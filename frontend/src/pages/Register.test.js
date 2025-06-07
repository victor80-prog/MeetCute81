import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom'; // Or MemoryRouter
import Register from './Register';
import api from '../utils/api';

// Mock the api utility
jest.mock('../utils/api');

// Mock react-icons
jest.mock('react-icons/fa', () => ({
  FaEnvelope: () => <svg data-testid="icon-envelope" />,
  FaLock: () => <svg data-testid="icon-lock" />,
  FaHeart: () => <svg data-testid="icon-heart" />,
  FaPhone: () => <svg data-testid="icon-phone" />,
  FaGlobe: () => <svg data-testid="icon-globe" />,
  FaCheckCircle: () => <svg data-testid="icon-check-circle" />,
}));

// Mock useNavigate from react-router-dom as it's used internally by Register (though not directly for this test's assertions)
// and also Link component is used for "Back to Login"
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'), // Retain other exports
  useNavigate: () => mockNavigate,
}));


describe('Register Page', () => {
  beforeEach(() => {
    // Reset mocks before each test
    api.post.mockClear();
    api.get.mockClear(); // In case Register component fetches something like countries
    mockNavigate.mockClear();

    // Mock countries fetch, assuming Register fetches them
    api.get.mockResolvedValue({ data: [{ id: '1', name: 'Testland' }] });


    render(
      <Router> {/* Using Router as Register component contains <Link> */}
        <Register />
      </Router>
    );
  });

  test('shows verification message after successful registration', async () => {
    // Simulate form filling
    fireEvent.change(screen.getByPlaceholderText(/your@email.com/i), {
      target: { name: 'email', value: 'test@example.com' },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/••••••••/i)[0], { // Password
      target: { name: 'password', value: 'password123' },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/••••••••/i)[1], { // Confirm Password
      target: { name: 'confirmPassword', value: 'password123' },
    });
    fireEvent.click(screen.getByLabelText(/I agree to the/i)); // Terms checkbox

    // Mock successful API response for registration
    api.post.mockResolvedValueOnce({
      data: { message: "Registration successful. Please check your email to verify your account." }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    // Wait for the success message to appear
    await waitFor(() => {
      expect(screen.getByText(/Registration Successful!/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Please check your email inbox \(and spam folder\) for a verification link/i)).toBeInTheDocument();

    // Verify API call
    expect(api.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'test@example.com',
      password: 'password123',
      phone: '', // Assuming phone is optional and not filled
      countryId: '1', // Assuming default country is selected
    });

    // Verify form is hidden (check for an element that should be gone, e.g., email input)
    expect(screen.queryByPlaceholderText(/your@email.com/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create Account/i })).not.toBeInTheDocument();

    // Verify "Back to Login" link is present
    expect(screen.getByRole('link', {name: /Back to Login/i})).toHaveAttribute('href', '/login');
  });

  test('shows error message if registration API call fails', async () => {
    fireEvent.change(screen.getByPlaceholderText(/your@email.com/i), {
      target: { name: 'email', value: 'fail@example.com' },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/••••••••/i)[0], {
      target: { name: 'password', value: 'password123' },
    });
    fireEvent.change(screen.getAllByPlaceholderText(/••••••••/i)[1], {
      target: { name: 'confirmPassword', value: 'password123' },
    });
    fireEvent.click(screen.getByLabelText(/I agree to the/i));

    // Mock failed API response
    const errorMessage = 'Email already in use.';
    api.post.mockRejectedValueOnce({
      response: { data: { error: errorMessage } }
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Form should still be visible
    expect(screen.getByPlaceholderText(/your@email.com/i)).toBeInTheDocument();
    expect(screen.queryByText(/Registration Successful!/i)).not.toBeInTheDocument();
  });
});
