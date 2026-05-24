-- Worklog AI Supabase Schema
-- Run these migrations in order in the Supabase SQL Editor

-- ============================================
-- PHASE 1: Database Schema
-- ============================================

-- 1.1 Users profile table (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  company_name TEXT,
  job_title TEXT,
  reminder_day INTEGER DEFAULT 1, -- 0-6 (Sunday-Saturday), default Monday
  reminder_time TIME DEFAULT '09:00', -- Default 9 AM
  reminder_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 1.2 Work log entries table
CREATE TABLE IF NOT EXISTS work_log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  accomplishments TEXT NOT NULL,
  challenges TEXT,
  learnings TEXT,
  goals_next_week TEXT,
  hours_logged DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_work_log_user_date ON work_log_entries(user_id, week_start_date);

-- Enable RLS
ALTER TABLE work_log_entries ENABLE ROW LEVEL SECURITY;

-- Policies for work_log_entries
CREATE POLICY "Users can view own work logs"
  ON work_log_entries
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own work logs"
  ON work_log_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work logs"
  ON work_log_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own work logs"
  ON work_log_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- 1.3 Appraisal criteria & generated outputs table
CREATE TABLE IF NOT EXISTS appraisal_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  criteria_text TEXT NOT NULL,
  company_goals TEXT,
  values TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appraisal_criteria_user ON appraisal_criteria(user_id, period_start, period_end);

-- Enable RLS
ALTER TABLE appraisal_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own criteria"
  ON appraisal_criteria
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own criteria"
  ON appraisal_criteria
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Generated appraisals table
CREATE TABLE IF NOT EXISTS generated_appraisals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES appraisal_criteria(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_text TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_appraisals_user ON generated_appraisals(user_id, period_start, period_end);

-- Enable RLS
ALTER TABLE generated_appraisals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appraisals"
  ON generated_appraisals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own appraisals"
  ON generated_appraisals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 1.4 Reminder logs (track sent reminders)
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_user ON reminder_logs(user_id, sent_at);

-- Enable RLS
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminder logs"
  ON reminder_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (for the cron job)
CREATE POLICY "Service role can insert reminder logs"
  ON reminder_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get current week start (Monday)
CREATE OR REPLACE FUNCTION get_week_start(date_value DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
  RETURN date_value - ((EXTRACT(DOW FROM date_value) + 6) % 7) * INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Sample Data (Optional - for testing)
-- ============================================

-- Uncomment to insert sample data
-- INSERT INTO user_profiles (id, email, company_name, job_title) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'Acme Corp', 'Software Engineer');

-- ============================================
-- Authentication Helper Tables
-- ============================================

-- Users table (for local auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  company_name TEXT,
  job_title TEXT,
  reminder_day INTEGER DEFAULT 1, -- 0-6 (Sunday-Saturday), default Monday
  reminder_time TEXT DEFAULT '09:00', -- UTC hour in HH:00 format
  reminder_enabled BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================
-- PHASE 2: Monthly Summaries & Chat
-- ============================================

-- Monthly Summaries Table
CREATE TABLE IF NOT EXISTS monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_year DATE NOT NULL,
    summary_text TEXT NOT NULL,
    entry_count INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    source_entry_ids UUID[] NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_summaries_user_month 
  ON monthly_summaries(user_id, month_year);

ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own monthly summaries" ON monthly_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly summaries" ON monthly_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly summaries" ON monthly_summaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly summaries" ON monthly_summaries FOR DELETE USING (auth.uid() = user_id);

-- Chat Sessions Table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own chat sessions" ON chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat sessions" ON chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat sessions" ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat sessions" ON chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
-- We need to join with chat_sessions to check user_id for RLS, or we can just add user_id to chat_messages.
-- For simplicity, let's add user_id to chat_messages so we don't have to do complex RLS.
ALTER TABLE chat_messages ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;

CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat messages" ON chat_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chat messages" ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- PHASE 3: Feedback
-- ============================================

-- Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'improvement', 'general')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  page_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category, created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own feedback" ON feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback" ON feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can read all feedback" ON feedback FOR SELECT USING (true);
CREATE POLICY "Service role can insert feedback" ON feedback FOR INSERT WITH CHECK (true);

-- ============================================
-- PHASE 4: AI Pulse Hub - AI News & Impact Tracking
-- ============================================

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
  impact_summary TEXT, -- "How this impacts employee performance and work"
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

-- Enable RLS (public read access for SEO)
ALTER TABLE ai_articles ENABLE ROW LEVEL SECURITY;

-- Public can read all articles (for SEO and unauthenticated users)
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

-- Enable RLS (public read access for SEO)
ALTER TABLE ai_impact_cards ENABLE ROW LEVEL SECURITY;

-- Public can read all impact cards
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

-- Enable RLS
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks"
  ON user_bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON user_bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON user_bookmarks
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4.4 Migration jobs and triggers (auto-update timestamps)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_articles_updated_at
  BEFORE UPDATE ON ai_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_impact_cards_updated_at
  BEFORE UPDATE ON ai_impact_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

