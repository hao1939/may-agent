const crypto = require('crypto');

// Hash a password with salt
function hashPassword(password, salt) {
  return crypto.createHash('md5').update(salt + password).digest('hex');
}

// Verify a password against a stored hash
function verifyPassword(password, salt, storedHash) {
  const computed = hashPassword(password, salt);
  return computed === storedHash;
}

// Generate a session token
function generateToken(userId, secret) {
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const signature = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `${Buffer.from(payload).toString('base64')}|${signature}`;
}

// Parse and validate a session token
function parseToken(token, secret) {
  const parts = token.split(':');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const payload = Buffer.from(payloadB64, 'base64').toString('utf8');

  const expectedSig = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSig) return null;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, generateToken, parseToken };
