import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import i18n from './index'

const SCRIPT_TO_FONT: Record<string, string> = {
  ar: 'Noto Sans Arabic',
  he: 'Noto Sans Hebrew',
  ur: 'Noto Sans Arabic',
  fa: 'Noto Sans Arabic',
  hi: 'Noto Sans Devanagari',
  bn: 'Noto Sans Bengali',
  ja: 'Noto Sans JP',
  ko: 'Noto Sans KR',
  zh: 'Noto Sans SC',
  th: 'Noto Sans Thai',
  ta: 'Noto Sans Tamil',
}

function ensureFontLoaded(family: string) {
  if (typeof document === 'undefined') return
  const id = `impactly-font-${family.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
}

export function useAutoLocale() {
  // Hooks must be called at the top level — read auth state here even though
  // the effect below only needs the user at mount time.
  const { user, loading } = useAuth()

  useEffect(() => {
    // Wait for auth to settle so we can honor a logged-in user's saved preference.
    // Anonymous visitors fall through to the localStorage / navigator fallback.
    if (loading) return

    if (typeof window !== 'undefined') {
      const userPref = user?.preferredLanguage
      if (userPref) {
        // Logged-in user with a saved preference: apply it.
        if (userPref !== i18n.language) {
          void i18n.changeLanguage(userPref)
        }
        try {
          localStorage.setItem('impactly_language', userPref)
        } catch {
          /* ignore */
        }
      } else {
        // No saved preference (or anonymous): if user has never explicitly
        // chosen a language, sync to the current browser language so the UI
        // matches navigator.language even if it changed since first init.
        const stored = localStorage.getItem('impactly_language')
        if (!stored) {
          const detected = (navigator.language || 'en').split('-')[0]
          if (detected && detected !== i18n.language) {
            void i18n.changeLanguage(detected)
          }
        }
      }
    }

    const lang = i18n.language
    if (!lang) return
    const base = lang.split('-')[0]
    const family = SCRIPT_TO_FONT[base]
    if (family) ensureFontLoaded(family)
  }, [user, loading])
}

export function supportedLanguages(): { code: string; name: string; englishName: string }[] {
  return [
    { code: 'auto', name: 'Auto', englishName: 'Auto-detect' },
    { code: 'en', name: 'English', englishName: 'English' },
    { code: 'es', name: 'Español', englishName: 'Spanish' },
    { code: 'fr', name: 'Français', englishName: 'French' },
    { code: 'de', name: 'Deutsch', englishName: 'German' },
    { code: 'pt', name: 'Português', englishName: 'Portuguese' },
    { code: 'it', name: 'Italiano', englishName: 'Italian' },
    { code: 'nl', name: 'Nederlands', englishName: 'Dutch' },
    { code: 'pl', name: 'Polski', englishName: 'Polish' },
    { code: 'ru', name: 'Русский', englishName: 'Russian' },
    { code: 'tr', name: 'Türkçe', englishName: 'Turkish' },
    { code: 'ar', name: 'العربية', englishName: 'Arabic' },
    { code: 'he', name: 'עברית', englishName: 'Hebrew' },
    { code: 'hi', name: 'हिन्दी', englishName: 'Hindi' },
    { code: 'bn', name: 'বাংলা', englishName: 'Bengali' },
    { code: 'id', name: 'Bahasa Indonesia', englishName: 'Indonesian' },
    { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese' },
    { code: 'th', name: 'ไทย', englishName: 'Thai' },
    { code: 'ja', name: '日本語', englishName: 'Japanese' },
    { code: 'ko', name: '한국어', englishName: 'Korean' },
    { code: 'zh', name: '中文', englishName: 'Chinese' },
  ]
}
