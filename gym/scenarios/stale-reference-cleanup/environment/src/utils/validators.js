// src/utils/validators.js — Input validation utilities

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateSlug(slug) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

module.exports = { validateEmail, validateSlug };
