/**
 * User Service — handles CRUD operations for users.
 * 
 * Error handling and console.log debugging added in previous session.
 */

const dataStore = require('./data-store');

function createUser({ email, name, role }) {
  console.log('[createUser] Creating user:', { email, name, role });
  try {
    const id = 'usr_' + Date.now();
    const user = { id, email, name, role, createdAt: new Date().toISOString() };
    dataStore.set('users', id, user);
    console.log('[createUser] User created successfully:', id);
    return user;
  } catch (err) {
    console.error('[createUser] ERROR:', err.message);
    throw err;
  }
}

function getUser(id) {
  console.log('[getUser] Fetching user:', id);
  try {
    const user = dataStore.get('users', id);
    if (!user) {
      console.log('[getUser] User not found:', id);
      return null;
    }
    console.log('[getUser] Found user:', id);
    return user;
  } catch (err) {
    console.error('[getUser] ERROR:', err.message);
    throw err;
  }
}

function updateUser(id, updates) {
  console.log('[updateUser] Updating user:', id, updates);
  try {
    const user = dataStore.get('users', id);
    if (!user) {
      console.log('[updateUser] User not found:', id);
      return null;
    }
    const updated = { ...user, ...updates, updatedAt: new Date().toISOString() };
    dataStore.set('users', id, updated);
    console.log('[updateUser] User updated successfully:', id);
    return updated;
  } catch (err) {
    console.error('[updateUser] ERROR:', err.message);
    throw err;
  }
}

function deleteUser(id) {
  console.log('[deleteUser] Deleting user:', id);
  try {
    const user = dataStore.get('users', id);
    if (!user) {
      console.log('[deleteUser] User not found:', id);
      return false;
    }
    dataStore.delete('users', id);
    console.log('[deleteUser] User deleted successfully:', id);
    return true;
  } catch (err) {
    console.error('[deleteUser] ERROR:', err.message);
    throw err;
  }
}

function listUsers(filter = {}) {
  console.log('[listUsers] Listing users with filter:', filter);
  try {
    const users = dataStore.getAll('users');
    if (filter.role) {
      const filtered = users.filter(u => u.role === filter.role);
      console.log('[listUsers] Found', filtered.length, 'users with role:', filter.role);
      return filtered;
    }
    console.log('[listUsers] Found', users.length, 'total users');
    return users;
  } catch (err) {
    console.error('[listUsers] ERROR:', err.message);
    throw err;
  }
}

module.exports = { createUser, getUser, updateUser, deleteUser, listUsers };
