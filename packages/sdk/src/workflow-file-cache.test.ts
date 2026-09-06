import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

// Import directly from source
import { WorkflowFileCache, parseSections, extractSectionContent, countPattern } from "./workflow-file-cache.js";

const TEST_DIR = join(import.meta.dirname ?? __dirname, "__test-cache-tmp__");

function setupTestDir() {
  mkdirSync(TEST_DIR, { recursive: true });
}

function cleanTestDir() {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
}

function writeTestFile(name: string, content: string): string {
  const path = join(TEST_DIR, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

describe("WorkflowFileCache", () => {
  let cache: WorkflowFileCache;

  beforeEach(() => {
    setupTestDir();
    cache = new WorkflowFileCache();
  });

  afterEach(() => {
    cleanTestDir();
  });

  // ── Basic read/write ──────────────────────────────────────────────

  it("reads a file and caches it", () => {
    const path = writeTestFile("a.md", "hello world");
    const result = cache.read(path);
    expect(result).toBe("hello world");
    expect(cache.isCached(path)).toBe(true);
  });

  it("returns null for non-existent file", () => {
    const result = cache.read(join(TEST_DIR, "nonexistent.md"));
    expect(result).toBeNull();
  });

  it("returns cached content on second read", () => {
    const path = writeTestFile("b.md", "original");
    cache.read(path);
    // Modify file on disk — cache should still return original
    writeFileSync(path, "modified", "utf-8");
    const result = cache.read(path);
    expect(result).toBe("original");
  });

  it("write updates both disk and cache", () => {
    const path = writeTestFile("c.md", "old");
    cache.read(path);
    cache.write(path, "new content");
    expect(cache.read(path)).toBe("new content");
    // Verify disk
    const { readFileSync } = require("node:fs");
    expect(readFileSync(path, "utf-8")).toBe("new content");
  });

  // ── Invalidation ──────────────────────────────────────────────────

  it("invalidate forces re-read from disk", () => {
    const path = writeTestFile("d.md", "v1");
    cache.read(path);
    writeFileSync(path, "v2", "utf-8");
    cache.invalidate(path);
    expect(cache.read(path)).toBe("v2");
  });

  it("invalidate returns false for uncached path", () => {
    expect(cache.invalidate("/no/such/path")).toBe(false);
  });

  it("flush clears all entries", () => {
    const p1 = writeTestFile("e1.md", "a");
    const p2 = writeTestFile("e2.md", "b");
    cache.read(p1);
    cache.read(p2);
    cache.flush();
    expect(cache.isCached(p1)).toBe(false);
    expect(cache.isCached(p2)).toBe(false);
    expect(cache.getStats().entries).toBe(0);
  });

  // ── Stats ─────────────────────────────────────────────────────────

  it("tracks hits and misses", () => {
    const path = writeTestFile("f.md", "data");
    cache.read(path); // miss
    cache.read(path); // hit
    cache.read(path); // hit
    const stats = cache.getStats();
    expect(stats.totalMisses).toBe(1);
    expect(stats.totalHits).toBe(2);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });

  it("tracks writes", () => {
    const path = writeTestFile("g.md", "x");
    cache.write(path, "y");
    cache.write(path, "z");
    expect(cache.getStats().totalWrites).toBe(2);
  });

  it("hitRate is 0 when no operations", () => {
    expect(cache.getStats().hitRate).toBe(0);
  });

  it("resetStats clears counters", () => {
    const path = writeTestFile("h.md", "data");
    cache.read(path);
    cache.read(path);
    cache.resetStats();
    const stats = cache.getStats();
    expect(stats.totalHits).toBe(0);
    expect(stats.totalMisses).toBe(0);
  });

  // ── TTL expiry ────────────────────────────────────────────────────

  it("expired entry triggers re-read", () => {
    const shortCache = new WorkflowFileCache(50, 1); // 1ms TTL
    const path = writeTestFile("i.md", "v1");
    shortCache.read(path);
    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy wait 5ms
    writeFileSync(path, "v2", "utf-8");
    expect(shortCache.read(path)).toBe("v2");
  });

  it("TTL=0 means no expiry", () => {
    const noExpiry = new WorkflowFileCache(50, 0);
    const path = writeTestFile("j.md", "forever");
    noExpiry.read(path);
    writeFileSync(path, "changed", "utf-8");
    // Should still return cached even after a delay
    expect(noExpiry.read(path)).toBe("forever");
  });

  // ── Capacity / eviction ───────────────────────────────────────────

  it("evicts oldest entry when at capacity", () => {
    const tinyCache = new WorkflowFileCache(2, 0);
    const p1 = writeTestFile("k1.md", "first");
    const p2 = writeTestFile("k2.md", "second");
    const p3 = writeTestFile("k3.md", "third");
    tinyCache.read(p1);
    tinyCache.read(p2);
    tinyCache.read(p3); // should evict p1
    expect(tinyCache.isCached(p1)).toBe(false);
    expect(tinyCache.isCached(p3)).toBe(true);
  });

  // ── exists ────────────────────────────────────────────────────────

  it("exists returns true for cached file", () => {
    const path = writeTestFile("l.md", "yes");
    cache.read(path);
    expect(cache.exists(path)).toBe(true);
  });

  it("exists returns true for uncached existing file", () => {
    const path = writeTestFile("m.md", "yes");
    expect(cache.exists(path)).toBe(true);
  });

  it("exists returns false for non-existent file", () => {
    expect(cache.exists(join(TEST_DIR, "nope.md"))).toBe(false);
  });

  // ── getCachedPaths ────────────────────────────────────────────────

  it("getCachedPaths returns all cached paths", () => {
    const p1 = writeTestFile("n1.md", "a");
    const p2 = writeTestFile("n2.md", "b");
    cache.read(p1);
    cache.read(p2);
    const paths = cache.getCachedPaths();
    expect(paths).toHaveLength(2);
  });

  // ── Path normalization ────────────────────────────────────────────

  it("normalizes double slashes", () => {
    const path = writeTestFile("o.md", "content");
    const doublePath = path.replace(/\//g, "//");
    cache.read(path);
    expect(cache.isCached(doublePath)).toBe(true);
  });
});

// ── Pure function tests ─────────────────────────────────────────────────

describe("parseSections", () => {
  it("parses multiple sections", () => {
    const content = "## Goal\nBuild stuff\n\n## Plan\n- item 1\n- item 2";
    const sections = parseSections(content);
    expect(sections.get("Goal")).toBe("Build stuff");
    expect(sections.get("Plan")).toBe("- item 1\n- item 2");
  });

  it("returns empty map for no sections", () => {
    const sections = parseSections("just text\nno headers");
    expect(sections.size).toBe(0);
  });

  it("handles empty content", () => {
    expect(parseSections("").size).toBe(0);
  });

  it("handles section with no content", () => {
    const sections = parseSections("## Empty\n## Next\nhas content");
    expect(sections.get("Empty")).toBe("");
    expect(sections.get("Next")).toBe("has content");
  });
});

describe("extractSectionContent", () => {
  const content = "## Goal\nDo the thing\n## Metrics\n- metric 1";

  it("extracts existing section", () => {
    expect(extractSectionContent(content, "Goal")).toBe("Do the thing");
  });

  it("returns null for missing section", () => {
    expect(extractSectionContent(content, "Missing")).toBeNull();
  });
});

describe("countPattern", () => {
  it("counts regex matches", () => {
    const content = "iteration 1\niteration 2\niteration 3";
    expect(countPattern(content, /iteration \d+/g)).toBe(3);
  });

  it("returns 0 for no matches", () => {
    expect(countPattern("hello", /xyz/g)).toBe(0);
  });

  it("counts overlapping-style patterns", () => {
    expect(countPattern("aaa", /a/g)).toBe(3);
  });

  it("works with empty string", () => {
    expect(countPattern("", /./g)).toBe(0);
  });
});
