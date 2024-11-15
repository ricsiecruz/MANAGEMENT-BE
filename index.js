const express = require('express')
const cors = require('cors');
const { Pool } = require('pg');
const app = express()
const port = 8080

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
            email VARCHAR(255) NOT NULL,
            contact VARCHAR(15),
            password VARCHAR(255) NOT NULL,
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
  
createUsersTable();

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})