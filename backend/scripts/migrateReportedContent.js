const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function migrateReportedContent() {
  const client = await pool.connect();
  try {
    console.log('Running reported content migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/reported_content.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migrations
    await client.query(migrationSQL);
    
    console.log('✅ Reported content migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error running reported content migration:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrateReportedContent(); 