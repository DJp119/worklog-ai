import dotenv from 'dotenv'
import { logger } from './logger.js'

dotenv.config()

const BREVO_API_KEY = process.env.BREVO_API_KEY || ''
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || 'xtate62@gmail.com'
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Worklog AI'

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || ''

const SUPPORTED_EMAIL_LANGS = new Set([
  'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'tr',
  'ar', 'he', 'hi', 'bn', 'id', 'vi', 'th', 'ja', 'ko', 'zh',
])

// Memoized email string translations (process-lifetime cache).
// Key: "<lang>:<source-text>" → translated text. Avoids repeated API calls.
const emailTranslationCache = new Map<string, string>()

/**
 * Translate a static email string into the target language via Google Translate.
 * Returns the original English string if:
 *   - lang is 'en' or unsupported
 *   - GOOGLE_TRANSLATE_API_KEY is not set
 *   - API call fails
 * Process-lifetime memoized so repeated identical sends are free.
 */
async function tx(text: string, lang: string): Promise<string> {
  const normalized = lang.split('-')[0].toLowerCase()
  if (normalized === 'en' || !SUPPORTED_EMAIL_LANGS.has(normalized)) return text
  if (!GOOGLE_TRANSLATE_API_KEY) return text

  const cacheKey = `${normalized}:${text}`
  const cached = emailTranslationCache.get(cacheKey)
  if (cached !== undefined) return cached

  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: [text], target: normalized, format: 'text' }),
      }
    )
    if (!res.ok) return text
    const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } }
    const translated = data?.data?.translations?.[0]?.translatedText
    if (translated && translated.trim()) {
      emailTranslationCache.set(cacheKey, translated)
      return translated
    }
  } catch (err) {
    logger.with('err', err).warn('Email translation failed for {} (lang={}); using English', text.slice(0, 40), normalized)
  }
  return text
}

/** Exported alias so other modules (e.g. weeklyDigestJob) can localize their own static strings. */
export const translateStatic = tx

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
    logger.warn('Brevo API key not configured - email not sent')
    return { success: false }
  }

  try {
    logger.with('to', options.to).info('Sending email via Brevo')
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
      logger
        .with('status', response.status)
        .with('statusText', response.statusText)
        .with('errorData', errorData)
        .error('Brevo API error')
      return { success: false }
    }

    logger.info('Email sent successfully via Brevo')
    return { success: true }
  } catch (error) {
    logger.error('Send email error: {}', error instanceof Error ? error.message : String(error), error)
    return { success: false }
  }
}

/**
 * Create email verification link
 */
export function createEmailVerificationLink(userId: string, emailToken: string): string {
  // FRONTEND_URL may be comma-separated for CORS; use only the first (primary) URL for links
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()
  return `${frontendUrl}/verify-email?token=${emailToken}&userId=${userId}`
}

/**
 * Create password reset link
 */
