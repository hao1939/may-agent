import { AppTaskResourceStore } from "../../core/state/app-task-resource-store.js";
import { getDb } from "../../../lib/db/connection.js";
import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskWorkflowRunner } from "./workflow.js";
import { EventBus } from "../../core/events/bus.js";
import type { TaskWorkflowInput } from "../../core/tasks/execution.js";
import { closeDb } from "../../../lib/db/connection.js";
import { getWorkflowRun } from "../../../lib/db/workflows.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

it.each(["error", "interrupted"] as const)("retains the %s run reference without changing Task failure recovery", async (status) => {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-failure-"));
  roots.push(root);
  const workflowDir = join(root, "owner", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(workflowDir, "review.ts"), `
export const name = "review";
export const description = "Unfinished contribution with retained evidence";
export async function execute(ctx) {
  return { ...ctx.done("Inspection stopped"), status: ${JSON.stringify(status)},
    output: { report: "partial.md" }, facts: { inspected: true } };
}`);
  AppTaskResourceStore.fromDb(getDb(root), "fixture").bootstrapSnapshot(
    {
      project: "fixture",
      resources: {
        review: {
          metadata: { id: "review", generation: 1, resourceVersion: 1 },
          spec: { parentId: "root", outcome: "Review", acceptance: ["Done"] },
          status: { phase: "running", observedGeneration: 0, currentAttemptId: "attempt" },
        },
      },
      attempts: {
        attempt: {
          metadata: { id: "attempt", resourceVersion: 1 },
          taskId: "review",
          taskGeneration: 1,
          specHash: "hash",
          owner: "owner",
          handler: "workflow:review",
          runtimeId: "rt",
          state: "running",
          reason: "event",
          startedAt: new Date().toISOString(),
        },
      },
    },
    "fixture",
  );
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: new EventBus() });
  const result = await runner.execute({
    source: { projectsRoot: root, projectRoot: root, persistDir: root, agentsRoot: root, sharedRoot: join(root, "shared") },
    descriptor: { id: "fixture", appDir: join(root, "sample.app"), projectDir: root, app: {} },
    capability: { workflow: "review", task: "Review the candidate" }, handler: "workflow:review",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    childContext: { live: [], completed: [] }, taskSnapshot: { live: [], truncated: false },
    taskEvents: {}, executionTimeoutMs: 1000,
    attempt: {
      read: { tasks: {} },
      task: { id: "review", generation: 1, outcome: "Review", acceptance: [], input: {} },
      attemptId: "attempt", role: { agent: "owner" }, resourceVersion: 1,
      events: { items: [], truncated: false }, waits: [], children: [], declaredOutputPaths: [],
      signal: new AbortController().signal, onEvent: () => () => {},
    },
  } as unknown as TaskWorkflowInput);
  expect(result.executionFailed).toBe(true);
  expect(result.handlerResult).toMatchObject({ state: "error", facts: [`workflow-run:${result.runId}`] });
  expect(result.runId).toBeTruthy();
  expect(getWorkflowRun(root, result.runId!)?.result_payload).toMatchObject({
    kind: "result", state: "available", value: { output: { report: "partial.md" }, facts: { inspected: true } },
  });
});

