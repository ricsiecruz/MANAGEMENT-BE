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
        // Calculate updated `sdfa_coefficient` with "week" and `upr`
        const updatedSdfaCoefficient = item.sdfa_coefficient.map((weekData) => {
            // Calculate "week" values
            const weekValues = Object.entries(weekData).reduce((result, [week, values]) => {
                const rank = parseFloat(values.rank || 0);
                const totalBirds = parseFloat(values.totalBirds || 0);

                // Calculate "week" using the formula rank / totalBirds
                const weekValue = totalBirds !== 0 ? (rank / totalBirds).toFixed(2) : '0.00';

                result[week] = { ...values, week: weekValue }; // Add calculated "week" to the object
                return result;
            }, {});

            // Calculate `upr` as the average of all "week" values
            const weekAverages = Object.values(weekValues)
                .map((value) => parseFloat(value.week || 0))
                .filter((num) => !isNaN(num)); // Exclude non-numeric values

            const upr = weekAverages.length > 0
                ? (weekAverages.reduce((sum, value) => sum + value, 0) / weekAverages.length).toFixed(2)
                : '0.00';

            // Return the modified structure
            return {
                upr, // Add `upr` at the root level
                data: [weekValues] // Add weeks data as `data`
            };
        });

        // Convert the array of `sdfa_coefficient` to the desired structure
        const formattedSdfaCoefficient = updatedSdfaCoefficient.length > 0
            ? { upr: updatedSdfaCoefficient[0].upr, data: updatedSdfaCoefficient[0].data }
            : null;

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
            JSON.stringify(formattedSdfaCoefficient), // Add updated JSON with calculated `upr` and "week"
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
        // Fetch data from the database
        const result = await pool.query('SELECT * FROM derbySdfa');

        // Calculate the average of all sdfa_coefficient.upr values
        let totalUpr = 0;
        let validUprCount = 0;

        const response = {
            aveUPR: null,  // Initialize AveUPR
            data: result.rows.map((row) => {
                let sdfaCoefficient = [];
                
                // Validate sdfa_coefficient format
                if (typeof row.sdfa_coefficient === 'string') {
                    try {
                        sdfaCoefficient = JSON.parse(row.sdfa_coefficient);
                        if (!Array.isArray(sdfaCoefficient)) {
                            throw new Error('Invalid sdfa_coefficient data (not an array)');
                        }
                    } catch (error) {
                        console.error('Error parsing sdfa_coefficient:', error);
                    }
                } else if (Array.isArray(row.sdfa_coefficient)) {
                    sdfaCoefficient = row.sdfa_coefficient; // Use directly if it's already an array
                } else {
                    console.warn('Invalid sdfa_coefficient data:', row.sdfa_coefficient);
                }

                // Extract and accumulate valid upr values
                if (sdfaCoefficient && sdfaCoefficient.upr) {
                    const upr = parseFloat(sdfaCoefficient.upr);
                    if (!isNaN(upr)) {
                        totalUpr += upr;
                        validUprCount++;
                    }
                }

                // Function to safely parse JSON or return the original object
                const safeParseJson = (data) => {
                    try {
                        return typeof data === 'string' ? JSON.parse(data) : data;
                    } catch (error) {
                        console.error('Error parsing data:', error);
                        return [];
                    }
                };

                return {
                    id: row.id,
                    line: row.line,
                    family: row.family,
                    sire: row.sire,
                    dam: row.dam,
                    week1: safeParseJson(row.week1),
                    week2: safeParseJson(row.week2),
                    week3: safeParseJson(row.week3),
                    week4: safeParseJson(row.week4),
                    week5: safeParseJson(row.week5),
                    upr: row.upr || "0.00",
                    sd: row.sd || "",
                    sdfa_coefficient: sdfaCoefficient,
                    remarks: row.remarks || "",
                    sdfa_points: safeParseJson(row.sdfa_points),
                    weekno: row.weekno || null,
                };
            })
        };

        // Calculate AveUPR by averaging the valid upr values
        if (validUprCount > 0) {
            response.aveUPR = (totalUpr / validUprCount).toFixed(2); // Round to 2 decimal places
        } else {
            response.aveUPR = "0.00";  // Default value if no valid upr values
        }

        // Send the structured response
        res.status(200).json([response]);

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