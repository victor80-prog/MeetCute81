const { Pool } = require('pg');
const pool = require('../config/db');

// Standardized features for each tier
const TIER_FEATURES = {
  Basic: [
    { feature_name: 'basic_matching', feature_description: 'Basic matching with limited daily likes' },
    { feature_name: 'profile_creation', feature_description: 'Create and customize your profile' },
    { feature_name: 'basic_search', feature_description: 'Basic search filters' },
    { feature_name: 'limited_messaging', feature_description: 'Send messages to mutual matches' }
  ],
  Premium: [
    { feature_name: 'unlimited_likes', feature_description: 'Unlimited likes and matches' },
    { feature_name: 'advanced_search', feature_description: 'Advanced search filters' },
    { feature_name: 'read_receipts', feature_description: 'See who read your messages' },
    { feature_name: 'profile_boost', feature_description: 'Boost your profile once a week' },
    { feature_name: 'see_who_likes_you', feature_description: 'See who liked your profile' },
    { feature_name: 'priority_matching', feature_description: 'Get priority in match results' }
  ],
  Elite: [
    { feature_name: 'all_premium_features', feature_description: 'All Premium features included' },
    { feature_name: 'unlimited_boosts', feature_description: 'Unlimited profile boosts' },
    { feature_name: 'incognito_mode', feature_description: 'Browse profiles anonymously' },
    { feature_name: 'message_priority', feature_description: 'Your messages appear first' },
    { feature_name: 'personal_matchmaker', feature_description: 'Personalized matchmaking service' },
    { feature_name: 'exclusive_events', feature_description: 'Access to exclusive events' }
  ]
};

async function cleanupAndStandardizeFeatures() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🚀 Starting feature cleanup and standardization...');
    
    // Get all packages
    const packagesResult = await client.query('SELECT id, name, tier_level FROM subscription_packages');
    const packages = packagesResult.rows;
    
    // Process each package
    for (const pkg of packages) {
      console.log(`\n📦 Processing package: ${pkg.name} (${pkg.tier_level || 'No tier'})`);
      
      // Get the standard features for this tier
      const standardFeatures = TIER_FEATURES[pkg.tier_level] || [];
      
      if (standardFeatures.length === 0) {
        console.log(`⚠️  No standard features defined for tier: ${pkg.tier_level}`);
        continue;
      }
      
      // Delete all existing features for this package
      await client.query('DELETE FROM subscription_features WHERE package_id = $1', [pkg.id]);
      console.log(`  - Removed all existing features for ${pkg.name}`);
      
      // Add the standard features
      for (const feature of standardFeatures) {
        await client.query(
          'INSERT INTO subscription_features (package_id, feature_name, feature_description) VALUES ($1, $2, $3)',
          [pkg.id, feature.feature_name, feature.feature_description]
        );
        console.log(`  + Added feature: ${feature.feature_name}`);
      }
    }
    
    // Update package descriptions to be consistent
    await client.query(
      "UPDATE subscription_packages SET description = 'Essential features to get started' WHERE tier_level = 'Basic'"
    );
    await client.query(
      "UPDATE subscription_packages SET description = 'Most popular - Enhanced features for better matching' WHERE tier_level = 'Premium'"
    );
    await client.query(
      "UPDATE subscription_packages SET description = 'Full access to all premium features' WHERE tier_level = 'Elite'"
    );
    
    await client.query('COMMIT');
    console.log('\n✅ Successfully cleaned up and standardized subscription features');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during feature cleanup:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
cleanupAndStandardizeFeatures()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to clean up features:', error);
    process.exit(1);
  });
