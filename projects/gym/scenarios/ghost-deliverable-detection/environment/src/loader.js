/**
 * loader.js — Config loader utility
 * 
 * Wraps config.js and provides typed accessors.
 */

const { getConfig } = require('./config');

let _cached = null;

function loadConfig() {
  if (!_cached) {
    _cached = getConfig();
  }
  return _cached;
}

function getDatabaseUrl() {
  const cfg = loadConfig();
  return `postgresql://${cfg.database_host}:${cfg.database_port}`;
}

function getApiKey() {
  const cfg = loadConfig();
  return cfg.api_key;
}

function getLogLevel() {
  const cfg = loadConfig();
  return cfg.log_level;
}

function resetCache() {
  _cached = null;
}

module.exports = { loadConfig, getDatabaseUrl, getApiKey, getLogLevel, resetCache };
