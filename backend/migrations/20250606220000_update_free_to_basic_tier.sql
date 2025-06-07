-- Migration to update any remaining 'free' tier users to 'Basic'
UPDATE users 
SET subscription_tier = 'Basic' 
WHERE LOWER(subscription_tier) = 'free';

-- Add a check constraint to ensure only valid tiers are used
ALTER TABLE users 
ADD CONSTRAINT valid_subscription_tier 
CHECK (subscription_tier IN ('Basic', 'Premium', 'Elite'));
