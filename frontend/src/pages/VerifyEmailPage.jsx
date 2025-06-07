import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const VerifyEmailPage = () => {
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get('token');

  useEffect(() => {
    // Check if we have a token in the URL
    if (!token) {
      setError('No verification token provided');
      setStatus('error');
      return;
    }

    // Prevent multiple verification attempts
    let isMounted = true;
    let timeoutId;

    const verifyToken = async () => {
      try {
        setStatus('verifying');
        
        // Call the verify email API
        const response = await verifyEmail(token);
        
        if (!isMounted) return;
        
        if (response.success) {
          setStatus('success');
          setMessage(response.message || 'Email verified successfully!');
          
          // Handle auto-login if token is provided
          if (response.token) {
            await login(response.token);
            
            // Redirect based on profile setup status
            if (response.requiresProfileSetup) {
              // Use window.location to force a full page refresh and ensure auth state is properly set
              window.location.href = '/profile-setup';
            } else {
              window.location.href = '/dashboard';
            }
          } else {
            // If no token but verified, redirect to login
            window.location.href = '/login?verified=true';
          }
        } else {
          throw new Error(response.error || 'Email verification failed');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Verification error:', err);
        setError(err.message || 'An error occurred during verification');
        setStatus('error');
        
        // Redirect to login with error after a delay
        timeoutId = setTimeout(() => {
          window.location.href = `/login?error=${encodeURIComponent(err.message || 'verification_failed')}`;
        }, 3000);
      }
    };

    verifyToken();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [token, login]);

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-600 mx-auto"></div>
            <h2 className="mt-6 text-2xl md:text-3xl font-extrabold text-gray-900">
              Verifying your email...
            </h2>
            <p className="mt-4 text-gray-600">
              Please wait while we verify your email address.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              This may take a moment. Please don't close this page.
            </p>
          </div>
        );
      
      case 'success':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100">
              <svg
                className="h-12 w-12 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl md:text-3xl font-extrabold text-gray-900">
              Email Verified Successfully!
            </h2>
            <p className="mt-4 text-gray-600">
              {message || 'Your email has been verified. You will be redirected shortly.'}
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Go to Login
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <>
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
              <svg
                className="h-10 w-10 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-2xl md:text-3xl font-extrabold text-gray-900">
              Verification Failed
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {error || 'An error occurred while verifying your email. Please try again.'}
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/resend-verification')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Request a new verification email
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center p-8 bg-white rounded-lg shadow-md">
        {renderContent()}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
