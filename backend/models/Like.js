const pool = require('../config/db');

class Like {
  static async createLike(userId, likedUserId) {
    const result = await pool.query(
      `INSERT INTO likes (user_id, liked_user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, likedUserId]
    );
    return result.rows[0];
  }

  static async checkLike(userId, likedUserId) {
    const result = await pool.query(
      `SELECT * FROM likes 
       WHERE user_id = $1 AND liked_user_id = $2`,
      [userId, likedUserId]
    );
    return result.rows[0];
  }

  static async deleteLike(userId, likedUserId) {
    const result = await pool.query(
      `DELETE FROM likes 
       WHERE user_id = $1 AND liked_user_id = $2
       RETURNING *`,
      [userId, likedUserId]
    );
    return result.rows[0];
  }

  /**
   * Retrieves all users who have liked a specific user.
   * @param {number} userId - The ID of the user whose likers are to be found.
   * @returns {Promise<Array<object>>} An array of user profiles (id, first_name, profile_pic) who liked the user.
   */
  static async getUsersWhoLiked(userId) {
    try {
      const result = await pool.query(
        `SELECT u.id, p.first_name, p.profile_pic
         FROM users u
         JOIN profiles p ON u.id = p.user_id
         JOIN likes l ON u.id = l.user_id
         WHERE l.liked_user_id = $1`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error(`Error getting users who liked user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = Like; 