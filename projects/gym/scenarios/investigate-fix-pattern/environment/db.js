// db.js — User data store
// Some users were imported from legacy system with different schema
const users = {
  '1': { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' },
  '2': { id: 2, name: 'Bob', profile: { email: 'bob@example.com' }, role: 'user' },  // legacy format
  '3': { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'user' },
  '4': { id: 4, name: 'Diana', profile: { email: 'diana@example.com' }, role: 'admin' },  // legacy format
  '5': { id: 5, name: 'Eve', email: null, role: 'user' },  // incomplete record
};

function getUser(id) {
  return users[String(id)] || null;
}

function getAllUserIds() {
  return Object.keys(users);
}

module.exports = { getUser, getAllUserIds };
