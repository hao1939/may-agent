import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock dispatch-dedup-guard to avoid flaky state-dependent tests
vi.mock("../shared/workflows/dispatch-dedup-guard.js", () => ({
  shouldDispatch: () => ({ allowed: true, attempts: 0 }),
  recordDispatch: () => {},
  recordOutcome: () => {},
  cleanup: () => {},
}));

// We need to import from the shared module
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
} from "../shared/workflows/heartbeat-data.ts";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeQuery(tables: {
  metrics?: any[];
  metric_snapshots?: any[];
  metric_alerts?: any[];
  events?: any[];
}) {
  return {
    heartbeatContext(_filter: any) {
      const metricRows = (tables.metrics ?? []).map((m: any) => ({
        ...m,
        alertOp: m.alert_op,
        sourceQuery: m.source_query,
        sourceCommand: m.source_command,
        snapshots: (tables.metric_snapshots ?? []),
      }));
      return {
        now: Date.now(),
        metrics: metricRows,
        alerts: (tables.metric_alerts ?? []).map((a: any) => ({
          ...a,
          metricId: a.metric_id,
          createdAt: a.created_at,
        })),
        inbox: (tables.events ?? []).map((e: any) => ({
          ...e,
          eventType: e.event_type,
        })),
      };
    },
  };
}

function makeMockCtx(opts: {
  tables?: {
    metrics?: any[];
    metric_snapshots?: any[];
    metric_alerts?: any[];
    events?: any[];
  };
  agentsRoot?: string;
  db?: any;
} = {}) {
  const tables = opts.tables ?? {};
  return {
    agentsRoot: opts.agentsRoot || "/tmp/fake-agents",
    query: opts.db ? undefined : makeQuery(tables),
    getDb: opts.db ? () => opts.db : undefined,
    emit: vi.fn(),
    log: vi.fn(),
    runAgent: vi.fn().mockResolvedValue({ status: "done", output: "done" }),
    done: vi.fn((msg: string) => ({ status: "done", output: msg })),
    summarize: vi.fn((r: any) => r.output || "summary"),
  } as any;
}

// ── loadMetrics ──────────────────────────────────────────────────────────

describe("loadMetrics", () => {
  it("returns empty string when no metrics", () => {
    const ctx = makeMockCtx({ tables: { metrics: [] } });
    expect(loadMetrics(ctx, "bob")).toBe("");
  });

  it("returns formatted healthy metric", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.coverage", explicitOwner: "bob", projectOwner: null, current: 80, target: 70, threshold: 60, alert_op: "<", source_query: null, source_command: null },
        ],
      },
    });
    const result = loadMetrics(ctx, "bob");
    expect(result).toContain("bob.coverage");
    expect(result).toContain("80");
    expect(result).toContain("✅");
    expect(result).not.toContain("⚠️ BELOW TARGET");
  });

  it("returns formatted breaching metric with alert_op '<'", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.uptime", explicitOwner: "bob", projectOwner: null, current: 50, target: 90, threshold: 70, alert_op: "<", source_query: "SELECT 1", source_command: null },
        ],
        metric_snapshots: [],
      },
    });
    const result = loadMetrics(ctx, "bob");
    expect(result).toContain("⚠️ BELOW TARGET");
    expect(result).toContain("Investigate this metric");
  });

  it("returns formatted breaching metric with alert_op '>'", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.errors", explicitOwner: "bob", projectOwner: null, current: 100, target: 10, threshold: 50, alert_op: ">", source_command: "echo hi", source_query: null },
        ],
        metric_snapshots: [],
      },
    });
    const result = loadMetrics(ctx, "bob");
    expect(result).toContain("⚠️ BELOW TARGET");
    expect(result).toContain("Diagnostic command");
  });

  it("shows repeated alert when 3+ consecutive breaches", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.speed", explicitOwner: "bob", projectOwner: null, current: 30, target: 90, threshold: 60, alert_op: "<", source_query: null, source_command: null },
        ],
        metric_snapshots: [{ value: 30 }, { value: 40 }, { value: 50 }], // all below 60
      },
    });
    const result = loadMetrics(ctx, "bob");
    expect(result).toContain("REPEATED ALERT");
    expect(result).toContain("seen 3x");
  });

  it("handles query error gracefully", () => {
    const ctx = makeMockCtx();
    ctx.query = { heartbeatContext: () => { throw new Error("DB broken"); } };
    expect(loadMetrics(ctx, "bob")).toBe("");
  });
});

