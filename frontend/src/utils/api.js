import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    // Skip token check for auth endpoints
    if (config.url.includes('/auth/')) {
      return config;
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!config._skipAuthRedirect) {
      // Only redirect if this isn't a public endpoint
      console.warn('No token found for protected endpoint:', config.url);
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  (response) => {
    // You can add any response transformation here if needed
    return response;
  },
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
    
    const isAuthEndpoint = config?.url?.includes('/auth/');
    const originalRequest = config;
    
    // Handle 401 Unauthorized
    if (status === 401) {
      const token = localStorage.getItem('token');
      
      // If we have a token and this isn't an auth endpoint, try to refresh it
      if (token && !isAuthEndpoint && !originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          // Try to refresh the token
          const refreshResponse = await api.post('/api/auth/refresh-token', {}, { _skipAuthRedirect: true });
          const newToken = refreshResponse.data.token;
          
          if (newToken) {
            // Update token in localStorage and axios defaults
            localStorage.setItem('token', newToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            
            // Retry the original request with the new token
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, clear token and redirect to login
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
          
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
      
      // If we get here, either there was no token or refresh failed
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/login';
      }
    } else if (status === 403) {
      // Handle 403 Forbidden
      if (data?.status === 'suspended') {
        // Forbidden due to account suspension
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        
        if (!window.location.pathname.includes('/suspended')) {
          window.location.href = '/suspended';
        }
      } else if (data?.status === 'email_unverified') {
        // Forbidden due to unverified email
        if (!window.location.pathname.includes('/verify-email')) {
          window.location.href = '/verify-email';
        }
      } else {
        // Other 403 errors
        console.error('Forbidden:', data?.message || 'You do not have permission to access this resource');
      }
    } else if (status >= 500) {
      // Handle server errors
      console.error('Server error:', data?.message || 'An unexpected error occurred');
    } else if (status >= 400) {
      // Handle other client errors
      console.error('Request error:', data?.message || 'Invalid request');
    }
    
    return Promise.reject(error);
  }
);

export default api; 