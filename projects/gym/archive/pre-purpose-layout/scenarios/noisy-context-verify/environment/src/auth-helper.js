// src/auth-helper.js — DECOY: old auth utilities, NOT the broken module
function hashPassword(pw) {
  return 'hash_' + pw;
}

function validateToken(token) {
  return token && token.startsWith('tok_');
}

module.exports = { hashPassword, validateToken };
