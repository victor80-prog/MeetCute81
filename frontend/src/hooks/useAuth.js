import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import config from '../config';

// Create auth context
const AuthContext = createContext(null);

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check if user is authenticated
  const isAuthenticated = useCallback(() => {
    return !!user && !!localStorage.getItem(config.auth.tokenKey);
  }, [user]);

  // Check if user has a specific role
  const hasRole = useCallback(
    (role) => {
      if (!user) return false;
      return user.role === role || user.role === 'admin'; // Admins have all roles
    },
    [user]
  );

  // Check if user has a specific feature (based on subscription)
  const hasFeature = useCallback(
    (featureName) => {
      if (!user) return false;
      // Check if user has the feature in their active features
      return user.active_features?.includes(featureName) || false;
    },
    [user]
  );

  // Login user
  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await authAPI.login({ email, password });
        
        if (response.success && response.token) {
          // Store tokens
          localStorage.setItem(config.auth.tokenKey, response.token);
          if (response.refreshToken) {
            localStorage.setItem(config.auth.refreshTokenKey, response.refreshToken);
          }
          
          // Store user data
          setUser(response.user);
          
          // Redirect based on user role or intended path
          const redirectTo = localStorage.getItem('redirectAfterLogin') || 
                            (response.user.role === 'admin' ? '/admin' : '/dashboard');
          localStorage.removeItem('redirectAfterLogin');
          
          navigate(redirectTo);
          return { success: true };
        } else {
          throw new Error(response.error || 'Login failed');
        }
      } catch (err) {
        const errorMessage = err.response?.data?.error || err.message || 'Login failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  // Logout user
  const logout = useCallback(() => {
    // Clear tokens and user data
    localStorage.removeItem(config.auth.tokenKey);
    localStorage.removeItem(config.auth.refreshTokenKey);
    localStorage.removeItem(config.auth.tokenExpiryKey);
    
    // Reset state
    setUser(null);
    setError(null);
    
    // Redirect to login
    navigate('/login');
  }, [navigate]);

  // Register new user
  const register = useCallback(
    async (userData) => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await authAPI.register(userData);
        
        if (response.success) {
          // Auto-login after registration if token is provided
          if (response.token) {
            localStorage.setItem(config.auth.tokenKey, response.token);
            setUser(response.user);
            navigate('/verify-email', { 
              state: { email: userData.email, status: 'pending_verification' } 
            });
          } else {
            // If no auto-login, redirect to login page
            navigate('/login', { 
              state: { 
                message: 'Registration successful! Please check your email to verify your account.',
                messageType: 'success'
              } 
            });
          }
          
          return { success: true };
        } else {
          throw new Error(response.error || 'Registration failed');
        }
      } catch (err) {
        const errorMessage = err.response?.data?.error || err.message || 'Registration failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  // Verify email
  const verifyEmail = useCallback(
    async (token) => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await authAPI.verifyEmail(token);
        
        if (response.success) {
          // If user is logged in, update their verification status
          if (user) {
            setUser(prev => ({
              ...prev,
              isEmailVerified: true
            }));
          }
          
          return { success: true, message: response.message };
        } else {
          throw new Error(response.error || 'Email verification failed');
        }
      } catch (err) {
        const errorMessage = err.response?.data?.error || err.message || 'Email verification failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem(config.auth.refreshTokenKey);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await authAPI.refreshToken({ refreshToken });
      
      if (response.success && response.token) {
        // Store the new token
        localStorage.setItem(config.auth.tokenKey, response.token);
        
        // Update token expiry
        if (response.expiresIn) {
          const expiresAt = new Date().getTime() + response.expiresIn * 1000;
          localStorage.setItem(config.auth.tokenExpiryKey, expiresAt.toString());
        }
        
        // Update user data if provided
        if (response.user) {
          setUser(response.user);
        }
        
        return response.token;
      } else {
        throw new Error(response.error || 'Failed to refresh token');
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      logout();
      return null;
    }
  }, [logout]);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem(config.auth.tokenKey);
      
      if (!token) {
        setLoading(false);
        return;
      }
      
      // Check if token is expired or about to expire
      const expiresAt = localStorage.getItem(config.auth.tokenExpiryKey);
      const isExpired = expiresAt && new Date().getTime() > parseInt(expiresAt, 10);
      const isAboutToExpire = expiresAt && 
        (parseInt(expiresAt, 10) - new Date().getTime()) < config.auth.tokenRefreshThreshold;
      
      try {
        // If token is expired or about to expire, try to refresh it
        if (isExpired || isAboutToExpire) {
          await refreshToken();
        }
        
        // Get current user data
        const response = await authAPI.getCurrentUser();
        
        if (response.success && response.user) {
          setUser(response.user);
        } else {
          throw new Error('Failed to fetch user data');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [refreshToken, logout]);

  // Value to be provided by the context
  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    hasRole,
    hasFeature,
    login,
    logout,
    register,
    verifyEmail,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default useAuth;
