// src/config/index.js - Main configuration
const defaults = require('./defaults');
const overrides = require('./overrides');

function loadConfig() {
  return {
    ...defaults,
    ...overrides,
    rateLimit: {
      ...defaults.rateLimit,
      ...(overrides.rateLimit || {})
    }
  };
}

module.exports = loadConfig();
