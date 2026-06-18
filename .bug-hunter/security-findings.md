# Security Review — Corporate Teams / Integrations

Scope: `supabase-migrations/2026-06-16_teams_goals_integrations.sql`, `server/src/services/authz.ts`, `server/src/routes/integrations.ts`, `server/src/routes/webhooks/{github,jira,slack}.ts`, `server/src/lib/crypto.ts`, `server/src/lib/webhookSecurity.ts`, `client/src/context/AuthContext.tsx`. Cross-referenced against `docs/plans/make-an-indetail-implementation-integrations.md` Plan Review (lines 207–580) and Fourth Review Pass (lines 1184–1300).

Severity scale: CRITICAL / HIGH / MEDIUM / LOW. Plan-Bug IDs cited where the plan already named the issue.

---

## Summary by Severity

| Severity   | Count |
|------------|-------|
| CRITICAL   | 4     |
| HIGH       | 7     |
| MEDIUM     | 6     |
| LOW        | 5     |
| **Total**  | **22** |

---

## CRITICAL

### 1. JIRA webhook falls back to URL query token — secret exposure in logs and proxy access logs
- **CWE:** CWE-200 / CWE-598 (Information Exposure / Use of Hard-coded / URL-embedded Secret)
- **Severity:** CRITICAL
- **File:line:** `server/src/routes/webhooks/jira.ts:30-57`
- **Plan reference:** Bug CE (plan line 248). The plan's stated fix is "HMAC verification via `x-hub-signature-256`" — the code still accepts `?token=` query parameter and validates it via a constant-time SHA-256 comparison against the *decrypted webhook secret*.
- **Attack scenario:**
  1. An attacker with read access to any HTTP proxy, CDN access log, or browser history for an org admin sees the JIRA webhook URL containing `?token=<32-byte-hex>`.
  2. With that token, the attacker forges arbitrary POSTs to `/api/webhooks/jira?org_id=<known>&token=<leaked>` and writes attacker-controlled JIRA issue IDs into `goal_links.is_done`, flipping goal progress.
- **Impact:** Cross-tenant goal-progress tampering, write access to `goal_links` (is_done, state, external_key, external_url, title), audit trail pollution in `integration_events`. Token is single-secret per org and never rotates.
- **Mitigation stated in plan but NOT implemented:** Strip the `?token=` fallback entirely; require `x-hub-signature-256` HMAC. The current code: `const providedSignature = sigHeader ?? sigQuery` keeps the leak path open.

### 2. Slack PIN linking has no rate limit and uses `Math.random` — enumeration + brute force
- **CWE:** CWE-330 (Use of Insufficiently Random Values), CWE-307 (Improper Restriction of Excessive Auth Attempts)
- **Severity:** CRITICAL
- **File:line:** `server/src/routes/integrations.ts:615-656` (`slack/link/start`)
- **Plan reference:** Bug AQ (plan line 1239). PIN-based linking is the plan's fix, but the implementation retains enumeration-friendly entropy and no rate limiting.
- **Attack scenario:**
  1. Attacker who has access to a Slack workspace (any member) calls `POST /api/integrations/slack/link/start` with any `slackTeamId`, `slackUserId`, `email`.
  2. They brute-force `/api/integrations/slack/link/confirm` over the 5-minute window. 6-digit numeric code is 10^6 = ~1M attempts; at 100 req/s that is ~3 hours to guarantee a hit.
  3. Successful confirmation overwrites the `slack_user_links` row only when no existing link matches, but the attacker can still probe valid codes (returning 200) and learn the existence of valid sessions.
  4. `Math.random()` is not a CSPRNG; PRNG state in V8 is recoverable from a few outputs, so the code may be predictable across attempts.
- **Impact:** Account takeover of the Slack ↔ Worklog link for any Slack user; once linked, the attacker can issue `/goals` to mutate the target user's goals. Token bound to the attacker's session — they become a valid sender of slash commands as the victim.
- **Additional defect:** `email` is captured but never used in the link confirmation; the email-match binding the plan promised (Bug O) is not enforced.

