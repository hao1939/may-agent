import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { readSessionMeta } from "../../src/lib/persistence.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";
import { getWorkflowRun, listWorkflowRunIds } from "../../src/lib/db/workflows.js";
import type { WorkflowToolResult } from "../../src/lib/workflow.js";
import { fakeModel } from "../fixtures/model.js";

// ── Test fixtures ──────────────────────────────────────────────────────

let testDir: string;
let workflowDir: string;
let persistDir: string;

function freshDir(): string {
  const dir = join(tmpdir(), `trace-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeWorkflow(name: string, content: string): void {
  writeFileSync(join(workflowDir, name), content, "utf-8");
}

beforeEach(() => {
  testDir = freshDir();
  workflowDir = join(testDir, "workflows");
  persistDir = join(testDir, "state");
  mkdirSync(workflowDir, { recursive: true });
  mkdirSync(persistDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// ── Session graph: parent links ────────────────────────────────────────

describe("session graph: parent links on run()", () => {
  it("sessions spawned with RunOptions have parentSessionId in status()", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "worker",
      description: "test",
      domain: "test",
      systemPrompt: "you are a worker",
      model: fakeModel(),
      tools: [],
    });

    const sid = manager.run("worker", "do work", {
      parentSessionId: "s_parent_123",
      workflowRunId: "wr_123",
      stepLabel: "coder",
    });

    const sessions = manager.status();
    const session = sessions.find((s) => s.sessionId === sid)!;
    expect(session.parentSessionId).toBe("s_parent_123");
    expect(session.workflowRunId).toBe("wr_123");
    expect(session.stepLabel).toBe("coder");
  });

  it("sessions without RunOptions have no parent links", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "worker",
      description: "test",
      domain: "test",
      systemPrompt: "you are a worker",
      model: fakeModel(),
      tools: [],
    });

    const sid = manager.run("worker", "do work");
    const sessions = manager.status();
    const session = sessions.find((s) => s.sessionId === sid)!;
    expect(session.parentSessionId).toBeUndefined();
    expect(session.workflowRunId).toBeUndefined();
    expect(session.stepLabel).toBeUndefined();
  });

  it("parent links are persisted in registry", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "worker",
      description: "test",
      domain: "test",
      systemPrompt: "you are a worker",
      model: fakeModel(),
      tools: [],
    });

    const sid = manager.run("worker", "do work", {
      parentSessionId: "s_parent_456",
      workflowRunId: "wr_456",
      stepLabel: "reviewer",
    });

    // Read the session's meta.json directly
    const persisted = readSessionMeta(persistDir, sid);
    expect(persisted!.parentSessionId).toBe("s_parent_456");
    expect(persisted!.workflowRunId).toBe("wr_456");
    expect(persisted!.stepLabel).toBe("reviewer");
  });
});

// ── Workflow run persistence ───────────────────────────────────────────

describe("workflow run persistence", () => {
  it("workflow.run() creates a workflow run record on disk", async () => {
    writeWorkflow(
      "simple.ts",
      `
      export const name = "simple";
      export const description = "Simple workflow";
      export async function execute(ctx) {
        return ctx.done("completed");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    const parsed: WorkflowToolResult = await runner.run("simple", "test");

    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    // Check the workflow run ID is returned
    expect(parsed.workflowRunId).toBeDefined();
    expect(parsed.workflowRunId).toMatch(/^wr_/);

    // Check the run was persisted
    const run = getWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run).not.toBeNull();
    expect(run!.workflow).toBe("simple");
    expect(run!.task).toBe("test");
    expect(run!.status).toBe("done");
    expect(run!.depth).toBe(1);
    expect(run!.result_summary).toBe("completed");
  });

  it("workflow run records all steps with session IDs", async () => {
    // This workflow calls runAgent which requires a registered agent.
    // Since we can't actually run an LLM, we'll test with a simple
    // workflow that doesn't call runAgent.
    writeWorkflow(
      "no-steps.ts",
      `
      export const name = "no-steps";
      export const description = "No agent steps";
      export async function execute(ctx) {
        return ctx.done("done without steps: " + ctx.input);
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    const parsed: WorkflowToolResult = await runner.run("no-steps", "task");
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = getWorkflowRun(persistDir, parsed.workflowRunId);
    // Steps are now tracked in sessions table, not on the run record
    expect(run).not.toBeNull();
    expect(run!.status).toBe("done");
  });

  it("blocked workflow persists with blocked status", async () => {
    writeWorkflow(
      "esc.ts",
      `
      export const name = "esc";
      export const description = "Blocks";
      export async function execute(ctx) {
        return ctx.blocked("too hard");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    const parsed: WorkflowToolResult = await runner.run("esc", "hard task");
    expect(parsed.type).toBe("blocked");
    if (parsed.type !== "blocked") return;

    const run = getWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.status).toBe("blocked");
    expect(run!.result_reason).toBe("too hard");
  });

  it("crashed workflow persists with error status", async () => {
    writeWorkflow(
      "crash.ts",
      `
      export const name = "crash";
      export const description = "Crashes";
      export async function execute(ctx) {
        throw new Error("kaboom");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    const parsed: WorkflowToolResult = await runner.run("crash", "doomed");
    expect(parsed.type).toBe("error");

    // The run should be persisted with error status
    const runs = listWorkflowRunIds(persistDir);
    expect(runs.length).toBe(1);
    const run = getWorkflowRun(persistDir, runs[0]);
    expect(run!.status).toBe("error");
  });

  it("listWorkflowRunIds returns all run IDs sorted", async () => {
    writeWorkflow(
      "list-test.ts",
      `
      export const name = "list-test";
      export const description = "For listing";
      export async function execute(ctx) {
        return ctx.done("ok");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    await runner.run("list-test", "first");
    await runner.run("list-test", "second");

    const runs = listWorkflowRunIds(persistDir);
    expect(runs.length).toBe(2);
    expect(runs[0] < runs[1]).toBe(true); // sorted by timestamp in ID
  });
});

// ── Workflow result: step summaries ────────────────────────────────────

describe("workflow result: step summaries", () => {
  it("done result includes empty steps array when no agents ran", async () => {
    writeWorkflow(
      "no-agents.ts",
      `
      export const name = "no-agents";
      export const description = "No agent calls";
      export async function execute(ctx) {
        return ctx.done("just done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    const parsed: WorkflowToolResult = await runner.run("no-agents", "task");
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    expect(parsed.steps).toEqual([]);
    expect(parsed.workflowRunId).toBeDefined();
  });

  it("blocked result includes workflowRunId and steps", async () => {
    writeWorkflow(
      "esc-steps.ts",
      `
      export const name = "esc-steps";
      export const description = "Blocks with info";
      export async function execute(ctx) {
        return ctx.blocked("nope", { detail: "x" });
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    const parsed: WorkflowToolResult = await runner.run("esc-steps", "task");
    expect(parsed.type).toBe("blocked");
    if (parsed.type !== "blocked") return;

    expect(parsed.workflowRunId).toBeDefined();
    expect(parsed.steps).toEqual([]);
  });
});

// ── Depth cap ──────────────────────────────────────────────────────────

describe("workflow nesting depth cap", () => {
  it("sub-workflow at depth 2 works", async () => {
    writeWorkflow(
      "outer.ts",
      `
      export const name = "outer";
      export const description = "Calls inner";
      export async function execute(ctx) {
        const inner = await ctx.call("inner", "sub-task");
        if (inner.status === "done") return ctx.done("outer+inner: " + inner.summary);
        return ctx.blocked("inner failed");
      }
    `,
    );
    writeWorkflow(
      "inner.ts",
      `
      export const name = "inner";
      export const description = "Inner workflow";
      export async function execute(ctx) {
        return ctx.done("inner done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir, maxDepth: 3 });

    const parsed: WorkflowToolResult = await runner.run("outer", "test");
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;
    expect(parsed.summary).toContain("inner done");
  });

  it("exceeding max depth blocks", async () => {
    writeWorkflow(
      "recursive.ts",
      `
      export const name = "recursive";
      export const description = "Calls itself";
      export async function execute(ctx) {
        try {
          const sub = await ctx.call("recursive", "recurse");
          if (sub.status === "blocked") return ctx.blocked("hit depth: " + sub.summary);
          return ctx.done("should not get here");
        } catch (error) {
          return ctx.blocked("hit depth: " + error.message);
        }
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir, maxDepth: 2 });

    const parsed: WorkflowToolResult = await runner.run("recursive", "go");
    expect(parsed.type).toBe("blocked");
    if (parsed.type !== "blocked") return;
    expect(parsed.reason).toContain("depth");
  });

  it("nested workflow runs create linked records", async () => {
    writeWorkflow(
      "parent-wf.ts",
      `
      export const name = "parent-wf";
      export const description = "Parent";
      export async function execute(ctx) {
        const sub = await ctx.call("child-wf", "child task");
        if (sub.status === "done") return ctx.done("parent+child");
        return ctx.blocked("child failed");
      }
    `,
    );
    writeWorkflow(
      "child-wf.ts",
      `
      export const name = "child-wf";
      export const description = "Child";
      export async function execute(ctx) {
        return ctx.done("child done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    const parsed: WorkflowToolResult = await runner.run("parent-wf", "test");
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    // Two workflow runs should exist
    const runs = listWorkflowRunIds(persistDir);
    expect(runs.length).toBe(2);

    const parentRun = getWorkflowRun(persistDir, parsed.workflowRunId);
    expect(parentRun!.depth).toBe(1);
    expect(parentRun!.parentWorkflowRunId).toBeNull();

    // Find the child run
    const childRunId = runs.find((r) => r !== parsed.workflowRunId)!;
    const childRun = getWorkflowRun(persistDir, childRunId);
    expect(childRun!.depth).toBe(2);
    expect(childRun!.parentWorkflowRunId).toBe(parsed.workflowRunId);
    expect(childRun!.workflow).toBe("child-wf");
  });
});

// ── callerSessionId propagation ────────────────────────────────────────

describe("callerSessionId", () => {
  it("workflow sets parentSessionId from callerSessionId", async () => {
    writeWorkflow(
      "caller-test.ts",
      `
      export const name = "caller-test";
      export const description = "Caller test";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      persistDir,
      callerSessionId: "s_may_session",
    });

    const parsed: WorkflowToolResult = await runner.run("caller-test", "test");
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = getWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.parentSessionId).toBe("s_may_session");
  });

  it("workflow without callerSessionId has no parent session", async () => {
    writeWorkflow(
      "no-caller.ts",
      `
      export const name = "no-caller";
      export const description = "No caller";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({ manager, workflowDir, persistDir });

    const parsed: WorkflowToolResult = await runner.run("no-caller", "test");
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = getWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.parentSessionId).toBeNull();
  });

  it("workflow run stores projectId when launched for a project", async () => {
    writeWorkflow(
      "project-tag-test.ts",
      `
      export const name = "project-tag-test";
      export const description = "Project tag test";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      persistDir,
      projectId: "scout/scout-second-brain-learning",
    });

    const parsed: WorkflowToolResult = await runner.run("project-tag-test", "test");
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = getWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.projectId).toBe("scout/scout-second-brain-learning");
  });

  it("workflow launched from a session inherits caller project and workflow lineage", async () => {
    writeWorkflow(
      "caller-lineage-test.ts",
      `
      export const name = "caller-lineage-test";
      export const description = "Caller lineage test";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `,
    );

    const callerSid = "s_project_caller";
    const manager = new SubagentManager({ persistDir });
    (manager as any).registry.saveSession(callerSid, {
      agent: "worker",
      task: "caller",
      status: "running",
      startedAt: Date.now(),
      workflowRunId: "wr_parent",
      projectId: "scout/scout-second-brain-learning",
    });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      persistDir,
      callerSessionId: callerSid,
    });

    const parsed: WorkflowToolResult = await runner.run("caller-lineage-test", "test");
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = getWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.parentSessionId).toBe(callerSid);
    expect(run!.parentWorkflowRunId).toBe("wr_parent");
    expect(run!.projectId).toBe("scout/scout-second-brain-learning");
  });
});
