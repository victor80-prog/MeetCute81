const { Pool } = require('pg');
const pool = require('../config/db');

// Subscription packages with their features
const SUBSCRIPTION_PACKAGES = [
  {
    name: 'Basic',
    price: 9.99,
    billing_interval: 'monthly',
    description: 'Essential features to get started',
    tier_level: 'Basic',
    duration_months: 1,
    features: [
      { feature_name: 'basic_matching', feature_description: 'Basic matching with limited daily likes' },
      { feature_name: 'profile_creation', feature_description: 'Create and customize your profile' },
      { feature_name: 'basic_search', feature_description: 'Basic search filters' },
      { feature_name: 'limited_messaging', feature_description: 'Send messages to mutual matches' }
    ]
  },
  {
    name: 'Premium',
    price: 19.99,
    billing_interval: 'monthly',
    description: 'Most popular - Enhanced features for better matching',
    tier_level: 'Premium',
    duration_months: 1,
    features: [
      { feature_name: 'unlimited_likes', feature_description: 'Unlimited likes and matches' },
      { feature_name: 'advanced_search', feature_description: 'Advanced search filters' },
      { feature_name: 'read_receipts', feature_description: 'See who read your messages' },
      { feature_name: 'profile_boost', feature_description: 'Boost your profile once a week' },
      { feature_name: 'see_who_likes_you', feature_description: 'See who liked your profile' },
      { feature_name: 'priority_matching', feature_description: 'Get priority in match results' }
    ]
  },
  {
    name: 'Elite',
    price: 29.99,
    billing_interval: 'monthly',
    description: 'Full access to all premium features',
    tier_level: 'Elite',
    duration_months: 1,
    features: [
      { feature_name: 'all_premium_features', feature_description: 'All Premium features included' },
      { feature_name: 'unlimited_boosts', feature_description: 'Unlimited profile boosts' },
      { feature_name: 'incognito_mode', feature_description: 'Browse profiles anonymously' },
      { feature_name: 'message_priority', feature_description: 'Your messages appear first' },
      { feature_name: 'personal_matchmaker', feature_description: 'Personalized matchmaking service' },
      { feature_name: 'exclusive_events', feature_description: 'Access to exclusive events' }
    ]
  }
];

async function initSubscriptionFeatures() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Clear existing data
    await client.query('TRUNCATE TABLE subscription_features CASCADE');
    await client.query('TRUNCATE TABLE subscription_packages CASCADE');
    
    console.log('Initializing subscription packages and features...');
    
    // Insert packages and their features
    for (const pkg of SUBSCRIPTION_PACKAGES) {
      // Insert package
      const packageResult = await client.query(
        `INSERT INTO subscription_packages 
         (name, price, billing_interval, description, tier_level, duration_months, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id`,
        [pkg.name, pkg.price, pkg.billing_interval, pkg.description, pkg.tier_level, pkg.duration_months]
      );
      
      const packageId = packageResult.rows[0].id;
      
      // Insert features
      for (const feature of pkg.features) {
        await client.query(
          `INSERT INTO subscription_features 
           (package_id, feature_name, feature_description)
           VALUES ($1, $2, $3)`,
          [packageId, feature.feature_name, feature.feature_description]
        );
      }
      
      console.log(`✅ Added package: ${pkg.name} with ${pkg.features.length} features`);
    }
    
    await client.query('COMMIT');
    console.log('✅ Successfully initialized subscription packages and features');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing subscription features:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the initialization
initSubscriptionFeatures()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to initialize subscription features:', error);
    process.exit(1);
  });