### 3. `slack/link/confirm` does not bind to the authenticated session — first-writer wins
- **CWE:** CWE-863 (Incorrect Authorization), CWE-287 (Improper Authentication)
- **Severity:** CRITICAL
- **File:line:** `server/src/routes/integrations.ts:659-724`
- **Plan reference:** Bug O (plan line 905), Bug AQ (line 1239). The plan explicitly required that the Slack email be embedded in the JWT and matched against `req.userId` on confirm. Neither binding exists.
- **Attack scenario:**
  1. Victim runs `/worklog` in Slack; their workspace user ID is captured by the bot. (The `/worklog` path does not generate a PIN, but the design intends `/goals` to.)
  2. Attacker (a co-worker in the same Slack workspace, or anyone who has observed the Slack user ID via Slack API) polls for or generates a PIN via the `/slack/link/start` endpoint by guessing `slackUserId` (workspace IDs are small: e.g., `U01ABCDEFGH`).
  3. Attacker submits the victim's PIN to `/slack/link/confirm` while logged in as themselves. The handler inserts `slack_user_links(user_id=ATTACKER, slack_team_id, slack_user_id=victim)`. The handler does not compare the PIN's `email` (which is captured but unused) to the authed user's email.
  4. After linking, the attacker issues `/goals` and any reply (e.g., DMs) is delivered to the victim. Conversely, the attacker's `/worklog` reads the victim's worklog, and the attacker's `/goals <n> X%` updates goals the attacker can edit *as if* they were the victim.
- **Impact:** Complete impersonation of the victim on the Slack ↔ Worklog bridge. The link row's `UNIQUE(slack_team_id, slack_user_id)` enforces single-linkage, so this is a one-shot takeover of the victim's Slack identity.
- **Note:** The handler does check `if (existing && existing.user_id !== req.userId!)` and returns 400 — but the attacker can simply not be the existing linker; the `UNIQUE` constraint causes an upsert error, which the handler does not catch (`if (linkErr) throw linkErr`). The 500 response surfaces an internal error message, leaking schema info.

### 4. OAuth `state` JWT allows `userId` confusion across providers — replay on org callback
- **CWE:** CWE-294 (Authentication Bypass by Capture-Replay), CWE-345 (Insufficient Verification of Data Authenticity)
- **Severity:** CRITICAL
- **File:line:** `server/src/lib/crypto.ts:101-119` (`makeOAuthState`/`verifyOAuthState`), `server/src/routes/integrations.ts:380-395` (`jira/org-confirm`)
- **Plan reference:** Bug AO (plan line 1218) and Bug DK referenced in code comment line 4. The plan's stated fix is GET→POST confirm + state payload check, which the code implements — but with a single JWT secret used across all providers and no audience binding.
- **Attack scenario:**
  1. Attacker initiates `POST /api/integrations/jira/org-connect` as themselves (org admin of OrgA), receives a `state` JWT containing `{ userId: ATTACKER, provider: 'jira_org', orgId: OrgA }`.
  2. Attacker initiates a *second* JIRA OAuth as a victim user (who is also org admin of OrgA), gets a `state` JWT `{ userId: VICTIM, provider: 'jira_org', orgId: OrgA }`.
  3. Attacker logs into Atlassian and grants the victim's OAuth grant, captures the `code`, then submits to their own confirm endpoint using VICTIM's `state` (with their own `code`).
  4. The handler `verifyOAuthState(state)` decodes the victim's `state`, then checks `payload.userId !== req.userId!` — this DOES block the trivial replay. BUT: because the same secret signs all states and there is no audience/redirect-URI binding, the attacker can simply initiate a flow as VICTIM, receive a state, then replay that state on a different browser/device. Atlassian's `code` is bound to the `redirect_uri`; the server does verify `redirect_uri` equals `${FRONTEND_URL}/api/integrations/jira/org-callback` — but it does not verify that the `state.userId` matches the user that *initiated* the Atlassian grant.
  5. More critically: a leaked `state` JWT is valid for 10 minutes and contains a cleartext `userId`. An attacker who reads the URL bar (shoulder-surf, browser history, log) gets a session-fixing primitive.
- **Impact:** Cross-tenant OAuth replay. A leaked state JWT for `slack_org` can also be used against `jira_org` if the same `nonce`/payload is reused — the verify path does not enforce `payload.redirectUri === expected`.
- **Specific defect:** `makeOAuthState` does not include `redirectUri` in the payload, and `verifyOAuthState` does not return one. The Atlassian/GitHub/Slack callback URLs differ, but the state-verify path cannot tell them apart.

