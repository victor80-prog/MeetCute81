import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';

const ModerationPanel = () => {
  const [selectedAction, setSelectedAction] = useState('');
  const [userIds, setUserIds] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [reportedContent, setReportedContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetails, setReportDetails] = useState(null);
  const [adminLogs, setAdminLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    fetchReportedContent();
    fetchAdminLogs();
  }, []);
  
  const fetchAdminLogs = async () => {
    try {
      setLogsLoading(true);
      const response = await adminAPI.getLogs({
        limit: 10,
        category: 'moderation'
      });
      
      if (response.data && response.data.logs) {
        setAdminLogs(response.data.logs.map(log => ({
          moderator: log.admin_email || 'Admin',
          action: log.action || 'Action',
          user: log.target_user_email || 'N/A',
          details: log.details || '',
          time: formatRelativeTime(new Date(log.created_at))
        })));
      } else {
        setAdminLogs([]);
      }
    } catch (err) {
      console.error('Error fetching admin logs:', err);
      // Don't show an error message for logs as it's secondary functionality
      setAdminLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };
  
  const formatRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) {
      return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 30) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const fetchReportedContent = async () => {
    try {
      const response = await adminAPI.getModerationReports();
      const summary = response.data.summary || {};
      
      setReportedContent([
        { type: 'Profile Reports', count: summary.profile || 0, icon: '👤', key: 'profile' },
        { type: 'Photo Reports', count: summary.photo || 0, icon: '🖼️', key: 'photo' },
        { type: 'Message Reports', count: summary.message || 0, icon: '💬', key: 'message' },
        { type: 'Suspicious Activity', count: summary.activity || 0, icon: '🕵️', key: 'activity' },
      ]);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch reported content');
      console.error('Error fetching reported content:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReports = async (type) => {
    try {
      const response = await adminAPI.getModerationReports(type);
      setSelectedReport({ type, reports: response.data.reports });
      setReportDetails(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch reports');
      console.error('Error fetching reports:', err);
    }
  };

  const handleViewDetails = async (reportId) => {
    try {
      const response = await adminAPI.getReportDetails(reportId);
      setReportDetails(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch report details');
      console.error('Error fetching report details:', err);
    }
  };

  const handleUpdateStatus = async (reportId, status, userAction = null) => {
    try {
      await api.put(`/api/admin/moderation/reports/${reportId}/status`, { 
        status,
        notes: `Status updated to ${status} by admin`,
        userAction: userAction // Optional: 'warn', 'suspend', or 'ban'
      });
      
      // Refresh the reports list
      if (selectedReport) {
        handleViewReports(selectedReport.type);
      }
      
      // Refresh the summary counts
      fetchReportedContent();
      
      setMessage({ type: 'success', text: `Report status updated successfully${userAction ? ` and user ${userAction}ed` : ''}` });
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to update report status' 
      });
      console.error('Error updating report status:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedAction) {
      setMessage({ type: 'error', text: 'Please select an action' });
      return;
    }
    
    if (!userIds.trim()) {
      setMessage({ type: 'error', text: 'Please enter user IDs' });
      return;
    }
    
    try {
      const userIdArray = userIds.split(',').map(id => id.trim()).filter(id => id);
      
      await api.post('/admin/users/bulk-action', {
        action: selectedAction,
        userIds: userIdArray,
        message: warningMessage || undefined
      });
      
      setMessage({ 
        type: 'success', 
        text: `Successfully performed ${selectedAction} on users: ${userIds}` 
      });
      
      // Reset form
      setUserIds('');
      setWarningMessage('');
      
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.message || `Failed to perform ${selectedAction} on users` 
      });
      console.error(`Error performing ${selectedAction}:`, err);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-[var(--dark)] mb-6">Moderation Tools</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-[var(--light)] to-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-[var(--dark)] mb-4">Bulk User Actions</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="action" className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                id="action"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
              >
                <option value="">Select an action</option>
                <option value="warn">Send Warning</option>
                <option value="suspend">Suspend Account (7 days)</option>
                <option value="ban">Ban Account</option>
                <option value="activate">Activate Account</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="userIds" className="block text-sm font-medium text-gray-700 mb-1">User IDs (comma separated)</label>
              <input
                id="userIds"
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                value={userIds}
                onChange={(e) => setUserIds(e.target.value)}
                placeholder="e.g., 23, 45, 67"
              />
            </div>
            
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
              <textarea
                id="message"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                placeholder="Warning or notification message to send to users"
                rows={3}
              />
            </div>
            
            <button
              type="submit"
              className="w-full px-4 py-2 bg-[var(--primary)] text-white font-medium rounded-md hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)]"
            >
              Apply Action
            </button>
            
            {message.text && (
              <div className={`p-3 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message.text}
              </div>
            )}
          </form>
        </div>
        
        <div className="bg-gradient-to-br from-[var(--light)] to-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-[var(--dark)] mb-4">Reported Content</h3>
          
          {loading ? (
            <div className="text-center py-8">
              <p>Loading...</p>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-100 text-red-800 rounded-md">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {reportedContent.map((item) => (
                <div 
                  key={item.key}
                  onClick={() => handleViewReports(item.key)}
                  className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <div className="text-sm font-medium">{item.type}</div>
                  <div className="text-xl font-bold mt-1">{item.count}</div>
                </div>
              ))}
            </div>
          )}
          
          {selectedReport && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold">{selectedReport.type}</h4>
                <button 
                  onClick={() => setSelectedReport(null)} 
                  className="text-sm text-[var(--primary)]"
                >
                  Back to summary
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reporter</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedReport.reports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.id}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {report.reporter_name || report.reporter_email}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(report.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            report.status === 'open' 
                              ? 'bg-blue-100 text-blue-800'
                              : report.status === 'closed'
                                ? 'bg-green-100 text-green-800'
                                : report.status === 'actioned'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => handleViewDetails(report.id)}
                            className="text-[var(--primary)] hover:text-[var(--primary-dark)]"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportDetails && (
            <div className="mt-4 bg-white p-6 rounded-xl shadow-md">
              <h4 className="text-lg font-semibold mb-4">Report Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Reported Content</p>
                  <p className="font-medium">{reportDetails.content_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Reported User</p>
                  <p>{reportDetails.reported_user}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Reported By</p>
                  <p>{reportDetails.reporter_user}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="capitalize">{reportDetails.status}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Reason</p>
                  <p>{reportDetails.reason}</p>
                </div>
                {reportDetails.notes && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500">Notes</p>
                    <p>{reportDetails.notes}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Reported At</p>
                  <p>{new Date(reportDetails.created_at).toLocaleString()}</p>
                </div>
                
                {/* Action buttons */}
                <div className="col-span-2 mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleUpdateStatus(reportDetails.id, 'closed')}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                  >
                    Mark as Resolved
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(reportDetails.id, 'dismissed')}
                    className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(reportDetails.id, 'actioned', 'warn')}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                  >
                    Warn User
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(reportDetails.id, 'actioned', 'suspend')}
                    className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium"
                  >
                    Suspend User
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(reportDetails.id, 'actioned', 'ban')}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium"
                  >
                    Ban User
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-bold text-[var(--dark)] mb-4">Recent Moderation Actions</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moderator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {adminLogs.map((action, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {action.moderator}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      action.action === 'Suspended' 
                        ? 'bg-yellow-100 text-yellow-800'
                        : action.action === 'Banned'
                          ? 'bg-red-100 text-red-800'
                          : action.action === 'Activated'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                    }`}>
                      {action.action}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {action.user}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">
                    {action.details}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {action.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ModerationPanel;
