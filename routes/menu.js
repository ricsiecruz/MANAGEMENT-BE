const express = require('express');
const pool = require('../pool');
const router = express.Router();

async function createMenuTable() {
    try {
        const query = `
        CREATE TABLE IF NOT EXISTS menu (
            id SERIAL PRIMARY KEY,
            link VARCHAR(255),
            label VARCHAR(255),
            date_created TIMESTAMP DEFAULT NOW()
        );
        `;

        await pool.query(query);
        console.log('Menu table created');
    } catch(err) {
        console.error(err);
        console.error('Menu table creation failed');
    }
}

async function populateInitialMenus() {
    const initialMenus = [
        { link: 'derby-sdfa', label: 'DERBY-SDFA' },
        { link: 'database', label: 'Database' },
        { link: 'users', label: 'Users' }
    ];

    try {
        for (const menu of initialMenus) {
            // Check if the menu item already exists
            const checkQuery = `
                SELECT COUNT(*) 
                FROM menu 
                WHERE LOWER(link) = LOWER($1) AND LOWER(label) = LOWER($2)
            `;
            const checkResult = await pool.query(checkQuery, [menu.link, menu.label]);
            const count = parseInt(checkResult.rows[0].count, 10);

            if (count === 0) {
                // Insert the missing menu item
                const insertQuery = `
                    INSERT INTO menu (link, label)
                    VALUES ($1, $2)
                    RETURNING id, link, label, date_created
                `;
                const insertResult = await pool.query(insertQuery, [menu.link, menu.label]);
                console.log('Inserted missing menu item:', insertResult.rows[0]);
            } else {
                console.log(`Menu item '${menu.label}' already exists. Skipping.`);
            }
        }
    } catch (err) {
        console.error('Error populating initial menus:', err);
    }
}

router.get('/', async(req, res) => {
    try {
        const result = await pool.query('SELECT * FROM menu ORDER BY id');
        res.json(result.rows);
    } catch(err) {
        res.status(500).json({error: 'Failed to fetch menu data' });
    }
});

router.post('/', async(req, res) => {
    const { link, label } = req.body;

    try {
        const query = `
            INSERT INTO menu (link, label)
            VALUES ($1, $2)
            RETURNING id, link, label, date_created
        `;

        const values = [link, label];

        const result = await pool.query(query, values);
        const newMenu = result.rows[0];

        res.status(201).json({
            message: 'Menu added successfully',
            menu: newMenu
        });
    } catch (err) {
        console.error('Error adding menu:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = {
    router,
    createMenuTable,
    populateInitialMenus
};