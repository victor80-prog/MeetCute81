const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  });

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/20240605_add_profile_columns.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute the migration
    logger.info('Running database migration...');
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    logger.info('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  logger.error('Unhandled error in migration:', error);
  process.exit(1);
});
