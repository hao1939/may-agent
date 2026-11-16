/**
 * Format a price value for display.
 * @param {number} value - The numeric price
 * @returns {string} Formatted price string
 */
function formatPrice(value) {
  // BUG: not formatting correctly
  return String(value);
}

/**
 * Format a value as a percentage string.
 * Uses formatPrice internally for the numeric part.
 * @param {number} value - decimal value (e.g., 0.15 for 15%)
 * @returns {string} e.g., "$0.15"
 */
function formatDiscount(value) {
  return formatPrice(value);
}

module.exports = { formatPrice, formatDiscount };
