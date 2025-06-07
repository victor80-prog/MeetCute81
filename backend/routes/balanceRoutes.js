const express = require('express');
const router = express.Router();
const { isAuthenticated, isUser } = require('../middleware/auth');
const balanceController = require('../controllers/balanceController');

router.get('/', isAuthenticated, isUser, balanceController.getUserBalance);
router.post('/withdraw', isAuthenticated, isUser, balanceController.requestWithdrawal);
router.get('/withdrawals', isAuthenticated, isUser, balanceController.getUserWithdrawalRequests);

module.exports = router;
