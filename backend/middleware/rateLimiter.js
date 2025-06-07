// In-memory store for request timestamps
// Not suitable for production with multiple server instances,
// but okay for V1 or single-instance deployments.
// For distributed systems, a shared store like Redis would be needed.
const requestLog = {};
// Structure:
// requestLog[userId] = {
//   featureKey1: [timestamp1, timestamp2, ...],
//   featureKey2: [timestamp1, timestamp2, ...],
// }

/**
 * Factory function to create a rate-limiting middleware.
 * @param {string} featureKey - A unique key for the feature being rate-limited (e.g., 'search', 'profileViewAnalytics').
 * @param {number} limit - The maximum number of allowed requests within the duration.
 * @param {number} durationSeconds - The duration in seconds for which the limit applies.
 * @returns {function} Express middleware function.
 */
const createRateLimiter = (featureKey, limit, durationSeconds) => {
  return async (req, res, next) => {
    // Rate limiting should ideally happen after user authentication
    if (!req.user || !req.user.id) {
      // This case should ideally be handled by authentication middleware first
      console.warn('RateLimiter: req.user.id not found. Ensure authentication middleware runs before rate limiter.');
      return res.status(401).json({ error: 'User authentication required.' });
    }
    const userId = req.user.id;

    // Rate limiting only applies to 'Basic' tier users for these features.
    // Assumes checkSubscription middleware runs before this and populates req.subscription.
    if (!req.subscription || req.subscription.tier_level !== 'Basic') {
      return next(); // Not a Basic user, or no subscription info, so skip rate limiting.
    }

    const now = Date.now();
    const durationMs = durationSeconds * 1000;

    // Initialize logs for the user if they don't exist
    if (!requestLog[userId]) {
      requestLog[userId] = {};
    }
    if (!requestLog[userId][featureKey]) {
      requestLog[userId][featureKey] = [];
    }

    // Get timestamps for the current user and feature
    const userFeatureLog = requestLog[userId][featureKey];

    // Filter out timestamps older than the duration
    const recentTimestamps = userFeatureLog.filter(timestamp => now - timestamp < durationMs);

    // Update the log with only recent timestamps
    requestLog[userId][featureKey] = recentTimestamps;

    // Check if the limit is exceeded
    if (recentTimestamps.length >= limit) {
      return res.status(429).json({
        error: `Rate limit exceeded for ${featureKey}. Max ${limit} requests per ${durationSeconds / 60} minutes for Basic tier. Try again later.`,
        feature: featureKey,
        limit,
        durationMinutes: durationSeconds / 60
      });
    }

    // Add current request timestamp
    requestLog[userId][featureKey].push(now);

    next();
  };
};

// --- Specific Rate Limiters ---

// Example: 20 searches per hour for Basic users
const searchRateLimiter = createRateLimiter('search', 20, 3600); // 3600 seconds = 1 hour

// Example: 10 profile view analytics accesses per day for Basic users
const profileViewAnalyticsRateLimiter = createRateLimiter('profileViewAnalytics', 10, 86400); // 86400 seconds = 24 hours

module.exports = {
  searchRateLimiter,
  profileViewAnalyticsRateLimiter,
  createRateLimiter // Exporting the factory itself in case it's needed for dynamic limiters
};
