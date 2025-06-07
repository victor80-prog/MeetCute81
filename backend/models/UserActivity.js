const pool = require('../config/db');

class UserActivity {
  static async getDailyActivity(userId) {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT * FROM user_activities 
       WHERE user_id = $1 AND activity_date = $2`,
      [userId, today]
    );
    return result.rows[0] || { user_id: userId, swipe_count: 0, message_count: 0, activity_date: today };
  }

  static async incrementSwipeCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO user_activities (user_id, swipe_count, activity_date)
       VALUES ($1, 1, $2)
       ON CONFLICT (user_id, activity_date)
       DO UPDATE SET swipe_count = user_activities.swipe_count + 1
       RETURNING *`,
      [userId, today]
    );
  }

  static async incrementMessageCount(userId) {
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO user_activities (user_id, message_count, activity_date)
       VALUES ($1, 1, $2)
       ON CONFLICT (user_id, activity_date)
       DO UPDATE SET message_count = user_activities.message_count + 1
       RETURNING *`,
      [userId, today]
    );
  }

  static async resetDailyCounts() {
    // This would typically be run by a scheduled job at midnight
    await pool.query(
      `UPDATE user_activities 
       SET swipe_count = 0, message_count = 0 
       WHERE activity_date < CURRENT_DATE`
    );
  }
}

module.exports = UserActivity;
