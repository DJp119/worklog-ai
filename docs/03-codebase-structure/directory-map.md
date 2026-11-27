# Directory Map

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Beginner, Junior, Senior

---

## 1. Plain-Language Overview (Explain Like I Am Five)

Think of this repository folder like a big school binder with labeled dividers:

- **`client/`**: Everything you *see and click* in your browser (screens, buttons, colors, translations).
- **`server/`**: The invisible kitchen running on another computer that checks passwords, talks to AI, sends emails, and saves data.
- **`shared/`**: A shared rulebook of shapes (like what a "Goal" or "WorkLogEntry" looks like) so both `client/` and `server/` speak the exact same language.
- **`worklog-marketing/`**: A separate public brochure website (blog + role templates) designed for Google searchers.
- **`migrations/` & `supabase-migrations/` & `*.sql`**: Blueprint recipes that tell the database how to build all 47 filing-cabinet tables.
- **`scripts/`**: Helper tools for backing up the database, restoring backups, and painting brand icons.
- **Excluded / Tooling folders (`skills/`, `.venv/`, `.agent/`, `node_modules/`):** Extra third-party toolkits, Python helpers, or downloaded libraries that are **not** your running Worklog AI app code.

---

## 2. Annotated Workspace Tree

```text
worklog-ai/
├── .github/workflows/          # GitHub Actions CI & automation
│   ├── codeql.yml              # Weekly/PR JavaScript-TypeScript CodeQL static security scan
│   └── db-backup.yml           # Daily 00:00 UTC backup runner invoking scripts/backup.js
├── client/                     # React 19 + Vite SPA (deployed to Vercel)
│   ├── public/                 # Static assets (icons, OG image, manifest, robots.txt, sitemap.xml, llms.txt, sw.js)
│   │   ├── locales/en/         # Duplicate static copy of English base translations
│   │   └── scripts/            # vercel-prepare-output.mjs re-export wrapper
│   ├── src/
│   │   ├── components/         # Reusable UI grouped by domain: ai-pulse/, Chat/, goals/, integrations/, landing/, premium/, teams/
│   │   ├── context/            # AuthContext (JWT + 14m timer), SubscriptionContext (incomplete — unauthenticated fetch)
│   │   ├── hooks/              # useHasOrg, useIsLoggedIn, usePageMeta, useTeamRole
│   │   ├── i18n/               # i18next config + useAutoLocale (20 languages, RTL support)
│   │   ├── lib/                # HTTP clients (api.ts, chatApi, goalsApi, teamsApi, integrationsApi, useSSE, push, formatters)
│   │   ├── locales/en/         # Primary bundled English dictionary (base.json, 742 lines)
│   │   ├── pages/              # 21 lazy-loaded route pages (+ ai-pulse/Hub.tsx)
│   │   └── types/              # Lucide icon declaration shim
│   └── test/                   # 2 client test files (authStorage.test.ts, useHasOrg.test.js; no runner configured)
├── server/                     # Express 4 + TypeScript API & cron runner (deployed to Render)
│   ├── src/
│   │   ├── __tests__/          # 6 Vitest suites (147 tests passing)
│   │   ├── i18n/               # Backend localized error catalog (SERVER_ERRORS) + runtime translation
│   │   ├── jobs/               # 8 core node-cron jobs + 3 gated marketing loops (jobs/marketing/)
│   │   ├── lib/                # DB singletons, email (Brevo), AI (Mistral/OpenRouter), crypto, logger, adapters (GitHub/Jira/Slack), webPush
│   │   ├── middleware/         # auth (requireAuth/optionalAuth), requestId (MDC), tierGate
│   │   ├── routes/             # 21 Express routers + 3 webhooks (routes/webhooks/{github,jira,slack}.ts)
│   │   └── services/           # Business domain services (authz, goalService, teamService, subscriptionService, activityAggregation, reportGeneration)
│   ├── Procfile                # Legacy Heroku/Railway start declaration
│   ├── test-db.js              # Standalone Postgres connectivity sanity script
│   └── fix_conflicts.cjs       # One-off git merge-conflict strip utility
├── shared/                     # Shared TypeScript interfaces/types (`shared/index.ts` & `shared/src/index.ts`)
├── worklog-marketing/          # Standalone Next.js 16 SSR/SSG marketing website (impactlyai.com)
│   ├── public/                 # Favicons, OG image, manifest, llms.txt, stock SVGs
│   └── src/
│       ├── app/                # Home, /blog, /blog/[slug], /privacy, /terms, /templates/self-appraisal/[role], robots.ts, sitemap.ts
│       ├── components/         # FaqAccordion, PainGrid, PlaygroundWidget (calls live API `/api/appraisal/playground-generate`)
│       └── content/            # Static blog post catalog (blogPosts.ts)
├── migrations/                 # 4 early incremental Postgres SQL migrations
├── supabase-migrations/        # 7 timestamped/named production SQL migrations (enterprise, security, i18n, cohorts, push)
├── scripts/                    # backup.js, restore.js, generate_brand_assets.py, vercel-prepare-output.mjs
├── docs/                       # Reverse-engineered documentation (01–14, _authoring-guide.md) + historical planning docs
├── *.sql                       # 4 root SQL files (supabase-schema.sql, supabase-schema-custom-auth.sql, supabase-migration-ai-pulse.sql, seed)
├── render.yaml / nixpacks.toml # Deployment specs (Render active; Railway nixpacks legacy)
└── package.json / tsconfig.json# Root npm workspace definition (`client`, `server`, `shared`)
```

