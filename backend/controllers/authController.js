const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Profile = require('../models/Profile');
const env = require('../config/env');
const pool = require('../config/db');
const { validateRegister, validateLogin } = require('../utils/validation');
const { sendVerificationEmail } = require('../services/emailService');
const logger = require('../utils/logger');

exports.register = async (req, res) => {
  try {
    const { error } = validateRegister(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password, role, phone, countryId } = req.body;
    
    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate email verification token
    const email_verification_token = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await User.create({ 
      email, 
      password: hashedPassword, 
      role: role || 'user',
      phone: phone || null,
      country_id: countryId || null,
      email_verification_token
    });

    // Send verification email
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      console.log(`Sending verification email to ${email} with token: ${email_verification_token}`);
      console.log(`Using base URL: ${baseUrl}`);
      
      const emailResult = await sendVerificationEmail(email, email_verification_token, baseUrl);
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        // Still return success to user but log the error
        logger.error(`Failed to send verification email to ${email}:`, emailResult.error);
      }
      
      logger.info(`New user registered: ${email} (ID: ${user.id})`);
      
      return res.status(201).json({ 
        message: "Registration successful. Please check your email to verify your account.",
        status: 'pending_verification',
        emailSent: emailResult.success
      });
      
    } catch (emailError) {
      console.error('Error in email sending process:', emailError);
      logger.error('Error in email sending process:', emailError);
      
      // Still return success to user but indicate email wasn't sent
      return res.status(201).json({ 
        message: "Registration successful, but we couldn't send the verification email. Please contact support.",
        status: 'pending_verification',
        emailSent: false
      });
    }
  } catch (err) {
    console.error('Registration error:', err);
    logger.error('Registration error:', { error: err.stack });
    res.status(500).json({ 
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

exports.login = async (req, res) => {
  // Ensure JWT environment variables are set, provide defaults for safety if not
  const jwtSecret = env.JWT_SECRET || 'your_default_jwt_secret'; // Fallback, should be in .env
  const jwtAccessExpiration = env.JWT_ACCESS_TOKEN_EXPIRATION || '1h';
  const jwtRefreshSecret = env.JWT_REFRESH_TOKEN_SECRET || 'your_default_jwt_refresh_secret'; // Fallback, should be in .env
  const jwtRefreshExpiration = env.JWT_REFRESH_TOKEN_EXPIRATION || '7d';
  try {
    const { error } = validateLogin(req.body);
    if (error) return res.status(400).json({ 
      success: false,
      error: error.details[0].message 
    });

    const { email, password } = req.body;
    
    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    // Check if email is verified
    if (!user.is_email_verified) {
      return res.status(200).json({
        success: false,
        requiresVerification: true,
        error: 'Please verify your email before logging in.',
        status: 'email_unverified',
        email: user.email
      });
    }

    // Check if user is suspended
    if (user.is_suspended) {
      return res.status(403).json({ 
        success: false,
        error: 'Account suspended',
        reason: user.suspension_reason || 'Violation of community guidelines',
        suspended_at: user.suspended_at,
        status: 'suspended'
      });
    }

    // Validate password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    // Generate access token
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, email: user.email }, // Added email to payload for consistency
      jwtSecret,
      { expiresIn: jwtAccessExpiration }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, // Added role to refresh token payload
      jwtRefreshSecret,
      { expiresIn: jwtRefreshExpiration }
    );

    // Send refresh token as HttpOnly cookie
    let maxAgeMs;
    if (typeof jwtRefreshExpiration === 'string') {
        const unit = jwtRefreshExpiration.slice(-1).toLowerCase();
        const value = parseInt(jwtRefreshExpiration.slice(0, -1));

        if (isNaN(value)) {
            logger.error(`Invalid value for JWT_REFRESH_TOKEN_EXPIRATION: ${jwtRefreshExpiration}. Using default 7 days.`);
            maxAgeMs = 7 * 24 * 60 * 60 * 1000; // Default to 7 days
        } else {
            if (unit === 'd') {
                maxAgeMs = value * 24 * 60 * 60 * 1000;
            } else if (unit === 'h') {
                maxAgeMs = value * 60 * 60 * 1000;
            } else if (unit === 'm') {
                maxAgeMs = value * 60 * 1000;
            } else if (unit === 's') {
                maxAgeMs = value * 1000;
            } else {
                logger.warn(`Unsupported unit in JWT_REFRESH_TOKEN_EXPIRATION: '${unit}'. Assuming value is in days. Original value: ${jwtRefreshExpiration}`);
                // Fallback: if unit is unrecognized but value is a number, assume days.
                // Or default to a known safe value if this assumption is too broad.
                maxAgeMs = value * 24 * 60 * 60 * 1000; // Assuming days if unit is unknown
            }
        }
    } else if (typeof jwtRefreshExpiration === 'number') {
        // If jwtRefreshExpiration is already a number (e.g. from a direct env var that's numeric, representing ms), use it directly
        maxAgeMs = jwtRefreshExpiration;
    } else {
        logger.warn(`JWT_REFRESH_TOKEN_EXPIRATION is not a string or number. Defaulting to 7 days. Value: ${jwtRefreshExpiration}`);
        maxAgeMs = 7 * 24 * 60 * 60 * 1000; // Default to 7 days
    }

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: maxAgeMs, // Use the correctly calculated milliseconds
      path: '/api/auth'
    });

    // Get user data without sensitive information
    const userData = {
      id: user.id,
      email: user.email,
      role: user.role,
      is_email_verified: user.is_email_verified,
      profile_complete: user.profile_complete || false,
      created_at: user.created_at,
      updated_at: user.updated_at
    };

    res.json({ 
      success: true,
      token: accessToken, // Send access token in response body
      user: userData,
      requiresProfileSetup: !user.profile_complete
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Login failed. Please try again later.' 
    });
  }
};

