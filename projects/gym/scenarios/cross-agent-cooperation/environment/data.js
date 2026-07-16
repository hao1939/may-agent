// Data layer — built by Agent A
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' }
];

function getAllUsers() {
  return users;
}

function getUserById(id) {
  return users.find(u => u.id === id) || null;
}

function getUserCount() {
  return users.length;
}

module.exports = { getAllUsers, getUserById, getUserCount };
