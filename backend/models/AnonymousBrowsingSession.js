const pool = require('../config/db');

class AnonymousBrowsingSession {
  /**
   * Starts a new anonymous browsing session for a user.
   * Ends any existing active session for the user before starting a new one.
   * @param {number} userId - The ID of the user.
   * @returns {Promise<object>} The created session record.
   */
  static async startSession(userId) {
    try {
      // End any existing active session first
      await this.endSession(userId);

      const result = await pool.query(
        `INSERT INTO anonymous_browsing_sessions (user_id, start_time, is_active)
         VALUES ($1, NOW(), true)
         RETURNING *`,
        [userId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error starting anonymous browsing session:', error);
      throw error;
    }
  }

  /**
   * Ends all active anonymous browsing sessions for a user.
   * @param {number} userId - The ID of the user.
   * @returns {Promise<void>}
   */
  static async endSession(userId) {
    try {
      await pool.query(
        `UPDATE anonymous_browsing_sessions
         SET is_active = false, end_time = NOW()
         WHERE user_id = $1 AND is_active = true`,
        [userId]
      );
      // No return value needed, or could return number of affected rows
    } catch (error) {
      console.error('Error ending anonymous browsing session(s):', error);
      throw error;
    }
  }

  /**
   * Retrieves the currently active anonymous browsing session for a user.
   * @param {number} userId - The ID of the user.
   * @returns {Promise<object|null>} The active session record or null if none found.
   */
  static async getActiveSession(userId) {
    try {
      const result = await pool.query(
        `SELECT * FROM anonymous_browsing_sessions
         WHERE user_id = $1 AND is_active = true
         ORDER BY start_time DESC
         LIMIT 1`, // Just in case, though startSession should prevent overlaps
        [userId]
      );
      return result.rows[0] || null;
    } catch (error)
    {
      console.error('Error getting active anonymous browsing session:', error);
      throw error;
    }
  }

  /**
   * Checks if a user currently has an active anonymous browsing session.
   * @param {number} userId - The ID of the user.
   * @returns {Promise<boolean>} True if an active session exists, false otherwise.
   */
  static async isActive(userId) {
    try {
      const activeSession = await this.getActiveSession(userId);
      return !!activeSession;
    } catch (error) {
      console.error('Error checking if anonymous browsing is active:', error);
      // Default to false in case of error to prevent unintended exposure
      return false;
    }
  }
}

module.exports = AnonymousBrowsingSession;
