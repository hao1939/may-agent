// src/lib/rate-store.js - In-memory rate limit storage
class RateLimitStore {
  constructor() {
    this.hits = new Map();    // key -> { count, resetTime }
  }

  increment(key, windowMs) {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now > entry.resetTime) {
      // New window
      this.hits.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return 1;
    }

    entry.count += 1;
    return entry.count;
  }

  getResetTime(key) {
    const entry = this.hits.get(key);
    return entry ? entry.resetTime : 0;
  }

  getTimeToReset(key) {
    const entry = this.hits.get(key);
    if (!entry) return 0;
    return Math.max(0, entry.resetTime - Date.now());
  }

  getCount(key) {
    const entry = this.hits.get(key);
    if (!entry || Date.now() > entry.resetTime) return 0;
    return entry.count;
  }

  reset(key) {
    this.hits.delete(key);
  }

  clear() {
    this.hits.clear();
  }
}

module.exports = { RateLimitStore };
