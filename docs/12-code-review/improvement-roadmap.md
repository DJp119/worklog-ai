# Improvement Roadmap

> **Status:** Planning (derived from debt/risks)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Senior

---

## 1. Roadmap principles

| Principle | Application |
|---|---|
| **Security first** | P0 items block everything else |
| **User value** | Features that unblock customers before internal polish |
| **Incremental** | Each step ships; no big-bang rewrites |
| **Measurable** | Each milestone has a verifiable outcome |

---

## 2. Quarter 1 (Immediate — 0-4 weeks)

### Goal: Eliminate critical security gaps and enable billing

| Item | Action | Owner | Done when |
|---|---|---|---|
| **SEC-01** | Move refresh tokens to httpOnly cookies (SameSite=Strict, Secure) | Backend | Cookies set on login/refresh; localStorage cleared |
| **SEC-02** | Add `helmet` + CSP headers | Backend | `npm i helmet`; CSP allows Vite HMR in dev |
| **OPS-03** | Implement minimal Stripe checkout for Pro/Enterprise | Backend + Client | `POST /api/billing/checkout` → Stripe session → webhook → update `subscriptions` |
| **TEST-01** | Enable client Vitest | Frontend | `npm test --workspace=client` passes |
| **CI-01** | Add GitHub Actions: typecheck, lint, server tests | DevOps | Green on every PR |

**Exit criteria:** No P0 risks; `npm test` passes in both workspaces; CI green.

---

## 3. Quarter 2 (4-12 weeks)

### Goal: Stabilize architecture and add observability

| Item | Action | Owner | Done when |
|---|---|---|---|
| **ARCH-02** | Extract cron jobs to separate Render worker service | Backend | New `worker` service; `server/src/jobs/` moved; HTTP process lighter |
| **ARCH-03** | Add Redis + BullMQ for webhook retries & async AI | Backend | `npm i bullmq ioredis`; webhook handlers enqueue jobs |
| **SEC-04** | Add webhook replay protection (store processed delivery IDs) | Backend | `processed_webhook_events` table; check on receive |
| **CQ-02** | Add cursor pagination to all list endpoints | Backend | `?cursor=&limit=` on `/entries`, `/goals`, `/orgs`, `/teams` |
| **CQ-01** | Standardize error response format | Backend | All routes return `{ success, data?, error? }`; auth routes aligned |
| **TEST-02** | Add CI pipeline (typecheck, lint, server tests, client tests) | DevOps | GitHub Actions YAML; required checks on PR |
| **OBS-05** | Centralize AI provider selection/fallback | Backend | New `lib/aiProvider.ts` with `generate(prompt, options?)` |

**Exit criteria:** Separate worker deployed; webhook retries work; pagination on all lists; CI required.

---

## 4. Quarter 3 (12-24 weeks)

### Goal: Scale architecture and add platform features

| Item | Action | Owner | Done when |
|---|---|---|---|
| **ARCH-01** | Introduce repository layer for DB access | Backend | `lib/repositories/` with `UserRepo`, `EntryRepo`, etc.; all routes use repos |
| **ARCH-04** | Add request validation middleware (Zod schemas) | Backend | `middleware/validate.ts`; all routes declare schema |
| **SEC-04** | Add per-user rate limits (token bucket in Redis) | Backend | `rate-limiter-flexible`; per-user + IP |
| **TEST-03** | Add Playwright E2E tests for critical flows | QA | `auth`, `entries`, `appraisal`, `goals` covered |
| **TEST-04** | Add contract testing (Pact or similar) | QA | Client/server type drift caught in CI |
| **OPS-02** | Add migration runner (Supabase CLI or custom) | DevOps | `supabase migration up` or custom `npm run migrate` |
| **FEAT-01** | Add team workspace onboarding wizard | Full stack | Multi-step flow for new org admins |
| **FEAT-02** | Add Slack `/worklog` command parity with web | Backend | All entry/create/checkin actions via Slack |

