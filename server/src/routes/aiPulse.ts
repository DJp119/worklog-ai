import { Router, Request, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/database.js'
import { logger } from '../lib/logger.js'
import { newsCollectionJob } from '../jobs/newsCollectionJob.js'


export const aiPulseRoutes = Router()

/**
 * Utility to parse PostgreSQL array string representation (e.g. '{"a","b"}')
 * into a standard JavaScript string array. Bypasses if already an array.
 */
function parsePostgresArray(val: any): string[] {
  if (Array.isArray(val)) {
    return val
  }
  if (typeof val !== 'string') {
    return []
  }

  const str = val.trim()
  if (!str.startsWith('{') || !str.endsWith('}')) {
    return str ? [str] : []
  }

  const content = str.slice(1, -1)
  if (!content) {
    return []
  }

  const result: string[] = []
  let current = ''
  let inQuotes = false
  let escaped = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (escaped) {
      current += char
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result.map(item => {
    if (item.startsWith('"') && item.endsWith('"')) {
      return item.slice(1, -1)
    }
    return item
  })
}


// ============================================
// Public Routes (No Auth Required)
// ============================================

// GET /api/ai-pulse/articles - Get all articles (public, with optional filtering)
aiPulseRoutes.get('/articles', async (req: Request, res: Response) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query

    let query = supabase
      .from('ai_articles')
      .select('*')
      .order('published_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching articles:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch articles' })
    }

    res.json({ success: true, data })
  } catch (err: any) {
    console.error('Error in GET /api/ai-pulse/articles:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/ai-pulse/articles/:slug - Get single article by slug
aiPulseRoutes.get('/articles/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const { data, error } = await supabase
      .from('ai_articles')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    // View count increment deferred to batch job (save API calls in Phase 0)
    res.json({ success: true, data })
  } catch (err: any) {
    console.error('Error fetching article:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/ai-pulse/impact-cards - Get all impact cards (public)
aiPulseRoutes.get('/impact-cards', async (req: Request, res: Response) => {
  try {
    const { industry } = req.query

    let query = supabase
      .from('ai_impact_cards')
      .select('*')
      .order('created_at', { ascending: false })

    if (industry) {
      query = query.eq('industry', industry)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching impact cards:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch impact cards' })
    }

    const formattedData = (data || []).map(card => ({
      ...card,
      companies_involved: parsePostgresArray(card.companies_involved),
      opportunities: parsePostgresArray(card.opportunities),
      risks: parsePostgresArray(card.risks),
      tools: parsePostgresArray(card.tools)
    }))

    res.json({ success: true, data: formattedData })
  } catch (err: any) {
    console.error('Error in GET /api/ai-pulse/impact-cards:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/ai-pulse/impact-cards/:industry - Get single impact card by industry
aiPulseRoutes.get('/impact-cards/:industry', async (req: Request, res: Response) => {
  try {
    const { industry } = req.params

    const { data, error } = await supabase
      .from('ai_impact_cards')
      .select('*')
      .eq('industry', industry)
      .single()

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Impact card not found' })
    }

    const formattedData = {
      ...data,
      companies_involved: parsePostgresArray(data.companies_involved),
      opportunities: parsePostgresArray(data.opportunities),
      risks: parsePostgresArray(data.risks),
      tools: parsePostgresArray(data.tools)
    }

    res.json({ success: true, data: formattedData })
  } catch (err: any) {
    console.error('Error fetching impact card:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ============================================
// Protected Routes (Auth Required)
// ============================================

// GET /api/ai-pulse/bookmarks - Get user's bookmarks
aiPulseRoutes.get('/bookmarks', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const { data, error } = await supabase
      .from('user_bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching bookmarks:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch bookmarks' })
    }

    res.json({ success: true, data })
  } catch (err: any) {
    console.error('Error in GET /api/ai-pulse/bookmarks:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/ai-pulse/bookmarks - Create bookmark
aiPulseRoutes.post('/bookmarks', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { article_id, impact_card_id } = req.body

    // Validate that exactly one of article_id or impact_card_id is provided
    if ((!article_id && !impact_card_id) || (article_id && impact_card_id)) {
      return res.status(400).json({
        success: false,
        error: 'Provide exactly one of: article_id or impact_card_id',
      })
    }

    const { data, error } = await supabase
      .from('user_bookmarks')
      .insert({
        user_id: userId,
        article_id: article_id || null,
        impact_card_id: impact_card_id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating bookmark:', error)
      return res.status(500).json({ success: false, error: 'Failed to create bookmark' })
    }

    res.json({ success: true, data })
  } catch (err: any) {
    console.error('Error in POST /api/ai-pulse/bookmarks:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/ai-pulse/bookmarks/:id - Delete bookmark
aiPulseRoutes.delete('/bookmarks/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { error } = await supabase
      .from('user_bookmarks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting bookmark:', error)
      return res.status(500).json({ success: false, error: 'Failed to delete bookmark' })
    }

    res.json({ success: true })
  } catch (err: any) {
    console.error('Error in DELETE /api/ai-pulse/bookmarks:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ============================================
// Admin Routes (Content Management - Manual Only for Phase 0)
// ============================================

// POST /api/ai-pulse/admin/articles - Create article (manual curation)
// NOTE: For Phase 0, this requires manual enablement. Consider adding API key auth.
aiPulseRoutes.post('/admin/articles', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication (API key or service role)
    // For Phase 0, this is disabled - uncomment to enable
    // res.status(403).json({ success: false, error: 'Admin access required' })
    // return

    const {
      title,
      slug,
      summary,
      content,
      source_url,
      source_name,
      category,
      published_at,
      impact_summary,
      thumbnail_url,
    } = req.body

    const { data, error } = await supabase
      .from('ai_articles')
      .insert({
        title,
        slug,
        summary,
        content,
        source_url,
        source_name,
        category,
        published_at: published_at || new Date().toISOString(),
        impact_summary,
        thumbnail_url,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating article:', error)
      return res.status(500).json({ success: false, error: 'Failed to create article' })
    }

    res.json({ success: true, data })
  } catch (err: any) {
    console.error('Error in POST /api/ai-pulse/admin/articles:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/ai-pulse/admin/impact-cards - Create impact card (manual curation)
aiPulseRoutes.post('/admin/impact-cards', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication (API key or service role)
    // For Phase 0, this is disabled

    const {
      slug,
      industry,
      industry_display_name,
      what_changed,
      impact_level,
      companies_involved,
      future_prediction,
      opportunities,
      risks,
      tools,
    } = req.body

    const { data, error } = await supabase
      .from('ai_impact_cards')
      .insert({
        slug,
        industry,
        industry_display_name,
        what_changed,
        impact_level,
        companies_involved,
        future_prediction,
        opportunities,
        risks,
        tools,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating impact card:', error)
      return res.status(500).json({ success: false, error: 'Failed to create impact card' })
    }

    res.json({ success: true, data })
  } catch (err: any) {
    console.error('Error in POST /api/ai-pulse/admin/impact-cards:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ============================================
// Phase 1: Personalization - "For You" Feed
// ============================================

// GET /api/ai-pulse/for-you - Personalized article feed (protected)
aiPulseRoutes.get('/for-you', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    // Get user's bookmarked categories
    const { data: bookmarks, error: bookmarkError } = await supabase
      .from('user_bookmarks')
      .select('article_id, ai_articles!inner(category)')
      .eq('user_id', userId)
      .limit(20)

    if (bookmarkError) {
      logger.error('Error fetching bookmarks for for-you:', bookmarkError)
      // Fallback to trending articles
      const { data, error } = await supabase
        .from('ai_articles')
        .select('*')
        .order('views_count', { ascending: false })
        .limit(6)

      if (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch articles' })
      }
      return res.json({ success: true, data: data || [], personalized: false })
    }

    // Extract preferred categories from bookmarks
    const categoryCounts: Record<string, number> = {}
    for (const b of (bookmarks as any[]) || []) {
      const cat = b.ai_articles?.category
      if (cat) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
      }
    }

    const preferredCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat)

    if (preferredCategories.length === 0) {
      // No bookmark history - return trending
      const { data, error } = await supabase
        .from('ai_articles')
        .select('*')
        .order('views_count', { ascending: false })
        .limit(6)

      if (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch articles' })
      }
      return res.json({ success: true, data: data || [], personalized: false })
    }

    // Return articles from preferred categories, mixing with recent articles
    const { data, error } = await supabase
      .from('ai_articles')
      .select('*')
      .in('category', preferredCategories)
      .order('published_at', { ascending: false })
      .limit(6)

    if (error) {
      return res.status(500).json({ success: false, error: 'Failed to fetch personalized articles' })
    }

    res.json({ success: true, data: data || [], personalized: true })
  } catch (err: any) {
    logger.error('Error in GET /api/ai-pulse/for-you:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ============================================
// Phase 1: Dynamic OG Image Generation
// ============================================

// GET /api/ai-pulse/og/article/:slug - Generate OG image for article share
aiPulseRoutes.get('/og/article/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()

    // Fetch article
    const { data: article, error } = await supabase
      .from('ai_articles')
      .select('title, source_name, category, published_at')
      .eq('slug', slug)
      .single()

    if (error || !article) {
      return res.status(404).json({ success: false, error: 'Article not found' })
    }

    // Build OG image as HTML for puppeteer or return SVG
    const title = String(article.title || 'AI Pulse Article')
    const source = String(article.source_name || 'AI Pulse')
    const category = String(article.category || 'AI News')
    const date = article.published_at
      ? new Date(article.published_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : ''

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <rect width="1200" height="630" fill="#111827"/>
      <rect x="60" y="60" width="8" height="470" rx="4" fill="#4F46E5"/>
      <text x="80" y="120" fill="#ffffff" font-family="Arial, sans-serif" font-size="18" font-weight="500" letter-spacing="2">${source.toUpperCase()}</text>
      <text x="80" y="220" fill="#ffffff" font-family="Arial, sans-serif" font-size="48" font-weight="700" width="1060" style="dominant-baseline:auto">
        ${title.length > 90 ? title.slice(0, 90) + '...' : title}
      </text>
      <text x="80" y="360" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="20">${category} / ${date}</text>
      <text x="80" y="520" fill="#ffffff" font-family="Arial, sans-serif" font-size="24" font-weight="500">AI Pulse</text>
      <text x="80" y="550" fill="#9CA3AF" font-family="Arial, sans-serif" font-size="16">Stay ahead with AI intelligence</text>
      <rect x="900" y="500" width="200" height="50" rx="4" fill="#4F46E5" opacity="0.9"/>
      <text x="1000" y="531" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="600" text-anchor="middle">Read on AI Pulse</text>
    </svg>`

    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(svg)
  } catch (err: any) {
    logger.error('Error generating OG image:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/ai-pulse/og/article/:slug.png - OG image for article (PNG placeholder - requires puppeteer)
aiPulseRoutes.get('/og/article/:slug.png', async (req: Request, res: Response) => {
  // For Phase 1, redirect to the SVG version (Phase 2 will add puppeteer for PNG generation)
  res.redirect(`/api/ai-pulse/og/article/${req.params.slug}`)
})

// POST /api/ai-pulse/admin/collect-news - Manually trigger RSS news collection (e.g. via CRON job trigger)
aiPulseRoutes.post('/admin/collect-news', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const adminKey = process.env.ADMIN_API_KEY

    // Simple security layer: if ADMIN_API_KEY is configured in env, require it as Bearer token
    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      logger.warn('Unauthorized attempt to trigger manual news collection')
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    logger.info('Manual news collection triggered via admin endpoint')
    // Run collection in background so the request doesn't timeout
    newsCollectionJob.collectNow().catch((err) => {
      logger.error('Error running manually triggered news collection: {}', err.message)
    })

    res.json({ success: true, message: 'News collection job triggered' })
  } catch (err: any) {
    logger.error('Failed to trigger manual news collection: {}', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})