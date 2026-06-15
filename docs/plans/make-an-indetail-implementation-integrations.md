# Implementation Plan — Corporate Teams: Manager Goals + JIRA / Slack / GitHub Integrations

## Context

`impactly-thoughts-1106.md` defines a paid **"Corporate Teams"** tier whose headline features are *"company goals, trickle-down OKRs, manager goal-setting, JIRA, Slack, more coming."* So far only the groundwork shipped: an `org_goals_alignment` boolean on `users` + a waitlist. This plan builds the actual tier:

1. **Managers set goals** for their org, departments, teams, and individual members (OKR-style, cascading).
2. **JIRA, Slack, GitHub integrations** — link goals to work items, auto-populate weekly worklogs, Slack notifications, and Slack slash commands.

It must extend (not duplicate) the already-written `docs/integrations/slack-git-auto-integration-plan.md`, which defined `user_integrations`, `log_source_references`, `integration_sync_logs`, `integration_preferences`, and the `work_log_entries.status`/`pending_review` columns, but explicitly deferred JIRA, the manager/team model, Slack notifications, and slash commands — exactly this scope.

### Two hard architectural realities (verified in code, not from CLAUDE.md)

- **Custom auth, not Supabase Auth.** There is a `public.users` table (`server/src/middleware/auth.ts`, `supabase-schema.sql:206`). All new FKs reference **`users(id)`**, never `auth.users`.
- **The server uses a single SERVICE-ROLE Supabase client that bypasses RLS** (`server/src/lib/database.ts`, `req.supabase` in `auth.ts:190`). Existing RLS policies using `auth.uid()` enforce **nothing**. Therefore **all authorization is enforced in a Node service layer keyed on `req.userId`**. We still ship RLS as inert defense-in-depth (in case a per-user anon client is ever introduced), but it is not the control.

Everything below conforms to existing conventions: `ApiResponse<T> = { success, data?, error? }`; routers `export const xRoutes = Router()` + `requireAuth` + `req.userId!`/`req.supabase!`; jobs as class singletons using `node-cron` + `mdc.run`; Mistral via `mistral.chat.complete`; email via Brevo `sendEmail`; client `apiRequest<T>` + feature API modules (`chatApi.ts` style); React Router v7 lazy pages under `ProtectedRoute`; `useAuth()`, `usePageMeta()`, `useTranslation()`; dark "glass" Tailwind.

---

## Architecture Decisions (reconciled with the above)

| Decision | Choice | Why |
|---|---|---|
| Org model | Full hierarchy: `organizations → org_members → departments → teams (nestable) → team_members`, plus a `team_closure` table | User-selected; closure table gives "manager sees all descendant members" in one query |
| Authz enforcement | **Node service layer** (`services/authz.ts`) keyed on `req.userId`; RLS is inert defense-in-depth | Service-role client bypasses RLS |
| Closure maintenance | **Postgres triggers** (not Node) | Service-role writes have many entry points (routes, jobs, Slack, manual SQL); only triggers hold for all writers |
| Integration auth | **Hybrid**: per-user OAuth in `user_integrations` (JIRA 3LO + GitHub identity); org-level installs in new `org_integrations` (Slack bot + GitHub App) | User-selected; correct attribution + clean org-wide webhooks |
| Token storage | AES-256-GCM via new `server/src/lib/crypto.ts`; ciphertext in token columns | No AES helper exists today; at-rest only is insufficient for OAuth tokens |
| Goal progress | `progress_mode` ∈ manual / key_results / linked_items; **children override mode** (parent = weighted avg of children) | OKR cascade semantics |
| Migration file | `supabase-migrations/2026-06-16_teams_goals_integrations.sql` | Matches the recent date-prefixed convention |

**Role semantics (the most error-prone point — document in code):** team **visibility** is granted at role ≥ `manager`; team **config mutation** (rename, membership, reparent) requires role ≥ `admin`. Org `owner/admin` is an escape hatch for everything in the org. Rank maps: `org {member:1,admin:2,owner:3}`, `team {member:1,manager:2,admin:3,owner:4}`. Never compare role strings lexically.

