# Backend Functions: Auth & Users

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Function inventory

| Function | File:line | Kind | Exported | Tier | Purpose |
|---|---|---|---|---|---|
| `requireAuth` | `middleware/auth.ts:138` | Middleware | Yes | A | Verify JWT, attach userId/user/supabase |
| `optionalAuth` | `middleware/auth.ts:206` | Middleware | Yes | A | Attach user if token present, never blocks |
| `generateAccessToken` | `middleware/auth.ts:41` | Function | Yes | A | Sign JWT (15min) |
| `generateRefreshToken` | `middleware/auth.ts:51` | Function | Yes | A | Generate 64-byte hex token |
| `createRefreshToken` | `middleware/auth.ts:57` | Function | Yes | A | Store SHA-256 hash in DB |
| `revokeRefreshToken` | `middleware/auth.ts:83` | Function | Yes | A | Mark token revoked |
| `validateRefreshToken` | `middleware/auth.ts:99` | Function | Yes | A | Verify token, join user |
| `verifyToken` | `middleware/auth.ts:120` | Function | Yes | B | JWT verify helper |
| `hashToken` | `middleware/auth.ts:257` | Function | Yes | B | SHA-256 hash |
| `hashPassword` | `lib/auth-utils.ts:9` | Function | Yes | A | bcrypt hash (12 rounds) |
| `comparePassword` | `lib/auth-utils.ts:16` | Function | Yes | A | bcrypt compare |
| `generateToken` | `lib/auth-utils.ts:23` | Function | Yes | B | 32-byte hex for email/reset |
| `isValidEmail` | `lib/auth-utils.ts:30` | Function | Yes | B | Regex validation |
| `validatePasswordStrength` | `lib/auth-utils.ts:41` | Function | Yes | B | ≥8 chars, 1 letter, 1 number |
| `signup handler` | `routes/auth.ts:38` | Route | No | A | Create user, send verification |
| `verify-email handler` | `routes/auth.ts:163` | Route | No | A | Verify token, mark verified |
| `resend-verification handler` | `routes/auth.ts:225` | Route | No | A | Resend email (60s rate limit) |
| `login handler` | `routes/auth.ts:326` | Route | No | A | Verify password, issue tokens |
| `logout handler` | `routes/auth.ts:411` | Route | No | A | Revoke refresh token |
| `me handler` | `routes/auth.ts:436` | Route | No | A | Return current user profile |
| `forgot-password handler` | `routes/auth.ts:480` | Route | No | A | Request reset email |
| `reset-password handler` | `routes/auth.ts:554` | Route | No | A | Reset password, revoke all refresh |
| `refresh handler` | `routes/auth.ts:630` | Route | No | A | Rotate access + refresh token |
| `get profile handler` | `routes/users.ts:19` | Route | No | A | Full profile with language |
| `update profile handler` | `routes/users.ts:82` | Route | No | A | Update profile + language |
| `update password handler` | `routes/users.ts:248` | Route | No | A | Change password, revoke all refresh |
| `delete account handler` | `routes/users.ts:326` | Route | No | A | Delete user (cascades) |

---

## 2. Tier A functions (detailed)

### `requireAuth` — `server/src/middleware/auth.ts:138`

**Identity:**
- Name: `requireAuth`
- File: `server/src/middleware/auth.ts:138`
- Module: `middleware/auth`
- Type: Express middleware
- Exported: Yes
- Async: Yes
- Called by: All protected routes via `router.get('/', requireAuth, handler)`

**Purpose:** Verify JWT from Authorization header, load user, attach `req.userId`, `req.user`, and service-role Supabase client.

**ELI5:** Like a security guard who checks your ID badge, looks you up in the employee directory, and gives you a master key to the filing cabinets — but only for your own files.

**Technical walkthrough:**
1. Extract `Authorization: Bearer <token>` header (line 144-150)
2. `verifyToken(token)` → JWT payload `{ userId, email }` (line 153)
3. If invalid/expired → 401
4. `supabase.from('users').select('id,email,name').eq('id', payload.userId).single()` (line 162-166)
5. If user not found → 401
6. Attach `req.userId = user.id`, `req.user = { id, email, name }` (line 174-179)
7. Write `userId` to MDC for logging (line 182-185)
8. Create new service-role Supabase client (line 187-194)
9. `next()` (line 196)

