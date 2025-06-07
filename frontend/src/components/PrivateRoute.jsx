import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from "../contexts/AuthContext";

export default function PrivateRoute({ children }) {
  const { currentUser, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Optional: Render a loading spinner or a minimal loading message
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // User is not authenticated, redirect to login page
    // Pass the current location so we can redirect back after login (optional)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated, now check for profile completion
  if (currentUser && currentUser.profile_complete === false && location.pathname !== '/profile-setup') {
    // User is authenticated, profile is not complete, and they are not trying to access profile-setup
    return <Navigate to="/profile-setup" state={{ from: location }} replace />;
  }

  // User is authenticated and profile is complete (or they are on /profile-setup)
  return children;
}