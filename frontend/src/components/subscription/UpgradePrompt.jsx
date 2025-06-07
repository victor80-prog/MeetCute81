import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { FaCrown, FaGem, FaRocket, FaCheckCircle } from 'react-icons/fa';
import { Button } from '../UI';
import { subscriptionService } from '../../services';
import { useAuth } from '../../hooks/useAuth';

/**
 * Component to display when a user needs to upgrade their subscription
 * @param {Object} props - Component props
 * @param {string} [props.feature] - Name of the feature that requires upgrade
 * @param {string} [props.requiredPlan] - Required plan name for the feature
 * @param {string} [props.message] - Custom message to display
 * @param {boolean} [props.showPlans=false] - Whether to show available plans
 * @param {Function} [props.onUpgrade] - Callback when upgrade is clicked
 * @returns {JSX.Element} Upgrade prompt component
 */
const UpgradePrompt = ({
  feature,
  requiredPlan = 'Premium',
  message,
  showPlans = false,
  onUpgrade,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(showPlans);
  const [error, setError] = React.useState(null);

  // Fetch available plans if needed
  React.useEffect(() => {
    if (showPlans) {
      const fetchPlans = async () => {
        try {
          setIsLoading(true);
          const response = await subscriptionService.getSubscriptionPlans();
          setPlans(response.data || []);
        } catch (err) {
          console.error('Failed to fetch plans:', err);
          setError('Failed to load subscription plans. Please try again later.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchPlans();
    }
  }, [showPlans]);

  // Handle upgrade button click
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigate('/subscription/upgrade');
    }
  };

  // Get feature icon based on plan
  const getPlanIcon = (planName) => {
    switch (planName.toLowerCase()) {
      case 'premium':
        return <FaGem className="text-purple-500" />;
      case 'elite':
        return <FaCrown className="text-yellow-500" />;
      default:
        return <FaRocket className="text-blue-500" />;
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Default upgrade message
  const defaultMessage = feature
    ? `The "${feature}" feature is only available with a ${requiredPlan} subscription.`
    : `This feature requires a ${requiredPlan} subscription.`;

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100">
            <FaGem className="h-6 w-6 text-indigo-600" />
          </div>
          <h3 className="mt-2 text-lg font-medium text-gray-900">
            {feature ? 'Upgrade Required' : 'Premium Feature'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {message || defaultMessage}
          </p>
          
          {!user ? (
            <div className="mt-6">
              <p className="text-sm text-gray-500 mb-4">
                Please sign in or create an account to continue.
              </p>
              <div className="flex justify-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => navigate('/login', { state: { from: window.location.pathname } })}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  onClick={() => navigate('/register')}
                >
                  Create Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <Button
                variant="primary"
                size="lg"
                onClick={handleUpgrade}
                className="w-full sm:w-auto"
              >
                Upgrade to {requiredPlan}
              </Button>
              
              <p className="mt-3 text-xs text-gray-500">
                Already have a subscription?{' '}
                <button
                  type="button"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                  onClick={() => navigate('/subscription/manage')}
                >
                  Manage subscription
                </button>
              </p>
            </div>
          )}
        </div>
        
        {showPlans && plans.length > 0 && (
          <div className="mt-10">
            <h4 className="text-center text-sm font-medium text-gray-900 uppercase tracking-wider">
              Choose the right plan for you
            </h4>
            
            <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:gap-8">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-lg border ${
                    plan.name.toLowerCase() === requiredPlan.toLowerCase()
                      ? 'border-indigo-500 ring-2 ring-indigo-500'
                      : 'border-gray-200'
                  } bg-white p-6 shadow-sm`}
                >
                  {plan.recommended && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white">
                        Recommended
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <div className="mr-3 h-8 w-8">
                      {getPlanIcon(plan.name)}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {plan.name}
                    </h3>
                  </div>
                  
                  <p className="mt-4 text-sm text-gray-500">
                    {plan.description}
                  </p>
                  
                  <p className="mt-4">
                    <span className="text-4xl font-extrabold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-base font-medium text-gray-500">
                      /{plan.billingCycle}
                    </span>
                  </p>
                  
                  <ul className="mt-6 space-y-3">
                    {plan.features?.map((feature, index) => (
                      <li key={index} className="flex">
                        <FaCheckCircle
                          className="h-5 w-5 flex-shrink-0 text-green-500"
                          aria-hidden="true"
                        />
                        <span className="ml-3 text-sm text-gray-700">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="mt-6">
                    <Button
                      variant={
                        plan.name.toLowerCase() === requiredPlan.toLowerCase()
                          ? 'primary'
                          : 'outline'
                      }
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        navigate(`/subscription/checkout?plan=${plan.id}`)
                      }
                    >
                      {plan.cta || 'Get Started'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Need help choosing?{' '}
                <button
                  type="button"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                  onClick={() => navigate('/contact')}
                >
                  Contact our sales team
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

UpgradePrompt.propTypes = {
  /** Name of the feature that requires upgrade */
  feature: PropTypes.string,
  /** Required plan name for the feature */
  requiredPlan: PropTypes.string,
  /** Custom message to display */
  message: PropTypes.node,
  /** Whether to show available plans */
  showPlans: PropTypes.bool,
  /** Callback when upgrade is clicked */
  onUpgrade: PropTypes.func,
};

export default UpgradePrompt;

/**
 * Example usage:
 * 
 * // Basic upgrade prompt
 * <UpgradePrompt 
 *   feature="Advanced Analytics"
 *   requiredPlan="Premium"
 *   message="Unlock powerful analytics to track your performance and growth."
 * />
 * 
 * // With plans displayed
 * <UpgradePrompt 
 *   feature="Team Collaboration"
 *   requiredPlan="Team"
 *   showPlans={true}
 * />
 * 
 * // Custom upgrade handler
 * <UpgradePrompt 
 *   feature="Priority Support"
 *   requiredPlan="Business"
 *   onUpgrade={() => {
 *     // Custom upgrade logic
 *     trackUpgradeClick('priority_support');
 *     showUpgradeModal();
 *   }}
 * />
 */
