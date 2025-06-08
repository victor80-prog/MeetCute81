import React, { useState, useEffect } from 'react';
import { FaSpinner, FaCheck, FaTimes, FaSearch, FaMoneyBillWave } from 'react-icons/fa';
import { format } from 'date-fns';
import { adminAPI } from '../../services/api';

const AdminDepositVerification = () => {
  const [deposits, setDeposits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalCount: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationError, setVerificationError] = useState(null);

  const fetchPendingDeposits = async (page, limit, query = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await adminAPI.getPendingTransactions({
        limit, 
        offset: (page - 1) * limit,
        search: query
      });
      setDeposits(response.data.transactions || []);
      setPagination(prev => ({ 
        ...prev, 
        totalCount: response.data.totalCount || 0,
        page 
      }));
    } catch (err) {
      console.error('Error fetching pending deposits:', err);
      setError(err.response?.data?.message || 'Failed to load pending deposits.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingDeposits(pagination.page, pagination.limit, searchQuery);
  }, [pagination.page, pagination.limit, searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPendingDeposits(1, pagination.limit, searchQuery);
  };

  const handleOpenModal = (deposit) => {
    setSelectedDeposit(deposit);
    setAdminNotes(deposit.admin_notes || '');
    setVerificationError(null);
  };

  const closeModal = () => {
    setSelectedDeposit(null);
    setAdminNotes('');
    setVerificationError(null);
  };

  const handleVerifyDeposit = async (status) => {
    if (!selectedDeposit) return;
    
    setIsSubmitting(true);
    setVerificationError(null);
    
    try {
      await adminAPI.verifyTransaction(selectedDeposit.id, {
        newStatus: status,
        adminNotes: adminNotes.trim() || undefined
      });
      
      closeModal();
      fetchPendingDeposits(pagination.page, pagination.limit, searchQuery);
    } catch (err) {
      console.error('Error verifying deposit:', err);
      setVerificationError(err.response?.data?.message || 'Failed to update deposit status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (status) => {
    const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full';
    
    switch (status) {
      case 'completed':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Completed</span>;
      case 'pending_verification':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case 'declined':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Declined</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FaMoneyBillWave className="mr-2 text-blue-500" />
            Pending Deposit Verification
          </h3>
          
          <form onSubmit={handleSearch} className="mt-4 md:mt-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search by user ID, email, or transaction ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-center">
            <div className="inline-flex items-center text-gray-600">
              <FaSpinner className="animate-spin mr-2" />
              Loading pending deposits...
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            <div className="inline-flex items-center">
              <FaTimes className="mr-2" />
              {error}
            </div>
          </div>
        ) : deposits.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No pending deposits found.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Method
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deposits.map((deposit) => (
                <tr key={deposit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {deposit.user_email ? deposit.user_email.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {deposit.user_email || 'Unknown User'}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {deposit.user_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(deposit.amount, deposit.currency)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{deposit.payment_method_name}</div>
                    <div className="text-sm text-gray-500">{deposit.payment_country_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(deposit.created_at), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderStatusBadge(deposit.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(deposit)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Verify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalCount > 0 && (
        <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPagination(prev => ({
                ...prev,
                page: Math.max(1, prev.page - 1)
              }))}
              disabled={pagination.page === 1}
              className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                pagination.page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({
                ...prev,
                page: Math.min(Math.ceil(pagination.totalCount / pagination.limit), prev.page + 1)
              }))}
              disabled={pagination.page * pagination.limit >= pagination.totalCount}
              className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                pagination.page * pagination.limit >= pagination.totalCount ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
                </span>{' '}
                of <span className="font-medium">{pagination.totalCount}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPagination(prev => ({
                    ...prev,
                    page: Math.max(1, prev.page - 1)
                  }))}
                  disabled={pagination.page === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                    pagination.page === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="flex items-center px-4 py-2 bg-white border-t border-b border-gray-300 text-sm font-medium text-gray-700">
                  Page {pagination.page} of {Math.ceil(pagination.totalCount / pagination.limit) || 1}
                </div>
                <button
                  onClick={() => setPagination(prev => ({
                    ...prev,
                    page: Math.min(Math.ceil(pagination.totalCount / pagination.limit), prev.page + 1)
                  }))}
                  disabled={pagination.page * pagination.limit >= pagination.totalCount}
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                    pagination.page * pagination.limit >= pagination.totalCount ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {selectedDeposit && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center pb-3">
              <h3 className="text-xl font-medium text-gray-900">
                Verify Deposit
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <FaTimes className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">User</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedDeposit.user_email || 'N/A'}
                    <span className="block text-sm text-gray-500">ID: {selectedDeposit.user_id}</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Amount</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {formatCurrency(selectedDeposit.amount, selectedDeposit.currency)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Payment Method</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedDeposit.payment_method_name}
                    <span className="block text-sm text-gray-500">{selectedDeposit.payment_country_name}</span>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Date</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(selectedDeposit.created_at), 'PPpp')}
                  </p>
                </div>
              </div>

              {selectedDeposit.user_provided_reference && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Reference/Note</p>
                  <p className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-900">
                    {selectedDeposit.user_provided_reference}
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700">
                  Admin Notes (Optional)
                </label>
                <textarea
                  id="adminNotes"
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Add any notes about this verification..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              {verificationError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <FaTimes className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{verificationError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifyDeposit('declined')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  <FaTimes className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Declining...' : 'Decline'}
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifyDeposit('completed')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  <FaCheck className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Verifying...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDepositVerification;
