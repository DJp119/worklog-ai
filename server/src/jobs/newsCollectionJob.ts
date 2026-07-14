import cron from 'node-cron'
import { logger } from '../lib/logger.js'
import { fetchRSSFeed, generateSlug, RSSItem, FREE_RSS_SOURCES } from '../lib/newsService.js'
import { supabase } from '../lib/database.js'
import { randomUUID } from 'crypto'
import { mdc } from '../lib/mdc.js'
import { generateArticleSummary } from '../lib/aiSummaryService.js'

class NewsCollectionJob {
  private task: cron.ScheduledTask | null = null
  private isRunning = false

  /**
   * Start the news collection cron job.
   * Phase 1: Fetches articles from RSS feeds every 6 hours.
   */
  start(): void {
    // Run every 30 minutes
    this.task = cron.schedule('*/30 * * * *', async () => {
      if (this.isRunning) {
        logger.info('News collection skipped - already running')
        return
      }
      this.isRunning = true
      logger.info('Starting news collection job...')
      try {
        await this.collectNews()
      } catch (err: any) {
        logger.error('News collection job failed: {}', err.message)
      } finally {
        this.isRunning = false
      }
    })

    logger.info('News collection job scheduled (*/30 * * * * - every 30 minutes)')
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
      logger.info('News collection cron job stopped')
    }
  }

  /**
   * Main collection logic - fetch from all RSS sources
   */
  private async collectNews(): Promise<void> {
    const jobRunId = randomUUID()
    await mdc.run({ jobRunId, jobName: 'news_collection' }, async () => {
      logger.info('Starting news collection from RSS feeds', { sources: FREE_RSS_SOURCES.length })

      let totalNewArticles = 0
      let totalDuplicates = 0

      for (const source of FREE_RSS_SOURCES) {
        try {
          const items = await fetchRSSFeed(source.url, source.name, source.category)
          logger.info(`Fetched ${items.length} items from ${source.name}`)

          for (const item of items) {
            const { inserted, duplicate } = await this.storeArticle(item)
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
  }

  /**
   * Store an RSS item as an article in the database.
   * Returns whether it was inserted and whether it was a duplicate.
   */
  private async storeArticle(item: RSSItem): Promise<{ inserted: boolean; duplicate: boolean }> {
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

  /**
   * Collect articles from all sources immediately (for testing)
   */
  async collectNow(): Promise<void> {
    await this.collectNews()
  }
}

export const newsCollectionJob = new NewsCollectionJob()
