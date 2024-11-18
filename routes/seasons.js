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
                    console.warn("Week data is not an array:", weekData);
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
            
            const week1 = addWeekData(record.sdfa_points[0].week1);
            const week2 = addWeekData(record.sdfa_points[0].week2);
            const week3 = addWeekData(record.sdfa_points[0].week3);
            const week4 = addWeekData(record.sdfa_points[0].week4);
            const week5 = addWeekData(record.sdfa_points[0].week5);
            
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

            return {
                ...record,
                upr: upr,
                sdfa_points: sdfa_points
            };
        });

        const avgPoints = calculateAvgPoints(transformedData);

        const finalData = {
            avgPoints: avgPoints,
            data: transformedData
        };

        console.log(JSON.stringify(finalData, null, 2));

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
        const result = await pool.query('SELECT * FROM derbySdfa');

        if (result.rows.length === 0) {
            return res.status(200).json({ avgPoints: 0, data: [] });
        }

        const avgPoints = calculateAvgPoints(result.rows);
        const avgFactorF = calculateAvgFactorF(result.rows);
        console.log('AvgFactorF:', avgFactorF);

        const responseData = {
            avgPoints: avgPoints,
            avgFactorF: avgFactorF,
            data: result.rows
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