const { Pool } = require('pg');
const env = require('../config/env');

// Database connection configuration
const pool = new Pool({
  user: env.DB_USER,
  host: env.DB_HOST,
  database: env.DB_NAME,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateGiftTiers() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Updating gift tiers...');
    
    // Get tier IDs
    const tiersResult = await client.query('SELECT id, name FROM gift_tiers');
    const tierMap = {};
    tiersResult.rows.forEach(tier => {
      tierMap[tier.name.toLowerCase()] = tier.id;
    });
    
    // Update gift items with appropriate tiers
    await client.query(
      `UPDATE gift_items 
       SET tier_id = $1 
       WHERE name IN ('Virtual Rose', 'Digital Chocolate Box', 'Premium Message')`,
      [tierMap['standard']]
    );
    
    // Add some premium gifts if they don't exist
    const premiumGifts = [
      { name: 'Golden Rose', price: 19.99, tier_id: tierMap['premium'] },
      { name: 'Diamond Ring', price: 49.99, tier_id: tierMap['elite'] }
    ];
    
    for (const gift of premiumGifts) {
      // First check if the gift already exists
      const exists = await client.query(
        'SELECT 1 FROM gift_items WHERE name = $1',
        [gift.name]
      );
      
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO gift_items (name, price, tier_id, is_available)
           VALUES ($1, $2, $3, true)`,
          [gift.name, gift.price, gift.tier_id]
        );
        console.log(`Added new gift: ${gift.name}`);
      } else {
        console.log(`Gift already exists: ${gift.name}`);
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Successfully updated gift tiers');
    
    // Show the updated gift items
    const result = await client.query(
      `SELECT gi.id, gi.name, gi.price, gi.is_available, 
              gt.name as tier_name, gt.min_subscription_level 
       FROM gift_items gi 
       LEFT JOIN gift_tiers gt ON gi.tier_id = gt.id`
    );
    
    console.log('\nUpdated gift items:');
    console.table(result.rows);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating gift tiers:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
updateGiftTiers()
  .catch(console.error)
  .finally(() => process.exit(0));
