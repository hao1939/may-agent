/**
 * middleware/rate-limit.js — Rate Limiting Middleware
 * 
 * Split from monolithic middleware.js by @devon on 2026-04-08.
 * IP-based sliding window rate limiter.
 */

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

module.exports = { rateLimiter };
