const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../pool');
const router = express.Router();

router.post('/', async (req, res) => {
  const { name, email, contact, password } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const query = `
      INSERT INTO users (name, email, contact, password)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, contact, date_registered;
    `;

    const values = [name, email, contact, hashedPassword];

    const result = await pool.query(query, values);
    const newUser = result.rows[0];

    // Send response
    res.status(201).json({
      message: 'User signed up successfully',
      user: newUser,
    });
  } catch (err) {
    if (err.code === '23505') {
      // Unique constraint violation
      res.status(400).json({ error: 'Email already in use' });
    } else {
      console.error('Error during signup:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

module.exports = router;