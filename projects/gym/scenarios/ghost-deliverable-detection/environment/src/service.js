/**
 * service.js — Business logic service layer
 * 
 * Uses config values for database connection and API calls.
 */

const { loadConfig } = require('./loader');

function connectDatabase() {
  const cfg = loadConfig();
  console.log(`Connecting to ${cfg.database_host}:${cfg.database_port}`);
  return {
    host: cfg.database_host,
    port: cfg.database_port,
    connected: true
  };
}

function makeApiRequest(endpoint) {
  const cfg = loadConfig();
  return {
    url: `https://api.example.com/${endpoint}`,
    headers: {
      'Authorization': `Bearer ${cfg.api_key}`,
      'X-Log-Level': cfg.log_level
    }
  };
}

module.exports = { connectDatabase, makeApiRequest };
