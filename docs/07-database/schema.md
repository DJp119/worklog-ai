# Database Schema Reference

> **Status:** Verified (All 15 `.sql` files inspected statically; live Supabase schema not queried directly)
> **Source commit:** `7567207`
> **Last reviewed:** 2026-11-27
> **Audience:** Junior, Senior

---

## 1. Plain-Language Overview (Explain Like I Am Five)

Think of the Postgres database like a huge filing room containing **47 drawers (tables)** and **1 summary window (view)**:

- Each drawer holds one kind of record (like `users`, `work_log_entries`, `goals`, `chat_messages`).
- Each column inside a drawer is a labeled slot on the index card (`id`, `email`, `progress`, etc.), and rules (`CHECK`, `UNIQUE`, `REFERENCES`) prevent saving nonsense cards—for example, a goal cannot end before it starts (`due_date >= start_date`).
- Because this app grew from a personal diary into a team/OKR/integration platform, older schema files (`supabase-schema.sql`, `supabase-schema-custom-auth.sql`) overlap with newer migrations (`supabase-migrations/*.sql`). Both the **declared schemas** and the **effective runtime columns** are listed below.

---

## 2. Custom Enums & View

| Object Name | Type | Values / Definition | Source |
|---|---|---|---|
| `org_role` | `ENUM` | `'member'`, `'admin'`, `'owner'` | `supabase-migrations/2026-06-16_teams_goals_integrations.sql:30` |
| `team_role` | `ENUM` | `'member'`, `'manager'`, `'admin'`, `'owner'` | `supabase-migrations/2026-06-16_teams_goals_integrations.sql:33` |
| `subscription_tier` | `ENUM` | `'free'`, `'pro'`, `'enterprise'` | `supabase-migrations/2026-06-20_premium_subscriptions.sql:11` |
| `subscription_status` | `ENUM` | `'trialing'`, `'active'`, `'past_due'`, `'paused'`, `'canceled'`, `'unpaid'` | `supabase-migrations/2026-06-20_premium_subscriptions.sql:14-16` |
| `cohort_retention_weekly` | `VIEW` | Joins `users` signup cohorts (`DATE_TRUNC('week', created_at)`) with `work_log_entries` for `week_1_retained`..`week_4_retained` | `supabase-migrations/cohort-tracking.sql:102-129` |

---

## 3. Identity, Auth, Compliance & Cohort Tables (7 Tables)

### `users`
Primary user account record (replaces `auth.users` in custom auth).
- **Columns (`supabase-schema.sql:206-219`, `supabase-schema-custom-auth.sql:14-42`, `cohort-tracking.sql:4-7`):**
  - `id` `UUID PK DEFAULT gen_random_uuid()`
  - `email` `TEXT UNIQUE NOT NULL`
  - `password_hash` `TEXT NOT NULL`
  - `name` `TEXT`
  - `company_name` `TEXT`
  - `job_title` `TEXT`
  - `reminder_day` `INTEGER DEFAULT 1` (`CHECK NULL OR BETWEEN 0 AND 6` via `2026-06-18`)
  - `reminder_time` `TEXT` (`supabase-schema.sql`) / `TIME` (`custom-auth.sql`) `DEFAULT '09:00'`
  - `reminder_enabled` `BOOLEAN DEFAULT true`
  - `reminder_last_sent_at` `TIMESTAMPTZ` (`migrations/002`)
  - `email_verified` `BOOLEAN DEFAULT false`, `email_verified_at` `TIMESTAMPTZ`
  - Onboarding columns (`custom-auth.sql:35-42`): `first_name TEXT`, `industry TEXT`, `function TEXT`, `years_experience TEXT`, `company_size TEXT`, `review_frequency TEXT`, `org_goals_alignment BOOLEAN DEFAULT false`, `onboarding_completed BOOLEAN DEFAULT false`
  - Cohort/streak columns (`cohort-tracking.sql:4-7`): `last_logged_date TIMESTAMPTZ`, `total_logs INTEGER DEFAULT 0`, `current_streak INTEGER DEFAULT 0`, `logging_cadence TEXT DEFAULT 'weekly'`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- **Runtime note:** `2026-06-05_i18n_support.sql` adds `preferred_language` to `user_profiles` (see below), while `routes/users.ts` also interacts with `user_profiles` for extra profile metadata.

