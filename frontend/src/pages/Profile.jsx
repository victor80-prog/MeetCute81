import { useState, useEffect } from 'react';
import { useAuth } from "../contexts/AuthContext";
import { FaUser, FaEnvelope, FaCalendar, FaVenusMars, FaStar, FaCrown, FaCamera } from 'react-icons/fa';
import { profileAPI } from '../services/api';

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

const Profile = () => {
  const [uploading, setUploading] = useState(false);

  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userSubscription, setUserSubscription] = useState(null);

  useEffect(() => {
    fetchProfile();
    fetchUserSubscription();
  }, []);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Only JPG, PNG, and GIF images are allowed');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Image size must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('profilePicture', file);

      // Create a preview URL for immediate feedback
      const previewUrl = URL.createObjectURL(file);
      const cleanupPreview = () => URL.revokeObjectURL(previewUrl);
      
      // Update the UI with the preview immediately
      setProfile(prev => {
        // Revoke any previous preview URL to prevent memory leaks
        if (prev.profile_picture?.startsWith('blob:')) {
          URL.revokeObjectURL(prev.profile_picture);
        }
        return {
          ...prev,
          profile_picture: previewUrl
        };
      });

      try {
        // Upload the file
        const response = await api.post('/api/profiles/picture', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data?.profilePicture) {
          // Construct the final URL with cache-busting
          const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
          let finalUrl = response.data.profilePicture;
          
          // Ensure the URL is absolute
          if (!finalUrl.startsWith('http')) {
            finalUrl = finalUrl.startsWith('/')
              ? `${baseUrl}${finalUrl}`
              : `${baseUrl}/uploads/profile-pictures/${finalUrl}`;
          }
          
          // Add cache-busting parameter
          const separator = finalUrl.includes('?') ? '&' : '?';
          finalUrl = `${finalUrl}${separator}t=${Date.now()}`;
          
          // Update with the final URL
          setProfile(prev => ({
            ...prev,
            profile_picture: finalUrl
          }));
        }
      } finally {
        // Always clean up the preview URL
        cleanupPreview();
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setError('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Use the current user's ID from auth context
      const profileData = await profileAPI.getProfile(currentUser.id);
      setProfile(profileData);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSubscription = async () => {
    try {
      // Assuming 'api' is your preconfigured Axios instance
      const response = await api.get('/api/subscriptions/user');
      if (response.data) {
        setUserSubscription(response.data);
      }
    } catch (err) {
      // It's okay if a user has no active subscription, so don't set a general error
      // unless it's a server error or unexpected issue.
      if (err.response && err.response.status !== 404) {
         console.error('Error fetching user subscription:', err.response?.data?.error || err.message);
         // Optionally set an error if it's not a simple 'not found'
         // setError(err.response?.data?.error || 'Failed to load subscription details.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] p-6 text-white">
            <div className="flex flex-col sm:flex-row items-center">
              <div className="relative group mb-4 sm:mb-0 sm:mr-6">
                <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                  {profile?.profile_picture ? (
                    <img 
                      key={profile.profile_picture} // Force re-render on URL change
                      src={getImageUrl(profile.profile_picture)} 
                      alt={profile.first_name || 'Profile'} 
                      className="w-full h-full object-cover"
                      onLoad={(e) => {
                        // If this is a blob URL that's still being used, clean it up
                        const img = e.target;
                        if (img.src.startsWith('blob:') && img.src !== profile.profile_picture) {
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
                        
                        // Fall back to placeholder
                        img.src = 'https://via.placeholder.com/150';
                      }}
                    />
                  ) : (
                    <FaUser className="text-gray-400 text-6xl" />
                  )}
                </div>
                <label 
                  className="absolute bottom-0 right-0 bg-[var(--accent)] text-white p-2 rounded-full cursor-pointer hover:bg-[var(--primary)] transition-colors"
                  title="Change profile picture"
                >
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {uploading ? 'Uploading...' : <FaCamera />}
                </label>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="text-center mt-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </h1>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Profile Info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <FaUser className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                <p className="text-gray-900">{profile?.first_name} {profile?.last_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <FaEnvelope className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="text-gray-900">{currentUser?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <FaCalendar className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Date of Birth</h3>
                <p className="text-gray-900">{new Date(profile?.dob).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <FaVenusMars className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Gender</h3>
                <p className="text-gray-900">{profile?.gender}</p>
              </div>
            </div>
            {profile?.bio && (
              <div className="border-t pt-6 mt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">About Me</h3>
                <p className="text-gray-900 whitespace-pre-line">{profile.bio}</p>
              </div>
            )}

            {/* Subscription Info Section */}
            {userSubscription && (
              <div className="border-t pt-6 mt-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="p-3 bg-yellow-100 rounded-full">
                    <FaCrown className="text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Current Subscription</h3>
                    <p className="text-gray-900 font-semibold">
                      {userSubscription.package_name} (Tier: {userSubscription.tier_level})
                    </p>
                  </div>
                </div>
                <div className="ml-16 space-y-2">
                  <div>
                    <h4 className="text-xs font-medium text-gray-500">Status</h4>
                    <p className="text-sm text-gray-700 capitalize">{userSubscription.status}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500">Active Since</h4>
                    <p className="text-sm text-gray-700">{new Date(userSubscription.start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500">Next Billing / Expires On</h4>
                    <p className="text-sm text-gray-700">{new Date(userSubscription.end_date).toLocaleDateString()}</p>
                  </div>
                  {userSubscription.auto_renew !== undefined && (
                     <div>
                       <h4 className="text-xs font-medium text-gray-500">Auto-Renew</h4>
                       <p className="text-sm text-gray-700">{userSubscription.auto_renew ? 'Enabled' : 'Disabled'}</p>
                     </div>
                  )}
                  {userSubscription.features && userSubscription.features.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-medium text-gray-500 mb-1">Features:</h4>
                      <ul className="list-disc list-inside pl-1 space-y-1">
                        {userSubscription.features.map((feature, index) => (
                          <li key={index} className="text-sm text-gray-700 flex items-center">
                            <FaStar className="text-yellow-500 mr-2 flex-shrink-0" />
                            {feature.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 