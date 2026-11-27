# Feature Flow: Notifications & Jobs

> **Status:** Partially verified (code inspection)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. What does this feature do?

Manages all background jobs (11 cron jobs) and notification channels: weekly reminder emails, monthly summaries, weekly digests, goal reminders, push notifications, Slack notifications, and marketing loops.

---

## 2. User interaction trace

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant F as Frontend (Settings.tsx)
    participant A as API (pushRoutes)
    participant D as Database (push_subscriptions, reminder_logs, marketing_logs)
    participant E as Email (Brevo)
    participant P as Web Push (VAPID)
    participant S as Slack
    participant J as Jobs (Node cron)

    %% PUSH SUBSCRIPTION
    U->>F: Opens /settings → "Enable Push" (Settings.tsx)
    F->>A: GET /api/push/vapid-public-key
    A-->>F: { publicKey }
    F->>P: navigator.serviceWorker.ready → pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
    P-->>F: PushSubscription { endpoint, keys: { p256dh, auth } }
    F->>A: POST /api/push/subscribe { endpoint, keys }
    A->>A: requireAuth → req.userId
    A->>D: INSERT push_subscriptions (user_id, endpoint, p256dh, auth)
    A-->>F: 201 { success: true }
    F->>B: Shows "Push enabled"

    %% WEEKLY REMINDER JOB (Mon 9 AM)
    participant R as reminderJob
    R->>D: SELECT users WHERE reminder_enabled=true AND reminder_day=1 (Mon) AND reminder_time <= now()
    loop For each user
        R->>D: Check reminder_logs (already sent this week?)
        R->>E: sendWeeklyReminder(user.email, user.name, week_start_date)
        R->>D: INSERT reminder_logs (user_id, sent_at, status='sent')
    end

    %% WEEKLY DIGEST JOB (Mon 8 AM)
    participant W as weeklyDigestJob
    W->>D: SELECT users with entries last week
    loop For each user
        W->>E: sendWeeklyDigest(user.email, entriesSummary)
        W->>D: INSERT marketing_logs (loop='weekly_digest', user_id)
    end

    %% MONTHLY SUMMARY JOB (1st of month)
    participant M as monthlySummaryJob
    M->>D: SELECT users with entries last month
    loop For each user
        M->>D: summaryService.generateMonthlySummary(userId, monthYear)
        M->>E: sendEmail with summary
    end

    %% GOAL DIGEST JOB (Daily 7 AM)
    participant G as goalDigestJob
    G->>D: SELECT goals with assignees, due soon
    loop For each goal
        G->>E: sendGoalReminder(assignee.email, goal)
        G->>S: slackNotifier.sendGoalReminder(assignee, goal)  // if Slack linked
    end

    %% GOAL ROLLUP JOB (Daily 3 AM)
    participant O as goalRollupJob
    O->>D: SELECT goals WHERE progress_mode IN ('key_results','linked_items')
    loop For each goal
        O->>D: goalService.rollupGoalProgress(goalId)
    end

    %% WEEKLY SYNC JOB (Daily 2 AM)
    participant Y as weeklySyncJob
    Y->>D: SELECT active user_integrations + org_integrations
    loop For each
        Y->>D: Acquire is_syncing/is_refreshing lock
        Y->>J: jiraAdapter/githubAdapter fetch recent
        Y->>D: Upsert goal_links
        Y->>D: Release lock
    end

    %% PRUNE JOB (Daily 4 AM)
    participant P as pruneJob
    P->>D: DELETE expired temp_oauth_states, temp_slack_codes, slack_command_sessions
    P->>D: DELETE integration_events > 30 days
    P->>D: Clear orphaned is_syncing/is_refreshing

    %% MARKETING LOOPS (gated by MARKETING_LOOPS_ENABLED)
    participant A as activationLoop (daily)
    A->>D: Find users who signed up but no entry → send activation email
    participant Dorm as dormancyWatch (daily)
    Dorm->>D: Find inactive users (>30 days) → send re-engagement email
    participant Wk as weeklyReview (weekly)
    Wk->>D: Generate marketing metrics → send to team Slack/email

    %% UNSUBSCRIBE PUSH
    U->>F: "Disable Push"
    F->>A: POST /api/push/unsubscribe { endpoint }
    A->>D: DELETE push_subscriptions WHERE user_id = req.userId AND endpoint = :endpoint
    A-->>F: 200 { success: true }
