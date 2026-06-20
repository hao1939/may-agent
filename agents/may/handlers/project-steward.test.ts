import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeProject, create } from "./project-steward.js";
import type { ProjectInfo } from "../../../shared/lib/project-health.ts";
import { createMetricService } from "../../../projects/may-agent/src/lib/metrics.ts";

const roots: string[] = [];

function makeRoot(): { root: string; projectsRoot: string } {
  const root = join(tmpdir(), `project-steward-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const projectsRoot = join(root, "projects");
  mkdirSync(projectsRoot, { recursive: true });
  roots.push(root);
  return { root, projectsRoot };
}

function writeProject(projectsRoot: string, slug: string, content: string): string {
  const dir = join(projectsRoot, slug);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "project.md");
  writeFileSync(file, content, "utf-8");
  return file;
}

function makeCtx(root: string, projectsRoot: string) {
  const emitted: Array<{ type: string; data?: Record<string, unknown>; envelope?: Record<string, unknown> }> = [];
  const metrics = {
    defined: [] as unknown[],
    recorded: [] as Array<{ id: string; value: number; opts?: Record<string, unknown> }>,
    evaluated: [] as string[],
    defineMany: vi.fn((defs: unknown[]) => metrics.defined.push(...defs)),
    record: vi.fn((id: string, value: number, opts?: Record<string, unknown>) => metrics.recorded.push({ id, value, opts })),
    evaluate: vi.fn((id: string) => {
      metrics.evaluated.push(id);
      return [];
    }),
  };
  const ctx = {
    agentName: "may",
    sdk: {
      paths: { root, projects: projectsRoot },
      emit: vi.fn((type: string, data?: Record<string, unknown>, envelope?: Record<string, unknown>) => {
        emitted.push({ type, data, envelope });
      }),
      log: vi.fn(),
      getDb: vi.fn(() => null),
      metrics,
    },
  } as any;
  return { ctx, emitted, metrics };
}

function makeMetricDb(): Database {
  const db = new Database(":memory:");
  db.run(`CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    path TEXT,
    name TEXT,
    owner TEXT
  )`);
  db.run(`CREATE TABLE metrics (
    id TEXT PRIMARY KEY,
    name TEXT,
    owner TEXT,
    type TEXT,
    current REAL,
    target REAL,
    threshold REAL,
    unit TEXT,
    priority TEXT,
    status TEXT,
    blocker TEXT,
    project TEXT,
    source TEXT,
    source_query TEXT,
    source_command TEXT,
    sensitivity REAL,
    measure_interval INTEGER,
    alert_op TEXT,
    speed TEXT,
    description TEXT,
    direction TEXT,
    config TEXT,
    created_at INTEGER,
    updated_at INTEGER
  )`);
  db.run(`CREATE TABLE metric_snapshots (
    metric_id TEXT,
    value REAL,
    sample_size INTEGER,
    measured_at INTEGER,
    measured_by TEXT,
    note TEXT
  )`);
  db.run(`CREATE TABLE metric_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_id TEXT,
    alert_type TEXT,
    message TEXT,
    resolved_at INTEGER,
    created_at INTEGER
  )`);
  db.run(`CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,
    data TEXT,
    timestamp INTEGER
  )`);
  return db;
}

describe("project-steward handler", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("emits project findings and records metrics without mutating project files", async () => {
    const { root, projectsRoot } = makeRoot();
    const good = writeProject(projectsRoot, "good", `---
id: good
owner: evaluator
status: active
---

# Good

## Tasks
- id: score-a
  status: ready
  result: null
  assignee: evaluator
  goal: Score batch A.
  depends_on: []
  attempts: 0
`);
    const invalid = writeProject(projectsRoot, "legacy", "# Legacy\n\n**Owner:** evaluator\n**Status:** active\n");
    const taskParserError = writeProject(projectsRoot, "bad-tasks", `---
id: bad-tasks
owner: evaluator
status: active
---

# Bad Tasks

## Tasks
this is not a task row
`);
    const needsOwner = writeProject(projectsRoot, "needs-owner", `---
id: needs-owner
owner: evaluator
status: active
project_policy: aggressive-push
max_task_attempts: 2
---

# Needs Owner

