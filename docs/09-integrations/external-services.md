# External Services Integration

> **Status:** Partially verified (code inspection)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Service inventory

| Service | Purpose | Auth method | Client lib | Verified |
|---|---|---|---|---|
| Supabase Postgres | Primary database | Service-role key | `@supabase/supabase-js` | ✅ |
| Mistral AI | Primary AI (appraisals, chat, summaries) | API key | `@mistralai/mistralai` | ⚠️ |
| OpenRouter | Fallback AI provider | API key | Custom fetch | ⚠️ |
| NVIDIA NIM | Additional AI provider | API key | OpenAI SDK | ⚠️ |
| Anthropic | Additional AI provider | API key | `@anthropic-ai/sdk` | ⚠️ |
| Brevo | Transactional email | API key | Custom fetch | ⚠️ |
| Web Push | Browser push notifications | VAPID keys | `web-push` | ⚠️ |
| GitHub | OAuth, API, webhooks | OAuth 2.0 + PAT | Custom fetch | ⚠️ |
| Jira | OAuth, API, webhooks | OAuth 2.0 (3LO) | Custom fetch | ⚠️ |
| Slack | OAuth, API, webhooks | OAuth 2.0 | Custom fetch | ⚠️ |
| PostHog | Analytics | API key | `posthog-node` / `posthog-js` | ⚠️ |
| Google Translate | Email translation | API key | Custom fetch | ⚠️ |

✅ = Implementation traced in code  
⚠️ = Implementation traced; runtime behavior not verified without credentials

---

## 2. Supabase Postgres

| Aspect | Detail |
|---|---|
| **Client** | `lib/database.ts` creates service-role client at module load |
| **Auth** | `SUPABASE_SERVICE_KEY` (bypasses RLS) |
| **Usage** | All product queries, auth token storage, job data |
| **Connection** | Direct (not pooler) — Render long-running process |
| **Failure behavior** | Queries throw; handlers catch → 500 |
| **RLS** | Enabled but bypassed by service-role; Node enforces scoping |

---

## 3. AI Providers

### 3.1 Mistral (primary)

| Property | Value |
|---|---|
| **Client** | `lib/mistral.ts` → `new Mistral({ apiKey })` |
| **Model** | `mistral-large-latest` (constant) |
| **Used by** | Appraisals, chat, summaries, reports, news categorization |
| **Fallback** | OpenRouter (where wired) |
| **Key env** | `MISTRAL_API_KEY` |
| **Error handling** | Warns at startup if missing; requests fail at runtime |

### 3.2 OpenRouter

| Property | Value |
|---|---|
| **Client** | `lib/openRouter.ts` → custom `fetch` to `openrouter.ai/api/v1/chat/completions` |
| **Models** | Configurable via `MODEL_MAP` (e.g., `gpt-4o`, `claude-3.5-sonnet`) |
| **Used by** | Chat fallback, report generation fallback |
| **Key env** | `OPENROUTER_API_KEY` |

### 3.3 NVIDIA NIM

| Property | Value |
|---|---|
| **Client** | Not found in inspected libs (OpenAI SDK in deps) |
| **Used by** | Checked at startup (`index.ts:284`) |
| **Key env** | `NVIDIA_NIM_API_KEY` |

### 3.4 Anthropic

| Property | Value |
|---|---|
| **Client** | `@anthropic-ai/sdk` in deps; usage not found in inspected libs |
| **Key env** | `ANTHROPIC_API_KEY` |

---

## 4. Brevo (Email)

| Property | Value |
|---|---|
| **Endpoint** | `https://api.brevo.com/v3/smtp/email` |
| **Auth** | `api-key` header |
| **From** | `BREVO_FROM_EMAIL` / `BREVO_FROM_NAME` (defaults: `xtate62@gmail.com` / `Worklog AI`) |
| **Client** | `lib/email.ts:88-112` → custom `fetch` |
| **Templates** | Inline HTML in `sendVerificationEmail`, `sendPasswordResetEmail`, `sendWeeklyReminder`, `sendWeeklyDigest` |
| **Translation** | `translateStatic` (Google Translate) memoized per-process |
| **Failure** | Returns `{ success: false }`; caller logs warning |
| **Key env** | `BREVO_API_KEY`, `GOOGLE_TRANSLATE_API_KEY` (optional) |

**Email types sent:**
1. Verification (signup)
2. Password reset
3. Weekly reminder (Mon 9 AM)
4. Weekly digest (Mon 8 AM)
5. Goal reminders (daily 7 AM)
6. Marketing loops (activation, dormancy, weekly review)

---

## 5. Web Push

