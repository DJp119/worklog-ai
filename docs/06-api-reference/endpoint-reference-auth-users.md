# API Reference: Auth & Users

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Auth endpoints (`/api/auth`)

### 1.1 `POST /api/auth/signup`

**Handler:** `server/src/routes/auth.ts:38`

| Property | Value |
|---|---|
| Auth | None |
| Rate limit | None (prod: global 100/15min) |
| Request body | `{ email: string, password: string, name?: string, company_name?: string, job_title?: string }` |
| Validation | Email format, password ≥8 chars + 1 letter + 1 number |
| Success | 201 `{ success: true, message: "Account created. Please check your email to verify.", data: { id, email, name } }` |
| Errors | 400 (validation), 400 (email exists), 500 |

**Flow:**
1. Hash password (bcrypt 12)
2. Insert `users` row (`email_verified: false`)
3. Create `email_verifications` (24hr expiry, SHA-256 token)
4. Upsert `user_profiles` (required for custom auth)
5. Send verification email (Brevo)
6. PostHog `user_signed_up`

---

### 1.2 `POST /api/auth/verify-email`

**Handler:** `server/src/routes/auth.ts:163`

| Property | Value |
|---|---|
| Auth | None |
| Request body | `{ userId: string, token: string }` |
| Success | 200 `{ success: true, message: "Email verified successfully" }` |
| Errors | 400 (missing fields), 400 (invalid/expired token), 500 |

**Flow:**
1. Hash token → find `email_verifications` row
2. Check expiry
3. Update `users.email_verified = true`
4. Delete verification row
5. PostHog `email_verified`

---

### 1.3 `POST /api/auth/resend-verification`

**Handler:** `server/src/routes/auth.ts:225`

| Property | Value |
|---|---|
| Auth | None |
| Rate limit | 60 seconds per email |
| Request body | `{ email: string }` |
| Success | 200 `{ success: true, message: "Verification email sent" }` |
| Errors | 400 (validation), 429 (rate limited), 500 |

---

### 1.4 `POST /api/auth/login`

**Handler:** `server/src/routes/auth.ts:326`

| Property | Value |
|---|---|
| Auth | None |
| Request body | `{ email: string, password: string, rememberMe?: boolean }` |
| Success | 200 `{ success: true, data: { user: {id, email, name, firstName, companyName, jobTitle, onboardingCompleted}, accessToken, refreshToken, expiresIn: 900 } }` |
| Errors | 400 (missing fields), 401 (invalid credentials), 403 (email not verified), 500 |

**Flow:**
1. Find user by email (lowercased)
2. Generic 401 if not found (anti-enumeration)
3. 403 if `email_verified` false
4. bcrypt compare password
5. `generateAccessToken` (JWT, 15min)
6. `generateRefreshToken` (64-byte hex)
7. `createRefreshToken` (30d if rememberMe, else 7d)
8. Store SHA-256 hash in `refresh_tokens`
9. PostHog `user_logged_in`

---

### 1.5 `POST /api/auth/logout`

**Handler:** `server/src/routes/auth.ts:411`

| Property | Value |
|---|---|
| Auth | None (but sends refresh token) |
| Request body | `{ refreshToken: string }` |
| Success | 200 `{ success: true }` |
| Errors | 500 |

**Flow:**
1. `validateRefreshToken` → get user ID
2. `revokeRefreshToken` (UPDATE `revoked=true`)
3. PostHog `user_logged_out`

---

### 1.6 `GET /api/auth/me`

