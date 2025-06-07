const pool = require('../config/db');
const { insertAdminLog } = require('../utils/adminLogger');
const PaymentMethod = require('../models/PaymentMethod');
const Transaction = require('../models/Transaction'); // Added Transaction model import
const WithdrawalRequest = require('../models/WithdrawalRequest'); // Added WithdrawalRequest model

exports.getDashboardStats = async (req, res) => {
  const client = await pool.connect();
  try {
    const [
      totalUsers,
      activeSubscriptions,
      revenueData
    ] = await Promise.all([
      // Total users (excluding admins)
      client.query("SELECT COUNT(*) FROM users WHERE role != 'admin'"),
      
      // Active subscriptions count by tier
      client.query(`
        SELECT 
          COUNT(CASE WHEN sp.tier_level = 'Basic' THEN 1 END) as basic_users,
          COUNT(CASE WHEN sp.tier_level = 'Premium' THEN 1 END) as premium_users,
          COUNT(CASE WHEN sp.tier_level = 'Elite' THEN 1 END) as elite_users,
          COUNT(*) as total_active_subscriptions
        FROM user_subscriptions us
        JOIN subscription_packages sp ON us.package_id = sp.id
        WHERE us.status = 'active' AND us.end_date > NOW()
      `),
      
      // Revenue data
      client.query(`
        SELECT 
          COALESCE(SUM(
            CASE 
              WHEN t.amount > 0 THEN t.amount
              ELSE 0
            END
          ), 0) as total_revenue,
          COUNT(DISTINCT t.user_id) as paying_users
        FROM transactions t
        WHERE t.status = 'completed' 
        AND t.created_at >= NOW() - INTERVAL '30 days'
      `)
    ]);

    const activeSubs = activeSubscriptions.rows[0];
    
    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      activeUsers: parseInt(activeSubs.total_active_subscriptions) || 0,
      premiumUsers: parseInt(activeSubs.premium_users) + parseInt(activeSubs.elite_users) || 0,
      monthlyRevenue: parseFloat(revenueData.rows[0].total_revenue) || 0,
      payingUsers: parseInt(revenueData.rows[0].paying_users) || 0,
      // Additional stats that might be useful
      basicUsers: parseInt(activeSubs.basic_users) || 0,
      eliteUsers: parseInt(activeSubs.elite_users) || 0
    });
  } catch (err) {
    console.error('Error getting dashboard stats:', err);
    res.status(500).json({ message: 'Failed to get dashboard stats' });
  } finally {
    client.release();
  }
};

