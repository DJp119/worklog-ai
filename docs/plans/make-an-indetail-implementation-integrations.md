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
- `goal_key_results(id, goal_id→goals ON DELETE CASCADE, title, metric_type, start_value numeric default 0, target_value numeric NOT NULL, current_value default 0, unit, weight numeric default 1 CHECK (weight >= 0), sort_order, timestamps)` — **`start_value` and `weight` are model fixes** required by the progress formula, and `target_value` is `NOT NULL` to prevent division-by-zero or null propagation.
- `goal_links(id, goal_id→goals ON DELETE CASCADE, provider jira|github, link_type, external_id, external_key, external_url, title, state, is_done bool, weight numeric default 1 CHECK (weight >= 0), created_by→users, org_id→organizations ON DELETE CASCADE, metadata jsonb, timestamps, unique(goal_id,provider,external_id))` + index `(provider, external_id)`. Composite FK `(goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE` is required for tenant isolation. **`created_by` + `org_id` are model fixes** that make webhook routing O(1) and safe. `external_id` for GitHub **must** store the globally unique and immutable GraphQL `node_id` (not the repository name/PR number string) to prevent links from breaking on repository rename or transfer, and for JIRA, `external_id` must store the immutable numeric issue ID (not the mutable key) to prevent broken links on issue moves.
- `goal_updates(id, goal_id→goals ON DELETE CASCADE, user_id→users, progress, status, note, created_at, org_id→organizations ON DELETE CASCADE)` + composite FKs: `(goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE` and `(org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE`.

**Integrations** (extend existing where named)
- Reuse `user_integrations` from the prior plan (per-user JIRA + GitHub). Add `jira` to its provider CHECK and ensure `access_token`/`refresh_token` columns store ciphertext (see crypto). Add `is_refreshing BOOLEAN DEFAULT false` and `refresh_started_at TIMESTAMPTZ` columns to support lock-free refresh serialization and proactive refresh tracking. Re-use existing `token_expires_at` column instead of adding a duplicate `expires_at` column.
- Modify `integration_preferences` to add a `sync_timezone TEXT DEFAULT 'UTC'` column (renamed from `timezone` to avoid PostgreSQL reserved keyword and function namespace conflicts) and a `last_weekly_sync_week TEXT DEFAULT NULL` column to support localized, catch-up weekly sync scheduling.
- Reuse `integration_sync_logs`, `log_source_references`.
- New `org_integrations(id, org_id→organizations ON DELETE CASCADE, provider slack|github_app|jira, external_install_id, bot_token_enc, access_token_enc, refresh_token_enc, expires_at timestamptz, webhook_secret, config jsonb, installed_by→users, is_active bool, is_refreshing bool default false, refresh_started_at timestamptz, timestamps, unique(org_id,provider), unique(provider,external_install_id))` + single-column FK `installed_by REFERENCES users(id) ON DELETE SET NULL` (to avoid blocking admin deletions). Note that for JIRA, `org_integrations` stores the tenant's JIRA Cloud site connection (Atlassian `cloudId` stored in `external_install_id`) and its shared webhook secret, as well as encrypted access/refresh tokens and token expiration.
- New `slack_user_links(id, org_id→organizations ON DELETE CASCADE, user_id→users ON DELETE CASCADE, slack_user_id, slack_team_id, unique(slack_team_id,slack_user_id), unique(org_id,user_id))` — a user should have at most one Slack link per organization to support multi-tenancy, plus composite FK `(org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE`.
- New `slack_command_sessions(slack_team_id, slack_user_id, index_number int, goal_id→goals ON DELETE CASCADE, org_id→organizations ON DELETE CASCADE, expires_at timestamptz, pk(slack_team_id, slack_user_id, index_number))` — temporary database storage to resolve Slack CLI fallback indexes without introducing a Redis dependency, plus composite FK `(goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE` for tenant isolation.
- New `integration_events(id, provider, external_event_id, event_type, payload jsonb, status received|processing|done|error, error, received_at, processed_at, updated_at timestamptz default now(), unique(provider,external_event_id))` — webhook idempotency/audit. Internal table; must not be exposed to frontend.

**Triggers / functions**
- `team_closure_after_insert()` (AFTER INSERT): self row + parent's ancestors paths.
- `teams_parent_cycle_guard()` (BEFORE INSERT OR UPDATE OF parent_team_id): cycle guard (RAISE EXCEPTION if `NEW.parent_team_id = NEW.id` or if `NEW.parent_team_id` is a descendant of `NEW.id` by checking `EXISTS (SELECT 1 FROM team_closure WHERE ancestor_id = NEW.id AND descendant_id = NEW.parent_team_id)`).
- `team_closure_after_reparent()` (AFTER UPDATE OF parent_team_id): only runs if `NEW.parent_team_id IS DISTINCT FROM OLD.parent_team_id`. Cuts old-ancestor↔subtree edges. If `NEW.parent_team_id IS NOT NULL`, stitches new-ancestor × subtree with `super.depth+sub.depth+1` (otherwise only cuts for root-level reparenting).
- `viewable_user_ids(p_user_id, p_org_id)` SQL function (RPC) — the closure+membership query the API calls (see authz).
- `verify_team_department_org()` (BEFORE INSERT OR UPDATE ON teams): validates that the department's `org_id` matches the team's `org_id`.
- `verify_goal_relations_org()` (BEFORE INSERT OR UPDATE ON goals): validates that `parent_goal_id`, `team_id`, and `department_id` share the goal's `org_id`.
- `goal_progress_recomputation_trigger` (AFTER INSERT OR UPDATE OR DELETE ON goal_key_results, goal_links, and goals): automatically triggers progress calculations (`recomputeGoalProgress`) inside the database to prevent concurrent lost updates in Node. To support automatic progress cascading, the trigger on `goals` must fire `AFTER INSERT OR UPDATE OF progress, parent_goal_id, progress_mode, rollup_weight OR DELETE ON goals`. The trigger function must check if the value of `progress` actually changed (or structural columns changed, or a goal was inserted/deleted), and if the parent goal is NOT NULL, call `recomputeGoalProgress` for the parent goal to propagate progress changes upward. Since propagation is strictly upward and the graph is a tree (acyclic), this terminates safely without infinite recursion. When a goal is reparented or deleted, the trigger must recompute progress for both the new parent (using `NEW.parent_goal_id` on INSERT/UPDATE) and the old parent (using `OLD.parent_goal_id` on UPDATE/DELETE) to prevent stale calculations, using conditional checks on `TG_OP` to safely avoid NULL record pointer errors during delete and insert operations.
- `goals_parent_cycle_guard()` (BEFORE INSERT OR UPDATE OF parent_goal_id): recursive CTE rejecting cycles, including a table check constraint `CHECK (parent_goal_id <> id)`.
- `prevent_org_id_mutation()` (BEFORE UPDATE OF org_id on teams, departments, goals, etc.): blocks modifying `org_id` to guarantee tenant isolation (must check `IF NEW.org_id IS DISTINCT FROM OLD.org_id` to prevent blocking updates where `org_id` remains unchanged).
- Reuse existing `update_updated_at_column()` trigger for `updated_at` on new tables.
- `provision_organization(name, slug, owner)` helper: creates org + owner `org_members` + root team + owner `team_members`; returns org id.
- RLS: `ENABLE ROW LEVEL SECURITY` + deny-all policies (e.g., `FOR ALL TO public USING (false)`) on all new tables to guarantee that the public REST API cannot bypass the Node server's authorization logic using the Supabase anon key/REST API.

### File: `shared/src/index.ts` (append types)

Mirror the SQL exactly. Add: `OrgRole`, `TeamRole`, `Organization`, `OrgMember`, `Department`, `Team`, `TeamMember`, `GoalScope`, `GoalStatus`, `GoalPeriod`, `ProgressMode`, `Goal`, `GoalKeyResult`, `GoalLink`, `GoalAssignee`, `GoalUpdate`, `GoalWithDetails` (goal + KRs + links + assignees), `IntegrationProvider`, `UserIntegration`, `OrgIntegration`, and request DTOs (`CreateGoalRequest`, `UpdateGoalRequest`, `CreateTeamRequest`, `AssignGoalRequest`, `LinkWorkItemRequest`). Keep alongside existing `ApiResponse<T>`, `WorkLogEntry`.

**Verify P0:** run the migration on a Supabase branch; `INSERT` an org via `provision_organization`; create nested teams and assert `team_closure` rows (self + ancestors); reparent a team with children and re-assert depths; attempt a cycle and confirm the exception. `npm run typecheck` passes with new shared types.

---

## Phase 1 — Goals + Team management (core feature, no integrations yet)

### Server

**`server/src/lib/crypto.ts`** (built now, used in P2) — `encryptSecret(plaintext): string` / `decryptSecret(packed): string` using AES-256-GCM, key from `INTEGRATION_ENCRYPTION_KEY` (32-byte hex or base64, validated at module load → fail fast). Support key rotation by prefixing the output with the first 8 hex characters of the active key's SHA-256 hash (`v1:<key_hash_prefix>:<iv_b64>:<tag_b64>:<ct_b64>`). When decrypting, find the matching key from the environment key list by hashing each key and matching the prefix, which ensures key rotation is position-independent and safe when new keys are added/reordered. Random 12-byte IV per call; `:` delimiter is safe vs base64. Include `makeOAuthState`/`verifyOAuthState` (HMAC over claims with `JWT_SECRET`, 10-min expiry) for CSRF.

**`server/src/services/authz.ts`** — the authorization core. Functions (all take a service-role `SupabaseClient`):
- `getUserOrgRole(db, userId, orgId): Promise<OrgRole|null>`
- `getEffectiveTeamRole(db, userId, teamId): Promise<TeamRole|null>` — **max** of direct team role, inherited admin/owner from any ancestor (via closure), and org owner/admin.
- `getViewableUserIds(db, userId, orgId): Promise<Set<string>>` — org admin/owner ⇒ all org members; else self + members of every team the user is a member of (role $\ge$ `member`), plus members of every managed team (role $\ge$ `manager`) and all descendants, via the `viewable_user_ids` RPC (single round trip).
- `canManageTeam`, `canViewUser`, `canEditGoal(db, userId, goalRow)` — First, check if the user is a member of the organization (`org_members`). If not, return false. Admin/owner can edit all. Else: created_by $\Rightarrow$ true only if individual-scope; team/dept-scope $\Rightarrow$ canManageTeam; individual self-goal assignee $\Rightarrow$ true for progress check-ins only. Org-scope goals require org admin.
- Rank maps + `orgRoleAtLeast`/`teamRoleAtLeast`.
- Express middleware `requireOrgRole(min)` / `requireTeamRole(min)` reading `req.params`/`req.body`, failing **closed** (try/catch ⇒ 500, never `next()` on error), memoizing the resolved role on `req`.

