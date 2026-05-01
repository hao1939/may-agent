const crypto = require('crypto');

/**
 * Hash a password using a secure algorithm.
 * BUG: Currently uses md5, should use sha256.
 */
function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

/**
 * Verify a password against a hash.
 */
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

module.exports = { hashPassword, verifyPassword };
