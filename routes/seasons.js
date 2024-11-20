const express = require('express');
const pool = require('../pool');
const router = express.Router();
const fs = require('fs');

async function createDerbySdfaTable() {
    try {
        const query = `
        CREATE TABLE IF NOT EXISTS derbySdfa (
            id VARCHAR PRIMARY KEY,  
            line VARCHAR,
            family VARCHAR,
            sire VARCHAR,
            dam VARCHAR,
            week1 JSONB,
            week2 JSONB,
            week3 JSONB,
            week4 JSONB,
            week5 JSONB,
            upr VARCHAR,
            sd VARCHAR,
            sdfa_coefficient VARCHAR,
            remarks VARCHAR,
            sdfa_points JSONB
        );
        `;

        await pool.query(query);
        console.log('DerbySdfa table created');
    } catch (err) {
        console.error(err);
        console.error('DerbySdfa table creation failed');
    }
}

async function importDataFromJson() {
    const data = JSON.parse(fs.readFileSync('C:/Program Files/PostgreSQL/17/data/derbySdfa.json', 'utf8'));

    // SQL query for inserting or updating data
    const insertQuery = `
    INSERT INTO derbySdfa (
        id, line, family, sire, dam, sd, remarks, sdfa_coefficient, sdfa_points
    ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
    )
    ON CONFLICT (id) DO UPDATE SET
        line = EXCLUDED.line,
        family = EXCLUDED.family,
        sire = EXCLUDED.sire,
        dam = EXCLUDED.dam,
        sd = EXCLUDED.sd,
        remarks = EXCLUDED.remarks,
        sdfa_coefficient = EXCLUDED.sdfa_coefficient,
        sdfa_points = EXCLUDED.sdfa_points
    RETURNING *;
    `;

    for (const item of data.data) {
        // Modify `sdfa_coefficient` to include the calculated "week" value
        const updatedSdfaCoefficient = item.sdfa_coefficient.map((weekData) => {
            return Object.entries(weekData).reduce((result, [week, values]) => {
                const rank = parseFloat(values.rank || 0);
                const totalBirds = parseFloat(values.totalBirds || 0);

                // Calculate "week" using the formula rank / totalBirds
                const weekValue = totalBirds !== 0 ? (rank / totalBirds).toFixed(2) : '0.00';

                result[week] = { ...values, week: weekValue }; // Add calculated "week" to the object
                return result;
            }, {});
        });

        // Parse and modify `sdfa_points` to include `upr`
        const updatedSdfaPoints = item.sdfa_points.map((weekData) => {
            return Object.entries(weekData).reduce((result, [week, values]) => {
                const points = parseFloat(values.points || 0);
                const f = parseFloat(values.f || 0);
                const upr = points * f; // Calculate upr
                result[week] = { ...values, upr }; // Add upr to the object
                return result;
            }, {});
        });

        // Prepare query values
        const values = [
            item.id,
            item.line,
            item.family,
            item.sire,
            item.dam,
            item.sd,
            item.remarks,
            JSON.stringify(updatedSdfaCoefficient), // Add updated JSON with calculated "week"
            JSON.stringify(updatedSdfaPoints), // Add updated JSON with `upr`
        ];

        try {
            const result = await pool.query(insertQuery, values);
            console.log('Inserted Data:', result.rows[0]);
        } catch (err) {
            console.error('Error importing data:', err);
        }
    }
}


router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM derbySdfa');

        // Map through the rows and parse `sdfa_coefficient` from string to JSON
        const formattedResult = result.rows.map((row) => {
            return {
                ...row,
                sdfa_coefficient: JSON.parse(row.sdfa_coefficient), // Convert JSON string to object
            };
        });

        res.status(200).json(formattedResult);
    } catch (err) {
        console.error('Error fetching derbySdfa:', err);
        res.status(500).json({ message: 'Failed to fetch derbySdfa' });
    }
});


module.exports = {
    router,
    createDerbySdfaTable,
    importDataFromJson
}