import React, { useState, useEffect } from 'react';
import { useAuth } from "../../contexts/AuthContext";
import { adminAPI } from '../../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const RevenueReport = () => {
  const { currentUser } = useAuth();
  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    try {
      const [trendResponse, summaryResponse] = await Promise.all([
        adminAPI.getRevenueStats(),
        adminAPI.getRevenueSummary()
      ]);
      
      setRevenueData({
        ...trendResponse.data,
        summary: summaryResponse.data
      });
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch revenue data');
      console.error('Error fetching revenue data:', err);
    } finally {
      setLoading(false);
    }
  };

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
            onClick={fetchRevenueData}
          >
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const COLORS = ['#8884d8', '#82ca9d'];

  const pieData = [
    { name: 'Subscriptions', value: revenueData.lastMonth.subscriptions },
    { name: 'Gifts', value: revenueData.lastMonth.gifts }
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-[var(--dark)] mb-2">Revenue Overview</h2>
        <p className="text-[var(--text-light)]">Comprehensive revenue statistics and trends</p>
      </div>
      
      {/* Revenue by Time Period */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Revenue by Time Period</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {revenueData.summary && (
            <>
              <div className="bg-white p-5 rounded-xl shadow-md">
                <h4 className="text-[var(--text-light)] text-sm font-medium mb-1">Today</h4>
                <p className="text-2xl font-bold text-[var(--dark)]">
                  ${revenueData.summary.byPeriod.today.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-md">
                <h4 className="text-[var(--text-light)] text-sm font-medium mb-1">This Week</h4>
                <p className="text-2xl font-bold text-[var(--dark)]">
                  ${revenueData.summary.byPeriod.week.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-md">
                <h4 className="text-[var(--text-light)] text-sm font-medium mb-1">This Month</h4>
                <p className="text-2xl font-bold text-[var(--dark)]">
                  ${revenueData.summary.byPeriod.month.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-md">
                <h4 className="text-[var(--text-light)] text-sm font-medium mb-1">This Year</h4>
                <p className="text-2xl font-bold text-[var(--dark)]">
                  ${revenueData.summary.byPeriod.year.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-md">
                <h4 className="text-[var(--text-light)] text-sm font-medium mb-1">All Time</h4>
                <p className="text-2xl font-bold text-[var(--dark)]">
                  ${revenueData.summary.byPeriod.allTime.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Revenue Trend */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold mb-4">Monthly Revenue Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={revenueData.monthlyTrend}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { month: 'short' });
                  }}
                />
                <YAxis 
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip 
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--primary)"
                  activeDot={{ r: 8 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Type */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold mb-4">Revenue by Type</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueData.summary?.byType || pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total"
                  nameKey="type"
                >
                  {(revenueData.summary?.byType || pieData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => `$${value.toLocaleString()}`}
                  labelFormatter={(name) => name.charAt(0).toUpperCase() + name.slice(1)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
        
      {/* Top Spending Users */}
      {revenueData.summary?.topUsers && revenueData.summary.topUsers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Top Spending Users</h3>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {revenueData.summary.topUsers.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${user.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.transactionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Last Month Summary Cards */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Last Month Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h4 className="text-[var(--text-light)] text-sm font-medium mb-2">Total Revenue</h4>
            <p className="text-2xl font-bold text-[var(--dark)]">
              ${revenueData.lastMonth.total.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h4 className="text-[var(--text-light)] text-sm font-medium mb-2">Subscription Revenue</h4>
            <p className="text-2xl font-bold text-[var(--dark)]">
              ${revenueData.lastMonth.subscriptions.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h4 className="text-[var(--text-light)] text-sm font-medium mb-2">Gift Revenue</h4>
            <p className="text-2xl font-bold text-[var(--dark)]">
              ${revenueData.lastMonth.gifts.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueReport;