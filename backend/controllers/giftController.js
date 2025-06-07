const Gift = require('../models/Gift');

// Gift Items Controllers
exports.getAllGiftItems = async (req, res) => {
  try {
    const gifts = await Gift.getAllGiftItems();
    res.json(gifts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get gift items' });
  }
};

exports.getGiftItemById = async (req, res) => {
  try {
    const gift = await Gift.getGiftItemById(req.params.id);
    if (!gift) {
      return res.status(404).json({ error: 'Gift item not found' });
    }
    res.json(gift);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get gift item' });
  }
};

exports.createGiftItem = async (req, res) => {
  try {
    const { name, description, price, imageUrl, category, required_tier_level } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    if (required_tier_level && !['Basic', 'Premium', 'Elite'].includes(required_tier_level)) {
      return res.status(400).json({ error: 'Invalid required_tier_level. Must be Basic, Premium, or Elite.' });
    }

    const gift = await Gift.createGiftItem({
      name,
      description,
      price: parseFloat(price),
      imageUrl,
      category,
      required_tier_level
    });

    res.status(201).json(gift);
  } catch (err) {
    console.error('Error creating gift item:', err);
    res.status(500).json({ error: 'Failed to create gift item' });
  }
};

exports.updateGiftItem = async (req, res) => {
  try {
    const { name, description, price, imageUrl, category, isAvailable, required_tier_level } = req.body;
    
    if (required_tier_level && !['Basic', 'Premium', 'Elite', null].includes(required_tier_level)) {
        return res.status(400).json({ error: 'Invalid required_tier_level. Must be Basic, Premium, Elite, or null.' });
    }

    const giftData = {
      name,
      description,
      imageUrl,
      category,
      isAvailable
    };
    if (price !== undefined) giftData.price = parseFloat(price);
    if (required_tier_level !== undefined) giftData.required_tier_level = required_tier_level;


    const gift = await Gift.updateGiftItem(req.params.id, giftData);

    if (!gift) {
      return res.status(404).json({ error: 'Gift item not found' });
    }

    res.json(gift);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update gift item' });
  }
};

// User Gifts Controllers
exports.sendGift = async (req, res) => {
  try {
    const { recipientId, giftItemId, message, isAnonymous, useSiteBalance } = req.body; // Added useSiteBalance
    
    if (!recipientId || !giftItemId) {
      return res.status(400).json({ error: 'Recipient and gift item are required' });
    }

    const gift = await Gift.sendGift({
      senderId: req.user.id,
      recipientId,
      giftItemId,
      message,
      isAnonymous: !!isAnonymous,
      useSiteBalance: !!useSiteBalance // Pass the flag to the model method
    });

    res.status(201).json(gift);
  } catch (err) {
    console.error('Error sending gift:', err.message, err.stack);
    if (err.code === 'INSUFFICIENT_TIER') {
      return res.status(403).json({ 
        success: false,
        error: err.message || 'Your subscription tier does not allow sending this gift.',
        code: 'INSUFFICIENT_TIER'
      });
    }
    if (err.code === 'GIFT_RESTRICTION') {
      return res.status(403).json({
        success: false,
        error: err.message || 'Gift sending is restricted for this user.',
        code: 'GIFT_RESTRICTION',
        upgradeRequired: true
      });
    }
    if (err.message && err.message.toLowerCase().includes('gift item not found')) {
      return res.status(404).json({ 
        success: false,
        error: err.message,
        code: 'GIFT_ITEM_NOT_FOUND'
      });
    }
    if (err.message && err.message.toLowerCase().includes('insufficient balance')) {
      return res.status(400).json({ 
        success: false,
        error: err.message,
        code: 'INSUFFICIENT_BALANCE'
      });
    }
    console.error('Unexpected error in sendGift:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send gift',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

exports.getReceivedGifts = async (req, res) => {
  try {
    const gifts = await Gift.getReceivedGifts(req.user.id);
    res.json(gifts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get received gifts' });
  }
};

exports.getSentGifts = async (req, res) => {
  try {
    const gifts = await Gift.getSentGifts(req.user.id);
    res.json(gifts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get sent gifts' });
  }
};

exports.markGiftAsRead = async (req, res) => {
  try {
    const gift = await Gift.markGiftAsRead(req.params.id, req.user.id);
    if (!gift) {
      return res.status(404).json({ error: 'Gift not found' });
    }
    res.json(gift);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark gift as read' });
  }
};

exports.getUnreadGiftCount = async (req, res) => {
  try {
    const count = await Gift.getUnreadGiftCount(req.user.id);
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get unread gift count' });
  }
};

exports.redeemReceivedGift = async (req, res) => {
  const TIER_LEVELS = {
    'free': 0,
    'basic': 1,
    'premium': 2,
    'elite': 3
  };
  const PREMIUM_TIER_NAME = 'Premium'; // For the error message
  const MINIMUM_REDEEM_LEVEL = TIER_LEVELS[PREMIUM_TIER_NAME.toLowerCase()];

  // Assumes req.user and req.user.subscription_tier are populated by auth middleware
  if (req.user && req.user.subscription_tier) {
    const userTier = req.user.subscription_tier.toLowerCase();
    const userTierLevel = TIER_LEVELS[userTier] !== undefined ? TIER_LEVELS[userTier] : -1; // Default to -1 if tier is unknown or not in our map

    if (userTierLevel < MINIMUM_REDEEM_LEVEL) {
      const userTierDisplay = userTier.charAt(0).toUpperCase() + userTier.slice(1);
      return res.status(403).json({
        success: false,
        error: `Your subscription tier (${userTierDisplay}) is not sufficient to redeem this gift (requires ${PREMIUM_TIER_NAME} or higher).`,
        code: 'UPGRADE_REQUIRED_FOR_GIFT_REDEMPTION'
      });
    }
  } else if (req.user && !req.user.subscription_tier) {
    // Handle cases where subscription_tier might be missing for a logged-in user (should ideally not happen)
    // Consider this a non-permissive state for redemption
    return res.status(403).json({
        success: false,
        error: 'Your subscription tier could not be determined. Gift redemption requires a Premium or higher tier.',
        code: 'TIER_UNKNOWN_FOR_GIFT_REDEMPTION'
    });
  }

  try {
      const { userGiftId } = req.params;
      const userId = req.user.id; // Assuming user ID is from auth middleware

      if (!userGiftId) {
          return res.status(400).json({ error: 'User Gift ID is required.' });
      }

      const result = await Gift.redeemGift(parseInt(userGiftId), userId);

      res.json({
          message: 'Gift redeemed successfully!',
          redeemedGiftId: result.redeemedGift.id,
          redeemedAmount: result.redeemedGift.redeemed_value,
          newBalance: result.newBalance
      });
  } catch (error) {
      console.error('Error redeeming gift:', error.message, error.stack);
      if (error.message.includes('not found') ||
          error.message.includes('already been redeemed') ||
          error.message.includes('original purchase price not recorded')) {
          return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Insufficient balance')) { // Should not happen on credit generally
          return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to redeem gift.' });
  }
}; 