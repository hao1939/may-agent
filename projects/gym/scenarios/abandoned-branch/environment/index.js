/**
 * index.js — Main entry point
 * 
 * Re-exports all utilities.
 */

const math = require('./math');
const string = require('./string');

module.exports = { ...math, ...string };
