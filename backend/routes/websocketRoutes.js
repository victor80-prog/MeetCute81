const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const WebSocketController = require('../controllers/websocketController');

// This route is just a placeholder since WebSocket connections are handled at the server level
// The actual WebSocket upgrade is handled in the WebSocketController
router.get('/connect', isAuthenticated, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'WebSocket connection should be upgraded to WebSocket protocol'
  });
});

// Export the WebSocket controller to be used in server.js
module.exports = {
  router,
  initializeWebSocket: (server) => new WebSocketController(server)
};
