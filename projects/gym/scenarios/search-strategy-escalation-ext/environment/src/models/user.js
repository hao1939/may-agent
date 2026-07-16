// src/models/user.js - User model
class User {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.email = data.email;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      createdAt: this.createdAt
    };
  }

  static validate(data) {
    const errors = [];
    if (!data.name || data.name.length < 1) errors.push('Name is required');
    if (!data.email || !data.email.includes('@')) errors.push('Valid email is required');
    return errors;
  }
}

module.exports = { User };
