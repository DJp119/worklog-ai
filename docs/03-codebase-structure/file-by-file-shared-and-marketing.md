# File-by-File Explanation: Shared, Marketing, SQL, Scripts & Root Files

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Shared Type Contract Package (`shared/`)

| File (LOC) | Purpose | Critical Finding |
|---|---|---|
| `shared/package.json` (15) | Workspace manifest (`"main": "./index.ts"`, `"types": "./index.ts"`). | Points runtime/bundler entry directly at `shared/index.ts`. |
| `shared/tsconfig.json` (21) | RootDir `./src`, outDir `./dist`, `strict: true`. | **Type-split root cause:** `shared/tsconfig.json` compiles `shared/src/index.ts` instead of `shared/index.ts`! |
| `shared/index.ts` (604) | Primary TS interface catalog (**75 exported symbols**) imported by `import ... from 'shared'` (`client/vite.config.ts` & `package.json`). | Contains `GenerateAppraisalResponse`, `ReminderLog`, `ApiError`, `AIArticle`, `AIImpactCard`, `BookmarkRequest`, `Bookmark`, plus `preferred_language` / `'gitlab'` fields not in `src/index.ts`. |
| `shared/src/index.ts` (550) | Secondary type file (**69 exported symbols**) matched by `tsconfig` `"paths": { "shared/*": ["../shared/*"] }`. | Contains `JoinWaitlistRequest`, `firstName`/`onboardingCompleted` fields (`UserProfile`/`UpdateProfileRequest`) absent from root `shared/index.ts`. |
| `shared/index.js`, `shared/index.d.ts`, `*.map` | Pre-compiled CommonJS/declaration outputs emitted beside `shared/index.ts`. | Can become stale if `shared/index.ts` is edited without re-emitting. |

---

## 2. Marketing Site (`worklog-marketing/` — Next.js 16 App Router)

Standalone brochure/SEO web application deployed independently to `https://impactlyai.com` (excluded from root npm workspaces).

| File (LOC) | Role |
|---|---|
| `worklog-marketing/package.json` (31) | Declares Next.js `16.2.6`, React `19.2.4`, `lucide-react`, `@vercel/analytics`, Tailwind v4, TypeScript v5. |
| `worklog-marketing/next.config.ts` (6), `vercel.json` (5), `postcss.config.mjs` (8), `eslint.config.mjs` (19), `tsconfig.json` (35) | Standard Next.js 16 + Tailwind CSS 4 + ESLint config (`@/*` → `./src/*`). |
| `worklog-marketing/src/app/layout.tsx` (123) | Root `<html lang="en">` layout loading Google Font `Plus_Jakarta_Sans`, preconnecting `app.impactlyai.com`, Google AdSense script (`ca-pub-7620811634558573`), GA4 (`G-HW2VQ27KDY`), Vercel Analytics. |
| `worklog-marketing/src/app/globals.css` (175) | Tailwind v4 theme variables & animations matching SPA aesthetic (`#0a0a0f`, `.glass`, `.glow-primary`, `.card-hover`). |
| `worklog-marketing/src/app/page.tsx` (464) | Marketing homepage embedding JSON-LD schemas (`SoftwareApplication`, `Organization`, `WebSite`), `PainGrid`, `PlaygroundWidget`, bento feature grid, `FaqAccordion`, CTAs linking to `https://app.impactlyai.com/login`. |
| `worklog-marketing/src/app/blog/page.tsx` (160) & `blog/[slug]/page.tsx` (285) | Static blog index & SSG article renderer with structured data (`Blog`, `BlogPosting`, `BreadcrumbList`) reading `BLOG_POSTS`. |
| `worklog-marketing/src/app/templates/self-appraisal/page.tsx` (201) & `[role]/page.tsx` (556) | Programmatic SEO pages for 8 roles (`software-engineer`, `product-manager`, `marketing-manager`, `ui-designer`, `qa-lead`, `data-analyst`, `engineering-manager`, `devops-engineer`) + dynamic fallback template + embedded `PlaygroundWidget`. |
| `worklog-marketing/src/app/privacy/page.tsx` (147) & `terms/page.tsx` (141) | Legal pages tailored to marketing domain (`impactlyai.com`) including AdSense cookie disclosures. |
| `worklog-marketing/src/app/robots.ts` (29) & `sitemap.ts` (64) | Dynamic `robots.txt` (explicitly allows AI crawlers like `GPTBot`, `ClaudeBot`, `PerplexityBot`) and sitemap covering all routes + blog posts + role templates. |
| `worklog-marketing/src/components/{FaqAccordion,PainGrid,PlaygroundWidget}.tsx` | Client components (`"use client"`); `PlaygroundWidget.tsx:102` calls `NEXT_PUBLIC_API_URL || "https://worklog-ai-7qh6.onrender.com"` at `/api/appraisal/playground-generate` with static fallback. |
| `worklog-marketing/src/content/blogPosts.ts` (156) | Currently contains 1 long-form guide (`star-method-performance-review`) and lookup helpers. |
| `worklog-marketing/public/*` | Static `manifest.json`, `llms.txt`, favicons, OG image (`og-default.png`), starter Next SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). |

---

## 3. SQL Schemas & Migrations (15 Files, ~3,372 LOC)

