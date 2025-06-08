// frontend/src/components/layout/Navbar.jsx

import { FaSearch, FaBell, FaEnvelope, FaMoneyBillWave, FaSignOutAlt } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserBalanceDisplay from '../UserBalanceDisplay';
import { profileAPI } from '../../services/api';

const Navbar = () => {
  const { currentUser, isLoading, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        console.log('Fetching profile for user:', currentUser.id);
        const profileData = await profileAPI.getProfile();
        console.log('Profile data received:', profileData);
        setProfile(profileData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch profile for Navbar:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
    
    // Set up a refresh interval to keep the profile data up to date
    const intervalId = setInterval(fetchProfile, 60000); // Refresh every minute
    
    // Clean up the interval on component unmount
    return () => clearInterval(intervalId);
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitial = () => {
    if (profile?.first_name) return profile.first_name[0].toUpperCase();
    if (currentUser?.email) return currentUser.email[0].toUpperCase();
    return '?';
  };

  return (
    <div className="bg-white shadow-sm py-4 px-6 flex items-center justify-between">
      <h2 className="text-2xl font-bold text-[var(--dark)]">Dashboard</h2>

      <div className="flex items-center space-x-6">
        <div className="relative">
          <FaSearch className="text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
          />
        </div>

        <div className="flex space-x-4 items-center">
          <Link to="/withdrawals" className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="Withdrawals">
            <FaMoneyBillWave className="text-xl text-green-600" />
          </Link>
          <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors" title="Notifications">
            <FaBell className="text-xl text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full"></span>
          </button>
          <Link to="/messages" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors" title="Messages">
            <FaEnvelope className="text-xl text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-pink-500 rounded-full"></span>
          </Link>
        </div>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center text-white font-semibold">
            {getInitial()}
          </div>
          <div>
            <p className="font-medium text-sm">
              {loading ? (
                'Loading...'
              ) : error ? (
                <span className="text-red-500">Error loading profile</span>
              ) : profile ? (
                `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || currentUser?.email
              ) : (
                currentUser?.email || 'User'
              )}
            </p>
            <UserBalanceDisplay className="text-xs text-gray-500" />
          </div>
          <button onClick={handleLogout} className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="Logout">
            <FaSignOutAlt className="text-xl text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;