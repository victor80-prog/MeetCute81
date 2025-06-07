const { Pool } = require('pg');
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

/**
 * Creates a match between two users for testing
 * @param {number} user1Id - ID of the first user
 * @param {number} user2Id - ID of the second user
 */
async function createMatch(user1Id, user2Id) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create match in one direction (matches table has a unique constraint on (user1_id, user2_id))
    const matchResult1 = await client.query(
      `INSERT INTO matches (user1_id, user2_id) 
       VALUES ($1, $2)
       ON CONFLICT (user1_id, user2_id) 
       DO NOTHING
       RETURNING *`,
      [user1Id, user2Id]
    );
    
    // Create the reverse match if it doesn't exist
    const matchResult2 = await client.query(
      `INSERT INTO matches (user1_id, user2_id) 
       VALUES ($1, $2)
       ON CONFLICT (user1_id, user2_id) 
       DO NOTHING
       RETURNING *`,
      [user2Id, user1Id]
    );
    
    await client.query('COMMIT');
    
    if (matchResult1.rows.length > 0 || matchResult2.rows.length > 0) {
      console.log(`Successfully created match between users ${user1Id} and ${user2Id}`);
      return true;
    } else {
      console.log('Match already existed in both directions');
      return false;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating match:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gets user ID by email
 * @param {string} email - User's email
 */
async function getUserIdByEmail(email) {
  const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  return result.rows[0]?.id;
}

// Main function to run the script
async function main() {
  try {
    // Get test users
    const user1Email = 'basic@test.com';
    const user2Email = 'premium@test.com';
    
    console.log(`Looking up user IDs for ${user1Email} and ${user2Email}...`);
    
    const user1Id = await getUserIdByEmail(user1Email);
    const user2Id = await getUserIdByEmail(user2Email);
    
    if (!user1Id || !user2Id) {
      console.error('One or both test users not found. Please run createTestUsers.js first.');
      console.log('User IDs found:', { user1Id, user2Id });
      process.exit(1);
    }
    
    console.log(`Found user IDs: ${user1Id} (${user1Email}) and ${user2Id} (${user2Email})`);
    
    // Create match
    console.log('Creating match...');
    const result = await createMatch(user1Id, user2Id);
    
    if (result) {
      console.log('✅ Match created successfully!');
      console.log(`You can now log in as ${user1Email} or ${user2Email} with password 'password123'`);
    } else {
      console.log('ℹ️ Match already existed');
    }
    
  } catch (error) {
    console.error('❌ Error in createTestMatch:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run the script
main();
