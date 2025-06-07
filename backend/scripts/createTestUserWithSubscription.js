const { Pool } = require('pg');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123',
  firstName: 'Test',
  lastName: 'User',
  username: 'testuser',
  role: 'user',
  subscriptionTier: 'Premium' // Can be 'Basic', 'Premium', or 'Elite'
};

async function createTestUser() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🚀 Creating test user with subscription...');
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(TEST_USER.password, salt);
    
    // Check if user already exists
    const userCheck = await client.query(
      'SELECT id FROM users WHERE email = $1', 
      [TEST_USER.email]
    );
    
    let userId;
    
    if (userCheck.rows.length > 0) {
      // User exists, update password and get ID
      userId = userCheck.rows[0].id;
      await client.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, userId]
      );
      console.log('ℹ️  Updated existing test user password');
    } else {
      // Create new user
      const userRes = await client.query(
        `INSERT INTO users 
         (email, password, first_name, last_name, username, role, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
         RETURNING id`,
        [
          TEST_USER.email,
          hashedPassword,
          TEST_USER.firstName,
          TEST_USER.lastName,
          TEST_USER.username,
          TEST_USER.role
        ]
      );
      userId = userRes.rows[0].id;
      console.log('✅ Created new test user');
    }
    
    // Create or update user profile
    const profileCheck = await client.query(
      'SELECT 1 FROM profiles WHERE user_id = $1',
      [userId]
    );
    
    if (profileCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO profiles 
         (user_id, first_name, last_name, bio, gender, dob, profile_picture)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          TEST_USER.firstName,
          TEST_USER.lastName,
          'Test user profile',
          'other',
          '1990-01-01',
          'default-profile.jpg'
        ]
      );
      console.log('✅ Created user profile');
    }
    
    // Get the subscription package ID for the specified tier
    const pkgRes = await client.query(
      'SELECT id FROM subscription_packages WHERE tier_level = $1 LIMIT 1',
      [TEST_USER.subscriptionTier]
    );
    
    if (pkgRes.rows.length === 0) {
      throw new Error(`No subscription package found for tier: ${TEST_USER.subscriptionTier}`);
    }
    
    const packageId = pkgRes.rows[0].id;
    
    // Create or update subscription
    const subCheck = await client.query(
      'SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    
    if (subCheck.rows.length > 0) {
      // Update existing subscription
      await client.query(
        `UPDATE user_subscriptions 
         SET package_id = $1, 
             tier_level = $2::subscription_tier, 
             status = 'active', 
             start_date = NOW(),
             end_date = NOW() + INTERVAL '1 month',
             updated_at = NOW()
         WHERE user_id = $3`,
        [packageId, TEST_USER.subscriptionTier, userId]
      );
      console.log(`✅ Updated existing subscription to ${TEST_USER.subscriptionTier} tier`);
    } else {
      // Create new subscription
      await client.query(
        `INSERT INTO user_subscriptions 
         (user_id, package_id, tier_level, status, start_date, end_date, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW() + INTERVAL '1 month', NOW(), NOW())`,
        [userId, packageId, TEST_USER.subscriptionTier]
      );
      console.log(`✅ Created new ${TEST_USER.subscriptionTier} subscription`);
    }
    
    // Get user's balance or create if not exists
    const balanceCheck = await client.query(
      'SELECT 1 FROM user_balances WHERE user_id = $1',
      [userId]
    );
    
    if (balanceCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO user_balances (user_id, balance, created_at, updated_at) VALUES ($1, 100.00, NOW(), NOW())',
        [userId]
      );
      console.log('✅ Initialized user balance with $100.00');
    }
    
    await client.query('COMMIT');
    
    console.log('\n✨ Test user setup complete!');
    console.log(`Email: ${TEST_USER.email}`);
    console.log(`Password: ${TEST_USER.password}`);
    console.log(`Subscription Tier: ${TEST_USER.subscriptionTier}`);
    console.log('\nYou can now use these credentials to test the application.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error setting up test user:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
createTestUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to set up test user:', error);
    process.exit(1);
  });
