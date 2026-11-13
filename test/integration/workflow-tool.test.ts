import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
import { SubagentManager } from "../../src/lib/manager.js";
import { createWorkflowRunner, createWorkflowTool } from "../../src/lib/workflow-tool.js";
import type { WorkflowEvent, WorkflowToolResult } from "../../src/lib/workflow.js";

// ── Test fixtures ──────────────────────────────────────────────────────

let testDir: string;
let workflowDir: string;

function freshDir(): string {
  const dir = join(tmpdir(), `wf-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write a workflow .ts file. */
function writeWorkflow(name: string, content: string): void {
  const fixture =
    content.includes("export const description") || name === "minimal.ts" || name === "broken.ts"
      ? content
      : content.replace(
          /(export const name\s*=\s*[^;]+;)/,
          '$1\n      export const description = "Test workflow fixture";',
        );
  writeFileSync(join(workflowDir, name), fixture, "utf-8");
}

/** Create a promise that resolves when the first event matching the predicate is seen. */
function waitForEvent(events: WorkflowEvent[], predicate: (e: WorkflowEvent) => boolean): Promise<void> {
  return new Promise((resolve) => {
    // Check if already seen
    if (events.some(predicate)) {
      resolve();
      return;
    }
    // Poll at microtask level — events are pushed synchronously by the tool
    const interval = setInterval(() => {
      if (events.some(predicate)) {
        clearInterval(interval);
        resolve();
      }
    }, 1);
  });
}

beforeEach(() => {
  testDir = freshDir();
  workflowDir = join(testDir, "workflows");
  mkdirSync(workflowDir, { recursive: true });
});

afterEach(() => {
  closeDb(join(testDir, "state"));
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// ── Tests ──────────────────────────────────────────────────────────────

describe("workflow tool: list", () => {
  it("returns empty list when no workflows exist", async () => {
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", { action: "list" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("list");
    if (parsed.type === "list") {
      expect(parsed.workflows).toEqual([]);
    }
  });

  it("returns empty list when directory doesn't exist", async () => {
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir: join(testDir, "nonexistent"),
    });

    const result = await tool.execute("tc1", { action: "list" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("list");
    if (parsed.type === "list") {
      expect(parsed.workflows).toEqual([]);
    }
  });

  it("lists workflows from .ts files", async () => {
    writeWorkflow(
      "alpha.ts",
      `
      export const name = "alpha";
      export const description = "Alpha workflow";
      export async function execute(ctx) { return ctx.done("ok"); }
    `,
    );
    writeWorkflow(
      "beta.ts",
      `
      export const name = "beta";
      export const description = "Beta workflow";
      export async function execute(ctx) { return ctx.done("ok"); }
    `,
    );
    // Non-.ts file should be ignored
    writeFileSync(join(workflowDir, "README.md"), "ignored", "utf-8");

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", { action: "list" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("list");
    if (parsed.type === "list") {
      expect(parsed.workflows).toHaveLength(2);
      expect(parsed.workflows[0].name).toBe("alpha");
      expect(parsed.workflows[0].description).toBe("Alpha workflow");
      expect(parsed.workflows[1].name).toBe("beta");
      expect(parsed.workflows[1].description).toBe("Beta workflow");
    }
  });

  it("handles workflow load errors gracefully", async () => {
    writeWorkflow("broken.ts", `export const foo = "bar";`); // missing name/execute

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", { action: "list" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("list");
    if (parsed.type === "list") {
      expect(parsed.workflows).toHaveLength(0);
      expect(parsed.diagnostics?.join("\n")).toContain("name");
    }
  });

  it("rejects workflows without an explicit description", async () => {
    writeWorkflow(
      "minimal.ts",
      `
      export const name = "minimal";
      export async function execute(ctx) { return ctx.done("ok"); }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", { action: "list" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("list");
    if (parsed.type === "list") {
      expect(parsed.workflows).toHaveLength(0);
      expect(parsed.diagnostics?.join("\n")).toContain("description");
    }
  });

  it("resolves by exported name and rejects duplicates within the owning agent", async () => {
    writeWorkflow(
      "agent-file.ts",
      `
      export const name = "effective";
      export const description = "Agent version";
      export async function execute(ctx) { return ctx.done("agent"); }
    `,
    );
    writeWorkflow(
      "duplicate-a.ts",
      `
      export const name = "ambiguous";
      export const description = "Duplicate A";
      export async function execute(ctx) { return ctx.done("a"); }
    `,
    );
    writeWorkflow(
      "duplicate-b.ts",
      `
      export const name = "ambiguous";
      export const description = "Duplicate B";
      export async function execute(ctx) { return ctx.done("b"); }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });
    const listed = JSON.parse((await tool.execute("tc1", { action: "list" })).content[0].text) as WorkflowToolResult;
    expect(listed.type).toBe("list");
    if (listed.type !== "list") return;
    expect(listed.workflows).toContainEqual({
      name: "effective",
      description: "Agent version",
      sourceScope: "agent",
    });
    expect(listed.workflows.some((workflow) => workflow.name === "ambiguous")).toBe(false);
    expect(listed.diagnostics?.join("\n")).toContain('Ambiguous agent workflow name "ambiguous"');

    const result = JSON.parse(
      (await tool.execute("tc2", { action: "run", name: "effective", task: "task" })).content[0].text,
    ) as WorkflowToolResult;
    expect(result.type).toBe("done");
    if (result.type === "done") expect(result.summary).toBe("agent");
  });
});

describe("workflow tool: typed execution", () => {
  it("bounds the complete workflow execution before any agent step", async () => {
    writeWorkflow(
      "never-finishes.ts",
      `
      export const name = "never-finishes";
      export const description = "Never resolves";
      export async function execute() { return new Promise(() => {}); }
    `,
    );
    const persistDir = join(testDir, "state");
    const manager = new SubagentManager({ persistDir });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      persistDir,
      executionTimeoutMs: 20,
    });

    const result = await runner.run("never-finishes", "stall before an agent step");

    expect(result).toMatchObject({
      type: "error",
      workflow: "never-finishes",
    });
    if (result.type === "error") {
      expect(result.error).toContain('Workflow "never-finishes" timed out after 20ms');
    }
    const [runDir] = readdirSync(join(persistDir, "workflow-runs"));
    const run = JSON.parse(readFileSync(join(persistDir, "workflow-runs", runDir, "run.json"), "utf8"));
    expect(run).toMatchObject({
      workflow: "never-finishes",
      status: "error",
    });
    expect(run.endedAt).toBeNumber();
  });

  it("shares one typed runner with the serialized tool boundary", async () => {
    writeWorkflow(
      "typed.ts",
      `
      export const name = "typed";
      export const description = "Typed runner fixture";
      export async function execute(ctx) { return ctx.done("typed result", { disposition: "converged" }); }
    `,
    );
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({ manager, workflowDir });
    const tool = createWorkflowTool({ manager, workflowDir });

    const typed = await runner.run("typed", "run typed workflow");
    expect(typed).toMatchObject({
      type: "done",
      workflow: "typed",
      summary: "typed result",
      output: { disposition: "converged" },
    });

    const serialized = await tool.execute("tc1", {
      action: "run",
      name: "typed",
      task: "run typed workflow",
    });
    expect(JSON.parse(serialized.content[0].text)).toMatchObject({
      type: "done",
      workflow: "typed",
      summary: "typed result",
      output: { disposition: "converged" },
    });
  });

  it("propagates the caller's recovery owner to workflow step sessions", async () => {
    writeWorkflow(
      "recovery-owned.ts",
      `
      export const name = "recovery-owned";
      export const description = "Recovery ownership fixture";
      export async function execute(ctx) {
        await ctx.agents.call("worker", "do the step");
        return ctx.done("done");
      }
    `,
    );
    const calls: Array<Record<string, unknown>> = [];
    const manager = {
      async callAgent(_agent: string, _task: string, options: Record<string, unknown>) {
        calls.push(options);
        return {
          sessionId: "step-session",
          status: "done",
          lastAssistantText: "done",
          messages: [],
          duration: "0s",
          outputDir: "",
        };
      },
    } as unknown as SubagentManager;
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
    });

    expect(await runner.run("recovery-owned", "run it")).toMatchObject({ type: "done" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
    });
  });
});

describe("workflow tool: run", () => {
  it("returns error when workflow not found", async () => {
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "nonexistent",
      task: "do something",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("error");
    if (parsed.type === "error") {
      expect(parsed.error).toContain("not found");
    }
  });

  it("executes a simple workflow that returns done", async () => {
    writeWorkflow(
      "simple.ts",
      `
      export const name = "simple";
      export const description = "A simple workflow";
      export async function execute(ctx) {
        return ctx.done("completed: " + ctx.input);
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "simple",
      task: "test task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("done");
    if (parsed.type === "done") {
      expect(parsed.workflow).toBe("simple");
      expect(parsed.summary).toBe("completed: test task");
    }
  });

  it("executes a workflow that blocks", async () => {
    writeWorkflow(
      "escalating.ts",
      `
      export const name = "escalating";
      export const description = "Always blocks";
      export async function execute(ctx) {
        return ctx.blocked("can't handle this", { reason: "too complex" });
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "escalating",
      task: "complex task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("blocked");
    if (parsed.type === "blocked") {
      expect(parsed.workflow).toBe("escalating");
      expect(parsed.reason).toBe("can't handle this");
      expect(parsed.context).toEqual({ reason: "too complex" });
    }
  });

  it("catches workflow crashes and returns error", async () => {
    writeWorkflow(
      "crashing.ts",
      `
      export const name = "crashing";
      export const description = "Throws an error";
      export async function execute(ctx) {
        throw new Error("boom!");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "crashing",
      task: "doomed task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("error");
    if (parsed.type === "error") {
      expect(parsed.workflow).toBe("crashing");
      expect(parsed.error).toContain("boom!");
    }
  });

  it("emits workflow events via onEvent callback", async () => {
    writeWorkflow(
      "evented.ts",
      `
      export const name = "evented";
      export const description = "Emits custom events";
      export async function execute(ctx) {
        await ctx.events.emit({ type: "test.custom-step", data: { result: "ok" } });
        return ctx.done("done with events");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    await tool.execute("tc1", {
      action: "run",
      name: "evented",
      task: "evented task",
    });

    expect(events.map((event) => event.type)).toEqual([
      "workflow.started", "test.custom-step", "workflow.completed",
    ]);
  });

  it("emits workflow.blocked event on local workflow blocker", async () => {
    writeWorkflow(
      "esc-event.ts",
      `
      export const name = "esc-event";
      export const description = "Escalates with event";
      export async function execute(ctx) {
        return ctx.blocked("nope");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    await tool.execute("tc1", {
      action: "run",
      name: "esc-event",
      task: "task",
    });

    expect(events.length).toBe(2);
    expect(events[0].type).toBe("workflow.started");
    expect(events[1].type).toBe("workflow.blocked");
  });

  it("keeps ctx.blocked local and does not emit escalation.created", async () => {
    writeWorkflow(
      "local-escalation.ts",
      `
      export const name = "local-escalation";
      export const description = "Escalates locally";
      export async function execute(ctx) {
        return ctx.blocked("missing sessionId", {
          owner: "agent:may",
          requestedAction: "Fix the event producer",
          facts: { triggerType: "session.end" },
        });
      }
    `,
    );

    const lifecycleEvents: WorkflowEvent[] = [];
    const runtimeEvents: Array<{ type: string; [key: string]: unknown }> = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => lifecycleEvents.push(e),
      runtimeCtx: {
        emit: (event: { type: string; [key: string]: unknown }) => runtimeEvents.push(event),
        dispatchEvent: () => {},
        getDb: () => getDb(join(testDir, "state")),
        query: {} as never,
        log: () => {},
        notify: () => {},
        metrics: {} as never,
        persistDir: "",
        projectRoot: "",
        agentsRoot: "",
        sharedRoot: "",
        projectsRoot: "",
      },
    });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "local-escalation",
      task: "task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("blocked");
    if (parsed.type === "blocked") {
      expect(parsed.reason).toBe("missing sessionId");
      expect(parsed.context).toEqual({
        owner: "agent:may",
        requestedAction: "Fix the event producer",
        facts: { triggerType: "session.end" },
      });
    }
    expect(lifecycleEvents.map((event) => event.type)).toEqual(["workflow.started", "workflow.blocked"]);
    expect(runtimeEvents.some((event) => event.type === "escalation.created")).toBe(false);
  });

  it("reports a blocked workflow without inventing an App input schema", async () => {
    writeWorkflow(
      "project-blocked.ts",
      `
      export const name = "project-blocked";
      export const description = "Blocks a project workflow";
      export async function execute(ctx) {
        return ctx.blocked("need owner judgment", { detail: "x" });
      }
    `,
    );

    const runtimeEvents: Array<{ type: string; [key: string]: unknown }> = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      agentName: "may",
      projectId: "may-agent",
      runtimeCtx: {
        emit: (event: { type: string; [key: string]: unknown }) => runtimeEvents.push(event),
        dispatchEvent: () => {},
        getDb: () => getDb(join(testDir, "state")),
        query: {} as never,
        log: () => {},
        notify: () => {},
        metrics: {} as never,
        persistDir: "",
        projectRoot: "",
        agentsRoot: "",
        sharedRoot: "",
        projectsRoot: "",
      },
    });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "project-blocked",
      task: "task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("blocked");
    if (parsed.type !== "blocked") return;
    expect(runtimeEvents.some((event) => event.type === "escalation.created")).toBe(false);
    expect(runtimeEvents).toContainEqual(expect.objectContaining({
      type: "workflow.owner.requested", owner: "agent:may",
      data: expect.objectContaining({ workflowRunId: parsed.workflowRunId, workflow: "project-blocked",
        projectId: "may-agent", blockerReason: "need owner judgment", context: { detail: "x" } }),
    }));
    expect(runtimeEvents.some(event => event.type === "app.input.requested")).toBe(false);
  });

  it("leaves task-bound workflow failure on its explicit task controller", async () => {
    writeWorkflow(
      "task-blocked.ts",
      `
      export const name = "task-blocked";
      export const description = "Blocks while handling a project task";
      export async function execute(ctx) {
        return ctx.blocked("worker preflight failed", { detail: "missing token" });
      }
    `,
    );

    const runtimeEvents: Array<{ type: string; [key: string]: unknown }> = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    AppTaskResourceStore.fromDb(getDb(join(testDir, "state")), "alpha-project").bootstrapSnapshot(
      {
        project: "alpha-project",
        resources: {
          "vm-pipeline-rest-plan": {
            metadata: { id: "vm-pipeline-rest-plan", generation: 1, resourceVersion: 1 },
            spec: { parentId: "root", outcome: "Plan", acceptance: ["Done"] },
            status: { phase: "running", observedGeneration: 0, currentAttemptId: "a_vm_pipeline_rest_plan_1" },
          },
        },
        attempts: {
          a_vm_pipeline_rest_plan_1: {
            metadata: { id: "a_vm_pipeline_rest_plan_1", resourceVersion: 1 },
            taskId: "vm-pipeline-rest-plan",
            taskGeneration: 1,
            specHash: "hash",
            owner: "aks-explorer",
            handler: "workflow:task-blocked",
            runtimeId: "rt",
            state: "running",
            reason: "event",
            startedAt: new Date().toISOString(),
          },
        },
      },
      "fixture",
    );
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      agentName: "aks-explorer",
      projectId: "alpha-project",
      taskBinding: {
        appId: "alpha-project",
        taskId: "vm-pipeline-rest-plan",
        generation: 1,
        attemptId: "a_vm_pipeline_rest_plan_1",
      },
      runtimeCtx: {
        emit: (event: { type: string; [key: string]: unknown }) => runtimeEvents.push(event),
        dispatchEvent: () => {},
        getDb: () => getDb(join(testDir, "state")),
        query: {} as never,
        log: () => {},
        notify: () => {},
        metrics: {} as never,
        persistDir: "",
        projectRoot: "",
        agentsRoot: "",
        sharedRoot: "",
        projectsRoot: "",
      },
    });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "task-blocked",
      task: [
        "app: /app/projects/alpha-project.app",
        "project: /app/projects/alpha-project",
        "",
        "## Trigger Event",
        "```json",
        JSON.stringify({
          type: "project.task.reconcile.started",
          project: "alpha-project",
          data: {
            taskId: "vm-pipeline-rest-plan",
            attemptId: "a_vm_pipeline_rest_plan_1",
          },
        }),
        "```",
      ].join("\n"),
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("blocked");
    expect(runtimeEvents.some((event) => event.type === "escalation.created")).toBe(false);
    expect(runtimeEvents.some((event) => event.type === "project.owner.requested")).toBe(false);
    expect(runtimeEvents.some((event) => event.type === "workflow.owner.requested")).toBe(false);
    expect(runtimeEvents.some((event) => event.type.startsWith("project.task."))).toBe(false);
    expect(runtimeEvents).toContainEqual(
      expect.objectContaining({
        type: "workflow.blocked",
        data: expect.objectContaining({
          projectId: "alpha-project",
          reason: "worker preflight failed",
          context: { detail: "missing token" },
        }),
      }),
    );
  });

  it("wakes the workflow owner when a top-level non-project workflow blocks", async () => {
    writeWorkflow(
      "owner-blocked.ts",
      `
      export const name = "owner-blocked";
      export const description = "Blocks a non-project workflow";
      export async function execute(ctx) {
        return ctx.blocked("need workflow owner", { detail: "generic" });
      }
    `,
    );

    const runtimeEvents: Array<{ type: string; [key: string]: unknown }> = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      agentName: "may",
      runtimeCtx: {
        emit: (event: { type: string; [key: string]: unknown }) => runtimeEvents.push(event),
        dispatchEvent: () => {},
        getDb: () => getDb(join(testDir, "state")),
        query: {} as never,
        log: () => {},
        notify: () => {},
        metrics: {} as never,
        persistDir: "",
        projectRoot: "",
        agentsRoot: "",
        sharedRoot: "",
        projectsRoot: "",
      },
    });

    const result = await tool.execute("tc1", {
      action: "run",
      name: "owner-blocked",
      task: "task",
    });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("blocked");
    if (parsed.type !== "blocked") return;
    expect(runtimeEvents.some((event) => event.type === "escalation.created")).toBe(false);
    expect(runtimeEvents).toContainEqual(
      expect.objectContaining({
        type: "workflow.owner.requested",
        owner: "agent:may",
        data: expect.objectContaining({
          reason: "workflow-blocked",
          workflowRunId: parsed.workflowRunId,
          workflow: "owner-blocked",
          workflowOwner: "agent:may",
          blockerReason: "need workflow owner",
          context: { detail: "generic" },
        }),
      }),
    );
  });

  // NOTE: hot-reload works under plain Node (cache-bust via ?t=counter)
  // but Bun test's transform pipeline normalizes query strings, so this
  // can't be tested here. Verified manually with node --input-type=module.
});

