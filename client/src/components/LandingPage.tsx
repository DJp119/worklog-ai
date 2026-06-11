import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useIsLoggedIn } from '../hooks/useIsLoggedIn'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs'
import Shield from 'lucide-react/dist/esm/icons/shield.mjs'
import Award from 'lucide-react/dist/esm/icons/award.mjs'
import Calendar from 'lucide-react/dist/esm/icons/calendar.mjs'
import Terminal from 'lucide-react/dist/esm/icons/terminal.mjs'
import Lock from 'lucide-react/dist/esm/icons/lock.mjs'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link.mjs'

const PainGrid = lazy(() => import('./landing/PainGrid'))
const PlaygroundWidget = lazy(() => import('./landing/PlaygroundWidget'))
const FaqAccordion = lazy(() => import('./landing/FaqAccordion'))

const BRAND_LOGOS = {
  google: (
    <svg className="h-8 w-auto fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
    </svg>
  ),
  meta: (
    <svg className="h-8 w-auto fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/>
    </svg>
  ),
  stripe: (
    <svg className="h-8 w-auto fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
    </svg>
  ),
  netflix: (
    <svg className="h-8 w-auto fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="m5.398 0 8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z"/>
    </svg>
  ),
  uber: (
    <svg className="h-8 w-auto fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 7.97v4.958c0 1.867 1.302 3.101 3 3.101.826 0 1.562-.316 2.094-.87v.736H6.27V7.97H5.082v4.888c0 1.257-.85 2.106-1.947 2.106-1.11 0-1.946-.827-1.946-2.106V7.971H0zm7.44 0v7.925h1.13v-.725c.521.532 1.257.86 2.06.86a3.006 3.006 0 0 0 3.034-3.01 3.01 3.01 0 0 0-3.033-3.024 2.86 2.86 0 0 0-2.049.861V7.971H7.439zm9.869 2.038c-1.687 0-2.965 1.37-2.965 3 0 1.72 1.334 3.01 3.066 3.01 1.053 0 1.913-.463 2.49-1.233l-.826-.611c-.43.577-.996.847-1.664.847-.973 0-1.753-.7-1.912-1.64h4.697v-.373c0-1.72-1.222-3-2.886-3zm6.295.068c-.634 0-1.098.294-1.381.758v-.713h-1.131v5.774h1.142V12.61c0-.894.544-1.47 1.291-1.47H24v-1.065h-.396zm-6.319.928c.85 0 1.564.588 1.756 1.47H15.52c.203-.882.916-1.47 1.765-1.47zm-6.732.012c1.086 0 1.98.883 1.98 2.004a1.993 1.993 0 0 1-1.98 2.001A1.989 1.989 0 0 1 8.56 13.02a1.99 1.99 0 0 1 1.992-2.004z"/>
    </svg>
  )
};


function LazyOnVisible({
  children,
  rootMargin = '300px',
  minHeight = 600,
}: {
  children: ReactNode
  rootMargin?: string
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin])

  return (
    <div ref={ref} style={shouldLoad ? undefined : { minHeight: `${minHeight}px` }}>
      {shouldLoad ? <Suspense fallback={null}>{children}</Suspense> : null}
    </div>
  )
}

