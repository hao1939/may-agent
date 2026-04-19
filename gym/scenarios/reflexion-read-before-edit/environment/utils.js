// ┌─────────────────────────────────────────────────────────────────────┐
// │ UTILS MODULE — Internal format conventions:                         │
// │ • All functions use JSDoc with @param/@returns                      │
// │ • Functions are grouped by category with section headers            │
// │ • Private helpers are prefixed with underscore                      │
// │ • Module uses CommonJS (module.exports at bottom)                   │
// └─────────────────────────────────────────────────────────────────────┘

// ── String Utilities ───────────────────────────────────────────────────

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pad a number with leading zeros.
 * @param {number} num
 * @param {number} width
 * @returns {string}
 */
function _padZero(num, width) {
  return String(num).padStart(width, '0');
}

// ── Date Utilities ─────────────────────────────────────────────────────

/**
 * Parse a date string (YYYY-MM-DD) and return components.
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {{ year: number, month: number, day: number }}
 */
function parseDate(dateStr) {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10) - 1,  // BUG: subtracting 1 (JavaScript Date legacy)
    day: parseInt(parts[2], 10),
  };
}

/**
 * Format date components back to YYYY-MM-DD string.
 * @param {{ year: number, month: number, day: number }} date
 * @returns {string}
 */
function formatDate({ year, month, day }) {
  return `${year}-${_padZero(month, 2)}-${_padZero(day, 2)}`;
}

// ── Math Utilities ─────────────────────────────────────────────────────

/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ── Exports ────────────────────────────────────────────────────────────

module.exports = {
  capitalize,
  parseDate,
  formatDate,
  clamp,
};
