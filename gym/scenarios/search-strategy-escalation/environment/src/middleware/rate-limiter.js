// src/middleware/rate-limiter.js - Rate limiting middleware
const config = require('../config');
const { RateLimitStore } = require('../lib/rate-store');

const store = new RateLimitStore();

function getKey(req) {
  // Use user ID if authenticated, IP otherwise
  if (req.userId) {
    return `user:${req.userId}`;
  }
  return `ip:${req.ip}`;
}

function rateLimiter(req, res, next) {
  if (!config.rateLimit.enabled) {
    return next();
  }

  // Skip certain paths
  if (config.rateLimit.skipPaths.includes(req.path)) {
    return next();
  }

  const key = getKey(req);
  const windowMs = config.rateLimit.windowMs;
  const max = config.rateLimit.max || 10;

  const current = store.increment(key, windowMs);

  if (config.rateLimit.headers) {
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
    res.setHeader('X-RateLimit-Reset', store.getResetTime(key));
  }

  if (current > max) {
    res.statusCode = 429;
    res.end(JSON.stringify({
      error: 'Too Many Requests',
      retryAfter: Math.ceil(store.getTimeToReset(key) / 1000)
    }));
    return;
  }

  next();
}

module.exports = rateLimiter;
module.exports.getKey = getKey;
