# Database Queries, Functions, Triggers & Operations

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Plain-Language Overview (Explain Like I Am Five)

Postgres doesn't just sit there holding folders—it also has built-in mini-robots (**functions and triggers**) and traffic cones (**locks**) that run automatically inside the database:

- Whenever you save a weekly log, a robot (`user_cohort_stats_trigger`) automatically recalculates your logging streak!
- Whenever you update a Key Result or a linked GitHub PR closes, a chain reaction (`recompute_goal_progress`) recalculates the goal's percentage—and climbs up the ladder to update its parent team/company goals too!
- Whenever you create a new company, a trigger (`provision_free_subscription`) automatically gives it a Free plan card.
- When Express asks the database a question, it calls `.from('table')` or `.rpc('robot_name')` using the service-role client.

---

## 2. PL/pgSQL Functions & RPCs Called from Node

| Function Name | Type / Usage | What It Does | Source |
|---|---|---|---|
| `provision_organization(p_name, p_slug, p_owner_id)` | RPC (`teamService.createOrg`, `routes/organizations.ts`) | Atomically creates org + `'owner'` row in `org_members` + `'Root'` team + team `'owner'`, rolling back (deleting org) on error. | `2026-06-16:507-543` |
| `viewable_user_ids(p_user_id, p_org_id)` | RPC (`authz.getViewableUserIds`) | Returns `SETOF UUID`: all org members if admin/owner, otherwise self + members of direct teams + members of descendant teams under teams where caller holds `manager`/`admin`/`owner`. | `2026-06-16:548-585` |
| `lock_organization_row(p_org_id)` | RPC (`teams.ts`, `goals.ts`, `goalService.ts`) | Runs `SELECT id ... FOR UPDATE` on `organizations` to serialize concurrent tree/parent mutations. *(Note: in stateless Supabase REST calls, single-statement RPC lock releases at statement end unless wrapped in a single Postgres transaction!)* | `2026-06-16:589-595` |
| `recompute_goal_progress(p_goal_id)` | Trigger + RPC (`goalRollupJob.ts`) | Recomputes goal progress for `'key_results'` (clamped weighted avg across metric types) or `'linked_items'` (done weight / total weight), then walks up `parent_goal_id` (max depth guard) cascading into ancestor `'linked_items'`/`'manual'` rollups; skips rewriting `manual` goal's own value. | `2026-06-16:997-1075` |
| `record_integration_event(p_provider, p_ext_id, p_type, p_payload)` | RPC (`webhookSecurity.recordEvent`) | Idempotent insert/reclaim into `integration_events`; returns `NULL` for duplicate non-errored events within 5 minutes so webhook retries short-circuit cleanly. | `2026-06-16:402-423` |
| `acquire_integration_sync_lock(p_user_id)` | RPC (`weeklySyncJob.ts`) | Sets `is_syncing = true` atomically on `integration_preferences` (reclaiming stale locks > 15m old). | `2026-06-16:428-441` |
| `get_week_start(date_value)` | Utility SQL function | Computes Monday start of week. | `supabase-schema.sql:186` |
| `cleanup_expired_tokens()` | Maintenance SQL function | Purges expired `email_verifications`, `refresh_tokens`, `password_resets` (unused by Node `pruneJob` which queries directly). | `custom-auth.sql:177-184` |
| `safe_local_time(p_timezone)` | Helper SQL function | Safe `NOW() AT TIME ZONE`, falling back to UTC on bad timezone names. | `2026-06-16:490-500` |
| `is_manager_of(p_mgr, p_member, p_org)` | Helper SQL function | Checks org/team management relationship via `team_closure`. | `2026-06-16:600-625` |

---

## 3. Database Triggers (Automated Invariants)

