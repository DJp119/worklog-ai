import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, Code, Briefcase, Megaphone, Palette, ShieldCheck, BarChart3, Users, Server } from "lucide-react";

export const metadata: Metadata = {
  title: "Self-Appraisal Templates by Role",
  description:
    "Free, role-specific self-appraisal templates with STAR-format examples for engineers, PMs, designers, QA leads, data analysts, managers, DevOps, and marketing managers. Copy-paste ready, plus AI-powered customization.",
  alternates: { canonical: "/templates/self-appraisal" },
  openGraph: {
    title: "Self-Appraisal Templates by Role | Impactly AI",
    description:
      "Role-specific self-appraisal templates with STAR examples for engineers, PMs, designers, QA, data, managers, DevOps, and marketing. Free and AI-powered.",
    url: "https://impactlyai.com/templates/self-appraisal",
    type: "website",
    images: ["/og-default.png"],
  },
};

const ROLES = [
  {
    slug: "software-engineer",
    name: "Software Engineer",
    desc: "Code quality, latency optimization, system architecture, mentorship — STAR examples from Junior through Staff/Lead.",
    icon: Code,
    color: "from-indigo-500 to-purple-500",
  },
  {
    slug: "product-manager",
    name: "Product Manager",
    desc: "Roadmap strategy, churn reduction, cross-functional delivery, vision — STAR examples from APM through Director.",
    icon: Briefcase,
    color: "from-purple-500 to-pink-500",
  },
  {
    slug: "ui-designer",
    name: "UI / UX Designer",
    desc: "Conversion lift, design-system contribution, accessibility wins — STAR examples from Junior through Design Lead.",
    icon: Palette,
    color: "from-pink-500 to-rose-500",
  },
  {
    slug: "qa-lead",
    name: "QA Lead",
    desc: "Test coverage, automation speed, escape-rate reduction, shift-left strategy — STAR examples for QA and SDETs.",
    icon: ShieldCheck,
    color: "from-emerald-500 to-cyan-500",
  },
  {
    slug: "data-analyst",
    name: "Data Analyst",
    desc: "Experimentation, attribution, self-serve analytics, data governance — STAR examples for analysts and BI engineers.",
    icon: BarChart3,
    color: "from-amber-500 to-orange-500",
  },
  {
    slug: "engineering-manager",
    name: "Engineering Manager",
    desc: "Team velocity, retention, hiring, technical strategy — STAR examples for EMs and tech leads.",
    icon: Users,
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    slug: "devops-engineer",
    name: "DevOps / SRE",
    desc: "CI/CD, reliability SLOs, FinOps, observability — STAR examples for DevOps, SRE, and platform engineers.",
    icon: Server,
    color: "from-sky-500 to-blue-500",
  },
  {
    slug: "marketing-manager",
    name: "Marketing Manager",
    desc: "CAC, SEO growth, programmatic campaigns, brand strategy — STAR examples from Coordinator through CMO.",
    icon: Megaphone,
    color: "from-cyan-500 to-blue-500",
  },
];

export default function TemplatesIndexPage() {
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Self-Appraisal Templates by Role",
    "url": "https://impactlyai.com/templates/self-appraisal",
    "description":
      "Free, role-specific self-appraisal templates with STAR examples for engineers, product managers, and marketing managers.",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Impactly AI",
      "url": "https://impactlyai.com",
    },
    "hasPart": ROLES.map((r) => ({
      "@type": "Article",
      "headline": `${r.name} Self-Appraisal Template`,
      "url": `https://impactlyai.com/templates/self-appraisal/${r.slug}`,
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://impactlyai.com" },
      { "@type": "ListItem", "position": 2, "name": "Self-Appraisal Templates", "item": "https://impactlyai.com/templates/self-appraisal" },
    ],
  };

  return (
    <div className="bg-futuristic min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <header className="relative w-full z-50 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center group">
            <svg className="h-7 w-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="ml-2 text-lg font-bold text-white">Impactly AI</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs md:text-sm text-gray-400 hover:text-indigo-400 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center mb-6 text-indigo-400">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Self-Appraisal <span className="gradient-text">Templates by Role</span>
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
            Pick your role. Copy STAR examples calibrated to your seniority. Or let Impactly AI generate one straight
            from your weekly logs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <Link
                key={role.slug}
                href={`/templates/self-appraisal/${role.slug}`}
                className="group glass rounded-2xl p-6 border border-white/5 hover:border-white/15 transition-all relative overflow-hidden"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-5`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">{role.name}</h2>
                <p className="text-xs md:text-sm text-gray-400 leading-relaxed mb-5">{role.desc}</p>
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                  <span>View Template</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 mb-4">Don&apos;t see your role?</p>
          <a
            href="https://app.impactlyai.com/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-sm rounded-xl"
          >
            <span>Generate a Custom Appraisal in 5 Minutes</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </main>

      <footer className="border-t border-white/5 bg-black/40 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <span>© 2026 Impactly AI. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
