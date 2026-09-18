import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { closeDb, getDb } from "../../../lib/requests.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitTaskInput } from "../state/inbox.js";
import { createAppInboxItem, getAppInboxItem } from "../state/app-inbox-store.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
  readAppTaskIntent,
  readAppTaskAdmissionOutcome,
  recordAppTaskAttemptSession,
  renewAppTaskAttemptLease,
  releaseStaleAppTaskResult,
  assertAppTaskEffectFresh,
  recoverableAppTaskAttempts,
  releaseInterruptedAppTaskAttempt,
  stopAppTaskAttempt,
  recordAppTaskTrigger,
} from "./app-task-reconciler.js";
import { reviseAppTask } from "./task-revision.js";
import { createTaskWorkflowRunner } from "../../adapters/executors/workflow.js";

const roots: string[] = [];
afterEach(() =>
  roots.splice(0).forEach((root) => {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }),
);
const worker = defineApp({
  id: "worker",
  version: 1,
  agent: "worker",
  tasks: {},
  inputSchema: Type.Object(
    {
      kind: Type.Literal("measure"),
      data: Type.Object({ source: Type.String({ minLength: 1 }) }, { additionalProperties: false }),
    },
    { additionalProperties: false },
  ),
  task: ({ input }) => ({
    kind: "desired",
    intent: {
      id: "generated-id",
      parentId: "root",
      outcome: `Measure ${input.data.source}`,
      acceptance: [`Verify ${input.data.source}`],
      input: { source: input.data.source },
      executor: input.data.source === "beta" ? "secondary" : "primary",
    },
  }),
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-task-revision-"));
  roots.push(root);
  let db = getDb(root);
  const context = (appId: string) =>
    appTaskContext({
      appDir: root,
      projectDir: root,
      agent: appId,
      maxConcurrent: 4,
      resourceStore: AppTaskResourceStore.fromDb(db, appId),
    });
  for (const appId of ["creator", "worker"])
    context(appId).resourceStore.bootstrapSnapshot(
      {
        project: appId,
        project_lifecycle: "active",
        root_task_id: "root",
        groups: { root: { id: "root", parent_id: null } },
      },
      "revision-test",
    );
  const source = context("creator");
  const target = context("worker");
  for (const id of ["parent", "sibling"])
    observeAppTaskIntent(source, {
      appAgent: "creator",
      intent: { id, parentId: "root", outcome: "Review evidence", acceptance: ["Verified"] },
    });
  const initial = { kind: "measure", data: { source: "alpha" } } as const;
  const attachment = worker.task!({ id: "child", source: { kind: "app", id: "creator" }, input: initial })!;
  if (attachment.kind !== "desired") throw new Error("Expected desired work");
  admitTaskInput(target, {
    appId: "worker",
    creator: { appId: "creator", taskId: "parent" },
    attachment: { kind: "desired", intent: { ...attachment.intent, id: "child" } },
    idempotencyKey: "first",
    inputContext: { id: "first", source: { kind: "app", id: "creator" }, input: initial },
  });
  const claim = (appId: string, taskId: string) => {
    const value = claimObservedAppTask(context(appId), { taskId, appAgent: appId, handler: "auto" });
    if (value.kind !== "claimed") throw new Error(`Expected claim, got ${value.kind}`);
    return value;
  };
  const parent = claim("creator", "parent");
  const actor = { appId: "creator", taskId: "parent", generation: parent.generation, attemptId: parent.attemptId };
  const change = {
    appId: "worker",
    taskId: "child",
    expectedGeneration: 1,
    input: { kind: "measure", data: { source: "beta" } },
  };
  const revise = () =>
    reviseAppTask({ source: context("creator"), target: context("worker"), app: worker, actor, change });
  return {
    root,
    context,
    claim,
    parent,
    actor,
    change,
    revise,
    get db() {
      return db;
    },
    reopen() {
      closeDb(root);
      db = getDb(root);
    },
  };
}

test("one revision changes actual input and App-selected execution, survives caller failure and rejects old results", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  recordAppTaskAttemptSession(f.context("worker"), old, "old-session");
  expect(f.revise().generation).toBe(2);
  expect(completeAppTask(f.context("worker"), old, { summary: "Obsolete alpha" }).status).toBe("stale");
  expect(releaseStaleAppTaskResult(f.context("worker"), old).status).toBe("released");
  failAppTaskAttempt(f.context("creator"), f.parent, "Answer failed after the saved revision");
  f.reopen();
  const next = f.claim("worker", "child");
  expect(next).toMatchObject({
    taskId: "child",
    generation: 2,
    handler: "executor:secondary",
    intent: { outcome: "Measure beta", acceptance: ["Verify beta"], input: { source: "beta" } },
  });
  expect(f.context("worker").resourceStore.readTask("child")?.metadata.creator).toEqual({
    appId: "creator",
    taskId: "parent",
  });
});

