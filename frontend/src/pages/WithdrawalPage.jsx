import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import UserBalanceDisplay, { balanceEventEmitter } from '../components/UserBalanceDisplay';
import { FaPaperPlane, FaListAlt, FaClock, FaCheckCircle, FaTimesCircle, FaExclamationTriangle } from 'react-icons/fa';

const WithdrawalPage = () => {
    const [amount, setAmount] = useState('');
    const [paymentDetails, setPaymentDetails] = useState('');
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [currentBalance, setCurrentBalance] = useState(null); // For local validation

    const fetchWithdrawalRequests = useCallback(async () => {
        setLoadingRequests(true);
        try {
            const response = await api.get('/api/balance/withdrawals');
            setRequests(response.data);
        } catch (err) {
            console.error('Error fetching withdrawal requests:', err);
            setError('Failed to load withdrawal history.');
        } finally {
            setLoadingRequests(false);
        }
    }, []);

    // Fetch balance for validation (UserBalanceDisplay also fetches its own)
    const fetchCurrentBalance = useCallback(async () => {
        try {
            const response = await api.get('/api/balance');
            setCurrentBalance(parseFloat(response.data.balance));
        } catch (err) {
            console.error("Error fetching current balance for validation:", err);
            // Not critical for page load, UserBalanceDisplay will show its own error
        }
    }, []);


    useEffect(() => {
        fetchWithdrawalRequests();
        fetchCurrentBalance(); // Fetch initial balance for validation

        // Listen to balance changes to update local balance for validation
        const unsubscribe = balanceEventEmitter.subscribe(fetchCurrentBalance);
        return unsubscribe;
    }, [fetchWithdrawalRequests, fetchCurrentBalance]);

    const handleSubmitWithdrawal = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Please enter a valid positive amount.');
            return;
        }
        if (currentBalance !== null && numericAmount > currentBalance) {
            setError('Withdrawal amount cannot exceed your current balance.');
            return;
        }
        if (!paymentDetails.trim()) {
            setError('Please provide your payment details.');
            return;
        }
        // Basic check for very long payment details
        if (paymentDetails.trim().length > 500) {
            setError('Payment details are too long (max 500 characters).');
            return;
        }


        setSubmitLoading(true);
        try {
            const response = await api.post('/api/balance/withdraw', { amount: numericAmount, paymentDetails });
            setSuccessMessage(response.data.message || 'Withdrawal request submitted successfully!');
            setAmount('');
            setPaymentDetails('');
            balanceEventEmitter.emit(); // Refresh balance in UserBalanceDisplay and local currentBalance
            fetchWithdrawalRequests(); // Refresh the list of requests
        } catch (err) {
            console.error('Error submitting withdrawal request:', err);
            setError(err.response?.data?.error || 'Failed to submit withdrawal request.');
        } finally {
            setSubmitLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status.toLowerCase()) {
            case 'pending': return <FaClock className="text-yellow-500" title="Pending" />;
            case 'approved': return <FaCheckCircle className="text-blue-500" title="Approved (Awaiting Processing)" />;
            case 'processed': return <FaCheckCircle className="text-green-500" title="Processed" />;
            case 'declined': return <FaTimesCircle className="text-red-500" title="Declined" />;
            default: return <FaExclamationTriangle className="text-gray-500" title={status} />;
        }
    };


    return (
        <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-slate-100">
            <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-600">
                Withdraw Funds
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* Balance Display Card */}
                <div className="lg:col-span-1 bg-slate-800 p-6 rounded-xl shadow-xl">
                    <h2 className="text-xl font-semibold mb-4 text-slate-200">Your Redeemable Balance</h2>
                    <UserBalanceDisplay className="text-2xl" />
                    <p className="text-xs text-slate-400 mt-2">
                        This is the total amount you can currently withdraw.
                    </p>
                </div>

                {/* Withdrawal Form Card */}
                <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl shadow-xl">
                    <h2 className="text-xl font-semibold mb-4 text-slate-200">Request a Withdrawal</h2>
                    {error && <p className="bg-red-700/30 text-red-300 p-3 rounded-md mb-4 text-sm">{error}</p>}
                    {successMessage && <p className="bg-green-700/30 text-green-300 p-3 rounded-md mb-4 text-sm">{successMessage}</p>}

                    <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-slate-300 mb-1">Amount to Withdraw ($)</label>
                            <input
                                type="number"
                                id="amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                min="0.01"
                                step="0.01"
                                required
                                className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                placeholder="e.g., 50.00"
                            />
                        </div>
                        <div>
                            <label htmlFor="paymentDetails" className="block text-sm font-medium text-slate-300 mb-1">Payment Details</label>
                            <textarea
                                id="paymentDetails"
                                value={paymentDetails}
                                onChange={(e) => setPaymentDetails(e.target.value)}
                                rows="4"
                                required
                                className="w-full bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                placeholder="e.g., PayPal: yourname@example.com OR Bank: [Account Name, Account Number, Bank Name, Swift/Sort Code]"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Ensure your payment details are accurate. Withdrawals are processed manually. Processing may take 3-5 business days.
                            </p>
                        </div>
                        <button
                            type="submit"
                            disabled={submitLoading}
                            className="w-full flex items-center justify-center bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-150 ease-in-out disabled:opacity-70"
                        >
                            <FaPaperPlane className="mr-2" />
                            {submitLoading ? 'Submitting Request...' : 'Submit Withdrawal Request'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Withdrawal History */}
            <div>
                <h2 className="text-2xl font-semibold mb-6 text-slate-200 flex items-center"><FaListAlt className="mr-3 text-emerald-400" />Withdrawal History</h2>
                {loadingRequests ? (
                    <p className="text-slate-400 text-center">Loading withdrawal history...</p>
                ) : requests.length === 0 ? (
                    <p className="text-slate-400 text-center bg-slate-800 p-6 rounded-xl shadow-md">You have not made any withdrawal requests yet.</p>
                ) : (
                    <div className="overflow-x-auto bg-slate-800 rounded-xl shadow-xl">
                        <table className="min-w-full divide-y divide-slate-700">
                            <thead className="bg-slate-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date Requested</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Amount ($)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Payment Details</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Admin Notes</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">Date Processed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {requests.map(req => (
                                    <tr key={req.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{new Date(req.requested_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-medium">{parseFloat(req.amount).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-400 max-w-xs truncate" title={req.user_payment_details}>{req.user_payment_details}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className="flex items-center gap-2 capitalize">
                                                {getStatusIcon(req.status)}
                                                <span className={`font-medium ${
                                                    req.status === 'pending' ? 'text-yellow-400' :
                                                    req.status === 'processed' ? 'text-green-400' :
                                                    req.status === 'declined' ? 'text-red-400' : 'text-slate-300'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-400 max-w-xs truncate" title={req.admin_notes || ''}>{req.admin_notes || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{req.processed_at ? new Date(req.processed_at).toLocaleString() : 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WithdrawalPage;
