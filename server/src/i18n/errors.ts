/**
 * Server-side error message i18n.
 *
 * English is the source of truth. Translations for other languages go
 * through Google Translate on demand, with a process-lifetime memo cache
 * (same pattern as server/src/lib/email.ts). The cache is best-effort:
 * a translation failure falls back to the English string.
 *
 * To localize a new error:
 *   1. Add a key to SERVER_ERRORS below.
 *   2. Call `getErrorMessage(req, 'yourKey', { params })` in the route.
 */

import type { Request } from 'express'
import { logger } from '../lib/logger.js'

export const SERVER_ERRORS = {
  // Generic
  internal: 'Internal server error',
  notFound: 'Not found',
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  rateLimited: 'Too many requests, please try again later',

  // Auth
  emailPasswordRequired: 'Email and password required',
  validEmailRequired: 'Valid email required',
  emailAlreadyRegistered: 'Email already registered',
  failedToCreateAccount: 'Failed to create account',
  invalidCredentials: 'Invalid email or password',
  emailNotVerified: 'Please verify your email before logging in',
  userNotFound: 'User not found',
  userIdAndTokenRequired: 'User ID and token required',
  invalidOrExpiredToken: 'Invalid or expired verification token',
  tokenExpired: 'Token has expired',
  failedToVerifyEmail: 'Failed to verify email',
  pleaseWaitVerification: 'Please wait before requesting another verification email',
  failedToResendVerification: 'Failed to resend verification email',
  refreshTokenRequired: 'Refresh token required',
  invalidRefreshToken: 'Invalid or expired refresh token',
  currentAndNewPasswordRequired: 'Current password and new password required',
  currentPasswordIncorrect: 'Current password is incorrect',
  failedToUpdatePassword: 'Failed to update password',
  passwordUpdated: 'Password updated successfully. Please log in again.',
  failedToDeleteAccount: 'Failed to delete account',
  accountDeleted: 'Account deleted successfully',

  // Profile
  profileNotFound: 'Profile not found',
  reminderDayOutOfRange: 'reminder_day must be 0-6 (Sunday-Saturday)',
  failedToUpdateProfile: 'Failed to update profile',
  noUpdate: 'Update matched no rows',

  // Rate limit
  tooManyAuthAttempts: 'Too many auth attempts, please try again later',
} as const

export type ServerErrorKey = keyof typeof SERVER_ERRORS

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || ''

const SUPPORTED_CODES = new Set([
  'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'tr',
  'ar', 'he', 'hi', 'bn', 'id', 'vi', 'th', 'ja', 'ko', 'zh',
])

// Process-lifetime memoized translation cache. Key: `${lang}:${text}`.
const translationCache = new Map<string, string>()

function normalize(code: string | undefined | null): string {
  if (!code) return 'en'
  const primary = code.split('-')[0]?.trim().toLowerCase()
  return primary && SUPPORTED_CODES.has(primary) ? primary : 'en'
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = params[k]
    return v === undefined || v === null ? `{{${k}}}` : String(v)
  })
}

async function translateOne(text: string, target: string): Promise<string> {
  if (target === 'en' || !GOOGLE_TRANSLATE_API_KEY) return text
  const key = `${target}:${text}`
  const cached = translationCache.get(key)
  if (cached !== undefined) return cached
  try {
    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: [text], target, format: 'text' }),
      }
    )
    if (!res.ok) return text
    const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } }
    const translated = data?.data?.translations?.[0]?.translatedText
    if (translated && translated.trim()) {
      translationCache.set(key, translated)
      return translated
    }
  } catch (err) {
    logger.with('err', err).warn('Server error translation failed (lang={}); using English', target)
  }
  return text
}

/**
 * Resolve the request's preferred language from:
 *   1. The `lang` query parameter (?lang=ja) — set by our client SDK on translate fetches.
 *   2. The Accept-Language header.
 *   3. 'en' as the final fallback.
 */
export function requestLanguage(req: Pick<Request, 'headers' | 'query'>): string {
  const q = req.query?.lang
  if (typeof q === 'string' && q.trim()) return normalize(q)
  const accept = req.headers['accept-language']
  if (typeof accept === 'string' && accept) {
    return normalize(accept.split(',')[0])
  }
  return 'en'
}

/**
 * Resolve a localized error string for the current request.
 *
 * Usage:
 *   const t = await getErrorMessage(req, 'emailPasswordRequired')
 *   res.status(400).json({ error: t })
 *
 * The function is async because it may call the Google Translate API on a
 * cache miss. All call sites already use async/await.
 */
export async function getErrorMessage(
  req: Pick<Request, 'headers' | 'query'>,
  key: ServerErrorKey,
  params?: Record<string, string | number>
): Promise<string> {
  const template = SERVER_ERRORS[key]
  const lang = requestLanguage(req)
  const english = interpolate(template, params)
  if (lang === 'en') return english
  return translateOne(english, lang)
}

/**
 * Synchronous variant: returns the interpolated English string only.
 * Use this when you cannot await a translation (e.g. in catch blocks that
 * already resolved). Callers wanting non-English errors should use the
 * async `getErrorMessage` instead.
 */
export function getErrorMessageSync(
  key: ServerErrorKey,
  params?: Record<string, string | number>
): string {
  return interpolate(SERVER_ERRORS[key], params)
}
