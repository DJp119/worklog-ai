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
