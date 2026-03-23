// src/middleware/auth.js - Authentication middleware
const config = require('../config');

function authenticate(req, res, next) {
  const token = req.headers['authorization'];
  
  if (!token) {
    req.userId = null;
    return next();
  }

  // Simple token validation (in production, verify JWT)
  if (token.startsWith('Bearer ')) {
    const decoded = decodeToken(token.slice(7));
    if (decoded && !isExpired(decoded)) {
      req.userId = decoded.userId;
      req.userRole = decoded.role;
    }
  }

  next();
}

function decodeToken(token) {
  try {
    // Simplified: in production use jwt.verify()
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64').toString());
  } catch {
    return null;
  }
}

function isExpired(decoded) {
  return decoded.exp && decoded.exp < Date.now() / 1000;
}

module.exports = authenticate;
