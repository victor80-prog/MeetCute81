const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const TEST_USER = {
  email: 'test@example.com',
  password: 'testpassword123'
};

// Function to make authenticated requests
async function makeRequest(method, endpoint, data = null, token = null) {
  const config = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    headers: {},
    data
  };

  if (token) {
    config.headers['x-auth-token'] = token;
  }

  console.log(`\n🌐 ${method.toUpperCase()} ${config.url}`);
  if (token) console.log('🔑 Using token:', token.substring(0, 20) + '...');
  if (data) console.log('📦 Request data:', JSON.stringify(data, null, 2));

  try {
    const response = await axios(config);
    console.log(`✅ Success (${response.status}):`, JSON.stringify(response.data, null, 2));
    return { success: true, data: response.data };
  } catch (error) {
    const errorData = {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
    console.error(`❌ Error (${error.response?.status || 'No response'}):`, JSON.stringify(errorData, null, 2));
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status,
      fullError: error
    };
  }
}

// Test feature access
async function testFeatureAccess() {
  console.log('🚀 Starting feature access tests...\n');
  
  // 1. Login
  console.log('1. Logging in test user...');
  const loginRes = await makeRequest('post', '/auth/login', {
    email: TEST_USER.email,
    password: TEST_USER.password
  });
  
  if (!loginRes.success) {
    console.error('❌ Login failed:', loginRes.error);
    return;
  }
  
  const token = loginRes.data.token;
  const userId = loginRes.data.user?.id;
  console.log(`✅ Login successful - User ID: ${userId}, Token: ${token.substring(0, 20)}...\n`);
  
  // 2. Get user's features
  console.log('2. Fetching user features...');
  const featuresRes = await makeRequest('get', '/features/my-features', null, token);
  
  if (featuresRes.success) {
    const features = featuresRes.data.features || [];
    console.log(`✅ User has ${features.length} features:`, features.map(f => f.name).join(', ') || 'None');
  } else {
    console.error('❌ Failed to fetch user features:', featuresRes.error);
  }
  console.log();
  
  // 3. Test premium feature access
  console.log('3. Testing premium feature access...');
  const premiumRes = await makeRequest('get', '/features/premium-feature', null, token);
  
  if (premiumRes.success) {
    console.log('✅ User has access to premium features');
    console.log('   Feature details:', JSON.stringify(premiumRes.data, null, 2));
  } else {
    console.log('ℹ️  User does not have access to premium features');
    if (premiumRes.status === 403) {
      console.log('   This is expected for basic users');
    }
    console.log('   Error details:', JSON.stringify({
      status: premiumRes.status,
      message: premiumRes.error?.message || premiumRes.error,
      data: premiumRes.error
    }, null, 2));
  }
  console.log();
  
  // 4. Test subscription required
  console.log('4. Testing subscription requirement...');
  const subRes = await makeRequest('get', '/features/subscription-required', null, token);
  
  if (subRes.success) {
    const features = subRes.data.features || [];
    console.log('✅ User has an active subscription');
    console.log(`   Available features (${features.length}):`, features.map(f => f.name).join(', ') || 'None');
  } else {
    console.log('❌ User does not have an active subscription');
    console.log('   Error details:', JSON.stringify({
      status: subRes.status,
      message: subRes.error?.message || subRes.error,
      data: subRes.error
    }, null, 2));
    
    // Debug: Check user's subscription in the database
    console.log('\n🔍 Debug: Checking user subscription in database...');
    const dbCheck = await checkUserSubscriptionInDB(userId);
    if (dbCheck) {
      console.log('   Database shows user has an active subscription:', JSON.stringify(dbCheck, null, 2));
    } else {
      console.log('   No active subscription found in database for this user');
    }
  }
  
  console.log('\n✨ Test completed');
}

// Helper function to check user subscription in the database
async function checkUserSubscriptionInDB(userId) {
  let pool;
  try {
    pool = require('../config/db');
    
    const query = `
      SELECT us.*, sp.name as package_name, sp.tier_level
      FROM user_subscriptions us
      LEFT JOIN subscription_packages sp ON us.package_id = sp.id
      WHERE us.user_id = $1
      AND us.status = 'active'
      AND (us.end_date IS NULL OR us.end_date > NOW())
      LIMIT 1;
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error checking user subscription in DB:', error);
    return null;
  }
}

// Run the test
testFeatureAccess().catch(console.error);
