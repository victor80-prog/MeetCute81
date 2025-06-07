import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../UI';
import { subscriptionService } from '../../services';

/**
 * Higher-Order Component to handle feature-based access control
 * @param {React.Component} WrappedComponent - The component to wrap
 * @param {Object} options - Configuration options
 * @param {string|Array} options.requiredFeature - Feature(s) required to access the component
 * @param {React.Component} options.FallbackComponent - Component to render if feature is not available
 * @param {boolean} options.loadingComponent - Whether to show loading state
 * @returns {React.Component} Wrapped component with feature check
 */
const withFeature = (
  WrappedComponent,
  {
    requiredFeature,
    FallbackComponent = null,
    loadingComponent: LoadingComponent = Spinner,
  } = {}
) => {
  // If no feature required, return the component as is
  if (!requiredFeature) {
    return WrappedComponent;
  }

  // Create the feature wrapper component
  const FeatureWrapper = (props) => {
    const { hasFeature: hasFeatureAuth, user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [features, setFeatures] = useState({});

    // Check if the user has the required feature(s)
    useEffect(() => {
      let isMounted = true;

      const checkFeatures = async () => {
        try {
          // If user is not authenticated, no access
          if (!user) {
            if (isMounted) {
              setHasAccess(false);
              setIsLoading(false);
            }
            return;
          }

          // Convert single feature to array for consistent handling
          const featuresToCheck = Array.isArray(requiredFeature)
            ? requiredFeature
            : [requiredFeature];

          // Check each required feature
          const featureChecks = await Promise.all(
            featuresToCheck.map(async (feature) => {
              // First check local auth context
              if (hasFeatureAuth(feature)) {
                return { feature, hasAccess: true };
              }

              // If not found locally, check with the server
              try {
                const hasServerAccess = await subscriptionService.isFeatureAvailable(feature);
                return { feature, hasAccess: hasServerAccess };
              } catch (error) {
                console.error(`Error checking feature ${feature}:`, error);
                return { feature, hasAccess: false };
              }
            })
          );

          // Combine all feature check results
          const results = featureChecks.reduce(
            (acc, { feature, hasAccess }) => ({
              ...acc,
              [feature]: hasAccess,
            }),
            {}
          );

          // User has access if ALL required features are available
          const allFeaturesAvailable = featureChecks.every(({ hasAccess }) => hasAccess);

          if (isMounted) {
            setFeatures(results);
            setHasAccess(allFeaturesAvailable);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error checking features:', error);
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
    }, [hasFeatureAuth, requiredFeature, user]);

    // Show loading state if needed
    if (isLoading && LoadingComponent) {
      return <LoadingComponent />;
    }

    // Show fallback if feature is not available
    if (!hasAccess) {
      return FallbackComponent ? (
        <FallbackComponent features={features} requiredFeature={requiredFeature} />
      ) : null;
    }

    // Render the wrapped component with all props and features
    return <WrappedComponent {...props} features={features} />;
  };

  // Set display name for better debugging
  const wrappedComponentName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';
  FeatureWrapper.displayName = `withFeature(${wrappedComponentName})`;

  return FeatureWrapper;
};

export default withFeature;
