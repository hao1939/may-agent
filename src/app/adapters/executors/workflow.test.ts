import { AppTaskResourceStore } from "../../core/state/app-task-resource-store.js";
import { getDb } from "../../../lib/db/connection.js";
import { afterEach, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskWorkflowRunner } from "./workflow.js";
import { EventBus } from "../../core/events/bus.js";
import type { AppTaskBlockedSettlement } from "@may-agent/sdk/app";
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

async function executeBlockedWorkflow(
  body: string,
  translateBlockedResult: (input: { facts: unknown; output: unknown }) => AppTaskBlockedSettlement | null,
) {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-blocked-fixture-"));
  roots.push(root);
  const workflowDir = join(root, "owner", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(workflowDir, "review.ts"), `
export const name = "review";
export const description = "Blocked workflow fixture";
export async function execute(ctx) {
${body}
}`);
  AppTaskResourceStore.fromDb(getDb(root), "fixture").bootstrapSnapshot(
    {
      project: "fixture",
      resources: {
        review: {
          metadata: { id: "review", generation: 1, resourceVersion: 1 },
          spec: { parentId: "root", outcome: "Review", acceptance: ["Done"] },
          status: { phase: "running", observedGeneration: 0, currentAttemptId: "attempt-blocked-fixture" },
        },
      },
      attempts: {
        "attempt-blocked-fixture": {
          metadata: { id: "attempt-blocked-fixture", resourceVersion: 1 },
          taskId: "review", taskGeneration: 1, specHash: "hash", owner: "owner",
          handler: "workflow:review", runtimeId: "rt", state: "running", reason: "event",
          startedAt: new Date().toISOString(),
        },
      },
    },
    "fixture",
  );
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: new EventBus() });
  const result = await runner.execute({
    source: { projectsRoot: root, projectRoot: root, persistDir: root, agentsRoot: root, sharedRoot: join(root, "shared") },
    descriptor: { id: "fixture", appDir: join(root, "sample.app"), projectDir: root, app: { tasks: { translateBlockedResult } } },
    capability: { workflow: "review", task: "Review the candidate" }, handler: "workflow:review",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    childContext: { live: [], completed: [] }, taskSnapshot: { live: [], truncated: false },
    taskEvents: {}, executionTimeoutMs: 1000,
    attempt: {
      read: { tasks: {} }, task: { id: "review", generation: 1, outcome: "Review", acceptance: [], input: {} },
      attemptId: "attempt-blocked-fixture", role: { agent: "owner" }, resourceVersion: 1,
      events: { items: [], truncated: false }, waits: [], children: [], declaredOutputPaths: [],
      signal: new AbortController().signal, onEvent: () => () => {},
    },
  } as unknown as TaskWorkflowInput);
  return { root, result };
}

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
  let policyCalls = 0;
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
            policyCalls++;
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
  expect(policyCalls).toBe(1);
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
  expect(getWorkflowRun(root, result.runId!)?.result_payload).toMatchObject({
    kind: "result",
    state: "available",
    value: { output: false, facts: evidence },
  });
});

it.each([
  ["report", { report: true }],
  ["continue", { continue: true }],
  ["report and continue", { report: true, continue: true }],
] as const)("rejects an empty workflow fact array before diagnostics can support %s", async (_label, settlement) => {
  const { result } = await executeBlockedWorkflow(
    '  return ctx.blocked("No progress", []);',
    () => settlement,
  );
  expect(result).toMatchObject({
    handlerBlocked: true,
    handlerResult: {
      state: "error",
      resultRejected: true,
      summary: expect.stringContaining("Host diagnostics are not agent evidence"),
      facts: [`execution-run:${result.runId}`],
      actions: [],
    },
  });
});

