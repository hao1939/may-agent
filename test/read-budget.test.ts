import { describe, it, expect, beforeEach } from "vitest";
import { TruncationTracker } from "../src/lib/tools.js";

describe("TruncationTracker read budget", () => {
  let tracker: TruncationTracker;

  beforeEach(() => {
    tracker = new TruncationTracker({ maxSessionReadBytes: 1000 });
  });

  it("produces no warning when reading under budget", () => {
    const warning = tracker.recordBytesRead(500);
    expect(warning).toBe("");
  });

  it("produces a warning when reading over budget", () => {
    // First read pushes us over
    const warning = tracker.recordBytesRead(1500);
    expect(warning).toContain("READ BUDGET WARNING");
    expect(warning).toContain("1KB"); // budget: 1000/1000 = 1KB
  });

  it("fires the warning only once", () => {
    // First read: over budget → warning
    const w1 = tracker.recordBytesRead(1500);
    expect(w1).toContain("READ BUDGET WARNING");

    // Second read: still over budget → no second warning
    const w2 = tracker.recordBytesRead(500);
    expect(w2).toBe("");

    // Third read: same, no warning
    const w3 = tracker.recordBytesRead(1000);
    expect(w3).toBe("");
  });

  it("accumulates cumulative bytes correctly", () => {
    expect(tracker.getCumulativeReadBytes()).toBe(0);

    tracker.recordBytesRead(100);
    expect(tracker.getCumulativeReadBytes()).toBe(100);

    tracker.recordBytesRead(250);
    expect(tracker.getCumulativeReadBytes()).toBe(350);

    tracker.recordBytesRead(700);
    expect(tracker.getCumulativeReadBytes()).toBe(1050);
  });

  it("does not warn when exactly at budget", () => {
    const warning = tracker.recordBytesRead(1000);
    expect(warning).toBe("");
    expect(tracker.getCumulativeReadBytes()).toBe(1000);
  });

  it("warns on the read that first exceeds budget", () => {
    // Under budget
    const w1 = tracker.recordBytesRead(600);
    expect(w1).toBe("");

    // Still under
    const w2 = tracker.recordBytesRead(300);
    expect(w2).toBe("");

    // This pushes over (600 + 300 + 200 = 1100 > 1000)
    const w3 = tracker.recordBytesRead(200);
    expect(w3).toContain("READ BUDGET WARNING");
    expect(w3).toContain("line-range reads");

    // No more warnings
    const w4 = tracker.recordBytesRead(500);
    expect(w4).toBe("");
  });

  it("uses default budget of 500_000 when no option is given", () => {
    const defaultTracker = new TruncationTracker();
    // Read just under default budget: no warning
    const w1 = defaultTracker.recordBytesRead(499_999);
    expect(w1).toBe("");

    // Push over: warning
    const w2 = defaultTracker.recordBytesRead(2);
    expect(w2).toContain("READ BUDGET WARNING");
    expect(defaultTracker.getCumulativeReadBytes()).toBe(500_001);
  });
});
