const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Ensure database.js exports a connected Sequelize instance

const User = sequelize.define('User', {
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        set(value) {
            const bcrypt = require('bcrypt');
            const hashedPassword = bcrypt.hashSync(value, 10); // Hashing password
            this.setDataValue('password', hashedPassword);
        },
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'user',
    },
});

module.exports = User;
