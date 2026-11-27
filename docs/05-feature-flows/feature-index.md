# Feature Flow Index

> **Status:** Partially verified (inventory complete, docs in progress)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Feature inventory

| # | Feature | Status | Primary files |
|---|---|---|---|
| 1 | **Auth & Onboarding** | Implemented | `auth.ts`, `AuthContext.tsx`, `Onboarding.tsx`, `users.ts` |
| 2 | **Weekly Logging** | Implemented | `entries.ts`, `LogEntry.tsx`, `entriesRoutes` |
| 3 | **Dashboard & Summaries** | Implemented | `Dashboard.tsx`, `summaries.ts`, `monthlySummaryJob.ts` |
| 4 | **Appraisal Generation** | Implemented | `appraisal.ts`, `Appraisal.tsx`, `mistral.ts`, `openRouter.ts` |
| 5 | **AI Chat** | Implemented | `chat.ts`, `Chat.tsx`, `chatService.ts`, `useSSE.ts` |
| 6 | **Goals & OKRs** | Implemented | `goals.ts`, `goalsApi.ts`, `goalService.ts`, `authz.ts` |
| 7 | **Organizations & Teams** | Implemented | `organizations.ts`, `teams.ts`, `teamService.ts`, `authz.ts` |
| 8 | **Integrations & Webhooks** | Implemented | `integrations.ts`, `webhooks/*.ts`, `*Adapter.ts`, `slackOAuth.ts` |
| 9 | **AI Pulse** | Implemented | `aiPulse.ts`, `Hub.tsx`, `newsCollectionJob.ts` |
| 10 | **Billing & Reports** | Partial (no payment) | `reports.ts`, `subscriptions.ts`, `reportGenerationService.ts` |
| 11 | **Notifications & Jobs** | Implemented | `reminderJob.ts`, `weeklyDigestJob.ts`, `push.ts`, `email.ts` |
| 12 | **i18n & Localization** | Implemented | `i18n/index.ts`, `translate.ts`, `useAutoLocale.ts`, `email.ts` |

---

## 2. Flow documentation status

| Flow document | Status | Key trace |
|---|---|---|
| `auth-and-onboarding.md` | Pending | signup → verify → login → token refresh → onboarding gate |
| `weekly-logging.md` | Pending | LogEntry form → createEntry → entriesRoutes → work_log_entries |
| `dashboard-and-summaries.md` | Pending | Dashboard → entries/summaries API → monthlySummaryJob |
| `appraisal-generation.md` | Pending | criteria → entries fetch → Mistral/OpenRouter → generated_appraisals |
| `ai-chat.md` | Pending | ChatWindow → SSE → chatService → Mistral stream → chat_messages |
| `goals-and-okrs.md` | Pending | createGoal → canEditGoal → goalService → rollup |
| `organizations-and-teams.md` | Pending | createOrg → teamService → closure table → authz ranks |
| `integrations-and-webhooks.md` | Pending | OAuth flow → webhook verification → sync job → goal_links |
| `ai-pulse.md` | Pending | newsCollectionJob → Mistral categorize → articles/cards/bookmarks |
| `billing-and-reports.md` | Pending | subscription tier → enterprise gate → reportGenerationService |
| `notifications-and-jobs.md` | Pending | reminderJob → email.ts → Brevo → push.ts → webPush |
| `i18n-and-localization.md` | Pending | detectInitialLanguage → translate API → translation_cache |

---

## 3. How to read a feature flow

Each flow document follows this structure:

1. **What does this feature do?** — Plain language
2. **User interaction trace** — Numbered steps from click to render
3. **Sequence diagram** — Mermaid showing component ↔ API ↔ DB ↔ external
4. **Files involved** — Table with responsibilities
5. **Functions involved** — In execution order
6. **Data transformation** — How payloads change across layers
7. **Failure scenarios** — What happens at each failure point
8. **Simple story** — Real-world analogy

---

## 4. Cross-cutting patterns

| Pattern | Appears in flows |
|---|---|
| **Auth guard** | All protected flows: `requireAuth` → `req.userId` + service-role client |
| **401 refresh** | All API calls: `apiRequest` catches 401 → `/auth/refresh` → retry |
| **Org/team authz** | Teams/Goals/Integrations: `requireOrgRole` / `requireTeamRole` → `authz.ts` |
| **Service-role discipline** | All DB writes: `.eq('user_id', req.userId)` or org/team scoping |
| **Async AI** | Appraisal/Chat/Reports: request → background → poll/webhook → result |
| **Job scheduling** | Notifications: cron → lock → work → release lock → log |

---

## 5. Verification labels

Each flow document will mark steps as:
- ✅ **Verified** — Code path traced end-to-end
- ⚠️ **Partially verified** — Main path traced; branches or runtime not exercised
- ❌ **Not verified** — Depends on unavailable credentials/services
- 📝 **Observation** — Notable implementation detail

---

## Related documents

- [Function index](../04-function-documentation/function-index.md)
- [System architecture](../02-architecture/system-architecture.md)
- [API overview](../06-api-reference/api-overview.md)

## Verification notes

Flow inventory derived from route handlers, page components, and job modules at commit `7567207`. Each flow will be traced through the actual implementation.