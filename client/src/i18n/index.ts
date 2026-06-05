import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enBase from '../locales/en/base.json'

export const TRANSLATION_VERSION = 1
const STORAGE_KEY = `impactly_i18n_v${TRANSLATION_VERSION}`
const LANG_KEY = 'impactly_language'

const RTL_LANGS = new Set(['ar', 'he', 'ur', 'fa', 'ps', 'sd', 'yi', 'ku'])

export function isRtl(lang: string): boolean {
  return RTL_LANGS.has(lang.split('-')[0])
}

const DynamicBackend = {
  type: 'backend' as const,
  init() {},
  read(language: string, _namespace: string, callback: (err: unknown, data: Record<string, string> | null) => void) {
    if (language === 'en') {
      callback(null, enBase as Record<string, string>)
      return
    }
    const cacheKey = `${STORAGE_KEY}_${language}`
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          callback(null, JSON.parse(cached))
          return
        } catch {
          /* fall through to network */
        }
      }
    }
    fetch(`/api/translate/${encodeURIComponent(language)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('translate failed'))))
      .then((data) => {
        const translations = (data?.data?.translations ?? data?.translations ?? {}) as Record<string, string>
        if (translations && Object.keys(translations).length > 0) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(translations))
          } catch {
            /* quota — ignore */
          }
          callback(null, { ...(enBase as Record<string, string>), ...translations })
        } else {
          callback(null, enBase as Record<string, string>)
        }
      })
      .catch(() => callback(null, enBase as Record<string, string>))
  },
}

export function detectInitialLanguage(): string {
  if (typeof window === 'undefined') return 'en'
  return (
    localStorage.getItem(LANG_KEY) ||
    (navigator.language || 'en').split('-')[0] ||
    'en'
  )
}

i18n
  .use(DynamicBackend)
  .use(initReactI18next)
  .init({
    lng: detectInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: false,
    nonExplicitSupportedLngs: true,
    ns: ['translation'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  })

if (typeof window !== 'undefined') {
  const applyDir = (lang: string) => {
    document.documentElement.lang = lang
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr'
  }
  applyDir(i18n.language || 'en')
  i18n.on('languageChanged', (lang) => {
    applyDir(lang)
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* ignore */
    }
  })
}

export default i18n
