# Threat Model and Findings

> **Status:** Partially verified (static analysis)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Senior

---

## 1. STRIDE analysis

| Threat | Vectors found | Mitigations | Gaps |
|---|---|---|---|
| **Spoofing** | JWT forgery, OAuth impersonation, webhook spoofing | JWT secret ≥32 chars, OAuth state, webhook HMAC | No certificate pinning; JWT alg not enforced (HS256 only) |
| **Tampering** | Request body modification, token tampering, DB injection | HTTPS, parameterized queries, signature verification | No request signing; CSP missing |
| **Repudiation** | Actions not attributable | Request IDs, PostHog analytics, auth event logs | No immutable audit log; logs in PostHog only |
| **Information Disclosure** | Cross-tenant data access, error leaks, token exposure | Service-role + Node scoping, generic auth errors, no stack traces in prod | Tokens in localStorage; debug logs in dev |
| **Denial of Service** | Rate limit bypass, cron job overload, AI cost explosion | Rate limits (prod), in-process cron, AI provider limits | No per-user limits; no AI request budgeting; cron in same process |
| **Elevation of Privilege** | Authz bypass, org/team role confusion, JWT privilege escalation | Rank maps, param-only authz, short JWT expiry | No automated authz tests; manual discipline |

---

## 2. Authentication findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| AUTH-01 | Refresh tokens stored in localStorage/sessionStorage — accessible to XSS | High | `AuthContext.tsx:134-140`, `authStorage.ts` |
| AUTH-02 | No httpOnly cookie option for tokens | High | `AuthContext.tsx`, `api.ts` |
| AUTH-03 | JWT algorithm not explicitly validated (defaults to HS256) | Medium | `middleware/auth.ts:120-126` |
| AUTH-04 | No password breach checking (HIBP) | Low | `auth-utils.ts` |
| AUTH-05 | Email verification token single-use but no rate limit on verify endpoint | Low | `auth.ts:163` |
| AUTH-06 | Password reset revokes ALL refresh tokens (good) | — | `auth.ts:599-606` |
| AUTH-07 | Login uses generic error for user not found / wrong password (good) | — | `auth.ts:342-345` |
| AUTH-08 | Forgot password always returns success (anti-enumeration, good) | — | `auth.ts:496-500` |
| AUTH-09 | `rememberMe` extends refresh token to 30 days vs 7 days | Medium | `auth.ts:368` |
| AUTH-10 | Token rotation on every refresh (good) | — | `auth.ts:652-662` |

---

## 3. Authorization findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| AUTHZ-01 | Service-role client bypasses RLS; all scoping in Node — manual discipline | Critical | `middleware/auth.ts:1-6`, `database.ts:41` |
| AUTHZ-02 | No automated check that every `req.supabase` query has user/org scope | High | Route handlers |
| AUTHZ-03 | `requireOrgRole` / `requireTeamRole` only trust `req.params` (good) | — | `authz.ts:233-237`, `:261-263` |
| AUTHZ-04 | Effective team role includes ancestor teams (manager/admin/owner only) | — | `authz.ts:92-111` |
| AUTHZ-05 | Org role never short-circuits team role check (good — Bug CP fix) | — | `authz.ts:114-118` |
| AUTHZ-06 | `canEditGoal` correctly handles individual/team/department/org scopes | — | `authz.ts:168-221` |
| AUTHZ-06 | 60-second tier cache may serve stale tier after subscription change | Low | `subscriptionService.ts:22-23` |
| AUTHZ-07 | No `is_active` flag on users — cannot disable without delete | Low | `users` table |

---

## 4. Input validation findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| VAL-01 | Mixed validation styles: manual, regex, Zod — inconsistent | Medium | Route handlers |
| VAL-02 | Some endpoints lack request body validation entirely | Medium | e.g., `aiPulse.ts` admin endpoints |
| VAL-03 | No centralized validation middleware | Medium | `index.ts` |
| VAL-04 | Database constraints not mirrored in API validation | Low | Unique keys, check constraints |
| VAL-05 | File upload not present (no attack surface) | — | N/A |

---

## 5. Webhook & integration findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| WH-01 | GitHub webhook: no replay protection beyond delivery ID | Medium | `webhooks/github.ts` |
| WH-02 | Jira webhook: no replay protection | Medium | `webhooks/jira.ts` |
| WH-03 | Slack webhook: 5-min timestamp window (good) | — | `webhookSecurity.ts` |
| WH-04 | OAuth state stored in `temp_oauth_states` with 10-min expiry (good) | — | `integrations.ts` |
| WH-05 | OAuth state cleanup only at server startup (not periodic) | Low | `index.ts:247` |
| WH-06 | Slack user link codes in `temp_slack_codes` with expiry (good) | — | `integrations.ts:794` |
| WH-07 | Encrypted OAuth token storage (AES-256-GCM) | — | `crypto.ts`, `user_integrations` |
| WH-08 | Integration sync locks (`is_syncing`, `is_refreshing`) prevent concurrent runs | — | `weeklySyncJob.ts` |
| WH-09 | Startup clears orphaned locks (good) | — | `index.ts:242-251` |
| WH-10 | No automated webhook signature test in CI | Low | No CI |

