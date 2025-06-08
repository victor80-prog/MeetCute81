import axios from 'axios';

// Get base URL from environment variable or use default
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Remove any trailing slashes
const cleanBaseURL = baseURL.replace(/\/+$/, '');
// Don't add /api here since some endpoints might not need it
const apiBaseURL = cleanBaseURL;

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
    // Skip token check for auth endpoints and login
    if (config.url && (config.url.startsWith('/auth/') || config.url === '/auth/login')) {
      return config;
    }
    
    // Special handling for profile setup - allow these even if profile is incomplete
    const isProfileSetup = config.url && (
      config.url.startsWith('/profiles') || 
      config.url.startsWith('/profile') ||
      config.url.startsWith('/api/profiles') ||
      config.url.startsWith('/api/profile')
    );
    
    const token = localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Setting Authorization header for:', config.url);
      
      // For profile setup, add a special header to bypass profile completion check
      if (isProfileSetup) {
        config.headers['X-Profile-Setup'] = 'true';
      }
    } else if (!config._skipAuthRedirect && !isProfileSetup) {
      console.warn('No token found for protected endpoint:', config.url);
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject({ ...error, message: 'Network error. Please check your connection.' });
    }

    const { status, data, config } = error.response;
    
    // Skip handling if this request was marked to skip auth redirect
    if (config?._skipAuthRedirect) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    if (status === 401) {
      localStorage.removeItem('token');
      // Only redirect if not already on login page
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    // Handle 403 Forbidden
    else if (status === 403) {
      // Handle profile setup requirement
      if (data?.code === 'PROFILE_SETUP_REQUIRED') {
        const publicPaths = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
        if (!publicPaths.includes(window.location.pathname) && 
            window.location.pathname !== '/profile-setup' && 
            !config?._skipProfileSetupRedirect) {
          window.location.href = '/profile-setup';
        }
      }
      console.error('Access forbidden:', data?.message || 'You do not have permission to access this resource');
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  // Register a new user
  register: async (userData) => {
    const response = await api.post('/api/auth/register', userData);
    return response.data;
  },
  
  // Login user
  login: async (credentials) => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data;
  },
  
  // Request password reset
  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  },
  
  // Reset password with token
  resetPassword: async (token, newPassword) => {
    const response = await api.post('/api/auth/reset-password', { token, newPassword });
    return response.data;
  },
  
  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  }
};

