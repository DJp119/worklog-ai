# Backend Functions: Entry, Middleware & Core Infrastructure

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Function inventory

| Function | File:line | Kind | Exported | Tier | Purpose |
|---|---|---|---|---|---|
| `startServer` | `index.ts:234` | Function | No | A | Bootstrap: cleanup locks, listen, env checks, init jobs |
| `requestIdMiddleware` | `middleware/requestId.ts` | Middleware | Yes | A | Generate/attach correlation ID |
| `requireAuth` | `middleware/auth.ts:138` | Middleware | Yes | A | JWT verify + user lookup + service-role client |
| `optionalAuth` | `middleware/auth.ts:206` | Middleware | Yes | A | Attach user if token present, never blocks |
| `tierGate.requireTier` | `middleware/tierGate.ts` | Middleware | Yes | A | Subscription tier gate (enterprise) |
| `generateAccessToken` | `middleware/auth.ts:41` | Function | Yes | A | Sign JWT (15min) |
| `generateRefreshToken` | `middleware/auth.ts:51` | Function | Yes | A | 64-byte hex token |
| `createRefreshToken` | `middleware/auth.ts:57` | Function | Yes | A | Store SHA-256 hash in DB |
| `revokeRefreshToken` | `middleware/auth.ts:83` | Function | Yes | A | Mark token revoked |
| `validateRefreshToken` | `middleware/auth.ts:99` | Function | Yes | A | Verify token, join user |
| `verifyToken` | `middleware/auth.ts:120` | Function | Yes | B | JWT verify helper |
| `hashToken` | `middleware/auth.ts:257` | Function | Yes | B | SHA-256 hash |
| `logger` | `lib/logger.ts` | Instance | Yes | B | Pino logger with MDC |
| `getMdcContext` | `lib/mdc.ts` | Function | Yes | B | Mapped diagnostic context |
| `runWithMdc` | `lib/mdc.ts` | Function | Yes | B | Run with MDC context |
| `getPostHogClient` | `lib/posthog.ts` | Function | Yes | B | Lazy PostHog init |
| `captureEvent` | `lib/posthog.ts` | Function | Yes | B | PostHog capture |
| `captureException` | `lib/posthog.ts` | Function | Yes | B | PostHog exception |
| `identifyUser` | `lib/posthog.ts` | Function | Yes | B | PostHog identify |
| `shutdownPostHog` | `lib/posthog.ts` | Function | Yes | B | Graceful shutdown |
| `supabase` | `lib/database.ts:41` | Instance | Yes | B | Service-role Supabase client |
| `isDatabaseConfigured` | `lib/database.ts:24` | Boolean | Yes | B | Env var check |
| `runtimeSupabaseUrl` | `lib/database.ts:37` | String | Yes | C | Resolved URL |
| `runtimeSupabaseKey` | `lib/database.ts:38` | String | Yes | C | Resolved key |

---

## 2. Tier A functions (detailed)

### `startServer` — `server/src/index.ts:234`

**Identity:** `startServer` / `index.ts:234` / Function / Not exported / async / A

**Purpose:** Complete server bootstrap: cleans orphaned locks, starts HTTP listener, validates env, initializes PostHog, starts all 11 cron jobs.

**ELI5:** The "opening ceremony" — cleans up yesterday's mess, checks all systems go, rings the opening bell, and starts the daily workers.

**Technical walkthrough:**
1. **Lock cleanup** (lines 239-255): Clears `is_syncing`, `is_refreshing` on integrations; deletes expired `temp_oauth_states`, `temp_slack_codes`, `slack_command_sessions`, old `integration_events`
2. **HTTP listen** (line 257): `app.listen(PORT)`
3. **Env checks** (lines 261-295): Warns if `JWT_SECRET` short, `SUPABASE_SERVICE_KEY` missing, `FRONTEND_URL` missing, no AI keys
4. **PostHog init** (lines 297-310): `getPostHogClient()`; captures `server_started` event
5. **Job starts** (lines 312-330): `reminderJob.start()`, `monthlySummaryJob.start()`, `newsCollectionJob.start()`, `weeklyDigestJob.start()`, `weeklySyncJob.start()`, `goalRollupJob.start()`, `goalDigestJob.start()`, `pruneJob.start()`, plus marketing loops if `MARKETING_LOOPS_ENABLED=true`
6. **Graceful shutdown** (lines 340-372): `SIGTERM`/`SIGINT` → stop all jobs → `shutdownPostHog()` → `process.exit(0)`

**Calls:** `supabase` (lock cleanup), `logger`, `getPostHogClient`, all job `start()`, `shutdownPostHog`

