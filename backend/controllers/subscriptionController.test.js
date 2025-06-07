const subscriptionController = require('./subscriptionController');
const Subscription = require('../models/Subscription');
const UserBalance = require('../models/UserBalance');
const pool = require('../config/db'); // Required for transaction client mocking

jest.mock('../models/Subscription');
jest.mock('../models/UserBalance');
jest.mock('../config/db', () => { // Mock db to control client behavior
  const actualPool = jest.requireActual('../config/db');
  return {
    ...actualPool,
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  };
});

describe('Subscription Controller', () => {
  let mockReq, mockRes, mockClient;

  beforeEach(() => {
    mockReq = {
      user: { id: 1 }, // Mock authenticated user
      body: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockClient = { // Mock client object that connect returns
        query: jest.fn(),
        release: jest.fn(),
    };
    pool.connect.mockReturnValue(mockClient); // Ensure connect returns our mockClient
    jest.clearAllMocks();
  });

  describe('purchaseWithBalance', () => {
    const packageId = 1;
    const mockPackage = { id: packageId, name: 'Premium Plan', price: '20.00' };
    const mockUserSubscription = { id: 1, package_id: packageId, status: 'active' };

    it('should purchase subscription with balance successfully', async () => {
      mockReq.body = { packageId };
      Subscription.getPackageById.mockResolvedValueOnce(mockPackage);
      UserBalance.debit.mockResolvedValueOnce({ balance: '80.00' }); // Assume debit is successful
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] }); // Mock transaction insert RETURNING id
      Subscription._activateSubscriptionWorkflow.mockResolvedValueOnce(mockUserSubscription.id); // Mock activation
      Subscription.getUserSubscription.mockResolvedValueOnce(mockUserSubscription); // For final response

      await subscriptionController.purchaseWithBalance(mockReq, mockRes);

      expect(Subscription.getPackageById).toHaveBeenCalledWith(packageId);
      expect(UserBalance.debit).toHaveBeenCalledWith(mockReq.user.id, parseFloat(mockPackage.price), mockClient);
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO transactions'), expect.any(Array));
      expect(Subscription._activateSubscriptionWorkflow).toHaveBeenCalledWith(mockClient, {
        userId: mockReq.user.id,
        packageId,
        originalTransactionId: 100, // from RETURNING id
        paymentMethodNameForLog: 'Site Balance',
      });
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Subscription purchased successfully with site balance.',
        subscription: mockUserSubscription,
      });
    });

    it('should return 404 if package not found', async () => {
      mockReq.body = { packageId };
      Subscription.getPackageById.mockResolvedValueOnce(null);

      await subscriptionController.purchaseWithBalance(mockReq, mockRes);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK'); // Ensure rollback if package not found
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Subscription package not found.' });
    });

    it('should return 400 for insufficient balance', async () => {
      mockReq.body = { packageId };
      Subscription.getPackageById.mockResolvedValueOnce(mockPackage);
      UserBalance.debit.mockRejectedValueOnce(new Error('Insufficient balance.'));

      await subscriptionController.purchaseWithBalance(mockReq, mockRes);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient balance.' });
    });

    it('should return 500 for other errors during purchase', async () => {
      mockReq.body = { packageId };
      Subscription.getPackageById.mockResolvedValueOnce(mockPackage);
      UserBalance.debit.mockRejectedValueOnce(new Error('Some DB error')); // Generic error

      await subscriptionController.purchaseWithBalance(mockReq, mockRes);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to purchase subscription with balance.' });
    });
  });
});
