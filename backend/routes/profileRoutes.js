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

// Profile picture upload
router.post(
  '/picture',
  isAuthenticated,
  (req, res, next) => {
    upload.single('profilePicture')(req, res, function(err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred during file upload
        return res.status(400).json({
          success: false,
          error: err.message || 'Error uploading file'
        });
      } else if (err) {
        // An unknown error occurred
        console.error('File upload error:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to process file upload'
        });
      }
      next();
    });
  },
  profileController.uploadProfilePicture
);

// Get user profile
router.get(
  '/',
  isAuthenticated,
  profileController.getProfile
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
