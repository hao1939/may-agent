/**
 * Configuration loader — reads config and registers validation plugins.
 * 
 * This module was recently refactored. Previously, plugin registration
 * happened in app.js after all modules were loaded. Now it happens here
 * during module load to "keep config concerns together."
 * 
 * TODO: The validator seems broken after this refactoring. Might be
 * a bug in the validator module? The error points there.
 */

const registry = require('./registry');

// ============================================================
// Default configuration
// ============================================================
const config = {
  appName: 'DataProcessor',
  version: '2.1.0',
  
  validation: {
    strictMode: true,
    maxFieldLength: 255,
    
    // Field type definitions — each has a validation rule
    types: {
      email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Invalid email format'
      },
      phone: {
        pattern: /^\+?[\d\s-]{7,15}$/,
        message: 'Invalid phone format'
      },
      zipcode: {
        pattern: /^\d{5}(-\d{4})?$/,
        message: 'Invalid zipcode format'
      }
    }
  }
};

// ============================================================
// Register validation plugins based on config types
// ============================================================
for (const [type, rule] of Object.entries(config.validation.types)) {
  registry.register(type, {
    validate(value) {
      if (typeof value !== 'string') return { valid: false, message: `Expected string, got ${typeof value}` };
      if (value.length > config.validation.maxFieldLength) return { valid: false, message: 'Value too long' };
      if (!rule.pattern.test(value)) return { valid: false, message: rule.message };
      return { valid: true };
    }
  });
}

/**
 * Get the configuration object.
 */
function getConfig() {
  return { ...config };
}

/**
 * Get a specific config value by dot-notation path.
 */
function getConfigValue(keyPath) {
  return keyPath.split('.').reduce((obj, key) => obj?.[key], config);
}

module.exports = { getConfig, getConfigValue };
