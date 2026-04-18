/**
 * Rate limiter middleware for auth endpoints.
 * Adds additional protection beyond account locking.
 */

class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  check(ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(ip)) {
      this.requests.set(ip, []);
    }

    const timestamps = this.requests.get(ip).filter(t => t > windowStart);
    this.requests.set(ip, timestamps);

    if (timestamps.length >= this.maxRequests) {
      return { allowed: false, retryAfter: Math.ceil(this.windowMs / 1000) };
    }

    timestamps.push(now);
    return { allowed: true, remaining: this.maxRequests - timestamps.length };
  }

  reset() {
    this.requests.clear();
  }
}

module.exports = { RateLimiter };
