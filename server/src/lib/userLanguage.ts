import type { AuthRequest } from '../middleware/auth.js'
import { isRtlLang, languageName } from '../routes/translate.js'

const SUPPORTED_CODES = new Set([
  'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'tr',
  'ar', 'he', 'hi', 'bn', 'id', 'vi', 'th', 'ja', 'ko', 'zh',
])

/**
 * Extract a supported primary language code from the Accept-Language header.
 * Used at signup / password-reset time when no DB profile exists yet.
 */
export function languageFromAcceptHeader(acceptLanguage: string | undefined | null): string {
  if (!acceptLanguage) return 'en'
  const primary = acceptLanguage.split(',')[0]?.split('-')[0]?.trim().toLowerCase()
  if (primary && SUPPORTED_CODES.has(primary)) return primary
  return 'en'
}

/**
 * Resolve the language code for the current request.
 * Priority: explicit user preference in DB row → Accept-Language header → 'en'.
 */
export async function resolveUserLanguage(
  req: AuthRequest,
  preferredFromProfile?: string | null
): Promise<string> {
  if (preferredFromProfile && SUPPORTED_CODES.has(preferredFromProfile.split('-')[0].toLowerCase())) {
    return preferredFromProfile.split('-')[0].toLowerCase()
  }
  const accept = req.headers['accept-language']
  return languageFromAcceptHeader(typeof accept === 'string' ? accept : null)
}

/**
 * Build the language-injection block that gets prepended to AI prompts.
 * Tells the LLM which language to respond in.
 */
export function languageInstruction(langCode: string): string {
  if (langCode === 'en') return ''
  const name = languageName(langCode)
  return [
    '',
    'CRITICAL LANGUAGE REQUIREMENT:',
    `Respond ENTIRELY in ${name} (${langCode}).`,
    `Use professional, natural ${name}.`,
    `If the user's source material is in another language, translate and adapt it naturally.`,
    `The output must read as if originally written by a native ${name} speaker.`,
    '',
  ].join('\n')
}

export { isRtlLang, languageName }
