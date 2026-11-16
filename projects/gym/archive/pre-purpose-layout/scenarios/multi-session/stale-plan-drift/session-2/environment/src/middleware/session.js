/**
 * middleware/session.js — Session Management Middleware
 * 
 * Split from monolithic middleware.js by @devon on 2026-04-08.
 * Handles cookie-based session creation, lookup, and cleanup.
 */
const crypto = require('crypto');

const sessions = new Map();
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function sessionMiddleware(req, res, next) {
  const sessionId = req.cookies?.session_id;
  
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    if (Date.now() - session.createdAt > SESSION_MAX_AGE) {
      sessions.delete(sessionId);
    } else {
      req.session = session.data;
      req.sessionId = sessionId;
      next();
      return;
    }
  }
  
  const newId = generateSessionId();
  sessions.set(newId, { data: {}, createdAt: Date.now() });
  req.session = sessions.get(newId).data;
  req.sessionId = newId;
  res.cookie('session_id', newId, { httpOnly: true, maxAge: SESSION_MAX_AGE });
  next();
}

function destroySession(req) {
  if (req.sessionId) {
    sessions.delete(req.sessionId);
  }
}

// Cleanup expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_MAX_AGE) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);

module.exports = { sessionMiddleware, destroySession };
