import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { FaCheckCircle } from 'react-icons/fa';

const SubscriptionConfirmation = () => {
  const location = useLocation();
  const { subscription } = location.state || {};

  if (!subscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Invalid subscription data</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--light)] to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <FaCheckCircle className="text-green-500 text-4xl" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-[var(--primary)] mb-4">
          Thank You!
        </h1>

        <p className="text-[var(--text)] mb-6">
          Your subscription has been successfully activated. You now have access to all {subscription.package_name} features.
        </p>

        <div className="bg-[var(--light)] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--primary)] mb-3">
            Subscription Details
          </h2>
          <div className="space-y-2 text-[var(--text)]">
            <p>
              <span className="font-medium">Package:</span> {subscription.package_name}
            </p>
            <p>
              <span className="font-medium">Amount:</span> ${subscription.price}/month
            </p>
            <p>
              <span className="font-medium">Next billing date:</span>{' '}
              {new Date(subscription.end_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="space-x-4">
          <Link
            to="/discover"
            className="inline-block bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
          >
            Start Exploring
          </Link>
          <Link
            to="/settings/subscription"
            className="inline-block bg-[var(--light)] text-[var(--primary)] px-8 py-3 rounded-full font-medium hover:bg-[var(--primary-light)] transition-colors"
          >
            Manage Subscription
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionConfirmation; 