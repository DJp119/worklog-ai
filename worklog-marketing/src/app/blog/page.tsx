import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Clock, Tag } from "lucide-react";
import { BLOG_POSTS } from "@/content/blogPosts";

export const metadata: Metadata = {
  title: "Career Growth & Performance Review Blog",
  description:
    "Long-form guides on writing self-appraisals, STAR-method examples, brag documents, promotion packets, and AI-assisted performance reviews. Updated weekly.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Career Growth & Performance Review Blog | Impactly AI",
    description:
      "Long-form guides on self-appraisals, STAR examples, brag documents, and promotion packets.",
    url: "https://impactlyai.com/blog",
    type: "website",
    images: ["/og-default.png"],
  },
};

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
  );

  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Impactly AI Blog",
    "url": "https://impactlyai.com/blog",
    "description":
      "Long-form guides on self-appraisals, STAR-method examples, brag documents, promotion packets, and AI-assisted performance reviews.",
    "publisher": {
      "@type": "Organization",
      "name": "Impactly AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://impactlyai.com/og-default.png",
      },
    },
    "blogPost": posts.map((p) => ({
      "@type": "BlogPosting",
      "headline": p.title,
      "url": `https://impactlyai.com/blog/${p.slug}`,
      "datePublished": p.publishedDate,
      "dateModified": p.modifiedDate ?? p.publishedDate,
      "author": { "@type": "Organization", "name": p.author },
      "keywords": p.tags.join(", "),
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://impactlyai.com" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://impactlyai.com/blog" },
    ],
  };

  return (
    <div className="bg-futuristic min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

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

      <main className="flex-1 max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center mb-6 text-indigo-400">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Career Growth &amp; <span className="gradient-text">Performance Review</span> Guides
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
            Long-form playbooks on self-appraisals, STAR-method examples, brag documents, and promotion packets. Written
            for engineers, PMs, designers, and managers.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group glass rounded-2xl p-7 border border-white/5 hover:border-white/15 transition-all"
            >
              <div className="flex items-center gap-3 mb-3 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {post.funnel}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {post.readingTimeMinutes} min read
                </span>
                <span>{new Date(post.publishedDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">
                {post.title}
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed mb-4">{post.excerpt}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <Tag className="w-3.5 h-3.5" />
                {post.tags.slice(0, 4).map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-white/5 border border-white/5">{t}</span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-1.5 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                <span>Read Article</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 mb-4">Want these techniques applied to your own work logs?</p>
          <a
            href="https://app.impactlyai.com/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-sm rounded-xl"
          >
            <span>Try the AI Appraisal Generator Free</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </main>

      <footer className="border-t border-white/5 bg-black/40 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <span>© 2026 Impactly AI. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/templates/self-appraisal" className="hover:text-gray-300 transition-colors">Templates</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
