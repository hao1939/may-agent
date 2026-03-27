const { login, logout } = require('../src/auth');
// Test login
const tok = login('alice', 'pass123');
console.assert(tok.token === 'tok_alice', 'login token');
// Test logout
const res = logout(tok.token);
console.assert(res.success === true, 'logout');
console.log('auth tests passed');
