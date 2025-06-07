require('dotenv').config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-here',
  
  // Database Configuration
  DB_USER: process.env.DB_USER || 'postgres',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_NAME: process.env.DB_NAME || 'meetcute',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_PORT: process.env.DB_PORT || 5432,

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};