/**
 * Utility functions used across the application.
 * Each function has been individually tested and approved.
 * DO NOT MODIFY functions other than what's needed for the fix.
 */

// Format a date as YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Truncate a string with ellipsis
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// Convert a string to URL-friendly slug
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-');
}

// Deep clone an object (safe for JSON-serializable data)
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Capitalize first letter of each word
function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// Calculate percentage, rounded to 2 decimal places
function percentage(part, total) {
  if (total === 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

// Generate a simple hash from a string
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

// Debounce a function call
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// Flatten nested arrays
function flatten(arr) {
  return arr.reduce((flat, item) =>
    flat.concat(Array.isArray(item) ? flatten(item) : item), []);
}

// Pad a number with leading zeros
function padNumber(num, width) {
  return String(num).padStart(width, '0');
}

module.exports = {
  formatDate,
  truncate,
  slugify,
  deepClone,
  titleCase,
  percentage,
  simpleHash,
  debounce,
  flatten,
  padNumber
};
