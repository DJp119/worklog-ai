# Documentation Coverage Audit

> **Status:** In progress
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Senior

---

## 1. File coverage

| Category | Files discovered | Files documented | Files excluded | Explanation |
|---|---:|---:|---:|---|
| Application TypeScript (client/src) | 73 | 73 | 0 | All pages, components, hooks, context, libs |
| Application TypeScript (server/src) | 72 | 72 | 0 | All routes, services, libs, jobs, middleware |
| Shared types (shared/src) | 1 | 1 | 0 | `index.ts` (603 lines) |
| Marketing site (worklog-marketing/src) | 14 | 14 | 0 | Pages, components, content |
| SQL schema/migration files | 14 | 14 | 0 | All 14 files inventoried |
| Root config files | 20 | 20 | 0 | package.json, tsconfig, vercel, render, etc. |
| Tests (server/__tests__) | 6 | 6 | 0 | All test files listed |
| Tests (client/test) | 2 | 2 | 0 | Listed as not runnable |
| Vendored (.venv/, skills/) | 2,700+ | 0 | 2,700+ | Third-party, excluded per policy |
| Build artifacts (dist/, *.js, *.map) | 50+ | 0 | 50+ | Generated, excluded |
| **Total tracked (git ls-files)** | **2,758** | **~200** | **~2,558** | Excluded = vendored + build artifacts |

---

## 2. Function coverage

| Documentation file | Functions discovered | Functions documented | Functions remaining | Notes |
|---|---:|---:|---:|---|
| `backend-auth-users.md` | ~30 | ~30 | 0 | Complete |
| `backend-core-ai.md` | ~25 | 0 | ~25 | Pending |
| `backend-teams-goals.md` | ~40 | 0 | ~40 | Pending |
| `backend-integrations.md` | ~35 | 0 | ~35 | Pending |
| `backend-platform-misc.md` | ~20 | 0 | ~20 | Pending |
| `backend-jobs-infra.md` | ~30 | 0 | ~30 | Pending |
| `backend-entry-middleware.md` | ~15 | 0 | ~15 | Pending |
| `frontend-pages.md` | ~50 | 0 | ~50 | Pending |
| `frontend-components.md` | ~120 | 0 | ~120 | Pending |
| `frontend-hooks-context-lib.md` | ~80 | ~80 | 0 | Complete |
| `shared-and-marketing.md` | ~20 | 0 | ~20 | Pending |
| **Total** | **~465** | **~110** | **~355** | Tier A+B documented |

**Tier C (inventory only) functions:** ~400 additional — listed in `function-index.md` but not individually documented.

---

## 3. Class coverage

| File | Classes discovered | Classes documented | Classes remaining | Notes |
|---|---:|---:|---:|---|
| `client/src/context/AuthContext.tsx` | 1 (`AuthError`) | 1 | 0 | Documented in backend-auth-users context |
| `client/src/context/SubscriptionContext.tsx` | 0 | 0 | 0 | No classes |
| `server/src/services/authz.ts` | 0 | 0 | 0 | Functions only |
| `server/src/services/goalService.ts` | 0 | 0 | 0 | Functions only |
| `server/src/services/teamService.ts` | 0 | 0 | 0 | Functions only |
| `server/src/services/subscriptionService.ts` | 0 | 0 | 0 | Functions only |
| `server/src/services/reportGenerationService.ts` | 0 | 0 | 0 | Functions only |
| `server/src/services/activityAggregationService.ts` | 0 | 0 | 0 | Functions only |
| **Total** | **1** | **1** | **0** | Codebase is function-oriented |

---

## 4. API coverage

