const { validateEmail, validateAge, sanitizeInput } = require('../src/validator');
console.assert(validateEmail('a@b.com') === true, 'valid email');
console.assert(validateEmail('bad') === false, 'invalid email');
console.assert(validateAge(25) === true, 'valid age');
console.assert(sanitizeInput('<b>hi</b>') === 'bhi/b', 'sanitize');
console.log('validator tests passed');
