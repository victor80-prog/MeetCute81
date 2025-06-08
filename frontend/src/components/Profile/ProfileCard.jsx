import { useState } from 'react';
import { FaUser, FaCamera } from 'react-icons/fa';
import Button from '../UI/Button';
import { useAuth } from "../../contexts/AuthContext";
import api from '../../services/api';

// Helper function to get full image URL
const getImageUrl = (path) => {
  // If no path is provided, return the default avatar
  if (!path) return '/images/default-avatar.svg';
  
  // Check if the path is already a full URL
  if (path.startsWith('http')) return path;
  
  // Otherwise, construct the full URL
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

const ProfileCard = ({ profile, onUpdate }) => {
  const [uploading, setUploading] = useState(false);
  const { currentUser } = useAuth();
  
  // Handle case when profile is undefined
  if (!profile) {
    return (
      <div className="card bg-white shadow-lg rounded-2xl overflow-hidden">
        <div className="h-48 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] relative rounded-t-2xl">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white">
            <p>Profile data unavailable</p>
          </div>
        </div>
        <div className="p-6 pt-20">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6 mb-2"></div>
          </div>
        </div>
      </div>
    );
  }
  
  const isOwnProfile = currentUser?.id === profile.user_id;

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await api.post('/api/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (onUpdate) {
        onUpdate({ ...profile, profile_picture: response.data.profilePicture });
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const profileImageUrl = getImageUrl(profile.profile_picture);
  const coverImageUrl = getImageUrl(profile.cover_photo);

  return (
    <div className="card bg-white shadow-lg rounded-2xl overflow-hidden">
      <div className="h-48 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] relative rounded-t-2xl">
        {coverImageUrl && (
          <img 
            src={coverImageUrl} 
            alt="Cover" 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
            }}
          />
        )}
      </div>
      
      {/* Profile Picture */}
      <div className="relative px-6">
        <div className="flex justify-center -mt-16 mb-4">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100">
              {profileImageUrl ? (
                <img 
                  src={profileImageUrl}
                  alt={profile.name || 'Profile'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <FaUser className="text-gray-400 text-5xl" />
                </div>
              )}
            </div>
            
            {isOwnProfile && (
              <label 
                className="absolute -bottom-2 -right-2 bg-[var(--accent)] text-white p-2 rounded-full cursor-pointer hover:bg-[var(--primary)] transition-colors"
                title="Change profile picture"
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <span className="text-xs">...</span>
                ) : (
                  <FaCamera className="text-white" />
                )}
              </label>
            )}
          </div>
        </div>
      </div>
      
      <div className="pt-20 px-6 pb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-[var(--dark)]">
            {profile.name}, <span className="font-normal text-[var(--text-light)]">{profile.age}</span>
          </h3>
        </div>
        
        <div className="flex items-center text-[var(--text-light)] mb-4">
          <svg className="w-5 h-5 mr-2 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          <span>{profile.location}</span>
        </div>
        
        <p className="text-[var(--text)] mb-6 leading-relaxed">
          {profile.bio}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-6">
          {profile.tags.map((tag, index) => (
            <span 
              key={index} 
              className="bg-[var(--light)] text-[var(--primary)] px-3 py-1 rounded-full text-sm font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="flex justify-between gap-4">
          <Button variant="secondary" className="flex-1 py-4">
            <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
          
          <Button variant="secondary" className="flex-1 py-4">
            <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </Button>
          
          <Button className="flex-1 py-4">
            <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;