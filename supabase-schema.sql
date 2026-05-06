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
  challenges TEXT NOT NULL,
  learnings TEXT NOT NULL,
  goals_next_week TEXT NOT NULL,
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
