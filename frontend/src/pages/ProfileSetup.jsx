// frontend/src/pages/ProfileSetup.jsx

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaUser, FaBirthdayCake, FaVenusMars, FaCamera, FaCheckCircle } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { profileAPI } from '../services/api';
import { toast } from 'react-toastify';

// Form validation rules
const validateForm = (data) => {
  const errors = {};
  
  if (!data.firstName?.trim()) {
    errors.firstName = 'First name is required';
  }
  
  if (!data.lastName?.trim()) {
    errors.lastName = 'Last name is required';
  }
  
  if (!data.dob) {
    errors.dob = 'Date of birth is required';
  } else {
    const birthDate = new Date(data.dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      errors.dob = 'You must be at least 18 years old';
    } else if (age > 120) {
      errors.dob = 'Please enter a valid date of birth';
    }
  }
  
  if (!data.gender) {
    errors.gender = 'Please select a gender';
  }
  
  return errors;
};

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, refreshUser } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    bio: '',
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  // Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }
    
    setProfilePicture(file);
    setProfilePicturePreview(URL.createObjectURL(file));
  };
  
  // Trigger file input click
  const triggerFileInput = () => fileInputRef.current?.click();
  
  // Fetch user profile data
  const fetchUserProfile = useCallback(async () => {
    if (!currentUser?.id) return null;
    
    try {
      const response = await profileAPI.getMyProfile();
      
      // If profile is already complete, redirect to dashboard
      if (response?.profile?.profile_complete) {
        navigate('/dashboard', { replace: true });
        return null;
      }
      
      return response?.profile || null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      // If it's a 404, it means no profile exists yet (expected for new users)
      if (error.response?.status !== 404) {
        toast.error('Failed to load profile data. Please refresh to try again.');
      }
      return null;
    }
  }, [currentUser?.id, navigate]);
  
  // Initialize form with user data
  const initializeForm = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Handle email verification toast if needed
      if (searchParams.get('verified') === 'true') {
        const email = searchParams.get('email');
        toast.success(`Email ${email ? `(${email})` : ''} verified successfully!`);
        // Clean up the URL
        navigate('/profile-setup', { replace: true });
      }
      
      // If user is already authenticated but profile is not complete
      if (currentUser?.id) {
        const profile = await fetchUserProfile();
        
        if (profile) {
          // Pre-fill form with existing profile data
          setFormData({
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            dob: profile.dob ? new Date(profile.dob).toISOString().split('T')[0] : '',
            gender: profile.gender || '',
            bio: profile.bio || ''
          });
          
          // Set profile picture if available
          if (profile.profile_picture) {
            try {
              let pictureUrl = profile.profile_picture;
              if (!pictureUrl.startsWith('http')) {
                const baseUrl = import.meta.env.VITE_API_URL || '';
                pictureUrl = `${baseUrl}${pictureUrl.startsWith('/') ? '' : '/'}${profile.profile_picture}`.replace(/([^:]\/)\/+/g, '$1');
              }
              setProfilePicturePreview(pictureUrl);
            } catch (error) {
              console.error('Error processing profile picture:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error initializing form:', error);
      toast.error('Failed to initialize form. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, searchParams, navigate, fetchUserProfile]);
  
  // Initialize on mount and when dependencies change
  useEffect(() => {
    initializeForm();
  }, [initializeForm]);
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const formErrors = validateForm(formData);
    setErrors(formErrors);
    
    if (Object.keys(formErrors).length > 0) {
      // Scroll to the first error
      const firstError = Object.keys(formErrors)[0];
      document.querySelector(`[name="${firstError}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 1. Update profile data
      const updateData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dob: formData.dob,
        gender: formData.gender,
        bio: formData.bio.trim()
      };
      
      await profileAPI.updateProfile(updateData);
      
      // 2. Upload profile picture if a new one was selected
      if (profilePicture) {
        try {
          await profileAPI.uploadProfilePicture(profilePicture);
        } catch (uploadError) {
          console.error('Error uploading profile picture:', uploadError);
          // Don't fail the entire process if picture upload fails
          toast.warning('Profile updated, but there was an issue uploading your profile picture. You can try again later.');
        }
      }
      
      // 3. Mark profile as complete
      await profileAPI.markProfileComplete();
      
      // 4. Refresh user data
      await refreshUser();
      
      // 5. Show success and redirect
      toast.success('Profile setup complete! Welcome to MeetCute!');
      navigate('/dashboard');
      
    } catch (error) {
      console.error('Error saving profile:', error);
      
      let errorMessage = 'Failed to save profile. Please try again.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Your session has expired. Please log in again.';
        navigate('/login');
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Show loading state
  if (isLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
        
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">
            {currentUser?.profile_complete ? 'Update Your Profile' : 'Complete Your Profile'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {currentUser?.profile_complete 
              ? 'Make changes to your profile information.'
              : 'Help us get to know you better. This information will be shown on your profile.'}
          </p>
        </div>
        
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Profile Picture Section */}
          <div className="px-6 py-8 border-b border-gray-200">
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {profilePicturePreview ? (
                    <img 
                      src={profilePicturePreview} 
                      alt="Profile preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FaUser className="w-16 h-16 text-gray-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 shadow-lg hover:bg-blue-700 transition-colors duration-200"
                  disabled={isSubmitting}
                >
                  <FaCamera className="w-5 h-5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                  disabled={isSubmitting}
                />
              </div>
              <button
                type="button"
                onClick={triggerFileInput}
                className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                disabled={isSubmitting}
              >
                {profilePicturePreview ? 'Change photo' : 'Add a photo'}
              </button>
            </div>
          </div>
          
          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="px-6 py-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              {/* First Name */}
              <div className="sm:col-span-3">
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  First name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="firstName"
                    id="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`block w-full rounded-md shadow-sm ${errors.firstName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                    disabled={isSubmitting}
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                  )}
                </div>
              </div>
              
              {/* Last Name */}
              <div className="sm:col-span-3">
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Last name <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="lastName"
                    id="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`block w-full rounded-md shadow-sm ${errors.lastName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                    disabled={isSubmitting}
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>
              
              {/* Date of Birth */}
              <div className="sm:col-span-3">
                <label htmlFor="dob" className="block text-sm font-medium text-gray-700">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaBirthdayCake className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      name="dob"
                      id="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      className={`block w-full pl-10 rounded-md ${errors.dob ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                      disabled={isSubmitting}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  {errors.dob && (
                    <p className="mt-1 text-sm text-red-600">{errors.dob}</p>
                  )}
                </div>
              </div>
              
              {/* Gender */}
              <div className="sm:col-span-3">
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className={`block w-full rounded-md shadow-sm ${errors.gender ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} sm:text-sm`}
                    disabled={isSubmitting}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                  {errors.gender && (
                    <p className="mt-1 text-sm text-red-600">{errors.gender}</p>
                  )}
                </div>
              </div>
              
              {/* Bio */}
              <div className="sm:col-span-6">
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                  About you
                </label>
                <div className="mt-1">
                  <textarea
                    id="bio"
                    name="bio"
                    rows={4}
                    value={formData.bio}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                    placeholder="Tell others about yourself..."
                    disabled={isSubmitting}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Write a few sentences about yourself. This will help others get to know you better.
                </p>
              </div>
            </div>
            
            {/* Form Actions */}
            <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="-ml-1 mr-2 h-4 w-4" />
                    {currentUser?.profile_complete ? 'Update Profile' : 'Complete Profile'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        {/* Debug info (only in development) */}
        {import.meta.env.DEV && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs text-gray-600">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify({
                formData,
                errors,
                isSubmitting,
                hasProfilePicture: !!profilePicture,
                profileComplete: currentUser?.profile_complete
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSetup;
      // If no user ID but we're not loading, set loading to false
      setPageLoading(false);
    }
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]); // Only re-run if currentUser.id changes

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
    
    // Validate required fields
    const requiredFields = {
      firstName: 'First Name',
      lastName: 'Last Name',
      dob: 'Date of Birth',
      gender: 'Gender'
    };
    
    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !formData[key])
      .map(([_, label]) => label);
    
    if (missingFields.length > 0) {
      const errorMsg = `Please fill in all required fields: ${missingFields.join(', ')}`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Validate age
    try {
      const today = new Date();
      const birthDate = new Date(formData.dob);
      
      // Check if date is valid
      if (isNaN(birthDate.getTime())) {
        throw new Error('Invalid date of birth');
      }
      
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        const errorMsg = 'You must be at least 18 years old to join.';
        setError(errorMsg);
        toast.error('Sorry, you must be 18 or older to use this service.');
        return;
      }
    } catch (dateError) {
      console.error('Error validating date of birth:', dateError);
      const errorMsg = 'Invalid date of birth. Please enter a valid date.';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    
    try {
      // 1. First update the profile data
      const updateData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dob: formData.dob,
        gender: formData.gender,
        bio: formData.bio ? formData.bio.trim() : ''
      };
      
      console.log('Updating profile with data:', updateData);
      await profileAPI.updateProfile(updateData);
      toast.success('Profile information saved successfully!');
      
      // 2. If there's a new profile picture, upload it
      if (profilePicture) {
        try {
          console.log('Uploading profile picture...');
          await profileAPI.uploadProfilePicture(profilePicture);
          console.log('Profile picture uploaded successfully');
          toast.success('Profile picture uploaded successfully!');
        } catch (uploadError) {
          console.error('Error uploading profile picture:', uploadError);
          // Don't fail the entire process if picture upload fails
          toast.warning('Profile updated, but there was an issue with your profile picture. You can try uploading it again later.');
        }
      }
      
      // 3. Mark profile as complete
      console.log('Marking profile as complete...');
      await profileAPI.markProfileComplete();
      
      // 4. Refresh user data in auth context
      console.log('Refreshing user data...');
      const updatedUser = await refreshUser();
      
      // 5. Show success and redirect
      toast.success('Profile setup complete! Welcome aboard!');
      console.log('Profile setup complete, redirecting to dashboard...');
      
      // Redirect to dashboard after a short delay to show success message
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      
    } catch (err) {
      console.error('Error in profile setup:', {
        error: err,
        response: err.response?.data,
        status: err.response?.status
      });
      
      let errorMessage = 'Failed to complete profile setup. Please try again.';
      
      // Handle specific error cases
      if (err.response?.status === 401) {
        errorMessage = 'Your session has expired. Please log in again.';
        toast.error(errorMessage);
        navigate('/login');
        return;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
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