| Property | Value |
|---|---|
| **Library** | `web-push` |
| **Keys** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`) |
| **Client** | `lib/webPush.ts` |
| **Subscription storage** | `push_subscriptions` table (user_id + endpoint + p256dh + auth) |
| **Send** | `sendPushNotification(userId, payload)` → iterates user's subscriptions |
| **Failure** | Logs error; subscription not auto-removed |

---

## 6. PostHog (Analytics)

### 6.1 Server (`lib/posthog.ts`)

| Property | Value |
|---|---|
| **Client** | `posthog-node` |
| **Init** | `getPostHogClient()` lazy; `POSTHOG_API_KEY` + `POSTHOG_HOST` |
| **Events** | `captureEvent(userId, event, properties)`, `captureException(err)`, `identifyUser(userId, traits)` |
| **Shutdown** | `shutdownPostHog()` on `SIGTERM`/`SIGINT` |
| **Request analytics** | Middleware captures `api_request` on response finish (`index.ts:153-177`) |

### 6.2 Client (`lib/analytics.ts`)

| Property | Value |
|---|---|
| **Client** | `posthog-js` + `@posthog/react` |
| **Init** | `initAnalytics(key, host)` deferred via `requestIdleCallback` |
| **Identify** | Called on login/hydration (`AuthContext.tsx:78-82`) |
| **Reset** | `posthog.reset()` on logout (`AuthContext.tsx:170`) |

---

## 7. Google Translate (Email only)

| Property | Value |
|---|---|
| **Endpoint** | `https://translation.googleapis.com/language/translate/v2` |
| **Auth** | API key in query string |
| **Client** | `lib/email.ts:44-73` (`translateStatic`) |
| **Cache** | In-memory `Map` keyed by `lang:text` (process lifetime) |
| **Fallback** | Returns English if unsupported, no key, or API error |
| **Key env** | `GOOGLE_TRANSLATE_API_KEY` |

---

## 8. Configuration summary

| Service | Required env vars | Optional env vars |
|---|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client) |
| Mistral | `MISTRAL_API_KEY` | — |
| OpenRouter | `OPENROUTER_API_KEY` | — |
| NVIDIA NIM | `NVIDIA_NIM_API_KEY` | — |
| Anthropic | `ANTHROPIC_API_KEY` | — |
| Brevo | `BREVO_API_KEY` | `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | — |
| PostHog | `POSTHOG_API_KEY` | `POSTHOG_HOST` |
| Google Translate | — | `GOOGLE_TRANSLATE_API_KEY` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` |
| Jira | `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` | — |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` | — |

---

## 9. Failure modes and observability

| Service | Failure detection | Alerting | Degradation |
|---|---|---|---|
| Supabase | Query errors → 500 | PostHog exception | App down |
| AI Providers | Request errors → 500 / fallback | PostHog exception | Feature degraded |
| Brevo | `sendEmail` returns `{success:false}` | Warning log | Emails not sent |
| Web Push | Send errors logged | Warning log | Notifications fail |
| PostHog | Init fails silently | None | Analytics lost |
| Google Translate | Returns English | Warning log | Emails in English |
| OAuth Providers | Callback errors → redirect with error | Warning log | Connect fails |
| Webhooks | Signature verification fails → 400 | Warning log | Events dropped |

---

## 10. Supply chain considerations

| Dependency | Version pinning | Audit |
|---|---|---|
| `@mistralai/mistralai` | `^1.5.0` | `npm audit` |
| `@anthropic-ai/sdk` | `^0.36.0` / `^0.109.1` | `npm audit` |
| `@supabase/supabase-js` | `^2.47.0` | `npm audit` |
| `web-push` | `^3.6.7` | `npm audit` |
| `posthog-node` / `posthog-js` | `^5.21.2` / `^1.379.1` | `npm audit` |
| `jsonwebtoken` | `^9.0.3` | `npm audit` |
| `bcrypt` | `^6.0.0` | `npm audit` |

**No automated dependency scanning in CI.**

---

## Related documents

- [Jira/GitHub/Slack details](./jira-github-slack.md)
- [API endpoints: integrations](../06-api-reference/endpoint-reference-integrations-webhooks.md)
- [Security architecture](../08-security/security-architecture.md)
- [Backend integration functions](../04-function-documentation/backend-integrations.md)

## Verification notes

Service integrations traced from `server/src/lib/*.ts`, `server/src/routes/integrations.ts`,
`server/src/routes/webhooks/*.ts`, `server/src/index.ts` at commit `7567207`.
Runtime behavior (API responses, OAuth flows, webhook delivery) not verified
without live credentials. Implementation patterns confirmed; error paths
traced in code.