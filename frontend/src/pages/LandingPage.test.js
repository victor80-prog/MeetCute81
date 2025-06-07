import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom'; // Or MemoryRouter
import LandingPage from './LandingPage';

// Mock react-icons if they cause issues in test environment (optional)
jest.mock('react-icons/fa', () => ({
  FaUserPlus: () => <svg data-testid="icon-user-plus" />,
  FaSignInAlt: () => <svg data-testid="icon-signin-alt" />,
  FaHeart: () => <svg data-testid="icon-heart" />,
  FaShieldAlt: () => <svg data-testid="icon-shield-alt" />,
  FaComments: () => <svg data-testid="icon-comments" />,
  FaStar: () => <svg data-testid="icon-star" />,
}));

describe('LandingPage', () => {
  beforeEach(() => {
    // Render the component within a Router because it uses <Link>
    render(
      <Router>
        <LandingPage />
      </Router>
    );
  });

  test('renders without crashing and shows key text elements', () => {
    // Main headline
    expect(screen.getByText(/Welcome to MeetCute - Find Your Spark!/i)).toBeInTheDocument();

    // Section titles (use queryByText if their exact casing/wording might vary slightly or use regex)
    expect(screen.getByText(/Why Choose MeetCute\?/i)).toBeInTheDocument();
    expect(screen.getByText(/What Our Members Say/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready to Find Your Match\?/i)).toBeInTheDocument();

    // Button texts
    // Use getAllByText if multiple buttons have similar text but different contexts (e.g. header and footer)
    expect(screen.getAllByText(/Sign Up/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Login/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sign Up Now/i)).toBeInTheDocument(); // Hero button
    expect(screen.getByText(/Get Started Today/i)).toBeInTheDocument(); // Footer CTA button
  });

  test('navigation links point to correct routes', () => {
    // Test hero section buttons
    const signUpButtonHero = screen.getByRole('link', { name: /Sign Up Now/i });
    expect(signUpButtonHero).toHaveAttribute('href', '/register');

    const loginButtonHero = screen.getByRole('link', { name: /Login/i });
    expect(loginButtonHero).toHaveAttribute('href', '/login');

    // Test navbar links (assuming simple structure)
    // The text "Login" might appear multiple times, ensure to select the correct one if needed
    // This example assumes the first "Login" link found is in the navbar
    const navLoginLink = screen.getAllByRole('link', { name: /Login/i })[0];
    expect(navLoginLink).toHaveAttribute('href', '/login');

    const navSignUpLink = screen.getByRole('link', { name: /Sign Up/i }); // Navbar Sign Up
    expect(navSignUpLink).toHaveAttribute('href', '/register');

    // Test Call to Action button in footer
    const getStartedButtonFooter = screen.getByRole('link', { name: /Get Started Today/i });
    expect(getStartedButtonFooter).toHaveAttribute('href', '/register');
  });

  test('renders feature section items', () => {
    expect(screen.getByText(/Smart Matching/i)).toBeInTheDocument();
    expect(screen.getByText(/Safe & Secure/i)).toBeInTheDocument();
    expect(screen.getByText(/Meaningful Connections/i)).toBeInTheDocument();
  });

  test('renders testimonial section items', () => {
    // Check for parts of the testimonial quotes or authors
    expect(screen.getByText(/Sarah M./i)).toBeInTheDocument();
    expect(screen.getByText(/John B./i)).toBeInTheDocument();
    expect(screen.getByText(/Linda K./i)).toBeInTheDocument();
    // Check for presence of star icons (mocked as svgs with testids)
    expect(screen.getAllByTestId('icon-star').length).toBeGreaterThan(0);
  });
});
