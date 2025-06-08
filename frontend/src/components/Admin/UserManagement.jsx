import React, { useState, useEffect } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { adminAPI } from '../../services/api';

const UserManagement = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [userToUpdate, setUserToUpdate] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await adminAPI.getUsers();
      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (userId, newStatus) => {
    if (newStatus === 'suspended' || newStatus === 'banned') {
      setUserToUpdate({ id: userId, status: newStatus });
      setShowReasonModal(true);
    } else {
      toggleStatus(userId, newStatus);
    }
  };

  const toggleStatus = async (userId, newStatus, reason = '') => {
    try {
      await adminAPI.updateUserStatus(userId, newStatus, reason);
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      
      // Clear selection after status change
      setSelectedUsers(prev => prev.filter(id => id !== userId));
      
      // Reset modal state
      setShowReasonModal(false);
      setUserToUpdate(null);
      setSuspensionReason('');
    } catch (err) {
      console.error('Error updating user status:', err);
      alert(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleReasonSubmit = () => {
    if (!suspensionReason.trim()) {
      alert('Please provide a reason for the suspension');
      return;
    }
    toggleStatus(userToUpdate.id, userToUpdate.status, suspensionReason);
  };

  const toggleUserSelect = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const bulkUpdateStatus = async (status) => {
    if (status === 'suspended' || status === 'banned') {
      setUserToUpdate({ ids: selectedUsers, status });
      setShowReasonModal(true);
    } else {
      try {
        await Promise.all(
          selectedUsers.map(userId =>
            api.put(`/api/admin/users/${userId}/status`, { status })
          )
        );

        setUsers(users.map(user => 
          selectedUsers.includes(user.id) ? { ...user, status } : user
        ));
        setSelectedUsers([]);
      } catch (err) {
        console.error('Error performing bulk update:', err);
        alert(err.response?.data?.message || 'Failed to update users');
      }
    }
  };

  const handleBulkReasonSubmit = async () => {
    if (!suspensionReason.trim()) {
      alert('Please provide a reason for the suspension');
      return;
    }

    try {
      await Promise.all(
        userToUpdate.ids.map(userId =>
          api.put(`/api/admin/users/${userId}/status`, { 
            status: userToUpdate.status,
            reason: suspensionReason
          })
        )
      );

      setUsers(users.map(user => 
        userToUpdate.ids.includes(user.id) ? { ...user, status: userToUpdate.status } : user
      ));
      setSelectedUsers([]);
      setShowReasonModal(false);
      setUserToUpdate(null);
      setSuspensionReason('');
    } catch (err) {
      console.error('Error performing bulk update:', err);
      alert(err.response?.data?.message || 'Failed to update users');
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
          <button
            className="absolute top-0 right-0 px-4 py-3"
            onClick={fetchUsers}
          >
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search users..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <select 
              className="py-2 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] bg-white"
              value=""
              onChange={(e) => e.target.value && bulkUpdateStatus(e.target.value)}
              disabled={selectedUsers.length === 0}
            >
              <option value="">Bulk Actions</option>
              <option value="active">Activate Selected</option>
              <option value="suspended">Suspend Selected</option>
              <option value="banned">Ban Selected</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => toggleUserSelect(user.id)}
                    className="rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-white font-semibold">
                      {user.name.charAt(0)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="text-xs text-gray-400">Joined: {user.joined}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.status === 'active' 
                      ? 'bg-green-100 text-green-800'
                      : user.status === 'suspended'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    user.role === 'premium' 
                      ? 'bg-purple-100 text-purple-800' 
                      : user.role === 'admin'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${user.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  <select
                    className="text-sm border border-gray-200 rounded p-1"
                    value={user.status}
                    onChange={(e) => handleStatusChange(user.id, e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Suspension Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {userToUpdate?.ids ? 'Bulk Suspension Reason' : 'Suspension Reason'}
            </h3>
            <textarea
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
              rows="3"
              placeholder="Enter reason for suspension..."
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
            ></textarea>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                onClick={() => {
                  setShowReasonModal(false);
                  setUserToUpdate(null);
                  setSuspensionReason('');
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-[var(--primary)] text-white rounded hover:bg-[var(--primary-dark)]"
                onClick={userToUpdate?.ids ? handleBulkReasonSubmit : handleReasonSubmit}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;