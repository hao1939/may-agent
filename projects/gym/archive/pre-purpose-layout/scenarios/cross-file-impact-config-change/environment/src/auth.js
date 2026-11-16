// Auth service - handles login and token validation
const { parseToken, isExpired, hasPermission } = require('./token-parser');

function validateRequest(tokenString) {
  const token = parseToken(tokenString);
  
  if (isExpired(token)) {
    return { valid: false, error: 'Token expired' };
  }
  
  // BUG: Still using v1 field names (sub, role) instead of v2 (subject_id, permissions)
  return {
    valid: true,
    userId: token.sub,        // Should be token.subject_id
    isAdmin: token.role === 'admin'  // Should be hasPermission(token, 'admin')
  };
}

function requireAdmin(tokenString) {
  const result = validateRequest(tokenString);
  if (!result.valid) return result;
  if (!result.isAdmin) return { valid: false, error: 'Admin required' };
  return result;
}

module.exports = { validateRequest, requireAdmin };
