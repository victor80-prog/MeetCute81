import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Premium = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to pricing page
    navigate('/pricing');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
    </div>
  );
};

export default Premium; 