# Security Architecture

> **Status:** Partially verified (code inspection)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Threat model summary

| Asset | Threats | Controls |
|---|---|---|
| User credentials | Credential stuffing, phishing, DB leak | bcrypt 12, rate limits, generic errors |
| Access tokens (JWT) | Theft, replay, forgery | 15min expiry, HTTPS only, `JWT_SECRET` ≥32 chars |
| Refresh tokens | Theft, long-lived access | SHA-256 hashed in DB, 7/30 day TTL, rotation on use |
| Database | Cross-tenant access, injection | Service-role + Node authorization, parameterized queries |
| AI prompts | Injection, data leakage | Server-side prompt construction, no user-controlled prompt parts |
| Webhooks | Spoofing, replay | HMAC/JWT signature verification per provider |
| OAuth tokens | Theft in transit/storage | Encrypted at rest (`crypto.ts`), HTTPS, short-lived codes |
| Email | Enumeration, spoofing | Generic responses, Brevo DKIM/SPF |
| Client tokens | XSS theft | localStorage/sessionStorage (no httpOnly cookie option) |

---

## 2. Authentication security

### 2.1 Password handling

| Aspect | Implementation | File |
|---|---|---|
| Hash algorithm | bcrypt | `lib/auth-utils.ts:9` |
| Cost factor | 12 rounds | `lib/auth-utils.ts:4` |
| Timing attack | bcrypt constant-time compare | `lib/auth-utils.ts:16` |
| Strength policy | ≥8 chars, 1 letter, 1 number | `lib/auth-utils.ts:41-54` |

### 2.2 Token design

| Token | Format | Lifetime | Storage | Rotation |
|---|---|---|---|---|
| Access | JWT (HS256) | 15 min | Memory + localStorage/sessionStorage | Auto at 14 min; on 401 |
| Refresh | 64-byte hex (opaque) | 30d / 7d | DB (SHA-256 hash) + client storage | On every use (revoke old, issue new) |
| Email verify | 32-byte hex | 24 hr | DB (SHA-256 hash) | Single-use, deleted on verify |
| Password reset | 32-byte hex | 1 hr | DB (SHA-256 hash) | Single-use, deleted on reset |

**JWT claims:** `{ userId, email }` — no roles/permissions (checked in Node).

**Secret:** `JWT_SECRET` from env, validated ≥32 chars at startup (`middleware/auth.ts:32-35`).

---

## 3. Authorization security

### 3.1 Service-role discipline

**Critical rule** (from `middleware/auth.ts:1-6`):

> `req.supabase` is built with the SERVICE ROLE key and bypasses RLS.
> Every route handler that uses `req.supabase` MUST scope queries by
> `req.userId`. A handler that uses `req.supabase` without an explicit
> user filter can read or write any user's data.

**Enforcement:** Manual — no automated check. Every data route inspected
includes `.eq('user_id', req.userId)` or org/team role checks.

### 3.2 Org/team role checks

| Check | Function | Trusted input |
|---|---|---|
| Org role | `authz.getUserOrgRole` → `requireOrgRole` | `req.params.orgId` only |
| Team role | `authz.getEffectiveTeamRole` → `requireTeamRole` | `req.params.teamId` only |
| Goal edit | `authz.canEditGoal` | `req.params.goalId` + `req.userId` |

**Security rule:** Only `req.params` is trusted. `req.body.orgId` /
`req.query.orgId` are attacker-controlled and ignored (`authz.ts:233-237`,
`:261-263`).

### 3.3 Effective team role algorithm

```typescript
// authz.ts:64-118
max(
  directTeamRole,
  orgRoleMappedToTeam,      // org admin→team admin, org owner→team owner
  ancestorTeamRoles         // manager/admin/owner only (excludes member)
)
```

**Never short-circuits** on org role — numeric max of all candidates.

---

## 4. Input validation

