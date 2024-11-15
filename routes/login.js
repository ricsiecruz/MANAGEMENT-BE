const express = require('express');
const bcrypt = require('bcrypt'); // To compare hashed passwords
const jwt = require('jsonwebtoken'); // For generating JWT tokens
const router = express.Router();

require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

// Import the database connection pool
const pool = require('../pool'); // Adjust path based on your project structure

// Hardcoded super admin credentials
const SUPER_ADMIN_EMAIL = 'super_admin@mail.com';
const SUPER_ADMIN_PASSWORD = '123qwe';

router.post('/', async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Check for hardcoded super admin credentials
        if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
            const token = jwt.sign(
                { email, role: 'super_admin' },
                JWT_SECRET,
                { expiresIn: '1h' } // Token valid for 1 hour
            );
            return res.status(200).json({
                message: 'Login successful',
                role: 'super_admin',
                token: token,
            });
        }

        // Find the user by email
        const query = `SELECT * FROM users WHERE email = $1;`;
        const values = [email];
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Generate a JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '1h' } // Token valid for 1 hour
        );

        res.status(200).json({
            message: 'Login successful',
            role: user.role,
            token: token,
        });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