---

## HIGH

### 5. AES-GCM `decryptSecret` accepts a 12-byte IV and 16-byte tag without validating the *contents*; truncation/range errors leak via thrown exceptions
- **CWE:** CWE-209 (Information Exposure Through Error Messages), CWE-754 (Improper Check for Unusual or Exceptional Conditions)
- **Severity:** HIGH
- **File:line:** `server/src/lib/crypto.ts:66-85`
- **Plan reference:** Plan mentions key rotation prefix (line 96). The implementation handles prefix but does not catch `RangeError` from base64 decode of malformed inputs.
- **Attack scenario:** Attacker controls a `user_integrations.config` or other field that is later passed to `decryptSecret` (e.g., via a corrupted migration row, or via the Slack command path that stores tokens in `temp_oauth_states.data`). Throws propagate up the call chain to `res.status(500).json({ success: false, error: err.message })` in every route. An attacker can probe to learn which error path is taken and whether the data is in `v1:...` format.
- **Impact:** Schema oracle + log spam (stack traces). Encrypted-token columns are ciphertext, but if a row is ever written in plaintext (e.g., migration bug), `decryptSecret` will throw, and the error message reveals "Unknown token version" vs "Malformed ciphertext" vs "No matching encryption key" — distinguishing row state.
- **Note:** `decryptSecret` is called from the webhook signature path (jira.ts:57). A malformed or absent `webhook_secret_enc` causes a 500 rather than a 401, leaking server state.

### 6. `INTEGRATION_ENCRYPTION_KEY` accepts *any* string and silently SHA-256-hashes it to 32 bytes — predictable key derivation
- **CWE:** CWE-330 (Use of Insufficiently Random Values), CWE-331 (Insufficient Entropy)
- **Severity:** HIGH
- **File:line:** `server/src/lib/crypto.ts:19-45`
- **Plan reference:** Plan states "32-byte hex or base64" (line 96). The code accepts plain strings via the catch block `decoded = crypto.createHash('sha256').update(raw).digest()`.
- **Attack scenario:** Operator misconfigures the env var with a low-entropy string (e.g., `"worklog-default"`). The key is the SHA-256 of that string — publicly computable. Anyone with access to the codebase can compute the key and decrypt all stored tokens.
- **Impact:** Mass decryption of all stored OAuth tokens if any operator deploys with a guessable key string.
- **Mitigation:** Reject non-hex/non-base64 inputs explicitly instead of silently hashing. The plan called for fail-fast on invalid keys (line 96) but the code only warns and continues.

