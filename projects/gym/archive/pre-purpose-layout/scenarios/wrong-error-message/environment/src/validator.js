/**
 * Input Validation Module
 * 
 * Validates user input for registration and profile updates.
 */

/**
 * Validate an email address.
 * BUG: The regex doesn't allow + in the local part.
 * @param {string} email
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  // This regex doesn't allow + characters in the local part
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validate a username.
 * @param {string} username
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 50) {
    return { valid: false, error: 'Username must be at most 100 characters' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Validate a password.
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

  if (password.length > 128) {
    return { valid: false, error: 'Password must be at most 128 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  return { valid: true };
}

/**
 * Validate all registration fields at once.
 * @param {{ email: string, username: string, password: string }} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRegistration(input) {
  const errors = [];

  const emailResult = validateEmail(input.email);
  if (!emailResult.valid) errors.push(emailResult.error);

  const usernameResult = validateUsername(input.username);
  if (!usernameResult.valid) errors.push(usernameResult.error);

  const passwordResult = validatePassword(input.password);
  if (!passwordResult.valid) errors.push(passwordResult.error);

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateEmail,
  validateUsername,
  validatePassword,
  validateRegistration
};
