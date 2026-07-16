/**
 * middleware/index.js — Middleware barrel export
 * 
 * Re-exports all middleware for backward compatibility.
 * Added by @devon on 2026-04-08 during middleware split.
 */
const { generateToken, verifyToken, authMiddleware, requireRole } = require('./auth');
const { sessionMiddleware, destroySession } = require('./session');
const { requestLogger } = require('./logging');
const { rateLimiter } = require('./rate-limit');

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  requireRole,
  sessionMiddleware,
  destroySession,
  requestLogger,
  rateLimiter
};
