import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import { FaTasks, FaSpinner, FaExclamationTriangle, FaTimes, FaCheckCircle, FaTimesCircle, FaSearch } from 'react-icons/fa';
import { format } from 'date-fns';

const AdminTransactionVerification = () => {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalCount: 0 });

  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState(null);

  const fetchPendingTransactions = useCallback(async (page, limit) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await adminAPI.getPendingTransactions({
        limit,
        offset: (page - 1) * limit
      });
      setTransactions(response.data.transactions || []);
      setPagination(prev => ({ ...prev, totalCount: response.data.totalCount || 0, page }));
    } catch (err) {
      console.error('Error fetching pending transactions:', err);
      setError(err.response?.data?.message || 'Failed to load transactions for verification.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingTransactions(pagination.page, pagination.limit);
  }, [fetchPendingTransactions, pagination.page, pagination.limit]);

  const handleOpenModal = (transaction) => {
    setSelectedTransaction(transaction);
    setAdminNotes(transaction.admin_notes || ''); // Pre-fill if notes exist
    setVerificationError(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
    setAdminNotes('');
    setVerificationError(null);
  };

  const handleVerifyTransaction = async (isApproved) => {
    if (!selectedTransaction) return;
    
    setIsSubmittingVerification(true);
    setVerificationError(null);
    
    try {
      const response = await adminAPI.verifyTransaction(selectedTransaction.id, {
        is_approved: isApproved,
        admin_notes: adminNotes
      });
      
      if (response.data.success) {
        // Update the transactions list
        setTransactions(prev => 
          prev.filter(tx => tx.id !== selectedTransaction.id)
        );
        // Update pagination total count
        setPagination(prev => ({
          ...prev,
          totalCount: Math.max(0, prev.totalCount - 1)
        }));
        // Close the modal
        handleCloseModal();
      }
    } catch (err) {
      console.error('Error verifying transaction:', err);
      setVerificationError(
        err.response?.data?.message || 'Failed to verify transaction. Please try again.'
      );
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  const renderStatusBadge = (status) => {
    let baseClasses = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full";
    if (status === 'completed') return <span className={`${baseClasses} bg-green-100 text-green-800`}>Completed</span>;
    if (status === 'pending_verification') return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Pending Verification</span>;
    if (status === 'pending_payment') return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>Pending Payment</span>;
    if (status === 'declined') return <span className={`${baseClasses} bg-red-100 text-red-800`}>Declined</span>;
    if (status === 'error') return <span className={`${baseClasses} bg-red-200 text-red-900`}>Error</span>;
    return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
  };


  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4 text-slate-700 flex items-center">
        <FaTasks className="mr-2" /> Transaction Verification Queue
      </h3>

      {isLoading && <p className="text-slate-500 flex items-center"><FaSpinner className="animate-spin mr-2" />Loading pending transactions...</p>}
      {error && <p className="text-red-600"><FaExclamationTriangle className="inline mr-1" /> {error}</p>}

      {!isLoading && !error && transactions.length === 0 && (
        <p className="text-slate-500">No transactions are currently pending verification.</p>
      )}

      {!isLoading && !error && transactions.length > 0 && (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{tx.user_email || `User ID: ${tx.user_id}`}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{tx.item_category} (ID: {tx.payable_item_id})</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{tx.currency} {tx.amount}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{tx.payment_method_name} ({tx.payment_country_name})</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 truncate max-w-xs" title={tx.user_provided_reference}>{tx.user_provided_reference}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button onClick={() => handleOpenModal(tx)} className="btn-secondary-sm text-indigo-600 hover:text-indigo-800">
                        <FaSearch className="mr-1 inline"/> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {pagination.totalCount > pagination.limit && (
            <div className="py-2 flex justify-between items-center">
              <button
                onClick={() => fetchPendingTransactions(pagination.page - 1, pagination.limit)}
                disabled={pagination.page === 1 || isLoading}
                className="btn-secondary-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-700">
                Page {pagination.page} of {Math.ceil(pagination.totalCount / pagination.limit)}
              </span>
              <button
                onClick={() => fetchPendingTransactions(pagination.page + 1, pagination.limit)}
                disabled={(pagination.page * pagination.limit) >= pagination.totalCount || isLoading}
                className="btn-secondary-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Verification Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl p-6 md:p-8 max-w-2xl w-full">
            <button onClick={handleCloseModal} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
              <FaTimes size={20} />
            </button>
            <h4 className="text-lg font-semibold mb-4 text-slate-800 border-b pb-2">Review Transaction Details</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4">
                <p><strong className="text-slate-600">Transaction ID:</strong> {selectedTransaction.id}</p>
                <p><strong className="text-slate-600">Date:</strong> {format(new Date(selectedTransaction.created_at), 'PPpp')}</p>
                <p><strong className="text-slate-600">User:</strong> {selectedTransaction.user_email || `ID: ${selectedTransaction.user_id}`}</p>
                <p><strong className="text-slate-600">Amount:</strong> {selectedTransaction.currency} {selectedTransaction.amount}</p>
                <p><strong className="text-slate-600">Item:</strong> {selectedTransaction.item_category} (ID: {selectedTransaction.payable_item_id})</p>
                <p><strong className="text-slate-600">Payment Method:</strong> {selectedTransaction.payment_method_name}</p>
                <p><strong className="text-slate-600">Country:</strong> {selectedTransaction.payment_country_name}</p>
                <p className="md:col-span-2"><strong className="text-slate-600">User Reference:</strong> {selectedTransaction.user_provided_reference || <span className="italic text-slate-400">None</span>}</p>
                <p className="md:col-span-2"><strong className="text-slate-600">Current Status:</strong> {renderStatusBadge(selectedTransaction.status)}</p>
            </div>

            <div>
              <label htmlFor="adminNotes" className="block text-sm font-medium text-slate-700 mb-1">Admin Notes</label>
              <textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows="3"
                className="mt-1 block w-full input-class"
                placeholder="Optional notes for this verification decision..."
              />
            </div>

            {verificationError && <p className="text-sm text-red-600 mt-3"><FaExclamationTriangle className="inline mr-1" />{verificationError}</p>}

            <div className="pt-6 flex justify-end space-x-3 border-t mt-4">
              <button
                type="button"
                onClick={() => handleVerificationSubmit('declined')}
                disabled={isSubmittingVerification}
                className="btn-danger px-4 py-2 text-sm disabled:opacity-50 flex items-center"
              >
                {isSubmittingVerification && <FaSpinner className="animate-spin mr-2" />} Decline
              </button>
              <button
                type="button"
                onClick={() => handleVerificationSubmit('completed')}
                disabled={isSubmittingVerification}
                className="btn-success px-4 py-2 text-sm disabled:opacity-50 flex items-center"
              >
                 {isSubmittingVerification && <FaSpinner className="animate-spin mr-2" />} Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Add basic button styles if not globally available via Tailwind components or existing CSS
const style = document.createElement('style');
style.textContent = `
  .input-class { /* Copied from CountryPaymentMethodsManager for consistency */
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    border: 1px solid #cbd5e1; /* slate-300 */
    border-radius: 0.375rem; /* rounded-md */
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
  }
  .input-class:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-color: #6366f1; /* indigo-500 */
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }
  .btn-secondary-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    background-color: white;
    color: #4f46e5; /* indigo-600 */
  }
  .btn-secondary-sm:hover {
    background-color: #f8fafc; /* slate-50 */
  }
  .btn-danger { /* For Decline button */
    background-color: #ef4444; /* red-500 */
    color: white;
    border-radius: 0.375rem;
  }
  .btn-danger:hover {
    background-color: #dc2626; /* red-600 */
  }
  .btn-success { /* For Approve button */
    background-color: #22c55e; /* green-500 */
    color: white;
    border-radius: 0.375rem;
  }
  .btn-success:hover {
    background-color: #16a34a; /* green-600 */
  }
`;
document.head.appendChild(style);

export default AdminTransactionVerification;