it("retains blocked workflow output, facts, and context through Host settlement", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-blocked-"));
  roots.push(root);
  const workflowDir = join(root, "owner", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(workflowDir, "review.ts"), `
export const name = "review";
export const description = "Blocked contribution with checkpoint";
export async function execute(ctx) {
  const evidence = Array.from({ length: 32 }, (_, index) => "fact-" + (index + 1));
  return { ...ctx.blocked("Await reviewer", evidence), output: false };
}`);
  AppTaskResourceStore.fromDb(getDb(root), "fixture").bootstrapSnapshot(
    {
      project: "fixture",
      resources: {
        review: {
          metadata: { id: "review", generation: 1, resourceVersion: 1 },
          spec: { parentId: "root", outcome: "Review", acceptance: ["Done"] },
          status: { phase: "running", observedGeneration: 0, currentAttemptId: "attempt-blocked" },
        },
      },
      attempts: {
        "attempt-blocked": {
          metadata: { id: "attempt-blocked", resourceVersion: 1 },
          taskId: "review", taskGeneration: 1, specHash: "hash", owner: "owner",
          handler: "workflow:review", runtimeId: "rt", state: "running", reason: "event",
          startedAt: new Date().toISOString(),
        },
      },
    },
    "fixture",
  );
  let policyInput: { summary: string; output?: unknown; facts?: unknown } | undefined;
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: new EventBus() });
  const result = await runner.execute({
    source: { projectsRoot: root, projectRoot: root, persistDir: root, agentsRoot: root, sharedRoot: join(root, "shared") },
    descriptor: {
      id: "fixture",
      appDir: join(root, "sample.app"),
      projectDir: root,
      app: {
        tasks: {
          translateBlockedResult: ({ summary, output, facts }) => {
            policyInput = { summary, output, facts };
            return null;
          },
        },
      },
    },
    capability: { workflow: "review", task: "Review the candidate" }, handler: "workflow:review",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    childContext: { live: [], completed: [] }, taskSnapshot: { live: [], truncated: false },
    taskEvents: {}, executionTimeoutMs: 1000,
    attempt: {
      read: { tasks: {} }, task: { id: "review", generation: 1, outcome: "Review", acceptance: [], input: {} },
      attemptId: "attempt-blocked", role: { agent: "owner" }, resourceVersion: 1,
      events: { items: [], truncated: false }, waits: [], children: [], declaredOutputPaths: [],
      signal: new AbortController().signal, onEvent: () => () => {},
    },
  } as unknown as TaskWorkflowInput);
  const evidence = Array.from({ length: 32 }, (_, index) => `fact-${index + 1}`);
  expect(policyInput).toEqual({
    summary: "Await reviewer",
    output: false,
    facts: evidence,
  });
  expect(result).toMatchObject({
    handlerBlocked: true,
    handlerResult: {
      state: "waiting",
      summary: "Await reviewer",
      result: { value: false },
      facts: [
        `execution-facts:${JSON.stringify(evidence)}`,
        `workflow-blocker-context:${JSON.stringify(evidence)}`,
      ],
    },
  });
  expect(result.handlerResult.facts).toHaveLength(2);
});

it.each(["report", "continue"] as const)(
  "rejects App %s: true when workflow blocked facts are an empty array despite diagnostic context",
  async (control) => {
    const root = mkdtempSync(join(tmpdir(), `task-workflow-empty-facts-${control}-`));
    roots.push(root);
    const workflowDir = join(root, "owner", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "empty-facts.ts"),
      `export const name = "empty-facts";
export const description = "Blocked without domain progress facts";
export async function execute(ctx) {
  return ctx.blocked("No progress", []);
}`,
    );
    AppTaskResourceStore.fromDb(getDb(root), "fixture").bootstrapSnapshot(
      {
        project: "fixture",
        resources: {
          review: {
            metadata: { id: "review", generation: 1, resourceVersion: 1 },
            spec: { parentId: "root", outcome: "Review", acceptance: ["Done"] },
            status: { phase: "running", observedGeneration: 0, currentAttemptId: "attempt-empty" },
          },
        },
        attempts: {
          "attempt-empty": {
            metadata: { id: "attempt-empty", resourceVersion: 1 },
            taskId: "review",
            taskGeneration: 1,
            specHash: "hash",
            owner: "owner",
            handler: "workflow:empty-facts",
            runtimeId: "rt",
            state: "running",
            reason: "event",
            startedAt: new Date().toISOString(),
          },
        },
      },
      "fixture",
    );
    const runner = createTaskWorkflowRunner({ manager: {} as never, bus: new EventBus() });
    const result = await runner.execute({
      source: { projectsRoot: root, projectRoot: root, persistDir: root, agentsRoot: root, sharedRoot: join(root, "shared") },
      descriptor: {
        id: "fixture",
        appDir: join(root, "sample.app"),
        projectDir: root,
        app: {
          tasks: {
            translateBlockedResult: () => (control === "report" ? { report: true } : { continue: true }),
          },
        },
      },
      capability: { workflow: "empty-facts", task: "Review the candidate" },
      handler: "workflow:empty-facts",
      executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
      childContext: { live: [], completed: [] },
      taskSnapshot: { live: [], truncated: false },
      taskEvents: {},
      executionTimeoutMs: 1000,
      attempt: {
        read: { tasks: {} },
        task: { id: "review", generation: 1, outcome: "Review", acceptance: [], input: {} },
        attemptId: "attempt-empty",
        role: { agent: "owner" },
        resourceVersion: 1,
        events: { items: [], truncated: false },
        waits: [],
        children: [],
        declaredOutputPaths: [],
        signal: new AbortController().signal,
        onEvent: () => () => {},
      },
    } as unknown as TaskWorkflowInput);
    expect(result).toMatchObject({
      handlerBlocked: true,
      handlerResult: {
        state: "error",
        resultRejected: true,
        summary: expect.stringContaining(
          control === "report"
            ? "report requires waiting or incomplete, true, and non-empty facts"
            : "continue requires waiting and progress facts",
        ),
      },
    });
  },
);