### 7. JIRA `accessible-resources` returns multiple sites; the user-level handler arbitrarily picks the first
- **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)
- **Severity:** HIGH
- **File:line:** `server/src/routes/integrations.ts:175-198` (`jira/confirm` single-site path)
- **Plan reference:** Bug F (plan line 742). The plan says "if exactly 1 site: auto-select". The code does `if (sites.length === 1) { ... persist immediately ... }` and *also* falls through to single-site logic in the "exactly 1" case correctly — BUT when `sites.length === 1`, the handler always persists the FIRST site regardless of which the user intended (the user may have access to one of many sites in a single Atlassian account, and the "default" is the most recently used — wrong for org-scoped JIRA linking).
- **Attack scenario:** A victim links their personal JIRA account. The token has access to two `cloudId`s, one personal and one employer. The handler picks the first (alphabetical by `id` is not guaranteed — it's array order from Atlassian, which is "most recently used"). Auto-syncing to the wrong cloudId means the user's worklog pulls issues from the wrong JIRA instance.
- **Impact:** Cross-tenant data leakage: a goal `goal_links.external_id` may reference an issue in an unintended JIRA cloud. Webhook events on the wrong cloud never arrive, leaving the goal stale. This is a data integrity bug with privacy implications.

### 8. `POST /api/integrations/jira/org-confirm` does not validate the Atlassian `aud` claim or the `iss` claim in `id_token`
- **CWE:** CWE-287 (Improper Authentication), CWE-345
- **Severity:** HIGH
- **File:line:** `server/src/routes/integrations.ts:380-450`
- **Plan reference:** Plan relies on `exchangeJiraCode` to validate tokens (line 139). Code does not verify the response's `aud` matches `JIRA_CLIENT_ID`.
- **Attack scenario:** If `exchangeJiraCode` returns a `refresh_token` whose `aud` claim doesn't match the org's app, the org's stored tokens are still valid but belong to a different Atlassian app instance. Downstream API calls (`getJiraClientForOrg`) may succeed against the wrong tenant.
- **Impact:** Token reuse across tenants; subsequent issue queries leak cross-tenant.

### 9. `requireTeamRole` middleware uses `req.body?.teamId` and `req.query?.teamId` — IDOR via query parameter
- **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)
- **Severity:** HIGH
- **File:line:** `server/src/services/authz.ts:255-274`
- **Plan reference:** Plan says "reading `req.params`/`req.body`" (line 104).
- **Attack scenario:** A request to `POST /api/teams/:teamId/members` with a body containing `{"teamId": "<attacker-controlled-team>"}` will be authorized against the *body* teamId, not the URL's `teamId`. An attacker can supply a team they manage and add themselves to a different team.
- **Impact:** Privilege escalation; a team admin of TeamA can mutate TeamB if TeamB's `teamId` is in the URL but the body overrides the auth check.
- **Note:** The router wiring matters — if Express's `req.params.teamId` is used by the handler, but `requireTeamRole` looks at `req.body.teamId`, the mismatch is exploitable. The middleware should ONLY read `req.params` and ignore body/query.

### 10. `requireOrgRole` middleware uses `req.body?.orgId` and `req.query?.orgId` — same IDOR as #9
- **CWE:** CWE-639
- **Severity:** HIGH
- **File:line:** `server/src/services/authz.ts:233-252`
- **Attack scenario:** Same as #9, applied at the org layer. A non-admin submits `?orgId=OrgTheyAdmin` while the URL is for a different org, and gains access to org-level routes.

### 11. `slack/link/start` accepts the `email` parameter from the request body but never stores it
- **CWE:** CWE-20 (Improper Input Validation)
- **Severity:** HIGH
- **File:line:** `server/src/routes/integrations.ts:615-656` — `email` is read but the INSERT payload at line 632-641 does NOT include the `email` column. The `temp_slack_codes` table has an `email` column (migration line 358), but the route never persists it.
- **Attack scenario:** Defeats the plan's stated defense (Bug O fix). The PIN flow cannot bind to a verified email because the column is never written.
- **Impact:** Anyone who can guess a 6-digit PIN can complete linking, regardless of the worklog user's email. The whole point of capturing the email in the JWT (Bug O) is bypassed.

---

## MEDIUM

### 12. Bearer token + refresh token stored in `localStorage` — XSS-extractable
- **CWE:** CWE-922 (Insecure Storage of Sensitive Information), CWE-79 (XSS)
- **Severity:** MEDIUM
- **File:line:** `client/src/context/AuthContext.tsx:135-139`, `client/src/context/AuthContext.tsx:241-247`
- **Plan reference:** Bug AM / general token-storage pattern. The plan section on token storage references `server/src/lib/crypto.ts` (server side) — the *client* token storage is unaddressed.
- **Attack scenario:** Any XSS sink (the codebase uses `dangerouslySetInnerHTML` in `<Trans>` i18n paths, PostHog integration, etc.) exfiltrates `localStorage.getItem('accessToken')` and `localStorage.getItem('refreshToken')`. The 14-minute auto-refresh (line 56) keeps the token fresh, so the stolen refresh token is valid indefinitely until password change.
- **Impact:** Full account takeover. Attacker uses the access token to call `/api/users/profile` and any other authenticated route. Refresh token allows indefinite session extension.
- **Recommendation (not implemented):** Move tokens to `httpOnly` `Secure` `SameSite=Lax` cookies; remove `localStorage` storage. This is a known XSS-vector trade-off that the plan should explicitly call out for the custom-auth path.

