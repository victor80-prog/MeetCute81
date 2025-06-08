import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaEnvelope, FaLock, FaHeart, FaPhone, FaGlobe, FaCheckCircle } from 'react-icons/fa';

import api from '../services/api';

const Register = () => {
  const navigate = useNavigate();
  // const { register } = useAuth(); // No longer using auth.register for this page
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    countryId: '',
    terms: false
  });
  
  const [countries, setCountries] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Fetch countries on component mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await api.get('/api/countries');
        const data = response.data;
        setCountries(data);
        // Set default country if available
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, countryId: data[0].id }));
        }
      } catch (error) {
        console.error('Error fetching countries:', error);
      }
    };
    
    fetchCountries();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Email and password fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.terms) {
      setError('Please agree to the Terms & Conditions');
      return;
    }

    try {
      setLoading(true);
      // Call API directly instead of using auth.register
      const response = await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        countryId: formData.countryId,
      });

      // Check for either the message or status field in the response
      if ((response.data && response.data.message) || response.data.status === 'pending_verification') {
        setShowVerificationMessage(true);
      } else {
        // Fallback success message if the response format is unexpected
        setShowVerificationMessage(true);
        console.log('Unexpected response format, but assuming success:', response.data);
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError(err.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--light)] to-[var(--accent)] p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-white mx-auto flex items-center justify-center">
            <FaHeart className="text-3xl text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold text-white mt-4">Create Account</h2>
          <p className="text-pink-100">Join our community today</p>
        </div>
        
        <div className="p-8">
          {showVerificationMessage ? (
            <div className="text-center">
              <FaCheckCircle className="text-5xl text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Registration Successful!</h3>
              <p className="text-[var(--text-light)]">
                Please check your email inbox (and spam folder) for a verification link to activate your account.
              </p>
              <p className="mt-4">
                <Link to="/login" className="text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium">
                  Back to Login
                </Link>
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Email</label>
                  <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  placeholder="your@email.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Password</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Confirm Password</label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Phone Number (optional)</label>
              <div className="relative">
                <FaPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                  placeholder="+1 (123) 456-7890"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Country (optional)</label>
              <div className="relative">
                <FaGlobe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  name="countryId"
                  value={formData.countryId}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                >
                  <option value="">Select a country</option>
                  {countries.map(country => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                checked={formData.terms}
                onChange={handleChange}
                className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary-light)] border-gray-300 rounded"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-[var(--text)]">
                I agree to the <a href="#" className="text-[var(--primary)] hover:text-[var(--primary-dark)]">Terms & Conditions</a>
              </label>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className={`btn-primary w-full py-3 mt-4 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--text-light)]">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-[var(--primary)] hover:text-[var(--primary-dark)]">
                Login
              </Link>
            </p>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;