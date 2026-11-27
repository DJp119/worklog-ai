# File-by-File Explanation: Server (`server/`)

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Configuration & Root Helper Scripts (`server/`)

| File (LOC) | Purpose |
|---|---|
| `server/package.json` (46) | Defines backend dependencies (`express`, `jsonwebtoken`, `bcrypt`, `@mistralai/mistralai`, `@supabase/supabase-js`, `node-cron`, `pino`, `web-push`, `zod`, `rss-parser`, `dayjs`, `posthog-node`, `express-rate-limit`, `shared`, unused `@anthropic-ai/sdk` & `@types/nodemailer`) and scripts (`dev`, `build`, `start`, `typecheck`, `lint`, `test`). |
| `server/tsconfig.json` (29) | `NodeNext` module target `ES2022`, **`strict: false`**, outputs `./dist`, excludes `__tests__` from compilation. |
| `server/vitest.config.ts` (9) | Enables Vitest on `src/__tests__/**/*.test.ts`. |
| `server/eslint.config.js` (37) | ESLint 9 config for `src/**/*.ts`; uses `@typescript-eslint/parser` with `no-unused-vars` enabled. |
| `server/.env.example` (60) | Template documenting Supabase, JWT, Brevo, Mistral, CORS, encryption, integration OAuth/webhook, Push, and Scheduler env vars. |
| `server/Procfile` (2) | `web: node dist/index.js` (Render/Railway process declaration). |
| `server/posthog-setup-report.md` | Historical setup note generated during PostHog integration. |
| `server/test-db.js` (33) | One-off connectivity smoke script querying `users` count (`server/src/lib/database.ts`). |
| `server/fix_conflicts.cjs` (21) | Utility script used previously to strip git conflict markers from `integrations.ts`. |
| `server/src/index.ts` (373) | Express server entry point: CORS, raw webhook body capture, rate limiting, `requestIdMiddleware`, Pino/PostHog logging, 21 routers, `/health`, error handler, orphan lock cleanup, 11 cron jobs, graceful shutdown. |
| `server/src/i18n/errors.ts` (161) | 28 keyed server error messages (`SERVER_ERRORS`), `interpolate()`, runtime language resolution via `Accept-Language`, and dynamic Google Translate caching (`translateOne`). |

---

## 2. Middleware (`server/src/middleware/`)

| File (LOC) | Purpose | Key Exports |
|---|---|---|
| `auth.ts` (260) | Enforces 32+ char `JWT_SECRET`, creates/rotates hashed refresh tokens, verifies access JWTs, populates `req.userId`/`req.user`/MDC + **service-role** `req.supabase`. | `generateAccessToken`, `generateRefreshToken`, `createRefreshToken`, `revokeRefreshToken`, `validateRefreshToken`, `verifyToken`, `requireAuth`, `optionalAuth`, `hashToken` |
| `requestId.ts` (28) | Validates `X-Request-Id` header against `/^[A-Za-z0-9_-]{8,64}$/` (or generates UUID) and wraps downstream calls inside `AsyncLocalStorage` MDC. | `requestIdMiddleware` |
| `tierGate.ts` (85) | Gates endpoints by org plan (`pro` / `enterprise`) or feature flag (`goals` / `integrations` / `aiReports`), trusting only `req.params.orgId`. | `requireTier`, `requireFeature` |

---

## 3. Domain Services (`server/src/services/`)

