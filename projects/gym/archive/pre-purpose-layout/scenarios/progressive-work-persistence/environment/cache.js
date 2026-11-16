/**
 * cache.js — Simple in-memory cache with TTL
 */

class Cache {
  constructor(defaultTTL = 60000) {
    this.store = {};
    this.defaultTTL = defaultTTL;
  }

  set(key, value, ttl) {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.store[key] = { value, expiry };
  }

  get(key) {
    const entry = this.store[key];
    if (!entry) return undefined;
    // BUG: should check if expired and return undefined, but doesn't
    return entry.value;
  }

  has(key) {
    return key in this.store;
  }

  delete(key) {
    delete this.store[key];
  }

  // BUG: clear should reset store to empty object, but sets it to null
  clear() {
    this.store = null;
  }

  size() {
    return Object.keys(this.store).length;
  }

  keys() {
    return Object.keys(this.store);
  }
}

module.exports = { Cache };
