const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const reportRoutes = require('./reportRoutes');

// Dashboard statistics
router.get('/stats', isAuthenticated, isAdmin, adminController.getDashboardStats);

// User management
router.get('/users', isAuthenticated, isAdmin, adminController.getAllUsers);
router.put('/users/:id/status', isAuthenticated, isAdmin, adminController.updateUserStatus);
router.delete('/users/:id', isAuthenticated, isAdmin, adminController.deleteUser);

// Revenue reports
router.get('/revenue', isAuthenticated, isAdmin, adminController.getRevenueStats);
router.get('/revenue/summary', isAuthenticated, isAdmin, adminController.getRevenueSummary);

// Subscription management
router.get('/subscriptions', isAuthenticated, isAdmin, adminController.getSubscriptionPlans);
router.post('/subscriptions', isAuthenticated, isAdmin, adminController.createSubscriptionPlan);
router.put('/subscriptions/:id', isAuthenticated, isAdmin, adminController.updateSubscriptionPlan);
router.delete('/subscriptions/:id', isAuthenticated, isAdmin, adminController.deleteSubscriptionPlan);

// Subscription Feature Management
router.get('/subscription-features', isAuthenticated, isAdmin, adminController.listSubscriptionFeatures);
router.post('/subscription-features', isAuthenticated, isAdmin, adminController.createSubscriptionFeature);
router.put('/subscription-features/:featureId', isAuthenticated, isAdmin, adminController.updateSubscriptionFeature);
router.delete('/subscription-features/:featureId', isAuthenticated, isAdmin, adminController.deleteSubscriptionFeature);

// Alternative subscription routes to match frontend calls
router.get('/subscription/plans', isAuthenticated, isAdmin, adminController.getSubscriptionPlans);
router.post('/subscription/plans', isAuthenticated, isAdmin, adminController.createSubscriptionPlan);
router.put('/subscription/plans/:id', isAuthenticated, isAdmin, adminController.updateSubscriptionPlan);
router.delete('/subscription/plans/:id', isAuthenticated, isAdmin, adminController.deleteSubscriptionPlan);

// Moderation
router.get('/moderation/reports', isAuthenticated, isAdmin, adminController.getReportedContent);
router.put('/moderation/reports/:id', isAuthenticated, isAdmin, adminController.updateReportStatus);

// Admin activity logs
router.get('/logs', isAuthenticated, isAdmin, adminController.getAdminLogs);

// Support tickets
router.get('/tickets', isAuthenticated, isAdmin, adminController.getTickets);

// Mount report routes
router.use('/reports', reportRoutes);

// Financials - Withdrawal Requests
router.get('/financials/withdrawal-requests', isAuthenticated, isAdmin, adminController.getWithdrawalRequests);
router.put('/financials/withdrawal-requests/:requestId', isAuthenticated, isAdmin, adminController.updateWithdrawalRequestStatus);

module.exports = router;