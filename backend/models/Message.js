// backend/models/Message.js

const pool = require('../config/db');

class Message {
  // Message types
  static get MESSAGE_TYPES() {
    return {
      TEXT: 'text',
      IMAGE: 'image',
      VIDEO: 'video',
      AUDIO: 'audio',
      FILE: 'file',
      LOCATION: 'location',
      EMOJI: 'emoji',
      SYSTEM: 'system'
    };
  }

  // --- NEW STATIC METHOD ---
  static async getConversationParticipants(conversationId) {
    const result = await pool.query(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [conversationId]
    );
    // Return an array of user IDs, e.g., [1, 25, 42]
    return result.rows.map(row => row.user_id);
  }

  // Create a new message
  static async create({ senderId, conversationId, content, messageType = 'text', parentMessageId = null }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const messageResult = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, parent_message_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [conversationId, senderId, content, messageType, parentMessageId]
      );
      
      const newMessage = messageResult.rows[0];

      await client.query(
        `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
        [conversationId]
      );
      
      await client.query(
        `UPDATE conversation_participants SET last_read_message_id = $1, updated_at = NOW() WHERE conversation_id = $2 AND user_id = $3`,
        [newMessage.id, conversationId, senderId]
      );
      
      await client.query('COMMIT');
      
      return await this.getById(newMessage.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get a message by ID with sender info
  static async getById(messageId) {
    const result = await pool.query(
      `SELECT m.*, 
              u.email as sender_email,
              p.first_name as sender_first_name,
              p.last_name as sender_last_name,
              COALESCE(p.profile_picture, p.profile_pic) as sender_profile_pic
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE m.id = $1 AND m.is_deleted = FALSE`,
      [messageId]
    );
    return result.rows[0] || null;
  }

  // Get messages in a conversation with pagination
  static async getByConversation(conversationId, { limit = 50, before = null } = {}) {
    let query = `
      SELECT m.*, 
             u.email as sender_email,
             p.first_name as sender_first_name,
             p.last_name as sender_last_name,
             COALESCE(p.profile_picture, p.profile_pic) as sender_profile_pic
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
    `;
    const params = [conversationId];
    if (before) {
      query += ` AND m.id < $${params.length + 1}`;
      params.push(before);
    }
    query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get conversations for a user with pagination
  static async getUserConversations(userId, { limit = 20, offset = 0 } = {}) {
    const query = `
      WITH user_conversations AS (
        SELECT conversation_id
        FROM conversation_participants
        WHERE user_id = $1
      ), last_message AS (
        SELECT DISTINCT ON (conversation_id)
          id,
          conversation_id,
          content,
          created_at
        FROM messages
        WHERE conversation_id IN (SELECT conversation_id FROM user_conversations)
        ORDER BY conversation_id, created_at DESC
      )
      SELECT
        c.id,
        c.updated_at,
        json_agg(
          json_build_object(
            'id', u.id,
            'email', u.email,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'profile_pic', COALESCE(p.profile_picture, p.profile_pic)
          )
        ) AS participants,
        lm.content as "lastMessage",
        lm.created_at as "lastMessageAt"
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN last_message lm ON c.id = lm.conversation_id
      WHERE c.id IN (SELECT conversation_id FROM user_conversations)
      GROUP BY c.id, c.updated_at, lm.content, lm.created_at
      ORDER BY c.updated_at DESC
      LIMIT $2 OFFSET $3;
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Mark messages as read
  static async markAsRead(conversationId, userId, messageId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (messageId) {
        await client.query(
          `UPDATE conversation_participants SET last_read_message_id = $1, updated_at = NOW() WHERE conversation_id = $2 AND user_id = $3 AND (last_read_message_id IS NULL OR last_read_message_id < $1)`,
          [messageId, conversationId, userId]
        );
      } else {
        await client.query(
          `UPDATE conversation_participants SET updated_at = NOW() WHERE conversation_id = $1 AND user_id = $2`,
          [conversationId, userId]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Edit a message
  static async edit(messageId, content, userId) {
    const result = await pool.query(
      `UPDATE messages SET content = $1, is_edited = TRUE, updated_at = NOW() WHERE id = $2 AND sender_id = $3 AND is_deleted = FALSE RETURNING *`,
      [content, messageId, userId]
    );
    return result.rows.length > 0 ? await this.getById(messageId) : null;
  }

  // Delete a message (soft delete)
  static async delete(messageId, userId) {
    const result = await pool.query(
      `UPDATE messages SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 AND sender_id = $2 RETURNING *`,
      [messageId, userId]
    );
    return result.rows[0] || null;
  }

  // Add a reaction to a message
  static async addReaction(messageId, userId, emoji) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`,
        [messageId, userId]
      );
      const result = await client.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) RETURNING *`,
        [messageId, userId, emoji]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Remove a reaction from a message
  static async removeReaction(messageId, userId, emoji) {
    const result = await pool.query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING *`,
      [messageId, userId, emoji]
    );
    return result.rows[0] || null;
  }

  // Get reactions for a message
  static async getReactions(messageId) {
    const result = await pool.query(
      `SELECT mr.*, p.first_name, p.last_name FROM message_reactions mr JOIN users u ON mr.user_id = u.id LEFT JOIN profiles p ON u.id = p.user_id WHERE mr.message_id = $1`,
      [messageId]
    );
    return result.rows;
  }

  // Create or get a conversation between two users
  static async getOrCreateConversation(user1Id, user2Id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existingConv = await client.query(
        `SELECT cp1.conversation_id as id FROM conversation_participants AS cp1 JOIN conversation_participants AS cp2 ON cp1.conversation_id = cp2.conversation_id WHERE cp1.user_id = $1 AND cp2.user_id = $2`,
        [user1Id, user2Id]
      );
      
      if (existingConv.rows.length > 0) {
        await client.query('COMMIT');
        return existingConv.rows[0].id;
      }
      
      const convResult = await client.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
      const conversationId = convResult.rows[0].id;
      
      await client.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [conversationId, user1Id, user2Id]
      );
      
      await client.query('COMMIT');
      return conversationId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Message;