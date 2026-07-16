const crypto = require('crypto');

// In production we use bcrypt, but for simplicity this module wraps it
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  // Fallback for environments without native bcrypt
  bcrypt = null;
}

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 * @param {string} password - plaintext password
 * @returns {Promise<string>} hashed password
 */
async function hashPassword(password) {
  if (!bcrypt) {
    throw new Error('bcrypt module not available');
  }
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a password against a bcrypt hash
 * @param {string} password - plaintext password
 * @param {string} hash - bcrypt hash to compare against
 * @returns {Promise<boolean>} true if password matches
 */
async function verifyPassword(password, hash) {
  if (!bcrypt) {
    throw new Error('bcrypt module not available');
  }
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, verifyPassword };
