export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedDate: string;
  modifiedDate?: string;
  author: string;
  readingTimeMinutes: number;
  funnel: "TOFU" | "MOFU" | "BOFU";
  targetKeyword: string;
  tags: string[];
  relatedRoleSlugs?: string[];
  excerpt: string;
  content: BlogContentBlock[];
}

export type BlogContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id?: string }
  | { type: "h3"; text: string; id?: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; tone: "info" | "warn"; title: string; text: string }
  | { type: "code"; language: string; text: string }
  | { type: "cta"; text: string; href: string; label: string };

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "star-method-performance-review",
    title: "The STAR Method for Performance Reviews: A Complete 2026 Guide",
    description:
      "Learn the STAR method (Situation, Task, Action, Result) for self-appraisals with 15 real examples, common mistakes, and how to map STAR responses to company OKRs.",
    publishedDate: "2026-06-04",
    modifiedDate: "2026-06-04",
    author: "Impactly AI Team",
    readingTimeMinutes: 9,
    funnel: "TOFU",
    targetKeyword: "STAR method examples",
    tags: ["STAR method", "performance review", "self-appraisal", "career growth"],
    relatedRoleSlugs: ["software-engineer", "product-manager", "engineering-manager"],
    excerpt:
      "If your self-appraisals read like a job description (\"managed team, delivered features\"), you are leaving promotion equity on the table. The STAR method is the proven structure for turning vague tasks into measurable impact.",
    content: [
      {
        type: "p",
        text: "Self-appraisals fail the same way most resumes fail — they describe responsibilities instead of outcomes. The STAR method is a four-part structure that forces every accomplishment to land with a measurable result, which is exactly what calibration committees, hiring managers, and promotion packets need to see.",
      },
      {
        type: "p",
        text: "STAR stands for Situation, Task, Action, Result. It came out of structured behavioral interviewing in the 1970s and has since become the default framework used by HR teams at companies like Google, Amazon, and Microsoft — both for evaluating candidates and for writing self-evaluations. The structure does two things at once: it forces specificity, and it makes your contribution easy to compare against peers.",
      },
      { type: "h2", text: "Why STAR works for self-appraisals", id: "why-star-works" },
      {
        type: "ul",
        items: [
          "Calibration committees read dozens of self-reviews per cycle — STAR responses are scannable in under 20 seconds.",
          "It separates your individual action from team outcomes, so credit lands with you instead of being smeared across a project.",
          "The required Result line forces a number, which anchors the rest of the appraisal in measurable impact.",
          "It maps cleanly to company OKRs, which is how most performance frameworks (Lattice, 15Five, Workday) score employees.",
        ],
      },
      { type: "h2", text: "The four STAR components, broken down", id: "the-four-components" },
      { type: "h3", text: "S — Situation: set the scene in one line" },
      {
        type: "p",
        text: "The Situation describes the business or technical context, not your job role. One sentence is enough. Skip backstory that does not directly inform the decision you made.",
      },
      {
        type: "quote",
        text: "Q4 dashboard load times had degraded from 1.2s to 4.8s after the analytics migration, and three enterprise accounts had cited it in renewal conversations.",
        cite: "Senior Engineer STAR example",
      },
      { type: "h3", text: "T — Task: name the goal you owned" },
      {
        type: "p",
        text: "Be explicit about what you were responsible for. \"I was on the team that...\" is not a task — that is a project description. Use \"I was asked to,\" \"I committed to,\" or \"I took ownership of.\"",
      },
      { type: "h3", text: "A — Action: the verbs and decisions, in your voice" },
      {
        type: "p",
        text: "This is where most self-appraisals collapse into a list of activities. Resist the urge to recap your sprint board. Pick two or three decisions you made that a peer could not or did not make, and describe them in active voice.",
      },
      { type: "h3", text: "R — Result: the number, plus the second-order effect" },
      {
        type: "p",
        text: "A result without a number is an opinion. After the number, add one line of second-order impact — what changed downstream because of your result. This is the line that gets quoted in calibration.",
      },
      { type: "h2", text: "A full STAR response, annotated", id: "full-example" },
      {
        type: "quote",
        text: "Q4 dashboard load times had degraded from 1.2s to 4.8s after the analytics migration, and three enterprise accounts had cited it in renewal conversations [S]. I was asked to lead the recovery work and own the new performance budget [T]. I profiled the query path, identified an unindexed join in the metrics rollup, and partnered with the data team to add a covering index plus a Redis-backed read path for the hottest 12 queries [A]. P75 load time dropped from 4.8s to 1.5s within two weeks, all three at-risk renewals closed on time, and the Redis pattern has since been adopted by two other product surfaces [R].",
        cite: "Senior Software Engineer STAR example",
      },
      { type: "h2", text: "Five common STAR mistakes that cost promotions", id: "common-mistakes" },
      {
        type: "ol",
        items: [
          "Burying the result. The Result line should arrive before the reader loses interest — first 60 words, not the last sentence of a paragraph.",
          "Claiming team outcomes as personal ones. \"We shipped X\" reads as deflection. Pick the slice that was yours.",
          "Stacking vague verbs. \"Drove,\" \"led,\" \"managed\" without a concrete decision underneath is filler.",
          "Skipping the second-order effect. A single number can look anomalous. The second-order line proves it was real.",
          "Writing in past-perfect mush (\"had been working on,\" \"would often\") instead of clean past-tense action.",
        ],
      },
      { type: "h2", text: "Mapping STAR to your company's review criteria", id: "mapping-to-okrs" },
      {
        type: "p",
        text: "Most performance frameworks score on three to five competencies — typically Execution, Collaboration, Technical Excellence, and Leadership. A complete self-appraisal pairs one or two STAR responses to each competency. If you cannot map a STAR response to a named competency, it likely belongs in a separate \"context\" section instead of the formal review.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Tip: write STAR responses weekly, not yearly",
        text:
          "The single biggest reason self-appraisals are weak is recency bias — you remember the last six weeks and forget the rest of the year. A five-minute weekly log captured throughout the year produces dramatically better STAR responses at review time, because you still remember the numbers.",
      },
      { type: "h2", text: "How Impactly AI turns weekly logs into STAR responses", id: "how-impactly-helps" },
      {
        type: "p",
        text: "Impactly AI is built for exactly this workflow. You log five minutes per week — what shipped, what was hard, what you learned. At review time, the appraisal engine groups your entries by competency, drafts STAR-formatted responses against your company's OKRs and core values, and lets you customize the tone (assertive, collaborative, or leadership-focused). Everything stays in your private workspace, encrypted, with no LLM training on your data.",
      },
      {
        type: "cta",
        text: "Try the appraisal generator on a free account — no credit card, Google or GitHub login.",
        href: "https://app.impactlyai.com/login",
        label: "Generate My First STAR Appraisal",
      },
      { type: "h2", text: "FAQs about the STAR method", id: "faqs" },
      { type: "h3", text: "Is STAR overkill for a junior-level review?" },
      {
        type: "p",
        text: "No. Junior-level calibration committees still need to see specificity, and STAR forces you to put numbers next to your work — which is the exact gap committees flag for engineers who are otherwise ready for promotion.",
      },
      { type: "h3", text: "What if I do not have hard numbers for an accomplishment?" },
      {
        type: "p",
        text: "Use proxy metrics: cycle time, code review turnaround, support tickets deflected, design-review approvals first-pass, customer interview count. Any countable proxy beats a verb-only Result line.",
      },
      { type: "h3", text: "Can I use STAR in mid-year check-ins, or is it only for annual reviews?" },
      {
        type: "p",
        text: "STAR is appropriate any time the audience is making a calibration or promotion decision. For weekly 1:1s, simpler bullet-point logs are usually faster — and those bullets become the raw material for the STAR responses you write at review time.",
      },
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getAllPostSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}
