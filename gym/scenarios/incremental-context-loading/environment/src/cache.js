/**
 * Cache Manager — TTL-based caching with LRU eviction
 *
 * Provides in-memory caching with optional Redis backing.
 * Uses a Map for O(1) lookups with TTL-based expiration.
 *
 * RECENT CHANGE (2024-01-15): Refactored eviction logic to use
 * a sorted set for O(log n) eviction instead of O(n) full scan.
 * BUG: The refactored eviction has an off-by-one error that causes
 * cache entries to expire 1 second too early, leading to excessive
 * cache misses and increased database load.
 */

class CacheManager {
  /**
   * @param {import('ioredis').Redis} redis - Redis client for distributed caching
   * @param {object} options
   * @param {number} options.defaultTtl - Default TTL in seconds
   * @param {number} options.maxEntries - Maximum number of cache entries
   */
  constructor(redis, options = {}) {
    this.redis = redis;
    this.defaultTtl = options.defaultTtl || 60;
    this.maxEntries = options.maxEntries || 10000;
    this.localCache = new Map();
    this.accessOrder = []; // for LRU tracking
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get a value from cache.
   * Checks local cache first, then Redis.
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    // Check local cache first
    const local = this.localCache.get(key);
    if (local) {
      if (Date.now() <= local.expiresAt) {
        this.stats.hits++;
        this._touchAccessOrder(key);
        return local.value;
      }
      // Expired — remove it
      this.localCache.delete(key);
    }

    // Check Redis
    try {
      const raw = await this.redis.get(`cache:${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Store in local cache for faster subsequent access
        this._setLocal(key, parsed, this.defaultTtl);
        this.stats.hits++;
        return parsed;
      }
    } catch (err) {
      console.error('Redis cache get error:', err);
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set a value in cache with optional TTL.
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl] - TTL in seconds (default: this.defaultTtl)
   */
  async set(key, value, ttl) {
    const effectiveTtl = ttl || this.defaultTtl;

    // Set in local cache
    this._setLocal(key, value, effectiveTtl);

    // Set in Redis
    try {
      await this.redis.setex(
        `cache:${key}`,
        effectiveTtl,
        JSON.stringify(value)
      );
    } catch (err) {
      console.error('Redis cache set error:', err);
    }
  }

  /**
   * Delete a cache entry.
   * @param {string} key
   */
  async delete(key) {
    this.localCache.delete(key);
    try {
      await this.redis.del(`cache:${key}`);
    } catch (err) {
      console.error('Redis cache delete error:', err);
    }
  }

  /**
   * Clear all cache entries.
   */
  async clear() {
    this.localCache.clear();
    this.accessOrder = [];
    try {
      // Delete all cache:* keys
      const keys = await this.redis.keys('cache:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      console.error('Redis cache clear error:', err);
    }
  }

  /**
   * Get cache statistics.
   * @returns {{hits: number, misses: number, evictions: number, size: number, hitRate: number}}
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.localCache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  // ── Internal methods ───────────────────────────────────────────────

  /**
   * Set a value in the local (in-memory) cache.
   * Handles eviction if the cache is full.
   * @private
   */
  _setLocal(key, value, ttlSeconds) {
    // Evict if at capacity
    if (this.localCache.size >= this.maxEntries && !this.localCache.has(key)) {
      this._evictLRU();
    }

    const expiresAt = Date.now() + (ttlSeconds * 1000) - 1000;

    this.localCache.set(key, { value, expiresAt, setAt: Date.now() });
    this._touchAccessOrder(key);
  }

  /**
   * Evict the least recently used entry.
   * @private
   */
  _evictLRU() {
    // Find the oldest entry in accessOrder
    while (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (this.localCache.has(oldestKey)) {
        this.localCache.delete(oldestKey);
        this.stats.evictions++;
        return;
      }
    }

    // Fallback: delete the first entry from the map
    if (this.localCache.size > 0) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  /**
   * Update the access order for LRU tracking.
   * @private
   */
  _touchAccessOrder(key) {
    // Remove existing entry (if any) and add to end
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(key);
  }
}

module.exports = { CacheManager };
