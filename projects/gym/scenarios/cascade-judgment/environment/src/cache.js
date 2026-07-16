/**
 * Cache Module — in-memory cache with TTL and eviction
 * 
 * Used by: search API, product API, user preferences
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const EVICTION_THRESHOLD_MS = 1 * 60 * 60 * 1000;  // BUG: only evicts entries older than 1 hour
const MAX_CACHE_SIZE = 10000;  // max entries

class Cache {
  constructor(options = {}) {
    this.store = new Map();
    this.ttl = options.ttl || CACHE_TTL_MS;
    this.maxSize = options.maxSize || MAX_CACHE_SIZE;
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.createdAt > this.ttl) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    
    this.hits++;
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key, value) {
    this.store.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      size: JSON.stringify(value).length  // approximate memory tracking
    });
    
    // Note: no eviction triggered on set — cache can grow past maxSize
    // Eviction only happens when evictStale() is called by the scheduler
  }

  /**
   * Evict stale entries from the cache.
   * BUG: The threshold is 1 hour but TTL is 24 hours.
   * This means entries sit in cache for up to 24 hours before expiring on read,
   * but evictStale() only removes entries older than 1 hour on its hourly run.
   * 
   * Wait — actually the bug is the OPPOSITE: the eviction threshold is SHORTER
   * than TTL, so evictStale() would aggressively evict valid entries.
   * BUT the comparison is wrong (uses > instead of <), so it actually 
   * evicts NOTHING because all entries are newer than 1 hour when called hourly.
   */
  evictStale() {
    const now = Date.now();
    let evicted = 0;
    
    for (const [key, entry] of this.store) {
      const age = now - entry.createdAt;
      // BUG: This should check age > this.ttl, but instead checks age > EVICTION_THRESHOLD_MS
      // Since evictStale() runs hourly and entries are at most 1 hour old when it runs,
      // this condition is almost never true → cache grows unbounded
      if (age > EVICTION_THRESHOLD_MS && age < this.ttl) {
        // This range (1h to 24h) is where entries SHOULD be kept, not evicted!
        // But the logic is inverted — it tries to evict entries that are 
        // between 1 hour and 24 hours old. However since it runs hourly,
        // entries are always < 1 hour old, so nothing gets evicted.
        // 
        // The REAL fix: evict entries where age > this.ttl
        // OR: implement proper LRU eviction when size > maxSize
      }
      
      // Additional bug: the eviction doesn't actually delete!
      // Someone commented out the delete during debugging and forgot to restore it
      // this.store.delete(key);  // COMMENTED OUT
      // evicted++;
    }
    
    return evicted;
  }

  /**
   * Search-specific cache. Returns cached search results for a query.
   * The search index rebuilds every hour, but cache TTL is 24 hours,
   * so users see stale results for up to 24 hours after a rebuild.
   */
  getSearchResults(query) {
    const key = `search:${query.toLowerCase().trim()}`;
    return this.get(key);
  }

  setSearchResults(query, results) {
    const key = `search:${query.toLowerCase().trim()}`;
    this.set(key, results);
  }

  getStats() {
    let totalSize = 0;
    for (const [, entry] of this.store) {
      totalSize += entry.size || 0;
    }
    return {
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      estimatedMemoryMB: totalSize / 1024 / 1024
    };
  }

  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// Global cache instance — shared across all modules
const globalCache = new Cache();

// Hourly eviction scheduler
// In production, this runs every hour via setInterval
// evictStale() is called but does nothing due to the bug
function startEvictionScheduler() {
  return setInterval(() => {
    const evicted = globalCache.evictStale();
    console.log(`[cache] evictStale ran: evicted ${evicted} entries, ${globalCache.store.size} remaining`);
  }, 60 * 60 * 1000);
}

module.exports = {
  Cache,
  globalCache,
  startEvictionScheduler,
  CACHE_TTL_MS,
  EVICTION_THRESHOLD_MS,
  MAX_CACHE_SIZE
};
