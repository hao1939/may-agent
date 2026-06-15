import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { create } from "./project.js";

const roots: string[] = [];

function makeCtx(
  root: string,
  projectsRoot: string,
  opts: {
    sessions?: Array<Record<string, unknown>>;
    workflowRuns?: Array<Record<string, unknown>>;
    metricSnapshots?: Array<Record<string, unknown>>;
    metricRows?: Array<Record<string, unknown>>;
  } = {},
) {
  const agentCalls: Array<{ agent: string; task: string; opts: Record<string, unknown> | undefined }> = [];
  const workflowCalls: Array<{ workflow: string; task: string; opts: Record<string, unknown> | undefined }> = [];
  const emitted: Array<{ type: string; data?: Record<string, unknown> }> = [];
  const metrics = {
    defined: [] as unknown[],
    recorded: [] as Array<{ id: string; value: number; opts?: Record<string, unknown> }>,
    evaluated: [] as string[],
    defineMany: (defs: unknown[]) => metrics.defined.push(...defs),
    record: (id: string, value: number, opts?: Record<string, unknown>) => metrics.recorded.push({ id, value, opts }),
    evaluate: (id: string) => {
      metrics.evaluated.push(id);
      return [];
    },
  };
  const filterRows = (rows: Array<Record<string, unknown>>, query: Record<string, unknown>) => rows.filter((row) => {
    for (const [key, value] of Object.entries(query)) {
      if (key === "limit") continue;
      if (value !== undefined && row[key] !== value) return false;
    }
    return true;
  });
  const ctx = {
    agentName: "may",
    sdk: {
      paths: { root, projects: projectsRoot },
      log: () => {},
      emit: (type: string, data?: Record<string, unknown>) => emitted.push({ type, data }),
      getDb: () => ({
        run: () => ({}),
        prepare: (sql: string) => ({
          get: (id?: unknown) => {
            if (sql.includes("FROM metrics")) {
              return (opts.metricRows ?? []).find((row) => row.id === id) ?? null;
            }
            return null;
          },
          all: () => opts.metricSnapshots ?? [],
        }),
      }),
      metrics,
      query: {
        alerts: () => ({ rows: [] }),
        workflowRuns: (query: Record<string, unknown> = {}) => ({ rows: filterRows(opts.workflowRuns ?? [], query) }),
        sessions: (query: Record<string, unknown> = {}) => ({ rows: filterRows(opts.sessions ?? [], query) }),
      },
      runAgent: async (agent: string, task: string, opts?: Record<string, unknown>) => {
        agentCalls.push({ agent, task, opts });
        return {
          sessionId: `s_${agentCalls.length}`,
          status: "done",
          lastAssistantText: "done",
          finishResult: { status: "success", summary: "done" },
        };
      },
      runWorkflow: async (workflow: string, task: string, opts?: Record<string, unknown>) => {
        workflowCalls.push({ workflow, task, opts });
        return { status: "done", summary: "workflow done", runId: `wr_${workflowCalls.length}` };
      },
    },
    triggerNow: () => false,
  } as any;

  return { ctx, agentCalls, workflowCalls, emitted, metrics };
}

