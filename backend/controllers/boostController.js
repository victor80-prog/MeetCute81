const ProfileBoost = require('../models/ProfileBoost');

const boostController = {
  /**
   * Activates a profile boost for the authenticated user.
   */
  activateBoost: async (req, res) => {
    try {
      const userId = req.user.id; // Assuming isAuthenticated middleware populates req.user
      const { boostType = 'standard', durationHours = 1 } = req.body; // Defaults for V1

      if (typeof durationHours !== 'number' || durationHours <= 0) {
        return res.status(400).json({ error: 'Invalid durationHours. Must be a positive number.' });
      }
      if (typeof boostType !== 'string' || boostType.trim() === '') {
        return res.status(400).json({ error: 'Invalid boostType. Must be a non-empty string.' });
      }

      // Optional: Check if user already has an active boost.
      // For V1, we allow creating a new one. getActiveUserBoost will pick the "latest".
      // const existingBoost = await ProfileBoost.getActiveUserBoost(userId);
      // if (existingBoost) {
      //   return res.status(409).json({
      //     message: 'An active boost already exists. Please wait for it to expire or allow stacking/replacement (future feature).',
      //     activeBoost: existingBoost
      //   });
      // }

      const boost = await ProfileBoost.activate(userId, boostType, durationHours);
      res.status(201).json({
        message: 'Profile boost activated successfully!',
        boost
      });
    } catch (error) {
      console.error('Error activating profile boost in controller:', error);
      res.status(500).json({ error: 'Failed to activate profile boost.' });
    }
  },

  /**
   * Gets the current active boost status for the authenticated user.
   */
  getBoostStatus: async (req, res) => {
    try {
      const userId = req.user.id; // Assuming isAuthenticated middleware populates req.user
      const activeBoost = await ProfileBoost.getActiveUserBoost(userId);

      if (activeBoost) {
        res.json({
          isBoosted: true,
          boostDetails: activeBoost
        });
      } else {
        res.json({
          isBoosted: false,
          boostDetails: null
        });
      }
    } catch (error) {
      console.error('Error getting boost status in controller:', error);
      res.status(500).json({ error: 'Failed to get boost status.' });
    }
  }
};

module.exports = boostController;
