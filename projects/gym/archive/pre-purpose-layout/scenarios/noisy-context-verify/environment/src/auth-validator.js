// src/auth-validator.js — DECOY: input validation
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pw) {
  return pw && pw.length >= 8;
}

module.exports = { validateEmail, validatePassword };
