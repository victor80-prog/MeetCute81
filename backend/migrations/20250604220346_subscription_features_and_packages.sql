-- Migration: Subscription Features and Packages
-- This migration sets up the subscription packages and their features

-- Ensure the tier_level type exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
        CREATE TYPE subscription_tier AS ENUM ('Basic', 'Premium', 'Elite');
    END IF;
END$$;

-- Create subscription_packages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.subscription_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    duration_months INTEGER DEFAULT 1,
    tier_level subscription_tier NOT NULL,
    UNIQUE(name)
);

-- Create subscription_features table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.subscription_features (
    id SERIAL PRIMARY KEY,
    package_id INTEGER REFERENCES public.subscription_packages(id) ON DELETE CASCADE,
    feature_name VARCHAR(200) NOT NULL,
    feature_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(package_id, feature_name)
);

-- Create or update function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription_packages
DROP TRIGGER IF EXISTS update_subscription_packages_modtime ON public.subscription_packages;
CREATE TRIGGER update_subscription_packages_modtime
BEFORE UPDATE ON public.subscription_packages
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Insert default subscription packages if they don't exist
-- First ensure the packages don't exist to avoid conflicts
WITH new_packages (name, price, billing_interval, description, tier_level, duration_months) AS (
  VALUES 
    ('Basic', 9.99, 'monthly', 'Essential features to get started', 'Basic', 1),
    ('Premium', 19.99, 'monthly', 'Most popular - Enhanced features for better matching', 'Premium', 1),
    ('Elite', 29.99, 'monthly', 'Full access to all premium features', 'Elite', 1)
)
INSERT INTO public.subscription_packages 
    (name, price, billing_interval, description, tier_level, duration_months)
SELECT p.name, p.price, p.billing_interval, p.description, p.tier_level::subscription_tier, p.duration_months
FROM new_packages p
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_packages sp 
  WHERE sp.name = p.name
);

-- Insert features for Basic tier
DO $$
DECLARE
  basic_pkg_id INTEGER;
BEGIN
  SELECT id INTO basic_pkg_id FROM public.subscription_packages WHERE tier_level = 'Basic' LIMIT 1;
  
  IF basic_pkg_id IS NOT NULL THEN
    INSERT INTO public.subscription_features (package_id, feature_name, feature_description)
    SELECT 
      basic_pkg_id, 
      v.feature_name, 
      v.feature_description
    FROM (VALUES
      ('basic_matching', 'Basic matching with limited daily likes'),
      ('profile_creation', 'Create and customize your profile'),
      ('basic_search', 'Basic search filters'),
      ('limited_messaging', 'Send messages to mutual matches')
    ) AS v(feature_name, feature_description)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscription_features 
      WHERE package_id = basic_pkg_id AND feature_name = v.feature_name
    );
  END IF;
END $$;

-- Insert features for Premium tier
DO $$
DECLARE
  premium_pkg_id INTEGER;
BEGIN
  SELECT id INTO premium_pkg_id FROM public.subscription_packages WHERE tier_level = 'Premium' LIMIT 1;
  
  IF premium_pkg_id IS NOT NULL THEN
    INSERT INTO public.subscription_features (package_id, feature_name, feature_description)
    SELECT 
      premium_pkg_id, 
      v.feature_name, 
      v.feature_description
    FROM (VALUES
      ('unlimited_likes', 'Unlimited likes and matches'),
      ('advanced_search', 'Advanced search filters'),
      ('read_receipts', 'See who read your messages'),
      ('profile_boost', 'Boost your profile once a week'),
      ('see_who_likes_you', 'See who liked your profile'),
      ('priority_matching', 'Get priority in match results')
    ) AS v(feature_name, feature_description)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscription_features 
      WHERE package_id = premium_pkg_id AND feature_name = v.feature_name
    );
  END IF;
END $$;

-- Insert features for Elite tier
DO $$
DECLARE
  elite_pkg_id INTEGER;
BEGIN
  SELECT id INTO elite_pkg_id FROM public.subscription_packages WHERE tier_level = 'Elite' LIMIT 1;
  
  IF elite_pkg_id IS NOT NULL THEN
    INSERT INTO public.subscription_features (package_id, feature_name, feature_description)
    SELECT 
      elite_pkg_id, 
      v.feature_name, 
      v.feature_description
    FROM (VALUES
      ('all_premium_features', 'All Premium features included'),
      ('unlimited_boosts', 'Unlimited profile boosts'),
      ('incognito_mode', 'Browse profiles anonymously'),
      ('message_priority', 'Your messages appear first'),
      ('personal_matchmaker', 'Personalized matchmaking service'),
      ('exclusive_events', 'Access to exclusive events')
    ) AS v(feature_name, feature_description)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subscription_features 
      WHERE package_id = elite_pkg_id AND feature_name = v.feature_name
    );
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_subscription_features_package ON public.subscription_features(package_id);
CREATE INDEX IF NOT EXISTS idx_subscription_packages_tier ON public.subscription_packages(tier_level);

-- Update user_subscriptions table to reference subscription_packages if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
        -- Add package_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'user_subscriptions' AND column_name = 'package_id') THEN
            ALTER TABLE public.user_subscriptions 
            ADD COLUMN package_id INTEGER REFERENCES public.subscription_packages(id);
        END IF;
        
        -- Add tier_level column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'user_subscriptions' AND column_name = 'tier_level') THEN
            ALTER TABLE public.user_subscriptions 
            ADD COLUMN tier_level subscription_tier;
            
            -- Update existing subscriptions to have a tier_level
            UPDATE public.user_subscriptions us
            SET tier_level = 'Basic'
            WHERE tier_level IS NULL;
            
            -- Make tier_level NOT NULL after setting defaults
            ALTER TABLE public.user_subscriptions 
            ALTER COLUMN tier_level SET NOT NULL;
        END IF;
    END IF;
END $$;

-- Create a function to get user's active features
CREATE OR REPLACE FUNCTION public.get_user_active_features(user_id_param INTEGER)
RETURNS TABLE(feature_name VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT sf.feature_name
    FROM user_subscriptions us
    JOIN subscription_packages sp ON us.package_id = sp.id OR us.tier_level = sp.tier_level
    JOIN subscription_features sf ON sp.id = sf.package_id
    WHERE us.user_id = user_id_param
      AND us.status = 'active'
      AND (us.end_date IS NULL OR us.end_date > CURRENT_TIMESTAMP)
      AND sp.is_active = true;
END;
$$ LANGUAGE plpgsql STABLE;
