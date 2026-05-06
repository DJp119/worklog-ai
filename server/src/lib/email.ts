import dotenv from 'dotenv'

dotenv.config()

const BREVO_API_KEY = process.env.BREVO_API_KEY || ''
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'xtate62@gmail.com'
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Worklog AI'

interface SendEmailOptions {
  to: string
  subject: string
  htmlBody: string
  textBody?: string
}

/**
 * Send email via Brevo API
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
  if (!BREVO_API_KEY) {
    console.warn('Brevo API key not configured - email not sent')
    return { success: false }
  }

  try {
    console.log('Sending email via Brevo to:', options.to)
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: BREVO_FROM_EMAIL,
          name: BREVO_FROM_NAME,
        },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.htmlBody,
        textContent: options.textBody || '',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Brevo API error:', response.status, response.statusText, errorData)
      return { success: false }
    }

    console.log('Email sent successfully via Brevo')
    return { success: true }
  } catch (error) {
    console.error('Send email error:', error)
    return { success: false }
  }
}

/**
 * Create email verification link
 */
export function createEmailVerificationLink(userId: string, emailToken: string): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  return `${frontendUrl}/verify-email?token=${emailToken}&userId=${userId}`
}

/**
 * Create password reset link
 */
export function createPasswordResetLink(userId: string, resetToken: string): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
  return `${frontendUrl}/reset-password?token=${resetToken}&userId=${userId}`
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(to: string, userId: string, emailToken: string): Promise<boolean> {
  const link = createEmailVerificationLink(userId, emailToken)

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #4F46E5;">Welcome to Worklog AI!</h1>
    <p>Thanks for signing up. Please verify your email address to get started.</p>
    <p style="margin: 30px 0;">
      <a href="${link}"
        style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Verify Email Address
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #4F46E5;">${link}</p>
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      This link will expire in 24 hours.
      <br>If you didn't create an account, you can ignore this email.
    </p>
  </div>
</body>
</html>
`

  const textBody = `Welcome to Worklog AI!\n\nThanks for signing up. Please verify your email by visiting this link:\n${link}\n\nThis link will expire in 24 hours.`

  const result = await sendEmail({
    to,
    subject: 'Verify your email - Worklog AI',
    htmlBody,
    textBody,
  })

  return result.success
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to: string, userId: string, resetToken: string): Promise<boolean> {
  const link = createPasswordResetLink(userId, resetToken)

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #4F46E5;">Password Reset</h1>
    <p>You requested a password reset. Click the button below to set a new password:</p>
    <p style="margin: 30px 0;">
      <a href="${link}"
        style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Reset Password
      </a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #4F46E5;">${link}</p>
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      This link will expire in 1 hour.
      <br>If you didn't request a password reset, you can ignore this email.
    </p>
  </div>
</body>
</html>
`

  const textBody = `Password Reset Request\n\nYou requested a password reset. Visit this link to reset your password:\n${link}\n\nThis link will expire in 1 hour.`

  const result = await sendEmail({
    to,
    subject: 'Password Reset - Worklog AI',
    htmlBody,
    textBody,
  })

  return result.success
}
