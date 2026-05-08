import cron from 'node-cron'
import { supabase } from '../lib/supabase.js'
import { generateMonthlySummary } from '../lib/summaryService.js'

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
  start(): void {
    // Run on 1st of every month at 2:00 AM
    cron.schedule('0 2 1 * *', () => {
      console.log('Starting monthly summary generation job...')
      this.generateAllSummaries().catch(err => {
        console.error('Error running monthly summary job:', err)
      })
    })
    console.log('Monthly summary cron job scheduled (0 2 1 * *)')
  }

  async generateAllSummaries(): Promise<void> {
    const lastMonth = getPreviousMonth() // e.g., '2025-04-01'
    
    // Find users with entries in that month
    const { data: users, error } = await supabase
      .from('work_log_entries')
      .select('user_id')
      .gte('week_start_date', lastMonth)
      .lt('week_start_date', getNextMonth(lastMonth))
    
    if (error) {
      console.error('Failed to fetch users for monthly summary:', error)
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
          console.error(`Failed to generate summary for user ${userId}:`, err)
          failureCount++
        }
      }
    }

    console.log(`Monthly summary job completed. Success: ${successCount}, Failures: ${failureCount}`)
  }
}

export const monthlySummaryJob = new MonthlySummaryJob()
