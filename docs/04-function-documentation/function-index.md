# Function Index

> **Status:** Partially verified (inventory complete, docs in progress)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Inventory summary

| Tier | Count | Description |
|---|---:|---|
| **Tier A** (full 13-section) | ~250 | Route handlers, middleware, services, jobs, contexts, hooks, pages, stateful components, API clients |
| **Tier B** (compact) | ~350 | Exported helpers, event handlers, meaningful components |
| **Tier C** (inventory row) | ~400 | Trivial presentational components, one-line helpers, constants |

**Total functions inventoried: ~1,000**

Every function appears in exactly one of the 12 documentation files below.

---

## 2. Documentation files

| File | Domain | Est. functions |
|---|---|---|
| `frontend-pages.md` | 21 page components + routing | ~50 |
| `frontend-components.md` | 43 components | ~120 |
| `frontend-hooks-context-lib.md` | 2 contexts, 4 hooks, 12 libs | ~80 |
| `backend-entry-middleware.md` | index.ts, 3 middlewares | ~30 |
| `backend-auth-users.md` | auth.ts, users.ts, auth-utils, crypto | ~60 |
| `backend-core-ai.md` | entries, appraisal, summaries, chat, feedback | ~55 |
| `backend-teams-goals.md` | orgs, teams, goals, subscriptions, reports | ~90 |
| `backend-integrations.md` | integrations, webhooks, adapters, OAuth | ~85 |
| `backend-platform-misc.md` | AI Pulse, push, translate, waitlist | ~45 |
| `backend-jobs-infra.md` | 11 jobs, email, push, logging, PostHog | ~65 |
| `shared-and-marketing.md` | Shared types, Next.js marketing site | ~40 |
| **function-index.md** | **This file — master inventory** | **~1,000** |

---

## 3. Tier definitions (from authoring guide)

### Tier A — Full 13-section template
**Required:** Identity, Purpose, ELI5, Technical, Inputs table, Returns, Execution flow, Dependencies, Call relationships, Side effects, Error handling, Real example, Summary

**Applies to:** Route handlers, middleware, exported service functions, job entry points, React contexts, custom hooks, page components, stateful components, API client modules, library entry points.

### Tier B — Compact template
**Required:** Identity, Purpose, Inputs, Returns, Calls, Side effects, Failure behavior, Summary

**Applies to:** Exported helpers, event handlers, meaningful presentational components, internal service methods.

### Tier C — Inventory row
**Required:** Name, file:line, Kind, One-line purpose, Why no deeper writeup

**Applies to:** Trivial presentational components, one-line helpers, constants, generated code.

---

## 4. Quick reference: key entry points

### Frontend
| Function | File:line | Tier |
|---|---|---|
| `App` | `client/src/App.tsx:210` | A |
| `AuthProvider` | `client/src/context/AuthContext.tsx:43` | A |
| `useAuth` | `client/src/context/AuthContext.tsx:283` | A |
| `apiRequest` | `client/src/lib/api.ts:38` | A |
| `refreshAccessToken` | `client/src/lib/api.ts:5` | A |
| `SubscriptionProvider` | `client/src/context/SubscriptionContext.tsx:15` | A |
| `useSubscription` | `client/src/context/SubscriptionContext.tsx:55` | B |
| `useHasOrg` | `client/src/hooks/useHasOrg.ts` | A |
| `useSSE` | `client/src/lib/useSSE.ts` | A |

### Backend — Auth & Users
| Function | File:line | Tier |
|---|---|---|
| `requireAuth` | `server/src/middleware/auth.ts:138` | A |
| `optionalAuth` | `server/src/middleware/auth.ts:206` | A |
| `generateAccessToken` | `server/src/middleware/auth.ts:41` | A |
| `createRefreshToken` | `server/src/middleware/auth.ts:57` | A |
| `validateRefreshToken` | `server/src/middleware/auth.ts:99` | A |
| `hashToken` | `server/src/middleware/auth.ts:257` | A |
| `signup handler` | `server/src/routes/auth.ts:38` | A |
| `login handler` | `server/src/routes/auth.ts:326` | A |
| `refresh handler` | `server/src/routes/auth.ts:630` | A |
| `hashPassword` | `server/src/lib/auth-utils.ts:9` | A |
| `comparePassword` | `server/src/lib/auth-utils.ts:16` | A |

