// API layer — built by Agent B
// TODO: import data layer and wire up these functions

function getUsers() {
  // TODO: connect to data layer - return all users
  return [];
}

function getUser(id) {
  // TODO: connect to data layer - return user by id
  return null;
}

function getStats() {
  // TODO: connect to data layer - return user count
  return { totalUsers: 0 };
}

module.exports = { getUsers, getUser, getStats };
