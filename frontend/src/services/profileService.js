import { get, post, put, upload } from '../utils/apiClient';

/**
 * Get user profile by ID
 * @param {string|number} [userId] - Optional user ID (gets current user if not provided)
 * @returns {Promise<Object>} Profile data
 */
export const getProfile = async (userId) => {
  try {
    // If no userId is provided, get current user's profile
    if (!userId) {
      return await get('/profiles');
    }
    
    // Ensure userId is a valid number
    const parsedUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(parsedUserId)) {
      throw new Error(`Invalid user ID: ${userId}`);
    }
    
    return await get(`/profiles/${parsedUserId}`);
  } catch (error) {
    console.error('Error in getProfile:', {
      error,
      userId,
      timestamp: new Date().toISOString()
    });
    throw error; // Re-throw to let the caller handle it
  }
};

/**
 * Get current user's profile
 * @returns {Promise<Object>} Current user's profile
 */
export const getMyProfile = async () => {
  try {
    return await get('/profiles');
  } catch (error) {
    console.error('Error in getMyProfile:', {
      error,
      timestamp: new Date().toISOString()
    });
    throw error; // Re-throw to let the caller handle it
  }
};

/**
 * Create or update user profile
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} Updated profile data
 */
export const updateProfile = async (profileData) => {
  return put('/profiles/me', profileData);
};

/**
 * Upload profile picture
 * @param {File} file - Image file to upload
 * @returns {Promise<Object>} Response with image URL
 */
export const uploadProfilePicture = async (file) => {
  return upload('/profiles/picture', file, 'profilePicture');
};

/**
 * Update profile picture
 * @param {string} imageUrl - URL of the new profile picture
 * @returns {Promise<Object>} Updated profile data
 */
export const updateProfilePicture = async (imageUrl) => {
  return put('/profiles/me/picture', { profilePicture: imageUrl });
};

/**
 * Get user's subscription features
 * @returns {Promise<Array>} List of active features
 */
export const getMyFeatures = async () => {
  return get('/profiles/me/features');
};

/**
 * Check if user has a specific feature
 * @param {string} featureName - Name of the feature to check
 * @returns {Promise<boolean>} True if user has the feature
 */
export const hasFeature = async (featureName) => {
  try {
    const response = await get(`/profiles/me/has-feature/${featureName}`);
    return response.data?.hasFeature || false;
  } catch (error) {
    console.error(`Error checking feature ${featureName}:`, error);
    return false;
  }
};

/**
 * Update user's preferences
 * @param {Object} preferences - User preferences to update
 * @returns {Promise<Object>} Updated profile with preferences
 */
export const updatePreferences = async (preferences) => {
  return put('/profiles/me/preferences', { preferences });
};

/**
 * Get user's privacy settings
 * @returns {Promise<Object>} User's privacy settings
 */
export const getPrivacySettings = async () => {
  return get('/profiles/me/privacy');
};

/**
 * Update user's privacy settings
 * @param {Object} privacySettings - Privacy settings to update
 * @returns {Promise<Object>} Updated privacy settings
 */
export const updatePrivacySettings = async (privacySettings) => {
  return put('/profiles/me/privacy', privacySettings);
};

/**
 * Search profiles based on criteria
 * @param {Object} criteria - Search criteria
 * @param {number} [page=1] - Page number
 * @param {number} [limit=10] - Items per page
 * @returns {Promise<Object>} Paginated list of matching profiles
 */
export const searchProfiles = async (criteria, page = 1, limit = 10) => {
  return get('/profiles/search', { 
    ...criteria, 
    page, 
    limit 
  });
};

/**
 * Get user's activity stats
 * @returns {Promise<Object>} User activity statistics
 */
export const getActivityStats = async () => {
  return get('/profiles/me/activity');
};

/**
 * Get user's connections
 * @param {number} [page=1] - Page number
 * @param {number} [limit=20] - Items per page
 * @returns {Promise<Object>} Paginated list of user connections
 */
export const getConnections = async (page = 1, limit = 20) => {
  return get('/profiles/me/connections', { page, limit });
};

/**
 * Get user's recent activity
 * @param {number} [limit=10] - Number of recent activities to return
 * @returns {Promise<Array>} List of recent activities
 */
export const getRecentActivity = async (limit = 10) => {
  return get('/profiles/me/recent-activity', { limit });
};
