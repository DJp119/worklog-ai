import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing your use of Impactly AI — the privacy-first AI self-appraisal generator. Read about acceptable use, accounts, billing, and our content policies.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | Impactly AI",
    description:
      "Terms governing your use of Impactly AI. Acceptable use, accounts, billing, content policies.",
    url: "https://impactlyai.com/terms",
    type: "article",
  },
};

export default function TermsPage() {
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
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Terms &amp; <span className="gradient-text">Conditions</span>
          </h1>
          <p className="text-sm text-gray-500">Last updated: June 4, 2026</p>
        </div>

        <article className="glass-strong rounded-2xl p-8 md:p-10 space-y-8 text-gray-300 border border-white/5">
          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p className="leading-relaxed text-sm md:text-base">
              By accessing and using Impactly AI (available at impactlyai.com and app.impactlyai.com), you agree to be
              bound by these Terms. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p className="leading-relaxed text-sm md:text-base">
              Impactly AI is a platform for logging weekly work activities and generating AI-powered self-appraisals.
              You are responsible for the data you input. We make no warranties about the accuracy, completeness, or
              suitability of AI-generated content for any specific employment decision.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">3. User Accounts</h2>
            <p className="leading-relaxed text-sm md:text-base">
              You must register for an account to access most features. You agree to provide accurate information,
              keep it current, and maintain the confidentiality of your credentials. You are responsible for activity
              on your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p className="leading-relaxed text-sm md:text-base">
              Do not use Impactly AI to log unlawful content, classified information, or another person&apos;s confidential
              data. Do not attempt to reverse-engineer, scrape, or stress-test the service without written permission.
            </p>
          </section>

          <section className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">5. Limitation of Liability</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              Impactly AI is provided &quot;as is.&quot; To the maximum extent permitted by law, Impactly AI and its operators
              are not liable for indirect, incidental, or consequential damages — including loss of promotion outcomes,
              employment decisions, or data exposure resulting from breaches outside our reasonable control.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              Use the service at your own risk. Do not submit highly sensitive material that would cause harm if
              exposed.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">6. Termination</h2>
            <p className="leading-relaxed text-sm md:text-base">
              We may suspend or terminate access at any time for breach of these Terms. You may close your account at
              any time, after which we delete your data according to our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">7. Changes to Terms</h2>
            <p className="leading-relaxed text-sm md:text-base">
              We may update these Terms periodically. Continued use of the service after changes constitutes acceptance
              of the revised Terms.
            </p>
          </section>
        </article>
      </main>

      <footer className="border-t border-white/5 bg-black/40 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <span>© 2026 Impactly AI. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
