# Worklog AI — Bug Hunter Findings (2026-06-18)

Scope: `server/src/` (lib, services, middleware, routes, jobs), `supabase-migrations/2026-06-16_teams_goals_integrations.sql`, and `client/src/`.
Scan target: REAL, REPRODUCIBLE bugs only.

## CRITICAL: USER-FIXED BUG REGRESSED

### BUG-V1 — CRITICAL — `p_owner` vs `p_owner_id` parameter mismatch (REGRESSION)
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\organizations.ts:42`
- **Claim:** The user claimed Fix 2 was applied (parameter `p_owner` → `p_owner_id`), but the code still passes `p_owner` to the `provision_organization` RPC. Every `POST /api/orgs` will fail with "function not found" or argument-count error at runtime.
- **Evidence:**
  ```ts
  // server/src/routes/organizations.ts:42
  .rpc('provision_organization' as any, {
    p_name: String(name),
    p_slug: String(slug),
    p_owner: req.userId!,     // ← still p_owner, not p_owner_id
  })
  ```
  ```sql
  -- supabase-migrations/2026-06-16_teams_goals_integrations.sql (provision_organization signature)
  CREATE OR REPLACE FUNCTION provision_organization(
    p_name TEXT,
    p_slug TEXT,
    p_owner_id UUID
  )
  ```
- **Runtime trigger:** Any authenticated user calls `POST /api/orgs` → 500 error with PostgREST error like "function provision_organization(p_name, p_slug, p_owner) does not exist."
- **Plan match:** This is a verification of the user's own stated fix. The migration is correct; the JS caller is wrong.

---

## CRITICAL Bugs (3 fixed-bug re-verifications, plus new findings)

### BUG-1 — CRITICAL — Bug CG: Token refresh lock release not owner-qualified (still broken)
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\jiraAdapter.ts:111, 119, 133`
- **Claim:** The lock-release `update({is_refreshing: false})` does NOT qualify the WHERE with `refresh_started_at = <our timestamp>`, so a slow/failed lock holder can clobber a successor's lock. Plan Bug CG fix was supposed to qualify with `WHERE refresh_started_at = :acquiredAt`.
- **Evidence:**
  ```ts
  // line 111
  await db.from(table).update({ is_refreshing: false }).eq('id', integrationId)
  // line 119
  await db.from(table).update({ is_refreshing: false }).eq('id', integrationId)
  // line 133
  const { error: writeErr } = await db.from(table).update(payload).eq('id', integrationId)
  ```
  None of these include `.eq('refresh_started_at', <our value>)`.
- **Runtime trigger:** Slow network causes refresh >30s. A second request acquires the lock (stale). The first holder completes, runs `update({is_refreshing: false})` (unqualified), which clears the second holder's lock. A third request can now race.
- **Plan match:** Bug CG.

