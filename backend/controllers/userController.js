const User = require('../models/User');
const Profile = require('../models/Profile');
const Like = require('../models/Like'); // Added Like model
const { validateProfile } = require('../utils/validation');

exports.getCurrentUserProfile = async (req, res) => {
  try {
    const profile = await Profile.findByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const profile = await Profile.findByUserId(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { error } = validateProfile(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { firstName, lastName, dob, gender, bio } = req.body;
    
    const profile = await Profile.createOrUpdate({
      userId: req.user.id,
      firstName,
      lastName,
      dob,
      gender,
      bio
    });
    
    // Mark profile as complete
    await User.updateProfileComplete(req.user.id);
    
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * Gets a list of users who have liked the currently authenticated user.
 * This route will be protected by isAuthenticated and checkFeatureAccess('whoLikesYou').
 */
exports.getWhoLikedMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const userTier = req.user.subscription_tier; // Assuming this is populated by auth middleware

    const likers = await Like.getUsersWhoLiked(userId);

    if (userTier === 'basic') {
      // For basic tier, return only the count and a message
      res.json({
        count: likers.length,
        message: 'Upgrade to Premium to see who liked you.',
        canViewProfiles: false
      });
    } else {
      // For premium or other higher tiers, return the full list
      res.json({
        likers: likers,
        canViewProfiles: true
      });
    }
  } catch (err) {
    console.error('Error in getWhoLikedMe controller:', err);
    res.status(500).json({ error: 'Failed to retrieve users who liked you.' });
  }
};

// Placeholder for getting incognito status (Elite feature)
exports.getIncognitoStatus = async (req, res) => {
  const userId = req.user.id;
  try {
    // In a real app, you'd fetch this from the User model, e.g., user.is_incognito
    // const user = await User.findById(userId);
    // const isIncognito = user.is_incognito || false;
    const isIncognito = false; // Dummy value

    console.log(`User ${userId} is checking incognito status (Elite feature). Current status: ${isIncognito}`);
    res.status(200).json({ 
      message: 'Successfully retrieved incognito status.',
      isIncognito,
      featureTier: 'Elite'
    });
  } catch (error) {
    console.error('Error in getIncognitoStatus:', error);
    res.status(500).json({ message: 'Server error while fetching incognito status.' });
  }
};

// Placeholder for setting incognito status (Elite feature)
exports.setIncognitoStatus = async (req, res) => {
  const userId = req.user.id;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'Invalid input: "enabled" must be a boolean.' });
  }

  try {
    // In a real app, you'd update this in the User model, e.g., await User.update(userId, { is_incognito: enabled });
    console.log(`User ${userId} is setting incognito status to ${enabled} (Elite feature).`);
    
    // Simulate update
    // const updatedUser = await User.findById(userId); 
    // const newStatus = updatedUser.is_incognito;

    res.status(200).json({
      message: `Incognito mode ${enabled ? 'enabled' : 'disabled'} successfully.`,
      isIncognito: enabled, // Return the new status
      featureTier: 'Elite'
    });
  } catch (error) {
    console.error('Error in setIncognitoStatus:', error);
    res.status(500).json({ message: 'Server error while updating incognito status.' });
  }
};