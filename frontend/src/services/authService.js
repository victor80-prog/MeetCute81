import { get, post } from '../utils/apiClient';
import config from '../config';

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Response data
 */
export const register = async (userData) => {
  return post('/auth/register', userData);
};

/**
 * Login user
 * @param {Object} credentials - User credentials (email and password)
 * @returns {Promise<Object>} Response with user data and tokens
 */
export const login = async (credentials) => {
  return post('/auth/login', credentials);
};

/**
 * Logout user
 * @returns {Promise<Object>} Response data
 */
export const logout = async () => {
  // Clear local storage
  localStorage.removeItem(config.auth.tokenKey);
  localStorage.removeItem(config.auth.refreshTokenKey);
  localStorage.removeItem(config.auth.tokenExpiryKey);
  
  // Call server to invalidate token
  try {
    await post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  return { success: true };
};

/**
 * Verify user's email with token
 * @param {string} token - Verification token
 * @returns {Promise<Object>} Response data
 */
export const verifyEmail = async (token) => {
  return get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
};

/**
 * Request password reset email
 * @param {string} email - User's email
 * @returns {Promise<Object>} Response data
 */
export const forgotPassword = async (email) => {
  return post('/auth/forgot-password', { email });
};

/**
 * Reset password with token
 * @param {string} token - Password reset token
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Response data
 */
export const resetPassword = async (token, newPassword) => {
  return post('/auth/reset-password', { token, newPassword });
};

/**
 * Refresh access token
 * @returns {Promise<string|null>} New access token or null if refresh failed
 */
export const refreshToken = async () => {
  try {
    const refreshToken = localStorage.getItem(config.auth.refreshTokenKey);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await post('/auth/refresh-token', { refreshToken });
    
    if (response.data?.token) {
      // Store the new token
      localStorage.setItem(config.auth.tokenKey, response.data.token);
      
      // Update token expiry if provided
      if (response.data.expiresIn) {
        const expiresAt = new Date().getTime() + response.data.expiresIn * 1000;
        localStorage.setItem(config.auth.tokenExpiryKey, expiresAt.toString());
      }
      
      return response.data.token;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    // Clear auth data on refresh failure
    localStorage.removeItem(config.auth.tokenKey);
    localStorage.removeItem(config.auth.refreshTokenKey);
    localStorage.removeItem(config.auth.tokenExpiryKey);
    return null;
  }
};

/**
 * Get current authenticated user
 * @returns {Promise<Object>} User data
 */
export const getCurrentUser = async () => {
  return get('/auth/me');
};

/**
 * Update user profile
 * @param {Object} profileData - Updated profile data
 * @returns {Promise<Object>} Updated user data
 */
export const updateProfile = async (profileData) => {
  return put('/auth/me', profileData);
};

/**
 * Change user password
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Response data
 */
export const changePassword = async (currentPassword, newPassword) => {
  return post('/auth/change-password', { currentPassword, newPassword });
};

/**
 * Resend verification email
 * @param {string} email - User's email
 * @returns {Promise<Object>} Response data
 */
export const resendVerification = async (email) => {
  return post('/auth/resend-verification', { email });
};

// Alias for backward compatibility
export const resendVerificationEmail = resendVerification;

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem(config.auth.tokenKey);
  if (!token) return false;
  
  // Check if token is expired
  const expiresAt = localStorage.getItem(config.auth.tokenExpiryKey);
  if (expiresAt) {
    return new Date().getTime() < parseInt(expiresAt, 10);
  }
  
  return true;
};

/**
 * Get authentication headers
 * @returns {Object} Headers with authorization token
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem(config.auth.tokenKey);
  return token ? { Authorization: `Bearer ${token}` } : {};
};
