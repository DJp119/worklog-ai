import { randomUUID } from 'crypto'
import { supabase } from '../lib/database.js'
import { generateMonthlySummary } from '../lib/summaryService.js'
import { logger } from '../lib/logger.js'
import { mdc } from '../lib/mdc.js'
import { startJob } from '../lib/scheduler.js'

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

export async function generateAllSummaries(): Promise<void> {
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

export const monthlySummaryJob = startJob('monthly_summary', '0 2 1 * *', generateAllSummaries)
