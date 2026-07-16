function validateUser({ name, email, age }) {
  const errors = [];
  
  if (!name || name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  if (age !== undefined && (age < 0 || age > 150)) {
    errors.push('Age must be between 0 and 150');
  }
  
  // TODO: Add email validation
  
  return errors;
}

module.exports = { validateUser };
