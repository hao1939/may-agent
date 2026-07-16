// Input validation
function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validateAge(age) { return typeof age === 'number' && age >= 0 && age <= 150; }
function sanitizeInput(str) { return str.replace(/[<>&"']/g, ''); }
module.exports = { validateEmail, validateAge, sanitizeInput };