---

## Phase 0 — Database migration & shared types (foundation)

### File: `supabase-migrations/2026-06-16_teams_goals_integrations.sql`

Additive only; `users(id)` FKs; enums guarded with `DO $$ ... EXCEPTION WHEN duplicate_object`. Tables:

**Org hierarchy**
- `organizations(id, name, slug unique, owner_id→users, created_at, updated_at)`
- `org_members(id, org_id→organizations ON DELETE CASCADE, user_id→users ON DELETE CASCADE, role org_role, unique(org_id,user_id))` — `org_role` enum = `member|admin|owner`
- `departments(id, org_id→organizations ON DELETE CASCADE, name)`
- `teams(id, org_id→organizations ON DELETE CASCADE, department_id→departments ON DELETE SET NULL, parent_team_id→teams ON DELETE SET NULL, name, timestamps)`
- `team_members(id, team_id→teams ON DELETE CASCADE, user_id→users ON DELETE CASCADE, role team_role, unique(team_id,user_id))` — `team_role` enum = `member|manager|admin|owner`
- `team_closure(ancestor_id→teams ON DELETE CASCADE, descendant_id→teams ON DELETE CASCADE, depth, pk(ancestor_id,descendant_id))` + indexes on both columns

**Goals** (`goal_scope`=`organization|department|team|individual`, `goal_status`=`draft|active|at_risk|completed|cancelled`, `goal_period`=`weekly|monthly|quarterly|annual|custom`)
- `goals(id, org_id→organizations ON DELETE CASCADE, scope, team_id→teams ON DELETE SET NULL, department_id→departments ON DELETE SET NULL, parent_goal_id→goals ON DELETE SET NULL, title, description, status, period, start_date, due_date, progress numeric(5,2) default 0, progress_mode text default 'manual', rollup_weight numeric default 1, created_by→users, timestamps)` + `CHECK` that scope matches the target column.
- `goal_assignees(goal_id→goals ON DELETE CASCADE, user_id→users ON DELETE CASCADE, assigned_by→users, assigned_at, pk(goal_id,user_id))`
- `goal_key_results(id, goal_id→goals ON DELETE CASCADE, title, metric_type, start_value numeric default 0, target_value, current_value default 0, unit, weight numeric default 1, sort_order, timestamps)` — **`start_value` and `weight` are model fixes** required by the progress formula.
- `goal_links(id, goal_id→goals ON DELETE CASCADE, provider jira|github, link_type, external_id, external_key, external_url, title, state, is_done bool, weight numeric default 1, created_by→users, org_id→organizations ON DELETE CASCADE, metadata jsonb, timestamps, unique(goal_id,provider,external_id))` + index `(provider, external_id)`. **`created_by` + `org_id` are model fixes** that make webhook routing O(1) and safe. `external_id` for GitHub must store a globally unique string (e.g. GitHub GraphQL node ID, or `owner/repo#number`) to prevent collision of PR numbers across different repositories.
- `goal_updates(id, goal_id→goals ON DELETE CASCADE, user_id→users, progress, status, note, created_at)` — check-in history.

**Integrations** (extend existing where named)
- Reuse `user_integrations` from the prior plan (per-user JIRA + GitHub). Add `jira` to its provider CHECK and ensure `access_token`/`refresh_token` columns store ciphertext (see crypto). Reuse `integration_preferences`, `integration_sync_logs`, `log_source_references`.
- New `org_integrations(id, org_id→organizations ON DELETE CASCADE, provider slack|github_app, external_install_id, bot_token_enc, webhook_secret, config jsonb, installed_by→users, is_active bool, timestamps, unique(org_id,provider), unique(provider,external_install_id))`.
- New `slack_user_links(id, org_id→organizations ON DELETE CASCADE, user_id→users ON DELETE CASCADE, slack_user_id, slack_team_id, unique(slack_team_id,slack_user_id), unique(org_id,user_id))` — a user should have at most one Slack link per organization to support multi-tenancy.
- New `integration_events(id, provider, external_event_id, event_type, payload jsonb, status received|processing|done|error, error, received_at, processed_at, unique(provider,external_event_id))` — webhook idempotency/audit.

