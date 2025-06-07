const pool = require('../config/db');

// Subscription tiers
const SUBSCRIPTION_TIERS = {
  BASIC: 'Basic',
  PREMIUM: 'Premium',
  ELITE: 'Elite'
};

class User {
  static get SUBSCRIPTION_TIERS() {
    return SUBSCRIPTION_TIERS;
  }

  static async create({ 
    email, 
    password, 
    role = 'user', 
    phone = null, 
    country_id = null, 
    email_verification_token,
    subscriptionTier = SUBSCRIPTION_TIERS.BASIC 
  }) {
    try {
      const result = await pool.query(
        `INSERT INTO users (email, password, role, phone, country_id, is_email_verified, email_verification_token, subscription_tier)
         VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7) 
         RETURNING id, email, role, is_email_verified, created_at, subscription_tier`,
        [email, password, role, phone, country_id, email_verification_token, subscriptionTier]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async findByVerificationToken(token) {
    const result = await pool.query(
      `SELECT id, email, is_email_verified, email_verification_token, 
              created_at, updated_at, is_active, role
       FROM users 
       WHERE email_verification_token = $1`,
      [token]
    );
    return result.rows[0];
  }

  static async verifyEmail(userId) {
    const result = await pool.query(
      `UPDATE users 
       SET is_email_verified = TRUE, 
           email_verification_token = NULL,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, email, is_email_verified`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    return result.rows[0];
  }

  static async findById(id) {
    return this.findByPk(id);
  }

  static async findByPk(id) {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async updateStatus(id, isActive) {
    await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2',
      [isActive, id]
    );
  }

  static async updateProfileComplete(id, complete = true) {
    await pool.query(
      'UPDATE users SET profile_complete = $1 WHERE id = $2',
      [complete, id]
    );
  }

  static async suspendUser(id, reason) {
    const result = await pool.query(
      `UPDATE users 
       SET is_suspended = true, 
           suspension_reason = $2,
           suspended_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, reason]
    );
    return result.rows[0];
  }

  static async unsuspendUser(id) {
    const result = await pool.query(
      `UPDATE users 
       SET is_suspended = false, 
           suspension_reason = NULL,
           suspended_at = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
}

module.exports = User;