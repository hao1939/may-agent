/**
 * Configuration loader
 * 
 * Loads settings from config.json and provides defaults.
 * The config system was updated in v2.3 to support external overrides.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const DEFAULTS = {
  cache_ttl_seconds: 300,  // 5 minutes — per spec
  max_cache_size: 500,
  cache_enabled: true,
  log_level: 'warn'
};

let _config = null;

function loadConfig() {
  if (_config) return _config;

  let fileConfig = {};
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    fileConfig = JSON.parse(raw);
  } catch (e) {
    console.warn('Could not load config.json, using defaults');
  }

  // Merge file config over defaults (file values take precedence)
  _config = { ...DEFAULTS, ...fileConfig };
  return _config;
}

function get(key) {
  const config = loadConfig();
  return config[key] !== undefined ? config[key] : undefined;
}

function resetForTesting() {
  _config = null;
}

module.exports = { loadConfig, get, resetForTesting };