**Triggers / functions**
- `team_closure_after_insert()` (AFTER INSERT): self row + cross-join parent's ancestors.
- `teams_parent_cycle_guard()` (BEFORE UPDATE OF parent_team_id): cycle guard (RAISE EXCEPTION if `NEW.parent_team_id` is a descendant of `NEW.id` by checking `EXISTS (SELECT 1 FROM team_closure WHERE ancestor_id = NEW.id AND descendant_id = NEW.parent_team_id)`). This uses the existing closure table to do an O(1) check instead of recursive CTEs which risk hanging if loops are created.
- `team_closure_after_reparent()` (AFTER UPDATE OF parent_team_id): only runs if `NEW.parent_team_id IS DISTINCT FROM OLD.parent_team_id`. Cuts old-ancestor↔subtree edges. If `NEW.parent_team_id IS NOT NULL`, stitches new-ancestor × subtree with `super.depth+sub.depth+1` (otherwise only cuts for root-level reparenting).
- `viewable_user_ids(p_user_id, p_org_id)` SQL function (RPC) — the closure+membership query the API calls (see authz).
- `goals_parent_cycle_guard()` (BEFORE UPDATE OF parent_goal_id): recursive CTE rejecting cycles.
- Reuse existing `update_updated_at_column()` trigger for `updated_at` on new tables.
- `provision_organization(name, slug, owner)` helper: creates org + owner `org_members` + root team + owner `team_members`; returns org id.
- RLS: `ENABLE ROW LEVEL SECURITY` + deny-all policies (e.g., `FOR ALL TO public USING (false)`) on all new tables to guarantee that the public REST API cannot bypass the Node server's authorization logic using the Supabase anon key/REST API (documented as inert under backend service-role operations).

### File: `shared/src/index.ts` (append types)

Mirror the SQL exactly. Add: `OrgRole`, `TeamRole`, `Organization`, `OrgMember`, `Department`, `Team`, `TeamMember`, `GoalScope`, `GoalStatus`, `GoalPeriod`, `ProgressMode`, `Goal`, `GoalKeyResult`, `GoalLink`, `GoalAssignee`, `GoalUpdate`, `GoalWithDetails` (goal + KRs + links + assignees), `IntegrationProvider`, `UserIntegration`, `OrgIntegration`, and request DTOs (`CreateGoalRequest`, `UpdateGoalRequest`, `CreateTeamRequest`, `AssignGoalRequest`, `LinkWorkItemRequest`). Keep alongside existing `ApiResponse<T>`, `WorkLogEntry`.

**Verify P0:** run the migration on a Supabase branch; `INSERT` an org via `provision_organization`; create nested teams and assert `team_closure` rows (self + ancestors); reparent a team with children and re-assert depths; attempt a cycle and confirm the exception. `npm run typecheck` passes with new shared types.

---

## Phase 1 — Goals + Team management (core feature, no integrations yet)

### Server

**`server/src/lib/crypto.ts`** (built now, used in P2) — `encryptSecret(plaintext): string` / `decryptSecret(packed): string` using AES-256-GCM, key from `INTEGRATION_ENCRYPTION_KEY` (32-byte hex or base64, validated at module load → fail fast). Output `v1:<iv_b64>:<tag_b64>:<ct_b64>`; random 12-byte IV per call; `:` delimiter is safe vs base64. Include `makeOAuthState`/`verifyOAuthState` (HMAC over claims with `JWT_SECRET`, 10-min expiry) for CSRF.

