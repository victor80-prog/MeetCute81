const pool = require('../config/db');
// Assuming you have a custom error handler utility
// If not, you might need to create one or use a simpler error response.
// For example: const AppError = (message, statusCode) => { const err = new Error(message); err.statusCode = statusCode; return err; };
const { AppError } = require('./errorHandler'); // Corrected path

const MESSAGE_LIMIT_BASIC = 10;
const SWIPE_LIMIT_BASIC = 15; // Updated as per your request

// Helper function to get current date in YYYY-MM-DD format for PostgreSQL
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const checkUsageLimit = async (req, res, next, limitType) => {
  console.log('[UsageLimits] Checking user:', req.user?.id, 'Subscription Tier:', req.user?.subscription_tier, 'Path:', req.path);
  if (!req.user || !req.user.id) {
    // Ensure req.user is populated by your authentication middleware
    return next(new AppError('User not authenticated for usage limit check', 401));
  }

  // Assuming subscription_tier is part of req.user, populated by auth middleware
  // And that 'basic' is the identifier for the free/basic tier.
  // Adjust 'basic' if your tier identifier is different (e.g., 'free', 'standard').
  const { id: userId, subscription_tier } = req.user;

  // Only Basic tier has limits
  // Premium and Elite tiers bypass all limits
  const UNLIMITED_TIERS = ['Premium', 'Elite'];
  const LIMITED_TIERS = ['Basic'];
  
  // If user has no tier or an unknown tier, default to Basic (limited)
  if (!subscription_tier || LIMITED_TIERS.includes(subscription_tier)) {
    // Continue with limit checks for Basic tier
  } else if (UNLIMITED_TIERS.includes(subscription_tier)) {
    return next(); // No limits for Premium/Elite tiers
  } else {
    // Default to Basic tier behavior for any unknown tiers
    console.warn(`Unknown subscription tier: ${subscription_tier}, applying Basic tier limits`);
  }

  const today = getTodayDate();
  let countColumn, dateColumn, limit, friendlyLimitName;

  if (limitType === 'message') {
    countColumn = 'message_count_today';
    dateColumn = 'last_message_date';
    limit = MESSAGE_LIMIT_BASIC;
    friendlyLimitName = 'message';
  } else if (limitType === 'swipe') {
    countColumn = 'swipe_count_today';
    dateColumn = 'last_swipe_date';
    limit = SWIPE_LIMIT_BASIC;
    friendlyLimitName = 'swipe';
  } else {
    console.error('Invalid limitType provided to checkUsageLimit:', limitType);
    return next(new AppError('Internal server error: Invalid limit type specified', 500));
  }

  let client;
  try {
    client = await pool.connect();
    // Get current counts and last date for the user
    const { rows } = await client.query(
      `SELECT ${countColumn}, ${dateColumn} FROM users WHERE id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      // This case should ideally not happen if req.user.id is valid
      return next(new AppError('User not found for usage limit check', 404));
    }

    let currentCount = rows[0][countColumn];
    // Ensure date comparison is robust. Convert DB date to YYYY-MM-DD string.
    const dbDate = rows[0][dateColumn];
    const lastDate = dbDate ? new Date(dbDate).toISOString().split('T')[0] : null;

    // If the last recorded date is not today, reset the count for today
    if (lastDate !== today) {
      await client.query(
        `UPDATE users SET ${countColumn} = 0, ${dateColumn} = $1 WHERE id = $2`,
        [today, userId]
      );
      currentCount = 0; // Count is now reset for today
    }

    if (currentCount >= limit) {
      const errorMessage = `You have reached your daily ${friendlyLimitName} limit of ${limit}.`;
      const upgradeMessage = ` Upgrade to Premium for unlimited ${friendlyLimitName}s.`;
      
      // Create the error with appropriate status code
      const err = new AppError(errorMessage + upgradeMessage, 429);
      err.limitExceeded = true;
      err.limitType = limitType;
      err.remaining = 0;
      err.limit = limit;
      err.tier = subscription_tier || 'Basic';
      return next(err);
    }

    // Attach info to request object for the incrementer middleware
    req.usageLimits = {
      ...req.usageLimits,
      [limitType]: {
        needsIncrement: true
      }
    };

    next();
  } catch (error) {
    console.error(`Error in checkUsageLimit for ${friendlyLimitName}s:`, error);
    return next(new AppError(`Server error while checking ${friendlyLimitName} limit`, 500));
  } finally {
    if (client) {
      client.release();
    }
  }
};

const checkMessageLimit = (req, res, next) => {
  checkUsageLimit(req, res, next, 'message');
};

const checkSwipeLimit = (req, res, next) => {
  checkUsageLimit(req, res, next, 'swipe');
};

// Middleware to increment usage count AFTER the main action (e.g., message sent, swipe recorded)
const incrementUsageCount = async (req, limitType) => {
  // Only increment if the checkUsageLimit middleware flagged it and user is basic
  if (req.user && req.user.subscription_tier === 'basic' && req.usageLimits?.[limitType]?.needsIncrement) {
    const { id: userId } = req.user;
    const countColumn = limitType === 'message' ? 'message_count_today' : 'swipe_count_today';
    // The date column should have already been set to today by checkUsageLimit if it was a new day.
    // So, we only need to increment the count.
    // However, to be absolutely safe, especially if checkUsageLimit wasn't called or had an issue,
    // explicitly setting the date is a good defensive measure.
    const dateColumn = limitType === 'message' ? 'last_message_date' : 'last_swipe_date';
    const today = getTodayDate();

    let client;
    try {
      client = await pool.connect();
      await client.query(
        `UPDATE users SET ${countColumn} = ${countColumn} + 1, ${dateColumn} = $1 WHERE id = $2`,
        [today, userId]
      );
      console.log(`UsageLimits: ${limitType} count incremented for user ${userId}.`);
    } catch (error) {
      console.error(`UsageLimits: Error incrementing ${limitType} count for user ${userId}:`, error);
      // Not propagating error to client as the main action already succeeded.
      // Logging is crucial here.
    } finally {
      if (client) {
        client.release();
      }
    }
  }
};

// These are designed to be called from your route handlers *after* the primary action is successful.
const incrementMessageCountForUser = async (req) => {
  await incrementUsageCount(req, 'message');
};

const incrementSwipeCountForUser = async (req) => {
  await incrementUsageCount(req, 'swipe');
};

module.exports = {
  checkMessageLimit,          // Middleware to use *before* processing the message sending
  checkSwipeLimit,            // Middleware to use *before* processing the swipe action
  incrementMessageCountForUser, // Function to call *after* message is sent
  incrementSwipeCountForUser,   // Function to call *after* swipe is recorded
  MESSAGE_LIMIT_BASIC,        // Exporting constants might be useful elsewhere
  SWIPE_LIMIT_BASIC
};
