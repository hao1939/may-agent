import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskCache } from "./task-cache";

describe("TaskCache", () => {
  let cache: TaskCache;

  beforeEach(() => {
    cache = new TaskCache({ maxEntries: 3, defaultTtlMs: 60_000 });
  });

  describe("basic operations", () => {
    it("should store and retrieve a value", () => {
      cache.set("ns", "key1", "value1");
      expect(cache.get("ns", "key1")).toBe("value1");
    });

    it("should return undefined for missing key", () => {
      expect(cache.get("ns", "missing")).toBeUndefined();
    });

    it("should isolate namespaces", () => {
      cache.set("ns1", "key", "a");
      cache.set("ns2", "key", "b");
      expect(cache.get("ns1", "key")).toBe("a");
      expect(cache.get("ns2", "key")).toBe("b");
    });

    it("should delete a specific entry", () => {
      cache.set("ns", "key1", "value1");
      expect(cache.delete("ns", "key1")).toBe(true);
      expect(cache.get("ns", "key1")).toBeUndefined();
    });

    it("should report has() correctly", () => {
      cache.set("ns", "key1", "value1");
      expect(cache.has("ns", "key1")).toBe(true);
      expect(cache.has("ns", "missing")).toBe(false);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", () => {
      vi.useFakeTimers();
      try {
        cache.set("ns", "key1", "value1", 1000);
        expect(cache.get("ns", "key1")).toBe("value1");

        vi.advanceTimersByTime(1001);
        expect(cache.get("ns", "key1")).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("should report TTL remaining", () => {
      vi.useFakeTimers();
      try {
        cache.set("ns", "key1", "value1", 5000);
        vi.advanceTimersByTime(2000);
        const remaining = cache.ttl("ns", "key1");
        expect(remaining).toBe(3000);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should prune expired entries", () => {
      vi.useFakeTimers();
      try {
        cache.set("ns", "a", 1, 1000);
        cache.set("ns", "b", 2, 5000);
        cache.set("ns", "c", 3, 1000);

        vi.advanceTimersByTime(2000);
        const pruned = cache.pruneExpired();
        expect(pruned).toBe(2);
        expect(cache.getStats().totalEntries).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entry when at capacity", () => {
      vi.useFakeTimers();
      try {
        // Fill cache to capacity (maxEntries=3)
        cache.set("ns", "first", "oldest");
        vi.advanceTimersByTime(100);
        cache.set("ns", "second", "middle");
        vi.advanceTimersByTime(100);
        cache.set("ns", "third", "newest");

        // Access "first" to make it recently used
        vi.advanceTimersByTime(100);
        cache.get("ns", "first");

        // Adding a 4th entry should evict "second" (least recently used)
        vi.advanceTimersByTime(100);
        cache.set("ns", "fourth", "new");

        // "second" should be evicted (LRU), "first" should survive (recently accessed)
        expect(cache.has("ns", "first")).toBe(true);
        expect(cache.has("ns", "second")).toBe(false);
        expect(cache.has("ns", "third")).toBe(true);
        expect(cache.has("ns", "fourth")).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should call onEvict callback when evicting", () => {
      const onEvict = vi.fn();
      const evictCache = new TaskCache({ maxEntries: 2, defaultTtlMs: 60_000, onEvict });

      evictCache.set("ns", "a", 1);
      evictCache.set("ns", "b", 2);
      evictCache.set("ns", "c", 3); // triggers eviction

      expect(onEvict).toHaveBeenCalledTimes(1);
    });

    it("should track eviction count in stats", () => {
      cache.set("ns", "a", 1);
      cache.set("ns", "b", 2);
      cache.set("ns", "c", 3);
      cache.set("ns", "d", 4); // triggers eviction

      expect(cache.getStats().evictionCount).toBe(1);
    });
  });

  describe("namespace operations", () => {
    it("should clear all entries in a namespace", () => {
      cache.set("ns1", "a", 1);
      cache.set("ns1", "b", 2);
      cache.set("ns2", "c", 3);

      const cleared = cache.clearNamespace("ns1");
      expect(cleared).toBe(2);
      expect(cache.has("ns1", "a")).toBe(false);
      expect(cache.has("ns2", "c")).toBe(true);
    });

    it("should list entries in a namespace", () => {
      cache.set("ns1", "a", 1);
      cache.set("ns2", "b", 2);
      cache.set("ns1", "c", 3);

      const entries = cache.getNamespaceEntries("ns1");
      expect(entries).toHaveLength(2);
    });
  });

  describe("statistics", () => {
    it("should track hits and misses", () => {
      cache.set("ns", "key1", "value1");
      cache.get("ns", "key1"); // hit
      cache.get("ns", "key1"); // hit
      cache.get("ns", "missing"); // miss

      const stats = cache.getStats();
      expect(stats.hitCount).toBe(2);
      expect(stats.missCount).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it("should reset stats on clear", () => {
      cache.set("ns", "key1", "value1");
      cache.get("ns", "key1");
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
    });
  });
});
