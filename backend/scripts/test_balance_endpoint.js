const axios = require('axios');
const { Pool } = require('pg');
const env = require('../config/env');

// Test the balance endpoint directly
async function testBalanceEndpoint() {
  try {
    console.log('Testing /api/balance endpoint...');
    
    // First, get a valid user token (you'll need to replace this with a valid token)
    // For testing, you can get a token from your frontend's localStorage
    const token = process.env.TEST_TOKEN || 'YOUR_TEST_TOKEN_HERE';
    
    if (!token || token === 'YOUR_TEST_TOKEN_HERE') {
      console.error('Please set a valid TEST_TOKEN environment variable');
      process.exit(1);
    }
    
    const response = await axios.get('http://localhost:5000/api/balance', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
  } catch (error) {
    console.error('Error testing balance endpoint:', {
      message: error.message,
      response: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      },
      stack: error.stack
    });
  }
}

// Test database connection and user_balances table
async function testDatabase() {
  const pool = new Pool({
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
  });

  try {
    console.log('\nTesting database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    // Check if user_balances table exists and has data
    const result = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_balances';
    `);
    
    console.log('\nuser_balances table columns:');
    console.table(result.rows);
    
    // Check if there are any users with balances
    const usersWithBalances = await pool.query(`
      SELECT u.id, u.email, ub.balance
      FROM users u
      LEFT JOIN user_balances ub ON u.id = ub.user_id
      LIMIT 5;
    `);
    
    console.log('\nSample users with balances:');
    console.table(usersWithBalances.rows);
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run tests
async function runTests() {
  await testBalanceEndpoint();
  await testDatabase();
}

runTests().catch(console.error);
