import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Impactly AI collects, uses, and protects your data. Row-Level Security, encryption in transit and at rest, and an explicit no-LLM-training policy on private work logs.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | Impactly AI",
    description:
      "How Impactly AI collects, uses, and protects your data. Row-Level Security, encryption, and an explicit no-LLM-training policy.",
    url: "https://impactlyai.com/privacy",
    type: "article",
  },
};

export default function PrivacyPage() {
  return (
    <div className="bg-futuristic min-h-screen flex flex-col">
      <header className="relative w-full z-50 border-b border-white/5 bg-black/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center group">
            <svg className="h-7 w-7 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="ml-2 text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">Impactly AI</span>
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

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16 space-y-10">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center mb-6 text-indigo-400">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Privacy <span className="gradient-text">Policy</span>
          </h1>
          <p className="text-sm text-gray-500">Last updated: June 4, 2026</p>
        </div>

        <article className="glass-strong rounded-2xl p-8 md:p-10 space-y-8 text-gray-300 border border-white/5">
          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              We collect information you provide directly to us — your email address, name, job title, target seniority levels, and the contents
              of the weekly work logs and AI-generated appraisals you create inside Impactly AI. This includes accomplishments, project metrics,
              hurdles overcome, and team contribution summaries.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              We also collect automated telemetry and system data when you interact with the app. This includes cookies, local browser storage,
              anonymized usage logs, browser type, device information, and referral sources to help optimize performance and user experience.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              Your work-log entries are processed by Mistral-hosted AI models to generate structured, STAR-formatted self-appraisals scoped to your
              account. We use this data strictly to provide, maintain, and support the application.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-indigo-300/95 font-medium">
              We enforce a strict privacy boundary: we do not use your private work logs, goals, metrics, or generated evaluations to train large language models — neither ours nor any third-party providers. Your data remains strictly isolated.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">3. Information Sharing</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              We do not sell, rent, or trade your personal data. Data is shared only with trusted third-party service providers strictly
              required to host and operate the Impactly AI infrastructure:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-400">
              <li><strong>Supabase:</strong> For cloud database storage, authentication routing, and Row-Level Security containment.</li>
              <li><strong>Mistral AI:</strong> For processing work logs into structured appraisal drafts via secure API channels.</li>
              <li><strong>Resend:</strong> For transactional emails, account notifications, and weekly check-in reminders.</li>
              <li><strong>Vercel and Render:</strong> For hosting web application servers and front-end assets.</li>
              <li><strong>PostHog and Google Analytics:</strong> For tracking anonymized user flows and interaction telemetry.</li>
            </ul>
          </section>

          <section className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">4. Data Security</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              All data is encrypted in transit using TLS 1.3 and at rest using AES-256 standards. We enforce database-level Row-Level Security (RLS) so
              that every backend database query is cryptographically filtered to return only the rows owned by the currently authenticated user session.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              While we implement state-of-the-art protections, no database or network is entirely impenetrable. You accept that Impactly AI is not liable for breaches outside our reasonable control. Please exercise discretion and avoid entering classified company secrets.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">5. Data Retention & Deletion</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              We retain your data for as long as your account is active to provide you with historical log features. You can request deletion of your account and
              associated data at any time.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              Upon requesting deletion via support channels, your database entries will be wiped from active database tables, and backup logs will cycle out within a standard 30-day window.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">6. Contact</h2>
            <p className="leading-relaxed text-sm md:text-base">
              For any questions regarding this Privacy Policy or your data, please contact us using the in-app feedback forms or email the support address listed in your account settings dashboard.
            </p>
          </section>
        </article>
      </main>

      <footer className="border-t border-white/5 bg-black/40 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <span>© 2026 Impactly AI. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-gray-300 transition-colors">Blog</Link>
            <Link href="/templates/self-appraisal" className="hover:text-gray-300 transition-colors">Templates</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
