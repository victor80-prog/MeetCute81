import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from 'react-router-dom';
import UserManagement from '../components/Admin/UserManagement';
import RevenueReport from '../components/Admin/RevenueReport';
import { adminAPI } from '../services/api';
import ModerationPanel from '../components/Admin/ModerationPanel';
import SubscriptionManagement from '../components/Admin/SubscriptionManagement';
import AdminStats from '../components/Admin/AdminStats';
import GlobalPaymentMethodsManager from '../components/Admin/GlobalPaymentMethodsManager';
import CountryPaymentMethodsManager from '../components/Admin/CountryPaymentMethodsManager';
import AdminTransactionVerification from '../components/Admin/AdminTransactionVerification';
import AdminDepositVerification from '../components/Admin/AdminDepositVerification';
import AdminWithdrawalsPage from './Admin/AdminWithdrawalsPage';
import SubscriptionFeaturesPage from './Admin/SubscriptionFeaturesPage';
import api from '../services/api';
import { 
  FaUsers, 
  FaChartLine, 
  FaShieldAlt, 
  FaTags, 
  FaMoneyCheckAlt, 
  FaTasks, 
  FaHandHoldingUsd, 
  FaListAlt,
  FaSync,
  FaExclamationTriangle,
  FaMoneyBillWave
} from 'react-icons/fa';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    premiumUsers: 0,
    monthlyRevenue: 0,
    payingUsers: 0,
    basicUsers: 0,
    eliteUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchDashboardStats = useCallback(async () => {
    console.log('Fetching dashboard stats...');
    setLoading(true);
    setError(null);
    
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      console.log('Current token in localStorage:', token ? 'Token exists' : 'No token found');
      
      if (!token) {
        console.error('No token found in localStorage');
        setError('Authentication required. Please log in again.');
        setLoading(false);
        navigate('/login');
        return;
      }
      
      // Ensure token is set in axios headers
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // First check if the API is available
      try {
        console.log('Performing health check...');
        const testResponse = await api.get('/api/health');
        console.log('Health check response:', testResponse.data);
      } catch (healthErr) {
        console.warn('Health check failed, but continuing with stats fetch:', healthErr.message);
        // Continue even if health check fails, as the stats endpoint might still work
      }
      
      // Now try the admin stats endpoint
      console.log('Fetching admin stats...');
      const response = await adminAPI.getDashboardStats();
      
      console.log('Dashboard stats response:', response.data);
      setStats(response.data);
      setLastRefreshed(new Date());
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      
      if (error.response) {
        // Handle specific error statuses
        const { status, data } = error.response;
        
        if (status === 401) {
          setError('Your session has expired. Please log in again.');
          // The interceptor will handle the redirect to login
        } else if (status === 403) {
          setError('You do not have permission to access the admin dashboard.');
        } else if (status >= 500) {
          setError('Server error. Please try again later.');
        } else {
          setError(data?.message || 'Failed to load dashboard data');
        }
      } else if (error.request) {
        // The request was made but no response was received
        setError('Unable to connect to the server. Please check your connection.');
      } else {
        // Something happened in setting up the request
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Initial data fetch
  useEffect(() => {
    // Check if user is admin
    if (currentUser && currentUser.role !== 'admin') {
      setError('You do not have permission to access the admin dashboard.');
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
    
    // Only fetch data if user is admin
    if (currentUser?.role === 'admin') {
      fetchDashboardStats();
      
      // Set up auto-refresh every 5 minutes
      const refreshInterval = setInterval(fetchDashboardStats, 5 * 60 * 1000);
      
      // Clean up interval on unmount
      return () => clearInterval(refreshInterval);
    }
  }, [currentUser, fetchDashboardStats, navigate]);
  
  // Manual refresh function
  const handleRefresh = () => {
    fetchDashboardStats();
  };

  const renderHeader = () => (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--dark)]">Admin Dashboard</h1>
        {lastRefreshed && (
          <p className="text-sm text-gray-500">
            Last updated: {new Date(lastRefreshed).toLocaleString()}
          </p>
        )}
      </div>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className={`flex items-center px-4 py-2 rounded-md ${loading ? 'bg-gray-300' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
      >
        {loading ? (
          <>
            <FaSync className="animate-spin mr-2" />
            Refreshing...
          </>
        ) : (
          <>
            <FaSync className="mr-2" />
            Refresh Data
          </>
        )}
      </button>
    </div>
  );
  
  // Render loading state
  if (loading && !lastRefreshed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading dashboard data...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
            <FaExclamationTriangle className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FaSync className="inline mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--light)] to-[var(--accent)] p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8">
          <div className="text-red-500 mb-4">
            <FaExclamationTriangle className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don't have permission to access the admin dashboard.</p>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {renderHeader()}
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <FaUsers className="text-2xl" />
            </div>
            <div className="ml-4">
              <p className="text-gray-500">Total Users</p>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <FaChartLine className="text-2xl" />
            </div>
            <div className="ml-4">
              <p className="text-gray-500">Active Users (30d)</p>
              <p className="text-2xl font-bold">{stats.activeUsers}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <FaMoneyCheckAlt className="text-2xl" />
            </div>
            <div className="ml-4">
              <p className="text-gray-500">Monthly Revenue</p>
              <p className="text-2xl font-bold">${stats.monthlyRevenue?.toLocaleString() || '0'}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <FaUsers className="text-2xl" />
            </div>
            <div className="ml-4">
              <p className="text-gray-500">Paying Users</p>
              <p className="text-2xl font-bold">{stats.payingUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold mb-4">Subscription Tiers</h3>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500">Basic Users</p>
              <p className="text-xl font-bold">{stats.basicUsers || 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Premium Users</p>
              <p className="text-xl font-bold">{stats.premiumUsers || 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Elite Users</p>
              <p className="text-xl font-bold">{stats.eliteUsers || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <button 
              onClick={() => setActiveTab('users')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              <FaUsers className="mx-auto text-blue-500 text-2xl mb-2" />
              <span>Manage Users</span>
            </button>
            <button 
              onClick={() => setActiveTab('subscriptions')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              <FaTags className="mx-auto text-purple-500 text-2xl mb-2" />
              <span>Subscriptions</span>
            </button>
            <button 
              onClick={() => setActiveTab('revenue')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              <FaMoneyCheckAlt className="mx-auto text-green-500 text-2xl mb-2" />
              <span>Revenue</span>
            </button>
            <button 
              onClick={() => setActiveTab('moderation')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              <FaShieldAlt className="mx-auto text-yellow-500 text-2xl mb-2" />
              <span>Moderation</span>
            </button>
            <button 
              onClick={() => setActiveTab('withdrawals')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              <FaHandHoldingUsd className="mx-auto text-red-500 text-2xl mb-2" />
              <span>Withdrawals</span>
            </button>
            <button 
              onClick={() => setActiveTab('features')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              <FaListAlt className="mx-auto text-indigo-500 text-2xl mb-2" />
              <span>Features</span>
            </button>
            <button 
              onClick={() => setActiveTab('deposits')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              <FaMoneyBillWave className="mx-auto text-orange-500 text-2xl mb-2" />
              <span>Deposit Verification</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'revenue' && <RevenueReport />}
        {activeTab === 'subscriptions' && <SubscriptionManagement />}
        {activeTab === 'moderation' && <ModerationPanel />}
        {activeTab === 'payment-methods' && <GlobalPaymentMethodsManager />}
        {activeTab === 'country-payment-methods' && <CountryPaymentMethodsManager />}
        {activeTab === 'transaction-verification' && <AdminTransactionVerification />}
        {activeTab === 'withdrawals' && <AdminWithdrawalsPage />}
        {activeTab === 'features' && <SubscriptionFeaturesPage />}
        {activeTab === 'deposits' && <AdminDepositVerification />}
        
        {!['users', 'revenue', 'subscriptions', 'moderation', 'payment-methods', 
            'country-payment-methods', 'transaction-verification', 'withdrawals', 'features', 'deposits'].includes(activeTab) && (
          <div className="p-8 text-center text-gray-500">
            <p>Select a section from the navigation to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