test("a Task workflow saves a creator revision while the worker runs, even if the workflow then fails", async () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  const directory = join(f.root, "creator", "workflows");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "correct.ts"), `
export const name = "correct";
export const description = "Revision boundary regression";
export async function execute(ctx) {
  await ctx.reviseTask(${JSON.stringify(f.change)});
  throw new Error("failed after saving requirements");
}`);
  const runner = createTaskWorkflowRunner({ manager: {} as never, bus: { emit() {} } as never });
  let received: unknown;
  const result = await runner.execute({
    descriptor: { id: "creator", appDir: join(f.root, "creator.app"), projectDir: f.root, app: worker },
    source: { projectsRoot: f.root, projectRoot: f.root, persistDir: f.root, agentsRoot: f.root, sharedRoot: f.root },
    capability: { agent: "creator", workflow: "correct", task: "Correct child requirements" },
    handler: "workflow:correct",
    attempt: {
      task: { id: "parent", generation: 1, outcome: "Review evidence", acceptance: ["Verified"], input: {} },
      attemptId: f.parent.attemptId,
      resourceVersion: 1,
      role: { agent: "creator" },
      events: { items: [], truncated: false },
      waits: { open: [], settled: [] },
      signal: new AbortController().signal,
      declaredOutputPaths: [],
      reviseTask: async (change: typeof f.change) => {
        received = change;
        return reviseAppTask({ source: f.context("creator"), target: f.context("worker"), app: worker, actor: f.actor, change });
      },
    },
    executionPaths: { projectDir: f.root, appDir: f.root, workspaceDir: f.root, outputDir: f.root },
    childContext: { live: [], completed: [], truncated: false },
    taskSnapshot: { live: [], truncated: false },
    taskEvents: { read: () => null, publish: () => 1, onEvent: () => () => {} },
    taskRead: { list: async () => ({ items: [] }), get: async () => null },
    executionTimeoutMs: 30_000,
  } as never);
  expect(received).toEqual(f.change);
  expect(result.handlerResult.summary).toContain("failed after saving requirements");
  expect(f.context("worker").resourceStore.readTask("child")?.spec.input).toEqual({ source: "beta" });
  expect(completeAppTask(f.context("worker"), old, { summary: "Old alpha result" }).status).toBe("stale");
});

function awaitingInput(f: ReturnType<typeof fixture>, id: string, taskId = "parent") {
  const inputContext = {
    id,
    source: { kind: "app" as const, id: "creator" },
    input: { kind: "measure", data: { source: "alpha" } },
  };
  const creator = { appId: "creator", taskId };
  createAppInboxItem(f.db, { ...inputContext, appId: "worker", creator });
  admitTaskInput(f.context("worker"), {
    appId: "worker",
    creator,
    attachment: { kind: "existing", taskId: "child" },
    inputContext,
    inboxInputId: id,
    idempotencyKey: `task:${id}`,
  });
  return () => getAppInboxItem(f.db, id)!;
}

