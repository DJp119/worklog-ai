# Backend Functions: Jobs & Infrastructure

> **Status:** Partially verified (code inspection)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Function inventory

| Function | File:line | Kind | Exported | Tier | Purpose |
|---|---|---|---|---|---|
| `reminderJob.start` | `jobs/reminderJob.ts` | Function | Yes | A | Weekly reminder emails (Mon 9 AM) |
| `reminderJob.stop` | `jobs/reminderJob.ts` | Function | Yes | B | Stop cron |
| `monthlySummaryJob.start` | `jobs/monthlySummaryJob.ts` | Function | Yes | A | Monthly AI summaries (1st of month) |
| `monthlySummaryJob.stop` | `jobs/monthlySummaryJob.ts` | Function | Yes | B | Stop cron |
| `newsCollectionJob.start` | `jobs/newsCollectionJob.ts` | Function | Yes | A | Daily AI news ingestion (6 AM) |
| `newsCollectionJob.stop` | `jobs/newsCollectionJob.ts` | Function | Yes | B | Stop cron |
| `weeklyDigestJob.start` | `jobs/weeklyDigestJob.ts` | Function | Yes | A | Weekly digest emails (Mon 8 AM) |
| `weeklyDigestJob.stop` | `jobs/weeklyDigestJob.ts` | Function | Yes | B | Stop cron |
| `weeklySyncJob.start` | `jobs/weeklySyncJob.ts` | Function | Yes | A | Daily Jira/GitHub sync (2 AM) |
| `weeklySyncJob.stop` | `jobs/weeklySyncJob.ts` | Function | Yes | B | Stop cron |
| `goalRollupJob.start` | `jobs/goalRollupJob.ts` | Function | Yes | A | Daily goal progress rollup (3 AM) |
| `goalRollupJob.stop` | `jobs/goalRollupJob.ts` | Function | Yes | B | Stop cron |
| `goalDigestJob.start` | `jobs/goalDigestJob.ts` | Function | Yes | A | Daily goal reminders (7 AM) |
| `goalDigestJob.stop` | `jobs/goalDigestJob.ts` | Function | Yes | B | Stop cron |
| `pruneJob.start` | `jobs/pruneJob.ts` | Function | Yes | A | Daily cleanup (4 AM) |
| `pruneJob.stop` | `jobs/pruneJob.ts` | Function | Yes | B | Stop cron |
| `activationLoop.start` | `jobs/marketing/activationLoop.ts` | Function | Yes | A | Marketing activation emails (daily) |
| `activationLoop.stop` | `jobs/marketing/activationLoop.ts` | Function | Yes | B | Stop cron |
| `dormancyWatch.start` | `jobs/marketing/dormancyWatch.ts` | Function | Yes | A | Dormant user re-engagement (daily) |
| `dormancyWatch.stop` | `jobs/marketing/dormancyWatch.ts` | Function | Yes | B | Stop cron |
| `weeklyReview.start` | `jobs/marketing/weeklyReview.ts` | Function | Yes | A | Weekly marketing report |
| `weeklyReview.stop` | `jobs/marketing/weeklyReview.ts` | Function | Yes | B | Stop cron |
| `email.sendEmail` | `lib/email.ts:88` | Function | Yes | A | Brevo send |
| `email.sendVerificationEmail` | `lib/email.ts` | Function | Yes | B | Signup verification |
| `email.sendPasswordResetEmail` | `lib/email.ts` | Function | Yes | B | Password reset |
| `email.sendWeeklyReminder` | `lib/email.ts` | Function | Yes | B | Weekly reminder |
| `email.sendWeeklyDigest` | `lib/email.ts` | Function | Yes | B | Weekly digest |
| `email.translateStatic` | `lib/email.ts:76` | Function | Yes | B | Google Translate memoized |
| `webPush.sendPushNotification` | `lib/webPush.ts` | Function | Yes | A | Send push to user's subscriptions |
| `webPush.getVapidKeys` | `lib/webPush.ts` | Function | Yes | B | VAPID keys |
| `slackNotifier.sendGoalReminder` | `lib/slackNotifier.ts` | Function | Yes | A | Goal reminder |
| `slackNotifier.sendDigest` | `lib/slackNotifier.ts` | Function | Yes | A | Weekly digest |
| `logger` | `lib/logger.ts` | Instance | Yes | B | Pino logger |
| `getMdcContext` | `lib/mdc.ts` | Function | Yes | B | MDC context |
| `posthog.captureEvent` | `lib/posthog.ts` | Function | Yes | B | PostHog event |
| `posthog.captureException` | `lib/posthog.ts` | Function | Yes | B | PostHog exception |
| `posthog.identifyUser` | `lib/posthog.ts` | Function | Yes | B | PostHog identify |

---

## 2. Tier A functions (detailed)

### `reminderJob.start` — `server/src/jobs/reminderJob.ts`

