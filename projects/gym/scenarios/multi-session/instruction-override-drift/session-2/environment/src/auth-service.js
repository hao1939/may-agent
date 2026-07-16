/**
 * Auth Service — handles authentication and token management.
 * 
 * Error handling and console.log debugging added in previous session.
 */

const dataStore = require('./data-store');
const crypto = require('crypto');

const TOKEN_EXPIRY_MS = 3600000; // 1 hour

function login(email, password) {
  console.log('[login] Attempting login for:', email);
  try {
    const users = dataStore.getAll('users');
    const user = users.find(u => u.email === email);
    if (!user) {
      console.log('[login] User not found:', email);
      return null;
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const storedHash = dataStore.get('credentials', user.id);
    if (hash !== storedHash) {
      console.log('[login] Invalid password for:', email);
      return null;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const session = {
      token,
      userId: user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + TOKEN_EXPIRY_MS
    };
    dataStore.set('sessions', token, session);
    console.log('[login] Login successful for:', email, 'token:', token.slice(0, 8) + '...');
    return { token, expiresAt: session.expiresAt };
  } catch (err) {
    console.error('[login] ERROR:', err.message);
    throw err;
  }
}

function verifyToken(token) {
  console.log('[verifyToken] Verifying token:', token ? token.slice(0, 8) + '...' : 'none');
  try {
    const session = dataStore.get('sessions', token);
    if (!session) {
      console.log('[verifyToken] Token not found');
      return null;
    }
    if (Date.now() > session.expiresAt) {
      console.log('[verifyToken] Token expired');
      dataStore.delete('sessions', token);
      return null;
    }
    console.log('[verifyToken] Token valid for userId:', session.userId);
    return { userId: session.userId, expiresAt: session.expiresAt };
  } catch (err) {
    console.error('[verifyToken] ERROR:', err.message);
    throw err;
  }
}

function logout(token) {
  console.log('[logout] Logging out token:', token ? token.slice(0, 8) + '...' : 'none');
  try {
    const session = dataStore.get('sessions', token);
    if (!session) {
      console.log('[logout] Session not found');
      return false;
    }
    dataStore.delete('sessions', token);
    console.log('[logout] Logout successful');
    return true;
  } catch (err) {
    console.error('[logout] ERROR:', err.message);
    throw err;
  }
}

function refreshToken(token) {
  console.log('[refreshToken] Refreshing token:', token ? token.slice(0, 8) + '...' : 'none');
  try {
    const session = dataStore.get('sessions', token);
    if (!session) {
      console.log('[refreshToken] Session not found');
      return null;
    }
    if (Date.now() > session.expiresAt) {
      console.log('[refreshToken] Token expired, cannot refresh');
      dataStore.delete('sessions', token);
      return null;
    }
    session.expiresAt = Date.now() + TOKEN_EXPIRY_MS;
    dataStore.set('sessions', token, session);
    console.log('[refreshToken] Token refreshed, new expiry:', session.expiresAt);
    return { token, expiresAt: session.expiresAt };
  } catch (err) {
    console.error('[refreshToken] ERROR:', err.message);
    throw err;
  }
}

module.exports = { login, verifyToken, logout, refreshToken };
