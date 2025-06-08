const Profile = require('../models/Profile');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Placeholder for actual logic to fetch profile visitors
// This would typically involve logging profile views in another table
// and then querying that table.
const getProfileVisitors = async (req, res) => {
  const userId = req.user.id; // Assuming auth middleware sets req.user

  try {
    // --- SIMULATED LOGIC ---
    // In a real application, you would query a table that logs profile visits.
    // For example: SELECT visitor_id, visit_timestamp FROM profile_visits WHERE visited_user_id = $1 ORDER BY visit_timestamp DESC LIMIT 20;
    // Then, you might fetch basic details for each visitor_id.

    // For now, let's return a dummy list of visitors.
    const dummyVisitors = [
      { id: 101, username: 'CuriousUser1', visitedAt: new Date(Date.now() - 3600000).toISOString(), mutualMatch: true },
      { id: 102, username: 'ExplorerGal', visitedAt: new Date(Date.now() - 7200000).toISOString(), mutualMatch: false },
      { id: 103, username: 'MysteryMan', visitedAt: new Date(Date.now() - 10800000).toISOString(), mutualMatch: true },
    ];

    // Simulate checking if the current user (premium user) has access to this feature
    // The middleware `requireTier('Premium')` already handles this, but good to be aware.
    console.log(`User ${userId} is accessing their profile visitors (Premium feature).`);

    res.status(200).json({
      message: 'Successfully retrieved profile visitors.',
      visitors: dummyVisitors,
      featureTier: 'Premium'
    });

  } catch (error) {
    console.error('Error in getProfileVisitors:', error);
    res.status(500).json({ message: 'Server error while fetching profile visitors.' });
  }
};

// Upload profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const userId = req.user.id;
    
    // The file has already been saved by multer, we just need to get its path
    const relativePath = `/uploads/profile-pictures/${path.basename(req.file.path)}`;
    const absolutePath = path.join(__dirname, '..', 'uploads', 'profile-pictures', path.basename(req.file.path));
    
    // Verify the file exists after upload
    if (!fs.existsSync(absolutePath)) {
      throw new Error('Uploaded file not found on server');
    }

    // Update user's profile picture in the database
    await Profile.updateProfilePicture(userId, relativePath);

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: relativePath
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    
    // Clean up the uploaded file if there was an error
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (err) {
        console.error('Error cleaning up file:', err);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload profile picture',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Fetching profile for user ID:', userId);
    
    const profile = await Profile.findByUserId(userId);
    
    if (!profile) {
      console.log('Profile not found for user ID:', userId);
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    
    // Log the raw profile data to see what's coming from the database
    console.log('Raw profile data from database:', JSON.stringify({
      userId: profile.user_id,
      email: profile.email,
      profilePicture: profile.profile_picture,
      hasProfilePicture: !!profile.profile_picture,
      profileKeys: Object.keys(profile)
    }, null, 2));
    
    // Check if the profile picture file exists if it's a local path
    if (profile.profile_picture && !profile.profile_picture.startsWith('http')) {
      const fullPath = path.join(__dirname, '..', profile.profile_picture);
      const fileExists = fs.existsSync(fullPath);
      console.log('Profile picture file check:', {
        dbPath: profile.profile_picture,
        fullPath,
        fileExists
      });
      
      if (!fileExists) {
        console.warn('Profile picture file not found at path:', fullPath);
      }
    }
    
    res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, dob, gender, bio } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !dob || !gender) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: firstName, lastName, dob, and gender are required'
      });
    }
    
    const updatedProfile = await Profile.createOrUpdate({
      userId,
      firstName,
      lastName,
      dob,
      gender,
      bio: bio || ''
    });
    
    // Mark profile as complete
    await Profile.markProfileComplete(userId);
    
    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully',
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to ensure upload directory exists
const ensureUploadsDirectory = () => {
  const uploadDir = path.join(__dirname, '../uploads/profile-pictures');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

module.exports = {
  getProfileVisitors,
  uploadProfilePicture,
  getProfile,
  updateProfile
};
