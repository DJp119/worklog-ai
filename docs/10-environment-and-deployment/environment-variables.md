# Environment Variables Reference

> **Status:** Verified (code inspection)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Client (`client/.env`)

| Variable | Required | Default | Purpose | Used by |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes | — | Supabase project URL (optional direct reads) | `lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | Yes | — | Supabase anon key (optional direct reads) | `lib/supabase.ts` |
| `VITE_API_URL` | Yes | `http://localhost:3001` | Backend API base URL | `AuthContext.tsx`, `api.ts`, `i18n/index.ts`, `chatApi.ts`, etc. |
| `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` | No | — | PostHog client token | `main.tsx` |
| `VITE_POSTHOG_HOST` | No | `https://us.i.posthog.com` | PostHog host | `main.tsx` |

**Note:** `VITE_` prefix is required for Vite to expose to client bundle.

---

## 2. Server (`server/.env`)

### 2.1 Core (required for startup)

| Variable | Required | Default | Validation | Purpose |
|---|---|---|---|---|
| `JWT_SECRET` | **Yes** | — | ≥32 chars (throws at import) | Signs access tokens |
| `SUPABASE_URL` | **Yes** | — | — | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | **Yes** | — | — | Service-role key (bypasses RLS) |
| `FRONTEND_URL` | **Yes** | — | — | CORS allowlist (comma-separated) |

**Startup behavior:** Missing `JWT_SECRET` or short secret throws at module load (`middleware/auth.ts:32-35`). Missing Supabase vars logs warnings but allows startup (`database.ts:26-35`).

### 2.2 AI Providers (at least one required for AI features)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MISTRAL_API_KEY` | No | — | Primary AI (appraisals, chat, summaries) |
| `OPENROUTER_API_KEY` | No | — | Fallback AI provider |
| `NVIDIA_NIM_API_KEY` | No | — | Additional AI provider |
| `ANTHROPIC_API_KEY` | No | — | Additional AI provider (SDK in deps) |

**Startup:** Logs warning if none configured (`index.ts:284-293`).

### 2.3 Email (Brevo)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `BREVO_API_KEY` | No | — | Transactional email API key |
| `BREVO_FROM_EMAIL` | No | `xtate62@gmail.com` | Sender email |
| `BREVO_FROM_NAME` | No | `Worklog AI` | Sender name |
| `GOOGLE_TRANSLATE_API_KEY` | No | — | Email translation (optional) |

**Behavior:** If `BREVO_API_KEY` missing, emails skipped with warning log.

### 2.4 Web Push

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VAPID_PUBLIC_KEY` | No | — | VAPID public key (browser) |
| `VAPID_PRIVATE_KEY` | No | — | VAPID private key (server) |
| `VAPID_SUBJECT` | No | — | `mailto:` contact for push service |

**Behavior:** If missing, push disabled.

### 2.5 PostHog (Server)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `POSTHOG_API_KEY` | No | — | Server analytics |
| `POSTHOG_HOST` | No | — | PostHog host (default `us.i.posthog.com`) |

### 2.6 OAuth Providers

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_CLIENT_ID` | No | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth |
| `GITHUB_APP_ID` | No | GitHub App |
| `GITHUB_APP_PRIVATE_KEY` | No | GitHub App (PEM) |
| `JIRA_CLIENT_ID` | No | Jira OAuth |
| `JIRA_CLIENT_SECRET` | No | Jira OAuth |
| `SLACK_CLIENT_ID` | No | Slack OAuth |
| `SLACK_CLIENT_SECRET` | No | Slack OAuth |
| `SLACK_SIGNING_SECRET` | No | Slack webhook verification |

### 2.7 Encryption & Security

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ENCRYPTION_KEY` | No | — | AES-256-GCM key for OAuth tokens (32 bytes) |
| `ACCESS_TOKEN_EXPIRY` | No | `15m` | JWT expiry (e.g., `15m`, `1h`) |
| `NODE_ENV` | No | `development` | `production` enables rate limits |

### 2.8 Rate Limiting

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `RATE_LIMIT_WINDOW` | No | `900000` (15 min) | Global rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Global rate limit max |

### 2.9 Feature Flags

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MARKETING_LOOPS_ENABLED` | No | `false` | Enable 3 marketing cron jobs |
| `VERCEL_ALLOWED_APPS` | No | — | Vercel app allowlist for CORS (comma-separated) |

### 2.10 Port

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `3001` | Server listen port |

---

## 3. Supabase Auth SMTP (not used by app)

The app uses **custom auth**, not Supabase Auth. However, if Supabase Auth is
enabled for any reason:

