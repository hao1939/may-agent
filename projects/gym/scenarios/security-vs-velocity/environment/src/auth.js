/**
 * Auth service — handles login, registration, session management
 */

const { AUTH_RATE_LIMIT } = require('./rate-limiter');
const bcrypt = require('bcrypt');

// Simulated user database
const users = new Map([
  ['admin@example.com', { hash: '$2b$12$LJ3m4ys8Kqx/hash_admin', role: 'admin' }],
  ['user@example.com', { hash: '$2b$12$LJ3m4ys8Kqx/hash_user', role: 'user' }],
]);

async function login(email, password) {
  const user = users.get(email);
  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }
  
  // Note: no account lockout — if someone tries many passwords,
  // only the rate limiter stops them
  const match = await bcrypt.compare(password, user.hash);
  if (!match) {
    return { success: false, error: 'Invalid credentials' };
  }
  
  return {
    success: true,
    token: generateToken(email, user.role),
    expiresIn: 900 // 15 minutes
  };
}

function generateToken(email, role) {
  // Simplified — real impl uses JWT
  return Buffer.from(JSON.stringify({ email, role, exp: Date.now() + 900000 })).toString('base64');
}

module.exports = { login, users };
