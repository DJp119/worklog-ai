# Backend Functions: Integrations (Jira, GitHub, Slack OAuth + Webhooks)

> **Status:** Partially verified (code inspection)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Function inventory

| Function | File:line | Kind | Exported | Tier | Purpose |
|---|---|---|---|---|---|
| `integrationsRoutes` Jira OAuth | `routes/integrations.ts:133` | Route | No | A | User Jira connect/confirm/sites/select |
| `integrationsRoutes` GitHub OAuth | `routes/integrations.ts:339` | Route | No | A | User GitHub connect/confirm |
| `integrationsRoutes` Jira Org | `routes/integrations.ts:430` | Route | No | A | Org Jira connect/confirm |
| `integrationsRoutes` Slack Org | `routes/integrations.ts:547` | Route | No | A | Org Slack connect/confirm |
| `integrationsRoutes` GitHub App | `routes/integrations.ts:670` | Route | No | A | GitHub App install/confirm |
| `integrationsRoutes` Slack Link | `routes/integrations.ts:794` | Route | No | A | User Slack link start/confirm |
| `integrationsRoutes.get('/user')` | `routes/integrations.ts:945` | Route | No | A | List user integrations |
| `integrationsRoutes.delete('/user/:provider')` | `routes/integrations.ts:970` | Route | No | A | Delete user integration |
| `integrationsRoutes.get('/org/:orgId')` | `routes/integrations.ts:990` | Route | No | A | List org integrations |
| `integrationsRoutes.delete('/org/:orgId/:provider')` | `routes/integrations.ts:1018` | Route | No | A | Delete org integration |
| `githubWebhookRoutes.post('/')` | `routes/webhooks/github.ts:22` | Route | No | A | GitHub webhook handler |
| `jiraWebhookRoutes.post('/')` | `routes/webhooks/jira.ts:24` | Route | No | A | Jira webhook handler |
| `slackWebhookRoutes.post('/')` | `routes/webhooks/slack.ts:22` | Route | No | A | Slack webhook + commands |
| `jiraAdapter.exchangeCodeForToken` | `lib/jiraAdapter.ts` | Function | Yes | A | OAuth token exchange |
| `jiraAdapter.fetchUserProjects` | `lib/jiraAdapter.ts` | Function | Yes | B | Fetch accessible projects |
| `jiraAdapter.fetchProjectIssues` | `lib/jiraAdapter.ts` | Function | Yes | B | Fetch issues for sync |
| `jiraAdapter.fetchAccessibleResources` | `lib/jiraAdapter.ts` | Function | Yes | B | Get cloud IDs |
| `jiraAdapter.normalizeEvent` | `lib/jiraAdapter.ts` | Function | Yes | A | Webhook → goal_link |
| `githubAdapter.exchangeCodeForToken` | `lib/githubAdapter.ts` | Function | Yes | A | OAuth token exchange |
| `githubAdapter.fetchUserRepos` | `lib/githubAdapter.ts` | Function | Yes | B | Fetch user repos |
| `githubAdapter.fetchRepoIssues` | `lib/githubAdapter.ts` | Function | Yes | B | Fetch issues for sync |
| `githubAdapter.fetchPullRequests` | `lib/githubAdapter.ts` | Function | Yes | B | Fetch PRs for sync |
| `githubAdapter.normalizeEvent` | `lib/githubAdapter.ts` | Function | Yes | A | Webhook → goal_link |
| `githubApp.createInstallationToken` | `lib/githubApp.ts` | Function | Yes | A | GitHub App installation token |
| `githubApp.listInstallationRepos` | `lib/githubApp.ts` | Function | Yes | B | Repos for installation |
| `slackOAuth.startSlackOAuth` | `lib/slackOAuth.ts` | Function | Yes | A | Generate Slack auth URL |
| `slackOAuth.handleSlackCallback` | `lib/slackOAuth.ts` | Function | Yes | A | Exchange code for tokens |
| `slackOAuth.linkSlackUser` | `lib/slackOAuth.ts` | Function | Yes | A | User link via short code |
| `slackOAuth.confirmSlackLink` | `lib/slackOAuth.ts` | Function | Yes | A | Confirm Slack user link |
| `slackAdapter.postMessage` | `lib/slackAdapter.ts` | Function | Yes | B | Send message |
| `slackAdapter.openModal` | `lib/slackAdapter.ts` | Function | Yes | B | Open modal |
| `slackAdapter.fetchChannels` | `lib/slackAdapter.ts` | Function | Yes | B | Fetch channels |
| `slackAdapter.exchangeCodeForToken` | `lib/slackAdapter.ts` | Function | Yes | A | OAuth token exchange |
| `slackAdapter.handleCommand` | `lib/slackAdapter.ts` | Function | Yes | A | Slash command handler |
| `slackAdapter.normalizeEvent` | `lib/slackAdapter.ts` | Function | Yes | A | Webhook → goal_link |
| `slackNotifier.sendGoalReminder` | `lib/slackNotifier.ts` | Function | Yes | A | Goal reminder notification |
| `slackNotifier.sendDigest` | `lib/slackNotifier.ts` | Function | Yes | A | Weekly digest |
| `webhookSecurity.verifyGitHubSignature` | `lib/webhookSecurity.ts` | Function | Yes | A | HMAC SHA-256 verify |
| `webhookSecurity.verifyJiraSignature` | `lib/webhookSecurity.ts` | Function | Yes | A | JWT/shared secret verify |
| `webhookSecurity.verifySlackSignature` | `lib/webhookSecurity.ts` | Function | Yes | A | HMAC + timestamp verify |
| `crypto.encrypt` | `lib/crypto.ts` | Function | Yes | A | AES-256-GCM encrypt |
| `crypto.decrypt` | `lib/crypto.ts` | Function | Yes | A | AES-256-GCM decrypt |
| `crypto.generateKey` | `lib/crypto.ts` | Function | Yes | B | Generate encryption key |

