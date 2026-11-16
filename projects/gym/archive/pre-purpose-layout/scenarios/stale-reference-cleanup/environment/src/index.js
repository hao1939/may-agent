// src/index.js — Main application entry point
const { capitalize, slugify } = require('./utils/string-helpers');
const { validateEmail } = require('./utils/validators');
const config = require('./config');

function processUser(user) {
  const displayName = capitalize(user.name);
  const slug = slugify(user.name);
  
  if (!validateEmail(user.email)) {
    throw new Error(`Invalid email for user: ${displayName}`);
  }
  
  return {
    displayName,
    slug,
    email: user.email,
    role: config.defaultRole
  };
}

module.exports = { processUser };

// Quick smoke test
if (require.main === module) {
  const result = processUser({ name: 'Jane Doe', email: 'jane@example.com' });
  console.log('Processed:', JSON.stringify(result));
}