**Exit criteria:** Repository layer covers 80% of queries; validation on all routes; E2E covers top 5 flows.

---

## 5. Quarter 4 (24-36 weeks)

### Goal: Platform maturity and extensibility

| Item | Action | Owner | Done when |
|---|---|---|---|
| **ARCH-03** | Migrate to message queue for all async work | Backend | BullMQ for AI, email, sync, webhooks |
| **FEAT-03** | Public API (API keys, rate limits, docs) | Backend | `/api/v1/*` with API key auth; OpenAPI spec |
| **FEAT-04** | Webhook delivery dashboard | Frontend + Backend | `/settings/webhooks` with retry UI |
| **FEAT-05** | Advanced AI: custom prompts, fine-tuning | Backend | Prompt templates per org; evaluation harness |
| **FEAT-06** | Mobile app (React Native / Expo) | Mobile | Shared `shared/` types; Expo + `react-native-web` |
| **DOC-02** | Publish OpenAPI spec + developer portal | DevRel | `openapi.json` served; Redoc UI |
| **OBS-05** | AI provider marketplace (Mistral, OpenRouter, NIM, Anthropic) | Backend | Plugin architecture; per-org model selection |

**Exit criteria:** Public API in beta; webhook dashboard live; mobile app in TestFlight.

---

## 6. Cross-cutting investments (ongoing)

| Area | Quarterly allocation |
|---|---|
| **Tech debt paydown** | 20% of sprint capacity |
| **Dependency updates** | Monthly `npm audit fix` + major version review |
| **Documentation** | Update with every feature; ADRs for decisions |
| **Performance budget** | Monitor `api_request` duration p95 < 500ms |
| **Security** | Annual pentest; quarterly dependency audit |

---

## 7. Success metrics

| Metric | Current | Q1 target | Q2 target | Q3 target | Q4 target |
|---|---:|---:|---:|---:|---:|
| Critical security findings | 1 | 0 | 0 | 0 | 0 |
| P1 risks | 7 | ≤2 | 0 | 0 | 0 |
| Server test coverage | Unknown | >60% | >75% | >85% | >90% |
| Client test coverage | 0% | >40% | >60% | >70% | >80% |
| E2E coverage (top flows) | 0% | 0% | 50% | 80% | 100% |
| CI/CD pipeline | None | Basic | Full | Full + contract | Full + contract |
| Pagination on lists | 0/8 | 8/8 | 8/8 | 8/8 | 8/8 |
| Webhook retry rate | 0% | 0% | >95% | >99% | >99.9% |
| API p95 latency | Unknown | <500ms | <300ms | <200ms | <150ms |

---

## 8. Resource assumptions

| Role | Q1 | Q2 | Q3 | Q4 |
|---|---:|---:|---:|---:|
| Backend engineers | 2 | 2 | 2 | 2 |
| Frontend engineers | 1 | 1 | 1 | 1 |
| DevOps/Platform | 0.5 | 1 | 1 | 1 |
| QA/Automation | 0 | 0.5 | 1 | 1 |
| DevRel/Docs | 0 | 0 | 0.5 | 0.5 |

---

## 9. Decision log (ADR template)

```markdown
# ADR-XXX: [Title]

## Context
[What problem are we solving?]

## Decision
[What are we doing?]

## Consequences
### Positive
- 
### Negative
- 

## Alternatives considered
- 

## Links
- Related issues:
- Implementation PR:
```

**First ADRs to write:**
- ADR-001: httpOnly cookies for refresh tokens
- ADR-002: Separate worker for cron jobs
- ADR-003: Redis + BullMQ for async work
- ADR-004: Repository layer for DB access
- ADR-005: Stripe for billing

---

## Related documents

- [Technical debt](./technical-debt.md)
- [Risks and observations](./risks-and-observations.md)
- [Security findings](../08-security/threat-model-and-findings.md)

## Verification notes

Roadmap derived from debt/risks analysis at commit `7567207`. Priorities
reflect security-first principle. Effort estimates are rough engineering
judgment. No team capacity planning performed.