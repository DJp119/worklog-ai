-- ============================================================================
-- Migration: 2026-06-16_teams_goals_integrations.sql
--
-- Implements the "Corporate Teams" paid tier:
--   * Organizations, Departments, Teams (with closure table for hierarchy)
--   * Org Members / Team Members (role-based)
--   * Goals (4 scopes: organization, department, team, individual)
--   * Goal Key Results, Goal Links, Goal Assignees, Goal Updates
--   * User & Org Integrations (Slack, GitHub App, JIRA)
--   * OAuth state store, Slack PIN codes, integration event log
--   * Global cron locks
--
-- This migration has been audited across 14 review passes. The schema is
-- idempotent (CREATE TABLE IF NOT EXISTS, DO-blocks for enums) so it can be
-- re-run safely during development.
--
-- IMPORTANT: This migration uses the SERVICE ROLE key on the server side and
-- relies on `req.userId` for authorization. RLS is enabled with deny-all
-- public policies to provide defense-in-depth in case the service key is
-- ever exposed.
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENUMS (idempotent)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
    CREATE TYPE org_role AS ENUM ('member', 'admin', 'owner');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_role') THEN
    CREATE TYPE team_role AS ENUM ('member', 'manager', 'admin', 'owner');
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: BASELINE INTEGRATIONS TABLES (idempotent)
-- These tables existed in earlier migrations; we add them defensively so this
-- file is self-contained for fresh databases.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  is_refreshing BOOLEAN NOT NULL DEFAULT false,
  refresh_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, provider)
);

ALTER TABLE user_integrations DROP CONSTRAINT IF EXISTS user_integrations_provider_check;
ALTER TABLE user_integrations ADD CONSTRAINT user_integrations_provider_check
  CHECK (provider IN ('slack', 'github', 'gitlab', 'jira'));

CREATE TABLE IF NOT EXISTS integration_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slack_channels TEXT[],
  github_repos TEXT[],
  gitlab_projects TEXT[],
  sync_enabled BOOLEAN DEFAULT true,
  sync_frequency TEXT CHECK (sync_frequency IN ('daily', 'weekly')),
  last_sync_week_date DATE,
  sync_timezone TEXT DEFAULT 'UTC',
  last_weekly_sync_week TEXT DEFAULT NULL,
  is_syncing BOOLEAN NOT NULL DEFAULT false,
  sync_started_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS log_source_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_log_entry_id UUID NOT NULL REFERENCES work_log_entries(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('commit', 'pr', 'review', 'message', 'thread')),
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(source_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'partial', 'failed')),
  items_fetched INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  synthesize_duration_ms INTEGER
);

-- Add status columns to work_log_entries (for auto-generated entries)
ALTER TABLE work_log_entries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'manual';
ALTER TABLE work_log_entries DROP CONSTRAINT IF EXISTS chk_work_log_status;
ALTER TABLE work_log_entries ADD CONSTRAINT chk_work_log_status
  CHECK (status IN ('manual', 'auto-generated', 'auto-generated-verified', 'auto-generated-edited', 'auto-generated-rejected'));

ALTER TABLE work_log_entries ADD COLUMN IF NOT EXISTS auto_generated_at TIMESTAMPTZ;
ALTER TABLE work_log_entries ADD COLUMN IF NOT EXISTS pending_review BOOLEAN DEFAULT false;