// ── loadProjects ─────────────────────────────────────────────────────────

describe("loadProjects", () => {
  it("returns empty string when no project dirs exist", () => {
    const ctx = makeMockCtx({ agentsRoot: "/tmp/nonexistent-agents-root-xyz" });
    expect(loadProjects(ctx, "bob")).toBe("");
  });

  it("returns project info for owned active projects", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hb-test-"));
    const projDir = join(tmpDir, "shared", "projects", "my-proj");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "project.md"), `---
owner: bob
status: active
health: green
---

# My Project

- [x] Step 1
- [ ] Step 2
`);
    const ctx = makeMockCtx({ agentsRoot: tmpDir });
    const result = loadProjects(ctx, "bob");
    expect(result).toContain("my-proj");
    expect(result).toContain("active");
    expect(result).toContain("1/2");
  });

  it("skips done projects", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hb-test-"));
    const projDir = join(tmpDir, "shared", "projects", "done-proj");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "project.md"), `---
owner: bob
status: done
---

# Done
`);
    const ctx = makeMockCtx({ agentsRoot: tmpDir });
    expect(loadProjects(ctx, "bob")).toBe("");
  });

  it("skips projects owned by other agents", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hb-test-"));
    const projDir = join(tmpDir, "shared", "projects", "other-proj");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "project.md"), `---
owner: amy
status: active
---

# Other
`);
    const ctx = makeMockCtx({ agentsRoot: tmpDir });
    expect(loadProjects(ctx, "bob")).toBe("");
  });
});

// ── loadAlerts ───────────────────────────────────────────────────────────

describe("loadAlerts", () => {
  it("returns empty string when no alerts", () => {
    const ctx = makeMockCtx({ tables: { metric_alerts: [] } });
    expect(loadAlerts(ctx, "bob")).toBe("");
  });

  it("returns formatted alerts", () => {
    const ctx = makeMockCtx({
      tables: {
        metric_alerts: [
          { metric_id: "bob.speed", message: "Speed too low", explicitOwner: "bob", projectOwner: null },
        ],
      },
    });
    const result = loadAlerts(ctx, "bob");
    expect(result).toContain("bob.speed");
    expect(result).toContain("Speed too low");
  });

  it("handles error gracefully", () => {
    const ctx = makeMockCtx();
    ctx.query = { heartbeatContext: () => { throw new Error("broken"); } };
    expect(loadAlerts(ctx, "bob")).toBe("");
  });
});

// ── loadHeartbeatMd ──────────────────────────────────────────────────────

describe("loadHeartbeatMd", () => {
  it("returns file content when it exists", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hb-test-"));
    mkdirSync(join(tmpDir, "bob"), { recursive: true });
    writeFileSync(join(tmpDir, "bob", "heartbeat.md"), "Do your job bob");
    const ctx = makeMockCtx({ agentsRoot: tmpDir });
    expect(loadHeartbeatMd(ctx, "bob")).toBe("Do your job bob");
  });

  it("returns fallback when file missing", () => {
    const ctx = makeMockCtx({ agentsRoot: "/tmp/nonexistent-xyz" });
    expect(loadHeartbeatMd(ctx, "bob")).toBe("(No heartbeat.md found)");
  });
});

// ── loadInbox ────────────────────────────────────────────────────────────

