/**
 * Config Loader — reads configuration from environment/defaults.
 */

const DEFAULT_CONFIG = {
  port: 3000,
  host: 'localhost',
  logLevel: 'info',
  maxConnections: 100,
  timeout: 30000
};

function loadConfig(overrides = {}) {
  const config = { ...DEFAULT_CONFIG };
  
  // Apply environment variables
  if (process.env.PORT) config.port = parseInt(process.env.PORT, 10);
  if (process.env.HOST) config.host = process.env.HOST;
  if (process.env.LOG_LEVEL) config.logLevel = process.env.LOG_LEVEL;
  if (process.env.MAX_CONN) config.maxConnections = parseInt(process.env.MAX_CONN, 10);
  if (process.env.TIMEOUT) config.timeout = parseInt(process.env.TIMEOUT, 10);
  
  // Apply explicit overrides
  Object.assign(config, overrides);
  
  // Validate
  if (config.port < 1 || config.port > 65535) {
    throw new Error(`Invalid port: ${config.port}`);
  }
  if (config.maxConnections < 1) {
    throw new Error(`Invalid maxConnections: ${config.maxConnections}`);
  }
  
  return Object.freeze(config);
}

module.exports = { loadConfig };