| Setting | Value |
|---|---|
| Host | `smtp.resend.com` or `smtp.brevo.com` |
| Port | `465` (SSL) or `587` (STARTTLS) |
| Username | `resend` or Brevo SMTP user |
| Password | Resend API key or Brevo SMTP key |

Configure in Supabase Dashboard → Authentication → Email → SMTP Settings.

---

## 4. Environment file templates

### `client/.env.example`

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

### `server/.env.example`

```bash
# Core (required)
JWT_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
FRONTEND_URL=

# AI (at least one)
MISTRAL_API_KEY=
OPENROUTER_API_KEY=
NVIDIA_NIM_API_KEY=
ANTHROPIC_API_KEY=

# Email
BREVO_API_KEY=
BREVO_FROM_EMAIL=xtate62@gmail.com
BREVO_FROM_NAME=Worklog AI
GOOGLE_TRANSLATE_API_KEY=

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com

# Analytics
POSTHOG_API_KEY=
POSTHOG_HOST=https://us.i.posthog.com

# OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=

# Security
ENCRYPTION_KEY=
ACCESS_TOKEN_EXPIRY=15m
NODE_ENV=development

# Rate limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Feature flags
MARKETING_LOOPS_ENABLED=false
VERCEL_ALLOWED_APPS=

# Port
PORT=3001
```

---

## 5. Local development setup

```bash
# 1. Copy templates
cp client/.env.example client/.env
cp server/.env.example server/.env

# 2. Fill in values (see Setup guides)

# 3. Start Supabase locally (optional)
supabase start

# 4. Run both
npm run dev
# client: http://localhost:5173
# server: http://localhost:3001
```

**Vite proxy:** `client/vite.config.ts` proxies `/api` to `http://localhost:3001`.

---

## 6. Production deployment

### Vercel (Client)

| Variable | Source |
|---|---|
| `VITE_SUPABASE_URL` | Vercel project settings |
| `VITE_SUPABASE_ANON_KEY` | Vercel project settings |
| `VITE_API_URL` | Vercel project settings (points to Render URL) |
| `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` | Vercel project settings |
| `VITE_POSTHOG_HOST` | Vercel project settings |

### Render (Server)

| Variable | Source |
|---|---|
| `JWT_SECRET` | Render environment |
| `SUPABASE_URL` | Render environment |
| `SUPABASE_SERVICE_KEY` | Render environment |
| `FRONTEND_URL` | Render environment (Vercel domain) |
| `MISTRAL_API_KEY` | Render environment |
| `OPENROUTER_API_KEY` | Render environment |
| `BREVO_API_KEY` | Render environment |
| `VAPID_PUBLIC_KEY` | Render environment |
| `VAPID_PRIVATE_KEY` | Render environment |
| `VAPID_SUBJECT` | Render environment |
| `POSTHOG_API_KEY` | Render environment |
| `GITHUB_CLIENT_ID` | Render environment |
| `GITHUB_CLIENT_SECRET` | Render environment |
| `GITHUB_APP_ID` | Render environment |
| `GITHUB_APP_PRIVATE_KEY` | Render environment (secret file) |
| `JIRA_CLIENT_ID` | Render environment |
| `JIRA_CLIENT_SECRET` | Render environment |
| `SLACK_CLIENT_ID` | Render environment |
| `SLACK_CLIENT_SECRET` | Render environment |
| `SLACK_SIGNING_SECRET` | Render environment |
| `ENCRYPTION_KEY` | Render environment |
| `NODE_ENV` | `production` (Render sets) |
| `PORT` | Render sets automatically |

---

## 7. Missing / undocumented variables

| Variable | Found in code | Status |
|---|---|---|
| `ENCRYPTION_KEY` | `lib/crypto.ts` | Used but not in `.env.example` |
| `GITHUB_APP_PRIVATE_KEY` | `lib/githubApp.ts` | Used but not in `.env.example` |
| `GOOGLE_TRANSLATE_API_KEY` | `lib/email.ts` | In `.env.example` |

---

## Related documents

- [Deployment architecture](../02-architecture/deployment-architecture.md)
- [Local setup](./local-setup.md)
- [Deployment guide](./deployment-guide.md)

## Verification notes

All variables traced from `server/src/index.ts`, `server/src/middleware/auth.ts`,
`server/src/lib/database.ts`, `server/src/lib/email.ts`, `server/src/lib/crypto.ts`,
`server/src/lib/webPush.ts`, `server/src/lib/posthog.ts`, `server/src/lib/mistral.ts`,
`server/src/routes/auth.ts`, `client/src/main.tsx`, `client/src/lib/api.ts`,
`client/src/context/AuthContext.tsx`, `client/src/i18n/index.ts` at commit `7567207`.