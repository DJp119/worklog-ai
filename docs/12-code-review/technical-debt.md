# Technical Debt

> **Status:** Partially verified (static analysis)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Senior

---

## 1. Debt inventory by category

| Category | Count | Severity |
|---|---:|---|
| Architecture | 4 | High |
| Security | 6 | High/Medium |
| Code quality | 8 | Medium/Low |
| Testing | 4 | Medium |
| Operations | 5 | Medium |
| Documentation | 3 | Low |

---

## 2. Architecture debt

| ID | Title | Description | Impact | Effort |
|---|---|---|---|---|
| ARCH-01 | **Service-role bypasses RLS; all authorization in Node** | Every query must manually scope by `user_id`/`org_id`. No automated guard. | Cross-tenant leak if missed | High (refactor to middleware or repository layer) |
| ARCH-02 | **Cron jobs in HTTP process** | 11 jobs share CPU/memory with requests; no horizontal scaling | Resource contention, reliability | High (separate worker) |
| ARCH-03 | **No message queue** | Webhook failures not retried; no backpressure | Lost events, no replay | High (add queue) |
| ARCH-04 | **No repository/DAO layer** | Supabase queries inline in routes; duplication, inconsistent patterns | Maintenance burden, bugs | Medium (extract services) |

---

## 3. Security debt

| ID | Title | Description | Severity | Effort |
|---|---|---|---|---|
| SEC-01 | **Refresh tokens in localStorage/sessionStorage** | XSS can steal long-lived tokens | High | Medium (httpOnly cookies) |
| SEC-02 | **No CSP / Helmet** | No Content Security Policy headers | Medium | Low |
| SEC-03 | **Inconsistent validation** | Manual, regex, Zod mixed; some endpoints unvalidated | Medium | Medium |
| SEC-04 | **Webhook replay protection incomplete** | GitHub/Jira lack delivery ID tracking | Medium | Medium |
| SEC-04 | **Admin endpoints for AI Pulse lack auth** | `aiPulse.ts:285`, `:335` | Medium | Low |
| SEC-06 | **No dependency scanning** | Supply chain risk | Low | Low (add to CI) |

---

## 4. Code quality debt

| ID | Title | Description | Severity | Effort |
|---|---|---|---|---|
| CQ-01 | **Inconsistent error handling** | Some routes return `{error}`, others `{success:false,error}` | Medium | Low |
| CQ-02 | **No pagination on list endpoints** | `GET /api/entries`, `/api/goals`, etc. return all rows | Medium | Low |
| CQ-03 | **Magic strings for roles/statuses** | `'member'`, `'active'`, `'manual'` scattered | Low | Low (constants) |
| CQ-04 | **`any` types in route handlers** | `AuthRequest` uses `any` for `supabase`, `body` | Low | Low |
| CQ-05 | **Duplicate validation logic** | Email, password strength repeated | Low | Low |
| CQ-06 | **No OpenAPI/Swagger** | API docs manual | Low | Medium |
| CQ-07 | **Mixed RLS policy styles** | User-scoped + deny-all-public | Low | Low |
| CQ-08 | **`SubscriptionContext` fetches without auth header** | Likely broken in production | Medium | Low |

---

## 5. Testing debt

| ID | Title | Description | Severity | Effort |
|---|---|---|---|---|
| TEST-01 | **Client tests not runnable** | No test runner configured | Medium | Low |
| TEST-02 | **No CI pipeline** | No automated gates | Medium | Low |
| TEST-03 | **No E2E tests** | Critical paths untested | High | Medium |
| TEST-04 | **No contract testing** | Client/server drift possible | Medium | Medium |

---

## 6. Operations debt

| ID | Title | Description | Severity | Effort |
|---|---|---|---|---|
| OPS-01 | **No CI/CD pipeline** | Manual deploy only | Medium | Low |
| OPS-02 | **No migration runner** | Manual SQL application | Medium | Low |
| OPS-03 | **Payment provider not implemented** | Subscriptions table exists but no billing | High | High |
| OPS-04 | **No dependency scanning** | Supply chain risk | Low | Low |
| OPS-05 | **No structured logging correlation in client** | Debugging hard | Low | Low |

---

## 6. Documentation debt

| ID | Title | Description | Severity |
|---|---|---|---|
| DOC-01 | **Root docs stale** | README, CLAUDE.md, AGENTS.md contradict code | High |
| DOC-02 | **No API reference** | Manual only | Medium |
| DOC-03 | **No architecture decision records** | Decisions only in code/comments | Low |

---

## 7. Debt priority matrix

| Priority | Items | Rationale |
|---|---|---|
| **P0 (Do now)** | SEC-01, ARCH-01, OPS-03 | Security critical, blocking billing |
| **P1 (This sprint)** | ARCH-02, ARCH-03, SEC-02, SEC-03, CQ-02, TEST-01, OPS-01 | High impact, medium effort |
| **P2 (Next quarter)** | ARCH-01 (refactor), ARCH-04, SEC-04, CQ-01, CQ-06, TEST-02, OPS-02 | Architectural, medium-high effort |
| **P3 (Backlog)** | ARCH-04, CQ-03, CQ-04, CQ-05, CQ-07, TEST-03, TEST-04, OPS-04, OPS-05, DOC-02, DOC-03 | Quality, docs, nice-to-have |

---

## 8. Debt trend

| Metric | Current | Target |
|---|---|---|
| P0 items | 3 | 0 |
| P1 items | 7 | ≤2 |
| Total debt items | 37 | ≤15 |
| Critical security findings | 1 (SEC-01) | 0 |

---

## Related documents

- [Risks and observations](./risks-and-observations.md)
- [Improvement roadmap](./improvement-roadmap.md)
- [Security findings](../08-security/threat-model-and-findings.md)
- [Auth security](../08-security/security-architecture.md#2-authentication-security)

## Verification notes

Debt items identified by static code inspection at commit `7567207`. No runtime
analysis or team survey performed. Severity and effort estimates are
engineering judgment.