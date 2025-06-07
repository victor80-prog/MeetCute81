const pool = require('../config/db');

class Match {
  static async createLike({ userId, likedUserId }) {
    await pool.query(
      `INSERT INTO likes (user_id, liked_user_id)
       VALUES ($1, $2)`,
      [userId, likedUserId]
    );
  }

  static async checkMutualLike(userId, likedUserId) {
    const result = await pool.query(
      `SELECT 1 FROM likes 
       WHERE user_id = $1 AND liked_user_id = $2`,
      [likedUserId, userId]
    );
    return result.rows.length > 0;
  }

  static async createMatch(user1Id, user2Id) {
    // Ensure consistent ordering of user IDs (smaller ID is always user1_id)
    const [smallerId, largerId] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
    
    const result = await pool.query(
      'INSERT INTO matches (user1_id, user2_id) VALUES ($1, $2) RETURNING *',
      [smallerId, largerId]
    );
    return result.rows[0];
  }

  static async getUserMatches(userId) {
    const result = await pool.query(
      `SELECT m.*, 
        p1.first_name as user1_first_name, p1.last_name as user1_last_name, p1.profile_pic as user1_profile_pic,
        p2.first_name as user2_first_name, p2.last_name as user2_last_name, p2.profile_pic as user2_profile_pic
      FROM matches m
      JOIN profiles p1 ON m.user1_id = p1.user_id
      JOIN profiles p2 ON m.user2_id = p2.user_id
      WHERE m.user1_id = $1 OR m.user2_id = $1
      ORDER BY m.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async checkMatch(user1Id, user2Id) {
    const result = await pool.query(
      'SELECT * FROM matches WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)',
      [user1Id, user2Id]
    );
    return result.rows[0];
  }

  static async deleteMatch(matchId, userId) {
    const result = await pool.query(
      'DELETE FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) RETURNING *',
      [matchId, userId]
    );
    return result.rows[0];
  }
}

module.exports = Match;