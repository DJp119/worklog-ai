# Feature Flow: Integrations & Webhooks

> **Status:** Partially verified (code inspection)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. What does this feature do?

Connects the app to Jira, GitHub, and Slack via OAuth. Syncs issues/PRs to work logs and goal links. Receives webhooks for real-time updates. Manages per-user and per-org connections.

---

## 2. User interaction trace

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant F as Frontend (Integrations.tsx)
    participant A as API (integrationsRoutes)
    participant D as Database (user_integrations, org_integrations, temp_oauth_states, integration_preferences, integration_events)
    participant J as Jira
    participant G as GitHub
    participant S as Slack

    %% JIRA USER CONNECT
    U->>F: Clicks "Connect Jira" (OAuthButton.tsx)
    F->>A: POST /api/integrations/jira/connect
    A->>D: INSERT temp_oauth_states (state, provider=jira, user_id, expires_at)
    A-->>F: { authUrl }
    F->>J: Redirects to Atlassian consent
    J->>U: User approves
    J->>A: GET /api/integrations/jira/callback?code&state
    A->>D: Validate state from temp_oauth_states
    A->>J: POST /oauth/token (code exchange)
    J-->>A: access_token, refresh_token
    A->>J: GET /oauth/token/accessible-resources
    J-->>A: [{ cloudId, name, url }]
    A->>D: UPSERT user_integrations (encrypted tokens, cloudId)
    A->>D: DELETE temp_oauth_states
    A-->>F: 302 /integrations?jira=connected

    %% GITHUB USER CONNECT (similar)
    F->>A: POST /api/integrations/github/connect
    A->>D: INSERT temp_oauth_states (provider=github)
    A-->>F: { authUrl }
    F->>G: Redirect
    G->>U: Approve
    G->>A: GET /api/integrations/github/callback?code&state
    A->>G: Exchange code for token
    A->>D: UPSERT user_integrations (provider=github)
    A-->>F: 302 /integrations?github=connected

    %% SLACK ORG CONNECT
    U->>F: "Add to Slack" (org admin)
    F->>A: POST /api/integrations/slack/org-connect
    A->>D: INSERT temp_oauth_states (provider=slack, org_id)
    A-->>F: { authUrl }
    F->>S: Redirect to Slack install
    S->>U: Approve for workspace
    S->>A: GET /api/integrations/slack/org-callback?code&state
    A->>S: Exchange code for bot token
    S-->>A: bot_token, team_id
    A->>D: UPSERT org_integrations (provider=slack, external_install_id=team_id)
    A-->>F: 302 /integrations?slack=connected

    %% SLACK USER LINK (for slash commands)
    U->>F: "Link Slack" → enters code from /worklog link <code>
    F->>A: POST /api/integrations/slack/link/start
    A->>D: INSERT temp_slack_codes (code, user_id, expires_at)
    A-->>F: { expiresAt }
    U->>S: Types `/worklog link ABC123`
    S->>A: POST /api/webhooks/slack (command)
    A->>A: verifySlackSignature
    A->>A: Parse code → exchange for user token
    A->>D: UPSERT slack_user_links (user_id, access_token, refresh_token)
    A->>S: Responds "Linked!"

    %% WEEKLY SYNC JOB (daily 2 AM)
    participant Y as weeklySyncJob
    Y->>D: SELECT active user_integrations + org_integrations
    loop For each integration
        Y->>D: Acquire lock (is_syncing / is_refreshing)
        alt Jira
            Y->>J: Fetch recent issues from projects
            Y->>A: jiraAdapter.normalizeEvent → upsert goal_links
        alt GitHub
            Y->>G: Fetch recent issues/PRs from repos
            Y->>A: githubAdapter.normalizeEvent → upsert goal_links
        alt Slack
            Y->>S: (no sync; notifications only)
        end
        Y->>D: Release lock
    end

    %% WEBHOOKS (real-time)
    Note over J,G,S: External events → POST /api/webhooks/{jira,github,slack}
    J->>A: POST /api/webhooks/jira (X-Atlassian-Webhook-Signature)
    A->>A: verifyJiraSignature
    A->>D: INSERT integration_events (raw payload)
    A->>A: jiraAdapter.normalizeEvent → upsert goal_links
    G->>A: POST /api/webhooks/github (X-Hub-Signature-256)
    A->>A: verifyGitHubSignature
    A->>D: INSERT integration_events
    A->>A: githubAdapter.normalizeEvent → upsert goal_links
    S->>A: POST /api/webhooks/slack (X-Slack-Signature)
    A->>A: verifySlackSignature
    A->>D: INSERT integration_events
    A->>A: slackAdapter.handleCommand / normalizeEvent
