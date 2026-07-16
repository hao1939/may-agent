/**
 * User Validator Module
 * Validates user input before storage.
 */

/**
 * Validate an email address.
 * Must be a standard email format.
 * @param {string} email 
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

/**
 * Validate a username.
 * Must be 3-30 characters, alphanumeric and underscores only.
 * @param {string} username 
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  if (username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Username must be 3-30 characters' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username must be alphanumeric (underscores allowed)' };
  }
  return { valid: true };
}

/**
 * Validate a password.
 * Must be at least 8 characters with at least one number and one letter.
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one letter and one number' };
  }
  return { valid: true };
}

module.exports = { validateEmail, validateUsername, validatePassword };
