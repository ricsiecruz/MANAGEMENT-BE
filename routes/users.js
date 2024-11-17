const express = require('express');
const pool = require('../pool'); // Import the pool instance
const User = require('../models/user');
const router = express.Router();

async function createSuperAdminIfNeeded() {
  const superAdminEmail = 'super_admin@mail.com';
  const superAdminPassword = '123qwe'; // Ideally hash this password before storing it

  try {
      const existingSuperAdmin = await User.findOne({ where: { email: superAdminEmail } });
      if (!existingSuperAdmin) {
          await User.create({
              email: superAdminEmail,
              password: superAdminPassword,
              role: 'super_admin',
          });
          console.log('Super Admin created!');
      } else {
          console.log('Super Admin already exists.');
      }
  } catch (err) {
      console.error('Error creating super admin:', err);
  }
}

async function createUsersTable() {
    try {
        const query = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            contact VARCHAR(15),
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            date_registered TIMESTAMP DEFAULT NOW()
        );
        `;

        await pool.query(query);
        console.log('Users table created');
    } catch (err) {
        console.error(err);
        console.error('Users table creation failed');
    }
}

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching users', err);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

module.exports = {
    router, // Export the router for routing
    createUsersTable, // Export the function to create the table
    createSuperAdminIfNeeded
};