export default function LandingPage() {
  const { t } = useTranslation()
  const isLoggedIn = useIsLoggedIn()

  return (
    <div className="bg-futuristic flex-1 flex flex-col min-h-screen">
      {/* Floating Header */}
      <header className="relative w-full z-50 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center group">
            <svg className="h-7 w-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="ml-2 text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{t('brand.name')}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">{t('landing.nav.features')}</a>
            <a href="#playground" className="text-sm text-gray-400 hover:text-white transition-colors">{t('landing.nav.playground')}</a>
            <a href="#privacy" className="text-sm text-gray-400 hover:text-white transition-colors">{t('landing.nav.security')}</a>
            <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors">{t('landing.nav.faq')}</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/ai-pulse"
              className="text-xs md:text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-white/5 flex items-center gap-1.5"
            >
              {t('nav.aiPulse')}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </Link>
            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all glow-primary"
              >
                {t('nav.dashboard')}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs md:text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-white/5"
                >
                  {t('nav.signIn')}
                </Link>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all glow-primary"
                >
                  {t('landing.hero.ctaPrimary')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-4 flex flex-col items-center overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center px-3.5 py-1.5 rounded-full glass mb-8 animate-float">
            <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2.5 animate-pulse"></span>
            <span className="text-xs text-gray-300 font-semibold tracking-wide">{t('brand.tagline')}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
            <span className="gradient-text text-glow-primary">{t('landing.hero.title')}</span>
          </h1>

          <p className="text-base sm:text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            {t('landing.hero.subtitle')}
          </p>

          <div className="w-full max-w-md mx-auto mb-6 flex flex-col sm:flex-row gap-2.5 p-1.5 glass rounded-2xl border border-white/10 shadow-2xl">
            <input
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              className="flex-1 bg-transparent border-0 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-transparent min-w-[200px]"
            />
            <Link
              to="/login"
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
            >
              <span>{t('landing.hero.ctaPrimary')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 text-[10px] sm:text-xs text-gray-500 tracking-wide mb-16 uppercase">
            <span className="flex items-center gap-1">{t('landing.hero.private')}</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">{t('landing.hero.weeklyTime')}</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">{t('landing.hero.promotionReady')}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto border-t border-white/5 pt-10">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">{t('landing.hero.weeklyTime')}</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">{t('landing.proof.stat3Label')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">10x</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">{t('landing.proof.stat2Label')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">{t('landing.proof.stat4Value')}</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">{t('landing.proof.stat4Label')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">Hybrid</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">AI</div>
            </div>
          </div>
        </div>
      </section>

      {/* Monochrome Brand Logos Cloud */}
      <section className="border-y border-white/5 bg-black/20 py-8 text-center px-4 relative">
        <p className="text-[10px] md:text-xs text-gray-500 font-semibold tracking-widest uppercase mb-6">
          {t('landing.proof.title')}
        </p>
        <ul className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-10 md:gap-16 opacity-65 hover:opacity-95 transition-opacity duration-300 list-none m-0 p-0">
          {["google", "meta", "stripe", "netflix", "uber"].map((brand) => (
            <li key={brand} className="text-white select-none flex items-center justify-center">
              {BRAND_LOGOS[brand as keyof typeof BRAND_LOGOS]}
            </li>
          ))}
        </ul>
      </section>

      {/* Pain Comparison Section */}
      <section className="py-24 relative overflow-hidden bg-black/10">
        <div className="max-w-6xl mx-auto text-center mb-16 px-4">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            {t('landing.pain.title')}
          </h2>
          <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
            {t('landing.pain.subtitle')}
          </p>
        </div>
        <LazyOnVisible minHeight={560}>
          <PainGrid />
        </LazyOnVisible>
      </section>

      {/* The Interactive AI Appraisal Playground Widget */}
      <section id="playground" className="py-24 relative overflow-hidden border-t border-white/5 bg-black/20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="max-w-6xl mx-auto text-center mb-16 px-4">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            {t('landing.playground.title')}
          </h2>
          <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
            {t('landing.playground.subtitle')}
          </p>
        </div>
        <LazyOnVisible minHeight={720}>
          <PlaygroundWidget />
        </LazyOnVisible>
      </section>

      {/* Key Features Bento Grid */}
      <section id="features" className="py-24 relative border-t border-white/5 bg-black/10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
              {t('landing.features.title')}
            </h2>
            <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1: Weekly Work Logs */}
            <div className="group card-hover glass rounded-2xl p-6 md:p-8 relative overflow-hidden md:col-span-2">
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-6 glow-primary">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white mb-2">{t('landing.howItWorks.step1Title')}</h3>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed max-w-lg">
                    {t('landing.howItWorks.step1Desc')}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                  <span>{t('landing.features.starTitle')}</span>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Custom Criteria */}
            <div className="group card-hover glass rounded-2xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full"></div>
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 glow-accent">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{t('landing.features.okrTitle')}</h3>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                    {t('landing.features.okrDesc')}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-purple-400 font-semibold uppercase tracking-wider">
                  <span>{t('landing.features.valuesTitle')}</span>
                </div>
              </div>
            </div>

            {/* Bento Card 3: AI Chat Assist */}
            <div className="group card-hover glass rounded-2xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-bl-full"></div>
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-6 glow-cyan">
                    <Terminal className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{t('landing.features.critiqueTitle')}</h3>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                    {t('landing.features.critiqueDesc')}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                  <span>{t('landing.features.toneTitle')}</span>
                </div>
              </div>
            </div>

            {/* Bento Card 4: Enterprise Safety & RLS */}
            <div className="group card-hover glass rounded-2xl p-6 md:p-8 relative overflow-hidden md:col-span-2">
              <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center mb-6">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg md:text-xl font-bold text-white mb-2">{t('landing.privacy.title')}</h3>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed max-w-lg">
                    {t('landing.privacy.principle1')} {t('landing.privacy.principle2')} {t('landing.privacy.principle3')}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                  <span>{t('landing.features.remindersTitle')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Trust Panel */}
      <section id="privacy" className="py-20 relative bg-black/20 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center mx-auto mb-6 text-indigo-400">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-4">
            {t('landing.privacy.title')}
          </h2>
          <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-2xl mx-auto mb-8">
            {t('landing.privacy.principle1')} {t('landing.privacy.principle2')} {t('landing.privacy.principle3')}
          </p>
          <div className="flex justify-center gap-6 text-[10px] md:text-xs font-mono text-gray-500">
            <span className="flex items-center gap-1">✓ TLS 1.3</span>
            <span>•</span>
            <span className="flex items-center gap-1">✓ RLS</span>
            <span>•</span>
            <span className="flex items-center gap-1">✓ {t('landing.privacy.principle2')}</span>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="py-24 relative border-t border-white/5 bg-black/10">
        <div className="max-w-6xl mx-auto text-center mb-16 px-4">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            {t('landing.faq.title')}
          </h2>
          <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
            {t('landing.faq.a6')}
          </p>
        </div>
        <LazyOnVisible minHeight={620}>
          <FaqAccordion />
        </LazyOnVisible>
      </section>

      {/* Closing CTA Banner */}
      <section className="py-24 relative overflow-hidden border-t border-white/5 bg-gradient-to-b from-transparent to-indigo-950/20 px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto glass-strong rounded-3xl p-8 md:p-14 text-center relative overflow-hidden border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-cyan-500/5"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
              {t('landing.finalCta.title')}
            </h2>
            <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
              {t('landing.finalCta.subtitle')}
            </p>

            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-base rounded-xl shadow-xl hover:shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <span>{t('nav.dashboard')}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-base rounded-xl shadow-xl hover:shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <span>{t('landing.finalCta.button')}</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}

            <p className="text-[10px] text-gray-500 font-medium tracking-wide mt-4 uppercase">
              {t('landing.hero.trustBadge')}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/40 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center group">
            <svg className="h-6 w-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="ml-2 text-sm font-bold text-white">{t('brand.name')}</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-xs text-gray-500">
            <Link to={isLoggedIn ? "/dashboard" : "/login"} className="hover:text-gray-300 transition-colors flex items-center gap-0.5">
              <span>{t('nav.signIn')}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-gray-300 transition-colors">{t('footer.terms')}</Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-gray-300 transition-colors">{t('footer.privacy')}</Link>
            <span>•</span>
            <span className="select-text">{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
