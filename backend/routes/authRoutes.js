const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');

// Authentication routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/resend-verification', authController.resendVerification);
router.get('/me', isAuthenticated, authController.getCurrentUser);
router.post('/refresh-token', authController.refreshToken);

// Email verification
router.get('/verify-email', authController.verifyEmail);

module.exports = router;