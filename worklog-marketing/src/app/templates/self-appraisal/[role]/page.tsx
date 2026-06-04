import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles, Download, CheckCircle2, ChevronRight, Bookmark } from "lucide-react";
import PlaygroundWidget from "@/components/PlaygroundWidget";

interface RoleDetail {
  roleName: string;
  title: string;
  desc: string;
  bullets: string[];
  examples: {
    level: string;
    focus: string;
    text: string;
  }[];
}

const DEFAULT_ROLE: RoleDetail = {
  roleName: "General Professional",
  title: "Professional Self-Appraisal Templates & STAR Comments",
  desc: "Simplify your yearly review. Access copy-pasteable self-evaluation remarks, structured checklist guidelines, and dynamic AI-powered drafts tailored for professional roles.",
  bullets: [
    "Tracks core operational contributions and project deliveries",
    "Highlights collaboration and support structures",
    "Focuses on leadership development and learning curves",
    "Ensures alignment with organizational OKRs and target key results"
  ],
  examples: [
    {
      level: "Associate Level",
      focus: "Task Delivery & Learning",
      text: "During this review period, I successfully took ownership of completing our catalog audit ahead of schedule. I focused on standardizing our team tracker, reducing document retrieval times by 15%. I proactively engaged with team members to master new workflow tools, demonstrating continuous skill improvement."
    },
    {
      level: "Mid-Senior Level",
      focus: "Operational Efficiency & Collaboration",
      text: "I demonstrated technical competence and collaborative value this quarter by streamlining our vendor communications pipeline. By partnering with Finance and Operations, I helped design a unified tracking dashboard. This strategic dashboard eliminated record duplication, reduced team communication cycles by 30%, and ensured all quarterly milestones were met."
    },
    {
      level: "Lead / Manager Level",
      focus: "Strategic Leadership & Impact",
      text: "I took full accountability for leading our Q3 team restructure, successfully reorganizing active resources without delaying core deliveries. Under my guidance, the team established a new communication cadence that saved 10+ administrative hours per week, while actively mentoring 3 junior employees for promotion readiness."
    }
  ]
};

