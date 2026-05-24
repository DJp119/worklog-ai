-- =====================================================
-- AI IMPACT HUB - DATABASE MIGRATION
-- Run this in Supabase SQL Editor
-- =====================================================

-- 4.1 AI Articles / News Feed table (publicly accessible for SEO)
CREATE TABLE IF NOT EXISTS ai_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  source_name TEXT,
  category TEXT NOT NULL CHECK (category IN ('news', 'models', 'startups', 'research', 'tools', 'open_source', 'funding', 'india_ai', 'world_ai')),
  published_at TIMESTAMPTZ NOT NULL,
  impact_summary TEXT,
  cta_text TEXT DEFAULT 'Track employee outcomes automatically with ImpactlyAI',
  cta_link TEXT DEFAULT '/dashboard',
  thumbnail_url TEXT,
  views_count INTEGER DEFAULT 0,
  bookmark_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_articles_category ON ai_articles(category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_articles_published ON ai_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_articles_slug ON ai_articles(slug);

-- Enable RLS for ai_articles
ALTER TABLE ai_articles ENABLE ROW LEVEL SECURITY;

-- Public can read all articles
DROP POLICY IF EXISTS "Public can view all articles" ON ai_articles;
CREATE POLICY "Public can view all articles"
  ON ai_articles
  FOR SELECT
  USING (true);

-- 4.2 AI Impact Cards table (publicly accessible for SEO)
CREATE TABLE IF NOT EXISTS ai_impact_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  industry TEXT NOT NULL UNIQUE CHECK (industry IN ('jobs', 'healthcare', 'education', 'finance', 'marketing', 'engineering', 'design', 'hr', 'agriculture', 'manufacturing')),
  industry_display_name TEXT NOT NULL,
  what_changed TEXT NOT NULL,
  impact_level TEXT NOT NULL CHECK (impact_level IN ('high', 'medium', 'low')),
  companies_involved TEXT[] DEFAULT '{}',
  future_prediction TEXT NOT NULL,
  opportunities TEXT[] DEFAULT '{}',
  risks TEXT[] DEFAULT '{}',
  tools TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_impact_cards_industry ON ai_impact_cards(industry);

-- Enable RLS for ai_impact_cards
ALTER TABLE ai_impact_cards ENABLE ROW LEVEL SECURITY;

-- Public can read all impact cards
DROP POLICY IF EXISTS "Public can view all impact cards" ON ai_impact_cards;
CREATE POLICY "Public can view all impact cards"
  ON ai_impact_cards
  FOR SELECT
  USING (true);

-- 4.3 User bookmarks for AI articles and impact cards
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES ai_articles(id) ON DELETE CASCADE,
  impact_card_id UUID REFERENCES ai_impact_cards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id),
  UNIQUE(user_id, impact_card_id),
  CONSTRAINT bookmark_target_check CHECK (
    (article_id IS NOT NULL AND impact_card_id IS NULL) OR
    (article_id IS NULL AND impact_card_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks(user_id);

-- Enable RLS for user_bookmarks
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can view own bookmarks
DROP POLICY IF EXISTS "Users can view own bookmarks" ON user_bookmarks;
CREATE POLICY "Users can view own bookmarks"
  ON user_bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert own bookmarks
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON user_bookmarks;
CREATE POLICY "Users can insert own bookmarks"
  ON user_bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete own bookmarks
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON user_bookmarks;
CREATE POLICY "Users can delete own bookmarks"
  ON user_bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4.4 Migration trigger for auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_articles_updated_at ON ai_articles;
CREATE TRIGGER update_ai_articles_updated_at
  BEFORE UPDATE ON ai_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_impact_cards_updated_at ON ai_impact_cards;
CREATE TRIGGER update_ai_impact_cards_updated_at
  BEFORE UPDATE ON ai_impact_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert sample AI articles
INSERT INTO ai_articles (title, slug, summary, content, source_url, source_name, category, published_at, impact_summary, thumbnail_url)
VALUES
  (
    'OpenAI Releases GPT-4.5 with Enhanced Reasoning',
    'openai-gpt-4-5-enhanced-reasoning',
    'OpenAI has announced GPT-4.5, showing 40% improvement in complex reasoning tasks.',
    'OpenAI today announced the release of GPT-4.5, the latest iteration of their flagship language model.',
    'https://openai.com',
    'OpenAI',
    'models',
    '2026-05-24T10:30:00Z',
    'This advancement means developers can automate more complex tasks faster. Track how your team adapts to AI-assisted development with ImpactlyAI.',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800'
  ),
  (
    'Anthropic Claude 3.5 Haiku Now Available',
    'anthropic-claude-3-5-haiku-launch',
    'Anthropic has launched Claude 3.5 Haiku, a new mid-tier model that balances cost and performance.',
    'Anthropic today announced the general availability of Claude 3.5 Haiku.',
    'https://anthropic.com',
    'Anthropic',
    'models',
    '2026-05-24T09:15:00Z',
    'Content teams can produce 3x more output. Measure your team''s content velocity and strategic impact with ImpactlyAI.',
    'https://images.unsplash.com/photo-1679904771728-3eb601ffb5a9?w=800'
  ),
  (
    'AI Startup Funding Reaches $500M This Week',
    'ai-startup-funding-500m-may-2026',
    'Notable recipients include Anthropic ($200M), Merch.ai ($150M), plus 12 other AI startups.',
    'Venture capital investment in AI startups reached $500 million this week alone.',
    'https://techcrunch.com',
    'TechCrunch',
    'funding',
    '2026-05-23T14:00:00Z',
    'The influx of capital means more AI tools for teams. Track how new tools impact your team''s productivity timeline.',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800'
  ),
  (
    'GitHub Copilot Workspace Launches in Beta',
    'github-copilot-workspace-beta',
    'GitHub has launched Copilot Workspace in beta - an AI-powered development environment.',
    'GitHub today announced the beta launch of Copilot Workspace.',
    'https://github.com',
    'GitHub',
    'tools',
    '2026-05-23T08:00:00Z',
    'Engineering teams using Copilot Workspace report 50% faster delivery. Track your team''s velocity improvements after AI tool adoption.',
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800'
  ),
  (
    'Google DeepMind Announces AlphaFold 3',
    'googled-deepmind-alphafold-3',
    'DeepMind''s AlphaFold 3 represents a breakthrough in protein structure prediction with 30% improved accuracy.',
    'Google DeepMind has unveiled AlphaFold 3, the latest iteration of their protein structure prediction system.',
    'https://deepmind.google',
    'Google DeepMind',
    'research',
    '2026-05-22T16:00:00Z',
    'Healthcare teams adopting AI-powered drug discovery tools need outcome tracking. Measure research productivity with ImpactlyAI.',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800'
  );

-- Insert sample industry impact cards
INSERT INTO ai_impact_cards (slug, industry, industry_display_name, what_changed, impact_level, companies_involved, future_prediction, opportunities, risks, tools)
VALUES
  (
    'hr-recruiting-ai',
    'hr',
    'HR & Recruiting',
    'AI automates resume screening, interview scheduling, and initial candidate assessment.',
    'high',
    '{"HireVue", "Pymetrics", "Eightfold AI", "LinkedIn"}',
    'By 2027, 80% of initial resume screening will be AI-driven.',
    '{"HR teams can focus on strategic initiatives", "Faster time-to-hire by 40-60%", "Reduced unconscious bias"}',
    '{"Administrative HR roles may decrease", "Need for AI literacy in HR teams"}',
    '{"HireVue", "Eightfold AI", "HireEZ"}'
  ),
  (
    'software-engineering-ai',
    'engineering',
    'Software Engineering',
    'AI pair programmers and code generation tools are becoming standard in development workflows.',
    'high',
    '{"GitHub", "GitLab", "Amazon", "Replit"}',
    'Junior developer roles will shift toward AI oversight and code review.',
    '{"Developers can focus on architecture", "Faster onboarding for juniors", "Reduced bugs through AI testing"}',
    '{"Commoditization of basic coding", "Security concerns with AI-generated code"}',
    '{"GitHub Copilot", "Cursor", "Replit Ghostwriter"}'
  ),
  (
    'healthcare-diagnostic-ai',
    'healthcare',
    'Healthcare',
    'AI for medical imaging, drug discovery, and patient triage is rapidly advancing.',
    'high',
    '{"Google Health", "Tempus", "Butterfly Network", "Insilico Medicine"}',
    'AI will become standard in radiology by 2026.',
    '{"Earlier disease detection", "Faster drug discovery", "Reduced admin burden"}',
    '{"Regulatory challenges", "Data privacy concerns"}',
    '{"Tempus", "Butterfly Network", "Aidoc"}'
  ),
  (
    'marketing-content-ai',
    'marketing',
    'Marketing & Content',
    'AI content generation is transforming copywriting, design, and campaign optimization.',
    'medium',
    '{"Jasper", "Copy.ai", "Canva", "Midjourney"}',
    'Marketing teams will need fewer content creators but more AI Prompt engineers.',
    '{"Faster content production", "Personalization at scale"}',
    '{"Content saturation", "Copyright concerns"}',
    '{"Jasper", "Midjourney", "Surfer SEO"}'
  );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check tables exist
SELECT
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ai_articles', 'ai_impact_cards', 'user_bookmarks');

-- Count seed data
SELECT 'ai_articles' as table_name, COUNT(*) as count FROM ai_articles
UNION ALL
SELECT 'ai_impact_cards', COUNT(*) FROM ai_impact_cards;