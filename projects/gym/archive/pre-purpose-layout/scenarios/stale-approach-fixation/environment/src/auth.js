// Authentication module
function login(username, password) {
  if (!username || !password) throw new Error('Missing credentials');
  return { token: 'tok_' + username, expires: Date.now() + 3600000 };
}
function logout(token) { return { success: true }; }
module.exports = { login, logout };