**`server/src/services/authz.ts`** — the authorization core. Functions (all take a service-role `SupabaseClient`):
- `getUserOrgRole(db, userId, orgId): Promise<OrgRole|null>`
- `getEffectiveTeamRole(db, userId, teamId): Promise<TeamRole|null>` — **max** of direct team role, inherited admin/owner from any ancestor (via closure), and org owner/admin.
- `getViewableUserIds(db, userId, orgId): Promise<Set<string>>` — org admin/owner ⇒ all org members; else self + members of every managed team (role≥manager) and all descendants, via the `viewable_user_ids` RPC (single round trip).
- `canManageTeam`, `canViewUser`, `canEditGoal(db, userId, goalRow)` (created_by ⇒ true; org-scope ⇒ org admin; team/dept-scope ⇒ canManageTeam; individual self-goal assignee ⇒ true for progress-only fields).
- Rank maps + `orgRoleAtLeast`/`teamRoleAtLeast`.
- Express middleware `requireOrgRole(min)` / `requireTeamRole(min)` reading `req.params`/`req.body`, failing **closed** (try/catch ⇒ 500, never `next()` on error), memoizing the resolved role on `req`.

**`server/src/services/teamService.ts`** — `createOrg`, `createDepartment`, `createTeam`, `moveTeam` (just `UPDATE parent_team_id`; trigger fixes closure), `deleteTeam` (guard: refuse if children exist unless `reparentChildrenTo` provided), `addMember`/`updateMemberRole`/`removeMember` (validate that the member being added is an active member of the organization `org_members` to prevent cross-tenant membership leaks), `rebuildClosure(orgId)` (ops/repair via recursive CTE).

**`server/src/services/goalService.ts`** — CRUD for goals/KRs/assignees/updates, `setParent` (run cycle-guard CTE before write), and **`recomputeGoalProgress(goalId, {db, visited})`**: if children exist ⇒ weighted avg of children; else by mode (manual=stored; key_results=weighted mean of `clamp01((current-start)/(target-start))` — guard against division by zero by returning `1.0` (representing 100%) if `target_value - start_value === 0` and `current_value >= target_value` else `0.0`, and then multiply the final progress by 100 before writing to the database; linked_items=`sum(weight where is_done)/sum(weight)`); write only if changed; then walk **up** to `parent_goal_id` (cycle-safe via `visited`). Fire-and-forget from handlers (mirror `invalidateMonthlySummary(...).catch()` in `entries.ts`).

**Routes** (register in `server/src/index.ts` via `app.use`):
- `server/src/routes/organizations.ts` → `/api/orgs` (create org, list my orgs, members, departments). Create uses `provision_organization` RPC.
- `server/src/routes/teams.ts` → `/api/teams` (CRUD gated by `requireTeamRole('admin')`, membership management, list members with `getViewableUserIds` filtering).
- `server/src/routes/goals.ts` → `/api/goals` (list visible goals, get one with details, create/update/delete gated by `canEditGoal`, assignees, KRs, `goal_updates` check-ins). List query filters by `getViewableUserIds` + org/team/scope params.

### Client

**`client/src/lib/teamsApi.ts`** + **`client/src/lib/goalsApi.ts`** — thin modules over `apiRequest<T>` (chatApi.ts style).

**Pages** (lazy-loaded in `App.tsx` under `ProtectedRoute`; `usePageMeta` + `useTranslation`; dark glass Tailwind):
- `client/src/pages/Goals.tsx` — my goals + goals assigned to me; progress bars; check-in modal.
- `client/src/pages/TeamGoals.tsx` — manager view: team tree (from closure), per-member goals, roll-up progress, create/assign goals. Gated by team role from a new `useTeamRole` hook.
- `client/src/pages/OrgSettings.tsx` — org/department/team management + member roles (org admin only).

**Components** under `client/src/components/goals/` and `teams/`: `GoalCard`, `GoalForm`, `KeyResultEditor`, `GoalProgressBar`, `AssigneePicker`, `TeamTree`, `MemberList`, `RoleBadge`. No prebuilt primitives exist — build inline with existing `glass`/`card-hover` classes; wrap all copy in `t()`; add keys to `client/src/locales/en/base.json`.

Add nav entries in `client/src/components/Layout.tsx` for Goals / Team (conditional on membership).

