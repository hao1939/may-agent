/**
 * Application Configuration
 */

const defaults = {
  port: 3000,
  host: '0.0.0.0',
  rateLimit: 100,  // requests per minute
  apiSecret: process.env.API_SECRET || 'dev-secret-key',
  logLevel: 'info',
  corsOrigins: ['https://app.example.com'],
  sessionTimeout: 3600,
  maxPayloadSize: '10mb'
};

let _config = null;

/**
 * Get the current configuration.
 * Merges defaults with any environment overrides.
 */
function getConfig() {
  if (_config) return _config;

  _config = {
    ...defaults,
    port: parseInt(process.env.PORT) || defaults.port,
    host: process.env.HOST || defaults.host,
    logLevel: process.env.LOG_LEVEL || defaults.logLevel,
    rateLimit: parseInt(process.env.RATE_LIMIT) || defaults.rateLimit,
  };

  return _config;
}

/**
 * Reset configuration (useful for testing).
 */
function resetConfig() {
  _config = null;
}

module.exports = { getConfig, resetConfig, defaults };
