# Threat Model — worklog-ai

Generated: 2026-06-05. Architecture: monorepo (client + server + shared).
Tech stack: React + Vite (client), Express + TS (server), Supabase Postgres, Resend/Brevo email, Mistral/NVIDIA NIM AI.

## Trust boundaries

| Boundary | From → To | Auth |
|---|---|---|
| TB-1 (public) | Anonymous internet → Vercel-hosted React SPA | None |
| TB-2 (auth) | Logged-in user → Express API | JWT bearer |
| TB-3 (data) | Express API → Supabase Postgres | Service role (server) / RLS (anon) |
| TB-4 (ai) | Server → Mistral / NVIDIA NIM | API key |
| TB-5 (email) | Server → Brevo | API key |
| TB-6 (cron) | node-cron jobs → Supabase | Service role |

## Data sensitivity

- **PII**: user email, name, company, job title, work log entries (free text), appraisal criteria (free text)
- **Credentials**: password hashes (bcrypt), email-verification tokens, password-reset tokens, refresh tokens
- **AI prompts**: may contain free-text work history sent to Mistral/NIM

## STRIDE threats

### Spoofing
- **S1**: JWT forgery (mitigation: HS256 with `JWT_SECRET` ≥ 32 chars; revocation via `refresh_tokens.revoked` flag)
- **S2**: Email verification bypass (mitigation: tokens with 24h expiry; flag in `users.email_verified`)
- **S3**: Password reset token reuse (mitigation: tokens expire in 1h; stored as bcrypt-hashed at rest)

### Tampering
- **T1**: SQL/PostgREST injection via unsanitized input (mitigation: parameterized queries via Supabase client)
- **T2**: RLS bypass via service-role key leaked (mitigation: service key only in `server/.env`, never shipped to client)
- **T3**: Mass assignment in profile updates — server destructures known fields only
- **T4**: Email template injection (mitigation: user-controlled fields not interpolated into subject; HTML body uses simple substitutions)

### Repudiation
- **R1**: AI appraisal generation should be logged for audit (currently captured via PostHog `appraisal_generated` event)
- **R2**: Reminder emails logged in `reminder_logs` table
- **R3**: No audit trail for who edited which `work_log_entry`

### Information Disclosure
- **I1**: Server logs may include request bodies — should never log passwords/tokens (mitigation: structured logger does not auto-log body; explicit fields only)
- **I2**: AI prompts may leak work history to model provider — acceptable risk; consider opt-in
- **I3**: Error responses may leak schema details (mitigation: localized error messages from `i18n/errors.ts`, no stack traces in 500s)
- **I4**: Rate-limit messages expose that endpoint exists — acceptable
- **I5**: `console.error` of error.message in client `loadProfile` (Settings.tsx:92) leaks server message into browser console

### Denial of Service
- **D1**: Global rate limiter (100 req / 15 min / IP)
- **D2**: Auth-specific limiter (20 / hour / IP)
- **D3**: AI endpoints (appraisal, chat) expensive — no per-user rate limit
- **D4**: Cron jobs all run on a single instance; no backpressure control
- **D5**: N+1 in monthly summary generation — `getSummariesForRange` may fire N Google Translate requests serially

### Elevation of Privilege
- **E1**: User A reads User B's data via `?userId=` injection (mitigation: `requireAuth` middleware sets `req.userId` from JWT, all queries scope by it)
- **E2**: User deletes another user's `work_log_entry` (mitigation: `DELETE /api/entries/:id` scopes by `user_id = req.userId`)
- **E3**: User promotes themselves to admin (no admin role exists in this app — N/A)
- **E4**: `PUT /api/users/profile` lets a user overwrite `email_verified` if the column is in the destructured payload (mitigation: only specific fields destructured)

## Critical hot spots (file-level)

- `server/src/routes/auth.ts` — signup, login, password reset, token rotation
- `server/src/routes/users.ts` — profile read/write (mass-assignment surface)
- `server/src/routes/translate.ts` — Google Translate proxy (in-memory cache; potential prompt-injection if cached translations get reused for user content)
- `server/src/jobs/reminderJob.ts`, `weeklyDigestJob.ts` — run on cron, no user auth, must filter by `user_id` carefully
- `server/src/middleware/auth.ts` — gate for all `/api/*` except `/api/auth/*` and `/api/translate/*`
- `client/src/lib/api.ts` — JWT storage (`accessToken` in localStorage; XSS risk if any user-controlled string is rendered as HTML)
- `client/src/pages/Settings.tsx` — error message surface (line 92 logs `err.message`)

## Vulnerability pattern library

- **Mass assignment**: check that PUT handlers whitelist fields
- **Missing auth on cron job query**: any `.from('users').select('email')` must NOT happen before user-id filter
- **console.error of network errors**: may leak tokens or server internals
- **JWT in localStorage**: subject to XSS exfiltration
- **Google Translate cached strings**: must never be used as user data, only as static UI chrome
- **RLS gaps**: `user_profiles` row creation must happen at signup; orphan rows in this table are a strong signal
- **Refresh-token rotation**: missing `revoked` check on each refresh
