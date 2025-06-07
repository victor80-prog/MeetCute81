const pool = require('../config/db');

async function checkUserBalances() {
  try {
    // Check if user_balances table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_balances'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ user_balances table does not exist');
      return;
    }

    console.log('✅ user_balances table exists');

    // Get table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_balances';
    `);

    console.log('\nTable structure:');
    console.table(structure.rows);

    // Check if any data exists
    const count = await pool.query('SELECT COUNT(*) FROM user_balances');
    console.log(`\nTotal rows in user_balances: ${count.rows[0].count}`);

  } catch (error) {
    console.error('Error checking user_balances table:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkUserBalances();
