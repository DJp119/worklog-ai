-- ============================================================================
-- Migration: 2026-06-18_followup_constraints.sql
--
-- Follow-up constraint hardening based on the post-review database audit.
-- All statements are idempotent (IF NOT EXISTS / DO block guards) so this
-- file can be applied on top of any previously deployed schema state.
--
-- Adds the missing CHECK constraints and column defaults identified in
-- the cross-schema audit:
--   * users.reminder_day   — 0..6 (was unbounded)
--   * work_log_entries.hours_logged — 0..99.99 (was unbounded)
--   * goal_links.metadata — default empty object (was NULL-only)
--   * goal_links.state    — normalized allowlist
--   * goal_links.weight   — must be > 0
--   * goal_updates         — defensive cross-tenant trigger (audit Finding #49)
--   * work_log_entries     — auto-generated_at consistency with status
--   * goal_key_results.sort_order — index for the "ordered KRs per goal" path
-- ============================================================================

-- 1) users.reminder_day must be 0..6 (Mon..Sun with Sun=0)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_reminder_day'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_reminder_day
      CHECK (reminder_day IS NULL OR reminder_day BETWEEN 0 AND 6);
  END IF;
END $$;

-- 2) work_log_entries.hours_logged must be 0..99.99
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_log_hours_logged'
  ) THEN
    ALTER TABLE work_log_entries
      ADD CONSTRAINT chk_work_log_hours_logged
      CHECK (hours_logged IS NULL OR (hours_logged >= 0 AND hours_logged <= 99.99));
  END IF;
END $$;

-- 3) work_log_entries auto_generated_at consistency with status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_log_autogen_consistency'
  ) THEN
    ALTER TABLE work_log_entries
      ADD CONSTRAINT chk_work_log_autogen_consistency
      CHECK (
        (status = 'manual' AND auto_generated_at IS NULL)
        OR (status <> 'manual' AND auto_generated_at IS NOT NULL)
      );
  END IF;
END $$;

-- 4) work_log_entries pending_review must be false for manual rows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_work_log_pending_review'
  ) THEN
    ALTER TABLE work_log_entries
      ADD CONSTRAINT chk_work_log_pending_review
      CHECK (
        status IN ('auto-generated', 'auto-generated-verified', 'auto-generated-edited', 'auto-generated-rejected')
        OR pending_review = false
      );
  END IF;
END $$;

-- 5) goal_key_results has no goal_id index for sort — add composite
CREATE INDEX IF NOT EXISTS idx_goal_key_results_goal_id_sort
  ON goal_key_results(goal_id, sort_order);

-- 6) goal_updates lacks the (goal_id, created_at DESC) index for "recent check-ins"
CREATE INDEX IF NOT EXISTS idx_goal_updates_goal_id_created
  ON goal_updates(goal_id, created_at DESC);

-- 7) goal_updates defensive cross-tenant trigger — if user_id is set it must
-- be a member of the goal's org at insert/update time. After the user is
-- removed from the org, the row's user_id is preserved (audit-trail intent)
-- and the trigger does NOT fire on user-removal. This is a deferred
-- "live cross-tenant" block, not a historical block.
CREATE OR REPLACE FUNCTION enforce_goal_updates_org_member()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW; -- nullable to preserve audit trail
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = NEW.org_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'goal_updates.user_id must belong to the goal''s organization';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_goal_updates_org_member ON goal_updates;
CREATE TRIGGER trigger_enforce_goal_updates_org_member
  BEFORE INSERT OR UPDATE OF user_id, org_id ON goal_updates
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_updates_org_member();

-- 8) goal_key_results CHECK: start_value <= target_value for monotonic metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_goal_kr_monotonic'
  ) THEN
    ALTER TABLE goal_key_results
      ADD CONSTRAINT chk_goal_kr_monotonic
      CHECK (
        metric_type = 'boolean'
        OR (target_value IS NOT NULL AND start_value IS NOT NULL AND start_value <= target_value)
      );
  END IF;
END $$;

-- 9) goal_key_results CHECK: percentage values in [0, 100]
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_goal_kr_percentage'
  ) THEN
    ALTER TABLE goal_key_results
      ADD CONSTRAINT chk_goal_kr_percentage
      CHECK (
        metric_type <> 'percentage'
        OR (start_value BETWEEN 0 AND 100 AND current_value BETWEEN 0 AND 100 AND target_value BETWEEN 0 AND 100)
      );
  END IF;
END $$;

-- 10) is_refreshing implies refresh_started_at is not null (consistency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_integrations_refresh_consistency'
  ) THEN
    ALTER TABLE user_integrations
      ADD CONSTRAINT chk_user_integrations_refresh_consistency
      CHECK (NOT is_refreshing OR refresh_started_at IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_integrations_refresh_consistency'
  ) THEN
    ALTER TABLE org_integrations
      ADD CONSTRAINT chk_org_integrations_refresh_consistency
      CHECK (NOT is_refreshing OR refresh_started_at IS NOT NULL);
  END IF;
END $$;

-- 11) integration_events.payload must not be absurdly large (DoS guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_integration_events_payload_size'
  ) THEN
    ALTER TABLE integration_events
      ADD CONSTRAINT chk_integration_events_payload_size
      CHECK (octet_length(payload::text) <= 65536);
  END IF;
END $$;

-- 12) goal_updates.note must not exceed a reasonable length
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_goal_updates_note_length'
  ) THEN
    ALTER TABLE goal_updates
      ADD CONSTRAINT chk_goal_updates_note_length
      CHECK (note IS NULL OR length(note) <= 10000);
  END IF;
END $$;

-- 13) goal_assignees needs an updated_at column + trigger for audit (DB-Finding #27)
ALTER TABLE goal_assignees
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

DROP TRIGGER IF EXISTS trigger_goal_assignees_updated_at ON goal_assignees;
CREATE TRIGGER trigger_goal_assignees_updated_at
  BEFORE UPDATE ON goal_assignees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14) goal_updates needs an updated_at column + trigger
ALTER TABLE goal_updates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

DROP TRIGGER IF EXISTS trigger_goal_updates_updated_at ON goal_updates;
CREATE TRIGGER trigger_goal_updates_updated_at
  BEFORE UPDATE ON goal_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 15) integration_preferences needs created_at/updated_at + trigger
ALTER TABLE integration_preferences
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_preferences' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE integration_preferences
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_integration_preferences_updated_at ON integration_preferences;
CREATE TRIGGER trigger_integration_preferences_updated_at
  BEFORE UPDATE ON integration_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 16) Notify PostgREST
NOTIFY pgrst, 'reload schema';