exports.getAllUsers = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Executing getAllUsers query...');
    const result = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.role,
        u.is_active,
        u.is_suspended,
        u.suspension_reason,
        u.suspended_at,
        u.created_at,
        p.first_name,
        p.last_name,
        u.profile_complete,
        COALESCE(
          (SELECT SUM(amount) 
           FROM transactions 
           WHERE user_id = u.id AND created_at >= NOW() - INTERVAL '30 days'
          ), 0
        ) as monthly_revenue
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      ORDER BY u.created_at DESC
    `);
    console.log(`Found ${result.rows.length} users`);

    const users = result.rows.map(user => {
      let status = 'active';
      if (user.is_suspended) {
        status = 'suspended';
      } else if (!user.is_active) {
        status = 'banned';
      }

      return {
        id: user.id,
        name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'Anonymous',
        email: user.email,
        status,
        role: user.role,
        joined: new Date(user.created_at).toISOString().split('T')[0],
        lastActive: user.profile_complete ? 'Active' : 'Never',
        revenue: parseFloat(user.monthly_revenue),
        suspension_details: user.is_suspended ? {
          reason: user.suspension_reason,
          suspended_at: user.suspended_at ? new Date(user.suspended_at).toISOString() : null
        } : null
      };
    });

    res.json(users);
  } catch (err) {
    console.error('Error getting users:', err);
    console.error('Error details:', {
      code: err.code,
      message: err.message,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
      where: err.where,
      schema: err.schema,
      table: err.table,
      column: err.column,
      dataType: err.dataType,
      constraint: err.constraint
    });
    res.status(500).json({ message: 'Failed to get users', error: err.message });
  } finally {
    client.release();
  }
};

exports.updateUserStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status, reason } = req.body;
    
    if (status === 'active') {
      // Activate user
      await client.query(
        `UPDATE users 
         SET is_active = true,
             is_suspended = false,
             suspension_reason = NULL,
             suspended_at = NULL
         WHERE id = $1`,
        [id]
      );
    } else if (status === 'suspended') {
      // Suspend user
      await client.query(
        `UPDATE users 
         SET is_active = true,
             is_suspended = true,
             suspension_reason = $2,
             suspended_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id, reason || 'Violation of community guidelines']
      );
    } else if (status === 'banned') {
      // Ban user (sets both inactive and suspended)
      await client.query(
        `UPDATE users 
         SET is_active = false,
             is_suspended = true,
             suspension_reason = $2,
             suspended_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id, reason || 'Account banned permanently']
      );
    }

    // Log the status change
    await client.query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'UPDATE_USER_STATUS', id, `Status changed to ${status}${reason ? `: ${reason}` : ''}`]
    );

    await client.query('COMMIT');
    res.json({ message: 'User status updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating user status:', err);
    res.status(500).json({ message: 'Failed to update user status' });
  } finally {
    client.release();
  }
};

exports.getRevenueStats = async (req, res) => {
  const client = await pool.connect();
  try {
    const [monthly, subscriptions, gifts] = await Promise.all([
      client.query(`
        SELECT DATE_TRUNC('month', created_at) as month,
               SUM(amount) as total
        FROM transactions
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month DESC
      `),
      client.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE item_category = 'subscription'
        AND created_at >= NOW() - INTERVAL '30 days'
      `),
      client.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE item_category = 'gift'
        AND created_at >= NOW() - INTERVAL '30 days'
      `)
    ]);

    res.json({
      monthlyTrend: monthly.rows.map(row => ({
        month: row.month,
        amount: parseFloat(row.total)
      })),
      lastMonth: {
        total: parseFloat(monthly.rows[0]?.total || 0),
        subscriptions: parseFloat(subscriptions.rows[0]?.total || 0),
        gifts: parseFloat(gifts.rows[0]?.total || 0)
      }
    });
  } catch (err) {
    console.error('Error getting revenue stats:', err);
    res.status(500).json({ message: 'Failed to get revenue stats' });
  } finally {
    client.release();
  }
};

exports.getTickets = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        u.email as user_email,
        p.first_name,
        p.last_name
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      ORDER BY t.created_at DESC
    `);

    const tickets = result.rows.map(ticket => ({
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      user: {
        id: ticket.user_id,
        email: ticket.user_email,
        name: ticket.first_name && ticket.last_name ? 
          `${ticket.first_name} ${ticket.last_name}` : 'Anonymous'
      },
      createdAt: new Date(ticket.created_at).toLocaleString(),
      updatedAt: ticket.updated_at ? new Date(ticket.updated_at).toLocaleString() : null
    }));

    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get tickets' });
  }
};

// New admin controller methods

exports.deleteUser = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Check if user exists
    const userCheck = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Log the deletion
    await insertAdminLog({
      adminId: req.user.id,
      action: 'DELETE_USER',
      targetUserId: id,
      details: `User deleted: ${userCheck.rows[0].email}`
    });
    
    // Delete user (will cascade to profiles, etc.)
    await client.query('DELETE FROM users WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Failed to delete user' });
  } finally {
    client.release();
  }
};

