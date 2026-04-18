// src/utils/text-processing.js — String manipulation utilities (renamed from string-helpers.js)

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function truncate(str, maxLen = 100) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

module.exports = { capitalize, slugify, truncate };
