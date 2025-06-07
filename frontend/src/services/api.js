import axios from 'axios';

// Ensure the base URL ends with /api
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const apiBaseURL = baseURL.endsWith('/api') ? baseURL : `${baseURL}/api`;

// Create axios instance with base URL
const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies/sessions
});

console.log('API Base URL:', apiBaseURL); // Debug log

// Request interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  // Register a new user
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  
  // Login user
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  
  // Request password reset
  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },
  
  // Reset password with token
  resetPassword: async (token, newPassword) => {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },
  
  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// Profile API
export const profileAPI = {
  /**
   * Get current user's full profile
   * @returns {Promise<Object>} User's profile data
   */
  getMyProfile: async () => {
    try {
      // First, get the current user's ID from the /me endpoint
      const userResponse = await api.get('/auth/me', { _skipAuthRedirect: true });
      const userId = userResponse.data?.id;
      
      if (!userId) {
        throw new Error('User ID not found in response');
      }
      
      // Then fetch the profile using the user ID
      const response = await api.get(`/profiles/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Could not fetch user profile:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      // Don't throw the error, just return null to indicate no profile exists
      return { error: 'Profile not found' };
    }
  },

  /**
   * Get user profile by ID (public data only)
   * @param {string|number} userId - User ID to fetch
   * @returns {Promise<Object>} Public profile data
   */
  getProfile: async (userId) => {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    try {
      const response = await api.get(`/profiles/${userId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching profile for user ${userId}:`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },
  
  /**
   * Create or update profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} Updated profile data
   */
  updateProfile: async (profileData) => {
    try {
      // First, get the current user's ID
      const userResponse = await api.get('/auth/me', { _skipAuthRedirect: true });
      const userId = userResponse.data?.id;
      
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Format the data to match the backend expectations
      const formattedData = {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        dob: profileData.dob,
        gender: profileData.gender,
        bio: profileData.bio
      };
      
      // Use PATCH for partial updates
      const response = await api.patch(`/profiles/${userId}`, formattedData);
      return response.data;
    } catch (error) {
      console.error('Error updating profile:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  },
  
  /**
   * Upload profile picture
   * @param {File} file - Image file to upload
   * @returns {Promise<Object>} Response with image URL
   */
  uploadProfilePicture: async (file) => {
    if (!file) {
      throw new Error('No file provided');
    }
    
    // First, get the current user's ID
    const userResponse = await api.get('/auth/me', { _skipAuthRedirect: true });
    const userId = userResponse.data?.id;
    
    if (!userId) {
      throw new Error('User ID not found');
    }
    
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    try {
      const response = await api.post(`/profiles/${userId}/picture`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading profile picture:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        fileInfo: { name: file.name, type: file.type, size: file.size }
      });
      throw error;
    }
  },
  
  /**
   * Mark profile as complete
   * @returns {Promise<Object>} Response data
   */
  markProfileComplete: async () => {
    try {
      // First, get the current user's ID
      const userResponse = await api.get('/auth/me', { _skipAuthRedirect: true });
      const userId = userResponse.data?.id;
      
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Mark the profile as complete
      const response = await api.patch(`/profiles/${userId}/complete`);
      return response.data;
    } catch (error) {
      console.error('Error marking profile as complete:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }
};

// Subscription API
export const subscriptionAPI = {
  // Get available subscription plans
  getPlans: async () => {
    const response = await api.get('/subscriptions/plans');
    return response.data;
  },
  
  // Subscribe to a plan
  subscribe: async (planId, paymentMethod) => {
    const response = await api.post('/subscriptions/subscribe', { planId, paymentMethod });
    return response.data;
  },
  
  // Cancel subscription
  cancelSubscription: async () => {
    const response = await api.post('/subscriptions/cancel');
    return response.data;
  }
};

// Likes API
export const likesAPI = {
  // Get received likes
  getReceivedLikes: async () => {
    const response = await api.get('/user/likes/received');
    return response.data;
  },
  
  // Get sent likes
  getSentLikes: async () => {
    const response = await api.get('/user/likes/sent');
    return response.data;
  },
  
  // Like a user
  likeUser: async (targetUserId) => {
    const response = await api.post('/user/likes', { targetUserId });
    return response.data;
  },
  
  // Unlike a user
  unlikeUser: async (targetUserId) => {
    const response = await api.delete(`/user/likes/${targetUserId}`);
    return response.data;
  }
};

// Export default API instance for direct use if needed
export default api;