describe("project handler task-driven dispatch", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("dispatches ready project tasks without launching a legacy project workflow", async () => {
    const root = join(tmpdir(), `project-task-handler-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "task-demo");
    const workflowDir = join(projectDir, "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, "task-demo-iteration.ts"), "export const name = 'task-demo-iteration';\n");
    const projectFile = join(projectDir, "project.md");
    writeFileSync(projectFile, `---
id: task-demo
owner: evaluator
status: active
---

# Task Demo

## Goal
Run ready tasks.

## Tasks
- id: score-a
  status: ready
  result: null
  assignee: evaluator
  goal: Score batch A.
  depends_on: []
  attempts: 0

- id: analyze
  status: pending
  result: null
  assignee: may
  goal: Analyze results.
  depends_on: [score-a]
  attempts: 0
`);

    const { ctx, agentCalls, workflowCalls, emitted } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)();
    await Promise.resolve();
    await Promise.resolve();

    expect(workflowCalls).toEqual([]);
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]).toMatchObject({
      agent: "evaluator",
      opts: { source: "project-task:score-a", projectId: "evaluator/task-demo" },
    });
    expect(agentCalls[0].task).toContain("## Project Task");
    expect(agentCalls[0].task).toContain("Task ID: score-a");
    expect(readFileSync(projectFile, "utf-8")).toContain("status: done");
    expect(readFileSync(projectFile, "utf-8")).toContain("result: succeeded");
    expect(emitted).toContainEqual({
      type: "project.task.dispatched",
      data: {
        projectId: "evaluator/task-demo",
        projectPath: "projects/task-demo",
        taskId: "score-a",
        assignee: "evaluator",
        runner: "agent",
        workflow: null,
      },
    });
  });

  it("routes project app owner work to project.owner.requested instead of launching a generic owner loop", async () => {
    const root = join(tmpdir(), `project-app-task-tree-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "task-demo.app");
    const taskDir = join(projectDir, "tasks");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(projectDir, "project.md"), `---
id: task-demo.app
owner: evaluator
status: active
type: project-app
max_concurrent: 2
---

# Task Demo App
`);
    writeFileSync(join(taskDir, "tree.json"), JSON.stringify({
      version: 2,
      root_task_id: "project",
      tasks: {
        project: { state: "backlog", children: ["lane"] },
        lane: { state: "backlog", children: ["ready-a", "ready-b", "done-a"] },
        "ready-a": { state: "backlog", children: [] },
        "ready-b": { state: "backlog", children: [], depends_on: ["done-a"] },
        "done-a": { state: "done", children: [] },
      },
    }, null, 2));

    const { ctx, agentCalls, workflowCalls, emitted } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)();

    expect(agentCalls).toEqual([]);
    expect(workflowCalls).toEqual([]);
    expect(emitted).toContainEqual({
      type: "project.owner.requested",
      data: {
        project: "task-demo",
        projectId: "task-demo",
        projectApp: "task-demo.app",
        projectPath: "projects/task-demo.app",
        owner: "evaluator",
        reason: "active project needs work",
        requested_by: "project-handler",
      },
    });
  });

  it("runs a task through a workflow only when the task asks for it", async () => {
    const root = join(tmpdir(), `project-task-workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "task-demo");
    mkdirSync(projectDir, { recursive: true });
    const projectFile = join(projectDir, "project.md");
    writeFileSync(projectFile, `---
id: task-demo
owner: evaluator
status: active
---

# Task Demo

## Tasks
- id: probe
  status: ready
  result: null
  assignee: evaluator
  goal: Run a bounded probe.
  run: workflow:managedsystem-probe
  depends_on: []
  attempts: 0
`);

    const { ctx, agentCalls, workflowCalls } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)();
    await Promise.resolve();
    await Promise.resolve();

    expect(agentCalls).toEqual([]);
    expect(workflowCalls).toHaveLength(1);
    expect(workflowCalls[0]).toMatchObject({
      workflow: "managedsystem-probe",
      opts: { source: "project-task:probe", projectId: "evaluator/task-demo" },
    });
    expect(workflowCalls[0].task).toContain("Task ID: probe");
    expect(readFileSync(projectFile, "utf-8")).toContain("status: done");
    expect(readFileSync(projectFile, "utf-8")).toContain("result: succeeded");
  });

  it("launches the project owner agent instead of a workflow when a task needs judgment", async () => {
    const root = join(tmpdir(), `project-task-judgment-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "task-demo");
    const workflowDir = join(projectDir, "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, "task-demo-iteration.ts"), "export const name = 'task-demo-iteration';\n");
    const projectFile = join(projectDir, "project.md");
    writeFileSync(projectFile, `---
id: task-demo
owner: evaluator
status: active
max_task_attempts: 2
---

# Task Demo

## Tasks
- id: score-a
  status: ready
  result: null
  assignee: evaluator
  goal: Score batch A.
  depends_on: []
  attempts: 2
`);

    const { ctx, agentCalls, workflowCalls } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)();
    await Promise.resolve();
    await Promise.resolve();

    expect(workflowCalls).toEqual([]);
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]).toMatchObject({
      agent: "evaluator",
      opts: { source: "project-owner", projectId: "evaluator/task-demo" },
    });
    expect(agentCalls[0].task).toContain("## Project Owner Loop");
    expect(agentCalls[0].task).toContain("replan, close, wait, or escalate");
    expect(readFileSync(projectFile, "utf-8")).toContain("attempts: 2");
  });

  it("launches owner judgment immediately on project.task.finished when all tasks are done", async () => {
    const root = join(tmpdir(), `project-task-finished-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const stateDir = join(root, ".state");
    const projectDir = join(projectsRoot, "task-demo");
    const workflowDir = join(projectDir, "workflows");
    mkdirSync(workflowDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(workflowDir, "task-demo-iteration.ts"), "export const name = 'task-demo-iteration';\n");
    // Place lastLaunch past the 5-min hard cooldown but within the 30-min regular
    // cooldown — forceLaunch (from project.task.finished) should bypass the latter.
    const pastHardCooldown = Date.now() - 10 * 60 * 1000;
    writeFileSync(join(stateDir, "project-health-state.json"), JSON.stringify({
      lastFullScan: Date.now(),
      projects: {
        "projects/task-demo": {
          blockerHash: "",
          consecutiveSkips: 0,
          reactivationAttempts: 0,
          lastEscalation: 0,
          lastLaunch: pastHardCooldown,
          lastStatusChange: 0,
          launchTimestamps: [pastHardCooldown],
        },
      },
    }));
    const projectFile = join(projectDir, "project.md");
    writeFileSync(projectFile, `---
id: task-demo
owner: evaluator
status: active
---

# Task Demo

## Goal
Judge the finished phase.

## Tasks
- id: score-a
  status: done
  result: succeeded
  assignee: evaluator
  goal: Score batch A.
  depends_on: []
  attempts: 1
`);

    const { ctx, agentCalls, workflowCalls } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "project.task.finished",
      data: {
        projectPath: "projects/task-demo",
        projectId: "evaluator/task-demo",
        taskId: "score-a",
      },
    } as any);
    await Promise.resolve();
    await Promise.resolve();

    expect(workflowCalls).toEqual([]);
    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]).toMatchObject({
      agent: "evaluator",
      opts: { source: "project-owner", projectId: "evaluator/task-demo" },
    });
  });

  it("treats a generic project.nudge as a force reconcile without requiring a comment", async () => {
    const root = join(tmpdir(), `project-generic-nudge-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const stateDir = join(root, ".state");
    const projectDir = join(projectsRoot, "nudge-demo");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    // Place lastLaunch past the 5-min hard cooldown but within the 30-min regular
    // cooldown — forceLaunch (from project.nudge) should bypass the latter.
    const pastHardCooldown = Date.now() - 10 * 60 * 1000;
    writeFileSync(join(stateDir, "project-health-state.json"), JSON.stringify({
      lastFullScan: Date.now(),
      projects: {
        "projects/nudge-demo": {
          blockerHash: "",
          consecutiveSkips: 0,
          reactivationAttempts: 0,
          lastEscalation: 0,
          lastLaunch: pastHardCooldown,
          lastStatusChange: 0,
          launchTimestamps: [pastHardCooldown, pastHardCooldown],
        },
      },
    }));
    writeFileSync(join(projectDir, "project.md"), `---
id: nudge-demo
owner: evaluator
status: active
---

# Nudge Demo
`);

    const { ctx, agentCalls } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "project.nudge",
      data: {
        projectPath: "projects/nudge-demo",
        projectId: "evaluator/nudge-demo",
      },
    } as any);
    await Promise.resolve();

    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]).toMatchObject({
      agent: "evaluator",
      opts: { source: "project-owner", projectId: "evaluator/nudge-demo" },
    });
  });

  it("records event-driven reconcile metrics and latency", async () => {
    const root = join(tmpdir(), `project-reconcile-metrics-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const stateDir = join(root, ".state");
    const projectDir = join(projectsRoot, "metrics-demo");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(stateDir, { recursive: true });
    // Place lastLaunch past the 5-min hard cooldown but within the 30-min regular
    // cooldown — forceLaunch (from project.nudge) should bypass the latter.
    const pastHardCooldown = Date.now() - 10 * 60 * 1000;
    writeFileSync(join(stateDir, "project-health-state.json"), JSON.stringify({
      lastFullScan: Date.now(),
      projects: {
        "projects/metrics-demo": {
          blockerHash: "",
          consecutiveSkips: 0,
          reactivationAttempts: 0,
          lastEscalation: 0,
          lastLaunch: pastHardCooldown,
          lastStatusChange: 0,
          launchTimestamps: [pastHardCooldown],
        },
      },
    }));
    writeFileSync(join(projectDir, "project.md"), `---
id: metrics-demo
owner: evaluator
status: active
---

# Metrics Demo
`);

    const { ctx, metrics } = makeCtx(root, projectsRoot);
    const timestamp = Date.now() - 1_500;

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "project.nudge",
      source: "test",
      owner: "may",
      timestamp,
      data: {
        projectPath: "projects/metrics-demo",
        projectId: "evaluator/metrics-demo",
      },
    } as any);

    expect(metrics.defined).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "project.reconcile.trigger-count" }),
      expect.objectContaining({ id: "project.reconcile.launched-count" }),
      expect.objectContaining({ id: "project.reconcile.event-latency-ms" }),
    ]));
    expect(metrics.recorded).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "project.reconcile.trigger-count", value: 1 }),
      expect.objectContaining({ id: "project.reconcile.launched-count", value: 1 }),
    ]));
    const latency = metrics.recorded.find((record) => record.id === "project.reconcile.event-latency-ms");
    expect(latency?.value).toBeGreaterThanOrEqual(1_500);
    expect(latency?.opts?.note).toContain("\"trigger\":\"project.nudge\"");
    expect(latency?.opts?.note).toContain("\"projectPath\":\"projects/metrics-demo\"");
    expect(metrics.evaluated).toEqual(expect.arrayContaining([
      "project.reconcile.trigger-count",
      "project.reconcile.launched-count",
      "project.reconcile.event-latency-ms",
    ]));
  });

  it("routes project health metric breaches to only the affected projects", async () => {
    const root = join(tmpdir(), `project-metric-breach-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const aksDir = join(projectsRoot, "aks-rp-e2e");
    const platformDir = join(projectsRoot, "platform");
    mkdirSync(aksDir, { recursive: true });
    mkdirSync(platformDir, { recursive: true });
    writeFileSync(join(aksDir, "project.md"), `---
id: aks-rp-e2e
owner: aks-explorer
status: active
project_policy: aggressive-push
---

# AKS RP E2E
`);
    writeFileSync(join(platformDir, "project.md"), `---
id: platform
owner: tech-lead
status: active
project_policy: stable-watch
---

# Platform
`);

    const { ctx, agentCalls } = makeCtx(root, projectsRoot, {
      metricSnapshots: [{
        note: JSON.stringify({
          trigger: "project.task.finished",
          findings: [{
            projectId: "aks-explorer/aks-rp-e2e",
            projectPath: "projects/aks-rp-e2e",
            projectPolicy: "aggressive-push",
            codes: ["owner_judgment_needed"],
          }],
        }),
      }],
    });

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "metric.breach",
      source: "metrics-snapshot",
      owner: "agent:may",
      timestamp: Date.now(),
      data: {
        metricId: "project.owner-judgment-needed-count",
        current: 1,
        threshold: 0,
        target: 0,
        message: "Project tasks needing owner judgment is above threshold",
      },
    } as any);

    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]).toMatchObject({
      agent: "aks-explorer",
      opts: { source: "project-owner", projectId: "aks-explorer/aks-rp-e2e" },
    });
    expect(agentCalls[0].task).toContain("metric.breach project.owner-judgment-needed-count");
    expect(agentCalls[0].task).toContain("current=1");
    expect(agentCalls[0].task).toContain("Policy: aggressive-push");
  });

  it("routes project-scoped metric breaches to the waiting project owner", async () => {
    const root = join(tmpdir(), `project-scoped-metric-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "scout-second-brain-learning");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "project.md"), `---
id: scout-second-brain-learning
owner: scout
status: waiting
resume_condition: Resume when \`scout.knowledge-preamble-coverage\` breaches.
---

# Scout Second Brain Learning
`);

    const { ctx, agentCalls } = makeCtx(root, projectsRoot, {
      metricRows: [{
        id: "scout.knowledge-preamble-coverage",
        project: "scout-second-brain-learning",
      }],
    });

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "metric.breach",
      source: "metrics-snapshot",
      owner: "agent:scout",
      timestamp: Date.now(),
      data: {
        metricId: "scout.knowledge-preamble-coverage",
        current: 0.18,
        threshold: 0.25,
        target: 0.8,
        message: "Scout knowledge preamble coverage is below threshold",
      },
    } as any);

    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]).toMatchObject({
      agent: "scout",
      opts: { source: "project-owner", projectId: "scout/scout-second-brain-learning" },
    });
    expect(agentCalls[0].task).toContain("metric.breach scout.knowledge-preamble-coverage");
    expect(agentCalls[0].task).toContain("current=0.18");
  });

  it("uses project health finding events as direct owner reconcile signals", async () => {
    const root = join(tmpdir(), `project-health-finding-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "waiting-demo");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "project.md"), `---
id: waiting-demo
owner: evaluator
status: waiting
resume_condition: wait for external signal
---

# Waiting Demo
`);

    const { ctx, agentCalls } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "project.health.finding",
      source: "project-steward",
      owner: "agent:evaluator",
      timestamp: Date.now(),
      data: {
        projectId: "evaluator/waiting-demo",
        projectPath: "projects/waiting-demo",
        code: "owner_judgment_needed",
        severity: "P2",
        message: "All project tasks are done; owner should replan the next phase or close the project.",
        evidence: { taskCount: 3, projectPolicy: "standard" },
      },
    } as any);

    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]).toMatchObject({
      agent: "evaluator",
      opts: { source: "project-owner", projectId: "evaluator/waiting-demo" },
    });
    expect(agentCalls[0].task).toContain("project.health.finding owner_judgment_needed");
    expect(agentCalls[0].task).toContain("All project tasks are done");
  });

  it("does not let a live project task session block final owner judgment", async () => {
    const root = join(tmpdir(), `project-task-session-live-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "task-demo");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "project.md"), `---
id: task-demo
owner: evaluator
status: active
---

# Task Demo

## Tasks
- id: score-a
  status: done
  result: succeeded
  assignee: evaluator
  goal: Score batch A.
  depends_on: []
  attempts: 1
`);

    const { ctx, agentCalls } = makeCtx(root, projectsRoot, {
      sessions: [
        {
          sessionId: "s_task",
          projectId: "evaluator/task-demo",
          status: "running",
          source: "project-task:score-a",
        },
      ],
    });

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "project.task.finished",
      data: {
        projectPath: "projects/task-demo",
        projectId: "evaluator/task-demo",
        taskId: "score-a",
      },
    } as any);
    await Promise.resolve();

    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0]).toMatchObject({
      agent: "evaluator",
      opts: { source: "project-owner", projectId: "evaluator/task-demo" },
    });
  });

  it("keeps project owner launches singleflight", async () => {
    const root = join(tmpdir(), `project-owner-live-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "owner-demo");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "project.md"), `---
id: owner-demo
owner: evaluator
status: active
---

# Owner Demo
`);

    const { ctx, agentCalls } = makeCtx(root, projectsRoot, {
      sessions: [
        {
          sessionId: "s_owner",
          projectId: "evaluator/owner-demo",
          status: "running",
          source: "project-owner",
        },
      ],
    });

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "project.nudge",
      data: {
        projectPath: "projects/owner-demo",
        projectId: "evaluator/owner-demo",
      },
    } as any);
    await Promise.resolve();

    expect(agentCalls).toEqual([]);
  });

  it("surfaces incomplete owner reviews that leave active projects with no open work", async () => {
    const root = join(tmpdir(), `project-owner-noop-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "owner-noop");
    mkdirSync(projectDir, { recursive: true });
    const projectFile = join(projectDir, "project.md");
    const discussionFile = join(projectDir, "discussion.md");
    writeFileSync(projectFile, `---
id: owner-noop
owner: evaluator
status: waiting
project_policy: stable-watch
---

# Owner Noop

## Current State
Waiting for a signal.

## Tasks
- id: done-task
  status: done
  result: succeeded
  assignee: evaluator
  goal: Already complete.
  depends_on: []
  attempts: 1
`);
    writeFileSync(discussionFile, `# Discussion

---read @iter1---

### project-creative-audit - 2026-05-21
No action needed, but owner should review this suggestion.
`);

    const { ctx, agentCalls, emitted } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "project.nudge",
      data: {
        projectPath: "projects/owner-noop",
        projectId: "evaluator/owner-noop",
        comment: true,
      },
    } as any);
    await Promise.resolve();
    await Promise.resolve();

    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0].task).toContain("plan the next project step");
    expect(agentCalls[0].task).toContain("Policy: stable-watch");
    expect(agentCalls[0].task).toContain("Use solid evidence before creating new tasks.");
    expect(readFileSync(projectFile, "utf-8")).toMatch(/status:\s*active/);
    expect(readFileSync(discussionFile, "utf-8")).not.toContain("---read @owner-s_1---");
    expect(emitted).toContainEqual({
      type: "project.owner.incomplete",
      data: {
        projectId: "evaluator/owner-noop",
        projectPath: "projects/owner-noop",
        reason: "owner finished success while project remained active with no open tasks",
        projectPolicy: "stable-watch",
        taskCount: 1,
        sessionId: "s_1",
      },
    });
  });

  it("passes aggressive-push posture to owner judgment", async () => {
    const root = join(tmpdir(), `project-owner-aggressive-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "owner-aggressive");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "project.md"), `---
id: owner-aggressive
owner: evaluator
status: active
project_policy: aggressive-push
---

# Owner Aggressive

## Tasks
- id: done-task
  status: done
  result: succeeded
  assignee: evaluator
  goal: Already complete.
  depends_on: []
  attempts: 1
`);

    const { ctx, agentCalls, emitted } = makeCtx(root, projectsRoot);

    await create(ctx, { name: "project", enabled: true, handler: "project" } as any)({
      type: "project.task.finished",
      data: {
        projectPath: "projects/owner-aggressive",
        projectId: "evaluator/owner-aggressive",
        taskId: "done-task",
      },
    } as any);
    await Promise.resolve();
    await Promise.resolve();

    expect(agentCalls).toHaveLength(1);
    expect(agentCalls[0].task).toContain("Policy: aggressive-push");
    expect(agentCalls[0].task).toContain("Actively inspect current evidence for the next frontier.");
    expect(agentCalls[0].task).toContain("create bounded next tasks and keep the project active");
    expect(emitted).toContainEqual({
      type: "project.owner.incomplete",
      data: {
        projectId: "evaluator/owner-aggressive",
        projectPath: "projects/owner-aggressive",
        reason: "owner finished success while project remained active with no open tasks",
        projectPolicy: "aggressive-push",
        taskCount: 1,
        sessionId: "s_1",
      },
    });
  });
});
