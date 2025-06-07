import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ConfirmSubscriptionPage from './ConfirmSubscriptionPage';
import api from '../utils/api';
import { AuthContext } from "../contexts/AuthContext";
import { SubscriptionContext } from "../contexts/SubscriptionContext";
import { balanceEventEmitter } from '../components/UserBalanceDisplay';

jest.mock('../utils/api');
jest.mock('../components/UserBalanceDisplay', () => ({
  ...jest.requireActual('../components/UserBalanceDisplay'),
  __esModule: true,
  default: () => <div data-testid="user-balance-display">MockBalanceDisplay</div>,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ packageId: '1' }), // Default mock packageId
}));

const mockUser = { id: 1, role: 'user', country_id: '1' };
const mockSubscriptionState = {
  subscription: null, // Or some existing subscription if testing upgrade/downgrade text
  isLoading: false,
  fetchSubscription: jest.fn(),
};

const mockPackage = {
  id: '1',
  name: 'Premium Plan',
  price: '20.00',
  tier_level: 'Premium',
  billing_interval: 'monthly',
  features: [{ name: 'Feature 1' }, { name: 'Feature 2' }],
};

const renderConfirmSubscriptionPage = (
  user = mockUser,
  subscriptionCtx = mockSubscriptionState,
  initialBalance = '100.00' // Default sufficient balance
) => {
  api.get.mockImplementation((url) => {
    if (url === `/subscription/packages/1`) return Promise.resolve({ data: mockPackage });
    if (url === '/api/balance') return Promise.resolve({ data: { balance: initialBalance } });
    if (url === '/countries') return Promise.resolve({ data: [{id: '1', name: 'Test Country'}] }); // Mock countries
    if (url.startsWith('/transactions/country/')) return Promise.resolve({data: []}); // Mock payment methods
    return Promise.reject(new Error(`Unknown API GET url: ${url}`));
  });
  balanceEventEmitter.emit = jest.fn();


  return render(
    <MemoryRouter initialEntries={['/subscribe/1']}> {/* Route matches useParams */}
      <AuthContext.Provider value={{ currentUser: user, authState: {isAuthenticated: !!user }, loading: false }}>
        <SubscriptionContext.Provider value={subscriptionCtx}>
          <Routes>
            <Route path="/subscribe/:packageId" element={<ConfirmSubscriptionPage />} />
            <Route path="/subscription/confirmation" element={<div>Generic Confirmation Page</div>} /> {/* Mock target page */}
          </Routes>
        </SubscriptionContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('ConfirmSubscriptionPage - Use Balance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubscriptionState.fetchSubscription.mockClear(); // Clear fetchSubscription mock
  });

  test('renders UserBalanceDisplay and package details', async () => {
    renderConfirmSubscriptionPage();
    await waitFor(() => {
      expect(screen.getByTestId('user-balance-display')).toBeInTheDocument();
      expect(screen.getByText(/Premium Plan/i)).toBeInTheDocument();
      expect(screen.getByText(/\$20.00/i)).toBeInTheDocument();
    });
  });

  test('shows "Use Balance to Subscribe" button if balance is sufficient', async () => {
    renderConfirmSubscriptionPage(mockUser, mockSubscriptionState, '30.00'); // Balance > package price
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Use Balance to Subscribe/i })).toBeInTheDocument();
    });
  });

  test('does not show "Use Balance" button or shows "insufficient" if balance is too low', async () => {
    renderConfirmSubscriptionPage(mockUser, mockSubscriptionState, '10.00'); // Balance < package price
    await waitFor(() => {
        expect(screen.getByText(/Your balance is insufficient for this package./i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Use Balance to Subscribe/i })).not.toBeInTheDocument();
  });

  test('successfully purchases with site balance', async () => {
    renderConfirmSubscriptionPage(mockUser, mockSubscriptionState, '50.00');
    api.post.mockResolvedValueOnce({ data: { message: 'Subscription successful via balance!', subscription: { package_name: 'Premium Plan', price: '20.00'} } });

    let useBalanceButton;
    await waitFor(() => {
      useBalanceButton = screen.getByRole('button', { name: /Use Balance to Subscribe/i });
    });
    fireEvent.click(useBalanceButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/subscriptions/purchase-with-balance', { packageId: '1' });
    });
    expect(balanceEventEmitter.emit).toHaveBeenCalled();
    expect(mockSubscriptionState.fetchSubscription).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/subscription/confirmation', {
      replace: true,
      state: {
        message: 'Subscription successful via balance!',
        type: 'success',
        packageName: 'Premium Plan',
        packagePrice: '20.00',
      },
    });
  });

  test('handles API error when purchasing with balance', async () => {
    renderConfirmSubscriptionPage(mockUser, mockSubscriptionState, '50.00');
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Balance purchase failed.' } } });

    let useBalanceButton;
    await waitFor(() => {
      useBalanceButton = screen.getByRole('button', { name: /Use Balance to Subscribe/i });
    });
    fireEvent.click(useBalanceButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/subscriptions/purchase-with-balance', { packageId: '1' });
    });
    expect(await screen.findByText(/Balance purchase failed./i)).toBeInTheDocument(); // Error message shown
    expect(balanceEventEmitter.emit).not.toHaveBeenCalled();
    expect(mockSubscriptionState.fetchSubscription).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Add a test to ensure the manual payment flow is still accessible
  test('manual payment section is still present', async () => {
    renderConfirmSubscriptionPage();
    await waitFor(() => {
      expect(screen.getByText(/OR PAY WITH/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Select your country for other payment methods:/i)).toBeInTheDocument();
    });
  });
});