**`server/src/services/teamService.ts`** — `createOrg`, `createDepartment`, `createTeam`, `moveTeam` — must lock the organization row `SELECT ... FOR UPDATE ON organizations WHERE id = orgId` before modifying parent relationships to prevent concurrent cycle creation. `deleteTeam` (guard: refuse if children exist unless `reparentChildrenTo` provided, enforced by database RESTRICT), `addMember`/`updateMemberRole`/`removeMember` (validate that the member being added is an active member of the organization `org_members` to prevent cross-tenant membership leaks, enforced at DB-level via composite foreign key constraints), `rebuildClosure(orgId)` (ops/repair via recursive CTE).

**`server/src/services/goalService.ts`** — CRUD for goals/KRs/assignees/updates. Enforce that manual progress updates can only occur when `progress_mode === 'manual'`, and block mixing child goals and key results/links on the same goal (validation on create/update). Reject progress updates if the goal has child goals.
- `setParent` (lock the organization row `SELECT ... FOR UPDATE ON organizations WHERE id = orgId` before modifying parent relationships to prevent concurrent cycle creation, run cycle-guard CTE before write, and trigger progress recomputation for both the **new** parent and the **old** parent `OLD.parent_goal_id` to prevent stale calculations).
- Goal deletion handler is managed automatically by the database `AFTER DELETE` trigger to trigger progress recomputation for the `parent_goal_id` of the deleted goal. Ensure `recomputeGoalProgress` handles the case where the target goal ID does not exist in the database (returning early without throwing an error) to allow parent goal deletion to succeed.
- **`recomputeGoalProgress(goalId, {db, visited})`**: Implemented inside a PostgreSQL function/trigger to ensure atomic updates and prevent concurrency race conditions (lost updates) in Node. If children exist ⇒ weighted avg of children (guarding against division by zero using `COALESCE(NULLIF(sum(rollup_weight), 0), 1)` if the sum of weights of child goals is 0); else by mode (manual=stored; key_results=weighted mean of `clamp01((current-start)/(target-start))` — guard against division by zero if sum of weights is 0 by returning `0.0`, and check if `target_value === start_value`, in which case return `1.0` if `current_value === target_value` else `0.0` (handling static goals and ensuring decreasing goal logic checks correctly), and then multiply by 100 before writing to the database; linked_items=if no links or sum of weights is 0 return `0.0` else `(sum(weight where is_done)/sum(weight)) * 100` to store as percentage); write only if changed; then walk **up** to `parent_goal_id` (cycle-safe via `visited` checks).

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

**`server/src/routes/integrations/jira.ts`** — `/api/integrations/jira/connect` (302 to Atlassian 3LO: scopes `read:jira-work read:jira-user offline_access`, signed `state`), `/callback` (exchange code, call `accessible-resources` for available sites. For org-level site selection, if multiple sites are returned, the server returns a short-lived signed state token containing the encrypted OAuth tokens and metadata, and redirects to a client site-selection page. The client queries a server `GET /api/integrations/jira/sites` endpoint passing this token to fetch the site list, avoiding large payload URLs. When a site is chosen, the client POSTs the selection and token back to `/api/integrations/jira/select`, where the server decrypts the tokens and saves them to `org_integrations` statelessly). For user-level connection, the callback must also fetch the user's personal JIRA `accountId` via `GET /rest/api/3/myself` and save it in `user_integrations.config` to support filtering issues. Handle **rotating refresh tokens** (store the new refresh token on every refresh; proactive refresh when `<60s` left) via shared `getJiraClient(userId)` and `getJiraClientForOrg(orgId)` helpers in `server/src/lib/jiraAdapter.ts`. To prevent token reuse revocation under concurrent requests, serialize refreshes using an atomic state update (`UPDATE user_integrations SET is_refreshing = true, refresh_started_at = NOW() WHERE id = $id AND (is_refreshing = false OR refresh_started_at < NOW() - INTERVAL '30 seconds') RETURNING *` for users, and a corresponding atomic update on `org_integrations` for org-level connections) to act as a lock. This avoids holding open database transactions/locks across external network calls (which causes pool exhaustion). If 0 rows are updated, wait and retry. Upon retrying, first check if `expires_at` is already in the future (indicating another process completed the refresh), and if so, return the active token immediately. If it still needs a refresh, perform the Atlassian API call outside any database transaction, then save the new tokens and clear `is_refreshing = false` in a quick write transaction. If the call fails, reset `is_refreshing = false`. Wrap the refresh API call in a try-catch; on permanent token rejection (e.g. revoked/expired with `invalid_grant` error), set `is_active = false` on the integration row and log a user/admin notification. For transient errors (e.g., timeouts, 5xx server errors, rate limits), throw the error to retry later without disabling the integration.

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

**`server/src/lib/webhookSecurity.ts`** — `verifyGithubSignature(raw, header, secret)` (HMAC-SHA256, secret = app-global `GITHUB_APP_WEBHOOK_SECRET`), `verifySlackSignature(raw, ts, sig, SLACK_SIGNING_SECRET)` (v0 base string + 5-min skew), and `verifyJiraWebhook(raw, header, secret)` (HMAC-SHA256). To perform absolute timing-safe comparisons and prevent unhandled `RangeError` crashes from Node's `crypto.timingSafeEqual` (which throws when buffers differ in length), hash both the computed and received signature buffers using SHA-256 first before passing them to `timingSafeEqual`. This guarantees that both buffers have the exact same length (32 bytes) regardless of the input, eliminating both `RangeError` and any timing leaks. JIRA webhooks are manually configured in the JIRA admin console (as OAuth `read:jira-work` scopes do not allow dynamic webhook creation). The web UI displays the unique webhook URL (with `org_id` query parameter) and the generated secret. JIRA sends the HMAC-SHA256 signature in the `x-hub-signature` (or `x-hub-signature-256`) header, which the server verifies against `org_integrations.webhook_secret` to keep secrets out of URL queries.
`recordEvent(provider, externalEventId, type, payload)` → `INSERT ... ON CONFLICT (provider, external_event_id) DO UPDATE SET status = EXCLUDED.status, payload = EXCLUDED.payload WHERE integration_events.status = 'error' OR (integration_events.status = 'processing' AND integration_events.updated_at < NOW() - INTERVAL '5 minutes') RETURNING id`. If no row is inserted/updated (indicating a duplicate event already processing or done) ⇒ ack 200 and stop. The check for events stuck in `'processing'` for over 5 minutes ensures recovery and reprocessing if a server worker crashes. Add a daily cron job to prune `integration_events` older than 30 days.

**Linking endpoint** `POST /api/goals/:goalId/links` (gated by `canEditGoal`): resolve the actor's `user_integrations` token; parse `external_url` → key/id; fetch current state (JIRA `GET /rest/api/3/issue/{id}?fields=status`, done = `statusCategory.key==='done'`; GitHub `GET /repos/{o}/{r}/pulls/{n}`, done = `merged` — store the globally unique GraphQL `node_id` or `owner/repo#number` as the `external_id`, **not** the simple PR number, to avoid collisions across different repositories in the organization, and store the immutable numeric issue ID as JIRA's `external_id` to prevent broken references when keys change); upsert `goal_links` (with `created_by`, `org_id`); `recomputeGoalProgress`.

**Webhook routes** `server/src/routes/webhooks/github.ts` + `jira.ts`: verify signature → `recordEvent` (idempotent) → resolve organization. For GitHub, resolve the organization via the `installation.id` in the webhook payload. For JIRA, resolve the organization directly using the `org_id` query parameter configured in the JIRA webhook URL. Load the corresponding `webhook_secret` to verify the signature, and then run `UPDATE goal_links SET is_done,state WHERE provider=$p AND external_id=$id AND org_id=$resolvedOrg RETURNING goal_id` (using `RETURNING goal_id` to get affected goal IDs in a single query; org scoping prevents cross-org tampering even on id collisions — updates are **tokenless**, matched purely on `(provider, external_id)`) → `recomputeGoalProgress` per affected goal. In batch updates, deduplicate and topologically sort goal updates (leaf to root) to avoid redundant recalculation and write contention. Process inside `mdc.run({jobRunId, jobName:'webhook:'+provider})`; on error mark event `error` but still ack 200 (avoid infinite retries); nightly job heals drift.

**`server/src/jobs/goalRollupJob.ts`** — class singleton, cron, full per-org recompute sweep; started in `index.ts`. To successfully heal drift without hitting API rate limits, the job **must batch queries**: use JQL searches (`id IN (...)` up to 50 items/request) for Jira and batched GraphQL node queries for GitHub using org-level installation tokens (falling back to pooled active user tokens if needed) to refresh the status of active external links before running progress recalculation.

**Client:** `LinkWorkItemModal.tsx` on `GoalCard` (paste JIRA/GitHub URL); show linked items + live state on the goal detail view.

**Raw-body capture:** route-specific middleware (`express.json({verify})`) to preserve bodies for signature verification.

**`server/src/lib/webhookSecurity.ts`** — `verifyGithubSignature`, `verifySlackSignature`, `verifyJiraWebhook`. Hash both the computed and received buffers with SHA-256 before `timingSafeEqual` to ensure 32-byte length and avoid `RangeError`.

**Linking endpoint** — `POST /api/goals/:goalId/links`. Resolve via `node_id` (GitHub) or numeric ID (JIRA).

**Webhook routes** — `github.ts`, `jira.ts`. `recordEvent` with `ON CONFLICT` deduplication. `recomputeGoalProgress` after status updates.

**Verify P3:** link JIRA/GitHub; update status via webhook; verify idempotency and tenant isolation.

---

## Phase 4 — Auto-populate weekly worklogs (extends the prior plan)

