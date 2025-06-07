BEGIN;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS message_count_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_message_date DATE,
ADD COLUMN IF NOT EXISTS swipe_count_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_swipe_date DATE;

-- Optionally, you might want to initialize last_message_date and last_swipe_date
-- for existing users to today or a specific date if needed, though it's often
-- handled by the application logic on first use.
-- Example: UPDATE users SET last_message_date = CURRENT_DATE WHERE last_message_date IS NULL;

COMMIT;
