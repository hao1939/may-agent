/**
 * Simple in-memory cache with TTL expiration
 */

const config = require('./config');

class Cache {
  constructor(options = {}) {
    // BUG: hardcoded 60s instead of reading from config
    this.defaultTTL = options.ttl || 60;
    this.maxSize = options.maxSize || config.get('max_cache_size') || 500;
    this.store = new Map();
  }

  set(key, value, ttl) {
    const effectiveTTL = ttl || this.defaultTTL;

    // Evict if at capacity
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (effectiveTTL * 1000),
      createdAt: Date.now()
    });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get size() {
    // Clean expired entries first
    for (const [key, entry] of this.store) {
      if (Date.now() > entry.expiresAt) {
        this.store.delete(key);
      }
    }
    return this.store.size;
  }

  getTTL(key) {
    const entry = this.store.get(key);
    if (!entry) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : -1;
  }
}

module.exports = { Cache };
