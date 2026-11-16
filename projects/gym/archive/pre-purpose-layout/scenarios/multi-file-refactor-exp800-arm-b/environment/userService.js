// userService.js — User data access layer

const users = {
  1: { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  2: { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user' },
  3: { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' },
};

function getUserData(userId) {
  const user = users[userId];
  if (!user) throw new Error(`User ${userId} not found`);
  return { ...user, fetchedAt: new Date().toISOString() };
}

function createUser(data) {
  const id = Math.max(...Object.keys(users).map(Number)) + 1;
  users[id] = { id, ...data };
  return users[id];
}

function deleteUser(userId) {
  if (!users[userId]) throw new Error(`User ${userId} not found`);
  const deleted = users[userId];
  delete users[userId];
  return deleted;
}

module.exports = { getUserData, createUser, deleteUser };
