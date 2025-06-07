const AnonymousBrowsingSession = require('../models/AnonymousBrowsingSession');

const anonymousBrowsingController = {
  /**
   * Starts an anonymous browsing session for the authenticated user.
   * Assumes prior isAuthenticated and checkFeatureAccess('anonymousBrowsing') middleware.
   */
  startAnonymousBrowsing: async (req, res) => {
    try {
      const userId = req.user.id;
      const session = await AnonymousBrowsingSession.startSession(userId);
      res.status(201).json({
        message: 'Anonymous browsing session started.',
        session
      });
    } catch (error) {
      console.error('Error in startAnonymousBrowsing controller:', error);
      res.status(500).json({ error: 'Failed to start anonymous browsing session.' });
    }
  },

  /**
   * Stops the anonymous browsing session for the authenticated user.
   * Assumes prior isAuthenticated middleware.
   */
  stopAnonymousBrowsing: async (req, res) => {
    try {
      const userId = req.user.id;
      await AnonymousBrowsingSession.endSession(userId);
      res.json({ message: 'Anonymous browsing session stopped.' });
    } catch (error) {
      console.error('Error in stopAnonymousBrowsing controller:', error);
      res.status(500).json({ error: 'Failed to stop anonymous browsing session.' });
    }
  },

  /**
   * Gets the status of anonymous browsing for the authenticated user.
   * Assumes prior isAuthenticated middleware.
   */
  getAnonymousBrowsingStatus: async (req, res) => {
    try {
      const userId = req.user.id;
      const activeSession = await AnonymousBrowsingSession.getActiveSession(userId);

      if (activeSession) {
        res.json({
          isActive: true,
          session: activeSession
        });
      } else {
        res.json({
          isActive: false,
          session: null
        });
      }
    } catch (error) {
      console.error('Error in getAnonymousBrowsingStatus controller:', error);
      res.status(500).json({ error: 'Failed to retrieve anonymous browsing status.' });
    }
  }
};

module.exports = anonymousBrowsingController;
