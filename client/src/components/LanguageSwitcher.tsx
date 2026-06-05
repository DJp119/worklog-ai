import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../i18n/useAutoLocale'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const current = i18n.language?.split('-')[0] || 'en'
  const languages = supportedLanguages()

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
        aria-label="Change language"
        title="Change language"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        {!compact && <span className="uppercase">{current}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 max-h-80 overflow-y-auto rounded-lg glass-strong border border-white/10 shadow-2xl z-50">
          {languages.map((lang) => {
            const isActive = (lang.code === 'auto' && !i18n.language) || lang.code === current
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  const next = lang.code === 'auto' ? undefined : lang.code
                  try {
                    if (next) {
                      localStorage.setItem('impactly_language', next)
                    } else {
                      localStorage.removeItem('impactly_language')
                    }
                  } catch {
                    /* ignore */
                  }
                  void i18n.changeLanguage(next)
                  setOpen(false)
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/5 flex items-center justify-between ${
                  isActive ? 'text-indigo-300 bg-indigo-500/10' : 'text-gray-300'
                }`}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{lang.name}</span>
                  {lang.name !== lang.englishName && (
                    <span className="text-xs text-gray-500">{lang.englishName}</span>
                  )}
                </span>
                <span className="text-xs text-gray-500 uppercase">
                  {lang.code === 'auto' ? 'AUTO' : lang.code}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
