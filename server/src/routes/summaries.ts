import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { generateMonthlySummary } from '../lib/summaryService.js'

export const summariesRoutes = Router()

/**
 * GET /api/summaries
 * Get all monthly summaries for current user
 */
summariesRoutes.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const supabase = req.supabase!

    const { data, error } = await supabase
      .from('monthly_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('month_year', { ascending: false })

    if (error) {
      console.error('Fetch summaries error:', error)
      return res.status(500).json({ success: false, error: 'Failed to fetch summaries' })
    }

    res.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Summaries error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * POST /api/summaries/generate
 * Force-generate a specific month's summary
 * Body: { monthYear: '2025-01-01' }
 */
summariesRoutes.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const { monthYear } = req.body

    if (!monthYear || typeof monthYear !== 'string' || !/^\d{4}-\d{2}-01$/.test(monthYear)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid monthYear. Must be YYYY-MM-01 format' 
      })
    }

    const summary = await generateMonthlySummary(userId, monthYear)

    if (!summary) {
      // It could be null because there are no logs
      return res.status(404).json({ 
        success: false, 
        error: 'No work logs found for this month, or generation failed' 
      })
    }

    res.status(200).json({ success: true, data: summary })
  } catch (error) {
    console.error('Generate summary error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})
