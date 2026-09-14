import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { closeDb, getDb } from "../../../lib/requests.js";
import { openDatabase } from "../../../lib/db.js";
import { inStateTransaction } from "../../../lib/db/transaction.js";
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
  recordAppTaskTrigger,
} from "./app-task-reconciler.js";
import { reviseAppTask } from "./task-revision.js";
import { createTaskSessionRecovery } from "../../adapters/executors/session-recovery.js";
import { EventBus } from "../events/bus.js";
import { SubagentManager } from "../../../lib/manager.js";
import { writeSessionMeta } from "../../../lib/persistence.js";

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
  const revise = (interrupt?: (sessions: string[]) => void) =>
    reviseAppTask({ source: context("creator"), target: context("worker"), app: worker, actor, change, interrupt });
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
  expect(f.revise(() => {}).generation).toBe(2);
  expect(completeAppTask(f.context("worker"), old, { summary: "Obsolete alpha" }).status).toBe("stale");
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

test("a creator cannot replace another caller's unfinished question", () => {
  const f = fixture();
  const foreign = awaitingInput(f, "foreign", "sibling");
  expect(() => f.revise()).toThrow("Another caller still awaits");
  expect(foreign().taskAdmissionKey).toBe("task:foreign");
  expect(f.context("worker").resourceStore.readTask("child")?.metadata.generation).toBe(1);
  const old = f.claim("worker", "child");
  expect(completeAppTask(f.context("worker"), old, { summary: "Alpha", result: { source: "alpha" } }).status).toBe(
    "applied",
  );
  expect(f.revise().generation).toBe(2);
  expect(foreign().taskAdmissionKey).toBe("task:foreign");
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

test("an executor without session cleanup keeps its assignment until it finishes", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  expect(() => f.revise()).toThrow("retry after it finishes");
  expect(f.context("worker").resourceStore.readTask("child")?.status.currentAttemptId).toBe(old.attemptId);
  expect(completeAppTask(f.context("worker"), old, { summary: "Alpha measured" }).status).toBe("applied");
  expect(f.revise().generation).toBe(2);
  expect(f.claim("worker", "child").intent.input).toEqual({ source: "beta" });
});

test("cleanup runs without the writer lock and replacement stays fenced until it succeeds", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  recordAppTaskAttemptSession(f.context("worker"), old, "old-session");
  const file = String(
    f.db
      .prepare("PRAGMA database_list")
      .all()
      .find((row) => row.name === "main")!.file,
  );
  const second = openDatabase(file);
  second.exec("PRAGMA busy_timeout = 0");
  let cleaned = false;
  try {
    f.revise((ids) => {
      expect(ids).toEqual(["old-session"]);
      expect(inStateTransaction(f.db)).toBe(false);
      second.exec("BEGIN IMMEDIATE");
      second.exec("ROLLBACK");
      expect(
        claimObservedAppTask(f.context("worker"), { taskId: "child", appAgent: "worker", handler: "auto" }).kind,
      ).toBe("busy");
      cleaned = true;
    });
    expect(cleaned).toBe(true);
    expect(f.claim("worker", "child").generation).toBe(2);
  } finally {
    second.close();
  }
});

test("failed cleanup or stale reviewed generation cannot save a revision", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  recordAppTaskAttemptSession(f.context("worker"), old, "old-session");
  const before = f.context("worker").resourceStore.readTask("child");
  expect(() =>
    f.revise(() => {
      throw new Error("Unconfirmed cleanup");
    }),
  ).toThrow("Unconfirmed cleanup");
  expect(f.context("worker").resourceStore.readTask("child")).toEqual(before);
  f.revise(() => {});
  expect(() => f.revise()).toThrow("requirements changed");
});

test("creator, caller freshness and App input validation precede cleanup", () => {
  const f = fixture();
  const sibling = f.claim("creator", "sibling");
  const invoke = (actor = f.actor, change = f.change) =>
    reviseAppTask({
      source: f.context("creator"),
      target: f.context("worker"),
      app: worker,
      actor,
      change,
      interrupt: () => {
        throw new Error("Unexpected cleanup");
      },
    });
  expect(() => invoke({ ...f.actor, taskId: "sibling", attemptId: sibling.attemptId })).toThrow("recorded creator");
  expect(() => invoke(f.actor, { ...f.change, input: { kind: "invented", data: { source: "beta" } } })).toThrow(
    "Invalid revision input",
  );
  recordAppTaskTrigger(f.context("creator"), "parent", { type: "human.correction", source: "human", data: {} });
  expect(() => invoke()).toThrow("New caller input");
  expect(f.context("worker").resourceStore.readTask("child")?.metadata.generation).toBe(1);
});

test("production recovery refuses a live external owner and permits revision after it exits", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  recordAppTaskAttemptSession(f.context("worker"), old, "external-session");
  const session = { agent: "worker", task: "Measure alpha", startedAt: Date.now() };
  writeSessionMeta(f.root, "external-session", { ...session, status: "running", detached: true, pid: process.pid });
  const recovery = createTaskSessionRecovery({
    persistDir: f.root,
    manager: new SubagentManager({ persistDir: f.root }),
    bus: new EventBus(),
  });
  const revise = () =>
    f.revise((ids) => ids.forEach((id) => recovery.interrupt(id, "Creator revised requirements", "child")));
  expect(revise).toThrow("external owner is still live");
  expect(f.context("worker").resourceStore.readTask("child")?.status.currentAttemptId).toBe(old.attemptId);
  expect(f.context("worker").resourceStore.readTask("child")?.metadata.generation).toBe(1);
  writeSessionMeta(f.root, "external-session", { ...session, status: "done" });
  expect(revise().generation).toBe(2);
});

test("a concurrent target revision during cleanup cannot be overwritten", () => {
  const f = fixture();
  const old = f.claim("worker", "child");
  recordAppTaskAttemptSession(f.context("worker"), old, "old-session");
  expect(() =>
    f.revise(() =>
      reviseAppTask({
        source: f.context("creator"), target: f.context("worker"), app: worker, actor: f.actor,
        change: { ...f.change, input: { kind: "measure", data: { source: "gamma" } } },
        interrupt: () => {},
      }),
    ),
  ).toThrow("requirements changed");
  expect(readAppTaskIntent(f.context("worker"), "child")).toMatchObject({
    outcome: "Measure gamma",
    input: { source: "gamma" },
  });
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
    expect(() => observeAppTaskIntent(target, { appAgent: "worker", intent: repaired })).toThrow(
      "Task still owes a caller answer",
    );
    expect(target.resourceStore.readTask("child")).toEqual(before);
    expect(pending().taskAdmissionKey).toBe("task:binding-repair");
    // The App still selects execution; its creator preserves the unanswered input
    // through the same revision capability used for requirement corrections.
    reviseAppTask({
      source: f.context("creator"),
      target,
      actor: f.actor,
      app: { ...worker, task: () => ({ kind: "desired", intent: repaired }) },
      change: { ...f.change, input: { kind: "measure", data: { source: "alpha" } } },
    });
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
    interrupt: () => {
      throw new Error("Unexpected cleanup");
    },
  });
  expect(result).toMatchObject({ generation: 1, changed: false });
  expect(f.context("worker").resourceStore.readTask("child")?.status.currentAttemptId).toBe(old.attemptId);
});
