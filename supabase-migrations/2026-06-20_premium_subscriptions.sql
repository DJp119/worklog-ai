-- ============================================================================
-- Premium Subscriptions, AI Reports, Activity Summaries, Channel Preferences.
--
-- Depends on: 2026-06-16_teams_goals_integrations.sql (prevent_org_id_mutation,
--   organizations table, users table, org_members table, teams table).
-- ============================================================================

-- Subscription tier enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
    CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM (
      'trialing', 'active', 'past_due', 'paused', 'canceled', 'unpaid'
    );
  END IF;
END $$;

-- Organization subscription
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  max_members INTEGER,
  ai_reports_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(org_id)
);

-- AI Performance Reports
CREATE TABLE IF NOT EXISTS performance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'self', 'individual', 'team', 'organization'
  )),
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  report_content JSONB NOT NULL,
  report_markdown TEXT,
  ai_model TEXT,
  token_usage INTEGER,
  generation_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN (
    'generating', 'completed', 'failed', 'expired'
  )),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(org_id, id)
);

-- Activity aggregation table
CREATE TABLE IF NOT EXISTS activity_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('jira', 'github', 'slack', 'manual')),
  summary_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(org_id, user_id, period_start, period_end, provider)
);

-- Integration channel and filter preferences
CREATE TABLE IF NOT EXISTS integration_channel_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'github', 'jira')),
  channel_type TEXT NOT NULL CHECK (channel_type IN (
    'notification', 'sync'
  )),
  channel_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  set_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_prefs_unique
  ON integration_channel_preferences(
    org_id,
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'),
    COALESCE(team_id, '00000000-0000-0000-0000-000000000000'),
    provider,
    channel_type
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_performance_reports_org ON performance_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_performance_reports_target_user ON performance_reports(target_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_summaries_user_period ON activity_summaries(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_channel_prefs_user ON integration_channel_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_prefs_team ON integration_channel_preferences(team_id);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_channel_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all public" ON subscriptions FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON performance_reports FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON activity_summaries FOR ALL TO public USING (false);
CREATE POLICY "Deny all public" ON integration_channel_preferences FOR ALL TO public USING (false);

-- Triggers for preventing org_id mutations
CREATE OR REPLACE TRIGGER trigger_prevent_subscriptions_org_mutation
BEFORE UPDATE OF org_id ON subscriptions
FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

CREATE OR REPLACE TRIGGER trigger_prevent_reports_org_mutation
BEFORE UPDATE OF org_id ON performance_reports
FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

CREATE OR REPLACE TRIGGER trigger_prevent_activity_summaries_org_mutation
BEFORE UPDATE OF org_id ON activity_summaries
FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

CREATE OR REPLACE TRIGGER trigger_prevent_channel_prefs_org_mutation
BEFORE UPDATE OF org_id ON integration_channel_preferences
FOR EACH ROW EXECUTE FUNCTION prevent_org_id_mutation();

-- Auto-provision free subscription when org is created
CREATE OR REPLACE FUNCTION provision_free_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (org_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_provision_free_subscription ON organizations;
CREATE TRIGGER trigger_provision_free_subscription
AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION provision_free_subscription();

-- updated_at trigger helper (reused across tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_performance_reports_updated_at ON performance_reports;
CREATE TRIGGER trigger_performance_reports_updated_at
BEFORE UPDATE ON performance_reports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_activity_summaries_updated_at ON activity_summaries;
CREATE TRIGGER trigger_activity_summaries_updated_at
BEFORE UPDATE ON activity_summaries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_channel_prefs_updated_at ON integration_channel_preferences;
CREATE TRIGGER trigger_channel_prefs_updated_at
BEFORE UPDATE ON integration_channel_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
