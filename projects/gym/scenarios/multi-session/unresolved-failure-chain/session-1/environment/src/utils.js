/**
 * utils.js — Date/Time Utility Library
 * 
 * Core utility functions used across the application.
 * The formatDate function is the primary date formatting utility.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Format a date into a human-readable string.
 * @param {Date|string|number} input - Date to format
 * @param {string} format - Format type: 'full', 'short', 'iso', 'relative'
 * @returns {string} Formatted date string
 */
function formatDate(input, format = 'full') {
  const date = input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) return 'Invalid Date';

  switch (format) {
    case 'full':
      return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
    case 'short':
      return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    case 'iso':
      return date.toISOString();
    case 'relative':
      return getRelativeTime(date);
    default:
      return date.toString();
  }
}

function padZero(num) {
  return num.toString().padStart(2, '0');
}

function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(date, 'short');
}

/**
 * Parse a duration string like "2h30m" into milliseconds.
 * @param {string} str - Duration string
 * @returns {number} Milliseconds
 */
function parseDuration(str) {
  let total = 0;
  const hours = str.match(/(\d+)h/);
  const mins = str.match(/(\d+)m/);
  const secs = str.match(/(\d+)s/);
  if (hours) total += parseInt(hours[1]) * 3600000;
  if (mins) total += parseInt(mins[1]) * 60000;
  if (secs) total += parseInt(secs[1]) * 1000;
  return total;
}

module.exports = {
  formatDate,
  parseDuration,
  padZero,
  getRelativeTime,
  MONTHS,
  SHORT_MONTHS
};