## Tasks
- id: stuck
  status: ready
  result: null
  assignee: evaluator
  goal: Try the difficult thing.
  depends_on: []
  attempts: 2
`);
    const before = new Map([good, invalid, taskParserError, needsOwner].map((file) => [file, readFileSync(file, "utf-8")]));
    const { ctx, emitted, metrics } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project-steward", enabled: true, handler: "project-steward" } as any)();

    const findings = emitted.filter((event) => event.type === "project.health.finding");
    expect(findings.map((event) => event.data?.code).sort()).toEqual([
      "invalid_format",
      "owner_judgment_needed",
      "task_parser_error",
    ]);
    expect(findings.find((event) => event.data?.projectId === "evaluator/needs-owner")?.data)
      .toMatchObject({ projectPolicy: "aggressive-push" });
    expect(findings.every((event) => !Object.prototype.hasOwnProperty.call(event.data ?? {}, "owner"))).toBe(true);
    expect(findings.every((event) => event.envelope?.owner === "evaluator" || event.envelope?.owner === "unknown")).toBe(true);

    expect(metrics.defineMany).toHaveBeenCalledTimes(1);
    expect(metrics.recorded.map((record) => [record.id, record.value])).toEqual([
      ["project.health.finding-count", 3],
      ["project.invalid-format-count", 1],
      ["project.task-parser-error-count", 1],
      ["project.owner-judgment-needed-count", 1],
      ["project.owner-incomplete-count", 0],
    ]);
    expect(metrics.evaluated).toEqual([
      "project.health.finding-count",
      "project.invalid-format-count",
      "project.task-parser-error-count",
      "project.owner-judgment-needed-count",
      "project.owner-incomplete-count",
    ]);

    for (const [file, content] of before) {
      expect(readFileSync(file, "utf-8")).toBe(content);
    }
    expect(ctx.sdk.log).toHaveBeenCalledWith("info", "[project-steward] checked 4 project(s), findings=3");
  });

  it("treats all active tasks done as owner judgment instead of a project blocker", () => {
    const project: ProjectInfo = {
      relPath: "projects/finished-phase",
      projectFile: "/tmp/finished-phase/project.md",
      content: `---
id: finished-phase
owner: may
status: active
project_policy: stable-watch
---

# Finished Phase

## Tasks
- id: done-a
  status: done
  result: succeeded
  assignee: may
  goal: Finish A.
  depends_on: []
  attempts: 1
`,
      status: "active",
      owner: "may",
      blockerReason: "",
      workflow: "custom-workflow",
      formatErrors: [],
    };

    const report = analyzeProject(project);

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      code: "owner_judgment_needed",
      severity: "P2",
    });
    expect(report.projectPolicy).toBe("stable-watch");
    expect(report.findings[0].evidence).toMatchObject({
      projectPolicy: "stable-watch",
      ownerIncomplete: true,
    });
    expect(report.findings[0].message).toContain("replan the next phase or close");
  });

  it("flags active projects that need owner planning but have no tasks", () => {
    const project: ProjectInfo = {
      relPath: "projects/no-tasks",
      projectFile: join(tmpdir(), `no-tasks-${Date.now()}`, "project.md"),
      content: `---
id: no-tasks
owner: evaluator
status: active
project_policy: aggressive-push
---

