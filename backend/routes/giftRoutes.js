const express = require('express');
const { isAuthenticated, isAdmin, isUser } = require('../middleware/auth'); // Added isUser
const router = express.Router();
const giftController = require('../controllers/giftController');

// Gift Items Routes (Admin only)
router.get('/items', giftController.getAllGiftItems);
router.get('/items/:id', giftController.getGiftItemById);
router.post('/items', isAuthenticated, isAdmin, giftController.createGiftItem);
router.put('/items/:id', isAuthenticated, isAdmin, giftController.updateGiftItem);

// User Gifts Routes
router.post('/send', isAuthenticated, isUser, giftController.sendGift); // Added isUser
router.get('/received', isAuthenticated, isUser, giftController.getReceivedGifts); // Added isUser
router.get('/sent', isAuthenticated, isUser, giftController.getSentGifts); // Added isUser
router.put('/read/:id', isAuthenticated, isUser, giftController.markGiftAsRead); // Added isUser
router.get('/unread-count', isAuthenticated, isUser, giftController.getUnreadGiftCount); // Added isUser
router.post('/received/:userGiftId/redeem', isAuthenticated, isUser, giftController.redeemReceivedGift);

module.exports = router; 