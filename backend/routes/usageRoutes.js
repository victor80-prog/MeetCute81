const express = require('express');
const router = express.Router();
const { isAuthenticated, isUser } = require('../middleware/auth');
const usageController = require('../controllers/usageController');

// Get current user's usage data
router.get('/', isAuthenticated, isUser, usageController.getUsage);

// Admin-only route to reset daily counts (typically called by a scheduled job)
router.post('/reset', isAuthenticated, usageController.resetDailyCounts);

module.exports = router;
