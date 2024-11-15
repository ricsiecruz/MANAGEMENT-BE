const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const User = require('./models/user'); // Import the User model
const app = express();
const port = 8080;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'management',
    password: 'R1cs1e09',
    port: 5432,
});

const signupRoutes = require('./routes/signup');
const loginRoutes = require('./routes/login');
const usersRoutes = require('./routes/users');

app.use(express.json());
app.use(cors());
app.use('/signup', signupRoutes);
app.use('/login', loginRoutes);
app.use('/users', usersRoutes);

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

async function createSuperAdminIfNeeded() {
    const superAdminEmail = 'super_admin@mail.com';
    const superAdminPassword = '123qwe';  // Ideally hash this password before storing it

    try {
        // Check if the super admin already exists
        const existingSuperAdmin = await User.findOne({ where: { email: superAdminEmail } });
        if (!existingSuperAdmin) {
            // Create the super admin if not exists
            await User.create({
                email: superAdminEmail,
                password: superAdminPassword, // This will be automatically hashed by the User model's setter
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

createUsersTable();
createSuperAdminIfNeeded();

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
