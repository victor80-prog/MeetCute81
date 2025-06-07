const WithdrawalRequest = require('./WithdrawalRequest');
const UserBalance = require('./UserBalance');
const pool = require('../config/db');

jest.mock('../config/db', () => {
  const actualPool = jest.requireActual('../config/db');
  return {
    ...actualPool,
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  };
});
jest.mock('./UserBalance');

describe('WithdrawalRequest Model', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockReturnValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    const userId = 1;
    const amount = '50.00';
    const paymentDetails = 'PayPal: test@example.com';
    const mockNewBalance = { balance: '150.00' };
    const mockRequest = { id: 1, user_id: userId, amount, user_payment_details: paymentDetails, status: 'pending' };

    it('should create a withdrawal request and debit balance if balance is sufficient', async () => {
      UserBalance.debit.mockResolvedValueOnce(mockNewBalance);
      mockClient.query.mockResolvedValueOnce({ rows: [mockRequest] }); // For INSERT

      const result = await WithdrawalRequest.createRequest({ userId, amount, paymentDetails });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(UserBalance.debit).toHaveBeenCalledWith(userId, parseFloat(amount), mockClient);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO withdrawal_requests'),
        [userId, parseFloat(amount), paymentDetails]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual({ request: mockRequest, newBalance: mockNewBalance.balance });
    });

    it('should throw error and rollback if balance is insufficient', async () => {
      UserBalance.debit.mockRejectedValueOnce(new Error('Insufficient balance.'));

      await expect(
        WithdrawalRequest.createRequest({ userId, amount, paymentDetails })
      ).rejects.toThrow('Insufficient balance.');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(UserBalance.debit).toHaveBeenCalledWith(userId, parseFloat(amount), mockClient);
      expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO withdrawal_requests'));
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('updateStatus', () => {
    const requestId = 1;
    const adminId = 99;
    const adminNotes = 'Processed by admin.';
    const mockPendingRequest = { id: requestId, user_id: 1, amount: '50.00', status: 'pending' };
    const mockApprovedRequest = { id: requestId, user_id: 1, amount: '50.00', status: 'approved' };


    it('should update status to processed, not credit balance', async () => {
      // getById is called internally by updateStatus
      WithdrawalRequest.getById = jest.fn().mockResolvedValueOnce(mockApprovedRequest); // Mock static method within the class
      mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockApprovedRequest, status: 'processed', admin_notes: adminNotes }] }); // For UPDATE

      await WithdrawalRequest.updateStatus({ requestId, newStatus: 'processed', adminId, adminNotes });

      expect(WithdrawalRequest.getById).toHaveBeenCalledWith(requestId, mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(UserBalance.credit).not.toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE withdrawal_requests'),
        ['processed', adminNotes, adminId, requestId]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      WithdrawalRequest.getById.mockRestore();
    });

    it('should update status to declined from pending, and credit balance', async () => {
      WithdrawalRequest.getById = jest.fn().mockResolvedValueOnce(mockPendingRequest);
      mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockPendingRequest, status: 'declined' }] }); // For UPDATE
      UserBalance.credit.mockResolvedValueOnce({ balance: '100.00' });

      await WithdrawalRequest.updateStatus({ requestId, newStatus: 'declined', adminId });

      expect(WithdrawalRequest.getById).toHaveBeenCalledWith(requestId, mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(UserBalance.credit).toHaveBeenCalledWith(mockPendingRequest.user_id, parseFloat(mockPendingRequest.amount), mockClient);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE withdrawal_requests'),
        ['declined', null, adminId, requestId] // adminNotes is null by default
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      WithdrawalRequest.getById.mockRestore();
    });

    it('should update status to declined from approved, and credit balance', async () => {
      WithdrawalRequest.getById = jest.fn().mockResolvedValueOnce(mockApprovedRequest);
      mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockApprovedRequest, status: 'declined' }] });
      UserBalance.credit.mockResolvedValueOnce({ balance: '100.00' });

      await WithdrawalRequest.updateStatus({ requestId, newStatus: 'declined', adminId });

      expect(WithdrawalRequest.getById).toHaveBeenCalledWith(requestId, mockClient);
      expect(UserBalance.credit).toHaveBeenCalledWith(mockApprovedRequest.user_id, parseFloat(mockApprovedRequest.amount), mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      WithdrawalRequest.getById.mockRestore();
    });


    it('should not credit balance if declining an already processed request', async () => {
      const mockProcessedRequest = { id: requestId, user_id: 1, amount: '50.00', status: 'processed' };
      WithdrawalRequest.getById = jest.fn().mockResolvedValueOnce(mockProcessedRequest);
      mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockProcessedRequest, status: 'declined' }] });

      await WithdrawalRequest.updateStatus({ requestId, newStatus: 'declined', adminId });

      expect(WithdrawalRequest.getById).toHaveBeenCalledWith(requestId, mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(UserBalance.credit).not.toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      WithdrawalRequest.getById.mockRestore();
    });

    it('should throw error if request not found', async () => {
      WithdrawalRequest.getById = jest.fn().mockResolvedValueOnce(undefined); // Request not found

      await expect(
        WithdrawalRequest.updateStatus({ requestId, newStatus: 'processed', adminId })
      ).rejects.toThrow('Withdrawal request not found.');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      WithdrawalRequest.getById.mockRestore();
    });
  });
});
