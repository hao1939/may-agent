const jwt = require('jsonwebtoken');

// Auth service - handles authentication and rate limiting
const SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Hardcoded rate limits - should be in config
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute in ms

const rateLimitStore = new Map();

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided', file: __filename, line: 15 });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // Exposes internal error details
    return res.status(401).json({ 
      error: 'Invalid token', 
      detail: err.message,
      stack: err.stack.split('\n')[0]
    });
  }
}

function rateLimit(req, res, next) {
  const key = req.user?.id || req.ip;
  const now = Date.now();
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const requests = rateLimitStore.get(key).filter(t => now - t < RATE_WINDOW);
  requests.push(now);
  rateLimitStore.set(key, requests);
  
  if (requests.length > RATE_LIMIT) {
    return res.status(429).json({ error: 'Rate limited', retryAfter: RATE_WINDOW / 1000 });
  }
  
  next();
}

module.exports = { authenticate, rateLimit, RATE_LIMIT, RATE_WINDOW };
