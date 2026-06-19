# Test Coverage Gaps — worklog-ai

**Auditor:** Test Reviewer
**Date:** 2026-06-18
**Scope:** `D:\Vibe Coded\worklog-ai\`

---

## Current Test Inventory

Two test files exist project-wide (excluding `node_modules`):

1. `D:\Vibe Coded\worklog-ai\server\src\__tests__\audit-fixes.test.ts` — 26 structural smoke tests (regex/string-match against source files, no live DB, no real network).
2. `D:\Vibe Coded\worklog-ai\client\test\authStorage.test.ts` — 3 unit tests for the `authStorage.ts` storage helpers (Node `assert`, mock Storage).

**Coverage is structural, not behavioral.** The audit-fixes file does not execute any code under test; it verifies the *presence* of substrings. This catches accidental deletions of fix markers but cannot catch:
- A regression in the *logic* inside a guarded block (only the regex stays satisfied)
- A fix that is *commented out* with a sentinel string still present
- A wrong constant, bad SQL, or off-by-one inside a verified function
- Concurrency, race conditions, or partial-failure scenarios

There is no test runner config (`vitest.config.*`, `playwright.config.*`, or `jest.config.*`) at the project root or in `server/` or `client/`. Tests rely on whatever defaults the runner picks up. No CI configuration enforces them.

---

## What the Existing Tests Do NOT Test

| Area | What is asserted | What is missing |
|---|---|---|
| `crypto.ts loadKeys()` | The function name appears | Throws on missing key, decrypts correctly, round-trips a secret |
| `webhookSecurity` pre-hash | 6+ occurrences of `createHash('sha256')` | Actual signature pass/fail, replay, clock-skew bound, timing attack |
| `jiraAdapter` timeout | `AbortSignal.timeout` literal | Aborts after timeout, error path, 4xx/5xx propagation |
| `authz` org-membership-first | regex window | All 5 branches of `canEditGoal` (org admin, creator, assignee, team, department) |
| Migration functions | SQL pattern presence | The migration itself is unverified beyond substring matches |
| `useHasOrg` / `useTeamRole` | File exists | Hook behavior, memoization, fetch error handling |
| `Layout.tsx` nav | regex window | No actual render test, no React Testing Library setup |

---

## Bug-Prone Code Paths and the Tests That Would Catch Bugs

### 1. Webhook signature verification — CRITICAL (security)

**Files:** `server/src/lib/webhookSecurity.ts`, `server/src/routes/webhooks/{github,jira,slack}.ts`

The existing audit-fixes test only checks that `createHash('sha256')` appears 6+ times. This is dangerously thin. Real bugs this hides:
- A future refactor could compute `expectedHash` and `receivedHash` from the *same* buffer (constant-time comparison becomes a tautology)
- A missing `startsWith('sha256=')` check could pass garbage through `hex` decode and silently compare empty digests
- The Slack `5 * 60 * 1000` skew is a magic number — boundary test would pin it

**Missing tests (CRITICAL):**
- Valid signature → `verifyGithubSignature` returns `true`
- Wrong secret → `false`
- Header missing `sha256=` prefix → `false`
- Header with non-hex body → does not throw `RangeError` (the original bug)
- Buffer length mismatch → does not throw (post-fix behavior)
- Slack: timestamp exactly 5 min in the past/future → boundary
- Slack: timestamp `NaN` parse → `false`
- `recordEvent` returns `null` on duplicate `externalEventId` and `string` on first call (mock DB)
- JIRA: token matches, token mismatches, stored secret decrypt failure
- `updateEventStatus` writes `processed_at` only on `done|error`
- Webhook handler returns 401 on bad signature, 200 with `{ message: 'Duplicate event' }` on retry

**Why critical:** These handlers are the unauthenticated entry point for the entire integrations feature. A bypass means an attacker can poison `goal_links` for any org.

---

### 2. Auth flows — CRITICAL (auth)

**Files:** `server/src/middleware/auth.ts`, `server/src/routes/auth.ts`

**Missing tests (CRITICAL):**
- `verifyToken` accepts a valid signed token, rejects a tampered token (mutate payload bytes after signing), rejects an expired token, rejects a token signed with a different `JWT_SECRET`
- `requireAuth` middleware: missing `Authorization` → 401, `Bearer ` prefix missing → 401, valid token + DB user present → 200, valid token + user deleted from DB → 401
- `validateRefreshToken`: token revoked, token expired, token for deleted user → `null`
- `refresh` flow: old refresh token is revoked atomically; using the old token after refresh → 401
- `hashToken` is deterministic, length 64 hex, two different inputs produce different hashes
- `reset-password` revokes **all** active refresh tokens (not just the reset token)
- `signup` 23505 (unique violation) returns 400, not 500
- `login` 401 on wrong password, 403 on unverified email, 200 on verified
- `resend-verification` 429 if a token was created in the last 60s
- Generic-error-after-missing-user to prevent email enumeration on `forgot-password` / `resend-verification`

**Why critical:** Account-takeover primitives. A failure here compromises every user.

---

### 3. Goal service — CRITICAL (data integrity, concurrency)

**Files:** `server/src/services/goalService.ts`, `server/src/routes/goals.ts`

**Missing tests (CRITICAL):**
- `setParent` cycle detection: setting A.parent = B, then B.parent = A → should reject; only the *current* comment claims it does — no test proves it
- `setParent` cross-org reparent: parent in org X, child in org Y → reject (would be a cross-tenant data leak)
- `setParent` self-parent (`goalId === newParentId`) → reject
- `updateGoal` with `progress` field on `progress_mode !== 'manual'` → throws "Manual progress updates only allowed..." (the guard exists but is **not** a regex-covered branch)
- `updateGoal` with `progress` on a goal that has children → throws
- `addGoalAssignee` to a user that is **not** an org member → FK violation surfaces as 500 instead of 403 in the route — this is the one the route explicitly checks, but a service-level test would catch a regression in the service
- `addLink` URL parser: all 5 supported shapes (PR URL, issue URL, JIRA browse URL with domain, JIRA browse URL without domain, bare KEY-N), all unsupported shapes throw
- `addLink` JIRA enrichment upgrades `externalId` to numeric; GitHub enrichment upgrades to `node_id` (best-effort)
- `addLink` writes `org_id` from the goal, not the request body
- `createGoalUpdate` with `progress` on `progress_mode === 'manual'` writes `goals.progress`; with `progress_mode === 'rollup'` does not
- `listVisibleGoals` filters individual-scope goals by `viewableUserIds.has(g.created_by)` — would catch a regression that exposes individual goals org-wide
- `getGoalWithDetails` returns key results ordered by `sort_order`, updates desc by `created_at` limit 20

**Concurrency tests (CRITICAL):**
- Two concurrent `setParent` calls on goals in the same org serialize on the `lock_organization_row` advisory lock. A test that fires two `setParent` in parallel and asserts both see consistent state would prove the lock works.
- Goal progress recomputation: insert a `goal_updates` row, observe that `goals.progress` is updated by the trigger — this is in the DB and currently completely untested. A migration that drops the trigger would only be caught by a behavioral test.

**Why critical:** The goals feature is the product's headline differentiator. A cycle or cross-tenant reparent is a data-integrity incident.

---

### 4. Team service — closure table maintenance — CRITICAL (correctness)

**Files:** `server/src/services/teamService.ts`, `server/src/routes/teams.ts`

**Missing tests (CRITICAL):**
- `createTeam` with `parentTeamId` writes the right `team_closure` rows (self, parent, grandparent, etc.). Currently no behavioral test.
- `moveTeam` updates the closure table correctly: ancestors of the new parent should be added; ancestors of the old parent should be removed (except shared ones)
- `moveTeam` rejects cycles: moving A under B when B is already under A
- `moveTeam` rejects cross-org moves (parent.team.org_id !== team.org_id)
- `deleteTeam` with children and no `reparentChildrenTo` → throws
- `deleteTeam` with `reparentChildrenTo` reparents all children to the new parent
- `rebuildClosure` produces a closure table that is identical to the one the trigger would have produced
- `getEffectiveTeamRole` returns `null` for non-member, `member` for direct, the *max* of direct/ancestor/org (the comment claims this is the post-Bug-CP fix; no test pins it)
- `getEffectiveTeamRole` excludes ancestor `member` role but includes ancestor `manager/admin/owner` (the Bug N fix)
- `getEffectiveTeamRole` org-admin candidate: org admin who is NOT a team member should still get team admin (Bug CP)
- `orgRoleAtLeast` and `teamRoleAtLeast` rank tables: 6+ boundary cases

**Why critical:** Closure tables are easy to break with a single migration and silent for the first few queries. The team RBAC model depends on `getEffectiveTeamRole` being correct.

---

### 5. Token refresh — race conditions — CRITICAL (auth)

**Files:** `client/src/lib/api.ts`, `server/src/routes/auth.ts`

**Missing tests (CRITICAL):**
- Two parallel 401s from two in-flight requests should trigger exactly **one** `refreshAccessToken` call, not two. The current code in `apiRequest` has no de-duplication — every 401 launches its own refresh. This is a real bug: two refresh calls each revoke the old token, one wins, the other returns 401 and redirects the user to `/login` mid-session.
- Refresh failure during an in-flight request: the first request silently fails, the second retries the refresh. There is no test for the `refreshed=false` branch.
- After successful refresh, the original request is replayed **once** with the new token. If the replay also returns 401, the user is logged out. There is no test for the double-401 case.
- `getStoredTokens` returns the union of local and session (covered), but does not test what happens when `accessToken` is in local and `refreshToken` is in session (the current code happily mixes them, which is wrong but untested).

**Why critical:** Token refresh is on the hot path. A race here logs users out unpredictably.

---

### 6. RLS policies — what would verify they are correct — CRITICAL (security)

**Files:** `supabase-schema.sql`, `supabase-migrations/2026-06-16_teams_goals_integrations.sql`

The service uses the **service role** key, which bypasses RLS. The audit-fixes test claims this is "inert defense-in-depth" (per the comment in `authz.ts`). RLS therefore only protects against direct PostgREST access from the client — which is critical for the Supabase anon key.

**Missing tests (CRITICAL):**
- RLS integration tests against a real (or testcontainer) Postgres: as user A, can I select user B's `work_log_entries`? Expected: no. (This is the original RLS test that should have been in CI from day one.)
- Same for `goals`, `goal_assignees`, `goal_updates`, `org_members`, `team_members`, `team_closure`, `goal_links`, `integration_events`
- `viewable_user_ids` RPC: returns the expected set for member / manager / admin / owner roles
- Migration idempotency: running the migration twice is a no-op (covered only by `CREATE TABLE IF NOT EXISTS` in the regex, not by running it)
- `recompute_goal_progress` trigger: insert a check-in, verify parent progress updates
- `record_integration_event` RPC: returns same ID for duplicate, new ID for new
- `lock_organization_row` RPC: actually blocks concurrent transactions

**Why critical:** RLS is the last line of defense. If a misconfigured policy exposes `org_members` or `goal_links` to anon reads, every user is at risk.

---

### 7. Slack command handler — IMPORTANT

**Files:** `server/src/routes/webhooks/slack.ts`

The audit-fixes test confirms session expiry and org-mismatch guard exist. Missing:

- Slack signed request with a valid signature and 5-min-future timestamp → 200
- Slack signed request with a 6-min-future timestamp → 401 (replay boundary)
- `parts[0] = '0'` → "Usage" message (the `index < 1` check is structurally verified but not behaviorally)
- `parts[0] = '-1'` → "Usage" message
- `parts[1] = '150%'` → "Usage" message (out of range)
- Slack user is linked but not in any org with this workspace → "No organization membership found"
- A user linked to org A tries to update a goal in org B (via tampered session) → "permission denied"
- A user who lost org membership but is still a `goal_assignees` row → can no longer edit (the canEditGoal org-first check is structurally verified but not behaviorally)
- Race: two `setParent` calls from Slack arrive simultaneously — same concern as goal service

---

### 8. Integration adapters (JIRA, GitHub) — IMPORTANT

**Files:** `server/src/lib/jiraAdapter.ts`, `server/src/lib/githubAdapter.ts`, `server/src/lib/githubApp.ts`

Audit-fixes asserts:
- `AbortSignal.timeout` exists
- No `404 return null as any`

Missing:
- `getJiraClient` returns null when no integration is connected; throws when creds are bad
- `call` method: 401 → throws, 429 → retries with backoff, 5xx → throws
- JIRA enrichment upgrades `externalId` to numeric ID
- `getGithubClient`: token missing → null, token expired → throws, scope insufficient → throws
- `getGithubClient` GraphQL `node_id` is preferred over REST databaseId
- GitHub App installation lookup: `hasOrgApp(repoFullName)` returns true/false correctly
- `weeklySyncJob` repo filter actually filters — current audit-fixes only checks the function names exist

---

### 9. Weekly sync and rollup jobs — IMPORTANT

**Files:** `server/src/jobs/weeklySyncJob.ts`, `server/src/jobs/goalRollupJob.ts`, `server/src/jobs/goalDigestJob.ts`

- Timezone validation: 'America/Los_Angeles' passes, 'Los_Angeles' fails, '' fails
- IANA timezone boundary (DST): 'America/Los_Angeles' on a DST transition day produces a valid cron string
- Repo filter: a PR for a repo NOT in the org's allowlist is skipped
- Per-member try/catch in `goalDigestJob` actually catches (a throwing `sendGoalDigest` does not abort the loop)
- Rollup arithmetic with zero children, with zero-weight children (the migration has a `NULLIF(SUM, 0)` guard — not tested)
- Rollup arithmetic with all-done children → 100%
- Rollup rounding: `Math.round(percent * 100) / 100` is correct at boundary values (33.333 → 33.33)

---

### 10. CORS — NICE-TO-HAVE

**Files:** `server/src/index.ts`

- `isAllowedVercelOrigin` accepts `https://foo.vercel.app`, rejects `http://foo.vercel.app`, rejects `https://foo.com` (no `.vercel.app` suffix), rejects malformed URLs
- `isAllowedVercelOrigin` with `https://.vercel.app` (no subdomain) → false
- CORS preflight: `OPTIONS` request returns the right headers for an allowed origin
- Localhost with non-standard port: `http://localhost:1234` → allowed; `http://localhost.evil.com:1234` → rejected

