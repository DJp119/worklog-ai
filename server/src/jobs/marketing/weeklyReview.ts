import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { supabase } from '../../lib/database.js'
import { logger } from '../../lib/logger.js'
import { mdc } from '../../lib/mdc.js'

const LOOP_NAME = 'weekly_review'

class WeeklyReview {
  private task: cron.ScheduledTask | null = null

  start(): void {
    this.task = cron.schedule('0 6 * * 1', () => {
      logger.info('Weekly review: generating marketing metrics report...')
      this.run().catch(err => {
        logger.error('Weekly review error: {}', err.message, err)
      })
    })
    logger.info('Weekly review scheduled (0 6 * * 1 — Mondays at 6 AM)')
  }

  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
      logger.info('Weekly review stopped')
    }
  }

  private async run(): Promise<void> {
    const jobRunId = randomUUID()
    await mdc.run({ jobRunId, jobName: LOOP_NAME }, async () => {
      try {
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

        const [newUsers, activeLoggers, activationRate, dormantUsers, emailsSent] = await Promise.all([
          this.countNewUsers(weekAgo, twoWeeksAgo),
          this.countActiveLoggers(weekAgo),
          this.calcActivationRate(),
          this.countDormantUsers(),
          this.countEmailsSent(weekAgo),
        ])

        const report = {
          generated_at: now.toISOString(),
          period: {
            start: weekAgo,
            end: now.toISOString(),
          },
          metrics: {
            new_users: newUsers,
            active_loggers: activeLoggers,
            activation_rate: activationRate,
            dormant_users: dormantUsers,
            marketing_emails_sent: emailsSent,
          },
        }

        logger.with('report', report).info('Weekly marketing review')
      } catch (err) {
        logger.error('Weekly review: unexpected error: {}', err instanceof Error ? err.message : String(err), err)
      }
    })
  }

  private async countNewUsers(weekAgo: string, twoWeeksAgo: string): Promise<{ thisWeek: number; lastWeek: number }> {
    const { data: thisWeek } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo)

    const { data: lastWeek } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', twoWeeksAgo)
      .lt('created_at', weekAgo)

    return {
      thisWeek: thisWeek?.length ?? 0,
      lastWeek: lastWeek?.length ?? 0,
    }
  }

  private async countActiveLoggers(weekAgo: string): Promise<number> {
    const { data, error } = await supabase
      .from('work_log_entries')
      .select('user_id')
      .gte('created_at', weekAgo)

    if (error) {
      logger.error('Weekly review: active loggers query error: {}', error.message, error)
      return 0
    }

    const uniqueUsers = new Set((data || []).map((e: any) => e.user_id))
    return uniqueUsers.size
  }

  private async calcActivationRate(): Promise<number | null> {
    const { count: totalUsers, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('email_verified', true)

    if (countError || !totalUsers || totalUsers === 0) return null

    const { data: usersWithEntries } = await supabase
      .from('work_log_entries')
      .select('user_id')

    if (!usersWithEntries) return 0

    const uniqueActiveUsers = new Set(usersWithEntries.map((e: any) => e.user_id))
    return Math.round((uniqueActiveUsers.size / totalUsers) * 100)
  }

  private async countDormantUsers(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: users } = await supabase
      .from('users')
      .select('id')

    if (!users || users.length === 0) return 0

    const userIds = users.map(u => u.id)

    const { data: recentEntries } = await supabase
      .from('work_log_entries')
      .select('user_id')
      .in('user_id', userIds)
      .gte('created_at', cutoffDate)

    const activeIds = new Set((recentEntries || []).map((e: any) => e.user_id))
    return users.filter(u => !activeIds.has(u.id)).length
  }

  private async countEmailsSent(weekAgo: string): Promise<number> {
    const { count, error } = await supabase
      .from('marketing_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'email_sent')
      .gte('created_at', weekAgo)

    if (error) {
      logger.error('Weekly review: email count query error: {}', error.message, error)
      return 0
    }

    return count ?? 0
  }

  async runNow(): Promise<void> {
    await this.run()
  }
}

export const weeklyReview = new WeeklyReview()