| API category | Endpoints discovered | Endpoints documented | Remaining |
|---|---:|---:|---:|
| Auth | 9 | 9 | 0 |
| Users | 4 | 4 | 0 |
| Entries | 5 | 5 | 0 |
| Appraisal | 4 | 4 | 0 |
| Summaries | 2 | 2 | 0 |
| Chat | 5 | 5 | 0 |
| Feedback | 2 | 2 | 0 |
| AI Pulse | 13 | 13 | 0 |
| Translate | 2 | 2 | 0 |
| Waitlist | 1 | 1 | 0 |
| Organizations | 7 | 7 | 0 |
| Teams | 6 | 6 | 0 |
| Goals | 12 | 12 | 0 |
| Integrations | 19 | 19 | 0 |
| Subscriptions | 1 | 1 | 0 |
| Reports | 3 | 3 | 0 |
| Channel Preferences | 5 | 5 | 0 |
| Push | 3 | 3 | 0 |
| GitHub Webhook | 1 | 1 | 0 |
| Jira Webhook | 1 | 1 | 0 |
| Slack Webhook | 1 | 1 | 0 |
| **Total** | **112** | **112** | **0** |

**All 112 endpoints documented across 5 endpoint reference files.**

---

## 5. Feature-flow coverage

| Feature flow | Documented | Status |
|---|---|---|
| Auth & Onboarding | ✅ | `auth-and-onboarding.md` |
| Weekly Logging | ✅ | `weekly-logging.md` |
| Dashboard & Summaries | ⬜ | Pending |
| Appraisal Generation | ✅ | `appraisal-generation.md` |
| AI Chat | ✅ | `ai-chat.md` |
| Goals & OKRs | ⬜ | Pending |
| Organizations & Teams | ⬜ | Pending |
| Integrations & Webhooks | ⬜ | Pending |
| AI Pulse | ⬜ | Pending |
| Billing & Reports | ⬜ | Pending |
| Notifications & Jobs | ⬜ | Pending |
| i18n & Localization | ⬜ | Pending |
| **Total** | **4/12** | 33% |

---

## 6. Verification status summary

| Label | Count | Description |
|---|---:|---|
| **Verified** | ~180 | Implementation inspected end-to-end at cited lines |
| **Partially verified** | ~120 | Main path inspected; some branches/runtime not exercised |
| **Not verified** | ~150 | Depends on unavailable credentials/services (AI, email, OAuth, webhooks, push) |
| **Not applicable** | ~15 | Concept doesn't exist in this project (e.g., GraphQL, SSR, microservices) |

---

## 7. Known limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| **Runtime behavior of external services** | AI providers, Brevo, OAuth providers, webhooks, web push cannot be exercised | Labeled "Not verified"; implementation patterns traced |
| **Client tests not runnable** | No test runner configured in `client/package.json` | Documented as gap; fix proposed in testing guide |
| **No CI/CD pipeline** | No automated quality gates | Proposed in deployment guide |
| **Line numbers pinned to `7567207`** | Future commits will shift lines | Re-verify on next documentation pass |
| **Subagents hit usage limits** | Pass 4/5 parallel work incomplete | Manual completion in progress |
| **No payment provider found** | Billing enforcement exists but no Stripe/Paddle integration | Documented as "Not found / Not verified" |

---

## 8. Coverage targets vs actual

| Metric | Target | Actual | Gap |
|---|---:|---:|---:|
| Backend route handlers documented | 100% | 100% | 0% |
| Database tables documented | 100% | 100% | 0% |
| API endpoints documented | 100% | 100% | 0% |
| Feature flows documented | 100% | 33% | 67% |
| Tier A functions documented | 100% | ~25% | 75% |
| Tier B functions documented | 100% | ~25% | 75% |
| Client tests runnable | 100% | 0% | 100% |
| CI/CD pipeline | 100% | 0% (proposed) | 100% |

---

## 9. Next steps to complete

1. **Complete Pass 4:** Document remaining 10 function documentation files (~355 functions)
2. **Complete Pass 5:** Document remaining 8 feature flows
3. **Pass 7 Audit:**
   - Generate final `DOCUMENTATION_COVERAGE.md` (this file)
   - Link check across all pages
   - Run `npm run typecheck`
   - Run `npm run lint`
   - Run `npm test --workspace=server`
   - `git status` confirms only `docs/` changed
   - Final summary

---

## Related documents

- [Progress tracker](../DOCUMENTATION_PROGRESS.md)
- [Function index](../04-function-documentation/function-index.md)
- [Feature index](../05-feature-flows/feature-index.md)

## Verification notes

Coverage audit performed by static analysis of repository at commit `7567207`.
Counts are estimates based on file inventory and regex patterns; exact numbers
will be finalized during audit pass.