const Subscription = require('../models/Subscription');
const pool = require('../config/db'); // Required for direct DB access in checkFeatureAccess

const checkSubscription = async (req, res, next) => {
  try {
    // Assuming req.user.id is populated by a prior authentication middleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const subscription = await Subscription.getUserSubscription(req.user.id);
    
    // The Subscription.getUserSubscription method now returns the subscription
    // with tier_level and its associated features list.
    if (!subscription || subscription.status !== 'active') {
      return res.status(403).json({
        message: 'Active subscription required.',
        // Consider a redirect or specific error code if preferred for frontend handling
        // redirect: '/pricing'
      });
    }

    // Add subscription info to request
    // req.subscription will contain { ..., tier_level: 'Premium', features: [...] }
    req.subscription = subscription;
    next();
  } catch (err) {
    console.error('Error checking subscription:', err);
    res.status(500).json({ message: 'Failed to check subscription status.' });
  }
};

// checkPremiumFeature is removed.

const checkFeatureAccess = (featureKey) => {
  return async (req, res, next) => {
    try {
      // Ensure checkSubscription has run and populated req.subscription
      if (!req.subscription || !req.subscription.tier_level) {
        // This might happen if checkSubscription didn't run or failed silently
        // Or if getUserSubscription didn't return a tier_level
        console.error('checkFeatureAccess: req.subscription or tier_level missing. Ensure checkSubscription runs first.');
        return res.status(403).json({ message: 'Subscription details not found. Access denied.' });
      }

      const userTierLevel = req.subscription.tier_level; // e.g., 'Basic', 'Premium', 'Elite'

      const permissionsResult = await pool.query(`
        SELECT feature_key, basic_access, premium_access, elite_access
        FROM feature_permissions
        WHERE feature_key = $1
      `, [featureKey]);

      if (permissionsResult.rows.length === 0) {
        return res.status(403).json({ message: `Feature '${featureKey}' not recognized or configured.` });
      }

      const permissions = permissionsResult.rows[0];
      let hasAccess = false;

      switch (userTierLevel.toLowerCase()) {
        case 'basic':
          hasAccess = permissions.basic_access;
          break;
        case 'premium':
          hasAccess = permissions.premium_access;
          break;
        case 'elite':
          hasAccess = permissions.elite_access;
          break;
        default:
          // Unknown tier level, deny access
          hasAccess = false;
      }

      if (!hasAccess) {
        return res.status(403).json({ message: `Feature '${featureKey}' is not available for your '${userTierLevel}' subscription tier.` });
      }

      next();
    } catch (err) {
      console.error(`Error checking feature access for '${featureKey}':`, err);
      res.status(500).json({ message: 'Failed to check feature access.' });
    }
  };
};

module.exports = {
  checkSubscription,
  checkFeatureAccess
  // Removed checkPremiumFeature
};