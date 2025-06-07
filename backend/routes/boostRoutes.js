const express = require('express');
const router = express.Router();
const boostController = require('../controllers/boostController');
const { isAuthenticated, isUser } = require('../middleware/auth'); // Added isUser
const { checkSubscription, checkFeatureAccess } = require('../middleware/subscription');

// Activate a profile boost
// Assuming 'profileBoost' is the feature_key in feature_permissions table
router.post(
  '/activate',
  isAuthenticated,
  isUser, // Added isUser
  checkSubscription,
  checkFeatureAccess('profileBoost'),
  boostController.activateBoost
);

// Get current boost status
router.get(
  '/status',
  isAuthenticated,
  isUser, // Added isUser
  boostController.getBoostStatus
);

module.exports = router;
