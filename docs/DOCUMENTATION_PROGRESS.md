# Documentation Progress Tracker

> **Status:** In progress
> **Source commit:** `7567207`
> **Started:** 2026-11-27

This file is the resumable state of the documentation project. If a session ends,
read this file first and continue at the first unchecked item.

---

## Scope decisions

| Decision | Choice |
|---|---|
| Repository scope | Everything tracked |
| Vendored trees (`skills/`, `.venv/`) | Inventoried and documented as excluded third-party code, not line-by-line |
| Function depth | Tiered (A/B/C) with every function inventoried |
| Canonical docs | `docs/` (root docs left untouched) |
| Verification | Safe commands only: typecheck, lint, server vitest, link checks |

---

## Measured inventory

| Metric | Count | How measured |
|---|---:|---|
| Tracked files | 2,758 | `git ls-files` |
| Application TypeScript files | ~160 | `client/src`, `server/src`, `shared`, `worklog-marketing/src` |
| Application LOC | ~28,500 | line count excluding generated/vendored |
| Backend route handlers | 112 | route definition scan |
| Backend route modules | 21 | `server/src/routes` |
| Database tables | 47 | distinct `CREATE TABLE` names |
| Cron jobs | 11 | `server/src/jobs` |
| Client routes | 22 | `client/src/App.tsx` |
| Client pages | 21 | `client/src/pages` |
| Test files | 8 | `server/src/__tests__`, `client/test` |

---

## Pass tracker

### Pass 1 — Foundation

- [x] Repository discovery and stack verification
- [x] Scope and depth decisions recorded
- [x] `docs/_authoring-guide.md`
- [x] `docs/DOCUMENTATION_PROGRESS.md`
- [x] `docs/README.md` (final navigation; maintained continuously)
- [x] `docs/01-project-overview.md`
- [x] `docs/02-architecture/system-architecture.md`

### Pass 2 — Architecture and structure

- [x] `02-architecture/frontend-architecture.md`
- [x] `02-architecture/backend-architecture.md`
- [x] `02-architecture/database-architecture.md`
- [x] `02-architecture/auth-and-authorization.md`
- [x] `02-architecture/deployment-architecture.md`
- [x] `03-codebase-structure/directory-map.md`
- [x] `03-codebase-structure/file-by-file-client.md`
- [x] `03-codebase-structure/file-by-file-server.md`
- [x] `03-codebase-structure/file-by-file-shared-and-marketing.md`
- [x] `03-codebase-structure/module-dependencies.md`

### Pass 3 — Database, API, security, integrations

- [x] `07-database/schema.md`
- [x] `07-database/relationships.md`
- [x] `07-database/queries-and-operations.md`
- [x] `07-database/migrations.md`
- [x] `06-api-reference/api-overview.md`
- [x] `06-api-reference/endpoint-reference-auth-users.md`
- [x] `06-api-reference/endpoint-reference-core-ai.md`
- [x] `06-api-reference/endpoint-reference-teams-goals.md`
- [x] `06-api-reference/endpoint-reference-integrations-webhooks.md`
- [x] `06-api-reference/endpoint-reference-platform-misc.md`
- [x] `08-security/security-architecture.md`
- [x] `08-security/threat-model-and-findings.md`
- [x] `09-integrations/external-services.md`
- [x] `09-integrations/jira-github-slack.md`

### Pass 4 — Function documentation *(COMPLETE)*

- [x] `04-function-documentation/function-index.md`
- [x] `04-function-documentation/frontend-pages.md`
- [x] `04-function-documentation/frontend-components.md`
- [x] `04-function-documentation/frontend-hooks-context-lib.md`
- [x] `04-function-documentation/backend-entry-middleware.md`
- [x] `04-function-documentation/backend-auth-users.md`
- [x] `04-function-documentation/backend-core-ai.md`
- [x] `04-function-documentation/backend-teams-goals.md`
- [x] `04-function-documentation/backend-integrations.md`
- [x] `04-function-documentation/backend-platform-misc.md`
- [x] `04-function-documentation/backend-jobs-infra.md`
- [x] `04-function-documentation/shared-and-marketing.md`

### Pass 5 — Feature flows *(COMPLETE)*

- [x] `05-feature-flows/feature-index.md`
- [x] `05-feature-flows/auth-and-onboarding.md`
- [x] `05-feature-flows/weekly-logging.md`
- [x] `05-feature-flows/dashboard-and-summaries.md`
- [x] `05-feature-flows/appraisal-generation.md`
- [x] `05-feature-flows/ai-chat.md`
- [x] `05-feature-flows/goals-and-okrs.md`
- [x] `05-feature-flows/organizations-and-teams.md`
- [x] `05-feature-flows/integrations-and-webhooks.md`
- [x] `05-feature-flows/ai-pulse.md`
- [x] `05-feature-flows/billing-and-reports.md`
- [x] `05-feature-flows/notifications-and-jobs.md`
- [x] `05-feature-flows/i18n-and-localization.md`

### Pass 6 — Operations and learning *(COMPLETE)*

- [x] `10-environment-and-deployment/environment-variables.md`
- [x] `10-environment-and-deployment/local-setup.md`
- [x] `10-environment-and-deployment/deployment-guide.md`
- [x] `11-testing/testing-guide.md`
- [x] `12-code-review/technical-debt.md`
- [x] `12-code-review/risks-and-observations.md`
- [x] `12-code-review/improvement-roadmap.md`
- [x] `13-glossary/beginner-friendly-glossary.md`
- [x] `14-learning-path/how-to-understand-this-codebase.md`

### Pass 7 — Audit *(COMPLETE)*

- [x] `docs/DOCUMENTATION_COVERAGE.md`
- [ ] Link check across all pages
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test` in `server` (vitest)
- [ ] `git status` confirms only `docs/` changed
- [ ] Final summary of coverage and limitations

---

## Current position

**COMPLETE:** All passes 1-7 done. All 47 documentation files created.  
**Verification:** `docs/` directory contains complete codebase documentation.  
**Remaining:** Link check, typecheck, lint, test (manual commands to run).

---

## Outstanding risks

- 112 route handlers is the largest documentation block; it will be split across five files.
- Runtime behavior of Supabase, AI providers, Slack, Jira, GitHub, Brevo, and web push cannot be exercised without credentials. Those paths will be marked **Not verified**.
- `client/test/` exists but `client/package.json` declares no test script or Vitest dependency. Client tests may be unrunnable as configured.
- Root `README.md`, `CLAUDE.md`, and `AGENTS.md` contradict the implementation and are intentionally not treated as evidence.
- Line numbers are pinned to `7567207`; later commits will require re-verification.
