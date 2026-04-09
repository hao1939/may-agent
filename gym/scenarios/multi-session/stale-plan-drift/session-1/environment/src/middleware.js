/**
 * middleware.js — Application Middleware
 * 
 * This monolithic middleware file handles authentication, session management,
 * request logging, and rate limiting. It has grown too large and needs to be
 * split into separate modules.
 */
const crypto = require('crypto');

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const TOKEN_EXPIRY = 3600; // 1 hour

function generateToken(userId, role) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    role: role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = decoded;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Requires role: ${role}` });
    }
    next();
  };
}

// ============================================================
// SESSION MIDDLEWARE
// ============================================================

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

// ============================================================
// LOGGING MIDDLEWARE
// ============================================================

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    if (LOG_LEVELS[level] >= currentLogLevel) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        method,
        url,
        status: res.statusCode,
        duration_ms: duration,
        ip,
        user: req.user?.sub || 'anonymous'
      };
      console.log(JSON.stringify(logEntry));
    }
  });
  
  next();
}

// ============================================================
// RATE LIMITING
// ============================================================

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

function rateLimiter(req, res, next) {
  const key = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    next();
    return;
  }
  
  const entry = rateLimitStore.get(key);
  if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry.count = 1;
    entry.windowStart = now;
    next();
    return;
  }
  
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retry_after: Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW - now) / 1000)
    });
  }
  
  next();
}

// Cleanup rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Auth
  generateToken,
  verifyToken,
  authMiddleware,
  requireRole,
  // Session
  sessionMiddleware,
  destroySession,
  // Logging
  requestLogger,
  // Rate limiting
  rateLimiter
};