---

### 11. RLS bypass detection in service routes — CRITICAL (security)

**Files:** all `server/src/routes/*.ts`

The header comment in `middleware/auth.ts` says: *"Every route handler that uses `req.supabase` MUST scope queries by `req.userId`. A handler that uses `req.supabase` without an explicit user filter can read or write any user's data."*

There is **no test that enforces this rule.** A static-analysis test (regex across `routes/*.ts` looking for `req.supabase!.from(X).select(Y)` without a `.eq('user_id'` or `.eq('id', req.userId)` within N characters) would catch the most common mistake. This is arguably the single highest-value test missing.

**Examples of code that would be flagged by such a test (none currently exist, but the risk is latent):**
- `req.supabase!.from('users').select('*')` (no filter)
- `req.supabase!.from('work_log_entries').select().eq('id', someId)` (using a path param instead of `req.userId`)

**Why critical:** Service-role bypass is the most likely source of a CVE in this codebase.

---

## Client Tests — Are there ANY?

Yes, exactly one: `client/test/authStorage.test.ts` (3 tests). The rest of the client has zero coverage:

- `client/src/lib/api.ts` — `apiRequest`, `refreshAccessToken` (race conditions, 401 replay, JSON parse of non-JSON response)
- `client/src/lib/goalsApi.ts` — all goal CRUD
- `client/src/lib/integrationsApi.ts` — all integration flows
- `client/src/lib/teamsApi.ts` — all team flows
- `client/src/lib/chatApi.ts` — SSE stream handling
- `client/src/lib/useSSE.ts` — streaming parser
- `client/src/lib/authStorage.ts` — only the 3 tests above
- `client/src/lib/formatters.ts`
- All hooks: `useHasOrg`, `useTeamRole`, `useIsLoggedIn`, `usePageMeta`
- All pages: `Appraisal`, `Chat`, `Dashboard`, `Feedback`, `LogEntry`, `Onboarding`, `OrgSettings`, `Goals`, `Integrations`, `TeamGoals`, `ai-pulse/*`

