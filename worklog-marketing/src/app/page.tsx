import Link from "next/link";
import { ArrowRight, Shield, Award, Calendar, Terminal, Lock, ExternalLink } from "lucide-react";
import PlaygroundWidget from "@/components/PlaygroundWidget";
import PainGrid from "@/components/PainGrid";
import FaqAccordion from "@/components/FaqAccordion";

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


export default function Home() {
  const SITE_URL = "https://impactlyai.com";

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Impactly AI",
    "url": SITE_URL,
    "description":
      "Privacy-first AI tool that turns weekly work logs into promotion-ready self-appraisals. STAR-formatted, OKR-aligned, no LLM training on user data.",
    "operatingSystem": "Web",
    "applicationCategory": "BusinessApplication",
    "image": `${SITE_URL}/og-default.png`,
    "featureList": [
      "AI-generated STAR-formatted self-appraisals",
      "Weekly work log capture (5 minutes / week)",
      "Custom OKR and company-values alignment",
      "AI critique assistant for revision",
      "Automated weekly reminders",
      "Customizable writing tone (assertive, collaborative, leadership)",
      "Row-Level Security and per-user data isolation",
      "Export to STAR reviews, career reflections, AI chat critiques",
      "Free tier with Google / GitHub OAuth"
    ],
    "offers": {
      "@type": "Offer",
      "price": "0.00",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "url": "https://app.impactlyai.com/login"
    },
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Impactly AI",
    "url": SITE_URL,
    "logo": `${SITE_URL}/og-default.png`,
    "description":
      "Privacy-first AI tool that turns weekly work logs into promotion-ready self-appraisals.",
    "sameAs": [],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Impactly AI",
    "url": SITE_URL,
    "publisher": {
      "@type": "Organization",
      "name": "Impactly AI",
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="bg-futuristic flex-1 flex flex-col">
      {/* Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* Floating Header */}
      <header className="relative w-full z-50 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center group">
            <svg className="h-7 w-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="ml-2 text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">Impactly AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#playground" className="text-sm text-gray-400 hover:text-white transition-colors">Playground</a>
            <Link href="/templates/self-appraisal" className="text-sm text-gray-400 hover:text-white transition-colors">Templates</Link>
            <Link href="/blog" className="text-sm text-gray-400 hover:text-white transition-colors">Blog</Link>
            <a href="#privacy" className="text-sm text-gray-400 hover:text-white transition-colors">Security</a>
            <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="https://app.impactlyai.com/login"
              className="text-xs md:text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors hover:bg-white/5"
            >
              Sign In
            </a>
            <a
              href="https://app.impactlyai.com/login"
              className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all glow-primary"
            >
              Get Started Free
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-28 px-4 flex flex-col items-center overflow-hidden">
        {/* Glowing floating blur orbs */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "2s" }}></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Active Appraisal badge */}
          <div className="inline-flex items-center px-3.5 py-1.5 rounded-full glass mb-8 animate-float">
            <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2.5 animate-pulse"></span>
            <span className="text-xs text-gray-300 font-semibold tracking-wide">AI-Powered Appraisal Workspace 2026</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
            <span className="text-white">Stop Stressing Over Your</span>
            <br />
            <span className="gradient-text text-glow-primary">Annual Self-Appraisal.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Impactly AI captures your weekly achievements, highlights your key metrics,
            and drafts professional, <span className="text-white font-semibold">promotion-ready self-evaluation reviews</span> in one click.
          </p>

          {/* Centered Email Conversion Trigger */}
          <div className="w-full max-w-md mx-auto mb-6 flex flex-col sm:flex-row gap-2.5 p-1.5 glass rounded-2xl border border-white/10 shadow-2xl">
            <input
              type="email"
              placeholder="Enter your professional email..."
              className="flex-1 bg-transparent border-0 px-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-transparent min-w-[200px]"
            />
            <a
              href="https://app.impactlyai.com/login"
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="flex items-center justify-center gap-6 text-[10px] sm:text-xs text-gray-500 tracking-wide mb-16 uppercase">
            <span className="flex items-center gap-1">🛡️ Private & Secure</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">⚡ Zero Onboarding Friction</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">🔒 Row-Level Security</span>
          </div>

          {/* Quick Stats Grid */}
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
              {/* <div className="text-2xl md:text-3xl font-extrabold gradient-text mb-1">Mistral</div> */}
              <div className="text-[10px] md:text-xs text-gray-500 font-mono tracking-widest uppercase">AI Grounding</div>
            </div>
          </div>
        </div>
      </section>

      {/* Monochrome Brand Logos Cloud */}
      <section className="border-y border-white/5 bg-black/20 py-8 text-center px-4 relative">
        <p className="text-[10px] md:text-xs text-gray-500 font-semibold tracking-widest uppercase mb-6">
          Loved by top-performing professionals and leaders at:
        </p>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-10 md:gap-16 opacity-65 hover:opacity-95 transition-opacity duration-300">
          {["google", "meta", "stripe", "netflix", "uber"].map((brand) => (
            <span key={brand} className="text-white select-none flex items-center justify-center">
              {BRAND_LOGOS[brand as keyof typeof BRAND_LOGOS]}
            </span>
          ))}
        </div>
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
        <PainGrid />
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
        <PlaygroundWidget />
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
                    Chat with an expert performance coach. Review generated comments, refine wording, adjust metrics, or query: *"What key tasks did I complete in Q3?"*
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-8 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
                  <span>Interactive feedback</span>
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
        <FaqAccordion />
      </section>

      {/* Closing CTA Banner */}
      <section className="py-24 relative overflow-hidden border-t border-white/5 bg-gradient-to-b from-transparent to-indigo-950/20 px-4">
        {/* Soft background orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto glass-strong rounded-3xl p-8 md:p-14 text-center relative overflow-hidden border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-cyan-500/5"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/2 to-transparent pointer-events-none"></div>

          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
              Ready to <span className="gradient-text text-glow-primary">Transform</span> Your Appraisals?
            </h2>
            <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
              Join high-performing engineers, managers, and designers who never scramble during review season. Secure the recognition and promotion you earned.
            </p>

            <a
              href="https://app.impactlyai.com/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-base rounded-xl shadow-xl hover:shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-5 h-5" />
            </a>

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
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="ml-2 text-sm font-bold text-white">Impactly AI</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-500">
            <Link href="/blog" className="hover:text-gray-300 transition-colors">
              Blog
            </Link>
            <Link href="/templates/self-appraisal" className="hover:text-gray-300 transition-colors">
              Templates
            </Link>
            <Link href="/templates/self-appraisal/software-engineer" className="hover:text-gray-300 transition-colors">
              Engineer Templates
            </Link>
            <Link href="/templates/self-appraisal/product-manager" className="hover:text-gray-300 transition-colors">
              PM Templates
            </Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">
              Terms
            </Link>
            <a href="mailto:impactlyai@zohomail.in" className="hover:text-gray-300 transition-colors">
              Contact
            </a>
            <a href="https://app.impactlyai.com/login" className="hover:text-gray-300 transition-colors flex items-center gap-0.5">
              <span>Go to App</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="text-xs text-gray-500 select-text">© 2026 Impactly AI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
