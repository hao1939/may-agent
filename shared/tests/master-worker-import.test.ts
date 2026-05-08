/**
 * Tests for workflows/master-worker.ts — imported directly for coverage.
 * Tests pure functions: extractDecision, diffSnapshots, orchestratorSystemPrompt, workerSystemPrompt.
 */
import { describe, it, expect } from "vitest";

import {
  extractDecision,
  formatLiveRuntimeSignals,
  orchestratorSystemPrompt,
  workerSystemPrompt,
  snapshotOutputs,
  diffSnapshots,
} from "../workflows/master-worker.ts";

describe("extractDecision", () => {
  it("detects CONTINUE at start of text", () => {
    const d = extractDecision("CONTINUE\nKeep going with the plan");
    expect(d.status).toBe("continue");
  });

  it("detects PIVOT at start of text", () => {
    const d = extractDecision("PIVOT\nChange approach");
    expect(d.status).toBe("pivot");
  });

  it("detects WAITING at start of text", () => {
    const d = extractDecision("WAITING\nNeed approval");
    expect(d.status).toBe("waiting");
  });

  it("detects BLOCKED at start of text", () => {
    const d = extractDecision("BLOCKED\nCannot access resource");
    expect(d.status).toBe("blocked");
  });

  it("detects proceed as continue", () => {
    const d = extractDecision("Let's proceed with the implementation");
    expect(d.status).toBe("continue");
  });

  it("detects 'move forward' as continue", () => {
    const d = extractDecision("We should move forward with testing");
    expect(d.status).toBe("continue");
  });

  it("detects 'start working' as continue", () => {
    const d = extractDecision("Time to start working on the feature");
    expect(d.status).toBe("continue");
  });

  it("detects let's begin as continue", () => {
    const d = extractDecision("Let's begin the refactor");
    expect(d.status).toBe("continue");
  });

  it("returns unknown for ambiguous text", () => {
    const d = extractDecision("I think we should review the code");
    expect(d.status).toBe("unknown");
  });

  it("handles empty string", () => {
    const d = extractDecision("");
    expect(d.status).toBe("unknown");
  });

  it("truncates detail to 500 chars", () => {
    const longText = "CONTINUE\n" + "x".repeat(600);
    const d = extractDecision(longText);
    expect(d.detail.length).toBeLessThanOrEqual(500);
  });

  it("detects keyword mid-text via scan", () => {
    const d = extractDecision("After analysis, I recommend we CONTINUE with the plan");
    expect(d.status).toBe("continue");
  });

  it("detects BLOCKED keyword mid-text", () => {
    const d = extractDecision("The deployment is BLOCKED by the broken CI");
    expect(d.status).toBe("blocked");
  });
});

describe("orchestratorSystemPrompt", () => {
  it("includes project directory", () => {
    const prompt = orchestratorSystemPrompt("/projects/test");
    expect(prompt).toContain("/projects/test");
  });

  it("mentions orchestrator role", () => {
    const prompt = orchestratorSystemPrompt("/any");
    expect(prompt).toContain("orchestrator");
  });

  it("includes decision keywords", () => {
    const prompt = orchestratorSystemPrompt("/any");
    expect(prompt).toContain("CONTINUE");
    expect(prompt).toContain("PIVOT");
    expect(prompt).toContain("BLOCKED");
    expect(prompt).toContain("WAITING");
  });

  it("uses workflow-collected live runtime signals before manual query fallback", () => {
    const prompt = orchestratorSystemPrompt("/any");
    expect(prompt).toContain("Use the workflow-collected Live Runtime Signals block as primary current metric evidence.");
    expect(prompt).toContain("Only call query_db if those signals are unavailable");
  });
});

describe("formatLiveRuntimeSignals", () => {
  it("includes current counts and open alerts", () => {
    const block = formatLiveRuntimeSignals({
      available: true,
      collectedAt: "2026-05-08T00:00:00.000Z",
      counts: {
        activeP0P1Metrics: 0,
        openP0P1Alerts: 1,
        openLowerPriorityAlerts: 0,
        activeProjectCount: null,
      },
      p0p1Metrics: [],
      openAlerts: [{
        id: 1,
        metricId: "metric.a",
        message: "bad",
        createdAt: 1,
        metricName: "Metric A",
        owner: "dev",
        priority: "P1",
        current: 1,
        target: 0,
        threshold: 0,
      }],
    });

    expect(block).toContain("Status: available");
    expect(block).toContain("open P0/P1 alerts=1");
    expect(block).toContain("metric.a");
  });
});

describe("workerSystemPrompt", () => {
  it("includes project directory", () => {
    const prompt = workerSystemPrompt("/projects/test");
    expect(prompt).toContain("/projects/test");
  });

  it("mentions worker role", () => {
    const prompt = workerSystemPrompt("/any");
    expect(prompt).toContain("worker");
  });
});

describe("diffSnapshots", () => {
  it("detects new files", () => {
    const before = new Map<string, number>();
    const after = new Map<string, number>([["file1.ts", 100]]);
    expect(diffSnapshots(before, after)).toEqual(["file1.ts"]);
  });

  it("detects modified files", () => {
    const before = new Map([["file1.ts", 100]]);
    const after = new Map([["file1.ts", 200]]);
    expect(diffSnapshots(before, after)).toEqual(["file1.ts"]);
  });

  it("ignores unchanged files", () => {
    const before = new Map([["file1.ts", 100]]);
    const after = new Map([["file1.ts", 100]]);
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("ignores deleted files", () => {
    const before = new Map([["file1.ts", 100]]);
    const after = new Map<string, number>();
    expect(diffSnapshots(before, after)).toEqual([]);
  });

  it("handles empty maps", () => {
    expect(diffSnapshots(new Map(), new Map())).toEqual([]);
  });

  it("handles mix of new, modified, unchanged, deleted", () => {
    const before = new Map([["a", 1], ["b", 2], ["c", 3]]);
    const after = new Map([["a", 1], ["b", 5], ["d", 4]]);
    const changed = diffSnapshots(before, after);
    expect(changed).toContain("b");
    expect(changed).toContain("d");
    expect(changed).not.toContain("a");
    expect(changed).not.toContain("c");
  });
});

describe("snapshotOutputs", () => {
  it("returns empty map for non-existent directory", () => {
    const snap = snapshotOutputs("/nonexistent");
    expect(snap.size).toBe(0);
  });
});
