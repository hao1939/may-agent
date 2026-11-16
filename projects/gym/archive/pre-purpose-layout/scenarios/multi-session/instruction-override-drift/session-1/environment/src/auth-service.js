/**
 * Auth Service — handles authentication and token management.
 * 
 * NOTE: Error handling and logging need to be added (see task).
 */

const dataStore = require('./data-store');
const crypto = require('crypto');

const TOKEN_EXPIRY_MS = 3600000; // 1 hour

function login(email, password) {
  const users = dataStore.getAll('users');
  const user = users.find(u => u.email === email);
  if (!user) return null;

  // Simple password check (in production, use bcrypt)
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const storedHash = dataStore.get('credentials', user.id);
  if (hash !== storedHash) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    token,
    userId: user.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + TOKEN_EXPIRY_MS
  };
  dataStore.set('sessions', token, session);
  return { token, expiresAt: session.expiresAt };
}

function verifyToken(token) {
  const session = dataStore.get('sessions', token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    dataStore.delete('sessions', token);
    return null;
  }
  return { userId: session.userId, expiresAt: session.expiresAt };
}

function logout(token) {
  const session = dataStore.get('sessions', token);
  if (!session) return false;
  dataStore.delete('sessions', token);
  return true;
}

function refreshToken(token) {
  const session = dataStore.get('sessions', token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    dataStore.delete('sessions', token);
    return null;
  }
  // Extend session
  session.expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  dataStore.set('sessions', token, session);
  return { token, expiresAt: session.expiresAt };
}

module.exports = { login, verifyToken, logout, refreshToken };
