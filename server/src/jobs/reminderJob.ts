import cron from 'node-cron'
import { supabase } from '../lib/database.js'
import { sendEmail, createEmailVerificationLink } from '../lib/email.js'

interface ReminderUser {
    id: string
    email: string
}

class ReminderJob {
    private task: cron.ScheduledTask | null = null

    /**
     * Start the weekly reminder job
     * Runs every Monday at 9:00 AM user's local time
     */
    start(): void {
        console.log('Reminder job initialized (email sending disabled - use custom auth emails)')
        return
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
     * Send reminders to all users (disabled for custom auth migration)
     */
    private async sendReminders(): Promise<void> {
        console.log('Reminder job: Email reminders disabled. Use Brevo for sending verification/password reset emails.')
    }

    /**
     * Run reminders immediately (for testing)
     */
    async runNow(): Promise<void> {
        await this.sendReminders()
    }
}

export const reminderJob = new ReminderJob()