test("unfinished input follows the revised answer across reopen while an accepted answer stays exact", () => {
  const f = fixture();
  const earlier = awaitingInput(f, "earlier");
  const old = f.claim("worker", "child");
  expect(completeAppTask(f.context("worker"), old, { summary: "Alpha", result: { source: "alpha" } }).status).toBe(
    "applied",
  );
  const pending = awaitingInput(f, "pending");
  f.revise();
  f.reopen();
  const next = f.claim("worker", "child");
  expect(completeAppTask(f.context("worker"), next, { summary: "Beta", result: { source: "beta" } }).status).toBe(
    "applied",
  );
  expect(earlier().taskAdmissionKey).toBe("task:earlier");
  expect(readAppTaskAdmissionOutcome(f.context("worker"), "child", earlier().taskAdmissionKey!)?.result).toEqual({
    source: "alpha",
  });
  expect(readAppTaskAdmissionOutcome(f.context("worker"), "child", pending().taskAdmissionKey!)?.result).toEqual({
    source: "beta",
  });
  expect(pending().input.data).toEqual({ source: "alpha" });
});

test("requirements can change with another caller pending; exact input remains answerable", () => {
  const f = fixture();
  const foreign = awaitingInput(f, "foreign", "sibling");
  expect(f.revise().generation).toBe(2);
  expect(foreign().taskAdmissionKey).toBe("task:foreign");
  const next = f.claim("worker", "child");
  expect(completeAppTask(f.context("worker"), next, { summary: "Beta", result: { source: "beta" } }).status).toBe("applied");
  expect(readAppTaskAdmissionOutcome(f.context("worker"), "child", foreign().taskAdmissionKey!)?.result).toEqual({ source: "beta" });
});

test.each(["answer", "wait"])(
  "raw updates cannot bypass admission during %s; the common revision returns the corrected answer",
  (settlement) => {
    const f = fixture();
    const config = f.context("creator");
    const app = { ...worker, id: "creator" };
    const original = { kind: "measure", data: { source: "alpha" } };
    const context = {
      id: "same-app-input",
      source: { kind: "app" as const, id: "creator" },
      input: original,
    };
    const creator = { appId: "creator", taskId: "parent" };
    createAppInboxItem(f.db, { ...context, appId: "creator", creator });
    admitTaskInput(config, {
      appId: "creator",
      creator,
      inboxInputId: context.id,
      idempotencyKey: `task:${context.id}`,
      inputContext: context,
      attachment: {
        kind: "desired",
        intent: {
          id: "local-child",
          parentId: "root",
          outcome: "Measure alpha",
          acceptance: ["Verify alpha"],
          input: { source: "alpha" },
          executor: "primary",
        },
      },
    });
    const output = {
      summary: "Claimed correction",
      facts: ["scope:beta"],
      actions: [
        {
          kind: "update-task",
          taskId: "local-child",
          expectedGeneration: 1,
          outcome: "Measure beta",
          acceptance: ["Verify beta"],
          input: { source: "beta" },
        } as never,
      ],
    };
    const before = config.resourceStore.readTask("local-child");
    expect(() =>
      settlement === "answer"
        ? completeAppTask(config, f.parent, output)
        : deferAppTask(config, f.parent, {
            ...output,
            disposition: "waiting",
            conditions: [
              {
                id: "proof",
                type: "proof.ready",
                subject: "proof:beta",
                expected: true,
                owner: "app:creator",
                reviewAfterMs: 60_000,
              },
            ],
          }),
    ).toThrow("update-task is retired");
    expect(config.resourceStore.readTask("local-child")).toEqual(before);
    expect(config.resourceStore.readAttempt(f.parent.attemptId)?.acceptedResult).toBeUndefined();
    expect(getAppInboxItem(f.db, context.id)?.taskAdmissionKey).toBe(`task:${context.id}`);

    reviseAppTask({
      source: config,
      target: config,
      app,
      actor: f.actor,
      change: { ...f.change, appId: "creator", taskId: "local-child" },
    });
    f.reopen();
    const next = f.claim("creator", "local-child");
    expect(next.intent).toMatchObject({ input: { source: "beta" }, executor: "secondary" });
    expect(
      completeAppTask(f.context("creator"), next, {
        summary: "Verified beta",
        result: { source: "beta" },
      }).status,
    ).toBe("applied");
    const saved = getAppInboxItem(f.db, context.id)!;
    expect(saved.input).toEqual(original);
    expect(
      readAppTaskAdmissionOutcome(f.context("creator"), "local-child", saved.taskAdmissionKey!)?.result,
    ).toEqual({ source: "beta" });
  },
);