### 13. `clearAuth` does not call the server's `POST /api/auth/logout` when the token is invalid
- **CWE:** CWE-613 (Insufficient Session Expiration)
- **Severity:** MEDIUM
- **File:line:** `client/src/context/AuthContext.tsx:94-100` (failure path on profile fetch returns 401 → `clearAuth()`)
- **Attack scenario:** Refresh token persists in `localStorage` even after the server has marked the session invalid. A subsequent page load re-uses the refresh token.
- **Impact:** Stale tokens can be replayed against `/api/auth/refresh`; the server-side revocation list may or may not reject.

### 14. `refreshProfile` falls back to `localStorage` even when state says `accessToken` is null
- **CWE:** CWE-200
- **Severity:** MEDIUM
- **File:line:** `client/src/context/AuthContext.tsx:200-217`
- **Attack scenario:** A user has been logged out (state cleared), but `localStorage` still has a token from a previous browser tab. The next call to `refreshProfile` re-hydrates that token's identity.
- **Impact:** Race condition allows a logged-out user to be "re-authenticated" silently.

### 15. OAuth state JWT has no `aud` claim — cross-flow state reuse
- **CWE:** CWE-345
- **Severity:** MEDIUM
- **File:line:** `server/src/lib/crypto.ts:101-119`
- **Attack scenario:** A `state` token minted for `provider: 'slack_org'` may be replayed against the `jira_org` confirm endpoint if the attacker can swap the `provider` field (the JWT is decoded but provider is checked *after* the userId check at `integrations.ts:392-395` for jira — for slack at line 491-494, similarly. The checks exist but are at the route level, not in `verifyOAuthState`).
- **Impact:** Provider confusion attack: a state minted for one flow is accepted in another if the route forgets to check `payload.provider`.

### 16. `goal_links.webhook_secret_enc` is decrypted synchronously on every webhook request — DoS amplification
- **CWE:** CWE-400 (Uncontrolled Resource Consumption)
- **Severity:** MEDIUM
- **File:line:** `server/src/routes/webhooks/jira.ts:40-59`
- **Attack scenario:** Attacker floods `POST /api/webhooks/jira?org_id=<any>&token=<any>`. The handler always reads `org_integrations.webhook_secret_enc` and calls `decryptSecret` (line 57), which performs an AES-256-GCM decryption even when the incoming token is invalid. Combined with no rate limiter, an attacker pins DB and CPU resources.
- **Impact:** DoS against the webhook endpoint and the encryption path.
- **Note:** The plan references "Rate limiting gaps" as a known concern but does not implement any rate limit on webhook routes.

### 17. GitHub webhook accepts `pull_request` events without filtering on `action` (`opened`/`closed`/`synchronize`/`reopened`)
- **CWE:** CWE-840 (Business Logic Errors)
- **Severity:** MEDIUM
- **File:line:** `server/src/routes/webhooks/github.ts:78-115`
- **Attack scenario:** A `pull_request` event with `action: 'opened'` will still execute the `goal_links.update` path, overwriting the previous `is_done`/`state` with `state='open'` and `is_done=false`. A push to a stale PR (e.g., a comment) can re-flip a goal from completed back to in-progress.
- **Impact:** Goal progress regresses on non-closure events. No filter for `action: 'closed'` and `action.merged === true` (only).
- **Plan reference:** Issue I (line 803). The plan mentioned event-type filtering for JIRA but not GitHub `action` filtering.

### 18. `temp_oauth_states` and `temp_slack_codes` are not rate-limited and not garbage-collected
- **CWE:** CWE-401 (Missing Release of Memory / Unbounded Growth)
- **Severity:** MEDIUM
- **File:line:** `server/src/routes/integrations.ts:96-119` (temp state), migration `:345-360` (table defs)
- **Attack scenario:** Attacker repeatedly calls `slack/link/start` and `jira/confirm` to fill `temp_oauth_states` and `temp_slack_codes`. No TTL cleanup job is configured. The table grows unbounded.
- **Impact:** Storage exhaustion; query slowdown on `slack_command_sessions` and `temp_oauth_states` lookups (index bloat).
- **Note:** The plan mentioned a daily cron for `integration_events` (line 161) but not for `temp_oauth_states` or `temp_slack_codes`.

