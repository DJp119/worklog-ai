# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (all workspaces)
npm install

# Run development servers (client + server concurrently)
npm run dev

# Run separately
npm run dev:client   # Vite on :5173
npm run dev:server   # Express on :3001

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Architecture Overview

**Monorepo with npm workspaces** - client, server, and shared packages.

```
worklog-ai/
├── client/     # React + Vite + Tailwind (Vercel deploy)
├── server/     # Express + TypeScript (Railway deploy)
├── shared/     # Shared TypeScript types
└── supabase-schema.sql
```

**Data flow:**
1. Frontend authenticates via Supabase Auth (magic link OTP)
2. API calls include `Authorization: Bearer <token>` header
3. Server validates JWT with Supabase, attaches user to request
4. Server queries Supabase Postgres with RLS (user_id scoping)
5. AI appraisals use Anthropic Claude API (`claude-sonnet-4-5-20250929`)

**Auth pattern:** Frontend uses Supabase client SDK; backend middleware (`server/src/middleware/auth.ts`) verifies tokens and creates per-request Supabase clients. The `AuthRequest` interface extends Express Request with `userId`, `user`, and `supabase` properties.

**Weekly reminder job:** `server/src/jobs/reminderJob.ts` runs Mondays at 9 AM via node-cron, sending emails through Resend. Controlled by `canRunReminderJobs` flag in `server/src/lib/supabase.ts`.

**Key patterns:**
- All API responses follow `{ success: boolean, data?: T, error?: string }` structure
- Database uses Row Level Security (RLS) - policies in `supabase-schema.sql`
- Token refresh handled in `client/src/lib/api.ts` on 401 responses
- CORS config in `server/src/index.ts` allows localhost, configured FRONTEND_URL, and Vercel domains

## Database Schema

Five tables with RLS (all scoped to `user_id = auth.uid()`):
- `user_profiles` - extends auth.users with job_title, reminder_day/time
- `work_log_entries` - weekly logs (accomplishments, challenges, learnings, goals)
- `appraisal_criteria` - user-defined criteria for AI generation
- `generated_appraisals` - AI output from Claude
- `reminder_logs` - audit trail for email reminders

Unique constraint: `work_log_entries(user_id, week_start_date)` prevents duplicate weekly entries.

## Deployment

- **Frontend:** Vercel, root directory `./client`, Vite preset
- **Backend:** Railway, root directory `./server`, Nixpacks auto-detect
- **Database:** Supabase Postgres (run `supabase-schema.sql` once)
- **Email:** Resend for both auth SMTP and reminder emails

**Critical env vars:**
- Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`
- Server: `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `FRONTEND_URL`, `JWT_SECRET`

**Supabase Auth redirect URLs must include:** `https://<vercel-domain>/**` and `http://localhost:5173/**`

## Environment Files

Copy from `.env.example` files:
- `client/.env.example` → `client/.env`
- `server/.env.example` → `server/.env`

See SETUP.md and DEPLOYMENT.md for detailed configuration.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (this repo: `DJp119/worklog-ai`). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.