const pool = require('../config/db');

/**
 * Insert an admin action log
 * @param {Object} params - Log parameters
 * @param {number} params.adminId - ID of the admin user
 * @param {string} params.action - Action taken
 * @param {number} params.targetUserId - ID of the user the action was performed on (optional)
 * @param {string} params.details - Additional details about the action
 * @returns {Promise<Object>} - The created log entry
 */
async function insertAdminLog({ adminId, action, targetUserId = null, targetType = null, targetId = null, details = null, client = null }) {
  const db = client || pool;
  try {
    const result = await db.query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [adminId, action, targetUserId, targetType, targetId, details]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Don't throw - logging should not interrupt main flow
    return null;
  }
}

/**
 * Get admin logs with pagination
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (1-based)
 * @param {number} params.limit - Items per page
 * @param {number} params.adminId - Filter by admin ID (optional)
 * @param {string} params.action - Filter by action type (optional)
 * @returns {Promise<Object>} - Paginated logs and count
 */
async function getAdminLogs({ page = 1, limit = 20, adminId = null, action = null }) {
  try {
    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = '';
    
    if (adminId) {
      params.push(adminId);
      whereClause += `WHERE admin_id = $${params.length}`;
    }
    
    if (action) {
      params.push(action);
      whereClause += whereClause ? ` AND action = $${params.length}` : `WHERE action = $${params.length}`;
    }
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM admin_logs ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalLogs = parseInt(countResult.rows[0].count);
    
    // Get paginated logs
    params.push(limit);
    params.push(offset);
    
    const logsQuery = `
      SELECT 
        al.*,
        a.email as admin_email,
        u.email as target_user_email
      FROM 
        admin_logs al
        LEFT JOIN users a ON al.admin_id = a.id
        LEFT JOIN users u ON al.target_user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    
    const logsResult = await pool.query(logsQuery, params);
    
    return {
      logs: logsResult.rows,
      total: totalLogs,
      pages: Math.ceil(totalLogs / limit),
      currentPage: page
    };
  } catch (error) {
    console.error('Error fetching admin logs:', error);
    throw error;
  }
}

module.exports = {
  insertAdminLog,
  getAdminLogs
};