1. **Auth & Onboarding:** `on_auth_user_created` (`supabase-schema.sql:54`, dropped in `custom-auth.sql:200` when custom auth replaced Supabase Auth); `trigger_provision_free_subscription` (`2026-06-20:148-150`) creates `'free'` subscription row on `organizations` insert.
2. **Streaks & Cohorts:** `user_cohort_stats_trigger` (`cohort-tracking.sql:82-85`) runs `AFTER INSERT OR UPDATE OR DELETE ON work_log_entries`, updating `users.total_logs`, `last_logged_date`, and consecutive-week `current_streak`.
3. **Team Hierarchy Maintenance:** `trigger_team_closure_insert`, `trigger_teams_cycle_guard`, `trigger_team_closure_update` maintain transitive paths in `team_closure` and forbid team cycles.
4. **Cross-Org Tenant Guards:**
   - `trigger_set_org_integration_installer_null` clears installer on org removal.
   - `trigger_enforce_min_org_owner` blocks demoting or deleting the last `'owner'` of an org!
   - `trigger_verify_slack_session_org`, `trigger_verify_team_department_org`, `trigger_verify_goal_relations_org`, `trigger_enforce_goal_updates_org_member` (`2026-06-18:104`), and `enforce_goal_structure_integrity()` triggers block invalid cross-org/child assignments.
   - 13 `prevent_org_id_mutation` triggers forbid reassigning `org_id` on existing rows.
5. **Goal Progress Cascade:** `trigger_recompute_progress_key_results`, `trigger_recompute_progress_links`, `trigger_goals_after_changes` keep `goals.progress` synchronized across key results, links, and child goals (`goals_parent_cycle_guard` stops goal hierarchy loops).
6. **Timestamp Bookkeeping:** `update_updated_at_column()` triggers on `ai_articles`, `ai_impact_cards`, `org_members`, `departments`, `teams`, `team_members`, `goals`, `goal_key_results`, `goal_links`, `org_integrations`, `organizations`, `goal_assignees`, `goal_updates`, `integration_preferences`, `subscriptions`, `performance_reports`, `activity_summaries`, `integration_channel_preferences`.

---

## 4. Table-by-Table Code Readers & Writers Map

Verified by scanning every `.from(...)` and `.rpc(...)` call across `server/src/` and `scripts/`:

| Table | Readers / Writers (`server/src/...`) |
|---|---|
| `users` | `routes/auth.ts`, `routes/users.ts`, `routes/entries.ts`, `routes/appraisal.ts`, `routes/integrations.ts`, `middleware/auth.ts`, `jobs/reminderJob.ts`, `jobs/weeklyDigestJob.ts`, `jobs/weeklySyncJob.ts`, `jobs/marketing/*` |
| `user_profiles` | `routes/auth.ts`, `routes/users.ts`, `routes/appraisal.ts`, `routes/chat.ts`, `jobs/weeklyDigestJob.ts` *(bug: queries non-existent `.user_id`)* |
| `email_verifications` | `routes/auth.ts` |
| `password_reset_tokens` | `routes/auth.ts` (`password_resets` table is unused) |
| `refresh_tokens` | `middleware/auth.ts`, `routes/auth.ts`, `routes/users.ts` |
| `waitlist` | `routes/waitlist.ts` |
| `work_log_entries` | `routes/entries.ts`, `routes/appraisal.ts`, `routes/webhooks/slack.ts`, `lib/summaryService.ts`, `services/activityAggregationService.ts`, `jobs/monthlySummaryJob.ts`, `jobs/weeklySyncJob.ts`, `jobs/marketing/*` |
| `appraisal_criteria`, `generated_appraisals` | `routes/appraisal.ts` |
| `monthly_summaries` | `routes/summaries.ts`, `lib/summaryService.ts`, `lib/chatService.ts`, `jobs/monthlySummaryJob.ts` |
| `chat_sessions`, `chat_messages` | `routes/chat.ts` |
| `feedback` | `routes/feedback.ts` |
| `reminder_logs` | `jobs/reminderJob.ts` |
| `organizations` | `services/teamService.ts`, `lib/githubApp.ts`, `jobs/goalDigestJob.ts` |
| `org_members` | `services/authz.ts`, `services/teamService.ts`, `services/subscriptionService.ts`, `services/reportGenerationService.ts`, `routes/teams.ts`, `routes/goals.ts`, `routes/integrations.ts`, `routes/webhooks/slack.ts`, `lib/slackNotifier.ts`, `jobs/weeklySyncJob.ts`, `jobs/goalDigestJob.ts` |
| `departments` | `services/teamService.ts` |
| `teams`, `team_members`, `team_closure` | `services/teamService.ts`, `services/authz.ts`, `routes/teams.ts`, `routes/channelPreferences.ts`, `services/reportGenerationService.ts` |
| `goals` | `routes/goals.ts`, `services/goalService.ts`, `services/authz.ts`, `services/reportGenerationService.ts`, `routes/webhooks/slack.ts`, `lib/slackNotifier.ts`, `jobs/goalRollupJob.ts` |
| `goal_assignees`, `goal_key_results` | `services/goalService.ts` (+ `authz`, `slackNotifier`, `reportGenerationService` on `goal_assignees`) |
| `goal_links` | `services/goalService.ts`, `routes/webhooks/github.ts`, `routes/webhooks/jira.ts`, `jobs/goalRollupJob.ts` |
| `goal_updates` | `services/goalService.ts`, `routes/webhooks/slack.ts` |
| `user_integrations` | `server/src/index.ts`, `routes/integrations.ts`, `lib/githubAdapter.ts`, `lib/jiraAdapter.ts`, `jobs/weeklySyncJob.ts` |
| `org_integrations` | `server/src/index.ts`, `routes/integrations.ts`, `routes/goals.ts`, `services/goalService.ts`, `lib/githubApp.ts`, `lib/jiraAdapter.ts`, `lib/slackAdapter.ts`, `routes/webhooks/github.ts`, `routes/webhooks/jira.ts`, `jobs/goalRollupJob.ts`, `jobs/goalDigestJob.ts` |
| `integration_preferences`, `log_source_references` | `index.ts`, `jobs/weeklySyncJob.ts` |
| `integration_sync_logs` | `jobs/goalDigestJob.ts` *(used by digest job; `weeklySyncJob` does not write here)* |
| `integration_channel_preferences` | `routes/channelPreferences.ts`, `services/subscriptionService.ts` |
| `integration_events` | `index.ts`, `jobs/pruneJob.ts`, `lib/webhookSecurity.ts`, `services/activityAggregationService.ts` |
| `slack_user_links` | `routes/integrations.ts`, `routes/webhooks/slack.ts`, `lib/slackNotifier.ts` |
| `slack_command_sessions`, `temp_oauth_states`, `temp_slack_codes` | `index.ts`, `jobs/pruneJob.ts`, `routes/integrations.ts`, `routes/webhooks/slack.ts` |
| `subscriptions` | `routes/subscriptions.ts`, `services/subscriptionService.ts` |
| `performance_reports` | `routes/reports.ts`, `services/reportGenerationService.ts` |
| `activity_summaries` | `services/activityAggregationService.ts` |
| `ai_articles`, `ai_impact_cards`, `user_bookmarks` | `routes/aiPulse.ts` (+ `newsCollectionJob.ts`, `weeklyDigestJob.ts` on `ai_articles`) |
| `translation_cache` | `routes/translate.ts` |
| `marketing_logs` | `jobs/marketing/*` |
| `push_subscriptions` | `routes/push.ts`, `lib/webPush.ts` |
| `global_locks` | Distributed lock helpers in `weeklySyncJob.ts` / `goalRollupJob.ts` / `goalDigestJob.ts` (note: check `global_locks` usage via Supabase query vs `acquire_integration_sync_lock`) |

---

## Related Documents

- [Database Schema](./schema.md)
- [Migrations & Schema Drift](./migrations.md)

## Verification Notes

- Verified all SQL functions/triggers from SQL files and all `.from()`/`.rpc()` call sites via `map_db_usage.mjs`.