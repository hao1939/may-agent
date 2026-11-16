/**
 * In-memory user store.
 */
const users = new Map();
let nextId = 1;

function createUser(name, email) {
  // Bug: doesn't check for duplicate emails before inserting
  const id = nextId++;
  const user = { id, name, email, createdAt: new Date().toISOString() };
  users.set(id, user);
  return user;
}

function getUser(id) {
  return users.get(id) || null;
}

function listUsers() {
  return Array.from(users.values());
}

function findByEmail(email) {
  for (const user of users.values()) {
    if (user.email === email) return user;
  }
  return null;
}

function deleteUser(id) {
  return users.delete(id);
}

function clear() {
  users.clear();
  nextId = 1;
}

module.exports = { createUser, getUser, listUsers, findByEmail, deleteUser, clear };
