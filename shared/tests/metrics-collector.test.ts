import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { MetricsCollector, computeStats, MetricsEntry } from "../workflows/metrics-collector.js";

const TEST_DIR = "/tmp/test-metrics-" + Date.now();

function makeEntry(overrides: Partial<MetricsEntry> = {}): MetricsEntry {
  return {
    projectId: "proj-1",
    iterationNumber: 1,
    durationMs: 1000,
    testCount: 10,
    deliverableCount: 2,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("starts empty", () => {
    expect(collector.size).toBe(0);
    expect(collector.getAll()).toEqual([]);
  });

  it("records entries", () => {
    collector.record(makeEntry());
    expect(collector.size).toBe(1);
  });

  it("getAll returns copies", () => {
    const entry = makeEntry();
    collector.record(entry);
    const all = collector.getAll();
    all.push(makeEntry());
    expect(collector.size).toBe(1);
  });

  it("getHistory filters by project", () => {
    collector.record(makeEntry({ projectId: "a", iterationNumber: 1 }));
    collector.record(makeEntry({ projectId: "b", iterationNumber: 1 }));
    collector.record(makeEntry({ projectId: "a", iterationNumber: 2 }));
    expect(collector.getHistory("a").length).toBe(2);
  });

  it("getHistory returns sorted by iteration", () => {
    collector.record(makeEntry({ projectId: "a", iterationNumber: 3 }));
    collector.record(makeEntry({ projectId: "a", iterationNumber: 1 }));
    const history = collector.getHistory("a");
    expect(history[0].iterationNumber).toBe(1);
    expect(history[1].iterationNumber).toBe(3);
  });

  it("getSummary for all projects", () => {
    collector.record(makeEntry({ projectId: "a", testCount: 5, deliverableCount: 1 }));
    collector.record(makeEntry({ projectId: "b", testCount: 3, deliverableCount: 2 }));
    const summary = collector.getSummary();
    expect(summary.totalIterations).toBe(2);
    expect(summary.totalTests).toBe(8);
    expect(summary.totalDeliverables).toBe(3);
    expect(summary.projects).toContain("a");
  });

  it("getSummary filtered by project", () => {
    collector.record(makeEntry({ projectId: "a" }));
    collector.record(makeEntry({ projectId: "b" }));
    const summary = collector.getSummary("a");
    expect(summary.totalIterations).toBe(1);
  });

  it("getTrend returns trend points", () => {
    collector.record(makeEntry({ projectId: "x", iterationNumber: 1, durationMs: 100 }));
    collector.record(makeEntry({ projectId: "x", iterationNumber: 2, durationMs: 200 }));
    const trend = collector.getTrend("x", "durationMs");
    expect(trend.length).toBe(2);
    expect(trend[0].value).toBe(100);
    expect(trend[1].value).toBe(200);
  });

  it("flush and load roundtrip", () => {
    collector.record(makeEntry({ projectId: "p", testCount: 42 }));
    const path = `${TEST_DIR}/metrics.json`;
    collector.flush(path);
    expect(existsSync(path)).toBe(true);

    const c2 = new MetricsCollector();
    c2.load(path);
    expect(c2.size).toBe(1);
    expect(c2.getAll()[0].testCount).toBe(42);
  });

  it("load throws on invalid data", () => {
    const path = `${TEST_DIR}/bad.json`;
    require("fs").writeFileSync(path, '"not an array"');
    expect(() => collector.load(path)).toThrow("expected array");
  });

  it("clear removes all entries", () => {
    collector.record(makeEntry());
    collector.clear();
    expect(collector.size).toBe(0);
  });
});

describe("computeStats", () => {
  it("returns zeros for empty array", () => {
    const stats = computeStats([]);
    expect(stats.count).toBe(0);
  });

  it("computes correct stats", () => {
    const entries = [100, 200, 300, 400, 500].map((d, i) =>
      makeEntry({ durationMs: d, iterationNumber: i })
    );
    const stats = computeStats(entries);
    expect(stats.count).toBe(5);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(500);
    expect(stats.avg).toBe(300);
  });
});
