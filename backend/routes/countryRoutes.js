const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Get all countries
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, code, phone_code FROM countries ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching countries:', err);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get country by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, code, phone_code FROM countries WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching country:', err);
    res.status(500).json({ error: 'Failed to fetch country' });
  }
});

module.exports = router;