# No Tasks
`,
      status: "active",
      owner: "evaluator",
      blockerReason: "",
      workflow: "",
      formatErrors: [],
    };

    const report = analyzeProject(project);

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      code: "owner_judgment_needed",
      severity: "P2",
    });
    expect(report.findings[0].evidence).toMatchObject({
      taskCount: 0,
      projectPolicy: "aggressive-push",
      ownerIncomplete: true,
    });
  });

  it("skips cleanly when no projects are present", async () => {
    const { root, projectsRoot } = makeRoot();
    const { ctx, emitted, metrics } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project-steward", enabled: true, handler: "project-steward" } as any)();

    expect(emitted).toContainEqual({
      type: "handler.skipped",
      data: expect.objectContaining({ handler: "project-steward", reason: "no projects found" }),
      envelope: undefined,
    });
    // defineMany is now called unconditionally so zero-value metrics are
    // recorded even when no projects exist, preventing stale-metric alerts.
    expect(metrics.defineMany).toHaveBeenCalled();
  });

  it("uses the real metric lifecycle for breach and recovery", async () => {
    const { root, projectsRoot } = makeRoot();
    const projectFile = writeProject(projectsRoot, "legacy", "# Legacy\n\n**Owner:** evaluator\n**Status:** active\n");
    const db = makeMetricDb();
    const emitted: Array<{ type: string; data?: Record<string, unknown>; envelope?: Record<string, unknown> }> = [];
    const ctx = {
      agentName: "may",
      sdk: {
        paths: { root, projects: projectsRoot },
        emit: vi.fn((type: string, data?: Record<string, unknown>, envelope?: Record<string, unknown>) => {
          emitted.push({ type, data, envelope });
        }),
        log: vi.fn(),
        metrics: createMetricService({
          getDb: () => db as any,
          measuredBy: "project-steward-test",
          emit: (type, data, envelope) => emitted.push({ type, data, envelope }),
          now: () => 1_779_219_500_000,
        }),
      },
    } as any;

    try {
      await create(ctx, { name: "project-steward", enabled: true, handler: "project-steward" } as any)();

      expect(db.query("SELECT current FROM metrics WHERE id = ?").get("project.health.finding-count")).toMatchObject({ current: 1 });
      expect(db.query("SELECT COUNT(*) as c FROM metric_snapshots WHERE metric_id = ?").get("project.health.finding-count")).toMatchObject({ c: 1 });
      expect(db.query("SELECT metric_id, resolved_at FROM metric_alerts WHERE metric_id = ?").get("project.health.finding-count")).toMatchObject({
        metric_id: "project.health.finding-count",
        resolved_at: null,
      });
      expect(emitted.some((event) => event.type === "metric.breach" && event.data?.metricId === "project.health.finding-count")).toBe(true);

      writeFileSync(projectFile, `---
id: legacy
owner: evaluator
status: active
---

# Legacy

## Tasks
- id: next
  status: ready
  result: null
  assignee: evaluator
  goal: Continue.
  depends_on: []
  attempts: 0
`, "utf-8");
      await create(ctx, { name: "project-steward", enabled: true, handler: "project-steward" } as any)();

      expect(db.query("SELECT current FROM metrics WHERE id = ?").get("project.health.finding-count")).toMatchObject({ current: 0 });
      expect(db.query("SELECT COUNT(*) as c FROM metric_snapshots WHERE metric_id = ?").get("project.health.finding-count")).toMatchObject({ c: 2 });
      expect(db.query("SELECT resolved_at FROM metric_alerts WHERE metric_id = ?").get("project.health.finding-count")).toMatchObject({
        resolved_at: 1_779_219_500_000,
      });
      expect(emitted.some((event) => event.type === "metric.recovered" && event.data?.metricId === "project.health.finding-count")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("surfaces unavailable watch metrics on waiting projects", async () => {
    const { root, projectsRoot } = makeRoot();
    writeProject(projectsRoot, "scout-second-brain-learning", `---
