const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

// Database connection configuration
const pool = new Pool({
  user: env.DB_USER,
  host: env.DB_HOST,
  database: env.DB_NAME,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test user data
const testUsers = [
  {
    email: 'basic@test.com',
    password: 'password123',
    role: 'user',
    subscription: 'Basic',
    profile: {
      first_name: 'Basic',
      last_name: 'User',
      gender: 'Other',
      dob: new Date('1990-01-01'),
      bio: 'Basic test user',
      profile_pic: 'default.jpg'
    }
  },
  {
    email: 'premium@test.com',
    password: 'password123',
    role: 'user',
    subscription: 'Premium',
    profile: {
      first_name: 'Premium',
      last_name: 'User',
      gender: 'Female',
      dob: new Date('1990-01-01'),
      bio: 'Premium test user',
      profile_pic: 'default.jpg'
    }
  },
  {
    email: 'elite@test.com',
    password: 'password123',
    role: 'user',
    subscription: 'Elite',
    profile: {
      first_name: 'Elite',
      last_name: 'User',
      gender: 'Male',
      dob: new Date('1990-01-01'),
      bio: 'Elite test user',
      profile_pic: 'default.jpg'
    }
  },
  {
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin',
    profile: {
      first_name: 'Admin',
      last_name: 'User',
      gender: 'Other',
      dob: new Date('1990-01-01'),
      bio: 'Admin test user',
      profile_pic: 'default.jpg'
    }
  }
];

async function createTestUsers() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete existing test users if they exist
    // First get the user IDs to delete
    const usersToDelete = await client.query(
      "SELECT id FROM users WHERE email LIKE '%@test.com'"
    );
    const userIds = usersToDelete.rows.map(row => row.id);
    
    if (userIds.length > 0) {
      console.log(`Found ${userIds.length} test users to delete`);
      
      // Delete from tables with foreign key references first, in the correct order
      const tablesToClean = [
        'user_gifts',
        'chat_messages',
        'chat_rooms',
        'likes',
        'views',
        'matches',
        'transactions',
        'user_balances',
        'user_subscriptions',
        'profiles',
        'user_roles',
        'notifications',
        'user_devices',
        'sessions',
        'password_reset_tokens',
        'email_verification_tokens',
        'user_preferences',
        'user_photos',
        'user_reports',
        'user_blocked_users',
        'user_favorites'
      ];
      
      // Delete from all related tables
      for (const table of tablesToClean) {
        try {
          // Check if user_id column exists in the table
          const columnCheck = await client.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_name = $1 AND column_name = 'user_id'`,
            [table]
          );
          
          if (columnCheck.rows.length > 0) {
            await client.query(`DELETE FROM ${table} WHERE user_id = ANY($1::int[])`, [userIds]);
          }
          
          // Check for other possible foreign key columns
          const otherFkColumns = ['sender_id', 'recipient_id', 'user1_id', 'user2_id', 'from_user_id', 'to_user_id'];
          for (const col of otherFkColumns) {
            const colCheck = await client.query(
              `SELECT column_name 
               FROM information_schema.columns 
               WHERE table_name = $1 AND column_name = $2`,
              [table, col]
            );
            
            if (colCheck.rows.length > 0) {
              await client.query(`DELETE FROM ${table} WHERE ${col} = ANY($1::int[])`, [userIds]);
            }
          }
          
          console.log(`Cleaned up ${table} table`);
        } catch (err) {
          console.error(`Error cleaning up ${table}:`, err.message);
        }
      }
      
      // Now delete the users
      await client.query(`
        DELETE FROM users 
        WHERE id = ANY($1::int[])
      `, [userIds]);
      
      // Finally, delete the users
      await client.query(`
        DELETE FROM users 
        WHERE id = ANY($1::int[])
      `, [userIds]);
    }

    // Create test users
    for (const userData of testUsers) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Insert user
      const userResult = await client.query(
        'INSERT INTO users (email, password, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id',
        [userData.email, hashedPassword, userData.role, true]
      );
      
      const userId = userResult.rows[0].id;
      
      // Insert profile
      await client.query(
        `INSERT INTO profiles 
        (user_id, first_name, last_name, gender, dob, bio, profile_pic)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          userData.profile.first_name,
          userData.profile.last_name,
          userData.profile.gender,
          userData.profile.dob,
          userData.profile.bio,
          userData.profile.profile_pic
        ]
      );
      
      // Add subscription if not admin
      if (userData.subscription) {
        // Get subscription package ID
        const packageResult = await client.query(
          'SELECT id FROM subscription_packages WHERE tier_level = $1 LIMIT 1',
          [userData.subscription]
        );
        
        if (packageResult.rows.length > 0) {
          const packageId = packageResult.rows[0].id;
          const startDate = new Date();
          const endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1); // 1 year subscription
          
          await client.query(
            `INSERT INTO user_subscriptions 
            (user_id, package_id, status, start_date, end_date, tier_level, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [userId, packageId, 'active', startDate, endDate, userData.subscription]
          );
          
          // User subscription is managed through the user_subscriptions table
        }
        
        // Initialize user balance
        await client.query(
          'INSERT INTO user_balances (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
          [userId, 100.00] // Give each test user $100 balance
        );
        console.log(`Initialized balance for user ${userData.email}`);
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Test users created successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating test users:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
createTestUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
