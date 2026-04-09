/**
 * User Service — handles CRUD operations for users.
 * 
 * NOTE: Error handling and logging need to be added (see task).
 */

const dataStore = require('./data-store');

function createUser({ email, name, role }) {
  const id = 'usr_' + Date.now();
  const user = { id, email, name, role, createdAt: new Date().toISOString() };
  dataStore.set('users', id, user);
  return user;
}

function getUser(id) {
  return dataStore.get('users', id);
}

function updateUser(id, updates) {
  const user = dataStore.get('users', id);
  if (!user) return null;
  const updated = { ...user, ...updates, updatedAt: new Date().toISOString() };
  dataStore.set('users', id, updated);
  return updated;
}

function deleteUser(id) {
  const user = dataStore.get('users', id);
  if (!user) return false;
  dataStore.delete('users', id);
  return true;
}

function listUsers(filter = {}) {
  const users = dataStore.getAll('users');
  if (filter.role) {
    return users.filter(u => u.role === filter.role);
  }
  return users;
}

module.exports = { createUser, getUser, updateUser, deleteUser, listUsers };
