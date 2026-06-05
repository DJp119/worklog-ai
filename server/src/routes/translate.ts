import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { logger } from '../lib/logger.js'

export const translateRoutes = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function loadEnBase(): Record<string, string> {
  const candidates = [
    resolve(__dirname, '../../../client/src/locales/en/base.json'),
    resolve(__dirname, '../../client/src/locales/en/base.json'),
    resolve(process.cwd(), '../client/src/locales/en/base.json'),
    resolve(process.cwd(), 'client/src/locales/en/base.json'),
  ]
  for (const path of candidates) {
    try {
      const raw = readFileSync(path, 'utf-8')
      return JSON.parse(raw) as Record<string, string>
    } catch {
      /* try next */
    }
  }
  logger.warn('Could not locate client/src/locales/en/base.json — translation endpoint will serve empty base')
  return {}
}

const enBase: Record<string, string> = loadEnBase()

const SUPPORTED_LANGUAGES: { code: string; name: string; englishName: string; rtl: boolean }[] = [
  { code: 'en', name: 'English', englishName: 'English', rtl: false },
  { code: 'es', name: 'Español', englishName: 'Spanish', rtl: false },
  { code: 'fr', name: 'Français', englishName: 'French', rtl: false },
  { code: 'de', name: 'Deutsch', englishName: 'German', rtl: false },
  { code: 'pt', name: 'Português', englishName: 'Portuguese', rtl: false },
  { code: 'it', name: 'Italiano', englishName: 'Italian', rtl: false },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', rtl: false },
  { code: 'pl', name: 'Polski', englishName: 'Polish', rtl: false },
  { code: 'ru', name: 'Русский', englishName: 'Russian', rtl: false },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', rtl: false },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', rtl: true },
  { code: 'he', name: 'עברית', englishName: 'Hebrew', rtl: true },
  { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', rtl: false },
  { code: 'bn', name: 'বাংলা', englishName: 'Bengali', rtl: false },
  { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian', rtl: false },
  { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', rtl: false },
  { code: 'th', name: 'ไทย', englishName: 'Thai', rtl: false },
  { code: 'ja', name: '日本語', englishName: 'Japanese', rtl: false },
  { code: 'ko', name: '한국어', englishName: 'Korean', rtl: false },
  { code: 'zh', name: '中文', englishName: 'Chinese', rtl: false },
]

const RTL_LANGS = new Set(['ar', 'he', 'ur', 'fa', 'ps', 'sd', 'yi', 'ku'])
const TRANSLATION_VERSION = 1
const inMemoryCache = new Map<string, { data: Record<string, string>; at: number }>()
const CACHE_TTL_MS = 1000 * 60 * 60

function normalizeLang(code: string): string {
  return code.split('-')[0].toLowerCase()
}

translateRoutes.get('/languages', (_req, res) => {
  res.json({ success: true, data: { languages: SUPPORTED_LANGUAGES } })
})

translateRoutes.get('/:languageCode', async (req, res) => {
  const lang = normalizeLang(req.params.languageCode)
  if (lang === 'en' || !SUPPORTED_LANGUAGES.some((l) => l.code === lang)) {
    res.json({ success: true, data: { translations: enBase, source: 'base', version: TRANSLATION_VERSION } })
    return
  }

  const cacheKey = `${lang}_v${TRANSLATION_VERSION}`
  const cached = inMemoryCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.json({ success: true, data: { translations: cached.data, source: 'cache', version: TRANSLATION_VERSION } })
    return
  }

  try {
    const translations = await translateStrings(Object.values(enBase), lang)
    const map: Record<string, string> = {}
    Object.keys(enBase).forEach((key, i) => {
      const translated = translations[i]
      map[key] = typeof translated === 'string' && translated.trim() ? translated : enBase[key]
    })
    inMemoryCache.set(cacheKey, { data: map, at: Date.now() })
    res.json({ success: true, data: { translations: map, source: 'google', version: TRANSLATION_VERSION } })
  } catch (err) {
    logger.with('err', err).warn('Translation fetch failed for {}: {}', lang, (err as Error).message)
    res.json({ success: true, data: { translations: enBase, source: 'fallback', version: TRANSLATION_VERSION } })
  }
})

async function translateStrings(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) return []
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, target: targetLang, format: 'text' }),
  })
  if (!res.ok) throw new Error(`Google Translate API ${res.status}`)
  const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } }
  return (data?.data?.translations ?? []).map((t) => t.translatedText ?? '')
}

export function isRtlLang(code: string): boolean {
  return RTL_LANGS.has(code.split('-')[0].toLowerCase())
}

export function languageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code.split('-')[0].toLowerCase())
  return lang ? lang.englishName : 'English'
}
