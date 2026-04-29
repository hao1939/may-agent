import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MetricsCollector, MetricsEntry, computeStats } from "../workflows/metrics-collector.js";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function makeEntry(overrides: Partial<MetricsEntry> = {}): MetricsEntry {
  return {
    projectId: "proj-a",
    iterationNumber: 1,
    durationMs: 1000,
    testCount: 10,
    deliverableCount: 2,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("MetricsCollector", () => {
  let mc: MetricsCollector;
  beforeEach(() => { mc = new MetricsCollector(); });

  // ── Record & retrieve ─────────────────────────────────────────

  it("starts empty", () => {
    expect(mc.size).toBe(0);
    expect(mc.getAll()).toEqual([]);
  });

  it("records and retrieves a single entry", () => {
    mc.record(makeEntry());
    expect(mc.size).toBe(1);
    expect(mc.getAll()[0].projectId).toBe("proj-a");
  });

  it("records multiple entries", () => {
    mc.record(makeEntry({ iterationNumber: 1 }));
    mc.record(makeEntry({ iterationNumber: 2 }));
    mc.record(makeEntry({ projectId: "proj-b" }));
    expect(mc.size).toBe(3);
  });

  it("stores copies, not references", () => {
    const entry = makeEntry();
    mc.record(entry);
    entry.durationMs = 9999;
    expect(mc.getAll()[0].durationMs).toBe(1000);
  });

  it("clear removes all entries", () => {
    mc.record(makeEntry());
    mc.clear();
    expect(mc.size).toBe(0);
  });

  // ── getHistory ────────────────────────────────────────────────

  it("getHistory filters by projectId", () => {
    mc.record(makeEntry({ projectId: "a" }));
    mc.record(makeEntry({ projectId: "b" }));
    mc.record(makeEntry({ projectId: "a", iterationNumber: 2 }));
    expect(mc.getHistory("a")).toHaveLength(2);
    expect(mc.getHistory("b")).toHaveLength(1);
  });

  it("getHistory returns sorted by iteration", () => {
    mc.record(makeEntry({ iterationNumber: 3 }));
    mc.record(makeEntry({ iterationNumber: 1 }));
    mc.record(makeEntry({ iterationNumber: 2 }));
    const h = mc.getHistory("proj-a");
    expect(h.map((e) => e.iterationNumber)).toEqual([1, 2, 3]);
  });

  it("getHistory returns empty for unknown project", () => {
    expect(mc.getHistory("nope")).toEqual([]);
  });

  // ── getSummary ────────────────────────────────────────────────

  it("getSummary across all projects", () => {
    mc.record(makeEntry({ durationMs: 100, deliverableCount: 1, testCount: 5 }));
    mc.record(makeEntry({ projectId: "b", durationMs: 200, deliverableCount: 3, testCount: 15 }));
    const s = mc.getSummary();
    expect(s.totalIterations).toBe(2);
    expect(s.totalDurationMs).toBe(300);
    expect(s.avgDurationMs).toBe(150);
    expect(s.totalDeliverables).toBe(4);
    expect(s.totalTests).toBe(20);
    expect(s.projects).toContain("proj-a");
    expect(s.projects).toContain("b");
  });

  it("getSummary for specific project", () => {
    mc.record(makeEntry({ projectId: "a", durationMs: 100 }));
    mc.record(makeEntry({ projectId: "b", durationMs: 200 }));
    const s = mc.getSummary("a");
    expect(s.totalIterations).toBe(1);
    expect(s.totalDurationMs).toBe(100);
    expect(s.projects).toEqual(["a"]);
  });

  it("getSummary empty collector", () => {
    const s = mc.getSummary();
    expect(s.totalIterations).toBe(0);
    expect(s.avgDurationMs).toBe(0);
  });

  // ── getTrend ──────────────────────────────────────────────────

  it("getTrend returns durationMs trend", () => {
    mc.record(makeEntry({ iterationNumber: 1, durationMs: 100 }));
    mc.record(makeEntry({ iterationNumber: 2, durationMs: 80 }));
    const trend = mc.getTrend("proj-a", "durationMs");
    expect(trend).toHaveLength(2);
    expect(trend[0].value).toBe(100);
    expect(trend[1].value).toBe(80);
  });

  it("getTrend returns testCount trend", () => {
    mc.record(makeEntry({ iterationNumber: 1, testCount: 10 }));
    mc.record(makeEntry({ iterationNumber: 2, testCount: 50 }));
    const trend = mc.getTrend("proj-a", "testCount");
    expect(trend.map((t) => t.value)).toEqual([10, 50]);
  });

  it("getTrend returns deliverableCount trend", () => {
    mc.record(makeEntry({ iterationNumber: 1, deliverableCount: 1 }));
    mc.record(makeEntry({ iterationNumber: 2, deliverableCount: 5 }));
    const trend = mc.getTrend("proj-a", "deliverableCount");
    expect(trend.map((t) => t.value)).toEqual([1, 5]);
  });

  it("getTrend empty for unknown project", () => {
    expect(mc.getTrend("nope", "durationMs")).toEqual([]);
  });

  // ── flush & load ──────────────────────────────────────────────

  let tmpDir: string;
  beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), "mc-test-")); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it("flush and load round-trip", () => {
    mc.record(makeEntry({ iterationNumber: 1 }));
    mc.record(makeEntry({ iterationNumber: 2 }));
    const path = join(tmpDir, "metrics.json");
    mc.flush(path);

    const mc2 = new MetricsCollector();
    mc2.load(path);
    expect(mc2.size).toBe(2);
    expect(mc2.getAll()[0].iterationNumber).toBe(1);
  });

  it("load replaces existing entries", () => {
    mc.record(makeEntry());
    const path = join(tmpDir, "m.json");
    mc.flush(path);

    mc.record(makeEntry({ iterationNumber: 99 }));
    expect(mc.size).toBe(2);
    mc.load(path);
    expect(mc.size).toBe(1);
  });

  it("flush creates parent directories", () => {
    mc.record(makeEntry());
    const path = join(tmpDir, "nested", "deep", "metrics.json");
    mc.flush(path);
    const mc2 = new MetricsCollector();
    mc2.load(path);
    expect(mc2.size).toBe(1);
  });
});

