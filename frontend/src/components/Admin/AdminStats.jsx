import React from 'react';
import { 
  FaUsers, 
  FaUserCheck, 
  FaCrown, 
  FaDollarSign, 
  FaChartLine,
  FaUserTie,
  FaUserShield
} from 'react-icons/fa';

const StatCard = ({ title, value, icon: Icon, trend, color = 'primary' }) => {
  const colorMap = {
    primary: 'bg-[var(--primary-light)] text-[var(--primary)]',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-yellow-100 text-yellow-600',
    danger: 'bg-red-100 text-red-600',
    info: 'bg-blue-100 text-blue-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-full ${colorMap[color]} flex items-center justify-center`}>
          <Icon className="text-xl" />
        </div>
        {trend !== undefined && (
          <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <h3 className="text-[var(--text-light)] text-sm font-medium mb-1">{title}</h3>
      <div className="text-2xl font-bold text-[var(--dark)]">
        {typeof value === 'number' && title.toLowerCase().includes('revenue') 
          ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
          : value.toLocaleString()}
      </div>
    </div>
  );
};

const AdminStats = ({ stats }) => {
  // Calculate percentages for the progress bars
  const totalActiveUsers = stats.activeUsers || 1; // Avoid division by zero
  const basicPercentage = Math.round(((stats.basicUsers || 0) / totalActiveUsers) * 100);
  const premiumPercentage = Math.round(((stats.premiumUsers || 0) / totalActiveUsers) * 100);
  const elitePercentage = Math.round(((stats.eliteUsers || 0) / totalActiveUsers) * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.totalUsers || 0}
          icon={FaUsers}
          color="info"
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers || 0}
          icon={FaUserCheck}
          color="success"
        />
        <StatCard
          title="Paying Users"
          value={stats.payingUsers || 0}
          icon={FaChartLine}
          color="warning"
        />
        <StatCard
          title="Monthly Revenue"
          value={stats.monthlyRevenue || 0}
          icon={FaDollarSign}
          color="primary"
        />
      </div>
      
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-[var(--dark)] mb-4">Subscription Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.basicUsers || 0}</div>
            <div className="text-sm text-[var(--text-light)]">Basic Users</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${basicPercentage}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">{basicPercentage}% of active users</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-500 mb-2">{stats.premiumUsers || 0}</div>
            <div className="text-sm text-[var(--text-light)]">Premium Users</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-yellow-500 h-2.5 rounded-full" 
                style={{ width: `${premiumPercentage}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">{premiumPercentage}% of active users</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{stats.eliteUsers || 0}</div>
            <div className="text-sm text-[var(--text-light)]">Elite Users</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-purple-600 h-2.5 rounded-full" 
                style={{ width: `${elitePercentage}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">{elitePercentage}% of active users</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;