---

## 2. Tier A functions (detailed)

### `jiraAdapter.exchangeCodeForToken` — `server/src/lib/jiraAdapter.ts`

**Identity:** `exchangeCodeForToken` / `lib/jiraAdapter.ts` / Function / Exported / async / A

**Purpose:** Exchange OAuth authorization code for access/refresh tokens.

**Technical:**
1. `POST https://auth.atlassian.com/oauth/token` with `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`
2. Returns `{ access_token, refresh_token, expires_in, scope }`
3. Caller stores encrypted tokens in `user_integrations` or `org_integrations`

**Used by:** `integrationsRoutes.post('/jira/confirm')`, `integrationsRoutes.post('/jira/org-confirm')`

---

### `githubAdapter.exchangeCodeForToken` — `server/src/lib/githubAdapter.ts`

**Identity:** `exchangeCodeForToken` / `lib/githubAdapter.ts` / Function / Exported / async / A

**Purpose:** Exchange GitHub OAuth code for user access token.

**Technical:**
1. `POST https://github.com/login/oauth/access_token` with `code`, `client_id`, `client_secret`
2. Returns `{ access_token, refresh_token, expires_in, scope, token_type }`
3. Caller stores encrypted tokens in `user_integrations`

**Used by:** `integrationsRoutes.post('/github/confirm')`

---

### `slackOAuth.startSlackOAuth` — `server/src/lib/slackOAuth.ts`

**Identity:** `startSlackOAuth` / `lib/slackOAuth.ts` / Function / Exported / async / A

**Purpose:** Generate Slack OAuth URL for org install.

**Technical:**
1. Builds URL: `https://slack.com/oauth/v2/authorize?client_id=...&scope=...&redirect_uri=...&state=...`
2. State stored in `temp_oauth_states` with 10-min expiry
3. Returns `{ authUrl }`

**Used by:** `integrationsRoutes.post('/slack/org-connect')`

---

### `slackOAuth.linkSlackUser` — `server/src/lib/slackOAuth.ts`

**Identity:** `linkSlackUser` / `lib/slackOAuth.ts` / Function / Exported / async / A

**Purpose:** Link user's Slack identity via short code (for `/worklog` command).

**Technical:**
1. Generates short code → stores in `temp_slack_codes` (10 min expiry)
2. User types `/worklog link <code>` in Slack
3. Webhook receives command → `confirmSlackLink(code)`
4. Exchanges code for user tokens → stores in `slack_user_links` (encrypted)

---

### `webhookSecurity.verifyGitHubSignature` — `server/src/lib/webhookSecurity.ts`

**Identity:** `verifyGitHubSignature` / `lib/webhookSecurity.ts` / Function / Exported / A

**Purpose:** Verify `X-Hub-Signature-256` HMAC SHA-256.

**Technical:**
1. Reads `req.rawBody` (captured by `express.json({ verify })`)
2. Computes `crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET).update(rawBody).digest('hex')`
3. Compares with `X-Hub-Signature-256` using timing-safe compare
4. Returns boolean

**Used by:** `githubWebhookRoutes.post('/')`

---

### `webhookSecurity.verifySlackSignature` — `server/src/lib/webhookSecurity.ts`

**Identity:** `verifySlackSignature` / `lib/webhookSecurity.ts` / Function / Exported / A

**Purpose:** Verify `X-Slack-Signature` + `X-Slack-Request-Timestamp`.

