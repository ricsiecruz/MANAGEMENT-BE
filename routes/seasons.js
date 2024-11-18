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
            const query = `
                INSERT INTO derbySdfa (
                    id, line, family, sire, dam, week1, week2, week3, week4, week5, upr, sd, sdfa_coefficient, remarks, sdfa_points
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
                )
            `;
            const values = [
                record.id, 
                record.line, 
                record.family, 
                record.sire, 
                record.dam, 
                JSON.stringify(record.week1), 
                JSON.stringify(record.week2), 
                JSON.stringify(record.week3), 
                JSON.stringify(record.week4), 
                JSON.stringify(record.week5), 
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
    } finally {
        // Close the pool connection after the operation is completed
        await pool.end();
    }
}

module.exports = {
    router,
    createDerbySdfaTable,
    importDataFromJson
}