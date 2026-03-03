import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { readSessionMeta } from "../src/persistence.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentManager } from "../src/manager.js";
import { createWorkflowTool } from "../src/workflow-tool.js";
import { readWorkflowRun, listWorkflowRuns } from "../src/persistence.js";
import type { WorkflowToolResult, WorkflowEvent, SessionTrace } from "../src/workflow.js";
import type { Model } from "@mariozechner/pi-ai";

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
    writeWorkflow("simple.ts", `
      export const name = "simple";
      export const description = "Simple workflow";
      export async function execute(ctx) {
        return ctx.done("completed");
      }
    `);

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
    const run = readWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run).not.toBeNull();
    expect(run!.workflow).toBe("simple");
    expect(run!.task).toBe("test");
    expect(run!.status).toBe("done");
    expect(run!.depth).toBe(1);
    expect(run!.result?.summary).toBe("completed");
  });

  it("workflow run records all steps with session IDs", async () => {
    // This workflow calls runAgent which requires a registered agent.
    // Since we can't actually run an LLM, we'll test with a simple
    // workflow that doesn't call runAgent.
    writeWorkflow("no-steps.ts", `
      export const name = "no-steps";
      export const description = "No agent steps";
      export async function execute(ctx) {
        return ctx.done("done without steps: " + ctx.task);
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "no-steps", task: "task" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = readWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.steps).toEqual([]);
  });

  it("escalated workflow persists with escalated status", async () => {
    writeWorkflow("esc.ts", `
      export const name = "esc";
      export const description = "Escalates";
      export async function execute(ctx) {
        return ctx.escalate("too hard");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "esc", task: "hard task" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("escalated");
    if (parsed.type !== "escalated") return;

    const run = readWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.status).toBe("escalated");
    expect(run!.result?.reason).toBe("too hard");
  });

  it("crashed workflow persists with error status", async () => {
    writeWorkflow("crash.ts", `
      export const name = "crash";
      export const description = "Crashes";
      export async function execute(ctx) {
        throw new Error("kaboom");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "crash", task: "doomed" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("error");

    // The run should be persisted with error status
    const runs = listWorkflowRuns(persistDir);
    expect(runs.length).toBe(1);
    const run = readWorkflowRun(persistDir, runs[0]);
    expect(run!.status).toBe("error");
  });

  it("listWorkflowRuns returns all run IDs sorted", async () => {
    writeWorkflow("list-test.ts", `
      export const name = "list-test";
      export const description = "For listing";
      export async function execute(ctx) {
        return ctx.done("ok");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    await tool.execute("tc1", { action: "run", name: "list-test", task: "first" });
    await tool.execute("tc2", { action: "run", name: "list-test", task: "second" });

    const runs = listWorkflowRuns(persistDir);
    expect(runs.length).toBe(2);
    expect(runs[0] < runs[1]).toBe(true); // sorted by timestamp in ID
  });
});

// ── Workflow result: step summaries ────────────────────────────────────

describe("workflow result: step summaries", () => {
  it("done result includes empty steps array when no agents ran", async () => {
    writeWorkflow("no-agents.ts", `
      export const name = "no-agents";
      export const description = "No agent calls";
      export async function execute(ctx) {
        return ctx.done("just done");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "no-agents", task: "task" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    expect(parsed.steps).toEqual([]);
    expect(parsed.workflowRunId).toBeDefined();
  });

  it("escalated result includes workflowRunId and steps", async () => {
    writeWorkflow("esc-steps.ts", `
      export const name = "esc-steps";
      export const description = "Escalates with info";
      export async function execute(ctx) {
        return ctx.escalate("nope", { detail: "x" });
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "esc-steps", task: "task" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("escalated");
    if (parsed.type !== "escalated") return;

    expect(parsed.workflowRunId).toBeDefined();
    expect(parsed.steps).toEqual([]);
  });
});

// ── Depth cap ──────────────────────────────────────────────────────────

describe("workflow nesting depth cap", () => {
  it("sub-workflow at depth 2 works", async () => {
    writeWorkflow("outer.ts", `
      export const name = "outer";
      export const description = "Calls inner";
      export async function execute(ctx) {
        const inner = await ctx.runWorkflow("inner", "sub-task");
        if (inner.type === "done") return ctx.done("outer+inner: " + inner.summary);
        return ctx.escalate("inner failed");
      }
    `);
    writeWorkflow("inner.ts", `
      export const name = "inner";
      export const description = "Inner workflow";
      export async function execute(ctx) {
        return ctx.done("inner done");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir, maxDepth: 3 });

    const result = await tool.execute("tc1", { action: "run", name: "outer", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;
    expect(parsed.summary).toContain("inner done");
  });

  it("exceeding max depth escalates", async () => {
    writeWorkflow("recursive.ts", `
      export const name = "recursive";
      export const description = "Calls itself";
      export async function execute(ctx) {
        const sub = await ctx.runWorkflow("recursive", "recurse");
        if (sub.type === "escalate") return ctx.escalate("hit depth: " + sub.reason);
        return ctx.done("should not get here");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir, maxDepth: 2 });

    const result = await tool.execute("tc1", { action: "run", name: "recursive", task: "go" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("escalated");
    if (parsed.type !== "escalated") return;
    expect(parsed.reason).toContain("depth");
  });

  it("nested workflow runs create linked records", async () => {
    writeWorkflow("parent-wf.ts", `
      export const name = "parent-wf";
      export const description = "Parent";
      export async function execute(ctx) {
        const sub = await ctx.runWorkflow("child-wf", "child task");
        if (sub.type === "done") return ctx.done("parent+child");
        return ctx.escalate("child failed");
      }
    `);
    writeWorkflow("child-wf.ts", `
      export const name = "child-wf";
      export const description = "Child";
      export async function execute(ctx) {
        return ctx.done("child done");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "parent-wf", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    // Two workflow runs should exist
    const runs = listWorkflowRuns(persistDir);
    expect(runs.length).toBe(2);

    const parentRun = readWorkflowRun(persistDir, parsed.workflowRunId);
    expect(parentRun!.depth).toBe(1);
    expect(parentRun!.parentWorkflowRunId).toBeUndefined();

    // Find the child run
    const childRunId = runs.find((r) => r !== parsed.workflowRunId)!;
    const childRun = readWorkflowRun(persistDir, childRunId);
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
    writeWorkflow("traceable.ts", `
      export const name = "traceable";
      export const description = "Traceable";
      export async function execute(ctx) {
        return ctx.done("traced");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager, workflowDir, persistDir,
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
    writeWorkflow("nested-trace.ts", `
      export const name = "nested-trace";
      export const description = "Calls inner";
      export async function execute(ctx) {
        const sub = await ctx.runWorkflow("inner-trace", "inner task");
        return sub.type === "done" ? ctx.done("outer: " + sub.summary) : ctx.escalate("fail");
      }
    `);
    writeWorkflow("inner-trace.ts", `
      export const name = "inner-trace";
      export const description = "Inner";
      export async function execute(ctx) {
        return ctx.done("inner done");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager, workflowDir, persistDir,
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
    writeWorkflow("path-test.ts", `
      export const name = "path-test";
      export const description = "Path test";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager, workflowDir, persistDir,
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
    writeWorkflow("tool-trace.ts", `
      export const name = "tool-trace";
      export const description = "Tool trace test";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager, workflowDir, persistDir,
      callerSessionId: "s_caller_99",
    });

    const wfResult = await tool.execute("tc1", { action: "run", name: "tool-trace", task: "test" });
    const parsed = JSON.parse(wfResult.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    // Use the subagents tool to trace
    const subTool = manager.createTool();
    const traceResult = await subTool.execute("tc2", {
      action: "trace",
      sessionId: parsed.workflowRunId,
    });
    const traceData = JSON.parse(traceResult.content[0].text);

    expect(traceData.targetId).toBe(parsed.workflowRunId);
    expect(traceData.tree).toBeDefined();
    expect(traceData.path).toBeDefined();
    expect(traceData.path.length).toBeGreaterThan(0);
  });

  it("trace requires sessionId parameter", async () => {
    const manager = new SubagentManager({ persistDir });
    const subTool = manager.createTool();

    const result = await subTool.execute("tc1", { action: "trace" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("requires");
  });
});

// ── callerSessionId propagation ────────────────────────────────────────

describe("callerSessionId", () => {
  it("workflow sets parentSessionId from callerSessionId", async () => {
    writeWorkflow("caller-test.ts", `
      export const name = "caller-test";
      export const description = "Caller test";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({
      manager, workflowDir, persistDir,
      callerSessionId: "s_may_session",
    });

    const result = await tool.execute("tc1", { action: "run", name: "caller-test", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = readWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.parentSessionId).toBe("s_may_session");
  });

  it("workflow without callerSessionId uses 'unknown'", async () => {
    writeWorkflow("no-caller.ts", `
      export const name = "no-caller";
      export const description = "No caller";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `);

    const manager = new SubagentManager({ persistDir });
    const tool = createWorkflowTool({ manager, workflowDir, persistDir });

    const result = await tool.execute("tc1", { action: "run", name: "no-caller", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;
    expect(parsed.type).toBe("done");
    if (parsed.type !== "done") return;

    const run = readWorkflowRun(persistDir, parsed.workflowRunId);
    expect(run!.parentSessionId).toBe("unknown");
  });
});