exports.getRevenueSummary = async (req, res) => {
  const client = await pool.connect();
  try {
    // Get revenue by time period
    const revenueByPeriod = await client.query(`
      SELECT 
        COALESCE(SUM(amount) FILTER (
          WHERE created_at >= CURRENT_DATE 
          AND status = 'completed'
        ), 0) as today,
        COALESCE(SUM(amount) FILTER (
          WHERE created_at >= (CURRENT_DATE - INTERVAL '7 days')
          AND status = 'completed'
        ), 0) as week,
        COALESCE(SUM(amount) FILTER (
          WHERE created_at >= (CURRENT_DATE - INTERVAL '30 days')
          AND status = 'completed'
        ), 0) as month,
        COALESCE(SUM(amount) FILTER (
          WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
          AND status = 'completed'
        ), 0) as year,
        COALESCE(SUM(amount) FILTER (
          WHERE status = 'completed'
        ), 0) as all_time
      FROM transactions
    `);
    
    // Get revenue by item_category
    const revenueByType = await client.query(`
      SELECT 
        item_category,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE status = 'completed'
      GROUP BY item_category
      ORDER BY total DESC
    `);
    
    // Get top spending users
    const topUsers = await client.query(`
      SELECT 
        t.user_id,
        u.email,
        p.first_name,
        p.last_name,
        COALESCE(SUM(t.amount), 0) as total_spent,
        COUNT(*) as transaction_count
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE t.status = 'completed'
      GROUP BY t.user_id, u.email, p.first_name, p.last_name
      HAVING COUNT(*) > 0
      ORDER BY total_spent DESC
      LIMIT 10
    `);
    
    res.json({
      byPeriod: {
        today: parseFloat(revenueByPeriod.rows[0].today || 0),
        week: parseFloat(revenueByPeriod.rows[0].week || 0),
        month: parseFloat(revenueByPeriod.rows[0].month || 0),
        year: parseFloat(revenueByPeriod.rows[0].year || 0),
        allTime: parseFloat(revenueByPeriod.rows[0].all_time || 0)
      },
      byType: revenueByType.rows.map(row => ({
        type: row.item_category, // Using type in response for backward compatibility
        count: parseInt(row.transaction_count),
        total: parseFloat(row.total)
      })),
      topUsers: topUsers.rows.map(user => ({
        id: user.user_id,
        email: user.email,
        name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'Anonymous',
        totalSpent: parseFloat(user.total_spent),
        transactionCount: parseInt(user.transaction_count)
      }))
    });
  } catch (err) {
    console.error('Error getting revenue summary:', err);
    res.status(500).json({ message: 'Failed to get revenue summary' });
  } finally {
    client.release();
  }
};

exports.getSubscriptionPlans = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM user_subscriptions WHERE package_id = p.id AND status = 'active') as active_subscribers,
        (SELECT json_agg(f.*) FROM subscription_features f WHERE f.package_id = p.id) as features
      FROM subscription_packages p
      ORDER BY p.price ASC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting subscription plans:', err);
    res.status(500).json({ message: 'Failed to get subscription plans' });
  }
};

exports.createSubscriptionPlan = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { name, price, billingInterval, features } = req.body;
    
    // Create package
    const packageResult = await client.query(
      `INSERT INTO subscription_packages (name, price, billing_interval, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [name, price, billingInterval || 'monthly']
    );
    
    const packageId = packageResult.rows[0].id;
    
    // Add features if provided
    if (features && features.length) {
      for (const feature of features) {
        await client.query(
          `INSERT INTO subscription_features (package_id, feature_name, feature_description)
           VALUES ($1, $2, $3)`,
          [packageId, feature.name, feature.description]
        );
      }
    }
    
    // Log the action
    await insertAdminLog({
      adminId: req.user.id,
      action: 'CREATE_SUBSCRIPTION_PLAN',
      details: `Created subscription plan: ${name} ($${price}/${billingInterval || 'monthly'})`
    });
    
    await client.query('COMMIT');
    
    res.status(201).json({
      id: packageId,
      name,
      price,
      billingInterval: billingInterval || 'monthly',
      isActive: true,
      features: features || []
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating subscription plan:', err);
    res.status(500).json({ message: 'Failed to create subscription plan' });
  } finally {
    client.release();
  }
};

exports.updateSubscriptionPlan = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, price, billingInterval, isActive, features } = req.body;
    
    // Check if plan exists
    const planCheck = await client.query('SELECT * FROM subscription_packages WHERE id = $1', [id]);
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }
    
    // Update package
    await client.query(
      `UPDATE subscription_packages 
       SET name = $1, price = $2, billing_interval = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [name, price, billingInterval, isActive, id]
    );
    
    // Handle features if provided
    if (features && features.length) {
      // Remove existing features
      await client.query('DELETE FROM subscription_features WHERE package_id = $1', [id]);
      
      // Add new features
      for (const feature of features) {
        await client.query(
          `INSERT INTO subscription_features (package_id, feature_name, feature_description)
           VALUES ($1, $2, $3)`,
          [id, feature.name, feature.description]
        );
      }
    }
    
    // Log the action
    await insertAdminLog({
      adminId: req.user.id,
      action: 'UPDATE_SUBSCRIPTION_PLAN',
      details: `Updated subscription plan ID ${id}: ${name}`
    });
    
    await client.query('COMMIT');
    
    res.json({ message: 'Subscription plan updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating subscription plan:', err);
    res.status(500).json({ message: 'Failed to update subscription plan' });
  } finally {
    client.release();
  }
};

