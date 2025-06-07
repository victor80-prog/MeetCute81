const pool = require('../config/db');

class ProfileView {
  // Record a profile view
  static async recordView(profileUserId, viewerId) {
    try {
      // Don't record self-views or views by admin users
      if (profileUserId === viewerId) {
        return null;
      }
      
      // Check if the viewer is an admin
      const userQuery = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [viewerId]
      );
      
      if (userQuery.rows.length > 0 && userQuery.rows[0].role === 'admin') {
        return null; // Don't record admin views
      }
      
      // Record the view - this will only insert once per day due to the unique constraint
      // The unique constraint in DB is on (viewer_id, viewed_user_id, viewed_date)
      // viewed_date defaults to CURRENT_DATE.
      // The conflict target (viewed_user_id, viewer_id, CAST(viewed_at AS DATE)) effectively
      // checks for uniqueness per day based on the viewed_at timestamp.
      const result = await pool.query(
        `INSERT INTO profile_views (viewed_user_id, viewer_id, viewed_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (viewed_user_id, viewer_id, CAST(viewed_at AS DATE))
         DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [profileUserId, viewerId]
      );
      
      return result.rows[0];
    } catch (err) {
      console.error('Error recording profile view:', err);
      return null;
    }
  }
  
  // Get view count for a profile
  static async getViewCount(profileUserId) {
    try {
      const result = await pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '24 hours') AS today,
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days') AS week,
          COUNT(*) AS total
        FROM profile_views 
        WHERE viewed_user_id = $1`,
        [profileUserId]
      );
      
      return {
        today: parseInt(result.rows[0].today || 0),
        week: parseInt(result.rows[0].week || 0),
        total: parseInt(result.rows[0].total || 0)
      };
    } catch (err) {
      console.error('Error getting profile view count:', err);
      return { today: 0, week: 0, total: 0 };
    }
  }
}

module.exports = ProfileView;
