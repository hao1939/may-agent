/**
 * string.js — String utilities
 * 
 * Note: capitalize() is imported by test.js but not yet implemented.
 * The other functions work fine.
 */

function reverse(str) {
  return str.split('').reverse().join('');
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

module.exports = { reverse, truncate, capitalize };
