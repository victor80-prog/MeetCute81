import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaExclamationTriangle, FaEnvelope } from 'react-icons/fa';

const Suspended = () => {
  const location = useLocation();
  const suspensionDetails = location.state || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--light)] to-white flex flex-col justify-center items-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-[var(--primary-light)]">
        <div className="mb-6">
          <div className="w-20 h-20 rounded-full bg-[var(--primary-light)] flex items-center justify-center mx-auto">
            <FaExclamationTriangle className="text-[var(--primary)] text-4xl" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-[var(--primary)] mb-4">
          Account Suspended
        </h1>
        
        <p className="text-[var(--text)] mb-6">
          {suspensionDetails.reason || 'Your account has been suspended for violating our community guidelines.'}
          <br />
          If you believe this is an error, please contact our support team.
        </p>

        <div className="bg-[var(--light)] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--primary)] mb-3">
            Contact Support
          </h2>
          <div className="flex items-center justify-center text-[var(--text)]">
            <FaEnvelope className="mr-2 text-[var(--primary)]" />
            <a 
              href="mailto:support@meetcute.com"
              className="text-[var(--primary)] hover:text-[var(--primary-dark)] transition-colors font-medium"
            >
              support@meetcute.com
            </a>
          </div>
        </div>

        <Link
          to="/"
          className="inline-block bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
        >
          Return Home
        </Link>

        {suspensionDetails.suspendedAt && (
          <div className="mt-6 text-sm text-[var(--text-light)]">
            Suspended on: {new Date(suspensionDetails.suspendedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Suspended; 