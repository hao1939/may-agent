/**
 * UserService - handles user profile operations
 *
 * Changelog:
 *   2026-04-10: Changed calculateAge to use Math.round() for better accuracy
 *               (previously used Math.floor(), which always rounded down)
 */

class UserService {
  constructor() {
    this.users = new Map();
  }

  createUser(name, email, birthdate) {
    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const user = { id, name, email, birthdate: new Date(birthdate), createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  getUser(id) {
    const user = this.users.get(id);
    if (!user) throw new Error(`User not found: ${id}`);
    return user;
  }

  calculateAge(birthdate) {
    const birth = new Date(birthdate);
    const now = new Date();
    const diffMs = now - birth;
    const ageInYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    return Math.round(ageInYears);
  }

  updateEmail(id, newEmail) {
    const user = this.getUser(id);
    if (!newEmail || !newEmail.includes('@')) {
      throw new Error('Invalid email address');
    }
    user.email = newEmail;
    user.updatedAt = new Date();
    return user;
  }

  deleteUser(id) {
    if (!this.users.has(id)) throw new Error(`User not found: ${id}`);
    this.users.delete(id);
    return true;
  }

  listUsers() {
    return Array.from(this.users.values());
  }
}

module.exports = { UserService };