**Identity:** `reminderJob.start` / `jobs/reminderJob.ts` / Function / Exported / A

**Purpose:** Schedules weekly reminder emails (Monday 9 AM by default).

**Technical:**
1. `node-cron.schedule('0 9 * * 1', async () => { ... })` — cron: Mon 9 AM
2. Queries users: `reminder_enabled=true`, `reminder_day=1` (Mon), `reminder_time <= now()`
3. For each user:
   - Checks `reminder_logs` for this week (prevents duplicates)
   - `email.sendWeeklyReminder(user.email, user.name, weekStartDate)`
   - Inserts `reminder_logs` (user_id, sent_at, status)
4. Logs count sent

**Schedule:** Cron `0 9 * * 1` (Mon 9 AM server time)

**Locks:** Uses `reminder_logs` uniqueness (user_id + week) to prevent duplicates

---

### `weeklySyncJob.start` — `server/src/jobs/weeklySyncJob.ts`

**Identity:** `weeklySyncJob.start` / `jobs/weeklySyncJob.ts` / Function / Exported / A

**Purpose:** Daily Jira/GitHub sync for all active integrations (2 AM).

**Technical:**
1. `node-cron.schedule('0 2 * * *', async () => { ... })` — cron: Daily 2 AM
2. Queries active `user_integrations` + `org_integrations` (Jira, GitHub)
3. For each integration:
   - Acquires lock: `is_syncing=true`, `sync_started_at=now()` on `integration_preferences`
   - Calls `jiraAdapter.fetchProjectIssues` or `githubAdapter.fetchRepoIssues`
   - Normalizes via adapter → upserts `goal_links` (match by `external_id`)
   - Releases lock: `is_syncing=false`
4. Token refresh: if `is_refreshing` false, sets true, refreshes token, updates `user_integrations`/`org_integrations`

**Schedule:** Cron `0 2 * * *` (Daily 2 AM)

**Locks:** `integration_preferences.is_syncing`, `user_integrations.is_refreshing`, `org_integrations.is_refreshing`

---

### `goalRollupJob.start` — `server/src/jobs/goalRollupJob.ts`

**Identity:** `goalRollupJob.start` / `jobs/goalRollupJob.ts` / Function / Exported / A

**Purpose:** Daily goal progress rollup from children/KRs/links (3 AM).

**Technical:**
1. `node-cron.schedule('0 3 * * *', async () => { ... })` — cron: Daily 3 AM
2. `supabase.from('goals').select('id').in('progress_mode', ['key_results', 'linked_items'])`
3. For each goal: `goalService.rollupGoalProgress(goalId)`
   - Walks `parent_goal_id` tree
   - Recalculates progress from children/KRs/links
   - `UPDATE goals SET progress = calculated`

**Schedule:** Cron `0 3 * * *` (Daily 3 AM)

---

### `pruneJob.start` — `server/src/jobs/pruneJob.ts`

**Identity:** `pruneJob.start` / `jobs/pruneJob.ts` / Function / Exported / A

**Purpose:** Daily cleanup of expired temp/cache rows (4 AM).

**Technical:**
1. `node-cron.schedule('0 4 * * *', async () => { ... })` — cron: Daily 4 AM
2. `DELETE FROM temp_oauth_states WHERE expires_at < now()`
2. `DELETE FROM temp_slack_codes WHERE expires_at < now()`
2. `DELETE FROM slack_command_sessions WHERE expires_at < now()`
2. `DELETE FROM integration_events WHERE received_at < now() - 30 days`
3. Clears orphaned locks:
   - `UPDATE integration_preferences SET is_syncing=false WHERE is_syncing=true AND sync_started_at < now() - 15 min`
   - `UPDATE user_integrations SET is_refreshing=false WHERE is_refreshing=true AND refresh_started_at < now() - 30 min`
   - `UPDATE org_integrations SET is_refreshing=false WHERE is_refreshing=true AND refresh_started_at < now() - 30 min`

**Schedule:** Cron `0 4 * * *` (Daily 4 AM)

---

### `email.sendEmail` — `server/src/lib/email.ts:88`

**Identity:** `sendEmail` / `lib/email.ts:88` / Function / Exported / async / A

**Purpose:** Send email via Brevo API.

**Technical:**
```ts
await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
  body: JSON.stringify({
    sender: { email: BREVO_FROM_EMAIL, name: BREVO_FROM_NAME },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.htmlBody,
    textContent: options.textBody || '',
  })
})
```
Returns `{ success: boolean, messageId?: string }`

---

### `webPush.sendPushNotification` — `server/src/lib/webPush.ts`

**Identity:** `sendPushNotification` / `lib/webPush.ts` / Function / Exported / async / A

**Purpose:** Send web push to all user's subscriptions.

