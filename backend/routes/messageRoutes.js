// backend/routes/messageRoutes.js

const express = require('express');
const router = express.Router();
const { isAuthenticated, isUser } = require('../middleware/auth');
const messageController = require('../controllers/messageController');
const Message = require('../models/Message');
const { body, param } = require('express-validator');

// Validation middleware
const validateMessageContent = [
  body('content').trim().notEmpty().withMessage('Message content is required')
];

// Conversation routes
router.get(
  '/conversation/:userId',
  isAuthenticated,
  isUser,
  param('userId').isInt().withMessage('Invalid user ID'),
  messageController.getOrCreateConversation
);

router.get(
  '/conversations',
  isAuthenticated,
  isUser,
  messageController.getConversations
);

// Message routes
router.get(
  '/:conversationId/messages',
  isAuthenticated,
  isUser,
  param('conversationId').isInt().withMessage('Invalid conversation ID'),
  messageController.getMessages
);

router.post(
  '/send',
  isAuthenticated,
  isUser,
  // REMOVED: checkMessageLimit middleware. Logic is now in the controller.
  [
    body('conversationId').isInt().withMessage('Invalid conversation ID'),
    body('content').trim().notEmpty().withMessage('Message content is required'),
    body('messageType').optional().isIn(Object.values(Message.MESSAGE_TYPES)).withMessage('Invalid message type'),
    body('parentMessageId').optional().isInt().withMessage('Invalid parent message ID')
  ],
  messageController.sendMessage
);

router.put(
  '/read',
  isAuthenticated,
  isUser,
  [
    body('conversationId').isInt().withMessage('Conversation ID is required'),
    body('messageId').optional().isInt().withMessage('Invalid message ID')
  ],
  messageController.markAsRead
);

router.put(
  '/:messageId',
  isAuthenticated,
  isUser,
  [
    param('messageId').isInt().withMessage('Invalid message ID'),
    body('content').trim().notEmpty().withMessage('Message content is required')
  ],
  messageController.editMessage
);

router.delete(
  '/:messageId',
  isAuthenticated,
  isUser,
  param('messageId').isInt().withMessage('Invalid message ID'),
  messageController.deleteMessage
);

// Reaction routes
router.post(
  '/:messageId/reactions',
  isAuthenticated,
  isUser,
  [
    param('messageId').isInt().withMessage('Invalid message ID'),
    body('emoji').notEmpty().withMessage('Emoji is required'),
    body('action').optional().isIn(['add', 'remove']).withMessage('Invalid action')
  ],
  messageController.reactToMessage
);

router.get(
  '/:messageId/reactions',
  isAuthenticated,
  isUser,
  param('messageId').isInt().withMessage('Invalid message ID'),
  messageController.getMessageReactions
);

module.exports = router;