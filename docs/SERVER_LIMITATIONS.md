# Server Limitations

This document outlines the known limitations of the Worklog AI backend server. Use it as a reference for production readiness assessments and technical debt planning.

---

## 1. Authentication & Security

| Limitation | Details | Priority |
|------------|---------|----------|
| **Custom auth instead of Supabase Auth** | Uses bespoke JWT + refresh token system instead of leveraging Supabase's built-in auth. Misses out on MFA, social logins, magic links | Medium |
| **Password stored as hash only** | No password reset token rotation, no rate limiting on password reset attempts | Medium |
| **No API versioning** | Routes are at `/api/*` with no version indicator (e.g., `/api/v1/`) | Low |
| **Generic error messages** | Good for security, but makes debugging harder in production | Low |
| **JWT secret fallback** | Uses weak dev secret `'dev-secret-change-in-production'` if not configured | High |

---

## 2. Rate Limiting & DDoS Protection

| Limitation | Details | Priority |
|------------|---------|----------|
| **Limited rate limit config** | Only 100 requests/15 min globally, 20/hour for auth. No per-endpoint granularity (e.g., chat API needs stricter limits) | Medium |
| **No IP-based blocking** | No mechanism to ban repeat offenders or brute force attackers | Medium |
| **Development mode disables rate limiting** | Easy to forget to enable in production | Low |

---

## 3. Database & Scalability

| Limitation | Details | Priority |
|------------|---------|----------|
| **No connection pooling max configured** | Relies on Supabase's default - may hit limits at scale | Low |
| **Sequential email sending** | Reminder job sends emails one-by-one (no batching or parallel processing) | Medium |
| **Monthly summary caching is naive** | Invalidation happens on entry create/update, but caching layer is in-memory (not persistent across server restarts) | Medium |
| **No database migrations system** | Schema changes require manual SQL - no Prisma/TypeORM migrations | Medium |

---

## 4. AI / Chat Service

| Limitation | Details | Priority |
|------------|---------|----------|
| **Single model dependency** | Tied to Mistral's `mistral-large-latest` - no fallback model if quota exceeded | High |
| **Token counting is approximate** | Uses simple `length/4` heuristic instead of proper tokenizer | Low |
| **No rate limiting on AI calls** | User could spam chat and hit Mistral API quotas | High |
| **No prompt injection protection** | User-generated content sent directly to LLM | Medium |

---

## 5. Email Service

| Limitation | Details | Priority |
|------------|---------|----------|
| **Single email provider (Brevo)** | No fallback if Brevo hits rate limits or outages | Medium |
| **No email queue** | Heavy load could block requests | Medium |
| **Hard-coded email templates** | Templates in code - not easily customizable without redeploy | Low |
| **No email analytics** | Can't track open rates, click-through rates | Low |

---

## 6. Monitoring & Observability

| Limitation | Details | Priority |
|------------|---------|----------|
| **PostHog is optional** | If not configured, no analytics at all | Low |
| **No structured logging** | Logs are plain console.log - hard to query in production | Medium |
| **No distributed tracing** | Can't trace requests across multiple services | Low |
| **No health check deep probes** | `/health` only returns OK - doesn't check database, AI API, email service status | High |

---

## 7. Background Jobs

| Limitation | Details | Priority |
|------------|---------|----------|
| **Local cron jobs** | Reminder and monthly summary jobs run on single instance - if 2 servers deploy, duplicates fire | High |
| **No job queue** | If remind job crashes mid-batch, progress is lost | Medium |
| **No retry logic** | Email failures are logged but never retried | Medium |
| **No job history / dashboard** | Can't see historical success/failure rates | Low |

---

## 8. Deployment & Infrastructure

| Limitation | Details | Priority |
|------------|---------|----------|
| **Stateless but not multi-region** | Can't scale across regions (all DB queries go to single Supabase region) | Low |
| **No CDN for static assets** | All requests hit the Express server | Low |
| **Single server process** | No horizontal scaling without a load balancer + sticky sessions (for jobs) | Medium |

---

## Quick Wins for Production

1. **Add comprehensive health checks** (`/health/db`, `/health/ai`, `/health/email`)
2. **Implement a job queue** (BullMQ + Redis) for emails/jobs
3. **Add structured logging** (pino/winston) for production debugging
4. **Add API rate limiting per user**, not just globally
5. **Consider Supabase Auth** to leverage their auth infrastructure

---

## How to Use This Document

- **Before production deploy**: Review all "High" priority items
- **Sprint planning**: Pick "Medium" priority items for technical debt sprints
- **On-call incidents**: Reference related limitations when debugging
- **Architecture reviews**: Use as baseline for improvement discussions