exports.deleteSubscriptionPlan = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Check if plan exists
    const planCheck = await client.query('SELECT * FROM subscription_packages WHERE id = $1', [id]);
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }
    
    // Check if plan has active subscribers
    const subscribersCheck = await client.query(
      'SELECT COUNT(*) FROM user_subscriptions WHERE package_id = $1 AND status = $2',
      [id, 'active']
    );
    
    if (parseInt(subscribersCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete plan with active subscribers. Deactivate it instead.' 
      });
    }
    
    // Delete plan (will cascade to features)
    await client.query('DELETE FROM subscription_packages WHERE id = $1', [id]);
    
    // Log the action
    await insertAdminLog({
      adminId: req.user.id,
      action: 'DELETE_SUBSCRIPTION_PLAN',
      details: `Deleted subscription plan ID ${id}: ${planCheck.rows[0].name}`
    });
    
    await client.query('COMMIT');
    
    res.json({ message: 'Subscription plan deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting subscription plan:', err);
    res.status(500).json({ message: 'Failed to delete subscription plan' });
  } finally {
    client.release();
  }
};

exports.getReportedContent = async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        r.*,
        reporter.email as reporter_email,
        reported.email as reported_email,
        p.first_name as reported_first_name,
        p.last_name as reported_last_name,
        reviewer.email as reviewer_email
      FROM reported_content r
      JOIN users reporter ON r.reporter_id = reporter.id
      JOIN users reported ON r.reported_user_id = reported.id
      LEFT JOIN profiles p ON reported.id = p.user_id
      LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
    `;
    
    const params = [];
    
    if (status) {
      params.push(status);
      query += ' WHERE r.status = $1';
    }
    
    query += ' ORDER BY r.created_at DESC';
    
    const result = await pool.query(query, params);
    
    const reports = result.rows.map(report => ({
      id: report.id,
      type: report.type,
      reason: report.reason,
      status: report.status,
      contentId: report.content_id,
      reporter: {
        id: report.reporter_id,
        email: report.reporter_email
      },
      reportedUser: {
        id: report.reported_user_id,
        email: report.reported_email,
        name: report.reported_first_name && report.reported_last_name ? 
          `${report.reported_first_name} ${report.reported_last_name}` : 'Anonymous'
      },
      reviewer: report.reviewer_email ? {
        id: report.reviewed_by,
        email: report.reviewer_email
      } : null,
      notes: report.notes,
      createdAt: new Date(report.created_at).toLocaleString(),
      reviewedAt: report.reviewed_at ? new Date(report.reviewed_at).toLocaleString() : null
    }));
    
    res.json(reports);
  } catch (err) {
    console.error('Error getting reported content:', err);
    res.status(500).json({ message: 'Failed to get reported content' });
  }
};

exports.updateReportStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status, notes, action } = req.body;
    
    // Check if report exists
    const reportCheck = await client.query('SELECT * FROM reported_content WHERE id = $1', [id]);
    if (reportCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Update report status
    await client.query(
      `UPDATE reported_content 
       SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [status, notes, req.user.id, id]
    );
    
    // Handle action if specified
    if (action) {
      const reportedUserId = reportCheck.rows[0].reported_user_id;
      
      if (action === 'suspend') {
        await client.query(
          `UPDATE users 
           SET is_suspended = true, suspension_reason = $1, suspended_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [notes || 'Violation of community guidelines', reportedUserId]
        );
      } else if (action === 'ban') {
        await client.query(
          `UPDATE users 
           SET is_active = false, is_suspended = true, suspension_reason = $1, suspended_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [notes || 'Account banned permanently', reportedUserId]
        );
      } else if (action === 'warning') {
        // In a real app, this might send an email warning
        console.log(`Warning issued to user ${reportedUserId}`);
      }
    }
    
    // Log the action
    await insertAdminLog({
      adminId: req.user.id,
      action: 'UPDATE_REPORT_STATUS',
      targetUserId: reportCheck.rows[0].reported_user_id,
      details: `Updated report ID ${id} status to ${status}${action ? ` with action: ${action}` : ''}`
    });
    
    await client.query('COMMIT');
    
    res.json({ message: 'Report status updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating report status:', err);
    res.status(500).json({ message: 'Failed to update report status' });
  } finally {
    client.release();
  }
};

