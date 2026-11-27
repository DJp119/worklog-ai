# Local Setup Guide

> **Status:** Verified (from config)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | `nvm install 20` or download |
| npm | 10+ | Included with Node |
| Git | Any | `git --version` |
| Supabase CLI | Latest | `npm i -g supabase` (optional) |

**Optional:** Docker (for local Supabase), PostgreSQL client (`psql`).

---

## 2. Clone and install

```bash
# Clone
git clone https://github.com/DJp119/worklog-ai.git
cd worklog-ai

# Install all workspaces
npm install
```

This installs dependencies for `client/`, `server/`, and `shared/` via npm workspaces.

---

## 3. Environment configuration

```bash
# Copy templates
cp client/.env.example client/.env
cp server/.env.example server/.env
```

### Minimum required for local dev

**`client/.env`:**
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
VITE_API_URL=http://localhost:3001
```

**`server/.env`:**
```bash
JWT_SECRET=your-32-char-minimum-secret-key-here
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=your-local-service-role-key
FRONTEND_URL=http://localhost:5173
MISTRAL_API_KEY=your-mistral-key  # or OPENROUTER_API_KEY
NODE_ENV=development
```

### Optional for full features

```bash
# Email (Brevo)
BREVO_API_KEY=
BREVO_FROM_EMAIL=dev@example.com

# Web Push
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:dev@example.com

# Analytics
POSTHOG_API_KEY=

# OAuth (for integration testing)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
```

---

## 4. Database setup

### Option A: Local Supabase (recommended)

```bash
# Start local Supabase stack
supabase start

# Apply all migrations in order
supabase db reset

# Or apply manually in order:
# 1. supabase-schema.sql
# 2. supabase-schema-custom-auth.sql
# 3. supabase-migration-ai-pulse.sql
# 4. migrations/001_monthly_summaries_and_chat.sql
# 5. migrations/002_add_reminder_columns_to_users.sql
# 6. migrations/003_make_log_fields_optional.sql
# 7. migrations/add_feedback_table.sql
# 8. supabase-migrations/2026-06-05_i18n_support.sql
# 9. supabase-migrations/2026-06-07_security_token_hashing.sql
# 10. supabase-migrations/2026-06-16_teams_goals_integrations.sql
# 11. supabase-migrations/2026-06-18_followup_constraints.sql
# 12. supabase-migrations/2026-06-20_premium_subscriptions.sql
# 13. supabase-migrations/cohort-tracking.sql
# 14. supabase-migrations/push-subscriptions.sql
```

**Local Supabase URLs:**
- API: `http://localhost:54321`
- Studio: `http://localhost:54323`
- DB: `postgresql://postgres:postgres@localhost:54322/postgres`

### Option B: Remote Supabase

Use your cloud Supabase project credentials in `.env` files.

### Option C: Plain PostgreSQL

```bash
# Create database
createdb worklog_ai

# Apply migrations manually via psql
psql -d worklog_ai -f supabase-schema.sql
# ... repeat for all 14 files in order ...
```

**Note:** No migration runner exists; apply manually in order.

---

## 5. Run development servers

```bash
# Run both client and server concurrently
npm run dev

# Or separately:
npm run dev:client   # Vite on http://localhost:5173
npm run dev:server   # Express on http://localhost:3001
```

**Vite proxy:** `client/vite.config.ts` proxies `/api/*` to `http://localhost:3001`.

---

## 6. Verify installation

| Check | Expected |
|---|---|
| `http://localhost:5173` | Landing page loads |
| `http://localhost:5173/login` | Login page |
| `http://localhost:3001/health` | `{ "status": "ok", "timestamp": "..." }` |
| `http://localhost:3001/api/auth/me` (with token) | User profile |
| Supabase Studio (`:54323`) | Tables visible |

---

## 7. Common issues

| Issue | Fix |
|---|---|
| `JWT_SECRET` too short | Must be ≥32 characters |
| `supabase start` fails | Docker not running; `docker Desktop` |
| CORS errors | `FRONTEND_URL` must include `http://localhost:5173` |
| AI features fail | `MISTRAL_API_KEY` or `OPENROUTER_API_KEY` required |
| Emails not sent | `BREVO_API_KEY` required; check logs |
| `npm run dev` fails | `npm install` in root (workspaces) |
| TypeScript errors | `npm run typecheck` to diagnose |

---

## 8. Useful commands

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Build all
npm run build

# Run server tests
cd server && npm test

# Supabase Studio
supabase studio

# View server logs
# (output in terminal running dev:server)

# Reset local DB
supabase db reset
```

---

## 9. IDE setup (VS Code recommended)

**Extensions:**
- TypeScript and JavaScript Language Features (built-in)
- ESLint (`dbaeumer.vscode-eslint`)
- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)
- PostHog (optional)

**Settings (`.vscode/settings.json`):**
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

---

## Related documents

- [Environment variables](../10-environment-and-deployment/environment-variables.md)
- [Deployment guide](./deployment-guide.md)
- [Database migrations](../07-database/migrations.md)

## Verification notes

Steps derived from `package.json` scripts, `vite.config.ts`, `supabase-schema.sql`,
`server/src/index.ts`, and environment variable references at commit `7567207`.
Not verified end-to-end without live credentials.