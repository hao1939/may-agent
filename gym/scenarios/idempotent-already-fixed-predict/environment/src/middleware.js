/**
 * API Middleware - Rate limiting and request processing
 */

const { getConfig } = require('./config');
const { logRequest } = require('./logger');

/**
 * Rate limiter middleware.
 * Tracks request counts per IP and enforces the configured limit.
 */
function rateLimiter(req, res, next) {
  const config = getConfig();
  const clientIp = req.ip || req.connection.remoteAddress;

  // Initialize tracking for this IP if not exists
  if (!rateLimiter._counts) rateLimiter._counts = {};
  if (!rateLimiter._counts[clientIp]) {
    rateLimiter._counts[clientIp] = { count: 0, resetTime: Date.now() + 60000 };
  }

  const tracker = rateLimiter._counts[clientIp];

  // Reset counter if window has passed
  if (Date.now() > tracker.resetTime) {
    tracker.count = 0;
    tracker.resetTime = Date.now() + 60000;
  }

  tracker.count++;

  if (tracker.count > config.rateLimit) {
    logRequest(req, 'RATE_LIMITED');
    return res.status(429).json({ error: 'Too many requests' });
  }

  logRequest(req, 'ALLOWED');
  next();
}

/**
 * Authentication middleware.
 * Validates bearer tokens against the configured secret.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const token = authHeader.slice(7);
  const config = getConfig();

  if (token !== config.apiSecret) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  req.authenticated = true;
  next();
}

/**
 * Request logger middleware.
 * Logs method, path, and timestamp for each request.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req, `${res.statusCode} ${duration}ms`);
  });
  next();
}

module.exports = { rateLimiter, authenticate, requestLogger };