---

## 3. Measured Codebase Inventory

| Area | Source Files Audited | Code Lines (LOC) | Notes |
|---|---|---|---|
| `client/` (`src/` + `test/` + scripts/sw) | 74 files | 11,689 LOC | Includes 21 pages, 27 components, 12 lib modules, 4 hooks, 2 contexts, 2 i18n modules, 2 tests |
| `server/` (`src/` + `test-db.js` + `fix_conflicts.cjs`) | 74 files | 15,215 LOC | Includes 21 routers (112 handlers), 11 jobs, 6 services, 23 lib modules, 3 middleware, 6 test suites |
| `shared/` (`index.ts`, `src/index.ts`) | 2 TS sources | 1,154 LOC | Plus generated `.js` / `.d.ts` build outputs in `shared/` |
| `worklog-marketing/` (`src/`) | 14 files | 2,958 LOC | Next.js App Router marketing site (excluded from root workspaces) |
| `scripts/` | 4 files | 529 LOC | Node backup/restore/Vercel scripts + Python brand asset generator |
| **SQL files** (root + `migrations/` + `supabase-migrations/`) | 15 SQL files | ~3,372 LOC | Define **47 distinct tables** |

### Excluded Third-Party / Generated / Local-Only Directories & Files

- **Dependencies & Build Outputs:** `node_modules/`, `client/dist/`, `server/dist/`, `shared/index.js`, `shared/index.d.ts`, `client/vite.config.js`, `client/vite.config.d.ts`, `*.tsbuildinfo`, `package-lock.json`.
- **Vendored Agent Toolkits & Environments:** `.venv/`, `skills/`, `.agent/`, `.agents/`, `.claude/`, `.codex/`, `.kilo/`, `.opencode/`, `.qwen/`, `.remember/`, `.bug-hunter/`, `.code-review-graph/`, `.ecc-design/`, `graphify-out/`, `headroom_memory.db`.
- **Secrets (never read or documented by value):** `.env`, `client/.env`, `server/.env`, `server/server/.env`.
- **Capture Artifacts:** `desktop_pagespeed.json`, `impactly_home.html`.

---

## Related Documents

- [File-by-File: Client](./file-by-file-client.md)
- [File-by-File: Server](./file-by-file-server.md)
- [File-by-File: Shared, Marketing, SQL & Scripts](./file-by-file-shared-and-marketing.md)
- [Module Dependencies](./module-dependencies.md)

## Verification Notes

- Verified via file-system enumeration and TypeScript AST scan across all non-excluded workspace paths (`files.json`).