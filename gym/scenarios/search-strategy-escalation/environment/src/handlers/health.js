// src/handlers/health.js - Health check endpoint
const config = require('../config');

function healthCheck(req, res) {
  res.end(JSON.stringify({
    status: 'ok',
    version: '2.1.0',
    uptime: process.uptime(),
    config: {
      port: config.port,
      rateLimitEnabled: config.rateLimit.enabled
    }
  }));
}

module.exports = { healthCheck };
