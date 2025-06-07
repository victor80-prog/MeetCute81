const { Pool } = require('pg');
const env = require('../config/env');

async function initializeUserBalances() {
  const pool = new Pool({
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
  });

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Finding users without balance records...');
    
    // Find users who don't have a balance record
    const result = await client.query(`
      SELECT u.id, u.email
      FROM users u
      LEFT JOIN user_balances ub ON u.id = ub.user_id
      WHERE ub.id IS NULL;
    `);
    
    const usersWithoutBalances = result.rows;
    console.log(`Found ${usersWithoutBalances.length} users without balance records`);
    
    // Initialize balance for each user
    for (const user of usersWithoutBalances) {
      console.log(`Initializing balance for user ${user.id} (${user.email})`);
      
      await client.query(
        'INSERT INTO user_balances (user_id, balance) VALUES ($1, $2)',
        [user.id, '0.00']
      );
    }
    
    await client.query('COMMIT');
    console.log('✅ Successfully initialized balances for all users');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing user balances:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
initializeUserBalances()
  .then(() => console.log('Balance initialization completed'))
  .catch(console.error)
  .finally(() => process.exit(0));
