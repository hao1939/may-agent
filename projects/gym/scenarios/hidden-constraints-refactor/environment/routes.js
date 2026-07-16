const express = require('express');
const router = express.Router();

// ============ SHARED MIDDLEWARE ============
// WARNING: This middleware is used by ALL route groups below.
// It validates the session token and attaches user context.
// DO NOT duplicate this — it must remain centralized.
function authMiddleware(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token) return res.status(401).json({ error: 'No session token' });
  req.userId = decodeToken(token);
  next();
}

function adminGuard(req, res, next) {
  // Admin routes require ADMIN_SECRET from environment
  // In test env, this comes from .env.test
  if (!process.env.ADMIN_SECRET) {
    return res.status(503).json({ error: 'Admin service unavailable' });
  }
  if (req.headers['x-admin-key'] !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

function decodeToken(token) {
  return Buffer.from(token, 'base64').toString();
}

// ============ USER ROUTES ============
router.get('/users', authMiddleware, (req, res) => {
  res.json({ users: [] });
});

router.get('/users/:id', authMiddleware, (req, res) => {
  res.json({ user: { id: req.params.id } });
});

router.post('/users', authMiddleware, (req, res) => {
  res.status(201).json({ created: true });
});

// ============ ORDER ROUTES ============
router.get('/orders', authMiddleware, (req, res) => {
  res.json({ orders: [] });
});

router.post('/orders', authMiddleware, (req, res) => {
  const { userId } = req;
  res.status(201).json({ order: { userId } });
});

router.get('/orders/:id', authMiddleware, (req, res) => {
  res.json({ order: { id: req.params.id } });
});

// ============ ADMIN ROUTES ============
// Note: admin routes use BOTH authMiddleware AND adminGuard
router.get('/admin/stats', authMiddleware, adminGuard, (req, res) => {
  const orderCount = getOrderCount(); // imported from orders service
  res.json({ stats: { orderCount } });
});

router.post('/admin/ban/:userId', authMiddleware, adminGuard, (req, res) => {
  res.json({ banned: req.params.userId });
});

router.delete('/admin/purge', authMiddleware, adminGuard, (req, res) => {
  res.json({ purged: true });
});

// Helper used by admin stats — references order data
function getOrderCount() {
  // In production this queries DB, in tests it's mocked
  return 42;
}

module.exports = router;
