import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/supabase.js'
import { generateMonthlySummary } from '../lib/summaryService.js'
import { logger } from '../lib/logger.js'
import { mdc } from '../lib/mdc.js'

function getPreviousMonth(): string {
  const date = new Date()
  date.setDate(1) // Set to 1st of current month
  date.setMonth(date.getMonth() - 1) // Go back one month
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function getNextMonth(monthStr: string): string {
  const date = new Date(monthStr)
  date.setMonth(date.getMonth() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

class MonthlySummaryJob {
  private cronExpressions: cron.ScheduledTask[] = []

  start(): void {
    // Run on 1st of every month at 2:00 AM
    const task = cron.schedule('0 2 1 * *', () => {
      logger.info('Starting monthly summary generation job...')
      this.generateAllSummaries().catch(err => {
        logger.error('Error running monthly summary job: {}', err.message, err)
      })
    })
    this.cronExpressions.push(task)
    logger.info('Monthly summary cron job scheduled (0 2 1 * *)')
  }

  async generateAllSummaries(): Promise<void> {
    const jobRunId = randomUUID()
    await mdc.run({ jobRunId, jobName: 'monthly_summary' }, async () => {
      const lastMonth = getPreviousMonth() // e.g., '2025-04-01'
    
    // Find users with entries in that month
    const { data: users, error } = await supabase
      .from('work_log_entries')
      .select('user_id')
      .gte('week_start_date', lastMonth)
      .lt('week_start_date', getNextMonth(lastMonth))
    
    if (error) {
      logger.error('Failed to fetch users for monthly summary: {}', error.message, error)
      return
    }

    const uniqueUserIds = [...new Set(users?.map(u => u.user_id))]
    
    let successCount = 0
    let failureCount = 0

    for (const userId of uniqueUserIds) {
      // Check if summary already exists
      const { data: existing } = await supabase
        .from('monthly_summaries')
        .select('id')
        .eq('user_id', userId)
        .eq('month_year', lastMonth)
        .single()

      if (!existing) {
        try {
          const summary = await generateMonthlySummary(userId, lastMonth)
          if (summary) {
            successCount++
          } else {
            failureCount++
          }
        } catch (err) {
          logger.with('targetUserId', userId).error('Failed to generate summary for user: {}', err instanceof Error ? err.message : String(err), err)
          failureCount++
        }
      }
    }

    logger.with('successCount', successCount).with('failureCount', failureCount).info('Monthly summary job completed')
    })
  }

  stop(): void {
    this.cronExpressions.forEach(task => task.stop())
    this.cronExpressions = []
    logger.info('Monthly summary cron job stopped')
  }
}

export const monthlySummaryJob = new MonthlySummaryJob()
