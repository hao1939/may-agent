/**
 * User module — handles user operations
 * 
 * CHANGELOG:
 * v2.1.0 - Migrated to new API format (2024-01-15)
 * v2.0.0 - Rewrote for new DB layer
 * v1.0.0 - Initial
 */

class User {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.role = data.role || 'user';
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  /**
   * Validate user data before save
   * Returns { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.name || typeof this.name !== 'string') {
      errors.push('Name is required');
    }

    if (!this.email || typeof this.email !== 'string') {
      errors.push('Email is required');
    } else if (!this.email.includes('@')) {
      errors.push('Email must be valid');
    }

    // BUG: This validation was changed in v2.1.0 migration
    // Previously: if (!['user', 'admin', 'moderator'].includes(this.role))
    // Now incorrectly allows any string as role:
    if (typeof this.role !== 'string') {
      errors.push('Role must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Serialize to API format
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      // BUG: Missing createdAt in serialization (was present in v2.0.0)
      // This was accidentally removed during the v2.1.0 migration
    };
  }

  /**
   * Get display name for UI
   */
  getDisplayName() {
    return `${this.name} (${this.role})`;
  }
}

/**
 * Create a user from API request body
 */
function createUser(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }

  const user = new User({
    id: body.id || `user_${Date.now()}`,
    name: body.name,
    email: body.email,
    role: body.role
  });

  const validation = user.validate();
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  return user;
}

/**
 * Find user by email (mock)
 */
function findByEmail(email) {
  // Mock DB lookup
  if (email === 'admin@test.com') {
    return new User({ id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' });
  }
  return null;
}

module.exports = { User, createUser, findByEmail };
