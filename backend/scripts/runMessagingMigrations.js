const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running messaging migrations...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/20240606_enhance_messaging_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migrations
    await client.query(migrationSQL);
    
    console.log('✅ Messaging migrations completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error running messaging migrations:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigrations();
