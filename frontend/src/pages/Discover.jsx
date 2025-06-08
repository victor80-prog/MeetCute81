import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileCard from '../components/Profile/ProfileCard';
import { matchesAPI } from '../services/api';
import { FaHeart, FaTimes } from 'react-icons/fa';
import { useAuth } from "../contexts/AuthContext";

const Discover = () => {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [matchCreated, setMatchCreated] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchProfiles();
    }
  }, [currentUser]);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await matchesAPI.getSuggestions();
      console.log('Fetched potential matches:', response);
      
      // Process profiles for display
      const processedProfiles = (Array.isArray(response) ? response : []).map(profile => ({
        id: profile.user_id,
        user_id: profile.user_id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        age: calculateAge(profile.dob),
        location: profile.location || 'Unknown location',
        bio: profile.bio || 'No bio provided',
        profile_picture: profile.profile_picture,
        tags: profile.interests ? profile.interests.split(',').map(i => i.trim()) : []
      }));
      
      setProfiles(processedProfiles);
      setCurrentIndex(0); // Reset to first profile when fetching new profiles
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError('Failed to load profiles. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper function to get full image URL
  const getImageUrl = (path) => {
    // If no path is provided, return the default avatar from backend
    if (!path) return 'http://localhost:3000/images/default-avatar.svg';
    
    // Check if the path is already a full URL
    if (path.startsWith('http')) return path;
    
    // If it's already an absolute path (starts with /), use as is
    if (path.startsWith('/')) return `http://localhost:3000${path}`;
    
    // Otherwise, assume it's a relative path from the uploads directory
    return `http://localhost:3000/uploads/${path}`;
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    } catch (err) {
      console.error('Error calculating age:', err);
      return null;
    }
  };

  const handleLike = async (profileId) => {
    try {
      console.log('Liking profile:', profileId);
      
      // Add error display with timeout to auto-dismiss
      const showTemporaryError = (message) => {
        setError(message);
        setTimeout(() => setError(null), 3000);
      };
      
      const response = await matchesAPI.likeProfile(profileId);
      
      // Handle already liked profiles
      if (response.alreadyLiked) {
        console.log('Already liked this profile');
        // Show a more informative message to the user
        if (response.match) {
          // If it's also a match, show match notification
          showMatchDialog(profileId, true);
        } else {
          // Just show a small notification
          showTemporaryError("You've already liked this profile");
          goToNextProfile();
        }
      } 
      // Check if it's a new match
      else if (response.data.match) {
        // Show match notification with option to message
        showMatchDialog(profileId, false);
      } else {
        // No match, just move to the next profile
        goToNextProfile();
      }
    } catch (err) {
      console.error('Error liking profile:', err);
      
      // Provide more specific error messages based on the error type
      if (err.response?.status === 429 && err.response?.data?.limitExceeded && err.response?.data?.limitType === 'swipe') {
        // Specific error for swipe limit - make this persistent and stay on current profile
        setError(err.response.data.error || 'You have reached your daily swipe limit. Please upgrade for unlimited swipes.');
        // Optionally, you could disable swipe buttons here or show an upgrade modal.
      } else {
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else if (err.request) {
          setError('Network error. Please check your connection.');
        } else {
          setError('Failed to like profile. Please try again.');
        }
        setTimeout(() => {
          setError(null);
          goToNextProfile(); // Move to next profile after showing other errors briefly
        }, 3000);
      }
    }
  };
  
  const showMatchDialog = (profileId, alreadyMatched) => {
    // Find the matched profile
    const matchedProfile = profiles.find(p => p.id === profileId);
    
    if (!matchedProfile) return;
    
    // Save match info to session storage for the Messages component
    const matchData = {
      user_id: matchedProfile.id,
      first_name: matchedProfile.name.split(' ')[0],
      last_name: matchedProfile.name.split(' ')[1] || '',
      profile_picture: matchedProfile.profile_picture
    };
    
    // Store the match data in session storage
    sessionStorage.setItem('selectedMatch', JSON.stringify(matchData));
    
    // Show modal dialog with options
    const message = alreadyMatched ? 
      `You already matched with ${matchedProfile.name}!` : 
      `It's a match with ${matchedProfile.name}! 🎉`;
      
    if (confirm(`${message}\n\nDo you want to message ${matchedProfile.name.split(' ')[0]} now?`)) {
      // Navigate to messages with this user
      navigate(`/messages/${matchedProfile.id}`);
    } else {
      // Continue browsing
      goToNextProfile();
    }
  };

  const handleSkip = () => {
    console.log('Skipping profile');
    goToNextProfile();
  };

  const goToNextProfile = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // No more profiles, show empty state or fetch more
      setProfiles([]);
      // Optionally fetch more profiles
      fetchProfiles();
    }
  };

  // Show loading state
  if (loading && profiles.length === 0) {
    return (
      <div className="pt-16 flex justify-center items-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  // Show error state
  if (error && profiles.length === 0) {
    return (
      <div className="pt-16 flex flex-col justify-center items-center min-h-[80vh] p-4">
        <div className="text-red-500 text-xl mb-4">😞 {error}</div>
        <button 
          onClick={fetchProfiles}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Show empty state when no profiles available
  if (profiles.length === 0) {
    return (
      <div className="pt-16 flex flex-col justify-center items-center min-h-[80vh] p-4">
        <div className="text-2xl font-bold mb-2">No more profiles</div>
        <p className="text-gray-500 mb-6 text-center">
          You've viewed all potential matches for now. Check back later for more!
        </p>
        <button 
          onClick={() => navigate('/matches')}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
        >
          View Your Matches
        </button>
      </div>
    );
  }

  // Get the current profile safely
  const currentProfile = profiles.length > currentIndex ? profiles[currentIndex] : null;

  return (
    <div className="pt-16 max-w-md mx-auto p-4">
      <div className="flex flex-col items-center">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 w-full">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="w-full mb-6">
          <ProfileCard profile={currentProfile} />
        </div>
        
        {currentProfile && (
          <>
            <div className="flex justify-center gap-6 mt-4">
              <button 
                onClick={handleSkip}
                className="w-16 h-16 flex items-center justify-center rounded-full bg-white border border-gray-300 shadow-md hover:shadow-lg transition-shadow"
              >
                <FaTimes className="text-gray-500 text-2xl" />
              </button>
              
              <button 
                onClick={() => handleLike(currentProfile.id)}
                className="w-16 h-16 flex items-center justify-center rounded-full bg-[var(--primary)] shadow-md hover:shadow-lg transition-shadow"
              >
                <FaHeart className="text-white text-2xl" />
              </button>
            </div>
            
            <div className="mt-8 text-center text-gray-500">
              {currentIndex + 1} of {profiles.length} profiles
            </div>
          </>
        )}

        {!currentProfile && !loading && !error && profiles.length === 0 && (
          <div className="text-center mt-8">
            <h2 className="text-2xl font-bold mb-2">No matches available</h2>
            <p className="mb-4">We couldn't find any potential matches for you right now.</p>
            <button 
              onClick={fetchProfiles}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;
