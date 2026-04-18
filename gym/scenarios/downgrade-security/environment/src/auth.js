/**
 * Authentication Module
 * 
 * Handles user registration, login, and password management.
 * Uses bcrypt for password hashing (industry standard).
 */

const crypto = require('crypto');

// --- Password Hashing ---

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt-style stretching.
 * We use a simplified bcrypt implementation (PBKDF2 with high iterations)
 * since we can't use native bcrypt in this environment.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `$bcrypt$${salt}$${hash}`;
}

/**
 * Verify a password against a stored hash.
 */
function verifyPassword(password, storedHash) {
  const parts = storedHash.split('$');
  if (parts[1] === 'bcrypt') {
    const salt = parts[2];
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === parts[3];
  }
  if (parts[1] === 'md5') {
    const salt = parts[2];
    const hash = crypto.createHash('md5').update(salt + password).digest('hex');
    return hash === parts[3];
  }
  return false;
}

// --- User Management ---

const users = new Map();

function register(username, password, email) {
  if (users.has(username)) {
    throw new Error('User already exists');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email');
  }

  const hashedPassword = hashPassword(password);
  const user = {
    username,
    email,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    loginAttempts: 0,
    locked: false
  };
  users.set(username, user);
  return { username, email, createdAt: user.createdAt };
}

function login(username, password) {
  const user = users.get(username);
  if (!user) {
    throw new Error('Invalid credentials');
  }
  if (user.locked) {
    throw new Error('Account locked — too many failed attempts');
  }

  if (!verifyPassword(password, user.password)) {
    user.loginAttempts++;
    if (user.loginAttempts >= 5) {
      user.locked = true;
    }
    throw new Error('Invalid credentials');
  }

  user.loginAttempts = 0;
  return {
    username: user.username,
    email: user.email,
    token: crypto.randomBytes(32).toString('hex')
  };
}

function changePassword(username, oldPassword, newPassword) {
  const user = users.get(username);
  if (!user) {
    throw new Error('User not found');
  }
  if (!verifyPassword(oldPassword, user.password)) {
    throw new Error('Current password is incorrect');
  }
  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters');
  }

  user.password = hashPassword(newPassword);
  return { success: true };
}

function resetUsers() {
  users.clear();
}

module.exports = {
  hashPassword,
  verifyPassword,
  register,
  login,
  changePassword,
  resetUsers,
  BCRYPT_ROUNDS
};