**`server/src/jobs/weeklySyncJob.ts`** (runs hourly):
- Uses validated timezone name directly with `AT TIME ZONE` (validity verified at API boundaries on write rather than slow system view queries).
- Uses exclusive upper bound JQL: `updatedDate >= 'YYYY-MM-DD' AND updatedDate < 'YYYY-MM-DD'` (Monday of following week).
- Acquires lock-free status via `is_syncing` database lock or uses connection-level `pg_try_advisory_lock` hashed by user_id to bigint (e.g. `('x' || substr(md5(user_id::text), 1, 16))::bit(64)::bigint`) to avoid holding open transactions during network calls.
- Restricts GitHub activity fetching to repositories owned by the organization or allowed by the GitHub App installation.

**Verify P4:** connect GitHub+JIRA, trigger a manual sync, confirm a `pending_review` draft with correct source references; edit+submit transitions status; reject deletes the draft.

---

## Phase 5 — Slack notifications + slash commands

**Notifications** — `slackNotifier.ts`, `goalDigestJob.ts`.

**Slash commands** — `webhooks/slack.ts`. Parses URL-encoded Block Kit payloads. Authenticated Slack-to-app mapping via signed JWT (includes `org_id` to prevent cross-tenant hijacking). Uses `slack_command_sessions` (cleared on new batch) for index-based reference.

**Commands:** `/worklog`, `/goals`, `/goals <index/id> <n>%`.

**Verify P5:** assign a goal → assignee gets a Slack DM; run `/goals` in Slack → see live progress; `/goals <id> 50%` → progress updates in-app; manager digest posts on schedule.

---

## Plan Review: Identified Mistakes & Corrections

1. **Slack Command Session Collision (Security Vulnerability):**
   - *Original:* The `slack_command_sessions` table used `pk(slack_user_id, index_number)`.
   - *Correction:* Primary-key on `(slack_team_id, slack_user_id, index_number)` for workspace isolation.

2. **Trigger Infinite Recursion vs. Progress Cascade (Postgres Bug):**
   - *Original:* The progress trigger on `goals` was restricted to fire only on structural columns.
   - *Correction:* Fire `AFTER UPDATE OF progress, parent_goal_id, progress_mode, rollup_weight ON goals`. The trigger function checks if the `progress` value actually changed and propagates.

3. **Orphaned Goal Deletion Failure (Postgres Bug):**
   - *Original:* Parent goal deletion would trigger `recomputeGoalProgress` on its child goals, which in turn calls it on the already-deleted parent, potentially throwing errors.
   - *Correction:* `recomputeGoalProgress` checks for goal existence and returns early if missing.

4. **Integration Client Site Mapping (API Client Bug):**
   - *Original:* Only per-user `getJiraClient(userId)` was specified.
   - *Correction:* Added `getJiraClientForOrg(orgId)` to fetch org-level JIRA site connections.

5. **Token Refresh Concurrency for Org Integrations:**
   - *Original:* Locking and serialization during OAuth token refresh were only specified for `user_integrations`.
   - *Correction:* Applied the same atomic lock-free check (`is_refreshing`) to `org_integrations`.

6. **JIRA Webhook Configuration Clarification:**
   - *Correction:* Webhooks must be manually configured in JIRA console; UI displays URL and `webhook_secret` query parameters.

7. **Slack Block Kit Action Payload Parsing:**
   - *Correction:* Slack interactive component payloads sent as URL-encoded `payload` strings are now explicitly decoded/parsed.

8. **Missing JIRA User Mapping for Weekly Sync:**
   - *Correction:* Added requirement to fetch personal JIRA `accountId` (via `GET /rest/api/3/myself`) to allow issue filtering.

9. **Key Rotation Decryption Failure (Cryptographic Bug):**
   - *Correction:* Replaced index-based key rotation prefix with a position-independent `v1:<key_hash_prefix>:...` identifier.

10. **Slack Command Session Index Bloat/Staleness:**
    - *Correction:* Added requirement to delete all existing session records for the active `(slack_team_id, slack_user_id)` before inserting a new batch.

11. **Multi-Instance Race Conditions on Weekly Sync:**
    - *Correction:* Added PostgreSQL advisory locking (`pg_try_advisory_xact_lock`) for each user ID.

12. **JIRA Webhook Secret Exposure (Security Vulnerability):**
    - *Correction:* Replaced query-token verification with HMAC-SHA256 signature verification of `x-hub-signature`.

13. **Imprecise Date Boundaries in Weekly JQL Queries:**
    - *Correction:* Specified exact ISO date boundaries with exclusive upper bound for JQL queries.

14. **OAuth Token Expiration Column Omissions:**
    - *Correction:* Added `expires_at TIMESTAMPTZ` to both `user_integrations` and `org_integrations`.

15. **Reserved Keyword Conflict for Timezone Column:**
    - *Correction:* Renamed to `sync_timezone`.

16. **JIRA JQL Date Range Query Exclusion (Jira API Bug):**
    - *Correction:* Changed to exclusive upper bound `updatedDate < 'YYYY-MM-DD'` where the date is the following Monday.

17. **PostgreSQL Trigger Variable Safety (`TG_OP` Checks):**
    - *Correction:* Added `TG_OP` conditional checks to access `NEW` only for `INSERT/UPDATE` and `OLD` for `DELETE/UPDATE`.

18. **PostgreSQL `BEFORE UPDATE OF org_id` Trigger Bug:**
    - *Correction:* Trigger only fails if `NEW.org_id IS DISTINCT FROM OLD.org_id`.

19. **Database Crash on Invalid Timezone Name:**
    - *Correction:* Implemented safe timezone verification via `COALESCE((SELECT name FROM pg_timezone_names WHERE name = sync_timezone LIMIT 1), 'UTC')`.

20. **Admin Deletion Blocked by Composite FK (`org_integrations`):**
    - *Correction:* Replaced with single-column FK `installed_by REFERENCES users(id) ON DELETE SET NULL`.

21. **GitHub Activity Privacy/Security Leak:**
    - *Correction:* Added restriction to only fetch activity for repositories owned by the organization or allowed by the GitHub App installation.

22. **Redundant Concurrent Token Refreshes:**
    - *Correction:* Added a pre-refresh check to see if `expires_at` is already in the future.

23. **Tenant Isolation in Slack Command Sessions:**
    - *Correction:* Added `org_id` column to `slack_command_sessions` with composite FK `(goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE`.

24. **Goals Cycle Guard on INSERT:**
    - *Correction:* Trigger now fires `BEFORE INSERT OR UPDATE OF parent_goal_id ON goals`.

25. **Slack Linking JWT Verification Security:**
    - *Correction:* Added `org_id` to JWT and server-side verification check that the authenticated user is an organization member.

26. **UUID to Bigint Advisory Lock Type Mismatch (Database Bug):**
    - *Original:* The weekly sync job specifies acquiring `pg_try_advisory_xact_lock` using the user's UUID.
    - *Correction:* PostgreSQL advisory locks require a 64-bit bigint. Passing a UUID directly throws a type mismatch error. We must hash the UUID (e.g., using `('x' || substr(md5(user_id::text), 1, 16))::bit(64)::bigint`) before passing it to the lock.

27. **Transaction Pool Exhaustion in Weekly Sync (Architecture Bug):**
    - *Original:* Using `pg_try_advisory_xact_lock` (transaction-level lock) during the weekly sync job will hold database connections open while performing long-running external API calls, leading to connection pool exhaustion.
    - *Correction:* Use a lock-free status check in the database (e.g., `is_syncing` and `sync_started_at` in `integration_preferences`) or session-level advisory locks (`pg_try_advisory_lock` / `pg_advisory_unlock`) instead of transaction-level locks.

28. **Goal Progress Recalculation Omission on Insert (Cascading Progress Bug):**
    - *Original:* The progress cascading trigger on `goals` was only set to fire `AFTER UPDATE`. It did not fire on `AFTER INSERT` or `AFTER DELETE`.
    - *Correction:* The trigger on `goals` must fire `AFTER INSERT OR UPDATE OF progress... OR DELETE ON goals` to ensure parent progress is recalculated when a child goal is first created or deleted.

29. **Missing Column `updated_at` in `integration_events` Table (Schema Bug):**
    - *Original:* The `integration_events` table does not define `updated_at`, but the query uses it to check for stuck events.
    - *Correction:* Added `updated_at timestamptz DEFAULT NOW()` column to `integration_events`.

30. **Token Expiration Column Duplication in `user_integrations` (Schema Inconsistency):**
    - *Original:* The plan specifies adding `expires_at` to `user_integrations`, duplicating the existing `token_expires_at` column.
    - *Correction:* Reuse the existing `token_expires_at` column rather than adding a duplicate `expires_at` column.

31. **Timezone Query Performance (Performance Bug):**
    - *Original:* The scheduler queried `pg_timezone_names` view per-user to validate timezones in a loop.
    - *Correction:* Timezone validity must be verified at the API boundary on write, allowing the scheduler to safely execute timezone conversions using the stored string directly.

32. **Target Value Not Null Constraint (Schema Validation):**
    - *Original:* `target_value` was nullable in `goal_key_results`.
    - *Correction:* Constrain `target_value` to `NUMERIC NOT NULL` to prevent division-by-zero or null propagation bugs.

33. **Missing Lock on Goals Parent Modification (Race Condition Bug):**
    - *Original:* Goal reparenting did not lock the organization row, allowing concurrent cycles to be formed in the goal tree.
    - *Correction:* Lock the organization row via `SELECT ... FOR UPDATE ON organizations WHERE id = orgId` before modifying `parent_goal_id`.

---

## 🔴 Critical Bugs Found After Review

