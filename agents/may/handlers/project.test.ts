import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { create, resolveWorkflowName } from "./project.js";
import type { ProjectInfo } from "../../../shared/lib/project-health.ts";

const roots: string[] = [];

function makeProject(root: string, slug: string, workflow = "project"): ProjectInfo {
  const projectDir = join(root, slug);
  mkdirSync(projectDir, { recursive: true });
  const projectFile = join(projectDir, "project.md");
  writeFileSync(projectFile, `---\nid: ${slug}\nowner: dev\nstatus: active\nworkflow: ${workflow}\n---\n`);
  return {
    relPath: `projects/${slug}`,
    projectFile,
    content: "",
    status: "active",
    owner: "dev",
    blockerReason: "",
    workflow,
    formatErrors: [],
  };
}

describe("project handler workflow resolution", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("maps canonical workflow: project to a slug iteration workflow when present", () => {
    const root = join(tmpdir(), `project-handler-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const project = makeProject(root, "example-project");
    const workflowDir = join(root, "example-project", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(join(workflowDir, "example-project-iteration.ts"), "export const name = 'example-project-iteration';\n");

    expect(resolveWorkflowName(project)).toBe("example-project-iteration");
  });

  it("preserves explicit non-project workflow names", () => {
    const root = join(tmpdir(), `project-handler-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const project = makeProject(root, "example-project", "custom-workflow");

    expect(resolveWorkflowName(project)).toBe("custom-workflow");
  });

  it("returns null for workflow: project when no slug iteration workflow exists", () => {
    const root = join(tmpdir(), `project-handler-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const project = makeProject(root, "no-workflow-project");

    expect(resolveWorkflowName(project)).toBeNull();
  });
});

describe("project handler task-driven dispatch", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("dispatches ready project tasks without launching the serial project workflow", async () => {
    const root = join(tmpdir(), `project-task-handler-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    roots.push(root);
    const projectsRoot = join(root, "projects");
    const projectDir = join(projectsRoot, "task-demo");
    mkdirSync(projectDir, { recursive: true });
    const projectFile = join(projectDir, "project.md");
    writeFileSync(projectFile, `---
id: task-demo
owner: evaluator
status: active
workflow: project
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

    const agentCalls: Array<{ agent: string; task: string; opts: Record<string, unknown> | undefined }> = [];
    const workflowCalls: unknown[] = [];
    const emitted: Array<{ type: string; data?: Record<string, unknown> }> = [];
    const ctx = {
      agentName: "may",
      sdk: {
        paths: { root, projects: projectsRoot },
        log: () => {},
        emit: (type: string, data?: Record<string, unknown>) => emitted.push({ type, data }),
        getDb: () => ({ run: () => ({}), prepare: () => ({ get: () => null, all: () => [] }) }),
        query: {
          alerts: () => ({ rows: [] }),
          workflowRuns: () => ({ rows: [] }),
          sessions: () => ({ rows: [] }),
        },
        runAgent: async (agent: string, task: string, opts?: Record<string, unknown>) => {
          agentCalls.push({ agent, task, opts });
          return {
            sessionId: "s_score_a",
            status: "done",
            lastAssistantText: "scored",
            finishResult: { status: "success", summary: "scored" },
          };
        },
        runWorkflow: async (...args: unknown[]) => {
          workflowCalls.push(args);
          return { status: "done", summary: "workflow done", runId: "wr_serial" };
        },
      },
      triggerNow: () => false,
    } as any;

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
      },
    });
  });
});