**Inputs:**
| Param | Type | Required | Description |
|---|---|---|---|
| `req.headers.authorization` | string | Yes | `Bearer <JWT>` |

**Returns:** Void (mutates `req`)

**Calls:** `verifyToken`, `supabase.from('users')`, `createClient` (service-role)

**Called by:** Every protected route handler

**Side effects:** Mutates `req`; creates Supabase client; writes to MDC

**Error handling:** 401 for missing/invalid/expired token or missing user; 500 for unexpected errors

**Example:** `GET /api/entries` → `requireAuth` → handler receives `req.userId`

**Summary:** Gatekeeper that validates identity and equips handlers with authenticated context.

---

### `createRefreshToken` — `server/src/middleware/auth.ts:57`

**Identity:** `createRefreshToken` / `middleware/auth.ts:57` / exported / async / A

**Purpose:** Store a new refresh token (SHA-256 hashed) with configurable TTL.

**ELI5:** Takes a spare key, hashes it so it can't be copied, puts it in the secure vault with an expiry date.

**Technical:**
1. Compute `expiresAt = now + expiryDays`
2. `supabase.from('refresh_tokens').insert({ user_id, token_hash: hashToken(token), expires_at, session_ttl_days: expiryDays }).select().single()`

**Inputs:** `userId: string`, `token: string` (plain), `expiryDays: number = 30`

**Returns:** Inserted `refresh_tokens` row

**Calls:** `hashToken`, `supabase.from('refresh_tokens')`

**Side effects:** DB insert

**Error handling:** Throws on DB error (logged, re-thrown)

---

### `validateRefreshToken` — `server/src/middleware/auth.ts:99`

**Identity:** `validateRefreshToken` / `middleware/auth.ts:99` / exported / async / A

**Purpose:** Find unrevoked, unexpired refresh token by hash; join user row.

**ELI5:** Checks the vault for a spare key that hasn't been cancelled or expired, and tells you who it belongs to.

**Technical:**
1. `hashToken(token)`
2. `supabase.from('refresh_tokens').select('*, users(id, email, name)').eq('token_hash', hash).eq('revoked', false).gte('expires_at', now).single()`

**Inputs:** `token: string` (plain)

**Returns:** Token record with joined `users` or `null`

**Calls:** `hashToken`, `supabase.from('refresh_tokens')`

---

### `signup handler` — `server/src/routes/auth.ts:38`

**Identity:** `authRoutes.post('/signup')` / `routes/auth.ts:38` / route handler / async / A

**Purpose:** Create user account, send verification email.

**Technical:**
1. Validate email, password strength
2. `hashPassword(password)` → bcrypt 12
3. Insert `users` (email_verified: false)
4. Generate 24hr verification token → `email_verifications` (SHA-256 hash)
5. Upsert `user_profiles` (required for custom auth)
6. `sendVerificationEmail` (Brevo)
7. PostHog `user_signed_up`
8. Return 201 with user data

**Inputs:** `{ email, password, name?, company_name?, job_title? }`

**Returns:** 201 `{ success, message, data: {id, email, name} }`

**Errors:** 400 (validation, duplicate email), 500

---

### `login handler` — `server/src/routes/auth.ts:326`

**Identity:** `authRoutes.post('/login')` / `routes/auth.ts:326` / route handler / async / A

**Purpose:** Verify credentials, issue JWT + refresh token.

**Technical:**
1. Find user by email (lowercased)
2. Generic 401 if not found (anti-enumeration)
3. 403 if `email_verified` false
4. `comparePassword` (bcrypt)
5. `generateAccessToken` (JWT, 15min)
6. `generateRefreshToken` (64-byte hex)
7. `createRefreshToken` (30d if rememberMe, else 7d)
8. PostHog `user_logged_in`
9. Return tokens + user

**Inputs:** `{ email, password, rememberMe? }`

