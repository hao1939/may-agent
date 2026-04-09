/**
 * Config Loader
 * 
 * Loads configuration files. Supports both JSON and YAML formats.
 * During migration, some configs are YAML and some are still JSON.
 * 
 * YAML files are loaded as raw text and parsed with a simple key-value parser.
 * (For production, use a proper YAML library — this is a migration interim.)
 */
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');

// Track which configs have been migrated to YAML
// Updated as migration progresses
const YAML_CONFIGS = ['database', 'cache', 'auth', 'logging', 'api', 'storage'];

/**
 * Simple YAML parser for flat and one-level-nested configs.
 * Handles: strings, numbers, booleans, and simple nested objects.
 */
function parseSimpleYaml(text) {
  const result = {};
  const lines = text.split('\n');
  let currentKey = null;
  
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    
    if (indent === 0) {
      const match = line.match(/^(\w+):\s*(.*)/);
      if (match) {
        const key = match[1];
        const value = match[2].trim();
        if (value === '') {
          result[key] = {};
          currentKey = key;
        } else {
          result[key] = parseValue(value);
          currentKey = null;
        }
      }
    } else if (currentKey && indent >= 2) {
      const match = line.match(/^\s+(\w+):\s*(.*)/);
      if (match) {
        if (typeof result[currentKey] !== 'object') result[currentKey] = {};
        result[currentKey][match[1]] = parseValue(match[2].trim());
      }
    }
  }
  
  return result;
}

function parseValue(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  // Strip quotes if present
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

function loadConfig(name) {
  if (YAML_CONFIGS.includes(name)) {
    const yamlPath = path.join(CONFIG_DIR, `${name}.yaml`);
    const content = fs.readFileSync(yamlPath, 'utf-8');
    return parseSimpleYaml(content);
  }
  
  const jsonPath = path.join(CONFIG_DIR, `${name}.json`);
  const content = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(content);
}

function getAllConfigs() {
  const configs = {};
  const allNames = ['database', 'cache', 'auth', 'logging', 'api', 'storage'];
  for (const name of allNames) {
    configs[name] = loadConfig(name);
  }
  return configs;
}

function getConfigFormat(name) {
  return YAML_CONFIGS.includes(name) ? 'yaml' : 'json';
}

module.exports = { loadConfig, getAllConfigs, getConfigFormat, YAML_CONFIGS };
