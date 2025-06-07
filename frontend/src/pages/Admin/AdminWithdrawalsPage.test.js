import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import AdminWithdrawalsPage from './AdminWithdrawalsPage';
import api from '../../utils/api';
import { AuthContext } from '../../contexts/AuthContext'; // Assuming admin role check might be here or in a route guard

jest.mock('../../utils/api');
global.prompt = jest.fn(); // Mock window.prompt

const mockAdminUser = { id: 99, role: 'admin' };

const renderAdminWithdrawalsPage = () => {
  return render(
    <Router>
      <AuthContext.Provider value={{ currentUser: mockAdminUser, loading: false }}>
        <AdminWithdrawalsPage />
      </AuthContext.Provider>
    </Router>
  );
};

describe('AdminWithdrawalsPage', () => {
  const mockRequests = [
    { id: 1, user_email: 'user1@example.com', amount: '100.00', user_payment_details: 'PayPal: user1', status: 'pending', requested_at: new Date().toISOString(), admin_notes: null, processed_at: null, processed_by_email: null },
    { id: 2, user_email: 'user2@example.com', amount: '50.00', user_payment_details: 'Bank: user2', status: 'approved', requested_at: new Date().toISOString(), admin_notes: 'OK', processed_at: null, processed_by_email: null },
    { id: 3, user_email: 'user3@example.com', amount: '75.00', user_payment_details: 'PayPal: user3', status: 'processed', requested_at: new Date().toISOString(), admin_notes: 'Done', processed_at: new Date().toISOString(), processed_by_email: 'admin@example.com' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: mockRequests }); // Default mock for initial fetch
    prompt.mockClear();
  });

  test('fetches and displays withdrawal requests on mount', async () => {
    renderAdminWithdrawalsPage();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/admin/financials/withdrawal-requests');
    });
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  test('filters requests when status filter changes', async () => {
    renderAdminWithdrawalsPage();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1)); // Initial fetch

    const filterSelect = screen.getByLabelText(/Filter by status/i);
    fireEvent.change(filterSelect, { target: { value: 'pending' } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/admin/financials/withdrawal-requests?status=pending');
    });
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('displays table headers correctly', async () => {
    renderAdminWithdrawalsPage();
    await waitFor(() => expect(screen.getByText('user1@example.com')).toBeInTheDocument()); // Wait for data
    const expectedHeaders = ['Req. ID', 'User Email', 'Amount ($)', 'Payment Details', 'Status', 'Date Requested', 'Admin Notes', 'Date Processed', 'Processed By', 'Actions'];
    expectedHeaders.forEach(header => {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    });
  });

  describe('Update Status Actions', () => {
    test('approves a pending request', async () => {
      renderAdminWithdrawalsPage();
      await waitFor(() => expect(screen.getByText('user1@example.com')).toBeInTheDocument());

      const approveButton = screen.getAllByRole('button', { name: /Approve/i })[0]; // Assuming first one is for pending
      prompt.mockReturnValueOnce(''); // No admin notes
      api.put.mockResolvedValueOnce({ data: { message: 'Status updated' } });

      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/api/admin/financials/withdrawal-requests/1', {
          status: 'approved',
          adminNotes: '',
        });
      });
      expect(screen.getByText(/Status updated successfully!/i)).toBeInTheDocument(); // Success message
      expect(api.get).toHaveBeenCalledTimes(2); // Initial fetch + refetch after update
    });

    test('declines a pending request with notes', async () => {
      renderAdminWithdrawalsPage();
      await waitFor(() => expect(screen.getByText('user1@example.com')).toBeInTheDocument());

      const declineButton = screen.getAllByRole('button', { name: /Decline/i })[0];
      prompt.mockReturnValueOnce('Incorrect details'); // Admin provides notes
      api.put.mockResolvedValueOnce({ data: { message: 'Status updated' } });

      fireEvent.click(declineButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/api/admin/financials/withdrawal-requests/1', {
          status: 'declined',
          adminNotes: 'Incorrect details',
        });
      });
      expect(screen.getByText(/Status updated successfully!/i)).toBeInTheDocument();
    });

    test('marks an approved request as processed', async () => {
      renderAdminWithdrawalsPage();
      await waitFor(() => expect(screen.getByText('user2@example.com')).toBeInTheDocument()); // Wait for request with ID 2 (approved)

      const processButton = screen.getAllByRole('button', { name: /Processed/i })[0];
      prompt.mockReturnValueOnce('Payment sent via PayPal');
      api.put.mockResolvedValueOnce({ data: { message: 'Status updated' } });

      fireEvent.click(processButton);

      await waitFor(() => {
        expect(api.put).toHaveBeenCalledWith('/api/admin/financials/withdrawal-requests/2', {
          status: 'processed',
          adminNotes: 'Payment sent via PayPal',
        });
      });
      expect(screen.getByText(/Status updated successfully!/i)).toBeInTheDocument();
    });

    test('handles API error on status update', async () => {
      renderAdminWithdrawalsPage();
      await waitFor(() => expect(screen.getByText('user1@example.com')).toBeInTheDocument());

      const approveButton = screen.getAllByRole('button', { name: /Approve/i })[0];
      prompt.mockReturnValueOnce('');
      api.put.mockRejectedValueOnce({ response: { data: { error: 'Update failed' } } });

      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(screen.getByText(/Update failed/i)).toBeInTheDocument();
      });
    });
  });
});
