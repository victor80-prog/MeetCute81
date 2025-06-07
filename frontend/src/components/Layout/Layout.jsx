// frontend/src/components/layout/Layout.jsx

import { Outlet } from 'react-router-dom';
import { SubscriptionProvider } from '../../contexts/SubscriptionContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import PrivateRoute from '../PrivateRoute'; // Assuming PrivateRoute handles loading/auth checks

const Layout = () => {
  // PrivateRoute will handle redirection, so we can simplify this component.
  return (
    <SubscriptionProvider>
      <div className="flex h-screen bg-[var(--light)]">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SubscriptionProvider>
  );
};

export default Layout;