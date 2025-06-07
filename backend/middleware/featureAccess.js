const { Pool } = require('pg');
const pool = require('../config/db');

/**
 * Middleware to check if the user has access to a specific feature
 * @param {string} featureName - The name of the feature to check access for
 * @returns {Function} - Express middleware function
 */
function hasFeatureAccess(featureName) {
  return async (req, res, next) => {
    // Skip check if user is admin
    if (req.user && req.user.role === 'admin') {
      return next();
    }

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    let client;
    
    try {
      client = await pool.connect();
      
      // Debug log the user ID and feature being checked
      console.log(`🔍 Checking feature access - User ID: ${req.user.id}, Feature: ${featureName}`);
      
      // Check if the user has an active subscription with the required feature
      const query = `
        SELECT 1
        FROM user_subscriptions us
        JOIN subscription_packages sp ON us.package_id = sp.id
        JOIN subscription_features sf ON sp.id = sf.package_id
        WHERE us.user_id = $1
          AND us.status = 'active'
          AND (us.end_date IS NULL OR us.end_date > NOW())
          AND sf.feature_name = $2
        LIMIT 1;
      `;
      
      console.log('Executing query:', query.replace(/\s+/g, ' ').trim());
      console.log('With params:', [req.user.id, featureName]);
      
      const result = await client.query(query, [req.user.id, featureName]);
      
      console.log('Query result:', { rowCount: result.rowCount, rows: result.rows });
      
      if (result.rows.length === 0) {
        // User doesn't have access to this feature
        console.log(`❌ Access denied - User ${req.user.id} doesn't have access to feature: ${featureName}`);
        return res.status(403).json({ 
          success: false, 
          message: 'This feature requires a premium subscription',
          requiredFeature: featureName,
          upgradeRequired: true
        });
      }
      
      console.log(`✅ Access granted - User ${req.user.id} has access to feature: ${featureName}`);
      // User has access, continue to the next middleware/route handler
      next();
      
    } catch (error) {
      console.error('❌ Error checking feature access:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        where: error.where,
        schema: error.schema,
        table: error.table,
        column: error.column,
        dataType: error.dataType,
        constraint: error.constraint
      });
      
      res.status(500).json({ 
        success: false, 
        message: `Error checking subscription status: ${error.message}`,
        error: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          detail: error.detail,
          hint: error.hint
        } : undefined
      });
    } finally {
      if (client) {
        try {
          await client.release();
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
    }
  };
}

/**
 * Middleware to get all features the current user has access to
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function getUserFeatures(req, res, next) {
  // Skip if user is not authenticated
  if (!req.user || !req.user.id) {
    return next();
  }

  const client = await pool.connect();
  
  try {
    // Get all features the user has access to through their active subscriptions
    const query = `
      SELECT DISTINCT sf.feature_name, sf.feature_description
      FROM user_subscriptions us
      JOIN subscription_packages sp ON us.package_id = sp.id OR us.tier_level = sp.tier_level
      JOIN subscription_features sf ON sp.id = sf.package_id
      WHERE us.user_id = $1
        AND us.status = 'active'
        AND (us.end_date IS NULL OR us.end_date > NOW())
      ORDER BY sf.feature_name;
    `;
    
    const result = await client.query(query, [req.user.id]);
    
    // Attach features to the request object for use in route handlers
    req.userFeatures = result.rows.map(row => ({
      name: row.feature_name,
      description: row.feature_description
    }));
    
    next();
    
  } catch (error) {
    console.error('Error fetching user features:', error);
    // Don't fail the request, just continue without features
    next();
  } finally {
    client.release();
  }
}

/**
 * Middleware to check if user has any active subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function hasActiveSubscription(req, res, next) {
  // Skip check if user is admin
  if (req.user && req.user.role === 'admin') {
    console.log('🛡️  Admin user, skipping subscription check');
    return next();
  }

  // Check if user is authenticated
  if (!req.user || !req.user.id) {
    console.log('🔒 Unauthenticated request to protected route');
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }

  let client;
  
  try {
    client = await pool.connect();
    console.log(`🔍 Checking active subscription for user ID: ${req.user.id}`);
    
    // Check if the user has any active subscription
    const query = `
      SELECT us.*, sp.name as package_name, sp.tier_level
      FROM user_subscriptions us
      JOIN subscription_packages sp ON us.package_id = sp.id
      WHERE us.user_id = $1
        AND us.status = 'active'
        AND (us.end_date IS NULL OR us.end_date > NOW())
      LIMIT 1;
    `;
    
    console.log('Executing subscription check query:', query.replace(/\s+/g, ' ').trim());
    console.log('With params:', [req.user.id]);
    
    const result = await client.query(query, [req.user.id]);
    console.log('Subscription check result:', { rowCount: result.rowCount, rows: result.rows });
    
    if (result.rows.length === 0) {
      // User doesn't have an active subscription
      console.log(`❌ No active subscription found for user ${req.user.id}`);
      return res.status(403).json({ 
        success: false, 
        message: 'An active subscription is required',
        upgradeRequired: true
      });
    }
    
    // Attach subscription details to the request for use in route handlers
    req.activeSubscription = result.rows[0];
    console.log(`✅ Active subscription found for user ${req.user.id}:`, 
      `Package: ${result.rows[0].package_name} (${result.rows[0].tier_level})`);
    
    // User has an active subscription, continue
    next();
    
  } catch (error) {
    console.error('❌ Error checking subscription status:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint
    });
    
    res.status(500).json({ 
      success: false, 
      message: `Error checking subscription status: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint
      } : undefined
    });
  } finally {
    if (client) {
      try {
        await client.release();
      } catch (releaseError) {
        console.error('Error releasing client:', releaseError);
      }
    }
  }
}

module.exports = {
  hasFeatureAccess,
  getUserFeatures,
  hasActiveSubscription
};
