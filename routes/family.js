const express = require('express');
const pool = require('../pool');
const router = express.Router();

async function createFamilyTable() {
    try {
        const query = `
        CREATE TABLE IF NOT EXISTS family (
            id SERIAL PRIMARY KEY,
            family VARCHAR(255),
            date_added TIMESTAMP DEFAULT NOW()
        );
        `;

        await pool.query(query);
        console.log('Family table created');
    } catch (err) {
        console.error(err);
        console.error('Family table creation failed');
    }
}

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM family ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch family data' });
    }
});

// Add a new family
router.post('/', async (req, res) => {
    const { family } = req.body;

    if (!family) {
        return res.status(400).json({ error: 'Family name is required' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO family (family) VALUES ($1) RETURNING *',
            [family]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add family' });
    }
});

// Delete a family
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM family WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Family not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete family' });
    }
});


module.exports = {
    router,
    createFamilyTable
};