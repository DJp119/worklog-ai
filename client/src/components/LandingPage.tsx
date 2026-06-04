import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
            <span className="ml-2 text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">Impactly AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#playground" className="text-sm text-gray-400 hover:text-white transition-colors">Playground</a>
            <a href="#privacy" className="text-sm text-gray-400 hover:text-white transition-colors">Security</a>
            <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/ai-pulse"
              className="text-xs md:text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-white/5 flex items-center gap-1.5"
            >
              AI Pulse
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
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs md:text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-white/5"
                >
                  Sign In
                </Link>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all glow-primary"
                >
                  Get Started Free
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
            <span className="text-xs text-gray-300 font-semibold tracking-wide">AI-Powered Appraisal Workspace 2026</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
            <span className="text-white">Stop Stressing Over Your</span>
            <br />
            <span className="gradient-text text-glow-primary">Annual Self-Appraisal.</span>
          </h1>

          <p className="text-base sm:text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Impactly AI captures your weekly achievements, highlights your key metrics,
            and drafts professional, <span className="text-white font-semibold">promotion-ready self-evaluation reviews</span> in one click.
          </p>

          <div className="w-full max-w-md mx-auto mb-6 flex flex-col sm:flex-row gap-2.5 p-1.5 glass rounded-2xl border border-white/10 shadow-2xl">
            <input
              type="email"
              placeholder="Enter your professional email..."
              className="flex-1 bg-transparent border-0 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-transparent min-w-[200px]"
            />
            <Link
              to="/login"
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 text-[10px] sm:text-xs text-gray-500 tracking-wide mb-16 uppercase">
            <span className="flex items-center gap-1">🛡️ Private & Secure</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">⚡ Zero Onboarding Friction</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">🔒 Row-Level Security</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto border-t border-white/5 pt-10">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">5 Min</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">Per Week logging</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">10x</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">Faster Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">100%</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">Private Archives</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">Hybrid</div>
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">AI Orchestration</div>
            </div>
          </div>
        </div>
      </section>

      {/* Monochrome Brand Logos Cloud */}
      <section className="border-y border-white/5 bg-black/20 py-8 text-center px-4 relative">
        <p className="text-[10px] md:text-xs text-gray-500 font-semibold tracking-widest uppercase mb-6">
          Built for professionals at companies like:
        </p>
        <ul className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-10 md:gap-16 opacity-35 hover:opacity-55 transition-opacity duration-300 list-none m-0 p-0">
          {["google", "meta", "stripe", "netflix", "uber"].map((brand) => (
            <li key={brand} className="text-sm font-black font-mono tracking-tighter text-white uppercase select-none">
              {brand}
            </li>
          ))}
        </ul>
      </section>

      {/* Pain Comparison Section */}
      <section className="py-24 relative overflow-hidden bg-black/10">
        <div className="max-w-6xl mx-auto text-center mb-16 px-4">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            The "December Appraisal Panic" is Over
          </h2>
          <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
            Why do we forget 90% of our impact before our yearly reviews? Compare the traditional hassle to the seamless automated workflow.
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
            Test Drive the Appraisal Engine
          </h2>
          <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
            Experience our specialized grounding models in action. Select a department, click generate, and see bullet points structure themselves.
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
              Engineered for <span className="gradient-text">High Performers</span>
            </h2>
            <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
              Everything you need to capture daily impact, maintain consistency, and secure corporate recognition.
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
                  <h3 className="text-lg md:text-xl font-bold text-white mb-2">Weekly Impact Logging (5 Mins)</h3>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed max-w-lg">
                    Build a premium catalog of your achievements as they happen. Just spend 5 minutes on Friday afternoon documenting completed tasks, hurdles overcome, and key learnings. Eliminates recency bias completely.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                  <span>Structured habit building</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
                  <h3 className="text-lg font-bold text-white mb-2">Criteria & Values Mapping</h3>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                    Upload your specific department goals or copy-paste company values. Our specialized AI correlates your work logs directly to company targets automatically.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-purple-400 font-semibold uppercase tracking-wider">
                  <span>Alignment engine</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
                  <h3 className="text-lg font-bold text-white mb-2">AI Critique Assistant</h3>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed">
                    Chat with an expert performance coach. Review generated comments, refine wording, adjust metrics, or query: <em>"What key tasks did I complete in Q3?"</em>
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                  <span>Interactive feedback</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
                  <h3 className="text-lg md:text-xl font-bold text-white mb-2">Enterprise-Grade Security & Row-Level Isolation</h3>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed max-w-lg">
                    Your career logs are encrypted at rest and in transit. By combining JWT tokens, strict database Row-Level Security (RLS), and sandboxed API pathways, we ensure your achievements are visible to you, and only you.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                  <span>Privacy-first architecture</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
            Your accomplishments belong to you. Period.
          </h2>
          <p className="text-sm md:text-base text-gray-400 leading-relaxed max-w-2xl mx-auto mb-8">
            Unlike many AI tools, Impactly AI never aggregates your private logs, trains large language models on your entries, or shares corporate documentation. Every check-in is encrypted and locked in your isolated database tenancy.
          </p>
          <div className="flex justify-center gap-6 text-[10px] md:text-xs font-mono text-gray-500">
            <span className="flex items-center gap-1">✓ TLS 1.3 Encryption</span>
            <span>•</span>
            <span className="flex items-center gap-1">✓ Supabase RLS Protected</span>
            <span>•</span>
            <span className="flex items-center gap-1">✓ Strict RAG Boundaries</span>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="py-24 relative border-t border-white/5 bg-black/10">
        <div className="max-w-6xl mx-auto text-center mb-16 px-4">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Commonly Asked Questions
          </h2>
          <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
            Have questions about accuracy, integration, or privacy? We have answers.
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
              Ready to <span className="gradient-text text-glow-primary">Transform</span> Your Appraisals?
            </h2>
            <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
              Join high-performing engineers, managers, and designers who never scramble during review season. Secure the recognition and promotion you earned.
            </p>

            {isLoggedIn ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-base rounded-xl shadow-xl hover:shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-base rounded-xl shadow-xl hover:shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            )}

            <p className="text-[10px] text-gray-500 font-medium tracking-wide mt-4 uppercase">
              🛡️ Zero credit card required • Join in 1 click
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
            <span className="ml-2 text-sm font-bold text-white">Impactly AI</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-xs text-gray-500">
            <Link to={isLoggedIn ? "/dashboard" : "/login"} className="hover:text-gray-300 transition-colors flex items-center gap-0.5">
              <span>Go to App</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <span>•</span>
            <span className="select-text">© 2026 Impactly AI. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
