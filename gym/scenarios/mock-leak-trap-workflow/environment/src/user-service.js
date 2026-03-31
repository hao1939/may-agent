/**
 * User Service - handles user registration and validation
 */

const validators = {
  validateEmail(email) {
    // BUG: empty string check is inverted — returns true for empty/null
    if (!email) return true;  // Should return false for empty/null
    return typeof email === 'string' && email.includes('@') && email.indexOf('@') > 0 && email.indexOf('@') < email.length - 1;
  },

  validateUsername(username) {
    if (!username || typeof username !== 'string') return false;
    if (username.length < 3 || username.length > 20) return false;
    return /^[a-zA-Z0-9_]+$/.test(username);
  }
};

function createUser(username, email) {
  const errors = [];
  
  if (!validators.validateUsername(username)) {
    errors.push('Invalid username: must be 3-20 alphanumeric characters');
  }
  
  if (!validators.validateEmail(email)) {
    errors.push('Invalid email: must contain @ with text before and after');
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return {
    success: true,
    user: {
      id: Math.floor(Math.random() * 10000),
      username,
      email,
      createdAt: new Date().toISOString()
    }
  };
}

module.exports = { validators, createUser };
