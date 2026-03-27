// src/lib/cache.js - Simple LRU cache
const config = require('../config');

class Cache {
  constructor(maxSize = config.cache.maxSize, ttl = config.cache.ttl) {
    this.maxSize = maxSize;
    this.ttl = ttl * 1000; // convert to ms
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.store.size >= this.maxSize) {
      // Evict oldest
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
    }
    this.store.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }
}

module.exports = { Cache };
