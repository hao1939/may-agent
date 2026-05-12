import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCachedContext,
  readProjectFile,
  readJournalFile,
  readDiscussionFile,
  getJournalTail,
  writeProjectFile,
  appendJournalEntry,
  extractField,
  extractSection,
  buildIterationSnapshot,
  shouldStop,
  formatOrchestratorContext,
  getCacheReport,
  flushBetweenIterations,
  type CachedProjectContext,
  type IterationSnapshot,
} from "../shared/workflows/master-worker-cached.ts";
import { ProjectCache } from "../shared/workflows/project-cache.ts";

// ── Helpers ─────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<CachedProjectContext> = {}): CachedProjectContext {
  const cache = new ProjectCache(50, 0); // no TTL for tests
  return {
    projectDir: "/tmp/test-project",
    projectFile: "/tmp/test-project/project.md",
    journalFile: "/tmp/test-project/journal.md",
    discussionFile: "/tmp/test-project/discussion.md",
    cache,
    ...overrides,
  };
}

const SAMPLE_PROJECT = `# Test Project

**Workflow**: master-worker
**Max Iterations**: 10
**Status**: active
**Owner**: alice

## Goal
Build a widget factory

## Plan
- [ ] Step 1
- [x] Step 2

## Metrics
| Metric | Current | Target |
|--------|---------|--------|
| tests  | 5       | 20     |
`;

const SAMPLE_JOURNAL = `## 2025-01-15 Iteration 1
Worker produced widget.ts (45 lines).

## 2025-01-15 Iteration 2
Worker added tests for widget.ts (12 tests).
`;

// ── createCachedContext ─────────────────────────────────────────────────

describe("createCachedContext", () => {
  it("creates context with correct paths", () => {
    const ctx = createCachedContext("/foo/bar");
    expect(ctx.projectDir).toBe("/foo/bar");
    expect(ctx.projectFile).toBe("/foo/bar/project.md");
    expect(ctx.journalFile).toBe("/foo/bar/journal.md");
    expect(ctx.discussionFile).toBe("/foo/bar/discussion.md");
    expect(ctx.cache).toBeInstanceOf(ProjectCache);
  });

  it("accepts custom TTL", () => {
    const ctx = createCachedContext("/foo", 5000);
    expect(ctx.cache).toBeInstanceOf(ProjectCache);
  });
});

// ── extractField ────────────────────────────────────────────────────────

describe("extractField", () => {
  it("extracts Status field", () => {
    expect(extractField(SAMPLE_PROJECT, "Status")).toBe("active");
  });

  it("extracts Max Iterations", () => {
    expect(extractField(SAMPLE_PROJECT, "Max Iterations")).toBe("10");
  });

  it("extracts Owner", () => {
    expect(extractField(SAMPLE_PROJECT, "Owner")).toBe("alice");
  });

  it("returns empty string for missing field", () => {
    expect(extractField(SAMPLE_PROJECT, "Nonexistent")).toBe("");
  });

  it("handles case insensitive match", () => {
    expect(extractField("**status**: done", "Status")).toBe("done");
  });
});

// ── extractSection ──────────────────────────────────────────────────────

describe("extractSection", () => {
  it("extracts Goal section", () => {
    expect(extractSection(SAMPLE_PROJECT, "Goal")).toBe("Build a widget factory");
  });

  it("extracts Plan section with checkboxes", () => {
    const plan = extractSection(SAMPLE_PROJECT, "Plan");
    expect(plan).toContain("- [ ] Step 1");
  });

  it("returns empty string for missing section", () => {
    expect(extractSection(SAMPLE_PROJECT, "Missing")).toBe("");
  });
});

// ── Cached reads (using pre-seeded cache) ───────────────────────────────

describe("readProjectFile", () => {
  it("returns cached content", () => {
    const ctx = makeCtx();
    // Pre-seed cache
    ctx.cache["cache"].set(ctx.projectFile, {
      content: SAMPLE_PROJECT,
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });
    expect(readProjectFile(ctx)).toBe(SAMPLE_PROJECT);
  });

  it("returns null when file not cached and doesn't exist", () => {
    const ctx = makeCtx();
    const result = readProjectFile(ctx);
    expect(result).toBeNull();
  });
});

