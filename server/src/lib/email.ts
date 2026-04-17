import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.FROM_EMAIL

// Allow missing key for development (emails won't be sent without it)
let resendClient: Resend | null = null

if (!resendApiKey) {
  console.warn('Warning: RESEND_API_KEY not set. Email reminders will not be sent.')
  console.warn('Get a key at: https://resend.com')
} else {
  resendClient = new Resend(resendApiKey)
}

export const resend = resendClient

export interface SendReminderOptions {
  email: string
  weekStart: string
  frontendUrl: string
}

/**
 * Send weekly reminder email to user
 */
export async function sendWeeklyReminder(options: SendReminderOptions): Promise<void> {
  const { email, weekStart, frontendUrl } = options

  if (!resendClient) {
    console.log('Resend not configured, skipping email send (dev mode)')
    return
  }

  if (!fromEmail) {
    console.warn('FROM_EMAIL not configured, skipping email send')
    return
  }

  await resendClient.emails.send({
    from: fromEmail,
    to: email,
    subject: `Time to log your week (${weekStart})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Weekly Work Log Reminder</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4f46e5; margin-bottom: 16px;">Weekly Work Log Reminder</h2>

          <p>Hi there,</p>

          <p>It's time to log your work for the week starting <strong>${weekStart}</strong>.</p>

          <p>This should only take about 5 minutes. Your future self will thank you when appraisal time comes!</p>

          <div style="margin: 24px 0;">
            <a href="${frontendUrl}/log" style="
              background-color: #4f46e5;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              display: inline-block;
              font-weight: 500;
            ">Log Your Week</a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

          <p style="color: #666; font-size: 14px; margin: 0;">
            This email was sent because you're subscribed to Worklog AI reminders.
          </p>
        </body>
      </html>
    `,
  })

  console.log(`Reminder email sent to ${email}`)
}

/**
 * Send appraisal ready notification
 */
export async function sendAppraisalReadyNotification(
  email: string,
  periodStart: string,
  periodEnd: string,
  frontendUrl: string
): Promise<void> {
  if (!resendClient) {
    console.log('Resend not configured, skipping email send (dev mode)')
    return
  }

  if (!fromEmail) {
    console.warn('FROM_EMAIL not configured, skipping email send')
    return
  }

  await resendClient.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Your self-appraisal is ready!',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Your Appraisal is Ready</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981; margin-bottom: 16px;">Your Self-Appraisal is Ready!</h2>

          <p>Hi there,</p>

          <p>Great news! Your self-appraisal for the period <strong>${periodStart}</strong> to <strong>${periodEnd}</strong> has been generated.</p>

          <p>Review it, make any adjustments, and you're ready to submit!</p>

          <div style="margin: 24px 0;">
            <a href="${frontendUrl}/appraisals" style="
              background-color: #10b981;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              display: inline-block;
              font-weight: 500;
            ">View Your Appraisal</a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

          <p style="color: #666; font-size: 14px; margin: 0;">
            Worklog AI - Helping you track your impact
          </p>
        </body>
      </html>
    `,
  })

  console.log(`Appraisal ready notification sent to ${email}`)
}
