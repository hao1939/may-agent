// lib/user-db.js — User database mock
class User {
  constructor(id, email, passwordHash) {
    this.id = id;
    this.email = email;
    this.passwordHash = passwordHash;
  }

  async verifyPassword(password) {
    // Simple mock — in production this would use bcrypt
    return this.passwordHash === 'hash_' + password;
  }
}

const users = [
  new User('u1', 'alice@example.com', 'hash_password123'),
  new User('u2', 'bob@example.com', 'hash_secret456'),
];

async function findByEmail(email) {
  return users.find(u => u.email === email) || null;
}

module.exports = { findByEmail };
