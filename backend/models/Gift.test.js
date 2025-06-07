const Gift = require('./Gift');
const UserBalance = require('./UserBalance');
const pool = require('../config/db');

// Mock dependencies
jest.mock('../config/db', () => {
  const actualPool = jest.requireActual('../config/db'); // Get actual pool for connect method
  return {
    ...actualPool, // Spread actual pool to keep its other properties if any
    query: jest.fn(),
    connect: jest.fn(() => ({ // Mock connect to return an object with query and release
      query: jest.fn(),
      release: jest.fn(),
    })),
  };
});
jest.mock('./UserBalance');

describe('Gift Model', () => {
  let mockClient;

  beforeEach(() => {
    // Setup mock client for each test that uses transactions
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockReturnValue(mockClient); // Ensure pool.connect() returns our mockClient
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendGift', () => {
    const senderId = 1;
    const recipientId = 2;
    const giftItemId = 1;
    const message = 'Congrats!';
    const isAnonymous = false;
    const mockGiftItem = { id: giftItemId, price: '10.00', required_tier_level: 'Basic' };
    const mockSenderTier = { tier_level: 'Premium' };
    const mockCreatedUserGift = { id: 1, sender_id: senderId, gift_item_id: giftItemId, original_purchase_price: mockGiftItem.price };

    beforeEach(() => {
        // Default mock implementations for queries within sendGift
        mockClient.query
            .mockResolvedValueOnce({ rows: [mockSenderTier] }) // Fetch sender's tier
            .mockResolvedValueOnce({ rows: [mockGiftItem] })   // Fetch gift item details
            .mockResolvedValueOnce({ rows: [mockCreatedUserGift] }); // Insert into user_gifts
    });

    it('should send gift and log transaction if useSiteBalance is false (default behavior)', async () => {
      mockClient.query.mockResolvedValueOnce({}); // Mock for insert into transactions

      const result = await Gift.sendGift({ senderId, recipientId, giftItemId, message, isAnonymous, useSiteBalance: false });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_gifts'), expect.any(Array));
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        [senderId, mockGiftItem.price, giftItemId] // Check for 'gift' type, 'completed' status
      );
      expect(UserBalance.debit).not.toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual(mockCreatedUserGift);
    });

    it('should send gift using site balance if useSiteBalance is true and balance is sufficient', async () => {
      UserBalance.debit.mockResolvedValueOnce({ balance: '90.00' }); // Sufficient balance
      mockClient.query.mockResolvedValueOnce({}); // Mock for insert into transactions (site balance type)

      const result = await Gift.sendGift({ senderId, recipientId, giftItemId, message, isAnonymous, useSiteBalance: true });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(UserBalance.debit).toHaveBeenCalledWith(senderId, parseFloat(mockGiftItem.price), mockClient);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        [senderId, 'gift_site_balance', mockGiftItem.price, giftItemId, 'Paid with site balance']
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual(mockCreatedUserGift);
    });

    it('should throw error and rollback if useSiteBalance is true and balance is insufficient', async () => {
      UserBalance.debit.mockRejectedValueOnce(new Error('Insufficient balance.'));

      await expect(
        Gift.sendGift({ senderId, recipientId, giftItemId, message, isAnonymous, useSiteBalance: true })
      ).rejects.toThrow('Insufficient balance.');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(UserBalance.debit).toHaveBeenCalledWith(senderId, parseFloat(mockGiftItem.price), mockClient);
      expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO transactions')); // No transaction logged
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
     it('should throw error if tier is insufficient', async () => {
        mockClient.query.mockReset(); // Reset general mocks for this specific case
        mockClient.query
            .mockResolvedValueOnce({ rows: [{ tier_level: 'Basic' }] }) // Sender is Basic
            .mockResolvedValueOnce({ rows: [{ price: '50.00', required_tier_level: 'Elite' }] }); // Gift requires Elite

        await expect(
            Gift.sendGift({ senderId, recipientId, giftItemId, message, isAnonymous })
        ).rejects.toThrow(/Your subscription tier \(Basic\) is not sufficient/);
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('redeemGift', () => {
    const userGiftId = 1;
    const userId = 1;
    const mockUserGift = {
      id: userGiftId,
      recipient_id: userId,
      gift_item_id: 1,
      is_redeemed: false,
      original_purchase_price: '100.00',
      gift_item_name: 'Big Diamond'
    };
    const redeemedValue = parseFloat((parseFloat(mockUserGift.original_purchase_price) * 0.73).toFixed(2));

    it('should redeem a valid gift and credit user balance', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockUserGift] }) // Fetch gift
        .mockResolvedValueOnce({ rows: [{ ...mockUserGift, is_redeemed: true, redeemed_at: new Date(), redeemed_value: redeemedValue }] }) // Update gift
      UserBalance.credit.mockResolvedValueOnce({ balance: redeemedValue.toString() }); // UserBalance.credit success

      const result = await Gift.redeemGift(userGiftId, userId);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT ug.*, gi.name as gift_item_name'), [userGiftId, userId]);
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE user_gifts'), [redeemedValue, userGiftId]);
      expect(UserBalance.credit).toHaveBeenCalledWith(userId, redeemedValue, mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result.redeemedGift.is_redeemed).toBe(true);
      expect(result.redeemedGift.redeemed_value).toEqual(redeemedValue);
      expect(result.newBalance).toEqual(redeemedValue.toString());
    });

    it('should throw error if gift not found or does not belong to user', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Gift not found

      await expect(Gift.redeemGift(userGiftId, userId)).rejects.toThrow('Gift not found or does not belong to the user.');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw error if gift already redeemed', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockUserGift, is_redeemed: true }] }); // Gift already redeemed

      await expect(Gift.redeemGift(userGiftId, userId)).rejects.toThrow('Gift has already been redeemed.');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw error if original_purchase_price is null', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ ...mockUserGift, original_purchase_price: null }] });

      await expect(Gift.redeemGift(userGiftId, userId)).rejects.toThrow('Cannot redeem gift: original purchase price not recorded.');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
