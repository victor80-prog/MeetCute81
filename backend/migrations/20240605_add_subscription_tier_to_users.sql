-- First, drop the existing column if it exists to avoid conflicts
ALTER TABLE users DROP COLUMN IF EXISTS subscription_tier;

-- Add subscription_tier column to users table with check constraint for valid tiers
ALTER TABLE users 
ADD COLUMN subscription_tier VARCHAR(20) NOT NULL DEFAULT 'Basic' 
CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('Basic', 'Premium', 'Elite'));

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- Update existing users to have the default Basic tier
UPDATE users SET subscription_tier = 'Basic' WHERE subscription_tier IS NULL OR subscription_tier = 'free';
