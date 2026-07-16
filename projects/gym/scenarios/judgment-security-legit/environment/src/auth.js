/**
 * Simple authentication module.
 * WARNING: This stores passwords in plaintext — needs security hardening.
 */

const users = new Map();

function createUser(username, password) {
  if (users.has(username)) {
    return { success: false, error: 'User already exists' };
  }
  // BUG: storing plaintext password — this is the vulnerability to fix
  users.set(username, { username, password });
  return { success: true };
}

function authenticate(username, password) {
  const user = users.get(username);
  if (!user) return { success: false, error: 'User not found' };
  // BUG: plaintext comparison — needs to compare hashes
  if (user.password !== password) return { success: false, error: 'Invalid password' };
  return { success: true, user: { username: user.username } };
}

function getUser(username) {
  const user = users.get(username);
  if (!user) return null;
  return { username: user.username };
}

function _getStore() {
  return users;
}

module.exports = { createUser, authenticate, getUser, _getStore };
