import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { resendVerification } from '../services/authService';

const VerificationStatusPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = searchParams.get('status');
  const error = searchParams.get('error');
  const email = searchParams.get('email');

  useEffect(() => {
    // Show appropriate toast message based on status/error
    if (status === 'already_verified') {
      toast.success('Your email is already verified. You can now log in.');
    } else if (status === 'verified') {
      toast.success('Email verified successfully!');
    } else if (error === 'invalid_token') {
      toast.error('Invalid or expired verification link.');
    } else if (error === 'verification_failed') {
      toast.error('Failed to verify email. Please try again.');
    }
  }, [status, error]);

  const handleResendVerification = async () => {
    if (!email) {
      toast.error('No email provided for resending verification');
      return;
    }

    try {
      const response = await resendVerification(email);
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {status === 'verified' ? 'Email Verified!' : 'Verification Status'}
          </h2>
        </div>

        <div className="mt-8 space-y-6">
          {status === 'verified' ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="mt-3 text-base text-gray-500">
                Your email has been successfully verified. You can now set up your profile.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => navigate('/profile-setup')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Set Up Profile
                </button>
              </div>
            </div>
          ) : error === 'invalid_token' ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-medium text-gray-900">Invalid or Expired Link</h3>
              <p className="mt-1 text-sm text-gray-500">
                The verification link is invalid or has expired. Please request a new verification email.
              </p>
              {email && (
                <div className="mt-6">
                  <button
                    onClick={handleResendVerification}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Resend Verification Email
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-500">
                {error || 'An unknown error occurred during verification.'}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationStatusPage;
