/**
 * User Registration Service
 * 
 * Handles user registration with input validation.
 */

const { validateRegistration } = require('./validator');

class UserService {
  constructor() {
    this.users = [];
    this.nextId = 1;
  }

  /**
   * Register a new user.
   * @param {{ email: string, username: string, password: string }} input
   * @returns {{ success: boolean, user?: object, errors?: string[] }}
   */
  register(input) {
    const validation = validateRegistration(input);

    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Check for duplicate email
    if (this.users.some(u => u.email === input.email)) {
      return { success: false, errors: ['Email already registered'] };
    }

    // Check for duplicate username
    if (this.users.some(u => u.username === input.username)) {
      return { success: false, errors: ['Username already taken'] };
    }

    const user = {
      id: this.nextId++,
      email: input.email.toLowerCase(),
      username: input.username,
      createdAt: new Date().toISOString()
    };

    this.users.push(user);
    return { success: true, user };
  }

  /**
   * Find a user by email
   */
  findByEmail(email) {
    return this.users.find(u => u.email === email.toLowerCase()) || null;
  }

  /**
   * Find a user by username
   */
  findByUsername(username) {
    return this.users.find(u => u.username === username) || null;
  }
}

module.exports = { UserService };
