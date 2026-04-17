import cron from 'node-cron'
import { supabase } from '../lib/supabase.js'
import { sendWeeklyReminder } from '../lib/email.js'

interface ReminderUser {
  id: string
  email: string
  last_log_week?: string
}

class ReminderJob {
  private task: cron.ScheduledTask | null = null

  /**
   * Start the weekly reminder job
   * Runs every Monday at 9:00 AM
   */
  start(): void {
    if (this.task) {
      console.log('Reminder job already running')
      return
    }

    // Every Monday at 9:00 AM
    this.task = cron.schedule('0 9 * * 1', async () => {
      console.log('Running weekly reminder job...')
      await this.sendReminders()
    }, {
      timezone: 'America/New_York', // Adjust to your timezone
    })

    console.log('Weekly reminder job scheduled for Mondays at 9:00 AM')
  }

  /**
   * Stop the reminder job
   */
  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
      console.log('Reminder job stopped')
    }
  }

  /**
   * Send reminders to all users
   */
  private async sendReminders(): Promise<void> {
    try {
      // Get all users
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, email')

      if (error) {
        console.error('Failed to fetch users:', error)
        return
      }

      if (!users || users.length === 0) {
        console.log('No users found')
        return
      }

      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - 7)
      const weekStartStr = weekStart.toISOString().split('T')[0]

      let sent = 0
      let failed = 0

      // Send reminder to each user
      for (const user of users) {
        try {
          await sendWeeklyReminder(user.email, weekStartStr)

          // Log the reminder
          await supabase.from('reminder_logs').insert({
            user_id: user.id,
            email_address: user.email,
            sent_at: new Date().toISOString(),
            status: 'sent',
          })

          sent++
        } catch (err) {
          console.error(`Failed to send reminder to ${user.email}:`, err)

          // Log the failure
          await supabase.from('reminder_logs').insert({
            user_id: user.id,
            email_address: user.email,
            sent_at: new Date().toISOString(),
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
          })

          failed++
        }
      }

      console.log(`Reminder job complete: ${sent} sent, ${failed} failed`)
    } catch (error) {
      console.error('Reminder job error:', error)
    }
  }
}

export const reminderJob = new ReminderJob()