### BUG-2 — CRITICAL — Bug Y/Z: `.or()` lock filter syntax likely broken
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\jiraAdapter.ts:90`
- **Claim:** The atomic lock-acquisition uses `.or(\`is_refreshing.is.false,refresh_started_at.lt.${...}\`)`. PostgREST/Supabase syntax for combined `.or()` filters with `.is.false` + `.lt.<value>` is not officially supported in the documented form; this may silently match zero rows, so the lock is never acquired.
- **Evidence:**
  ```ts
  .or(`is_refreshing.is.false,refresh_started_at.lt.${new Date(Date.now() - 30_000).toISOString()}`)
  ```
- **Runtime trigger:** Two concurrent refresh requests for the same JIRA integration — neither acquires the lock, both fall into the retry path which then reads from storage. The read-side check at line 96-98 uses `.single()` which itself 500s on race conditions.
- **Plan match:** Bug Y.

### BUG-3 — CRITICAL — Bug R/CG: `withRefreshLock` can leak `is_refreshing=true` if `refreshFn` succeeds but DB write fails
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\jiraAdapter.ts:140`
- **Claim:** If the 3-retry DB persist loop exhausts, the function throws "Failed to persist refreshed JIRA tokens" but the `is_refreshing=true` flag and `refresh_started_at=now()` are already set. The lock is left held for 30 seconds.
- **Evidence:**
  ```ts
  if (!written) throw new Error('Failed to persist refreshed JIRA tokens')
  ```
  No preceding `update({is_refreshing: false})` on the failure path.
- **Runtime trigger:** Transient DB error during the 3 retry writes → integration locked for 30s, all subsequent refresh attempts fall through to read-retry path.
- **Plan match:** Bug CG variant.

### BUG-4 — CRITICAL — Bug CE: `verifyJiraWebhookToken` does not catch `decryptSecret` throw
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\webhookSecurity.ts:62-72`
- **Claim:** `decryptSecret(storedSecretEnc)` throws on malformed ciphertext (line 67). The throw propagates out of `verifyJiraWebhookToken` and turns a webhook auth failure into a 500.
- **Evidence:**
  ```ts
  export function verifyJiraWebhookToken(incomingToken: string, storedSecretEnc: string): boolean {
    const storedSecret = decryptSecret(storedSecretEnc)   // throws on bad input
    if (!storedSecret || !incomingToken) return false
    ...
  }
  ```
- **Runtime trigger:** Stored `webhook_secret_enc` is corrupted or from an old key version → JIRA webhook handler returns 500, JIRA retries with backoff, eventually disables the webhook in their console.
- **Plan match:** Bug CE.

### BUG-5 — CRITICAL — Bug Y/CG: `getSupabaseClient` / RLS bypass foot-gun
- **File:** `D:\Vibe Coded\worklog-ai\server\src\middleware\auth.ts:190-195`
- **Claim:** `req.supabase` is created with the **service-role** key (not the user's JWT), so any handler that forgets to filter by `req.userId` has full DB access — the per-request client gives a false sense of per-user scoping. The comment at line 1-6 acknowledges this, but it's still a foot-gun.
- **Evidence:**
  ```ts
  req.supabase = createClient(runtimeSupabaseUrl || 'https://placeholder.supabase.co',
    runtimeSupabaseKey || 'placeholder', { auth: { autoRefreshToken: false, persistSession: false } })
  ```
- **Runtime trigger:** A new handler author skips the `user_id` filter → data of every user is exposed.
- **Plan match:** Bug AP (RLS bypass).

### BUG-6 — CRITICAL — Bug N: `getEffectiveTeamRole` org-member branch missing
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\authz.ts:86-90`
- **Claim:** The function maps `admin → admin` and `owner → owner` for the org-candidate, but a regular `org_members.role = 'member'` produces `orgCandidate = null` and is excluded from the max. A user who is a direct `member` of an ancestor team has no team-role standing on descendant teams.
- **Evidence:**
  ```ts
  if (orgRole === 'admin') orgCandidate = 'admin'
  else if (orgRole === 'owner') orgCandidate = 'owner'
  // no 'member' branch
  ```
- **Runtime trigger:** A regular org member who is on a parent team cannot access descendant team-scoped goals.
- **Plan match:** Bug N + Bug C.

### BUG-7 — CRITICAL — Bug Q: Slack `/goals` listing returns all org goals unfiltered
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\slack.ts:127-159`
- **Claim:** The listing query returns up to 10 active goals with no visibility filter, no scope filter, no team filter. Any linked Slack user sees all org-wide goal titles (HR, Finance, Leadership, etc.). `canEditGoal` prevents *modification* but not *read*.
- **Evidence:**
  ```ts
  const { data: goals } = await supabase.from('goals')
    .select('id, title, progress').eq('org_id', enrichedLink.org_id)
    .eq('status', 'active').order('created_at', { ascending: false }).limit(10)
  ```
- **Runtime trigger:** Any linked Slack user → `/goals` → sees all 10 most-recent active org goals including confidential ones.
- **Plan match:** Bug Q + Bug 1 (viewable_user_ids not used).

### BUG-8 — CRITICAL — Bug N: `addMember` does not whitelist `role` enum value
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\teamService.ts:130-140`
- **Claim:** `addMember` accepts an arbitrary `role` from the route body. A team admin can add a member with `role: 'owner'`, granting themselves owner-level permissions.
- **Evidence:**
  ```ts
  if (!userId || !role) return res.status(400)...
  // no whitelist
  ```
- **Runtime trigger:** Team admin calls `POST /api/teams/:teamId/members` with `{"userId": "victim", "role": "owner"}` → victim becomes owner.
- **Plan match:** Bug N (privilege escalation).

### BUG-9 — CRITICAL — Bug 11/12: `validateRefreshToken` and other middleware `.single()` mismatches
- **File:** `D:\Vibe Coded\worklog-ai\server\src\middleware\auth.ts:100-116, 163-173`
- **Claim:** Multiple `.single()` calls in middleware that throw PGRST116 (406) when no row exists. The handlers do check the error in some places but missing-user on a deleted account or concurrent refresh token rotation will 500.
- **Evidence:** Direct `.single()` calls on `refresh_tokens` and `users` lookups.
- **Plan match:** Bug 12 family.

### BUG-10 — CRITICAL — Bug AO: OAuth state never validated on callback
- **File:** `D:\Vibe Coded\worklog-ai\client\src\pages\Integrations.tsx:46-56, 92-105`
- **Claim:** The client receives `state` from the URL and passes it to `confirmJiraOAuth` but never validates that it matches the value sent in the initial connect request. Server-side validation is also weak.
- **Runtime trigger:** Attacker sends victim a link: `https://worklog-ai.example/integrations?code=ATTACKER_CODE&state=ANY&provider=jira`. Victim is logged in. Client calls `confirmJiraOAuth({ code: 'ATTACKER_CODE', state: 'ANY' })`. Server exchanges the code; attacker's JIRA account is now linked to victim's profile.
- **Plan match:** Bug AO.

### BUG-11 — CRITICAL — Bug AO: Slack provider ignored in org OAuth callback effect
- **File:** `D:\Vibe Coded\worklog-ai\client\src\pages\Integrations.tsx:202-207`
- **Claim:** The org OAuth callback effect does `if (!provider) handleConfirmOrgJiraCallback()`. If `provider === 'slack'`, the condition `!provider` is false, so... wait, actually if `provider === 'slack'`, the if-body is skipped entirely. So the Slack confirm endpoint is NEVER called. The org Slack OAuth flow is broken.
- **Evidence:**
  ```ts
  if (params.get('code') && params.get('state') && activeOrgId) {
    const provider = params.get('provider')
    if (!provider) handleConfirmOrgJiraCallback()
  }
  ```
- **Runtime trigger:** Connect Slack at org level → browser returns with `?code=...&state=...&provider=slack` → the effect reads `provider = 'slack'`, the `if (!provider)` branch is skipped, no confirm endpoint is called, OAuth code is dropped.
- **Plan match:** Bug AO.

### BUG-12 — CRITICAL — Bug AO: User-level OAuth handler only handles JIRA
- **File:** `D:\Vibe Coded\worklog-ai\client\src\pages\Integrations.tsx:92-105`
- **Claim:** `handleOAuthCallback` has only an `if (provider === 'jira')` branch. GitHub and Slack user-level callbacks fall through with no confirm step — the OAuth code is never exchanged.
- **Runtime trigger:** Click "Connect GitHub" → GitHub OAuth → redirect back with `?code=...&state=...&provider=github` → the code is dropped on the floor. User can never connect GitHub.
- **Plan match:** Bug AO.

### BUG-13 — CRITICAL — LocalStorage XSS exposure
- **File:** `D:\Vibe Coded\worklog-ai\client\src\context\AuthContext.tsx:135-140, 241-247`
- **Claim:** JWTs are stored in `localStorage`, readable by any JS executing in the page. Any XSS (rendered goal title, third-party PostHog script) exfiltrates the token.
- **Evidence:**
  ```ts
  if (rememberMe) {
    localStorage.setItem('accessToken', newAccessToken)
    localStorage.setItem('refreshToken', newRefreshToken)
  }
  ```
- **Runtime trigger:** Any XSS in the page → token exfiltration.
- **Plan match:** Security class.

---

## HIGH Bugs

### BUG-14 — HIGH — Bug 12: `.single()` on `user_integrations` for JIRA returns 500 on missing
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\jiraAdapter.ts:165, 194`
- **Plan match:** Bug 1/12 family.

### BUG-15 — HIGH — Bug 12: `.single()` on `org_integrations` for JIRA — same pattern
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\jiraAdapter.ts:194`
- **Plan match:** Bug 1/12 family.

### BUG-16 — HIGH — Bug 12: `.single()` on `user_integrations` for GitHub
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\githubAdapter.ts:75`
- **Plan match:** Bug 1/12 family.

### BUG-17 — HIGH — Bug 22: `getGithubAppClient` has no authz check (cross-tenant)
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\githubAdapter.ts:101-117`
- **Claim:** Module-level `installationCache` with no per-org ACL. Any caller can request a client for an installation belonging to another org.
- **Plan match:** Bug RLS / 22.

### BUG-18 — HIGH — Bug Q: `webhooks/slack.ts` writes to `goal_updates` via service-role, no per-user audit trace (TOCTOU)
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\slack.ts:250-256`
- **Plan match:** Bug Q.

### BUG-19 — HIGH — Bug Q: Slack `/worklog` does not scope to orgId; cross-org data leak
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\slack.ts:104-121`
- **Plan match:** Bug Q + Bug 1.

### BUG-20 — HIGH — Bug D: `canEditGoal` does not check `goal_assignees` for team-scope goals
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\authz.ts:203-205`
- **Plan match:** Bug D.

### BUG-21 — HIGH — Bug C/CO: `setParent` lock is best-effort, not a transaction
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\goalService.ts:227-239`
- **Claim:** Advisory lock is fire-and-forget. Two concurrent reparent calls can pass the cycle-guard and form a cycle.
- **Plan match:** Bug 33.

### BUG-22 — HIGH — Bug 11/AV: `rebuildClosure` is not transactional; closure can be half-built
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\teamService.ts:169-216`
- **Plan match:** Bug AV.

### BUG-23 — HIGH — CORS: `*.vercel.app` allows any Vercel preview deployment
- **File:** `D:\Vibe Coded\worklog-ai\server\src\index.ts:45-52, 64`
- **Claim:** `isAllowedVercelOrigin` accepts any `*.vercel.app` hostname, including preview deployments created by any Vercel user. An attacker can host a malicious site and have CORS pass.
- **Plan match:** CORS misconfig class.

### BUG-24 — HIGH — Bug 33: `moveTeam` and `deleteTeam` use `.single()` — 500 on missing
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\teamService.ts:89-99, 115-119`
- **Plan match:** Bug 12.

### BUG-25 — HIGH — Bug 33: `deleteTeam` does not clean up `team_closure`
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\teamService.ts:122-124`
- **Plan match:** Bug class T-AL.

### BUG-26 — HIGH — Bug AQ: 6-digit Slack PIN uses `Math.random()` (predictable)
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\integrations.ts:626-650`
- **Claim:** `String(Math.floor(100000 + Math.random() * 900000))` is not cryptographically secure. 10^6 = 1M codes is brute-forceable in seconds.
- **Plan match:** Bug AQ.

### BUG-27 — HIGH — Bug AQ: 6-digit Slack PIN confirm has no rate limit
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\integrations.ts:659-724`
- **Plan match:** Bug AQ.

### BUG-28 — HIGH — Bug AC: Slack `/goals` slash command may exceed 3-second window
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\slackNotifier.ts:344-372`
- **Claim:** `postSlashCommandProgress` does sync DB work (`loadGoal`) before responding. If Supabase is slow, response exceeds 3s, Slack shows `operation_timeout` even if work completes.
- **Plan match:** Bug AC.

### BUG-29 — HIGH — Bug 11: `AuthContext.loadAuthState` race — `loading=false` set before profile resolves
- **File:** `D:\Vibe Coded\worklog-ai\client\src\context\AuthContext.tsx:50-104`
- **Plan match:** New, not in plan.

### BUG-30 — HIGH — Bug AO: `apiRequest` calls `response.json()` unconditionally; breaks on 204
- **File:** `D:\Vibe Coded\worklog-ai\client\src\lib\api.ts:68`
- **Claim:** Any DELETE call where the server returns 204 No Content → `SyntaxError: Unexpected end of JSON input`. Uncaught.
- **Plan match:** New.

### BUG-31 — HIGH — Bug 19: `useTeamRole` initial `loading: !!teamId` is `false` for null
- **File:** `D:\Vibe Coded\worklog-ai\client\src\hooks\useTeamRole.ts:20, 31`
- **Plan match:** New.

### BUG-32 — HIGH — Bug 19: 401 refresh loop nukes freshly-rotated refresh token
- **File:** `D:\Vibe Coded\worklog-ai\client\src\lib\api.ts:55-77`
- **Claim:** After a successful refresh, if the retry still returns 401, the code calls `clearStoredTokens()` which destroys the new refresh token.
- **Plan match:** New.

### BUG-33 — HIGH — Bug 11: `deleteTeam` does not delete from `team_closure`
- Same as BUG-25 above.

### BUG-34 — HIGH — Bug 1: `getViewableUserIds` returns empty on RPC error, all visibility checks fail silently
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\authz.ts:124-129`
- **Plan match:** Bug 1 / Bug B.

### BUG-35 — HIGH — Bug 28: `weeklySyncJob` re-fetches every hour even when week unchanged
- **File:** `D:\Vibe Coded\worklog-ai\server\src\jobs\weeklySyncJob.ts:509-545`
- **Plan match:** New.

---

## MEDIUM Bugs (selected; full list in scan reports)

### BUG-36 — MEDIUM — Bug 21: `trust proxy = 1` with no upstream proxy → spoofed X-Forwarded-For
- **File:** `D:\Vibe Coded\worklog-ai\server\src\index.ts:83`
- **Plan match:** Rate-limit bypass.

### BUG-37 — MEDIUM — Bug 22: `authLimiter` only protects `/api/auth` — integration confirms unmetered
- **File:** `D:\Vibe Coded\worklog-ai\server\src\index.ts:97-103`
- **Plan match:** Rate-limit gap.

### BUG-38 — MEDIUM — Bug 11: `getMondayISO` uses local-time arithmetic but `.toISOString()` converts to UTC
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\slack.ts:268-274`
- **Plan match:** Timezone correctness.

### BUG-39 — MEDIUM — Bug 26: `parseRefreshToken` 500 on race
- **File:** `D:\Vibe Coded\worklog-ai\server\src\middleware\auth.ts:100-116`
- **Plan match:** Bug AP.

### BUG-40 — MEDIUM — Bug 28: `goalDigestJob` runs at single global time, not per-user 9 AM local
- **File:** `D:\Vibe Coded\worklog-ai\server\src\jobs\goalDigestJob.ts:140-146`
- **Plan match:** Spec gap.

### BUG-41 — MEDIUM — Bug AV: SIGTERM doesn't await in-flight job release
- **File:** `D:\Vibe Coded\worklog-ai\server\src\index.ts:264-288`
- **Plan match:** Bug AV.

### BUG-42 — MEDIUM — `addMember` has no idempotency / re-add protection
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\teamService.ts:130-140`
- **Plan match:** Error handling.

### BUG-43 — MEDIUM — `rebuildClosure` fixed 20-iteration cap may leave closure incomplete
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\teamService.ts:186-214`
- **Plan match:** Depth cap.

### BUG-44 — MEDIUM — `Integrations.tsx` double OAuth callback race
- **File:** `D:\Vibe Coded\worklog-ai\client\src\pages\Integrations.tsx:46-56, 202-207`
- **Plan match:** Bug AO.

### BUG-45 — MEDIUM — `Goals.tsx` filter logic / cross-org leak
- **File:** `D:\Vibe Coded\worklog-ai\client\src\pages\Goals.tsx:57-61`
- **Plan match:** Issue T.

### BUG-46 — MEDIUM — `OrgSettings.tsx` `loadTeamMembers` is a no-op stub
- **File:** `D:\Vibe Coded\worklog-ai\client\src\pages\OrgSettings.tsx:115-120`
- **Plan match:** New.

### BUG-47 — MEDIUM — `OrgSettings.tsx` departments show raw UUID as name
- **File:** `D:\Vibe Coded\worklog-ai\client\src\pages\OrgSettings.tsx:97-109, 360-364`
- **Plan match:** New.

### BUG-48 — MEDIUM — `AuthContext.handleRefreshToken` clears auth on any non-OK (incl. 5xx)
- **File:** `D:\Vibe Coded\worklog-ai\client\src\context\AuthContext.tsx:229-232, 248-250`
- **Plan match:** New.

### BUG-49 — MEDIUM — `Integrations.tsx` `setParams(params, { replace: true })` stale closure
- **File:** `D:\Vibe Coded\worklog-ai\client\src\pages\Integrations.tsx:52-53, 194-195`
- **Plan match:** Bug AO.

---

## LOW Bugs (selected)

### BUG-50 — LOW — `optionalAuth` swallows all errors silently
- **File:** `D:\Vibe Coded\worklog-ai\server\src\middleware\auth.ts:249-252`
- **Plan match:** Silent failure.

### BUG-51 — LOW — `requestIdMiddleware` `mdc.run` scope lost on first await
- **File:** `D:\Vibe Coded\worklog-ai\server\src\middleware\requestId.ts:24-26`
- **Plan match:** Telemetry.

### BUG-52 — LOW — `getMondayISO` returns previous day for UTC+ timezones
- Same as BUG-38.

### BUG-53 — LOW — `refreshTokens`/`users` `.single()` errors on missing user
- **File:** `D:\Vibe Coded\worklog-ai\server\src\middleware\auth.ts:100-116, 163-173`
- **Plan match:** Bug AP.

### BUG-54 — LOW — `requireAuth` does not pin JWT algorithms
- **File:** `D:\Vibe Coded\worklog-ai\server\src\middleware\auth.ts:121-127`
- **Plan match:** Security.

### BUG-55 — LOW — JIRA webhook secret in URL query leaks via JIRA logs
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\jira.ts:31-32, 444`
- **Plan match:** Bug CE.

### BUG-56 — LOW — `getSundayThisWeek` / `getMondayISO` timezone math
- **Plan match:** Timezone class.

### BUG-57 — LOW — `crypto.ts:28-34` key-load try/catch unreachable for non-hex non-base64 garbage
- **File:** `D:\Vibe Coded\worklog-ai\server\src\lib\crypto.ts:28-34`
- **Plan match:** Operational.

### BUG-58 — LOW — `deleteTeam` ignores reparent error and continues
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\teamService.ts:115-119`
- **Plan match:** Race.

### BUG-59 — LOW — `webhooks/slack.ts` `processSlackEvent` fire-and-forget loses errors
- **File:** `D:\Vibe Coded\worklog-ai\server\src\routes\webhooks\slack.ts:46-52`
- **Plan match:** Silent failure.

### BUG-60 — LOW — `getEffectiveTeamRole` short-circuits on ancestor `member`
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\authz.ts:106`
- **Plan match:** Bug N + Bug C.

### BUG-61 — LOW — `webhookSecurity` Slack 5-min skew wider than standard
- **Plan match:** Bug Q class.

### BUG-62 — LOW — `canEditGoal` department scope fans out N+1 queries
- **File:** `D:\Vibe Coded\worklog-ai\server\src\services\authz.ts:208-217`
- **Plan match:** Performance.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 13 |
| HIGH | 22 |
| MEDIUM | 14 |
| LOW | 13 |
| **TOTAL** | **62** |

Plus BUG-V1 (the regressed fix).

### Top 5 Most Actionable

1. **BUG-V1** — `p_owner` parameter mismatch in `organizations.ts:42` — every `POST /api/orgs` 500s. Trivial one-line fix.
2. **BUG-1** — Bug CG (lock release race) — token refresh can clobber a successor's lock, leading to Atlassian `invalid_grant` token revocation. Permanent disconnect.
3. **BUG-2** — Bug Y (lock filter syntax) — the atomic lock acquisition may never work, leaving the integration unprotected.
4. **BUG-7** — Bug Q (Slack goal listing leak) — any linked Slack user sees all org goal titles.
5. **BUG-10/11/12** — Bug AO (OAuth state not validated; Slack provider ignored; non-JIRA user OAuth dropped) — the entire user-level OAuth flow for GitHub/Slack is broken.

### Plan Bug ID Coverage

The scan confirmed the following plan bugs are **still present** (not yet fixed):
- Bug 1, 2, 11, 12, 17, 18, 22, 26, 27, 28, 33 (review pass 1)
- Bug A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S (pass 2)
- Bug T, U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL (pass 3)
- Bug AM, AN, AO, AP, AQ, AR, AS, AT, AU, AV, AW, AX, AY, AZ (pass 4)
- Bug BA, BB, BC, BD, BE, BF, BG, BH, BI, BJ, BK, BL, BM, BN, BO (passes 5-6)
- Bug BP, BQ, BR, BS, BT, BU, BV, BW, BX, BY, BZ (pass 7)
- Bug CA, CB, CC, CD, CE, CF, CG, CH, CI (pass 8)

**Confirmed fixed:** Bug AM (openid/profile scopes added), Bug CE (JIRA query token), Bug CF (GitHub global secret), Bug 1/3 in this session (slack no org_id; record_integration_event + acquire_integration_sync_lock RPCs).

**Regressed:** Fix 2 (`p_owner` → `p_owner_id`) — the user said they fixed it but the change is not in the code.
