const express = require('express');
const router = express.Router();
const { validateUser } = require('./validator');
const { authMiddleware } = require('./middleware');

router.post('/users', authMiddleware, (req, res) => {
  const { name, email, age } = req.body;
  
  const errors = validateUser({ name, email, age });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  
  res.status(201).json({ id: Date.now(), name, email, age });
});

router.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Test User' });
});

module.exports = router;
