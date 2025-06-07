import React from 'react';
import { Link } from 'react-router-dom';
import { FaUserPlus, FaSignInAlt, FaHeart, FaShieldAlt, FaComments, FaStar } from 'react-icons/fa';

// Optional: Import a CSS file for custom styles if Tailwind isn't enough
// import '../styles/LandingPage.css';

const LandingPage = () => {
  const features = [
    {
      icon: <FaHeart className="text-4xl text-[var(--primary)] mb-3" />,
      title: 'Smart Matching',
      description: 'Our intelligent algorithm helps you find compatible partners based on your preferences and interests.',
    },
    {
      icon: <FaShieldAlt className="text-4xl text-[var(--primary)] mb-3" />,
      title: 'Safe & Secure',
      description: 'We prioritize your safety with advanced security measures and profile verification.',
    },
    {
      icon: <FaComments className="text-4xl text-[var(--primary)] mb-3" />,
      title: 'Meaningful Connections',
      description: 'Connect with genuine people looking for serious relationships and lasting love.',
    },
  ];

  const testimonials = [
    {
      quote: "I found my soulmate on MeetCute! The platform is easy to use and the people are genuine. Highly recommended!",
      author: "Sarah M.",
      rating: 5,
    },
    {
      quote: "After trying several dating sites, MeetCute stands out. The focus on meaningful connections made all the difference.",
      author: "John B.",
      rating: 5,
    },
    {
      quote: "A great experience overall. The site is well-designed and I met some wonderful people.",
      author: "Linda K.",
      rating: 4,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--light)] to-[var(--accent)] text-[var(--text)]">
      {/* Navbar Placeholder */}
      <nav className="bg-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-[var(--primary)]">
            MeetCute
          </Link>
          <div>
            <Link to="/login" className="text-[var(--text)] hover:text-[var(--primary)] mr-4">
              Login
            </Link>
            <Link to="/register" className="btn-primary-outline px-4 py-2 rounded-lg">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="container mx-auto text-center py-16 md:py-24 px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--primary-dark)] mb-6">
          Welcome to MeetCute - Find Your Spark!
        </h1>
        <p className="text-lg md:text-xl text-[var(--text-light)] mb-8 max-w-2xl mx-auto">
          Discover genuine connections and build meaningful relationships. Our platform is designed to help you find not just a date, but a life partner.
        </p>
        <div className="space-x-4">
          <Link
            to="/register"
            className="btn-primary text-lg px-8 py-3 rounded-lg inline-flex items-center"
          >
            <FaUserPlus className="mr-2" /> Sign Up Now
          </Link>
          <Link
            to="/login"
            className="btn-secondary text-lg px-8 py-3 rounded-lg inline-flex items-center"
          >
            <FaSignInAlt className="mr-2" /> Login
          </Link>
        </div>
      </header>

      {/* Features/About Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-semibold text-[var(--text)] mb-12">Why Choose MeetCute?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                {feature.icon}
                <h3 className="text-xl font-semibold text-[var(--primary-dark)] mb-2">{feature.title}</h3>
                <p className="text-[var(--text-light)]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-semibold text-[var(--text)] mb-12">What Our Members Say</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-lg text-left">
                <div className="flex items-center mb-2">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <FaStar key={i} className="text-yellow-400" />
                  ))}
                  {[...Array(5 - testimonial.rating)].map((_, i) => (
                    <FaStar key={i} className="text-gray-300" />
                  ))}
                </div>
                <p className="text-[var(--text-light)] italic mb-4">"{testimonial.quote}"</p>
                <p className="font-semibold text-[var(--primary)]">- {testimonial.author}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action (Footer) */}
      <section className="py-16 bg-[var(--primary)] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Find Your Match?</h2>
          <p className="text-lg mb-8 max-w-xl mx-auto">
            Join thousands of singles finding love on MeetCute. Your next great relationship is just a click away.
          </p>
          <Link
            to="/register"
            className="bg-white text-[var(--primary)] font-bold text-lg px-10 py-3 rounded-lg inline-flex items-center hover:bg-pink-100 transition-colors"
          >
            <FaUserPlus className="mr-2" /> Get Started Today
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-6 text-center">
        <p className="text-[var(--text-light)]">
          &copy; {new Date().getFullYear()} MeetCute. All rights reserved.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Crafted with <FaHeart className="inline text-red-500" /> by the MeetCute Team
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
