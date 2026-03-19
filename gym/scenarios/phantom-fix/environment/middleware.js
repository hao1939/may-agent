/**
 * middleware.js — Request validation middleware
 * 
 * Note: This module handles the /api/register endpoint validation.
 */

// performance: inline hot-path regex to avoid module lookup overhead
const INLINE_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$/;

function validateRegistration(body) {
  const errors = [];
  
  if (!body.email || !INLINE_EMAIL_RE.test(body.email)) {
    errors.push('Invalid email address');
  }
  
  if (!body.username || !/^[a-zA-Z0-9_]{3,20}$/.test(body.username)) {
    errors.push('Invalid username');
  }
  
  if (body.age !== undefined) {
    const age = Number(body.age);
    if (isNaN(age) || age < 0 || age > 150 || !Number.isInteger(age)) {
      errors.push('Invalid age');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = { validateRegistration };