// Verify email and redirect to profile setup
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const isApiRequest = req.get('accept')?.includes('application/json');

    if (!token) {
      logger.warn('Email verification attempt without token');
      if (isApiRequest) {
        return res.status(400).json({ success: false, error: 'Token is required' });
      }
      return res.redirect(`${frontendUrl}/login?error=token_required`);
    }

    logger.info(`Verifying email with token: ${token}`);
    const user = await User.findByVerificationToken(token);

    if (!user) {
      logger.warn(`No user found with verification token: ${token}`);
      if (isApiRequest) {
        return res.status(400).json({ success: false, error: 'Invalid or expired token' });
      }
      return res.redirect(`${frontendUrl}/login?error=invalid_token`);
    }

    // Verify the email if not already verified
    if (!user.is_email_verified) {
      logger.info(`Verifying email for user: ${user.email} (ID: ${user.id})`);
      await User.verifyEmail(user.id);
      logger.info(`Email verified for user: ${user.email} (ID: ${user.id})`);
    } else {
      logger.info(`User ${user.email} already verified, proceeding with login`);
    }

    // Generate JWT token for the user
    const authToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Check if user needs to complete profile setup
    const profile = await Profile.findByUserId(user.id);
    const requiresProfileSetup = !profile || !profile.first_name || !profile.birth_date;

    // For API requests, return JSON response
    if (isApiRequest) {
      return res.json({
        success: true,
        message: 'Email verified successfully',
        token: authToken,
        requiresProfileSetup,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          is_email_verified: true
        }
      });
    }

    // For direct browser requests, handle redirects
    const redirectUrl = requiresProfileSetup 
      ? `${frontendUrl}/profile-setup?verified=true&email=${encodeURIComponent(user.email)}`
      : `${frontendUrl}/dashboard`;
      
    logger.info(`Redirecting to: ${redirectUrl}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || frontendUrl);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Set auth cookies
    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost'
    });
    
    // Client-readable token (if needed for certain operations)
    res.cookie('auth_token', authToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? undefined : 'localhost'
    });
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Set a cookie to prevent multiple verification attempts
    res.cookie('email_verified', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 5 * 60 * 1000, // 5 minutes
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : 'localhost'
    });
    
    // For API clients, return a JSON response
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.status(200).json({
        success: true,
        redirect: redirectUrl,
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          isVerified: true
        }
      });
    }
    
    // For browser redirects
    res.redirect(redirectUrl);
  } catch (err) {
    logger.error('Email verification error:', { error: err.message, stack: err.stack });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=verification_failed&message=${encodeURIComponent(err.message)}`);
  }
};

// Get current user information
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Return user data without sensitive information
    const userData = {
      id: user.id,
      email: user.email,
      role: user.role,
      is_email_verified: user.is_email_verified,
      profile_complete: user.profile_complete || false,
      created_at: user.created_at
    };

    res.json({ 
      success: true,
      user: userData
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to retrieve user information' 
    });
  }
};

// Resend verification email
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find user by email using the correct method
    const user = await User.findByEmail(email);
    
    if (!user) {
      return res.status(200).json({
        success: false,
        error: 'No account found with this email address.'
      });
    }

    if (user.is_email_verified) {
      return res.status(200).json({
        success: false,
        error: 'This email has already been verified.'
      });
    }

    // Generate new verification token
    const email_verification_token = crypto.randomBytes(32).toString('hex');
    
    // Update user with new verification token
    await pool.query(
      'UPDATE users SET email_verification_token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [email_verification_token, user.id]
    );

    // Send verification email
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    await sendVerificationEmail(user.email, email_verification_token, baseUrl);

    res.json({
      success: true,
      message: 'Verification email resent. Please check your inbox.'
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email. Please try again later.'
    });
  }
};

// Refresh Token Endpoint
exports.refreshToken = async (req, res) => {
  // Ensure JWT environment variables are set, provide defaults for safety if not
  const jwtSecret = env.JWT_SECRET || 'your_default_jwt_secret'; 
  const jwtAccessExpiration = env.JWT_ACCESS_TOKEN_EXPIRATION || '1h';
  const jwtRefreshSecret = env.JWT_REFRESH_TOKEN_SECRET || 'your_default_jwt_refresh_secret'; 

  const { refreshToken } = req.cookies; // Extract refreshToken from cookies

  if (!refreshToken) {
    return res.status(401).json({ success: false, error: 'Refresh token not found.' });
  }

  try {
    // Verify the refresh token
    // Ensure you use the correct secret for verifying refresh tokens
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret);

    // Check if the user from the refresh token still exists and is active
    const user = await User.findById(decoded.id);
    if (!user || user.is_suspended) {
      res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' });
      return res.status(403).json({ success: false, error: 'User not found or account suspended. Please log in again.' });
    }

    // Generate a new access token
    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role, email: user.email }, 
      jwtSecret, // Use the access token secret here
      { expiresIn: jwtAccessExpiration }
    );

    // Optional: Implement refresh token rotation - generate a new refresh token
    // and update the cookie. For simplicity, we'll reuse the existing one here.

    res.json({
      success: true,
      token: newAccessToken,
      message: 'Access token refreshed successfully.'
    });

  } catch (err) {
    logger.error('Refresh token error:', { error: err.message, stack: err.stack });
    // If refresh token is invalid or expired
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      // Clear the potentially invalid refresh token cookie
      res.clearCookie('refreshToken', { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'strict', 
        path: '/api/auth' // Must match the path used when setting the cookie
      });
      return res.status(403).json({ success: false, error: 'Invalid or expired refresh token. Please log in again.' });
    }
    return res.status(500).json({ success: false, error: 'Could not refresh access token.' });
  }
};