describe("loadInbox", () => {
  it("returns empty string when no events", () => {
    const ctx = makeMockCtx({ tables: { events: [] } });
    expect(loadInbox(ctx, "bob")).toBe("");
  });

  it("formats recent events with age", () => {
    const now = Date.now();
    const ctx = makeMockCtx({
      tables: {
        events: [{
          id: 1,
          event_type: "notification",
          data: JSON.stringify({ summary: "Test notification" }),
          urgency: "normal",
          timestamp: now - 5 * 60000, // 5 min ago
        }],
      },
    });
    const result = loadInbox(ctx, "bob");
    expect(result).toContain("notification");
    expect(result).toContain("Test notification");
    expect(result).toContain("m ago");
  });

  it("deduplicates similar events", () => {
    const now = Date.now();
    const ctx = makeMockCtx({
      tables: {
        events: [
          { id: 1, event_type: "alert", data: JSON.stringify({ summary: "Same thing" }), urgency: "normal", timestamp: now - 5 * 60000 },
          { id: 2, event_type: "alert", data: JSON.stringify({ summary: "Same thing" }), urgency: "normal", timestamp: now - 10 * 60000 },
          { id: 3, event_type: "alert", data: JSON.stringify({ summary: "Same thing" }), urgency: "normal", timestamp: now - 15 * 60000 },
        ],
      },
    });
    const result = loadInbox(ctx, "bob");
    expect(result).toContain("×3");
  });

  it("handles error gracefully", () => {
    const ctx = makeMockCtx();
    ctx.query = { heartbeatContext: () => { throw new Error("broken"); } };
    expect(loadInbox(ctx, "bob")).toBe("");
  });
});

// ── formatMetricsBlock ───────────────────────────────────────────────────

describe("formatMetricsBlock", () => {
  it("returns no owned metrics message when none are owned by the agent", () => {
    const ctx = makeMockCtx({ tables: { metrics: [] } });
    const result = formatMetricsBlock(ctx, "bob");
    expect(result).toContain("No metrics owned by bob");
    expect(result).not.toContain("No metrics configured");
  });

  it("returns no red metric signal when no breaches", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.x", explicitOwner: "bob", projectOwner: null, current: 90, target: 80, threshold: 70, alert_op: "<", source_query: null, source_command: null },
        ],
      },
    });
    const result = formatMetricsBlock(ctx, "bob");
    expect(result).toContain("No red metric signals");
    expect(result).toContain("Metrics alone do not require action");
  });

  it("returns red metric block when breaching", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.x", explicitOwner: "bob", projectOwner: null, current: 30, target: 80, threshold: 50, alert_op: "<", source_query: null, source_command: null },
        ],
        metric_snapshots: [],
      },
    });
    const result = formatMetricsBlock(ctx, "bob");
    expect(result).toContain("FIRST");
    expect(result).toContain("review red metric signals");
    expect(result).toContain("Judge the signal in context");
  });
});

// ── shouldSkipHeartbeat ──────────────────────────────────────────────────

describe("shouldSkipHeartbeat", () => {
  it("never skips when red metrics present", () => {
    const ctx = makeMockCtx();
    const result = shouldSkipHeartbeat(ctx, "bob", "⚠️ BELOW TARGET", "", "", "");
    expect(result).toBeNull();
  });

  it("never skips when alerts present", () => {
    const ctx = makeMockCtx();
    const result = shouldSkipHeartbeat(ctx, "bob", "✅", "⚠️ alert", "", "");
    expect(result).toBeNull();
  });

  it("never skips when inbox has events", () => {
    const ctx = makeMockCtx();
    const result = shouldSkipHeartbeat(ctx, "bob", "✅", "", "- event", "");
    expect(result).toBeNull();
  });

  it("never skips when active projects exist", () => {
    const ctx = makeMockCtx();
    const result = shouldSkipHeartbeat(ctx, "bob", "✅", "", "", "- project");
    expect(result).toBeNull();
  });

  it("skips when all empty and recent heartbeat exists", () => {
    const now = Date.now();
    const ctx = makeMockCtx();
    ctx.query = {
      ...makeQuery({}),
      events: () => ({
        rows: [{
          event_type: "handler.completed",
          data: JSON.stringify({ handler: "heartbeat-bob" }),
          timestamp: now - 10 * 60000,
        }],
      }),
    };
    const result = shouldSkipHeartbeat(ctx, "bob", "", "", "", "");
    expect(result).toContain("idle-skip");
  });

  it("does not skip when no recent heartbeat found", () => {
    const ctx = makeMockCtx();
    ctx.query = {
      ...makeQuery({}),
      events: () => ({ rows: [] }),
    };
    const result = shouldSkipHeartbeat(ctx, "bob", "", "", "", "");
    expect(result).toBeNull();
  });
});

