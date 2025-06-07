import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { subscriptionService } from '../../services';
import { Spinner } from '../UI';

/**
 * FeatureGate component to conditionally render content based on feature access
 * @param {Object} props - Component props
 * @param {string|Array} props.feature - Required feature(s) to check
 * @param {React.ReactNode} props.children - Content to render if feature is available
 * @param {React.ReactNode} [props.fallback=null] - Content to render if feature is not available
 * @param {boolean} [props.showLoading=true] - Whether to show loading state
 * @param {React.Component} [props.loadingComponent=Spinner] - Custom loading component
 * @param {boolean} [props.requireAll=true] - If multiple features, require all (AND) or any (OR)
 * @returns {React.ReactNode} Rendered content based on feature access
 */
const FeatureGate = ({
  feature,
  children,
  fallback = null,
  showLoading = true,
  loadingComponent: LoadingComponent = Spinner,
  requireAll = true,
}) => {
  const { hasFeature: hasFeatureAuth, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [features, setFeatures] = useState({});

  useEffect(() => {
    let isMounted = true;

    const checkFeatures = async () => {
      try {
        // If no feature required, grant access
        if (!feature) {
          if (isMounted) {
            setHasAccess(true);
            setIsLoading(false);
          }
          return;
        }

        // Convert single feature to array for consistent handling
        const featuresToCheck = Array.isArray(feature) ? feature : [feature];
        const featureResults = {};
        
        // Check each feature
        for (const feat of featuresToCheck) {
          // First check local auth context
          const hasLocalAccess = hasFeatureAuth(feat);
          featureResults[feat] = hasLocalAccess;
          
          // If not found locally and user is authenticated, check with the server
          if (!hasLocalAccess && isAuthenticated) {
            try {
              const hasServerAccess = await subscriptionService.isFeatureAvailable(feat);
              featureResults[feat] = hasServerAccess;
            } catch (error) {
              console.error(`Error checking feature ${feat}:`, error);
              featureResults[feat] = false;
            }
          }
        }

        // Determine access based on requireAll flag
        const accessGranted = requireAll
          ? Object.values(featureResults).every(Boolean) // ALL features must be true
          : Object.values(featureResults).some(Boolean); // ANY feature can be true

        if (isMounted) {
          setFeatures(featureResults);
          setHasAccess(accessGranted);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error in FeatureGate:', error);
        if (isMounted) {
          setHasAccess(false);
          setIsLoading(false);
        }
      }
    };

    checkFeatures();

    return () => {
      isMounted = false;
    };
  }, [feature, hasFeatureAuth, isAuthenticated, requireAll]);

  // Show loading state if needed
  if (isLoading && showLoading) {
    return <LoadingComponent />;
  }

  // Return children if feature is available, otherwise return fallback
  return hasAccess ? children : fallback;
};

FeatureGate.propTypes = {
  /** Required feature or array of features to check */
  feature: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  /** Content to render if feature is available */
  children: PropTypes.node.isRequired,
  /** Content to render if feature is not available */
  fallback: PropTypes.node,
  /** Whether to show loading state */
  showLoading: PropTypes.bool,
  /** Custom loading component */
  loadingComponent: PropTypes.elementType,
  /** If multiple features, whether to require all (AND) or any (OR) */
  requireAll: PropTypes.bool,
};

export default FeatureGate;

/**
 * Example usage:
 * 
 * // Basic usage with a single feature
 * <FeatureGate feature="premium_messaging">
 *   <PremiumMessagingComponent />
 * </FeatureGate>
 * 
 * // With custom fallback
 * <FeatureGate 
 *   feature="advanced_analytics"
 *   fallback={
 *     <UpgradePrompt feature="Advanced Analytics" />
 *   }
 * >
 *   <AnalyticsDashboard />
 * </FeatureGate>
 * 
 * // Multiple features (require all)
 * <FeatureGate feature={['premium_messaging', 'advanced_analytics']}>
 *   <PremiumAnalyticsDashboard />
 * </FeatureGate>
 * 
 * // Multiple features (require any)
 * <FeatureGate 
 *   feature={['monthly_subscription', 'yearly_subscription']}
 *   requireAll={false}
 * >
 *   <SubscriberContent />
 * </FeatureGate>
 */
