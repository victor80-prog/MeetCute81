const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const env = require('../config/env');

const createAdmin = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Admin credentials
    const email = 'admin@meetcute.com';
    const password = 'admin123'; // This will be hashed
    const role = 'admin';

    // Check if admin already exists
    const existingAdmin = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const result = await client.query(
      `INSERT INTO users (email, password, role, is_active, profile_complete) 
       VALUES ($1, $2, $3, true, true) 
       RETURNING id`,
      [email, hashedPassword, role]
    );

    const adminId = result.rows[0].id;

    // Create admin profile
    await client.query(
      `INSERT INTO profiles (user_id, first_name, last_name, dob, gender, bio) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, 'Admin', 'User', '1990-01-01', 'other', 'System Administrator']
    );

    await client.query('COMMIT');

    console.log('✅ Admin user created successfully');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Please change the password after first login');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating admin user:', err);
  } finally {
    client.release();
    process.exit(0);
  }
};

createAdmin().catch(console.error); 