No React Testing Library setup. No component render tests. No hook tests.

---

## E2E Test Paths — Critical User Flows Untested

There is no Playwright config and no E2E tests. Critical flows that should be E2E-tested:

1. **Sign up → email verify → log in** — happy path + expired token
2. **Create org → invite member → role change → RBAC enforcement** (a member of org A cannot see org B's data)
3. **Create team → add member → manager promotes a member to manager → that member can now edit a team goal**
4. **Create goal → add KR → check-in → progress updates → rollup** (end-to-end through the trigger)
5. **Link a JIRA issue to a goal → mark the issue done in JIRA → webhook fires → goal progress updates**
6. **Link a GitHub PR to a goal → close the PR → webhook fires → goal progress updates**
7. **Slack `/goals 1 75%` from an authorized user → goal progress updates in DB**
8. **Slack `/goals 1 75%` from an unauthorized user → "permission denied"**
9. **Token refresh: log in, wait for access token to expire, make a request → single refresh call, request succeeds**
10. **Password reset: request reset, use old refresh token after reset → 401 (token was revoked)**
11. **Webhook replay: send the same GitHub delivery ID twice → second call returns "Duplicate event"**
12. **Cross-tenant: org A user attempts to PATCH org B's goal via direct goalId → 403**

---

## Summary: Critical vs Nice-to-Have

### CRITICAL (would catch real, security-impacting bugs)

1. Webhook signature verification — pass/fail, replay, malformed input (security)
2. Auth: JWT tampering, refresh token revocation, missing user (auth)
3. Goal service: cycle detection in `setParent`, progress-mode guards, cross-org reparent (data integrity)
4. Team service: closure-table correctness on create/move/delete (data integrity, RBAC)
5. Token refresh race condition in `apiRequest` (UX, sessions)
6. RLS policies against a real Postgres (security last-line)
7. Static-analysis test for `req.supabase` without `req.userId` filter (privilege escalation)
8. `getEffectiveTeamRole` rank max (RBAC)

### IMPORTANT (would catch correctness/UX bugs)

9. Slack command handler — bounds, replay, cross-tenant
10. Integration adapters — error paths, 401/429
11. Jobs — timezone, repo allowlist, per-member error isolation
12. Client `apiRequest` — JSON parse failure, 401 redirect
13. Email enumeration prevention on `forgot-password` / `resend-verification`

### NICE-TO-HAVE

14. CORS preflight
15. Formatters, hooks
16. i18n message resolution
17. Component render snapshots

---

## Top 5 Tests to Add First

1. **`webhookSecurity` unit tests with real HMAC inputs** — would have caught the original `RangeError` on length-mismatch, and proves the fix is correct, not just present. Pure unit, no DB. Highest security ROI.

2. **Static analysis: `req.supabase` calls without `req.userId` scoping in `server/src/routes/*.ts`** — single regex-based test that scans all route files. Catches the most likely CVE class. Trivial to write.

3. **`getEffectiveTeamRole` and `canEditGoal` exhaustive branch tests** — table-driven unit tests with a mocked Supabase client covering all role combinations (member/manager/admin/owner × direct/ancestor/org). Pins the post-Bug-CP/Bug-N/Bug-D fixes. No DB needed.

4. **Goal `setParent` cycle + cross-org tests with a real Postgres (testcontainers or local)** — proves the advisory lock + cycle guard actually work, not just that the SQL contains the words. Catches regressions in the migration.

5. **Token refresh race test in `client/src/lib/api.ts`** — Vitest test that fires two parallel `apiRequest` calls that both return 401, asserts the underlying `fetch` to `/api/auth/refresh` was called **exactly once**, and that both original requests succeed with the new token. Pins the most likely production UX bug.

---

## Files referenced

- `D:\Vibe Coded\worklog-ai\server\src\__tests__\audit-fixes.test.ts`
- `D:\Vibe Coded\worklog-ai\client\test\authStorage.test.ts`
- `D:\Vibe Coded\worklog-ai\server\src\lib\webhookSecurity.ts`
- `D:\Vibe Coded\worklog-ai\server\src\middleware\auth.ts`
- `D:\Vibe Coded\worklog-ai\server\src\routes\auth.ts`
- `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\github.ts`
- `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\jira.ts`
- `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\slack.ts`
- `D:\Vibe Coded\worklog-ai\server\src\routes\goals.ts`
- `D:\Vibe Coded\worklog-ai\server\src\services\authz.ts`
- `D:\Vibe Coded\worklog-ai\server\src\services\goalService.ts`
- `D:\Vibe Coded\worklog-ai\server\src\services\teamService.ts`
- `D:\Vibe Coded\worklog-ai\client\src\lib\api.ts`
- `D:\Vibe Coded\worklog-ai\client\src\lib\authStorage.ts`
- `D:\Vibe Coded\worklog-ai\client\package.json`
- `D:\Vibe Coded\worklog-ai\supabase-migrations\2026-06-16_teams_goals_integrations.sql`
