const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  user: env.DB_USER,
  host: env.DB_HOST,
  database: 'postgres', // Connect to default postgres database first
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
});

async function createDatabaseIfNotExists() {
  try {
    // Check if database exists
    const result = await pool.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [env.DB_NAME]);

    if (result.rows.length === 0) {
      // Create database if it doesn't exist
      await pool.query(`CREATE DATABASE ${env.DB_NAME}`);
      console.log(`✅ Database ${env.DB_NAME} created`);
    } else {
      console.log(`✅ Database ${env.DB_NAME} already exists`);
    }
  } catch (err) {
    console.error('❌ Error checking/creating database:', err);
    throw err;
  }
}

async function runMigrations() {
  try {
    // First, ensure database exists
    await createDatabaseIfNotExists();

    // Connect to the actual database
    const dbPool = new Pool({
      user: env.DB_USER,
      host: env.DB_HOST,
      database: env.DB_NAME,
      password: env.DB_PASSWORD,
      port: env.DB_PORT,
    });

    // Create users table first
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('user', 'premium', 'staff', 'admin')) DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        profile_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    // Create profiles table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        bio TEXT,
        last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Profiles table created');

    // Create transactions table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('subscription', 'gift')),
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Transactions table created');

    // Create admin_logs table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Admin logs table created');

    // Create reported content table
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS reported_content (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reported_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('profile', 'photo', 'message', 'activity')),
        content_id INTEGER,
        reason TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE
      );
    `);
    console.log('✅ Reported content table created');

    // Create subscription tables
    await dbPool.query(`
      -- Create subscription_packages table
      CREATE TABLE IF NOT EXISTS subscription_packages (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create subscription_features table
      CREATE TABLE IF NOT EXISTS subscription_features (
          id SERIAL PRIMARY KEY,
          package_id INTEGER REFERENCES subscription_packages(id) ON DELETE CASCADE,
          feature_name VARCHAR(200) NOT NULL,
          feature_description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create user_subscriptions table
      CREATE TABLE IF NOT EXISTS user_subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          package_id INTEGER REFERENCES subscription_packages(id) ON DELETE RESTRICT,
          status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
          start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          end_date TIMESTAMP WITH TIME ZONE NOT NULL,
          auto_renew BOOLEAN DEFAULT true,
          payment_method_id VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create subscription_transactions table
      CREATE TABLE IF NOT EXISTS subscription_transactions (
          id SERIAL PRIMARY KEY,
          subscription_id INTEGER REFERENCES user_subscriptions(id) ON DELETE SET NULL,
          amount DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'completed',
          payment_method VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_subscription_packages_active ON subscription_packages(is_active);
      CREATE INDEX IF NOT EXISTS idx_subscription_features_package ON subscription_features(package_id);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_subscription_transactions_subscription ON subscription_transactions(subscription_id);
    `);
    console.log('✅ Subscription tables created');

    // Create indexes
    await dbPool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_target_user_id ON admin_logs(target_user_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_reported_content_type ON reported_content(type);
      CREATE INDEX IF NOT EXISTS idx_reported_content_status ON reported_content(status);
      CREATE INDEX IF NOT EXISTS idx_reported_content_reporter ON reported_content(reporter_id);
      CREATE INDEX IF NOT EXISTS idx_reported_content_reported_user ON reported_content(reported_user_id);
    `);
    console.log('✅ Indexes created');

    // Insert admin user if it doesn't exist
    await dbPool.query(`
      INSERT INTO users (email, password, role, is_active, profile_complete)
      VALUES (
        'admin@meetcute.com',
        '$2a$10$YourHashedPasswordHere',
        'admin',
        true,
        true
      )
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log('✅ Admin user created/verified');

    // Insert sample data
    await dbPool.query(`
      -- Insert sample reported content
      INSERT INTO reported_content (reporter_id, reported_user_id, type, reason, status)
      SELECT 
          u1.id as reporter_id,
          u2.id as reported_user_id,
          CASE floor(random() * 4)
              WHEN 0 THEN 'profile'
              WHEN 1 THEN 'photo'
              WHEN 2 THEN 'message'
              ELSE 'activity'
          END as type,
          CASE floor(random() * 4)
              WHEN 0 THEN 'Inappropriate content'
              WHEN 1 THEN 'Harassment'
              WHEN 2 THEN 'Spam'
              ELSE 'Suspicious behavior'
          END as reason,
          'pending' as status
      FROM 
          users u1 
          CROSS JOIN users u2
      WHERE 
          u1.id != u2.id 
          AND u1.role != 'admin' 
          AND u2.role != 'admin'
      LIMIT 50
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Sample data inserted');

    await dbPool.end();
    console.log('✅ All migrations completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();