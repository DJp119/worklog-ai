-- Cohort tracking migration

-- 1. Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_logged_date TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_logs INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS logging_cadence TEXT DEFAULT 'weekly';

-- 2. Create trigger function to update stats when work_log_entries change
CREATE OR REPLACE FUNCTION update_user_cohort_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_total_logs INTEGER;
  v_last_logged_date TIMESTAMPTZ;
  v_current_streak INTEGER := 0;
  v_week_start DATE;
  v_expected_next DATE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  -- Calculate total logs and last logged date
  SELECT 
    COUNT(*),
    MAX(created_at)
  INTO 
    v_total_logs, 
    v_last_logged_date
  FROM work_log_entries
  WHERE user_id = v_user_id;

  -- Calculate current streak
  FOR v_week_start IN 
    SELECT week_start_date 
    FROM work_log_entries 
    WHERE user_id = v_user_id 
    ORDER BY week_start_date DESC
  LOOP
    IF v_expected_next IS NULL THEN
      -- First (most recent) entry
      v_current_streak := 1;
      v_expected_next := v_week_start - INTERVAL '7 days';
    ELSIF v_week_start = v_expected_next THEN
      v_current_streak := v_current_streak + 1;
      v_expected_next := v_week_start - INTERVAL '7 days';
    ELSE
      -- Streak broken
      EXIT;
    END IF;
  END LOOP;

  -- If expected next is not null, let's verify if the user missed this/last week entirely
  -- and break the streak if they haven't logged recently.
  IF v_expected_next IS NOT NULL THEN
    IF DATE_TRUNC('week', NOW()) - INTERVAL '1 week' > (v_expected_next + INTERVAL '7 days') THEN
       v_current_streak := 0;
    END IF;
  END IF;

  -- Update the user
  UPDATE users 
  SET 
    total_logs = COALESCE(v_total_logs, 0),
    last_logged_date = v_last_logged_date,
    current_streak = v_current_streak
  WHERE id = v_user_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS user_cohort_stats_trigger ON work_log_entries;
CREATE TRIGGER user_cohort_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON work_log_entries
FOR EACH ROW
EXECUTE FUNCTION update_user_cohort_stats();

-- 4. Backfill existing users
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM users LOOP
    UPDATE work_log_entries SET updated_at = NOW() WHERE user_id = u.id AND id = (SELECT id FROM work_log_entries WHERE user_id = u.id LIMIT 1);
  END LOOP;
END;
$$;

-- 5. Create index
CREATE INDEX IF NOT EXISTS idx_users_cohort ON users(created_at, last_logged_date);

-- 6. Create convenience view for cohort retention
CREATE OR REPLACE VIEW cohort_retention_weekly AS
WITH cohorts AS (
  SELECT 
    DATE_TRUNC('week', created_at)::DATE AS signup_week,
    COUNT(id) AS cohort_size
  FROM users
  GROUP BY 1
),
retention AS (
  SELECT 
    DATE_TRUNC('week', u.created_at)::DATE AS signup_week,
    (e.week_start_date - DATE_TRUNC('week', u.created_at)::DATE) / 7 AS week_offset,
    COUNT(DISTINCT u.id) AS retained_users
  FROM users u
  JOIN work_log_entries e ON e.user_id = u.id
  GROUP BY 1, 2
)
SELECT 
  c.signup_week,
  c.cohort_size,
  MAX(CASE WHEN r.week_offset = 1 THEN r.retained_users ELSE 0 END) AS week_1_retained,
  MAX(CASE WHEN r.week_offset = 2 THEN r.retained_users ELSE 0 END) AS week_2_retained,
  MAX(CASE WHEN r.week_offset = 3 THEN r.retained_users ELSE 0 END) AS week_3_retained,
  MAX(CASE WHEN r.week_offset = 4 THEN r.retained_users ELSE 0 END) AS week_4_retained
FROM cohorts c
LEFT JOIN retention r ON r.signup_week = c.signup_week
GROUP BY c.signup_week, c.cohort_size
ORDER BY c.signup_week DESC;
