import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import WithdrawalPage from './WithdrawalPage';
import api from '../utils/api';
import { AuthContext } from "../contexts/AuthContext";
import { balanceEventEmitter } from '../components/UserBalanceDisplay'; // Import emitter

jest.mock('../utils/api');
jest.mock('../components/UserBalanceDisplay', () => ({
  ...jest.requireActual('../components/UserBalanceDisplay'), // Keep actual event emitter
  __esModule: true,
  default: () => <div data-testid="user-balance-display">MockBalanceDisplay</div>,
}));

const mockUser = { id: 1, role: 'user' };

const renderWithdrawalPage = () => {
  return render(
    <Router>
      <AuthContext.Provider value={{ currentUser: mockUser, loading: false }}>
        <WithdrawalPage />
      </AuthContext.Provider>
    </Router>
  );
};

describe('WithdrawalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/api/balance/withdrawals') return Promise.resolve({ data: [] });
      if (url === '/api/balance') return Promise.resolve({ data: { balance: '200.00' } }); // For local balance check
      return Promise.reject(new Error(`Unknown API GET url: ${url}`));
    });
    balanceEventEmitter.emit = jest.fn(); // Mock emit function
  });

  test('renders UserBalanceDisplay and withdrawal form elements', async () => {
    renderWithdrawalPage();
    await waitFor(() => expect(screen.getByTestId('user-balance-display')).toBeInTheDocument());
    expect(screen.getByLabelText(/Amount to Withdraw/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Payment Details/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Withdrawal Request/i })).toBeInTheDocument();
  });

  test('fetches and displays past withdrawal requests', async () => {
    const mockRequests = [
      { id: 1, requested_at: new Date().toISOString(), amount: '50.00', user_payment_details: 'PayPal: one@test.com', status: 'pending', admin_notes: null, processed_at: null },
      { id: 2, requested_at: new Date().toISOString(), amount: '25.00', user_payment_details: 'Bank: 123', status: 'processed', admin_notes: 'Done', processed_at: new Date().toISOString() },
    ];
    api.get.mockImplementation((url) => {
      if (url === '/api/balance/withdrawals') return Promise.resolve({ data: mockRequests });
      if (url === '/api/balance') return Promise.resolve({ data: { balance: '200.00' } });
      return Promise.reject(new Error(`Unknown API GET url: ${url}`));
    });

    renderWithdrawalPage();

    await waitFor(() => {
      expect(screen.getByText('PayPal: one@test.com')).toBeInTheDocument();
      expect(screen.getByText('Bank: 123')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('processed')).toBeInTheDocument();
    });
  });

  test('handles error when fetching past requests', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/api/balance/withdrawals') return Promise.reject({response: {data: {error: 'Failed to load history.'}}});
      if (url === '/api/balance') return Promise.resolve({ data: { balance: '200.00' } });
      return Promise.reject(new Error(`Unknown API GET url: ${url}`));
    });
    renderWithdrawalPage();
    await waitFor(() => {
      expect(screen.getByText('Failed to load withdrawal history.')).toBeInTheDocument();
    });
  });

  describe('Submit Withdrawal Request Form', () => {
    test('client-side validation for amount and paymentDetails', async () => {
      renderWithdrawalPage();
      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/balance')); // Wait for initial balance fetch

      const submitButton = screen.getByRole('button', { name: /Submit Withdrawal Request/i });

      // Invalid amount
      fireEvent.change(screen.getByLabelText(/Amount to Withdraw/i), { target: { value: '-10' } });
      fireEvent.change(screen.getByLabelText(/Payment Details/i), { target: { value: 'Details' } });
      fireEvent.click(submitButton);
      expect(await screen.findByText(/Please enter a valid positive amount./i)).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();

      // Empty paymentDetails
      fireEvent.change(screen.getByLabelText(/Amount to Withdraw/i), { target: { value: '20' } });
      fireEvent.change(screen.getByLabelText(/Payment Details/i), { target: { value: '  ' } }); // Empty
      fireEvent.click(submitButton);
      expect(await screen.findByText(/Please provide your payment details./i)).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();

      // Amount exceeds balance (local check)
      fireEvent.change(screen.getByLabelText(/Amount to Withdraw/i), { target: { value: '300.00' } }); // Balance is 200.00
      fireEvent.change(screen.getByLabelText(/Payment Details/i), { target: { value: 'Valid details' } });
      fireEvent.click(submitButton);
      expect(await screen.findByText(/Withdrawal amount cannot exceed your current balance./i)).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();

    });

    test('successful submission', async () => {
      api.post.mockResolvedValueOnce({ data: { message: 'Request submitted!', requestId: 3, newBalance: '150.00' } });
      api.get.mockImplementation((url) => { // For refetching requests
          if (url === '/api/balance/withdrawals') return Promise.resolve({ data: [] }); // Initial empty, then refetched
          if (url === '/api/balance') return Promise.resolve({ data: { balance: '200.00' } });
          return Promise.reject(new Error(`Unknown API GET url: ${url}`));
      });

      renderWithdrawalPage();
      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/balance'));


      fireEvent.change(screen.getByLabelText(/Amount to Withdraw/i), { target: { value: '50.00' } });
      fireEvent.change(screen.getByLabelText(/Payment Details/i), { target: { value: 'PayPal: new@test.com' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit Withdrawal Request/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/balance/withdraw', {
          amount: 50.00,
          paymentDetails: 'PayPal: new@test.com',
        });
      });
      expect(await screen.findByText('Request submitted!')).toBeInTheDocument();
      expect(balanceEventEmitter.emit).toHaveBeenCalled();
      expect(api.get).toHaveBeenCalledWith('/api/balance/withdrawals'); // For refetch
    });

    test('API error on submission (e.g. insufficient balance from backend)', async () => {
      api.post.mockRejectedValueOnce({ response: { data: { error: 'Backend: Insufficient balance.' } } });
      renderWithdrawalPage();
      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/balance'));


      fireEvent.change(screen.getByLabelText(/Amount to Withdraw/i), { target: { value: '250.00' } }); // More than balance
      fireEvent.change(screen.getByLabelText(/Payment Details/i), { target: { value: 'Bank: 789' } });
      fireEvent.click(screen.getByRole('button', { name: /Submit Withdrawal Request/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
      expect(await screen.findByText('Backend: Insufficient balance.')).toBeInTheDocument();
      expect(balanceEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
