const express = require('express');
const cors = require('cors');
const pool = require('./pool'); // Import the pool instance from pool.js
const app = express();
const port = 8080;

const signupRoutes = require('./routes/signup');
const loginRoutes = require('./routes/login');
const { router: usersRoutes, createUsersTable, createSuperAdminIfNeeded } = require('./routes/users');
const { router: familyRoutes, createFamilyTable } = require('./routes/family');

app.use(express.json());
app.use(cors());
app.use('/signup', signupRoutes);
app.use('/login', loginRoutes);
app.use('/users', usersRoutes);
app.use('/family', familyRoutes);

// Call the table creation functions
createUsersTable();
createFamilyTable();
createSuperAdminIfNeeded();

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
