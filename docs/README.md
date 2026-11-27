# Worklog AI — Complete Technical Documentation

> **Source commit:** `7567207` (2026-07-16)
> **Generated:** 2026-11-27
> **Status:** In progress — see [Documentation Progress](./DOCUMENTATION_PROGRESS.md)

---

## 📚 Navigation

### Start here

| Audience | Start with |
|---|---|
| **New to programming** | [Glossary](./13-glossary/beginner-friendly-glossary.md) → [Project Overview](./01-project-overview.md) → [Learning Path](./14-learning-path/how-to-understand-this-codebase.md) |
| **Junior developer** | [Project Overview](./01-project-overview.md) → [System Architecture](./02-architecture/system-architecture.md) → [Directory Map](./03-codebase-structure/directory-map.md) |
| **Senior engineer** | [System Architecture](./02-architecture/system-architecture.md) → [Auth Architecture](./02-architecture/auth-and-authorization.md) → [Database Schema](./07-database/schema.md) |
| **Debugging a bug** | [Feature Flows](./05-feature-flows/feature-index.md) → [Function Docs](./04-function-documentation/function-index.md) → [Risks](./12-code-review/risks-and-observations.md) |
| **Adding a feature** | [API Reference](./06-api-reference/api-overview.md) → [Function Docs](./04-function-documentation/function-index.md) → [Database Schema](./07-database/schema.md) |
| **Deploying** | [Deployment Architecture](./02-architecture/deployment-architecture.md) → [Environment Variables](./10-environment-and-deployment/environment-variables.md) |

---

## 📁 Documentation Structure

### 01 — Project Overview
- [Project Overview](./01-project-overview.md) — What this is, who uses it, feature inventory, tech stack, documentation drift

### 02 — Architecture
- [System Architecture](./02-architecture/system-architecture.md) — High-level diagram, request lifecycle, trust boundaries, failure domains
- [Frontend Architecture](./02-architecture/frontend-architecture.md) — React SPA, routing, AuthContext, API client, i18n, styling
- [Backend Architecture](./02-architecture/backend-architecture.md) — Express bootstrap, middleware chain, 21 routers, 11 jobs
- [Database Architecture](./02-architecture/database-architecture.md) — 47 tables, 5 domains, RLS reality, access patterns
- [Auth & Authorization](./02-architecture/auth-and-authorization.md) — Custom JWT, refresh tokens, org/team rank maps, service-role discipline
- [Deployment Architecture](./02-architecture/deployment-architecture.md) — Vercel, Render, Supabase, DNS, CI/CD proposal

### 03 — Codebase Structure
- [Directory Map](./03-codebase-structure/directory-map.md) — Complete file tree with exclusions
- [File-by-File: Client](./03-codebase-structure/file-by-file-client.md) — 73 files: pages, components, hooks, libs, context
- [File-by-File: Server](./03-codebase-structure/file-by-file-server.md) — 72 files: routes, services, libs, jobs, middleware
- [File-by-File: Shared & Marketing](./03-codebase-structure/file-by-file-shared-and-marketing.md) — Shared types, Next.js marketing site
- [Module Dependencies](./03-codebase-structure/module-dependencies.md) — Import graph, external deps, no circular deps

### 04 — Function Documentation
- [Function Index](./04-function-documentation/function-index.md) — Every function: file, line, tier, purpose
- [Frontend Pages](./04-function-documentation/frontend-pages.md) — 21 page components, routes, guards
- [Frontend Components](./04-function-documentation/frontend-components.md) — 43 components: props, state, events
- [Frontend Hooks, Context, Lib](./04-function-documentation/frontend-hooks-context-lib.md) — AuthContext, SubscriptionContext, 4 hooks, 12 libs
- [Backend Entry & Middleware](./04-function-documentation/backend-entry-middleware.md) — index.ts, 3 middlewares
- [Backend Auth & Users](./04-function-documentation/backend-auth-users.md) — 13 handlers, token ops, auth utils
- [Backend Core AI](./04-function-documentation/backend-core-ai.md) — Entries, appraisals, summaries, chat, feedback
- [Backend Teams & Goals](./04-function-documentation/backend-teams-goals.md) — Orgs, teams, goals, subscriptions, reports
- [Backend Integrations](./04-function-documentation/backend-integrations.md) — Jira, GitHub, Slack OAuth + webhooks
- [Backend Platform & Misc](./04-function-documentation/backend-platform-misc.md) — AI Pulse, push, translate, waitlist, feedback
- [Backend Jobs & Infra](./04-function-documentation/backend-jobs-infra.md) — 11 cron jobs, email, push, logging, PostHog
- [Shared & Marketing](./04-function-documentation/shared-and-marketing.md) — Shared types, Next.js marketing site

