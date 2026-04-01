const express = require('express');
const router = express.Router();

/**
 * GET /api/users/profile
 * Returns the authenticated user's profile.
 * Requires valid Bearer token in Authorization header.
 */
router.get('/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  });
});

/**
 * PUT /api/users/profile
 * Update user profile fields.
 */
router.put('/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { name, email } = req.body;
  
  // In a real app this would update the database
  const updated = {
    ...req.user,
    ...(name && { name }),
    ...(email && { email }),
  };
  
  res.json({ message: 'Profile updated', user: updated });
});

/**
 * GET /api/users/sessions
 * Returns active session info for the authenticated user.
 */
router.get('/sessions', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    userId: req.user.id,
    activeSessions: 1, // simplified
    lastActivity: new Date().toISOString(),
  });
});

module.exports = router;
