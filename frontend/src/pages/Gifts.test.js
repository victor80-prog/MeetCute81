import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from 'react-router-dom'; // Needed for <Link> if any, or context providers
import Gifts from './Gifts';
import api from '../utils/api';
import { AuthContext } from "../contexts/AuthContext";
import { SubscriptionContext } from "../contexts/SubscriptionContext";
import { balanceEventEmitter } from '../components/UserBalanceDisplay';

jest.mock('../utils/api');
jest.mock('../components/UserBalanceDisplay', () => ({
  ...jest.requireActual('../components/UserBalanceDisplay'), // Keep actual event emitter
  __esModule: true,
  default: () => <div data-testid="user-balance-display">MockBalanceDisplay</div>, // Mock the component itself
}));


// Mock window.confirm and window.alert
global.confirm = jest.fn();
global.alert = jest.fn();

const mockUser = { id: 1, role: 'user', name: 'Test User' };
const mockSubscription = { tier_level: 'Premium' };

const renderGiftsPage = (user = mockUser, subscription = mockSubscription) => {
  return render(
    <Router>
      <AuthContext.Provider value={{ currentUser: user, loading: false }}>
        <SubscriptionContext.Provider value={{ subscription: subscription, isLoading: false }}>
          <Gifts />
        </SubscriptionContext.Provider>
      </AuthContext.Provider>
    </Router>
  );
};

