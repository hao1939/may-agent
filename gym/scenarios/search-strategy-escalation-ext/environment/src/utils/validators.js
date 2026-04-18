// src/utils/validators.js - Input validation utilities
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

function isPositiveInt(value) {
  const num = parseInt(value);
  return !isNaN(num) && num > 0 && String(num) === String(value);
}

function validatePagination(query) {
  const limit = query.limit ? parseInt(query.limit) : 20;
  const offset = query.offset ? parseInt(query.offset) : 0;
  
  return {
    limit: Math.min(Math.max(limit, 1), 100),
    offset: Math.max(offset, 0)
  };
}

module.exports = { isValidEmail, isValidId, isPositiveInt, validatePagination };