const ROLE_DATA_MAP: Record<string, RoleDetail> = {
  "software-engineer": {
    roleName: "Software Engineer",
    title: "Software Engineer Self-Appraisal Templates & STAR Comments",
    desc: "Accelerate your developer appraisal. Find structured accomplishments, STAR examples for frontend/backend engineers, and downloadable promotion templates.",
    bullets: [
      "Highlights code quality, test coverage, and system architecture",
      "Features latency optimization, bug fixes, and data schema indexing",
      "Demonstrates agile collaboration, peer reviews, and mentorship wins",
      "Validates feature deliveries against strict deployment schedules"
    ],
    examples: [
      {
        level: "Junior Software Engineer",
        focus: "Feature Delivery & Code Quality",
        text: "During this review period, I successfully delivered 12 high-priority features on time with zero post-release regressions. I took ownership of our new client dashboard component, actively seeking code review feedback to elevate my understanding of React best practices and improving unit test coverage from 65% to 80%."
      },
      {
        level: "Senior Software Engineer",
        focus: "System Performance & Architecture",
        text: "I demonstrated technical leadership by auditing our main analytics query structure. By implementing redis-backed caching and refactoring complex SQL joins, I successfully reduced search response times by 62%, improving the user dashboard loading speed from 4.8s to 1.5s. Additionally, I led the architecture review for 3 new feature streams."
      },
      {
        level: "Staff / Lead Engineer",
        focus: "Technical Mentorship & Strategic Vision",
        text: "I spearheaded the core migration of our database models, directing a team of 5 developers to complete the release ahead of schedule. Under my guidance, the team established query performance standard operating procedures, cutting average page load times across the app. I actively mentored 4 junior developers, resulting in 2 successful promotions."
      }
    ]
  },
  "product-manager": {
    roleName: "Product Manager",
    title: "Product Manager Self-Evaluation Templates & Examples",
    desc: "Craft a compelling product leadership narrative. Discover copy-pasteable accomplishments, STAR-structured goal metrics, and promotion guidelines for PMs.",
    bullets: [
      "Highlights roadmap definition, user research, and spec prioritization",
      "Details cross-functional leadership across dev, design, and marketing",
      "Tracks product adoption metrics, active user growth, and churn reduction",
      "Aligns product features directly with company strategic initiatives"
    ],
    examples: [
      {
        level: "Associate Product Manager",
        focus: "Feature Delivery & Analytics",
        text: "During this period, I successfully coordinated the launch of our new onboarding sequence. By partnering with UX Research and writing detailed user stories, I delivered the feature on schedule, leading to a direct 14% improvement in first-week user retention."
      },
      {
        level: "Senior Product Manager",
        focus: "Roadmap Strategy & Churn Reduction",
        text: "I led the strategic repositioning of our enterprise dashboard, conducting 20+ qualitative customer interviews to define our Q3 roadmap. By prioritizing customer-requested data features, I managed the cross-functional release, which secured a 22% improvement in enterprise account renewals and drove $80k in expansion revenue."
      },
      {
        level: "Product Director / Lead PM",
        focus: "Product Vision & Team Mentorship",
        text: "I took ownership of our platform's 2026 growth roadmap, aligning 3 independent product teams with our company-wide OKRs. Under my direction, we launched the self-appraisal suite, acquiring 15,000 active signups in Q1. I directly managed and mentored a team of 4 PMs, structuring clear career growth tracks for each."
      }
    ]
  },
  "marketing-manager": {
    roleName: "Marketing Manager",
    title: "Marketing Manager Self-Appraisal Templates & Phrases",
    desc: "Showcase your campaign growth and metrics. Utilize STAR examples, content strategy templates, and programmatic growth formulas for marketers.",
    bullets: [
      "Tracks customer acquisition cost (CAC) and marketing ROI improvements",
      "Highlights brand positioning, editorial calendars, and content pillars",
      "Measures organic visitor growth, SEO optimization, and conversions",
      "Demonstrates brand representation and cross-functional campaigns"
    ],
    examples: [
      {
        level: "Marketing Coordinator",
        focus: "Campaign Execution & Social Proof",
        text: "This quarter, I successfully managed our editorial content calendar, publishing 18 high-ranking articles that boosted organic traffic by 25%. Additionally, I facilitated our user case study program, publishing 5 client video testimonials that enhanced social proof on the web."
      },
      {
        level: "Senior Marketing Manager",
        focus: "Growth SEO & Programmatic Campaigns",
        text: "I championed our programmatic SEO strategy, defining a detailed topical map around self-appraisal guides. By scaling dynamic landing pages, I drove a 140% increase in high-intent keyword search traffic and slashed our blended customer acquisition costs (CAC) by 18%."
      },
      {
        level: "Marketing Director / CMO",
        focus: "Brand Strategy & Global Allocation",
        text: "I took full responsibility for our $250k marketing budget, restructuring ad allocation to improve blended conversion rates. I managed a high-performing creative team of 8 designers and copywriters, successfully rolling out the Q4 brand overhaul which achieved a 30% increase in brand mentions."
      }
    ]
  },
  "ui-designer": {
    roleName: "UI Designer",
    title: "UI / UX Designer Self-Appraisal Templates & STAR Examples",
    desc: "Frame your design decisions as measurable business outcomes. STAR-formatted examples covering Figma systems, accessibility wins, and conversion lift for product designers.",
    bullets: [
      "Quantifies usability gains, conversion lift, and task completion rates",
      "Demonstrates design-system contributions and component-library scale",
      "Shows research-driven decisions backed by user testing",
      "Covers accessibility (WCAG) and inclusive-design improvements"
    ],
    examples: [
      {
        level: "Junior UI Designer",
        focus: "Component Library & Visual Polish",
        text: "I contributed 14 new components to our shared Figma library, reducing duplicate work across 3 squads. I redesigned the empty states for our onboarding flow, which lifted the activation completion rate by 9% in A/B testing and shipped to 100% of new signups."
      },
      {
        level: "Senior Product Designer",
        focus: "Research-Driven Conversion Lift",
        text: "I led the redesign of our pricing page following 18 customer interviews and 3 rounds of usability testing. The shipped variant lifted free-tier signups by 27% and reduced our help-desk pricing questions by 45%, validating the simplified plan-comparison layout."
      },
      {
        level: "Staff / Design Lead",
        focus: "Design System & Cross-Team Strategy",
        text: "I owned the v2 rewrite of our design system, migrating 12 product surfaces to a single token-based theming layer. Under my guidance, we hit WCAG AA across the entire app and reduced front-end CSS bundle size by 32%, freeing 200ms of LCP across mobile."
      }
    ]
  },
  "qa-lead": {
    roleName: "QA Lead",
    title: "QA Lead Self-Appraisal Templates & Quality Engineering STAR Examples",
    desc: "Position your quality work as risk reduction and velocity. STAR examples covering test automation, escape-rate reduction, and shift-left initiatives for QA and SDET leads.",
    bullets: [
      "Tracks defect escape rate, test coverage, and CI signal quality",
      "Quantifies time saved through automation and parallelization",
      "Demonstrates shift-left initiatives and developer-experience wins",
      "Shows incident-response leadership and post-mortem quality"
    ],
    examples: [
      {
        level: "QA Engineer",
        focus: "Test Coverage & Automation",
        text: "I authored 240 new end-to-end Playwright tests covering our checkout funnel, lifting critical-path coverage from 58% to 91%. The expanded suite caught 7 regressions before merge in Q3, preventing what historically would have been customer-visible incidents."
      },
      {
        level: "Senior QA Engineer / SDET",
        focus: "Pipeline Speed & Flake Reduction",
        text: "I refactored our CI test matrix to run in parallel shards, cutting build time from 22 minutes to 7 minutes. I also drove a quarterly flake-budget initiative, reducing the rolling flake rate from 4.1% to 0.6% — restoring developer trust in the red/green signal."
      },
      {
        level: "QA Lead / Manager",
        focus: "Quality Strategy & Shift-Left",
        text: "I established our shift-left quality program, embedding QA engineers in 4 product squads and shipping the first contract-testing framework across our service mesh. Defect escape rate fell 62% year-over-year, and we eliminated 3 of the 4 historical Sev-1 categories."
      }
    ]
  },
  "data-analyst": {
    roleName: "Data Analyst",
    title: "Data Analyst Self-Appraisal Templates & Analytics STAR Examples",
    desc: "Turn dashboards and SQL into business outcomes. STAR-formatted examples covering experimentation, attribution, and self-serve analytics for data analysts and BI engineers.",
    bullets: [
      "Quantifies revenue or cost impact from experiments and analyses",
      "Shows stakeholder enablement via dashboards and self-serve tooling",
      "Demonstrates data-quality and model-governance improvements",
      "Highlights cross-functional partnership with product, growth, and finance"
    ],
    examples: [
      {
        level: "Data Analyst",
        focus: "Experimentation & Insight Delivery",
        text: "I designed and analyzed 11 A/B tests across the onboarding funnel this quarter. Three were rolled out to 100% based on my recommendations and collectively lifted Week-1 retention by 6.2 percentage points, the equivalent of ~$140k in annualized recurring revenue."
      },
      {
        level: "Senior Data Analyst",
        focus: "Dashboard Enablement & Attribution",
        text: "I built a self-serve growth dashboard in Looker that replaced 14 recurring ad-hoc requests, freeing roughly 9 analyst-hours per week. My multi-touch attribution model also corrected our paid-channel ROAS calculation, redirecting $60k of monthly budget into higher-performing channels."
      },
      {
        level: "Analytics Lead / Manager",
        focus: "Data Strategy & Governance",
        text: "I led the migration of our reporting layer to dbt + Snowflake, instituting tested SQL models and a tier-1/2/3 SLA framework. Query latency dropped 70% and data-incident MTTR fell from 6 hours to under 45 minutes — measurably restoring stakeholder trust in our metrics."
      }
    ]
  },
  "engineering-manager": {
    roleName: "Engineering Manager",
    title: "Engineering Manager Self-Appraisal Templates & Leadership STAR Examples",
    desc: "Make your management impact visible. STAR-formatted examples covering team velocity, retention, hiring, and technical strategy for engineering managers and tech leads.",
    bullets: [
      "Shows team velocity, predictability, and quality outcomes",
      "Quantifies retention, hiring, and promotion of direct reports",
      "Demonstrates technical strategy and architectural decision making",
      "Highlights cross-org partnership with product, design, and exec stakeholders"
    ],
    examples: [
      {
        level: "Tech Lead Manager",
        focus: "Team Velocity & Delivery Predictability",
        text: "I shipped our team's 2026 roadmap on schedule for 4 consecutive quarters, the first such streak in team history. By introducing weekly delivery health reviews and trimming WIP, our cycle time dropped from 9 days to 3.5 days while quality bar (escaped defects per release) held flat."
      },
      {
        level: "Engineering Manager",
        focus: "People Leadership & Retention",
        text: "I grew the team from 5 to 9 engineers this year, closing all 4 reqs within target time-to-fill and retaining 100% of existing engineers through a competitive hiring market. Two engineers were promoted under my coaching — one to Senior and one to Staff — both with unanimous calibration support."
      },
      {
        level: "Senior Engineering Manager",
        focus: "Org Strategy & Architectural Influence",
        text: "I co-authored our platform's 3-year technical strategy, aligning 6 partner teams on a shared services boundary and migration sequence. I personally led the org-wide post-mortem on our Q2 latency incident, driving 4 cross-team workstreams that brought P99 from 1.4s back under our 600ms SLO."
      }
    ]
  },
  "devops-engineer": {
    roleName: "DevOps Engineer",
    title: "DevOps Engineer Self-Appraisal Templates & Infrastructure STAR Examples",
    desc: "Translate platform work into reliability and cost outcomes. STAR examples covering CI/CD, observability, incident response, and FinOps for DevOps, SRE, and platform engineers.",
    bullets: [
      "Quantifies uptime, deploy frequency, and incident-response improvements",
      "Demonstrates infrastructure cost savings and FinOps wins",
      "Shows observability and developer-experience contributions",
      "Highlights security, compliance, and disaster-recovery readiness"
    ],
    examples: [
      {
        level: "DevOps Engineer",
        focus: "CI/CD & Deploy Frequency",
        text: "I rebuilt our deploy pipeline on GitHub Actions with parallelized container builds and remote layer caching. Deploy frequency rose from 4/week to an average of 18/week, and the mean deploy lead time dropped from 38 minutes to 7 minutes — a measurable DORA improvement."
      },
      {
        level: "Senior SRE",
        focus: "Reliability & Incident Response",
        text: "I owned the migration from single-region RDS to multi-AZ with managed read replicas, lifting our database availability SLO from 99.9% to 99.99%. I also rewrote our incident runbook, cutting MTTR for paging events from 47 minutes to 14 minutes during our Q4 traffic spike."
      },
      {
        level: "Platform Lead / Staff SRE",
        focus: "FinOps & Architectural Influence",
        text: "I led a cross-team FinOps initiative that right-sized Kubernetes node pools and migrated stateless workloads to Graviton. Monthly cloud spend dropped 31% — about $42k/month — with no measured impact on latency or error rate, and the savings were redirected into our zero-trust networking rollout."
      }
    ]
  }
};