describe("readJournalFile", () => {
  it("returns cached journal content", () => {
    const ctx = makeCtx();
    ctx.cache["cache"].set(ctx.journalFile, {
      content: SAMPLE_JOURNAL,
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });
    expect(readJournalFile(ctx)).toBe(SAMPLE_JOURNAL);
  });

  it("returns empty string when not found", () => {
    const ctx = makeCtx();
    expect(readJournalFile(ctx)).toBe("");
  });
});

describe("readDiscussionFile", () => {
  it("returns null when discussion doesn't exist", () => {
    const ctx = makeCtx();
    expect(readDiscussionFile(ctx)).toBeNull();
  });
});

describe("getJournalTail", () => {
  it("returns full journal when under limit", () => {
    const ctx = makeCtx();
    ctx.cache["cache"].set(ctx.journalFile, {
      content: SAMPLE_JOURNAL,
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });
    expect(getJournalTail(ctx, 5000)).toBe(SAMPLE_JOURNAL);
  });

  it("truncates to last N chars", () => {
    const ctx = makeCtx();
    const longJournal = "x".repeat(5000);
    ctx.cache["cache"].set(ctx.journalFile, {
      content: longJournal,
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });
    const tail = getJournalTail(ctx, 100);
    expect(tail.length).toBe(100);
    expect(tail).toBe("x".repeat(100));
  });
});

// ── buildIterationSnapshot ──────────────────────────────────────────────

describe("buildIterationSnapshot", () => {
  it("builds complete snapshot from cached data", () => {
    const ctx = makeCtx();
    ctx.cache["cache"].set(ctx.projectFile, {
      content: SAMPLE_PROJECT,
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });
    ctx.cache["cache"].set(ctx.journalFile, {
      content: SAMPLE_JOURNAL,
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });

    const snap = buildIterationSnapshot(ctx, 3);
    expect(snap).not.toBeNull();
    expect(snap!.iteration).toBe(3);
    expect(snap!.maxIterations).toBe(10);
    expect(snap!.status).toBe("active");
    expect(snap!.goal).toBe("Build a widget factory");
    expect(snap!.journalTail).toBe(SAMPLE_JOURNAL);
    expect(snap!.discussionContent).toBeNull();
  });

  it("returns null when project file missing", () => {
    const ctx = makeCtx();
    expect(buildIterationSnapshot(ctx, 1)).toBeNull();
  });

  it("defaults maxIterations to 50 when not specified", () => {
    const ctx = makeCtx();
    ctx.cache["cache"].set(ctx.projectFile, {
      content: "# Project\n**Status**: active\n## Goal\nDo stuff",
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });
    ctx.cache["cache"].set(ctx.journalFile, {
      content: "",
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });

    const snap = buildIterationSnapshot(ctx, 1);
    expect(snap!.maxIterations).toBe(50);
  });
});

// ── shouldStop ──────────────────────────────────────────────────────────

describe("shouldStop", () => {
  const baseSnapshot: IterationSnapshot = {
    projectContent: SAMPLE_PROJECT,
    journalTail: "",
    discussionContent: null,
    iteration: 1,
    maxIterations: 10,
    status: "active",
    goal: "test",
  };

  it("does not stop when active and under limit", () => {
    expect(shouldStop(baseSnapshot)).toEqual({ stop: false, reason: "" });
  });

  it("stops when iteration exceeds max", () => {
    const result = shouldStop({ ...baseSnapshot, iteration: 11 });
    expect(result.stop).toBe(true);
    expect(result.reason).toContain("max iterations");
  });

  it("stops when status is done", () => {
    const result = shouldStop({ ...baseSnapshot, status: "done" });
    expect(result.stop).toBe(true);
    expect(result.reason).toContain("done");
  });

  it("stops when status is cancelled", () => {
    const result = shouldStop({ ...baseSnapshot, status: "cancelled" });
    expect(result.stop).toBe(true);
  });

  it("stops when status is paused", () => {
    const result = shouldStop({ ...baseSnapshot, status: "paused" });
    expect(result.stop).toBe(true);
  });

  it("does not stop for blocked status", () => {
    const result = shouldStop({ ...baseSnapshot, status: "blocked" });
    expect(result.stop).toBe(false);
  });

  it("does not stop for waiting status", () => {
    const result = shouldStop({ ...baseSnapshot, status: "waiting" });
    expect(result.stop).toBe(false);
  });

  it("stops at exactly max+1", () => {
    expect(shouldStop({ ...baseSnapshot, iteration: 10 }).stop).toBe(false);
    expect(shouldStop({ ...baseSnapshot, iteration: 11 }).stop).toBe(true);
  });
});