### 05 — Feature Flows
- [Flow Index](./05-feature-flows/flow-index.md) — All 13 major flows at a glance
- [01 — Signup & Onboarding](./05-feature-flows/flow-01-signup-and-onboarding.md) — Register, verify email, login, onboarding wizard
- [02 — Auth Token Lifecycle](./05-feature-flows/flow-02-auth-token-lifecycle.md) — 15-min JWT, refresh rotation, logout, password reset
- [03 — Work Log Entry CRUD](./05-feature-flows/flow-03-work-log-entry-crud.md) — Create/edit/delete weekly log entries
- [04 — AI Appraisal Generation](./05-feature-flows/flow-04-ai-appraisal-generation.md) — Mistral prompt → OpenRouter → save → display
- [05 — AI Chat](./05-feature-flows/flow-05-ai-chat.md) — Chat sessions, message history, AI responses
- [06 — Goals & OKRs](./05-feature-flows/flow-06-goals-and-okrs.md) — Goal creation, key results, check-ins, rollup job
- [07 — Team Management](./05-feature-flows/flow-07-team-management.md) — Orgs, teams, roles, closure table, re-parent
- [08 — Jira Integration](./05-feature-flows/flow-08-jira-integration.md) — OAuth2, cloud_id, issue sync, goal linking
- [09 — GitHub Integration](./05-feature-flows/flow-09-github-integration.md) — GitHub App, webhooks, HMAC, provider bug
- [10 — Slack Integration](./05-feature-flows/flow-10-slack-integration.md) — OAuth, channel connect, temp_slack_codes bug
- [11 — Email Notifications](./05-feature-flows/flow-11-email-notifications.md) — Brevo SMTP, 11 cron jobs, IS_SCHEDULER_NODE
- [12 — Push Notifications](./05-feature-flows/flow-12-push-notifications.md) — VAPID, subscribe/unsubscribe, onConflict bug
- [13 — AI Pulse & Marketing](./05-feature-flows/flow-13-ai-pulse-and-marketing.md) — Content hub, marketing loops, MARKETING_LOOPS_ENABLED


### 06 — API Reference
- [API Overview](./06-api-reference/api-overview.md) — 112 endpoints, auth matrix, conventions
- [Auth & Users](./06-api-reference/endpoint-reference-auth-users.md) — 13 endpoints
- [Core & AI](./06-api-reference/endpoint-reference-core-ai.md) — 18 endpoints
- [Teams & Goals](./06-api-reference/endpoint-reference-teams-goals.md) — 25 endpoints
- [Integrations & Webhooks](./06-api-reference/endpoint-reference-integrations-webhooks.md) — 21 endpoints
- [Platform & Misc](./06-api-reference/endpoint-reference-platform-misc.md) — 35 endpoints

### 07 — Database
- [Schema](./07-database/schema.md) — 47 tables, columns, indexes, RLS
- [Relationships](./07-database/relationships.md) — ER diagrams, cardinality, missing FKs
- [Queries & Operations](./07-database/queries-and-operations.md) — Patterns, service-role discipline, RPCs
- [Migrations](./07-database/migrations.md) — 14 files, order, destructive ops, rollback

### 08 — Security
- [Security Architecture](./08-security/security-architecture.md) — Threat model, auth, validation, webhooks, client risks
- [Threat Model & Findings](./08-security/threat-model-and-findings.md) — STRIDE, 30 risks, 20 observations, remediation roadmap

