const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1]; // Extract Bearer token

    if (!token) {
        return res.status(401).json({ error: 'Access denied, no token provided' });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user; // Attach user info to request
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid or expired token' });
    }
}

module.exports = authenticateToken;
