import { Type, defineApp } from "@may-agent/sdk";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { readAppConversationResource } from "./conversations.js";
import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { cacheTaskSnapshots, readTaskSnapshot } from "../tasks/app-task-store.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { claimAppInboxItem, waitAppInboxClaim } from "../../../../test/fixtures/legacy-inbox.js";
import { createConversationTopic, listConversationTopicLinksForTask } from "./conversations.js";
import {
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  failAppTaskAttempt,
  markAppTaskAttention,
  observeAppTaskIntent,
  retryFailedAppTask,
  reportAppTaskFailure,
  readAppTaskAdmissionOutcome,
} from "../tasks/app-task-reconciler.js";
import { failTask, finishTask, openState, testAttachment } from "../../../../test/fixtures/request-task-state.js";
import { admitTaskInput, completeTaskInput, recoverTaskInputAdmissionKey } from "./inbox.js";

const roots: string[] = [];
const connections: SqliteDb[] = [];
afterEach(() => {
  setSystemTime();
  for (const db of connections.splice(0)) db.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-request-state-"));
  roots.push(root);
  const path = join(root, "host.sqlite");
  const db = openDatabase(path);
  connections.push(db);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  applyDbSchema(db);
  for (const appId of ["example", "other"]) {
    AppTaskResourceStore.fromDb(db, appId).bootstrapSnapshot(
      {
        version: 1,
        project: appId,
        project_lifecycle: "active",
        root_task_id: "project",
        groups: { project: { id: "project", parent_id: null } },
        tasks: {},
      },
      "fixture",
    );
  }
  createConversationTopic(db, {
    id: "topic",
    appId: "example",
    conversationId: "chat",
    title: "Example",
    openedBy: "human",
    originMessageId: "one",
  });
  const item = createAppInboxItem(db, {
    id: "request-one",
    appId: "example",
    topicId: "topic",
    conversationId: "chat",
    conversationSequence: 1,
    source: { kind: "human", id: "one" },
    input: { kind: "example", data: {} },
  }).item;
  const config = openState(path);
  connections.push(config.resourceStore.db);
  const input = {
    appId: "example",
    attachment: testAttachment(),
    idempotencyKey: "task:request-one",
    inputContext: { id: item.id, source: item.source, input: item.input },
    inboxInputId: item.id,
  };
  return { db, path, config, input };
}

function advanceToRetry(config: ReturnType<typeof openState>, taskId = "work/one") {
  const retryAt = config.resourceStore.readTask(taskId)!.status.executionRetryAt!;
  expect(retryAt).toBeGreaterThan(Date.now());
  setSystemTime(new Date(retryAt));
}

function repeatFailures(config: ReturnType<typeof openState>, count: number) {
  for (let failure = 0; failure < count; failure++) {
    if (failure) advanceToRetry(config);
    expect(failTask(config).status).toBe("retrying");
    expect(config.resourceStore.readTask("work/one")?.status.executionFailures).toBe(failure + 1);
  }
}

async function worker(path: string, action: string, taskId?: string) {
  const child = Bun.spawn(
    [
      process.execPath,
      fileURLToPath(new URL("../../../../test/fixtures/request-task-state.ts", import.meta.url)),
      path,
      action,
      ...(taskId ? [taskId] : []),
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      timeout: 10_000,
    },
  );
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  return { exitCode, stderr };
}

describe("request-to-Task state operation", () => {
  it("fences direct follow-up admission and commits its Topic link atomically", () => {
    const { db, config, input } = fixture();
    expect(() =>
      admitTaskInput(config, {
        ...input,
        authorize: () => {
          throw new Error("turn stopped");
        },
      }),
    ).toThrow("turn stopped");
    expect(config.resourceStore.readTask("work/one")).toBeNull();
    expect(() => admitTaskInput(config, { ...input, inboxInputId: undefined, topicId: "missing" })).toThrow();
    expect(config.resourceStore.readTask("work/one")).toBeNull();
    admitTaskInput(config, { ...input, inboxInputId: undefined, topicId: "topic" });
    expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
  });
  it("commits Task input, exact dependency, Topic and Conversation claim release together", () => {
    const { db, config, input } = fixture();
    admitTaskInput(config, input);
    expect(getAppInboxItem(db, input.inputContext.id)).toMatchObject({ waitingOn: { kind: "task", id: "work/one" } });
    expect(getAppInboxItem(db, input.inputContext.id)?.lease).toBeUndefined();
    expect(config.resourceStore.readTask("work/one")).not.toBeNull();
    expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
    createAppInboxItem(db, {
      id: "next",
      appId: "example",
      conversationId: "chat",
      conversationSequence: 2,
      source: { kind: "human", id: "two" },
      input: { kind: "example", data: {} },
    });
    expect(claimAppInboxItem(db, "next", "handler-two", 60_000)).not.toBeNull();
  });

  it("replays a lost reply without duplicating input and rejects changed desired work", () => {
    const { config, input } = fixture();
    let authorized = 0;
    const authorize = () => {
      authorized++;
    };
    const first = admitTaskInput(config, { ...input, authorize });
    const revision = config.resourceStore.revision();
    expect(admitTaskInput(config, { ...input, authorize })).toMatchObject({
      taskId: first.taskId,
      generation: first.generation,
    });
    expect(authorized).toBe(2);
    expect(config.resourceStore.revision()).toBe(revision);
    expect(
      config.resourceStore.readTaskContext({ taskIds: [first.taskId] }).taskTriggers?.[first.taskId]?.events,
    ).toHaveLength(1);
    expect(() => admitTaskInput(config, { ...input, attachment: testAttachment("different") })).toThrow();
    expect(config.resourceStore.readTask("different")).toBeNull();
    const changed = testAttachment();
    if (changed.kind !== "desired") throw new Error("fixture");
    changed.intent.outcome = "Different desired work";
    expect(() => admitTaskInput(config, { ...input, attachment: changed })).toThrow("different desired work");
    expect(() =>
      admitTaskInput(config, { ...input, idempotencyKey: "try-another-key", attachment: changed }),
    ).toThrow("identity must belong");
    expect(() =>
      admitTaskInput(config, { ...input, inputContext: { ...input.inputContext, input: { kind: "changed", data: {} } } }),
    ).toThrow("does not match");
  });

  it.each([
    ["desired", false],
    ["existing", false],
    ["desired", true],
    ["existing", true],
  ] as const)("recovers a released %s admission after a crash (completed: %j)", async (kind, completed) => {
    const { db, path, config, input } = fixture();
    const desired = testAttachment();
    if (desired.kind !== "desired") throw new Error("fixture");
    if (kind === "existing") observeAppTaskIntent(config, { intent: desired.intent, appAgent: config.agent });
    expect(await worker(path, `crash-admission-${kind}`)).toEqual({ exitCode: 137, stderr: "" });
    expect(getAppInboxItem(db, input.inputContext.id)?.waitingOn).toBeUndefined();
    if (completed) finishTask(config);
    const before = config.resourceStore.readTaskContext({ taskIds: ["work/one"] });
    const legacyKey = `task:request-one:${kind}:work/one`;
    const admissions = () =>
      config.resourceStore.readTaskContext({
        taskIds: [],
        admissionIds: [legacyKey, input.idempotencyKey],
      }).appTaskAdmissions;
    const accepted = admissions()?.[legacyKey];
    expect(accepted).toBeDefined();
    const now = Date.now();
    const resumed = {
      ...input,
      now,
      attachment: kind === "existing" ? ({ kind, taskId: "work/one" } as const) : desired,
    };
    db.exec(
      "CREATE TRIGGER fail_topic BEFORE INSERT ON conversation_topic_tasks BEGIN SELECT RAISE(ABORT, 'link failure'); END",
    );
    expect(() => admitTaskInput(config, resumed)).toThrow("link failure");
    expect(admissions()?.[input.idempotencyKey]).toBeUndefined();
    expect(admissions()?.[legacyKey]).toEqual(accepted);
    expect(getAppInboxItem(db, input.inputContext.id)?.status).toBe("pending");
    db.exec("DROP TRIGGER fail_topic");
    const result = admitTaskInput(config, resumed);
    expect(result.taskId).toBe("work/one");
    expect(admissions()?.[input.idempotencyKey]).toBeUndefined();
    expect(admissions()?.[legacyKey]).toEqual(accepted);
    expect(config.resourceStore.readTaskContext({ taskIds: ["work/one"] }).taskTriggers).toEqual(before.taskTriggers);
    expect(getAppInboxItem(db, input.inputContext.id)?.waitingOn?.id).toBe("work/one");
    expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
    expect(Boolean(readAppTaskAdmissionOutcome(config, "work/one", legacyKey))).toBe(completed);
    const revision = config.resourceStore.revision();
    admitTaskInput(config, resumed);
    expect(config.resourceStore.revision()).toBe(revision);
  });

  it("rejects changed desired work but can recover its prior admission as an existing Task", () => {
    const { db, config, input } = fixture();
    const legacyKey = "task:request-one:desired:work/one";
    admitTaskInput(config, { ...input, inboxInputId: undefined, idempotencyKey: legacyKey });
    const before = config.resourceStore.readTaskContext({ taskIds: ["work/one"] }).taskTriggers;
    const changed = testAttachment();
    if (changed.kind !== "desired") throw new Error("fixture");
    changed.intent.outcome = "Different work";
    expect(() => admitTaskInput(config, { ...input, attachment: changed })).toThrow("different desired work");
    expect(getAppInboxItem(db, input.inputContext.id)?.waitingOn).toBeUndefined();
    expect(getAppInboxItem(db, input.inputContext.id)?.status).toBe("pending");
    admitTaskInput(config, { ...input, attachment: { kind: "existing", taskId: "work/one" } });
    expect(config.resourceStore.readTaskContext({ taskIds: ["work/one"] }).taskTriggers).toEqual(before);
    expect(getAppInboxItem(db, input.inputContext.id)?.waitingOn?.id).toBe("work/one");
  });

  it("rolls back admission, wait, and cached state when Topic linking fails", () => {
    const { db, config, input } = fixture();
    cacheTaskSnapshots(config);
    readTaskSnapshot(config);
    db.exec(
      "CREATE TRIGGER fail_topic BEFORE INSERT ON conversation_topic_tasks BEGIN SELECT RAISE(ABORT, 'link failure'); END",
    );
    expect(() => admitTaskInput(config, input)).toThrow("link failure");
    expect(getAppInboxItem(db, input.inputContext.id)?.status).toBe("pending");
    expect(config.resourceStore.readTask("work/one")).toBeNull();
    expect(
      config.resourceStore.readTaskContext({ taskIds: [], admissionIds: [input.idempotencyKey] }).appTaskAdmissions?.[
        input.idempotencyKey
      ],
    ).toBeUndefined();
    db.exec("DROP TRIGGER fail_topic");
    admitTaskInput(config, { ...input, attachment: testAttachment("recomputed") });
    expect(readTaskSnapshot(config).resources?.["work/one"]).toBeUndefined();
    expect(readTaskSnapshot(config).resources?.recomputed).toBeDefined();
  });

  it("does not satisfy a new input with an earlier answer from the same Task", () => {
    const { db, config, input } = fixture();
    admitTaskInput(config, { ...input, inboxInputId: undefined, idempotencyKey: "earlier-request" });
    finishTask(config);
    admitTaskInput(config, input);
    expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
    expect(getAppInboxItem(db, input.inputContext.id)?.taskAdmissionKey).toBe(input.idempotencyKey);
    expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
  });

  it("does not treat an older receipt as completion of a changed generation", () => {
    const { db, config, input } = fixture();
    admitTaskInput(config, { ...input, inboxInputId: undefined, idempotencyKey: "earlier-request" });
    finishTask(config);
    const changed = testAttachment();
    if (changed.kind !== "desired") throw new Error("fixture");
    changed.intent.outcome = "New generation";
    admitTaskInput(config, { ...input, attachment: changed });
    expect(config.resourceStore.readTask("work/one")?.metadata.generation).toBe(2);
    expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
  });

  it("persists an exact answer across processes without an EventBus", async () => {
    const { db, path, config, input } = fixture();
    admitTaskInput(config, input);
    createAppInboxItem(db, {
      id: "other-request",
      appId: "other",
      source: { kind: "system", id: "test" },
      input: input.inputContext.input,
    });
    const other = claimAppInboxItem(db, "other-request", "other-handler", 60_000)!;
    waitAppInboxClaim(db, other, { kind: "task", id: "work/one" });
    expect(await worker(path, "complete")).toEqual({ exitCode: 0, stderr: "" });
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
    expect(getAppInboxItem(db, "other-request")?.availableAt).toBeUndefined();
  });

  it.each(["report", "cancel"])("preserves input and owner control after %s without a notification", (operation) => {
    const { db, config, input } = fixture();
    admitTaskInput(config, input);
    if (operation === "report") {
      const claim = claimObservedAppTask(config, {
        taskId: "work/one",
        appAgent: "example-owner",
        handler: "agent:example-owner",
      });
      if (claim.kind !== "claimed") throw new Error("expected claim");
      reportAppTaskFailure(config, claim, { summary: "Source is offline", facts: ["fixture:source-offline"] });
      expect(config.resourceStore.readAttempt(claim.attemptId)?.acceptedResult).toMatchObject({
        state: "incomplete",
        summary: "Source is offline",
        facts: ["fixture:source-offline"],
      });
      expect(config.resourceStore.isCancelled(claim.taskId)).toBe(false);
      expect(readAppTaskAdmissionOutcome(config, claim.taskId, input.idempotencyKey)).toBeNull();
      expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
      advanceToRetry(config);
      finishTask(config);
    } else {
      const current = config.resourceStore.readTask("work/one")!;
      cancelAppTask(config, {
        appId: "example",
        taskId: "work/one",
        expectedGeneration: current.metadata.generation,
        expectedResourceVersion: current.metadata.resourceVersion,
        reason: "Owner withdrew the assignment",
      });
    }
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
  });

  it.each(["complete", "close"])("Task %s survives an unavailable input projection", (decision) => {
    const { db, config, input } = fixture();
    admitTaskInput(config, input);
    const item = getAppInboxItem(db, input.inputContext.id)!;
    db.exec("CREATE TRIGGER fail_projection BEFORE UPDATE ON app_inbox_items BEGIN SELECT RAISE(ABORT, 'projection failure'); END");
    if (decision === "complete") finishTask(config);
    else {
      const task = config.resourceStore.readTask("work/one")!;
      cancelAppTask(config, { appId: "example", taskId: "work/one", expectedGeneration: task.metadata.generation,
        expectedResourceVersion: task.metadata.resourceVersion, decision: "app-policy", reason: "Owner withdrew this input" });
    }
    const result = { summary: decision === "complete" ? "Verified" : "Closed by owner" };
    expect(() => completeTaskInput(db, item, result, Date.now())).toThrow("projection failure");
    expect(getAppInboxItem(db, input.inputContext.id)?.status).toBe("handling");
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
    db.exec("DROP TRIGGER fail_projection");
    expect(completeTaskInput(db, item, result, Date.now())).toBe(true);
    expect(getAppInboxItem(db, input.inputContext.id)?.result).toEqual(result);
  });

  it("preserves retry pacing and unfinished input across processes beyond the old failure limit", async () => {
    setSystemTime(new Date());
    const { db, path, config, input } = fixture();
    admitTaskInput(config, input);
    createAppInboxItem(db, {
      id: "other-request",
      appId: "other",
      source: { kind: "system", id: "test" },
      input: input.inputContext.input,
    });
    const other = claimAppInboxItem(db, "other-request", "other-handler", 60_000)!;
    waitAppInboxClaim(db, other, { kind: "task", id: "work/one" });
    repeatFailures(config, 5);
    const deadline = config.resourceStore.readTask("work/one")!.status.executionRetryAt!;
    // A fresh process observes the saved deadline, with no EventBus or in-memory timer.
    expect(await worker(path, "expect-backoff")).toEqual({ exitCode: 0, stderr: "" });
    const restarted = openState(path);
    connections.push(restarted.resourceStore.db);
    expect(restarted.resourceStore.readTask("work/one")?.status).toMatchObject({
      phase: "pending",
      executionFailures: 5,
      executionRetryAt: deadline,
    });
    expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
    const tree = restarted.resourceStore.readTaskContext({ taskIds: ["work/one"] });
    expect(Object.values(tree.attempts ?? {})).toHaveLength(5);
    expect(tree.taskTriggers?.["work/one"]?.events).toHaveLength(1);
    advanceToRetry(restarted);
    finishTask(restarted);
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
    expect(getAppInboxItem(db, "other-request")?.availableAt).toBeUndefined();
    expect(restarted.resourceStore.isCancelled("work/one")).toBe(false);
    expect(readAppTaskAdmissionOutcome(restarted, "work/one", input.idempotencyKey)?.summary).toBe("Verified");
  });

  it("a newly attached human input permits progress without erasing prior failure cost", () => {
    const { db, config, input } = fixture();
    admitTaskInput(config, { ...input, inboxInputId: undefined, idempotencyKey: "earlier-request" });
    repeatFailures(config, 4);
    admitTaskInput(config, { ...input, attachment: { kind: "existing", taskId: "work/one" } });
    expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
    expect(config.resourceStore.readTask("work/one")?.status.executionFailures).toBe(4);
    expect(
      config.resourceStore.readTaskContext({ taskIds: ["work/one"] }).taskTriggers?.["work/one"]?.events,
    ).toHaveLength(2);
    finishTask(config);
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
    expect(config.resourceStore.isCancelled("work/one")).toBe(false);
  });

  it.each(["retry", "revise"])("waits for an exact answer after an authorized %s", (operation) => {
    const { db, config, input } = fixture();
    admitTaskInput(config, { ...input, inboxInputId: undefined, idempotencyKey: "earlier-request" });
    repeatFailures(config, 4);
    const task = config.resourceStore.readTask("work/one")!;
    if (operation === "retry") {
      retryFailedAppTask(config, {
        appId: "example",
        taskId: "work/one",
        expectedGeneration: task.metadata.generation,
        expectedResourceVersion: task.metadata.resourceVersion,
      });
    } else {
      const attachment = testAttachment();
      if (attachment.kind !== "desired") throw new Error("fixture");
      observeAppTaskIntent(config, {
        appAgent: config.agent,
        intent: { ...attachment.intent, outcome: "Finish the revised example" },
      });
    }
    admitTaskInput(config, { ...input, attachment: { kind: "existing", taskId: "work/one" } });
    expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
    finishTask(config);
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
  });

  it("rolls back failure facts and pacing together when retry persistence fails", () => {
    const { db, config, input } = fixture();
    admitTaskInput(config, input);
    repeatFailures(config, 3);
    advanceToRetry(config);
    const claim = claimObservedAppTask(config, {
      taskId: "work/one",
      appAgent: "example-owner",
      handler: "agent:example-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const before = readTaskSnapshot(config);
    db.exec(
      "CREATE TRIGGER fail_retry BEFORE UPDATE OF resource_json ON app_tasks WHEN NEW.app_id = 'example' AND NEW.task_id = 'work/one' AND json_extract(NEW.resource_json, '$.status.executionFailures') = 4 BEGIN SELECT RAISE(ABORT, 'retry write failure'); END",
    );
    expect(() => failAppTaskAttempt(config, claim, "Fixture execution failure")).toThrow("retry write failure");
    expect(readTaskSnapshot(config)).toEqual(before);
    expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
    db.exec("DROP TRIGGER fail_retry");
    expect(failAppTaskAttempt(config, claim, "Fixture execution failure").status).toBe("retrying");
    expect(config.resourceStore.readTask("work/one")?.status.executionFailures).toBe(4);
    expect(config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("failed");
    expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
    advanceToRetry(config);
    finishTask(config);
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
  });

  it("does not return an old attention result while new attached input is pending", () => {
    const { db, config, input } = fixture();
    admitTaskInput(config, { ...input, inboxInputId: undefined, idempotencyKey: "earlier-request" });
    const claim = claimObservedAppTask(config, {
      taskId: "work/one",
      appAgent: "example-owner",
      handler: "agent:example-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    markAppTaskAttention(config, claim, { summary: "Old blocker", reason: "fixture" });
    admitTaskInput(config, { ...input, attachment: { kind: "existing", taskId: "work/one" } });
    expect(getAppInboxItem(db, input.inputContext.id)?.availableAt).toBeUndefined();
    finishTask(config);
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
  });

  it("admits only one binding from competing processes using the same saved input", async () => {
    const { db, path, config, input } = fixture();
    const results = await Promise.all([worker(path, "attach", "left"), worker(path, "attach", "right")]);
    expect(results.filter((result) => result.exitCode === 0)).toHaveLength(1);
    const taskId = getAppInboxItem(db, input.inputContext.id)?.waitingOn?.id;
    expect(["left", "right"]).toContain(taskId);
    expect(
      [config.resourceStore.readTask("left"), config.resourceStore.readTask("right")].filter(Boolean),
    ).toHaveLength(1);
  });

  it.each(["crash-before", "crash-after"])("recovers %s commit without partially accepted work", async (action) => {
    const { db, path, config, input } = fixture();
    const result = await worker(path, action);
    expect(result.exitCode).toBe(137);
    expect(result.stderr).toBe("");
    if (action === "crash-before") {
      expect(config.resourceStore.readTask("work/one")).toBeNull();
      expect(getAppInboxItem(db, input.inputContext.id)?.waitingOn).toBeUndefined();
      expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(0);
    } else {
      expect(getAppInboxItem(db, input.inputContext.id)?.waitingOn?.id).toBe("work/one");
      expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
    }
    admitTaskInput(config, input);
    finishTask(config);
    expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey) || config.resourceStore.isCancelled("work/one")).toBeTruthy();
  });

  it("rolls back nested state writes even when their caller handles the failure", () => {
    const { db, config, input } = fixture();
    stateTransaction(config.resourceStore.db, () => {
      try {
        stateTransaction(config.resourceStore.db, () => {
          admitTaskInput(config, input);
          throw new Error("reject nested operation");
        });
      } catch {
        /* outer operation can continue; nested writes are gone */
      }
    });
    expect(config.resourceStore.readTask("work/one")).toBeNull();
    expect(getAppInboxItem(db, input.inputContext.id)?.waitingOn).toBeUndefined();
  });
});

it("runs Task-only input with no conversational frontend and keeps retained Conversation state readable", async () => {
  const { db, config } = fixture();
  const app = defineApp({
    id: "example", version: 1, agent: "example-owner",
    inputSchema: Type.Object({ kind: Type.Literal("example"), data: Type.Object({}) }),
    tasks: {}, task: () => testAttachment("work/without-chat"),
  });
  const host = new AppInboxHost({
    db, apps: [app],
    attachTask: (input) => admitTaskInput(config, input),
    readDependency: async ({ dependency }) => ({ ...dependency, status: "done", summary: "Verified", facts: ["fixture:checked"] }),
  });
  const before = readAppConversationResource(db, "example", "chat");
  host.admit({ id: "no-chat", appId: app.id, source: { kind: "system", id: "scheduler" }, input: { kind: "example", data: {} } });
  await host.recoverTaskResults();
  expect(config.resourceStore.readTask("work/without-chat")?.metadata.generation).toBe(1);
  finishTask(config, "work/without-chat");
  await host.recoverTaskResults();
  expect(host.get("no-chat")).toMatchObject({ status: "done", result: { summary: "Verified" } });
  expect(readAppConversationResource(db, "example", "chat")).toEqual(before);
  expect(listConversationTopicLinksForTask(db, app.id, "work/without-chat")).toEqual([]);
});

it("routes an exact App-only revision through the installed mapper and gives stale input one readable result", async () => {
  const { db, config } = fixture();
  const taskId = "goal/existing";
  observeAppTaskIntent(config, {
    appAgent: "example-owner",
    intent: {
      id: taskId,
      parentId: "project",
      outcome: "Original requirements",
      acceptance: ["Original acceptance"],
    },
  });
  const originalClaim = claimObservedAppTask(config, {
    taskId,
    appAgent: "example-owner",
    handler: "agent:example-owner",
  });
  if (originalClaim.kind !== "claimed") throw new Error("expected original claim");
  completeAppTask(config, originalClaim, { summary: "Original evidence", facts: ["fixture:accepted"] });
  const acceptedAttempt = config.resourceStore.readAttempt(originalClaim.attemptId);
  const notifications: Array<{ id: string; status: string; summary: string }> = [];
  const conversationUpdates: string[] = [];
  let mappings = 0;
  const mappedInputIds: string[] = [];
  const app = defineApp({
    id: "example",
    version: 1,
    agent: "example-owner",
    inputSchema: Type.Unknown(),
    tasks: {},
    task: ({ id, input }) => {
      mappings++;
      mappedInputIds.push(id);
      const data = input.data as { taskId?: string; expectedGeneration?: number; outcome?: string };
      return {
        kind: "desired" as const,
        expectedGeneration: data.expectedGeneration,
        intent: {
          id: data.taskId ?? "goal/new",
          parentId: "wrong-parent",
          outcome: data.outcome ?? "Revised requirements",
          acceptance: ["Revised acceptance"],
        },
      };
    },
  });
  const host = new AppInboxHost({
    db,
    apps: [app],
    attachTask: (input) => admitTaskInput(config, input),
    onRequestUpdated: (item, result, status) => notifications.push({ id: item.id, status, summary: result.summary }),
    onConversationChanged: (_, conversationId) => conversationUpdates.push(conversationId),
  });
  const revisionInput = {
    kind: "revision",
    data: { taskId, expectedGeneration: 1, outcome: "Corrected requirements" },
  };
  expect(
    host.admit({
      id: "revision-ok",
      appId: "example",
      source: { kind: "system", id: "supervisor" },
      input: revisionInput,
    }).item,
  ).toMatchObject({ status: "handling", waitingOn: { kind: "task", id: taskId } });
  const revised = config.resourceStore.readTask(taskId)!;
  expect(revised).toMatchObject({
    metadata: { generation: 2, creator: { appId: "example" } },
    spec: { parentId: "project", outcome: "Corrected requirements" },
  });
  expect(config.resourceStore.readAttempt(originalClaim.attemptId)).toEqual(acceptedAttempt);
  const mappingsAfterRevision = mappings;
  expect(
    host.admit({
      id: "revision-ok",
      appId: "example",
      source: { kind: "system", id: "supervisor" },
      input: revisionInput,
    }),
  ).toMatchObject({ created: false, item: { status: "handling" } });
  expect(mappings).toBe(mappingsAfterRevision);
  expect(config.resourceStore.readTask(taskId)?.metadata.generation).toBe(2);

  // A replay of the already linked exact admission remains idempotent even
  // though expectedGeneration is now stale; changed desired work is rejected.
  const saved = host.get("revision-ok")!;
  const attachment = app.task!({ id: saved.id, source: saved.source, input: saved.input });
  if (attachment.kind !== "desired") throw new Error("expected revision attachment");
  expect(
    admitTaskInput(config, {
      appId: "example",
      creator: { appId: "example" },
      creatorRevision: true,
      attachment,
      inputContext: { id: saved.id, source: saved.source, input: saved.input },
      inboxInputId: saved.id,
      idempotencyKey: "task:revision-ok",
    }),
  ).toMatchObject({ taskId, generation: 2, changed: false });
  expect(() =>
    admitTaskInput(config, {
      appId: "example",
      creator: { appId: "example" },
      creatorRevision: true,
      attachment: {
        ...attachment,
        intent: { ...attachment.intent, outcome: "Different replay" },
      },
      inputContext: { id: saved.id, source: saved.source, input: saved.input },
      inboxInputId: saved.id,
      idempotencyKey: "task:revision-ok",
    }),
  ).toThrow("different desired work");

  const stale = host.admit({
    id: "revision-stale",
    appId: "example",
    source: { kind: "app", id: "supervisor" },
    conversationId: "owner-chat",
    conversationSequence: 9,
    input: revisionInput,
  }).item;
  expect(stale).toMatchObject({
    status: "done",
    handling: { phase: "failed", reason: expect.stringContaining("current generation 2") },
    result: { response: expect.stringContaining("current expectedGeneration") },
  });
  expect(notifications).toEqual([
    { id: "revision-stale", status: "done", summary: expect.stringContaining("was not applied") },
  ]);
  expect(conversationUpdates).toEqual(["owner-chat"]);
  expect(mappedInputIds.filter((id) => id === "revision-stale")).toHaveLength(1);
  await host.recoverAdmissions();
  await host.recoverAdmissions();
  expect(mappedInputIds.filter((id) => id === "revision-stale")).toHaveLength(1);
  expect(notifications).toHaveLength(1);
  expect(
    host.admit({
      id: "revision-stale",
      appId: "example",
      source: { kind: "app", id: "supervisor" },
      conversationId: "owner-chat",
      conversationSequence: 9,
      input: revisionInput,
    }).created,
  ).toBe(false);
  expect(notifications).toHaveLength(1);
  expect(conversationUpdates).toHaveLength(1);

  const beforeAttach = config.resourceStore.readTask(taskId)!.metadata.generation;
  const mappingsBeforeAttach = mappings;
  host.admit({
    id: "ordinary-attach",
    appId: "example",
    targetTaskId: taskId,
    source: { kind: "human", id: "operator" },
    input: { kind: "revision", data: { taskId, expectedGeneration: 999, outcome: "Must not revise" } },
  });
  expect(mappings).toBe(mappingsBeforeAttach);
  expect(config.resourceStore.readTask(taskId)?.metadata.generation).toBe(beforeAttach);
});

it("rejects missing, closed, foreign, and task-bound App-mapper revision authority", async () => {
  const { db, config } = fixture();
  const seed = (id: string, creator?: { appId: string; taskId?: string }) =>
    observeAppTaskIntent(config, {
      appAgent: "example-owner",
      creator,
      intent: { id, parentId: "project", outcome: id, acceptance: ["Remain fenced"] },
    });
  seed("foreign", { appId: "other" });
  seed("self", { appId: "example", taskId: "self" });
  seed("task-bound", { appId: "example", taskId: "caller" });
  seed("closed");
  const closed = config.resourceStore.readTask("closed")!;
  cancelAppTask(config, {
    appId: "example",
    taskId: "closed",
    expectedGeneration: closed.metadata.generation,
    expectedResourceVersion: closed.metadata.resourceVersion,
    reason: "Closed fixture",
  });
  const app = defineApp({
    id: "example",
    version: 1,
    agent: "example-owner",
    inputSchema: Type.Unknown(),
    tasks: {},
    task: ({ input }) => {
      const data = input.data as { taskId: string };
      return {
        kind: "desired" as const,
        expectedGeneration: 1,
        intent: { id: data.taskId, parentId: "project", outcome: "Changed", acceptance: ["Changed"] },
      };
    },
  });
  const host = new AppInboxHost({ db, apps: [app], attachTask: (input) => admitTaskInput(config, input) });
  for (const [id, expected] of [
    ["missing", "does not exist"],
    ["closed", "closed Task"],
    ["foreign", "exact App-only creator"],
    ["self", "exact App-only creator"],
    ["task-bound", "exact App-only creator"],
  ] as const) {
    const item = host.admit({
      id: `reject-${id}`,
      appId: "example",
      source: { kind: "system", id: "supervisor" },
      input: { kind: "revision", data: { taskId: id } },
    }).item;
    expect(item).toMatchObject({ status: "done", result: { summary: expect.stringContaining(expected) } });
  }

  // A delegated input retains its task-bound provenance and cannot masquerade
  // as App-only merely because the mapper asks for an App-owned target.
  seed("app-owned");
  createAppInboxItem(db, {
    id: "delegated-masquerade",
    appId: "example",
    creator: { appId: "example", taskId: "caller" },
    source: { kind: "app", id: "example" },
    input: { kind: "revision", data: { taskId: "app-owned" } },
  });
  await host.recoverAdmissions();
  expect(host.get("delegated-masquerade")).toMatchObject({
    status: "done",
    result: { summary: expect.stringContaining("trusted App-only creator authority") },
  });
});

it("recovers only an exact, unambiguous historical admission key", () => {
  const { db, config, input } = fixture();
  admitTaskInput(config, input);
  finishTask(config);
  db.prepare("UPDATE app_inbox_items SET task_admission_key = NULL WHERE id = ?").run(input.inputContext.id);
  const item = getAppInboxItem(db, input.inputContext.id)!;
  expect(recoverTaskInputAdmissionKey(db, item)).toBe(input.idempotencyKey);
  expect(readAppTaskAdmissionOutcome(config, "work/one", input.idempotencyKey)?.summary).toBe("Verified");
  // Two historical admissions cannot be collapsed into a guessed input answer.
  admitTaskInput(config, { ...input, inboxInputId: undefined, idempotencyKey: `task:${item.id}:existing:work/one` });
  db.prepare("UPDATE app_inbox_items SET task_admission_key = NULL WHERE id = ?").run(item.id);
  expect(recoverTaskInputAdmissionKey(db, item)).toBeUndefined();
});

it("recovers equivalent historical aliases without reopening cancelled work", async () => {
  const { db, config, input } = fixture();
  admitTaskInput(config, input);
  const current = config.resourceStore.readTask("work/one")!;
  cancelAppTask(config, {
    appId: "example", taskId: "work/one", reason: "Superseded work",
    expectedGeneration: current.metadata.generation, expectedResourceVersion: current.metadata.resourceVersion,
  });
  const original = config.resourceStore.readTaskContext({ taskIds: [], admissionIds: [input.idempotencyKey] })
    .appTaskAdmissions![input.idempotencyKey]!;
  const alias = `task:${input.inputContext.id}:existing:work/one`;
  expect(config.resourceStore.commit({ fences: [{ taskId: "work/one", resourceVersion: config.resourceStore.readTask("work/one")!.metadata.resourceVersion }], admissions: [{ taskId: alias, value: { ...original, admittedAt: "2000-01-01T00:00:00.000Z" } }] })).toBe(true);
  db.prepare("UPDATE app_inbox_items SET task_admission_key = NULL WHERE id = ?").run(input.inputContext.id);
  const before = config.resourceStore.readSnapshot();
  const host = new AppInboxHost({
    db,
    apps: [defineApp({ id: "example", version: 1, agent: "example-owner", inputSchema: Type.Unknown(), tasks: {}, task: () => testAttachment() })],
    attachTask: (request) => admitTaskInput(config, request),
    readDependency: async ({ dependency }) => {
      const closure = config.resourceStore.readCancellation(dependency.id)!;
      return { ...dependency, status: "attention", summary: closure.summary!, response: closure.response, facts: closure.facts ?? [] };
    },
  });
  await host.recoverTaskResults();
  expect(host.get(input.inputContext.id)).toMatchObject({ status: "done", taskAdmissionKey: input.idempotencyKey, result: { summary: "Cancelled by human: Superseded work" } });
  expect(config.resourceStore.readSnapshot()).toEqual(before);
  await host.recoverTaskResults();
  expect(config.resourceStore.readSnapshot()).toEqual(before);
  host.close();
});

it("keeps conflicting alias generations, specifications, accepted results and feedback unlinked", () => {
  for (const patch of [
    { taskGeneration: 2 }, { specHash: "different" }, { resultAttemptId: "different-answer" },
    { reportAttemptId: "different-feedback" }, { inputEvent: { type: "different-input" } },
  ]) {
    const { db, config, input } = fixture();
    admitTaskInput(config, input);
    const original = config.resourceStore.readTaskContext({ taskIds: [], admissionIds: [input.idempotencyKey] })
      .appTaskAdmissions![input.idempotencyKey]!;
    expect(config.resourceStore.commit({ fences: [{ taskId: "work/one", resourceVersion: config.resourceStore.readTask("work/one")!.metadata.resourceVersion }], admissions: [{ taskId: `task:${input.inputContext.id}:existing:work/one`, value: { ...original, ...patch } }] })).toBe(true);
    db.prepare("UPDATE app_inbox_items SET task_admission_key = NULL WHERE id = ?").run(input.inputContext.id);
    expect(recoverTaskInputAdmissionKey(db, getAppInboxItem(db, input.inputContext.id)!)).toBeUndefined();
    expect(getAppInboxItem(db, input.inputContext.id)?.taskAdmissionKey).toBeUndefined();
  }
});
