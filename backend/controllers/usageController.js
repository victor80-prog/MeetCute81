const UserActivity = require('../models/UserActivity');
const User = require('../models/User');
const logger = require('../utils/logger');

// Define free tier limits
const FREE_TIER_LIMITS = {
  dailySwipes: 50,
  dailyMessages: 10
};

/**
 * Get the current user's usage limits and remaining counts
 */
exports.getUsage = async (req, res) => {
  let user; // Declare user at function scope
  
  try {
    logger.info('getUsage called', { 
      userId: req.user?.id,
      user: req.user,
      headers: req.headers
    });
    
    if (!req.user || !req.user.id) {
      logger.error('No user in request', { 
        user: req.user,
        headers: req.headers
      });
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    const userId = req.user.id;
    
    // Get user's subscription tier
    logger.info('Fetching user', { userId });
    try {
      user = await User.findByPk(userId);
      if (!user) {
        logger.error('User not found in database', { userId });
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      logger.info('User found', { 
        userId: user.id, 
        subscriptionTier: user.subscription_tier,
        userData: user
      });
      
      // Attach user data to request for use in other middleware
      req.userData = user;
    } catch (userError) {
      logger.error('Error fetching user', { 
        error: userError.message,
        stack: userError.stack,
        userId
      });
      return res.status(500).json({
        success: false,
        error: 'Error fetching user data',
        details: process.env.NODE_ENV === 'development' ? userError.message : undefined
      });
    }

    // Get today's activity
    logger.info('Fetching daily activity', { userId });
    let activity;
    try {
      activity = await UserActivity.getDailyActivity(userId);
      logger.info('Activity data', { activity });
    } catch (activityError) {
      logger.error('Error getting daily activity', { 
        error: activityError.message,
        stack: activityError.stack 
      });
      throw activityError;
    }
    
    // Check if user is on a limited tier (Basic)
    const isLimitedTier = !user.subscription_tier || 
                         user.subscription_tier === 'Basic';
    
    // Default to Basic tier if not set
    const subscriptionTier = user.subscription_tier || 'Basic';
    
    res.json({
      success: true,
      data: {
        subscriptionTier,
        limits: {
          dailySwipes: isLimitedTier ? FREE_TIER_LIMITS.dailySwipes : null,
          dailyMessages: isLimitedTier ? FREE_TIER_LIMITS.dailyMessages : null,
          remainingSwipes: isLimitedTier ? Math.max(0, FREE_TIER_LIMITS.dailySwipes - (activity.swipe_count || 0)) : null,
          remainingMessages: isLimitedTier ? Math.max(0, FREE_TIER_LIMITS.dailyMessages - (activity.message_count || 0)) : null,
          isUnlimited: !isLimitedTier
        }
      }
    });
    
  } catch (err) {
    console.error('Error getting usage data:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get usage data',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Reset daily counts for all users (admin only)
 * This would typically be called by a scheduled job
 */
exports.resetDailyCounts = async (req, res) => {
  try {
    // This would typically be called by a scheduled job at midnight
    await UserActivity.resetDailyCounts();
    
    res.json({
      success: true,
      message: 'Daily counts reset successfully'
    });
    
  } catch (err) {
    console.error('Error resetting daily counts:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to reset daily counts',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
