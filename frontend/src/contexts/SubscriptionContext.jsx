import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { subscriptionAPI } from '../services/api';
import { useAuth } from './AuthContext';

// Define subscription tiers and their levels for comparison
const SUBSCRIPTION_TIERS = {
  BASIC: 'Basic',
  PREMIUM: 'Premium',
  ELITE: 'Elite'
};

const SUBSCRIPTION_LEVELS = {
  [SUBSCRIPTION_TIERS.BASIC]: 1,
  [SUBSCRIPTION_TIERS.PREMIUM]: 2,
  [SUBSCRIPTION_TIERS.ELITE]: 3
};

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  const fetchSubscription = useCallback(async () => {
    if (!currentUser) {
      setSubscription(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await subscriptionAPI.getUserSubscription();
      if (response) {
        setSubscription(response);
      } else {
        setSubscription(null);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
      setError(err.response?.data?.message || 'Error fetching subscription data');
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Fetch subscription when component mounts or currentUser changes
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  /**
   * Checks if the current user has an active subscription
   * @returns {boolean} True if user has an active subscription
   */
  const hasActiveSubscription = useCallback(() => {
    return !!(subscription && subscription.status === 'active');
  }, [subscription]);

  /**
   * Gets the current subscription tier level (Basic, Premium, Elite)
   * @returns {string|null} The subscription tier or null if no active subscription
   */
  const getSubscriptionTier = useCallback(() => {
    if (!hasActiveSubscription()) return null;
    return subscription.tier_level || subscription.package_details?.tier_level || null;
  }, [subscription, hasActiveSubscription]);

  /**
   * Checks if the current user's subscription has access to a specific feature
   * @param {string} featureKey - The key/name of the feature to check
   * @returns {boolean} True if the user has access to the feature
   */
  const hasFeatureAccess = useCallback((featureKey) => {
    if (!featureKey) return false;
    
    // If no subscription, only allow features that don't require a subscription
    if (!hasActiveSubscription()) {
      return false;
    }
    
    const keyLower = featureKey.toLowerCase().trim();
    
    // Check if the feature is explicitly listed in the subscription features
    if (subscription.features?.some(feature => 
      feature.name && feature.name.toLowerCase().includes(keyLower)
    )) {
      return true;
    }
    
    return false;
  }, [subscription, hasActiveSubscription]);

  /**
   * Checks if the user's subscription meets or exceeds the required tier level
   * @param {string} requiredTier - The minimum required tier level (Basic, Premium, Elite)
   * @returns {boolean} True if the user's subscription meets or exceeds the required tier
   */
  const meetsTierRequirement = useCallback((requiredTier) => {
    if (!requiredTier || !hasActiveSubscription()) return false;
    
    const currentTier = getSubscriptionTier();
    if (!currentTier) return false;
    
    const currentLevel = SUBSCRIPTION_LEVELS[currentTier.toUpperCase()] || 0;
    const requiredLevel = SUBSCRIPTION_LEVELS[requiredTier.toUpperCase()] || 0;
    
    return currentLevel >= requiredLevel;
  }, [getSubscriptionTier, hasActiveSubscription]);

  const contextValue = {
    subscription,
    isLoading,
    error,
    fetchSubscription,
    hasFeatureAccess,
    hasActiveSubscription,
    getSubscriptionTier,
    meetsTierRequirement,
    SUBSCRIPTION_TIERS,
    SUBSCRIPTION_LEVELS
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === null) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
