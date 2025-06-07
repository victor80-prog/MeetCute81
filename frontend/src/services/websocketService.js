// frontend/src/services/websocketService.js

import { getToken } from '../utils/auth'; // Assuming you have this utility

class WebSocketService {
  constructor() {
    this.socket = null;
    this.messageHandlers = new Map();
    this.connectionHandlers = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.isConnecting = false;
  }

  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  connect() {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;
    const authToken = getToken();
    
    if (!authToken) {
      console.error('No auth token for WebSocket. Connection aborted.');
      this.isConnecting = false;
      return;
    }

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host.replace(':5173', ':5000')}/api/ws`;

      this.socket = new WebSocket(wsUrl, ['access_token', authToken]);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected.');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.connectionHandlers.forEach(handler => handler(true));
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
      
      this.socket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.connectionHandlers.forEach(handler => handler(false));
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };
      
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }
  
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max WebSocket reconnection attempts reached.');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * (2 ** (this.reconnectAttempts - 1)), this.maxReconnectDelay);
    console.log(`Attempting to reconnect in ${delay}ms...`);
    
    setTimeout(() => this.connect(), delay);
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'User disconnected');
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }
  
  send(message) {
    if (!this.isConnected()) {
      console.error('WebSocket is not connected. Cannot send message.');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  on(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    const handlers = this.messageHandlers.get(type);
    handlers.add(handler);
    return () => handlers.delete(handler);
  }
  
  onConnectionChange(handler) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }
  
  handleMessage(message) {
    if (!message?.type) {
      return;
    }
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.data));
    }
  }

  // --- Convenience methods ---
  
  sendChatMessage(conversationId, content, options = {}) {
    return this.send({
      type: 'chat_message',
      data: { conversationId, content, ...options }
    });
  }
  
  sendTypingIndicator(conversationId, isTyping = true) {
    return this.send({
      type: 'typing',
      data: { conversationId, isTyping }
    });
  }
}

// Create and export a single instance of the service (Singleton pattern)
export const webSocketService = new WebSocketService();