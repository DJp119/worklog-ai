import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { supabase } from '../../lib/database.js'
import { sendEmail } from '../../lib/email.js'
import { logger } from '../../lib/logger.js'
import { mdc } from '../../lib/mdc.js'

const LOOP_NAME = 'activation'
const COOLDOWN_DAYS = 7

class ActivationLoop {
  private task: cron.ScheduledTask | null = null

  start(): void {
    this.task = cron.schedule('0 9 * * 1', () => {
      logger.info('Activation loop: checking for stalled signups...')
      this.run().catch(err => {
        logger.error('Activation loop error: {}', err.message, err)
      })
    })
    logger.info('Activation loop scheduled (0 9 * * 1 — Mondays at 9 AM)')
  }

  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
      logger.info('Activation loop stopped')
    }
  }

  private async run(): Promise<void> {
    const jobRunId = randomUUID()
    await mdc.run({ jobRunId, jobName: LOOP_NAME }, async () => {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const { data: stalledUsers, error } = await supabase
          .from('users')
          .select(`
            id, email, name, preferred_language,
            user_profiles:user_profiles(preferred_language)
          `)
          .eq('email_verified', true)
          .lte('created_at', sevenDaysAgo)
          .not('id', 'in', (
            supabase
              .from('work_log_entries')
              .select('user_id')
              .gte('created_at', sevenDaysAgo)
          ).not('id', 'is', null) as any)

        if (error) {
          logger.error('Activation loop: query error: {}', error.message, error)
          return
        }

        if (!stalledUsers || stalledUsers.length === 0) {
          logger.info('Activation loop: no stalled users found')
          return
        }

        const { data: recentlyContacted } = await supabase
          .from('marketing_logs')
          .select('user_id')
          .eq('loop_name', LOOP_NAME)
          .gte(
            'created_at',
            new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
          )

        const contactedIds = new Set((recentlyContacted || []).map(r => r.user_id))
        const toContact = stalledUsers.filter(u => !contactedIds.has(u.id))

        if (toContact.length === 0) {
          logger.info('Activation loop: all stalled users already contacted within cooldown')
          return
        }

        let sent = 0
        for (const user of toContact) {
          try {
            const profilePref = (user as any).user_profiles?.preferred_language
            const lang = profilePref || user.preferred_language || 'en'
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
      <h1 style="color: #4F46E5; margin-top: 0;">Ready to log your first week?</h1>
      <p style="font-size: 16px;">${greeting},</p>
      <p style="font-size: 16px;">
        You signed up for Worklog AI — now it's time to put it to work. Logging your first week takes just 5 minutes.
      </p>
      <p style="font-size: 16px;">
        Once you have a few weeks logged, you can generate an AI-powered performance appraisal that writes itself.
      </p>
      <p style="margin: 30px 0; text-align: center;">
        <a href="${frontendUrl}/log"
          style="display: inline-block; padding: 14px 36px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Log Your First Week
        </a>
      </p>
      <p style="margin-top: 30px; color: #666; font-size: 13px; border-top: 1px solid #eee; padding-top: 16px;">
        You're receiving this because you signed up for Worklog AI.
      </p>
    </div>
  </div>
</body>
</html>`

            const result = await sendEmail({
              to: user.email,
              subject: 'Ready to log your first week? — Worklog AI',
              htmlBody,
            })

            await supabase.from('marketing_logs').insert({
              loop_name: LOOP_NAME,
              user_id: user.id,
              action: result.success ? 'email_sent' : 'email_failed',
              detail: { email: user.email },
            })

            if (result.success) sent++
          } catch (err) {
            logger.with('targetUserId', user.id).error('Activation loop: send failed: {}', err instanceof Error ? err.message : String(err), err)
            await supabase.from('marketing_logs').insert({
              loop_name: LOOP_NAME,
              user_id: user.id,
              action: 'email_failed',
              detail: { email: user.email, error: err instanceof Error ? err.message : 'Unknown' },
            })
          }
        }

        logger.with('found', stalledUsers.length).with('contacted', toContact.length).with('sent', sent).info('Activation loop completed')
      } catch (err) {
        logger.error('Activation loop: unexpected error: {}', err instanceof Error ? err.message : String(err), err)
      }
    })
  }

  async runNow(): Promise<void> {
    await this.run()
  }
}

export const activationLoop = new ActivationLoop()
