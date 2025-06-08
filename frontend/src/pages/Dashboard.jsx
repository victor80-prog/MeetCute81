import { useState, useEffect } from 'react';
import { FaHeart, FaComments, FaEye, FaArrowUp, FaBell, FaSpinner, FaReceipt, FaCreditCard } from 'react-icons/fa'; // Added FaReceipt, FaCreditCard
import Card from '../components/UI/Card';
import { dashboardAPI, transactionsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns'; // Added format
import { useAuth } from "../contexts/AuthContext";

const Dashboard = () => {
  const [loading, setLoading] = useState(true); // General loading for initial stats/activity
  const [error, setError] = useState(null); // General error for initial stats/activity
  const [dashboardStats, setDashboardStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // State for Transactions
  const [userTransactions, setUserTransactions] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [transactionsError, setTransactionsError] = useState(null);
  const [transactionsPagination, setTransactionsPagination] = useState({
    page: 1,
    limit: 5,
    totalCount: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return;

      setLoading(true); // For stats and activities
      setError(null);
      
      try {
        const [statsResponse, activitiesResponse] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getActivity()
        ]);
        setDashboardStats(statsResponse);
        setActivities(activitiesResponse);
      } catch (err) {
        console.error('Error fetching initial dashboard data:', err);
        setError(err.response?.data?.message || 'Failed to load dashboard summary.');
      } finally {
        setLoading(false);
      }
    };

    const fetchUserTransactions = async () => {
      if (!currentUser) return;

      setIsLoadingTransactions(true);
      setTransactionsError(null);
      try {
        const offset = (transactionsPagination.page - 1) * transactionsPagination.limit;
        const response = await transactionsAPI.getMyTransactions({
          limit: transactionsPagination.limit,
          offset
        });
        setUserTransactions(response.transactions || []);
        setTransactionsPagination(prev => ({ ...prev, totalCount: response.totalCount || 0 }));
      } catch (err) {
        console.error('Error fetching user transactions:', err);
        setTransactionsError(err.response?.data?.message || 'Failed to load transactions.');
      } finally {
        setIsLoadingTransactions(false);
      }
    };

    if (currentUser) {
      fetchDashboardData();
      fetchUserTransactions();
    }
  }, [currentUser, transactionsPagination.page]); // Re-fetch transactions when page changes
  
  // If we're still loading initial data or don't have stats yet, use placeholders
  const stats = dashboardStats ? [
    { 
      title: 'Matches', 
      value: dashboardStats.matches.total.toString(), 
      icon: <FaHeart className="text-2xl" />,
      description: 'Your connections',
      metrics: [
        { label: 'Today', value: dashboardStats.matches.today.toString() },
        { label: 'This Week', value: dashboardStats.matches.week.toString() },
        { label: 'Total', value: dashboardStats.matches.total.toString() },
      ]
    },
    { 
      title: 'Messages', 
      value: dashboardStats.messages.unread.toString(), 
      icon: <FaComments className="text-2xl" />,
      description: 'Unread conversations',
      metrics: [
        { label: 'New Today', value: dashboardStats.messages.today.toString() },
        { label: 'This Week', value: dashboardStats.messages.week.toString() },
        { label: 'Total', value: dashboardStats.messages.total.toString() },
      ]
    },
    { 
      title: 'Profile Views', 
      value: dashboardStats.profileViews.total.toString(), 
      icon: <FaEye className="text-2xl" />,
      description: 'People viewed your profile',
      metrics: [
        { label: 'Today', value: dashboardStats.profileViews.today.toString() },
        { label: 'This Week', value: dashboardStats.profileViews.week.toString() },
        { label: 'Total', value: dashboardStats.profileViews.total.toString() },
      ]
    }
  ] : [
    { 
      title: 'Matches', 
      value: '...', 
      icon: <FaHeart className="text-2xl" />,
      description: 'Your connections',
      metrics: [
        { label: 'Today', value: '...' },
        { label: 'This Week', value: '...' },
        { label: 'Total', value: '...' },
      ]
    },
    { 
      title: 'Messages', 
      value: '...', 
      icon: <FaComments className="text-2xl" />,
      description: 'Unread conversations',
      metrics: [
        { label: 'New Today', value: '...' },
        { label: 'This Week', value: '...' },
        { label: 'Total', value: '...' },
      ]
    },
    { 
      title: 'Profile Views', 
      value: '...', 
      icon: <FaEye className="text-2xl" />,
      description: 'People viewed your profile',
      metrics: [
        { label: 'Today', value: '...' },
        { label: 'This Week', value: '...' },
        { label: 'Total', value: '...' },
      ]
    }
  ];
  
  // Get activity icon based on type
  const getActivityIcon = (type) => {
    switch (type) {
      case 'match':
        return <FaHeart className="text-xl" />;
      case 'message':
        return <FaComments className="text-xl" />;
      case 'view':
        return <FaEye className="text-xl" />;
      default:
        return <FaBell className="text-xl" />;
    }
  };
  
  // Handle navigation to a user's profile or messages
  const handleActivityAction = (activity) => {
    if (activity.type === 'message') {
      navigate(`/messages/${activity.userId}`);
    } else {
      navigate(`/profile/${activity.userId}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Display error message if there was an error */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-[var(--dark)]">{stat.title}</h3>
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-[var(--primary)]">
                {loading ? <FaSpinner className="text-2xl animate-spin" /> : stat.icon}
              </div>
            </div>
            <div className="text-3xl font-bold text-[var(--dark)] mb-1">
              {loading ? <div className="w-16 h-8 bg-gray-200 animate-pulse rounded"></div> : stat.value}
            </div>
            <p className="text-sm text-[var(--text-light)] mb-4">{stat.description}</p>
            <div className="flex justify-between border-t border-gray-100 pt-4">
              {stat.metrics.map((metric, i) => (
                <div key={i} className="text-center">
                  <div className="text-xl font-bold">
                    {loading ? (
                      <div className="w-8 h-6 bg-gray-200 animate-pulse rounded mx-auto"></div>
                    ) : (
                      metric.value
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-light)]">{metric.label}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="section-title">
          <FaBell className="mr-2 text-[var(--primary)]" />
          Recent Activity
        </h3>
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            // Activity skeleton loaders
            Array(3).fill(0).map((_, index) => (
              <div key={index} className="p-5 border-b border-gray-100 last:border-0">
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse mr-4"></div>
                  <div className="flex-1">
                    <div className="w-1/3 h-5 bg-gray-200 animate-pulse rounded mb-2"></div>
                    <div className="w-2/3 h-4 bg-gray-200 animate-pulse rounded mb-1"></div>
                    <div className="w-1/4 h-3 bg-gray-200 animate-pulse rounded"></div>
                  </div>
                </div>
              </div>
            ))
          ) : activities.length > 0 ? (
            activities.map((activity, index) => (
              <div 
                key={index} 
                className="p-5 border-b border-gray-100 last:border-0 hover:bg-[var(--light)] transition-colors cursor-pointer"
                onClick={() => handleActivityAction(activity)}
              >
                <div className="flex">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-[var(--primary)] mr-4">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div>
                    <h4 className="font-semibold">{activity.title}</h4>
                    <p className="text-sm text-[var(--text-light)]">{activity.description}</p>
                    <p className="text-xs text-[var(--text-light)] mt-1">{activity.relativeTime}</p>
                  </div>
                  <button className="ml-auto self-start text-[var(--primary)] hover:text-[var(--primary-dark)]">
                    <FaArrowUp className="rotate-45" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-5 text-center text-gray-500">
              <p>No recent activity to display</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div>
        <h3 className="section-title">
          <FaReceipt className="mr-2 text-[var(--primary)]" />
          My Recent Payments
        </h3>
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {isLoadingTransactions ? (
            Array(3).fill(0).map((_, index) => (
              <div key={index} className="p-5 border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="w-1/2 h-5 bg-gray-200 animate-pulse rounded"></div>
                    <div className="w-1/3 h-4 bg-gray-200 animate-pulse rounded"></div>
                  </div>
                  <div className="w-1/4 h-5 bg-gray-200 animate-pulse rounded"></div>
                </div>
              </div>
            ))
          ) : transactionsError ? (
            <div className="p-5 text-center text-red-500">{transactionsError}</div>
          ) : userTransactions.length === 0 ? (
            <div className="p-5 text-center text-gray-500">
              <p>You have no transactions yet.</p>
            </div>
          ) : (
            userTransactions.map(tx => {
              // Format transaction title based on available data
              const getTransactionTitle = () => {
                if (tx.itemName) return tx.itemName;
                if (tx.item_category && tx.payable_item_id) return `${tx.item_category} ID: ${tx.payable_item_id}`;
                if (tx.description) return tx.description;
                return 'Payment';
              };

              // Format payment method display
              const getPaymentMethod = () => {
                const method = tx.payment_method_name || 'N/A';
                const country = tx.payment_country_name ? `(${tx.payment_country_name})` : '';
                return `Method: ${method} ${country}`.trim();
              };

              return (
                <div key={tx.id || tx.transaction_id || `tx-${Math.random().toString(36).substr(2, 9)}`} 
                     className="p-5 border-b border-gray-100 last:border-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                    <div className="md:col-span-2">
                      <p className="font-semibold text-sm text-[var(--dark)]">
                        {getTransactionTitle()}
                      </p>
                      {tx.created_at && (
                        <p className="text-xs text-gray-500">
                          {format(new Date(tx.created_at), 'PPpp')}
                        </p>
                      )}
                      {tx.transaction_id && (
                        <p className="text-xs text-gray-500 mt-1">
                          ID: {tx.transaction_id}
                        </p>
                      )}
                    </div>
                    <div className="text-sm md:text-right">
                      <p className="font-semibold text-[var(--dark)]">
                        {tx.currency || '$'} {tx.amount || '0.00'}
                      </p>
                      <p className={`
                        ${tx.status === 'completed' ? 'text-green-500' : ''}
                        ${tx.status === 'pending_verification' ? 'text-yellow-500' : ''}
                        ${tx.status === 'pending_payment' ? 'text-orange-500' : ''}
                        ${tx.status === 'declined' || tx.status === 'error' ? 'text-red-500' : ''}
                        capitalize text-sm mt-1
                      `}>
                        {tx.status ? tx.status.replace(/_/g, ' ') : 'pending'}
                      </p>
                    </div>
                    <div className="col-span-1 md:col-span-3 text-xs text-gray-500 mt-1">
                      {getPaymentMethod()}
                      {(tx.status === 'pending_payment' || tx.status === 'pending_verification') && (
                        <div className="mt-1">
                          Reference: {tx.user_provided_reference || 'Not yet submitted'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {/* Pagination for Transactions */}
          {transactionsPagination.totalCount > transactionsPagination.limit && !isLoadingTransactions && !transactionsError && (
            <div className="p-4 flex justify-between items-center border-t">
              <button
                onClick={() => setTransactionsPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={transactionsPagination.page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {transactionsPagination.page} of {Math.ceil(transactionsPagination.totalCount / transactionsPagination.limit)}
              </span>
              <button
                onClick={() => setTransactionsPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={(transactionsPagination.page * transactionsPagination.limit) >= transactionsPagination.totalCount}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;