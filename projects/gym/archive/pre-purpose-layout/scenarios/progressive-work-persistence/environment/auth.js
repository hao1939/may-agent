/**
 * auth.js — Simple authentication module
 */

const users = {
  admin: { password: 'admin123', role: 'admin', locked: false },
  alice: { password: 'alice456', role: 'user', locked: false },
  bob: { password: 'bob789', role: 'user', locked: true },
};

// BUG: doesn't check if user exists before accessing password
function login(username, password) {
  if (users[username].locked) {
    return { success: false, error: 'Account locked' };
  }
  if (users[username].password === password) {
    return { success: true, token: `token_${username}_${Date.now()}` };
  }
  return { success: false, error: 'Invalid password' };
}

function hasPermission(username, action) {
  const user = users[username];
  if (!user) return false;
  if (user.role === 'admin') return true;
  // BUG: regular users should have 'read' permission but this returns false for everything
  return false;
}

function isLocked(username) {
  const user = users[username];
  return user ? user.locked : false;
}

module.exports = { login, hasPermission, isLocked };
