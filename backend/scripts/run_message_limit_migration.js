const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbConfig = require('../config/db');
const pool = new Pool(dbConfig);

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../../migrations/20240605_drop_message_limit_trigger.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    console.log('Successfully removed message limit trigger and function');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
