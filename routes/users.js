const express = require('express');
const pool = require('../pool');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
      // Query to get all users
      const result = await pool.query('SELECT * FROM users');
      
      // Send back the results
      res.status(200).json(result.rows); // Sending users as JSON response
    } catch (err) {
      console.error('Error fetching users', err);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
});

module.exports = router;