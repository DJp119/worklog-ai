-- Worklog AI Custom Authentication Schema
-- Run this in Supabase SQL Editor to migrate from Supabase Auth to custom auth

-- ============================================
-- PHASE 1: Create Users Table (replaces auth.users dependency)
-- ============================================

DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS email_verifications CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1.1 Users table (self-contained, no auth.users dependency)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    company_name TEXT,
    job_title TEXT,
    reminder_day INTEGER DEFAULT 1,
    reminder_time TIME DEFAULT '09:00',
    reminder_enabled BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookup
CREATE INDEX idx_users_email ON users(email);

-- 1.2 Email verifications table
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_token ON email_verifications(token);

-- 1.3 Refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- 1.4 Password reset tokens table
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_resets_user ON password_resets(user_id);
CREATE INDEX idx_password_resets_token ON password_resets(token);

-- ============================================
-- PHASE 2: Work Log Entries (unchanged)
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_work_log_user_date ON work_log_entries(user_id, week_start_date);

-- ============================================
-- PHASE 3: Appraisal Tables (unchanged)
-- ============================================

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

-- ============================================
-- PHASE 4: Reminder Logs (unchanged)
-- ============================================

CREATE TABLE IF NOT EXISTS reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    email_address TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_user ON reminder_logs(user_id, sent_at);

-- ============================================
-- PHASE 5: Helper Functions
-- ============================================

-- Function to get current week start (Monday)
CREATE OR REPLACE FUNCTION get_week_start(date_value DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
    RETURN date_value - ((EXTRACT(DOW FROM date_value) + 6) % 7) * INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM email_verifications WHERE expires_at < NOW();
    DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true;
    DELETE FROM password_resets WHERE expires_at < NOW() OR used = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PHASE 6: Update existing data (if any)
-- ============================================

-- If you have existing user_profiles, migrate them to users table
-- Uncomment if you have existing data:
/*
INSERT INTO users (id, email, company_name, job_title, reminder_day, reminder_time, reminder_enabled, email_verified, created_at)
SELECT id, email, company_name, job_title, reminder_day, reminder_time, reminder_enabled, true, created_at
FROM user_profiles
ON CONFLICT (email) DO NOTHING;
*/

-- Drop the old user_profiles trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================
-- SCHEMA MIGRATION COMPLETE
-- ============================================
