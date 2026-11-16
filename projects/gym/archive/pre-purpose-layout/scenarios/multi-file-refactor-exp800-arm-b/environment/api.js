// api.js — API route handlers
const { getUserData } = require('./userService');

function handleGetUser(req) {
  const userId = parseInt(req.params.id, 10);
  const user = getUserData(userId);
  return { status: 200, body: user };
}

function handleGetUserEmail(req) {
  const userId = parseInt(req.params.id, 10);
  const user = getUserData(userId);
  return { status: 200, body: { email: user.email } };
}

module.exports = { handleGetUser, handleGetUserEmail };
