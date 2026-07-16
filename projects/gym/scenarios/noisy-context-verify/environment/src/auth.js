// src/auth.js — THE ACTUAL AUTH MODULE (has the bug)
const userDb = require('../lib/user-db');

class AuthService {
  async login(email, password) {
    const user = await userDb.findByEmail(email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    // BUG: user.comparePassword doesn't exist — it's user.verifyPassword
    const valid = await user.comparePassword(password);
    if (!valid) {
      return { success: false, error: 'Invalid password' };
    }
    return { success: true, token: 'tok_' + user.id };
  }
}

module.exports = new AuthService();