| File (LOC) | Purpose | Key Exports |
|---|---|---|
| `authz.ts` (285) | Numeric role rank checks for orgs (`member=1..owner=3`) and teams (`member=1..owner=4`), closure-inherited team roles, `canEditGoal`, `requireOrgRole`, `requireTeamRole`. | `orgRoleAtLeast`, `teamRoleAtLeast`, `getUserOrgRole`, `getEffectiveTeamRole`, `getViewableUserIds`, `canManageTeamConfig`, `canManageTeamGoals`, `canViewUser`, `canEditGoal`, `requireOrgRole`, `requireTeamRole` |
| `teamService.ts` (217) | CRUD for organizations, departments, nested teams (`moveTeam`, `deleteTeam`), team memberships, and fallback `rebuildClosure()` loop. | `createOrg`, `listMyOrgs`, `getOrgMembers`, `createDepartment`, `createTeam`, `moveTeam`, `deleteTeam`, `addMember`, `updateMemberRole`, `removeMember`, `rebuildClosure` |
| `goalService.ts` (511) | Goal/OKR CRUD, key results, assignees, check-ins (triggers DB progress rollup), parent hierarchy + cycle prevention, Jira/GitHub URL & ticket key parser + linker. | `createGoal`, `updateGoal`, `deleteGoal`, `getGoalWithDetails`, `listVisibleGoals`, `addKeyResult`, `updateKeyResult`, `addGoalAssignee`, `removeGoalAssignee`, `createGoalUpdate`, `setParent`, `parseLinkUrl`, `addLink`, `removeLink`, `listLinks` |
| `subscriptionService.ts` (150) | Resolves org tier (60s in-memory cache), checks feature flags & member limits, fetches personal integration sync filters & team Slack channels. | `clearTierCache`, `getOrgTier`, `isFeatureEnabled`, `checkMemberLimit`, `getUserSyncFilters`, `getTeamSlackChannels` |
| `activityAggregationService.ts` (173) | Aggregates GitHub PRs/issues, Jira tickets, Slack messages (`log_source_references`), and manual `work_log_entries` across a user/date range. | `aggregateUserActivity` |
| `reportGenerationService.ts` (301) | Compiles enterprise AI performance reviews (org/team/individual scope) combining work activity + goal progress via Mistral (`mistral-large-latest`) and stores in `performance_reports`. | `generatePerformanceReport` |

---

## 4. Infrastructure & Provider Libraries (`server/src/lib/`)

| File (LOC) | Purpose |
|---|---|
| `database.ts` (48) | Primary Supabase client singleton (uses service key, falls back to anon key if unset) + `isDatabaseConfigured`. |
| `supabase.ts` (62) | Secondary legacy Supabase singleton + `isSupabaseConfigured`, `canRunReminderJobs`, `getSupabaseClient()`. |
| `logger.ts` (76) | Structured SLF4J-style Pino logger with automatic `{}` placeholder interpolation and `[req=...\|user=...]` MDC prefixing. |
| `mdc.ts` (19) | Node `AsyncLocalStorage<LogContext>` carrying per-request `requestId` and `userId`. |
| `posthog.ts` (93) | Server-side `posthog-node` telemetry (`captureEvent`, `identifyUser`, `captureException`, `shutdownPostHog`). |
| `auth-utils.ts` (61) | `bcrypt` hashing/comparison (10 rounds), hex random token generation, email & 8-char password strength validation. |
| `crypto.ts` (153) | Multi-key AES-256-GCM encryption/decryption (`INTEGRATION_ENCRYPTION_KEYS`) + signed 10m JWT OAuth `state` builder/verifier (`makeOAuthState`, `verifyOAuthState`). |
| `webhookSecurity.ts` (160) | GitHub (`X-Hub-Signature-256` HMAC), Slack (`v0` HMAC + 5m timestamp check), Jira (SHA-256 token equality — see findings), plus `integration_events` ledger helpers. |
| `mistral.ts` (20) | Exports configured `Mistral` SDK instance (`MISTRAL_API_KEY`). |
| `openRouter.ts` (61) | HTTP wrapper around OpenRouter chat completions (`google/gemma-2-9b-it:free` default for playground). |
| `aiSummaryService.ts` (92) | Uses `mistral-small-latest` to generate 3-sentence AI Pulse article summaries (`generateArticleSummary`, `batchSummarizeArticles`). |
| `summaryService.ts` (132) | Generates/caches/invalidates monthly work-log summaries in `monthly_summaries` using Mistral. |
| `chatService.ts` (99) | Loads monthly summaries across a range, stitches context, injects system prompt + user language instruction, and enforces 10-message sliding window. |
| `userLanguage.ts` (54) | Resolves user preferred language from DB/`Accept-Language` and generates prompt-level non-English output instruction. |
| `newsService.ts` (59) | RSS parser (`rss-parser`) fetching configured AI news feeds (`fetchRSSFeed`, `generateSlug`). |
| `email.ts` (339) | Brevo HTTP API transactional sender supporting HTML verification, password reset, and weekly reminder emails translated via Google Translate (`tx`). |
| `webPush.ts` (79) | `web-push` VAPID wrapper sending browser push alerts (`sendPushToUser`) and pruning expired `404`/`410` subscriptions. |
| `githubAdapter.ts` (151) | Authenticated GitHub REST client (`user_integrations` PAT/OAuth or `githubApp` JWT installation token) with issue/PR/search helpers. |
| `githubApp.ts` (128) | Manages GitHub App installation linking (`resolveInstallationOrg`, `matchOrgByLogin`, `storeInstallation`, `uninstallApp`). |
| `jiraAdapter.ts` (368) | Atlassian OAuth 2.0 3LO token refresh with DB lock (`withRefreshLock`), `JiraHttpError`, site discovery, JQL search, issue fetch. |
| `slackAdapter.ts` (112) | Slack Web API client (`chat.postMessage`, `conversations.open`, `users.lookupByEmail`, `sendEphemeral`). |
| `slackNotifier.ts` (450) | Builds Slack Block Kit cards for goal assignment, progress updates, weekly digests, slash command responses, and manager check-in alerts. |
| `slackOAuth.ts` (25) | Resolves Slack bot token across OAuth v2 response shapes (`getSlackBotToken`). |

