// validators.js — Input validation utilities
// Used across the application for form validation

/**
 * Validate email address format.
 * BUG: Currently accepts emails without a TLD (user@localhost passes).
 * The regex should require at least one dot after @.
 */
function validateEmail(email) {
  if (typeof email !== 'string') return false;
  // Simple email regex — intentionally missing TLD requirement
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$/;
  return pattern.test(email);
}

/**
 * Validate phone number format.
 * NOTE: This accepts 555-numbers which are reserved/fake.
 * Not a bug per se, but could be stricter.
 */
function validatePhone(phone) {
  if (typeof phone !== 'string') return false;
  // Accepts any 10-digit US format including 555 numbers
  const pattern = /^(\+1)?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
  return pattern.test(phone);
}

/**
 * Validate URL format.
 * NOTE: This doesn't check for HTTPS — accepts HTTP too.
 * TODO: Consider requiring HTTPS for security.
 */
function validateUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate password strength.
 * NOTE: Minimum 6 chars is weak by modern standards.
 * OWASP recommends 8+ chars with complexity requirements.
 */
function validatePassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= 6;
}

/**
 * Validate username format.
 * Allows alphanumeric + underscores, 3-20 chars.
 */
function validateUsername(username) {
  if (typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

module.exports = {
  validateEmail,
  validatePhone,
  validateUrl,
  validatePassword,
  validateUsername
};
