const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

// This script tests the balance functionality directly against the database
// without going through the HTTP server

async function testBalanceForUser(userId) {
  const pool = new Pool({
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
  });

  const client = await pool.connect();
  
  try {
    console.log(`\nTesting balance for user ID: ${userId}`);
    
    // 1. Get user details
    const userResult = await client.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.error(`User with ID ${userId} not found`);
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`User: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
    
    // 2. Check if user has a balance record
    const balanceResult = await client.query(
      'SELECT * FROM user_balances WHERE user_id = $1',
      [userId]
    );
    
    if (balanceResult.rows.length === 0) {
      console.log('No balance record found. Creating one...');
      await client.query(
        'INSERT INTO user_balances (user_id, balance) VALUES ($1, 0.00) RETURNING *',
        [userId]
      );
      console.log('Created new balance record');
    } else {
      console.log('Current balance:', balanceResult.rows[0]);
    }
    
    // 3. Test the UserBalance model directly
    const UserBalance = require('../models/UserBalance');
    console.log('\nTesting UserBalance.getByUserId...');
    const balanceAccount = await UserBalance.getByUserId(userId);
    console.log('getByUserId result:', balanceAccount);
    
    console.log('\nTesting UserBalance.getOrCreateByUserId...');
    const balanceAccount2 = await UserBalance.getOrCreateByUserId(userId);
    console.log('getOrCreateByUserId result:', balanceAccount2);
    
    // 4. Test updating balance
    console.log('\nTesting balance update...');
    const updatedBalance = await UserBalance.credit(userId, 10.50);
    console.log('After crediting $10.50:', updatedBalance);
    
    const finalBalance = await UserBalance.debit(userId, 5.25);
    console.log('After debiting $5.25:', finalBalance);
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run tests
async function runTests() {
  // Test with user ID 1 (or any valid user ID)
  await testBalanceForUser(1);
  
  // Test with admin user (ID 13 from previous output)
  await testBalanceForUser(13);
}

runTests().catch(console.error);
