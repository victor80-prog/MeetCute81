// Auth utility functions

/**
 * Retrieves the authentication token from localStorage
 * @returns {string|null} The authentication token or null if not found
 */
export const getToken = () => {
  return localStorage.getItem('token') || null;
};

/**
 * Stores the authentication token in localStorage
 * @param {string} token - The authentication token to store
 */
export const setToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

/**
 * Removes the authentication token from localStorage
 */
export const removeToken = () => {
  localStorage.removeItem('token');
};

/**
 * Checks if the user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
export const isAuthenticated = () => {
  const token = getToken();
  return !!token;
};

/**
 * Parses the JWT token to get user information
 * @returns {Object|null} The decoded token payload or null if invalid
 */
export const getTokenPayload = () => {
  const token = getToken();
  if (!token) return null;
  
  try {
    // Token is in format: header.payload.signature
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing token:', error);
    return null;
  }
};

/**
 * Gets the current user ID from the token
 * @returns {string|null} The user ID or null if not found
 */
export const getUserId = () => {
  const payload = getTokenPayload();
  return payload?.sub || payload?.id || null;
};

/**
 * Gets the current user's roles from the token
 * @returns {Array<string>} Array of roles or empty array if none
 */
export const getUserRoles = () => {
  const payload = getTokenPayload();
  if (!payload) return [];
  
  if (Array.isArray(payload.roles)) {
    return payload.roles;
  } else if (payload.role) {
    return [payload.role];
  }
  
  return [];
};

/**
 * Checks if the current user has a specific role
 * @param {string} role - The role to check for
 * @returns {boolean} True if the user has the role, false otherwise
 */
export const hasRole = (role) => {
  const roles = getUserRoles();
  return roles.includes(role);
};

/**
 * Checks if the current user has any of the specified roles
 * @param {Array<string>} roles - Array of roles to check
 * @returns {boolean} True if the user has any of the roles, false otherwise
 */
export const hasAnyRole = (roles) => {
  const userRoles = getUserRoles();
  return roles.some(role => userRoles.includes(role));
};

/**
 * Checks if the current user has all of the specified roles
 * @param {Array<string>} roles - Array of roles to check
 * @returns {boolean} True if the user has all of the roles, false otherwise
 */
export const hasAllRoles = (roles) => {
  const userRoles = getUserRoles();
  return roles.every(role => userRoles.includes(role));
};

export default {
  getToken,
  setToken,
  removeToken,
  isAuthenticated,
  getTokenPayload,
  getUserId,
  getUserRoles,
  hasRole,
  hasAnyRole,
  hasAllRoles
};
