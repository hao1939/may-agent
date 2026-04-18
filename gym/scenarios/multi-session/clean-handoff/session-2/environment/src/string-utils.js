/**
 * String utility functions — pure functions, no dependencies.
 * @module string-utils
 */

/**
 * Capitalize the first letter and lowercase the rest.
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a string to a URL-friendly slug.
 * Lowercases, replaces spaces with hyphens, strips non-alphanumeric chars.
 * @param {string} str - Input string
 * @returns {string} URL-friendly slug
 */
function slugify(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Truncate a string to maxLen characters, appending a suffix.
 * @param {string} str - Input string
 * @param {number} maxLen - Maximum length (including suffix)
 * @param {string} [suffix="..."] - Suffix to append when truncated
 * @returns {string} Truncated string
 */
function truncate(str, maxLen, suffix = "...") {
  if (!str || typeof str !== "string") return "";
  if (typeof maxLen !== "number" || maxLen < 0) return str;
  if (str.length <= maxLen) return str;
  const cutoff = maxLen - suffix.length;
  if (cutoff <= 0) return suffix.slice(0, maxLen);
  return str.slice(0, cutoff) + suffix;
}

/**
 * Convert a camelCase string to kebab-case.
 * @param {string} str - camelCase input
 * @returns {string} kebab-case output
 */
function camelToKebab(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
}

/**
 * Count words in a string (splits on whitespace).
 * @param {string} str - Input string
 * @returns {number} Word count
 */
function countWords(str) {
  if (!str || typeof str !== "string") return 0;
  const trimmed = str.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

module.exports = { capitalize, slugify, truncate, camelToKebab, countWords };
