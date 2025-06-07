const adminController = require('./adminController');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const { insertAdminLog } = require('../utils/adminLogger'); // Actual or mock

jest.mock('../models/WithdrawalRequest');
jest.mock('../utils/adminLogger'); // Mock admin logger

describe('Admin Controller - Withdrawal Management', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      user: { id: 99, role: 'admin' }, // Mock authenticated admin user
      body: {},
      params: {},
      query: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe('getWithdrawalRequests', () => {
    it('should fetch all withdrawal requests if no status filter is provided', async () => {
      const mockRequests = [{ id: 1, amount: '100' }, { id: 2, amount: '200' }];
      WithdrawalRequest.getAll.mockResolvedValueOnce(mockRequests);

      await adminController.getWithdrawalRequests(mockReq, mockRes);

      expect(WithdrawalRequest.getAll).toHaveBeenCalledTimes(1);
      expect(WithdrawalRequest.getByStatus).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockRequests);
    });

    it('should fetch withdrawal requests by status if status filter is provided', async () => {
      mockReq.query = { status: 'pending' };
      const mockPendingRequests = [{ id: 1, amount: '100', status: 'pending' }];
      WithdrawalRequest.getByStatus.mockResolvedValueOnce(mockPendingRequests);

      await adminController.getWithdrawalRequests(mockReq, mockRes);

      expect(WithdrawalRequest.getByStatus).toHaveBeenCalledWith('pending');
      expect(WithdrawalRequest.getAll).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(mockPendingRequests);
    });

    it('should handle errors when fetching withdrawal requests', async () => {
      WithdrawalRequest.getAll.mockRejectedValueOnce(new Error('DB Error'));
      await adminController.getWithdrawalRequests(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch withdrawal requests.' });
    });
  });

  describe('updateWithdrawalRequestStatus', () => {
    const requestId = '1';
    const adminNotes = 'Approved by admin';
    const mockUpdatedRequest = { id: 1, status: 'approved', admin_notes: adminNotes, user_id: 10 };

    it('should update withdrawal request status successfully', async () => {
      mockReq.params = { requestId };
      mockReq.body = { status: 'approved', adminNotes };
      WithdrawalRequest.updateStatus.mockResolvedValueOnce(mockUpdatedRequest);
      insertAdminLog.mockResolvedValueOnce({}); // Mock logger

      await adminController.updateWithdrawalRequestStatus(mockReq, mockRes);

      expect(WithdrawalRequest.updateStatus).toHaveBeenCalledWith({
        requestId: 1,
        newStatus: 'approved',
        adminId: mockReq.user.id,
        adminNotes,
      });
      expect(insertAdminLog).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Withdrawal request status updated.',
        request: mockUpdatedRequest,
      });
    });

    it('should return 400 for invalid status', async () => {
      mockReq.params = { requestId };
      mockReq.body = { status: 'invalid_status' };

      await adminController.updateWithdrawalRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid status provided. Must be one of: approved, processed, declined.' });
    });

    it('should return 404 if request not found', async () => {
      mockReq.params = { requestId };
      mockReq.body = { status: 'approved' };
      WithdrawalRequest.updateStatus.mockRejectedValueOnce(new Error('Withdrawal request not found.'));

      await adminController.updateWithdrawalRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Withdrawal request not found.' });
    });

    it('should return 500 if UserBalance.credit fails during a decline (simulated by a generic error)', async () => {
      mockReq.params = { requestId };
      mockReq.body = { status: 'declined', adminNotes: 'Insufficient proof' };
      WithdrawalRequest.updateStatus.mockRejectedValueOnce(new Error('Insufficient balance.')); // Simulating UserBalance.credit error message

      await adminController.updateWithdrawalRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Balance update failed during status change: Insufficient balance.' });
    });

    it('should return 500 for other errors during status update', async () => {
      mockReq.params = { requestId };
      mockReq.body = { status: 'approved' };
      WithdrawalRequest.updateStatus.mockRejectedValueOnce(new Error('Some DB Error'));

      await adminController.updateWithdrawalRequestStatus(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to update withdrawal request status.' });
    });
  });
});
