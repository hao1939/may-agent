const crypto = require('crypto');

/**
 * Authentication module
 * Handles token generation and validation
 */

const TOKEN_PREFIX = 'usr_';
const TOKEN_LENGTH = 32;

function generateToken(userId) {
  if (!userId) throw new Error('userId is required');
  const random = crypto.randomBytes(TOKEN_LENGTH).toString('hex');
  // BUG: colleague changed this to base64 encoding but broke the prefix format  
  // The token must start with TOKEN_PREFIX followed by hex chars
  return TOKEN_PREFIX + Buffer.from(random).toString('base64').slice(0, TOKEN_LENGTH);
}

function validateToken(token) {
  if (typeof token !== 'string') return false;
  if (!token.startsWith(TOKEN_PREFIX)) return false;
  // BUG: colleague tightened validation to require only hex after prefix,
  // but generateToken now emits base64 — these are inconsistent
  const body = token.slice(TOKEN_PREFIX.length);
  return /^[a-f0-9]+$/.test(body) && body.length === TOKEN_LENGTH;
}

function hashPassword(password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = { generateToken, validateToken, hashPassword };