const ROLE_SLUGS = Object.keys(ROLE_DATA_MAP);

function resolveRoleData(role: string): RoleDetail {
  return (
    ROLE_DATA_MAP[role] ?? {
      ...DEFAULT_ROLE,
      roleName: role
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    }
  );
}

export async function generateStaticParams() {
  return ROLE_SLUGS.map((role) => ({ role }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ role: string }> }
): Promise<Metadata> {
  const { role } = await params;
  const data = resolveRoleData(role);
  const canonicalPath = `/templates/self-appraisal/${role}`;

  return {
    title: data.title,
    description: data.desc,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: `${data.title} | Impactly AI`,
      description: data.desc,
      url: `https://impactlyai.com${canonicalPath}`,
      type: "article",
      images: ["/og-default.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${data.title} | Impactly AI`,
      description: data.desc,
      images: ["/og-default.png"],
    },
  };
}

export default async function RoleTemplatePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  const data = resolveRoleData(role);
  const canonical = `https://impactlyai.com/templates/self-appraisal/${role}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://impactlyai.com",
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Self-Appraisal Templates",
        "item": "https://impactlyai.com/templates/self-appraisal",
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": data.roleName,
        "item": canonical,
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": data.title,
    "description": data.desc,
    "mainEntityOfPage": canonical,
    "url": canonical,
    "image": "https://impactlyai.com/og-default.png",
    "author": {
      "@type": "Organization",
      "name": "Impactly AI",
      "url": "https://impactlyai.com",
    },
    "publisher": {
      "@type": "Organization",
      "name": "Impactly AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://impactlyai.com/og-default.png",
      },
    },
    "datePublished": "2026-06-04",
    "dateModified": "2026-06-04",
  };

  return (
    <div className="bg-futuristic min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <header className="relative w-full z-50 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center group">
            <svg className="h-7 w-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="ml-2 text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">Impactly AI</span>
          </Link>

          <a
            href="https://app.impactlyai.com/login"
            className="px-4 py-2 rounded-lg text-xs md:text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg hover:shadow-indigo-500/20 transition-all glow-primary"
          >
            Get Started Free
          </a>
        </div>
      </header>

      <main className="flex-1 py-12 px-4 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs md:text-sm text-gray-500 hover:text-indigo-400 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Homepage</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-20">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 font-semibold uppercase tracking-wider">
              <Bookmark className="w-3.5 h-3.5" />
              <span>Role-Specific Template Guide</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
              {data.title}
            </h1>

            <p className="text-sm md:text-base text-gray-400 leading-relaxed font-normal">
              {data.desc}
            </p>

            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest font-bold">What this template focuses on:</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex gap-2.5 items-start text-xs text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <a
                href="https://app.impactlyai.com/login"
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <span>Write My appraisal with AI</span>
                <Sparkles className="w-4 h-4" />
              </a>
              <a
                href="https://app.impactlyai.com/login"
                className="px-6 py-3 glass hover:bg-white/10 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-white/5"
              >
                <span>Download Markdown Template</span>
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-5 glass rounded-3xl p-6 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full"></div>
            <h3 className="text-base font-bold text-white mb-3">How to write a perfect self-review:</h3>
            <ol className="space-y-4">
              {[
                { step: "01", title: "Ground with raw bullet points", desc: "List all core accomplishments weekly to sidestep recency bias." },
                { step: "02", title: "Inject STAR structure", desc: "Define precisely the Situation, Task, Action taken, and final quantifiable Result." },
                { step: "03", title: "Map to corporate parameters", desc: "Infuse specific target competencies, values, and team goals." }
              ].map((item, idx) => (
                <li key={idx} className="flex gap-3.5 items-start">
                  <span className="text-xs font-mono bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded font-bold">{item.step}</span>
                  <div>
                    <h4 className="text-xs font-bold text-gray-200">{item.title}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <section className="mb-20">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
              Structured STAR Examples for {data.roleName}s
            </h2>
            <p className="text-xs md:text-sm text-gray-500 max-w-xl">
              Select and customize these pre-formatted STAR responses. Each text segment illustrates optimal career phrasing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.examples.map((ex, idx) => (
              <div key={idx} className="glass rounded-2xl p-6 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
                <div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <span className="text-xs font-extrabold text-indigo-400 font-mono tracking-wider uppercase">{ex.level}</span>
                    <span className="text-[10px] text-gray-500 bg-white/2 px-2 py-0.5 rounded border border-white/5">{ex.focus}</span>
                  </div>
                  <p className="text-xs md:text-sm text-gray-400 leading-relaxed whitespace-pre-line italic">
                    &quot;{ex.text}&quot;
                  </p>
                </div>

                <a
                  href="https://app.impactlyai.com/login"
                  className="mt-6 flex items-center justify-center gap-1 w-full py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-all border border-white/5"
                >
                  <span>Copy &amp; Customize in App</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </section>

        <section id="custom-generator" className="py-16 border-t border-white/5">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-2">
              Generate Custom {data.roleName} Appraisals
            </h2>
            <p className="text-xs md:text-sm text-gray-500 max-w-lg mx-auto">
              Test-drive the specialized performance writing models below. Perfect for {data.roleName} reviews.
            </p>
          </div>
          <PlaygroundWidget />
        </section>
      </main>

      <footer className="border-t border-white/5 bg-black/40 py-12 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="ml-2 text-sm font-bold text-white">Impactly AI</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-500">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
            <a href="https://app.impactlyai.com/login" className="hover:text-gray-300 transition-colors">App Workspace</a>
          </div>
          <span className="text-xs text-gray-500">© 2026 Impactly AI. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