### Bug 1 — `viewable_user_ids` SQL function never defined (BLOCKING)
The migration file has a bullet: `viewable_user_ids(p_user_id, p_org_id)` SQL function (RPC) but **no CREATE FUNCTION body** is written anywhere in Phase 0. Both `authz.ts` and the trigger layer reference it. An empty migration will pass syntactically (bullets aren't SQL), and the implementer gets "function does not exist" at runtime.

**Correction:** Define the function in the migration. It returns all user IDs viewable by a given user in an org:
- Org admin/owner → all org members
- Otherwise → self + members of teams user is ≥ member of + members of descendant teams the user is ≥ manager of
```sql
CREATE OR REPLACE FUNCTION viewable_user_ids(p_user_id UUID, p_org_id UUID)
RETURNS SETOF UUID LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM org_members WHERE user_id = p_user_id AND org_id = p_org_id) THEN
    RETURN; -- not a member
  END IF;

  IF EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = p_user_id AND org_id = p_org_id AND role IN ('admin', 'owner')
  ) THEN
    RETURN QUERY SELECT user_id FROM org_members WHERE org_id = p_org_id;
    RETURN;
  END IF;

  RETURN QUERY
  WITH my_managed_teams AS (
    -- teams where user is admin/owner (can see all descendant members)
    SELECT descendant_id AS team_id
    FROM team_members tm
    JOIN team_closure tc ON tm.team_id = tc.ancestor_id
    WHERE tm.user_id = p_user_id AND tm.org_id = p_org_id
      AND tm.role IN ('admin', 'owner')
  ),
  my_member_teams AS (
    -- teams where user is a member (can see team members)
    SELECT team_id FROM team_members
    WHERE user_id = p_user_id AND org_id = p_org_id AND role = 'member'
  )
  SELECT DISTINCT tm2.user_id
  FROM (
    SELECT team_id FROM my_managed_teams
    UNION
    SELECT team_id FROM my_member_teams
  ) t
  JOIN team_members tm2 ON t.team_id = tm2.team_id AND tm2.org_id = p_org_id
  UNION SELECT p_user_id;
END;
$$;
```

### Bug 2 — JIRA OAuth `accountId` fetched with wrong API (runtime error)
Phase 2 says: *"fetch the user's personal JIRA `accountId` via `GET /rest/api/3/myself`"*. This endpoint **rejects OAuth 2.0 bearer tokens** — Atlassian requires Basic Auth or API token for `/rest/api/3/myself`. The `accountId` must be extracted from the **`id_token` JWT** returned by Atlassian in the token-exchange response. No API call needed.

**Correction:** In the JIRA OAuth callback:
```ts
const { id_token } = tokenResponse; // JWT from Atlassian
const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString());
const jiraAccountId = payload.sub || payload.account_id;
await db.update('user_integrations').set({ config: { accountId: jiraAccountId, cloudId } }).where(...)
```

### Bug 3 — GitHub webhook `installation.id` unverified against stored org (Security)
The plan resolves org via `installation.id` in the webhook payload but never verifies that the **authenticated webhook** matches the installation registered for that org. Without this, a webhook with a spoofed `installation.id` pointing to a valid org would pass through.

**Correction:** In `server/src/routes/webhooks/github.ts`, after resolving via `installation.id`:
```ts
const storedInstall = await req.supabase
  .from('org_integrations')
  .select('id, is_active')
  .eq('provider', 'github_app')
  .eq('external_install_id', installation.id)
  .eq('is_active', true)
  .single();

if (!storedInstall || storedInstall.org_id !== resolvedOrg.id) {
  logger.warn('GitHub webhook installation mismatch', { installationId: installation.id });
  return res.status(403).json({ error: 'Forbidden' }); // ack 200 + silent? or 403?
}
```

---

## 🟡 High Priority Issues

### Issue 4 — `user_integrations` provider CHECK must be DROPPED before ADD — cannot ALTER ADD VALUE
Phase 0 says *"modify `user_integrations` to add `jira` to the provider CHECK"*. You cannot `ALTER TABLE ... ADD VALUE` to a CHECK constraint. The prior plan wrote `CHECK (provider IN ('slack', 'github', 'gitlab'))`. Must rebuild explicitly:

```sql
ALTER TABLE user_integrations DROP CONSTRAINT IF EXISTS user_integrations_provider_check;
ALTER TABLE user_integrations ADD CONSTRAINT user_integrations_provider_check
  CHECK (provider IN ('slack', 'github', 'gitlab', 'jira'));
```

### Issue 5 — Duplicate verbatim content in Phase 3 (Bugs 17, 27 in review section refer to the same issue)
The block from `Raw-body capture (prerequisite):` (line ~157) through `**Verify P3:**` (line ~179) is **fully duplicated** at lines ~171-177 onward. Second copy must be deleted.

### Issue 6 — `org_integrations` JIRA = one site per org, not documented
`UNIQUE(org_id, provider)` means one JIRA site per org at the org level. If an org has two JIRA sites, only the first can be stored at org level. Add an explicit comment and document that multi-site orgs use per-user `user_integrations(provider='jira')` instead.

### Issue 7 — `goalRollupJob` has no per-org iteration; job does nothing as written
The job says *"batch queries, use org-level tokens"* but never specifies which organizations to process. Needs an explicit loop:

```ts
const activeOrgs = await db
  .from('goal_links').select('org_id')
  .groupBy('org_id');

for (const { org_id } of activeOrgs) {
  const lock = await db.raw(
    `SELECT pg_try_advisory_lock(?)`,
    BigInt('0x' + md5(org_id).substring(0, 16)) // session-level lock, releases after session
  );
  if (!lock.rows[0].pg_try_advisory_lock) continue;
  try {
    await syncOrgGoals(org_id);
  } finally {
    await db.raw(`SELECT pg_advisory_unlock(?)`, [lock.rows[0].pg_try_advisory_lock]);
  }
}
```

### Issue 8 — Trigger function bodies are unwritten — bullets are not SQL
Every trigger bullet (lines 71-82) has a behavior description but **no `CREATE FUNCTION ... LANGUAGE plpgsql` body**. Example — `team_closure_after_insert` must insert `(NEW.id, NEW.id, 0)` (self) and then, if `NEW.parent_team_id IS NOT NULL`, insert `SELECT ancestor_id, NEW.id, depth+1 FROM team_closure WHERE descendant_id = NEW.parent_team_id`. Write all bodies explicitly in the migration file.

---

## 🔵 Medium Priority Improvements

### Improvement 9 — `recomputeGoalProgress` missing decreasing goal case
Formula `clamp01((current - start) / (target - start))` only works for increasing goals. For "lower is better" (start > target): use `clamp01((start - current) / (start - target))`. Static goals where `start = target`: return `1.0` if `current = target`, else `0.0`. Both cases must be handled:

```sql
IF target_value = start_value THEN
  RETURN CASE WHEN current_value = target_value THEN 1.0 ELSE 0.0 END;
END IF;
IF target_value > start_value THEN
  -- increasing
  RETURN LEAST(GREATEST((current_value - start_value)::numeric
    / NULLIF(target_value - start_value, 0), 0), 1);
ELSE
  -- decreasing / "lower is better"
  RETURN LEAST(GREATEST((start_value - current_value)::numeric
    / NULLIF(start_value - target_value, 0), 0), 1);
END IF;
```

### Improvement 10 — Topological sort in batch goal updates not implemented
P3 says *"topologically sort goal updates (leaf to root)"* without specifying an algorithm. Without it, concurrent updates can cause deadlocks or stale intermediate progress states. Implement DFS-based topological sort in the webhook handler:

```ts
function topologicalSortLeafFirst(goalIds: Set<string>, getParent: (id: string) => string | null): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const parent = getParent(id);
    if (parent && goalIds.has(parent)) visit(parent);
    result.push(id); // parent is pushed after child = leaf-first
  }

  for (const id of goalIds) visit(id);
  return result.reverse(); // now leaf-first order
}
```

### Improvement 11 — `teamRoleAtLeast(null, min)` crashes — add null guard
If a user is not on a team, `role = null`. Integer comparison on null in `TEAM_ROLE_RANK[role]` returns `undefined` and comparison works by accident rather than design.

```ts
export function teamRoleAtLeast(role: TeamRole | null, min: TeamRole): boolean {
  if (role === null) return false;
  return TEAM_ROLE_RANK[role] >= TEAM_ROLE_RANK[min];
}
```

### Improvement 12 — `usersLookupByEmail` silently fails if Slack bot is uninstalled
If workspace admin revokes the Slack bot, `usersLookupByEmail` returns `user_not_found`. Plan should check `auth.test` first and disable the org integration on installation failure:

```ts
const authTest = await slackClient.auth.test();
if (!authTest.ok || authTest.team_id !== slackWorkspaceId) {
  await db.update('org_integrations').set({ is_active: false }).eq('org_id', orgId);
  await sendAdminNotification(orgId, 'Slack bot uninstalled — re-authorize required');
  throw new Error('Slack bot uninstalled');
}
```

### Improvement 13 — `requireOrgRole` and `requireTeamRole` chaining examples missing
Explicit examples of how to compose `requireAuth` + role middleware:

```ts
router.post('/', requireAuth, requireOrgRole('owner'), async (req, res) => { ... }); // create org
router.delete('/:orgId', requireAuth, requireOrgRole('owner'), deleteOrg);
router.post('/teams', requireAuth, requireTeamRole('admin'), createTeam); // team mutation
router.get('/:teamId/members', requireAuth, requireTeamRole('member'), listMembers); // anyone on team reads
```

### Improvement 14 — Goal listing loses all results when `getViewableUserIds` returns empty
When all a user's teams are deleted, `viewableUserIds = {}`. Their own individual goals and assigned goals are then invisible.

```sql
-- In goals.ts WHERE clause, add fallback:
AND (
  g.id IN (SELECT goal_id FROM goal_assignees WHERE user_id = $userId)
  OR g.created_by = $userId
  OR g.created_by = ANY($viewableUserIds)
  OR ga.user_id = ANY($viewableUserIds)
)
```

### Improvement 15 — GitHub App callback must verify `target_type = 'Organization'`
Storing a user-level GitHub App installation under an org would be incorrect.

```ts
const { data: installation } = await app.client.apps.getInstallation({
  installation_id: parseInt(installationId, 10)
});
if (installation.target_type !== 'Organization') {
  return res.redirect(`${FRONTEND_URL}/integrations?error=org_required`);
}
```

---

## 🟢 Minor / Editorial

### Note 16 — `Brevo` in plan matches codebase; CLAUDE.md says `Resend`
`server/src/lib/email.ts` uses `Brevo` (confirmed). The plan is correct. **CLAUDE.md should be updated:** change `Resend` → `Brevo` in the email section.

### Note 17 — Duplicate Phase 3 block (same as Issue 5 above)
Remove the second copy of `raw-body capture`, `Linking endpoint`, `Webhook routes` content at lines ~171-177.

### Note 18 — `integration_events` partial index for webhook deduplication queries
```sql
CREATE INDEX idx_integration_events_active
  ON integration_events(provider, external_event_id)
  WHERE status IN ('received', 'processing');
-- Partial index; 'done'/'error' rows excluded to keep index small
```

### Note 19 — Slack interactive `payload` field must be `JSON.parse`d
`req.body.payload` arrives as a string containing JSON, not a parsed object. Call `JSON.parse(req.body.payload)` before accessing fields.

### Note 20 — `org_integrations` missing explicit webhook routing indexes
```sql
CREATE INDEX idx_org_integrations_provider_install
  ON org_integrations(provider, external_install_id)
  WHERE provider IN ('github_app', 'slack');
CREATE INDEX idx_org_integrations_jira_org
  ON org_integrations(org_id, provider)
  WHERE provider = 'jira';
```

*Review completed 2026-06-16. Bugs 1-3 are blocking (runtime/compile errors or security). Issues 4-8 are high confidence structural fixes. Improvements 9-15 are quality/correctness enhancements. Notes 16-20 are minor.*

---

## Second Review Pass — Additional Findings (2026-06-16)

### 🔴 Bug A — **CORRECTION CONTRADICTS ITSELF** (Plan Review section — line 291 vs 295)
Items 11 and 27 in the Plan Review section directly contradict each other, and the contradiction is invisible because both are labeled "Correction":

- **Item 11 (line 291)**: *"Added PostgreSQL advisory locking (`pg_try_advisory_xact_lock`) for each user ID."* — transaction-level.
- **Item 27 (line 295)**: *"Use a lock-free status check... or session-level advisory locks (`pg_try_advisory_lock` / `pg_advisory_unlock`) instead of transaction-level locks."* — corrects item 11.

Item 11 is a **copy of the broken original plan decision** that should NOT be in the review section at all — it was the original architecture. Including it as Item 11 with "Correction:" prefix is misleading. An implementer reading sequentially could implement item 11's approach (transaction-level locks that hold connections during API calls), never noticing it was already contradicted at item 27.

**Fix:** Remove Item 11 from the review section. The session-level advisory lock approach at item 27 is the correct final state. The review section should only contain the 33 corrections derived from prior review passes — not a mix of original mistakes and corrections with no label distinguishing what is "original" vs "corrected."

---

### 🔴 Bug B — **My own `viewable_user_ids` function (written in Bug 1) uses wrong role threshold — managers excluded**
The SQL I wrote in **Bug 1** has a semantic error in the role check for descendant team visibility:

```sql
-- WRONG (what I wrote): uses 'admin', 'owner' only
my_managed_teams AS (
  SELECT descendant_id AS team_id
  FROM team_members tm
  JOIN team_closure tc ON tm.team_id = tc.ancestor_id
  WHERE tm.user_id = p_user_id AND tm.org_id = p_org_id
    AND tm.role IN ('admin', 'owner')  -- ← BUG: misses 'manager'
)
```

The architecture decision (line 36) clearly states: *"team descendant visibility is granted at role ≥ manager"*. The rank map is `{member:1, manager:2, admin:3, owner:4}`. A **manager** must be able to see descendants' team members. My function excludes them.

Additionally, my member teams check uses `role = 'member'` only. A **manager** on a specific team should also be able to see other members of that same team (role = member, via the member-teams branch). A manager who has no admin/owner status on any team would get zero results from the member check.

**Fix:** Correct the function:
```sql
-- CORRECTED
my_managed_teams AS (
  -- Admin/owner/manager: see all descendant team members
  SELECT descendant_id AS team_id
  FROM team_members tm
  JOIN team_closure tc ON tm.team_id = tc.ancestor_id
  WHERE tm.user_id = p_user_id AND tm.org_id = p_org_id
    AND tm.role IN ('manager', 'admin', 'owner')
),
my_member_teams AS (
  -- member/admin/owner/manager: see members of teams I'm directly on
  SELECT team_id FROM team_members
  WHERE user_id = p_user_id AND org_id = p_org_id
    AND role IN ('member', 'manager', 'admin', 'owner') -- all roles can see their team's members
)
```

---

### 🔴 Bug C — **`getEffectiveTeamRole` function algorithm not specified**
Phase 1 (line 100) describes the function output as the **max** of three role sources:
- Direct team role
- Inherited admin/owner from any ancestor team (via closure)
- Org owner/admin

But the algorithm for computing this max is nowhere in the plan. An implementer would have to derive it. It's non-trivial because it requires:
1. Query `team_members` for direct role on `teamId`
2. Query `team_closure` for all ancestor teams, join to `team_members` for those ancestors, find max role among them
3. Query `org_members` for org role

The correct implementation uses the numeric rank map: `Math.max(directRank, maxAncestorRank, orgRank)`. If any rank is null, treat as 0. The function should return `null` if the user is not on the team AND not org admin/owner (i.e., no access to this team at all).

**Fix:** Write the pseudocode in the `authz.ts` section:
```ts
async function getEffectiveTeamRole(
  db: SupabaseClient,
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
  // Must be org member to have any team access
  const orgId = await getOrgIdForTeam(db, teamId);
  if (!orgId) return null;
  const orgRole = await getUserOrgRole(db, userId, orgId);
  if (orgRole === 'admin' || orgRole === 'owner') return orgRole; // org escape hatch

  // Direct team role
  const direct = await db.from('team_members')
    .select('role').eq('user_id', userId).eq('team_id', teamId).single();

  // Ancestor team roles
  const ancestors = await db.from('team_closure tc')
    .select('tm.role')
    .join('team_members tm', 'tc.ancestor_id', 'tm.team_id')
    .where('tc.descendant_id', teamId)
    .where('tm.user_id', userId);

  const allRoles = [
    direct?.role,
    ...ancestors.map(r => r.role as TeamRole),
    orgRole as TeamRole | null,
  ].filter((r): r is TeamRole => r !== null && r !== undefined);

  if (allRoles.length === 0) return null;

  const ranks = allRoles.map(r => TEAM_ROLE_RANK[r]);
  const maxRank = Math.max(...ranks);
  return (Object.entries(TEAM_ROLE_RANK) as [TeamRole, number][])
    .find(([, v]) => v === maxRank)?.[0] ?? null;
}
```

---

### 🟡 Bug D — **`canEditGoal` check-in case doesn't verify assignees**
Line 102: *"individual self-goal assignee ⇒ true for progress check-ins only."*

The check-in path (updating progress via `goal_updates`) is gated by "individual self-goal assignee." But the described logic does not actually CHECK that the calling user is assigned to the goal. It only verifies:
1. User is org member
2. User is admin/owner OR (goal.created_by = user AND scope = 'individual') OR (team/dept scope ⇒ canManageTeam)

For "individual self-goal assignee," the plan says true for progress check-ins. But `goal.created_by = user` is NOT the same as being an ASSIGNEE. Someone could be assigned to a goal they didn't create. They should be able to check in even though `created_by ≠ userId`. The condition should check `goal_assignees.user_id = $userId`, not `created_by`.

**Fix:** Change the Phase 1 `canEditGoal` logic for the check-in case to:
```ts
// For progress check-ins (updates to goal_updates):
if (goal.scope === 'individual') {
  // Can check in if: you created it OR you are assigned to it
  return goal.created_by === userId ||
    await db.from('goal_assignees').select('goal_id')
      .eq('goal_id', goal.id).eq('user_id', userId).single() !== null;
}
```

---

### 🟡 Bug E — **Advisory locks have no expiry — crash orphans block future runs indefinitely**
Issue 27 corrected the lock type from `pg_try_advisory_xact_lock` (transaction-level) to `pg_try_advisory_lock` (session-level), which is correct. But session-level advisory locks have **no TTL** — if the Node process holding the lock crashes or is hard-killed, `pg_advisory_unlock` is never called. The lock persists until PostgreSQL detects the session is dead (typically on next query from that connection back to the pool), but in a pooling scenario (e.g., PgBouncer), the connection might be reused before PostgreSQL notices.

Additionally, the plan says to use a session-level advisory lock with `finally { pg_advisory_unlock }`, but there's **no lock acquisition timeout**. If two instances of the job try to lock the same org's goals simultaneously, one waits indefinitely.

**Fix:** Add explicit timeout handling:
```ts
const lockResult = await db.raw(
  `SELECT pg_try_advisory_lock(?) AS acquired`,
  [lockKey]
).timeout(5000); // 5-second timeout

if (!lockResult.rows[0].acquired) {
  logger.warn(`Could not acquire lock for org {} — another instance running`, orgId);
  continue; // skip this org, try next
}
```
Also document that a daily cleanup job should handle stale locks:
```sql
-- Run daily to release locks held by dead sessions
SELECT pg_advisory_unlock(key)
FROM (
  SELECT key, pid FROM pg_locks WHERE locktype = 'advisory'
    AND granted AND NOT EXISTS (
      SELECT 1 FROM pg_stat_activity WHERE pid = pg_locks.pid AND state = 'active'
    )
) dead WHERE EXTRACT(EPOCH FROM NOW() - query_start) > 3600;
```

---

### 🟡 Bug F — **JIRA `accessible-resources` returns MULTIPLE sites — plan doesn't handle**
Phase 2 says: "call `accessible-resources` for available sites." The Atlassian `GET /rest/api/2/accessible-resources` endpoint returns **all JIRA sites** the authenticated user has access to — potentially multiple, across multiple organizations. For org-level JIRA (one site per org), the plan assumes exactly one site. But if the org admin has access to 3 JIRA sites and calls `accessible-resources`, the plan doesn't specify which `cloudId` to store in `org_integrations`.

Additionally, the user-level JIRA connection also calls `accessible-resources` (for cloudId) — but if multiple sites are returned, which one is the user's "personal" JIRA?

**Fix:** For org-level:
- If exactly 1 site: auto-select
- If multiple: show site selection UI (this is already described for some flows), require admin to pick
- If 0: show error "No JIRA sites found"

For user-level:
- Store ALL accessible `cloudId` values in `user_integrations.config.cloudIds[]` (array)
- When listing user issues, iterate all clouds
- When linking to a goal, the user specifies which JIRA site the issue comes from

---

### 🟡 Bug G — **GitHub App callback WITHOUT `state` payload — installation_id still available**
Line 145 says: *"If the app installation is initiated directly from GitHub without a `state` payload, redirect the logged-in user to an organization linking page in the client."*

But GitHub's OAuth callback for GitHub Apps **always includes `installation_id`** in the URL query parameter, even when no `state` was passed. We can look up the installation via GitHub's API (`GET /app/installations/{installation_id}`) to get the account (org) name, then match it against our `organizations` table by slug or name. This should be attempted before redirecting to a "link org" page, reducing user friction.

**Fix:** Update `server/src/lib/githubApp.ts` callback:
```ts
const installationId = req.query.installation_id;
if (!state && installationId) {
  // GitHub ALWAYS passes installation_id in the callback URL
  const { data: installation } = await app.client.apps.getInstallation({
    installation_id: parseInt(installationId, 10)
  });
  if (installation.target_type === 'Organization') {
    // Try to auto-match by org slug
    const org = await db.from('organizations')
      .select('id').ilike('slug', installation.account.login.toLowerCase())
      .single();
    if (org) {
      // Store installation.id under matched org
      await storeInstallation(org.id, installation);
      return res.redirect(`${FRONTEND_URL}/integrations?github_connected=true`);
    }
  }
}
// Fallback to manual org linking
return res.redirect(`${FRONTEND_URL}/integrations/link-github?installation_id=${installationId}`);
```

---

### 🟡 Bug H — **`department_id` unique constraint is wrong**
Line 49: `departments(id, org_id, name, UNIQUE(id, org_id))` — this is a no-op. `UNIQUE(id, org_id)` where `id` is the PRIMARY KEY of the same table means `(id, org_id)` is unique whenever `id` is unique, which is always since `id` is the PK. This constraint adds nothing.

The actual intent is probably to enforce UNIQUE `(org_id, name)` within an organization (no duplicate department names). But the plan doesn't specify this at all, leaving the unique department name constraint missing entirely.

**Fix:** Replace with:
```sql
UNIQUE(org_id, name)  -- one department name per org
```
And add: `CHECK (name <> '')` to prevent empty names.

---

### 🟡 Bug I — **JIRA webhook event types not specified — could process wrong events**
Phase 3 webhook processing for JIRA at line 165 says "update goal_links based on status change." But JIRA sends many webhook event types (e.g., `jira:issue_updated`, `comment_created`, `issuelink_created`). The plan doesn't filter by event type. If JIRA sends ANY event (even a comment edit), it would trigger a goal link update. JQL queries might also produce stale results.

The `integration_events` table has `event_type` but the plan never specifies which `event_type` values to accept for JIRA vs GitHub. Processing all events wastes resources; some could corrupt `goal_links` state.

**Fix:** Explicitly specify allowlist per provider:
```ts
// jira.ts webhook
const ALLOWED_EVENTS = new Set([
  'jira:issue_updated',    // status field changed
  'jira:issue_created',    // for future auto-linking
  'issuelink.created',     // for issuelink type goals
  'worklogcreated',        // for time-tracking goals
]);
if (!ALLOWED_EVENTS.has(event.type)) {
  return res.status(200).json({ skipped: true });
}
// For jira:issue_updated: also check that 'status' field changed
// (check fieldNames in the webhook payload's changelog)
```

---

### 🟢 Issue J — **Slack OAuth scopes: comma vs space delimited**
Line 143 says scopes: `chat:write,commands,users:read,users:read.email`

Slack's OAuth 2.0 `scope` parameter expects **space-separated** strings. Passing a comma-separated list (as shown) will cause Slack's OAuth server to reject the request with `invalid_scope`. The comma format shown in the plan is not valid Slack API syntax.

**Fix:** Update to space-separated:
```ts
scopes: 'chat:write commands users:read users:read.email'
```

---

### 🟢 Issue K — **`goalRollupJob` for JIRA — no handling of rate limits or 404s on per-issue fetch**
Line 167: "batch queries: JQL `id IN (...)` up to 50 items/request for JIRA." If even one issue in the batch is deleted or the user lost access to it, JIRA returns a partial response with some successful and some 404 errors. The plan doesn't specify graceful handling. A single missing issue should not cause the entire batch to fail.

**Fix:** In the rollback job, validate each result in the batch; skip and log items that return 404, don't abort the whole batch:
```ts
for (const linked of activeLinks) {
  const jiraIssue = await getJiraIssue(jiraClient, linked.external_id); // may 404
  if (jiraIssue === null) {
    await markLinkStale(linked.id, 'issue_deleted_or_inaccessible');
    continue;
  }
  // process normally
}
```

---

### 🟢 Issue L — **`metric_type` field on `goal_key_results` — defined but never used**
Line 57 includes `metric_type` in `goal_key_results`. This field implies there are different metric types (e.g., `percentage`, `currency`, `number`, `boolean`). The `recomputeGoalProgress` function at line 112 uses a uniform formula `clamp01((current-start)/(target-start))`. This formula doesn't account for different metric types. For a `boolean` metric (0 or 1), the formula degenerates to `clamp01((0-0)/(1-0)) = 0` for false, `clamp01((1-0)/(1-0)) = 1` for true — which happens to work. But for `currency` or `number`, the formula is correct. For `percentage`, you might double-count (treating 50% as the target, not the unit).

The plan defines `metric_type` but never specifies its enum values or how the progress function branches on it.

**Fix:** Add explicit `metric_type` enum and branching in progress calculation:
```sql
ALTER TABLE goal_key_results ADD COLUMN metric_type TEXT DEFAULT 'number'
  CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean', 'ratio'));
```

And in `recomputeGoalProgress`:
```sql
CASE metric_type
  WHEN 'boolean' THEN
    CASE WHEN current_value = 1 THEN 1.0 WHEN target_value = 1 THEN 0.0 ELSE 0.5 END
  WHEN 'percentage' THEN
    -- current/target interpreted as 0-100, not 0-1
    LEAST(GREATEST(current_value / NULLIF(target_value, 0), 0), 1)
  WHEN 'currency' THEN  -- same as number
    clamp_formula...
  ELSE  -- number / ratio / default
    clamp_formula...
END
```

---

### 🟢 Issue M — **`departments` table: no unique name constraint per org**
Line 49 creates `departments` but doesn't enforce that two departments in the same org can't share the same name. An org admin could create "Engineering" twice. The teams table has no such constraint either (line 50 only has `UNIQUE(id, org_id)` which is a no-op).

**Fix:** `ALTER TABLE departments ADD UNIQUE(org_id, name)`.

---

## Third Review Pass — Security, Concurrency, and Integration Audit (2026-06-16)

### 🔴 Bug N — **Inherited Non-Managerial Team Roles in `getEffectiveTeamRole` (Privilege Escalation)**
Phase 1 (line 100) describes the function `getEffectiveTeamRole` as calculating the maximum role among the direct role, org role, and ancestor team roles. However, it fails to filter out the `member` role when checking ancestor teams. Under this logic, a regular `member` of a parent team would inherit `member` status on all child subtrees.
- **Why it's a mistake:** The role semantics state: *"team descendant visibility is granted at role >= manager"*. A regular team member of a parent team should not gain visibility or access to descendant teams they do not belong to.
- **Fix:** When querying ancestor team roles in `getEffectiveTeamRole`, explicitly exclude the `'member'` role:
  ```typescript
  const ancestors = await db.from('team_closure tc')
    .select('tm.role')
    .join('team_members tm', 'tc.ancestor_id', 'tm.team_id')
    .where('tc.descendant_id', teamId)
    .where('tm.user_id', userId)
    .whereIn('tm.role', ['manager', 'admin', 'owner']); // Only inherit manager+ roles
  ```

### 🔴 Bug O — **Slack Account Hijacking / Misassociation during Slack Linking (Security Vulnerability)**
When a user executes a Slack command (like `/worklog`) and is not linked, the app generates a signed JWT containing their Slack user ID and team ID. When the user clicks the link and authenticates in the web app, the server links that Slack user ID to `req.userId`.
- **Why it's a mistake:** If a user shares this linking link by mistake (or if a malicious actor steals it), Slack User A's account is linked to Worklog User B. User B can then view/modify User A's data via Slack command DMs.
- **Fix:**
  1. During the Slack slash command handler, fetch the Slack user's email address via the Slack API (`users.info` with the bot token).
  2. Embed this email address in the signed linking JWT payload.
  3. When verifying the token on `/api/integrations/slack/link`, verify that the email address of the logged-in Postgres user (`req.userId`) matches the email encoded in the JWT.

### 🔴 Bug P — **Confused Auth Roles for Team Goal Management vs Team Config Mutation (Authorization Lockout)**
The plan requires team config mutations (rename, membership, reparent) to require role >= `admin`. It also states that editing team-scoped goals requires `canManageTeam`.
- **Why it's a mistake:** If `canManageTeam` is mapped to the `admin` threshold (to protect team structure), then team **managers** cannot create or edit team goals, which breaks the core tier feature *"Manager Goal-Setting"*. If `canManageTeam` is mapped to the `manager` threshold, then managers gain unauthorized access to rename and reparent teams.
- **Fix:** Split the authorization checks in `server/src/services/authz.ts`:
  - `canManageTeamConfig`: Requires team role >= `admin` (or org admin/owner).
  - `canManageTeamGoals`: Requires team role >= `manager` (or org admin/owner).

### 🔴 Bug Q — **Slack Interactive Actions Bypass the Authorization Layer (Security Vulnerability)**
The plan details parsing Slack Block Kit payloads and mapping Slack users to web users but fails to require running the Node authorization service layer (`services/authz.ts`) on the linked user before updating the database.
- **Why it is a mistake:** If a user clicks a button in Slack (e.g., "Approve Worklog" or "Check-in Goal"), the backend receives the event payload containing the target resource ID (like a goal or worklog ID) in the button's `value` attribute. If the server executes the update based solely on this ID without verifying that the linked user has the correct permissions (e.g., is a manager of the assignee, or is the owner of the goal), it creates an authorization bypass. Any user in the Slack workspace could potentially approve their own worklogs or modify goals they don't own by triggering the action endpoint.
- **Fix:** Every Slack interactive action handler must run the resolved `userId` through the authorization service checks:
  ```ts
  const authorized = await canEditGoal(db, userId, targetGoal);
  if (!authorized) {
    return res.status(200).json({
      response_type: 'ephemeral',
      text: '❌ You do not have permission to modify this goal.'
    });
  }
  ```

### 🔴 Bug R — **Atlassian Token Refresh HTTP Timeout vs. Database Lock TTL Mismatch (Concurrency Bug)**
The database lock (`is_refreshing = true` with `refresh_started_at < NOW() - INTERVAL '30 seconds'`) can expire before a slow HTTP token refresh request times out.
- **Why it is a mistake:** Node HTTP clients typically have default request timeouts of 2 minutes (120 seconds) or no timeout at all. If the Atlassian API call is extremely slow (e.g., 40 seconds) due to network congestion, the 30-second database lock expires. A second concurrent request will see that the lock is expired and trigger a second refresh request using the *same* old refresh token. When the first request finally succeeds, it writes the new token. When the second request completes, Atlassian will detect that the old refresh token was reused (which is a critical security violation under Atlassian's Rotating Refresh Token policy). Atlassian will immediately revoke the entire authorization grant (`invalid_grant`), permanently disconnecting the integration.
- **Fix:**
  1. The HTTP request timeout on OAuth refresh requests MUST be strictly configured to be short (e.g., maximum 15 seconds).
  2. The database lock duration (30 seconds) must be at least double the HTTP request timeout.
  3. Ensure that when the lock is released or retried, the system checks if the token has already been refreshed by another process in the meantime (by checking if `expires_at` is now in the future).

### 🔴 Bug S — **Express Middleware Ordering Bug for Raw-Body Webhooks (Runtime Bug)**
The plan places route-specific raw-body parsers before the global `express.json()`. However, if the global body parser is registered at the top of the main server entrypoint (`server/src/index.ts`) before routes are mounted, the request stream is already consumed.
- **Why it is a mistake:** If a request stream is read and parsed by a global parser first, registering `express.json({ verify: ... })` or `express.urlencoded({ verify: ... })` on specific routes downstream will not work. `req.rawBody` will remain `undefined`, causing all webhook signature verifications (GitHub, Slack, JIRA) to fail at runtime with validation errors.
- **Fix:** Ensure that the raw-body parser middleware for webhook routes is registered **before** any global `app.use(express.json())` or `app.use(express.urlencoded())` statements are declared in the main `server/src/index.ts` file:
  ```ts
  // Must be at the very top of the middleware stack
  app.use('/api/webhooks/github', express.json({
    verify: (req: any, _, buf) => { req.rawBody = buf; }
  }));
  app.use('/api/webhooks/slack', express.urlencoded({
    extended: true,
    verify: (req: any, _, buf) => { req.rawBody = buf; }
  }));
  // Then register the global parsers for other routes
  app.use(express.json());
  ```

### 🟡 Issue T — **Goal Visibility Logic Filters Out Valid Team/Org Goals (Visibility Bug)**
The goal listing query (and proposed Improvement 14) filters goals using only user IDs (the creator's ID or assignee's ID matching the user's `viewableUserIds` set).
- **Why it's a mistake:** If an organization admin (who does not belong to Team X) creates an unassigned goal for Team X, it will be invisible to Team X's members because the admin's user ID is not in their `viewableUserIds` set and there are no assignees. Similarly, organization-scoped goals would be hidden from most users.
- **Fix:** Structure the visibility query in `server/src/routes/goals.ts` using the goal's `scope`:
  ```sql
  SELECT g.* FROM goals g
  LEFT JOIN goal_assignees ga ON g.id = ga.goal_id
  WHERE g.org_id = :orgId
    AND (
      g.scope = 'organization'
      OR g.scope = 'department'
      OR (g.scope = 'team' AND g.team_id IN (
        SELECT tc.descendant_id 
        FROM team_members tm
        JOIN team_closure tc ON tm.team_id = tc.ancestor_id
        WHERE tm.user_id = :userId AND tm.org_id = :orgId
          AND (tm.role IN ('manager', 'admin', 'owner') OR tc.depth = 0)
      ))
      OR (g.scope = 'individual' AND (
        g.created_by = :userId
        OR ga.user_id = :userId
        OR ga.user_id IN (SELECT * FROM viewable_user_ids(:userId, :orgId))
        OR EXISTS (
          SELECT 1 FROM org_members 
          WHERE user_id = :userId AND org_id = :orgId AND role IN ('admin', 'owner')
        )
      ))
    );
  ```

### 🟡 Issue U — **Race Condition in Mixing Child Goals and Key Results/Links (Integrity Bug)**
The plan requires blocking the mixing of child goals and key results/links on the same goal. While Phase 1 locks the organization row during parent modification (`setParent`), it does not require locking the organization or goal row when adding/deleting key results or links.
- **Why it's a mistake:** A race condition exists: User A adds a child goal to Goal X (locks org, finds no KRs, succeeds). User B concurrently adds a KR to Goal X (does not lock org, finds no children, succeeds). Goal X ends up with both a child goal and a key result, breaking database integrity.
- **Fix:** Enforce this validation in database triggers on `goals`, `goal_key_results`, and `goal_links` that lock the target goal row (`SELECT 1 FROM goals WHERE id = NEW.goal_id FOR UPDATE`).

### 🟡 Issue V — **Undefined Authorization for Department-Scoped Goals (Runtime Error)**
The plan states editing department-scoped goals requires `canManageTeam`.
- **Why it's a mistake:** The schema defines `departments` as `(id, org_id, name)` with no department members or roles table. Calling `canManageTeam` with a department ID will crash or fail because it expects a team ID and queries `team_members`.
- **Fix:** Explicitly define that department-scoped goals can only be managed by organization admins/owners.

### 🟡 Issue W — **Missing Org Scoping for `org_integrations.installed_by` (Tenant Isolation Leak)**
The `org_integrations` table has a single-column FK `installed_by REFERENCES users(id)`.
- **Why it's a mistake:** If a user installs an integration for Organization A, and is later removed from Organization A, the `installed_by` column still points to them, leaking references cross-tenant.
- **Fix:** Use a composite foreign key:
  ```sql
  FOREIGN KEY (org_id, installed_by) REFERENCES org_members(org_id, user_id) ON DELETE SET NULL
  ```

### 🟡 Issue X — **Missing Foreign Key Constraint on `slack_command_sessions` (Tenant Isolation Leak)**
The `slack_command_sessions` table stores `slack_team_id`, `slack_user_id`, and `org_id` but lacks a foreign key constraint referencing `slack_user_links`.
- **Why it's a mistake:** A session row could reference an arbitrary combination of Slack user, Slack team, and organization, potentially leaking goal references across workspaces.
- **Fix:** Ensure `slack_user_links` has a unique constraint on `(slack_team_id, slack_user_id, org_id)` and reference it:
  ```sql
  FOREIGN KEY (slack_team_id, slack_user_id, org_id) REFERENCES slack_user_links(slack_team_id, slack_user_id, org_id) ON DELETE CASCADE
  ```

### 🟡 Issue Y — **Session-Level Advisory Locks Cause Connection Pool Starvation & Lock Leakage (Architecture Bug)**
The plan suggests session-level advisory locks (`pg_try_advisory_lock`) to serialize weekly sync runs.
- **Why it's a mistake:**
  1. **Pool Starvation:** Because the lock is bound to the connection, the database connection must remain checked out from the Node pool during the entire duration of the slow external API calls (JIRA/GitHub). Under load, this exhausts the database connection pool, freezing the REST API.
  2. **Lock Leakage:** If a Node process crashes or fails to call `pg_advisory_unlock` (due to an uncaught exception), the lock remains active on the pooled connection. Unrelated queries executing on that connection will inherit the lock.
- **Fix:** Explicitly forbid session-level advisory locks for sync tasks. Instead, use an atomic database-state check (`is_syncing` and `sync_started_at` columns) in the database (`integration_preferences`):
  ```sql
  UPDATE integration_preferences
  SET is_syncing = true, sync_started_at = NOW()
  WHERE user_id = :userId
    AND (is_syncing = false OR sync_started_at < NOW() - INTERVAL '15 minutes')
  RETURNING *;
  ```
  If a row is returned, the lock is acquired, and the database connection can be released back to the pool immediately while the slow API calls execute.

### 🟡 Issue Z — **Stateless JWT State Token Bloat and Truncation (UX & Architecture Bug)**
For JIRA site selection, if multiple sites are returned, the plan specifies serializing the sites list and the encrypted OAuth tokens into a signed state JWT and redirecting the browser: `/integrations/jira/select-site?token=JWT_TOKEN`.
- **Why it is a mistake:** A stateless JWT containing multiple Jira site structures (each with a name, URL, avatar, and cloud ID) plus the encrypted Atlassian OAuth access and refresh tokens (which are already long) will easily exceed 3,000–4,000 characters. Web browsers, proxy servers, and CDN gateways (like Nginx, Cloudflare) enforce strict URL length limits (often 2,048 characters). The redirect URL will be truncated, causing decryption and validation failures for admins with access to multiple Atlassian sites.
- **Fix:** Replace the stateless JWT with a server-side cache table `temp_oauth_states(key UUID primary key, data JSONB, expires_at TIMESTAMPTZ)`. Store the site list and encrypted tokens in this table, and pass only a 36-character UUID string `key` in the redirect URL query parameter. The client will fetch the sites via `GET /api/integrations/jira/sites?key=UUID`, which resolves the cache record on the server.

### 🟡 Issue AA — **JIRA JQL Timezone Profile Ambiguity (API/Sync Bug)**
The plan specifies querying Jira using plain date strings: `updatedDate >= 'YYYY-MM-DD' AND updatedDate < 'YYYY-MM-DD'`.
- **Why it is a mistake:** In Jira Cloud, JQL date queries that omit timezone offsets are interpreted in the **timezone of the caller's Jira profile settings**. Because the weekly sync job executes API calls using either the admin's org-level token or a user's token, the date boundaries will shift depending on the timezone set in the Atlassian account of the person who installed the integration or authorized the connection. This causes silent synchronization gaps where work logged on Sunday evening or Monday morning is missed or double-counted depending on the offset.
- **Fix:** Convert the local week start and end dates (e.g., Monday 00:00:00 and Sunday 23:59:59 in the user's `sync_timezone`) into absolute ISO 8601 strings with offsets (e.g., `2026-06-08T00:00:00-04:00` or converted to UTC) and use these absolute timestamps in the JQL query:
  `updatedDate >= "2026-06-08T00:00:00-04:00" AND updatedDate < "2026-06-15T00:00:00-04:00"`.

### 🟡 Issue AB — **JIRA Sync Limited to Issue Assignee, Missing Worklog Authorship (Sync Bug)**
The plan assumes we only need to sync issues assigned to the user.
- **Why it is a mistake:** In real software development teams, developers frequently log work (Jira Worklogs) on issues assigned to other team members (e.g., when helping debug, reviewing code, or pairing). If the weekly sync job only queries issues assigned to the user (`assignee = accountId`), it will miss all the time tracked on external issues, leading to incomplete weekly worklogs.
- **Fix:** Expand the JQL query to search for issues where the user is either the assignee OR they have logged work:
  `assignee = "${accountId}" OR worklogAuthor = "${accountId}" AND updatedDate >= ...`.
  Then, during the import process, parse the issue's worklogs to extract entries where the author matches the user's `accountId` within the target timeframe.

### 🟡 Issue AC — **Slack Slash Command 3-Second Timeout and Synchronous Processing (Integration Bug)**
Slash commands like `/worklog` (sync) or `/goals <index> <progress>%` (which triggers a cascading trigger in the DB) are processed synchronously.
- **Why it is a mistake:** Slack slash commands require an HTTP `200 OK` response within **3.0 seconds**. If a command triggers a weekly sync (calling JIRA and GitHub APIs) or cascading progress recalculations up a deep goals tree, it can easily exceed 3 seconds. When this happens, Slack will close the connection and display an `operation_timeout` error to the user, even if the backend process eventually finishes.
- **Fix:** The slash command endpoint must immediately respond with an HTTP `200 OK` containing an ephemeral acknowledgment (e.g., `{"text": "Syncing your weekly worklogs..."}`), and spawn the sync/update logic asynchronously in the background. Once the background job completes, post the final result using the `response_url` parameter provided in Slack's original request payload.

### 🟡 Issue AD — **GitHub Goal Links Fetch API Crash for Issues (API Bug)**
The plan assumes all GitHub links are Pull Requests and specifies querying the Pull Requests REST API: `GET /repos/{owner}/{repo}/pulls/{number}`.
- **Why it is a mistake:** Users frequently link GitHub Issues to their goals. Attempting to query an Issue URL using the Pull Requests API will return `404 Not Found` or a payload schema mismatch, causing the progress rollup job to fail or crash.
- **Fix:** Parse the linked URL to check if it contains `/issues/` or `/pull/`. For issues, query the Issue API `GET /repos/{owner}/{repo}/issues/{number}` and check `state === 'closed'`. For PRs, query the PR API and check `merged === true`.

### 🟡 Issue AE — **Sibling Node Deadlocks in Cascading Progress Trigger (Database Bug)**
The plan does not sort database writes when propagating progress up the goal tree.
- **Why it is a mistake:** When a batch update (e.g. during a nightly rollup or weekly sync) modifies the progress of multiple leaf goals concurrently, the PostgreSQL database trigger will propagate these updates upward. If Transaction A updates Leaf Goal 1 and Leaf Goal 2, and Transaction B updates them in a different order, the cascading updates to their common parent and grandparent goals will acquire locks in different orders. This creates a classic database deadlock condition, causing queries to fail with a `deadlock detected` error.
- **Fix:** In the Node service layer, any batch updates to goals, key results, or links must sort the target IDs in a stable, deterministic order (e.g., sorting by UUID alphabetically) before executing the writes. Furthermore, ensure that the topological update propagation inside the database locks rows in a deterministic order.

### 🟢 Issue AF — **Missing Domain-to-CloudId Mapping for JIRA Integration (Runtime Error)**
The JIRA API requires a UUID-based `cloudId` to fetch issues. When linking an issue, a user pastes the URL (e.g. `https://my-company.atlassian.net/browse/KEY-123`). The plan stores `cloudIds` but does not maintain a mapping from domains to Cloud IDs.
- **Why it is a mistake:** The server has no way to resolve which `cloudId` corresponds to the domain of the pasted URL.
- **Fix:** Store a structured list of connected sites in the configuration:
  ```json
  {
    "sites": [
      { "domain": "my-company.atlassian.net", "cloudId": "12345678-abcd-ef01-2345-6789abcdef01" }
    ]
  }
  ```

### 🟢 Issue AG — **Performance Degradation when Validating Timezones using `pg_timezone_names` (Performance Bug)**
Correction 19 proposes querying the slow `pg_timezone_names` view per-user in the scheduler.
- **Why it's a mistake:** `pg_timezone_names` dynamically scans the OS zoneinfo database and is notoriously slow in PostgreSQL. Running a subquery against it for every row in `integration_preferences` will cause severe performance degradation.
- **Fix:** Validate timezones in Node before write. Use a lightweight PL/pgSQL helper function with `EXCEPTION` handling for runtime safety:
  ```sql
  CREATE OR REPLACE FUNCTION safe_local_time(p_timezone TEXT)
  RETURNS TIMESTAMP LANGUAGE plpgsql STABLE AS $$
  BEGIN
    RETURN NOW() AT TIME ZONE p_timezone;
  EXCEPTION WHEN OTHERS THEN
    RETURN NOW() AT TIME ZONE 'UTC';
  END;
  $$;
  ```

### 🟢 Issue AH — **Redundant Recalculations in Webhook Batch Processing (Performance Bug)**
Improvement 10 proposes a topological sort of goal updates.
- **Why it's a mistake:** Because `recomputeGoalProgress` automatically cascades progress updates upward, updating both a child and parent goal in the same batch triggers redundant updates, causing write contention and lock conflicts.
- **Fix:** Only invoke `recomputeGoalProgress` on the leaf-most goals in the batch; let the database trigger cascade handle the upward propagation automatically.

### 🟢 Issue AI — **Missing Database Persistence Retries for Newly Refreshed Tokens (Reliability Bug)**
To prevent transaction pool exhaustion, the external API call to refresh tokens is executed outside of any SQL transaction. Once the Node server receives the new tokens, it attempts to write them to the database. If the database is under high load or temporarily drops its connection at that exact millisecond, this write query fails. The newly received tokens are lost. Since the old refresh token has already been used and invalidated on the provider's server, the application is left with an invalid refresh token in the database. On the next API call, the provider will return `invalid_grant`, permanently breaking the integration.
- **Fix:** Implement an in-memory retry loop with exponential backoff (e.g., 3 retries over 5 seconds) specifically for the database write query that persists the newly acquired tokens.

### 🟢 Issue AJ — **Missing Type Safety in Webhook Signature Headers (DoS Vector)**
If an attacker or a faulty webhook call sends a request with a missing or malformed signature header (e.g. `x-hub-signature-256` is `undefined`), the validation function `verifyGithubSignature` will pass `undefined` to `crypto.createHash` or try to call `.split()` on a non-string. In Node.js, this throws a `TypeError: The "data" argument must be of type string or an instance of Buffer`, which will crash the Node server process if not caught, leading to a simple Denial of Service (DoS) vulnerability.
- **Fix:** Ensure that the webhook handlers check that the signature header is present, is a single string, and has the correct format (e.g., starts with `sha256=`) before executing any cryptographic operations. If not, reject the request immediately with `400 Bad Request`.

### 🟢 Issue AK — **Goal Rollup Job Querying Inactive/Disabled Integrations (Performance Bug)**
If an integration is disabled (e.g., `is_active = false`) or revoked, the nightly `goalRollupJob` will still attempt to fetch updates for its linked items. Since the credentials are stale or inactive, these API calls will fail, flooding logs with authentication errors and wasting API rate limits.
- **Fix:** The database query that selects active `goal_links` to sync during the nightly rollup must join with `org_integrations` and `user_integrations` and filter out any links where the parent integration has `is_active = false`.

### 🟢 Issue AL — **Weekly Sync Timezone-Aware SQL Query & Node boundaries (Actionable Appendix)**
A robust query is needed to retrieve all users who are eligible for a weekly sync, using absolute time conversion in Node to avoid timezone queries in a loop.
- **Database Query:**
  ```sql
  SELECT 
    ip.user_id,
    (NOW() AT TIME ZONE ip.sync_timezone) AS local_now,
    (date_trunc('week', NOW() AT TIME ZONE ip.sync_timezone) + INTERVAL '9 hours') AS threshold,
    to_char(
      CASE 
        WHEN (NOW() AT TIME ZONE ip.sync_timezone) >= (date_trunc('week', NOW() AT TIME ZONE ip.sync_timezone) + INTERVAL '9 hours')
        THEN (NOW() AT TIME ZONE ip.sync_timezone) - INTERVAL '7 days'
        ELSE (NOW() AT TIME ZONE ip.sync_timezone) - INTERVAL '14 days'
      END,
      'IYYY-"W"IW'
    ) AS latest_eligible_week
  FROM integration_preferences ip
  JOIN users u ON ip.user_id = u.id
  WHERE 
    EXISTS (
      SELECT 1 FROM user_integrations ui 
      WHERE ui.user_id = ip.user_id AND ui.is_active = true
    )
    AND (
      ip.last_weekly_sync_week IS NULL 
      OR ip.last_weekly_sync_week < to_char(
        CASE 
          WHEN (NOW() AT TIME ZONE ip.sync_timezone) >= (date_trunc('week', NOW() AT TIME ZONE ip.sync_timezone) + INTERVAL '9 hours')
          THEN (NOW() AT TIME ZONE ip.sync_timezone) - INTERVAL '7 days'
          ELSE (NOW() AT TIME ZONE ip.sync_timezone) - INTERVAL '14 days'
        END,
        'IYYY-"W"IW'
      )
    );
  ```
- **Node.js Time Bound Calculator:**
  ```ts
  import dayjs from 'dayjs';
  import timezone from 'dayjs/plugin/timezone';
  import utc from 'dayjs/plugin/utc';
  import isoWeek from 'dayjs/plugin/isoWeek';

  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(isoWeek);

  function getSyncBoundaries(weekStr: string, userTimezone: string) {
    const [year, week] = weekStr.split('-W').map(Number);
    const startOfWeekLocal = dayjs().tz(userTimezone).year(year).isoWeek(week).startOf('isoWeek');
    const endOfWeekLocal = startOfWeekLocal.add(1, 'week');
    return {
      sinceUTC: startOfWeekLocal.utc().format(),
      untilUTC: endOfWeekLocal.utc().format()
    };
  }
  ```

---

*Third review completed 2026-06-16. Identified: 6 critical security/runtime failures (Bugs N-S), 9 sync/API/architecture gaps (Issues T-AE), 7 reliability/performance/SQL improvements (Issues AF-AL).*

