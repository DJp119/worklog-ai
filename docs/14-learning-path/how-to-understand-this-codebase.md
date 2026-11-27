# How to Understand This Codebase

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Beginner, Junior, Senior

---

## 1. Choose your starting point

| If you are... | Start here | Time to productive |
|---|---|---|
| **New to programming** | Glossary → Project Overview → Frontend Architecture | 2-4 weeks |
| **Junior developer** | Project Overview → System Architecture → Directory Map | 1-2 weeks |
| **Senior engineer** | System Architecture → Auth Architecture → Database Schema | 2-3 days |
| **Debugging a bug** | Feature Flows → Function Docs → Risks | 30 min - 2 hours |
| **Adding a feature** | API Reference → Function Docs → Database Schema | 1-3 days |
| **Deploying** | Deployment Architecture → Environment Variables | 1-2 days |

---

## 2. The 5-layer mental model

Think of the codebase as five layers. Each layer only talks to the one below.

```
┌─────────────────────────────────────┐
│ 1. BROWSER (React SPA)              │  ← You are here
│    Pages, Components, Hooks, State  │
└──────────────┬──────────────────────┘
               │ HTTP + JWT
┌──────────────▼──────────────────────┐
│ 2. API (Express)                    │
│    Routes, Middleware, Validation   │
└──────────────┬──────────────────────┘
               │ Service-role SDK
┌──────────────▼──────────────────────┐
│ 3. SERVICES (Domain Logic)          │
│    Authz, Goals, Teams, Reports     │
└──────────────┬──────────────────────┘
               │ SDK / HTTP
┌──────────────▼──────────────────────┐
│ 4. DATABASE (Supabase Postgres)     │
│    Tables, RLS, Indexes, RPCs       │
└──────────────┬──────────────────────┘
               │ API
┌──────────────▼──────────────────────┐
│ 5. EXTERNAL (AI, Email, GitHub...)  │
│    Mistral, Brevo, Jira, Slack...   │
└─────────────────────────────────────┘
```

**Rule:** Code in layer N should only import from layer N or N+1. Never skip layers.

---

## 3. Recommended reading order

### Phase 1: Big picture (30 min)

1. **Project Overview** — What is this? Who uses it? What are the 4 subsystems?
2. **System Architecture** — The story of opening the app; request lifecycle; 5 data planes.
3. **Directory Map** — Where files live; what's excluded.

### Phase 2: Core systems (2-4 hours)

4. **Auth & Authorization Architecture** — Custom JWT + refresh tokens; org/team rank maps; service-role discipline.
5. **Database Architecture** — 47 tables, 5 domains, RLS reality check, migration order.
6. **Frontend Architecture** — React SPA, routing, AuthContext, API client, i18n.
7. **Backend Architecture** — Express bootstrap, middleware chain, 21 routers, 11 jobs.

### Phase 3: Deep dives (as needed)

| Need | Read |
|---|---|
| **How login works** | Auth endpoints → Auth functions → AuthContext |
| **How goals roll up** | Goals endpoints → GoalService → Team closure |
| **How Jira sync works** | Integrations endpoints → JiraAdapter → weeklySyncJob |
| **How AI appraisal generates** | Appraisal endpoints → Mistral/OpenRouter → chatService |
| **How email sends** | Email lib → Brevo → jobs (reminder, digest) |
| **How push works** | Push endpoints → webPush lib → service worker |

### Phase 4: Reference (while coding)

- **API Reference** — Exact request/response for each endpoint
- **Function Documentation** — Every function: inputs, outputs, calls, side effects
- **Database Schema** — Column types, indexes, RLS, relationships
- **Environment Variables** — Every var, required/optional, where used

---

## 4. How to trace a feature end-to-end

**Example: "User creates a work log entry"**

1. **Browser:** User fills form in `LogEntry.tsx` → clicks Save
2. **Component:** `LogEntry` calls `createEntry()` from `lib/api.ts`
3. **API Client:** `apiRequest('POST', '/api/entries', body)` adds Bearer token
4. **Network:** `POST https://api.example.com/api/entries` + JWT
5. **Express:** CORS → rate limit → requestId → logger → `requireAuth`
6. **Middleware:** `requireAuth` verifies JWT → loads user → attaches `req.userId`, `req.supabase`
7. **Route:** `entries.ts` `POST /` handler receives `req.body`, `req.userId`
8. **Handler:** Validates input → `supabase.from('work_log_entries').insert({...user_id: req.userId})`
9. **Database:** Inserts row (RLS bypassed; Node scoped by `user_id`)
10. **Response:** `{ success: true, data: entry }` → JSON to browser
11. **Client:** `apiRequest` returns `entry` → `LogEntry` updates state → re-renders

