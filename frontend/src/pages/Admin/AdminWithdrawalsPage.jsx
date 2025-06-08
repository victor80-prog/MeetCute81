import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FaFilter, FaEdit, FaCheck, FaTimes, FaPaperPlane, FaUserShield } from 'react-icons/fa';

// Define allowed status values to match database constraints
const ALLOWED_STATUS_VALUES = ['pending', 'approved', 'processed', 'rejected'];

const AdminWithdrawalsPage = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'processed', 'declined'
    const [actionLoading, setActionLoading] = useState(null); // Stores requestId being acted upon

    const statusOptions = ['all', ...ALLOWED_STATUS_VALUES];

    const fetchWithdrawalRequests = useCallback(async () => {
        setLoading(true);
        setError('');
        setSuccessMessage('');
        try {
            let url = '/api/admin/financials/withdrawal-requests';
            if (statusFilter && statusFilter !== 'all') {
                url += `?status=${statusFilter}`;
            }
            const response = await api.get(url);
            setRequests(response.data);
        } catch (err) {
            console.error('Error fetching withdrawal requests:', err);
            setError(err.response?.data?.error || 'Failed to load withdrawal requests.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchWithdrawalRequests();
    }, [fetchWithdrawalRequests]);

    const handleUpdateStatus = async (requestId, newStatus, notes = '') => {
        // Ensure status is lowercase to match database constraints
        const normalizedStatus = newStatus.toLowerCase();
        
        // Validate the status value
        if (!ALLOWED_STATUS_VALUES.includes(normalizedStatus)) {
            const errorMsg = `Invalid status value: ${newStatus}. Must be one of: ${ALLOWED_STATUS_VALUES.join(', ')}`;
            console.error(errorMsg);
            setError(errorMsg);
            return;
        }

        // For declined or processed status, prompt for notes if not provided
        let adminNotes = notes;
        if ((newStatus === 'declined' || newStatus === 'processed') && !notes) {
            adminNotes = window.prompt(
                `Enter notes for ${newStatus} action (optional for processed, recommended for declined):`,
                ''
            ) || '';
            
            // If user cancels the prompt for declined status, don't proceed
            if (adminNotes === null && newStatus === 'declined') {
                return;
            }
        }

        setActionLoading(requestId);
        setError('');
        setSuccessMessage('');
        
        try {
            const response = await api.put(
                `/api/admin/financials/withdrawal-requests/${requestId}`,
                { status: normalizedStatus, adminNotes }
            );
            setSuccessMessage(response.data.message || 'Status updated successfully!');
            fetchWithdrawalRequests(); // Refresh the list
        } catch (err) {
            console.error(`Error updating status for request ${requestId}:`, err);
            const errorMsg = err.response?.data?.error || 
                           err.message || 
                           `Failed to update status for request ${requestId}.`;
            setError(errorMsg);
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'pending': return 'text-yellow-400 border-yellow-400';
            case 'approved': return 'text-blue-400 border-blue-400';
            case 'processed': return 'text-green-400 border-green-400';
            case 'declined': return 'text-red-400 border-red-400';
            default: return 'text-slate-400 border-slate-400';
        }
    };

    return (
        <div className="p-4 md:p-6 bg-slate-900 min-h-screen text-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">
                    Manage Withdrawal Requests
                </h1>
                <FaUserShield className="text-3xl text-sky-500" />
            </div>

            {error && <p className="bg-red-700/30 text-red-300 p-3 rounded-md mb-4 text-sm">{error}</p>}
            {successMessage && <p className="bg-green-700/30 text-green-300 p-3 rounded-md mb-4 text-sm">{successMessage}</p>}

            <div className="mb-6 flex items-center gap-4 bg-slate-800 p-4 rounded-lg shadow">
                <FaFilter className="text-sky-400" />
                <label htmlFor="statusFilter" className="text-sm font-medium text-slate-300">Filter by status:</label>
                <select
                    id="statusFilter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                >
                    {statusOptions.map(option => (
                        <option key={option} value={option} className="capitalize">
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <p className="text-center text-slate-400 py-10">Loading requests...</p>
            ) : requests.length === 0 ? (
                <p className="text-center text-slate-400 py-10 bg-slate-800 p-6 rounded-xl shadow-md">
                    No withdrawal requests found for the selected filter.
                </p>
            ) : (
                <div className="overflow-x-auto bg-slate-800 rounded-xl shadow-xl">
                    <table className="min-w-full divide-y divide-slate-700">
                        <thead className="bg-slate-700/50">
                            <tr>
                                {[
                                    'Req. ID',
                                    'User Email',
                                    'Amount ($)',
                                    'Payment Details',
                                    'Status',
                                    'Date Requested',
                                    'Admin Notes',
                                    'Date Processed',
                                    'Processed By',
                                    'Actions'
                                ].map(header => (
                                    <th 
                                        key={header} 
                                        scope="col" 
                                        className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {requests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                                        {req.id}
                                    </td>
                                    <td 
                                        className="px-4 py-3 whitespace-nowrap text-sm text-slate-300" 
                                        title={req.user_email}
                                    >
                                        {req.user_email}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 font-semibold">
                                        {parseFloat(req.amount).toFixed(2)}
                                    </td>
                                    <td 
                                        className="px-4 py-3 text-sm text-slate-400 max-w-xs break-all" 
                                        title={req.user_payment_details}
                                    >
                                        <pre className="whitespace-pre-wrap font-sans text-xs">
                                            {req.user_payment_details}
                                        </pre>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <span 
                                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border-2 ${getStatusColor(req.status)} capitalize`}
                                        >
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                                        {req.created_at ? new Date(req.created_at).toLocaleString() : 'N/A'}
                                    </td>
                                    <td 
                                        className="px-4 py-3 text-sm text-slate-400 max-w-xs break-words" 
                                        title={req.admin_notes || ''}
                                    >
                                        {req.admin_notes || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                                        {req.processed_at ? new Date(req.processed_at).toLocaleString() : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                                        {req.processed_by_email || req.processed_by || 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm space-x-2">
                                        {req.status === 'pending' && (
                                            <>
                                                <button 
                                                    onClick={() => handleUpdateStatus(req.id, 'approved')} 
                                                    disabled={actionLoading === req.id} 
                                                    className="btn-admin-action bg-blue-500 hover:bg-blue-600"
                                                >
                                                    <FaCheck className="mr-1"/>Approve
                                                </button>
                                                <button 
                                                    onClick={() => handleUpdateStatus(req.id, 'rejected')} 
                                                    disabled={actionLoading === req.id} 
                                                    className="btn-admin-action bg-red-500 hover:bg-red-600"
                                                >
                                                    <FaTimes className="mr-1"/>Reject
                                                </button>
                                            </>
                                        )}
                                        {req.status === 'approved' && (
                                            <>
                                                <button 
                                                    onClick={() => handleUpdateStatus(req.id, 'processed')} 
                                                    disabled={actionLoading === req.id} 
                                                    className="btn-admin-action bg-green-500 hover:bg-green-600"
                                                >
                                                    <FaPaperPlane className="mr-1"/>Processed
                                                </button>
                                                <button 
                                                    onClick={() => handleUpdateStatus(req.id, 'rejected')} 
                                                    disabled={actionLoading === req.id} 
                                                    className="btn-admin-action bg-red-500 hover:bg-red-600"
                                                >
                                                    <FaTimes className="mr-1"/>Reject
                                                </button>
                                            </>
                                        )}
                                        {(req.status === 'processed' || req.status === 'rejected') && (
                                            <button 
                                                onClick={() => {
                                                    const notes = window.prompt("Update admin notes (optional):", req.admin_notes || "");
                                                    if (notes !== null) handleUpdateStatus(req.id, req.status, notes);
                                                }}
                                                disabled={actionLoading === req.id}
                                                className="btn-admin-action bg-slate-500 hover:bg-slate-600"
                                            >
                                                <FaEdit className="mr-1"/>Edit Notes
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            
            {/* Simple CSS for buttons */}
            <style jsx="true">{
                `.btn-admin-action {
                    padding: 0.3rem 0.6rem;
                    border-radius: 0.375rem;
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                    transition: background-color 0.15s ease-in-out;
                }
                .btn-admin-action:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }`
            }</style>
        </div>
    );
};

export default AdminWithdrawalsPage;
