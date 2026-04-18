// src/middleware/cors.js - CORS middleware
const config = require('../config');

function cors(req, res, next) {
  const { origin, methods } = config.cors;
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  next();
}

module.exports = cors;
