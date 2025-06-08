import React, { useState, useEffect, useCallback } from 'react';
import { FaMoneyBillWave, FaHistory, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import api from '../services/api';
import UserBalanceDisplay from '../components/UserBalanceDisplay';
import { balanceEventEmitter } from '../components/UserBalanceDisplay';

const DepositPage = () => {
  // State for form and data
  const [amount, setAmount] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [reference, setReference] = useState('');
  const [depositHistory, setDepositHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [currentBalance, setCurrentBalance] = useState(null);
  const [initiatedTransaction, setInitiatedTransaction] = useState(null);
  const [paymentInstructions, setPaymentInstructions] = useState(null);

  // Fetch user's current balance
  const fetchCurrentBalance = useCallback(async () => {
    try {
      const response = await api.get('/api/balance');
      setCurrentBalance(parseFloat(response.data.balance));
    } catch (err) {
      console.error("Error fetching current balance:", err);
    }
  }, []);

  // Fetch user's deposit history
  const fetchDepositHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setError(null);
    try {
      const response = await api.get('/api/deposits', {
        params: { limit: 10, offset: 0 }
      });
      setDepositHistory(response.data.deposits || []);
    } catch (err) {
      console.error('Error fetching deposit history:', err);
      setError('Failed to load deposit history.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Fetch countries
  const fetchCountries = useCallback(async () => {
    try {
      const response = await api.get('/api/countries');
      setCountries(response.data || []);
      // Set default country if available
      if (response.data && response.data.length > 0) {
        setSelectedCountry(response.data[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching countries:', err);
      setError('Failed to load countries.');
    }
  }, []);

  // Fetch payment methods for selected country
  const fetchPaymentMethods = useCallback(async () => {
    if (!selectedCountry) return;
    
    try {
      const response = await api.get(`/api/transactions/country/${selectedCountry}/methods`);
      const methods = Array.isArray(response.data) ? response.data : [];
      
      // Map the API response to the format our component expects
      const formattedMethods = methods.map(method => ({
        id: method.payment_method_id,
        name: method.payment_method_name || method.name,
        code: method.payment_method_code || method.code,
        instructions: method.user_instructions || method.payment_method_description
      }));
      
      setPaymentMethods(formattedMethods);
      
      // Set default payment method if available
      if (formattedMethods.length > 0 && formattedMethods[0] && formattedMethods[0].id) {
        setSelectedPaymentMethod(formattedMethods[0].id.toString());
        
        // If we have instructions, update the payment instructions state
        if (formattedMethods[0].instructions) {
          setPaymentInstructions(formattedMethods[0].instructions);
        }
      } else {
        setSelectedPaymentMethod(''); // Reset if no valid methods
        setPaymentInstructions(null);
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
      setError('Failed to load payment methods.');
      setPaymentMethods([]); // Reset on error
      setSelectedPaymentMethod('');
    }
  }, [selectedCountry]);

  // Initialize data on component mount
  useEffect(() => {
    fetchCurrentBalance();
    fetchDepositHistory();
    fetchCountries();
    
    // Subscribe to balance changes
    const unsubscribe = balanceEventEmitter.subscribe(fetchCurrentBalance);
    
    return () => {
      unsubscribe(); // Cleanup subscription
    };
  }, [fetchCurrentBalance, fetchDepositHistory, fetchCountries]);

  // Fetch payment methods when selected country changes
  useEffect(() => {
    if (selectedCountry) {
      fetchPaymentMethods();
    }
  }, [selectedCountry, fetchPaymentMethods]);

  // Handle deposit form submission - Step 1: Initiate transaction
  const handleInitiateDeposit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      // Validate input
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        setError('Please enter a valid amount greater than zero.');
        setIsLoading(false);
        return;
      }

      if (!selectedCountry || !selectedPaymentMethod) {
        setError('Please select a country and payment method.');
        setIsLoading(false);
        return;
      }

      // Get the selected payment method details
      const selectedMethod = paymentMethods.find(m => m.id.toString() === selectedPaymentMethod);
      
      // Prepare payload for transaction initiation
      const payload = {
        countryId: selectedCountry,
        paymentMethodId: selectedPaymentMethod,
        amount: parseFloat(amount),
        currency: 'USD', // Default currency, can be made dynamic
        itemCategory: 'gift', // As per database constraint
        payableItemId: 1, // Placeholder ID for deposits
        description: 'deposit'
      };

      // Initiate transaction
      const response = await api.post('/api/deposits/initiate', payload);
      console.log('Deposit initiation response:', response.data);
      
      if (!response.data || !response.data.transaction || !response.data.transaction.id) {
        throw new Error('Failed to initiate deposit: Invalid response from server');
      }
      
      const transaction = response.data.transaction;
      const paymentMethod = response.data.paymentMethod || selectedMethod?.name || 'M-Pesa';
      
      // Format payment instructions with amount
      let instructions = response.data.paymentInstructions || 
        `Please send KES ${parseFloat(amount).toFixed(2)} to ${paymentMethod} and enter the transaction code below.`;
      
      // Store the transaction and instructions
      setInitiatedTransaction({
        id: transaction.id,
        amount: transaction.amount,
        paymentMethod: paymentMethod,
        paymentInstructions: instructions,
        configurationDetails: response.data.paymentConfigurationDetails || {}
      });
      
      setPaymentInstructions(instructions);
      setSuccessMessage('Deposit initiated. Please complete the payment using the instructions below.');
    } catch (err) {
      console.error('Error initiating deposit:', err);
      setError(err.response?.data?.message || 'Failed to initiate deposit.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle submission of payment reference - Step 2
  const handleSubmitReference = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    
    try {
      if (!reference) {
        setError('Please enter a payment reference.');
        setIsLoading(false);
        return;
      }

      if (!initiatedTransaction) {
        setError('No active transaction found. Please initiate a new deposit.');
        setIsLoading(false);
        return;
      }

      // Try to get the transaction ID from different possible locations
      let transactionId = null;
      
      if (initiatedTransaction.id) {
        // If the transaction itself has an ID
        transactionId = initiatedTransaction.id;
        console.log('Using transaction ID:', transactionId);
      } else if (initiatedTransaction.transaction?.id) {
        // If it's in the standard format
        transactionId = initiatedTransaction.transaction.id;
        console.log('Using transaction ID from nested object:', transactionId);
      }
      
      // If we couldn't find a transaction ID, we need to abort
      if (!transactionId) {
        console.error('Could not find transaction ID in:', initiatedTransaction);
        setError('Could not determine transaction ID. Please try initiating a new deposit.');
        setIsLoading(false);
        return;
      }
      
      console.log('Submitting payment reference for transaction:', transactionId, 'with reference:', reference);
      
      const response = await api.post('/api/deposits/verify', {
        transactionId: transactionId,
        reference: reference
      });

      if (response.data && response.data.success) {
        // Clear any existing messages
        setError(null);
        // Set success message
        setSuccessMessage('Payment reference submitted successfully. Your deposit is pending verification.');
        
        // Reset the form
        setAmount('');
        setReference('');
        setInitiatedTransaction(null);
        setPaymentInstructions(null);
        
        // Refresh balance and history
        fetchCurrentBalance();
        fetchDepositHistory();
        balanceEventEmitter.emit(); // Notify other components about balance change
      } else {
        setSuccessMessage(null);
        setError(response.data?.message || 'Failed to submit payment reference.');
      }
    } catch (err) {
      console.error('Error submitting payment reference:', err);
      setError(err.response?.data?.message || 'An error occurred while submitting your payment reference.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle cancellation of current transaction
  const handleCancelTransaction = () => {
    setInitiatedTransaction(null);
    setPaymentInstructions(null);
    setReference('');
    setSuccessMessage(null);
    setError(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center text-purple-600 mb-8">Deposit Funds</h1>
      
      {/* User Balance Display */}
      <div className="mb-8">
        <UserBalanceDisplay />
      </div>
      
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6 flex items-center">
          <FaCheckCircle className="mr-2" />
          <span>{successMessage}</span>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6 flex items-center">
          <FaExclamationTriangle className="mr-2" />
          <span>{error}</span>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Deposit Form Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FaMoneyBillWave className="mr-2 text-green-500" />
            {initiatedTransaction ? 'Complete Your Deposit' : 'Make a Deposit'}
          </h2>
          
          {!initiatedTransaction ? (
            /* Step 1: Initiate Deposit Form */
            <form onSubmit={handleInitiateDeposit}>
              {/* Amount Input */}
              <div className="mb-4">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount ($)
                </label>
                <input
                  type="number"
                  id="amount"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter amount"
                  required
                />
              </div>
              
              {/* Country Selection */}
              <div className="mb-4">
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  id="country"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Select Country</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.id.toString()}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Payment Method Selection */}
              <div className="mb-6">
                <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  id="paymentMethod"
                  value={selectedPaymentMethod}
                  onChange={(e) => {
                    const selectedMethod = paymentMethods.find(m => m.id.toString() === e.target.value);
                    setSelectedPaymentMethod(e.target.value);
                    if (selectedMethod) {
                      setPaymentInstructions(selectedMethod.instructions || null);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Select Payment Method</option>
                  {paymentMethods.map(method => {
                    if (!method || !method.id || !method.name) return null;
                    return (
                      <option key={method.id} value={method.id.toString()}>
                        {method.name}
                      </option>
                    );
                  })}
                </select>
                {paymentInstructions && !initiatedTransaction && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                    {paymentInstructions}
                  </div>
                )}
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Initiate Deposit'}
              </button>
            </form>
          ) : (
            /* Step 2: Submit Payment Reference Form */
            <div>
              {/* Payment Instructions */}
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="font-semibold text-gray-800 mb-2">Payment Instructions:</h3>
                <div className="text-sm text-gray-700 whitespace-pre-line mb-4">
                  {paymentInstructions || 'Please select a payment method to see instructions.'}
                </div>
                
                {initiatedTransaction?.configurationDetails?.paybill_number && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="font-medium">PayBill Number: <span className="font-bold">{initiatedTransaction.configurationDetails.paybill_number}</span></p>
                    {initiatedTransaction.configurationDetails.account_number && (
                      <p className="mt-1">Account Number: <span className="font-medium">{initiatedTransaction.configurationDetails.account_number}</span></p>
                    )}
                    <p className="mt-2 text-sm">Amount: <span className="font-bold">KES {parseFloat(amount || 0).toFixed(2)}</span></p>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleSubmitReference}>
                {/* Reference Input */}
                <div className="mb-6">
                  <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Reference/Transaction ID
                  </label>
                  <input
                    type="text"
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter your payment reference"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enter the reference/ID from your payment transaction
                  </p>
                </div>
                
                {/* Submit and Cancel Buttons */}
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Submitting...' : 'Submit Reference'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleCancelTransaction}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
        
        {/* Deposit History Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <FaHistory className="mr-2 text-blue-500" />
            Deposit History
          </h2>
          
          {isLoadingHistory ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : depositHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No deposit history found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {depositHistory.map((deposit) => (
                    <tr key={deposit.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(deposit.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          deposit.status === 'completed' ? 'bg-green-100 text-green-800' :
                          deposit.status === 'pending_verification' ? 'bg-yellow-100 text-yellow-800' :
                          deposit.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {deposit.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${parseFloat(deposit.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepositPage;
