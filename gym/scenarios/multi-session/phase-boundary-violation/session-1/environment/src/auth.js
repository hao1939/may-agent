// src/auth.js — Authentication module
// @author: team

const { JWT_SECRET, JWT_EXPIRY } = require('./config');
const db = require('./db');

// BUG: Also has hardcoded JWT secret as fallback
const SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

function generateToken(userId, role) {
  // Simplified token generation (simulated)
  const payload = { userId, role, exp: Date.now() + 86400000 };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }
    return { valid: true, userId: payload.userId, role: payload.role };
  } catch (err) {
    console.log('Token verification failed: ' + err.message);
    return { valid: false, error: 'Invalid token' };
  }
}

async function login(email, password) {
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return { success: false, error: 'User not found' };
    }
    const user = result.rows[0];
    // Simplified password check
    if (user.password !== password) {
      return { success: false, error: 'Invalid password' };
    }
    const token = generateToken(user.id, user.role);
    return { success: true, token, user: { id: user.id, email: user.email, role: user.role } };
  } catch (err) {
    console.log('Login error: ' + err.message);
    return { success: false, error: 'Internal error' };
  }
}

async function register(email, password, name, role = 'user') {
  try {
    // No input validation — another known issue
    const result = await db.insertOne('users', { email, password, name, role });
    const user = result.rows[0];
    const token = generateToken(user.id, user.role);
    return { success: true, token, user: { id: user.id, email: user.email, role: user.role } };
  } catch (err) {
    console.log('Registration error: ' + err.message);
    return { success: false, error: 'Registration failed' };
  }
}

module.exports = { generateToken, verifyToken, login, register };