**Verify P1:** create org → create nested teams → add a member as `manager` of a parent team → as that manager, create a team goal and assign an individual goal to a descendant-team member → confirm visibility (manager sees report's goal; an unrelated user does not via the API) → update a KR and confirm parent goal progress rolls up → record a check-in.

---

## Phase 2 — Integration connections (OAuth) + org installs

Build the connection layer for all three providers; no sync/linking behavior yet.

**`server/src/routes/integrations/jira.ts`** — `/api/integrations/jira/connect` (302 to Atlassian 3LO: scopes `read:jira-work read:jira-user offline_access`, signed `state`), `/callback` (exchange code, call `accessible-resources` for available sites. If multiple sites are returned, the server temporarily caches the tokens and sites in a short-lived cache/cookie and redirects the user to a selection page in the client with a secure, short-lived session token. Once selected, the client POSTs the selection to `/api/integrations/jira/select`, and the server retrieves the cached tokens, encrypts them, and saves them to `user_integrations` with `config={cloudId,siteUrl}`), `/disconnect`. Handle **rotating refresh tokens** (store the new refresh token on every refresh; proactive refresh when `<60s` left) via a shared `getJiraClient(userId)` in `server/src/lib/jiraAdapter.ts`. To prevent token reuse revocation under concurrent requests, wrap the token refresh operation in a database-level lock (`SELECT ... FOR UPDATE` on `user_integrations`) to serialize refresh operations.

**`server/src/routes/integrations/github.ts`** — per-user identity OAuth (`read:user`, `repo`), store encrypted token + GitHub numeric id/login in `config`. `server/src/lib/githubAdapter.ts` (extend the one named in the prior plan).

**`server/src/routes/integrations/slack.ts`** — org install (OAuth v2 scopes `chat:write,commands,users:read,users:read.email`), gated by `requireOrgRole('admin')`, `orgId` bound into `state`; store bot token encrypted in `org_integrations`. `server/src/lib/slackAdapter.ts` (`postMessage`, `openDm`, `usersLookupByEmail`).

**`server/src/lib/githubApp.ts`** — GitHub App install callback: since GitHub App installation flows support a `state` parameter, pass the `org_id` in the `state` parameter during redirect. Upon callback, read this `org_id` from the `state` parameter to store `installation.id` in `org_integrations(provider='github_app')` and associate it with the correct organization. Mint installation tokens for org-level reads.

**Client:** `client/src/lib/integrationsApi.ts`; `client/src/pages/Integrations.tsx` (per-user "Connect JIRA/GitHub" + org-admin "Install Slack/GitHub App"); `components/integrations/ConnectionCard.tsx`, `OAuthButton.tsx`. Connection status only returns booleans/usernames — **never ciphertext**.

**Verify P2:** complete each OAuth round-trip on localhost + a deployed URL; confirm `user_integrations`/`org_integrations` rows contain `v1:...` ciphertext (not plaintext); `decryptSecret` round-trips; revoke + reconnect works; CSRF state rejects tampered/expired values.

---

## Phase 3 — Goal ↔ work-item linking + webhook progress sync

**Raw-body capture (prerequisite):** in `server/src/index.ts`, **before** the global `express.json()`, mount route-specific parsers: `app.use('/api/webhooks/github', express.json({ verify: (req,_,buf)=>{(req as any).rawBody=buf} }))`, same for `/api/webhooks/jira`, and `app.use('/api/webhooks/slack', express.raw({type:'*/*'}))` (Slack signs raw form bytes).

**`server/src/lib/webhookSecurity.ts`** — `verifyGithubSignature(raw, header, secret)` (HMAC-SHA256, `timingSafeEqual`; secret = app-global `GITHUB_APP_WEBHOOK_SECRET`), `verifySlackSignature(raw, ts, sig, SLACK_SIGNING_SECRET)` (v0 base string + 5-min skew), `verifyJiraWebhook` (shared-secret query token in the registered webhook URL matched against `org_integrations.webhook_secret` after resolving org from query parameters/URL path). `recordEvent(provider, externalEventId, type, payload)` → `INSERT ... ON CONFLICT (provider, external_event_id) DO UPDATE SET status = EXCLUDED.status, payload = EXCLUDED.payload WHERE integration_events.status = 'error' RETURNING id`. If no row is inserted/updated (indicating a duplicate event already processing or done) ⇒ ack 200 and stop.

**Linking endpoint** `POST /api/goals/:goalId/links` (gated by `canEditGoal`): resolve the actor's `user_integrations` token; parse `external_url` → key/id; fetch current state (JIRA `GET /rest/api/3/issue/{key}?fields=status`, done = `statusCategory.key==='done'`; GitHub `GET /repos/{o}/{r}/pulls/{n}`, done = `merged` — store the globally unique GraphQL `node_id` or `owner/repo#number` as the `external_id`, **not** the simple PR number, to avoid collisions across different repositories in the organization); upsert `goal_links` (with `created_by`, `org_id`); `recomputeGoalProgress`.

**Webhook routes** `server/src/routes/webhooks/github.ts` + `jira.ts`: verify signature → `recordEvent` (idempotent) → resolve org via `installation.id`/`cloudId` → `UPDATE goal_links SET is_done,state WHERE provider=$p AND external_id=$id AND org_id=$resolvedOrg RETURNING goal_id` (using `RETURNING goal_id` to get affected goal IDs in a single query; org scoping prevents cross-org tampering even on id collisions — updates are **tokenless**, matched purely on `(provider, external_id)`) → `recomputeGoalProgress` per affected goal. In batch updates, deduplicate and topologically sort goal updates (leaf to root) to avoid redundant recalculation and write contention. Process inside `mdc.run({jobRunId, jobName:'webhook:'+provider})`; on error mark event `error` but still ack 200 (avoid infinite retries); nightly job heals drift.

**`server/src/jobs/goalRollupJob.ts`** — class singleton, cron, full per-org recompute sweep; started in `index.ts`. To successfully heal drift, the job must query the JIRA and GitHub APIs to refresh the status of all active external links (Jira issues, GitHub PRs) before running the progress recalculation.

**Client:** `LinkWorkItemModal.tsx` on `GoalCard` (paste JIRA/GitHub URL); show linked items + live state on the goal detail view.

**Verify P3:** link a real JIRA issue and a GitHub PR to a `linked_items` goal → progress reflects done ratio → transition the issue to Done / merge the PR → webhook flips `is_done` and progress recomputes (check `integration_events` shows `done`, no duplicates on redelivery) → confirm a webhook for another org cannot mutate these links.

---

## Phase 4 — Auto-populate weekly worklogs (extends the prior plan)

Implement the orchestrator from `slack-git-auto-integration-plan.md`, adding JIRA: `server/src/lib/activityNormalizer.ts` (unified `NormalizedActivity`, dedupe by source URL, week grouping), `autoLogSynthesizer.ts` (Mistral `chat.complete` → 200–400-word draft), and `server/src/jobs/weeklySyncJob.ts` (run dynamically on Monday morning based on each user's local timezone preference stored in `integration_preferences.timezone` to ensure accurate date-windowing) — fetches activity (commits/PRs, Jira issues) for the **previous ISO week** (Monday through Sunday of the week that just ended in their timezone) to compile the worklog. Adapters fetch commits/PRs (GitHub), issues worked (JIRA), and—if the user opts in—Slack messages. Writes `work_log_entries` with `status='auto-generated'`, `pending_review=true`, and `log_source_references`. To prevent hitting Mistral rate limits, queue the sync tasks and throttle calls with concurrency limiting (e.g. `p-limit`) and exponential backoff retry logic. Client: `AutoLogReview.tsx` + a Dashboard "Ready for review" card (as specified in the prior plan). Gate all of this behind `integration_preferences.sync_enabled` + explicit opt-in (GDPR notes in the prior plan apply).

**Verify P4:** connect GitHub+JIRA, trigger a manual sync, confirm a `pending_review` draft with correct source references; edit+submit transitions status; reject deletes the draft.

---

## Phase 5 — Slack notifications + slash commands

**Notifications** (`server/src/lib/slackNotifier.ts`, called from goal/assignment events and a digest job): goal assigned → DM the assignee; weekly **manager digest** (`server/src/jobs/goalDigestJob.ts`) → channel/DM summary of team progress + at-risk goals; reminder nudges. Uses the org bot token (`decryptSecret`) and `slack_user_links` for DM targeting; resolves unmapped users by email via `users:read.email`.

**Slash commands** `server/src/routes/webhooks/slack.ts`: verify signature → map `(team_id, user_id)` → app user via `slack_user_links`. If unmapped, return an ephemeral Slack message with a secure link directing the user to `/integrations/slack/link` in the web application. This link must contain a short-lived, signed token (JWT) containing their Slack user and team IDs. It requires the user to log in/be logged in to authenticate their identity and verify the token signature before linking their Slack ID to prevent security hijacking (do **not** automatically trust or link users based on matching emails from Slack's `users.info` without authentication, and do **not** accept unsigned, plain query parameters to prevent CSRF/forgery). Once mapped: **ack within 3s** (`200` + ephemeral "working…") → do work async and POST to `response_url`. Commands: `/worklog` (show/create this week's entry), `/goals` (list active goals + progress), `/goals <id> <n>%` (record a `goal_update`, `recomputeGoalProgress`, reply). All mutations re-check `canEditGoal`. Dedupe via `integration_events` on `trigger_id`/`event_id`.

**Verify P5:** assign a goal → assignee gets a Slack DM; run `/goals` in Slack → see live progress; `/goals <id> 50%` → progress updates in-app; manager digest posts on schedule (use `runNow()`).

---

## Critical files

**New (server):** `lib/crypto.ts`, `lib/webhookSecurity.ts`, `lib/jiraAdapter.ts`, `lib/githubAdapter.ts`, `lib/githubApp.ts`, `lib/slackAdapter.ts`, `lib/slackNotifier.ts`, `lib/activityNormalizer.ts`, `lib/autoLogSynthesizer.ts`; `services/authz.ts`, `services/teamService.ts`, `services/goalService.ts`; `routes/organizations.ts`, `routes/teams.ts`, `routes/goals.ts`, `routes/integrations/{jira,github,slack}.ts`, `routes/webhooks/{github,jira,slack}.ts`; `jobs/{weeklySyncJob,goalRollupJob,goalDigestJob}.ts`.
**Modified (server):** `index.ts` (raw-body parsers before global json; register routers; start jobs), `middleware/auth.ts` (export `requireOrgRole`/`requireTeamRole` or import from authz), `lib/supabase.ts`/`database.ts` (no change beyond reuse).
**New (client):** `lib/{teamsApi,goalsApi,integrationsApi}.ts`; `pages/{Goals,TeamGoals,OrgSettings,Integrations,AutoLogReview}.tsx`; `components/{goals,teams,integrations}/*`; `hooks/useTeamRole.ts`, `hooks/useGoals.ts`.
**Modified (client):** `App.tsx` (routes), `components/Layout.tsx` (nav), `pages/Dashboard.tsx` (review card), `locales/en/base.json` (i18n keys).
**DB:** `supabase-migrations/2026-06-16_teams_goals_integrations.sql`.

## Environment variables (add to `server/.env.example`)
`INTEGRATION_ENCRYPTION_KEY` (32-byte hex/base64), `OAUTH_STATE_SECRET` (or reuse `JWT_SECRET`), `JIRA_CLIENT_ID/SECRET/REDIRECT_URI`, `GITHUB_CLIENT_ID/SECRET/REDIRECT_URI`, `GITHUB_APP_ID/PRIVATE_KEY/WEBHOOK_SECRET`, `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET/REDIRECT_URI`, `WEEKLY_SYNC_HOUR=9`, `SYNC_JOB_TIMEOUT_MS=300000`. Deploy: client→Vercel (`./client`), server→Railway (`./server`), DB→Supabase (run migration in SQL editor); register OAuth redirect + webhook URLs for localhost and the deployed server.

## End-to-end verification
Per-phase checks listed above. Whole-feature smoke test: provision org → build a team tree → manager assigns a cascading goal with KRs and a linked GitHub PR → merge the PR (webhook updates progress) → weekly sync drafts a worklog from JIRA+GitHub activity → assignee gets a Slack DM and updates progress via `/goals` → manager digest reflects the roll-up. Run `npm run typecheck`, `npm run lint`, and `npm run build` clean throughout. Codex review at end of each response per CLAUDE.md.
