// lib/auth-legacy.js — DECOY: deprecated auth code
// DO NOT USE — kept for backwards compatibility
function legacyLogin(username, pw) {
  console.warn('DEPRECATED: use AuthService.login instead');
  return { ok: username === 'admin' && pw === 'admin' };
}

module.exports = { legacyLogin };
