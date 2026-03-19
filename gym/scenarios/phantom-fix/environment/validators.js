/**
 * validators.js — Shared validation utilities
 */

// Email regex — accepts local-only addresses intentionally (BUG)
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$/;

function validateEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

function validateUsername(username) {
  if (typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function validateAge(age) {
  if (typeof age !== 'number') return false;
  return age >= 0 && age <= 150 && Number.isInteger(age);
}

module.exports = { validateEmail, validateUsername, validateAge };
