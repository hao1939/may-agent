/**
 * Cache module  
 * Simple in-memory cache with TTL support
 * 
 * GOOD IMPROVEMENT: colleague added TTL support (was missing before)
 */

class Cache {
  constructor(defaultTTL = 60000) {
    this.store = new Map();
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl) {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.store.set(key, { value, expiry });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key) {
    // GOOD: colleague updated has() to respect TTL too
    const value = this.get(key);
    return value !== undefined;
  }

  delete(key) {
    return this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  size() {
    // GOOD: colleague updated size() to exclude expired entries
    let count = 0;
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now <= entry.expiry) count++;
    }
    return count;
  }
}

module.exports = { Cache };
