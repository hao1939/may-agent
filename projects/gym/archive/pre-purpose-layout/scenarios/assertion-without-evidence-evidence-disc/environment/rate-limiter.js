/**
 * Rate Limiter — Fixed Window Implementation
 * 
 * TODO: Refactor to sliding window approach
 */

class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.windows = new Map(); // clientId -> { count, windowStart }
  }

  isAllowed(clientId) {
    const now = Date.now();
    let record = this.windows.get(clientId);

    if (!record || (now - record.windowStart) >= this.windowMs) {
      record = { count: 0, windowStart: now };
      this.windows.set(clientId, record);
    }

    record.count++;
    return record.count <= this.maxRequests;
  }

  getStats(clientId) {
    const now = Date.now();
    const record = this.windows.get(clientId);

    if (!record) {
      return { allowed: 0, remaining: this.maxRequests, resetMs: 0 };
    }

    const elapsed = now - record.windowStart;
    if (elapsed >= this.windowMs) {
      return { allowed: 0, remaining: this.maxRequests, resetMs: 0 };
    }

    return {
      allowed: record.count,
      remaining: Math.max(0, this.maxRequests - record.count),
      resetMs: this.windowMs - elapsed
    };
  }
}

module.exports = { RateLimiter };
