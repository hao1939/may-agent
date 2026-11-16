/**
 * users.js — User Routes
 * 
 * Updated by @devon on 2026-04-08 — imports from split middleware modules.
 */
const express = require('express');
const router = express.Router();
const { generateToken } = require('../middleware/auth');
const { authMiddleware, requireRole } = require('../middleware/auth');

// In-memory user store (for demo)
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', password: 'hashed_pw_1' },
  { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user', password: 'hashed_pw_2' }
];

// POST /api/users/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // In production, compare hashed passwords
  const token = generateToken(user.id, user.role);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

// GET /api/users (requires auth + admin)
router.get('/', authMiddleware, requireRole('admin'), (req, res) => {
  res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
});

// GET /api/users/:id (requires auth)
router.get('/:id', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

module.exports = router;