exports.getAdminLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, adminId, action, category } = req.query;
    const offset = (page - 1) * parseInt(limit);
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
    
    if (category) {
      params.push(`%${category}%`);
      whereClause += whereClause ? ` AND action ILIKE $${params.length}` : `WHERE action ILIKE $${params.length}`;
    }
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM admin_logs ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalLogs = parseInt(countResult.rows[0].count);
    
    // Get paginated logs
    params.push(parseInt(limit));
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
    
    res.json({
      logs: logsResult.rows,
      total: totalLogs,
      pages: Math.ceil(totalLogs / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (err) {
    console.error('Error getting admin logs:', err);
    res.status(500).json({ message: 'Failed to get admin logs' });
  }
};

// Payment Method Management
exports.listGlobalPaymentMethodTypes = async (req, res) => {
  try {
    const types = await PaymentMethod.getAllTypes();
    res.status(200).json(types);
  } catch (error) {
    console.error('Error in listGlobalPaymentMethodTypes:', error);
    res.status(500).json({ message: 'Error listing global payment method types', error: error.message });
  }
};

exports.createGlobalPaymentMethodType = async (req, res) => {
  try {
    const { name, code, description, isActive } = req.body; // isActive can be part of creation

    if (!name || !code) {
      return res.status(400).json({ message: 'Name and code are required for payment method type.' });
    }

    const newType = await PaymentMethod.createType({ name, code, description, isActive });
    res.status(201).json(newType);
  } catch (error) {
    console.error('Error in createGlobalPaymentMethodType:', error);
    // Check for unique constraint violation (e.g., PostgreSQL error code 23505)
    if (error.code === '23505' && error.constraint === 'payment_methods_code_key') {
      return res.status(409).json({ message: `Payment method type with code '${req.body.code.toUpperCase()}' already exists.` });
    }
    res.status(500).json({ message: 'Error creating global payment method type', error: error.message });
  }
};

exports.listCountryPaymentMethods = async (req, res) => {
  try {
    const { countryId } = req.params;
    if (isNaN(parseInt(countryId))) {
        return res.status(400).json({ message: 'Invalid country ID.' });
    }
    const methods = await PaymentMethod.getCountryPaymentMethods(parseInt(countryId));
    res.status(200).json(methods);
  } catch (error) {
    console.error('Error in listCountryPaymentMethods:', error);
    res.status(500).json({ message: 'Error listing country payment methods', error: error.message });
  }
};

exports.configureCountryPaymentMethod = async (req, res) => {
  try {
    const { countryId } = req.params;
    const cId = parseInt(countryId);
    const { paymentMethodId, isActive, priority, userInstructions, configurationDetails } = req.body;
    const pId = parseInt(paymentMethodId);

    if (isNaN(cId)) {
      return res.status(400).json({ message: 'Invalid country ID.' });
    }
    if (isNaN(pId)) {
      return res.status(400).json({ message: 'PaymentMethodId is required and must be a number.' });
    }
    if (configurationDetails !== null && typeof configurationDetails !== 'object') {
        return res.status(400).json({ message: 'ConfigurationDetails must be an object or null.' });
    }

    // The model method returns the raw upserted row.
    // We need to determine if it was a create or update for status code,
    // or just fetch the full details again.
    // For simplicity, we'll fetch details after upsert.

    await PaymentMethod.configureCountryPaymentMethod({
      countryId: cId,
      paymentMethodId: pId,
      isActive, // Will default in model if undefined
      priority, // Will default in model if undefined
      userInstructions,
      configurationDetails
    });

    // Fetch the full details to return in response
    const configuredMethodDetails = await PaymentMethod.getCountryPaymentMethodDetail(cId, pId);

    if (!configuredMethodDetails) {
        // This case should ideally not be reached if upsert was successful
        return res.status(404).json({ message: 'Configured payment method not found after operation.' });
    }

    // Simple approach: return 200 for success from POST as it's an upsert.
    // A more complex approach could try to determine if it was a create or update.
    res.status(200).json(configuredMethodDetails);

  } catch (error) {
    console.error('Error in configureCountryPaymentMethod:', error);
    // Handle potential foreign key constraint errors, e.g., if paymentMethodId doesn't exist
    if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({ message: 'Invalid paymentMethodId or countryId. Ensure they exist.' });
    }
    res.status(500).json({ message: 'Error configuring country payment method', error: error.message });
  }
};

exports.getCountryPaymentMethodDetail = async (req, res) => {
  try {
    const { countryId, paymentMethodId } = req.params;
    const cId = parseInt(countryId);
    const pId = parseInt(paymentMethodId);

    if (isNaN(cId) || isNaN(pId)) {
      return res.status(400).json({ message: 'Invalid country ID or payment method ID.' });
    }

    const detail = await PaymentMethod.getCountryPaymentMethodDetail(cId, pId);

    if (!detail) {
      return res.status(404).json({ message: 'Configured payment method not found for this country.' });
    }
    res.status(200).json(detail);
  } catch (error) {
    console.error('Error in getCountryPaymentMethodDetail:', error);
    res.status(500).json({ message: 'Error getting country payment method detail', error: error.message });
  }
};

exports.updateCountryPaymentMethodConfiguration = async (req, res) => {
  try {
    const { countryId, paymentMethodId } = req.params;
    const cId = parseInt(countryId);
    const pId = parseInt(paymentMethodId);
    const { isActive, priority, userInstructions, configurationDetails } = req.body;

    if (isNaN(cId) || isNaN(pId)) {
      return res.status(400).json({ message: 'Invalid country ID or payment method ID.' });
    }
    if (configurationDetails !== undefined && configurationDetails !== null && typeof configurationDetails !== 'object') {
        return res.status(400).json({ message: 'ConfigurationDetails must be an object or null if provided.' });
    }

    // Use the same upsert logic from the model
    await PaymentMethod.configureCountryPaymentMethod({
      countryId: cId,
      paymentMethodId: pId,
      isActive,
      priority,
      userInstructions,
      configurationDetails
    });

    const updatedMethodDetails = await PaymentMethod.getCountryPaymentMethodDetail(cId, pId);

    if (!updatedMethodDetails) {
      // If after upsert, it's still not found, this is an issue (e.g. trying to update a non-existent one without creation)
      // However, configureCountryPaymentMethod IS an upsert. So this means the method type ID itself might be invalid.
      return res.status(404).json({ message: 'Configured payment method not found or payment method type is invalid.' });
    }

    res.status(200).json(updatedMethodDetails);

  } catch (error) {
    console.error('Error in updateCountryPaymentMethodConfiguration:', error);
     if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({ message: 'Invalid paymentMethodId or countryId. Ensure they exist.' });
    }
    res.status(500).json({ message: 'Error updating country payment method configuration', error: error.message });
  }
};

