const pool = require('../config/db');
const UserBalance = require('./UserBalance');

class Gift {
  // Tier hierarchy for gift sending permissions
  static TIER_HIERARCHY = {
    'Basic': 1,
    'Premium': 2,
    'Elite': 3,
  };

  // Gift Items Methods
  static async getAllGiftItems() {
    const result = await pool.query(
      'SELECT id, name, description, price, image_url, category, is_available, tier_id as required_tier_level FROM gift_items WHERE is_available = TRUE ORDER BY price ASC'
    );
    return result.rows;
  }

  static async getGiftItemById(id) {
    const result = await pool.query(
      'SELECT id, name, description, price, image_url, category, is_available, tier_id as required_tier_level FROM gift_items WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async createGiftItem({ name, description, price, imageUrl, category, required_tier_level }) {
    const result = await pool.query(
      `INSERT INTO gift_items (name, description, price, image_url, category, tier_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, price, imageUrl, category, required_tier_level]
    );
    // Map tier_id to required_tier_level in the response
    const gift = result.rows[0];
    if (gift) {
      gift.required_tier_level = gift.tier_id;
      delete gift.tier_id;
    }
    return gift;
  }

  static async updateGiftItem(id, { name, description, price, imageUrl, category, isAvailable, required_tier_level }) {
    const result = await pool.query(
      `UPDATE gift_items 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           image_url = COALESCE($4, image_url),
           category = COALESCE($5, category),
           is_available = COALESCE($6, is_available),
           tier_id = COALESCE($7, tier_id)
       WHERE id = $8
       RETURNING *`,
      [name, description, price, imageUrl, category, isAvailable, required_tier_level, id]
    );
    // Map tier_id to required_tier_level in the response
    const gift = result.rows[0];
    if (gift) {
      gift.required_tier_level = gift.tier_id;
      delete gift.tier_id;
    }
    return gift;
  }

  // User Gifts Methods
  static async sendGift({ senderId, recipientId, giftItemId, message, isAnonymous, useSiteBalance = false }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch sender's tier
      const senderTierResult = await client.query(
        `SELECT sp.tier_level, sp.id as tier_id, sp.price as subscription_price
         FROM user_subscriptions us
         JOIN subscription_packages sp ON us.package_id = sp.id
         WHERE us.user_id = $1 AND us.status = 'active'
         ORDER BY sp.price DESC
         LIMIT 1`,
        [senderId]
      );

      const senderTier = senderTierResult.rows[0]?.tier_level || 'Basic'; // Default to Basic if no active sub
      const senderTierId = senderTierResult.rows[0]?.tier_id;

      // 2. Fetch gift item details with tier information
      const giftItemResult = await client.query(
        `SELECT gi.price, gi.tier_id, gt.name as tier_name, gt.min_subscription_level
         FROM gift_items gi
         LEFT JOIN gift_tiers gt ON gi.tier_id = gt.id
         WHERE gi.id = $1 AND gi.is_available = TRUE`,
        [giftItemId]
      );
      
      if (giftItemResult.rows.length === 0) {
        throw new Error('Gift item not found or is unavailable.');
      }
      const giftItem = giftItemResult.rows[0];

      // 4. Insert into user_gifts
      const userGiftResult = await client.query(
        `INSERT INTO user_gifts
         (sender_id, recipient_id, gift_item_id, message, is_anonymous, original_purchase_price)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [senderId, recipientId, giftItemId, message, isAnonymous, giftItem.price]
      );
      const createdUserGift = userGiftResult.rows[0];

      // 5. Handle transaction recording based on useSiteBalance
      if (useSiteBalance) {
        // Debit from site balance
        await UserBalance.debit(senderId, parseFloat(giftItem.price), client);
        
        // Record transaction as paid with site balance
        await client.query(
          `INSERT INTO transactions 
           (user_id, type, amount, status, item_category, payable_item_id, description, payment_details)
           VALUES ($1, $2, $3, 'completed', 'gift', $4, $5, $6::jsonb)`,
          [
            senderId, 
            'gift_sent', 
            giftItem.price, 
            giftItemId, 
            `Gift sent to user ${recipientId}`,
            JSON.stringify({ payment_method: 'site_balance' })
          ]
        );
      } else {
        // For non-site balance payments (e.g., credit card, etc.)
        await client.query(
          `INSERT INTO transactions 
           (user_id, type, amount, status, item_category, payable_item_id, description, payment_details)
           VALUES ($1, $2, $3, 'completed', 'gift', $4, $5, $6::jsonb)`,
          [
            senderId, 
            'gift_sent', 
            giftItem.price, 
            giftItemId, 
            `Gift sent to user ${recipientId}`,
            JSON.stringify({ payment_method: 'direct_payment' })
          ]
        );
      }

      await client.query('COMMIT');
      return createdUserGift;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in sendGift transaction:', error);
      throw error; // Re-throw to be caught by controller
    } finally {
      client.release();
    }
  }

