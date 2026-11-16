// src/auth-middleware.js — DECOY: Express middleware, unrelated
function authMiddleware(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token' });
  next();
}

module.exports = authMiddleware;
