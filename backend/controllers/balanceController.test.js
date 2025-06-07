const balanceController = require('./balanceController');
const UserBalance = require('../models/UserBalance');
const WithdrawalRequest = require('../models/WithdrawalRequest');

jest.mock('../models/UserBalance');
jest.mock('../models/WithdrawalRequest');

describe('Balance Controller', () => {
  let mockReq, mockRes;

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
    jest.clearAllMocks();
  });

  describe('getUserBalance', () => {
    it('should return user balance successfully', async () => {
      UserBalance.getOrCreateByUserId.mockResolvedValueOnce({ balance: '123.45' });
      await balanceController.getUserBalance(mockReq, mockRes);
      expect(UserBalance.getOrCreateByUserId).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith({ balance: '123.45' });
    });

    it('should handle errors when fetching balance', async () => {
      UserBalance.getOrCreateByUserId.mockRejectedValueOnce(new Error('DB error'));
      await balanceController.getUserBalance(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch balance.' });
    });
  });

  describe('requestWithdrawal', () => {
    it('should submit withdrawal request successfully', async () => {
      mockReq.body = { amount: '50.00', paymentDetails: 'PayPal: test@example.com' };
      const mockResult = { request: { id: 1 }, newBalance: '73.45' };
      WithdrawalRequest.createRequest.mockResolvedValueOnce(mockResult);

      await balanceController.requestWithdrawal(mockReq, mockRes);

      expect(WithdrawalRequest.createRequest).toHaveBeenCalledWith({
        userId: 1,
        amount: '50.00',
        paymentDetails: 'PayPal: test@example.com',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Withdrawal request submitted successfully.',
        requestId: 1,
        newBalance: '73.45',
      });
    });

    it('should return 400 for invalid amount', async () => {
      mockReq.body = { amount: '-10', paymentDetails: 'Test' };
      await balanceController.requestWithdrawal(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid withdrawal amount.' });
    });

    it('should return 400 for missing payment details', async () => {
      mockReq.body = { amount: '10' };
      await balanceController.requestWithdrawal(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Payment details are required and must be a non-empty string.' });
    });

    it('should return 400 for amount below minimum (e.g. $1.00)', async () => {
      mockReq.body = { amount: '0.50', paymentDetails: 'Test' };
      await balanceController.requestWithdrawal(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Minimum withdrawal amount is $1.00.' });
    });


    it('should return 400 for insufficient balance', async () => {
      mockReq.body = { amount: '50.00', paymentDetails: 'Test' };
      WithdrawalRequest.createRequest.mockRejectedValueOnce(new Error('Insufficient balance.'));
      await balanceController.requestWithdrawal(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient balance.' });
    });

    it('should return 500 for other errors during request creation', async () => {
      mockReq.body = { amount: '50.00', paymentDetails: 'Test' };
      WithdrawalRequest.createRequest.mockRejectedValueOnce(new Error('Some DB Error'));
      await balanceController.requestWithdrawal(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to submit withdrawal request.' });
    });
  });

  describe('getUserWithdrawalRequests', () => {
    it('should return user withdrawal requests successfully', async () => {
      const mockRequests = [{ id: 1, amount: '50.00' }];
      WithdrawalRequest.getByUserId.mockResolvedValueOnce(mockRequests);
      await balanceController.getUserWithdrawalRequests(mockReq, mockRes);
      expect(WithdrawalRequest.getByUserId).toHaveBeenCalledWith(1);
      expect(mockRes.json).toHaveBeenCalledWith(mockRequests);
    });

    it('should handle errors when fetching requests', async () => {
      WithdrawalRequest.getByUserId.mockRejectedValueOnce(new Error('DB error'));
      await balanceController.getUserWithdrawalRequests(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch withdrawal requests.' });
    });
  });
});