**Technical:**
1. Checks timestamp within 5 minutes (replay protection)
2. Computes `crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${rawBody}`).digest('hex')`
3. Compares with `X-Slack-Signature` (format `v0=<hash>`)
3. Returns boolean

**Used by:** `slackWebhookRoutes.post('/')`

---

### `crypto.encrypt` / `crypto.decrypt` — `server/src/lib/crypto.ts`

**Identity:** `encrypt` / `decrypt` / `lib/crypto.ts` / Functions / Exported / A

**Purpose:** AES-256-GCM encryption for OAuth token storage.

**Technical:**
- Key: `ENCRYPTION_KEY` env var (32 bytes)
- `encrypt(plaintext)` → `{ iv, ciphertext, authTag }` → base64 JSON
- `decrypt(ciphertextObj)` → plaintext or throws

**Used by:** All integration token storage (`user_integrations`, `org_integrations`, `slack_user_links`)

---

## 2. Tier B functions (compact)

| Function | File:line | Purpose |
|---|---|---|
| `integrationsRoutes` Jira user connect | `integrations.ts:133` | OAuth start/get/callback/confirm |
| `integrationsRoutes` GitHub user connect | `integrations.ts:339` | OAuth start/get/callback/confirm |
| `integrationsRoutes` Jira org connect | `integrations.ts:430` | Org OAuth start/callback/confirm |
| `integrationsRoutes` Slack org connect | `integrations.ts:547` | Org OAuth start/callback/confirm |
| `integrationsRoutes` GitHub App | `integrations.ts:670` | App install/callback/confirm |
| `integrationsRoutes` Slack link | `integrations.ts:794` | User link start/confirm |
| `integrationsRoutes.get('/user')` | `integrations.ts:945` | List user integrations |
| `integrationsRoutes.delete('/user/:provider')` | `integrations.ts:970` | Disconnect user integration |
| `integrationsRoutes.get('/org/:orgId')` | `integrations.ts:990` | List org integrations |
| `integrationsRoutes.delete('/org/:orgId/:provider')` | `integrations.ts:1018` | Disconnect org integration |
| `githubWebhookRoutes.post('/')` | `webhooks/github.ts:22` | Verify sig → normalize → goal_links |
| `jiraWebhookRoutes.post('/')` | `webhooks/jira.ts:24` | Verify sig → normalize → goal_links |
| `slackWebhookRoutes.post('/')` | `webhooks/slack.ts:22` | Verify sig → commands/events → goal_links |
| `jiraAdapter.fetchUserProjects` | `jiraAdapter.ts` | List Jira projects |
| `jiraAdapter.fetchProjectIssues` | `jiraAdapter.ts` | Sync issues |
| `jiraAdapter.fetchAccessibleResources` | `jiraAdapter.ts` | Get cloud IDs |
| `jiraAdapter.normalizeEvent` | `jiraAdapter.ts` | Webhook → goal_link |
| `githubAdapter.fetchUserRepos` | `githubAdapter.ts` | List repos |
| `githubAdapter.fetchRepoIssues` | `githubAdapter.ts` | Sync issues |
| `githubAdapter.fetchPullRequests` | `githubAdapter.ts` | Sync PRs |
| `githubAdapter.normalizeEvent` | `githubAdapter.ts` | Webhook → goal_link |
| `githubApp.createInstallationToken` | `githubApp.ts` | App installation token |
| `githubApp.listInstallationRepos` | `githubApp.ts` | Repos for installation |
| `slackOAuth.handleSlackCallback` | `slackOAuth.ts` | Org callback token exchange |
| `slackOAuth.confirmSlackLink` | `slackOAuth.ts` | User link confirm |
| `slackAdapter.postMessage` | `slackAdapter.ts` | Send message |
| `slackAdapter.openModal` | `slackAdapter.ts` | Open modal |
| `slackAdapter.fetchChannels` | `slackAdapter.ts` | Fetch channels |
| `slackAdapter.exchangeCodeForToken` | `slackAdapter.ts` | User token exchange |
| `slackAdapter.handleCommand` | `slackAdapter.ts` | `/worklog` command |
| `slackAdapter.normalizeEvent` | `slackAdapter.ts` | Webhook → goal_link |
| `slackNotifier.sendGoalReminder` | `slackNotifier.ts` | Goal reminder |
| `slackNotifier.sendDigest` | `slackNotifier.ts` | Weekly digest |
| `webhookSecurity.verifyJiraSignature` | `webhookSecurity.ts` | JWT/shared secret |
| `crypto.generateKey` | `crypto.ts` | Generate encryption key |

---

## Related documents

- [Integrations endpoints](../06-api-reference/endpoint-reference-integrations-webhooks.md)
- [Jira/GitHub/Slack details](../09-integrations/jira-github-slack.md)
- [Integrations flow](../05-feature-flows/integrations-and-webhooks.md)
- [Webhook security](../08-security/security-architecture.md#5-webhook-security)

## Verification notes

All functions traced from source at commit `7567207`. OAuth handshakes, webhook delivery, token encryption/decryption not verified at runtime.