  static async getReceivedGifts(userId) {
    const result = await pool.query(
      `SELECT 
          ug.id, 
          ug.sender_id, 
          ug.recipient_id, 
          ug.gift_item_id, 
          ug.message, 
          ug.is_anonymous, 
          ug.is_read, 
          ug.created_at, 
          ug.original_purchase_price,
          ug.is_redeemed, 
          ug.redeemed_at, 
          ug.redeemed_value,
          gi.id as item_id, 
          gi.name, 
          gi.description, 
          gi.price, 
          gi.image_url, 
          gi.category, 
          gi.is_available, 
          gi.tier_id,
          CASE WHEN ug.is_anonymous THEN NULL ELSE u.id END as sender_user_id,
          CASE WHEN ug.is_anonymous THEN 'Anonymous' ELSE p.first_name || ' ' || p.last_name END as sender_name,
          CASE WHEN ug.is_anonymous THEN NULL ELSE p.profile_pic END as sender_profile_pic
       FROM user_gifts ug
       JOIN gift_items gi ON ug.gift_item_id = gi.id
       LEFT JOIN users u ON ug.sender_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE ug.recipient_id = $1
       ORDER BY ug.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async getSentGifts(userId) {
    const result = await pool.query(
      `SELECT ug.*, gi.*, 
        p.first_name || ' ' || p.last_name as recipient_name,
        p.profile_pic as recipient_profile_pic
       FROM user_gifts ug
       JOIN gift_items gi ON ug.gift_item_id = gi.id
       JOIN profiles p ON ug.recipient_id = p.user_id
       WHERE ug.sender_id = $1
       ORDER BY ug.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async markGiftAsRead(giftId, userId) {
    const result = await pool.query(
      `UPDATE user_gifts 
       SET is_read = TRUE
       WHERE id = $1 AND recipient_id = $2
       RETURNING *`,
      [giftId, userId]
    );
    return result.rows[0];
  }

  static async getUnreadGiftCount(userId) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM user_gifts WHERE recipient_id = $1 AND is_read = FALSE',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  static async redeemGift(userGiftId, userId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. First, check user's subscription tier
        const userTierResult = await client.query(
            `SELECT sp.tier_level, sp.price as subscription_price
             FROM user_subscriptions us
             JOIN subscription_packages sp ON us.package_id = sp.id
             WHERE us.user_id = $1 AND us.status = 'active'
             ORDER BY sp.price DESC
             LIMIT 1`,
            [userId]
        );
        
        const userTier = userTierResult.rows[0]?.tier_level || 'Basic';
        const tierLevel = Gift.TIER_HIERARCHY[userTier] || 1; // Default to 1 (Basic) if tier not found
        
        // Check if user's tier is sufficient for gift redemption (requires Premium or higher)
        if (tierLevel < 2) { // Premium is level 2
            const error = new Error(`Your subscription tier (${userTier}) is not sufficient to redeem this gift (requires Premium or higher).`);
            error.code = 'UPGRADE_REQUIRED_FOR_GIFT_REDEMPTION';
            error.userTier = userTier;
            throw error;
        }

        // 2. Fetch the user_gift and ensure it belongs to the user and is not redeemed
        const giftResult = await client.query(
            `SELECT ug.*, gi.name as gift_item_name
             FROM user_gifts ug
             JOIN gift_items gi ON ug.gift_item_id = gi.id
             WHERE ug.id = $1 AND ug.recipient_id = $2 FOR UPDATE`,
            [userGiftId, userId]
        );
        const userGift = giftResult.rows[0];

        if (!userGift) {
            const error = new Error('Gift not found or does not belong to the user.');
            error.code = 'GIFT_NOT_FOUND';
            throw error;
        }
        if (userGift.is_redeemed) {
            const error = new Error('Gift has already been redeemed.');
            error.code = 'GIFT_ALREADY_REDEEMED';
            throw error;
        }
        if (userGift.original_purchase_price == null) {
            console.error(`Attempted to redeem gift ${userGiftId} with null original_purchase_price.`);
            const error = new Error('Cannot redeem gift: original purchase price not recorded.');
            error.code = 'INVALID_GIFT_RECORD';
            throw error;
        }

        // 2. Calculate redeemed_value (73%)
        const originalPrice = parseFloat(userGift.original_purchase_price);
        const redeemedValue = parseFloat((originalPrice * 0.73).toFixed(2));

        // 3. Update user_gifts table
        const updatedGiftResult = await client.query(
            `UPDATE user_gifts
             SET is_redeemed = TRUE, redeemed_at = CURRENT_TIMESTAMP, redeemed_value = $1
             WHERE id = $2
             RETURNING *`,
            [redeemedValue, userGiftId]
        );
        const updatedGift = updatedGiftResult.rows[0];


        // 4. Credit user's balance
        const updatedBalance = await UserBalance.credit(userId, redeemedValue, client);

        // 5. TODO: Log this balance transaction for auditing (e.g., in a new balance_transactions table)
        // For now, console.log for tracing
        console.log(`User ${userId} redeemed gift ${userGift.id} (item: ${userGift.gift_item_name}) for ${redeemedValue}. New balance: ${updatedBalance.balance}`);

        await client.query('COMMIT');
        return {
            redeemedGift: updatedGift,
            newBalance: updatedBalance.balance
        };
    } catch (error) {
        await client.query('ROLLBACK');
        // Only log full error stack for server-side debugging
        console.error('Error in redeemGift transaction:', error.message, error.stack);
        // Rethrow with just the error code and message for the client
        const clientError = new Error(error.message);
        clientError.code = error.code || 'REDEMPTION_ERROR';
        if (error.userTier) clientError.userTier = error.userTier;
        throw clientError;
    } finally {
        client.release();
    }
  }
}

module.exports = Gift; 