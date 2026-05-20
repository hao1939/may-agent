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
  } = {},
) {
  const agentCalls: Array<{ agent: string; task: string; opts: Record<string, unknown> | undefined }> = [];
  const workflowCalls: Array<{ workflow: string; task: string; opts: Record<string, unknown> | undefined }> = [];
  const emitted: Array<{ type: string; data?: Record<string, unknown> }> = [];
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
      getDb: () => ({ run: () => ({}), prepare: () => ({ get: () => null, all: () => [] }) }),
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

  return { ctx, agentCalls, workflowCalls, emitted };
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
    writeFileSync(join(stateDir, "project-health-state.json"), JSON.stringify({
      lastFullScan: Date.now(),
      projects: {
        "projects/task-demo": {
          blockerHash: "",
          consecutiveSkips: 0,
          reactivationAttempts: 0,
          lastEscalation: 0,
          lastLaunch: Date.now(),
          lastStatusChange: 0,
          launchTimestamps: [Date.now()],
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
    writeFileSync(join(stateDir, "project-health-state.json"), JSON.stringify({
      lastFullScan: Date.now(),
      projects: {
        "projects/nudge-demo": {
          blockerHash: "",
          consecutiveSkips: 0,
          reactivationAttempts: 0,
          lastEscalation: 0,
          lastLaunch: Date.now(),
          lastStatusChange: 0,
          launchTimestamps: [Date.now(), Date.now()],
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
});
