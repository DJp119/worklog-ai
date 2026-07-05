import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { supabase } from '../../lib/database.js'
import { sendEmail } from '../../lib/email.js'
import { logger } from '../../lib/logger.js'
import { mdc } from '../../lib/mdc.js'

const LOOP_NAME = 'dormancy_watch'
const INACTIVE_THRESHOLD_DAYS = 14
const COOLDOWN_DAYS = 21

class DormancyWatch {
  private task: cron.ScheduledTask | null = null

  start(): void {
    this.task = cron.schedule('0 10 * * *', () => {
      logger.info('Dormancy watch: checking for inactive users...')
      this.run().catch(err => {
        logger.error('Dormancy watch error: {}', err.message, err)
      })
    })
    logger.info('Dormancy watch scheduled (0 10 * * * — daily at 10 AM)')
  }

  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
      logger.info('Dormancy watch stopped')
    }
  }

  private async run(): Promise<void> {
    const jobRunId = randomUUID()
    await mdc.run({ jobRunId, jobName: LOOP_NAME }, async () => {
      try {
        const cutoffDate = new Date(Date.now() - INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()

        const { data: users, error: userError } = await supabase
          .from('users')
          .select('id, email, name, preferred_language, created_at')
          .eq('email_verified', true)

        if (userError) {
          logger.error('Dormancy watch: user query error: {}', userError.message, userError)
          return
        }

        if (!users || users.length === 0) {
          logger.info('Dormancy watch: no users found')
          return
        }

        const userIds = users.map(u => u.id)

        const { data: recentEntries } = await supabase
          .from('work_log_entries')
          .select('user_id')
          .in('user_id', userIds)
          .gte('created_at', cutoffDate)

        const activeUserIds = new Set((recentEntries || []).map(e => e.user_id))
        const dormantUsers = users.filter(u => !activeUserIds.has(u.id))

        if (dormantUsers.length === 0) {
          logger.info('Dormancy watch: no dormant users found')
          return
        }

        const { data: recentLogs } = await supabase
          .from('marketing_logs')
          .select('user_id')
          .eq('loop_name', LOOP_NAME)
          .in('user_id', dormantUsers.map(u => u.id))
          .gte(
            'created_at',
            new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
          )

        const contactedIds = new Set((recentLogs || []).map(r => r.user_id))
        const toContact = dormantUsers.filter(u => !contactedIds.has(u.id))

        if (toContact.length === 0) {
          logger.info('Dormancy watch: all dormant users already contacted within cooldown')
          return
        }

        await supabase.from('marketing_logs').insert({
          loop_name: LOOP_NAME,
          user_id: null,
          action: 'dormant_list_staged',
          detail: {
            total_dormant: dormantUsers.length,
            to_contact: toContact.length,
            user_ids: toContact.map(u => u.id),
            threshold_days: INACTIVE_THRESHOLD_DAYS,
          },
        })

        logger.with('totalDormant', dormantUsers.length).with('toContact', toContact.length).info('Dormancy watch: dormant users staged')

        let sent = 0
        for (const user of toContact) {
          try {
            const lang = user.preferred_language || 'en'
            const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()
            const greeting = user.name ? `Hi ${user.name}` : 'Hi there'

            const htmlBody = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="color: #4F46E5; margin-top: 0;">We miss you!</h1>
      <p style="font-size: 16px;">${greeting},</p>
      <p style="font-size: 16px;">
        It's been a while since you last logged your work. Your work logs are the foundation for AI-powered appraisals that save you hours during review season.
      </p>
      <p style="font-size: 16px;">
        Jump back in and pick up where you left off.
      </p>
      <p style="margin: 30px 0; text-align: center;">
        <a href="${frontendUrl}/log"
          style="display: inline-block; padding: 14px 36px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Log This Week
        </a>
      </p>
      <p style="margin-top: 30px; color: #666; font-size: 13px; border-top: 1px solid #eee; padding-top: 16px;">
        You're receiving this because you have a Worklog AI account.
      </p>
    </div>
  </div>
</body>
</html>`

            const result = await sendEmail({
              to: user.email,
              subject: 'We miss you! — Worklog AI',
              htmlBody,
            })

            await supabase.from('marketing_logs').insert({
              loop_name: LOOP_NAME,
              user_id: user.id,
              action: result.success ? 'email_sent' : 'email_failed',
              detail: { email: user.email, days_since_signup: Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000) },
            })

            if (result.success) sent++
          } catch (err) {
            logger.with('targetUserId', user.id).error('Dormancy watch: send failed: {}', err instanceof Error ? err.message : String(err), err)
            await supabase.from('marketing_logs').insert({
              loop_name: LOOP_NAME,
              user_id: user.id,
              action: 'email_failed',
              detail: { email: user.email, error: err instanceof Error ? err.message : 'Unknown' },
            })
          }
        }

        logger.with('totalDormant', dormantUsers.length).with('contacted', toContact.length).with('sent', sent).info('Dormancy watch completed')
      } catch (err) {
        logger.error('Dormancy watch: unexpected error: {}', err instanceof Error ? err.message : String(err), err)
      }
    })
  }

  async runNow(): Promise<void> {
    await this.run()
  }
}

export const dormancyWatch = new DormancyWatch()
