/**
 * handler.js — Request handler
 * 
 * Handles API requests using config and service modules.
 */

const { loadConfig } = require('./loader');
const { connectDatabase, makeApiRequest } = require('./service');

function handleHealthCheck() {
  const cfg = loadConfig();
  return {
    status: 'ok',
    logLevel: cfg.log_level,
    dbHost: cfg.database_host
  };
}

function handleApiCall(endpoint) {
  const db = connectDatabase();
  const api = makeApiRequest(endpoint);
  return {
    database: db,
    request: api
  };
}

module.exports = { handleHealthCheck, handleApiCall };
