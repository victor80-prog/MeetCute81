import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom'; // Using MemoryRouter for testing
import VerifyEmailPage from './VerifyEmailPage';
import api from '../utils/api';

// Mock the api utility
jest.mock('../utils/api');

// Mock react-router-dom's useSearchParams
// We will also need to wrap the component in a Router context that can provide search params
// Using MemoryRouter and setting initialEntries is a good way.

// Mock react-icons
jest.mock('react-icons/fa', () => ({
  FaCheckCircle: () => <svg data-testid="icon-check-circle" />,
  FaTimesCircle: () => <svg data-testid="icon-times-circle" />,
  FaSpinner: () => <svg data-testid="icon-spinner" />,
}));

const renderWithRouter = (ui, { route = '/', initialEntries = ['/'] } = {}) => {
  window.history.pushState({}, 'Test page', route);
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/verify-email" element={ui} />
        <Route path="/login" element={<div>Login Page Mock</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('VerifyEmailPage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('displays "no token" message if token is missing', () => {
    renderWithRouter(<VerifyEmailPage />, { initialEntries: ['/verify-email'] }); // No token in query
    expect(screen.getByText(/No verification token found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('icon-spinner')).not.toBeInTheDocument();
  });

  test('displays loading state then success message for a valid token', async () => {
    const mockToken = 'valid-token';
    api.get.mockResolvedValueOnce({ data: { message: "Email has been successfully verified!" } });

    renderWithRouter(<VerifyEmailPage />, { initialEntries: [`/verify-email?token=${mockToken}`] });

    // Check for loading state initially
    expect(screen.getByTestId('icon-spinner')).toBeInTheDocument();
    expect(screen.getByText(/Verifying Email.../i)).toBeInTheDocument();

    // Wait for the API call to resolve and UI to update
    await waitFor(() => {
      expect(screen.getByText(/Email has been successfully verified!/i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('icon-check-circle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Proceed to Login/i })).toHaveAttribute('href', '/login');
    expect(api.get).toHaveBeenCalledWith(`/api/auth/verify-email?token=${mockToken}`);
  });

  test('displays loading state then error message for an invalid token', async () => {
    const mockToken = 'invalid-token';
    api.get.mockRejectedValueOnce({
      response: { data: { error: "Your token is kaput." } }
    });

    renderWithRouter(<VerifyEmailPage />, { initialEntries: [`/verify-email?token=${mockToken}`] });

    // Check for loading state
    expect(screen.getByTestId('icon-spinner')).toBeInTheDocument();

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Your token is kaput./i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('icon-times-circle')).toBeInTheDocument();
    expect(screen.getByText(/Verification Failed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Login/i })).toHaveAttribute('href', '/login');
    expect(api.get).toHaveBeenCalledWith(`/api/auth/verify-email?token=${mockToken}`);
  });

  test('displays a generic error message if API call fails without specific error data', async () => {
    const mockToken = 'another-token';
    api.get.mockRejectedValueOnce(new Error("Network Error")); // Generic error

    renderWithRouter(<VerifyEmailPage />, { initialEntries: [`/verify-email?token=${mockToken}`] });

    expect(screen.getByTestId('icon-spinner')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Failed to verify email. The token might be invalid or expired./i)).toBeInTheDocument();
    });
    expect(screen.getByTestId('icon-times-circle')).toBeInTheDocument();
  });
});
