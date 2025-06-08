// frontend/src/services/chatService.js

import api from './api';

const sendMessage = async (conversationId, content, options = {}) => {
  try {
    // --- FIX: Build the payload dynamically ---
    const payload = {
      conversationId,
      content,
      messageType: options.messageType || 'text',
    };

    // Only include parentMessageId if it's a valid number
    if (options.parentMessageId && !isNaN(parseInt(options.parentMessageId))) {
      payload.parentMessageId = options.parentMessageId;
    }
    // If parentMessageId is null or undefined, the key won't be sent,
    // and the backend's .optional() validator will work correctly.

    const response = await api.post('/api/messages/send', payload);
    return response.data; // Should return { success: true, data: messageObject }
  } catch (error) {
    // Axios wraps the error, so we re-throw it to be handled by the component
    throw error;
  }
};

const chatService = {
  sendMessage,
};

export default chatService;