-- Migration: Add reminder preference columns to users table
-- The users table (local auth) was missing these columns that user_profiles had.
-- This allows storing reminder preferences for users using the local auth system.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reminder_day INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reminder_time TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN users.reminder_day IS '0-6 (Sunday-Saturday), default Monday';
COMMENT ON COLUMN users.reminder_time IS 'UTC hour in HH:00 format, e.g. 09:00';
COMMENT ON COLUMN users.reminder_enabled IS 'Whether weekly email reminders are enabled';
