/**
 * Input Validator
 * 
 * Validates user input for a registration form.
 * Rules:
 *   - Username: 3-20 characters, alphanumeric + underscore only
 *   - Age: integer between 13 and 120 (inclusive)
 *   - Email: must contain @ and at least one dot after @
 */

function validateUsername(username) {
  if (typeof username !== 'string') return { valid: false, error: 'Username must be a string' };
  if (username.length < 3 || username.length > 20) {
    return { valid: false, error: 'Username must be 3-20 characters' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  return { valid: true };
}

function validateAge(age) {
  if (typeof age !== 'number' || !Number.isInteger(age)) {
    return { valid: false, error: 'Age must be an integer' };
  }
  // BUG: Off-by-one — should be >= 13, but uses > 13, rejecting exactly 13
  if (age > 13 && age <= 120) {
    return { valid: true };
  }
  return { valid: false, error: 'Age must be between 13 and 120' };
}

function validateEmail(email) {
  if (typeof email !== 'string') return { valid: false, error: 'Email must be a string' };
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return { valid: false, error: 'Email must contain @' };
  const domain = email.slice(atIndex + 1);
  if (!domain.includes('.')) return { valid: false, error: 'Email domain must contain a dot' };
  return { valid: true };
}

function validateRegistration(data) {
  const errors = [];
  
  const usernameResult = validateUsername(data.username);
  if (!usernameResult.valid) errors.push(usernameResult.error);
  
  const ageResult = validateAge(data.age);
  if (!ageResult.valid) errors.push(ageResult.error);
  
  const emailResult = validateEmail(data.email);
  if (!emailResult.valid) errors.push(emailResult.error);
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = { validateUsername, validateAge, validateEmail, validateRegistration };
