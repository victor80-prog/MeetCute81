import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSubscription } from "../contexts/SubscriptionContext";
import { useAuth } from "../contexts/AuthContext";
import api from '../services/api';
import UserBalanceDisplay, { balanceEventEmitter } from '../components/UserBalanceDisplay'; // Import balance components
import { FaWallet } from 'react-icons/fa'; // For Buy with Balance button

// import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const ConfirmSubscriptionPage = () => {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { subscription: currentSubscription, fetchSubscription, isLoading: isSubscriptionLoading } = useSubscription();

  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isLoadingPackage, setIsLoadingPackage] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // Used for manual payment form submission
  const [isProcessingBalancePurchase, setIsProcessingBalancePurchase] = useState(false); // For balance purchase
  const [error, setError] = useState(null); // General errors
  const [actionType, setActionType] = useState('Subscribe');
  const [gainedFeatures, setGainedFeatures] = useState([]);
  const [lostFeatures, setLostFeatures] = useState([]);

  // New state variables
  const [countries, setCountries] = useState([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [countryError, setCountryError] = useState(null);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethodConfig, setSelectedPaymentMethodConfig] = useState(null);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [paymentMethodError, setPaymentMethodError] = useState(null);

  const [initiatedTransaction, setInitiatedTransaction] = useState(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [successMessage, setSuccessMessage] = useState(''); // For success messages

  // For site balance purchase
  const [currentBalance, setCurrentBalance] = useState(null);
  const [canUseBalance, setCanUseBalance] = useState(false);


  const fetchCurrentBalance = useCallback(async () => {
    try {
      const response = await api.get('/api/balance');
      const balanceValue = parseFloat(response.data.balance);
      setCurrentBalance(balanceValue);
      if (selectedPackage && balanceValue >= parseFloat(selectedPackage.price)) {
        setCanUseBalance(true);
      } else {
        setCanUseBalance(false);
      }
    } catch (err) {
      console.error("Error fetching current balance:", err);
      // Not critical for page load if UserBalanceDisplay handles its own display
    }
  }, [selectedPackage]); // Re-check if balance is sufficient when selectedPackage changes

  useEffect(() => {
    fetchCurrentBalance();
    const unsubscribe = balanceEventEmitter.subscribe(fetchCurrentBalance);
    return unsubscribe;
  }, [fetchCurrentBalance]);

  // Fetch package details
  useEffect(() => {
    const loadPackageDetails = async () => {
      if (!packageId) {
        setError('No package ID provided.');
        setIsLoadingPackage(false);
        return;
      }
      setIsLoadingPackage(true);
      try {
        const response = await api.get(`/api/subscriptions/packages/${packageId}`);
        setSelectedPackage(response.data);
      } catch (err) {
        console.error('Error fetching package details:', err);
        setError(err.response?.data?.message || 'Failed to load package details.');
      } finally {
        setIsLoadingPackage(false);
      }
    };
    loadPackageDetails();
  }, [packageId]);

  // Update canUseBalance when selectedPackage or currentBalance changes
   useEffect(() => {
    if (selectedPackage && currentBalance !== null) {
      if (parseFloat(currentBalance) >= parseFloat(selectedPackage.price)) {
        setCanUseBalance(true);
      } else {
        setCanUseBalance(false);
      }
    }
  }, [selectedPackage, currentBalance]);

  // Determine Action Type
  useEffect(() => {
    if (currentSubscription && selectedPackage) {
      if (currentSubscription.status === 'active') {
        if (parseFloat(selectedPackage.price) > parseFloat(currentSubscription.price)) {
          setActionType('Upgrade');
        } else if (parseFloat(selectedPackage.price) < parseFloat(currentSubscription.price)) {
          setActionType('Downgrade');
        } else if (selectedPackage.id !== currentSubscription.package_id) {
          setActionType('Switch Plan'); // Same price, different package
        } else {
          setActionType('Re-subscribe'); // Same package, but not active (e.g. cancelled)
        }
      } else { // No active current subscription
        setActionType('Subscribe');
      }
    } else if (selectedPackage) { // No current subscription, but have a selected package
        setActionType('Subscribe');
    }
  }, [currentSubscription, selectedPackage]);

  // Fetch Countries
  useEffect(() => {
    const fetchCountries = async () => {
      setIsLoadingCountries(true);
      setCountryError(null);
      try {
        const response = await api.get('/api/countries');
        setCountries(response.data || []);
        if (currentUser?.country_id) {
          setSelectedCountryId(currentUser.country_id.toString());
        }
      } catch (err) {
        console.error('Error fetching countries:', err);
        setCountryError(err.response?.data?.message || 'Failed to load countries.');
      } finally {
        setIsLoadingCountries(false);
      }
    };
    fetchCountries();
  }, [currentUser?.country_id]); // Depend on user's country_id to pre-select

  // Fetch Payment Methods when selectedCountryId changes
  useEffect(() => {
    if (selectedCountryId) {
      setIsLoadingPaymentMethods(true);
      setPaymentMethodError(null);
      setPaymentMethods([]); // Clear previous methods
      setSelectedPaymentMethodConfig(null); // Clear selected payment method config
      setInitiatedTransaction(null); // Clear any previous transaction initiation
      setPaymentReference(''); // Clear payment reference

      api.get(`/transactions/country/${selectedCountryId}/methods`)
        .then(response => {
          setPaymentMethods(response.data || []);
        })
        .catch(err => {
          console.error('Error fetching payment methods:', err);
          setPaymentMethodError(err.response?.data?.message || 'Failed to load payment methods for this country.');
        })
        .finally(() => {
          setIsLoadingPaymentMethods(false);
        });
    } else {
      setPaymentMethods([]);
      setSelectedPaymentMethodConfig(null);
      setPaymentMethodError(null);
      setInitiatedTransaction(null);
       setPaymentReference('');
    }
  }, [selectedCountryId]);

  // Helper function to calculate feature differences (existing)
  const getFeatureDifferences = (currentFeatures = [], selectedFeatures = []) => {
    const currentFeatureNames = new Set(currentFeatures.map(f => f.name));
    const selectedFeatureNames = new Set(selectedFeatures.map(f => f.name));

    const gained = selectedFeatures.filter(f => !currentFeatureNames.has(f.name));
    const lost = currentFeatures.filter(f => !selectedFeatureNames.has(f.name));
    return { gained, lost };
  };

  useEffect(() => {
    if (currentSubscription && currentSubscription.features && selectedPackage && selectedPackage.features) {
      const { gained, lost } = getFeatureDifferences(currentSubscription.features, selectedPackage.features);
    if (actionType === 'Upgrade' || actionType === 'Switch Plan') {
        setGainedFeatures(gained);
      setLostFeatures(lost);
      } else if (actionType === 'Downgrade') {
        setLostFeatures(lost);
      setGainedFeatures(gained);
      } else {
        setGainedFeatures([]);
        setLostFeatures([]);
      }
    } else {
      setGainedFeatures([]);
      setLostFeatures([]);
    }
  }, [currentSubscription, selectedPackage, actionType]);

  const handlePurchaseWithBalance = async () => {
    if (!selectedPackage) return;
    
    try {
      setIsProcessingBalancePurchase(true);
      setError('');
      
      const response = await api.post('/api/subscriptions/purchase-with-balance', { packageId: selectedPackage.id });
      setSuccessMessage(response.data.message || 'Subscription purchased successfully with account balance!');
      await fetchSubscription(); // Refresh subscription state from context
      await fetchCurrentBalance(); // Refresh balance
      // Optionally, navigate to a success page or dashboard after a short delay
      setTimeout(() => {
        navigate('/profile'); // Or a dedicated subscription success page
      }, 2000);
    } catch (err) {
      console.error('Error purchasing with balance:', err);
      setError(err.response?.data?.error || 'Failed to purchase subscription with balance.');
    }
    setIsProcessingBalancePurchase(false);
  };


  const handleSubmit = async (event) => {
    event.preventDefault();
    // This function will be refactored in a subsequent step to handle the new payment flow.
    // For now, it might not do anything or might be used for the payment reference submission part later.
    // If initiatedTransaction is set, this form might be for submitting reference.

    if (!initiatedTransaction) {
        // Logic to initiate transaction
        if (!selectedPaymentMethodConfig) {
            setError('Please select a payment method.');
            return;
        }
        setIsProcessing(true);
        setError(null);
        try {
            const payload = {
                countryId: selectedCountryId,
                paymentMethodTypeId: selectedPaymentMethodConfig.payment_method_id,
                itemCategory: 'subscription', // Assuming only subscription for now
                itemId: selectedPackage.id,
            };
            const response = await api.post('/api/transactions/initiate', payload);
            setInitiatedTransaction(response.data); // Store transaction and payment instructions
            // The UI should now update to show payment instructions and reference input
        } catch (err) {
            console.error('Error initiating transaction:', err);
            setError(err.response?.data?.message || 'Failed to initiate transaction.');
        } finally {
            setIsProcessing(false);
        }
      } else {
        // Logic to submit payment reference
        if (!paymentReference.trim()) {
            setError('Please enter your payment reference.');
            return;
        }
        setIsProcessing(true);
        setError(null);
        try {
            const response = await api.post(`/transactions/${initiatedTransaction.transaction.id}/submit-reference`, {
                userProvidedReference: paymentReference,
            });
            // On successful submission of reference, navigate to a confirmation/pending page
            await fetchSubscription(); // Refresh global subscription state, as it might be pending verification
            navigate('/subscription/confirmation', { // Or a new page for pending verification
                state: {
                    message: 'Payment reference submitted. Your subscription is pending verification.',
                    subscriptionDetails: response.data // The updated transaction object
                }
            });
        } catch (err) {
             console.error('Error submitting payment reference:', err);
             setError(err.response?.data?.message || 'Failed to submit payment reference.');
        } finally {
            setIsProcessing(false);
        }
      }
  };

  const getActionVerb = () => {
    if (actionType === 'Switch Plan') return 'Switch to';
    return actionType;
  }

  if (isLoadingPackage || isSubscriptionLoading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="loader">Loading...</div></div>;
  }

  if (error && !selectedPackage) { // Critical error like package not found
    return <div className="text-center py-10 text-red-500">Error: {error} <Link to="/pricing" className="text-blue-500 underline">Go to Pricing</Link></div>;
  }

  if (!selectedPackage) {
    return <div className="text-center py-10">Package not found. <Link to="/pricing" className="text-blue-500 underline">Return to Pricing</Link></div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto bg-slate-800 shadow-xl rounded-lg overflow-hidden">
        <div className="p-6 md:p-8">
          <h2 className="text-3xl font-extrabold text-center mb-2">
            {getActionVerb()} {selectedPackage.name}
          </h2>
          <p className="text-center text-slate-400 mb-6 text-lg">
            Confirm your plan details and payment method.
          </p>

          {/* Error display at the top */}
          {error && <p className="text-red-400 text-sm mb-4 p-3 bg-red-900/20 rounded-md text-center">{error}</p>}

          {/* Package Details */}
          <div className="bg-slate-700 p-6 rounded-lg mb-6">
            <h3 className="text-xl font-semibold mb-3">{selectedPackage.tier_level} Tier Features:</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-300 mb-4">
              {selectedPackage.features?.map(feature => (
                <li key={feature.name || feature.id}>{feature.name}</li>
              ))}
            </ul>
            <div className="text-right">
              <span className="text-4xl font-bold">${selectedPackage.price}</span>
              <span className="text-slate-400">/{selectedPackage.billing_interval === 'monthly' ? 'mo' : selectedPackage.billing_interval}</span>
            </div>
          </div>

          {/* Display Gained/Lost Features */}
          {actionType === 'Upgrade' && gainedFeatures.length > 0 && (
            <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded-lg text-sm">
              <h4 className="font-semibold text-green-400 mb-2">Features you'll gain:</h4>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                {gainedFeatures.map(f => <li key={`gained-${f.name}`}>{f.name}</li>)}
              </ul>
            </div>
          )}
          {actionType === 'Downgrade' && lostFeatures.length > 0 && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-sm">
              <h4 className="font-semibold text-red-400 mb-2">Features you'll lose access to:</h4>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                {lostFeatures.map(f => <li key={`lost-${f.name}`}>{f.name}</li>)}
              </ul>
            </div>
          )}
           {actionType === 'Switch Plan' && (gainedFeatures.length > 0 || lostFeatures.length > 0) && (
            <div className="mb-6 space-y-3">
              {gainedFeatures.length > 0 && (
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg text-sm">
                  <h4 className="font-semibold text-green-400 mb-2">New features you'll get:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {gainedFeatures.map(f => <li key={`gained-switch-${f.name}`}>{f.name}</li>)}
                  </ul>
                </div>
              )}
              {lostFeatures.length > 0 && (
                 <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg text-sm">
                  <h4 className="font-semibold text-red-400 mb-2">Features you'll no longer have:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {lostFeatures.map(f => <li key={`lost-switch-${f.name}`}>{f.name}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Current Subscription Info (existing) */}
          {currentSubscription && currentSubscription.status === 'active' && (
            <div className="mb-6 p-4 bg-slate-700/50 rounded-lg text-sm">
              <p className="font-semibold">Current Plan: {currentSubscription.package_name} (${currentSubscription.price}/{currentSubscription.billing_interval})</p>
              <p className="text-slate-400">Your current billing cycle ends on: {new Date(currentSubscription.end_date).toLocaleDateString()}.</p>
              {actionType === 'Upgrade' && <p className="text-green-400 mt-1">You are upgrading your plan.</p>}
              {actionType === 'Downgrade' && <p className="text-yellow-400 mt-1">You are downgrading your plan. Changes will apply as per new term.</p>}
              {actionType === 'Switch Plan' && <p className="text-blue-400 mt-1">You are switching your plan.</p>}
            </div>
          )}

          {/* Balance Payment Option */}
          <div className="mb-6 p-4 bg-slate-700/50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <p className="text-lg font-semibold">Your Site Balance</p>
                <UserBalanceDisplay />
            </div>
            {canUseBalance && selectedPackage && (
              <button
                onClick={handlePurchaseWithBalance}
                disabled={isProcessingBalancePurchase || isProcessing}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50 flex items-center justify-center"
              >
                <FaWallet className="mr-2" />
                {isProcessingBalancePurchase ? 'Processing...' : `Use Balance for ${selectedPackage.name} ($${selectedPackage.price})`}
              </button>
            )}
            {!canUseBalance && currentBalance !== null && selectedPackage && (
              <p className="text-sm text-yellow-400 mt-2">
                Your balance (${currentBalance?.toFixed(2)}) is insufficient for this package ($${selectedPackage.price}). <Link to="/deposit" className="font-medium text-indigo-400 hover:text-indigo-300">Deposit funds?</Link>
              </p>
            )}
            {currentBalance === null && (
                 <p className="text-sm text-slate-400 mt-2">Loading your balance...</p>
            )}
          </div>

          {/* Divider or Payment Options Header */} 
          {(!canUseBalance || (canUseBalance && selectedPackage && parseFloat(currentBalance) < parseFloat(selectedPackage.price))) && (
            <div className="my-8 flex items-center">
                <hr className="flex-grow border-slate-600" />
                <span className="px-3 text-slate-400 text-sm">OR PAY WITH</span>
                <hr className="flex-grow border-slate-600" />
            </div>
          )}

          {/* Form for other payment methods - Conditionally rendered */} 
          {(!canUseBalance || (canUseBalance && selectedPackage && parseFloat(currentBalance) < parseFloat(selectedPackage.price))) && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="country-select" className="block text-sm font-medium text-slate-300 mb-1">
                  Select your country for payment methods:
                </label>
                <select
                  id="country-select"
                  value={selectedCountryId}
                  onChange={(e) => setSelectedCountryId(e.target.value)}
                  disabled={isLoadingCountries || isProcessing || !!initiatedTransaction}
                  className="w-full p-3 bg-slate-700 rounded border border-slate-600 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">-- Select Country --</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.id.toString()}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {isLoadingCountries && <p className="text-xs text-slate-400 mt-1">Loading countries...</p>}
                {countryError && <p className="text-xs text-red-400 mt-1">{countryError}</p>}
              </div>

              {selectedCountryId && !isLoadingPaymentMethods && paymentMethods.length > 0 && !initiatedTransaction && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Choose a Payment Method:</label>
                  <div className="space-y-2">
                    {paymentMethods.map(method => (
                      <div key={method.payment_method_id}
                          onClick={() => !isProcessing && setSelectedPaymentMethodConfig(method)}
                          className={`p-3 rounded border cursor-pointer transition-all
                                      ${selectedPaymentMethodConfig?.payment_method_id === method.payment_method_id ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-700 border-slate-600 hover:border-slate-500'}
                                      ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <p className="font-semibold">{method.payment_method_name}</p>
                        {method.description && <p className="text-xs text-slate-400">{method.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isLoadingPaymentMethods && <p className="text-xs text-slate-400 my-2">Loading payment methods...</p>}
              {paymentMethodError && <p className="text-xs text-red-400 my-2">{paymentMethodError}</p>}
              
              {initiatedTransaction && selectedPaymentMethodConfig && (
                <div className="my-6 p-4 bg-slate-700/70 rounded-lg">
                  <h3 className="text-lg font-semibold text-indigo-400 mb-2">Complete Your Payment</h3>
                  <p className="text-sm text-slate-300 mb-1">Method: {selectedPaymentMethodConfig.payment_method_name}</p>
                  {initiatedTransaction.paymentInstructions && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-slate-200">Instructions:</p>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap">{initiatedTransaction.paymentInstructions}</p>
                    </div>
                  )}
                  {selectedPaymentMethodConfig.configuration_details && (
                    <div className="mb-3 text-xs">
                        {Object.entries(selectedPaymentMethodConfig.configuration_details).map(([key, value]) => (
                            <p key={key}><strong className="capitalize text-slate-400">{key.replace(/_/g, ' ')}:</strong> <span className="text-slate-200">{value}</span></p>
                        ))}
                    </div>
                  )}
                  <p className="text-sm text-slate-300 mb-3">
                    Amount: <strong className="text-white">{selectedPackage?.price} {selectedPackage?.currency || 'USD'}</strong> (Transaction ID: {initiatedTransaction.transaction.id})
                  </p>
                  <div className="mb-4">
                    <label htmlFor="payment-reference" className="block text-sm font-medium text-slate-300 mb-1">
                      Enter Payment Reference:
                    </label>
                    <input
                      type="text"
                      id="payment-reference"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      disabled={isProcessing}
                      className="w-full p-3 bg-slate-600 rounded border border-slate-500 focus:border-indigo-500 focus:ring-indigo-500 disabled:opacity-50"
                      placeholder="e.g., M-Pesa code, Bank transaction ID"
                    />
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isProcessing || isLoadingCountries || isLoadingPaymentMethods || (selectedCountryId && !selectedPaymentMethodConfig && !initiatedTransaction) || (!selectedCountryId && !initiatedTransaction) || isProcessingBalancePurchase}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing
                    ? 'Processing...'
                    : initiatedTransaction
                        ? `Submit Payment Reference for $${selectedPackage?.price}`
                        : `${getActionVerb()} Plan & Proceed to Payment`}
                </button>
              </div>
            </form>
          )}
          
          {/* General error display (moved from inside form) */}
          {error && !successMessage && <p className="text-red-400 text-sm mt-4 p-3 bg-red-900/20 rounded-md text-center">{error}</p>}
          {successMessage && <p className="text-green-400 text-sm mt-4 p-3 bg-green-900/20 rounded-md text-center">{successMessage}</p>}
          
          {initiatedTransaction && initiatedTransaction.status === 'pending_payment' && (
            <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-md text-center">
              <p className="text-sm text-blue-300">Your transaction has been initiated. Please complete the payment using the details provided.</p>
              <p className="text-sm text-blue-300 mt-1">You can check the status on your <Link to="/transactions" className="font-medium hover:underline text-indigo-400">transactions page</Link>.</p>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-6 text-center">
            By confirming your subscription, you agree to our Terms of Service and acknowledge our Privacy Policy.
            {actionType !== 'Switch Plan' && actionType !== 'Downgrade' && " Your subscription may auto-renew unless cancelled."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConfirmSubscriptionPage;
