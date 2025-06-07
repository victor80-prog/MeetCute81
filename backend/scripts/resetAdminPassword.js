const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function resetAdminPassword() {
  const client = await pool.connect();
  try {
    // Generate new password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    // Update admin password
    await client.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, 'admin@meetcute.com']
    );

    console.log('Admin password has been reset successfully');
  } catch (err) {
    console.error('Error resetting admin password:', err);
  } finally {
    client.release();
    process.exit();
  }
}

resetAdminPassword();
