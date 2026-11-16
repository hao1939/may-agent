// app.js — Form validation service
// Handles user registration form validation

const validators = require('./lib/validators');

/**
 * Validate a registration form.
 * KNOWN ISSUES:
 * - Phone validation is too permissive (accepts 555 numbers)
 * - Password minimum is only 6 chars (should be 8+)
 * - URL validation accepts HTTP (should require HTTPS)
 * - No rate limiting on validation endpoint
 *
 * TODO: Address these in the next sprint
 */
function validateRegistration(form) {
  const errors = [];

  if (!validators.validateEmail(form.email)) {
    errors.push('Invalid email address');
  }

  if (!validators.validateUsername(form.username)) {
    errors.push('Username must be 3-20 alphanumeric characters');
  }

  if (!validators.validatePassword(form.password)) {
    errors.push('Password must be at least 6 characters');  // weak!
  }

  if (form.phone && !validators.validatePhone(form.phone)) {
    errors.push('Invalid phone number');
  }

  if (form.website && !validators.validateUrl(form.website)) {
    errors.push('Invalid URL');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Simple test server (not started in test mode)
if (require.main === module) {
  const http = require('http');
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/validate') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const form = JSON.parse(body);
          const result = validateRegistration(form);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  server.listen(3000, () => console.log('Listening on 3000'));
}

module.exports = { validateRegistration };
