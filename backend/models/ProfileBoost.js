const pool = require('../config/db');

class ProfileBoost {
  /**
   * Activates a profile boost for a user.
   * For V1, this creates a new boost record. If multiple boosts are active,
   * getActiveUserBoost will return the one with the latest start_time or end_time.
   * A more sophisticated approach might prevent overlapping boosts or define stacking rules.
   * @param {number} userId - The ID of the user activating the boost.
   * @param {string} boostType - The type of boost (e.g., 'standard', 'super').
   * @param {number} durationHours - The duration of the boost in hours.
   * @returns {Promise<object|null>} The created boost record or null if an error occurs.
   */
  static async activate(userId, boostType, durationHours) {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    const multiplier = 1.5; // Default multiplier for V1

    try {
      const result = await pool.query(
        `INSERT INTO profile_boosts (user_id, boost_type, start_time, end_time, multiplier)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, boostType, startTime, endTime, multiplier]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error activating profile boost:', error);
      throw error; // Re-throw to be caught by controller
    }
  }

  /**
   * Retrieves the currently active profile boost for a user.
   * If multiple are technically active (e.g. overlapping), this will pick one,
   * typically the one with the latest end_time due to ordering.
   * @param {number} userId - The ID of the user.
   * @returns {Promise<object|null>} The active boost record or null if none found.
   */
  static async getActiveUserBoost(userId) {
    try {
      const result = await pool.query(
        `SELECT * FROM profile_boosts
         WHERE user_id = $1
           AND start_time <= NOW()
           AND end_time > NOW()
         ORDER BY end_time DESC, start_time DESC
         LIMIT 1`, // Ensure only one is returned if multiple somehow overlap
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting active user boost:', error);
      throw error;
    }
  }

  /**
   * Checks if a user currently has an active profile boost.
   * @param {number} userId - The ID of the user.
   * @returns {Promise<boolean>} True if an active boost exists, false otherwise.
   */
  static async isUserBoosted(userId) {
    try {
      const activeBoost = await this.getActiveUserBoost(userId);
      return !!activeBoost;
    } catch (error) {
      console.error('Error checking if user is boosted:', error);
      // In case of error, assume not boosted to be safe for matching algorithms
      return false;
    }
  }
}

module.exports = ProfileBoost;