// ── formatOrchestratorContext ────────────────────────────────────────────

describe("formatOrchestratorContext", () => {
  const snap: IterationSnapshot = {
    projectContent: SAMPLE_PROJECT,
    journalTail: SAMPLE_JOURNAL,
    discussionContent: null,
    iteration: 3,
    maxIterations: 10,
    status: "active",
    goal: "Build a widget factory",
  };

  it("includes iteration header", () => {
    const result = formatOrchestratorContext(snap);
    expect(result).toContain("## Iteration 3/10");
  });

  it("includes goal", () => {
    const result = formatOrchestratorContext(snap);
    expect(result).toContain("**Goal**: Build a widget factory");
  });

  it("includes project.md content", () => {
    const result = formatOrchestratorContext(snap);
    expect(result).toContain("## project.md");
    expect(result).toContain("**Workflow**: master-worker");
  });

  it("includes journal tail", () => {
    const result = formatOrchestratorContext(snap);
    expect(result).toContain("## journal.md (last 3000 chars)");
    expect(result).toContain("Worker produced widget.ts");
  });

  it("excludes discussion when null", () => {
    const result = formatOrchestratorContext(snap);
    expect(result).not.toContain("## discussion.md");
  });

  it("includes discussion when present", () => {
    const withDisc = { ...snap, discussionContent: "Hao says: ship it" };
    const result = formatOrchestratorContext(withDisc);
    expect(result).toContain("## discussion.md");
    expect(result).toContain("Hao says: ship it");
  });
});

// ── getCacheReport ──────────────────────────────────────────────────────

describe("getCacheReport", () => {
  it("returns formatted stats string", () => {
    const ctx = makeCtx();
    // Seed and read to generate stats
    ctx.cache["cache"].set(ctx.projectFile, {
      content: "test",
      loadedAt: Date.now(),
      hits: 0,
      dirty: false,
    });
    ctx.cache.read(ctx.projectFile); // hit
    ctx.cache.read(ctx.projectFile); // hit

    const report = getCacheReport(ctx);
    expect(report).toContain("Cache:");
    expect(report).toContain("entries");
    expect(report).toContain("hits");
  });
});

// ── flushBetweenIterations ──────────────────────────────────────────────

describe("flushBetweenIterations", () => {
  it("invalidates project and journal but not discussion", () => {
    const ctx = makeCtx();
    // Seed all three
    for (const file of [ctx.projectFile, ctx.journalFile, ctx.discussionFile]) {
      ctx.cache["cache"].set(file, {
        content: "cached",
        loadedAt: Date.now(),
        hits: 0,
        dirty: false,
      });
    }
    expect(ctx.cache.isCached(ctx.projectFile)).toBe(true);
    expect(ctx.cache.isCached(ctx.journalFile)).toBe(true);
    expect(ctx.cache.isCached(ctx.discussionFile)).toBe(true);

    flushBetweenIterations(ctx);

    expect(ctx.cache.isCached(ctx.projectFile)).toBe(false);
    expect(ctx.cache.isCached(ctx.journalFile)).toBe(false);
    expect(ctx.cache.isCached(ctx.discussionFile)).toBe(true);
  });
});
