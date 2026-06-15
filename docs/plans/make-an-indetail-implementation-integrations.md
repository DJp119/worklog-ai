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
| Org model | Full hierarchy: `organizations → org_members → departments → teams (nestable) → team_members`, plus a `team_closure` table. Single-column FKs are used for nullable relationships (e.g. departments -> teams) to prevent the Postgres composite `ON DELETE SET NULL` bug, while triggers enforce tenant isolation. | User-selected; closure table gives "manager sees all descendant members" in one query; triggers enforce strict tenant isolation |
| Authz enforcement | **Node service layer** (`services/authz.ts`) keyed on `req.userId`; RLS is inert defense-in-depth | Service-role client bypasses RLS |
| Closure maintenance | **Postgres triggers** (not Node) + `ON DELETE RESTRICT` for `parent_team_id` | Triggers hold for all writers. `ON DELETE RESTRICT` prevents closure table corruption on deletion by requiring explicit reparenting of children. |
| Integration auth | **Hybrid**: per-user OAuth in `user_integrations` (JIRA 3LO + GitHub identity); org-level installs in new `org_integrations` (Slack bot, GitHub App, and JIRA site connections with explicit access/refresh token columns) | User-selected; correct attribution + clean org-wide webhooks + site-wide webhook routing |
| Token storage | AES-256-GCM via new `server/src/lib/crypto.ts` (using Base64/Hex conversion keys); ciphertext in token columns | No AES helper exists today; at-rest only is insufficient for OAuth tokens |
| Goal progress | `progress_mode` ∈ manual / key_results / linked_items; **children override mode** (parent = weighted avg of children). Manual progress updates restricted to `'manual'` mode and rejected for goals with child goals. Progress recomputation is database-trigger-driven to prevent Node concurrency race conditions. | OKR cascade semantics. Prevents overwriting manual progress and avoids lost updates during concurrent edits. |
| JIRA/GitHub Rollup Sync | **Batched queries** (JIRA JQL by ID + GitHub GraphQL using org-level installation tokens) | Avoids hitting API rate limits during nightly sweeps or bulk updates and handles deleted/disconnected user tokens. |
| Slack Slash commands | **PostgreSQL ephemeral session table or Block Kit encoding** | Resolves numbered indexes (1, 2, 3) to goal UUIDs statelessly without adding Redis (avoiding new infrastructure dependencies as package.json shows the app has no Redis). |
| Weekly Sync | **Monday 9 AM Local timezone with catch-up logic** | Optimized via a single PostgreSQL query with timezone functions to select only users needing sync. |
| Migration file | `supabase-migrations/2026-06-16_teams_goals_integrations.sql` | Matches the recent date-prefixed convention |

**Role semantics (the most error-prone point — document in code):** team **visibility** allows team members (role $\ge$ `member`) to see their own team and its goals, while team **descendant visibility** is granted at role $\ge$ `manager`. Team **config mutation** (rename, membership, reparent) requires role $\ge$ `admin`. Org `owner/admin` is an escape hatch for everything in the org. Rank maps: `org {member:1,admin:2,owner:3}`, `team {member:1,manager:2,admin:3,owner:4}`. Never compare role strings lexically.

---

## Phase 0 — Database migration & shared types (foundation)

### File: `supabase-migrations/2026-06-16_teams_goals_integrations.sql`

Additive only; `users(id)` FKs; enums guarded with `DO $$ ... EXCEPTION WHEN duplicate_object`. Tables:

**Org hierarchy**
- `organizations(id, name, slug unique, created_at, updated_at)` — owner is derived from `org_members` to prevent redundant sources of truth.
- `org_members(id, org_id→organizations ON DELETE CASCADE, user_id→users ON DELETE CASCADE, role org_role, unique(org_id,user_id))` — `org_role` enum = `member|admin|owner`. Enforce exactly one owner per organization via a unique partial index: `CREATE UNIQUE INDEX idx_single_org_owner ON org_members(org_id) WHERE (role = 'owner')`.
- `departments(id, org_id→organizations ON DELETE CASCADE, name, UNIQUE(id, org_id))`
- `teams(id, org_id→organizations ON DELETE CASCADE, department_id→departments ON DELETE SET NULL, parent_team_id→teams ON DELETE RESTRICT, name, timestamps, UNIQUE(id, org_id))` + composite FK `(parent_team_id, org_id) REFERENCES teams(id, org_id) ON DELETE RESTRICT` (to prevent closure table corruption on delete). Note: `department_id` is a single-column FK `REFERENCES departments(id) ON DELETE SET NULL` to prevent the Postgres composite `ON DELETE SET NULL` bug (which would nullify `org_id`). Tenant isolation is enforced via the `verify_team_department_org()` trigger.
- `team_members(id, team_id→teams ON DELETE CASCADE, user_id→users ON DELETE CASCADE, role team_role, org_id→organizations, unique(team_id,user_id))` — `team_role` enum = `member|manager|admin|owner` + composite FKs: `(team_id, org_id) REFERENCES teams(id, org_id) ON DELETE CASCADE` and `(org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE` to prevent cross-tenant membership leaks.
- `team_closure(ancestor_id→teams ON DELETE CASCADE, descendant_id→teams ON DELETE CASCADE, depth, pk(ancestor_id,descendant_id))` + indexes on both columns

**Goals** (`goal_scope`=`organization|department|team|individual`, `goal_status`=`draft|active|at_risk|completed|cancelled`, `goal_period`=`weekly|monthly|quarterly|annual|custom`)
- `goals(id, org_id→organizations ON DELETE CASCADE, scope, team_id→teams ON DELETE SET NULL, department_id→departments ON DELETE SET NULL, parent_goal_id→goals ON DELETE SET NULL, title, description, status, period, start_date, due_date, progress numeric(5,2) default 0, progress_mode text default 'manual', rollup_weight numeric default 1, created_by→users, timestamps, UNIQUE(id, org_id))` + `CHECK` that scope matches the target column. Note: `parent_goal_id`, `team_id`, and `department_id` are single-column FKs `ON DELETE SET NULL` to avoid Postgres composite `ON DELETE SET NULL` bugs. Tenant isolation is enforced via the `verify_goal_relations_org()` trigger.
- `goal_assignees(goal_id→goals ON DELETE CASCADE, user_id→users ON DELETE CASCADE, assigned_by→users, assigned_at, org_id→organizations ON DELETE CASCADE, pk(goal_id,user_id))` + composite FKs: `(goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE` and `(org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE` to guarantee user belongs to the same org.
- `goal_key_results(id, goal_id→goals ON DELETE CASCADE, title, metric_type, start_value numeric default 0, target_value, current_value default 0, unit, weight numeric default 1 CHECK (weight >= 0), sort_order, timestamps)` — **`start_value` and `weight` are model fixes** required by the progress formula.
- `goal_links(id, goal_id→goals ON DELETE CASCADE, provider jira|github, link_type, external_id, external_key, external_url, title, state, is_done bool, weight numeric default 1 CHECK (weight >= 0), created_by→users, org_id→organizations ON DELETE CASCADE, metadata jsonb, timestamps, unique(goal_id,provider,external_id))` + index `(provider, external_id)`. Composite FK `(goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE` is required for tenant isolation. **`created_by` + `org_id` are model fixes** that make webhook routing O(1) and safe. `external_id` for GitHub must store a globally unique string (e.g. GitHub GraphQL node ID, or `owner/repo#number`), and for JIRA, `external_id` must store the immutable numeric issue ID (not the mutable key) to prevent broken links on issue moves.
- `goal_updates(id, goal_id→goals ON DELETE CASCADE, user_id→users, progress, status, note, created_at, org_id→organizations ON DELETE CASCADE)` + composite FKs: `(goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE` and `(org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE`.