it.each([
  ["exact boundary", ["x".repeat(8192)], false],
  ["one byte over", ["x".repeat(8193)], true],
  ["multibyte over", ["é".repeat(4097)], true],
  ["aggregate 32 strings", Array.from({ length: 32 }, () => "x".repeat(255)), true],
  ["large object", { evidence: "x".repeat(8192) }, true],
] as const)("bounds workflow contribution facts at the UTF-8 budget: %s", async (_label, facts, projected) => {
  const captured: Array<{ facts: unknown; output: unknown }> = [];
  const { root, result } = await executeBlockedWorkflow(
    `  return { ...ctx.blocked("Retain evidence", ${JSON.stringify(facts)}), output: false };`,
    ({ facts: originalFacts, output }) => {
      captured.push({ facts: originalFacts, output });
      return null;
    },
  );
  expect(captured).toEqual([{ facts, output: false }]);
  const stored = result.handlerResult.facts;
  expect(stored.every((fact) => Buffer.byteLength(fact, "utf8") < 8300)).toBeTrue();
  if (projected) {
    expect(stored).toContain(`workflow-contribution-facts:see workflow-run:${result.runId} (exceeds 8192-byte Task facts bound)`);
    expect(JSON.stringify(stored)).not.toContain("x".repeat(1000));
  } else {
    expect(stored).toContain((facts as readonly string[])[0]);
  }
  expect(stored).toContain(`workflow-blocker-context:see workflow-run:${result.runId} (exceeds 8192-byte Task facts bound)`);
  expect(getWorkflowRun(root, result.runId!)?.result_payload).toMatchObject({
    kind: "result",
    state: "available",
    value: { output: false, facts },
  });
});

