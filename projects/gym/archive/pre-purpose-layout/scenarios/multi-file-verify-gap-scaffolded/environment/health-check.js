/**
 * Health Check — exposes health endpoint data using config.
 * This file uses a DIFFERENT import pattern than server.js.
 */

const configLoader = require('./config-loader');

function getHealthStatus(overrides) {
  // Uses the module object pattern, not destructured
  const config = configLoader.loadConfig(overrides);
  
  return {
    status: 'ok',
    uptime: process.uptime(),
    config: {
      port: config.port,
      host: config.host,
      logLevel: config.logLevel,
      maxConnections: config.maxConnections
    },
    timestamp: new Date().toISOString()
  };
}

function checkDependencies() {
  try {
    // Verify config loads without error
    configLoader.loadConfig();
    return { configLoader: 'ok' };
  } catch (e) {
    return { configLoader: 'error', message: e.message };
  }
}

module.exports = { getHealthStatus, checkDependencies };
