const pool = require('../config/db');

const packages = [
  {
    name: 'Basic',
    price: 9.99,
    billing_interval: 'monthly',
    features: [
      { name: 'See who likes you', description: 'View users who have liked your profile' },
      { name: 'Unlimited likes', description: 'Send unlimited likes to other users' },
      { name: 'Priority in discover feed', description: 'Get higher visibility in the discover feed' },
      { name: 'Ad-free experience', description: 'Enjoy the app without advertisements' }
    ]
  },
  {
    name: 'Premium',
    price: 19.99,
    billing_interval: 'monthly',
    features: [
      { name: 'All Basic features', description: 'Includes all features from the Basic package' },
      { name: 'Send virtual gifts', description: 'Send virtual gifts to other users' },
      { name: 'Premium profile badge', description: 'Display a premium badge on your profile' },
      { name: 'Advanced matching algorithms', description: 'Get better matches with advanced algorithms' },
      { name: 'Read receipts', description: 'See when your messages are read' },
      { name: 'Profile boost once a month', description: 'Get a profile boost once every month' }
    ]
  },
  {
    name: 'VIP',
    price: 29.99,
    billing_interval: 'monthly',
    features: [
      { name: 'All Premium features', description: 'Includes all features from the Premium package' },
      { name: 'Priority support', description: 'Get priority customer support' },
      { name: 'Profile boost weekly', description: 'Get a profile boost every week' },
      { name: 'See who viewed your profile', description: 'View users who visited your profile' },
      { name: 'Exclusive VIP events', description: 'Access to exclusive VIP events' },
      { name: 'Custom profile themes', description: 'Customize your profile with exclusive themes' }
    ]
  }
];

async function initSubscriptions() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete existing packages and features
    await client.query('DELETE FROM subscription_features');
    await client.query('DELETE FROM subscription_packages');

    // Insert packages
    for (const pkg of packages) {
      const packageResult = await client.query(`
        INSERT INTO subscription_packages (name, price, billing_interval)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [pkg.name, pkg.price, pkg.billing_interval]);

      const packageId = packageResult.rows[0].id;

      // Insert features
      for (const feature of pkg.features) {
        await client.query(`
          INSERT INTO subscription_features (package_id, feature_name, feature_description)
          VALUES ($1, $2, $3)
        `, [packageId, feature.name, feature.description]);
      }
    }

    await client.query('COMMIT');
    console.log('Successfully initialized subscription packages');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing subscription packages:', err);
  } finally {
    client.release();
  }
}

initSubscriptions().then(() => process.exit()); 