-- Migration script to fix profile schema issues
-- This script should be run after the application is stopped

-- Start a transaction
BEGIN;

-- 1. Fix profile picture column duplication
-- First, ensure we have a profile_picture column
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255);

-- Copy data from profile_pic to profile_picture if needed
UPDATE profiles 
SET profile_picture = profile_pic 
WHERE profile_picture IS NULL AND profile_pic IS NOT NULL;

-- Drop the old profile_pic column if it exists
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS profile_pic;

-- 2. Add missing columns if they don't exist
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Add NOT NULL constraints with proper defaults for existing rows
-- First, update any null values with defaults
UPDATE profiles SET first_name = 'User' WHERE first_name IS NULL;
UPDATE profiles SET last_name = 'User' WHERE last_name IS NULL;
UPDATE profiles SET gender = 'other' WHERE gender IS NULL;

-- Then add the constraints
ALTER TABLE profiles 
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN gender SET NOT NULL;

-- 4. Add check constraint for gender
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS valid_gender,
  ADD CONSTRAINT valid_gender CHECK (gender IN ('male', 'female', 'other'));

-- 5. Add/update indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- 6. Add comments to document the schema
COMMENT ON TABLE profiles IS 'Stores user profile information';
COMMENT ON COLUMN profiles.user_id IS 'References users.id';
COMMENT ON COLUMN profiles.profile_picture IS 'Path to the profile picture';
COMMENT ON COLUMN profiles.gender IS 'User''s gender (male, female, other)';

-- 7. Update the updated_at column on row updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists to avoid errors
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- Create the trigger
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Commit the transaction
COMMIT;