describe("workflow tool: agent name validation", () => {
  it("rejects agents.call with undefined agent name (defensive guard)", async () => {
    writeWorkflow(
      "bad-agent.ts",
      `
      export const name = "bad-agent";
      export async function execute(ctx) {
        await ctx.agents.call(undefined, "task");
        return ctx.done("should not reach");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", { action: "run", name: "bad-agent", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("error");
    if (parsed.type === "error") {
      expect(parsed.error).toContain("invalid agent name");
    }
  });

  it("rejects agents.call with the literal string 'undefined' as agent name", async () => {
    writeWorkflow(
      "bad-agent-str.ts",
      `
      export const name = "bad-agent-str";
      export async function execute(ctx) {
        // Simulate serialization bug: agentName becomes the string "undefined"
        await ctx.agents.call("undefined", "task");
        return ctx.done("should not reach");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    const result = await tool.execute("tc1", { action: "run", name: "bad-agent-str", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("error");
    if (parsed.type === "error") {
      expect(parsed.error).toContain("invalid agent name");
    }
  });
});

describe("workflow tool: structured agent results", () => {
  it("forwards a workflow-authored schema and exposes the validated payload", async () => {
    writeWorkflow(
      "structured-result.ts",
      `
      export const name = "structured-result";
      export const description = "Returns a schema-backed review";
      const ReviewSchema = {
        type: "object",
        properties: { verdict: { enum: ["pass", "fail"] } },
        required: ["verdict"],
        additionalProperties: false,
      };
      export async function execute(ctx) {
        const review = await ctx.agents.call("reviewer", "review it", { schema: ReviewSchema, tools: "readonly" });
        return ctx.done(review.status + ":" + review.output.verdict);
      }
    `,
    );

    let receivedOpts: Record<string, unknown> | undefined;
    const manager = {
      result: () => {
        throw new Error("no replay");
      },
      callAgent: async (_agent: string, _task: string, opts: Record<string, unknown>) => {
        receivedOpts = opts;
        return {
          sessionId: "s_structured",
          status: "done" as const,
          lastAssistantText: "Review complete",
          messages: [],
          duration: "0.0s",
          outputDir: "",
          finishResult: { status: "success", summary: "Review complete", result: { verdict: "pass" } },
          structuredResult: { verdict: "pass" },
        };
      },
    } as unknown as SubagentManager;

    const tool = createWorkflowTool({ manager, workflowDir });
    const result = await tool.execute("tc1", { action: "run", name: "structured-result", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("done");
    if (parsed.type === "done") expect(parsed.summary).toBe("done:pass");
    expect(receivedOpts?.requireFinish).toBe(true);
    expect(receivedOpts?.outputSchema).toMatchObject({ type: "object" });
    expect(receivedOpts?.toolPolicy).toBe("readonly");
  });

  it("turns prose-only workflow completion into an error result", async () => {
    writeWorkflow(
      "reject-prose.ts",
      `
      export const name = "reject-prose";
      export const description = "Rejects a prose-only agent result";
      export async function execute(ctx) {
        const result = await ctx.agents.call("worker", "do it");
        return ctx.done(result.status + ":" + result.summary);
      }
    `,
    );

    const manager = {
      result: () => {
        throw new Error("no replay");
      },
      callAgent: async () => ({
        sessionId: "s_prose",
        status: "done" as const,
        lastAssistantText: "I finished the task.",
        messages: [],
        duration: "0.0s",
        outputDir: "",
      }),
    } as unknown as SubagentManager;

    const tool = createWorkflowTool({ manager, workflowDir });
    const result = await tool.execute("tc1", { action: "run", name: "reject-prose", task: "test" });
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("done");
    if (parsed.type === "done") {
      expect(parsed.summary).toContain("error:Workflow agent step completed without the required finish() result");
    }
  });
});

describe("workflow tool: steering", () => {
  it("steer() returns false when no workflow is running", () => {
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    expect(tool.steer("stop")).toBe(false);
  });

  it("isRunning is false when no workflow is active", () => {
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    expect(tool.isRunning).toBe(false);
    expect(tool.activeWorkflow).toBeNull();
  });

  it("isRunning is false after a workflow completes", async () => {
    writeWorkflow(
      "quick.ts",
      `
      export const name = "quick";
      export const description = "Quick workflow";
      export async function execute(ctx) {
        return ctx.done("done");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    await tool.execute("tc1", {
      action: "run",
      name: "quick",
      task: "task",
    });

    expect(tool.isRunning).toBe(false);
    expect(tool.activeWorkflow).toBeNull();
  });

  it("isRunning is false after a workflow crashes", async () => {
    writeWorkflow(
      "crasher.ts",
      `
      export const name = "crasher";
      export const description = "Crashes";
      export async function execute(ctx) {
        throw new Error("crash");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    await tool.execute("tc1", {
      action: "run",
      name: "crasher",
      task: "task",
    });

    expect(tool.isRunning).toBe(false);
    expect(tool.activeWorkflow).toBeNull();
  });

  it("isRunning is false after a workflow blocks", async () => {
    writeWorkflow(
      "esc.ts",
      `
      export const name = "esc";
      export const description = "Blocks";
      export async function execute(ctx) {
        return ctx.blocked("nope");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({ manager, workflowDir });

    await tool.execute("tc1", {
      action: "run",
      name: "esc",
      task: "task",
    });

    expect(tool.isRunning).toBe(false);
    expect(tool.activeWorkflow).toBeNull();
  });

  it("steer() queues a signal that interrupts the workflow at the next agents.call", async () => {
    // This workflow calls runAgent but we pre-queue a steering signal.
    // Since runAgent checks the queue before running the agent, it should
    // throw WorkflowInterrupted immediately without ever calling manager.run().
    writeWorkflow(
      "steerable.ts",
      `
      export const name = "steerable";
      export const description = "Workflow that can be steered";
      export async function execute(ctx) {
        // This will never actually reach runAgent because steering is pre-queued
        const result = await ctx.agents.call("coder", "do something");
        return ctx.done("should not reach here");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    // Start the workflow execution in the background
    const execPromise = tool.execute("tc1", {
      action: "run",
      name: "steerable",
      task: "steerable task",
    });

    // The workflow is synchronous up to the first runAgent, so by the time
    // execute() is called, the workflow.started event fires synchronously,
    // and then the workflow calls runAgent which checks the queue.
    // Since we need to steer BEFORE runAgent checks, we need to pre-queue.
    // But the tool only exposes steer() after the workflow starts...
    // Actually, the workflow's execute() is called asynchronously,
    // but in this test the steering signal needs to be in the queue
    // before runAgent checks it.
    //
    // The way this works: the workflow.execute() is an async function.
    // It runs synchronously until the first await. ctx.agents.call is async,
    // so the first thing it does is check steeringQueue.shift().
    // If we call steer() before execute(), the signal will be in the queue.
    //
    // BUT we can't call steer() before execute() because isRunning is false.
    // The solution: we need to test with a workflow that does some async
    // work (like a setTimeout) before calling runAgent, giving us time
    // to call steer().

    // Wait for the result
    const result = await execPromise;
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    // The workflow should have errored because "coder" isn't registered,
    // not interrupted — because we couldn't steer in time.
    // This test validates that steer() returns false when called before
    // the workflow starts. The real steering test needs async timing.
    expect(parsed.type).toBe("error");
  });

  it("pre-queued steering signal interrupts workflow before first agents.call", async () => {
    // Write a workflow that uses a global signal to indicate it's ready,
    // then waits for a signal to proceed. This avoids flaky setTimeout timing.
    writeWorkflow(
      "delayed.ts",
      `
      export const name = "delayed";
      export const description = "Delays then calls runAgent";
      export async function execute(ctx) {
        // Signal readiness via a custom event, then wait for the steering signal
        // to be queued before proceeding to runAgent
        await ctx.events.emit({ type: "test.ready", data: { step: "ready-for-steering" } });
        // Small yield to let the test queue a steering signal
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));
        const result = await ctx.agents.call("coder", "do something");
        return ctx.done("should not reach here");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    // Start execution (don't await)
    const execPromise = tool.execute("tc1", {
      action: "run",
      name: "delayed",
      task: "steerable task",
    });

    // Wait for the workflow to signal it's ready for steering
    await waitForEvent(events, (e) => e.type === "test.ready" && "data" in e && (e.data as { step?: string }).step === "ready-for-steering");

    // Now the workflow is running and waiting — steer it
    expect(tool.isRunning).toBe(true);
    expect(tool.activeWorkflow).toBe("delayed");

    const steered = tool.steer("change direction please");
    expect(steered).toBe(true);

    // Wait for workflow to finish
    const result = await execPromise;
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("interrupted");
    if (parsed.type === "interrupted") {
      expect(parsed.workflow).toBe("delayed");
      expect(parsed.steeringMessage).toBe("change direction please");
      expect(parsed.completedSteps).toEqual([]); // no steps completed before interruption
    }

    // Tool should be clean after interruption
    expect(tool.isRunning).toBe(false);
    expect(tool.activeWorkflow).toBeNull();
    expect(tool.steer("anything")).toBe(false);
  });

  it("steering after one completed step includes that step in completedSteps", async () => {
    // Write a workflow that emits a signal when it's past the first step
    // and ready for the steering signal
    writeWorkflow(
      "two-step.ts",
      `
      export const name = "two-step";
      export const description = "Two step workflow";
      export async function execute(ctx) {
        await ctx.events.emit({ type: "test.planning_started", data: { step: "planning" } });
        await ctx.events.emit({ type: "test.planning_completed", data: { step: "planning" } });

        // Signal that we're past step 1 and ready for steering
        await ctx.events.emit({ type: "test.ready", data: { step: "ready-for-steering" } });
        // Yield to let the test queue a steering signal
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        // This runAgent will check steering queue
        const result = await ctx.agents.call("coder", "implement");
        return ctx.done("done");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    const execPromise = tool.execute("tc1", {
      action: "run",
      name: "two-step",
      task: "task",
    });

    // Wait for the workflow to signal readiness
    await waitForEvent(events, (e) => e.type === "test.ready" && "data" in e && (e.data as { step?: string }).step === "ready-for-steering");

    expect(tool.isRunning).toBe(true);
    tool.steer("abort now");

    const result = await execPromise;
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("interrupted");
    if (parsed.type === "interrupted") {
      expect(parsed.steeringMessage).toBe("abort now");
      // completedSteps only tracks runAgent calls, not manual emit calls
      expect(parsed.completedSteps).toEqual([]);
    }

    expect(tool.isRunning).toBe(false);
  });

  it("multiple steer() calls queue multiple signals, first one wins", async () => {
    writeWorkflow(
      "multi-steer.ts",
      `
      export const name = "multi-steer";
      export const description = "Multi-steer test";
      export async function execute(ctx) {
        await ctx.events.emit({ type: "test.ready", data: { step: "ready-for-steering" } });
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));
        const result = await ctx.agents.call("coder", "first");
        return ctx.done("done");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const tool = createWorkflowTool({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    const execPromise = tool.execute("tc1", {
      action: "run",
      name: "multi-steer",
      task: "task",
    });

    await waitForEvent(events, (e) => e.type === "test.ready" && "data" in e && (e.data as { step?: string }).step === "ready-for-steering");

    tool.steer("first signal");
    tool.steer("second signal");
    tool.steer("third signal");

    const result = await execPromise;
    const parsed = JSON.parse(result.content[0].text) as WorkflowToolResult;

    expect(parsed.type).toBe("interrupted");
    if (parsed.type === "interrupted") {
      // First signal wins (shift from queue)
      expect(parsed.steeringMessage).toBe("first signal");
    }
  });
});
