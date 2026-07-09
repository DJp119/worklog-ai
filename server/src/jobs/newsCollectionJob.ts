import { logger } from '../lib/logger.js'
import { fetchRSSFeed, generateSlug, RSSItem, FREE_RSS_SOURCES } from '../lib/newsService.js'
import { supabase } from '../lib/database.js'
import { randomUUID } from 'crypto'
import { mdc } from '../lib/mdc.js'
import { generateArticleSummary } from '../lib/aiSummaryService.js'
import { startJob } from '../lib/scheduler.js'

let isRunning = false

export async function collectNews(): Promise<void> {
  if (isRunning) {
    logger.info('News collection skipped - already running')
    return
  }
  isRunning = true
  const jobRunId = randomUUID()
  try {
    await mdc.run({ jobRunId, jobName: 'news_collection' }, async () => {
      logger.info('Starting news collection from RSS feeds', { sources: FREE_RSS_SOURCES.length })

      let totalNewArticles = 0
      let totalDuplicates = 0

      for (const source of FREE_RSS_SOURCES) {
        try {
          const items = await fetchRSSFeed(source.url, source.name, source.category)
          logger.info(`Fetched ${items.length} items from ${source.name}`)

          for (const item of items) {
            const { inserted, duplicate } = await storeArticle(item)
            if (inserted) totalNewArticles++
            if (duplicate) totalDuplicates++
          }
        } catch (err) {
          logger.error(`Failed to fetch from ${source.name}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      logger.info(
        `News collection completed: ${totalNewArticles} new articles, ${totalDuplicates} duplicates skipped`
      )
    })
  } finally {
    isRunning = false
  }
}

/**
 * Store an RSS item as an article in the database.
 * Returns whether it was inserted and whether it was a duplicate.
 */
async function storeArticle(item: RSSItem): Promise<{ inserted: boolean; duplicate: boolean }> {
  try {
    // Generate a unique slug
    const baseSlug = generateSlug(item.title)
    const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`

    // Check for duplicates by URL
    const { data: existing } = await supabase
      .from('ai_articles')
      .select('id')
      .eq('source_url', item.url)
      .limit(1)

    if (existing && existing.length > 0) {
      return { inserted: false, duplicate: true }
    }

    // Generate AI summary if API key is available
    const aiSummary = await generateArticleSummary(item.title, item.summary, item.source)

    const { error } = await supabase.from('ai_articles').insert({
      title: item.title,
      slug,
      summary: aiSummary?.summary || item.summary,
      content: item.summary,
      source_url: item.url,
      source_name: item.source,
      category: (aiSummary?.category as any) || (item.category as any),
      published_at: item.published_at,
      impact_summary: aiSummary?.impact_summary || `From ${item.source}: ${item.summary.slice(0, 200)}`,
      thumbnail_url: null,
      views_count: 0,
      bookmark_count: 0,
      share_count: 0,
    })

    if (error) {
      // Unique constraint or other error
      if (error.message.includes('duplicate')) {
        return { inserted: false, duplicate: true }
      }
      logger.error('Failed to insert article:', error.message)
      return { inserted: false, duplicate: false }
    }

    return { inserted: true, duplicate: false }
  } catch (err) {
    logger.error('Error storing article:', err)
    return { inserted: false, duplicate: false }
  }
}

export const newsCollectionJob = startJob('news_collection', '*/30 * * * *', collectNews)