// Profile API
export const profileAPI = {
  // Get user profile (fetches the authenticated user's profile)
  getProfile: async () => {
    const response = await api.get('/api/profiles');
    return response.data.profile; // Return the profile object directly
  },
  
  // Create or update profile
  updateProfile: async (profileData) => {
    const response = await api.put('/api/profiles', profileData);
    return response.data.profile; // Return the updated profile object
  },
  
  // Upload profile picture
  uploadProfilePicture: async (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    
    const response = await api.post('/api/profiles/picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
  
  // Mark profile as complete
  markProfileComplete: async () => {
    const response = await api.put('/api/profiles/complete');
    return response.data;
  }
};

// Subscription API
export const subscriptionAPI = {
  // Get available subscription plans
  getPlans: async () => {
    const response = await api.get('/api/subscriptions/plans');
    return response.data;
  },
  
  // Get current user's subscription
  getUserSubscription: async () => {
    const response = await api.get('/api/subscriptions/user');
    return response.data;
  },
  
  // Subscribe to a plan
  subscribe: async (planId, paymentMethod) => {
    const response = await api.post('/api/subscriptions/subscribe', { planId, paymentMethod });
    return response.data;
  },
  
  // Cancel subscription
  cancelSubscription: async () => {
    const response = await api.post('/api/subscriptions/cancel');
    return response.data;
  }
};

// Likes API
export const likesAPI = {
  // Get received likes
  getReceivedLikes: async () => {
    const response = await api.get('/api/user/likes/received');
    return response.data;
  },
  
  // Get sent likes
  getSentLikes: async () => {
    const response = await api.get('/api/user/likes/sent');
    return response.data;
  },
  
  // Like a user
  likeUser: async (targetUserId) => {
    const response = await api.post('/api/user/likes', { targetUserId });
    return response.data;
  },
  
  // Unlike a user
  unlikeUser: async (targetUserId) => {
    const response = await api.delete(`/api/user/likes/${targetUserId}`);
    return response.data;
  }
};

// Balance API
export const balanceAPI = {
  // Get user balance
  getBalance: async () => {
    const response = await api.get('/api/balance');
    return response.data;
  },
  
  // Withdraw balance
  withdraw: async (amount, paymentDetails) => {
    const response = await api.post('/api/balance/withdraw', { amount, paymentDetails });
    return response.data;
  },
  
  // Get withdrawal history
  getWithdrawals: async () => {
    const response = await api.get('/api/balance/withdrawals');
    return response.data;
  }
};

// Dashboard API
export const dashboardAPI = {
  // Get dashboard stats
  getStats: async () => {
    const response = await api.get('/api/dashboard/stats');
    return response.data;
  },
  
  // Get dashboard activity
  getActivity: async () => {
    const response = await api.get('/api/dashboard/activity');
    return response.data;
  }
};

// Transactions API
export const transactionsAPI = {
  // Get user transactions
  getMyTransactions: async (params = {}) => {
    const response = await api.get('/api/transactions/my-transactions', { params });
    return response.data;
  },
  
  // Initiate a transaction
  initiate: async (payload) => {
    const response = await api.post('/api/transactions/initiate', payload);
    return response.data;
  }
};

// Matches API
export const matchesAPI = {
  // Get match suggestions
  getSuggestions: async () => {
    const response = await api.get('/api/matches/suggestions');
    return response.data;
  },
  
  // Like a profile
  likeProfile: async (profileId) => {
    const response = await api.post(`/api/matches/like/${profileId}`);
    return response.data;
  },
  
  // Skip a profile
  skipProfile: async (profileId) => {
    const response = await api.post(`/api/matches/skip/${profileId}`);
    return response.data;
  },
  
  // Get matches
  getMatches: async () => {
    const response = await api.get('/api/matches');
    return response.data;
  },
  
  // Get match details
  getMatch: async (matchId) => {
    const response = await api.get(`/api/matches/${matchId}`);
    return response.data;
  },
  
  // Unmatch with a user
  unmatch: async (matchId) => {
    const response = await api.delete(`/api/matches/${matchId}`);
    return response.data;
  }
};

// Gifts API
export const giftsAPI = {
  // Get received gifts
  getReceivedGifts: async () => {
    const response = await api.get('/api/gifts/received');
    return response.data;
  },
  
  // Get sent gifts
  getSentGifts: async () => {
    const response = await api.get('/api/gifts/sent');
    return response.data;
  },
  
  // Redeem a gift
  redeemGift: async (giftId) => {
    const response = await api.post(`/api/gifts/received/${giftId}/redeem`);
    return response.data;
  },
  
  // Send a gift
  sendGift: async (giftData) => {
    const response = await api.post('/api/gifts/send', giftData);
    return response.data;
  },
  
  // Get available gift items
  getAvailableGifts: async () => {
    const response = await api.get('/api/gifts/items');
    return response.data;
  }
};

// Messages API
export const messagesAPI = {
  // Get or create a conversation with a user
  getOrCreateConversation: async (userId) => {
    const response = await api.get(`/api/messages/conversation/${userId}`);
    return response.data;
  },
  
  // Get all conversations
  getConversations: async () => {
    const response = await api.get('/api/messages/conversations');
    return response.data;
  },
  
  // Get messages in a conversation
  getMessages: async (conversationId) => {
    const response = await api.get(`/api/messages/${conversationId}`);
    return response.data;
  },
  
  // Send a message
  sendMessage: async (conversationId, content) => {
    const response = await api.post(`/api/messages/send`, {
      conversationId,
      content
    });
    return response.data;
  },
  
  // Mark messages as read
  markAsRead: async (messageIds) => {
    const response = await api.put('/api/messages/read', { messageIds });
    return response.data;
  }
};

// Admin API
export const adminAPI = {
  // Get dashboard statistics
  getDashboardStats: () => api.get('/api/admin/stats'),
  
  // User management
  getUsers: () => api.get('/api/admin/users'),
  updateUserStatus: (userId, status, reason = '') => api.put(`/api/admin/users/${userId}/status`, { status, reason }),
  deleteUser: (userId) => api.delete(`/api/admin/users/${userId}`),
  
  // Revenue reports
  getRevenueStats: () => api.get('/api/admin/revenue'),
  getRevenueSummary: () => api.get('/api/admin/revenue/summary'),
  
  // Subscription management
  getSubscriptionPlans: () => api.get('/api/admin/subscriptions'),
  createSubscriptionPlan: (planData) => api.post('/api/admin/subscriptions', planData),
  updateSubscriptionPlan: (id, planData) => api.put(`/api/admin/subscriptions/${id}`, planData),
  deleteSubscriptionPlan: (id) => api.delete(`/api/admin/subscriptions/${id}`),
  
  // Subscription features
  listSubscriptionFeatures: () => api.get('/api/admin/subscription-features'),
  createSubscriptionFeature: (featureData) => api.post('/api/admin/subscription-features', featureData),
  updateSubscriptionFeature: (featureId, featureData) => 
    api.put(`/api/admin/subscription-features/${featureId}`, featureData),
  deleteSubscriptionFeature: (featureId) => api.delete(`/api/admin/subscription-features/${featureId}`),
  
  // Moderation
  getModerationReports: (type) => 
    api.get('/api/admin/moderation/reports' + (type ? `?type=${type}` : '')),
  getReportDetails: (reportId) => 
    api.get(`/api/admin/moderation/reports/${reportId}`),
  getLogs: (params) => 
    api.get('/api/admin/logs', { params }),
  
  // Transaction Verification
  getPendingTransactions: (params) => 
    api.get('/api/admin/transactions/pending-verification', { params }),
  verifyTransaction: (transactionId, data) =>
    api.put(`/api/admin/transactions/${transactionId}/verify`, data),
    
  // Payment Method Types
  getPaymentMethodTypes: () => 
    api.get('/api/admin/payment-methods/types'),
  createPaymentMethodType: (data) =>
    api.post('/api/admin/payment-methods/types', data),
  updatePaymentMethodType: (typeId, data) =>
    api.put(`/api/admin/payment-methods/types/${typeId}`, data),
  deletePaymentMethodType: (typeId) =>
    api.delete(`/api/admin/payment-methods/types/${typeId}`),
    
  // Country Payment Methods
  getCountryPaymentMethods: (countryId) =>
    api.get(`/api/admin/payment-methods/country/${countryId}`),
  addCountryPaymentMethod: (countryId, data) =>
    api.post(`/api/admin/payment-methods/country/${countryId}`, data),
  updateCountryPaymentMethod: (countryId, methodId, data) =>
    api.put(`/api/admin/payment-methods/country/${countryId}/method/${methodId}`, data),
  updateCountryPaymentMethodStatus: (countryId, methodId, data) =>
    api.patch(`/api/admin/payment-methods/country/${countryId}/method/${methodId}/status`, data),
  deleteCountryPaymentMethod: (countryId, methodId) =>
    api.delete(`/api/admin/payment-methods/country/${countryId}/method/${methodId}`)
};

// Export default API instance for direct use if needed
export default api;
