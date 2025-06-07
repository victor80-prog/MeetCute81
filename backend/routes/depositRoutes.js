const express = require('express');
const router = express.Router();
const depositController = require('../controllers/depositController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Protect all routes in this file
router.use(isAuthenticated);

// User deposit routes
router.post('/initiate', depositController.initiateDeposit);
router.post('/verify', depositController.verifyDeposit);
router.get('/', depositController.listDeposits);

// Admin routes (with additional admin middleware)
router.get('/admin/pending-verification', isAdmin, depositController.listPendingVerificationDeposits);
router.post('/admin/:transactionId/verify', isAdmin, depositController.verifyDepositByAdmin);

module.exports = router;
