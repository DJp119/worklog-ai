import cron from 'node-cron'
import { supabase } from '../lib/database.js'
import { sendReminderEmail } from '../lib/email.js'

interface ReminderUser {
    id: string
    email: string
    name: string | null
}

class ReminderJob {
    private task: cron.ScheduledTask | null = null

    /**
     * Start the hourly reminder job.
     * Runs at the top of every hour (minute 0).
     * Checks which users have reminder_enabled=true,
     * reminder_day matching the current UTC day-of-week,
     * and reminder_time matching the current UTC hour.
     */
    start(): void {
        // Run every hour at minute 0
        this.task = cron.schedule('0 * * * *', () => {
            console.log('Reminder cron: checking for users to remind...')
            this.sendReminders().catch(err => {
                console.error('Reminder cron error:', err)
            })
        })
        console.log('Reminder cron job scheduled (0 * * * * — every hour)')
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
     * Find users whose reminder preferences match the current UTC day+hour
     * and send them a reminder email.
     */
    private async sendReminders(): Promise<void> {
        const now = new Date()
        const utcDay = now.getUTCDay()   // 0 = Sunday, 6 = Saturday
        const utcHour = now.getUTCHours()
        const utcTimeStr = `${utcHour.toString().padStart(2, '0')}:00`

        console.log(`Reminder cron: UTC day=${utcDay}, hour=${utcTimeStr}`)

        try {
            // Query users with matching reminder preferences
            const { data: users, error } = await supabase
                .from('users')
                .select('id, email, name')
                .eq('reminder_enabled', true)
                .eq('reminder_day', utcDay)
                .eq('reminder_time', utcTimeStr)

            if (error) {
                console.error('Reminder cron: DB query error:', error)
                return
            }

            if (!users || users.length === 0) {
                console.log('Reminder cron: no users to remind at this time')
                return
            }

            console.log(`Reminder cron: found ${users.length} user(s) to remind`)

            let successCount = 0
            let failCount = 0

            for (const user of users as ReminderUser[]) {
                try {
                    const sent = await sendReminderEmail(user.email, user.name || undefined)

                    // Log the reminder attempt
                    await supabase.from('reminder_logs').insert({
                        user_id: user.id,
                        email_address: user.email,
                        status: sent ? 'sent' : 'failed',
                        error_message: sent ? null : 'Email send returned false',
                    })

                    if (sent) {
                        successCount++
                    } else {
                        failCount++
                    }
                } catch (err) {
                    failCount++
                    console.error(`Reminder cron: failed for user ${user.id}:`, err)

                    // Log the failure
                    try {
                        await supabase.from('reminder_logs').insert({
                            user_id: user.id,
                            email_address: user.email,
                            status: 'failed',
                            error_message: err instanceof Error ? err.message : 'Unknown error',
                        })
                    } catch (logErr) {
                        // don't let logging failure crash the loop
                        console.error('Reminder cron: failed to log error:', logErr)
                    }
                }
            }

            console.log(`Reminder cron completed. Sent: ${successCount}, Failed: ${failCount}`)
        } catch (err) {
            console.error('Reminder cron: unexpected error:', err)
        }
    }

    /**
     * Run reminders immediately (for testing)
     */
    async runNow(): Promise<void> {
        await this.sendReminders()
    }
}

export const reminderJob = new ReminderJob()
