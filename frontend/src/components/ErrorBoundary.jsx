import { Component } from 'react';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center p-8">
            <h2 className="text-2xl font-bold text-[var(--primary)] mb-4">
              Something went wrong
            </h2>
            <p className="text-[var(--text-light)] mb-6">
              We're sorry for the inconvenience. Please try refreshing the page.
            </p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => window.location.reload()} 
                className="btn-primary px-6 py-3"
              >
                Refresh Page
              </button>
              <a href="/" className="btn-outline px-6 py-3">
                Go to Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;