const { Pool } = require('pg');
const env = require('../config/env');

async function ensureBalanceTables() {
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
    
    console.log('Checking user_balances table...');
    
    // Create user_balances table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_balances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Ensured user_balances table exists');
    
    // Create or replace the update_timestamp function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('Ensured update_timestamp function exists');
    
    // Create or replace the trigger for user_balances
    await client.query(`
      DROP TRIGGER IF EXISTS update_user_balances_timestamp ON user_balances;
      CREATE TRIGGER update_user_balances_timestamp
      BEFORE UPDATE ON user_balances
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();
    `);
    
    console.log('Ensured update trigger exists for user_balances');
    
    await client.query('COMMIT');
    console.log('✅ Database schema verified and updated successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error ensuring balance tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the function
ensureBalanceTables()
  .then(() => console.log('Database check completed'))
  .catch(console.error)
  .finally(() => process.exit(0));
