import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

export default function PrivateRoute({ 
  children, 
  requireCompleteProfile = true,
  adminOnly = false
}) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  
  // List of routes where profile completion is not required
  const profileNotRequiredPaths = ['/profile-setup', '/pricing', '/subscription', '/subscribe'];
  const isProfileRequired = requireCompleteProfile && 
    !profileNotRequiredPaths.some(path => location.pathname.startsWith(path));
  
  // Check if user is admin and profile is complete when user changes or route changes
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!currentUser) {
        setIsCheckingProfile(false);
        return;
      }
      
      // Check admin access first if required
      if (adminOnly && currentUser.role !== 'admin') {
        console.log('Admin access required');
        toast.error('You do not have permission to access this page');
        setIsCheckingProfile(false);
        return;
      }
      
      // Skip profile check if not required for this route
      if (!isProfileRequired) {
        setIsCheckingProfile(false);
        return;
      }
      
      try {
        // If profile_complete is already in the user object, use that
        if (currentUser.profile_complete === false) {
          console.log('Profile not complete, redirecting to profile setup');
          return;
        }
        
        // Otherwise, fetch the latest profile data
        const response = await fetch('/api/user/profile');
        if (response.ok) {
          const data = await response.json();
          if (data.profile_complete === false) {
            console.log('Profile not complete, will redirect to profile setup');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking profile status:', error);
        toast.error('Error checking your profile status. Please try again.');
      } finally {
        setIsCheckingProfile(false);
      }
    };
    
    checkAuthorization();
  }, [currentUser, isProfileRequired, location.pathname, adminOnly]);
  
  // Show loading state while checking auth/profile status
  if (loading || isCheckingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  // If not authenticated, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Check admin access
  if (adminOnly && currentUser.role !== 'admin') {
    toast.error('You do not have permission to access this page');
    return <Navigate to="/dashboard" replace />;
  }
  
  // If profile is not complete and required for this route, redirect to profile setup
  if (isProfileRequired && currentUser.profile_complete === false) {
    // Don't redirect if we're already on the profile setup page
    if (!location.pathname.startsWith('/profile-setup')) {
      return <Navigate to="/profile-setup" state={{ from: location }} replace />;
    }
  }
  
  // If suspended, redirect to suspended page unless already there
  if (currentUser.is_suspended && !location.pathname.startsWith('/suspended')) {
    return <Navigate to="/suspended" replace />;
  }
  
  // If all checks pass, render the children
  return children;
}