test.each([false, true])("spec save preserves running execution (session: %s), leases and effect fences", (session) => {
  const f = fixture();
  const target = f.context("worker");
  const old = f.claim("worker", "child");
  if (session) recordAppTaskAttemptSession(target, old, "old-session");
  const before = target.resourceStore.readTask("child")!;
  expect(f.revise().generation).toBe(2);
  expect(target.resourceStore.readTask("child")?.status).toEqual(before.status);
  expect(target.resourceStore.readAttempt(old.attemptId)?.state).toBe("running");
  expect(renewAppTaskAttemptLease(target, old)).toBe(true);
  expect(recordAppTaskAttemptSession(target, old, "old-session")).toBe(true);
  expect(claimObservedAppTask(target, { taskId: "child", appAgent: "worker", handler: "auto" }).kind).toBe("busy");
  expect(() => assertAppTaskEffectFresh(target, old)).toThrow("stale");
  expect(completeAppTask(target, old, { summary: "Old result" }).status).toBe("stale");
  expect(releaseStaleAppTaskResult(target, old).status).toBe("released");
  expect(f.claim("worker", "child").generation).toBe(2);
  expect(releaseStaleAppTaskResult(target, old).status).toBe("superseded");
});

test("status changes during mapping do not conflict with requirement writes", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  const app = { ...worker, task: (...args: Parameters<NonNullable<typeof worker.task>>) => {
    failAppTaskAttempt(f.context("worker"), old, "Worker failed during mapping");
    return worker.task!(...args);
  } };
  expect(reviseAppTask({ source: f.context("creator"), target: f.context("worker"), app, actor: f.actor, change: f.change }).generation).toBe(2);
  expect(f.context("worker").resourceStore.readTask("child")?.status.summary).toBe("Worker failed during mapping");
});

test("execution failure after a revision preserves both inputs", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  f.revise();
  expect(failAppTaskAttempt(f.context("worker"), old, "Executor disconnected").status).toBe("retrying");
  const task = f.context("worker").resourceStore.readTask("child")!;
  expect(task.metadata.generation).toBe(2);
  expect(task.status.currentAttemptId).toBeUndefined();
  expect(task.status.observedGeneration).toBe(1);
  expect(f.context("worker").resourceStore.readTrigger("child")?.events).toHaveLength(2);
});

test("restart recovers an old execution into the latest spec without a revision notification", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  f.revise();
  // Simulate the departed runtime, retaining the exact attempt and accepted input.
  f.db.prepare(`UPDATE app_task_attempts SET attempt_json = json_set(attempt_json, '$.runtimeId', 'departed')
    WHERE app_id = 'worker' AND attempt_id = ?`).run(old.attemptId);
  f.reopen();
  const target = f.context("worker");
  const recovery = recoverableAppTaskAttempts(target, Date.now(), true, ["child"]);
  expect(recovery).toHaveLength(1);
  expect(releaseInterruptedAppTaskAttempt(target, recovery[0], "Restart recovery").released).toBe(true);
  const next = f.claim("worker", "child");
  expect(next.generation).toBe(2);
  expect(next.intent.input).toEqual({ source: "beta" });
  expect(next.events).toHaveLength(2);
  expect(completeAppTask(target, next, { summary: "Beta verified" }).status).toBe("applied");
});

test("explicit Stop still controls the exact running attempt after a spec update", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  f.revise();
  expect(stopAppTaskAttempt(f.context("worker"), { taskId: "child", attemptId: old.attemptId,
    expectedGeneration: old.generation, reason: "Caller stopped this execution" }).changed).toBe(true);
  const task = f.context("worker").resourceStore.readTask("child")!;
  expect(task.metadata.generation).toBe(2);
  expect(task.status.observedGeneration).toBe(1);
  expect(task.status.currentAttemptId).toBeUndefined();
});