exports.removeCountryPaymentMethod = async (req, res) => {
  try {
    const { countryId, paymentMethodId } = req.params;
    const cId = parseInt(countryId);
    const pId = parseInt(paymentMethodId);

    if (isNaN(cId) || isNaN(pId)) {
      return res.status(400).json({ message: 'Invalid country ID or payment method ID.' });
    }

    const deletedMethod = await PaymentMethod.removeCountryPaymentMethod(cId, pId);

    if (!deletedMethod) {
      return res.status(404).json({ message: 'Configured payment method not found for this country to remove.' });
    }

    // Respond with the deleted record or a success message
    res.status(200).json({ message: 'Payment method configuration removed successfully.', data: deletedMethod });
    // Or simply res.status(204).send(); if no content is preferred on delete
  } catch (error) {
    console.error('Error in removeCountryPaymentMethod:', error);
    res.status(500).json({ message: 'Error removing country payment method', error: error.message });
  }
};

// Admin Transaction Management
exports.listPendingVerificationTransactions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
      return res.status(400).json({ message: 'Invalid limit or offset parameters.' });
    }

    const result = await Transaction.getPendingVerification(limit, offset);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error listing pending verification transactions:', error);
    res.status(500).json({ message: 'Failed to list pending verification transactions', error: error.message });
  }
};

exports.getAdminTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const tId = parseInt(transactionId);

    if (isNaN(tId)) {
      return res.status(400).json({ message: 'Invalid transaction ID.' });
    }

    const transaction = await Transaction.getById(tId); // Use admin version getById

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }
    res.status(200).json(transaction);
  } catch (error) {
    console.error('Error getting transaction details for admin:', error);
    res.status(500).json({ message: 'Failed to get transaction details', error: error.message });
  }
};

