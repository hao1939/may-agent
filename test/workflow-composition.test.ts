import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkflowTool } from "../src/lib/workflow-tool.js";
import { SubagentManager } from "../src/lib/manager.js";
import type { WorkflowEvent, WorkflowToolResult } from "../src/lib/workflow.js";

let testDir: string;
let workflowDir: string;

function freshDir(): string {
  const dir = join(tmpdir(), `wf-comp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeWorkflow(name: string, content: string): void {
  writeFileSync(join(workflowDir, name), content, "utf-8");
}

beforeEach(() => {
  testDir = freshDir();
  workflowDir = join(testDir, "workflows");
  mkdirSync(workflowDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("workflow composition: runWorkflow", () => {
  it("runs a sub-workflow via ctx.runWorkflow()", async () => {
    writeWorkflow(
      "sub.ts",
      `
      export const name = "sub";
      export const description = "Sub-workflow";
      export async function execute(ctx) {
        return ctx.done("sub completed: " + ctx.task);
      }
    `,
    );

    writeWorkflow(
      "parent.ts",
      `
      export const name = "parent";
      export const description = "Parent workflow that calls sub";
      export async function execute(ctx) {
        const result = await ctx.runWorkflow("sub", "child task");
        if (result.type === "done") {
          return ctx.done("parent got: " + result.summary);
        }
        return ctx.escalate("sub-workflow failed");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "parent",
      task: "parent task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("done");
    if (parsed.type === "done") {
      expect(parsed.summary).toBe("parent got: sub completed: child task");
    }
  });

  it("handles sub-workflow escalation", async () => {
    writeWorkflow(
      "failing-sub.ts",
      `
      export const name = "failing-sub";
      export const description = "Always escalates";
      export async function execute(ctx) {
        return ctx.escalate("can't do it");
      }
    `,
    );

    writeWorkflow(
      "parent-esc.ts",
      `
      export const name = "parent-esc";
      export const description = "Parent that handles sub escalation";
      export async function execute(ctx) {
        const result = await ctx.runWorkflow("failing-sub", "task");
        if (result.type === "escalate") {
          return ctx.escalate("sub escalated: " + result.reason);
        }
        return ctx.done("should not reach");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "parent-esc",
      task: "task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("escalated");
    if (parsed.type === "escalated") {
      expect(parsed.reason).toContain("sub escalated: can't do it");
    }
  });

  it("returns escalate when sub-workflow is not found", async () => {
    writeWorkflow(
      "parent-missing.ts",
      `
      export const name = "parent-missing";
      export const description = "Calls nonexistent sub";
      export async function execute(ctx) {
        const result = await ctx.runWorkflow("nonexistent", "task");
        if (result.type === "escalate") {
          return ctx.escalate("sub not found: " + result.reason);
        }
        return ctx.done("should not reach");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "parent-missing",
      task: "task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("escalated");
    if (parsed.type === "escalated") {
      expect(parsed.reason).toContain("not found");
    }
  });

  it("emits workflow events for sub-workflows", async () => {
    writeWorkflow(
      "sub-events.ts",
      `
      export const name = "sub-events";
      export const description = "Sub with events";
      export async function execute(ctx) {
        ctx.emit({ type: "test.sub_step", step: "sub-step" });
        return ctx.done("sub done");
      }
    `,
    );

    writeWorkflow(
      "parent-events.ts",
      `
      export const name = "parent-events";
      export const description = "Parent with sub events";
      export async function execute(ctx) {
        const result = await ctx.runWorkflow("sub-events", "task");
        return ctx.done("parent done");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    await tool.execute("tc1", {
      action: "run",
      name: "parent-events",
      task: "task",
    });

    // Expected events:
    // 1. workflow.started (parent)
    // 2. workflow.started (sub)
    // 3. test.sub_step (sub-step, emitted by workflow code)
    // 4. workflow.completed (sub)
    // 5. workflow.completed (parent)
    const types = events.map((e) => e.type);
    expect(types).toContain("workflow.started");
    expect(types).toContain("workflow.completed");

    // Should have multiple workflow.started events (parent + sub)
    const starts = events.filter((e) => e.type === "workflow.started");
    expect(starts.length).toBe(2);
  });

  it("sub-workflow shares steering queue with parent", async () => {
    // Write a sub that yields then calls runAgent (which checks steering)
    writeWorkflow(
      "sub-steerable.ts",
      `
      export const name = "sub-steerable";
      export const description = "Sub that can be steered";
      export async function execute(ctx) {
        ctx.emit({ type: "test.ready", step: "ready-for-steering" });
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));
        const result = await ctx.runAgent("coder", "something");
        return ctx.done("should not reach");
      }
    `,
    );

    writeWorkflow(
      "parent-steerable.ts",
      `
      export const name = "parent-steerable";
      export const description = "Parent that delegates to steerable sub";
      export async function execute(ctx) {
        const result = await ctx.runWorkflow("sub-steerable", "task");
        return ctx.done("done");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")), infraRetryMax: 0 });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    function waitForEvent(predicate: (e: WorkflowEvent) => boolean): Promise<void> {
      return new Promise((resolve) => {
        if (events.some(predicate)) {
          resolve();
          return;
        }
        const interval = setInterval(() => {
          if (events.some(predicate)) {
            clearInterval(interval);
            resolve();
          }
        }, 1);
      });
    }

    const execPromise = tool.execute("tc1", {
      action: "run",
      name: "parent-steerable",
      task: "task",
    });

    await waitForEvent((e) => e.type === "test.ready" && "step" in e && e.step === "ready-for-steering");

    // Steer the parent — should propagate to sub-workflow since they share the queue
    expect(tool.isRunning).toBe(true);
    tool.steer("interrupt!");

    const result = await execPromise;
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    // The interruption should propagate from sub-workflow through parent
    expect(parsed.type).toBe("interrupted");
    if (parsed.type === "interrupted") {
      expect(parsed.steeringMessage).toBe("interrupt!");
    }
  });
});
