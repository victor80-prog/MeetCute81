import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserBalanceDisplay, { balanceEventEmitter } from './UserBalanceDisplay';
import api from '../utils/api';

jest.mock('../utils/api');

describe('UserBalanceDisplay', () => {
  afterEach(() => {
    jest.clearAllMocks();
    // Clear any listeners added during tests
    balanceEventEmitter.listeners = [];
  });

  test('renders loading state initially', () => {
    api.get.mockReturnValue(new Promise(() => {})); // Keep promise pending
    render(<UserBalanceDisplay />);
    expect(screen.getByText(/Loading balance.../i)).toBeInTheDocument();
  });

  test('fetches and displays balance successfully', async () => {
    api.get.mockResolvedValue({ data: { balance: '123.45' } });
    render(<UserBalanceDisplay />);

    await waitFor(() => {
      expect(screen.getByText(/\$123.45/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Balance:/i)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/balance');
  });

  test('displays error message on API failure', async () => {
    api.get.mockRejectedValue(new Error('API Error'));
    render(<UserBalanceDisplay />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load balance./i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Retry/i)).toBeInTheDocument(); // Check for retry button
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument(); // No balance amount shown
  });

  test('refetches balance when retry button is clicked after an error', async () => {
    api.get.mockRejectedValueOnce(new Error('API Error')); // First call fails
    render(<UserBalanceDisplay />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load balance./i)).toBeInTheDocument();
    });

    api.get.mockResolvedValueOnce({ data: { balance: '50.00' } }); // Second call succeeds
    const retryButton = screen.getByText(/Retry/i);
    act(() => {
      retryButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText(/\$50.00/i)).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledTimes(2); // Called once initially, once on retry
  });

  test('subscribes to and refetches balance on balanceEventEmitter emit', async () => {
    api.get.mockResolvedValueOnce({ data: { balance: '100.00' } });
    render(<UserBalanceDisplay />);

    await waitFor(() => {
      expect(screen.getByText(/\$100.00/i)).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledTimes(1);

    // Simulate another component emitting the event
    api.get.mockResolvedValueOnce({ data: { balance: '150.00' } }); // New balance value
    act(() => {
      balanceEventEmitter.emit();
    });

    await waitFor(() => {
      // Check if loading state appears briefly
      expect(screen.queryByText(/Loading balance.../i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/\$150.00/i)).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledTimes(2); // Called again after emit
  });

   test('unsubscribes from event emitter on unmount', async () => {
    api.get.mockResolvedValue({ data: { balance: '10.00' } });
    const { unmount } = render(<UserBalanceDisplay />);

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect(balanceEventEmitter.listeners.length).toBe(1);

    unmount();
    expect(balanceEventEmitter.listeners.length).toBe(0);
  });
});
