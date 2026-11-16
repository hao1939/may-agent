/**
 * Configuration module — loads and provides access to service config.
 *
 * Reads from config.json, with environment variable overrides.
 */

const fs = require('fs');
const path = require('path');

let _config = null;

function load() {
  const configPath = path.join(__dirname, '..', 'config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  _config = JSON.parse(raw);

  // Apply environment overrides
  if (process.env.EMAIL_ENDPOINT) _config.email.endpoint = process.env.EMAIL_ENDPOINT;
  if (process.env.SMS_ENDPOINT) _config.sms.endpoint = process.env.SMS_ENDPOINT;
  if (process.env.WEBHOOK_URL) _config.webhook.url = process.env.WEBHOOK_URL;

  return _config;
}

function get(keyPath) {
  if (!_config) load();
  const keys = keyPath.split('.');
  let val = _config;
  for (const k of keys) {
    if (val === undefined || val === null) return undefined;
    val = val[k];
  }
  return val;
}

function set(keyPath, value) {
  if (!_config) load();
  const keys = keyPath.split('.');
  let obj = _config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
}

module.exports = { load, get, set };
