import React, { useState, useEffect } from 'react';
import { likesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { FaUserCircle, FaCrown, FaHeart } from 'react-icons/fa'; // Added FaHeart

// Helper function to get full image URL (consistent with Matches.jsx)
const getImageUrl = (path) => {
  if (!path) return null; // Return null if no path to let FaUserCircle show
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `http://localhost:3000${path}`;
  return `http://localhost:3000/uploads/${path}`;
};

const WhoLikedMe = () => {
  const [likesData, setLikesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchLikes = async () => {
      try {
        setLoading(true);
        const likesData = await likesAPI.getReceivedLikes();
        setLikesData(likesData);
        setError(null);
      } catch (err) {
        console.error('Error fetching who liked me:', err);
        setError(err.response?.data?.error || 'Failed to load likes information.');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) { // Only fetch if user is logged in
      fetchLikes();
    }
  }, [currentUser]);

  if (!currentUser) { // Don't render if not logged in or user data not yet available
    return null;
  }

  if (loading) {
    return (
      <div className="p-4 border rounded-lg shadow bg-white">
        <h3 className="text-lg font-semibold mb-2 text-[var(--primary-dark)] flex items-center">
          <FaHeart className="mr-2 text-red-500" /> Who Liked You
        </h3>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg shadow bg-white">
        <h3 className="text-lg font-semibold mb-2 text-red-500">Error</h3>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  if (!likesData) {
    return (
        <div className="p-4 border rounded-lg shadow bg-white">
            <h3 className="text-lg font-semibold mb-2 text-[var(--primary-dark)] flex items-center">
                <FaHeart className="mr-2 text-red-500" /> Who Liked You
            </h3>
            <p className="text-gray-500">No information available.</p>
        </div>
    ); 
  }

  return (
    <div className="p-4 border rounded-lg shadow bg-white">
      <h3 className="text-lg font-semibold mb-3 text-[var(--primary-dark)] flex items-center">
        <FaHeart className="mr-2 text-red-500" /> Who Liked You
      </h3>
      
      {likesData.canViewProfiles === false ? (
        // Basic User View
        <div className="text-center">
          <p className="text-2xl font-bold">{likesData.count}</p>
          <p className="text-gray-600 mb-3">people have liked your profile!</p>
          {likesData.message && <p className="text-sm text-gray-500 mb-4">{likesData.message}</p>}
          <Link 
            to="/subscription" // Assuming this is the route for subscription/upgrade page
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-lg shadow hover:from-yellow-500 hover:to-orange-600 transition-colors"
          >
            <FaCrown className="mr-2" /> Upgrade to Premium
          </Link>
        </div>
      ) : (
        // Premium User View
        likesData.likers && likesData.likers.length > 0 ? (
          <ul className="space-y-3 max-h-60 overflow-y-auto">
            {likesData.likers.map(liker => {
              const profilePicUrl = getImageUrl(liker.profile_picture);
              return (
                <li key={liker.user_id || liker.id} className="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100">
                  {profilePicUrl ? (
                    <img src={profilePicUrl} alt={liker.first_name} className="w-10 h-10 rounded-full mr-3 object-cover" />
                  ) : (
                    <FaUserCircle className="w-10 h-10 rounded-full mr-3 text-gray-400" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-800">{liker.first_name} {liker.last_name}</p>
                    {/* TODO: Add more details if available, e.g., age, city */}
                  </div>
                  {/* Optional: Link to their profile if that's a feature and user has access */}
                  {/* <Link to={`/profile/${liker.user_id}`} className="ml-auto text-sm text-[var(--primary)] hover:underline">View Profile</Link> */}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-500">No one has liked your profile yet. Keep engaging!</p>
        )
      )}
    </div>
  );
};

export default WhoLikedMe;