```

---

## 3. Files involved

| File | Responsibility |
|---|---|
| `server/src/jobs/reminderJob.ts` | Weekly reminder emails (Mon 9 AM) |
| `server/src/jobs/weeklyDigestJob.ts` | Weekly digest emails (Mon 8 AM) |
| `server/src/jobs/monthlySummaryJob.ts` | Monthly AI summaries (1st of month) |
| `server/src/jobs/goalDigestJob.ts` | Daily goal reminders (7 AM) |
| `server/src/jobs/goalRollupJob.ts` | Daily goal progress rollups (3 AM) |
| `server/src/jobs/weeklySyncJob.ts` | Daily Jira/GitHub sync (2 AM) |
| `server/src/jobs/pruneJob.ts` | Daily cleanup (4 AM) |
| `server/src/jobs/marketing/activationLoop.ts` | Activation emails |
| `server/src/jobs/marketing/dormancyWatch.ts` | Dormant user re-engagement |
| `server/src/jobs/marketing/weeklyReview.ts` | Weekly marketing report |
| `server/src/lib/email.ts` | Brevo email sending + Google Translate |
| `server/src/lib/webPush.ts` | VAPID keys, push sending |
| `server/src/lib/slackNotifier.ts` | Slack goal reminders, digests |
| `server/src/routes/push.ts` | VAPID key, subscribe, unsubscribe |
| `server/src/lib/summaryService.ts` | Monthly summary generation |
| `server/src/lib/slackAdapter.ts` | Slack API calls |
| `client/src/pages/Settings.tsx` | Push toggle, notification prefs |
| `client/src/lib/push.ts` | Client push subscription |
| `client/src/lib/api.ts` | Push API calls |

---

## 4. Functions involved (in execution order)

### Push subscription
1. `Settings.tsx` → `push.subscribe()` → `lib/push.ts`
2. `pushRoutes.post('/subscribe')` → `server/src/routes/push.ts:21`
3. `supabase.from('push_subscriptions').insert({ user_id, endpoint, p256dh, auth })`

### Weekly reminder job
1. `reminderJob.start()` → `jobs/reminderJob.ts` (cron: `0 9 * * 1`)
2. Query users with `reminder_enabled`, `reminder_day=1`, `reminder_time <= now()`
3. `email.sendWeeklyReminder(user.email, user.name, weekStartDate)` → `lib/email.ts`
4. `INSERT reminder_logs`

### Email sending
1. `email.sendEmail({ to, subject, htmlBody, textBody })` → `lib/email.ts:88`
2. `fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': BREVO_API_KEY } })`
3. Returns `{ success, messageId }`

### Web push
1. `webPush.sendPushNotification(userId, payload)` → `lib/webPush.ts`
2. `getVapidKeys()` → `web-push` library
3. Iterate user's `push_subscriptions` → `webPush.sendNotification(subscription, payload)`

### Slack notifications
1. `slackNotifier.sendGoalReminder(userId, goal)` → `lib/slackNotifier.ts`
2. `getTeamSlackChannels(orgId, teamId)` → `subscriptionService.ts`
3. `slackAdapter.postMessage(channel, blocks)` → `lib/slackAdapter.ts`

### Prune job
1. `pruneJob.start()` → `jobs/pruneJob.ts` (cron: `0 4 * * *`)
2. `DELETE FROM temp_oauth_states WHERE expires_at < now()`
3. `DELETE FROM temp_slack_codes WHERE expires_at < now()`
4. `DELETE FROM slack_command_sessions WHERE expires_at < now()`
5. `DELETE FROM integration_events WHERE received_at < now() - 30 days`
6. Clear orphaned `is_syncing=true`, `is_refreshing=true`

---

## 5. Data transformation

| Stage | Data shape |
|---|---|
| Push subscription request | `{ endpoint, keys: { p256dh, auth } }` |
| Push subscription DB | `{ user_id, endpoint, p256dh, auth, created_at }` |
| VAPID keys | `{ publicKey, privateKey, subject: 'mailto:...' }` |
| Reminder email | Template with user name, week start date, login link |
| Digest email | Template with entry summaries, streak, links |
| Slack message | Blocks: header, goal title, due date, progress bar, action button |
| Push payload | `{ title: 'Worklog AI', body: 'Time to log your week!', url: '/log' }` |
| Prune criteria | `expires_at < now()`, `received_at < now() - 30 days` |

---

## 6. Failure scenarios

| Failure point | Behavior |
|---|---|
| Brevo API key missing | Email skipped; warning logged |
| Push send fails (expired sub) | Logs error; subscription not auto-removed |
| Slack notification fails | Logs error; continues |
| Job lock held | Skips; logs warning; retries next run |
| Cron not running (free tier spin-down) | Jobs don't execute; no alert |
| Duplicate reminder | `reminder_logs` check prevents |
| 401 on push API | `apiRequest` refreshes token → retries |

---

## 7. Simple story

Think of a **notification engine** that runs while you sleep:

1. **Every Monday 8 AM**: Weekly digest email with your stats
2. **Every Monday 9 AM**: "Time to log your week!" reminder
3. **Every day 2 AM**: Syncs your Jira/GitHub issues to goal links
4. **Every day 3 AM**: Recalculates all goal progress rollups
5. **Every day 4 AM**: Cleans up expired temp data
6. **Every day 6 AM**: Collects AI news for AI Pulse
7. **Every day 7 AM**: Reminds goal assignees of due dates
8. **1st of month**: Generates your monthly AI summary
9. **Marketing loops** (if enabled): Activates new users, wakes dormant ones, sends weekly team report

**Opt-out**: Unsubscribe link in emails; "Disable Push" in Settings; `MARKETING_LOOPS_ENABLED=false` disables marketing jobs.

---

## Related documents

- [Job functions](../04-function-documentation/backend-jobs-infra.md)
- [Email service](../09-integrations/external-services.md#4-brevo-email)
- [Push notifications](../09-integrations/external-services.md#5-web-push)
- [Auth flow](../05-feature-flows/auth-and-onboarding.md)

## Verification notes

Paths traced from `server/src/jobs/*.ts`, `server/src/lib/email.ts`, `server/src/lib/webPush.ts`,
`server/src/lib/slackNotifier.ts`, `server/src/routes/push.ts` at commit `7567207`.
Not verified at runtime: cron scheduling on Render free tier, Brevo delivery, push delivery, Slack API rate limits.