| File (LOC) | Purpose |
|---|---|
| `supabase-schema.sql` (542) | Original Supabase Auth base schema + appended custom-auth, AI Pulse, chat, feedback, marketing, translation tables (18 `CREATE TABLE` statements). |
| `supabase-schema-custom-auth.sql` (206) | Custom JWT/bcrypt auth schema removing `auth.users` FK (`users`, `email_verifications`, `refresh_tokens`, `password_resets`, `waitlist`, core tables). |
| `supabase-migration-ai-pulse.sql` (267) | Standalone schema & permissive read policies for `ai_articles`, `ai_impact_cards`, `user_bookmarks`. |
| `supabase-schema-ai-pulse-seed.sql` (207) | SQL `INSERT` seeds for 5 initial AI Pulse articles and 5 impact cards. |
| `migrations/001_monthly_summaries_and_chat.sql` (61) | Creates `monthly_summaries`, `chat_sessions`, `chat_messages` + `auth.uid()` RLS policies. |
| `migrations/002_add_reminder_columns_to_users.sql` (14) | Adds `reminder_day`, `reminder_time`, `reminder_enabled`, `reminder_last_sent_at`, `logging_cadence` on `users`. |
| `migrations/003_make_log_fields_optional.sql` (6) | Drops `NOT NULL` on `challenges`, `learnings`, `goals_next_week` in `work_log_entries`. |
| `migrations/add_feedback_table.sql` (44) | Creates `feedback` table + indexes & permissive RLS. |
| `supabase-migrations/2026-06-05_i18n_support.sql` (36) | Adds `users.preferred_language` and creates `translation_cache`. |
| `supabase-migrations/2026-06-07_security_token_hashing.sql` (137) | Hardens token storage columns (`token_hash`) and token invalidation indexes. |
| `supabase-migrations/2026-06-16_teams_goals_integrations.sql` (1,375) | Massive enterprise rollout: 22 tables, enums (`org_role`, `team_role`, `goal_scope`, `goal_status`, `goal_period`, `progress_mode`, `metric_type`, `integration_provider`, etc.), 20 PL/pgSQL functions (closure triggers, cycle guards, `recompute_goal_progress`, locks), 34 triggers, 25 deny-all RLS policies. |
| `supabase-migrations/2026-06-18_followup_constraints.sql` (225) | Enforces `goal_updates` author org membership + adds `updated_at` triggers & extra constraints. |
| `supabase-migrations/2026-06-20_premium_subscriptions.sql` (180) | Adds `subscriptions`, `performance_reports`, `activity_summaries`, `integration_channel_preferences` + `provision_free_subscription()` trigger on `organizations`. |
| `supabase-migrations/cohort-tracking.sql` (130) | Adds `current_streak`, `longest_streak`, `total_logs`, cohort stats columns & `user_cohort_stats_trigger` on `work_log_entries`. |
| `supabase-migrations/push-subscriptions.sql` (13) | Adds `push_subscriptions(user_id, endpoint, p256dh, auth)` with `UNIQUE(user_id, endpoint)`. |

---

## 4. Operational Scripts (`scripts/`) & Root Files

| File (LOC) | Purpose |
|---|---|
| `scripts/backup.js` (186) | Fetches all rows (paginated 1,000/page) across 14 core tables using `SUPABASE_SERVICE_KEY` and emails raw JSON backup via Brevo (note: misses newer org/goal/integration/subscription tables; imports `zlib` without compressing). |
| `scripts/restore.js` (115) | CLI restore script reading `.json` / `.json.gz` backup files and upserting records into the 14 core tables (`--dry-run` / `--confirm` required). |
| `scripts/generate_brand_assets.py` (201) | Pillow (PIL) generator painting PNG/ICO/OG images into `client/public/` (`apple-touch-icon.png`, favicons, `og-default.png`, `mstile-150x150.png`). |
| `scripts/vercel-prepare-output.mjs` (27) | Copies Vite `client/dist` into Vercel expected output directory. |
| `package.json`, `tsconfig.json` | Root workspace orchestrator (`dev`, `build`, `lint`, `typecheck`); note unused experiment deps (`openai`, `headroom-ai`, `@anthropic-ai/claude-agent-sdk`) live here. |
| `render.yaml`, `nixpacks.toml`, `vercel.json`, `.env.production.example` | Deployment & production env templates. |
| `test-api.sh` (86) | Shell smoke script hitting `/health`, `/api/auth/signup`, `/api/auth/login`. |
| Root legacy markdown guides (`README.md`, `SETUP.md`, `DEPLOYMENT.md`, `AGENTS.md`, `CLAUDE.md`, `BACKEND_MIGRATION.md`, `DOCUMENTATION.md`, `POSTHOG_SETUP.md`, `QUICK_FIX_CHAT_AUTH.md`, `SETUP-ENVIRONMENT.md`, `TESTING_CHECKLIST.md`, `DEPLOYMENT_ENV_CHECKLIST.md`) | Historical project guides containing mixed current & superseded claims (for example Supabase Auth magic links, Resend, Railway). |

---

## Related Documents

- [Directory Map](./directory-map.md)
- [Database Schema](../07-database/schema.md)
- [Environment Variables](../10-environment-and-deployment/environment-variables.md)

## Verification Notes

- Verified all file names, line counts, and exported type symbols against filesystem & AST output (`files.json`, `types.json`, `sql.json`).