| Layer | Coverage | Gaps |
|---|---|---|
| Route-level manual checks | Auth, entries, users | Inconsistent; some fields unvalidated |
| Regex | Email, password strength | No centralized validation library |
| Zod schemas | Goals, integrations, some org routes | Not universal |
| Database constraints | Unique keys, check constraints | FKs missing on some soft relationships |
| File upload | None (no upload endpoints) | N/A |

**Risk:** Inconsistent validation means some endpoints accept partial or
unexpected payloads.

---

## 5. Webhook security

### 5.1 Signature verification

| Provider | Method | File |
|---|---|---|
| GitHub | HMAC SHA-256 (`X-Hub-Signature-256`) | `lib/webhookSecurity.ts` |
| Jira | JWT or shared secret | `lib/webhookSecurity.ts` |
| Slack | HMAC SHA-256 (`X-Slack-Signature`) | `lib/webhookSecurity.ts` |

**Implementation:** Raw body captured via `express.json({ verify })` before
parsing (`index.ts:97-110`). Timing-safe comparison.

### 5.2 Replay protection

| Provider | Mechanism |
|---|---|
| GitHub | `X-GitHub-Delivery` UUID (not validated for replay) |
| Jira | Not implemented |
| Slack | `X-Slack-Request-Timestamp` (5 min window) |

**Gap:** No persistent replay cache; relies on timestamp window (Slack) or
nothing (GitHub/Jira).

---

## 6. OAuth security

### 6.1 State management

| Provider | State storage | Expiry | Verification |
|---|---|---|---|
| Jira (user/org) | `temp_oauth_states` | 10 min | Exact match + expiry |
| GitHub (user) | `temp_oauth_states` | 10 min | Exact match + expiry |
| GitHub App | `temp_oauth_states` | 10 min | Exact match + expiry |
| Slack (org) | `temp_oauth_states` | 10 min | Exact match + expiry |
| Slack (user link) | `temp_slack_codes` | 10 min | Code match + expiry |

**State format:** `{ state: string, provider, userId?, orgId?, expiresAt, data? }`

### 6.2 Token storage

| Table | Encryption | Algorithm |
|---|---|---|
| `user_integrations.access_token` | Yes | `lib/crypto.ts` (AES-256-GCM) |
| `user_integrations.refresh_token` | Yes | `lib/crypto.ts` |
| `org_integrations.config` | Partial (secrets) | `lib/crypto.ts` |

**Encryption key:** Derived from `ENCRYPTION_KEY` env var (not in inspected files;
assumed present).

---

## 7. Transport security

| Control | Implementation |
|---|---|
| HTTPS enforcement | Render + Vercel terminate TLS; HSTS via platform |
| CORS | Strict allowlist: localhost, `FRONTEND_URL`, allowlisted Vercel apps (`index.ts:62-95`) |
| `trust proxy` | Enabled for correct client IP behind Render (`index.ts:115`) |
| Rate limiting | 100/15min global, 20/hr auth (prod only) |
| Request ID | `requestIdMiddleware` for correlation |
| Helmet/CSP | **Not present** — no `helmet` dependency |

---

## 8. Data protection

### 8.1 At rest

| Data | Protection |
|---|---|
| Passwords | bcrypt hash (never plaintext) |
| Refresh tokens | SHA-256 hash |
| Email/reset tokens | SHA-256 hash |
| OAuth tokens | AES-256-GCM (`lib/crypto.ts`) |
| Database | Supabase managed (encrypted at rest) |

### 8.2 In transit

| Path | Protection |
|---|---|
| Client ↔ API | TLS 1.2+ (Render/Vercel) |
| API ↔ Supabase | TLS (Supabase enforces) |
| API ↔ Providers | TLS (all providers enforce) |
| Webhooks | TLS + signature verification |

---

## 9. Client-side security

### 9.1 Token storage

| Token | Storage | Risk |
|---|---|---|
| Access token | localStorage (rememberMe) / sessionStorage | XSS readable |
| Refresh token | Same as access token | XSS readable |