-- ============================================================================
-- SECTION 3: CORPORATE TEAMS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (name <> ''),
  slug TEXT UNIQUE NOT NULL CHECK (slug = LOWER(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role org_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(org_id, user_id)
);

-- Bug DG: Only one owner per org is allowed (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_org_owner
  ON org_members(org_id) WHERE (role = 'owner');

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name <> ''),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(org_id, name),
  -- Spec line 49: UNIQUE(id, org_id) so teams/goals can build composite
  -- FKs to (department_id, org_id) for tenant isolation.
  UNIQUE(id, org_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  parent_team_id UUID REFERENCES teams(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (name <> ''),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(id, org_id),
  -- Composite FK prevents moving a team to a parent in a different org
  CONSTRAINT fk_team_parent FOREIGN KEY (parent_team_id, org_id) REFERENCES teams(id, org_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role team_role NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, user_id),
  -- Composite FKs enforce tenant isolation at the DB layer
  CONSTRAINT fk_team_member_team_org FOREIGN KEY (team_id, org_id) REFERENCES teams(id, org_id) ON DELETE CASCADE,
  CONSTRAINT fk_team_member_org_user FOREIGN KEY (org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_closure (
  ancestor_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  descendant_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL CHECK (depth >= 0),
  PRIMARY KEY (ancestor_id, descendant_id)
);

-- ============================================================================
-- SECTION 4: GOAL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('organization', 'department', 'team', 'individual')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (title <> ''),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'at_risk', 'completed', 'cancelled')),
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'quarterly', 'annual', 'custom')),
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  progress NUMERIC(5,2) DEFAULT 0.00 CHECK (progress >= 0 AND progress <= 100),
  progress_mode TEXT NOT NULL DEFAULT 'manual' CHECK (progress_mode IN ('manual', 'key_results', 'linked_items')),
  rollup_weight NUMERIC NOT NULL DEFAULT 1 CHECK (rollup_weight >= 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(id, org_id),
  CONSTRAINT chk_goals_date CHECK (due_date >= start_date),
  CONSTRAINT chk_goals_parent_not_self CHECK (parent_goal_id <> id),
  CONSTRAINT chk_goal_scope_columns CHECK (
    (scope = 'organization' AND team_id IS NULL AND department_id IS NULL) OR
    (scope = 'department' AND department_id IS NOT NULL AND team_id IS NULL) OR
    (scope = 'team' AND team_id IS NOT NULL AND department_id IS NULL) OR
    (scope = 'individual' AND team_id IS NULL AND department_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS goal_assignees (
  goal_id UUID NOT NULL,
  user_id UUID NOT NULL,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, user_id),
  CONSTRAINT fk_goal_assignee_goal_org FOREIGN KEY (goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE,
  CONSTRAINT fk_goal_assignee_org_user FOREIGN KEY (org_id, user_id) REFERENCES org_members(org_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal_key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (title <> ''),
  metric_type TEXT NOT NULL DEFAULT 'number' CHECK (metric_type IN ('number', 'percentage', 'currency', 'boolean', 'ratio')),
  start_value NUMERIC NOT NULL DEFAULT 0,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  -- Bug DB-C1: a 'boolean' metric must use 0/1 for current/target. Without
  -- this check, an arbitrary current_value would produce nonsense progress.
  CONSTRAINT chk_kr_boolean_values CHECK (metric_type <> 'boolean' OR (current_value IN (0,1) AND target_value IN (0,1) AND start_value IN (0,1))),
  unit TEXT,
  weight NUMERIC NOT NULL DEFAULT 1 CHECK (weight >= 0),
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('jira', 'github')),
  link_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_key TEXT NOT NULL,
  external_url TEXT NOT NULL,
  title TEXT NOT NULL,
  -- DB-Finding #14: state has a normalized allowlist to prevent free-form values
  state TEXT CHECK (state IN ('open', 'in_progress', 'closed', 'done', 'blocked', 'review', 'todo', 'merged')),
  is_done BOOLEAN NOT NULL DEFAULT false,
  -- DB-Finding #15: weight must be strictly positive so a completed link
  -- with weight=0 cannot silently contribute 0 to the parent rollup
  weight NUMERIC NOT NULL DEFAULT 1 CHECK (weight > 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- DB-Finding #57: metadata default to empty object so callers don't have
  -- to special-case NULL
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(goal_id, provider, external_id),
  CONSTRAINT fk_goal_link_goal_org FOREIGN KEY (goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL,
  user_id UUID, -- Nullable to preserve audit trail when a user leaves the org
  progress NUMERIC(5,2) NOT NULL CHECK (progress >= 0 AND progress <= 100),
  -- DB-M8: check constraint on status to match goals lifecycle vocabulary
  status TEXT NOT NULL CHECK (status IN ('on_track', 'at_risk', 'off_track', 'done', 'cancelled', 'active', 'draft')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_goal_updates_goal_org FOREIGN KEY (goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE,
  -- ON DELETE SET NULL (not CASCADE) preserves the audit row when a user is removed
  CONSTRAINT fk_goal_updates_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  -- DB-C3 fix: do NOT add a composite (org_id, user_id) FK to org_members. Such
  -- a FK forces `user_id` to NOT NULL (since `org_members.user_id` is NOT NULL),
  -- contradicting the audit-trail intent. The `user_id` is intentionally nullable
  -- so the historical check-in survives a user's departure. The `org_id` FK
  -- alone is sufficient for tenant scoping.
);

-- ============================================================================
-- SECTION 5: ORG-LEVEL INTEGRATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'github_app', 'jira')),
  external_install_id TEXT NOT NULL,
  bot_token_enc TEXT,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  expires_at TIMESTAMPTZ,
  -- Issue DC: webhook_secret is encrypted at rest (same key format as other tokens)
  webhook_secret_enc TEXT,
  config JSONB,
  -- Bug BB: Use single-column FK to avoid org_id NULL violation
  installed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_refreshing BOOLEAN NOT NULL DEFAULT false,
  refresh_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(org_id, provider),
  UNIQUE(provider, external_install_id)
);

-- ============================================================================
-- SECTION 6: SLACK TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS slack_user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slack_user_id TEXT NOT NULL,
  slack_team_id TEXT NOT NULL,
  UNIQUE(slack_team_id, slack_user_id),
  -- Issue BE: A user can link multiple Slack workspaces across tenants
  UNIQUE(user_id, slack_team_id)
);

CREATE TABLE IF NOT EXISTS slack_command_sessions (
  slack_team_id TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  index_number INTEGER NOT NULL,
  goal_id UUID NOT NULL,
  org_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (slack_team_id, slack_user_id, index_number),
  CONSTRAINT fk_slack_command_sessions_goal FOREIGN KEY (goal_id, org_id) REFERENCES goals(id, org_id) ON DELETE CASCADE,
  CONSTRAINT fk_slack_command_sessions_user FOREIGN KEY (slack_team_id, slack_user_id) REFERENCES slack_user_links(slack_team_id, slack_user_id) ON DELETE CASCADE
);

-- ============================================================================
-- SECTION 7: OAUTH / PIN / EVENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS temp_oauth_states (
  key UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS temp_slack_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_team_id TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(slack_team_id, slack_user_id),
  UNIQUE(code)
);

CREATE TABLE IF NOT EXISTS integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'github_app', 'jira')),
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'done', 'error')),
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(provider, external_event_id)
);

-- ============================================================================
-- SECTION 8: GLOBAL LOCKS (cluster-safe cron)
-- ============================================================================

