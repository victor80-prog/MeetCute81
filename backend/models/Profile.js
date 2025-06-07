// backend/models/Profile.js

const pool = require('../config/db');

class Profile {
  /**
   * Creates or updates a user's profile using a single, atomic "UPSERT" command.
   * This is efficient and prevents race conditions.
   * @param {object} profileDetails - Contains userId, firstName, lastName, etc.
   * @returns {object} The newly created or updated profile row from the database.
   */
  static async createOrUpdate({ userId, firstName, lastName, dob, gender, bio }) {
    const query = `
      INSERT INTO profiles (user_id, first_name, last_name, dob, gender, bio, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        dob = EXCLUDED.dob,
        gender = EXCLUDED.gender,
        bio = EXCLUDED.bio,
        updated_at = NOW()
      RETURNING *;
    `;
    const values = [userId, firstName, lastName, dob, gender, bio];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error in Profile.createOrUpdate:', error);
      throw error;
    }
  }

  /**
   * Updates just the profile picture URL for a user.
   * Also uses an "UPSERT" in case a profile record doesn't exist yet.
   * @param {number} userId - The ID of the user.
   * @param {string} pictureUrl - The path to the uploaded picture.
   * @returns {object} The user_id and new profile_picture path.
   */
  static async updateProfilePicture(userId, pictureUrl) {
    const query = `
      INSERT INTO profiles (user_id, profile_picture, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        profile_picture = EXCLUDED.profile_picture,
        updated_at = NOW()
      RETURNING user_id, profile_picture;
    `;
    try {
      const result = await pool.query(query, [userId, pictureUrl]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in Profile.updateProfilePicture:', error);
      throw error;
    }
  }

  /**
   * Finds a user's profile and associated user data by their ID.
   * @param {number} userId - The user's ID.
   * @returns {object|null} The combined profile and user data, or null if not found.
   */
  static async findByUserId(userId) {
    // Note: Your original findByUserId query had a dependency on subscription_features.
    // I've kept it but be aware of the dual feature system issue we discussed.
    const query = `
      SELECT 
        p.*, 
        u.email,
        u.role,
        u.profile_complete,
        COALESCE(
          (
            SELECT json_agg(sf.feature_name)
            FROM user_subscriptions usub
            JOIN subscription_features sf ON usub.package_id = sf.package_id
            WHERE usub.user_id = u.id AND usub.status = 'active' AND usub.end_date > NOW()
          ), 
          '[]'::json
        ) AS active_features
      FROM profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1;
    `;
    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Error in Profile.findByUserId for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Your getPotentialMatches function. No changes needed here.
   */
  static async getPotentialMatches(userId, limit = 20) {
    const query = `
       SELECT
           p.*,
           u.id as user_id,
           (COALESCE(sp.tier_level, 'Basic') = 'Elite') AS is_elite
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
       LEFT JOIN subscription_packages sp ON us.package_id = sp.id
       WHERE u.id != $1 
         AND u.is_active = true
         AND u.role != 'admin'
         AND u.profile_complete = true
         AND NOT EXISTS (
           SELECT 1 FROM likes 
           WHERE user_id = $1 AND liked_user_id = u.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM likes
           WHERE user_id = u.id AND liked_user_id = $1
         )
         AND NOT EXISTS (
           SELECT 1 FROM matches 
           WHERE (user1_id = $1 AND user2_id = u.id) OR (user1_id = u.id AND user2_id = $1)
         )
       ORDER BY is_elite DESC, RANDOM()
       LIMIT $2
    `;
    try {
      const result = await pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error(`Error in Profile.getPotentialMatches for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = Profile;