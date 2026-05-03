class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

const users = [];

function createUser({ name, email, age }) {
  const user = {
    id: users.length + 1,
    name,
    email,
    age,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

function getUser(id) {
  return users.find((u) => u.id === id) || null;
}

function listUsers() {
  return [...users];
}

module.exports = { ValidationError, createUser, getUser, listUsers };
