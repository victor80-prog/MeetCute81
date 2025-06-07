const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  user: env.DB_USER,
  host: env.DB_HOST,
  database: env.DB_NAME,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
});

async function checkTable() {
  try {
    // Check if table exists
    const tableExists = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'withdrawal_requests');"
    );
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ withdrawal_requests table does not exist');
      return;
    }
    
    console.log('✅ withdrawal_requests table exists');
    
    // Get table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'withdrawal_requests';
    `);
    
    console.log('\nTable structure:');
    console.table(columns.rows);
    
  } catch (error) {
    console.error('Error checking table:', error);
  } finally {
    await pool.end();
  }
}

checkTable();