### `user_profiles`
Legacy Supabase-Auth profile extension (still read/written by `routes/users.ts`, `auth.ts`, `appraisal.ts`, `chat.ts`, `jobs/weeklyDigestJob.ts`).
- **Columns (`supabase-schema.sql:12-22`, `2026-06-05:5-6`):** `id UUID PK`, `email TEXT UNIQUE NOT NULL`, `company_name TEXT`, `job_title TEXT`, `reminder_day INTEGER DEFAULT 1`, `reminder_time TIME DEFAULT '09:00'`, `reminder_enabled BOOLEAN DEFAULT true`, `preferred_language TEXT DEFAULT NULL`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`.
- **Schema gap:** `weeklyDigestJob.ts:46` queries non-existent `user_profiles.user_id`.

### `email_verifications`
Stores hashed single-use email verification tokens (`2026-06-07` hashed `token` → `token_hash`).
- **Columns (`supabase-schema.sql:227-234`, `custom-auth.sql:45-52`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `token_hash TEXT NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `verified BOOLEAN DEFAULT false` (`custom-auth`), `created_at TIMESTAMPTZ DEFAULT NOW()`. `UNIQUE(user_id, token_hash)` or `UNIQUE(token_hash)`.

### `password_reset_tokens` (Used at Runtime)
Stores hashed password-reset tokens queried by `server/src/routes/auth.ts`.
- **Columns (`supabase-schema.sql:239-246`, `2026-06-07:74-103`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `token_hash TEXT NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `created_at TIMESTAMPTZ DEFAULT NOW()`. `UNIQUE(user_id, token_hash)` / `UNIQUE(token_hash)`. RLS deny-all enabled in `2026-06-16:1311`.

### `password_resets` (Unused Alternative Schema)
Declared in `supabase-schema-custom-auth.sql:73-81` (`id`, `user_id`, `token_hash UNIQUE NOT NULL`, `expires_at`, `used BOOLEAN`, `used_at`, `created_at`). **Not queried anywhere in `server/src/`** (which uses `password_reset_tokens`).

### `refresh_tokens`
Stores SHA-256 hashes of rotatable 30-day refresh tokens.
- **Columns (`supabase-schema.sql:251-260`, `2026-06-07:10`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `token_hash TEXT UNIQUE NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `session_ttl_days INT NOT NULL DEFAULT 30`, `revoked BOOLEAN DEFAULT false`, `revoked_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT NOW()`.

### `waitlist`
Captures prospective Corporate Teams signups from landing `PricingSection`.
- **Columns (`supabase-schema-custom-auth.sql:89-94`):** `id UUID PK`, `email TEXT UNIQUE NOT NULL`, `source TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`.

---

## 4. Work Logs & AI Core Tables (8 Tables)

### `work_log_entries`
Core weekly accomplishment diary (one entry per user per week).
- **Columns (`supabase-schema.sql:60-72`, `migrations/003`, `2026-06-16:109-115`, `2026-06-18:38-70`):**
  - `id UUID PK DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `week_start_date DATE NOT NULL`
  - `accomplishments TEXT NOT NULL`, `challenges TEXT`, `learnings TEXT`, `goals_next_week TEXT` (nullable after `migrations/003`)
  - `hours_logged DECIMAL(4,2)` (`CHECK NULL OR (0..99.99)` per `2026-06-18:40`)
  - Integration sync extensions: `status TEXT DEFAULT 'manual'` (`CHECK IN ('manual','auto-generated','auto-generated-verified','auto-generated-edited','auto-generated-rejected')`), `auto_generated_at TIMESTAMPTZ`, `pending_review BOOLEAN DEFAULT false`
  - `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`. `UNIQUE(user_id, week_start_date)`.

### `appraisal_criteria`
Saved prompt inputs (criteria text, company goals, values) linked to generated appraisals.
- **Columns (`supabase-schema.sql:102-111`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `period_start DATE NOT NULL`, `period_end DATE NOT NULL`, `criteria_text TEXT NOT NULL`, `company_goals TEXT`, `values TEXT`, `created_at TIMESTAMPTZ`.

### `generated_appraisals`
Mistral-generated self-appraisal documents.
- **Columns (`supabase-schema.sql:129-138`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `criteria_id UUID REFERENCES appraisal_criteria(id) ON DELETE SET NULL`, `period_start DATE NOT NULL`, `period_end DATE NOT NULL`, `generated_text TEXT NOT NULL`, `word_count INTEGER NOT NULL`, `created_at TIMESTAMPTZ`.

### `monthly_summaries`
Pre-computed Mistral monthly rollups of work logs for fast chat/appraisal retrieval.
- **Columns (`supabase-schema.sql:272-282`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `month_year DATE NOT NULL`, `summary_text TEXT NOT NULL`, `entry_count INTEGER NOT NULL`, `word_count INTEGER NOT NULL`, `source_entry_ids UUID[] NOT NULL`, `generated_at TIMESTAMPTZ`. `UNIQUE(user_id, month_year)`.

### `chat_sessions` & `chat_messages`
Streaming AI Critique Assistant conversations scoped by review date range.
- **`chat_sessions` (`supabase-schema.sql:294-302`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `title TEXT NOT NULL DEFAULT 'New Chat'`, `period_start DATE NOT NULL`, `period_end DATE NOT NULL`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`.
- **`chat_messages` (`supabase-schema.sql:313-319` vs `migrations/001:45-52`):** `id UUID PK`, `session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE`, `[optional user_id UUID REFERENCES users(id) ON DELETE CASCADE in 001]`, `role TEXT CHECK ('user','assistant')`, `content TEXT NOT NULL`, `created_at TIMESTAMPTZ`.

### `feedback`
In-app bug reports and feature ratings.
- **Columns (`supabase-schema.sql:338-346`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `category TEXT CHECK ('bug','feature','improvement','general')`, `rating INTEGER CHECK (1..5)`, `message TEXT NOT NULL`, `page_context TEXT`, `created_at TIMESTAMPTZ`.

### `reminder_logs`
Audit log of sent/failed reminder emails (`reminderJob`).
- **Columns (`supabase-schema.sql:156-163`):** `id UUID PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `sent_at TIMESTAMPTZ`, `email_address TEXT NOT NULL`, `status TEXT CHECK ('sent','failed','bounced')`, `error_message TEXT`.

---

## 5. Organizations, Departments & Teams Tables (6 Tables)

All defined in `supabase-migrations/2026-06-16_teams_goals_integrations.sql:121-189` with deny-all RLS.

| Table | Columns & Constraints |
|---|---|
| `organizations` | `id UUID PK`, `name TEXT NOT NULL CHECK (name <> '')`, `slug TEXT UNIQUE NOT NULL CHECK (slug = LOWER(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`, `created_at`, `updated_at` |
| `org_members` | `id UUID PK`, `org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `role org_role NOT NULL`, `created_at`, `updated_at`, `UNIQUE(org_id, user_id)` |
| `departments` | `id UUID PK`, `org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `name TEXT NOT NULL`, `created_at`, `updated_at`, `UNIQUE(org_id, name)`, `UNIQUE(id, org_id)` |
| `teams` | `id UUID PK`, `org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `department_id UUID REFERENCES departments(id) ON DELETE SET NULL`, `parent_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT`, `name TEXT NOT NULL`, `created_at`, `updated_at`, `UNIQUE(id, org_id)`, `fk_team_parent(parent_team_id, org_id)` |
| `team_members` | `id UUID PK`, `team_id UUID NOT NULL`, `user_id UUID NOT NULL`, `role team_role NOT NULL`, `org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `created_at`, `updated_at`, `UNIQUE(team_id, user_id)`, composite FKs to `teams(id, org_id)` and `org_members(org_id, user_id)` |
| `team_closure` | `ancestor_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `descendant_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE`, `depth INTEGER NOT NULL CHECK (depth >= 0)`, `PRIMARY KEY (ancestor_id, descendant_id)` |

---

## 6. Goals & OKRs Tables (5 Tables)

All defined in `supabase-migrations/2026-06-16_teams_goals_integrations.sql:193-296` (+ `2026-06-18` updates).

| Table | Columns & Key Constraints |
|---|---|
| `goals` | `id UUID PK`, `org_id UUID NOT NULL`, `scope ('organization'\|'department'\|'team'\|'individual')`, `team_id`, `department_id`, `parent_goal_id`, `title`, `description`, `status ('draft'\|'active'\|'at_risk'\|'completed'\|'cancelled')`, `period ('weekly'\|'monthly'\|'quarterly'\|'annual'\|'custom')`, `start_date DATE`, `due_date DATE` (`due_date >= start_date`), `progress NUMERIC(5,2)` (`0..100`), `progress_mode ('manual'\|'key_results'\|'linked_items')`, `rollup_weight NUMERIC >= 0`, `created_by`, `created_at`, `updated_at`, `UNIQUE(id, org_id)`, `chk_goal_scope_columns` |
| `goal_assignees` | `goal_id`, `user_id`, `assigned_by`, `assigned_at`, `org_id`, `updated_at` (`2026-06-18`), `PK(goal_id, user_id)`, composite FKs `(goal_id, org_id)` & `(org_id, user_id)` |
| `goal_key_results` | `id UUID PK`, `goal_id`, `title`, `metric_type ('number'\|'percentage'\|'currency'\|'boolean'\|'ratio')`, `start_value`, `target_value`, `current_value`, `unit`, `weight >= 0`, `sort_order`, `created_at`, `updated_at`, boolean/monotonic/percentage CHECKs |
| `goal_links` | `id UUID PK`, `goal_id`, `provider ('jira'\|'github')`, `link_type`, `external_id`, `external_key`, `external_url`, `title`, `state ('open'\|'in_progress'\|'closed'\|'done'\|'blocked'\|'review'\|'todo'\|'merged')`, `is_done BOOLEAN`, `weight > 0`, `created_by`, `org_id`, `metadata JSONB DEFAULT '{}'`, `UNIQUE(goal_id, provider, external_id)` |
| `goal_updates` | `id UUID PK`, `goal_id`, `user_id` (nullable `ON DELETE SET NULL`), `progress`, `status ('on_track'\|'at_risk'\|'off_track'\|'done'\|'cancelled'\|'active'\|'draft')`, `note` (`<=10000` chars), `org_id`, `created_at`, `updated_at` |

---

## 7. Integrations, OAuth, Slack & Locks Tables (11 Tables)

| Table | Key Columns | Purpose & Source |
|---|---|---|
| `user_integrations` | `id`, `user_id`, `provider`, `access_token`, `refresh_token`, `token_expires_at`, `scopes TEXT[]`, `is_active`, `config JSONB`, `last_sync_at`, `is_refreshing`, `refresh_started_at`, `UNIQUE(user_id, provider)` | Per-user encrypted GitHub/Jira OAuth tokens (`2026-06-16:43-59`). |
| `org_integrations` | `id`, `org_id`, `provider ('slack'\|'github_app'\|'jira')`, `external_install_id`, `bot_token_enc`, `access_token_enc`, `refresh_token_enc`, `expires_at`, `webhook_secret_enc`, `config JSONB`, `installed_by`, `is_active`, `is_refreshing`, `refresh_started_at`, `UNIQUE(org_id, provider)`, `UNIQUE(provider, external_install_id)` | Workspace-level integration installs & encrypted secrets (`2026-06-16:302-323`). |
| `integration_preferences` | `id`, `user_id UNIQUE`, `slack_channels`, `github_repos`, `gitlab_projects`, `sync_enabled`, `sync_frequency`, `last_sync_week_date`, `sync_timezone`, `last_weekly_sync_week`, `is_syncing`, `sync_started_at`, `created_at`, `updated_at` | Sync schedule & mutex columns (`2026-06-16:65-79`, `2026-06-18:204-215`). |
| `integration_channel_preferences` | `id`, `org_id`, `user_id`, `team_id`, `provider ('slack'\|'github'\|'jira')`, `channel_type ('notification'\|'sync')`, `channel_config JSONB`, `is_active`, `set_by` | Partial unique index on `(org_id, COALESCE(user_id,0..0), COALESCE(team_id,0..0), provider, channel_type)` (`2026-06-20:77-99`). |
| `log_source_references` | `id`, `work_log_entry_id`, `provider`, `source_type ('commit'\|'pr'\|'review'\|'message'\|'thread')`, `source_id`, `source_url`, `source_data JSONB`, `UNIQUE(source_id, provider)` | Links auto-generated work log entries back to PRs/issues (`2026-06-16:81-91`). |
| `integration_sync_logs` | `id`, `user_id`, `provider`, `sync_type`, `status`, `items_fetched`, `items_processed`, `items_skipped`, `error_message`, `started_at`, `completed_at`, `synthesize_duration_ms` | Sync job telemetry & digest run log (`2026-06-16:93-106`). |
| `integration_events` | `id`, `provider ('slack'\|'github_app'\|'jira')`, `external_event_id`, `event_type`, `payload JSONB (<=64KB)`, `status ('received'\|'processing'\|'done'\|'error')`, `error`, `received_at`, `processed_at`, `updated_at`, `UNIQUE(provider, external_event_id)` | Webhook deduplication & idempotency ledger (`2026-06-16:372-384`). |
| `slack_user_links` | `id`, `user_id`, `slack_user_id`, `slack_team_id`, `UNIQUE(slack_team_id, slack_user_id)`, `UNIQUE(user_id, slack_team_id)` | Maps Slack accounts to Impactly users (`2026-06-16:329-337`). |
| `slack_command_sessions` | `slack_team_id`, `slack_user_id`, `index_number`, `goal_id`, `org_id`, `expires_at`, `PK(slack_team_id, slack_user_id, index_number)` | Ephemeral 1..N index mapping for Slack `/goals` replies (`2026-06-16:339-349`). |
| `temp_oauth_states` | `key UUID PK`, `data JSONB NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL` | Single-use OAuth state storage (`2026-06-16:355-359`). |
| `temp_slack_codes` | `id UUID PK`, `slack_team_id`, `slack_user_id`, `code VARCHAR(6) UNIQUE`, `expires_at`, `created_at` | 6-digit PIN store for Slack account linking (`2026-06-16:361-370`). *(Note: `routes/integrations.ts:822` attempts to insert an undeclared `email` column.)* |

---

## 8. Platform, AI Pulse, Billing, Marketing & Push Tables (10 Tables)

| Table | Key Columns | Source |
|---|---|---|
| `ai_articles` | `id`, `title`, `slug UNIQUE`, `summary`, `content`, `source_url`, `source_name`, `category` (9 options — note UI has `'ai_news'` filter button not in CHECK), `published_at`, `impact_summary`, `cta_text`, `cta_link`, `thumbnail_url`, `views_count`, `bookmark_count`, `share_count` | `supabase-schema.sql:362-381`, `supabase-migration-ai-pulse.sql:7-26` |
| `ai_impact_cards` | `id`, `slug UNIQUE`, `industry UNIQUE` (10 options), `industry_display_name`, `what_changed`, `impact_level ('high'\|'medium'\|'low')`, arrays `companies_involved`, `opportunities`, `risks`, `tools`, `future_prediction` | `supabase-schema.sql:397-411`, `supabase-migration-ai-pulse.sql:43-57` |
| `user_bookmarks` | `id`, `user_id`, `article_id`, `impact_card_id`, `bookmark_target_check` XOR constraint | `supabase-schema.sql:425-437`, `supabase-migration-ai-pulse.sql:72-84` |
| `translation_cache` | Two conflicting schemas: `(language_code, version)` PK with `source` (`supabase-schema.sql:517-524`) vs `id`, `language_code`, `namespace`, `version` (`2026-06-05:8-17`) | `supabase-schema.sql:517-524`, `2026-06-05_i18n_support.sql:8-17` |
| `marketing_logs` | `id`, `loop_name TEXT NOT NULL`, `user_id UUID`, `action TEXT NOT NULL`, `detail JSONB DEFAULT '{}'`, `created_at` | `supabase-schema.sql:482-489` |
| `global_locks` | `job_name TEXT PK`, `locked_by UUID NOT NULL`, `locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `supabase-migrations/2026-06-16_teams_goals_integrations.sql:390-394` |
| `subscriptions` | `id`, `org_id UNIQUE`, `tier subscription_tier DEFAULT 'free'`, `status subscription_status DEFAULT 'active'`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `max_members`, `ai_reports_enabled` | `supabase-migrations/2026-06-20_premium_subscriptions.sql:21-34` |
| `performance_reports` | `id`, `org_id`, `report_type ('self'\|'individual'\|'team'\|'organization')`, `target_user_id`, `target_team_id`, `period_start`, `period_end`, `generated_by`, `report_content JSONB`, `report_markdown`, `ai_model`, `token_usage`, `generation_time_ms`, `status`, `error_message`, `UNIQUE(org_id, id)` | `supabase-migrations/2026-06-20_premium_subscriptions.sql:37-60` |
| `activity_summaries` | `id`, `org_id`, `user_id`, `period_start`, `period_end`, `provider ('jira'\|'github'\|'slack'\|'manual')`, `summary_data JSONB`, `UNIQUE(org_id, user_id, period_start, period_end, provider)` | `supabase-migrations/2026-06-20_premium_subscriptions.sql:63-74` |
| `push_subscriptions` | `id`, `user_id REFERENCES users(id) ON DELETE CASCADE`, `endpoint TEXT NOT NULL`, `p256dh TEXT NOT NULL`, `auth TEXT NOT NULL`, `user_agent TEXT`, `created_at`, `UNIQUE(user_id, endpoint)` | `supabase-migrations/push-subscriptions.sql:3-12` |

---

## Related Documents

- [Database Architecture](../02-architecture/database-architecture.md)
- [Table Relationships & ERD](./relationships.md)
- [Queries, Locks & Triggers](./queries-and-operations.md)
- [Migrations & Schema Drift](./migrations.md)

## Verification Notes

- Verified every table, column, type, default, and constraint directly from all 15 SQL files (`tables.json` and direct `view_file` inspections).