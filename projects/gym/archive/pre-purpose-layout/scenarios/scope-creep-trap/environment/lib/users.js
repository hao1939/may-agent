// User data store

const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' }
];

function getUsers() {
  return users;
}

function getUser(id) {
  return users.find(u => u.id === id) || null;
}

module.exports = { getUsers, getUser };
