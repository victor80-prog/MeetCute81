import axios from 'axios';
import config from '../config';
import { refreshToken } from '../services/authService';

// Create axios instance with base URL and default headers
const apiClient = axios.create({
  baseURL: config.api.baseURL,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: config.api.withCredentials,
});

// Request interceptor to add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('meetCuteToken');
    
    // If token exists, add it to the Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors and token refresh
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 and we haven't already tried to refresh the token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const newToken = await refreshToken();
        
        if (newToken) {
          // Update the Authorization header with the new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          
          // Retry the original request with the new token
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        // If refresh fails, redirect to login
        window.location.href = '/login?session=expired';
        return Promise.reject(refreshError);
      }
    }
    
    // For other errors, just reject with the error
    return Promise.reject(error);
  }
);

/**
 * Makes an API request with proper error handling
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method (get, post, put, delete)
 * @param {string} options.url - API endpoint URL
 * @param {Object} [options.data] - Request payload
 * @param {Object} [options.params] - URL parameters
 * @param {Object} [options.headers] - Custom headers
 * @returns {Promise<{data: any, error: Error|null}>} Response data or error
 */
export const apiRequest = async ({
  method = 'get',
  url,
  data = null,
  params = null,
  headers = {},
}) => {
  try {
    const response = await apiClient({
      method,
      url,
      data,
      params,
      headers: {
        ...headers,
      },
    });

    return { data: response.data, error: null };
  } catch (error) {
    // Handle different types of errors
    let errorMessage = 'An error occurred';
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const { status, data } = error.response;
      
      if (status === 401) {
        errorMessage = 'Session expired. Please log in again.';
        // Redirect to login if not already there
        if (!window.location.pathname.includes('login')) {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
      } else if (status === 403) {
        errorMessage = 'You do not have permission to perform this action.';
      } else if (status === 404) {
        errorMessage = 'The requested resource was not found.';
      } else if (status === 422) {
        // Handle validation errors
        if (data?.errors) {
          return { 
            data: null, 
            error: {
              message: 'Validation failed',
              errors: data.errors,
              status: 422,
            },
          };
        }
        errorMessage = data?.message || 'Validation failed';
      } else if (status >= 500) {
        errorMessage = 'A server error occurred. Please try again later.';
      } else {
        errorMessage = data?.message || errorMessage;
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
      errorMessage = 'No response from server. Please check your connection.';
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
      errorMessage = error.message;
    }
    
    return { 
      data: null, 
      error: {
        message: errorMessage,
        status: error.response?.status,
        originalError: error,
      },
    };
  }
};

// Helper methods for common HTTP methods
export const get = (url, params = {}, headers = {}) => 
  apiRequest({ method: 'get', url, params, headers });

export const post = (url, data = {}, headers = {}) => 
  apiRequest({ method: 'post', url, data, headers });

export const put = (url, data = {}, headers = {}) => 
  apiRequest({ method: 'put', url, data, headers });

export const del = (url, data = {}, headers = {}) => 
  apiRequest({ method: 'delete', url, data, headers });

export const upload = (url, file, fieldName = 'file', extraData = {}) => {
  const formData = new FormData();
  formData.append(fieldName, file);
  
  // Append extra data if provided
  Object.entries(extraData).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  return apiRequest({
    method: 'post',
    url,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export default apiClient;
