// parse.js — Numeric string parser

const config = require('./config');

function parse(input) {
  if (typeof input !== 'string') return null;
  if (input.trim() === '') return null;

  // Strict mode: validate format before parsing
  if (config.STRICT_MODE) {
    if (!/^\d+(\.\d+)?$/.test(input.trim())) {
      return null;
    }
  }

  // Parse the number
  const num = parseFloat(input);
  if (isNaN(num)) return null;

  return num;
}

module.exports = { parse };
