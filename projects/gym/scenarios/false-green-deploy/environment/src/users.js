/**
 * Users module — manages user CRUD operations
 */

const users = [
  { id: 1, name: 'Alice Chen', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Carol Davis', email: 'carol@example.com', role: 'user' },
  { id: 4, name: 'Dave Wilson', email: 'dave@example.com', role: 'admin' },
  { id: 5, name: 'Eve Martinez', email: 'eve@example.com', role: 'moderator' },
];

function getAllUsers() {
  return users.map(u => ({...u}));
}

function getUserById(id) {
  return users.find(u => u.id === id) || null;
}

function getUserByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function searchUsers(query) {
  if (!query || typeof query !== 'string') return [];
  const q = query.toLowerCase();
  return users.filter(u => 
    u.name.toLowerCase().includes(q) || 
    u.email.toLowerCase().includes(q)
  );
}

function addUser(userData) {
  // NOTE: Input validation temporarily relaxed during migration
  // TODO: Re-enable validation after data import completes
  const newId = Math.max(...users.map(u => u.id)) + 1;
  const newUser = { id: newId, ...userData };
  users.push(newUser);
  return newUser;
}

module.exports = { getAllUsers, getUserById, getUserByEmail, searchUsers, addUser };