**Integrations** (extend existing where named)
- Reuse `user_integrations` from the prior plan (per-user JIRA + GitHub). Add `jira` to its provider CHECK and ensure `access_token`/`refresh_token` columns store ciphertext (see crypto).
- Modify `integration_preferences` to add a `timezone TEXT DEFAULT 'UTC'` column and a `last_weekly_sync_week TEXT DEFAULT NULL` column to support localized, catch-up weekly sync scheduling.
- Reuse `integration_sync_logs`, `log_source_references`.
- New `org_integrations(id, org_id→organizations ON DELETE CASCADE, provider slack|github_app|jira, external_install_id, bot_token_enc, access_token_enc, refresh_token_enc, webhook_secret, config jsonb, installed_by→users, is_active bool, timestamps, unique(org_id,provider), unique(provider,external_install_id))` + composite FK `(org_id, installed_by) REFERENCES org_members(org_id, user_id) ON DELETE RESTRICT`. Note that for JIRA, `org_integrations` stores the tenant's JIRA Cloud site connection and its shared webhook secret, as well as encrypted access/refresh tokens.
- New `slack_user_links(id, org_id→organizations ON DELETE CASCADE, user_id→users ON DELETE CASCADE, slack_user_id, slack_team_id, unique(slack_team_id,slack_user_id), unique(org_id,user_id))` — a user should have at most one Slack link per organization to support multi-tenancy, plus composite FK `(org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE`.
- New `slack_command_sessions(slack_user_id, index_number int, goal_id→goals ON DELETE CASCADE, expires_at timestamptz, pk(slack_user_id, index_number))` — temporary database storage to resolve Slack CLI fallback indexes without introducing a Redis dependency.
- New `integration_events(id, provider, external_event_id, event_type, payload jsonb, status received|processing|done|error, error, received_at, processed_at, unique(provider,external_event_id))` — webhook idempotency/audit. Internal table; must not be exposed to frontend.

**Triggers / functions**
- `team_closure_after_insert()` (AFTER INSERT): self row + parent's ancestors paths.
- `teams_parent_cycle_guard()` (BEFORE INSERT OR UPDATE OF parent_team_id): cycle guard (RAISE EXCEPTION if `NEW.parent_team_id = NEW.id` or if `NEW.parent_team_id` is a descendant of `NEW.id` by checking `EXISTS (SELECT 1 FROM team_closure WHERE ancestor_id = NEW.id AND descendant_id = NEW.parent_team_id)`).
- `team_closure_after_reparent()` (AFTER UPDATE OF parent_team_id): only runs if `NEW.parent_team_id IS DISTINCT FROM OLD.parent_team_id`. Cuts old-ancestor↔subtree edges. If `NEW.parent_team_id IS NOT NULL`, stitches new-ancestor × subtree with `super.depth+sub.depth+1` (otherwise only cuts for root-level reparenting).
- `viewable_user_ids(p_user_id, p_org_id)` SQL function (RPC) — the closure+membership query the API calls (see authz).
- `verify_team_department_org()` (BEFORE INSERT OR UPDATE ON teams): validates that the department's `org_id` matches the team's `org_id`.
- `verify_goal_relations_org()` (BEFORE INSERT OR UPDATE ON goals): validates that `parent_goal_id`, `team_id`, and `department_id` share the goal's `org_id`.
- `goal_progress_recomputation_trigger` (AFTER INSERT OR UPDATE OR DELETE ON goal_key_results, goal_links, and goals): automatically triggers progress calculations (`recomputeGoalProgress`) inside the database to prevent concurrent lost updates in Node.
- `goals_parent_cycle_guard()` (BEFORE UPDATE OF parent_goal_id): recursive CTE rejecting cycles.
- `prevent_org_id_mutation()` (BEFORE UPDATE OF org_id on teams, departments, goals, etc.): blocks modifying `org_id` to guarantee tenant isolation.
- Reuse existing `update_updated_at_column()` trigger for `updated_at` on new tables.
- `provision_organization(name, slug, owner)` helper: creates org + owner `org_members` + root team + owner `team_members`; returns org id.
- RLS: `ENABLE ROW LEVEL SECURITY` + deny-all policies (e.g., `FOR ALL TO public USING (false)`) on all new tables to guarantee that the public REST API cannot bypass the Node server's authorization logic using the Supabase anon key/REST API.

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
- `getViewableUserIds(db, userId, orgId): Promise<Set<string>>` — org admin/owner ⇒ all org members; else self + members of every team the user is a member of (role $\ge$ `member`), plus members of every managed team (role $\ge$ `manager`) and all descendants, via the `viewable_user_ids` RPC (single round trip).
- `canManageTeam`, `canViewUser`, `canEditGoal(db, userId, goalRow)` — First, check if the user is a member of the organization (`org_members`). If not, return false. Admin/owner can edit all. Else: created_by $\Rightarrow$ true only if individual-scope; team/dept-scope $\Rightarrow$ canManageTeam; individual self-goal assignee $\Rightarrow$ true for progress check-ins only. Org-scope goals require org admin.
- Rank maps + `orgRoleAtLeast`/`teamRoleAtLeast`.
- Express middleware `requireOrgRole(min)` / `requireTeamRole(min)` reading `req.params`/`req.body`, failing **closed** (try/catch ⇒ 500, never `next()` on error), memoizing the resolved role on `req`.

