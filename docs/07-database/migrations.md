# Database Migrations & Schema Drift Analysis

> **Status:** Verified
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Plain-Language Overview (Explain Like I Am Five)

Think of SQL migration files like instruction pages added over time as the house was remodeled:

1. Page 1 built a tiny cottage attached to Supabase's built-in mailbox (`supabase-schema.sql`).
2. Page 2 tore off that mailbox and built our own front door (`supabase-schema-custom-auth.sql`).
3. Later pages added AI news, translations, streaks, enterprise teams, OKRs, Jira/GitHub/Slack connectors, browser push bells, and billing plans.
4. Because nobody uses an automated migration runner (developers paste SQL into Supabase Studio manually), a few **mismatches** crept in between what the old pages say, what the newer pages expect, and what the Node server actually queries! Every mismatch found is listed clearly below.

---

## 2. Recommended Migration Application Order (Clean Install vs Incremental)

| Order | File | Purpose |
|---|---|---|
| 1 | `supabase-schema.sql` (base + appended sections) | Base tables, `users`, `password_reset_tokens`, `email_verifications`, `refresh_tokens`, AI Pulse, chat, feedback, marketing, translation |
| 2 | `supabase-schema-custom-auth.sql` *(careful: creates `password_resets` vs `password_reset_tokens`, drops `on_auth_user_created`)* | Drops Supabase `auth.users` dependency, adds onboarding columns to `users` & `waitlist` |
| 3 | `supabase-migration-ai-pulse.sql` + `supabase-schema-ai-pulse-seed.sql` | Ensures AI Pulse tables, indexes, and 5+5 initial seed rows |
| 4 | `migrations/001`, `002`, `003`, `add_feedback_table` | Historical incremental patches (mostly idempotent/subsumed by `supabase-schema.sql`) |
| 5 | `supabase-migrations/2026-06-05_i18n_support.sql` | Adds `user_profiles.preferred_language` and `translation_cache` (`namespace` variant) |
| 6 | `supabase-migrations/2026-06-07_security_token_hashing.sql` | Converts plaintext tokens to SHA-256 `token_hash` columns + adds `session_ttl_days` |
| 7 | `supabase-migrations/2026-06-16_teams_goals_integrations.sql` | Corporate Teams, OKRs, closure table, rollup triggers, webhook ledger, locks, deny-all RLS |
| 8 | `supabase-migrations/2026-06-18_followup_constraints.sql` | Follow-up `CHECK` constraints, sort/audit indexes, `goal_updates` member trigger, `updated_at` triggers |
| 9 | `supabase-migrations/2026-06-20_premium_subscriptions.sql` | `subscriptions`, `performance_reports`, `activity_summaries`, `integration_channel_preferences` |
| 10 | `supabase-migrations/cohort-tracking.sql` | Adds `total_logs`, `current_streak`, `last_logged_date`, `logging_cadence`, trigger & cohort view |
| 11 | `supabase-migrations/push-subscriptions.sql` | Adds `push_subscriptions` |

---

## 3. Verified Schema vs Runtime Drift Issues

| # | Area | SQL Declaration | Runtime Code Expectation | Impact |
|---|---|---|---|---|
| 1 | Password reset table | `custom-auth.sql:73` creates `password_resets`; `supabase-schema.sql:239` & `2026-06-16:1311` create/harden `password_reset_tokens` | `server/src/routes/auth.ts` queries `password_reset_tokens` | Applying only `custom-auth.sql` without `supabase-schema.sql` leaves `password_reset_tokens` missing! |
| 2 | `temp_slack_codes.email` | `2026-06-16:361-370` defines `(id, slack_team_id, slack_user_id, code, expires_at, created_at)` — **no `email` column** | `server/src/routes/integrations.ts:822` inserts `{ slack_team_id, slack_user_id, email, code, expires_at }` | PostgREST rejects insert if `email` column wasn't manually added out-of-band. |
| 3 | `push_subscriptions` conflict target | `push-subscriptions.sql:11` declares `UNIQUE(user_id, endpoint)` only | `server/src/routes/push.ts:41` calls `.upsert(..., { onConflict: 'endpoint' })` | Postgres raises error `42P10` (`no unique or exclusion constraint matching ON CONFLICT`) unless `UNIQUE(endpoint)` exists separately. |
| 4 | `user_profiles.user_id` | `supabase-schema.sql:12-22` defines PK `id` (no `user_id` column) | `server/src/jobs/weeklyDigestJob.ts:46` selects `.select('user_id')` from `user_profiles` | Weekly digest fails to query recipients. |
| 5 | `integration_channel_preferences` upsert | `2026-06-20:92-99` uses expression index `COALESCE(user_id, ...), COALESCE(team_id, ...)` | `server/src/routes/channelPreferences.ts:65,137` passes SQL `COALESCE(...)` strings inside `.upsert(..., { onConflict: '...' })` | PostgREST `on_conflict` query param accepts column names, not SQL `COALESCE` expressions — upsert calls risk failing. |
| 6 | `ai_articles.category` CHECK | SQL `CHECK` allows 9 values (`'news'..'world_ai'`) (`supabase-schema.sql:369`) | `client/src/pages/ai-pulse/Hub.tsx:48` includes 10th filter button `'ai_news'` | Clicking `'ai_news'` always returns empty results cleanly (never exists in DB). |
| 7 | `integration_events.provider` CHECK | `2026-06-16:374` requires `provider IN ('slack', 'github_app', 'jira')` | `server/src/routes/webhooks/github.ts:37` calls `recordEvent(..., { provider: 'github', ... })` | Webhook idempotency insert fails DB CHECK constraint! |
| 8 | `translation_cache` schema divergence | `supabase-schema.sql:517` uses composite PK `(language_code, version)` + `source`; `2026-06-05:8` uses `id` + `namespace` + `UNIQUE(language_code, namespace, version)` | `routes/translate.ts` queries `translation_cache` | Requires checking which DDL ran in production (`2026-06-05` omits `source` column!). |

---

## Related Documents

- [Database Schema](./schema.md)
- [Technical Debt](../12-code-review/technical-debt.md)
- [Risks & Observations](../12-code-review/risks-and-observations.md)

## Verification Notes

- Verified across all 15 `.sql` files and cross-checked against all server routes, jobs, and client components.