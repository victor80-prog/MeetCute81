import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[var(--light)] to-[var(--accent)] p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8">
        <div className="text-9xl font-bold text-[var(--primary)]">404</div>
        <h1 className="text-2xl font-bold text-[var(--dark)] mt-4">Page Not Found</h1>
        <p className="text-[var(--text-light)] mt-2 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link 
          to="/" 
          className="btn-primary inline-flex items-center px-6 py-3"
        >
          Go to Homepage
        </Link>
      </div>
    </div>
  );
}