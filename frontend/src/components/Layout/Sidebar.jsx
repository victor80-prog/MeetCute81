import { NavLink } from 'react-router-dom';
import { FaHeart, FaSearch, FaComments, FaUsers, FaGift, FaCrown, FaUser, FaCog, FaShieldAlt, FaTags, FaMoneyBillWave, FaExchangeAlt } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = () => {
  const { logout, currentUser } = useAuth();
  const navItems = [
    { icon: <FaHeart />, text: 'Dashboard', path: '/dashboard' },
    { icon: <FaSearch />, text: 'Discover', path: '/discover' },
    { icon: <FaComments />, text: 'Messages', path: '/messages', badge: 3 },
    { icon: <FaUsers />, text: 'Matches', path: '/matches', badge: 12 },
    { icon: <FaGift />, text: 'Gifts', path: '/gifts' },
    { icon: <FaCrown />, text: 'Premium', path: '/premium' },
    { icon: <FaTags />, text: 'Pricing', path: '/pricing' },
    { icon: <FaMoneyBillWave />, text: 'Deposit', path: '/deposits' },
    { icon: <FaExchangeAlt />, text: 'Withdraw', path: '/withdrawals' },
    { icon: <FaUser />, text: 'My Profile', path: '/profile' },
    { icon: <FaCog />, text: 'Settings', path: '/settings' },
  ];

  return (
    <div className="w-64 bg-white h-full shadow-lg flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-white">
            <FaHeart className="text-xl" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] bg-clip-text text-transparent">
            MeetCute
          </h1>
        </div>
      </div>
      
      <nav className="flex-1 py-6 px-4">
        {navItems.map((item) => (
          <NavLink
            key={item.text}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center p-3 my-1 rounded-xl text-gray-600 hover:text-[var(--primary)] hover:bg-[var(--light)] 
               transition-colors ${isActive ? 'text-[var(--primary)] bg-[var(--light)] font-medium' : ''}`
            }
          >
            <span className="text-xl mr-3">{item.icon}</span>
            <span className="flex-1">{item.text}</span>
            {item.badge && (
              <span className="bg-[var(--primary)] text-white text-xs px-2 py-1 rounded-full">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
        {currentUser?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center p-3 my-1 rounded-xl text-gray-600 hover:text-[var(--primary)] hover:bg-[var(--light)] 
               transition-colors ${isActive ? 'text-[var(--primary)] bg-[var(--light)] font-medium' : ''}`
            }
          >
            <FaShieldAlt className="text-xl mr-3" />
            Admin Dashboard
          </NavLink>
        )}
      </nav>
      
      <div className="p-4 border-t border-gray-100">
        <button 
          onClick={logout}
          className="w-full py-3 border border-[var(--primary)] text-[var(--primary)] rounded-xl font-medium hover:bg-[var(--light)] transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;