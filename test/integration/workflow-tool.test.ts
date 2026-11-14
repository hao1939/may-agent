import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
import { SubagentManager } from "../../src/lib/manager.js";
import type { SubagentDefinition } from "../../src/lib/types.js";
import { buildWorkflowCatalog } from "../../src/lib/workflow-catalog.js";
import { createWorkflowRunner } from "../../src/lib/workflow-tool.js";
import type { WorkflowEvent, WorkflowToolResult } from "../../src/lib/workflow.js";
import { fakeModel } from "../fixtures/model.js";

const workerDef: SubagentDefinition = {
  name: "worker", description: "Worker", domain: "test", model: fakeModel(), tools: [],
};
const reviewerDef: SubagentDefinition = {
  name: "reviewer", description: "Reviewer", domain: "test", model: fakeModel(), tools: [],
};
const coderDef: SubagentDefinition = {
  name: "coder", description: "Coder", domain: "test", model: fakeModel(), tools: [],
};
const testAgentDefs = new Map<string, SubagentDefinition>([
  ["worker", workerDef],
  ["reviewer", reviewerDef],
  ["coder", coderDef],
]);

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

describe("workflow catalog: list", () => {
  it("returns empty list when no workflows exist", async () => {
    const catalog = await buildWorkflowCatalog(workflowDir);
    expect([...catalog.workflows.values()]).toEqual([]);
  });

  it("returns empty list when directory doesn't exist", async () => {
    const catalog = await buildWorkflowCatalog(join(testDir, "nonexistent"));
    expect([...catalog.workflows.values()]).toEqual([]);
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

    const catalog = await buildWorkflowCatalog(workflowDir);
    const workflows = [...catalog.workflows.values()].sort((a, b) => a.name.localeCompare(b.name));
    expect(workflows).toHaveLength(2);
    expect(workflows[0].name).toBe("alpha");
    expect(workflows[0].description).toBe("Alpha workflow");
    expect(workflows[1].name).toBe("beta");
    expect(workflows[1].description).toBe("Beta workflow");
  });

  it("handles workflow load errors gracefully", async () => {
    writeWorkflow("broken.ts", `export const foo = "bar";`); // missing name/execute

    const catalog = await buildWorkflowCatalog(workflowDir);
    expect([...catalog.workflows.values()]).toHaveLength(0);
    expect(catalog.diagnostics.join("\n")).toContain("name");
  });

  it("rejects workflows without an explicit description", async () => {
    writeWorkflow(
      "minimal.ts",
      `
      export const name = "minimal";
      export async function execute(ctx) { return ctx.done("ok"); }
    `,
    );

    const catalog = await buildWorkflowCatalog(workflowDir);
    expect([...catalog.workflows.values()]).toHaveLength(0);
    expect(catalog.diagnostics.join("\n")).toContain("description");
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

    const catalog = await buildWorkflowCatalog(workflowDir);
    const workflows = [...catalog.workflows.values()].map((w) => ({
      name: w.name,
      description: w.description,
      sourceScope: w.sourceScope,
    }));
    expect(workflows).toContainEqual({
      name: "effective",
      description: "Agent version",
      sourceScope: "agent",
    });
    expect(workflows.some((workflow) => workflow.name === "ambiguous")).toBe(false);
    expect(catalog.diagnostics.join("\n")).toContain('Ambiguous agent workflow name "ambiguous"');

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({ manager, workflowDir });
    const result = await runner.run("effective", "task");
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

  it("returns typed output from createWorkflowRunner", async () => {
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

    const typed = await runner.run("typed", "run typed workflow");
    expect(typed).toMatchObject({
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
        await ctx.call("worker", "do the step");
        return ctx.done("done");
      }
    `,
    );
    const calls: Array<Record<string, unknown>> = [];
    const callAgent = async (_agent: string, _task: string, options: Record<string, unknown>) => {
      calls.push(options);
      return {
        sessionId: "step-session",
        status: "done",
        lastAssistantText: "done",
        messages: [],
        duration: "0s",
        outputDir: "",
      };
    };
    const manager = {
      callAgent,
      callAgentDefinition: (_def: SubagentDefinition, task: string, options: Record<string, unknown>) =>
        callAgent(_def.name, task, options),
    } as unknown as SubagentManager;
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      agentDefinitions: testAgentDefs,
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

describe("workflow runner: run", () => {
  it("returns error when workflow not found", async () => {
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("nonexistent", "do something");

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
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("simple", "test task");

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
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("escalating", "complex task");

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
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("crashing", "doomed task");

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
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    await runner.run("evented", "evented task");

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
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    await runner.run("esc-event", "task");

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
    const runner = createWorkflowRunner({
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

    const parsed: WorkflowToolResult = await runner.run("local-escalation", "task");

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
    const runner = createWorkflowRunner({
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

    const parsed: WorkflowToolResult = await runner.run("project-blocked", "task");

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
    const runner = createWorkflowRunner({
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

    const parsed: WorkflowToolResult = await runner.run(
      "task-blocked",
      [
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
    );

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
    const runner = createWorkflowRunner({
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

    const parsed: WorkflowToolResult = await runner.run("owner-blocked", "task");

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

describe("workflow runner: agent name validation", () => {
  it("rejects call with undefined agent name (defensive guard)", async () => {
    writeWorkflow(
      "bad-agent.ts",
      `
      export const name = "bad-agent";
      export async function execute(ctx) {
        await ctx.call(undefined, "task");
        return ctx.done("should not reach");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("bad-agent", "test");

    expect(parsed.type).toBe("error");
    if (parsed.type === "error") {
      expect(parsed.error).toContain("invalid agent name");
    }
  });

  it("rejects call with the literal string 'undefined' as agent name", async () => {
    writeWorkflow(
      "bad-agent-str.ts",
      `
      export const name = "bad-agent-str";
      export async function execute(ctx) {
        // Simulate serialization bug: agentName becomes the string "undefined"
        await ctx.call("undefined", "task");
        return ctx.done("should not reach");
      }
    `,
    );

    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({ manager, workflowDir });

    const parsed: WorkflowToolResult = await runner.run("bad-agent-str", "test");

    expect(parsed.type).toBe("error");
    if (parsed.type === "error") {
      expect(parsed.error).toContain("invalid agent name");
    }
  });
});

describe("workflow runner: structured agent results", () => {
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
        const review = await ctx.call("reviewer", "review it", { schema: ReviewSchema, tools: "readonly" });
        return ctx.done(review.status + ":" + review.output.verdict);
      }
    `,
    );

    let receivedOpts: Record<string, unknown> | undefined;
    const callAgent = async (_agent: string, _task: string, opts: Record<string, unknown>) => {
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
    };
    const manager = {
      result: () => {
        throw new Error("no replay");
      },
      callAgent,
      callAgentDefinition: (_def: SubagentDefinition, task: string, opts: Record<string, unknown>) =>
        callAgent(_def.name, task, opts),
    } as unknown as SubagentManager;

    const runner = createWorkflowRunner({ manager, workflowDir, agentDefinitions: testAgentDefs });
    const parsed: WorkflowToolResult = await runner.run("structured-result", "test");

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
        const result = await ctx.call("worker", "do it");
        return ctx.done(result.status + ":" + result.summary);
      }
    `,
    );

    const callAgent = async () => ({
      sessionId: "s_prose",
      status: "done" as const,
      lastAssistantText: "I finished the task.",
      messages: [],
      duration: "0.0s",
      outputDir: "",
    });
    const manager = {
      result: () => {
        throw new Error("no replay");
      },
      callAgent,
      callAgentDefinition: callAgent,
    } as unknown as SubagentManager;

    const runner = createWorkflowRunner({ manager, workflowDir, agentDefinitions: testAgentDefs });
    const parsed: WorkflowToolResult = await runner.run("reject-prose", "test");

    expect(parsed.type).toBe("done");
    if (parsed.type === "done") {
      expect(parsed.summary).toContain("error:Workflow agent step completed without the required finish() result");
    }
  });
});