**To trace any feature:** Find the page → find the API call → find the route → find the handler → find the DB query.

---

## 5. Key files to bookmark

| Purpose | File |
|---|---|
| **All routes** | `server/src/index.ts:184-204` |
| **Auth middleware** | `server/src/middleware/auth.ts` |
| **Authorization** | `server/src/services/authz.ts` |
| **Database client** | `server/src/lib/database.ts` |
| **Client API** | `client/src/lib/api.ts` |
| **Client auth** | `client/src/context/AuthContext.tsx` |
| **Client routes** | `client/src/App.tsx` |
| **Shared types** | `shared/src/index.ts` |
| **Migrations order** | `docs/07-database/migrations.md` |
| **Env vars** | `docs/10-environment-and-deployment/environment-variables.md` |

---

## 6. Common "where is X?" answers

| Question | Answer |
|---|---|
| Where is the login handler? | `server/src/routes/auth.ts:326` |
| Where is the JWT secret? | `server/src/middleware/auth.ts:32` (env var `JWT_SECRET`) |
| Where are refresh tokens stored? | `refresh_tokens` table (SHA-256 hash) |
| Where is the AI prompt for appraisals? | `server/src/lib/aiSummaryService.ts` + `appraisal.ts` |
| Where is the team hierarchy? | `team_closure` table + `authz.getEffectiveTeamRole` |
| Where are OAuth tokens encrypted? | `lib/crypto.ts` → `user_integrations.access_token` |
| Where do cron jobs start? | `server/src/index.ts:312-330` |
| Where is the Supabase client created? | `server/src/lib/database.ts:41` |
| Where is the client API base URL? | `client/src/lib/api.ts:3` (`VITE_API_URL`) |
| Where is the refresh token rotation? | `server/src/routes/auth.ts:630` + `client/src/context/AuthContext.tsx:219` |

---

## 7. Debugging checklist

| Symptom | Check |
|---|---|
| "401 Unauthorized" | Token expired? `AuthContext` refresh? `apiRequest` retry? |
| "403 Forbidden" | Org/team role? `requireOrgRole` / `requireTeamRole` params? |
| "500 Internal Server Error" | Server logs (`Render` dashboard) → `logger.error` |
| "CORS error" | `FRONTEND_URL` includes origin? `VERCEL_ALLOWED_APPS`? |
| "AI failed" | `MISTRAL_API_KEY` / `OPENROUTER_API_KEY` set? Provider status? |
| "Email not sent" | `BREVO_API_KEY` set? Server logs for `sendEmail`? |
| "Webhook 400" | Signature verification? `X-Hub-Signature-256` / `X-Slack-Signature`? |
| "Cron not running" | Render free tier spun down? `MARKETING_LOOPS_ENABLED`? |
| "Subscription not loading" | `SubscriptionContext` fetch has auth header? |

---

## 8. Contributing workflow

```bash
# 1. Branch
git checkout -b feat/your-feature

# 2. Code
# ... make changes ...

# 3. Quality gates (run locally)
npm run typecheck
npm run lint
npm test --workspace=server

# 4. Commit
git add .
git commit -m "feat: your feature description"

# 5. Push & PR
git push origin feat/your-feature
# Open PR on GitHub
```

**PR requirements (when CI exists):**
- TypeScript compiles
- ESLint passes
- Server tests pass
- Client tests pass (once enabled)
- No console.log left in code
- Documentation updated if API changes

---

## 9. Glossary quick link

Every technical term is defined in **[Glossary](../13-glossary/beginner-friendly-glossary.md)** with:
- Simple explanation (analogy)
- Technical explanation
- Where it appears in the codebase

---

## 10. When you're stuck

1. **Search the codebase** — `grep` for the error message or function name
2. **Check the docs** — Feature flows, function docs, API reference
3. **Read the tests** — `server/src/__tests__/` shows expected behavior
4. **Check the glossary** — Unknown term?
5. **Ask** — Reference the file:line and what you've already checked

---

## Related documents

- [Glossary](../13-glossary/beginner-friendly-glossary.md)
- [Project overview](../01-project-overview.md)
- [System architecture](../02-architecture/system-architecture.md)
- [Feature flows](../05-feature-flows/feature-index.md)

## Verification notes

Learning path derived from documentation structure at commit `7567207`.
Tested against actual codebase navigation patterns.