it("bounds oversized blocked workflow contribution facts while passing full facts to App policy", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-oversized-facts-"));
  roots.push(root);
  const workflowDir = join(root, "owner", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    join(workflowDir, "oversized.ts"),
    `export const name = "oversized";
export const description = "Blocked contribution with >8KiB facts";
export async function execute(ctx) {
  return ctx.blocked("Await large artifact review", { payload: "x".repeat(9000) });
}`,
  );
  AppTaskResourceStore.fromDb(getDb(root), "fixture").bootstrapSnapshot(
    {
      project: "fixture",
      resources: {
        review: {
          metadata: { id: "review", generation: 1, resourceVersion: 1 },
          spec: { parentId: "root", outcome: "Review", acceptance: ["Done"] },
          status: { phase: "running", observedGeneration: 0, currentAttemptId: "attempt-oversized" },
        },
      },
      attempts: {
        "attempt-oversized": {
          metadata: { id: "attempt-oversized", resourceVersion: 1 },
          taskId: "review",
          taskGeneration: 1,
          specHash: "hash",
          owner: "owner",
          handler: "workflow:oversized",
          runtimeId: "rt",
          state: "running",
          reason: "event",
          startedAt: new Date().toISOString(),
        },
      },
    },
    "fixture",
  );
  let observedFacts: unknown;
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: new EventBus() });
  const result = await runner.execute({
    source: { projectsRoot: root, projectRoot: root, persistDir: root, agentsRoot: root, sharedRoot: join(root, "shared") },
    descriptor: {
      id: "fixture",
      appDir: join(root, "sample.app"),
      projectDir: root,
      app: {
        tasks: {
          translateBlockedResult: ({ facts }) => {
            observedFacts = facts;
            return { continue: true };
          },
        },
      },
    },
    capability: { workflow: "oversized", task: "Review the candidate" },
    handler: "workflow:oversized",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    childContext: { live: [], completed: [] },
    taskSnapshot: { live: [], truncated: false },
    taskEvents: {},
    executionTimeoutMs: 1000,
    attempt: {
      read: { tasks: {} },
      task: { id: "review", generation: 1, outcome: "Review", acceptance: [], input: {} },
      attemptId: "attempt-oversized",
      role: { agent: "owner" },
      resourceVersion: 1,
      events: { items: [], truncated: false },
      waits: [],
      children: [],
      declaredOutputPaths: [],
      signal: new AbortController().signal,
      onEvent: () => () => {},
    },
  } as unknown as TaskWorkflowInput);
  expect(observedFacts).toEqual({ payload: "x".repeat(9000) });
  expect(result.runId).toBeTruthy();
  expect(result).toMatchObject({
    handlerBlocked: true,
    handlerResult: {
      state: "waiting",
      continue: true,
      facts: [
        `execution-facts:see workflow-run:${result.runId} (exceeds 8192-byte Task facts bound)`,
        `workflow-blocker-context:see workflow-run:${result.runId} (exceeds 8192-byte Task facts bound)`,
      ],
    },
  });
  expect(getWorkflowRun(root, result.runId!)?.result_payload).toMatchObject({
    kind: "facts",
    state: "available",
    value: { payload: expect.stringContaining("xxxx") },
  });
});