exports.verifyTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const adminId = req.user.id; // Assuming admin user ID is available from auth middleware
    const { newStatus, adminNotes } = req.body;

    const tId = parseInt(transactionId);

    if (isNaN(tId)) {
      return res.status(400).json({ message: 'Invalid transaction ID.' });
    }
    if (newStatus !== 'completed' && newStatus !== 'declined') {
      return res.status(400).json({ message: "Invalid new status. Must be 'completed' or 'declined'." });
    }

    const client = await pool.connect();
    let updatedTransaction;
    try {
      await client.query('BEGIN');

      // Fetch transaction details to check its type and get amount/user_id
      const transactionDetails = await Transaction.getById(tId, client); // Pass client for transaction
      if (!transactionDetails) {
        throw new Error('Transaction not found');
      }

      updatedTransaction = await Transaction.verify({
        transactionId: tId,
        adminId,
        newStatus,
        adminNotes
      }, client); // Pass client for transaction

      // If it's a deposit and it's being completed, update user's balance
      const isDeposit = transactionDetails.item_category === 'deposit' || 
                        (transactionDetails.item_category === 'gift' && transactionDetails.description === 'deposit');

      if (isDeposit && newStatus === 'completed') {
        const balanceQuery = `
          INSERT INTO user_balances (user_id, balance)
          VALUES ($1, $2)
          ON CONFLICT (user_id) 
          DO UPDATE SET 
              balance = user_balances.balance + EXCLUDED.balance,
              updated_at = NOW()
          RETURNING balance;
        `;
        await client.query(balanceQuery, [
          transactionDetails.user_id,
          transactionDetails.amount
        ]);
        console.log(`Updated balance for user ${transactionDetails.user_id}. New balance after deposit ID ${tId} approval.`);
      }

      // Log admin action
      await insertAdminLog({
        adminId,
        action: 'VERIFY_TRANSACTION',
        targetType: 'transaction',
        targetId: tId,
        details: `Status set to ${newStatus}. Notes: ${adminNotes || ''}`
      }, client); // Pass client for transaction

      await client.query('COMMIT');
      res.status(200).json(updatedTransaction);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error during transaction verification or balance update:', error);
      // Re-throw to be caught by the outer catch block for consistent error response
      throw error; 
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error verifying transaction status:', error);
    if (error.message.includes('Transaction not found') ||
        error.message.includes('not in \'pending_verification\' status') ||
        error.message.includes('Invalid new status')) {
      return res.status(400).json({ message: error.message });
    }
    // Specific error for fulfillment failure if Transaction.verify throws it distinctly
    if (error.message.includes('Fulfillment failed')) {
        return res.status(500).json({ message: 'Transaction status updated, but an error occurred during service fulfillment. Please review manually.', error: error.message });
    }
    res.status(500).json({ message: 'Failed to verify transaction status', error: error.message });
  }
};

// Withdrawal Management
exports.getWithdrawalRequests = async (req, res) => {
  try {
      const { status } = req.query;
      let requests;
      if (status) {
          requests = await WithdrawalRequest.getByStatus(status);
      } else {
          requests = await WithdrawalRequest.getAll();
      }
      res.json(requests);
  } catch (error) {
      console.error('Admin: Error fetching withdrawal requests:', error.message, error.stack);
      res.status(500).json({ error: 'Failed to fetch withdrawal requests.' });
  }
};

exports.updateWithdrawalRequestStatus = async (req, res) => {
  try {
      const { requestId } = req.params;
      const { status, adminNotes } = req.body; // status: 'approved', 'processed', 'rejected'
      const adminId = req.user.id;

      if (!status || !['approved', 'processed', 'rejected'].includes(status)) {
          return res.status(400).json({ error: 'Invalid status provided. Must be one of: approved, processed, rejected.' });
      }

      const updatedRequest = await WithdrawalRequest.updateStatus({
          requestId: parseInt(requestId),
          newStatus: status,
          adminId,
          adminNotes
      });

      // Log admin action
      await insertAdminLog({
        adminId,
        action: 'UPDATE_WITHDRAWAL_STATUS',
        targetUserId: updatedRequest.user_id, // Assuming updatedRequest contains user_id
        details: `Withdrawal request ID ${updatedRequest.id} status updated to ${status}. Notes: ${adminNotes || ''}`
      });

      res.json({ message: 'Withdrawal request status updated.', request: updatedRequest });
  } catch (error) {
      console.error('Admin: Error updating withdrawal request status:', error.message, error.stack);
       if (error.message.includes('not found')) {
          return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Insufficient balance')) { // Should only occur if refund fails
          return res.status(500).json({ error: `Balance update failed during status change: ${error.message}`});
      }
      res.status(500).json({ error: 'Failed to update withdrawal request status.' });
  }
};