// ── computeStats ──────────────────────────────────────────────────

describe("computeStats", () => {
  it("returns zeros for empty array", () => {
    const s = computeStats([]);
    expect(s.count).toBe(0);
    expect(s.min).toBe(0);
    expect(s.avg).toBe(0);
  });

  it("handles single entry", () => {
    const s = computeStats([makeEntry({ durationMs: 500 })]);
    expect(s.count).toBe(1);
    expect(s.min).toBe(500);
    expect(s.max).toBe(500);
    expect(s.avg).toBe(500);
    expect(s.p50).toBe(500);
    expect(s.p95).toBe(500);
  });

  it("computes correct stats for multiple entries", () => {
    const entries = [100, 200, 300, 400, 500].map((d) => makeEntry({ durationMs: d }));
    const s = computeStats(entries);
    expect(s.count).toBe(5);
    expect(s.min).toBe(100);
    expect(s.max).toBe(500);
    expect(s.avg).toBe(300);
    expect(s.p50).toBe(300);
  });

  it("computes p95 for large dataset", () => {
    const entries = Array.from({ length: 100 }, (_, i) =>
      makeEntry({ durationMs: (i + 1) * 10 })
    );
    const s = computeStats(entries);
    expect(s.count).toBe(100);
    expect(s.min).toBe(10);
    expect(s.max).toBe(1000);
    expect(s.p95).toBeGreaterThan(900);
  });

  it("handles duplicate values", () => {
    const entries = [100, 100, 100].map((d) => makeEntry({ durationMs: d }));
    const s = computeStats(entries);
    expect(s.min).toBe(100);
    expect(s.max).toBe(100);
    expect(s.avg).toBe(100);
    expect(s.p50).toBe(100);
  });
});
