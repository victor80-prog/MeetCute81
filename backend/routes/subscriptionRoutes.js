const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, isUser } = require('../middleware/auth'); // Added isUser
const subscriptionController = require('../controllers/subscriptionController');

// Public routes
router.get('/packages', subscriptionController.getPackages);
router.get('/packages/:id', subscriptionController.getPackage);

// Protected routes (require authentication)
router.get('/user', isAuthenticated, isUser, subscriptionController.getUserSubscription);
// router.post('/subscribe', isAuthenticated, isUser, subscriptionController.createSubscription); // Deprecated
router.post('/purchase-with-balance', isAuthenticated, isUser, subscriptionController.purchaseWithBalance); // New route
router.post('/cancel/:subscriptionId', isAuthenticated, isUser, subscriptionController.cancelSubscription);
// router.post('/upgrade', isAuthenticated, isUser, subscriptionController.upgradeSubscription); // Deprecated
// router.post('/downgrade', isAuthenticated, isUser, subscriptionController.downgradeSubscription); // Deprecated

// Admin routes
router.post('/packages', isAuthenticated, isAdmin, subscriptionController.createPackage);
router.put('/packages/:id', isAuthenticated, isAdmin, subscriptionController.updatePackage);

module.exports = router; 