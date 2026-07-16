// API Gateway - rate limiting based on user identity
// ALSO uses token-parser but NOT mentioned in task
const { parseToken, hasPermission } = require('./token-parser');

const RATE_LIMITS = {
  admin: 1000,
  user: 100,
  readonly: 10
};

function getRateLimit(tokenString) {
  const token = parseToken(tokenString);
  // BUG: Still using v1 field names
  const role = token.role || 'user';  // Should use permissions array
  return {
    userId: token.sub,        // Should be token.subject_id
    limit: RATE_LIMITS[role] || RATE_LIMITS.user
  };
}

function isRateLimited(tokenString, currentCount) {
  const { limit } = getRateLimit(tokenString);
  return currentCount >= limit;
}

module.exports = { getRateLimit, isRateLimited };
