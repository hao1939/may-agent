/**
 * WorkflowFileCache — In-memory caching layer for workflow filesystem operations.
 * 
 * Reduces redundant readFileSync calls during a workflow iteration by
 * caching parsed file content. Invalidates on write. Originally extracted
 * from shared/workflows/project-cache.ts (where it was named ProjectCache)
 * for project.ts; promoted to SDK so any project-scoped workflow can use it.
 * 
 * Usage:
 *   const cache = new WorkflowFileCache();
 *   const content = cache.read(path);     // cached after first read
 *   cache.write(path, newContent);         // writes through + updates cache
 *   cache.invalidate(path);               // force re-read on next access
 *   cache.flush();                        // clear all cached data
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";

export interface CacheEntry {
  content: string;
  loadedAt: number;       // Date.now() when loaded
  hits: number;           // number of cache hits
  dirty: boolean;         // true if written but not yet flushed
}

export interface CacheStats {
  entries: number;
  totalHits: number;
  totalMisses: number;
  totalWrites: number;
  hitRate: number;         // 0-1
}

export class WorkflowFileCache {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0, writes: 0 };
  private maxEntries: number;
  private ttlMs: number;

  /**
   * @param maxEntries - Maximum cached files (default 50)
   * @param ttlMs - Time-to-live in ms (default 30000 = 30s). 0 = no expiry.
   */
  constructor(maxEntries = 50, ttlMs = 30000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Read a file, returning cached content if available and not expired.
   * Returns null if file doesn't exist.
   */
  read(path: string): string | null {
    const normalized = this.normalizePath(path);
    const entry = this.cache.get(normalized);

    if (entry && !this.isExpired(entry)) {
      entry.hits++;
      this.stats.hits++;
      return entry.content;
    }

    // Cache miss — read from filesystem
    this.stats.misses++;
    try {
      const content = readFileSync(path, "utf-8");
      this.set(normalized, content, false);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Write content to a file and update the cache.
   */
  write(path: string, content: string): void {
    const normalized = this.normalizePath(path);
    writeFileSync(path, content, "utf-8");
    this.set(normalized, content, true);
    this.stats.writes++;
  }

  /**
   * Check if a file exists (uses cache if available).
   */
  exists(path: string): boolean {
    const normalized = this.normalizePath(path);
    const entry = this.cache.get(normalized);
    if (entry && !this.isExpired(entry)) return true;
    return existsSync(path);
  }

  /**
   * Invalidate a specific cached entry, forcing re-read on next access.
   */
  invalidate(path: string): boolean {
    return this.cache.delete(this.normalizePath(path));
  }

  /**
   * Clear all cached data.
   */
  flush(): void {
    this.cache.clear();
  }

  /**
   * Reset stats counters.
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, writes: 0 };
  }

  /**
   * Get cache performance statistics.
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      entries: this.cache.size,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalWrites: this.stats.writes,
      hitRate: total === 0 ? 0 : this.stats.hits / total,
    };
  }

  /**
   * Get a snapshot of all cached paths (for debugging).
   */
  getCachedPaths(): string[] {
    return [...this.cache.keys()];
  }

  /**
   * Check if a specific path is currently cached and not expired.
   */
  isCached(path: string): boolean {
    const entry = this.cache.get(this.normalizePath(path));
    return entry !== undefined && !this.isExpired(entry);
  }

  // ── Internal ──────────────────────────────────────────────────────

  private normalizePath(path: string): string {
    // Normalize trailing slashes and double slashes
    return path.replace(/\/+/g, "/").replace(/\/$/, "");
  }

  private isExpired(entry: CacheEntry): boolean {
    if (this.ttlMs === 0) return false;
    return Date.now() - entry.loadedAt > this.ttlMs;
  }

  private set(normalized: string, content: string, dirty: boolean): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(normalized)) {
      const oldest = this.findOldest();
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(normalized, {
      content,
      loadedAt: Date.now(),
      hits: 0,
      dirty,
    });
  }

  private findOldest(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.loadedAt < oldestTime) {
        oldestTime = entry.loadedAt;
        oldestKey = key;
      }
    }
    return oldestKey;
  }
}

/**
 * Parse sections from a project.md file content.
 * Pure function — no I/O.
 */
export function parseSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split("\n");
  let currentSection = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (currentSection) {
        sections.set(currentSection, currentContent.join("\n").trim());
      }
      currentSection = match[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections.set(currentSection, currentContent.join("\n").trim());
  }

  return sections;
}

/**
 * Extract a specific section's content from project.md.
 * Pure function — no I/O.
 */
export function extractSectionContent(content: string, sectionName: string): string | null {
  const sections = parseSections(content);
  return sections.get(sectionName) ?? null;
}

/**
 * Count how many times a pattern appears in cached content.
 * Useful for counting iterations, milestones, etc.
 */
export function countPattern(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}
