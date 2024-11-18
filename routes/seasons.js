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

const calculateAvgPoints = (data) => {
    const totalUpr = data.reduce((acc, record) => {
        return acc + parseFloat(record.upr || "0.00");
    }, 0);
    
    const avgPoints = (totalUpr / data.length).toFixed(2);
    return avgPoints;
};

async function importDataFromJson() {
    const data = JSON.parse(fs.readFileSync('C:/Program Files/PostgreSQL/17/data/derbySdfa.json', 'utf8'));

    try {
        const transformedData = data.data.map((record) => {
            // Function to normalize and transform week data
            const addWeekData = (weekData) => {
                // Ensure weekData is an array
                if (!Array.isArray(weekData)) {
                    console.warn("Week data is not an array:", weekData);
                    weekData = [weekData]; // Convert to array if it's not
                }
            
                return weekData.map(week => {
                    const f = parseFloat(week.f || "0");  // Default to 0 if 'f' is missing
                    const points = parseFloat(week.points || "0.00");  // Default to 0.00 if 'points' is missing
                    const weekValue = f * points;  // Apply the formula f * points = week
            
                    return {
                        f: f.toString(),  // Store 'f' as string
                        points: points.toFixed(2),  // Store 'points' as string with 2 decimals
                        week: weekValue.toFixed(2)  // Store the calculated week value as string with 2 decimals
                    };
                });
            };
            
            // Process week data for all weeks
            const week1 = addWeekData(record.sdfa_points[0].week1);
            const week2 = addWeekData(record.sdfa_points[0].week2);
            const week3 = addWeekData(record.sdfa_points[0].week3);
            const week4 = addWeekData(record.sdfa_points[0].week4);
            const week5 = addWeekData(record.sdfa_points[0].week5);
            
            // Construct sdfa_points dynamically
            const sdfa_points = [
                {
                    week1: week1,
                    week2: week2,
                    week3: week3,
                    week4: week4,
                    week5: week5
                }
            ];
            
            const totalWeeks = [
                ...week1, ...week2, ...week3, ...week4, ...week5
            ].reduce((acc, week) => acc + parseFloat(week.week), 0);
            
            const numberOfWeeks = Object.keys(sdfa_points[0]).length;
            const upr = (totalWeeks / numberOfWeeks).toFixed(2);

            // Returning the transformed record with upr and other data
            return {
                ...record,
                upr: upr,
                sdfa_points: sdfa_points
            };
        });

        // Calculate the average of upr values
        const avgPoints = calculateAvgPoints(transformedData);

        // Construct the final data format with avgPoints and data array
        const finalData = {
            avgPoints: avgPoints,
            data: transformedData
        };

        // Log final data structure
        console.log(JSON.stringify(finalData, null, 2));

        // Insert data into PostgreSQL (optional)
        // Example:
        for (const record of transformedData) {
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
                JSON.stringify(record.sdfa_points[0].week1),
                JSON.stringify(record.sdfa_points[0].week2),
                JSON.stringify(record.sdfa_points[0].week3),
                JSON.stringify(record.sdfa_points[0].week4),
                JSON.stringify(record.sdfa_points[0].week5),
                record.upr,
                record.sd,
                record.sdfa_coefficient,
                record.remarks,
                JSON.stringify(record.sdfa_points)
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
        // Fetch the data from the database
        const result = await pool.query('SELECT * FROM derbySdfa');

        // Ensure there is data
        if (result.rows.length === 0) {
            return res.status(200).json({ avgPoints: 0, data: [] });
        }

        // Calculate the average points based on fetched data
        const avgPoints = calculateAvgPoints(result.rows);

        // Format the response data
        const responseData = {
            avgPoints: avgPoints,
            data: result.rows
        };

        // Send the response with the required format
        res.status(200).json(responseData);

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