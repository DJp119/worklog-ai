# API Reference: Integrations & Webhooks

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. User-level integrations (`/api/integrations`)

### 1.1 Jira OAuth (user)

#### `POST /api/integrations/jira/connect`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{}` |
| Success | 200 `{ success: true, data: { authUrl: string } }` |
| Errors | 401, 500 |

**Flow:** Generates OAuth state, stores in `temp_oauth_states`, returns Atlassian auth URL.

#### `GET /api/integrations/jira/connect`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { authUrl: string } }` |
| Errors | 401, 500 |

**Alternative:** GET version for frontend redirect.

#### `GET /api/integrations/jira/callback`

| Property | Value |
|---|---|
| Auth | None (OAuth callback) |
| Query params | `code`, `state` |
| Success | 302 redirect to frontend `/integrations?jira=connected` |
| Errors | 400 (invalid state), 500 |

**Flow:**
1. Validate state from `temp_oauth_states`
2. Exchange code for tokens (Jira API)
3. Fetch accessible resources (cloud ID)
4. Upsert `user_integrations` (encrypted tokens)
5. Delete state
5. Redirect to frontend

#### `POST /api/integrations/jira/confirm`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ code: string, state: string, cloudId?: string }` |
| Success | 200 `{ success: true }` |
| Errors | 401, 400, 500 |

**Alternative:** POST confirmation for SPA flow.

#### `GET /api/integrations/jira/sites`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: JiraSite[] }` |
| Errors | 401, 500 |

**Returns:** User's accessible Jira cloud sites (for multi-site selection).

#### `POST /api/integrations/jira/select-site`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ cloudId: string }` |
| Success | 200 `{ success: true }` |
| Errors | 401, 500 |

---

### 1.2 GitHub OAuth (user)

#### `POST /api/integrations/github/connect`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { authUrl: string } }` |
| Errors | 401, 500 |

#### `GET /api/integrations/github/connect`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { authUrl: string } }` |

#### `GET /api/integrations/github/callback`

| Property | Value |
|---|---|
| Auth | None |
| Query params | `code`, `state` |
| Success | 302 redirect to frontend |

#### `POST /api/integrations/github/confirm`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ code: string, state: string }` |
| Success | 200 `{ success: true }` |

---

### 1.3 Slack OAuth (user link)

#### `POST /api/integrations/slack/link/start`

| Property | Value |
|---|---|
| Auth | `requireAuth` + rate limit |
| Success | 200 `{ success: true, data: { expiresAt: ISO8601 } }` |
| Errors | 401, 429, 500 |

**Flow:** Generates short code, stores in `temp_slack_codes`, returns expiry.

#### `POST /api/integrations/slack/link/confirm`

| Property | Value |
|---|---|
| Auth | `requireAuth` + rate limit |
| Request body | `{ code: string }` |
| Success | 200 `{ success: true }` |
| Errors | 401, 400 (invalid/expired code), 429, 500 |

**Flow:** Verifies code → exchanges for Slack tokens → stores in `slack_user_links`.

---

### 1.4 GitHub App (user)

#### `POST /api/integrations/github/app-connect`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { authUrl: string } }` |

#### `GET /api/integrations/github/app-callback`

| Property | Value |
|---|---|
| Auth | None |
| Query params | `installation_id`, `setup_action` |
| Success | 302 redirect |

#### `POST /api/integrations/github/app-callback`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ installation_id: string }` |
| Success | 200 `{ success: true }` |

---

### 1.5 List / delete user integrations

#### `GET /api/integrations/user`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: UserIntegration[] }` |

**Response (`UserIntegration[]`):**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "provider": "'jira'|'github'|'slack'|'github_app'|'gitlab'",
    "created_at": "ISO8601",
    "token_expires_at": "ISO8601|null",
    "is_active": "boolean",
    "scopes": "string[]",
    "config": "object"
  }
]
```

#### `DELETE /api/integrations/user/:provider`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Path params | `provider` (jira|github|slack|github_app|gitlab) |
| Success | 200 `{ success: true }` |

---

## 2. Org-level integrations (`/api/integrations/org`)

### 2.1 Jira org connect

#### `POST /api/integrations/jira/org-connect`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { authUrl: string } }` |

#### `GET /api/integrations/jira/org-callback`

| Property | Value |
|---|---|
| Auth | None |
| Query params | `code`, `state` |
| Success | 302 redirect |

#### `POST /api/integrations/jira/org-confirm`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ code: string, state: string }` |
| Success | 200 `{ success: true }` |

