// src/app.js — Express application entry point
// @author: team
// NOTE: @sam didn't modify this file — still has hardcoded port

const express = require('express');
const config = require('./config');
const auth = require('./auth');
const userService = require('./user-service');
const db = require('./db');
const cache = require('./cache');

const app = express();
app.use(express.json());

// Auth routes
app.post('/api/v1/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await auth.login(email, password);
  if (result.success) {
    res.json({ token: result.token, user: result.user });
  } else {
    res.status(401).json({ error: result.error });
  }
});

app.post('/api/v1/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  const result = await auth.register(email, password, name, role);
  if (result.success) {
    res.status(201).json({ token: result.token, user: result.user });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// User routes
app.get('/api/v1/users', async (req, res) => {
  const { page, limit } = req.query;
  const users = await userService.listUsers(parseInt(page) || 1, parseInt(limit) || 20);
  res.json(users);
});

app.get('/api/v1/users/:id', async (req, res) => {
  const user = await userService.getUser(req.params.id);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.put('/api/v1/users/:id', async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.delete('/api/v1/users/:id', async (req, res) => {
  const deleted = await userService.deleteUser(req.params.id);
  if (deleted) {
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// BUG: Hardcoded port instead of using config
app.listen(3000, () => {
  console.log('Server running on port 3000');
});

module.exports = app;