### 19. `slack_user_links` has no FK to `org_members` — deleted users keep their Slack link
- **CWE:** CWE-672 (Operation on a Resource After Expiration or Release)
- **Severity:** MEDIUM
- **File:line:** `supabase-migrations/2026-06-16_teams_goals_integrations.sql:319-327`
- **Attack scenario:** User is removed from `org_members` (or `users` is hard-deleted), but `slack_user_links.user_id` still points to them. The Slack slash command path (`slack.ts:86-100`) queries `org_members` for the user and finds nothing, falling back to `userOrgs[0]?.org_id` — possibly an org the user is no longer in.
- **Impact:** Stale Slack links grant access to a former employee's org via Slack.

### 20. `global_locks` table does not have a TTL or staleness check
- **CWE:** CWE-672, CWE-400
- **Severity:** MEDIUM
- **File:line:** `supabase-migrations/2026-06-16_teams_goals_integrations.sql:380-384`
- **Attack scenario:** A cron worker dies after `INSERT INTO global_locks` but before the unlock. Subsequent runs `SELECT 1 FROM global_locks WHERE job_name = ?` see the row and skip forever. No heartbeat, no expiry.
- **Impact:** Permanent denial of cron execution for the affected job. The plan (Issue E line 711) flagged this; the migration did not address it.

### 21. `org_integrations` SELECT in the listing endpoint (`GET /org/:orgId`) leaks `installed_by` to all org members
- **CWE:** CWE-200
- **Severity:** MEDIUM
- **File:line:** `server/src/routes/integrations.ts:776-787`
- **Attack scenario:** Org `member` role (not admin) calls `GET /api/integrations/org/:orgId` and receives `installed_by` (the admin user ID) for each integration. The handler uses `requireOrgRole('member')` so any member can read.
- **Impact:** Internal recon — members learn which admin installed which integration. Combined with the `users` table being queryable, an attacker can correlate who has admin privileges.

### 22. `goal_updates.user_id` may be `NULL` — audit trail loss on user deletion
- **CWE:** CWE-778 (Insufficient Logging)
- **Severity:** MEDIUM
- **File:line:** `supabase-migrations/2026-06-16_teams_goals_integrations.sql:270-286`
- **Note:** Plan explicitly justified this for audit-trail preservation. Listed for completeness — the `user_id` is set to NULL on `users` delete, so a goal update from a now-deleted user is unattributable. Consider soft-deletes or a separate audit log.

---

## LOW

### 23. `webhook_secret_enc` returned in DB read by `verifyJiraWebhookToken` is decrypted on every call — minor DoS surface
- **CWE:** CWE-208 (Observable Timing Discrepancy)
- **Severity:** LOW
- **File:line:** `server/src/lib/webhookSecurity.ts:62-72`
- **Note:** The decryption happens unconditionally. Consider caching the decrypted secret per-org in-process with a short TTL (e.g., 60s) so the webhook hot-path doesn't decrypt on every request.

### 24. `slack_user_links` `UNIQUE(user_id, slack_team_id)` allows one link per workspace but does not enforce that the user is an org member
- **CWE:** CWE-285 (Improper Authorization)
- **Severity:** LOW
- **File:line:** `supabase-migrations/2026-06-16_teams_goals_integrations.sql:319-327`
- **Attack scenario:** A user who is a member of multiple orgs can link a single Slack workspace to one org and then the `/goals` flow picks the "first" org matching `external_install_id` (slack.ts:90-94). The picked org may not be the org the user intends.
- **Impact:** Cross-tenant routing confusion in slash commands. Not exploitable for direct data theft (the authz layer still gates writes), but UX/scope confusion.

### 25. `slack_command_sessions` are deleted without tenant isolation in the listing branch
- **CWE:** CWE-863
- **Severity:** LOW
- **File:line:** `server/src/routes/webhooks/slack.ts:149-153`
- **Attack scenario:** The `delete().eq('slack_team_id', ...).eq('slack_user_id', ...)` only filters by Slack IDs, not by `org_id`. A user with multiple orgs linked to the same Slack workspace has their command session cleared across all orgs.
- **Impact:** Cross-org session wipe. Subsequent `/goals <index> <pct>%` returns "No goal at index" until the user re-runs `/goals`.

