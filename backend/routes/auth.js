const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const pool = require('../config/db');

// Test DB connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Database connection error', err.stack);
  } else {
    console.log('Database connected');
  }
});

// User registration
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, role || 'user']
    );
    res.json(newUser.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user.rows.length) return res.status(400).json({ error: 'Invalid credentials' });
    
    const isValidPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!isValidPassword) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { id: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user information
router.get('/me', isAuthenticated, async (req, res) => {
  try {
    // Get user info including profile_complete status
    const result = await pool.query('SELECT id, email, role, profile_complete FROM users WHERE id = $1', [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to retrieve user information' });
  }
});

module.exports = router;