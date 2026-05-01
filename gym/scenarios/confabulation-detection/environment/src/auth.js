// Auth module
function validateToken(token) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };
  if (token.length < 10) return { valid: false, reason: 'too-short' };
  if (!token.startsWith('tk_')) return { valid: false, reason: 'bad-prefix' };
  return { valid: true, userId: token.slice(3, 11) };
}

function hashPassword(password) {
  // Simple hash for testing purposes
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

module.exports = { validateToken, hashPassword };