**Returns:** 200 `{ success, data: { user, accessToken, refreshToken, expiresIn: 900 } }`

**Errors:** 400, 401, 403, 500

---

### `refresh handler` — `server/src/routes/auth.ts:630`

**Identity:** `authRoutes.post('/refresh')` / `routes/auth.ts:630` / route handler / async / A

**Purpose:** Rotate access + refresh token.

**Technical:**
1. `validateRefreshToken(refreshToken)` → gets user
2. `revokeRefreshToken(oldToken)`
3. Read `session_ttl_days` from token row (default 30)
4. Generate new access + refresh token
5. `createRefreshToken(userId, newRefreshToken, sessionTtlDays)`
6. Return new pair

**Inputs:** `{ refreshToken }`

**Returns:** 200 `{ success, data: { accessToken, refreshToken, expiresIn: 900 } }`

---

### `reset-password handler` — `server/src/routes/auth.ts:554`

**Identity:** `authRoutes.post('/reset-password')` / `routes/auth.ts:554` / route handler / async / A

**Purpose:** Reset password with token; revoke ALL refresh tokens (security).

**Technical:**
1. Validate token + new password strength
2. Find `password_reset_tokens` by hash, check expiry
3. `hashPassword(newPassword)`
4. `UPDATE users SET password_hash WHERE id = userId`
5. `UPDATE refresh_tokens SET revoked=true WHERE user_id = userId AND revoked=false` (revoke ALL)
6. Delete used reset token
7. PostHog `password_reset_completed`

**Inputs:** `{ token, newPassword }`

**Errors:** 400 (invalid/expired token, weak password), 500

---

## 3. Tier B functions (compact)

### `hashToken` — `middleware/auth.ts:257`
**Purpose:** SHA-256 hash for token storage. `crypto.createHash('sha256').update(token).digest('hex')`

### `verifyToken` — `middleware/auth.ts:120`
**Purpose:** `jwt.verify(token, JWT_SECRET)` → payload or null.

### `optionalAuth` — `middleware/auth.ts:206`
**Purpose:** Like `requireAuth` but never blocks; attaches user if valid token present.

### `hashPassword` — `lib/auth-utils.ts:9`
**Purpose:** `bcrypt.hash(password, 12)`

### `comparePassword` — `lib/auth-utils.ts:16`
**Purpose:** `bcrypt.compare(password, hash)`

### `generateToken` — `lib/auth-utils.ts:23`
**Purpose:** `crypto.randomBytes(32).toString('hex')` — for email/reset tokens.

### `isValidEmail` — `lib/auth-utils.ts:30`
**Purpose:** Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### `validatePasswordStrength` — `lib/auth-utils.ts:41`
**Purpose:** Checks ≥8 chars, 1 letter, 1 number. Returns `{ valid, errors[] }`.

### `logout handler` — `routes/auth.ts:411`
**Purpose:** `revokeRefreshToken` + PostHog `user_logged_out`.

### `me handler` — `routes/auth.ts:436`
**Purpose:** Returns user profile + `user_profiles.preferred_language`.

### `forgot-password handler` — `routes/auth.ts:480`
**Purpose:** Anti-enumeration; always returns success. Creates 1hr reset token.

### `get profile handler` — `routes/users.ts:19`
**Purpose:** Returns full `UserProfile` with language from `user_profiles`.

### `update profile handler` — `routes/users.ts:82`
**Purpose:** Updates `users` + upserts `user_profiles.preferred_language`.

### `update password handler` — `routes/users.ts:248`
**Purpose:** Verifies current password, hashes new, revokes ALL refresh tokens.

### `delete account handler` — `routes/users.ts:326`
**Purpose:** Deletes `users` row (cascades via FK).

---

## Related documents

- [Auth architecture](../02-architecture/auth-and-authorization.md)
- [Auth endpoints](../06-api-reference/endpoint-reference-auth-users.md)
- [Auth flow](./../05-feature-flows/auth-and-onboarding.md)

## Verification notes

All functions traced from source at commit `7567207`. Runtime behavior (Brevo email, token rotation under load) not verified.