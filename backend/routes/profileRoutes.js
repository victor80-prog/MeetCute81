const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');
const { requireTier } = require('../middleware/authSubscription');
const profileController = require('../controllers/profileController');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads/profile-pictures');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Debug logging middleware
router.use((req, res, next) => {
  console.log('Profile route accessed:', req.method, req.path);
  console.log('Headers:', req.headers);
  if (req.method !== 'GET') {
    console.log('Body:', req.body);
  }
  next();
});

// Profile picture upload with enhanced validation and error handling
router.post(
  '/picture',
  isAuthenticated,
  (req, res, next) => {
    console.log('Starting file upload for user:', req.user.id);
    
    // Check if file is present
    if (!req.files || !req.files.profilePicture) {
      console.log('No file uploaded in request');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please select a file.'
      });
    }
    
    upload.single('profilePicture')(req, res, function(err) {
      if (err) {
        console.error('File upload error:', {
          error: err.message,
          stack: err.stack,
          userId: req.user.id,
          file: req.file
        });
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File size too large. Maximum size is 5MB.'
          });
        }
        
        if (err.message.includes('image files')) {
          return res.status(400).json({
            success: false,
            error: 'Invalid file type. Only JPG, JPEG, PNG, and GIF images are allowed.'
          });
        }
        
        return res.status(400).json({
          success: false,
          error: 'Failed to upload file. ' + (err.message || 'Please try again.')
        });
      }
      
      if (!req.file) {
        console.log('No file data after upload middleware');
        return res.status(400).json({
          success: false,
          error: 'No file data received. Please try again.'
        });
      }
      
      console.log('File upload successful:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename,
        userId: req.user.id
      });
      
      next();
    });
  },
  // Handle the actual file processing in the controller
  profileController.uploadProfilePicture
);

// Get current user's full profile
router.get(
  '/',
  isAuthenticated,
  (req, res, next) => {
    console.log('Fetching current user profile for user ID:', req.user.id);
    profileController.getMyProfile(req, res, next);
  }
);

// Get user profile by ID (public data) or current user if no ID provided
router.get(
  '/:userId?',
  isAuthenticated,
  (req, res, next) => {
    const { userId } = req.params;
    
    // Log the incoming request details
    console.log('Profile request received:', {
      path: req.path,
      method: req.method,
      params: req.params,
      query: req.query,
      userId: req.user.id,
      requestedUserId: userId || 'current user'
    });
    
    try {
      // If no userId is provided, get current user's profile
      if (!userId) {
        console.log('No userId provided, fetching current user profile');
        return profileController.getMyProfile(req, res, next);
      }
      
      // Validate userId format
      if (isNaN(parseInt(userId, 10))) {
        console.log('Invalid userId format:', userId);
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID format. Must be a number.'
        });
      }
      
      // If requesting own profile, use getMyProfile for full data
      if (parseInt(userId, 10) === req.user.id) {
        console.log('User requested their own profile by ID, using getMyProfile');
        return profileController.getMyProfile(req, res, next);
      }
      
      // Otherwise, get the specified user's public profile
      console.log('Fetching public profile for user ID:', userId);
      return profileController.getUserProfile(req, res, next);
      
    } catch (error) {
      console.error('Error in profile route handler:', {
        error: error.message,
        stack: error.stack,
        userId: req.user.id,
        requestedUserId: userId
      });
      
      // Handle specific error cases
      if (error.name === 'SequelizeDatabaseError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID format',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
      
      // Pass to error handler middleware
      next(error);
    }
  }
);

// Update user profile
router.put(
  '/',
  isAuthenticated,
  profileController.updateProfile
);

// Profile visitors (Premium feature)
router.get(
  '/visitors',
  isAuthenticated,
  requireTier('Premium'),
  profileController.getProfileVisitors
);

// Serve uploaded profile pictures
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Error handling middleware for file uploads
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred during file upload
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'File upload error: ' + err.message
    });
  } else if (err) {
    // Other errors
    console.error('Profile route error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  next();
});

// Serve profile pictures
router.get('/picture/:filename', (req, res) => {
  const logger = require('../utils/logger');
  const filename = req.params.filename;
  
  // Basic security check to prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    logger.warn('Potential directory traversal attempt', { filename });
    return res.status(400).json({ 
      success: false,
      error: 'Invalid filename' 
    });
  }
  
  const filePath = path.join(__dirname, '../uploads/profile-pictures', filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    logger.warn('Profile picture not found', { filename });
    return res.status(404).json({ 
      success: false,
      error: 'Profile picture not found' 
    });
  }
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Set cache headers (1 day)
  res.setHeader('Cache-Control', 'public, max-age=86400');
  
  // Determine content type based on file extension
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      contentType = 'image/jpeg';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.gif':
      contentType = 'image/gif';
      break;
  }
  
  res.setHeader('Content-Type', contentType);
  res.sendFile(filePath);
});

// Route to get profile visitors (Premium feature)
router.get('/visitors', 
  isAuthenticated, 
  requireTier('Premium'), 
  profileController.getProfileVisitors
);

module.exports = router;
