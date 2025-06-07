const User = require('./User');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('User Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('User.create()', () => {
    it('should create a new user with email verification fields', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'user',
        phone: '1234567890',
        country_id: '1',
        email_verification_token: 'testtoken123',
      };
      const expectedUser = { id: 1, ...userData, is_email_verified: false };
      pool.query.mockResolvedValueOnce({ rows: [expectedUser] });

      const user = await User.create(userData);

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        `INSERT INTO users (email, password, role, phone, country_id, is_email_verified, email_verification_token)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6) RETURNING *`,
        [
          userData.email,
          userData.password,
          userData.role,
          userData.phone,
          userData.country_id,
          userData.email_verification_token,
        ]
      );
      expect(user).toEqual(expectedUser);
    });
  });

  describe('User.findByVerificationToken()', () => {
    it('should find a user by a valid verification token', async () => {
      const token = 'validtoken123';
      const expectedUser = { id: 1, email: 'test@example.com', email_verification_token: token };
      pool.query.mockResolvedValueOnce({ rows: [expectedUser] });

      const user = await User.findByVerificationToken(token);

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email_verification_token = $1',
        [token]
      );
      expect(user).toEqual(expectedUser);
    });

    it('should return undefined if no user is found for the token', async () => {
      const token = 'invalidtoken123';
      pool.query.mockResolvedValueOnce({ rows: [] });

      const user = await User.findByVerificationToken(token);

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE email_verification_token = $1',
        [token]
      );
      expect(user).toBeUndefined();
    });
  });

  describe('User.verifyEmail()', () => {
    it('should update user email verification status and nullify token', async () => {
      const userId = 1;
      pool.query.mockResolvedValueOnce({ rowCount: 1 }); // Assuming update is successful

      await User.verifyEmail(userId);

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE users SET is_email_verified = TRUE, email_verification_token = NULL WHERE id = $1',
        [userId]
      );
    });
  });
});
