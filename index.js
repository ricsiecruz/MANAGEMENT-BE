const express = require('express');
const cors = require('cors');
const pool = require('./pool'); // Import the pool instance from pool.js
const app = express();
const port = 8080;

const signupRoutes = require('./routes/signup');
const loginRoutes = require('./routes/login');
const { router: usersRoutes, createUsersTable, createSuperAdminIfNeeded } = require('./routes/users');
const { router: familyRoutes, createFamilyTable } = require('./routes/family');
const { router: menuRoutes, createMenuTable, populateInitialMenus } = require('./routes/menu');
const { router: seasonsRoutes, createDerbySdfaTable, importDataFromJson } = require('./routes/seasons');

app.use(express.json());
app.use(cors());
app.use('/signup', signupRoutes);
app.use('/login', loginRoutes);
app.use('/users', usersRoutes);
app.use('/family', familyRoutes);
app.use('/menu', menuRoutes);
app.use('/seasons', seasonsRoutes);

// Call the table creation functions

async function initialize() {
    await createUsersTable();
    await createFamilyTable();
    await createSuperAdminIfNeeded();
    await createMenuTable(); // Create the menu table if it doesn't exist
    await populateInitialMenus(); // Populate the menu table with initial data
    await createDerbySdfaTable();
    await importDataFromJson();
}

initialize().then(() => {
    app.listen(port, () => {
        console.log(`App listening on port ${port}`);
    });
}).catch(err => {
    console.error('Error during initialization:', err);
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await pool.end();
    process.exit(0);
});