export function createPasswordResetLink(userId: string, resetToken: string): string {
  // FRONTEND_URL may be comma-separated for CORS; use only the first (primary) URL for links
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()
  return `${frontendUrl}/reset-password?token=${resetToken}&userId=${userId}`
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(to: string, userId: string, emailToken: string, lang: string = 'en'): Promise<boolean> {
  const link = createEmailVerificationLink(userId, emailToken)

  const [heading, intro, button, copyHint, expiryNote, subject, textIntro] = await Promise.all([
    tx('Welcome to Worklog AI!', lang),
    tx('Thanks for signing up. Please verify your email address to get started.', lang),
    tx('Verify Email Address', lang),
    tx('Or copy and paste this link into your browser:', lang),
    tx('This link will expire in 24 hours. If you didn\'t create an account, you can ignore this email.', lang),
    tx('Verify your email - Worklog AI', lang),
    tx('Welcome to Worklog AI! Thanks for signing up. Please verify your email by visiting this link:', lang),
  ])

  const htmlBody = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #4F46E5;">${heading}</h1>
    <p>${intro}</p>
    <p style="margin: 30px 0;">
      <a href="${link}"
        style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
        ${button}
      </a>
    </p>
    <p>${copyHint}</p>
    <p style="word-break: break-all; color: #4F46E5;">${link}</p>
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      ${expiryNote}
    </p>
  </div>
</body>
</html>
`

  const textBody = `${heading}\n\n${textIntro}\n${link}\n\n${expiryNote}`

  const result = await sendEmail({
    to,
    subject,
    htmlBody,
    textBody,
  })

  return result.success
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to: string, userId: string, resetToken: string, lang: string = 'en'): Promise<boolean> {
  const link = createPasswordResetLink(userId, resetToken)

  const [heading, intro, button, copyHint, expiryNote, subject, textIntro] = await Promise.all([
    tx('Password Reset', lang),
    tx('You requested a password reset. Click the button below to set a new password:', lang),
    tx('Reset Password', lang),
    tx('Or copy and paste this link into your browser:', lang),
    tx('This link will expire in 1 hour. If you didn\'t request a password reset, you can ignore this email.', lang),
    tx('Password Reset - Worklog AI', lang),
    tx('You requested a password reset. Visit this link to reset your password:', lang),
  ])

  const htmlBody = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #4F46E5;">${heading}</h1>
    <p>${intro}</p>
    <p style="margin: 30px 0;">
      <a href="${link}"
        style="display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
        ${button}
      </a>
    </p>
    <p>${copyHint}</p>
    <p style="word-break: break-all; color: #4F46E5;">${link}</p>
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      ${expiryNote}
    </p>
  </div>
</body>
</html>
`

  const textBody = `${heading}\n\n${textIntro}\n${link}\n\n${expiryNote}`

  const result = await sendEmail({
    to,
    subject,
    htmlBody,
    textBody,
  })

  return result.success
}

/**
 * Send weekly worklog reminder email
 */
export async function sendReminderEmail(to: string, userName?: string, lang: string = 'en'): Promise<boolean> {
  // FRONTEND_URL may be comma-separated for CORS; use only the first (primary) URL for links
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim()
  const logUrl = `${frontendUrl}/log`
  const settingsUrl = `${frontendUrl}/settings`

  const [hiNamed, hiAnon, heading, intro1, intro2, button, footerHint, manageLink, subject] = await Promise.all([
    userName ? tx(`Hi ${userName}`, lang) : Promise.resolve(''),
    tx('Hi there', lang),
    tx('⚡ Time to Log Your Work', lang),
    tx("It's time for your weekly work log! Take 5 minutes to reflect on what you accomplished, the challenges you faced, and what you learned.", lang),
    tx('Consistent logging makes your appraisal season a breeze — no more scrambling to remember what you did months ago.', lang),
    tx('Log Your Week', lang),
    tx("You're receiving this because you have weekly reminders enabled.", lang),
    tx('Manage reminder preferences', lang),
    tx('⚡ Weekly Reminder: Log Your Work — Worklog AI', lang),
  ])

  const greeting = userName ? hiNamed : hiAnon

  const htmlBody = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="color: #4F46E5; margin-top: 0;">${heading}</h1>
      <p style="font-size: 16px;">${greeting},</p>
      <p style="font-size: 16px;">
        ${intro1}
      </p>
      <p style="font-size: 16px;">
        ${intro2}
      </p>
      <p style="margin: 30px 0; text-align: center;">
        <a href="${logUrl}"
          style="display: inline-block; padding: 14px 36px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
          ${button}
        </a>
      </p>
      <p style="margin-top: 30px; color: #666; font-size: 13px; border-top: 1px solid #eee; padding-top: 16px;">
        ${footerHint}
        <a href="${settingsUrl}" style="color: #4F46E5; text-decoration: none;">${manageLink}</a>
      </p>
    </div>
  </div>
</body>
</html>
`

  const textBody = `${greeting},\n\n${intro1}\n\n${button}: ${logUrl}\n\n${footerHint} ${manageLink}: ${settingsUrl}`

  const result = await sendEmail({
    to,
    subject,
    htmlBody,
    textBody,
  })

  return result.success
}
