import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { logger } from '../lib/logger.js'
import { supabase } from '../lib/supabase.js'
import { mistral, chatModel } from '../lib/mistral.js'

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
const TRANSLATION_VERSION = 3
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
  
  // 1. Check in-memory cache
  const cached = inMemoryCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    res.json({ success: true, data: { translations: cached.data, source: 'cache', version: TRANSLATION_VERSION } })
    return
  }

  // 2. Check Supabase database cache (Layer 2)
  try {
    const { data: dbRow, error: dbError } = await supabase
      .from('translation_cache')
      .select('translations')
      .eq('language_code', lang)
      .eq('namespace', 'all')
      .eq('version', TRANSLATION_VERSION)
      .maybeSingle()

    if (dbRow?.translations && Object.keys(dbRow.translations).length > 0) {
      const dbTranslations = dbRow.translations as Record<string, string>
      const merged = { ...enBase, ...dbTranslations }
      inMemoryCache.set(cacheKey, { data: merged, at: Date.now() })
      res.json({ success: true, data: { translations: merged, source: 'database', version: TRANSLATION_VERSION } })
      return
    }
    if (dbError) {
      logger.error('Error fetching from translation_cache: {}', dbError.message)
    }
  } catch (dbErr) {
    logger.error('Exception fetching from translation_cache: {}', dbErr instanceof Error ? dbErr.message : String(dbErr))
  }

  // 3. Fallback: OpenRouter → Google Translate → Mistral AI (Layer 3)
  try {
    let map: Record<string, string> = {}
    const openrouterApiKey = process.env.OPENROUTER_API_KEY

    // Try OpenRouter first if key is present
    if (openrouterApiKey) {
      logger.info('Translating to {} using OpenRouter API', lang)
      try {
        const openrouterTranslations = await translateJsonWithOpenRouter(enBase, lang)
        if (openrouterTranslations && Object.keys(openrouterTranslations).length > 0) {
          map = { ...enBase, ...openrouterTranslations }
        }
      } catch (orErr) {
        logger.error('OpenRouter translation attempt failed for {}: {}', lang, (orErr as Error).message)
      }
    }

    // Fallback to Google Translate if OpenRouter failed or not configured
    if (Object.keys(map).length === 0) {
      const googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY
      if (googleApiKey) {
        logger.info('Translating to {} using Google Translate API', lang)
        try {
          const translations = await translateStrings(Object.values(enBase), lang)
          if (translations && translations.length > 0) {
            Object.keys(enBase).forEach((key, i) => {
              const translated = translations[i]
              map[key] = typeof translated === 'string' && translated.trim() ? translated : enBase[key]
            })
          }
        } catch (gErr) {
          logger.error('Google Translate attempt failed for {}: {}', lang, (gErr as Error).message)
        }
      }
    }

    // Fallback to Mistral AI if both failed or not configured
    if (Object.keys(map).length === 0) {
      const mistralApiKey = process.env.MISTRAL_API_KEY
      if (mistralApiKey && mistralApiKey !== 'dummy-key-for-dev') {
        logger.info('Translating to {} using Mistral AI', lang)
        try {
          const mistralTranslations = await translateJsonWithMistral(enBase, lang)
          if (mistralTranslations && Object.keys(mistralTranslations).length > 0) {
            map = { ...enBase, ...mistralTranslations }
          }
        } catch (mErr) {
          logger.error('Mistral translation attempt failed for {}: {}', lang, (mErr as Error).message)
        }
      }
    }

    // If all failed, return empty translations map and success: false so client doesn't cache it
    if (Object.keys(map).length === 0) {
      logger.warn('All translation providers failed or unconfigured for lang {}. Returning empty map.', lang)
      res.json({ success: false, data: { translations: {}, source: 'failed', version: TRANSLATION_VERSION } })
      return
    }

    // Save to database cache
    const { error: upsertError } = await supabase
      .from('translation_cache')
      .upsert({
        language_code: lang,
        namespace: 'all',
        translations: map,
        version: TRANSLATION_VERSION,
        updated_at: new Date().toISOString()
      }, { onConflict: 'language_code,namespace,version' })

    if (upsertError) {
      logger.error('Failed to upsert to translation_cache: {}', upsertError.message)
    }

    inMemoryCache.set(cacheKey, { data: map, at: Date.now() })
    res.json({ success: true, data: { translations: map, source: 'translation_service', version: TRANSLATION_VERSION } })

  } catch (err) {
    logger.with('err', err).warn('Translation fetch failed for {}: {}', lang, (err as Error).message)
    res.json({ success: false, data: { translations: {}, source: 'exception', version: TRANSLATION_VERSION } })
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

async function translateJsonWithOpenRouter(
  json: Record<string, string>,
  targetLang: string
): Promise<Record<string, string>> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return {}

  const model = process.env.OPENROUTER_TRANSLATE_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free'
  const keys = Object.keys(json)
  const chunkResult: Record<string, string> = {}
  const chunkSize = 150

  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunkKeys = keys.slice(i, i + chunkSize)
    const chunkJson: Record<string, string> = {}
    chunkKeys.forEach((k) => {
      chunkJson[k] = json[k]
    })

    try {
      const translatedChunk = await translateChunkWithOpenRouter(chunkJson, targetLang, apiKey, model)
      Object.assign(chunkResult, translatedChunk)
    } catch (err) {
      logger.error('OpenRouter translation failed for chunk starting at {}: {}', i, (err as Error).message)
      throw err
    }
  }

  return chunkResult
}

