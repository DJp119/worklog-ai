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
            <p className="leading-relaxed text-sm md:text-base mb-3">
              By accessing, browsing, registering for, or using Impactly AI (including impactlyai.com, its subdomains such as app.impactlyai.com, and related services), you agree to be
              bound by these Terms of Conditions. If you do not agree to all of these Terms, you are prohibited from using the service.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              These terms constitute a binding legal agreement between you and the operators of Impactly AI.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              Impactly AI is a platform designed to help professionals track and compile weekly work activities and automatically draft AI-powered, structured self-appraisals using secure Large Language Model interfaces.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              You maintain full ownership and responsibility for the data and logs you input. We do not inspect, edit, or control your logs. While our AI models aim to optimize formatting and highlight metrics, we make no guarantees regarding the ultimate accuracy, adequacy, or professional impact of any generated text in any formal performance evaluation or promotion context.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">3. User Accounts & Registration</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              To utilize the core features of the service, you must register for an account using verified authentication paths (such as Google or GitHub authentication). You agree to provide accurate registration info, keep it current, and safeguard the credentials you use to access the app.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              You are fully responsible for any and all activity that occurs under your account. You must notify us immediately if you suspect any unauthorized access or data security breach.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">4. Acceptable Use Policy</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              You agree not to use Impactly AI to log unlawful material, publish copyrighted content without authorization, or input classified company information that violates standard employee disclosures.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              Furthermore, you agree not to attempt to reverse-engineer the application structure, scrape public/private database paths, run automated denial of service tests, or trigger stress tests on active API endpoints without explicit prior written authorization.
            </p>
          </section>

          <section className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">5. Limitation of Liability</h2>
            <p className="leading-relaxed text-sm md:text-base mb-3">
              Impactly AI and its infrastructure are provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind. To the maximum extent permitted by law, the operators of Impactly AI are not liable for any indirect, incidental, or consequential damages.
            </p>
            <p className="leading-relaxed text-sm md:text-base text-gray-400">
              This includes, but is not limited to, losses involving promotion outcomes, career status changes, or data exposure resulting from server issues outside our reasonable control. Use the service at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">6. Account Termination</h2>
            <p className="leading-relaxed text-sm md:text-base">
              We reserve the right to suspend or terminate your access to the service at any time if we find you are in breach of these Terms of Service. You may close your active account at any time. Following closure, your log history is queued for deletion in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">7. Changes to Terms</h2>
            <p className="leading-relaxed text-sm md:text-base">
              We reserve the right to periodically update these Terms. When modifications are made, we will update the &quot;Last updated&quot; date. Your continued use of the service following updates signifies your acceptance of the new terms.
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
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