### 26. `temp_slack_codes` insert via `upsert` with `onConflict: 'slack_team_id,slack_user_id'` re-uses an existing code row — does not invalidate prior codes
- **CWE:** CWE-294 (Replay)
- **Severity:** LOW
- **File:line:** `server/src/routes/integrations.ts:630-647`
- **Attack scenario:** A user requests a new PIN, the old PIN is overwritten, but the new PIN is generated by `Math.random()` (issue #2) and the old one (if leaked) was tied to the same `(slack_team_id, slack_user_id)`. The unique constraint on `code` (migration line 359) prevents two active codes for the same numeric PIN, so collisions are rare.
- **Impact:** Low because of the per-code uniqueness, but the lack of an audit log of which `email` claimed which `code` is a gap.

### 27. `webhook_secret_enc` is generated client-side via `crypto.randomBytes(32).toString('hex')` — 64 hex chars; but the plan references it should be a 32-byte secret, which is what 64 hex chars represents
- **CWE:** None
- **Severity:** LOW (informational)
- **File:line:** `server/src/routes/integrations.ts:420`
- **Note:** The secret is stored encrypted (`webhook_secret_enc`) and never returned in responses. Rotation is not implemented in the codebase — if compromised, only manual DB update.

---

## Cross-Reference: Plan-Bug Coverage

| Plan Bug ID | Plan Topic | Status in Code |
|---|---|---|
| Bug AO / Bug DK | OAuth state machine GET→POST | **Partially fixed** — see #4. POST confirm exists but state JWT has no audience binding. |
| Bug CE | JIRA webhook token via URL | **NOT fixed** — see #1. `?token=` fallback retained. |
| Bug CF | GitHub webhook signature | Fixed — see `verifyGithubSignature` with SHA-256 pre-hash. |
| Bug AM | Atlassian `id_token` parse | **Partially fixed** — `id_token` parsed at `integrations.ts:163-170`, but `parts[1]` access on a non-JWT crashes. |
| Bug AP | RLS on `refresh_tokens` etc. | Fixed — see migration `1230-1239`. |
| Bug DK | OAuth account hijacking via GET | See #4. |
| Bug AQ | Slack PIN linking | **Not actually implemented correctly** — see #2, #3, #11. |
| Bug O | Slack account hijacking | **Not fixed** — see #3. |
| Bug N | Inherited `member` role in `getEffectiveTeamRole` | Fixed — see `authz.ts:91-112`. |
| Bug P | `canManageTeamConfig` vs `canManageTeamGoals` | Fixed — both functions exist. |
| Bug Q | Slack interactive actions bypass authz | Fixed — see `slack.ts:198-204`. |
| Bug R | JIRA token refresh lock TTL | Lock pattern is `acquire_integration_sync_lock` in migration `:418-431`; integration refresh lock is not implemented for the same purpose (JIRA uses `is_refreshing` boolean) — verification incomplete. |
| Bug S | Raw-body middleware ordering | **Not verified** — `server/src/index.ts` not in scan targets. |
| Bug AT | Retrospective worklog sync | Job uses sliding window via `last_weekly_sync_week` comparison; not in scan targets. |
| Bug AN | JQL operator precedence | Fixed in migration `:218-230` (parameterized). |

---

## Gaps and Recommended Tests (not part of the bug count)

These are not findings but items the plan should add:

1. **Rate limiting** on all `POST /api/integrations/*` and `/api/auth/*` routes — completely missing.
2. **CSRF tokens** on all state-changing routes (`/api/teams/*`, `/api/goals/*`, `/api/integrations/*`). The `auth.ts` middleware in the existing server may already provide this; not in scan scope.
3. **CORS** — `server/src/index.ts` not in scan scope; plan references it as configured for localhost/Vercel only.
4. **Body size limit** on webhook routes — `express.json({ limit: ... })` not set in scan scope; default is 100kb which is fine for JIRA but tight for GitHub.
5. **Logging of PII** — `slack.ts:108-111` logs `goalIds` which may contain sensitive titles; `integrationEvents.payload` retains full JIRA issue data forever (30-day retention per plan, no implementation in scan scope).

---

*Reviewer note: I did not modify any code. All file paths are absolute. The findings above are derived from direct code reading against the plan's named bugs (lines 207–580 and 1184–1300).*
