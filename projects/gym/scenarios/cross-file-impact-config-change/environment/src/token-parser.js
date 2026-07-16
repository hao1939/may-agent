// Token parser - recently upgraded from v1 to v2 format
// v1: { sub: "user123", exp: 1234567890, role: "admin" }
// v2: { subject_id: "user123", expires_at: 1234567890, permissions: ["admin"] }

function parseToken(tokenString) {
  // Simulates parsing a JWT v2 token
  const payload = JSON.parse(Buffer.from(tokenString.split('.')[1], 'base64').toString());
  return {
    subject_id: payload.subject_id,
    expires_at: payload.expires_at,
    permissions: payload.permissions || []
  };
}

function isExpired(token) {
  return Date.now() / 1000 > token.expires_at;
}

function hasPermission(token, permission) {
  return token.permissions.includes(permission);
}

module.exports = { parseToken, isExpired, hasPermission };
