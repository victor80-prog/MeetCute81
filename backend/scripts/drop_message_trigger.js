const { Pool } = require('pg');
const dbConfig = require('../config/db');

async function dropTrigger() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  });

  const client = await pool.connect();
  try {
    console.log('Dropping message limit trigger...');
    await client.query('DROP TRIGGER IF EXISTS message_limit_check ON public.messages');
    
    console.log('Dropping check_message_limits function...');
    await client.query('DROP FUNCTION IF EXISTS public.check_message_limits()');
    
    console.log('Successfully removed message limit trigger and function');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

dropTrigger().catch(console.error);
