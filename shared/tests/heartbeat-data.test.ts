/**
 * Tests for workflows/heartbeat-data.ts — imports actual module for coverage.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  loadMetrics,
  loadProjects,
  loadAlerts,
  loadHeartbeatMd,
  loadInbox,
  formatMetricsBlock,
  runRedMetricCommands,
  shouldSkipHeartbeat,
  genericHeartbeat,
} from "../workflows/heartbeat-data.js";

const TEST_DIR = join("/tmp", "__test_hb_tmp__");

function cleanup() {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
}

function makeDb(overrides: Record<string, any> = {}) {
  const defaultPrepare = (_sql: string) => ({
    all: (..._args: any[]) => [],
    get: (..._args: any[]) => null,
  });
  return {
    prepare: overrides.prepare || defaultPrepare,
  };
}

function queryResult(rows: any[] = []) {
  return { rows, rowCount: rows.length, limit: rows.length, truncated: false };
}

function safeAll(db: any, label: string): any[] {
  try {
    return db.prepare(label).all();
  } catch {
    return [];
  }
}

function makeQuery(overrides: Record<string, any> = {}) {
  if (overrides.query) return overrides.query;
  return {
    heartbeatContext: (_filter: any) => {
      if (overrides.heartbeatContext) return overrides.heartbeatContext;
      const db = overrides.db || makeDb(overrides);
      const snapshots = safeAll(db, "metric_snapshots");
      const metrics = safeAll(db, "metrics").map((row) => ({
        ...row,
        alertOp: row.alertOp ?? row.alert_op,
        sourceQuery: row.sourceQuery ?? row.source_query,
        sourceCommand: row.sourceCommand ?? row.source_command,
        snapshots,
      }));
      const alerts = safeAll(db, "metric_alerts").map((row) => ({
        ...row,
        metricId: row.metricId ?? row.metric_id,
      }));
      const inbox = safeAll(db, "events").map((row) => ({
        ...row,
        eventType: row.eventType ?? row.event_type,
      }));
      return { now: Date.now(), metrics, alerts, inbox };
    },
    events: (_filter: any) => queryResult(overrides.events ?? []),
  };
}

function makeCtx(overrides: Record<string, any> = {}): any {
  return {
    agentsRoot: overrides.agentsRoot || TEST_DIR,
    getDb: () => overrides.db || makeDb(overrides),
    query: makeQuery(overrides),
    emit: vi.fn(),
    log: vi.fn(),
    done: vi.fn((msg: string) => ({ type: "done", message: msg })),
    summarize: vi.fn((_r: any, _opts?: any) => "summary"),
    runAgent: vi.fn(async () => ({ status: "success", lastAssistantText: "ok" })),
    dispatchEvent: vi.fn(),
    ...overrides,
  };
}

describe("loadMetrics", () => {
  it("returns empty string when no metrics", () => {
    const ctx = makeCtx();
    expect(loadMetrics(ctx, "bob")).toBe("");
  });

  it("returns formatted metrics for healthy metrics", () => {
    const db = makeDb({
      prepare: (sql: string) => ({
        all: () => sql.includes("metrics") && !sql.includes("snapshots")
          ? [{ id: "test.coverage", explicitOwner: "bob", projectOwner: null, current: 85, target: 80, threshold: 60, alert_op: "<", source_query: null, source_command: null }]
          : [],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = loadMetrics(ctx, "bob");
    expect(result).toContain("test.coverage");
    expect(result).toContain("✅");
  });

  it("marks breaching metrics with warning", () => {
    const db = makeDb({
      prepare: (sql: string) => ({
        all: (..._args: any[]) => {
          if (sql.includes("metric_snapshots")) return [];
          if (sql.includes("metrics")) return [{ id: "test.cov", explicitOwner: "bob", projectOwner: null, current: 50, target: 80, threshold: 60, alert_op: "<", source_query: "SELECT 1", source_command: null }];
          return [];
        },
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = loadMetrics(ctx, "bob");
    expect(result).toContain("⚠️ BELOW TARGET");
    expect(result).toContain("Investigate");
  });

  it("uses project owner when metric owner is empty", () => {
    const db = makeDb({
      prepare: (sql: string) => ({
        all: (..._args: any[]) => {
          if (sql.includes("metric_snapshots")) return [];
          if (sql.includes("metrics")) return [{ id: "example.coverage-rate", explicitOwner: null, projectOwner: "bob", current: 0.5, target: 1, threshold: 0.8, alert_op: "<", source_query: null, source_command: null }];
          return [];
        },
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    expect(loadMetrics(ctx, "bob")).toContain("example.coverage-rate");
    expect(loadMetrics(ctx, "arc")).toBe("");
  });

  it("keeps retired v2 spec coverage out of active metrics", () => {
    const source = readFileSync(resolve(__dirname, "../../may/handlers/metrics-snapshot.ts"), "utf8");
    const activeRegistry = source.slice(
      source.indexOf("const ALL_METRICS"),
      source.indexOf("const RETIRED_METRIC_IDS"),
    );
    const retiredRegistry = source.slice(source.indexOf("const RETIRED_METRIC_IDS"));

    expect(activeRegistry).not.toContain('id: "v2.spec-coverage-rate"');
    expect(retiredRegistry).toContain('"v2.spec-coverage-rate"');
  });

  it("shows consecutive breach escalation", () => {
    const db = makeDb({
      prepare: (sql: string) => ({
        all: (..._args: any[]) => {
          if (sql.includes("metric_snapshots")) return [{ value: 50 }, { value: 45 }, { value: 40 }];
          if (sql.includes("metrics")) return [{ id: "test.cov", explicitOwner: "bob", projectOwner: null, current: 50, target: 80, threshold: 60, alert_op: "<", source_query: null, source_command: "echo diag" }];
          return [];
        },
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = loadMetrics(ctx, "bob");
    expect(result).toContain("REPEATED ALERT");
    expect(result).toContain("3x");
  });

  it("handles db errors gracefully", () => {
    const ctx = makeCtx({ db: { prepare: () => { throw new Error("db error"); } } });
    expect(loadMetrics(ctx, "bob")).toBe("");
  });
});

describe("loadProjects", () => {
  beforeEach(() => { cleanup(); });

  it("returns empty for no projects", () => {
    const ctx = makeCtx();
    expect(loadProjects(ctx, "bob")).toBe("");
  });

  it("loads shared projects owned by agent", () => {
    const projDir = join(TEST_DIR, "shared", "projects", "myproj");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "project.md"), `---
owner: bob
status: active
health: green
---

# Test

## Milestones
- [x] Done one
- [ ] Not done
`, "utf-8");

    const ctx = makeCtx();
    const result = loadProjects(ctx, "bob");
    expect(result).toContain("myproj");
    expect(result).toContain("active");
    expect(result).toContain("1/2");
  });

  it("skips done/complete projects", () => {
    const projDir = join(TEST_DIR, "shared", "projects", "doneproj");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "project.md"), `---
owner: bob
status: done
---

# Test
`, "utf-8");

    const ctx = makeCtx();
    expect(loadProjects(ctx, "bob")).toBe("");
  });

  it("skips projects owned by other agents", () => {
    const projDir = join(TEST_DIR, "shared", "projects", "otherproj");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "project.md"), `---
owner: alice
status: active
---

# Test
`, "utf-8");

    const ctx = makeCtx();
    expect(loadProjects(ctx, "bob")).toBe("");
  });

  it("ignores legacy per-agent workspace/projects directories", () => {
    // Legacy location no longer scanned (KE-426 follow-up).
    const projDir = join(TEST_DIR, "bob", "workspace", "projects", "legproj");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "project.md"), `# Test
**Status**: active
**Health**: 🟡

## Milestones
- [ ] Something
`, "utf-8");

    const ctx = makeCtx();
    expect(loadProjects(ctx, "bob")).toBe("");
  });
});

describe("loadAlerts", () => {
  it("returns empty when no alerts", () => {
    const ctx = makeCtx();
    expect(loadAlerts(ctx, "bob")).toBe("");
  });

  it("returns formatted alerts", () => {
    const db = makeDb({
      prepare: () => ({
        all: () => [{ metric_id: "bob.coverage", explicitOwner: "bob", projectOwner: null, severity: "warning", message: "Coverage dropped" }],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = loadAlerts(ctx, "bob");
    expect(result).toContain("⚠️");
    expect(result).toContain("Coverage dropped");
  });

  it("routes project-scoped alerts to the project owner", () => {
    const db = makeDb({
      prepare: () => ({
        all: () => [{ metric_id: "v2.spec-coverage-rate", explicitOwner: null, projectOwner: "bob", message: "Coverage dropped" }],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    expect(loadAlerts(ctx, "bob")).toContain("v2.spec-coverage-rate");
    expect(loadAlerts(ctx, "arc")).toBe("");
  });

  it("handles db errors", () => {
    const ctx = makeCtx({ db: { prepare: () => { throw new Error("fail"); } } });
    expect(loadAlerts(ctx, "bob")).toBe("");
  });
});

describe("loadHeartbeatMd", () => {
  beforeEach(() => { cleanup(); });

  it("returns content of heartbeat.md", () => {
    mkdirSync(join(TEST_DIR, "bob"), { recursive: true });
    writeFileSync(join(TEST_DIR, "bob", "heartbeat.md"), "# Bob's heartbeat\nDo stuff", "utf-8");
    const ctx = makeCtx();
    const result = loadHeartbeatMd(ctx, "bob");
    expect(result).toContain("Bob's heartbeat");
  });

  it("returns fallback when file missing", () => {
    const ctx = makeCtx();
    expect(loadHeartbeatMd(ctx, "nobody")).toContain("No heartbeat.md");
  });
});

describe("loadInbox", () => {
  it("returns empty when no events", () => {
    const ctx = makeCtx();
    expect(loadInbox(ctx, "bob")).toBe("");
  });

  it("returns formatted events with dedup", () => {
    const now = Date.now();
    const db = makeDb({
      prepare: () => ({
        all: () => [
          { id: 1, event_type: "notification", data: JSON.stringify({ summary: "Test event 1" }), urgency: "normal", timestamp: now - 60000 },
          { id: 2, event_type: "notification", data: JSON.stringify({ summary: "Test event 1" }), urgency: "normal", timestamp: now - 120000 },
          { id: 3, event_type: "alert", data: JSON.stringify({ summary: "Different event" }), urgency: "immediate", timestamp: now - 30000 },
        ],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = loadInbox(ctx, "bob");
    expect(result).toContain("notification");
    expect(result).toContain("×2");  // deduped
    expect(result).toContain("alert");
  });

  it("handles db errors", () => {
    const ctx = makeCtx({ db: { prepare: () => { throw new Error("fail"); } } });
    expect(loadInbox(ctx, "bob")).toBe("");
  });
});

describe("formatMetricsBlock", () => {
  it("returns no owned metrics message when empty", () => {
    const ctx = makeCtx();
    const result = formatMetricsBlock(ctx, "bob");
    expect(result).toContain("No metrics owned by bob");
    expect(result).not.toContain("No metrics configured");
  });

  it("returns all healthy message", () => {
    const db = makeDb({
      prepare: (sql: string) => ({
        all: () => sql.includes("metrics") && !sql.includes("snapshots")
          ? [{ id: "test.cov", explicitOwner: "bob", projectOwner: null, current: 90, target: 80, threshold: 60, alert_op: "<", source_query: null, source_command: null }]
          : [],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = formatMetricsBlock(ctx, "bob");
    expect(result).toContain("No red metric signals");
  });

  it("returns red metric block with investigation prompt", () => {
    const db = makeDb({
      prepare: (sql: string) => ({
        all: (..._args: any[]) => {
          if (sql.includes("metric_snapshots")) return [];
          if (sql.includes("metrics")) return [{ id: "test.cov", explicitOwner: "bob", projectOwner: null, current: 50, target: 80, threshold: 60, alert_op: "<", source_query: null, source_command: null }];
          return [];
        },
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = formatMetricsBlock(ctx, "bob");
    expect(result).toContain("FIRST");
    expect(result).toContain("Judge the signal in context");
  });
});

describe("runRedMetricCommands", () => {
  it("returns empty when no red metrics", () => {
    const ctx = makeCtx();
    expect(runRedMetricCommands(ctx, "bob")).toBe("");
  });

  it("returns empty when all metrics healthy", () => {
    const db = makeDb({
      prepare: () => ({
        all: () => [{ id: "m1", explicitOwner: "bob", projectOwner: null, current: 90, target: 80, threshold: 60, alert_op: "<", source_command: null, source_query: null }],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    expect(runRedMetricCommands(ctx, "bob")).toBe("");
  });

  it("runs diagnostic command for red metric", () => {
    const db = makeDb({
      prepare: () => ({
        all: () => [{ id: "m1", explicitOwner: "bob", projectOwner: null, current: 50, target: 80, threshold: 60, alert_op: "<", source_command: "echo hello", source_query: null }],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = runRedMetricCommands(ctx, "bob");
    expect(result).toContain("Red Metric Diagnostic");
    expect(result).toContain("hello");
  });

  it("handles command failure gracefully", () => {
    const db = makeDb({
      prepare: () => ({
        all: () => [{ id: "m1", explicitOwner: "bob", projectOwner: null, current: 50, target: 80, threshold: 60, alert_op: "<", source_command: "false", source_query: null }],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = runRedMetricCommands(ctx, "bob");
    expect(result).toContain("m1");
  });

  it("reports no diagnostic command when none configured", () => {
    const db = makeDb({
      prepare: () => ({
        all: () => [{ id: "m1", explicitOwner: "bob", projectOwner: null, current: 50, target: 80, threshold: 60, alert_op: "<", source_command: null, source_query: null }],
        get: () => null,
      }),
    });
    const ctx = makeCtx({ db });
    const result = runRedMetricCommands(ctx, "bob");
    expect(result).toContain("No diagnostic command");
  });
});

describe("shouldSkipHeartbeat", () => {
  it("never skips when red metrics present", () => {
    const ctx = makeCtx();
    expect(shouldSkipHeartbeat(ctx, "bob", "⚠️ BELOW TARGET", "", "", "")).toBeNull();
  });

  it("never skips when alerts present", () => {
    const ctx = makeCtx();
    expect(shouldSkipHeartbeat(ctx, "bob", "", "alert!", "", "")).toBeNull();
  });

  it("never skips when inbox has events", () => {
    const ctx = makeCtx();
    expect(shouldSkipHeartbeat(ctx, "bob", "", "", "event!", "")).toBeNull();
  });

  it("never skips when projects active", () => {
    const ctx = makeCtx();
    expect(shouldSkipHeartbeat(ctx, "bob", "", "", "", "project!")).toBeNull();
  });

  it("skips when everything quiet and recent heartbeat exists", () => {
    const now = Date.now();
    const ctx = makeCtx({
      events: [{
        event_type: "handler.completed",
        data: JSON.stringify({ handler: "heartbeat-bob" }),
        timestamp: now - 10 * 60 * 1000,
      }],
    });
    const result = shouldSkipHeartbeat(ctx, "bob", "", "", "", "");
    expect(result).toContain("idle-skip");
  });

  it("does not skip when no recent heartbeat", () => {
    const db = makeDb({
      prepare: () => ({
        all: () => [],
        get: () => null, // no recent heartbeat
      }),
    });
    const ctx = makeCtx({ db });
    expect(shouldSkipHeartbeat(ctx, "bob", "", "", "", "")).toBeNull();
  });

  it("handles db errors (does not skip)", () => {
    const ctx = makeCtx({ query: { events: () => { throw new Error("fail"); } } });
    expect(shouldSkipHeartbeat(ctx, "bob", "", "", "", "")).toBeNull();
  });
});

describe("genericHeartbeat", () => {
  beforeEach(() => { cleanup(); });

  it("runs a full heartbeat cycle", async () => {
    // Set up circuit breaker dir
    mkdirSync(join(TEST_DIR, "shared", "circuit-breaker"), { recursive: true });
    mkdirSync(join(TEST_DIR, "bob"), { recursive: true });
    writeFileSync(join(TEST_DIR, "bob", "heartbeat.md"), "# Bob heartbeat", "utf-8");

    const ctx = makeCtx({
      agentsRoot: TEST_DIR,
    });
    ctx.runAgent.mockResolvedValueOnce({ status: "success", lastAssistantText: "Did heartbeat stuff", deliverables: [{ path: "test.md" }] });

    const result = await genericHeartbeat(ctx, "bob");
    expect(ctx.runAgent).toHaveBeenCalledTimes(1);
    expect(ctx.done).toHaveBeenCalled();
  });

  it("skips when circuit breaker is open", async () => {
    // Create circuit breaker state file at the correct path
    const sharedDir = join(TEST_DIR, "shared");
    mkdirSync(sharedDir, { recursive: true });
    writeFileSync(join(sharedDir, "circuit-breaker-state.json"), JSON.stringify({
      agents: {
        bob: {
          consecutiveErrors: 10,
          lastError: Date.now(),
          lastErrorMessage: "test error",
          trippedAt: Date.now(),
        },
      },
    }), "utf-8");
    // Also create the SIGNAL file (CB checks for it)
    mkdirSync(join(TEST_DIR, "bob"), { recursive: true });
    writeFileSync(join(TEST_DIR, "bob", "SIGNAL-circuit-breaker.md"), "tripped", "utf-8");

    const ctx = makeCtx({ agentsRoot: TEST_DIR });
    const result = await genericHeartbeat(ctx, "bob");
    expect(ctx.done).toHaveBeenCalledWith(expect.stringContaining("Circuit breaker"));
    expect(ctx.runAgent).not.toHaveBeenCalled();
  });

  it("collects red metric diagnostics before main heartbeat", async () => {
    const db = makeDb({
      prepare: (sql: string) => ({
        all: (..._args: any[]) => {
          if (sql.includes("metric_snapshots")) return [];
          if (sql.includes("metric_alerts")) return [];
          if (sql.includes("events")) return [];
          if (sql.includes("metrics")) return [{ id: "bob.cov", explicitOwner: "bob", projectOwner: null, current: 50, target: 80, threshold: 60, alert_op: "<", source_command: "echo diag_output", source_query: null }];
          return [];
        },
        get: () => null,
      }),
    });

    mkdirSync(join(TEST_DIR, "shared", "circuit-breaker"), { recursive: true });
    mkdirSync(join(TEST_DIR, "bob"), { recursive: true });
    writeFileSync(join(TEST_DIR, "bob", "heartbeat.md"), "# Bob", "utf-8");

    const ctx = makeCtx({ agentsRoot: TEST_DIR, db });
    ctx.runAgent.mockResolvedValueOnce({ status: "success", lastAssistantText: "Fixed metric" });

    await genericHeartbeat(ctx, "bob");
    
    // The prompt should include diagnostic results
    const promptArg = ctx.runAgent.mock.calls[0][1];
    expect(promptArg).toContain("diag_output");
  });

  it("records error outcome when agent errors", async () => {
    mkdirSync(join(TEST_DIR, "shared", "circuit-breaker"), { recursive: true });
    mkdirSync(join(TEST_DIR, "bob"), { recursive: true });
    writeFileSync(join(TEST_DIR, "bob", "heartbeat.md"), "# Bob", "utf-8");

    const ctx = makeCtx({ agentsRoot: TEST_DIR });
    ctx.escalate = vi.fn((reason: string, context?: unknown) => ({ type: "escalate", reason, context }));
    ctx.runAgent.mockResolvedValueOnce({ sessionId: "s_error", status: "error", error: "Connection error.", lastAssistantText: "" });

    const result = await genericHeartbeat(ctx, "bob");
    expect(ctx.done).not.toHaveBeenCalled();
    expect(ctx.escalate).toHaveBeenCalledWith(expect.stringContaining("Heartbeat agent session failed"), {
      sessionId: "s_error",
      error: "Connection error.",
    });
    expect(result.type).toBe("escalate");
  });
});

afterAll(() => { cleanup(); });