**Technical:**
1. `getVapidKeys()` → `{ publicKey, privateKey, subject }`
2. `supabase.from('push_subscriptions').select('*').eq('user_id', userId)`
3. For each sub: `web-push.sendNotification(subscription, JSON.stringify(payload), { vapidDetails })`
3. Handles 410/404 (expired) — could auto-delete

---

## 3. Tier B functions (compact)

| Function | File:line | Purpose |
|---|---|---|
| `reminderJob.stop` | `reminderJob.ts` | Stop cron |
| `monthlySummaryJob.start` | `monthlySummaryJob.ts` | Monthly summaries (1st of month) |
| `monthlySummaryJob.stop` | `monthlySummaryJob.ts` | Stop cron |
| `newsCollectionJob.start` | `newsCollectionJob.ts` | AI news ingestion (6 AM) |
| `newsCollectionJob.stop` | `newsCollectionJob.ts` | Stop cron |
| `weeklyDigestJob.start` | `weeklyDigestJob.ts` | Weekly digest emails (Mon 8 AM) |
| `weeklyDigestJob.stop` | `weeklyDigestJob.ts` | Stop cron |
| `weeklySyncJob.stop` | `weeklySyncJob.ts` | Stop cron |
| `goalRollupJob.stop` | `goalRollupJob.ts` | Stop cron |
| `goalDigestJob.start` | `goalDigestJob.ts` | Goal reminders (7 AM) |
| `goalDigestJob.stop` | `goalDigestJob.ts` | Stop cron |
| `pruneJob.stop` | `pruneJob.ts` | Stop cron |
| `activationLoop.start` | `marketing/activationLoop.ts` | Activation emails (daily) |
| `activationLoop.stop` | `marketing/activationLoop.ts` | Stop cron |
| `dormancyWatch.start` | `marketing/dormancyWatch.ts` | Dormant user re-engagement |
| `dormancyWatch.stop` | `marketing/dormancyWatch.ts` | Stop cron |
| `weeklyReview.start` | `marketing/weeklyReview.ts` | Weekly marketing report |
| `weeklyReview.stop` | `marketing/weeklyReview.ts` | Stop cron |
| `email.sendVerificationEmail` | `email.ts` | Signup verification |
| `email.sendPasswordResetEmail` | `email.ts` | Password reset |
| `email.sendWeeklyReminder` | `email.ts` | Weekly reminder |
| `email.sendWeeklyDigest` | `email.ts` | Weekly digest |
| `email.translateStatic` | `email.ts:76` | Google Translate memoized |
| `webPush.getVapidKeys` | `webPush.ts` | VAPID keys |
| `slackNotifier.sendGoalReminder` | `slackNotifier.ts` | Slack goal reminder |
| `slackNotifier.sendDigest` | `slackNotifier.ts` | Weekly digest |
| `logger` | `logger.ts` | Pino logger |
| `getMdcContext` | `mdc.ts` | MDC context |
| `posthog.captureEvent` | `posthog.ts` | PostHog event |
| `posthog.captureException` | `posthog.ts` | PostHog exception |
| `posthog.identifyUser` | `posthog.ts` | PostHog identify |

---

## 4. Job schedule summary

| Job | Cron | Time (UTC) | Purpose |
|---|---|---|---|
| `reminderJob` | `0 9 * * 1` | Mon 9:00 | Weekly reminder emails |
| `monthlySummaryJob` | `0 0 1 * *` | 1st of month 00:00 | Monthly AI summaries |
| `newsCollectionJob` | `0 6 * * *` | Daily 06:00 | AI news ingestion |
| `weeklyDigestJob` | `0 8 * * 1` | Mon 08:00 | Weekly digest emails |
| `weeklySyncJob` | `0 2 * * *` | Daily 02:00 | Jira/GitHub sync |
| `goalRollupJob` | `0 3 * * *` | Daily 03:00 | Goal progress rollup |
| `goalDigestJob` | `0 7 * * *` | Daily 07:00 | Goal reminders |
| `pruneJob` | `0 4 * * *` | Daily 04:00 | Cleanup temp/cache |
| `activationLoop` | `0 9 * * *` | Daily 09:00 | Marketing activation |
| `dormancyWatch` | `0 10 * * *` | Daily 10:00 | Dormant user outreach |
| `weeklyReview` | `0 9 * * 1` | Mon 09:00 | Marketing weekly report |

**Note:** All times server-local (UTC unless configured). Render free tier may spin down — jobs won't run during spin-down.

---

## Related documents

- [Notifications & Jobs flow](../05-feature-flows/notifications-and-jobs.md)
- [Email service](../09-integrations/external-services.md#4-brevo-email)
- [Push notifications](../09-integrations/external-services.md#5-web-push)
- [Job startup](../02-architecture/backend-architecture.md#10-background-jobs)

## Verification notes

All functions traced from source at commit `7567207`. Cron scheduling on Render free tier, Brevo delivery, push delivery not verified at runtime.