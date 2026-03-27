// server.js — User API endpoint
const { getUser } = require('./db');

// Format user for API response
function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email.toLowerCase(),  // BUG: crashes when email is in profile or null
    role: user.role,
    displayName: `${user.name} <${user.email}>`,
  };
}

// Simulate API handler
function handleGetUser(id) {
  const user = getUser(id);
  
  // Missing: no null check for user not found
  const formatted = formatUser(user);  // BUG: crashes on invalid ID (user is null)
  
  return {
    status: 200,
    body: formatted,
  };
}

module.exports = { handleGetUser, formatUser };
