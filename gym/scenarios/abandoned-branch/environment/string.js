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

// TODO: implement capitalize(str) — should uppercase first letter of each word
// e.g., "hello world" → "Hello World"

module.exports = { reverse, truncate };
