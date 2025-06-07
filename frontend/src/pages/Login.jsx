import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from "../contexts/AuthContext";
import { FaEnvelope, FaLock, FaHeart, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import { resendVerification } from '../services/authService';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [showResendLink, setShowResendLink] = useState(false);

  // Check for verification status in URL
  useEffect(() => {
    const status = searchParams.get('status');
    const error = searchParams.get('error');
    const email = searchParams.get('email');

    if (status === 'already_verified') {
      toast.success('Your email is already verified. You can now log in.');
    } else if (error === 'verification_required') {
      setUnverifiedEmail(email || '');
      setShowResendLink(true);
      toast.error('Please verify your email before logging in.');
    } else if (error === 'verification_failed') {
      toast.error('Email verification failed. Please try again.');
    } else if (error === 'invalid_token') {
      toast.error('Invalid or expired verification link.');
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShowResendLink(false);

    try {
      const { success, error, user, requiresVerification } = await login(formData.email, formData.password);
      
      if (requiresVerification) {
        setUnverifiedEmail(formData.email);
        setShowResendLink(true);
        setError('Please verify your email before logging in.');
        return;
      }
      
      if (success) {
        // Redirect based on role and profile status
        if (user.role === 'admin') {
          navigate('/admin');
        } else if (user.profile_complete) {
          navigate('/dashboard');
        } else {
          navigate('/profile-setup');
        }
      } else {
        setError(error || 'Failed to sign in');
        // If the error is about email verification
        if (error?.toLowerCase().includes('verify')) {
          setUnverifiedEmail(formData.email);
          setShowResendLink(true);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    
    try {
      const response = await resendVerification(unverifiedEmail);
      if (response.success) {
        toast.success('Verification email resent. Please check your inbox.');
      } else {
        throw new Error(response.error);
      }
    } catch (err) {
      console.error('Error resending verification:', err);
      toast.error(err.message || 'Failed to resend verification email');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--light)] to-[var(--accent)] p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white mx-auto flex items-center justify-center">
            <FaHeart className="text-3xl text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold text-white mt-4">Welcome Back</h2>
          <p className="text-pink-100">Sign in to continue your journey</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaExclamationTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                  {showResendLink && unverifiedEmail && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      className="mt-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-dark)] focus:outline-none"
                    >
                      Resend verification email
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {searchParams.get('verified') === 'true' && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-400">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FaCheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Email verified successfully! Please complete your profile.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Email</label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Password</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberMe"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary-light)] border-gray-300 rounded"
                />
                <label htmlFor="rememberMe" className="ml-2 block text-sm text-[var(--text)]">
                  Remember me
                </label>
              </div>
              <Link to="/forgot-password" className="text-sm text-[var(--primary)] hover:text-[var(--primary-dark)]">
                Forgot password?
              </Link>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`btn-primary w-full py-3 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--text-light)]">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-[var(--primary)] hover:text-[var(--primary-dark)]">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;