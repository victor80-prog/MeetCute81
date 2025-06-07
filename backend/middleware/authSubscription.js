const Subscription = require('../models/Subscription');

// Define the hierarchy of subscription tiers
const tierHierarchy = {
  'Basic': 1,
  'Premium': 2,
  'Elite': 3
};

/**
 * Middleware to check if a user has the required subscription tier.
 * @param {string} requiredTierName - The minimum tier name required (e.g., 'Premium', 'Elite').
 */
const requireTier = (requiredTierName) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required. No user found in request.' });
    }

    const userId = req.user.id;
    const requiredLevel = tierHierarchy[requiredTierName];

    if (!requiredLevel) {
      console.error(`Invalid tier name "${requiredTierName}" used in requireTier middleware.`);
      return res.status(500).json({ message: 'Server configuration error regarding subscription tiers.' });
    }

    try {
      const userSubscription = await Subscription.getUserSubscription(userId);

      if (!userSubscription || !userSubscription.tier_level) {
        return res.status(403).json({
          message: `Access denied. A '${requiredTierName}' subscription or higher is required for this feature. You have no active subscription.`
        });
      }

      const userLevel = tierHierarchy[userSubscription.tier_level];

      if (!userLevel) {
        console.error(`User ID ${userId} has an invalid tier_level "${userSubscription.tier_level}" in their active subscription.`);
        return res.status(403).json({
          message: 'Access denied. Your current subscription tier is unrecognized.'
        });
      }

      if (userLevel >= requiredLevel) {
        // User has the required tier or higher
        req.subscription = userSubscription; // Optionally attach subscription details to request
        next();
      } else {
        return res.status(403).json({
          message: `Access denied. A '${requiredTierName}' subscription or higher is required. Your current tier is '${userSubscription.tier_level}'.`
        });
      }
    } catch (error) {
      console.error('Error in requireTier middleware:', error);
      return res.status(500).json({ message: 'Server error while verifying subscription.' });
    }
  };
};

module.exports = { requireTier };
