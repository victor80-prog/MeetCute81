-- Update all users with 'free' tier to 'Basic'
UPDATE users 
SET subscription_tier = 'Basic',
    updated_at = NOW()
WHERE subscription_tier = 'free';

-- Verify the update
SELECT id, email, subscription_tier 
FROM users 
WHERE subscription_tier = 'Basic' 
LIMIT 5;