### 09 — Integrations
- [External Services](./09-integrations/external-services.md) — 11 services, auth, failure modes
- [Jira, GitHub, Slack](./09-integrations/jira-github-slack.md) — OAuth flows, webhooks, sync, goal linking

### 10 — Environment & Deployment
- [Environment Variables](./10-environment-and-deployment/environment-variables.md) — 30+ vars, required/optional, prod values
- [Local Setup](./10-environment-and-deployment/local-setup.md) — Prerequisites, Supabase, dev servers
- [Deployment Guide](./10-environment-and-deployment/deployment-guide.md) — Vercel, Render, Supabase, DNS, CI/CD proposal

### 11 — Testing
- [Testing Guide](./11-testing/testing-guide.md) — 6 server tests, 2 client tests (not runnable), CI proposal

### 12 — Code Review
- [Technical Debt](./12-code-review/technical-debt.md) — 37 items by category, priority matrix
- [Risks & Observations](./12-code-review/risks-and-observations.md) — 30 risks, 20 observations, verification status
- [Improvement Roadmap](./12-code-review/improvement-roadmap.md) — 4 quarters, success metrics, ADR template

### 13 — Glossary
- [Beginner-Friendly Glossary](./13-glossary/beginner-friendly-glossary.md) — 80+ terms: simple + technical explanations

### 14 — Learning Path
- [How to Understand This Codebase](./14-learning-path/how-to-understand-this-codebase.md) — Reading order, tracing features, debugging

---

## 📊 Coverage Summary

| Category | Documented | Total | Coverage |
|---|---:|---:|---:|
| Backend route handlers | 112 | 112 | 100% |
| Database tables | 47 | 47 | 100% |
| Client pages | 21 | 21 | 100% |
| Client components | 43 | 43 | 100% |
| Cron jobs | 11 | 11 | 100% |
| External services | 11 | 11 | 100% |
| Server tests | 6 | 6 | 100% |
| Client tests | 0/2 | 2 | 0% (not runnable) |
| CI/CD | Proposed | — | 0% (not implemented) |

---

## 🔍 Quick Links

- [Documentation Progress Tracker](./DOCUMENTATION_PROGRESS.md)
- [Coverage Audit](./DOCUMENTATION_COVERAGE.md) (when complete)
- [Authoring Guide](./_authoring-guide.md) — Internal style guide
- [Progress Tracker](./DOCUMENTATION_PROGRESS.md) — Resumable state

---

## ⚠️ Important Notes

### Documentation Drift
**Root documentation (`README.md`, `CLAUDE.md`, `AGENTS.md`, `DOCUMENTATION.md`) is stale.**  
Key corrections in this documentation:
- **Auth:** Custom bcrypt + JWT + refresh tokens (not Supabase magic links)
- **Database:** 47 tables (not 5); service-role bypasses RLS
- **AI:** Mistral + OpenRouter + NVIDIA NIM (not Mistral only)
- **Email:** Brevo (not Resend)
- **Deploy:** Render (not Railway)
- **Billing:** Enforcement exists; payment provider not found

### Verification Labels
Every page has a status banner:
- **Verified** — Implementation inspected end-to-end
- **Partially verified** — Main path inspected; some branches/runtime not exercised
- **Not verified** — Depends on unavailable credentials/services
- **Not applicable** — Concept doesn't exist in this project

### Line Numbers
All `path:line` references are pinned to commit `7567207`.  
If code moves, update the reference and note the new commit.

---

## 🤝 Contributing to Documentation

See [Authoring Guide](./_authoring-guide.md) for:
- Tiered function documentation (A/B/C)
- API/DB/feature flow formats
- Mermaid conventions
- Verification standards
- Coverage bookkeeping

---

## 📞 Questions?

If something is unclear:
1. Check the [Glossary](./13-glossary/beginner-friendly-glossary.md)
2. Search the [Function Index](./04-function-documentation/function-index.md)
3. Trace the [Feature Flow](./05-feature-flows/feature-index.md)
4. Reference the exact `file:line` when asking

---

*Generated from commit `7567207` — "fix: preserve Slack OAuth v2 bot token handling" (2026-07-16)*