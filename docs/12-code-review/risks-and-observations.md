# Risks and Observations

> **Status:** Partially verified (static analysis)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Senior

---

## 1. Critical risks

| ID | Risk | Likelihood | Impact | Evidence |
|---|---|---|---|---|
| RISK-01 | **Cross-tenant data leak** — missed `user_id` scope | Medium | Critical | `middleware/auth.ts:1-6` warns; no automated check |
| RISK-02 | **Refresh token theft via XSS** | Medium | Critical | Tokens in localStorage/sessionStorage |
| RISK-03 | **Billing enforcement without payment provider** | High | High | `subscriptionService.ts` gates features; no Stripe/Paddle |
| RISK-04 | **Cron job resource contention** | Medium | High | 11 jobs + HTTP in single Node process |
| RISK-05 | **Webhook event loss** | Medium | Medium | No retry queue; failed webhooks dropped |

---

## 2. High risks

| ID | Risk | Likelihood | Impact | Evidence |
|---|---|---|---|---|
| RISK-06 | **Client auth broken without httpOnly cookies** | High | High | `AuthContext.tsx`, `authStorage.ts` |
| RISK-07 | **SubscriptionContext broken** — no auth header | High | Medium | `SubscriptionContext.tsx:27` |
| RISK-08 | **No pagination on list endpoints** | High | Medium | `entries.ts`, `goals.ts`, `organizations.ts` |
| RISK-09 | **Inconsistent validation** | High | Medium | Mixed manual/Zod/regex |
| RISK-10 | **No CI/CD** | High | Medium | No GitHub Actions |
| RISK-11 | **Payment provider missing** | Certain | High | No Stripe/Paddle routes |

---

## 3. Medium risks

| ID | Risk | Likelihood | Impact | Evidence |
|---|---|---|---|---|
| RISK-12 | **Cron job duplicate runs** | Medium | Medium | Locks mitigate, not eliminate |
| RISK-13 | **Webhook replay (GitHub/Jira)** | Medium | Medium | No delivery ID tracking |
| RISK-14 | **Admin AI Pulse endpoints unprotected** | Medium | Low | `aiPulse.ts:285`, `:335` |
| RISK-15 | **No pagination** | Certain | Medium | Multiple list endpoints |
| RISK-16 | **No CI/CD** | Certain | Medium | No `.github/workflows` |
| RISK-17 | **Magic strings for enums** | Certain | Low | Scattered `'member'`, `'active'` |
| RISK-18 | **No API versioning** | Certain | Low | Breaking changes risk |
| RISK-19 | **Mixed RLS styles** | Certain | Low | User-scoped + deny-all |
| RISK-20 | **Client tests not runnable** | Certain | Medium | No test runner |

---

## 4. Low risks

| ID | Risk | Likelihood | Impact | Evidence |
|---|---|---|---|---|
| RISK-21 | **Magic strings for roles/statuses** | Certain | Low | Scattered |
| RISK-22 | **`any` types in handlers** | Certain | Low | `AuthRequest` uses `any` |
| RISK-23 | **Duplicate validation logic** | Certain | Low | Email/password repeated |
| RISK-24 | **No OpenAPI spec** | Certain | Low | Manual docs only |
| RISK-25 | **Mixed RLS styles** | Certain | Low | Two patterns |
| RISK-26 | **`SubscriptionContext` fetch bug** | High | Low | `SubscriptionContext.tsx:27` |
| RISK-27 | **No CSP headers** | Certain | Low | No `helmet` |
| RISK-28 | **OAuth state cleanup only at startup** | Certain | Low | `index.ts:247` |
| RISK-29 | **No dependency scanning** | Certain | Low | No CI |
| RISK-30 | **Root docs stale** | Certain | Low | README/CLAUDE/AGENTS |

---

## 5. Observations (not risks, but notable)

### 5.1 Architecture observations

| Obs | Description |
|---|---|
| OBS-01 | **Modular monolith** — 21 routers, 6 services, 11 jobs in one process. Simple ops, shared failure domain. |
| OBS-02 | **Shallow layering** — Routes often query DB directly; services only for complex domains. |
| OBS-03 | **Service-role discipline** — Authorization is a coding convention, not enforced by framework. |
| OBS-04 | **Multi-provider AI** — Mistral primary, OpenRouter/NIM fallbacks. Provider selection not centralized. |
| OBS-05 | **Custom auth, not Supabase Auth** — Root docs claim magic links; reality is bcrypt+JWT. |

### 5.2 Code observations

| Obs | Description |
|---|---|
| OBS-06 | **Token rotation on every refresh** — Good security practice. |
| OBS-07 | **Password reset revokes ALL refresh tokens** — Correct compromise recovery. |
| OBS-08 | **Team closure table** — Materialized ancestry for O(1) ancestor queries. |
| OBS-09 | **Rank maps for roles** — Numeric comparison, never lexical. |
| OBS-10 | **Startup lock cleanup** — Clears orphaned `is_syncing`/`is_refreshing` locks. |
| OBS-11 | **In-memory tier cache (60s)** — Reduces DB hits for subscription checks. |

### 5.3 Data observations

| Obs | Description |
|---|---|
| OBS-12 | **47 tables** — Significant schema for a "weekly log" product. |
| OBS-13 | **Two token tables** — `password_reset_tokens` + `password_resets` (legacy). |
| OBS-14 | **Array FK** — `monthly_summaries.source_entry_ids` not enforced. |
| OBS-15 | **Deny-all-public RLS** — Newer tables; older use user-scoped. |
| OBS-16 | **No payment columns on subscriptions** — `provider`, `provider_subscription_id` missing. |

### 5.4 Integration observations

| Obs | Description |
|---|---|
| OBS-17 | **Three OAuth flows per provider** — User, org, and (GitHub) App. |
| OBS-18 | **Slack user link via short code** — Novel UX for `/worklog link <code>`. |
| OBS-19 | **Encrypted token storage** — AES-256-GCM for OAuth tokens. |
| OBS-20 | **Sync locks per user/team** — Prevents concurrent Jira/GitHub sync. |

---

## 6. Verification status

| Area | Verified | Partially | Not verified |
|---|---:|---:|---:|
| Auth flow | ✅ | | |
| Authorization logic | ✅ | | |
| Route inventory | ✅ | | |
| Database schema | ✅ | | |
| AI provider wiring | | ✅ | |
| Email delivery | | | ✅ |
| OAuth flows | | ✅ | |
| Webhook delivery | | | ✅ |
| Cron job execution | | ✅ | |
| Payment/billing | | | ✅ (not found) |
| Client test runnability | ✅ (not runnable) | | |
| CI/CD | ✅ (absent) | | |

---

## Related documents

- [Technical debt](./technical-debt.md)
- [Improvement roadmap](./improvement-roadmap.md)
- [Threat model](../08-security/threat-model-and-findings.md)
- [Security architecture](../08-security/security-architecture.md)

## Verification notes

Risks and observations derived from static code inspection at commit `7567207`.
No runtime testing, penetration testing, or team survey performed. Likelihood
and impact ratings are engineering judgment based on code patterns.