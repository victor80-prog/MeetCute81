const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Protect all routes in this file
router.use(isAuthenticated);
router.use(isAdmin);

// Get transactions pending verification
router.get('/pending-verification', adminController.listPendingVerificationTransactions);

// Get details of a specific transaction
router.get('/:transactionId', adminController.getAdminTransactionDetails);

// Verify or update status of a transaction
router.put('/:transactionId/verify', adminController.verifyTransactionStatus);

module.exports = router;
