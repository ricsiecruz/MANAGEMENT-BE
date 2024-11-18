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

    try {
        for (const record of data.data) {
            // Modify week data to include weekNo (week calculation) directly in the week objects
            const addWeekNoToData = (weekData) => {
                return weekData.map(week => {
                    if (week.rank && week.totalBirds) {
                        const rank = parseFloat(week.rank);
                        const totalBirds = parseFloat(week.totalBirds);
                        // Round to two decimal places
                        week.week = (rank / totalBirds).toFixed(2);  // Week number formula rounded to two decimals
                    } else {
                        week.week = null;  // If no rank or totalBirds, set week to null
                    }
                    return week;
                });
            };

            // Add weekNo directly to each week (week1, week2, etc.)
            const week1 = addWeekNoToData(record.week1);
            const week2 = addWeekNoToData(record.week2);
            const week3 = addWeekNoToData(record.week3);
            const week4 = addWeekNoToData(record.week4);
            const week5 = addWeekNoToData(record.week5);

            const query = `
                INSERT INTO derbySdfa (
                    id, line, family, sire, dam, week1, week2, week3, week4, week5, upr, sd, sdfa_coefficient, remarks, sdfa_points
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                )
                ON CONFLICT (id) DO UPDATE SET
                    line = EXCLUDED.line,
                    family = EXCLUDED.family,
                    sire = EXCLUDED.sire,
                    dam = EXCLUDED.dam,
                    week1 = EXCLUDED.week1,
                    week2 = EXCLUDED.week2,
                    week3 = EXCLUDED.week3,
                    week4 = EXCLUDED.week4,
                    week5 = EXCLUDED.week5,
                    upr = EXCLUDED.upr,
                    sd = EXCLUDED.sd,
                    sdfa_coefficient = EXCLUDED.sdfa_coefficient,
                    remarks = EXCLUDED.remarks,
                    sdfa_points = EXCLUDED.sdfa_points;
            `;

            const values = [
                record.id, 
                record.line, 
                record.family, 
                record.sire, 
                record.dam, 
                JSON.stringify(week1), 
                JSON.stringify(week2), 
                JSON.stringify(week3), 
                JSON.stringify(week4), 
                JSON.stringify(week5), 
                record.upr, 
                record.sd, 
                record.sdfa_coefficient, 
                record.remarks, 
                JSON.stringify(record.sdfaPoints)
            ];

            await pool.query(query, values);
        }
        console.log('Data imported successfully');
    } catch (err) {
        console.error('Error importing data:', err);
    }
}

router.get('/', async(req, res) => {
    try {
        const result = await pool.query('SELECT * FROM derbySdfa');
        res.status(200).json(result.rows);  // The result will include weekNo
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