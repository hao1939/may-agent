/**
 * Task Cache — In-memory cache with TTL support for agent task results.
 * 
 * Caches expensive operation results (evaluations, file scans, etc.) to avoid
 * redundant computation when multiple agents request similar data within a
 * short timeframe.
 * 
 * Design:
 * - LRU eviction when maxEntries exceeded
 * - TTL per-entry with configurable default
 * - Namespace isolation per agent
 * - Thread-safe via synchronous operations (no async gaps)
 */

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessedAt: number;
  namespace: string;
}

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export interface CacheOptions {
  maxEntries: number;
  defaultTtlMs: number;
  onEvict?: (entry: CacheEntry) => void;
}

const DEFAULT_OPTIONS: CacheOptions = {
  maxEntries: 1000,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * TaskCache provides a namespaced, TTL-aware cache for agent task results.
 */
export class TaskCache {
  private entries: Map<string, CacheEntry> = new Map();
  private options: CacheOptions;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate a namespaced cache key.
   */
  private makeKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  /**
   * Get a cached value. Returns undefined if not found or expired.
   */
  get<T>(namespace: string, key: string): T | undefined {
    const fullKey = this.makeKey(namespace, key);
    const entry = this.entries.get(fullKey);

    if (!entry) {
      this.missCount++;
      return undefined;
    }

    // Check TTL expiration
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(fullKey);
      this.missCount++;
      return undefined;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.hitCount++;

    return entry.value as T;
  }

  /**
   * Set a cached value with optional TTL override.
   */
  set<T>(namespace: string, key: string, value: T, ttlMs?: number): void {
    const fullKey = this.makeKey(namespace, key);
    const now = Date.now();
    const ttl = ttlMs ?? this.options.defaultTtlMs;

    // Evict if at capacity and this is a new key
    if (!this.entries.has(fullKey) && this.entries.size >= this.options.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      key: fullKey,
      value,
      createdAt: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessedAt: now,
      namespace,
    };

    this.entries.set(fullKey, entry as CacheEntry);
  }

  /**
   * Delete a specific cache entry.
   */
  delete(namespace: string, key: string): boolean {
    const fullKey = this.makeKey(namespace, key);
    return this.entries.delete(fullKey);
  }

  /**
   * Clear all entries in a namespace.
   */
  clearNamespace(namespace: string): number {
    let count = 0;
    for (const [key, entry] of this.entries) {
      if (entry.namespace === namespace) {
        this.entries.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of this.entries.values()) {
      if (oldest === null || entry.createdAt < oldest) {
        oldest = entry.createdAt;
      }
      if (newest === null || entry.createdAt > newest) {
        newest = entry.createdAt;
      }
    }

    const total = this.hitCount + this.missCount;
    return {
      totalEntries: this.entries.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /**
   * Remove expired entries. Called periodically or before stats.
   */
  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Evict the least recently used entry when cache is at capacity.
   * Finds the entry with the oldest lastAccessedAt timestamp.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = 0;

    for (const [key, entry] of this.entries) {
      if (oldestKey === null || entry.lastAccessedAt < oldestTime) {
        oldestKey = key;
        oldestTime = entry.lastAccessedAt;
      }
    }

    if (oldestKey) {
      const entry = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      this.evictionCount++;
      if (this.options.onEvict && entry) {
        this.options.onEvict(entry);
      }
    }
  }

  /**
   * Get all entries in a namespace (for debugging/inspection).
   */
  getNamespaceEntries(namespace: string): CacheEntry[] {
    const results: CacheEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.namespace === namespace) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(namespace: string, key: string): boolean {
    const fullKey = this.makeKey(namespace, key);
    const entry = this.entries.get(fullKey);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(fullKey);
      return false;
    }
    return true;
  }

  /**
   * Get remaining TTL for an entry in milliseconds.
   * Returns -1 if entry doesn't exist or is expired.
   */
  ttl(namespace: string, key: string): number {
    const fullKey = this.makeKey(namespace, key);
    const entry = this.entries.get(fullKey);
    if (!entry) return -1;
    const remaining = entry.expiresAt - Date.now();
    if (remaining <= 0) {
      this.entries.delete(fullKey);
      return -1;
    }
    return remaining;
  }
}