---

## 5. HTTP Route Modules (`server/src/routes/` — 21 Modules, 112 Handlers)

- **Core User & Auth:** `auth.ts` (679L, 9 handlers), `users.ts` (367L, 4 handlers), `entries.ts` (258L, 5 handlers), `appraisal.ts` (359L, 4 handlers), `summaries.ts` (74L, 2 handlers), `chat.ts` (302L, 5 handlers), `feedback.ts` (101L, 2 handlers).
- **Teams, Goals & Subscriptions:** `organizations.ts` (154L, 7 handlers), `teams.ts` (198L, 6 handlers), `goals.ts` (378L, 12 handlers), `subscriptions.ts` (42L, 1 handler), `reports.ts` (102L, 3 handlers).
- **Integrations & Webhooks:** `integrations.ts` (1,032L, 23 handlers), `channelPreferences.ts` (148L, 5 handlers), `webhooks/github.ts` (161L, 1 handler), `webhooks/jira.ts` (127L, 1 handler), `webhooks/slack.ts` (320L, 1 HTTP receiver dispatching slash commands `/worklog`, `/goals`, `/log`).
- **Platform, Content & Growth:** `aiPulse.ts` (545L, 13 handlers), `translate.ts` (352L, 2 handlers), `waitlist.ts` (58L, 1 handler), `push.ts` (86L, 3 handlers).

---

## 6. Background Jobs & Tests (`server/src/jobs/`, `server/src/__tests__/`)

- **Core Jobs (8):** `reminderJob.ts` (164L), `monthlySummaryJob.ts` (94L), `newsCollectionJob.ts` (146L), `weeklyDigestJob.ts` (184L), `weeklySyncJob.ts` (561L), `goalRollupJob.ts` (427L), `goalDigestJob.ts` (204L), `pruneJob.ts` (68L).
- **Gated Marketing Loops (3, active only when `MARKETING_LOOPS_ENABLED === 'true'`):** `marketing/activationLoop.ts` (157L), `marketing/dormancyWatch.ts` (178L), `marketing/weeklyReview.ts` (161L).
- **Unit Test Suites (6 files, 147 tests total):** `audit-fixes.test.ts` (65 tests — static source checks for security fixes), `authz.test.ts` (47 tests — role rank & `canEditGoal`), `channelPreferences.test.ts` (6 tests), `goalService.test.ts` (7 tests — URL parsing & cycle checks), `slackOAuth.test.ts` (3 tests), `webhookSecurity.test.ts` (19 tests — HMAC & AES-GCM crypto).

---

## Related Documents

- [Backend Architecture](../02-architecture/backend-architecture.md)
- [API Reference Overview](../06-api-reference/api-overview.md)
- [Backend Function Reference](../04-function-documentation/function-index.md)

## Verification Notes

- Verified every file path and LOC under `server/` using AST scan (`files.json`, `functions.json`, `routes.json`).