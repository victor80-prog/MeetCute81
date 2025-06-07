const cron = require('node-cron');
const UserActivity = require('../models/UserActivity');
const logger = require('../utils/logger');

/**
 * Schedule the daily reset job to run at midnight every day
 */
function scheduleDailyReset() {
  // Schedule to run at 00:00 (midnight) every day
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Running daily reset job...');
      
      // Reset all user activity counts
      await UserActivity.resetDailyCounts();
      
      logger.info('Successfully reset daily usage counts');
    } catch (error) {
      logger.error('Error in daily reset job:', error);
    }
  }, {
    timezone: 'UTC', // Adjust timezone as needed
    scheduled: true
  });
  
  logger.info('Scheduled daily reset job to run at midnight UTC');
}

module.exports = {
  scheduleDailyReset
};
