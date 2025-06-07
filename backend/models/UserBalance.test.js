const UserBalance = require('./UserBalance');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('UserBalance Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getByUserId', () => {
    it('should return user balance if found', async () => {
      const mockBalance = { user_id: 1, balance: '100.00' };
      pool.query.mockResolvedValueOnce({ rows: [mockBalance] });
      const balance = await UserBalance.getByUserId(1);
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM user_balances WHERE user_id = $1', [1]);
      expect(balance).toEqual(mockBalance);
    });

    it('should return undefined if user balance not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const balance = await UserBalance.getByUserId(1);
      expect(balance).toBeUndefined();
    });
  });

  describe('getOrCreateByUserId', () => {
    it('should return existing balance if found', async () => {
      const mockBalance = { user_id: 1, balance: '100.00' };
      // Mock getByUserId behavior
      jest.spyOn(UserBalance, 'getByUserId').mockResolvedValueOnce(mockBalance);

      const balance = await UserBalance.getOrCreateByUserId(1);
      expect(UserBalance.getByUserId).toHaveBeenCalledWith(1, pool); // pool is the default client
      expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT')); // No insert query
      expect(balance).toEqual(mockBalance);
      UserBalance.getByUserId.mockRestore();
    });

    it('should create and return new balance if not found', async () => {
      const newBalanceData = { user_id: 1, balance: '0.00' };
      // Mock getByUserId to return undefined first
      jest.spyOn(UserBalance, 'getByUserId').mockResolvedValueOnce(undefined);
      pool.query.mockResolvedValueOnce({ rows: [newBalanceData] }); // Mock insert query

      const balance = await UserBalance.getOrCreateByUserId(1);

      expect(UserBalance.getByUserId).toHaveBeenCalledWith(1, pool);
      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO user_balances (user_id, balance) VALUES ($1, 0.00) RETURNING *',
        [1]
      );
      expect(balance).toEqual(newBalanceData);
      UserBalance.getByUserId.mockRestore();
    });
  });

  describe('updateBalance', () => {
    it('should correctly update balance for a positive change', async () => {
        const initialBalance = { user_id: 1, balance: '50.00' };
        const expectedUpdatedBalance = { user_id: 1, balance: '70.00' };
        jest.spyOn(UserBalance, 'getOrCreateByUserId').mockResolvedValueOnce(initialBalance);
        pool.query.mockResolvedValueOnce({ rows: [expectedUpdatedBalance] });

        const result = await UserBalance.updateBalance(1, 20.00);
        expect(UserBalance.getOrCreateByUserId).toHaveBeenCalledWith(1, pool);
        expect(pool.query).toHaveBeenCalledWith(
            'UPDATE user_balances SET balance = $1 WHERE user_id = $2 RETURNING *',
            ['70.00', 1]
        );
        expect(result).toEqual(expectedUpdatedBalance);
        UserBalance.getOrCreateByUserId.mockRestore();
    });

    it('should correctly update balance for a negative change (debit)', async () => {
        const initialBalance = { user_id: 1, balance: '50.00' };
        const expectedUpdatedBalance = { user_id: 1, balance: '30.00' };
        jest.spyOn(UserBalance, 'getOrCreateByUserId').mockResolvedValueOnce(initialBalance);
        pool.query.mockResolvedValueOnce({ rows: [expectedUpdatedBalance] });

        const result = await UserBalance.updateBalance(1, -20.00);
         expect(pool.query).toHaveBeenCalledWith(
            'UPDATE user_balances SET balance = $1 WHERE user_id = $2 RETURNING *',
            ['30.00', 1]
        );
        expect(result).toEqual(expectedUpdatedBalance);
        UserBalance.getOrCreateByUserId.mockRestore();
    });

    it('should throw error if new balance is negative', async () => {
        const initialBalance = { user_id: 1, balance: '10.00' };
        jest.spyOn(UserBalance, 'getOrCreateByUserId').mockResolvedValueOnce(initialBalance);

        await expect(UserBalance.updateBalance(1, -20.00)).rejects.toThrow('Insufficient balance.');
        expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE'));
        UserBalance.getOrCreateByUserId.mockRestore();
    });
  });

  describe('credit', () => {
    it('should call updateBalance with a positive amount', async () => {
      jest.spyOn(UserBalance, 'updateBalance').mockResolvedValueOnce({ user_id: 1, balance: '120.00' });
      await UserBalance.credit(1, 20.00);
      expect(UserBalance.updateBalance).toHaveBeenCalledWith(1, 20.00, pool);
      UserBalance.updateBalance.mockRestore();
    });

    it('should throw error if credit amount is negative', async () => {
      await expect(UserBalance.credit(1, -5)).rejects.toThrow('Credit amount must be positive.');
    });
  });

  describe('debit', () => {
    it('should call updateBalance with a negative amount', async () => {
      jest.spyOn(UserBalance, 'updateBalance').mockResolvedValueOnce({ user_id: 1, balance: '80.00' });
      await UserBalance.debit(1, 20.00);
      expect(UserBalance.updateBalance).toHaveBeenCalledWith(1, -20.00, pool);
      UserBalance.updateBalance.mockRestore();
    });

    it('should throw error if debit amount is negative', async () => {
        await expect(UserBalance.debit(1, -5)).rejects.toThrow('Debit amount must be positive.');
    });

    // Insufficient balance case is effectively tested via updateBalance's negative new balance check
    it('debit leading to insufficient balance should throw error via updateBalance', async () => {
        const initialBalance = { user_id: 1, balance: '10.00' };
        // Mock getOrCreateByUserId directly because debit calls updateBalance which calls getOrCreateByUserId
        jest.spyOn(UserBalance, 'getOrCreateByUserId').mockResolvedValueOnce(initialBalance);

        await expect(UserBalance.debit(1, 20.00)).rejects.toThrow('Insufficient balance.');
        UserBalance.getOrCreateByUserId.mockRestore();
    });
  });
});
