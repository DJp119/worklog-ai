import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, Calendar, User } from "lucide-react";
import { BLOG_POSTS, getAllPostSlugs, getPostBySlug } from "@/content/blogPosts";
import type { BlogContentBlock } from "@/content/blogPosts";

export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return { title: "Article Not Found" };
  }
  const canonical = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author }],
    alternates: { canonical },
    openGraph: {
      title: `${post.title} | Impactly AI`,
      description: post.description,
      url: `https://impactlyai.com${canonical}`,
      type: "article",
      publishedTime: post.publishedDate,
      modifiedTime: post.modifiedDate ?? post.publishedDate,
      authors: [post.author],
      tags: post.tags,
      images: ["/og-default.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | Impactly AI`,
      description: post.description,
      images: ["/og-default.png"],
    },
  };
}

function renderBlock(block: BlogContentBlock, idx: number) {
  switch (block.type) {
    case "p":
      return (
        <p key={idx} className="text-[15px] md:text-base text-gray-300 leading-[1.85] mb-5">
          {block.text}
        </p>
      );
    case "h2":
      return (
        <h2 key={idx} id={block.id} className="text-2xl md:text-3xl font-bold text-white mt-12 mb-4 scroll-mt-20">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={idx} id={block.id} className="text-xl md:text-2xl font-semibold text-white mt-8 mb-3 scroll-mt-20">
          {block.text}
        </h3>
      );
    case "ul":
      return (
        <ul key={idx} className="space-y-2 mb-6 pl-5 list-disc text-gray-300 text-[15px] leading-[1.85] marker:text-indigo-400">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    case "ol":
      return (
        <ol key={idx} className="space-y-2 mb-6 pl-5 list-decimal text-gray-300 text-[15px] leading-[1.85] marker:text-indigo-400">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      );
    case "quote":
      return (
        <blockquote key={idx} className="border-l-4 border-indigo-500/60 bg-indigo-500/5 pl-5 py-4 my-6 rounded-r-xl">
          <p className="text-[15px] md:text-base text-gray-200 italic leading-relaxed">&ldquo;{block.text}&rdquo;</p>
          {block.cite && (
            <footer className="mt-2 text-xs font-mono text-indigo-400/80 uppercase tracking-wider">— {block.cite}</footer>
          )}
        </blockquote>
      );
    case "callout":
      return (
        <aside
          key={idx}
          className={`my-7 p-5 rounded-2xl border ${
            block.tone === "warn"
              ? "bg-red-500/5 border-red-500/20"
              : "bg-indigo-500/5 border-indigo-500/20"
          }`}
        >
          <h4 className={`text-sm font-bold mb-2 ${block.tone === "warn" ? "text-red-300" : "text-indigo-300"}`}>
            {block.title}
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed">{block.text}</p>
        </aside>
      );
    case "code":
      return (
        <pre key={idx} className="my-6 p-4 rounded-xl bg-black/50 border border-white/10 overflow-x-auto">
          <code className={`language-${block.language} text-xs text-gray-200 font-mono`}>{block.text}</code>
        </pre>
      );
    case "cta":
      return (
        <div key={idx} className="my-8 p-6 glass rounded-2xl border border-indigo-500/20 text-center">
          <p className="text-sm md:text-base text-gray-200 mb-4">{block.text}</p>
          <a
            href={block.href}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-sm rounded-xl"
          >
            <span>{block.label}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      );
    default:
      return null;
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const canonical = `https://impactlyai.com/blog/${post.slug}`;

  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.description,
    "mainEntityOfPage": canonical,
    "url": canonical,
    "image": "https://impactlyai.com/og-default.png",
    "author": {
      "@type": "Organization",
      "name": post.author,
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
    "datePublished": post.publishedDate,
    "dateModified": post.modifiedDate ?? post.publishedDate,
    "keywords": post.tags.join(", "),
    "articleSection": post.funnel,
    "wordCount": post.content
      .filter((b): b is { type: "p"; text: string } => b.type === "p")
      .reduce((acc, b) => acc + b.text.split(/\s+/).length, 0),
    "timeRequired": `PT${post.readingTimeMinutes}M`,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://impactlyai.com" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://impactlyai.com/blog" },
      { "@type": "ListItem", "position": 3, "name": post.title, "item": canonical },
    ],
  };

  const relatedPosts = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="bg-futuristic min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }} />
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
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs md:text-sm text-gray-400 hover:text-indigo-400 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Blog</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16 w-full">
        <article>
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4">
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {post.funnel}
              </span>
              {post.tags.slice(0, 2).map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-white/5 border border-white/5 normal-case">{t}</span>
              ))}
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-5">{post.title}</h1>
            <p className="text-base md:text-lg text-gray-400 leading-relaxed mb-6">{post.excerpt}</p>
            <div className="flex flex-wrap items-center gap-5 text-xs text-gray-500 border-t border-white/5 pt-5">
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {post.author}</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(post.publishedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {post.readingTimeMinutes} min read</span>
            </div>
          </header>

          <div className="prose-styles">
            {post.content.map((block, idx) => renderBlock(block, idx))}
          </div>
        </article>

        {post.relatedRoleSlugs && post.relatedRoleSlugs.length > 0 && (
          <aside className="mt-16 pt-10 border-t border-white/5">
            <h3 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-5">Role templates referenced</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {post.relatedRoleSlugs.map((slug) => (
                <Link
                  key={slug}
                  href={`/templates/self-appraisal/${slug}`}
                  className="block p-4 glass rounded-xl border border-white/5 hover:border-white/15 transition-colors text-sm text-gray-300"
                >
                  {slug
                    .split("-")
                    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                    .join(" ")} →
                </Link>
              ))}
            </div>
          </aside>
        )}

        {relatedPosts.length > 0 && (
          <aside className="mt-12 pt-10 border-t border-white/5">
            <h3 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-5">Keep reading</h3>
            <div className="space-y-3">
              {relatedPosts.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="block p-4 glass rounded-xl border border-white/5 hover:border-white/15 transition-colors"
                >
                  <h4 className="text-base font-semibold text-white mb-1">{p.title}</h4>
                  <p className="text-xs text-gray-400">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </main>

      <footer className="border-t border-white/5 bg-black/40 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <span>© 2026 Impactly AI. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-gray-300 transition-colors">Blog</Link>
            <Link href="/templates/self-appraisal" className="hover:text-gray-300 transition-colors">Templates</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
