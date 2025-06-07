const express = require('express');
const router = express.Router();
const { isAuthenticated, isUser } = require('../middleware/auth'); // Added isUser
const dashboardController = require('../controllers/dashboardController');

// Get dashboard stats
router.get('/stats', isAuthenticated, isUser, dashboardController.getUserStats); // Added isUser

// Get recent activity
router.get('/activity', isAuthenticated, isUser, dashboardController.getRecentActivity); // Added isUser

module.exports = router;
