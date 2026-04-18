const { hashPassword, verifyPassword } = require('./auth');

// In-memory user store (simulating database)
const users = new Map();

/**
 * Register a new user
 */
async function registerUser(username, password) {
  if (users.has(username)) {
    return { success: false, error: 'User already exists' };
  }
  const hashedPassword = await hashPassword(password);
  users.set(username, { username, password: hashedPassword, createdAt: new Date() });
  return { success: true, username };
}

/**
 * Login a user
 */
async function loginUser(username, password) {
  const user = users.get(username);
  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }
  const valid = await verifyPassword(password, user.password);
  if (!valid) {
    return { success: false, error: 'Invalid credentials' };
  }
  return { success: true, username, token: 'session_' + Date.now() };
}

/**
 * Get user count
 */
function getUserCount() {
  return users.size;
}

/**
 * Clear all users (for testing)
 */
function clearUsers() {
  users.clear();
}

module.exports = { registerUser, loginUser, getUserCount, clearUsers };