### Backend — Core AI
| Function | File:line | Tier |
|---|---|---|
| `entriesRoutes.get('/')` | `server/src/routes/entries.ts:14` | A |
| `entriesRoutes.post('/')` | `server/src/routes/entries.ts:74` | A |
| `appraisalRoutes.post('/generate')` | `server/src/routes/appraisal.ts:111` | A |
| `summariesRoutes.post('/generate')` | `server/src/routes/summaries.ts:42` | A |
| `chatRoutes.post('/sessions/:id/messages')` | `server/src/routes/chat.ts:167` | A |
| `chatService.sendMessage` | `server/src/lib/chatService.ts` | A |
| `summaryService.generateMonthlySummary` | `server/src/lib/summaryService.ts` | A |

### Backend — Teams & Goals
| Function | File:line | Tier |
|---|---|---|
| `getUserOrgRole` | `server/src/services/authz.ts:44` | A |
| `getEffectiveTeamRole` | `server/src/services/authz.ts:64` | A |
| `canEditGoal` | `server/src/services/authz.ts:168` | A |
| `requireOrgRole` | `server/src/services/authz.ts:239` | A |
| `requireTeamRole` | `server/src/services/authz.ts:265` | A |
| `goalService.createGoal` | `server/src/services/goalService.ts` | A |
| `teamService.createTeam` | `server/src/services/teamService.ts` | A |
| `subscriptionService.getOrgTier` | `server/src/services/subscriptionService.ts:92` | A |

### Backend — Integrations
| Function | File:line | Tier |
|---|---|---|
| `integrations.ts` Jira OAuth handlers | `server/src/routes/integrations.ts:133` | A |
| `integrations.ts` GitHub OAuth handlers | `server/src/routes/integrations.ts:339` | A |
| `integrations.ts` Slack OAuth handlers | `server/src/routes/integrations.ts:547` | A |
| `jiraAdapter.exchangeCodeForToken` | `server/src/lib/jiraAdapter.ts` | A |
| `githubAdapter.exchangeCodeForToken` | `server/src/lib/githubAdapter.ts` | A |
| `slackOAuth.startSlackOAuth` | `server/src/lib/slackOAuth.ts` | A |
| `webhookSecurity.verifyGitHubSignature` | `server/src/lib/webhookSecurity.ts` | A |

### Backend — Jobs
| Function | File:line | Tier |
|---|---|---|
| `reminderJob.start` | `server/src/jobs/reminderJob.ts` | A |
| `monthlySummaryJob.start` | `server/src/jobs/monthlySummaryJob.ts` | A |
| `weeklySyncJob.start` | `server/src/jobs/weeklySyncJob.ts` | A |
| `goalRollupJob.start` | `server/src/jobs/goalRollupJob.ts` | A |
| `pruneJob.start` | `server/src/jobs/pruneJob.ts` | A |

---

## 5. How to use this index

1. **Find a function:** Search by name or file:line
2. **Go to its documentation:** Open the corresponding `.md` file in `04-function-documentation/`
3. **Understand its tier:** Tier A = full details, Tier B = compact, Tier C = inventory only

---

## 6. Coverage tracking

| Documentation file | Functions documented | Status |
|---|---:|---|
| `frontend-pages.md` | 0 / ~50 | Pending |
| `frontend-components.md` | 0 / ~120 | Pending |
| `frontend-hooks-context-lib.md` | 0 / ~80 | Pending |
| `backend-entry-middleware.md` | 0 / ~30 | Pending |
| `backend-auth-users.md` | 0 / ~60 | Pending |
| `backend-core-ai.md` | 0 / ~55 | Pending |
| `backend-teams-goals.md` | 0 / ~90 | Pending |
| `backend-integrations.md` | 0 / ~85 | Pending |
| `backend-platform-misc.md` | 0 / ~45 | Pending |
| `backend-jobs-infra.md` | 0 / ~65 | Pending |
| `shared-and-marketing.md` | 0 / ~40 | Pending |

*This index will be updated as each file is completed.*

---

## Related documents

- [Authoring guide](../_authoring-guide.md#3-function-documentation-tiers)
- [Progress tracker](../DOCUMENTATION_PROGRESS.md)

## Verification notes

Inventory generated by static analysis of all `.ts`/`.tsx` files in `client/src`, `server/src`, `shared`, `worklog-marketing/src` at commit `7567207`. Function count estimated via regex patterns; actual count will be refined during documentation.