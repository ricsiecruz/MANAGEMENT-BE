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

const calculateAvgFactorF = (data) => {
    let totalFactorSum = 0;
    let totalFCount = 0;

    for (let weekIndex = 1; weekIndex <= 5; weekIndex++) {
        const weekKey = `week${weekIndex}`;
        const weekData = data.map(record => record.sdfa_points[0][weekKey]).flat();

        const sumF = weekData.reduce((acc, week) => acc + parseFloat(week.f || "0"), 0);
        const countF = weekData.length;

        totalFactorSum += sumF * countF;
        totalFCount += countF;
    }

    const avgFactorF = (totalFactorSum / totalFCount).toFixed(2);
    return avgFactorF;
};

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
            JSON.stringify(item.sdfa_coefficient),
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

        const data = result.rows.forEach((row, index) => {
            console.log(`Row ${index + 1}:`);
            console.log('week1:', JSON.stringify(row.week1, null, 2)); // Pretty print week1 array
          });
          

        console.log('result', data)

        if (result.rows.length === 0) {
            return res.status(200).json({ avgPoints: 0, data: [] });
        }

        const avgPoints = calculateAvgPoints(result.rows);
        const avgFactorF = calculateAvgFactorF(result.rows);

        const transformedData = result.rows.map(record => {
            console.log('get api record', record)
            const sdfaPoints = record.sdfa_points[0];
            const weeksData = Object.keys(sdfaPoints).reduce((acc, weekKey) => {
                const week = sdfaPoints[weekKey];

                const weekPoints = {
                    points: parseFloat(week[0]?.points || "0").toFixed(2),
                    f: parseFloat(week[0]?.f || "0").toFixed(2),
                    week: parseFloat(week[0]?.week || "0").toFixed(2),
                };

                const weekCoefficient = {
                    rank: weekKey === 'week1' ? 1 : null, // Replace with actual rank calculation
                    totalBirds: week.length || 0,          // Replace with actual total birds calculation
                    week: parseFloat(week[0]?.week || "0").toFixed(2),
                };

                acc.sdfaPoints[weekKey] = weekPoints;
                acc.sdfaCoefficient[weekKey] = weekCoefficient;

                return acc;
            }, { sdfaPoints: {}, sdfaCoefficient: {} });

            const sd = (parseFloat(record.upr) - parseFloat(avgPoints)).toFixed(2);
            const sdfaPointsFormula = (parseFloat(record.sd) / parseFloat(avgPoints)).toFixed(2);

            return {
                id: record.id,
                line: record.line,
                family: record.family,
                sire: record.sire,
                dam: record.dam,
                sdfa_coefficient: {
                    data:[weeksData.sdfaCoefficient]
                },
                remarks: record.remarks,
                sdfa_points: {
                    upr: record.upr,
                    sd: sd,
                    sdfaPointsFormula: sdfaPointsFormula,
                    data: [weeksData.sdfaPoints]
                }
            };
        });

        const responseData = {
            avgPoints: avgPoints,
            avgFactorF: avgFactorF,
            data: transformedData,
        };

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