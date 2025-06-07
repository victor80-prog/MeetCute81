const express = require('express');
const router = express.Router();
const anonymousBrowsingController = require('../controllers/anonymousBrowsingController');
const { isAuthenticated, isUser } = require('../middleware/auth'); // Added isUser
const { checkSubscription, checkFeatureAccess } = require('../middleware/subscription');

// Start anonymous browsing session
// Assuming 'anonymousBrowsing' is the feature_key
router.post(
  '/start',
  isAuthenticated,
  isUser, // Added isUser
  checkSubscription,
  checkFeatureAccess('anonymousBrowsing'),
  anonymousBrowsingController.startAnonymousBrowsing
);

// Stop anonymous browsing session
router.post(
  '/stop',
  isAuthenticated,
  isUser, // Added isUser
  anonymousBrowsingController.stopAnonymousBrowsing
);

// Get current anonymous browsing status
router.get(
  '/status',
  isAuthenticated,
  isUser, // Added isUser
  anonymousBrowsingController.getAnonymousBrowsingStatus
);

module.exports = router;
