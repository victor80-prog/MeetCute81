// frontend/src/pages/ProfileSetup.jsx

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaUser, FaBirthdayCake, FaVenusMars, FaCamera, FaCheckCircle } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { profileAPI } from '../services/api';
import { toast } from 'react-toastify';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, refreshUser } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    bio: '',
  });

  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Effect 1: Handle email verification toast and clean URL
  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      const email = searchParams.get('email');
      toast.success(`Email ${email ? `(${email})` : ''} verified successfully! Welcome!`);
      // Use replace to prevent the toast from showing on refresh
      navigate('/profile-setup', { replace: true });
    }
  }, [searchParams, navigate]);

  // Effect 2: Fetch existing profile data to pre-fill the form
  useEffect(() => {
    const fetchProfile = async () => {
      if (currentUser) {
        try {
          // profileAPI.getProfile() directly returns the profile object or null
          const existingProfile = await profileAPI.getProfile();
          if (existingProfile) { // Check if profile exists
            const { first_name, last_name, dob, gender, bio, profile_picture } = existingProfile;
            setFormData({
              firstName: first_name || '',
              lastName: last_name || '',
              dob: dob ? new Date(dob).toISOString().split('T')[0] : '',
              gender: gender || '',
              bio: bio || '',
            });
            if (profile_picture) {
              // Construct full URL for profile picture if it's a relative path
              // Ensure VITE_API_URL is correctly defined in your .env file
              const baseUrl = import.meta.env.VITE_API_URL || '';
              if (profile_picture.startsWith('/uploads')) { // Example check for relative path
                 setProfilePicturePreview(`${baseUrl}${profile_picture}`);
              } else {
                 setProfilePicturePreview(profile_picture); // Assume it's a full URL or blob
              }
            }
          }
        } catch (err) {
          console.error('Could not fetch existing profile, likely a new user.', err);
          toast.info('Please complete your profile to get started.');
        } finally {
          setPageLoading(false);
        }
      }
    };

    if (currentUser) {
      fetchProfile();
    } else {
        // This handles the case where the AuthContext is still loading the user
        setPageLoading(true);
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File is too large! Maximum size is 5MB.');
        return;
      }
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfilePicturePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => fileInputRef.current.click();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName || !formData.lastName || !formData.dob || !formData.gender) {
      setError('Please fill in all required fields: First Name, Last Name, DoB, and Gender.');
      return;
    }

    const today = new Date();
    const birthDate = new Date(formData.dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      setError('You must be at least 18 years old to join.');
      toast.error('Sorry, you must be 18 or older to use this service.');
      return;
    }

    setLoading(true);
    try {
      // API calls are now sequential and stop on failure
      await profileAPI.updateProfile(formData);

      if (profilePicture) {
        await profileAPI.uploadProfilePicture(profilePicture);
      }

      await profileAPI.markProfileComplete();

      await refreshUser(); // Refresh auth context to get profile_complete=true
      toast.success('Profile setup complete! Welcome aboard!');
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to complete profile setup.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      {/* ... your JSX for the form ... */}
      {/* This JSX does not need to change, it will now be pre-filled correctly */}
    </div>
  );
};

export default ProfileSetup;