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
      // Avoid redirecting if this request was specifically told not to
      if (!error.config?._skipAuthRedirect) {
        localStorage.removeItem('token');
        // Potentially clear other user-related state here
        window.location.href = '/login';
      }
    }
    // Handle 403 Forbidden - specifically for profile setup requirement
    else if (error.response?.status === 403 && error.response.data?.code === 'PROFILE_SETUP_REQUIRED') {
      // Redirect to profile setup if not already there or on other specific public paths
      const publicPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
      if (window.location.pathname !== '/profile-setup' && !publicPaths.includes(window.location.pathname)) {
        // Check if _skipProfileSetupRedirect is set on the request config
        if (!error.config?._skipProfileSetupRedirect) {
          window.location.href = '/profile-setup';
        }
      }
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
  // Get user profile (fetches the authenticated user's profile)
  getProfile: async () => {
    const response = await api.get('/profiles/'); // Removed ${userId}
    return response.data;
  },
  
  // Create or update profile
  updateProfile: async (profileData) => {
    const response = await api.put('/profiles', profileData);
    return response.data;
  },
  
  // Upload profile picture
  uploadProfilePicture: async (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    const response = await api.post('/profiles/picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
  
  // Mark profile as complete
  markProfileComplete: async () => {
    const response = await api.put('/profiles/complete');
    return response.data;
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
