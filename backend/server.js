// backend/server.js

const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const env = require('./config/env');
const pool = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const WebSocketController = require('./controllers/websocketController'); // Import the controller

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const matchRoutes = require('./routes/matchRoutes');
const messageRoutes = require('./routes/messageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const giftRoutes = require('./routes/giftRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const profileRoutes = require('./routes/profileRoutes');
const countryRoutes = require('./routes/countryRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const boostRoutes = require('./routes/boostRoutes');
const anonymousBrowsingRoutes = require('./routes/anonymousBrowsingRoutes');
const videoChatRoutes = require('./routes/videoChatRoutes');
const paymentMethodAdminRoutes = require('./routes/paymentMethodAdminRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const adminTransactionRoutes = require('./routes/adminTransactionRoutes');
const balanceRoutes = require('./routes/balanceRoutes');
const depositRoutes = require('./routes/depositRoutes');
const featureTestRoutes = require('./routes/featureTestRoutes');
const usageRoutes = require('./routes/usageRoutes');

const app = express();
const server = http.createServer(app);

// --- CORS Configuration ---
const allowedOrigins = [
  'http://localhost:5173', 
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// Enable pre-flight across-the-board
app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-profile-setup'],
  exposedHeaders: ['set-cookie']
}));

// Apply CORS middleware with credentials support
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-profile-setup'],
  exposedHeaders: ['set-cookie']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Configure static file serving with proper CORS and security headers
const publicPath = path.join(__dirname, 'public');
const uploadsPath = path.join(__dirname, 'uploads');

// Create a custom static file handler with proper headers
const staticFileHandler = (directory, options = {}) => {
  return express.static(directory, {
    ...options,
    setHeaders: (res, path) => {
      // Set CORS headers
      res.set('Access-Control-Allow-Origin', 'http://localhost:5173');
      res.set('Access-Control-Allow-Credentials', 'true');
      
      // Set security headers
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('Cross-Origin-Embedder-Policy', 'require-corp');
      
      // Set cache control headers
      if (path.endsWith('.jpeg') || path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.gif')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      } else {
        res.set('Cache-Control', 'no-store');
      }
    }
  });
};

// Add a specific route for the default avatar to ensure proper CORS headers
app.get('/default-avatar.png', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'default-avatar.png');
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  
  // Send the file
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending default avatar:', err);
      res.status(404).json({ success: false, error: 'Default avatar not found' });
    }
  });
});

// Serve public files
app.use(staticFileHandler(publicPath));

// Serve uploads directory
app.use('/uploads', staticFileHandler(uploadsPath));

// Add a specific route for profile pictures to handle CORS preflight
app.options('/uploads/profile-pictures/:filename', (req, res) => {
  res.set('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint - must be defined before other routes
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/anonymous-browsing', anonymousBrowsingRoutes);
app.use('/api/video-chat', videoChatRoutes);
app.use('/api/admin/payment-methods', paymentMethodAdminRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin/transactions', adminTransactionRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/features', featureTestRoutes);

// --- WebSocket Setup ---
// Instantiate the WebSocket controller and pass the server to it.
const wsController = new WebSocketController(server);
app.set('wsController', wsController); // Make it accessible in routes if needed

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use(errorHandler);

// Process event handlers...
process.on('unhandledRejection', (err) => logger.error('Unhandled Rejection:', err));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down...');
  server.close(() => logger.info('Process terminated.'));
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  try {
    await pool.query('SELECT NOW()');
    logger.info('Database connected successfully.');
  } catch (err) {
    logger.error('Database connection error:', err);
  }
});

module.exports = { app, server };