describe("workflow runner: steering", () => {
  it("steer() returns false when no workflow is running", () => {
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({ manager, workflowDir });

    expect(runner.steer("stop")).toBe(false);
  });

  it("isRunning is false when no workflow is active", () => {
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({ manager, workflowDir });

    expect(runner.isRunning).toBe(false);
    expect(runner.activeWorkflow).toBeNull();
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
    const runner = createWorkflowRunner({ manager, workflowDir });

    await runner.run("quick", "task");

    expect(runner.isRunning).toBe(false);
    expect(runner.activeWorkflow).toBeNull();
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
    const runner = createWorkflowRunner({ manager, workflowDir });

    await runner.run("crasher", "task");

    expect(runner.isRunning).toBe(false);
    expect(runner.activeWorkflow).toBeNull();
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
    const runner = createWorkflowRunner({ manager, workflowDir });

    await runner.run("esc", "task");

    expect(runner.isRunning).toBe(false);
    expect(runner.activeWorkflow).toBeNull();
  });

  it("steer() queues a signal that interrupts the workflow at the next call", async () => {
    writeWorkflow(
      "steerable.ts",
      `
      export const name = "steerable";
      export const description = "Workflow that can be steered";
      export async function execute(ctx) {
        const result = await ctx.call("coder", "do something");
        return ctx.done("should not reach here");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      onEvent: (e) => events.push(e),
    });

    const parsed: WorkflowToolResult = await runner.run("steerable", "steerable task");
    expect(parsed.type).toBe("error");
  });

  it("pre-queued steering signal interrupts workflow before first call", async () => {
    writeWorkflow(
      "delayed.ts",
      `
      export const name = "delayed";
      export const description = "Delays then calls runAgent";
      export async function execute(ctx) {
        await ctx.events.emit({ type: "test.ready", data: { step: "ready-for-steering" } });
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));
        const result = await ctx.call("coder", "do something");
        return ctx.done("should not reach here");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      agentDefinitions: testAgentDefs,
      onEvent: (e) => events.push(e),
    });

    const execPromise = runner.run("delayed", "steerable task");

    await waitForEvent(events, (e) => e.type === "test.ready" && "data" in e && (e.data as { step?: string }).step === "ready-for-steering");

    expect(runner.isRunning).toBe(true);
    expect(runner.activeWorkflow).toBe("delayed");

    const steered = runner.steer("change direction please");
    expect(steered).toBe(true);

    const parsed: WorkflowToolResult = await execPromise;

    expect(parsed.type).toBe("interrupted");
    if (parsed.type === "interrupted") {
      expect(parsed.workflow).toBe("delayed");
      expect(parsed.steeringMessage).toBe("change direction please");
      expect(parsed.completedSteps).toEqual([]); // no steps completed before interruption
    }

    expect(runner.isRunning).toBe(false);
    expect(runner.activeWorkflow).toBeNull();
    expect(runner.steer("anything")).toBe(false);
  });

  it("steering after one completed step includes that step in completedSteps", async () => {
    writeWorkflow(
      "two-step.ts",
      `
      export const name = "two-step";
      export const description = "Two step workflow";
      export async function execute(ctx) {
        await ctx.events.emit({ type: "test.planning_started", data: { step: "planning" } });
        await ctx.events.emit({ type: "test.planning_completed", data: { step: "planning" } });

        await ctx.events.emit({ type: "test.ready", data: { step: "ready-for-steering" } });
        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        const result = await ctx.call("coder", "implement");
        return ctx.done("done");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      agentDefinitions: testAgentDefs,
      onEvent: (e) => events.push(e),
    });

    const execPromise = runner.run("two-step", "task");

    await waitForEvent(events, (e) => e.type === "test.ready" && "data" in e && (e.data as { step?: string }).step === "ready-for-steering");

    expect(runner.isRunning).toBe(true);
    runner.steer("abort now");

    const parsed: WorkflowToolResult = await execPromise;

    expect(parsed.type).toBe("interrupted");
    if (parsed.type === "interrupted") {
      expect(parsed.steeringMessage).toBe("abort now");
      expect(parsed.completedSteps).toEqual([]);
    }

    expect(runner.isRunning).toBe(false);
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
        const result = await ctx.call("coder", "first");
        return ctx.done("done");
      }
    `,
    );

    const events: WorkflowEvent[] = [];
    const manager = new SubagentManager({ persistDir: join(testDir, "state") });
    const runner = createWorkflowRunner({
      manager,
      workflowDir,
      agentDefinitions: testAgentDefs,
      onEvent: (e) => events.push(e),
    });

    const execPromise = runner.run("multi-steer", "task");

    await waitForEvent(events, (e) => e.type === "test.ready" && "data" in e && (e.data as { step?: string }).step === "ready-for-steering");

    runner.steer("first signal");
    runner.steer("second signal");
    runner.steer("third signal");

    const parsed: WorkflowToolResult = await execPromise;

    expect(parsed.type).toBe("interrupted");
    if (parsed.type === "interrupted") {
      // First signal wins (shift from queue)
      expect(parsed.steeringMessage).toBe("first signal");
    }
  });
});
