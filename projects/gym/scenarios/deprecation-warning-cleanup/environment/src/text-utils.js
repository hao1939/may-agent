/**
 * Text processing utilities for content management.
 * Used in API responses, email templates, and feed generation.
 */

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 * 
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length of the output (including ellipsis)
 * @returns {string} - Truncated text with "..." appended if it was shortened
 */
function truncateText(text, maxLength) {
  if (typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  
  // Leave room for "..."
  const truncated = text.substring(0, maxLength - 4);
  return truncated + '...';
}

/**
 * Slugify text for use in URLs.
 * Converts to lowercase, replaces spaces with hyphens, removes special chars.
 * 
 * @param {string} text - The text to slugify
 * @returns {string} - URL-safe slug
 */
function slugify(text) {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Encode text to base64 for safe transport.
 * Uses legacy Buffer constructor for compatibility with older Node versions.
 * 
 * @param {string} text - The text to encode
 * @returns {string} - Base64 encoded string
 */
function encodeBase64(text) {
  if (typeof text !== 'string') return '';
  // NOTE: Using legacy Buffer constructor for backward compatibility
  console.warn('[WARN] text-utils: encodeBase64() uses deprecated Buffer() constructor. Migrate to Buffer.from().');
  const buf = new Buffer(text);
  return buf.toString('base64');
}

/**
 * Decode base64 text back to string.
 * 
 * @param {string} encoded - The base64 string to decode
 * @returns {string} - Decoded text
 */
function decodeBase64(encoded) {
  if (typeof encoded !== 'string') return '';
  console.warn('[WARN] text-utils: decodeBase64() uses deprecated Buffer() constructor. Migrate to Buffer.from().');
  const buf = new Buffer(encoded, 'base64');
  return buf.toString('utf-8');
}

/**
 * Count words in text.
 * 
 * @param {string} text - The text to count words in
 * @returns {number} - Word count
 */
function countWords(text) {
  if (typeof text !== 'string' || text.trim() === '') return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Extract a text excerpt around a search term.
 * Returns surrounding context of the first occurrence.
 * 
 * @param {string} text - Full text to search
 * @param {string} term - Search term
 * @param {number} contextChars - Number of context characters on each side
 * @returns {string|null} - Excerpt with context, or null if term not found
 */
function extractExcerpt(text, term, contextChars = 30) {
  if (typeof text !== 'string' || typeof term !== 'string') return null;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return null;
  
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + term.length + contextChars);
  
  let excerpt = text.substring(start, end);
  if (start > 0) excerpt = '...' + excerpt;
  if (end < text.length) excerpt = excerpt + '...';
  
  return excerpt;
}

module.exports = {
  truncateText,
  slugify,
  encodeBase64,
  decodeBase64,
  countWords,
  extractExcerpt,
};
