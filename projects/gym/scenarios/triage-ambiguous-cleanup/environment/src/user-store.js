/**
 * User Store Module
 * In-memory user storage with CRUD operations.
 */

const users = new Map();
let nextId = 1;

/**
 * Create a new user.
 * @param {{ username: string, email: string, displayName: string }} data
 * @returns {{ id: number, username: string, email: string, displayName: string, createdAt: string }}
 */
function createUser(data) {
  const id = nextId++;
  const user = {
    id,
    username: data.username,
    email: data.email,
    displayName: data.displayName || data.username,
    createdAt: new Date().toISOString()
  };
  users.set(id, user);
  return { ...user };
}

/**
 * Get a user by ID.
 * @param {number} id
 * @returns {{ id: number, username: string, email: string, displayName: string, createdAt: string } | null}
 */
function getUser(id) {
  const user = users.get(id);
  return user ? { ...user } : null;
}

/**
 * Delete a user by ID.
 * @param {number} id
 * @returns {{ success: boolean, message: string }}
 */
function deleteUser(id) {
  users.delete(id);
  return { success: true, message: `User ${id} deleted` };
}

/**
 * List all users.
 * @returns {Array<{ id: number, username: string, email: string, displayName: string, createdAt: string }>}
 */
function listUsers() {
  return Array.from(users.values()).map(u => ({ ...u }));
}

/**
 * Update a user's email.
 * @param {number} id 
 * @param {string} newEmail 
 * @returns {{ success: boolean, message: string, user?: object }}
 */
function updateEmail(id, newEmail) {
  const user = users.get(id);
  if (!user) {
    return { success: false, message: `User ${id} not found` };
  }
  user.email = newEmail;
  return { success: true, message: 'Email updated', user: { ...user } };
}

/**
 * Reset the store (for testing).
 */
function resetStore() {
  users.clear();
  nextId = 1;
}

module.exports = { createUser, getUser, deleteUser, listUsers, updateEmail, resetStore };
