// backend/middleware/auth.js

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const pool = require('../config/db');

const isAuthenticated = async (req, res, next) => {
  try {
    console.log('Auth middleware - Headers:', req.headers);
    let token = req.header('x-auth-token');
    
    if (!token) {
      const authHeader = req.header('Authorization');
      console.log('Auth middleware - Authorization header:', authHeader);
      
      if (!authHeader) {
        console.log('Auth middleware - No token found in request');
        return res.status(401).json({ message: 'No token, authorization denied' });
      }
      token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      console.log('Auth middleware - Extracted token:', token ? `${token.substring(0, 10)}...` : 'none');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      console.error('Token verification failed:', err.message);
      return res.status(401).json({ message: 'Token is not valid', error: err.message });
    }
    
    // --- GUARANTEED CORRECT SQL QUERY ---
    // This query uses a subquery with a unique alias ('active_tier') to avoid conflicts
    // with the 'users.subscription_tier' column. It guarantees we get the correct,
    // prioritized, active tier.
    const query = `
      SELECT 
          u.id, 
          u.email, 
          u.role, 
          u.is_active, 
          u.is_suspended,
          u.suspension_reason,
          u.suspended_at,
          u.message_count_today,
          u.last_message_date,
          u.profile_complete, -- Added profile_complete
          -- Use COALESCE on our reliable subquery result
          COALESCE(sub.active_tier, 'Basic') as subscription_tier 
      FROM users u
      LEFT JOIN (
          SELECT 
              user_id, 
              tier_level as active_tier -- Use a unique alias
          FROM user_subscriptions
          WHERE user_id = $1
            AND status = 'active'
            AND end_date > NOW()
          ORDER BY
              CASE
                  WHEN tier_level = 'Elite' THEN 1
                  WHEN tier_level = 'Premium' THEN 2
                  ELSE 3
              END
          LIMIT 1
      ) AS sub ON u.id = sub.user_id
      WHERE u.id = $1;
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query, [decoded.id]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'User not found' });
      }

      const user = result.rows[0];
      
      if (user.is_suspended) {
        return res.status(403).json({
          message: 'Account suspended',
          error: 'Account suspended',
          reason: user.suspension_reason || 'Account access restricted.',
          status: 'suspended'
        });
      }

      if (!user.is_active) {
        return res.status(403).json({ message: 'Account is not active', error: 'Account not active', status: 'inactive' });
      }

      // Profile completion check - skip if this is a profile setup request
      const isProfileSetup = req.header('X-Profile-Setup') === 'true';
      
      // Skip profile completion check for profile setup requests
      if (user.profile_complete === false && !isProfileSetup) {
        const allowedPaths = [
          '/api/auth/logout',
          '/api/auth/me',
          '/api/auth/refresh-token',
          // Allow all profile-related endpoints during setup
          /^\/api\/profile/,
          /^\/profile/
        ];

        const isPathAllowed = allowedPaths.some(path => {
          if (path instanceof RegExp) {
            return path.test(req.originalUrl);
          }
          return req.originalUrl === path;
        });

        if (!isPathAllowed) {
          return res.status(403).json({
            success: false,
            error: 'Profile setup required',
            code: 'PROFILE_SETUP_REQUIRED',
            requiresProfileSetup: true
          });
        }
      }

      req.user = user;
      next();
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
};

const isUser = (req, res, next) => {
  if (req.user && req.user.role === 'user') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. This action is for users only.' });
  }
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isUser
};