**Side effects:** Binds port, starts timers, mutates DB (lock cleanup), registers signal handlers

**Error handling:** Throws on `JWT_SECRET` missing/short (line 32-35); other issues logged as warnings

---

### `requireAuth` — `server/src/middleware/auth.ts:138`

**Identity:** `requireAuth` / `middleware/auth.ts:138` / Middleware / Exported / async / A

**Purpose:** Verify JWT, load user, attach `req.userId`, `req.user`, service-role Supabase client.

**ELI5:** Security guard who checks your badge, looks you up in the directory, and hands you a master key to the filing cabinets — but only for your own files.

**Technical:** See `backend-auth-users.md` for full walkthrough.

---

### `tierGate.requireTier` — `server/src/middleware/tierGate.ts`

**Identity:** `requireTier` / `middleware/tierGate.ts` / Middleware factory / Exported / A

**Purpose:** Gates routes by subscription tier (e.g., `requireTier('enterprise')`).

**Technical:**
1. Reads `orgId` from `req.params`
2. Calls `subscriptionService.getOrgTier(db, orgId)`
3. If tier < required → 403 `{ error: 'Forbidden' }`
4. Attaches `req.orgTier` → `next()`

**Used by:** `reports.ts` (all 3 handlers)

---

### `requestIdMiddleware` — `server/src/middleware/requestId.ts`

**Identity:** `requestIdMiddleware` / `middleware/requestId.ts` / Middleware / Exported / A

**Purpose:** Generates or reads `x-request-id` header; attaches to `req.id` for logging correlation.

**Technical:**
```ts
const requestId = req.headers['x-request-id'] || crypto.randomUUID()
req.id = requestId
res.setHeader('x-request-id', requestId)
next()
```

---

## 3. Tier B functions (compact)

| Function | File:line | Purpose |
|---|---|---|
| `optionalAuth` | `middleware/auth.ts:206` | Like `requireAuth` but never blocks |
| `generateAccessToken` | `middleware/auth.ts:41` | `jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })` |
| `generateRefreshToken` | `middleware/auth.ts:51` | `crypto.randomBytes(64).toString('hex')` |
| `createRefreshToken` | `middleware/auth.ts:57` | Inserts `refresh_tokens` with SHA-256 hash |
| `revokeRefreshToken` | `middleware/auth.ts:83` | `UPDATE refresh_tokens SET revoked=true WHERE token_hash = hashToken(token)` |
| `validateRefreshToken` | `middleware/auth.ts:99` | Finds unrevoked, unexpired token + joins user |
| `verifyToken` | `middleware/auth.ts:120` | `jwt.verify(token, JWT_SECRET)` |
| `hashToken` | `middleware/auth.ts:257` | `crypto.createHash('sha256').update(token).digest('hex')` |
| `logger` | `lib/logger.ts` | Pino instance with `child()` for context |
| `getMdcContext` | `lib/mdc.ts` | Returns `AsyncLocalStorage` context |
| `runWithMdc` | `lib/mdc.ts` | Runs callback with MDC context |
| `getPostHogClient` | `lib/posthog.ts` | Lazy singleton `PostHog` init |
| `captureEvent` | `lib/posthog.ts` | `posthog.capture({ distinctId, event, properties })` |
| `captureException` | `lib/posthog.ts` | `posthog.captureException(err)` |
| `identifyUser` | `lib/posthog.ts` | `posthog.identify(distinctId, traits)` |
| `shutdownPostHog` | `lib/posthog.ts` | `posthog.shutdown()` |
| `supabase` | `lib/database.ts:41` | `createClient(runtimeSupabaseUrl, runtimeSupabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })` |
| `isDatabaseConfigured` | `lib/database.ts:24` | Boolean: `SUPABASE_URL && SUPABASE_SERVICE_KEY` truthy |

---

## 4. Tier C (inventory)

| Function | File:line | Kind | Why Tier C |
|---|---|---|---|
| `runtimeSupabaseUrl` | `lib/database.ts:37` | Constant | Resolved URL string |
| `runtimeSupabaseKey` | `lib/database.ts:38` | Constant | Resolved key string |
| `firstDefined` | `lib/database.ts:7` | Helper | Internal env var resolver |

---

## Related documents

- [Auth architecture](../02-architecture/auth-and-authorization.md)
- [System architecture](../02-architecture/system-architecture.md)
- [Backend architecture](../02-architecture/backend-architecture.md)
- [Auth functions](../04-function-documentation/backend-auth-users.md)

## Verification notes

All functions traced from source at commit `7567207`. Graceful shutdown behavior verified in code; runtime signal handling not tested.