**Handler:** `server/src/routes/auth.ts:436`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { id, email, name, companyName, jobTitle, emailVerified, preferredLanguage, createdAt } }` |
| Errors | 401, 404, 500 |

**Flow:**
1. `requireAuth` attaches `req.userId` and service-role client
2. Select `users` + `user_profiles.preferred_language`

---

### 1.7 `POST /api/auth/forgot-password`

**Handler:** `server/src/routes/auth.ts:480`

| Property | Value |
|---|---|
| Auth | None |
| Request body | `{ email: string }` |
| Success | 200 `{ success: true, message: "If an account exists with this email, a password reset link has been sent." }` |
| Errors | 400 (missing email), 500 |

**Anti-enumeration:** Always returns success even if email not found.

**Flow:**
1. Find user by email (if exists)
2. Generate 1hr reset token
3. Delete existing `password_reset_tokens` for user
4. Insert new token (SHA-256 hash)
5. Send reset email (Brevo)
6. PostHog `password_reset_requested`

---

### 1.8 `POST /api/auth/reset-password`

**Handler:** `server/src/routes/auth.ts:554`

| Property | Value |
|---|---|
| Auth | None |
| Request body | `{ token: string, newPassword: string }` |
| Validation | Password strength (≥8, 1 letter, 1 number) |
| Success | 200 `{ success: true, message: "Password reset successfully" }` |
| Errors | 400 (missing fields), 400 (invalid/expired token), 400 (weak password), 500 |

**Flow:**
1. Hash token → find `password_reset_tokens`
2. Check expiry
3. Hash new password (bcrypt)
4. Update `users.password_hash`
5. **Revoke ALL refresh tokens for user** (security: account compromise recovery)
6. Delete used reset token
7. PostHog `password_reset_completed`

---

### 1.9 `POST /api/auth/refresh`

**Handler:** `server/src/routes/auth.ts:630`

| Property | Value |
|---|---|
| Auth | None |
| Request body | `{ refreshToken: string }` |
| Success | 200 `{ success: true, data: { accessToken, refreshToken, expiresIn: 900 } }` |
| Errors | 400 (missing token), 401 (invalid/expired), 404 (user not found), 500 |

**Flow:**
1. Hash token → `validateRefreshToken` (joins `users`)
2. Revoke old token
3. Read `session_ttl_days` from row (default 30)
4. Generate new access + refresh token
5. `createRefreshToken` with same TTL
6. Return new pair

---

## 2. User endpoints (`/api/users`)

### 2.1 `GET /api/users/profile`

**Handler:** `server/src/routes/users.ts:19`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: UserProfile }` |
| Errors | 401, 404, 500 |

**Response (`UserProfile` from `shared`):**
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string|null",
  "firstName": "string|null",
  "companyName": "string|null",
  "jobTitle": "string|null",
  "industry": "string|null",
  "function": "string|null",
  "yearsExperience": "string|null",
  "companySize": "string|null",
  "reviewFrequency": "string|null",
  "orgGoalsAlignment": "boolean",
  "onboardingCompleted": "boolean",
  "reminderDay": "number",
  "reminderTime": "string",
  "reminderEnabled": "boolean",
  "emailVerified": "boolean",
  "preferredLanguage": "string|null",
  "createdAt": "ISO8601",
  "totalLogs": "number",
  "currentStreak": "number",
  "lastLoggedDate": "ISO8601|null",
  "loggingCadence": "'daily'|'weekly'"
}
```

---

### 2.2 `PUT /api/users/profile`

**Handler:** `server/src/routes/users.ts:82`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | Partial `UserProfile` (excludes `id`, `email`, `createdAt`) |
| Success | 200 `{ success: true, data: UserProfile }` |
| Errors | 401, 400 (validation), 500 |

**Updates:** `users` table + `user_profiles.preferred_language` (upsert).

---

### 2.3 `PUT /api/users/password`

**Handler:** `server/src/routes/users.ts:248`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ currentPassword: string, newPassword: string }` |
| Validation | Current password correct, new password strength |
| Success | 200 `{ success: true, message: "Password updated successfully" }` |
| Errors | 401, 400 (wrong current password), 400 (weak new password), 500 |

**Flow:**
1. Verify current password (bcrypt)
2. Hash new password
3. Update `users.password_hash`
4. **Revoke ALL refresh tokens** (like reset-password)
5. PostHog `password_changed`

---

### 2.4 `DELETE /api/users/account`

**Handler:** `server/src/routes/users.ts:326`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, message: "Account deleted successfully" }` |
| Errors | 401, 500 |

**Flow:**
1. Delete `users` row (cascades via FK to `user_profiles`, `refresh_tokens`, etc.)
2. PostHog `account_deleted`

---

## Related documents

- [Auth architecture](../02-architecture/auth-and-authorization.md)
- [API overview](./api-overview.md)
- [Backend auth functions](../04-function-documentation/backend-auth-users.md)

## Verification notes

All endpoints traced from `server/src/routes/auth.ts` and `server/src/routes/users.ts` at commit `7567207`. Request/response shapes from handler code. Not verified at runtime: Brevo email delivery, token rotation under load.