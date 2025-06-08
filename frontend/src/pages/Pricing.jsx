import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheck, FaTimes, FaCrown, FaArrowRight } from 'react-icons/fa';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';

const Pricing = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { subscription: currentSubscription } = useSubscription();

  // Fetch all subscription packages
  useEffect(() => {
    const fetchPackages = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get('/api/subscriptions/packages');
        setPackages(response.data || []);
      } catch (err) {
        console.error('Error fetching packages:', err);
        setError(err.response?.data?.message || 'Failed to load subscription packages');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, []);

  // Process packages into tiers and features
  const { tiers, allFeatures } = useMemo(() => {
    const tiers = {};
    const featuresMap = new Map();

    packages.forEach(pkg => {
      if (!pkg.tier_level) return;

      // For each tier, keep the monthly package by default
      if (!tiers[pkg.tier_level] || pkg.billing_interval === 'monthly') {
        tiers[pkg.tier_level] = pkg;
      }

      // Collect all unique features
      pkg.features?.forEach(feature => {
        if (!featuresMap.has(feature.name)) {
          featuresMap.set(feature.name, feature.description || 'No description available.');
        }
      });
    });

    // Ensure specific order: Basic, Premium, Elite
    const tierOrder = ['Basic', 'Premium', 'Elite'];
    const orderedTiers = [];
    
    tierOrder.forEach(tierName => {
      if (tiers[tierName]) {
        orderedTiers.push(tiers[tierName]);
        delete tiers[tierName];
      }
    });

    // Add any remaining tiers
    Object.values(tiers).forEach(tier => {
      orderedTiers.push(tier);
    });

    // Set Basic tier price to 0
    const basicTier = orderedTiers.find(t => t.tier_level === 'Basic');
    if (basicTier) {
      basicTier.price = 0;
    }

    return {
      tiers: orderedTiers,
      allFeatures: Array.from(featuresMap, ([name, description]) => ({ name, description }))
    };
  }, [packages]);

  const handleChoosePlan = (packageId, tierLevel) => {
    if (!currentUser) {
      navigate('/login', { state: { from: '/pricing', packageId } });
      return;
    }

    // If user already has this tier, don't navigate
    if (currentSubscription?.tier_level === tierLevel) {
      return;
    }

    // Navigate to subscription confirmation page
    navigate(`api/subscribe/${packageId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-red-600 p-8 bg-white shadow-lg rounded-lg text-center max-w-md">
          <h2 className="text-2xl font-semibold mb-4">Error Loading Packages</h2>
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-600 p-8 bg-white shadow-lg rounded-lg text-center max-w-md">
          <h2 className="text-2xl font-semibold mb-4">No Subscription Packages Available</h2>
          <p className="mb-4">Please check back later or contact support.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            Choose Your Perfect Plan
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-xl text-gray-500">
            Select the subscription that fits your needs and start connecting today.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
          {tiers.map((pkg) => {
            const isCurrentPlan = currentSubscription?.tier_level === pkg.tier_level;
            const isUpgrade = currentSubscription && 
              pkg.tier_level !== 'Basic' && 
              pkg.tier_level !== currentSubscription.tier_level &&
              (pkg.tier_level === 'Elite' || 
               (pkg.tier_level === 'Premium' && currentSubscription.tier_level === 'Basic'));
            
            return (
              <div
                key={pkg.id}
                className={`relative bg-white border-2 rounded-2xl shadow-sm overflow-hidden ${
                  pkg.tier_level === 'Premium' ? 'border-blue-500' : 'border-gray-200'
                }`}
              >
                {pkg.tier_level === 'Premium' && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                    Most Popular
                  </div>
                )}
                
                <div className="p-8">
                  <h2 className="text-lg font-medium text-gray-900">
                    {pkg.tier_level} Plan
                    {pkg.tier_level === 'Elite' && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Best Value
                      </span>
                    )}
                  </h2>
                  
                  <p className="mt-4 flex items-baseline text-gray-900">
                    <span className="text-5xl font-extrabold tracking-tight">
                      ${pkg.price}
                    </span>
                    <span className="ml-1 text-xl font-semibold text-gray-500">
                      /{pkg.billing_interval === 'monthly' ? 'month' : 'year'}
                    </span>
                  </p>
                  
                  <p className="mt-6 text-gray-500">{pkg.description}</p>
                  
                  <ul className="mt-6 space-y-4">
                    {allFeatures.map((feature, index) => {
                      const hasFeature = pkg.features?.some(f => f.name === feature.name);
                      return (
                        <li key={index} className="flex items-start">
                          {hasFeature ? (
                            <FaCheck className="flex-shrink-0 h-5 w-5 text-green-500" />
                          ) : (
                            <FaTimes className="flex-shrink-0 h-5 w-5 text-gray-300" />
                          )}
                          <span className={`ml-3 ${hasFeature ? 'text-gray-700' : 'text-gray-400'}`}>
                            {feature.name}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  
                  <div className="mt-8">
                    <button
                      onClick={() => handleChoosePlan(pkg.id, pkg.tier_level)}
                      disabled={isCurrentPlan}
                      className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        isCurrentPlan
                          ? 'bg-gray-400 cursor-not-allowed'
                          : pkg.tier_level === 'Premium'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {isCurrentPlan ? (
                        'Current Plan'
                      ) : isUpgrade ? (
                        <>
                          Upgrade Now <FaArrowRight className="ml-2 -mr-1 h-4 w-4" />
                        </>
                      ) : (
                        'Get Started'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Need help choosing the right plan? <a href="/contact" className="text-indigo-600 hover:text-indigo-500">Contact our support team</a>.</p>
          <p className="mt-2">Prices and features are subject to change. Subscriptions auto-renew unless cancelled.</p>
          <p>For more details, please review our Terms of Service.</p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;