id: scout-second-brain-learning
owner: scout
status: waiting
resume_condition: Resume if \`scout.knowledge-practice-loaded\` drops below 1 or \`scout.knowledge-preamble-coverage\` stops improving.
---

# Scout Second Brain Learning

## Signals
- \`scout.operational-friction-rate-24h\` is a weak secondary signal only.

## Watch Conditions
- Reactivate if \`scout.knowledge-practice-loaded < 1\`.
- Reactivate if \`scout.knowledge-preamble-coverage\` stops improving.
`);
    const db = makeMetricDb();
    const now = Date.now();
    db.run(
      `INSERT INTO metrics (id, name, owner, type, current, target, threshold, unit, priority, status, project, alert_op, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["scout.knowledge-practice-loaded", "Scout knowledge practice loaded", "scout", "health", 1, 1, 1, "boolean", "P2", "disabled", "scout-second-brain-learning", "<", now - 12 * 3600_000, now - 12 * 3600_000],
    );
    db.run(
      `INSERT INTO metrics (id, name, owner, type, current, target, threshold, unit, priority, status, project, alert_op, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["scout.knowledge-preamble-coverage", "Scout knowledge preamble coverage", "scout", "gauge", 0.3, 0.8, 0.25, "ratio", "P3", "active", "scout-second-brain-learning", "<", now - 12 * 3600_000, now - 12 * 3600_000],
    );
    db.run(
      `INSERT INTO metrics (id, name, owner, type, current, target, threshold, unit, priority, status, project, alert_op, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["scout.operational-friction-rate-24h", "Scout operational friction", "scout", "gauge", 0.5, 0.1, 0.3, "ratio", "P3", "disabled", "scout-second-brain-learning", ">", now - 12 * 3600_000, now - 12 * 3600_000],
    );
    const { ctx, emitted, metrics } = makeCtx(root, projectsRoot);
    ctx.sdk.getDb = vi.fn(() => db);

    try {
      await create(ctx, { name: "project-steward", enabled: true, handler: "project-steward" } as any)();

      const finding = emitted.find((event) => event.type === "project.health.finding");
      expect(finding?.data).toMatchObject({
        projectId: "scout/scout-second-brain-learning",
        projectPath: "projects/scout-second-brain-learning",
        code: "watch_signal_unavailable",
        severity: "P2",
      });
      expect(finding?.envelope).toMatchObject({ owner: "scout" });
      expect(JSON.stringify(finding?.data?.evidence)).toContain("not_active");
      expect(JSON.stringify(finding?.data?.evidence)).toContain("stale");
      expect(JSON.stringify(finding?.data?.evidence)).not.toContain("scout.operational-friction-rate-24h");
      expect(metrics.recorded.find((record) => record.id === "project.health.finding-count")).toMatchObject({ value: 1 });
    } finally {
      db.close();
    }
  });

  it("surfaces system-operations only when alert chains lack fresh judgment", async () => {
    const { root, projectsRoot } = makeRoot();
    writeProject(projectsRoot, "system-operations", `---
id: system-operations
owner: may
status: waiting
resume_condition: Run on a P0/P1 reliability signal breach or unresolved metric-alert chain.
---

# System Operations
`);
    const db = makeMetricDb();
    const now = Date.now();
    db.run(
      `INSERT INTO metrics (id, name, owner, type, current, target, threshold, unit, priority, status, alert_op, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["session.error-rate-6h", "Session error rate", "may", "gauge", 0.5, 0.1, 0.3, "ratio", "P1", "active", ">", now - 60 * 60_000, now - 60 * 60_000],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, resolved_at, created_at) VALUES (?, ?, ?, ?, ?)",
      ["session.error-rate-6h", "threshold", "Session error rate is above threshold", null, now - 20 * 60_000],
    );
    db.run(
      `INSERT INTO metrics (id, name, owner, type, current, target, threshold, unit, priority, status, alert_op, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["project.health.finding-count", "Project health findings", "may", "health", 1, 0, 0, "count", "P1", "active", ">", now - 60 * 60_000, now - 60 * 60_000],
    );
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, resolved_at, created_at) VALUES (?, ?, ?, ?, ?)",
      ["project.health.finding-count", "threshold", "Project health findings is above threshold", null, now - 60 * 60_000],
    );
    const { ctx, emitted } = makeCtx(root, projectsRoot);
    ctx.sdk.getDb = vi.fn(() => db);

    try {
      await create(ctx, { name: "project-steward", enabled: true, handler: "project-steward" } as any)();
      expect(emitted.find((event) => event.type === "project.health.finding")?.data).toMatchObject({
        projectId: "may/system-operations",
        code: "ops_alert_chain_needs_judgment",
        severity: "P1",
      });
      expect(JSON.stringify(emitted.find((event) => event.type === "project.health.finding")?.data?.evidence))
        .not.toContain("project.health.finding-count");

      emitted.length = 0;
      db.run(
        "INSERT INTO events (event_type, data, timestamp) VALUES (?, ?, ?)",
        ["metric.alert_judged", JSON.stringify({ metricId: "session.error-rate-6h", alertId: 1, operation: "fix_root_cause" }), now - 5 * 60_000],
      );
      await create(ctx, { name: "project-steward", enabled: true, handler: "project-steward" } as any)();
      expect(emitted.some((event) => event.type === "project.health.finding")).toBe(false);
    } finally {
      db.close();
    }
  });
});
