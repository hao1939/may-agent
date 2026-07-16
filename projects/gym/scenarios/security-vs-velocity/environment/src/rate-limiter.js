/**
 * Rate Limiter — controls request rates for API endpoints
 * 
 * Configuration:
 * - AUTH_RATE_LIMIT: Max requests/sec for /auth/* endpoints
 * - API_RATE_LIMIT: Max requests/sec for general API endpoints
 * - ADMIN_RATE_LIMIT: Max requests/sec for /admin/* endpoints
 */

const AUTH_RATE_LIMIT = 5;        // requests per second for auth endpoints
const API_RATE_LIMIT = 100;       // requests per second for general API
const ADMIN_RATE_LIMIT = 20;      // requests per second for admin endpoints

// Token bucket implementation
class TokenBucket {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate; // tokens per second
    this.lastRefill = Date.now();
  }

  tryConsume() {
    this._refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Per-IP rate limiting buckets
const buckets = new Map();

function getRateLimitForPath(path) {
  if (path.startsWith('/auth/')) return AUTH_RATE_LIMIT;
  if (path.startsWith('/admin/')) return ADMIN_RATE_LIMIT;
  return API_RATE_LIMIT;
}

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const path = req.path || req.url;
  const limit = getRateLimitForPath(path);
  
  const key = `${ip}:${path.split('/')[1]}`;
  
  if (!buckets.has(key)) {
    buckets.set(key, new TokenBucket(limit, limit));
  }
  
  const bucket = buckets.get(key);
  
  if (bucket.tryConsume()) {
    res.setHeader('X-RateLimit-Remaining', Math.floor(bucket.tokens));
    next();
  } else {
    res.status(429).json({
      error: 'Too Many Requests',
      retryAfter: Math.ceil(1 / limit),
      limit: limit,
      path: path
    });
  }
}

// No account lockout mechanism exists — rate limiting is the only
// brute-force protection for auth endpoints.
// TODO: Implement account lockout after N failed attempts (tracked in JIRA-4521)

module.exports = {
  rateLimitMiddleware,
  getRateLimitForPath,
  TokenBucket,
  AUTH_RATE_LIMIT,
  API_RATE_LIMIT,
  ADMIN_RATE_LIMIT
};
