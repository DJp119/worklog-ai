import cron from 'node-cron'
import { logger } from '../lib/logger.js'
import { supabase } from '../lib/database.js'
import { sendEmail } from '../lib/email.js'
import { mdc } from '../lib/mdc.js'
import { randomUUID } from 'crypto'

const WEEKLY_DIGEST_TABLE = 'weekly_digest_subscriptions'

type DigestUser = {
  id: string
  email: string
  name: string | null
  subscription_type: 'all' | 'category' | 'bookmarked'
  preferred_category: string | null
}

class WeeklyDigestJob {
  private task: cron.ScheduledTask | null = null

  /**
   * Start the weekly digest cron job.
   * Sends every Monday at 9:00 AM.
   */
  start(): void {
    this.task = cron.schedule('0 9 * * 1', async () => {
      logger.info('Starting weekly digest job...')
      try {
        await this.sendWeeklyDigests()
      } catch (err: any) {
        logger.error('Weekly digest job failed: {}', err.message)
      }
    })

    logger.info('Weekly digest job scheduled (0 9 * * 1 - Mondays at 9 AM)')
  }

  /** Stop the cron job */
  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
      logger.info('Weekly digest cron job stopped')
    }
  }

  /**
   * Send weekly digest emails to all subscribers
   */
  private async sendWeeklyDigests(): Promise<void> {
    const jobRunId = randomUUID()
    await mdc.run({ jobRunId, jobName: 'weekly_digest' }, async () => {
      // Get all subscribers from the user_profiles table (users with digest_enabled)
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, user_id, job_title')

      if (profilesError) {
        logger.error('Failed to fetch user profiles: {}', profilesError.message)
        return
      }

      // Get top articles from the past week
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: topArticles, error: articlesError } = await supabase
        .from('ai_articles')
        .select('title, slug, summary, source_name, published_at')
        .gte('published_at', oneWeekAgo)
        .order('published_at', { ascending: false })
        .limit(5)

      if (articlesError) {
        logger.error('Failed to fetch articles: {}', articlesError.message)
        return
      }

      if (!topArticles || topArticles.length === 0) {
        logger.info('No new articles to include in weekly digest')
        return
      }

      let sent = 0
      let failed = 0

      for (const profile of profiles || []) {
        // Get user email from users/auth table
        const { data: user } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', profile.user_id)
          .single()

        if (!user) continue

        const success = await this.sendDigestEmail(user.email, user.name, topArticles)
        if (success) sent++
        else failed++
      }

      logger.info(`Weekly digest completed: ${sent} sent, ${failed} failed`)
    })
  }

  /**
   * Send a single digest email
   */
  private async sendDigestEmail(
    to: string,
    name: string | null,
    articles: any[]
  ): Promise<boolean> {
    const greeting = name ? `Hi ${name}` : 'Hi there'
    const articlesHtml = articles
      .map(
        (article) => `
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #eee;">
            <h3 style="margin: 0 0 8px; font-size: 16px; color: #111827;">${article.title}</h3>
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">${article.summary.slice(0, 200)}...</p>
            <a href="${process.env.FRONTEND_URL}/ai-pulse/articles/${article.slug}"
               style="color: #4F46E5; text-decoration: none; font-size: 13px; font-weight: 500;">
              Read more on AI Pulse
            </a>
          </td>
        </tr>
      `
      )
      .join('')

    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="color: #4F46E5; margin-top: 0;">AI Pulse Weekly Digest</h1>
      <p style="font-size: 16px;">${greeting},</p>
      <p style="font-size: 16px;">
        Here are the top AI stories from this week:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        ${articlesHtml}
      </table>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/ai-pulse"
           style="display: inline-block; padding: 14px 36px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          View All Stories
        </a>
      </p>
      <p style="margin-top: 30px; color: #666; font-size: 13px; border-top: 1px solid #eee; padding-top: 16px;">
        AI Pulse from Worklog AI
      </p>
    </div>
  </div>
</body>
</html>`

    const result = await sendEmail({
      to,
      subject: 'AI Pulse Weekly Digest - Top AI Stories',
      htmlBody,
    })

    return result.success
  }

  /** Send digest immediately (for testing) */
  async sendNow(): Promise<void> {
    await this.sendWeeklyDigests()
  }
}

export const weeklyDigestJob = new WeeklyDigestJob()
