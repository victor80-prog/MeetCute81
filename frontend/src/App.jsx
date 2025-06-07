// frontend/src/App.jsx

import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Layout from './components/Layout/Layout';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ProfileSetup from './pages/ProfileSetup';
import WithdrawalPage from './pages/WithdrawalPage';
import DepositPage from './pages/DepositPage';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import Messages from './pages/Messages';
import AdminDashboard from './pages/AdminDashboard';
import AdminWithdrawalsPage from './pages/Admin/AdminWithdrawalsPage';
import NotFound from './pages/NotFound';
import Matches from './pages/Matches';
import Gifts from './pages/Gifts';
import Premium from './pages/Premium';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Suspended from './pages/Suspended';
import Pricing from './pages/Pricing';
import SubscriptionConfirmation from './pages/SubscriptionConfirmation';
import ConfirmSubscriptionPage from './pages/ConfirmSubscriptionPage';
import PrivateRoute from './components/PrivateRoute';

const router = createBrowserRouter([
  // Routes without the main Layout
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  { path: "/suspended", element: <Suspended /> },
  { path: "/", element: <LandingPage /> },

  // Routes with the main Layout (which now contains SubscriptionProvider)
  {
    element: <Layout />,
    children: [
      // Routes that require authentication and a complete profile
      {
        element: <PrivateRoute requireCompleteProfile={true}><div /></PrivateRoute>,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/discover", element: <Discover /> },
          { path: "/messages", element: <Messages /> },
          { path: "/messages/:conversationId", element: <Messages /> },
          { path: "/matches", element: <Matches /> },
          { path: "/gifts", element: <Gifts /> },
          { path: "/premium", element: <Premium /> },
          { path: "/profile", element: <Profile /> },
          { path: "/settings", element: <Settings /> },
          { path: "/withdrawals", element: <WithdrawalPage /> },
          { path: "/deposits", element: <DepositPage /> },
        ]
      },
      
      // Routes that require authentication but not a complete profile
      {
        element: <PrivateRoute requireCompleteProfile={false}><div /></PrivateRoute>,
        children: [
          { path: "/profile-setup", element: <ProfileSetup /> },
          { path: "/pricing", element: <Pricing /> },
          { path: "/subscription/confirmation", element: <SubscriptionConfirmation /> },
          { path: "/subscribe/:packageId", element: <ConfirmSubscriptionPage /> },
        ]
      },
    ]
  },
  
  // Admin Routes (protected by both auth and admin check)
  {
    path: "/admin",
    element: (
      <PrivateRoute requireCompleteProfile={false} adminOnly={true}>
        <AdminDashboard />
      </PrivateRoute>
    )
  },
  {
    path: "/admin/withdrawals",
    element: (
      <PrivateRoute requireCompleteProfile={false} adminOnly={true}>
        <AdminWithdrawalsPage />
      </PrivateRoute>
    )
  },

  // Fallback Route
  { path: "*", element: <NotFound /> }
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
});

function App() {
  return (
    <AuthProvider>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
