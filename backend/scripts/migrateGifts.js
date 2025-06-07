const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrateGifts = async () => {
  try {
    console.log('Starting gift tables migration...');
    
    // Gift Items table
    console.log('Creating gift_items table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gift_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image_url TEXT,
        category VARCHAR(50),
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ gift_items table created successfully');

    // User Gifts table
    console.log('Creating user_gifts table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_gifts (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        recipient_id INTEGER REFERENCES users(id),
        gift_item_id INTEGER REFERENCES gift_items(id),
        message TEXT,
        is_anonymous BOOLEAN DEFAULT FALSE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ user_gifts table created successfully');

    console.log('✅ Gift tables migration completed successfully');
  } catch (err) {
    console.error('❌ Gift tables migration failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
};

migrateGifts(); 