**`server/src/services/teamService.ts`** — `createOrg`, `createDepartment`, `createTeam`, `moveTeam` — must lock the organization row `SELECT ... FOR UPDATE ON organizations WHERE id = orgId` before modifying parent relationships to prevent concurrent cycle creation. `deleteTeam` (guard: refuse if children exist unless `reparentChildrenTo` provided, enforced by database RESTRICT), `addMember`/`updateMemberRole`/`removeMember` (validate that the member being added is an active member of the organization `org_members` to prevent cross-tenant membership leaks, enforced at DB-level via composite foreign key constraints), `rebuildClosure(orgId)` (ops/repair via recursive CTE).

**`server/src/services/goalService.ts`** — CRUD for goals/KRs/assignees/updates. Enforce that manual progress updates can only occur when `progress_mode === 'manual'`, and block mixing child goals and key results/links on the same goal (validation on create/update). Reject progress updates if the goal has child goals.
- `setParent` (run cycle-guard CTE before write, and trigger progress recomputation for both the **new** parent and the **old** parent `OLD.parent_goal_id` to prevent stale calculations).
- Goal deletion handler must trigger progress recomputation for the `parent_goal_id` of the deleted goal.
- **`recomputeGoalProgress(goalId, {db, visited})`**: Implemented inside a PostgreSQL function/trigger to ensure atomic updates and prevent concurrency race conditions (lost updates) in Node. If children exist ⇒ weighted avg of children; else by mode (manual=stored; key_results=weighted mean of `clamp01((current-start)/(target-start))` — guard against division by zero if sum of weights is 0 by returning `0.0`, and check if `target_value === start_value`, in which case return `1.0` if `current_value === target_value` else `0.0` (handling static goals and ensuring decreasing goal logic checks correctly), and then multiply by 100 before writing to the database; linked_items=if no links or sum of weights is 0 return `0.0` else `(sum(weight where is_done)/sum(weight)) * 100` to store as percentage); write only if changed; then walk **up** to `parent_goal_id` (cycle-safe via `visited` checks).

**Routes** (register in `server/src/index.ts` via `app.use`):
- `server/src/routes/organizations.ts` → `/api/orgs` (create org, list my orgs, members, departments). Create uses `provision_organization` RPC.
- `server/src/routes/teams.ts` → `/api/teams` (CRUD gated by `requireTeamRole('admin')`, membership management, list members with `getViewableUserIds` filtering).
- `server/src/routes/goals.ts` → `/api/goals` (list visible goals, get one with details, create/update/delete gated by `canEditGoal`, assignees, KRs, `goal_updates` check-ins). Enforce progress mutation is only allowed if `progress_mode === 'manual'`. List query filters by `getViewableUserIds` + org/team/scope params.

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

