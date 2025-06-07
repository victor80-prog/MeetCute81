const express = require('express');
const router = express.Router();
const videoChatController = require('../controllers/videoChatController');
const { isAuthenticated, isUser } = require('../middleware/auth'); // Added isUser
const { checkSubscription, checkFeatureAccess } = require('../middleware/subscription');

// Assuming 'videoChat' is the feature_key

// Initiate a video call
router.post(
  '/initiate',
  isAuthenticated,
  isUser, // Added isUser
  checkSubscription,
  checkFeatureAccess('videoChat'),
  videoChatController.initiateVideoCall
);

// Accept a video call
router.post(
  '/accept', // Consider using a path parameter like /accept/:callId
  isAuthenticated,
  isUser, // Added isUser
  checkSubscription,
  checkFeatureAccess('videoChat'),
  videoChatController.acceptVideoCall
);

// Handle signaling messages (SDP, ICE candidates)
router.post(
  '/signal', // Consider using a path parameter like /signal/:callId
  isAuthenticated,
  isUser, // Added isUser
  checkSubscription,
  checkFeatureAccess('videoChat'),
  videoChatController.handleVideoCallSignaling
);

// End a video call
router.post(
  '/end', // Consider using a path parameter like /end/:callId
  isAuthenticated,
  isUser, // Added isUser
  checkSubscription,
  checkFeatureAccess('videoChat'),
  videoChatController.endVideoCall
);

module.exports = router;
