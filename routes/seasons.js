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

    try {
        const transformedData = data.data.map((record) => {
            const addWeekData = (weekData) => {
                if (!Array.isArray(weekData)) {
                    weekData = [weekData];
                }

                return weekData.map(week => {
                    const f = parseFloat(week.f || "0");
                    const points = parseFloat(week.points || "0.00");
                    const weekValue = f * points;

                    return {
                        f: f.toString(),
                        points: points.toFixed(2),
                        week: weekValue.toFixed(2)
                    };
                });
            };

            const weeks = {};
            for (let i = 1; i <= 5; i++) {
                weeks[`week${i}`] = addWeekData(record.sdfa_points[0][`week${i}`]);
            }

            const sdfa_points = [weeks];
            const totalWeeks = Object.values(weeks).flat()
                .reduce((acc, week) => acc + parseFloat(week.week), 0);
            const numberOfWeeks = Object.keys(sdfa_points[0]).length;
            const upr = (totalWeeks / numberOfWeeks).toFixed(2);

            return {
                ...record,
                upr: upr,
                sdfa_points: sdfa_points
            };
        });

        // Calculate avgPoints AFTER transforming data
        const avgPoints = calculateAvgPoints(transformedData);

        const finalData = {
            avgPoints: avgPoints,
            data: transformedData
        };

        // console.log(JSON.stringify(finalData, null, 2));

        // Now that avgPoints is available, proceed with inserting data into the database
        for (const record of transformedData) {
            const sd = (parseFloat(record.upr) - parseFloat(avgPoints)).toFixed(2);  // Calculate sd here

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
                sd,  // Include sd here
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

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM derbySdfa');

        if (result.rows.length === 0) {
            return res.status(200).json({ avgPoints: 0, data: [] });
        }

        const avgPoints = calculateAvgPoints(result.rows);
        const avgFactorF = calculateAvgFactorF(result.rows);

        const transformedData = result.rows.map(record => {
            // Extract weeks from sdfa_points
            const sdfaPoints = record.sdfa_points[0];
            const weeksData = {
                week1: sdfaPoints.week1,
                week2: sdfaPoints.week2,
                week3: sdfaPoints.week3,
                week4: sdfaPoints.week4,
                week5: sdfaPoints.week5
            };

            // Calculate sd using upr - avgPoints
            const sd = (parseFloat(record.upr) - parseFloat(avgPoints)).toFixed(2);
            console.log('sd', sd, 'avgPoints', avgPoints)
            const sdfaPointsFormula = (parseFloat(record.sd) / parseFloat(avgPoints)).toFixed(2);

            return {
                id: record.id,
                line: record.line,
                family: record.family,
                sire: record.sire,
                dam: record.dam,
                week1: record.week1,
                week2: record.week2,
                week3: record.week3,
                week4: record.week4,
                week5: record.week5,
                sdfa_coefficient: record.sdfa_coefficient,
                remarks: record.remarks,
                sdfa_points: {
                    upr: record.upr,
                    sd: sd,
                    sdfaPointsFormula: sdfaPointsFormula,
                    data: [weeksData]
                }
            };
        });

        const responseData = {
            avgPoints: avgPoints,
            avgFactorF: avgFactorF,
            data: transformedData
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