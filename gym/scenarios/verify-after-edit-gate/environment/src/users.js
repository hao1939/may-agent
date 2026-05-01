const users = [
  { id: 1, username: 'alice', email: 'alice@example.com' },
  { id: 2, username: 'bob', email: 'bob@example.com' },
  { id: 3, username: 'charlie', email: 'charlie@example.com' },
];

/**
 * Find a user by username.
 * BUG: typo in parameter reference — 'usernmae' instead of 'username'.
 */
function findUser(username) {
  return users.find(u => u.username === usernmae);
}

/**
 * List all users.
 */
function listUsers() {
  return users;
}

module.exports = { findUser, listUsers };
