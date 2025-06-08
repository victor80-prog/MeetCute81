// frontend/src/pages/Matches.jsx

import { useState, useEffect } from 'react';
import { useAuth } from "../contexts/AuthContext";
import { FaComment, FaHeart, FaUserTimes, FaTimes } from 'react-icons/fa';
import { matchesAPI, messagesAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

// Helper function to get full image URL
const getImageUrl = (path) => {
  if (!path) return null;
  
  // If it's a blob URL, return as is (for previews)
  if (path.startsWith('blob:')) return path;
  
  // If it's already a full URL, return as is
  if (path.startsWith('http')) return path;
  
  const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
  
  // For profile pictures, use our proxy endpoint
  if (path.includes('profile-') || path.includes('profile_')) {
    // Extract just the filename
    const filename = path.split('/').pop();
    // Use our proxy endpoint that handles CORS properly
    return `${baseUrl}/api/profiles/picture/${encodeURIComponent(filename)}`;
  }
  
  // For other static files, use the regular path
  return path.startsWith('/') 
    ? `${baseUrl}${path}` 
    : `${baseUrl}/${path}`;
};

const Matches = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const matchesData = await matchesAPI.getMatches();
      setMatches(Array.isArray(matchesData) ? matchesData : []);
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError(err.response?.data?.error || 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };
  
  // --- NEW FUNCTION TO HANDLE CHAT BUTTON CLICK ---
  const handleChat = async (matchedUserId) => {
    try {
      // Call the API to get or create a conversation
      const response = await messagesAPI.getOrCreateConversation(matchedUserId);
      const conversationId = response?.conversationId || response?.data?.conversationId;
      
      if (conversationId) {
        // Navigate to the messages page with the correct CONVERSATION ID
        navigate(`/messages/${conversationId}`);
      } else {
        throw new Error('Could not start a conversation.');
      }
    } catch (err) {
      console.error('Error starting chat:', err);
      toast.error('Could not open chat. Please try again.');
    }
  };

  const handleUnmatch = async (matchId) => {
    if (!window.confirm('Are you sure you want to unmatch?')) return;

    try {
      await matchesAPI.unmatch(matchId);
      setMatches(prevMatches => prevMatches.filter(match => match.id !== matchId));
      toast.success('Successfully unmatched.');
    } catch (err) {
      console.error('Error unmatching:', err);
      toast.error(err.response?.data?.error || 'Failed to unmatch.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Your Matches</h1>
      
      {matches.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow-sm">
          <div className="text-6xl mb-4">💝</div>
          <h2 className="text-xl font-semibold mb-2 text-gray-700">No matches yet</h2>
          <p className="text-gray-500">Keep swiping to find your perfect match!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map(match => {
            // FIX: Access the corrected 'profile_picture' property
            const imageUrl = getImageUrl(match.matchedUser.profile_picture);
            
            return (
              <div key={match.id} className="bg-white rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300">
                <div className="relative h-64 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {match.matchedUser.profile_picture ? (
                    <img 
                      key={match.matchedUser.profile_picture} // Force re-render on URL change
                      src={getImageUrl(match.matchedUser.profile_picture)}
                      alt={`${match.matchedUser.firstName || 'User'}'s profile`}
                      className="w-full h-full object-cover"
                      onLoad={(e) => {
                        // If this is a blob URL that's still being used, clean it up
                        const img = e.target;
                        if (img.src.startsWith('blob:') && img.src !== match.matchedUser.profile_picture) {
                          URL.revokeObjectURL(img.src);
                        }
                      }}
                      onError={(e) => {
                        const img = e.target;
                        // Don't retry if we already tried with a fallback
                        if (img.src.includes('placeholder.com')) return;
                        
                        // If this was a blob URL, clean it up
                        if (img.src.startsWith('blob:')) {
                          URL.revokeObjectURL(img.src);
                        }
                        
                        // Fall back to a simple placeholder
                        img.src = 'https://via.placeholder.com/300x300?text=No+Image';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <div className="text-gray-400 text-center p-4">
                        <div className="text-6xl mb-2">👤</div>
                        <p className="text-sm">No profile picture</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-4">
                  <h3 className="text-xl font-semibold mb-1 text-gray-800">
                    {match.matchedUser.firstName} {match.matchedUser.lastName}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    Matched on {new Date(match.createdAt).toLocaleDateString()}
                  </p>
                  
                  <div className="flex justify-between items-center gap-2">
                    <button 
                      className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
                      onClick={() => handleChat(match.matchedUser.id)}
                    >
                      <FaComment /> Chat
                    </button>
                    
                    <button 
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-full"
                      onClick={() => handleUnmatch(match.matchedUser.id)}
                      title="Unmatch"
                    >
                      <FaTimes className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Matches;