describe('Gifts Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/gifts/items') return Promise.resolve({ data: [] });
      if (url === '/gifts/received') return Promise.resolve({ data: [] });
      if (url === '/gifts/sent') return Promise.resolve({ data: [] });
      if (url === '/api/balance') return Promise.resolve({ data: { balance: '100.00' } }); // Mock balance for send gift
      return Promise.reject(new Error(`Unknown API GET url: ${url}`));
    });
    balanceEventEmitter.emit = jest.fn(); // Mock emit function for spying
  });

  describe('Redemption Logic', () => {
    const mockReceivedGifts = [
      { id: 1, name: 'Rose', is_redeemed: false, original_purchase_price: '10.00', redeemed_value: null, redeemed_at: null, image_url: '', required_tier_level: 'Basic', sender_name: 'User A', message: 'For you', created_at: new Date().toISOString() },
      { id: 2, name: 'Diamond Ring', is_redeemed: true, original_purchase_price: '100.00', redeemed_value: '73.00', redeemed_at: new Date().toISOString(), image_url: '', required_tier_level: 'Premium', sender_name: 'User B', message: 'Big one', created_at: new Date().toISOString() },
      { id: 3, name: 'Watch', is_redeemed: false, original_purchase_price: '50.00', redeemed_value: null, redeemed_at: null, image_url: '', required_tier_level: 'Elite', sender_name: 'User C', message: 'Time flies', created_at: new Date().toISOString() },
    ];

    test('displays redeem button for unredeemed gifts with price, and status for redeemed', async () => {
      api.get.mockImplementation(url => {
        if (url === '/gifts/received') return Promise.resolve({ data: mockReceivedGifts });
        return Promise.resolve({ data: [] });
      });
      renderGiftsPage();
      fireEvent.click(screen.getByText(/Received Gifts/i));

      await waitFor(() => {
        expect(screen.getByText('Rose')).toBeInTheDocument();
      });

      // Gift 1 (Redeemable)
      const redeemButtonRose = screen.getByRole('button', { name: /Redeem for \$7.30/i }); // 10.00 * 0.73
      expect(redeemButtonRose).toBeInTheDocument();

      // Gift 2 (Redeemed)
      expect(screen.getByText(/Redeemed for \$73.00/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Redeem for/i, exact: false })).not.toContainEqual(
        screen.queryByText(/Redeemed for \$73.00/i)?.closest('div')?.querySelector('button') // ensure we are not picking up other buttons
      );


      // Gift 3 (Redeemable)
      const redeemButtonWatch = screen.getByRole('button', { name: /Redeem for \$36.50/i }); // 50.00 * 0.73
      expect(redeemButtonWatch).toBeInTheDocument();
    });

    test('handles successful gift redemption', async () => {
      api.get.mockResolvedValueOnce({ data: mockReceivedGifts.filter(g => g.id === 1) }); // Only gift 1 for simplicity
      api.post.mockResolvedValueOnce({ data: { message: 'Gift redeemed!', redeemedAmount: '7.30' } });
      confirm.mockReturnValueOnce(true); // User confirms redemption

      renderGiftsPage();
      fireEvent.click(screen.getByText(/Received Gifts/i));

      let redeemButton;
      await waitFor(() => {
        redeemButton = screen.getByRole('button', { name: /Redeem for \$7.30/i });
      });

      fireEvent.click(redeemButton);

      expect(confirm).toHaveBeenCalledWith('Are you sure you want to redeem this gift for $7.30? This action cannot be undone.');

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/gifts/received/1/redeem');
      });
      expect(balanceEventEmitter.emit).toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Gift redeemed!');
      await waitFor(() => {
        expect(screen.getByText(/Redeemed for \$7.30/i)).toBeInTheDocument(); // Check for updated UI
      });
    });

    test('handles failed gift redemption', async () => {
      api.get.mockResolvedValueOnce({ data: mockReceivedGifts.filter(g => g.id === 1) });
      api.post.mockRejectedValueOnce({ response: { data: { error: 'Redemption failed' } } });
      confirm.mockReturnValueOnce(true);

      renderGiftsPage();
      fireEvent.click(screen.getByText(/Received Gifts/i));

      let redeemButton;
      await waitFor(() => {
        redeemButton = screen.getByRole('button', { name: /Redeem for \$7.30/i });
      });
      fireEvent.click(redeemButton);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/gifts/received/1/redeem');
      });
      expect(balanceEventEmitter.emit).not.toHaveBeenCalled(); // Not called on failure
      expect(screen.getByText(/Redemption failed/i)).toBeInTheDocument(); // Error message shown
    });
  });

  describe('Use Balance for Sending Gift', () => {
    const mockGiftItems = [{ id: 1, name: 'Test Gift', price: '50.00', required_tier_level: 'Basic', image_url: '', description: 'A test gift' }];

    beforeEach(() => {
        api.get.mockImplementation((url) => {
            if (url === '/gifts/items') return Promise.resolve({ data: mockGiftItems });
            if (url === '/api/balance') return Promise.resolve({ data: { balance: '100.00' } }); // User has $100 balance
            return Promise.resolve({ data: [] });
        });
    });

    test('shows "Use site balance" checkbox and defaults to checked if balance is sufficient', async () => {
      renderGiftsPage();
      fireEvent.click(screen.getByText(/Available Gifts/i)); // Switch to available gifts tab

      await waitFor(() => { // Wait for gifts to load
        fireEvent.click(screen.getByText('Test Gift')); // Click to select gift, opening modal
      });

      await waitFor(() => { // Wait for modal to render and balance to be checked
        const checkbox = screen.getByLabelText(/\$100.00/i); // Checkbox label includes balance
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).toBeChecked();
        expect(screen.getByRole('button', {name: /Send Gift \(from Balance: \$50.00\)/i})).toBeInTheDocument();
      });
    });

    test('sends with useSiteBalance: true when checkbox is checked', async () => {
      renderGiftsPage();
      fireEvent.click(screen.getByText(/Available Gifts/i));
      await waitFor(() => fireEvent.click(screen.getByText('Test Gift'))); // Open modal

      // Fill recipient ID
      await waitFor(() => {
        fireEvent.change(screen.getByPlaceholderText(/Recipient User ID/i), { target: { value: 'user123' } });
      });

      // Ensure checkbox is checked (should be by default)
      const checkbox = screen.getByLabelText(/\$100.00/i);
      expect(checkbox).toBeChecked();

      api.post.mockResolvedValueOnce({ data: { message: 'Gift sent' } }); // Mock send gift API
      fireEvent.click(screen.getByRole('button', { name: /Send Gift \(from Balance: \$50.00\)/i }));

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/gifts/send', expect.objectContaining({
          useSiteBalance: true,
          giftItemId: 1,
          recipientId: 'user123'
        }));
      });
      expect(balanceEventEmitter.emit).toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith('Gift sent successfully!');
    });

    test('sends with useSiteBalance: false when checkbox is unchecked', async () => {
      renderGiftsPage();
      fireEvent.click(screen.getByText(/Available Gifts/i));
      await waitFor(() => fireEvent.click(screen.getByText('Test Gift')));

      await waitFor(() => { // Ensure checkbox is present before unchecking
        const checkbox = screen.getByLabelText(/\$100.00/i);
        fireEvent.click(checkbox); // Uncheck it
        expect(checkbox).not.toBeChecked();
      });

      // Fill recipient ID
      fireEvent.change(screen.getByPlaceholderText(/Recipient User ID/i), { target: { value: 'user123' } });


      api.post.mockResolvedValueOnce({ data: { message: 'Gift sent' } });
      fireEvent.click(screen.getByRole('button', { name: /Send Gift \(\$50.00\)/i })); // Text changes when balance not used

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/gifts/send', expect.objectContaining({
          useSiteBalance: false,
          giftItemId: 1,
          recipientId: 'user123'
        }));
      });
      expect(balanceEventEmitter.emit).not.toHaveBeenCalled(); // Not called if balance not used
      expect(alert).toHaveBeenCalledWith('Gift sent successfully!');
    });
  });
});
