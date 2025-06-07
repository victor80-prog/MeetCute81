// backend/controllers/websocketController.js

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Use pool for DB access
const { JWT_SECRET } = require('../config/env'); // Correctly import secret

class WebSocketController {
  constructor(server) {
    if (!server) {
      throw new Error('Server instance is required for WebSocketController.');
    }
    this.wss = new WebSocket.Server({ noServer: true });
    this.clients = new Map(); // userId -> Set of WebSocket connections

    this.setupUpgradeHandler(server);
    this.setupConnectionHandler();
  }

  setupUpgradeHandler(server) {
    server.on('upgrade', (request, socket, head) => {
      const token = this.getTokenFromRequest(request);
      
      if (!token) {
        return this.denyUpgrade(socket, 'HTTP/1.1 401 Unauthorized\r\n\r\n');
      }

      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err || !decoded.id) {
          return this.denyUpgrade(socket, 'HTTP/1.1 401 Unauthorized\r\n\r\n');
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, decoded); // Pass the decoded user payload
        });
      });
    });
  }

  setupConnectionHandler() {
    this.wss.on('connection', (ws, user) => { // 'user' is the decoded JWT payload
      const userId = user.id;

      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(ws);
      console.log(`WebSocket client connected: User ${userId}`);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          // Here you can route to different handlers based on message.type
          // For now, we log it.
          console.log(`Received message from User ${userId}:`, message);
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      });

      ws.on('close', () => {
        const userSockets = this.clients.get(userId);
        if (userSockets) {
          userSockets.delete(ws);
          if (userSockets.size === 0) {
            this.clients.delete(userId);
            console.log(`WebSocket client disconnected: User ${userId} (last connection)`);
          }
        }
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for User ${userId}:`, error);
      });
    });
  }

  getTokenFromRequest(req) {
    // 1. Check Sec-WebSocket-Protocol Header (preferred method)
    const protocolHeader = req.headers['sec-websocket-protocol'];
    if (protocolHeader) {
      // The header can be "access_token, my-token-value"
      const parts = protocolHeader.split(',');
      const tokenPart = parts.find(p => p.trim().toLowerCase() !== 'access_token');
      if (tokenPart) return tokenPart.trim();
    }
    
    // 2. Fallback to URL query parameter (less secure, but an option)
    if (req.url) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (token) return token;
    }
    
    return null;
  }

  denyUpgrade(socket, response) {
    socket.write(response);
    socket.destroy();
  }

  broadcastToUser(userId, message) {
    const userSockets = this.clients.get(userId);
    if (userSockets) {
      const messageStr = JSON.stringify(message);
      userSockets.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    }
  }

  // You can add more broadcast methods here, e.g., broadcastToConversation
}

module.exports = WebSocketController;