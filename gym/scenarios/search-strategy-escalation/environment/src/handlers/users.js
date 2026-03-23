// src/handlers/users.js - User endpoint handlers
const { getDb } = require('../lib/database');

async function getUser(req, res) {
  const { id } = req.params;
  const user = await getDb().findUser(id);
  
  if (!user) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'User not found' }));
    return;
  }
  
  res.end(JSON.stringify(user));
}

async function listUsers(req, res) {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const users = await getDb().listUsers(limit, offset);
  res.end(JSON.stringify({ users, limit, offset }));
}

async function createUser(req, res) {
  const { name, email } = req.body;
  
  if (!name || !email) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Name and email required' }));
    return;
  }
  
  const user = await getDb().createUser({ name, email });
  res.statusCode = 201;
  res.end(JSON.stringify(user));
}

module.exports = { getUser, listUsers, createUser };