**Mitigation:** No httpOnly cookie option implemented. Content Security Policy
not configured.

### 9.2 XSS surface

| Vector | Status |
|---|---|
| User content in chat/markdown | Rendered via React (auto-escaped) |
| AI-generated content | Inserted as text, not HTML |
| URL parameters | Not directly rendered |
| `dangerouslySetInnerHTML` | **Not found** in inspected components |

### 9.3 Dependencies

| Package | Version | Known vulns (as of 2026-11) |
|---|---|---|
| `react` | 19.1.0 | Check `npm audit` |
| `express` | 4.21.2 | Check `npm audit` |
| `@supabase/supabase-js` | 2.47.0 | Check `npm audit` |
| `jsonwebtoken` | 9.0.3 | Check `npm audit` |
| `bcrypt` | 6.0.0 | Check `npm audit` |

---

## 10. Operational security

### 10.1 Secrets management

| Secret | Rotation | Access |
|---|---|---|
| `JWT_SECRET` | Manual | Render env |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard | Render env |
| `MISTRAL_API_KEY` | Provider dashboard | Render env |
| `BREVO_API_KEY` | Brevo dashboard | Render env |
| `VAPID_PRIVATE_KEY` | `web-push generate-keys` | Render env |
| `ENCRYPTION_KEY` | Manual | Render env |

**Not in repo:** `.env` files gitignored. `.env.example` templates only.

### 10.2 Logging

| Logged | Not logged |
|---|---|
| Request ID, method, path, status, duration, userId (analytics) | Passwords, tokens, OAuth codes, email content |
| Errors with stack traces (Pino) | Full request bodies (except webhooks) |
| Auth events (signup, login, reset) | |

### 10.3 Incident response

| Capability | Status |
|---|---|
| Revoke all user sessions | `DELETE /api/users/account` + token revocation |
| Disable user | Not implemented (no `is_active` on users) |
| Rotate JWT secret | Manual (invalidates all access tokens) |
| Audit trail | `reminder_logs`, `marketing_logs`, `integration_sync_logs` |
| SIEM integration | PostHog only |

---

## 11. Known gaps and observations

| Gap | Severity | File/Context |
|---|---|---|
| No CSP / Helmet | Medium | `index.ts` |
| Refresh tokens in localStorage | High | `AuthContext.tsx`, `authStorage.ts` |
| No password breach check (HIBP) | Low | `auth-utils.ts` |
| Inconsistent validation | Medium | Route handlers |
| No automated authz test for new routes | Medium | `authz.ts` |
| Webhook replay protection incomplete | Medium | `webhookSecurity.ts` |
| No `is_active` / disable user | Low | `users` table |
| OAuth state cleanup only at startup | Low | `index.ts:247-250` |
| No dependency scanning in CI | Low | No GitHub Actions |
| Payment provider not implemented | High (if billing needed) | `subscriptions` table |

---

## 12. Compliance considerations

| Regulation | Status |
|---|---|
| GDPR (data deletion) | `DELETE /api/users/account` cascades; no automated export |
| CCPA | Same as GDPR |
| SOC 2 | Not certified; controls partially implemented |
| HIPAA | Not applicable (no PHI) |
| PCI DSS | Not applicable (no payment processing) |

---

## Related documents

- [Auth architecture](../02-architecture/auth-and-authorization.md)
- [Auth endpoints](../06-api-reference/endpoint-reference-auth-users.md)
- [Webhook endpoints](../06-api-reference/endpoint-reference-integrations-webhooks.md)
- [Threat model findings](./threat-model-and-findings.md)
- [Code review: risks](../12-code-review/risks-and-observations.md)

## Verification notes

Security controls traced from `middleware/auth.ts`, `authz.ts`, `webhookSecurity.ts`,
`auth-utils.ts`, `crypto.ts`, `index.ts`, `AuthContext.tsx` at commit `7567207`.
No penetration testing performed. Secret values not inspected.