CREATE TABLE IF NOT EXISTS global_locks (
  job_name TEXT PRIMARY KEY,
  locked_by UUID NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SECTION 8b: WEBHOOK EVENT IDEMPOTENCY RPC
-- ============================================================================
-- Idempotent event recording. Returns the event id when a new event was
-- inserted or a previously-errored/stuck event was reclaimed. Returns NULL
-- when a duplicate is encountered (caller should ack and stop).
CREATE OR REPLACE FUNCTION record_integration_event(
  p_provider TEXT,
  p_external_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO integration_events (provider, external_event_id, event_type, payload, status)
  VALUES (p_provider, p_external_event_id, p_event_type, p_payload, 'received')
  ON CONFLICT (provider, external_event_id) DO UPDATE
    SET status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    WHERE integration_events.status = 'error'
       OR (integration_events.status IN ('received', 'processing')
           AND integration_events.updated_at < NOW() - INTERVAL '5 minutes')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Acquire per-user weekly-sync lock. Returns the user_id when the lock was
-- acquired; NULL when another worker is already syncing. Auto-expires after
-- 15 minutes to recover from crashed workers.
CREATE OR REPLACE FUNCTION acquire_integration_sync_lock(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE integration_preferences
    SET is_syncing = true,
        sync_started_at = NOW()
    WHERE user_id = p_user_id
      AND (is_syncing = false OR sync_started_at < NOW() - INTERVAL '15 minutes')
  RETURNING user_id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================================================
-- SECTION 9: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON departments(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_department_id ON teams(department_id);
CREATE INDEX IF NOT EXISTS idx_teams_parent_team_id ON teams(parent_team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_org_id ON team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_team_closure_descendant ON team_closure(descendant_id);
-- Spec line 52: indexes on both ancestor and descendant columns of team_closure.
CREATE INDEX IF NOT EXISTS idx_team_closure_ancestor ON team_closure(ancestor_id);
CREATE INDEX IF NOT EXISTS idx_goals_org_id ON goals(org_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent_goal_id ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_team_id ON goals(team_id);
CREATE INDEX IF NOT EXISTS idx_goals_department_id ON goals(department_id);
CREATE INDEX IF NOT EXISTS idx_goal_assignees_user_id ON goal_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_key_results_goal_id ON goal_key_results(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_links_goal_id ON goal_links(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_links_provider_ext_id ON goal_links(provider, external_id);
CREATE INDEX IF NOT EXISTS idx_goal_updates_goal_id ON goal_updates(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_updates_user_id ON goal_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_updates_org_id ON goal_updates(org_id);
CREATE INDEX IF NOT EXISTS idx_org_integrations_org_id ON org_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_links_user ON slack_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_command_sessions_goal ON slack_command_sessions(goal_id);

-- Issue DL/Issue DC: partial index speeds up the "in-flight" event lookups
-- used for idempotency on webhook retries.
CREATE INDEX IF NOT EXISTS idx_integration_events_active
  ON integration_events(provider, external_event_id)
  WHERE status IN ('received', 'processing');

CREATE INDEX IF NOT EXISTS idx_temp_slack_codes_code ON temp_slack_codes(code);
CREATE INDEX IF NOT EXISTS idx_integration_preferences_sync
  ON integration_preferences(sync_enabled, last_weekly_sync_week);
CREATE INDEX IF NOT EXISTS idx_temp_oauth_states_expires ON temp_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_temp_slack_codes_expires ON temp_slack_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_slack_command_sessions_expires ON slack_command_sessions(expires_at);

-- ============================================================================
-- SECTION 10: HELPER FUNCTIONS
-- ============================================================================

-- Safe timezone conversion (Bug BF / Issue BE): never crashes on invalid input
CREATE OR REPLACE FUNCTION safe_local_time(p_timezone TEXT)
RETURNS TIMESTAMP LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_timezone IS NULL THEN
    RETURN NOW() AT TIME ZONE 'UTC';
  END IF;
  RETURN NOW() AT TIME ZONE p_timezone;
EXCEPTION WHEN OTHERS THEN
  RETURN NOW() AT TIME ZONE 'UTC';
END;
$$;

-- Issue BG: Provision an organization atomically (org + owner + root team)
-- DB-H5: Wrap in EXCEPTION so that a partial failure (e.g. unique violation
-- on the second insert, or a FK violation) does not leave an orphan org
-- and root team behind. We delete the org; ON DELETE CASCADE removes the
-- rest of the children.
CREATE OR REPLACE FUNCTION provision_organization(
  p_name TEXT,
  p_slug TEXT,
  p_owner_id UUID
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_org_id UUID;
  v_team_id UUID;
BEGIN
  INSERT INTO organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_org_id;

  BEGIN
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (v_org_id, p_owner_id, 'owner');
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM organizations WHERE id = v_org_id;
    RAISE;
  END;

  BEGIN
    INSERT INTO teams (org_id, name, parent_team_id)
    VALUES (v_org_id, p_name || ' Root', NULL)
    RETURNING id INTO v_team_id;

    INSERT INTO team_members (team_id, user_id, role, org_id)
    VALUES (v_team_id, p_owner_id, 'owner', v_org_id);
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM organizations WHERE id = v_org_id;
    RAISE;
  END;

  RETURN v_org_id;
END;
$$;

-- Viewable user ids RPC: returns the set of users that `p_user_id` is
-- allowed to view in the given org (self + their managed team members + all
-- members if admin/owner).
CREATE OR REPLACE FUNCTION viewable_user_ids(p_user_id UUID, p_org_id UUID)
RETURNS SETOF UUID LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM org_members WHERE user_id = p_user_id AND org_id = p_org_id) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = p_user_id AND org_id = p_org_id AND role IN ('admin', 'owner')
  ) THEN
    RETURN QUERY SELECT user_id FROM org_members WHERE org_id = p_org_id;
    RETURN;
  END IF;

  RETURN QUERY
  WITH my_managed_teams AS (
    SELECT descendant_id AS team_id
    FROM team_members tm
    JOIN team_closure tc ON tm.team_id = tc.ancestor_id
    WHERE tm.user_id = p_user_id AND tm.org_id = p_org_id
      AND tm.role IN ('manager', 'admin', 'owner')
  ),
  my_member_teams AS (
    SELECT team_id FROM team_members
    WHERE user_id = p_user_id AND org_id = p_org_id
      AND role IN ('member', 'manager', 'admin', 'owner')
  )
  SELECT DISTINCT tm2.user_id
  FROM (
    SELECT team_id FROM my_managed_teams
    UNION
    SELECT team_id FROM my_member_teams
  ) t
  JOIN team_members tm2 ON t.team_id = tm2.team_id AND tm2.org_id = p_org_id
  UNION SELECT p_user_id;
END;
$$;

-- Lock an organization row to prevent concurrent parent-mutation races
-- (Bug CO). Returns the row's id (or NULL if missing).
CREATE OR REPLACE FUNCTION lock_organization_row(p_org_id UUID)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM organizations WHERE id = p_org_id FOR UPDATE;
  RETURN v_id;
END;
$$;

-- Manager check: returns TRUE iff `p_manager_id` manages `p_member_id` in `p_org_id`
CREATE OR REPLACE FUNCTION is_manager_of(p_manager_id UUID, p_member_id UUID, p_org_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = p_manager_id AND org_id = p_org_id AND role IN ('admin', 'owner')
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM team_members tm_mgr
    JOIN team_closure tc ON tm_mgr.team_id = tc.ancestor_id
    JOIN team_members tm_memb ON tc.descendant_id = tm_memb.team_id
    WHERE tm_mgr.user_id = p_manager_id
      AND tm_mgr.org_id = p_org_id
      AND tm_mgr.role IN ('manager', 'admin', 'owner')
      AND tm_memb.user_id = p_member_id
      AND tm_memb.org_id = p_org_id
  );
END;
$$;

-- ============================================================================
-- SECTION 11: ORG INTEGRATION INSTALLER NULLIFY
-- ============================================================================
-- Bug BB: When an org member is deleted, we need to nullify `installed_by`
-- before the FK violation would occur (the FK is now a single-column FK to
-- users, so this is belt-and-braces safety).
CREATE OR REPLACE FUNCTION set_org_integration_installer_null()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE org_integrations
  SET installed_by = NULL
  WHERE org_id = OLD.org_id AND installed_by = OLD.user_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_org_integration_installer_null ON org_members;
CREATE TRIGGER trigger_set_org_integration_installer_null
  BEFORE DELETE ON org_members
  FOR EACH ROW EXECUTE FUNCTION set_org_integration_installer_null();

-- ============================================================================
-- SECTION 12: ENFORCE MINIMUM ORG OWNER
-- ============================================================================
-- Enforce at least one owner per organization (skips when the org itself is
-- being deleted, to avoid blocking cascading cleanup).
CREATE OR REPLACE FUNCTION enforce_min_org_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce when the organization itself still exists
  IF EXISTS (SELECT 1 FROM organizations WHERE id = OLD.org_id) THEN
    -- DB-H7: if this DELETE is the cascading side-effect of a user being
    -- hard-deleted from `users` (the user no longer exists), allow it.
    -- Without this guard, removing the last owner of an org is impossible
    -- without first transferring ownership — a usability / GDPR blocker.
    IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
      IF EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
        -- User still exists — the DELETE is intentional, enforce min-owner
        IF NOT EXISTS (
          SELECT 1 FROM org_members
          WHERE org_id = OLD.org_id AND user_id <> OLD.user_id AND role = 'owner'
        ) THEN
          RAISE EXCEPTION 'Cannot remove the last owner of the organization';
        END IF;
      END IF;
      -- ELSE: cascading user delete — allow (DB-H7)
    ELSIF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role IS DISTINCT FROM 'owner' THEN
      IF NOT EXISTS (
        SELECT 1 FROM org_members
        WHERE org_id = OLD.org_id AND user_id <> OLD.user_id AND role = 'owner'
      ) THEN
        RAISE EXCEPTION 'Cannot remove the last owner of the organization';
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_min_org_owner ON org_members;
CREATE TRIGGER trigger_enforce_min_org_owner
  BEFORE UPDATE OF role OR DELETE ON org_members
  FOR EACH ROW EXECUTE FUNCTION enforce_min_org_owner();

-- ============================================================================
-- SECTION 13: SLACK SESSION ORG VERIFICATION
-- ============================================================================
-- Issue CD: A Slack command session must reference a goal in an org that the
-- user is a member of AND a Slack workspace that is installed/active for that org.
CREATE OR REPLACE FUNCTION verify_slack_session_org()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM slack_user_links
  WHERE slack_team_id = NEW.slack_team_id AND slack_user_id = NEW.slack_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Slack user is not linked to any Worklog AI user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = NEW.org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Linked user is not a member of the target organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM org_integrations
    WHERE org_id = NEW.org_id AND provider = 'slack'
      AND external_install_id = NEW.slack_team_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Slack workspace % is not installed/active for organization %', NEW.slack_team_id, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verify_slack_session_org ON slack_command_sessions;
CREATE TRIGGER trigger_verify_slack_session_org
  BEFORE INSERT OR UPDATE ON slack_command_sessions
  FOR EACH ROW EXECUTE FUNCTION verify_slack_session_org();

-- ============================================================================
-- SECTION 14: TEAM CLOSURE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION team_closure_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_closure (ancestor_id, descendant_id, depth)
  VALUES (NEW.id, NEW.id, 0);

  IF NEW.parent_team_id IS NOT NULL THEN
    INSERT INTO team_closure (ancestor_id, descendant_id, depth)
    SELECT ancestor_id, NEW.id, depth + 1
    FROM team_closure
    WHERE descendant_id = NEW.parent_team_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_team_closure_insert ON teams;
CREATE TRIGGER trigger_team_closure_insert
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION team_closure_after_insert();

-- DB-H6: backfill team_closure for any pre-existing teams. The trigger
-- above only fires on future inserts; if a deployment already had teams
-- in place (or this migration is re-applied after a restore), the
-- closure table would be empty and `getEffectiveTeamRole` would silently
-- return null for every member. Backfill is idempotent (ON CONFLICT DO
-- NOTHING) so it is safe to run unconditionally.
INSERT INTO team_closure (ancestor_id, descendant_id, depth)
  SELECT t.id, t.id, 0 FROM teams t
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;

-- Recursive ancestor backfill via WITH RECURSIVE (DB-H6 follow-up).
-- Walks each team's parent chain and inserts the (ancestor, descendant,
-- depth) rows the trigger would have written on insert.
INSERT INTO team_closure (ancestor_id, descendant_id, depth)
  WITH RECURSIVE chain AS (
    SELECT id AS team_id, parent_team_id, 0 AS depth FROM teams WHERE parent_team_id IS NOT NULL
    UNION ALL
    SELECT c.team_id, t.parent_team_id, c.depth + 1
    FROM chain c JOIN teams t ON t.id = c.parent_team_id
    WHERE t.parent_team_id IS NOT NULL
  )
  SELECT team_id, parent_team_id, depth + 1 FROM chain
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;

-- Team cycle guard: prevent a team being its own ancestor
CREATE OR REPLACE FUNCTION teams_parent_cycle_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_team_id = NEW.id THEN
    RAISE EXCEPTION 'A team cannot be its own parent';
  END IF;

  IF EXISTS (
    SELECT 1 FROM team_closure
    WHERE ancestor_id = NEW.id AND descendant_id = NEW.parent_team_id
  ) THEN
    RAISE EXCEPTION 'Cyclic team relationship detected: team % is a descendant of team %', NEW.parent_team_id, NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_teams_cycle_guard ON teams;
CREATE TRIGGER trigger_teams_cycle_guard
  BEFORE INSERT OR UPDATE OF parent_team_id ON teams
  FOR EACH ROW EXECUTE FUNCTION teams_parent_cycle_guard();

-- Reparent closure maintenance
CREATE OR REPLACE FUNCTION team_closure_after_reparent()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.parent_team_id IS DISTINCT FROM OLD.parent_team_id THEN
    -- Drop ancestors that came via the OLD parent
    IF OLD.parent_team_id IS NOT NULL THEN
      DELETE FROM team_closure
      WHERE descendant_id IN (
        SELECT descendant_id FROM team_closure WHERE ancestor_id = NEW.id
      )
      AND ancestor_id IN (
        SELECT ancestor_id FROM team_closure WHERE descendant_id = OLD.parent_team_id
      );
    END IF;

    -- Add ancestors via the NEW parent
    IF NEW.parent_team_id IS NOT NULL THEN
      INSERT INTO team_closure (ancestor_id, descendant_id, depth)
      SELECT anc.ancestor_id, des.descendant_id, anc.depth + des.depth + 1
      FROM team_closure anc
      CROSS JOIN team_closure des
      WHERE anc.descendant_id = NEW.parent_team_id
        AND des.ancestor_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_team_closure_update ON teams;
CREATE TRIGGER trigger_team_closure_update
  AFTER UPDATE OF parent_team_id ON teams
  FOR EACH ROW EXECUTE FUNCTION team_closure_after_reparent();

-- ============================================================================
-- SECTION 15: TENANT ISOLATION TRIGGERS
-- ============================================================================

-- Department must belong to same org as the team
CREATE OR REPLACE FUNCTION verify_team_department_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM departments WHERE id = NEW.department_id AND org_id = NEW.org_id) THEN
      RAISE EXCEPTION 'Department must belong to the same organization as the team';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verify_team_department_org ON teams;
CREATE TRIGGER trigger_verify_team_department_org
  BEFORE INSERT OR UPDATE OF department_id, org_id ON teams
  FOR EACH ROW EXECUTE FUNCTION verify_team_department_org();

-- Parent goal / team / department must all belong to the same org
CREATE OR REPLACE FUNCTION verify_goal_relations_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_goal_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM goals WHERE id = NEW.parent_goal_id AND org_id = NEW.org_id) THEN
      RAISE EXCEPTION 'Parent goal must belong to the same organization';
    END IF;
  END IF;

  IF NEW.team_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW.team_id AND org_id = NEW.org_id) THEN
      RAISE EXCEPTION 'Team must belong to the same organization';
    END IF;
  END IF;

  IF NEW.department_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM departments WHERE id = NEW.department_id AND org_id = NEW.org_id) THEN
      RAISE EXCEPTION 'Department must belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verify_goal_relations_org ON goals;
CREATE TRIGGER trigger_verify_goal_relations_org
  BEFORE INSERT OR UPDATE OF parent_goal_id, team_id, department_id, org_id ON goals
  FOR EACH ROW EXECUTE FUNCTION verify_goal_relations_org();

-- Prevent org_id mutation on every table where it appears
CREATE OR REPLACE FUNCTION prevent_org_id_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Changing org_id is not allowed for security and tenant isolation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_teams_org_id_mutation ON teams;
CREATE TRIGGER trigger_prevent_teams_org_id_mutation
  BEFORE UPDATE OF org_id ON teams
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

DROP TRIGGER IF EXISTS trigger_prevent_departments_org_id_mutation ON departments;
CREATE TRIGGER trigger_prevent_departments_org_id_mutation
  BEFORE UPDATE OF org_id ON departments
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

DROP TRIGGER IF EXISTS trigger_prevent_goals_org_id_mutation ON goals;
CREATE TRIGGER trigger_prevent_goals_org_id_mutation
  BEFORE UPDATE OF org_id ON goals
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

DROP TRIGGER IF EXISTS trigger_prevent_org_members_org_id_mutation ON org_members;
CREATE TRIGGER trigger_prevent_org_members_org_id_mutation
  BEFORE UPDATE OF org_id ON org_members
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

DROP TRIGGER IF EXISTS trigger_prevent_team_members_org_id_mutation ON team_members;
CREATE TRIGGER trigger_prevent_team_members_org_id_mutation
  BEFORE UPDATE OF org_id ON team_members
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

DROP TRIGGER IF EXISTS trigger_prevent_goal_assignees_org_id_mutation ON goal_assignees;
CREATE TRIGGER trigger_prevent_goal_assignees_org_id_mutation
  BEFORE UPDATE OF org_id ON goal_assignees
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

DROP TRIGGER IF EXISTS trigger_prevent_goal_links_org_id_mutation ON goal_links;
CREATE TRIGGER trigger_prevent_goal_links_org_id_mutation
  BEFORE UPDATE OF org_id ON goal_links
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

DROP TRIGGER IF EXISTS trigger_prevent_goal_updates_org_id_mutation ON goal_updates;
CREATE TRIGGER trigger_prevent_goal_updates_org_id_mutation
  BEFORE UPDATE OF org_id ON goal_updates
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

DROP TRIGGER IF EXISTS trigger_prevent_org_integrations_org_id_mutation ON org_integrations;
CREATE TRIGGER trigger_prevent_org_integrations_org_id_mutation
  BEFORE UPDATE OF org_id ON org_integrations
  FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

-- ============================================================================
-- SECTION 16: GOAL CYCLE GUARD (Bug BA)
-- ============================================================================
-- Uses a recursive CTE to walk the ancestor chain from the proposed parent;
-- rejects the update if `NEW.id` appears (would form a cycle).
CREATE OR REPLACE FUNCTION goals_parent_cycle_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_goal_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_goal_id = NEW.id THEN
    RAISE EXCEPTION 'A goal cannot be its own parent';
  END IF;

  IF EXISTS (
    WITH RECURSIVE goal_ancestors AS (
      SELECT id, parent_goal_id
      FROM goals
      WHERE id = NEW.parent_goal_id
      UNION ALL
      SELECT g.id, g.parent_goal_id
      FROM goals g
      JOIN goal_ancestors ga ON g.id = ga.parent_goal_id
    )
    SELECT 1 FROM goal_ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Cyclic goal relationship detected: goal % is a descendant of goal %', NEW.parent_goal_id, NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_goals_cycle_guard ON goals;
CREATE TRIGGER trigger_goals_cycle_guard
  BEFORE INSERT OR UPDATE OF parent_goal_id ON goals
  FOR EACH ROW EXECUTE FUNCTION goals_parent_cycle_guard();

-- ============================================================================
-- SECTION 17: GOAL PROGRESS RECOMPUTATION
-- ============================================================================
-- Single source of truth for "what's this goal's progress".
-- * If the goal has children, weighted average of their (non-draft/cancelled) progress.
-- * If progress_mode is `manual`, keep the stored value.
-- * If `key_results`, weighted average of (current→target) per KR.
-- * If `linked_items`, weighted fraction of `is_done` work links.
-- Result is clamped to [0, 100] and rounded to 2 decimals.
CREATE OR REPLACE FUNCTION recompute_goal_progress(p_goal_id UUID)
RETURNS VOID AS $$
DECLARE
  v_org_id UUID;
  v_progress_mode TEXT;
  v_status TEXT;
  v_has_children BOOLEAN;
  v_new_progress NUMERIC(5,2);
  v_current_progress NUMERIC(5,2);
  v_parent_goal_id UUID;
BEGIN
  SELECT org_id, progress_mode, progress, parent_goal_id, status
  FROM goals
  WHERE id = p_goal_id
  INTO v_org_id, v_progress_mode, v_current_progress, v_parent_goal_id, v_status;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Don't roll up for inactive goals
  IF v_status IN ('draft', 'cancelled') THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM goals WHERE parent_goal_id = p_goal_id
  ) INTO v_has_children;

  IF v_has_children THEN
    -- Spec: COALESCE(NULLIF(SUM(rollup_weight),0), 1) — when children have no
    -- aggregate weight, treat the divisor as 1 (so the numerator passes through
    -- unchanged) rather than silently zeroing the parent.
    SELECT COALESCE(
      SUM(progress * rollup_weight) / NULLIF(SUM(rollup_weight), 0),
      SUM(progress * rollup_weight)
    ) INTO v_new_progress
    FROM goals
    WHERE parent_goal_id = p_goal_id AND status NOT IN ('draft', 'cancelled');
  ELSE
    IF v_progress_mode = 'manual' THEN
      v_new_progress := v_current_progress;
    ELSIF v_progress_mode = 'key_results' THEN
      SELECT COALESCE(
        SUM(
          CASE
            WHEN metric_type = 'boolean' THEN CASE WHEN current_value = target_value THEN 1.0 ELSE 0.0 END
            WHEN target_value = start_value THEN CASE WHEN current_value = target_value THEN 1.0 ELSE 0.0 END
            WHEN target_value > start_value THEN LEAST(GREATEST((current_value - start_value) / (target_value - start_value), 0), 1)
            ELSE LEAST(GREATEST((start_value - current_value) / (start_value - target_value), 0), 1)
          END * weight
        ) / NULLIF(SUM(weight), 0),
        0.00
      ) * 100 INTO v_new_progress
      FROM goal_key_results
      WHERE goal_id = p_goal_id;
    ELSIF v_progress_mode = 'linked_items' THEN
      SELECT COALESCE(
        SUM(CASE WHEN is_done THEN weight ELSE 0 END) / NULLIF(SUM(weight), 0),
        0.00
      ) * 100 INTO v_new_progress
      FROM goal_links
      WHERE goal_id = p_goal_id;
    ELSE
      v_new_progress := 0.00;
    END IF;
  END IF;

  v_new_progress := LEAST(GREATEST(v_new_progress, 0.00), 100.00);
  v_new_progress := ROUND(v_new_progress, 2);

  IF v_new_progress IS DISTINCT FROM v_current_progress THEN
    UPDATE goals
    SET progress = v_new_progress, updated_at = NOW()
    WHERE id = p_goal_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Bug BC: detail triggers must recompute BOTH old and new goal on re-assignment
CREATE OR REPLACE FUNCTION trigger_recompute_goal_progress_from_details()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM recompute_goal_progress(NEW.goal_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.goal_id IS DISTINCT FROM OLD.goal_id THEN
      PERFORM recompute_goal_progress(OLD.goal_id);
    END IF;
    PERFORM recompute_goal_progress(NEW.goal_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM recompute_goal_progress(OLD.goal_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recompute_progress_key_results ON goal_key_results;
CREATE TRIGGER trigger_recompute_progress_key_results
  AFTER INSERT OR UPDATE OF current_value, target_value, start_value, weight, metric_type, goal_id OR DELETE
  ON goal_key_results
  FOR EACH ROW EXECUTE FUNCTION trigger_recompute_goal_progress_from_details();

DROP TRIGGER IF EXISTS trigger_recompute_progress_links ON goal_links;
CREATE TRIGGER trigger_recompute_progress_links
  AFTER INSERT OR UPDATE OF is_done, weight, goal_id OR DELETE
  ON goal_links
  FOR EACH ROW EXECUTE FUNCTION trigger_recompute_goal_progress_from_details();

-- Goal structural propagation: recompute parents when children change
CREATE OR REPLACE FUNCTION goals_after_changes_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_goal_id IS NOT NULL THEN
      PERFORM recompute_goal_progress(NEW.parent_goal_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.progress_mode IS DISTINCT FROM OLD.progress_mode THEN
      PERFORM recompute_goal_progress(NEW.id);
    END IF;

    IF NEW.rollup_weight IS DISTINCT FROM OLD.rollup_weight THEN
      IF NEW.parent_goal_id IS NOT NULL THEN
        PERFORM recompute_goal_progress(NEW.parent_goal_id);
      END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.progress IS DISTINCT FROM OLD.progress OR NEW.parent_goal_id IS DISTINCT FROM OLD.parent_goal_id THEN
      IF OLD.parent_goal_id IS NOT NULL AND OLD.parent_goal_id IS DISTINCT FROM NEW.parent_goal_id THEN
        PERFORM recompute_goal_progress(OLD.parent_goal_id);
      END IF;

      IF NEW.parent_goal_id IS NOT NULL THEN
        PERFORM recompute_goal_progress(NEW.parent_goal_id);
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_goal_id IS NOT NULL THEN
      PERFORM recompute_goal_progress(OLD.parent_goal_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_goals_after_changes ON goals;
CREATE TRIGGER trigger_goals_after_changes
  AFTER INSERT OR UPDATE OF progress, parent_goal_id, progress_mode, rollup_weight, status OR DELETE
  ON goals
  FOR EACH ROW EXECUTE FUNCTION goals_after_changes_trigger();

-- ============================================================================
-- SECTION 18: GOAL STRUCTURE INTEGRITY (no mixing children with KRs/links)
-- ============================================================================
-- A goal can have EITHER child goals OR key results OR work links — not a mix.
-- Concurrency: lock the parent row before checking child existence.
CREATE OR REPLACE FUNCTION enforce_goal_structure_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only handle INSERT and UPDATE; DELETE is always allowed
  IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'goal_key_results' THEN
    IF TG_OP = 'UPDATE' AND NEW.goal_id IS DISTINCT FROM OLD.goal_id THEN
      RAISE EXCEPTION 'Changing goal_id is not allowed for key results';
    END IF;
    -- Lock only when linking to a goal
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.goal_id IS NOT NULL) THEN
      PERFORM 1 FROM goals WHERE id = NEW.goal_id FOR UPDATE;
    END IF;
    IF EXISTS (SELECT 1 FROM goals WHERE parent_goal_id = NEW.goal_id) THEN
      RAISE EXCEPTION 'Cannot add key result: Goal already has child goals';
    END IF;
  ELSIF TG_TABLE_NAME = 'goal_links' THEN
    IF TG_OP = 'UPDATE' AND NEW.goal_id IS DISTINCT FROM OLD.goal_id THEN
      RAISE EXCEPTION 'Changing goal_id is not allowed for work links';
    END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.goal_id IS NOT NULL) THEN
      PERFORM 1 FROM goals WHERE id = NEW.goal_id FOR UPDATE;
    END IF;
    IF EXISTS (SELECT 1 FROM goals WHERE parent_goal_id = NEW.goal_id) THEN
      RAISE EXCEPTION 'Cannot add work link: Goal already has child goals';
    END IF;
  ELSIF TG_TABLE_NAME = 'goals' THEN
    IF NEW.parent_goal_id IS NOT NULL THEN
      -- Target parent must exist and be lockable
      PERFORM 1 FROM goals WHERE id = NEW.parent_goal_id FOR UPDATE;
      -- Target must have no KRs
      IF EXISTS (SELECT 1 FROM goal_key_results WHERE goal_id = NEW.parent_goal_id) THEN
        RAISE EXCEPTION 'Cannot set parent goal: Target goal already has key results';
      END IF;
      -- Target must have no outgoing links
      IF EXISTS (SELECT 1 FROM goal_links WHERE goal_id = NEW.parent_goal_id) THEN
        RAISE EXCEPTION 'Cannot set parent goal: Target goal already has work links';
      END IF;
      -- NEW itself must not have children — cannot orphan a sub-tree
      IF EXISTS (SELECT 1 FROM goals WHERE parent_goal_id = NEW.id) THEN
        RAISE EXCEPTION 'Cannot set a goal that has child goals as a child of another goal';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_kr_integrity ON goal_key_results;
CREATE TRIGGER trigger_enforce_kr_integrity
  BEFORE INSERT OR UPDATE ON goal_key_results
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_structure_integrity();

DROP TRIGGER IF EXISTS trigger_enforce_link_integrity ON goal_links;
CREATE TRIGGER trigger_enforce_link_integrity
  BEFORE INSERT OR UPDATE ON goal_links
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_structure_integrity();

DROP TRIGGER IF EXISTS trigger_enforce_goal_child_integrity ON goals;
CREATE TRIGGER trigger_enforce_goal_child_integrity
  BEFORE INSERT OR UPDATE OF parent_goal_id ON goals
  FOR EACH ROW EXECUTE FUNCTION enforce_goal_structure_integrity();

-- ============================================================================
-- SECTION 19: RLS HARDENING
-- ============================================================================
-- The server uses the SERVICE ROLE key and bypasses RLS. These deny-all
-- policies ensure the anon/authenticated roles can NEVER read or write
-- these tables directly (defense in depth).

-- Enable RLS on all newly added tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_closure ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_user_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_command_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE temp_slack_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_locks ENABLE ROW LEVEL SECURITY;
-- Defense-in-depth: RLS on baseline integration tables (Bug AP follow-up).
-- The Node service uses the service-role key which bypasses RLS, but if
-- anyone ever ships a per-user anon client the deny-all policy here
-- guarantees no direct PostgREST access to token-bearing tables.
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_source_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- Deny-all policies. Service role bypasses these automatically.
DROP POLICY IF EXISTS "Deny all public" ON organizations;
DROP POLICY IF EXISTS "Deny all public" ON org_members;
DROP POLICY IF EXISTS "Deny all public" ON departments;
DROP POLICY IF EXISTS "Deny all public" ON teams;
DROP POLICY IF EXISTS "Deny all public" ON team_members;
DROP POLICY IF EXISTS "Deny all public" ON team_closure;
DROP POLICY IF EXISTS "Deny all public" ON goals;
DROP POLICY IF EXISTS "Deny all public" ON goal_assignees;
DROP POLICY IF EXISTS "Deny all public" ON goal_key_results;
DROP POLICY IF EXISTS "Deny all public" ON goal_links;
DROP POLICY IF EXISTS "Deny all public" ON goal_updates;
DROP POLICY IF EXISTS "Deny all public" ON org_integrations;
DROP POLICY IF EXISTS "Deny all public" ON slack_user_links;
DROP POLICY IF EXISTS "Deny all public" ON slack_command_sessions;
DROP POLICY IF EXISTS "Deny all public" ON temp_oauth_states;
DROP POLICY IF EXISTS "Deny all public" ON temp_slack_codes;
DROP POLICY IF EXISTS "Deny all public" ON integration_events;
DROP POLICY IF EXISTS "Deny all public" ON global_locks;
DROP POLICY IF EXISTS "Deny all public" ON user_integrations;
DROP POLICY IF EXISTS "Deny all public" ON integration_preferences;
DROP POLICY IF EXISTS "Deny all public" ON log_source_references;
DROP POLICY IF EXISTS "Deny all public" ON integration_sync_logs;

CREATE POLICY "Deny all public" ON organizations FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON org_members FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON departments FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON teams FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON team_members FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON team_closure FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON goals FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON goal_assignees FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON goal_key_results FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON goal_links FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON goal_updates FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON org_integrations FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON slack_user_links FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON slack_command_sessions FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON temp_oauth_states FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON temp_slack_codes FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON integration_events FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON global_locks FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON user_integrations FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON integration_preferences FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON log_source_references FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON integration_sync_logs FOR ALL TO public USING (false);

-- Bug AP: Enable RLS on the custom-auth tables that were previously unprotected.
-- Note: base schema defines password_reset_tokens (not password_resets) — fix
-- the table-name mismatch that the prior review pass flagged.
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all public access to refresh_tokens" ON refresh_tokens;
DROP POLICY IF EXISTS "Deny all public access to email_verifications" ON email_verifications;
DROP POLICY IF EXISTS "Deny all public access to password_reset_tokens" ON password_reset_tokens;

CREATE POLICY "Deny all public access to refresh_tokens" ON refresh_tokens FOR ALL TO public USING (false);
CREATE POLICY "Deny all public access to email_verifications" ON email_verifications FOR ALL TO public USING (false);
CREATE POLICY "Deny all public access to password_reset_tokens" ON password_reset_tokens FOR ALL TO public USING (false);

-- ============================================================================
-- SECTION 19b: AUTO-UPDATE `updated_at` (DB-M9)
-- ============================================================================
-- Apply the existing update_updated_at_column() trigger to every table
-- that has an `updated_at` column. The function is defined in the base
-- schema (supabase-schema.sql:460). We re-define it here defensively so
-- the migration is self-contained for fresh DBs.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_members_updated_at ON org_members;
CREATE TRIGGER trg_org_members_updated_at BEFORE UPDATE ON org_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_departments_updated_at ON departments;
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON team_members;
CREATE TRIGGER trg_team_members_updated_at BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_goal_key_results_updated_at ON goal_key_results;
CREATE TRIGGER trg_goal_key_results_updated_at BEFORE UPDATE ON goal_key_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_goal_links_updated_at ON goal_links;
CREATE TRIGGER trg_goal_links_updated_at BEFORE UPDATE ON goal_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_org_integrations_updated_at ON org_integrations;
CREATE TRIGGER trg_org_integrations_updated_at BEFORE UPDATE ON org_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 20: NOTIFY POSTGREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';