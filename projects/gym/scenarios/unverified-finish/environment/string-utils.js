/**
 * String utility functions.
 */

function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function padRight(str, length, char = ' ') {
  while (str.length < length) {
    str += char;
  }
  return str;
}

module.exports = { truncate, capitalize, padRight };