**`server/src/routes/integrations/jira.ts`** — `/api/integrations/jira/connect` (302 to Atlassian 3LO: scopes `read:jira-work read:jira-user offline_access`, signed `state`), `/callback` (exchange code, call `accessible-resources` for available sites. If multiple sites are returned, the server returns the site list along with a short-lived signed JWT containing the encrypted tokens. The client redirects to a selection page, and when the site is chosen, POSTs the selection and JWT back to `/api/integrations/jira/select`, where the server decrypts the tokens and saves them to `org_integrations` statelessly), `/disconnect`. Handle **rotating refresh tokens** (store the new refresh token on every refresh; proactive refresh when `<60s` left) via a shared `getJiraClient(userId)` in `server/src/lib/jiraAdapter.ts`. To prevent token reuse revocation under concurrent requests, wrap the token refresh operation in a database-level lock (`SELECT ... FOR UPDATE` on `user_integrations`) to serialize refresh operations. Inside the transaction, after acquiring the lock, reload the tokens from the database and verify it still requires refresh before calling the Atlassian API. If it has been refreshed by a concurrent worker, return the new token and skip the refresh API call. Wrap the refresh API call in a try-catch; on permanent token rejection (e.g. revoked/expired with `invalid_grant` error), set `is_active = false` on `user_integrations` and log a user notification. For transient errors (e.g., timeouts, 5xx server errors, rate limits), throw the error to retry later without disabling the integration.

**`server/src/routes/integrations/github.ts`** — per-user identity OAuth (`read:user`, `repo`), store encrypted token + GitHub numeric id/login in `config`. `server/src/lib/githubAdapter.ts` (extend the one named in the prior plan).

**`server/src/routes/integrations/slack.ts`** — org install (OAuth v2 scopes `chat:write,commands,users:read,users:read.email`), gated by `requireOrgRole('admin')`, `orgId` bound into `state`; store bot token encrypted in `org_integrations`. `server/src/lib/slackAdapter.ts` (`postMessage`, `openDm`, `usersLookupByEmail`).

**`server/src/lib/githubApp.ts`** — GitHub App install callback: since GitHub App installation flows support a `state` parameter, pass the `org_id` in the `state` parameter during redirect. Upon callback, read this `org_id` from the `state` parameter to store `installation.id` in `org_integrations(provider='github_app')` and associate it with the correct organization. Mint installation tokens for org-level reads. If the app installation is initiated directly from GitHub without a `state` payload, redirect the logged-in user to an organization linking page in the client.

**CSRF & Org Binding Security:**
All organization installation flows (Slack, GitHub App, and JIRA site connections) must bind the target `org_id` and the user ID of the requesting admin inside the signed state payload (`makeOAuthState`/`verifyOAuthState` using HMAC with `JWT_SECRET`, 10-minute expiry). The callback must verify this signature and ensure the authenticated user initiating the callback matches the logged-in user and holds admin rights on the target organization, preventing cross-tenant hijacking.

**Client:** `client/src/lib/integrationsApi.ts`; `client/src/pages/Integrations.tsx` (per-user "Connect JIRA/GitHub" + org-admin "Install Slack/GitHub App"). This component also handles sub-routes for Slack user linking `/integrations/slack/link?token=...` (preserving the signed query token across SPA login redirects) and JIRA site selection `/integrations/jira/select-site`. `components/integrations/ConnectionCard.tsx`, `OAuthButton.tsx`. Connection status only returns booleans/usernames — **never ciphertext**.

**Verify P2:** complete each OAuth round-trip on localhost + a deployed URL; confirm `user_integrations`/`org_integrations` rows contain `v1:...` ciphertext (not plaintext); `decryptSecret` round-trips; revoke + reconnect works; CSRF state rejects tampered/expired values.

