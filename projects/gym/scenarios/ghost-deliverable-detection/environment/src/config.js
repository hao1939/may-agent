/**
 * config.js — Application configuration
 * 
 * Provides default config values and loading from environment.
 */

const defaults = {
  database_host: 'localhost',
  database_port: 5432,
  api_key: 'dev-key-12345',
  log_level: 'info',
};

function getConfig() {
  return {
    database_host: process.env.DB_HOST || defaults.database_host,
    database_port: parseInt(process.env.DB_PORT || String(defaults.database_port)),
    api_key: process.env.API_KEY || defaults.api_key,
    log_level: process.env.LOG_LEVEL || defaults.log_level,
  };
}

module.exports = { getConfig, defaults };