it("inspects the current workflow definition without executing it", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-inspection-"));
  roots.push(root);
  mkdirSync(join(root, "owner", "workflows"), { recursive: true });
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: {} as never });
  const inspect = (agent = "owner") => runner.inspect({
    source: {
      projectsRoot: root,
      projectRoot: root,
      agentsRoot: root,
      persistDir: join(root, "state"),
      sharedRoot: join(root, "shared"),
    },
    appDir: join(root, "sample.app"),
    agent,
    workflow: "verify",
  });
  expect((await inspect()).available).toBeFalse();
  const path = join(root, "owner", "workflows", "verify.ts");
  writeFileSync(
    path,
    `export const name = "verify";
export const description = "Availability fixture";
export function execute() { throw new Error("Must not execute during lookup"); }`,
  );
  expect((await inspect()).available).toBeTrue();
  expect((await inspect("other")).available).toBeFalse();
  writeFileSync(path, 'export const name = "verify";');
  expect((await inspect()).available).toBeFalse();
});

it("includes carried-over continuedInputs under Assigned Attempt Input even when new items is empty", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-continued-"));
  roots.push(root);
  const workflowDir = join(root, "owner", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  let observedPrompt = "";
  writeFileSync(
    join(workflowDir, "check-input.ts"),
    `
export const name = "check-input";
export const description = "Reads legacy task string and reconciliation events";
export async function execute(ctx) {
  return ctx.done("checked", { state: "converged", summary: "checked", facts: [String(ctx.reconciliation?.events.continuedInputs?.length ?? 0)] });
}`,
  );
  AppTaskResourceStore.fromDb(getDb(root), "fixture").bootstrapSnapshot(
    {
      project: "fixture",
      resources: {
        review: {
          metadata: { id: "review", generation: 1, resourceVersion: 2 },
          spec: { parentId: "root", outcome: "Review", acceptance: ["Checked"] },
          status: { phase: "running", observedGeneration: 0, currentAttemptId: "attempt-continued" },
        },
      },
      attempts: {
        "attempt-continued": {
          metadata: { id: "attempt-continued", resourceVersion: 1 },
          taskId: "review",
          taskGeneration: 1,
          specHash: "hash",
          owner: "owner",
          handler: "workflow:check-input",
          runtimeId: "rt",
          state: "running",
          reason: "event",
          startedAt: new Date().toISOString(),
        },
      },
    },
    "fixture",
  );
  const bus = new EventBus();
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus });
  await runner.execute({
    source: { projectsRoot: root, projectRoot: root, persistDir: root, agentsRoot: root, sharedRoot: join(root, "shared") },
    descriptor: { id: "fixture", appDir: join(root, "sample.app"), projectDir: root, app: {} },
    capability: { workflow: "check-input", task: "Check carried input" },
    handler: "workflow:check-input",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    childContext: { live: [], completed: [] },
    taskSnapshot: { live: [], truncated: false },
    taskEvents: {},
    executionTimeoutMs: 5000,
    attempt: {
      read: { tasks: {} },
      task: {
        id: "review",
        generation: 1,
        status: "running",
        outcome: "Review",
        acceptance: ["Checked"],
        input: {},
        pendingEvents: { items: [], truncated: false },
      },
      attemptId: "attempt-continued",
      role: { agent: "owner" },
      resourceVersion: 2,
      events: {
        items: [],
        truncated: false,
        continuedInputs: [{ observedAt: "2026-11-12T00:00:00Z", event: { type: "app.input.requested", data: { id: "c1" } } }],
      },
      waits: { open: [], note: "none" },
      children: { live: [], completed: [] },
      declaredOutputPaths: [],
      signal: new AbortController().signal,
      onEvent: () => () => {},
    },
  } as unknown as TaskWorkflowInput);
  observedPrompt = getWorkflowRun(root, (await import("../../../lib/db/workflows.js")).listWorkflowRunIds(root)[0]!)!.task;
  expect(observedPrompt).toContain("## Assigned Attempt Input");
  expect(observedPrompt).toContain('"continuedInputs"');
});