---

## Phase 3 — Goal ↔ work-item linking + webhook progress sync

**Raw-body capture (prerequisite):** in `server/src/index.ts`, **before** the global `express.json()`, mount route-specific parsers: `app.use('/api/webhooks/github', express.json({ verify: (req,_,buf)=>{(req as any).rawBody=buf} }))`, same for `/api/webhooks/jira`, and `app.use('/api/webhooks/slack', express.urlencoded({ extended: true, verify: (req,_,buf)=>{(req as any).rawBody=buf} }))` (parses URL-encoded fields automatically while keeping the raw buffer in `req.rawBody` for signature validation).

**`server/src/lib/webhookSecurity.ts`** — `verifyGithubSignature(raw, header, secret)` (HMAC-SHA256, `timingSafeEqual`; secret = app-global `GITHUB_APP_WEBHOOK_SECRET`), `verifySlackSignature(raw, ts, sig, SLACK_SIGNING_SECRET)` (v0 base string + 5-min skew). To prevent unhandled `RangeError` crashes from Node's `crypto.timingSafeEqual` (which throws when buffers differ in length), compare signature lengths first before performing `timingSafeEqual` in all signature verification helpers. `verifyJiraWebhook` (shared-secret query token in the registered webhook URL matched against `org_integrations.webhook_secret` after resolving org from query parameters/URL path).
`recordEvent(provider, externalEventId, type, payload)` → `INSERT ... ON CONFLICT (provider, external_event_id) DO UPDATE SET status = EXCLUDED.status, payload = EXCLUDED.payload WHERE integration_events.status = 'error' OR (integration_events.status = 'processing' AND integration_events.updated_at < NOW() - INTERVAL '5 minutes') RETURNING id`. If no row is inserted/updated (indicating a duplicate event already processing or done) ⇒ ack 200 and stop. The check for events stuck in `'processing'` for over 5 minutes ensures recovery and reprocessing if a server worker crashes. Add a daily cron job to prune `integration_events` older than 30 days.

**Linking endpoint** `POST /api/goals/:goalId/links` (gated by `canEditGoal`): resolve the actor's `user_integrations` token; parse `external_url` → key/id; fetch current state (JIRA `GET /rest/api/3/issue/{id}?fields=status`, done = `statusCategory.key==='done'`; GitHub `GET /repos/{o}/{r}/pulls/{n}`, done = `merged` — store the globally unique GraphQL `node_id` or `owner/repo#number` as the `external_id`, **not** the simple PR number, to avoid collisions across different repositories in the organization, and store the immutable numeric issue ID as JIRA's `external_id` to prevent broken references when keys change); upsert `goal_links` (with `created_by`, `org_id`); `recomputeGoalProgress`.

**Webhook routes** `server/src/routes/webhooks/github.ts` + `jira.ts`: verify signature → `recordEvent` (idempotent) → resolve org via `installation.id`/`cloudId` → `UPDATE goal_links SET is_done,state WHERE provider=$p AND external_id=$id AND org_id=$resolvedOrg RETURNING goal_id` (using `RETURNING goal_id` to get affected goal IDs in a single query; org scoping prevents cross-org tampering even on id collisions — updates are **tokenless**, matched purely on `(provider, external_id)`) → `recomputeGoalProgress` per affected goal. In batch updates, deduplicate and topologically sort goal updates (leaf to root) to avoid redundant recalculation and write contention. Process inside `mdc.run({jobRunId, jobName:'webhook:'+provider})`; on error mark event `error` but still ack 200 (avoid infinite retries); nightly job heals drift.

**`server/src/jobs/goalRollupJob.ts`** — class singleton, cron, full per-org recompute sweep; started in `index.ts`. To successfully heal drift without hitting API rate limits, the job **must batch queries**: use JQL searches (`id IN (...)` up to 50 items/request) for Jira and batched GraphQL node queries for GitHub using org-level installation tokens (falling back to pooled active user tokens if needed) to refresh the status of active external links before running progress recalculation.