test("creator, caller freshness and App input validation protect requirements", () => {
  const f = fixture();
  const sibling = f.claim("creator", "sibling");
  const invoke = (actor = f.actor, change = f.change) =>
    reviseAppTask({
      source: f.context("creator"),
      target: f.context("worker"),
      app: worker,
      actor,
      change,
    });
  expect(() => invoke({ ...f.actor, taskId: "sibling", attemptId: sibling.attemptId })).toThrow("recorded creator");
  expect(() => invoke(f.actor, { ...f.change, input: { kind: "invented", data: { source: "beta" } } })).toThrow(
    "Invalid revision input",
  );
  recordAppTaskTrigger(f.context("creator"), "parent", { type: "human.correction", source: "human", data: {} });
  expect(() => invoke()).toThrow("New caller input");
  expect(f.context("worker").resourceStore.readTask("child")?.metadata.generation).toBe(1);
});

test("a concurrent spec change during mapping cannot be overwritten", () => {
  const f = fixture();
  const app = { ...worker, task: (...args: Parameters<NonNullable<typeof worker.task>>) => {
    reviseAppTask({ source: f.context("creator"), target: f.context("worker"), app: worker, actor: f.actor,
      change: { ...f.change, input: { kind: "measure", data: { source: "gamma" } } } });
    return worker.task!(...args);
  } };
  expect(() => reviseAppTask({ source: f.context("creator"), target: f.context("worker"), app, actor: f.actor, change: f.change })).toThrow("requirements changed");
  expect(readAppTaskIntent(f.context("worker"), "child")?.input).toEqual({ source: "gamma" });
});

test("the responsible App can change execution without changing creator requirements", () => {
  const f = fixture();
  const target = f.context("worker");
  observeAppTaskIntent(target, {
    appAgent: "worker",
    intent: { ...readAppTaskIntent(target, "child")!, executor: "replacement" },
  });
  expect(target.resourceStore.readTask("child")?.spec.executor).toBe("replacement");
  expect(() =>
    observeAppTaskIntent(target, {
      appAgent: "worker",
      intent: { ...readAppTaskIntent(target, "child")!, outcome: "Discard accepted work" },
    }),
  ).toThrow("recorded creator");
});

test.each(["queued", "waiting"])(
  "policy repair preserves a %s caller obligation through the common revision",
  (phase) => {
    const f = fixture();
    const target = f.context("worker");
    const pending = awaitingInput(f, "binding-repair");
    if (phase === "waiting")
      deferAppTask(target, f.claim("worker", "child"), {
        disposition: "waiting",
        summary: "Source unavailable",
        conditions: [
          {
            id: "source",
            type: "source.ready",
            subject: "source:alpha",
            expected: true,
            owner: "app:worker",
            reviewAfterMs: 60_000,
          },
        ],
      });
    const before = target.resourceStore.readTask("child");
    const repaired = { ...readAppTaskIntent(target, "child")!, executor: "replacement" };
    observeAppTaskIntent(target, { appAgent: "worker", intent: repaired });
    expect(target.resourceStore.readTask("child")?.status).toEqual(before!.status);
    expect(pending().taskAdmissionKey).toBe("task:binding-repair");
    f.reopen();
    const next = f.claim("worker", "child");
    expect(next).toMatchObject({ handler: "executor:replacement", intent: { input: { source: "alpha" } } });
    completeAppTask(f.context("worker"), next, { summary: "Alpha verified", result: { source: "alpha" } });
    expect(
      readAppTaskAdmissionOutcome(f.context("worker"), "child", pending().taskAdmissionKey!)?.result,
    ).toEqual({ source: "alpha" });
  },
);

test("unchanged input does not interrupt the current worker or advance its generation", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  recordAppTaskAttemptSession(f.context("worker"), old, "old-session");
  const result = reviseAppTask({
    source: f.context("creator"),
    target: f.context("worker"),
    app: worker,
    actor: f.actor,
    change: { ...f.change, input: { kind: "measure", data: { source: "alpha" } } },
  });
  expect(result).toMatchObject({ generation: 1, changed: false });
  expect(f.context("worker").resourceStore.readTask("child")?.status.currentAttemptId).toBe(old.attemptId);
});
