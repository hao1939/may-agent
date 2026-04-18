// src/config/overrides.js - Environment-specific overrides
// In production, we might override certain values
module.exports = {
  logLevel: process.env.LOG_LEVEL || 'info'
};