// ── runRedMetricCommands ─────────────────────────────────────────────────

describe("runRedMetricCommands", () => {
  it("returns empty string when no red metrics", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.x", explicitOwner: "bob", projectOwner: null, current: 90, target: 80, threshold: 70, alert_op: "<", source_command: null, source_query: null },
        ],
      },
    });
    expect(runRedMetricCommands(ctx, "bob")).toBe("");
  });

  it("runs diagnostic command for red metric", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.x", explicitOwner: "bob", projectOwner: null, current: 30, target: 80, threshold: 50, alert_op: "<", source_command: "echo diagnostic-output", source_query: null },
        ],
      },
    });
    const result = runRedMetricCommands(ctx, "bob");
    expect(result).toContain("Red Metric Diagnostic");
    expect(result).toContain("diagnostic-output");
    expect(result).toContain("bob.x");
  });

  it("handles command failure gracefully", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.x", explicitOwner: "bob", projectOwner: null, current: 30, target: 80, threshold: 50, alert_op: "<", source_command: "exit 1", source_query: null },
        ],
      },
    });
    const result = runRedMetricCommands(ctx, "bob");
    expect(result).toContain("bob.x");
  });

  it("reports no diagnostic command when none configured", () => {
    const ctx = makeMockCtx({
      tables: {
        metrics: [
          { id: "bob.x", explicitOwner: "bob", projectOwner: null, current: 30, target: 80, threshold: 50, alert_op: "<", source_command: null, source_query: null },
        ],
      },
    });
    const result = runRedMetricCommands(ctx, "bob");
    expect(result).toContain("No diagnostic command configured");
  });

  it("handles error gracefully", () => {
    const ctx = makeMockCtx();
    ctx.query = { heartbeatContext: () => { throw new Error("broken"); } };
    expect(runRedMetricCommands(ctx, "bob")).toBe("");
  });
});

// ── genericHeartbeat ─────────────────────────────────────────────────────

describe("genericHeartbeat", () => {
  it("calls runAgent and returns done", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "hb-gen-"));
    mkdirSync(join(tmpDir, "bob"), { recursive: true });
    mkdirSync(join(tmpDir, "shared"), { recursive: true });
    writeFileSync(join(tmpDir, "bob", "heartbeat.md"), "Be bob");
    // Need circuit-breaker state file in shared/
    writeFileSync(join(tmpDir, "shared", "circuit-breaker-state.json"), JSON.stringify({ agents: {} }));

    const ctx = makeMockCtx({
      agentsRoot: tmpDir,
      tables: { metrics: [], events: [] },
    });
    const result = await genericHeartbeat(ctx, "bob");
    expect(ctx.runAgent).toHaveBeenCalledWith("bob", expect.any(String));
    const prompt = (ctx.runAgent as any).mock.calls[0][1] as string;
    expect(prompt).toContain("implicit self-maintenance project");
    expect(prompt).toContain("Explicit Shared Projects You Own");
    expect(prompt).toContain("goal/context + signals -> judgment -> action/evidence");
    expect(ctx.done).toHaveBeenCalled();
  });
});
