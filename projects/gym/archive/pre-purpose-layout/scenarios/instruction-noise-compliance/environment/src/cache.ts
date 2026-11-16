const config = require("./config");

class CacheManager {
  constructor() {
    this.store = new Map();
    this.maxSize = config.maxSize;
    this.maxAge = config.maxAge;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.store.delete(key);
      return null;
    }
    
    return entry.value;
  }

  set(key, value) {
    // Evict if at capacity
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
    
    this.store.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }
}

module.exports = { CacheManager };