it.each([
  ["oversized facts", '{ ...ctx.blocked("Retain evidence", { evidence: "x".repeat(70 * 1024) }), output: false }'],
  ["combined output and facts", '{ ...ctx.blocked("Retain evidence", { evidence: "x".repeat(9 * 1024) }), output: { report: "y".repeat(60 * 1024) } }'],
] as const)("rejects an unavailable workflow overflow projection: %s", async (_label, fields) => {
  let policyCalls = 0;
  const { root, result } = await executeBlockedWorkflow(
    `  return ${fields};`,
    () => { policyCalls++; return null; },
  );
  expect(policyCalls).toBe(0);
  expect(result.handlerResult).toMatchObject({
    state: "error",
    resultRejected: true,
    summary: expect.stringContaining("return a durable artifact reference"),
    facts: [`workflow-run:${result.runId}`],
    actions: [],
  });
  expect(getWorkflowRun(root, result.runId!)?.result_payload).toMatchObject({ state: "unavailable", reason: "too-large" });
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

it("parks on ctx.ask and retires the answered human.review Condition with expanded inputKeys on wake", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-workflow-ctx-ask-"));
  roots.push(root);
  const workflowDir = join(root, "owner", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(
    join(workflowDir, "ask-env.ts"),
    `
export const name = "ask-env";
export const description = "Parks on ctx.ask then converges with human reply";
export async function execute(ctx) {
  const answer = await ctx.ask({ id: "clarify-env", prompt: "Which env?" });
  return ctx.done(
    "Shipped",
    { attemptNumber: ctx.task.attemptNumber, env: answer.value },
    { facts: [\`attempt:\${ctx.task.attemptNumber}\`, \`env:\${answer.value}\`] },
  );
}`,
  );
  const store = AppTaskResourceStore.fromDb(getDb(root), "fixture");
  store.bootstrapSnapshot(
    {
      project: "fixture",
      resources: {
        ship: {
          metadata: { id: "ship", generation: 1, resourceVersion: 2 },
          spec: { parentId: "root", outcome: "Ship", acceptance: ["Verified"] },
          status: { phase: "running", observedGeneration: 0, currentAttemptId: "attempt-1" },
        },
      },
      attempts: {
        "attempt-1": {
          metadata: { id: "attempt-1", resourceVersion: 1 },
          taskId: "ship",
          taskGeneration: 1,
          specHash: "hash",
          owner: "owner",
          handler: "workflow:ask-env",
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
  const baseInput = {
    source: { projectsRoot: root, projectRoot: root, persistDir: root, agentsRoot: root, sharedRoot: join(root, "shared") },
    descriptor: { id: "fixture", appDir: join(root, "sample.app"), projectDir: root, app: {} },
    capability: { workflow: "ask-env", task: "Ship v1" },
    handler: "workflow:ask-env",
    executionPaths: { appDir: root, projectDir: root, workspaceDir: root },
    childContext: { live: [], completed: [] },
    taskSnapshot: { live: [], truncated: false },
    taskEvents: {},
    executionTimeoutMs: 5000,
  };

  // Attempt 1: parks on clarify-env
  const run1 = await runner.execute({
    ...baseInput,
    attempt: {
      read: { tasks: {} },
      task: {
        id: "ship",
        generation: 1,
        status: "running",
        outcome: "Ship",
        acceptance: ["Verified"],
        input: {},
        pendingEvents: { items: [], truncated: false },
      },
      attemptId: "attempt-1",
      role: { agent: "owner" },
      resourceVersion: 2,
      events: { items: [], truncated: false },
      waits: { open: [], note: "none" },
      children: { live: [], completed: [] },
      declaredOutputPaths: [],
      signal: new AbortController().signal,
      onEvent: () => () => {},
    },
  } as unknown as TaskWorkflowInput);
  expect(run1.handlerResult.state).toBe("waiting");
  if (run1.handlerResult.state === "waiting") {
    expect(run1.handlerResult.conditions).toMatchObject([
      { id: "clarify-env", type: "human.review", owner: "human", requestedAction: "Which env?" },
    ]);
  }

  // Persist Attempt 2 + parked inputWaits on a fresh state root as Host reconciler does
  const root2 = mkdtempSync(join(tmpdir(), "task-workflow-ctx-ask-2-"));
  roots.push(root2);
  const workflowDir2 = join(root2, "owner", "workflows");
  mkdirSync(workflowDir2, { recursive: true });
  writeFileSync(
    join(workflowDir2, "ask-env.ts"),
    `
export const name = "ask-env";
export const description = "Parks on ctx.ask then converges with human reply";
export async function execute(ctx) {
  const answer = await ctx.ask({ id: "clarify-env", prompt: "Which env?" });
  return ctx.done(
    "Shipped",
    { attemptNumber: ctx.task.attemptNumber, env: answer.value },
    { facts: [\`attempt:\${ctx.task.attemptNumber}\`, \`env:\${answer.value}\`] },
  );
}`,
  );
  AppTaskResourceStore.fromDb(getDb(root2), "fixture").bootstrapSnapshot(
    {
      project: "fixture",
      resources: {
        ship: {
          metadata: { id: "ship", generation: 1, resourceVersion: 4 },
          spec: { parentId: "root", outcome: "Ship", acceptance: ["Verified"] },
          status: {
            phase: "running",
            observedGeneration: 1,
            currentAttemptId: "attempt-2",
            conditionIds: ["clarify-env"],
            inputWaits: {
              "task:orig-1": { taskGeneration: 1, conditions: [{ id: "clarify-env", generation: 1 }] },
            },
          },
        },
      },
      attempts: {
        "attempt-1": {
          metadata: { id: "attempt-1", resourceVersion: 2 },
          taskId: "ship",
          taskGeneration: 1,
          specHash: "hash",
          owner: "owner",
          handler: "workflow:ask-env",
          runtimeId: "rt",
          state: "completed",
          reason: "event",
          startedAt: new Date().toISOString(),
        },
        "attempt-2": {
          metadata: { id: "attempt-2", resourceVersion: 1 },
          taskId: "ship",
          taskGeneration: 1,
          specHash: "hash",
          owner: "owner",
          handler: "workflow:ask-env",
          runtimeId: "rt",
          state: "running",
          reason: "event",
          startedAt: new Date().toISOString(),
        },
      },
    },
    "fixture",
  );

  const run2 = await runner.execute({
    ...baseInput,
    source: { projectsRoot: root2, projectRoot: root2, persistDir: root2, agentsRoot: root2, sharedRoot: join(root2, "shared") },
    descriptor: { id: "fixture", appDir: join(root2, "sample.app"), projectDir: root2, app: {} },
    executionPaths: { appDir: root2, projectDir: root2, workspaceDir: root2 },
    attempt: {
      read: { tasks: {} },
      task: {
        id: "ship",
        generation: 1,
        status: "running",
        outcome: "Ship",
        acceptance: ["Verified"],
        input: {},
        conditions: [{ id: "clarify-env", type: "human.review", subject: "workflow-ask:ship:clarify-env", owner: "human" }],
        pendingEvents: { items: [], truncated: false },
      },
      attemptId: "attempt-2",
      role: { agent: "owner" },
      resourceVersion: 4,
      events: {
        inputs: [
          {
            id: "reply-2",
            key: "task:reply-2",
            source: { kind: "human", id: "hao" },
          },
        ],
        items: [
          {
            observedAt: "2026-11-28T00:00:00Z",
            event: {
              type: "app.task.requested",
              source: "human",
              data: {
                idempotencyKey: "task:reply-2",
                request: {
                  id: "reply-2",
                  humanRequested: true,
                  source: { kind: "human", id: "hao" },
                  input: { kind: "message", data: { message: "prod-east" } },
                },
              },
            },
          },
        ],
        truncated: false,
      },
      waits: {
        open: [
          {
            conditionId: "clarify-env",
            conditionGeneration: 1,
            type: "human.review",
            subject: "workflow-ask:ship:clarify-env",
            state: "unknown",
          },
        ],
        note: "open",
      },
      children: { live: [], completed: [] },
      declaredOutputPaths: [],
      signal: new AbortController().signal,
      onEvent: () => () => {},
    },
  } as unknown as TaskWorkflowInput);

  expect(run2.hostCompletion).toBe("finite-done");
  expect(run2.handlerResult).toMatchObject({
    state: "converged",
    summary: "Shipped",
    result: { attemptNumber: 2, env: "prod-east" },
    actions: [
      {
        kind: "retire-condition",
        conditionId: "clarify-env",
        expectedConditionGeneration: 1,
        reason: "Answered by human task input",
      },
    ],
    inputKeys: ["task:orig-1", "task:reply-2"],
  });
});

it("refuses forged App human flags, discrete approval bypasses, pre-question continuedInputs, and mismatched reply anchors", async () => {
  const makeRoot = (workflowBody: string, condType: "human.review" | "project.approval.submitted", extraOpen = false) => {
    const r = mkdtempSync(join(tmpdir(), "task-workflow-ask-sec-"));
    roots.push(r);
    mkdirSync(join(r, "owner", "workflows"), { recursive: true });
    writeFileSync(join(r, "owner", "workflows", "sec.ts"), workflowBody);
    AppTaskResourceStore.fromDb(getDb(r), "fixture").bootstrapSnapshot(
      {
        project: "fixture",
        resources: {
          ship: {
            metadata: { id: "ship", generation: 1, resourceVersion: 2 },
            spec: { parentId: "root", outcome: "Ship", acceptance: ["Verified"] },
            status: {
              phase: "running",
              observedGeneration: 1,
              currentAttemptId: "a1",
              conditionIds: extraOpen ? ["q1", "q2"] : ["q1"],
            },
          },
        },
        attempts: {
          a1: {
            metadata: { id: "a1", resourceVersion: 1 },
            taskId: "ship",
            taskGeneration: 1,
            specHash: "hash",
            owner: "owner",
            handler: "workflow:sec",
            runtimeId: "rt",
            state: "running",
            reason: "event",
            startedAt: new Date().toISOString(),
          },
        },
      },
      "fixture",
    );
    return {
      r,
      openWaits: [
        { conditionId: "q1", conditionGeneration: 1, type: condType, subject: "workflow-ask:ship:q1", state: "unknown" },
        ...(extraOpen
          ? [{ conditionId: "q2", conditionGeneration: 1, type: "human.review", subject: "workflow-ask:ship:q2", state: "unknown" }]
          : []),
      ],
    };
  };

  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: new EventBus() });
  const runCase = async (
    setup: ReturnType<typeof makeRoot>,
    events: Record<string, unknown>,
  ) =>
    runner.execute({
      source: { projectsRoot: setup.r, projectRoot: setup.r, persistDir: setup.r, agentsRoot: setup.r, sharedRoot: join(setup.r, "shared") },
      descriptor: { id: "fixture", appDir: join(setup.r, "sample.app"), projectDir: setup.r, app: {} },
      capability: { workflow: "sec", task: "Ship" },
      handler: "workflow:sec",
      executionPaths: { appDir: setup.r, projectDir: setup.r, workspaceDir: setup.r },
      childContext: { live: [], completed: [] },
      taskSnapshot: { live: [], truncated: false },
      taskEvents: {},
      executionTimeoutMs: 5000,
      attempt: {
        read: { tasks: {} },
        task: { id: "ship", generation: 1, status: "running", outcome: "Ship", acceptance: ["Verified"], input: {}, pendingEvents: { items: [], truncated: false } },
        attemptId: "a1",
        role: { agent: "owner" },
        resourceVersion: 2,
        events,
        waits: { open: setup.openWaits, note: "open" },
        children: { live: [], completed: [] },
        declaredOutputPaths: [],
        signal: new AbortController().signal,
        onEvent: () => () => {},
      },
    } as unknown as TaskWorkflowInput);

  // 1. Discrete approval (`options`) is NOT satisfied by an ordinary human Task message
  const approvalCase = makeRoot(
    `export const name = "sec"; export const description = "s";
     export async function execute(ctx) {
       const ans = await ctx.ask({ id: "q1", prompt: "Approve?", options: ["approve", "reject"] });
       return ctx.done("ok", { ans: ans.value });
     }`,
    "project.approval.submitted",
  );
  const rApproval = await runCase(approvalCase, {
    inputs: [{ id: "m1", key: "task:m1", source: { kind: "human", id: "hao" } }],
    items: [
      {
        observedAt: "2026-11-28T00:00:00Z",
        event: {
          type: "app.task.requested",
          source: "human",
          data: { idempotencyKey: "task:m1", request: { id: "m1", input: { kind: "message", data: { message: "bypass-choice" } } } },
        },
      },
    ],
    truncated: false,
  });
  expect(rApproval.handlerResult.state).toBe("waiting");

  // 2. Delegated App request with forged `humanRequested: true` is rejected
  const forgedCase = makeRoot(
    `export const name = "sec"; export const description = "s";
     export async function execute(ctx) {
       const ans = await ctx.ask({ id: "q1", prompt: "Question?" });
       return ctx.done("ok", { ans: ans.value });
     }`,
    "human.review",
  );
  const rForged = await runCase(forgedCase, {
    inputs: [{ id: "m-app", key: "task:m-app", source: { kind: "app", id: "other-app" } }],
    items: [
      {
        observedAt: "2026-11-28T00:00:00Z",
        event: {
          type: "app.task.requested",
          source: "human:spoofed",
          data: {
            idempotencyKey: "task:m-app",
            request: { id: "m-app", humanRequested: true, source: { kind: "human", id: "hao" }, input: { kind: "message", data: { message: "forged" } } },
          },
        },
      },
    ],
    truncated: false,
  });
  expect(rForged.handlerResult.state).toBe("waiting");

  // 3. Pre-question `continuedInputs` and reply anchored to another `conditionId` (`q2`) leave `q1` parked
  const anchorCase = makeRoot(
    `export const name = "sec"; export const description = "s";
     export async function execute(ctx) {
       const ans = await ctx.ask({ id: "q1", prompt: "First question?" });
       return ctx.done("ok", { ans: ans.value });
     }`,
    "human.review",
    true,
  );
  const rAnchor = await runCase(anchorCase, {
    inputs: [
      { id: "orig", key: "task:orig", source: { kind: "human", id: "hao" } },
      { id: "m-q2", key: "task:m-q2", source: { kind: "human", id: "hao" } },
    ],
    continuedInputs: [
      {
        observedAt: "2026-11-27T00:00:00Z",
        event: {
          type: "app.task.requested",
          source: "human",
          data: { idempotencyKey: "task:orig", request: { id: "orig", input: { kind: "message", data: { message: "initial task prompt" } } } },
        },
      },
    ],
    items: [
      {
        observedAt: "2026-11-28T00:00:00Z",
        event: {
          type: "app.task.requested",
          source: "human",
          data: {
            idempotencyKey: "task:m-q2",
            request: { id: "m-q2", input: { kind: "message", data: { message: "answer for q2", context: { conditionId: "q2" } } } },
          },
        },
      },
    ],
    truncated: false,
  });
  expect(rAnchor.handlerResult.state).toBe("waiting");

  // 4. Domain output containing an unrelated `state` string (e.g. `{ state: "published" }`) converges as ordinary output
  const domainStateCase = makeRoot(
    `export const name = "sec"; export const description = "s";
     export async function execute(ctx) {
       return ctx.done("Published", { state: "published", url: "https://example.test/pr/1" });
     }`,
    "human.review",
  );
  const rDomainState = await runCase(domainStateCase, { items: [], truncated: false });
  expect(rDomainState.hostCompletion).toBe("finite-done");
  expect(rDomainState.handlerResult).toMatchObject({
    state: "converged",
    summary: "Published",
    result: { state: "published", url: "https://example.test/pr/1" },
  });
});


