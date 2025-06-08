// Simple script to manually login and store the token
// Run this in browser console on the login page

async function testLogin() {
  try {
    const response = await fetch('http://localhost:5000/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@meetcute.com',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      console.log('Login successful!');
      localStorage.setItem('token', data.token);
      console.log('Token stored:', data.token);
      return data.token;
    } else {
      console.error('Login failed:', data);
      return null;
    }
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

// Check current token
function checkToken() {
  const token = localStorage.getItem('token');
  console.log('Current token:', token);
  return token;
}

// Make authenticated request test
async function testAuthenticatedRequest(endpoint = '/auth/me') {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found in localStorage');
    return null;
  }
  
  try {
    const response = await fetch(`http://localhost:5000${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log('Auth test response:', data);
    return data;
  } catch (error) {
    console.error('Auth test error:', error);
    return null;
  }
}

// Helper to test transactions endpoint
async function testTransactionsRequest() {
  return testAuthenticatedRequest('/transactions/my-transactions?limit=5&offset=0');
}

// Export for console use
window.authTest = {
  login: testLogin,
  checkToken,
  testAuth: testAuthenticatedRequest,
  testTransactions: testTransactionsRequest
};

console.log('Auth test utilities loaded. Use window.authTest.login() to login');
