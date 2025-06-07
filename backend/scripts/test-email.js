const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file in the backend directory
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading environment from: ${envPath}`);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
  process.exit(1);
} else {
  console.log('✅ Environment variables loaded successfully');
}

// Log important env vars (masking sensitive data)
console.log('Environment:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '***' : 'Not set');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' : 'Not set');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);

const { sendEmail } = require('../services/emailService');

async function testEmail() {
  console.log('\n🚀 Starting email test...');
  
  const testEmail = process.env.EMAIL_USER; // Send to yourself for testing
  
  if (!testEmail) {
    console.error('❌ No test email address found in environment variables');
    process.exit(1);
  }
  
  console.log(`📧 Sending test email to: ${testEmail}`);
  
  try {
    const result = await sendEmail({
      to: testEmail,
      subject: 'Test Email from MeetCute81',
      html: '<h1>Test Email</h1><p>This is a test email from MeetCute81.</p>',
      text: 'This is a test email from MeetCute81.'
    });
    
    console.log('\n📨 Email result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ Test email sent successfully!');
      console.log('Please check your inbox (and spam folder) for the test email.');
    } else {
      console.error('\n❌ Failed to send test email:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Error sending test email:');
    console.error(error);
  }
}

// Run the test
testEmail().catch(error => {
  console.error('Unhandled error in test:', error);
  process.exit(1);
});
