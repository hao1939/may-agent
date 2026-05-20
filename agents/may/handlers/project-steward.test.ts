import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeProject, create } from "./project-steward.js";
import type { ProjectInfo } from "../../../shared/lib/project-health.ts";
import { createMetricService } from "../../../projects/platform/repos/may-agent/src/lib/metrics.ts";

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
workflow: project
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
workflow: project
---

# Bad Tasks

## Tasks
this is not a task row
`);
    const needsOwner = writeProject(projectsRoot, "needs-owner", `---
id: needs-owner
owner: evaluator
status: active
workflow: project
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

    expect(emitted.filter((event) => event.type === "project.health.checked")).toHaveLength(4);
    const findings = emitted.filter((event) => event.type === "project.health.finding");
    expect(findings.map((event) => event.data?.code).sort()).toEqual([
      "invalid_format",
      "missing_owner_workflow",
      "owner_judgment_needed",
      "task_parser_error",
    ]);
    expect(findings.every((event) => !Object.prototype.hasOwnProperty.call(event.data ?? {}, "owner"))).toBe(true);
    expect(findings.every((event) => event.envelope?.owner === "evaluator" || event.envelope?.owner === "unknown")).toBe(true);

    expect(metrics.defineMany).toHaveBeenCalledTimes(1);
    expect(metrics.recorded.map((record) => [record.id, record.value])).toEqual([
      ["project.health.finding-count", 4],
      ["project.invalid-format-count", 1],
      ["project.task-parser-error-count", 1],
      ["project.owner-judgment-needed-count", 1],
      ["project.missing-owner-workflow-count", 1],
    ]);
    expect(metrics.evaluated).toEqual([
      "project.health.finding-count",
      "project.invalid-format-count",
      "project.task-parser-error-count",
      "project.owner-judgment-needed-count",
      "project.missing-owner-workflow-count",
    ]);

    for (const [file, content] of before) {
      expect(readFileSync(file, "utf-8")).toBe(content);
    }
    expect(ctx.sdk.log).toHaveBeenCalledWith("info", "[project-steward] checked 4 project(s), findings=4");
  });

  it("treats all active tasks done as owner judgment instead of a project blocker", () => {
    const project: ProjectInfo = {
      relPath: "projects/finished-phase",
      projectFile: "/tmp/finished-phase/project.md",
      content: `---
id: finished-phase
owner: may
status: active
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
    expect(report.findings[0].message).toContain("replan the next phase or close");
  });

  it("flags active projects that need the owner loop but have no project workflow", () => {
    const project: ProjectInfo = {
      relPath: "projects/no-workflow",
      projectFile: join(tmpdir(), `no-workflow-${Date.now()}`, "project.md"),
      content: `---
id: no-workflow
owner: evaluator
status: active
workflow: project
---

# No Workflow
`,
      status: "active",
      owner: "evaluator",
      blockerReason: "",
      workflow: "project",
      formatErrors: [],
    };

    const report = analyzeProject(project);

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      code: "missing_owner_workflow",
      severity: "P1",
    });
    expect(report.findings[0].evidence).toMatchObject({
      workflow: "project",
      taskCount: 0,
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
    expect(metrics.defineMany).not.toHaveBeenCalled();
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
workflow: project
---

# Legacy
`, "utf-8");
      mkdirSync(join(projectsRoot, "legacy", "workflows"), { recursive: true });
      writeFileSync(join(projectsRoot, "legacy", "workflows", "legacy-iteration.ts"), "export const name = 'legacy-iteration';\n", "utf-8");
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
});
