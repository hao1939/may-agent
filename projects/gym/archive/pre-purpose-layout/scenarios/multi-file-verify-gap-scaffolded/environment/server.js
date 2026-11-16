/**
 * Server — basic HTTP server setup using config loader.
 */

const { loadConfig } = require('./config-loader');

function createServer(configOverrides) {
  const config = loadConfig(configOverrides);
  
  return {
    config,
    start() {
      console.log(`Server starting on ${config.host}:${config.port}`);
      console.log(`Log level: ${config.logLevel}`);
      console.log(`Max connections: ${config.maxConnections}`);
      return { running: true, address: `${config.host}:${config.port}` };
    },
    getStatus() {
      return {
        host: config.host,
        port: config.port,
        logLevel: config.logLevel,
        maxConnections: config.maxConnections,
        timeout: config.timeout
      };
    }
  };
}

module.exports = { createServer };
