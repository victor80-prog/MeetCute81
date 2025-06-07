const nodemailer = require('nodemailer');
const { templates } = require('../config/email');
const emailConfig = require('../config/email');
const logger = require('../utils/logger');

// Create a transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  logger: false, // Disable logging
  debug: false, // Disable SMTP traffic in the logs
  tls: {
    rejectUnauthorized: false // For development only
  }
});

// Verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Error with email configuration:', error);
    logger.error('Error with email configuration:', error);
  } else {
    console.log('Server is ready to take our messages');
    logger.info('Email server is ready to take our messages');
  }
});

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text content
 */
const sendEmail = async ({ to, subject, html, text }) => {
  console.log('Attempting to send email...');
  console.log('From:', emailConfig.from);
  console.log('To:', to);
  console.log('Subject:', subject);
  
  try {
    // Don't send emails in test environment
    if (process.env.NODE_ENV === 'test') {
      const testMessage = `[TEST] Email not sent to ${to} - ${subject}`;
      console.log(testMessage);
      logger.info(testMessage);
      return { success: true, test: true };
    }

    const mailOptions = {
      from: emailConfig.from,
      to,
      subject,
      text: text || '',
      html: html || ''
    };

    console.log('Mail options:', JSON.stringify(mailOptions, null, 2));
    
    const info = await transporter.sendMail(mailOptions);
    
    const successMessage = `Email sent to ${to}: ${info.messageId}`;
    console.log(successMessage);
    logger.info(successMessage);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMessage = `Error sending email to ${to}: ${error.message}`;
    console.error(errorMessage);
    console.error('Error details:', error);
    logger.error(errorMessage, { error: error.stack });
    return { success: false, error: error.message };
  }
};

/**
 * Send verification email
 * @param {string} email - Recipient email address
 * @param {string} token - Verification token
 * @param {string} baseUrl - Base URL for verification link
 */
const sendVerificationEmail = async (email, token, baseUrl) => {
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  const template = templates.verifyEmail(verificationUrl);
  
  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail
};
