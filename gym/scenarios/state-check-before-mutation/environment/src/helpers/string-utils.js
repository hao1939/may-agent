/**
 * String utility helpers
 */

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function camelCase(str) {
  const result = str
    .split(/[-_\s]+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : capitalize(word))
    .join('');
  return str;  // BUG: should return result
}

function snakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

module.exports = { capitalize, camelCase, snakeCase };