```

---

## 3. Files involved

| File | Responsibility |
|---|---|
| `server/src/routes/integrations.ts` | 19 handlers: all OAuth flows, list/delete |
| `server/src/routes/webhooks/github.ts` | GitHub webhook verification + processing |
| `server/src/routes/webhooks/jira.ts` | Jira webhook verification + processing |
| `server/src/routes/webhooks/slack.ts` | Slack webhook + slash commands |
| `server/src/lib/jiraAdapter.ts` | `exchangeCodeForToken`, `fetchUserProjects`, `fetchProjectIssues`, `normalizeEvent` |
| `server/src/lib/githubAdapter.ts` | `exchangeCodeForToken`, `fetchUserRepos`, `fetchRepoIssues`, `normalizeEvent` |
| `server/src/lib/githubApp.ts` | GitHub App installation token management |
| `server/src/lib/slackAdapter.ts` | `postMessage`, `openModal`, `fetchChannels`, `exchangeCodeForToken` |
| `server/src/lib/slackOAuth.ts` | `startSlackOAuth`, `handleSlackCallback`, `linkSlackUser` |
| `server/src/lib/slackNotifier.ts` | `sendGoalReminder`, `sendDigest` |
| `server/src/lib/webhookSecurity.ts` | `verifyGitHubSignature`, `verifyJiraSignature`, `verifySlackSignature` |
| `server/src/lib/crypto.ts` | `encrypt`, `decrypt` (AES-256-GCM for token storage) |
| `server/src/jobs/weeklySyncJob.ts` | Daily 2 AM sync for all integrations |
| `server/src/jobs/goalDigestJob.ts` | Daily 7 AM goal reminders via Slack |
| `client/src/pages/Integrations.tsx` | User/org integrations list, connect buttons |
| `client/src/components/integrations/ConnectionCard.tsx` | Connected integration display |
| `client/src/components/integrations/OAuthButton.tsx` | OAuth connect button |
| `client/src/lib/integrationsApi.ts` | All integration API calls |

---

## 4. Functions involved (in execution order)

### Jira OAuth (user)
1. `OAuthButton.tsx` → `integrationsApi.connectJira()` → `integrationsApi.ts`
2. `integrationsRoutes.post('/jira/connect')` → `integrations.ts:133`
3. `jiraAdapter.startOAuth` → generates state → `temp_oauth_states`
4. Callback → `integrations.ts:159` → `jiraAdapter.exchangeCodeForToken`
5. `jiraAdapter.fetchAccessibleResources` → cloudId
6. `UPSERT user_integrations` (encrypted tokens via `crypto.ts`)

### GitHub OAuth (user)
1. `integrationsApi.connectGitHub()` → `integrations.ts:339`
2. `githubAdapter.exchangeCodeForToken` → tokens
3. `UPSERT user_integrations`

### Slack Org Connect
1. `integrationsApi.connectSlack()` → `integrations.ts:547`
2. `slackOAuth.startSlackOAuth` → auth URL
3. Callback → `slackOAuth.handleSlackCallback` → bot token
4. `UPSERT org_integrations` (provider=slack)

### Slack User Link (slash command)
1. `linkSlackStart` → `temp_slack_codes`
2. User types `/worklog link <code>` in Slack
3. Webhook → `slackAdapter.handleCommand` → `linkSlackUser`
4. `UPSERT slack_user_links`

### Weekly Sync Job
1. `weeklySyncJob.start()` → `jobs/weeklySyncJob.ts`
2. For each active integration:
   - Acquire `is_syncing` / `is_refreshing` lock
   - `jiraAdapter.fetchProjectIssues` / `githubAdapter.fetchRepoIssues`
   - `normalizeEvent` → upsert `goal_links` (matching by `external_id`)
   - Release lock

### Webhook Processing
1. `verifyGitHubSignature` / `verifyJiraSignature` / `verifySlackSignature` → `webhookSecurity.ts`
2. `jiraAdapter.normalizeEvent` / `githubAdapter.normalizeEvent` / `slackAdapter.normalizeEvent`
3. `INSERT integration_events` + upsert `goal_links`

---

## 5. Data transformation

| Stage | Data shape |
|---|---|
| OAuth state | `{ state, provider, userId?, orgId?, expiresAt, data? }` |
| Jira tokens | `{ access_token, refresh_token, cloudId }` (encrypted in DB) |
| GitHub tokens | `{ access_token, refresh_token }` (encrypted) |
| Slack bot token | `xoxb-...` (encrypted in `org_integrations.config`) |
| Slack user tokens | `slack_user_links` (encrypted) |
| Sync lock | `is_syncing=true`, `sync_started_at=now()` |
| Webhook event | `{ provider, event_type, external_id, external_key, title, state, url, is_done, raw_payload }` |
| Goal link upsert | `UNIQUE (goal_id, provider, external_id)` |

---

## 6. Failure scenarios

| Failure point | Behavior |
|---|---|
| OAuth state expired | 400 `{ error: "Invalid or expired state" }` |
| Token exchange fails | 500; logs error; user retries |
| Signature verification fails | 400 `{ error: "Invalid signature" }` |
| Sync lock held | Job skips; logs warning; retries next run |
| Token refresh fails | Marks `is_refreshing=false`; logs error; user notified |
| Webhook processing error | Logs error; returns 200 to ack (prevents replay) |
| 401 on API call | `apiRequest` refreshes token → retries |

---

## 7. Simple story

Connect your **work tools** so the app reads them automatically:

1. **Click "Connect Jira"** → approve → your issues appear in goal links
2. **Click "Connect GitHub"** → approve → your PRs appear in goal links
3. **Admin clicks "Add Slack"** → installs bot → team gets `/worklog` command
4. **You type `/worklog link ABC123`** in Slack → your Slack identity linked
5. **Every night at 2 AM** → app pulls new issues/PRs → updates goal progress
6. **Instantly** → Jira webhook fires → goal link updates to "Done"

**Security**: Tokens encrypted at rest (AES-256-GCM). Webhooks verified by HMAC. OAuth state expires in 10 min.

---

## Related documents

- [Integrations endpoints](../06-api-reference/endpoint-reference-integrations-webhooks.md)
- [Jira/GitHub/Slack details](../09-integrations/jira-github-slack.md)
- [Integration functions](../04-function-documentation/backend-integrations.md)
- [Webhook security](../08-security/security-architecture.md#5-webhook-security)

## Verification notes

All paths traced from `server/src/routes/integrations.ts`, `webhooks/*.ts`,
`lib/*Adapter.ts`, `lib/slackOAuth.ts`, `lib/webhookSecurity.ts` at commit `7567207`.
Not verified at runtime: actual OAuth handshakes, webhook delivery, token encryption/decryption, sync job concurrency.