### 2.2 Slack org connect

#### `POST /api/integrations/slack/org-connect`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { authUrl: string } }` |

#### `GET /api/integrations/slack/org-callback`

| Property | Value |
|---|---|
| Auth | None |
| Query params | `code`, `state` |
| Success | 302 redirect |

#### `POST /api/integrations/slack/org-confirm`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ code: string, state: string }` |
| Success | 200 `{ success: true }` |

### 2.3 GitHub App org connect

#### `POST /api/integrations/github/app-connect`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Success | 200 `{ success: true, data: { authUrl: string } }` |

#### `GET /api/integrations/github/app-callback`

| Property | Value |
|---|---|
| Auth | None |
| Query params | `installation_id`, `setup_action` |
| Success | 302 redirect |

#### `POST /api/integrations/github/app-callback`

| Property | Value |
|---|---|
| Auth | `requireAuth` |
| Request body | `{ installation_id: string }` |
| Success | 200 `{ success: true }` |

### 2.4 List / delete org integrations

#### `GET /api/integrations/org/:orgId`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('member')` |
| Path params | `orgId` (uuid) |
| Success | 200 `{ success: true, data: OrgIntegration[] }` |

#### `DELETE /api/integrations/org/:orgId/:provider`

| Property | Value |
|---|---|
| Auth | `requireAuth` + `requireOrgRole('admin')` |
| Path params | `orgId`, `provider` (slack|github_app|jira) |
| Success | 200 `{ success: true }` |

---

## 3. Webhooks

### 3.1 `POST /api/webhooks/github`

| Property | Value |
|---|---|
| Auth | GitHub signature verification |
| Headers | `X-Hub-Signature-256`, `X-GitHub-Event`, `X-GitHub-Delivery` |
| Success | 200 `{ success: true }` (always, to acknowledge) |
| Errors | 400 (invalid signature), 500 |

**Flow:**
1. Verify HMAC SHA-256 signature (`webhookSecurity.verifyGitHubSignature`)
2. Parse event type (`X-GitHub-Event`)
3. Normalize via `githubAdapter`
4. Insert `integration_events` (raw payload)
5. If issue/PR event → create/update `goal_links` for matching goals
6. PostHog `github_webhook_received`

**Supported events:** `issues`, `pull_request`, `push` (configurable).

---

### 3.2 `POST /api/webhooks/jira`

| Property | Value |
|---|---|
| Auth | Jira signature verification |
| Headers | `X-Atlassian-Webhook-Signature` (or JWT) |
| Success | 200 `{ success: true }` |
| Errors | 400 (invalid signature), 500 |

**Flow:**
1. Verify signature (`webhookSecurity.verifyJiraSignature`)
2. Parse event
3. Normalize via `jiraAdapter`
4. Insert `integration_events`
5. Update `goal_links` for matching Jira issues
5. PostHog `jira_webhook_received`

**Supported events:** `jira:issue_created`, `jira:issue_updated`, `jira:issue_deleted`.

---

### 3.3 `POST /api/webhooks/slack`

| Property | Value |
|---|---|
| Auth | Slack signature verification |
| Headers | `X-Slack-Signature`, `X-Slack-Request-Timestamp` |
| Content-Type | `application/x-www-form-urlencoded` (Slack commands) or `application/json` (events) |
| Success | 200 `{ success: true }` or Slack command response |
| Errors | 400 (invalid signature), 500 |

**Flow:**
1. Verify signature (`webhookSecurity.verifySlackSignature`)
2. Parse payload (command or event)
3. If slash command (`/worklog`) → `slackAdapter.handleCommand` → modal/form
4. If event (`link_shared`, `message`) → normalize → `integration_events`
5. If goal link shared → create `goal_links`
5. PostHog `slack_webhook_received`

**Supported:** Slash commands (`/worklog`), link sharing, message events.

---

## Related documents

- [API overview](./api-overview.md)
- [Jira/GitHub/Slack integration details](../09-integrations/jira-github-slack.md)
- [Backend integration functions](../04-function-documentation/backend-integrations.md)
- [Webhook security](../08-security/security-architecture.md)

## Verification notes

All endpoints traced from `server/src/routes/integrations.ts`, `webhooks/github.ts`, `webhooks/jira.ts`, `webhooks/slack.ts` at commit `7567207`. OAuth flows from `jiraAdapter.ts`, `githubAdapter.ts`, `slackOAuth.ts`. Not verified at runtime: actual OAuth handshakes, webhook delivery, token encryption.