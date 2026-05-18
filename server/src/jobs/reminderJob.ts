import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { supabase } from '../lib/database.js'
import { sendReminderEmail } from '../lib/email.js'
import { logger } from '../lib/logger.js'
import { mdc } from '../lib/mdc.js'

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
            logger.info('Reminder cron: checking for users to remind...')
            this.sendReminders().catch(err => {
                logger.error('Reminder cron error: {}', err.message, err)
            })
        })
        logger.info('Reminder cron job scheduled (0 * * * * — every hour)')
    }

    /**
     * Stop the reminder job
     */
    stop(): void {
        if (this.task) {
            this.task.stop()
            this.task = null
            logger.info('Reminder job stopped')
        }
    }

    /**
     * Find users whose reminder preferences match the current UTC day+hour
     * and send them a reminder email.
     */
    private async sendReminders(): Promise<void> {
        const jobRunId = randomUUID()
        await mdc.run({ jobRunId, jobName: 'reminder' }, async () => {
            const now = new Date()
        const utcDay = now.getUTCDay()   // 0 = Sunday, 6 = Saturday
        const utcHour = now.getUTCHours()
        const utcTimeStr = `${utcHour.toString().padStart(2, '0')}:00`

        logger.with('utcDay', utcDay).with('utcHour', utcTimeStr).info('Reminder cron: checking schedule')

        try {
            // Query users with matching reminder preferences
            const { data: users, error } = await supabase
                .from('users')
                .select('id, email, name')
                .eq('reminder_enabled', true)
                .eq('reminder_day', utcDay)
                .eq('reminder_time', utcTimeStr)

            if (error) {
                logger.error('Reminder cron: DB query error: {}', error.message, error)
                return
            }

            if (!users || users.length === 0) {
                logger.info('Reminder cron: no users to remind at this time')
                return
            }

            logger.with('userCount', users.length).info('Reminder cron: found users to remind')

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
                    logger.with('targetUserId', user.id).error('Reminder cron: failed for user: {}', err instanceof Error ? err.message : String(err), err)

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
                        logger.error('Reminder cron: failed to log error: {}', logErr instanceof Error ? logErr.message : String(logErr), logErr)
                    }
                }
            }

            logger.with('successCount', successCount).with('failCount', failCount).info('Reminder cron completed')
        } catch (err) {
            logger.error('Reminder cron: unexpected error: {}', err instanceof Error ? err.message : String(err), err)
        }
        })
    }

    /**
     * Run reminders immediately (for testing)
     */
    async runNow(): Promise<void> {
        await this.sendReminders()
    }
}

export const reminderJob = new ReminderJob()