---

## 6. AI & data handling findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| AI-01 | Prompts built server-side (good — no user-controlled prompt injection) | — | `chatService.ts`, `appraisal.ts` |
| AI-02 | User entries included in AI prompts — data leaves infrastructure | Medium | `appraisal.ts:140`, `chatService.ts` |
| AI-03 | Multiple AI providers (Mistral, OpenRouter, NIM, Anthropic) — supply chain | Low | `index.ts:284-293` |
| AI-04 | No request/response logging for AI calls (cost debugging) | Low | `mistral.ts`, `openRouter.ts` |
| AI-05 | AI Pulse articles public (no auth) — by design | — | `aiPulse.ts:70` |
| AI-06 | Admin endpoints for AI Pulse content creation — no auth in handler | Medium | `aiPulse.ts:285`, `:335` |

---

## 7. Client-side findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| CLI-01 | Tokens in localStorage/sessionStorage — XSS accessible | High | `AuthContext.tsx`, `authStorage.ts` |
| CLI-02 | No CSP / `helmet` equivalent | Medium | `index.ts`, `vite.config.ts` |
| CLI-03 | Service worker registered unconditionally | Low | `main.tsx:27-33` |
| CLI-04 | Analytics (PostHog) identifies user on login/hydration | Low | `AuthContext.tsx:78-82` |
| CLI-05 | Subscription context fetches without auth header (observed bug) | Medium | `SubscriptionContext.tsx:27` |
| CLI-06 | i18n fetches translations from API — cache poisoning limited by version | Low | `i18n/index.ts` |

---

## 8. Operational & infrastructure findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| OPS-01 | All cron jobs in same process as HTTP — resource contention | Medium | `index.ts:312-320` |
| OPS-02 | No horizontal scaling for cron (locks mitigate, not eliminate) | Medium | `index.ts`, `jobs/*` |
| OPS-03 | No message queue — webhook failures not retried | Medium | `webhooks/*.ts` |
| OPS-04 | No database migration runner — manual SQL application | Low | `migrations/`, `supabase-migrations/` |
| OPS-05 | No CI/CD pipeline in repo | Low | No `.github/workflows` |
| OPS-06 | Environment validation only warns, doesn't fail (except JWT) | Low | `index.ts:261-295` |
| OPS-07 | Payment provider not implemented (subscriptions table exists) | High | `subscriptionService.ts`, `subscriptions` table |
| OPS-08 | `SubscriptionContext` fetches without auth header (likely broken) | Medium | `SubscriptionContext.tsx:27` |
| OPS-09 | No dependency vulnerability scanning | Low | No GitHub Actions |
| OPS-10 | LogRocket dependency but init not verified | Low | `package.json` |

---

## 9. Database findings

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| DB-01 | RLS policies dual style (user-scoped + deny-all) — confusing | Low | `schema.md` |
| DB-02 | Service-role bypasses RLS — Node is sole enforcer | Critical | `middleware/auth.ts:1-6` |
| DB-03 | Missing FKs on soft relationships (goal_links.org_id, etc.) | Low | `relationships.md` |
| DB-04 | Array FK (`source_entry_ids`) not enforced | Low | `monthly_summaries` |
| DB-05 | Token hashing migration destructive (drops column) | High | `2026-06-07_security_token_hashing.sql` |
| DB-06 | No automated migration testing | Low | No CI |

---

## 10. Priority remediation roadmap

| Priority | Action | Effort |
|---|---|---|
| P0 | Move refresh tokens to httpOnly cookies (or add secure flag + SameSite) | Medium |
| P0 | Add automated authz test: every `req.supabase` query must have scope filter | Medium |
| P0 | Implement payment provider or remove subscription gating | High |
| P1 | Add CSP headers via `helmet` or manual middleware | Low |
| P1 | Add webhook replay protection (store processed delivery IDs) | Medium |
| P1 | Add per-user rate limits (not just IP) | Medium |
| P1 | Fix `SubscriptionContext` auth header | Low |
| P2 | Add CI with typecheck, lint, vitest, dependency audit | Medium |
| P2 | Add migration runner or document manual process clearly | Low |
| P2 | Add password breach check (HIBP) on signup/password change | Low |
| P3 | Separate cron worker from HTTP process | High |
| P3 | Add message queue for webhook retries | High |
| P3 | Implement user disable (`is_active`) | Low |

---

## Related documents

- [Security architecture](./security-architecture.md)
- [Auth architecture](../02-architecture/auth-and-authorization.md)
- [Code review risks](../12-code-review/risks-and-observations.md)

## Verification notes

Findings derived from static code inspection at commit `7567207`. No runtime
testing, penetration testing, or dependency scanning performed. Severity
ratings follow CVSS-inspired scale adapted for code review context.