async function translateChunkWithOpenRouter(
  chunk: Record<string, string>,
  targetLang: string,
  apiKey: string,
  model: string
): Promise<Record<string, string>> {
  const prompt = `You are a professional software localization tool. Translate the values of the following JSON object into the language code: "${targetLang}".

CRITICAL RULES:
1. Return ONLY a valid JSON object with the exact same keys as the input.
2. Keep all placeholder variables like {{count}}, {{hours}}, {{date}}, {{year}}, {{time}} exactly as they are. Do not translate or modify them.
3. Do not add any markdown formatting (no \`\`\`json blocks), explanations, or notes.
4. Translate the values naturally and accurately to feel native to speakers of "${targetLang}".

JSON to translate:
${JSON.stringify(chunk, null, 2)}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://impactlyai.com',
      'X-Title': 'Impactly AI',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`OpenRouter API error ${res.status}: ${errorText}`)
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('OpenRouter returned empty content')
  }

  const parsed = JSON.parse(content.trim())
  return parsed as Record<string, string>
}

async function translateJsonWithMistral(
  json: Record<string, string>,
  targetLang: string
): Promise<Record<string, string>> {
  const keys = Object.keys(json)
  const chunkResult: Record<string, string> = {}
  const chunkSize = 150

  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunkKeys = keys.slice(i, i + chunkSize)
    const chunkJson: Record<string, string> = {}
    chunkKeys.forEach((k) => {
      chunkJson[k] = json[k]
    })

    try {
      const translatedChunk = await translateChunkWithMistral(chunkJson, targetLang)
      Object.assign(chunkResult, translatedChunk)
    } catch (err) {
      logger.error('Mistral translation failed for chunk starting at {}: {}', i, (err as Error).message)
      throw err
    }
  }

  return chunkResult
}

async function translateChunkWithMistral(
  chunk: Record<string, string>,
  targetLang: string
): Promise<Record<string, string>> {
  const prompt = `You are a professional software localization tool. Translate the values of the following JSON object into the language code: "${targetLang}".

CRITICAL RULES:
1. Return ONLY a valid JSON object with the exact same keys as the input.
2. Keep all placeholder variables like {{count}}, {{hours}}, {{date}}, {{year}}, {{time}} exactly as they are. Do not translate or modify them.
3. Do not add any markdown formatting (no \`\`\`json blocks), explanations, or notes.
4. Translate the values naturally and accurately to feel native to speakers of "${targetLang}".

JSON to translate:
${JSON.stringify(chunk, null, 2)}`

  const response = await mistral.chat.complete({
    model: chatModel,
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  })

  const content = response.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Mistral returned empty content')
  }

  const parsed = JSON.parse(content as string)
  return parsed as Record<string, string>
}

export function isRtlLang(code: string): boolean {
  return RTL_LANGS.has(code.split('-')[0].toLowerCase())
}

export function languageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code.split('-')[0].toLowerCase())
  return lang ? lang.englishName : 'English'
}
