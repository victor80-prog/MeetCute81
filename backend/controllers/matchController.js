// backend/controllers/matchController.js

const pool = require('../config/db');
const Match = require('../models/Match');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Like = require('../models/Like');
const { incrementSwipeCountForUser } = require('../middleware/usageLimits');

exports.getPotentialMatches = async (req, res) => {
  try {
    const matches = await Profile.getPotentialMatches(req.user.id);
    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get matches' });
  }
};

exports.likeProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const likedUserId = req.params.id;
    
    if (userId === likedUserId) {
      return res.status(400).json({ error: 'Cannot like yourself' });
    }
    
    const userExists = await User.findById(likedUserId);
    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const existingLike = await pool.query(
      'SELECT * FROM likes WHERE user_id = $1 AND liked_user_id = $2',
      [userId, likedUserId]
    );
    
    if (existingLike.rows.length > 0) {
      const isMutual = await Match.checkMutualLike(userId, likedUserId);
      return res.json({ 
        match: isMutual,
        alreadyLiked: true,
        message: 'You have already liked this profile' 
      });
    }
    
    await Match.createLike({ userId, likedUserId });
    await incrementSwipeCountForUser(req);
    
    const isMutual = await Match.checkMutualLike(userId, likedUserId);
    
    if (isMutual) {
      await Match.createMatch(userId, likedUserId);
      return res.json({ match: true });
    }
    
    res.json({ match: false });
  } catch (err) {
    if (err.limitExceeded && err.limitType === 'swipe') {
      return res.status(err.statusCode || 429).json({
        success: false,
        error: err.message || 'Daily swipe limit reached.',
        limitExceeded: true,
        limitType: 'swipe',
      });
    }
    
    console.error('Full error in likeProfile:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to like profile',
      message: err.message
    });
  }
};

exports.getMatches = async (req, res) => {
  try {
    const matches = await Match.getUserMatches(req.user.id);
    
    const transformedMatches = matches.map(match => {
      const isUser1 = match.user1_id === req.user.id;
      return {
        id: match.id,
        matchedUser: {
          id: isUser1 ? match.user2_id : match.user1_id,
          firstName: isUser1 ? match.user2_first_name : match.user1_first_name,
          lastName: isUser1 ? match.user2_last_name : match.user1_last_name,
          // --- FIX: Use a consistent property name ---
          profile_picture: isUser1 ? match.user2_profile_pic : match.user1_profile_pic
        },
        createdAt: match.created_at
      };
    });

    res.json(transformedMatches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get matches' });
  }
};

exports.checkAndCreateMatch = async (req, res) => {
  try {
    const { likedUserId } = req.body;
    if (!likedUserId) {
      return res.status(400).json({ error: 'likedUserId is required' });
    }

    await Like.createLike(req.user.id, likedUserId);
    const otherUserLike = await Like.checkLike(likedUserId, req.user.id);
    
    if (otherUserLike) {
      const existingMatch = await Match.checkMatch(req.user.id, likedUserId);
      if (!existingMatch) {
        const match = await Match.createMatch(req.user.id, likedUserId);
        res.json({ match, message: "It's a match!" });
      } else {
        res.json({ match: existingMatch, message: 'Match already exists' });
      }
    } else {
      res.json({ message: 'Like recorded, waiting for the other person to like back' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process match' });
  }
};

exports.unmatch = async (req, res) => {
  try {
    const { matchId } = req.params;
    const deletedMatch = await Match.deleteMatch(matchId, req.user.id);
    
    if (!deletedMatch) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    const match = deletedMatch;
    await Like.deleteLike(match.user1_id, match.user2_id);
    await Like.deleteLike(match.user2_id, match.user1_id);
    
    res.json({ message: 'Successfully unmatched' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unmatch' });
  }
};