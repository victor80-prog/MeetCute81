const giftController = require('./giftController');
const Gift = require('../models/Gift');

jest.mock('../models/Gift');

describe('Gift Controller', () => {
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

  describe('sendGift', () => {
    it('should send a gift successfully', async () => {
      mockReq.body = { recipientId: 2, giftItemId: 1, message: 'Hi', isAnonymous: false, useSiteBalance: false };
      const mockSentGift = { id: 1, ...mockReq.body };
      Gift.sendGift.mockResolvedValueOnce(mockSentGift);

      await giftController.sendGift(mockReq, mockRes);

      expect(Gift.sendGift).toHaveBeenCalledWith({
        senderId: mockReq.user.id,
        recipientId: 2,
        giftItemId: 1,
        message: 'Hi',
        isAnonymous: false,
        useSiteBalance: false,
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockSentGift);
    });

    it('should send a gift successfully using site balance', async () => {
      mockReq.body = { recipientId: 2, giftItemId: 1, message: 'Hi', useSiteBalance: true };
      const mockSentGift = { id: 1, ...mockReq.body };
      Gift.sendGift.mockResolvedValueOnce(mockSentGift);

      await giftController.sendGift(mockReq, mockRes);
      expect(Gift.sendGift).toHaveBeenCalledWith(expect.objectContaining({ useSiteBalance: true }));
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockSentGift);
    });

    it('should return 400 if recipientId or giftItemId is missing', async () => {
      mockReq.body = { recipientId: 2 }; // Missing giftItemId
      await giftController.sendGift(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Recipient and gift item are required' });
    });

    it('should return 403 for insufficient tier', async () => {
      mockReq.body = { recipientId: 2, giftItemId: 1 };
      Gift.sendGift.mockRejectedValueOnce({ code: 'INSUFFICIENT_TIER', message: 'Tier too low' });
      await giftController.sendGift(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Tier too low' });
    });

    it('should return 400 for insufficient balance', async () => {
        mockReq.body = { recipientId: 2, giftItemId: 1, useSiteBalance: true };
        Gift.sendGift.mockRejectedValueOnce(new Error('Insufficient balance.'));
        await giftController.sendGift(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient balance.' });
    });

    it('should return 500 for other errors', async () => {
      mockReq.body = { recipientId: 2, giftItemId: 1 };
      Gift.sendGift.mockRejectedValueOnce(new Error('DB Error'));
      await giftController.sendGift(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to send gift' });
    });
  });

  describe('redeemReceivedGift', () => {
    it('should redeem a gift successfully', async () => {
      mockReq.params = { userGiftId: '10' };
      const mockResult = {
        redeemedGift: { id: 10, redeemed_value: '7.30' },
        newBalance: '107.30',
      };
      Gift.redeemGift.mockResolvedValueOnce(mockResult);

      await giftController.redeemReceivedGift(mockReq, mockRes);

      expect(Gift.redeemGift).toHaveBeenCalledWith(10, mockReq.user.id);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Gift redeemed successfully!',
        redeemedGiftId: 10,
        redeemedAmount: '7.30',
        newBalance: '107.30',
      });
    });

    it('should return 400 if userGiftId is missing', async () => {
      mockReq.params = {}; // Missing userGiftId
      await giftController.redeemReceivedGift(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User Gift ID is required.' });
    });

    it('should return 404 if gift not found or other specific errors', async () => {
      mockReq.params = { userGiftId: '10' };
      Gift.redeemGift.mockRejectedValueOnce(new Error('Gift not found or does not belong to the user.'));
      await giftController.redeemReceivedGift(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Gift not found or does not belong to the user.' });
    });

    it('should return 404 if gift already redeemed', async () => {
      mockReq.params = { userGiftId: '10' };
      Gift.redeemGift.mockRejectedValueOnce(new Error('Gift has already been redeemed.'));
      await giftController.redeemReceivedGift(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Gift has already been redeemed.' });
    });


    it('should return 500 for other errors during redemption', async () => {
      mockReq.params = { userGiftId: '10' };
      Gift.redeemGift.mockRejectedValueOnce(new Error('Some DB Error'));
      await giftController.redeemReceivedGift(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to redeem gift.' });
    });
  });
});
