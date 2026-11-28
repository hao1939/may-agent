import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";
import { SubagentManager } from "../../src/lib/manager.js";
import type { WorkflowEvent, WorkflowToolResult } from "../../src/lib/workflow.js";

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
  it("runs a sub-workflow via ctx.call()", async () => {
    writeWorkflow(
      "sub.ts",
      `
      export const name = "sub";
      export const description = "Sub-workflow";
      export async function execute(ctx) {
        return ctx.done("sub completed: " + ctx.input.prompt);
      }
    `,
    );

    writeWorkflow(
      "parent.ts",
      `
      export const name = "parent";
      export const description = "Parent workflow that calls sub";
      export async function execute(ctx) {
        const result = await ctx.call("global/sub", { prompt: "child task" });
        if (result.status === "done") {
          return ctx.done("parent got: " + result.summary);
        }
        return ctx.blocked("sub-workflow failed");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("parent", "parent task");

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
      export const description = "Always blocks";
      export async function execute(ctx) {
        return ctx.blocked("can't do it");
      }
    `,
    );

    writeWorkflow(
      "parent-esc.ts",
      `
      export const name = "parent-esc";
      export const description = "Parent that handles sub blocker";
      export async function execute(ctx) {
        const result = await ctx.call("global/failing-sub", { prompt: "task" });
        if (result.status === "blocked") {
          return ctx.blocked("sub blocked: " + result.summary);
        }
        return ctx.done("should not reach");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("parent-esc", "task");

    expect(parsed.type).toBe("blocked");
    if (parsed.type === "blocked") {
      expect(parsed.reason).toContain("sub blocked: can't do it");
    }
  });

  it("lets the caller report blocked when a sub-workflow cannot start", async () => {
    writeWorkflow(
      "parent-missing.ts",
      `
      export const name = "parent-missing";
      export const description = "Calls nonexistent sub";
      export async function execute(ctx) {
        const result = await ctx.call("global/nonexistent", { prompt: "task" });
        if (result.status === "error") {
          return ctx.blocked("sub not found: " + result.summary);
        }
        return ctx.done("should not reach");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("parent-missing", "task");

    expect(parsed.type).toBe("blocked");
    if (parsed.type === "blocked") {
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
        await ctx.events.emit({ type: "test.sub_step", data: { step: "sub-step" } });
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
        const result = await ctx.call("global/sub-events", { prompt: "task" });
        return ctx.done("parent done");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: mkdtempSync(join(tmpdir(), "may-test-")) });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    await runner.run("parent-events", "task");

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
});
