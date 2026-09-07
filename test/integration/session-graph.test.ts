import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { readSessionMeta } from "../../src/lib/persistence.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../../src/lib/manager.js";
import { createWorkflowTool } from "../../src/lib/workflow-tool.js";
import { getWorkflowRun, listWorkflowRunIds } from "../../src/lib/requests.js";
import type { WorkflowToolResult } from "../../src/lib/workflow.js";
import type { Model } from "@earendil-works/pi-ai";

// ── Test fixtures ──────────────────────────────────────────────────────

let testDir: string;
let workflowDir: string;
let persistDir: string;

function freshDir(): string {
  const dir = join(tmpdir(), `trace-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function fakeModel(): Model<any> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "anthropic",
    provider: "anthropic",
    baseUrl: "http://localhost:0",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096,
    maxTokens: 1024,
  };
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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "simple", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "no-steps", task: "task" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "esc", task: "hard task" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "crash", task: "doomed" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    await tool.execute("tc1", { action: "run", name: "list-test", task: "first" });
    await tool.execute("tc2", { action: "run", name: "list-test", task: "second" });

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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "no-agents", task: "task" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "esc-steps", task: "task" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
        const inner = await ctx.workflows.run("inner", "sub-task");
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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir, maxDepth: 3 });

    const result = await tool.execute("tc1", { action: "run", name: "outer", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
        const sub = await ctx.workflows.run("recursive", "recurse");
        if (sub.status === "blocked") return ctx.blocked("hit depth: " + sub.summary);
        return ctx.done("should not get here");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir, maxDepth: 2 });

    const result = await tool.execute("tc1", { action: "run", name: "recursive", task: "go" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
        const sub = await ctx.workflows.run("child-wf", "child task");
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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "parent-wf", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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

// ── Trace ──────────────────────────────────────────────────────────────

describe("trace()", () => {
  it("returns null for unknown session ID", () => {
    const manager = new SubagentManager({ persistDir });
    expect(manager.trace("nonexistent")).toBeNull();
  });

  it("returns null for unknown session", () => {
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    expect(manager.trace("anything")).toBeNull();
  });

  it("traces a standalone session (no workflow)", () => {
    const manager = new SubagentManager({ persistDir });
    manager.register({
      name: "worker",
      description: "test",
      domain: "test",
      systemPrompt: "test",
      model: fakeModel(),
      tools: [],
    });

    const sid = manager.run("worker", "standalone task");
    (manager.registryStore as any).getRegistry = () => {
      throw new Error("trace must not scan all historical metadata");
    };
    const trace = manager.trace(sid);

    expect(trace).not.toBeNull();
    expect(trace!.targetId).toBe(sid);
    expect(trace!.tree.type).toBe("session");
    expect(trace!.tree.id).toBe(sid);
    expect(trace!.tree.isTarget).toBe(true);
    expect(trace!.path.length).toBe(1);
    expect(trace!.path[0]).toContain(sid);
  });

  it("traces a workflow run by its runId", async () => {
    writeWorkflow(
      "traceable.ts",
      `
      export const name = "traceable";
      export const description = "Traceable";
      export async function execute(ctx) {
        return ctx.done("traced");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      persistDir,
      callerSessionId: "s_caller_1",
    });

    const result = await tool.execute("tc1", { action: "run", name: "traceable", task: "trace me" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const trace = manager.trace(parsed.workflowRunId);
    expect(trace).not.toBeNull();
    expect(trace!.targetId).toBe(parsed.workflowRunId);

    // Root should be the caller session
    expect(trace!.tree.type).toBe("session");
    expect(trace!.tree.id).toBe("s_caller_1");

    // First child should be the workflow
    expect(trace!.tree.children.length).toBe(1);
    expect(trace!.tree.children[0].type).toBe("workflow");
    expect(trace!.tree.children[0].label).toBe("traceable");
    expect(trace!.tree.children[0].isTarget).toBe(true);
  });

  it("traces a session within a workflow — shows position in tree", async () => {
    writeWorkflow(
      "nested-trace.ts",
      `
      export const name = "nested-trace";
      export const description = "Calls inner";
      export async function execute(ctx) {
        const sub = await ctx.workflows.run("inner-trace", "inner task");
        return sub.status === "done" ? ctx.done("outer: " + sub.summary) : ctx.blocked("fail");
      }
    `,
    );
    writeWorkflow(
      "inner-trace.ts",
      `
      export const name = "inner-trace";
      export const description = "Inner";
      export async function execute(ctx) {
        return ctx.done("inner done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      persistDir,
      callerSessionId: "s_may_1",
    });

    const result = await tool.execute("tc1", { action: "run", name: "nested-trace", task: "outer" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    // Trace the outer workflow run
    const outerTrace = manager.trace(parsed.workflowRunId);
    expect(outerTrace).not.toBeNull();

    // Tree: s_may_1 → nested-trace(wr_outer) → inner-trace(wr_inner)
    const outerWf = outerTrace!.tree.children[0];
    expect(outerWf.type).toBe("workflow");
    expect(outerWf.label).toBe("nested-trace");

    // The inner workflow should be a child of the outer
    const innerWf = outerWf.children.find((c) => c.type === "workflow" && c.label === "inner-trace");
    expect(innerWf).toBeDefined();
    expect(innerWf!.depth).toBe(2);
  });

  it("path shows exact position from root to target", async () => {
    writeWorkflow(
      "path-test.ts",
      `
      export const name = "path-test";
      export const description = "Path test";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      persistDir,
      callerSessionId: "s_may_42",
    });

    const result = await tool.execute("tc1", { action: "run", name: "path-test", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const trace = manager.trace(parsed.workflowRunId);
    expect(trace).not.toBeNull();

    // Path should be: [caller/caller, wr_xxx/path-test]
    expect(trace!.path.length).toBe(2);
    expect(trace!.path[0]).toContain("s_may_42");
    expect(trace!.path[1]).toContain("path-test");
  });

  it("trace via subagents tool returns the same data", async () => {
    writeWorkflow(
      "tool-trace.ts",
      `
      export const name = "tool-trace";
      export const description = "Tool trace test";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      persistDir,
      callerSessionId: "s_caller_99",
    });

    const wfResult = await tool.execute("tc1", { action: "run", name: "tool-trace", task: "test" });
    const parsed = JSON.parse(wfResult.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    // Use the manager trace directly
    const traceData = manager.trace(parsed.workflowRunId);

    expect(traceData.targetId).toBe(parsed.workflowRunId);
    expect(traceData.tree).toBeDefined();
    expect(traceData.path).toBeDefined();
    expect(traceData.path.length).toBeGreaterThan(0);
  });

  it("trace requires a valid sessionId", async () => {
    const manager = new SubagentManager({ persistDir });

    const traceData = manager.trace("nonexistent");
    expect(traceData).toBeNull();
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
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      persistDir,
      callerSessionId: "s_may_session",
    });

    const result = await tool.execute("tc1", { action: "run", name: "caller-test", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "no-caller", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      persistDir,
      projectId: "scout/scout-second-brain-learning",
    });

    const result = await tool.execute("tc1", { action: "run", name: "project-tag-test", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
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
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      persistDir,
      callerSessionId: callerSid,
    });

    const result = await tool.execute("tc1", { action: "run", name: "caller-lineage-test", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = getWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.parentSessionId).toBe(callerSid);
    expect(run!.parentWorkflowRunId).toBe("wr_parent");
    expect(run!.projectId).toBe("scout/scout-second-brain-learning");
  });
});
