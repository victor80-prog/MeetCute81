const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  user: env.DB_USER,
  host: env.DB_HOST,
  database: env.DB_NAME,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
});

// Test connection and create database if it doesn't exist
const initializeDatabase = async () => {
  try {
    // Try to connect to the database
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
  } catch (err) {
    if (err.code === '3D000') {
      // Database doesn't exist, create it
      const pgPool = new Pool({
        user: env.DB_USER,
        host: env.DB_HOST,
        database: 'postgres',
        password: env.DB_PASSWORD,
        port: env.DB_PORT,
      });

      try {
        await pgPool.query(`CREATE DATABASE ${env.DB_NAME}`);
        console.log(`✅ Database ${env.DB_NAME} created`);
      } catch (createErr) {
        console.error('❌ Error creating database:', createErr);
        process.exit(1);
      } finally {
        await pgPool.end();
      }
    } else {
      console.error('❌ Database connection error:', err);
      process.exit(1);
    }
  }
};

// Initialize database
initializeDatabase();

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;