**Client:** `LinkWorkItemModal.tsx` on `GoalCard` (paste JIRA/GitHub URL); show linked items + live state on the goal detail view.

**Verify P3:** link a real JIRA issue and a GitHub PR to a `linked_items` goal → progress reflects done ratio → transition the issue to Done / merge the PR → webhook flips `is_done` and progress recomputes (check `integration_events` shows `done`, no duplicates on redelivery) → confirm a webhook for another org cannot mutate these links.

---

## **Phase 4 — Auto-populate weekly worklogs (extends the prior plan)**

Implement the orchestrator from `slack-git-auto-integration-plan.md`, adding JIRA: `server/src/lib/activityNormalizer.ts` (unified `NormalizedActivity`, dedupe by source URL, week grouping), `autoLogSynthesizer.ts` (Mistral `chat.complete` → 200–400-word draft). **Introduce an `ActivityProvider` interface seam** in `server/src/lib/activityProvider.ts` with concrete **adapters** (`GithubActivityProvider`, `JiraActivityProvider`, `SlackActivityProvider`) to decouple sync logic from third-party API clients, and `server/src/jobs/weeklySyncJob.ts` (runs **hourly**; uses a PostgreSQL timezone-aware query to select only users whose local time is past Monday morning 9 AM in `integration_preferences.timezone` and whose `last_weekly_sync_week` is older than the current week `to_char(timezone(timezone, now()), 'IYYY-IW')`) — fetches activity (commits/PRs, Jira issues) for the **previous ISO week** (Monday through Sunday of the week that just ended in their timezone) to compile the worklog. Saves the current week identifier to `last_weekly_sync_week` to prevent duplicate processing. Adapters fetch commits/PRs (GitHub), issues worked (JIRA), and—if the user opts in—Slack messages. Writes `work_log_entries` with `status='auto-generated'`, `pending_review=true`, and `log_source_references`. Skip LLM calls entirely for weeks with 0 activity to optimize token usage. To prevent hitting Mistral rate limits, queue the sync tasks and throttle calls with concurrency limiting (e.g. `p-limit`) and exponential backoff retry logic. Client: `AutoLogReview.tsx` + a Dashboard "Ready for review" card (as specified in the prior plan). Gate all of this behind `integration_preferences.sync_enabled` + explicit opt-in (GDPR notes in the prior plan apply).

**Verify P4:** connect GitHub+JIRA, trigger a manual sync, confirm a `pending_review` draft with correct source references; edit+submit transitions status; reject deletes the draft.

---

## **Phase 5 — Slack notifications + slash commands**

**Notifications** (`server/src/lib/slackNotifier.ts`, called from goal/assignment events and a digest job): goal assigned → DM the assignee (falling back to email notifications via Brevo if the user is unmapped or has notifications disabled); weekly **manager digest** (`server/src/jobs/goalDigestJob.ts`) → channel/DM summary of team progress + at-risk goals; reminder nudges. Uses the org bot token (`decryptSecret`) and `slack_user_links` for DM targeting; resolves unmapped users by email via `users:read.email`.

