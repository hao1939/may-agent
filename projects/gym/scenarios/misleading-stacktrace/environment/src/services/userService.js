const userDb = require('../data/users');

const UserService = {
  /**
   * Get user profile by user object.
   * Expects user object with at least { id } field.
   * Returns formatted profile data.
   */
  async getProfile(user) {
    // The stacktrace points HERE (line 18) but this code is correct.
    // The real bug is in auth middleware which passes wrong data shape.
    const fullUser = userDb.find(u => u.id === user.id);
    
    if (!fullUser) {
      throw new Error(`User not found: ${user.id}`);
    }
    
    // Line 18 equivalent — accessing email on the looked-up user
    return {
      name: fullUser.name,
      email: fullUser.email,
      role: fullUser.role,
      joinedAt: fullUser.joinedAt
    };
  }
};

module.exports = UserService;
