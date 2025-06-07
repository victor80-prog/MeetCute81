const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { hasFeatureAccess, getUserFeatures, hasActiveSubscription } = require('../middleware/featureAccess');

// Middleware to attach user features to all authenticated routes
router.use(isAuthenticated, getUserFeatures);

// Test route to get all features the current user has access to
router.get('/my-features', (req, res) => {
  res.json({
    success: true,
    features: req.userFeatures || []
  });
});

// Test route that requires a specific feature
router.get('/premium-feature', 
  hasFeatureAccess('see_who_likes_you'),
  (req, res) => {
    res.json({
      success: true,
      message: 'You have access to this premium feature!',
      feature: 'see_who_likes_you',
      description: 'See who liked your profile'
    });
  }
);

// Test route that requires an active subscription
router.get('/subscription-required',
  isAuthenticated,
  hasActiveSubscription,
  (req, res) => {
    res.json({
      success: true,
      message: 'You have an active subscription!',
      subscription: req.activeSubscription,
      features: req.userFeatures || []
    });
  }
);

module.exports = router;
