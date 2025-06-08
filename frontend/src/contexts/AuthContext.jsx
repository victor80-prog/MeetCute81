// frontend/src/contexts/AuthContext.jsx

import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get('/api/auth/me', { _skipAuthRedirect: true });
        if (response.data) {
          setCurrentUser(response.data);
        }
      } catch (err) {
        console.error('Auth check failed, clearing token.', err.message);
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    // This function now returns a promise that the UI component will handle.
    setIsLoading(true);
    setError(null);
    try {
      // Make sure we're not sending an Authorization header for the login request
      const config = {
        headers: {},
        _skipAuthRedirect: true
      };
      
      const response = await api.post('/api/auth/login', { email, password }, config);
      const { token, user: userData, requiresVerification } = response.data;
      
      if (requiresVerification) {
        return { success: false, requiresVerification: true, error: 'Please verify your email.' };
      }

      if (!token || !userData) {
        throw new Error('Invalid response from server');
      }

      // Store token and set default auth header
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Set user data
      setCurrentUser(userData);
      
      // Verify the token was set correctly
      console.log('Token set after login, making test request to /api/auth/me');
      const meResponse = await api.get('/api/auth/me', { _skipAuthRedirect: true });
      console.log('User data from /api/auth/me:', meResponse.data);
      
      return { success: true, user: userData };

    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // This function simply clears the state. The UI will handle navigation.
    setCurrentUser(null);
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    // No navigation here!
    return Promise.resolve();
  };

  const updateUser = (userData) => {
    setCurrentUser(prev => ({
      ...prev,
      ...userData
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        error,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};