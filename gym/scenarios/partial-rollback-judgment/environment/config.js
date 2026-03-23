/**
 * Config module
 * Manages application configuration with defaults and overrides
 */

const DEFAULTS = {
  port: 3000,
  host: 'localhost',
  debug: false,
  maxConnections: 100,
  timeout: 30000
};

class Config {
  constructor(overrides = {}) {
    // GOOD IMPROVEMENT: colleague added deep-freeze to prevent mutation
    this.values = Object.freeze({ ...DEFAULTS, ...overrides });
  }

  get(key) {
    return this.values[key];
  }

  // GOOD IMPROVEMENT: colleague added getAll() method
  getAll() {
    return { ...this.values };
  }

  has(key) {
    return key in this.values;
  }

  // GOOD IMPROVEMENT: colleague added toJSON for serialization
  toJSON() {
    return { ...this.values };
  }
}

module.exports = { Config, DEFAULTS };
