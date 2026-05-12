-- Make challenges, learnings, and goals_next_week optional
ALTER TABLE work_log_entries
  ALTER COLUMN challenges DROP NOT NULL,
  ALTER COLUMN learnings DROP NOT NULL,
  ALTER COLUMN goals_next_week DROP NOT NULL;