// --- Subscription Feature Management ---

exports.listSubscriptionFeatures = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        sf.id, 
        sf.feature_name, 
        sf.feature_description,
        sf.package_id, 
        sp.name as package_name,
        sf.premium_only, 
        sf.elite_only,
        sf.created_at
      FROM subscription_features sf
      LEFT JOIN subscription_packages sp ON sf.package_id = sp.id
      ORDER BY sf.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing subscription features:', err);
    res.status(500).json({ message: 'Failed to list subscription features' });
  } finally {
    client.release();
  }
};

exports.createSubscriptionFeature = async (req, res) => {
  const client = await pool.connect();
  try {
    // MODIFIED: premium_only and elite_only removed from destructuring
    const { feature_name, feature_description, package_id } = req.body; 

    if (!feature_name || typeof feature_name !== 'string' || feature_name.trim() === '') {
      return res.status(400).json({ message: 'Feature name is required and must be a non-empty string.' });
    }
    if (feature_description && typeof feature_description !== 'string') {
      return res.status(400).json({ message: 'Feature description must be a string.' });
    }
    if (package_id !== undefined && package_id !== null && (typeof package_id !== 'number' || !Number.isInteger(package_id))) {
       return res.status(400).json({ message: 'Package ID must be an integer or null.' });
    }
    // MODIFIED: Validation for premium_only and elite_only removed

    await client.query('BEGIN');
    // SQL query and parameters are already correct from previous successful edit
    const result = await client.query(
      `INSERT INTO subscription_features (feature_name, feature_description, package_id) 
       VALUES ($1, $2, $3) RETURNING *`,
      [feature_name.trim(), feature_description ? feature_description.trim() : null, package_id]
    );
    
    await insertAdminLog(req.user.id, 'CREATE_SUBSCRIPTION_FEATURE', null, `Created feature: ${result.rows[0].feature_name}`, client);
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating subscription feature:', err);
    res.status(500).json({ message: 'Failed to create subscription feature' });
  } finally {
    client.release();
  }
};

exports.updateSubscriptionFeature = async (req, res) => {
  const client = await pool.connect();
  try {
    const { featureId } = req.params;
    const { feature_name, feature_description, package_id, premium_only, elite_only } = req.body;

    if (!feature_name || typeof feature_name !== 'string' || feature_name.trim() === '') {
      return res.status(400).json({ message: 'Feature name is required and must be a non-empty string.' });
    }
    if (feature_description && typeof feature_description !== 'string') {
      return res.status(400).json({ message: 'Feature description must be a string.' });
    }
    if (package_id !== undefined && package_id !== null && (typeof package_id !== 'number' || !Number.isInteger(package_id))) {
       return res.status(400).json({ message: 'Package ID must be an integer or null.' });
    }
    if (typeof premium_only !== 'boolean') {
      return res.status(400).json({ message: 'premium_only must be a boolean.' });
    }
    if (typeof elite_only !== 'boolean') {
      return res.status(400).json({ message: 'elite_only must be a boolean.' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE subscription_features 
       SET feature_name = $1, feature_description = $2, package_id = $3
       WHERE id = $4 RETURNING *`,
      [feature_name.trim(), feature_description ? feature_description.trim() : null, package_id, featureId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Subscription feature not found' });
    }
    
    await insertAdminLog(req.user.id, 'UPDATE_SUBSCRIPTION_FEATURE', null, `Updated feature ID: ${featureId} to ${result.rows[0].feature_name}`, client);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating subscription feature:', err);
    res.status(500).json({ message: 'Failed to update subscription feature' });
  } finally {
    client.release();
  }
};

exports.deleteSubscriptionFeature = async (req, res) => {
  const client = await pool.connect();
  try {
    const { featureId } = req.params;
    
    await client.query('BEGIN');
    const result = await client.query('DELETE FROM subscription_features WHERE id = $1 RETURNING feature_name', [featureId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Subscription feature not found' });
    }
    
    await insertAdminLog(req.user.id, 'DELETE_SUBSCRIPTION_FEATURE', null, `Deleted feature ID: ${featureId}, Name: ${result.rows[0].feature_name}`, client);
    await client.query('COMMIT');
    res.status(200).json({ message: 'Subscription feature deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting subscription feature:', err);
    res.status(500).json({ message: 'Failed to delete subscription feature' });
  } finally {
    client.release();
  }
};