**Slash commands** `server/src/routes/webhooks/slack.ts`: verify signature → map `(team_id, user_id)` → app user via `slack_user_links`. If unmapped, return an ephemeral Slack message with a secure link directing the user to `/integrations/slack/link` in the web application. This link must contain a short-lived, signed token (JWT) containing their Slack user and team IDs. It requires the user to log in/be logged in to authenticate their identity and verify the token signature before linking their Slack ID to prevent security hijacking (do **not** automatically trust or link users based on matching emails from Slack's `users.info` without authentication, and do **not** accept unsigned, plain query parameters to prevent CSRF/forgery). Once mapped: **ack within 3s** (`200` + ephemeral "working…") → do work async and POST to `response_url`.

Commands:
* `/worklog` (show/create this week's entry)
* `/goals` (lists active goals and progress using Slack **Block Kit interactive components** like select menus/modals for a premium, mobile-friendly UX, avoiding raw UUID typing. Fallback lists goals numbered `1`, `2`, `3` to allow index-based reference. The server caches this list in a short-lived PostgreSQL table `slack_command_sessions` to support index lookup).
* `/goals <index/id> <n>%` (record a `goal_update`, `recomputeGoalProgress`, reply). Resolve index using the PostgreSQL session table. All mutations re-check `canEditGoal` and verify that the target goal's `progress_mode === 'manual'`. Reject progress updates for automated goals. Dedupe via `integration_events` on `trigger_id`/`event_id`.

**Verify P5:** assign a goal → assignee gets a Slack DM; run `/goals` in Slack → see live progress; `/goals <id> 50%` → progress updates in-app; manager digest posts on schedule (use `runNow()`).

---

## Critical files

**New (server):** `lib/crypto.ts`, `lib/webhookSecurity.ts`, `lib/jiraAdapter.ts`, `lib/githubAdapter.ts`, `lib/githubApp.ts`, `lib/slackAdapter.ts`, `lib/slackNotifier.ts`, `lib/activityNormalizer.ts`, `lib/autoLogSynthesizer.ts`; `services/authz.ts`, `services/teamService.ts`, `services/goalService.ts`; `routes/organizations.ts`, `routes/teams.ts`, `routes/goals.ts`, `routes/integrations/{jira,github,slack}.ts`, `routes/webhooks/{github,jira,slack}.ts`; `jobs/{weeklySyncJob,goalRollupJob,goalDigestJob}.ts`.
**Modified (server):** `index.ts` (raw-body parsers before global json; register routers; start jobs), `middleware/auth.ts` (export `requireOrgRole`/`requireTeamRole` or import from authz), `lib/supabase.ts`/`database.ts` (no change beyond reuse).
**New (client):** `lib/{teamsApi,goalsApi,integrationsApi}.ts`; `pages/{Goals,TeamGoals,OrgSettings,Integrations,AutoLogReview}.tsx`; `components/{goals,teams,integrations}/*`; `hooks/useTeamRole.ts`, `hooks/useGoals.ts`.
**Modified (client):** `App.tsx` (routes), `components/Layout.tsx` (nav), `pages/Dashboard.tsx` (review card), `locales/en/base.json` (i18n keys).
**DB:** `supabase-migrations/2026-06-16_teams_goals_integrations.sql`.

## Environment variables (add to `server/.env.example`)
`INTEGRATION_ENCRYPTION_KEY` (32-byte key: 64-character hex or 44-character base64 string, supporting comma-separated list for key rotation), `OAUTH_STATE_SECRET` (or reuse `JWT_SECRET`), `JIRA_CLIENT_ID/SECRET/REDIRECT_URI`, `GITHUB_CLIENT_ID/SECRET/REDIRECT_URI`, `GITHUB_APP_ID/PRIVATE_KEY/WEBHOOK_SECRET` (ensure private key handles multi-line PEM newline formatting), `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET/REDIRECT_URI`, `WEEKLY_SYNC_HOUR=9`, `SYNC_JOB_TIMEOUT_MS=300000`. Deploy: client→Vercel (`./client`), server→Railway (`./server`), DB→Supabase (run migration in SQL editor); register OAuth redirect + webhook URLs for localhost and the deployed server.

## End-to-end verification
Per-phase checks listed above. Whole-feature smoke test: provision org → build a team tree → manager assigns a cascading goal with KRs and a linked GitHub PR → merge the PR (webhook updates progress) → weekly sync drafts a worklog from JIRA+GitHub activity → assignee gets a Slack DM and updates progress via `/goals` → manager digest reflects the roll-up. Run `npm run typecheck`, `npm run lint`, and `npm run build` clean throughout. Codex review at end of each response per CLAUDE.md.
