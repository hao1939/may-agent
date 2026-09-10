import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { AppTaskResourceStore } from "../../app-task-resource-store.js";
import { cacheTaskSnapshots, readTaskSnapshot } from "../../app-task-store.js";
import {
  claimAppInboxItem,
  createAppInboxItem,
  getAppInboxItem,
  waitAppInboxClaim,
  wakeAppInboxItem,
} from "../../app-inbox-store.js";
import { createConversationTopic, listConversationTopicLinksForTask } from "./conversations.js";
import {
  cancelAppTask,
  claimObservedAppTask,
  completeAppTask,
  failAppTaskAttempt,
  markAppTaskAttention,
  observeAppTaskIntent,
  retryFailedAppTask,
  stopAppTask,
} from "../../app-task-reconciler.js";
import { failTask, finishTask, openState, testAttachment } from "../../../../test/fixtures/request-task-state.js";
import { admitTaskRequest, attachRequestToTask } from "./inbox.js";

const roots: string[] = [];
const connections: SqliteDb[] = [];
afterEach(() => {
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
  const claim = claimAppInboxItem(db, item.id, "handler-one", 60_000)!;
  const config = openState(path);
  connections.push(config.resourceStore.db);
  const input = {
    appId: "example",
    attachment: testAttachment(),
    idempotencyKey: "task:request-one",
    request: { id: item.id, source: item.source, input: item.input },
    claim,
  };
  return { db, path, config, input };
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
      admitTaskRequest(config, {
        ...input,
        authorize: () => {
          throw new Error("turn stopped");
        },
      }),
    ).toThrow("turn stopped");
    expect(config.resourceStore.readTask("work/one")).toBeNull();
    expect(() => admitTaskRequest(config, { ...input, topicId: "missing" })).toThrow();
    expect(config.resourceStore.readTask("work/one")).toBeNull();
    admitTaskRequest(config, { ...input, topicId: "topic" });
    expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
  });
  it("commits Task input, exact dependency, Topic and Conversation claim release together", () => {
    const { db, config, input } = fixture();
    attachRequestToTask(config, input);
    expect(getAppInboxItem(db, input.request.id)).toMatchObject({ waitingOn: { kind: "task", id: "work/one" } });
    expect(getAppInboxItem(db, input.request.id)?.lease).toBeUndefined();
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
    const first = attachRequestToTask(config, input);
    const revision = config.resourceStore.revision();
    expect(attachRequestToTask(config, input)).toMatchObject({ taskId: first.taskId, generation: first.generation });
    expect(config.resourceStore.revision()).toBe(revision);
    expect(
      config.resourceStore.readTaskContext({ taskIds: [first.taskId] }).taskTriggers?.[first.taskId]?.events,
    ).toHaveLength(1);
    expect(() => attachRequestToTask(config, { ...input, attachment: testAttachment("different") })).toThrow();
    expect(config.resourceStore.readTask("different")).toBeNull();
    const changed = testAttachment();
    if (changed.kind !== "desired") throw new Error("fixture");
    changed.intent.outcome = "Different desired work";
    expect(() => attachRequestToTask(config, { ...input, attachment: changed })).toThrow("different desired work");
    expect(() =>
      attachRequestToTask(config, { ...input, idempotencyKey: "try-another-key", attachment: changed }),
    ).toThrow("identity must belong");
    expect(() =>
      attachRequestToTask(config, { ...input, request: { ...input.request, input: { kind: "changed", data: {} } } }),
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
    expect(getAppInboxItem(db, input.request.id)?.waitingOn).toBeUndefined();
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
    const now = input.claim.item.lease!.expiresAt + 1;
    const claim = claimAppInboxItem(db, input.request.id, "restarted-handler", 60_000, now)!;
    const resumed = {
      ...input,
      claim,
      now,
      attachment: kind === "existing" ? ({ kind, taskId: "work/one" } as const) : desired,
    };
    db.exec(
      "CREATE TRIGGER fail_topic BEFORE INSERT ON conversation_topic_tasks BEGIN SELECT RAISE(ABORT, 'link failure'); END",
    );
    expect(() => attachRequestToTask(config, resumed)).toThrow("link failure");
    expect(admissions()?.[input.idempotencyKey]).toBeUndefined();
    expect(admissions()?.[legacyKey]).toEqual(accepted);
    expect(getAppInboxItem(db, input.request.id)?.lease?.owner).toBe("restarted-handler");
    db.exec("DROP TRIGGER fail_topic");
    const result = attachRequestToTask(config, resumed);
    expect(result.taskId).toBe("work/one");
    expect(admissions()?.[input.idempotencyKey]).toBeUndefined();
    expect(admissions()?.[legacyKey]).toEqual(accepted);
    expect(config.resourceStore.readTaskContext({ taskIds: ["work/one"] }).taskTriggers).toEqual(before.taskTriggers);
    expect(getAppInboxItem(db, input.request.id)?.waitingOn?.id).toBe("work/one");
    expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
    expect(Boolean(getAppInboxItem(db, input.request.id)?.availableAt)).toBe(completed);
    const revision = config.resourceStore.revision();
    attachRequestToTask(config, resumed);
    expect(config.resourceStore.revision()).toBe(revision);
  });

  it("rejects changed desired work but can recover its prior admission as an existing Task", () => {
    const { db, config, input } = fixture();
    const legacyKey = "task:request-one:desired:work/one";
    admitTaskRequest(config, { ...input, idempotencyKey: legacyKey });
    const before = config.resourceStore.readTaskContext({ taskIds: ["work/one"] }).taskTriggers;
    const changed = testAttachment();
    if (changed.kind !== "desired") throw new Error("fixture");
    changed.intent.outcome = "Different work";
    expect(() => attachRequestToTask(config, { ...input, attachment: changed })).toThrow("different desired work");
    expect(getAppInboxItem(db, input.request.id)?.waitingOn).toBeUndefined();
    expect(getAppInboxItem(db, input.request.id)?.lease?.owner).toBe(input.claim.owner);
    attachRequestToTask(config, { ...input, attachment: { kind: "existing", taskId: "work/one" } });
    expect(config.resourceStore.readTaskContext({ taskIds: ["work/one"] }).taskTriggers).toEqual(before);
    expect(getAppInboxItem(db, input.request.id)?.waitingOn?.id).toBe("work/one");
  });

  it("rejects an expired or superseded request claim before creating Task work", () => {
    const { db, config, input } = fixture();
    expect(() => attachRequestToTask(config, { ...input, now: input.claim.item.lease!.expiresAt + 1 })).toThrow(
      "claim is stale",
    );
    expect(
      claimAppInboxItem(db, input.request.id, "new-owner", 60_000, input.claim.item.lease!.expiresAt + 1),
    ).not.toBeNull();
    expect(() => attachRequestToTask(config, input)).toThrow("claim is stale");
    expect(config.resourceStore.readTask("work/one")).toBeNull();
  });

  it("rolls back admission, wait, and cached state when Topic linking fails", () => {
    const { db, config, input } = fixture();
    cacheTaskSnapshots(config);
    readTaskSnapshot(config);
    db.exec(
      "CREATE TRIGGER fail_topic BEFORE INSERT ON conversation_topic_tasks BEGIN SELECT RAISE(ABORT, 'link failure'); END",
    );
    expect(() => attachRequestToTask(config, input)).toThrow("link failure");
    expect(getAppInboxItem(db, input.request.id)?.lease?.owner).toBe("handler-one");
    expect(config.resourceStore.readTask("work/one")).toBeNull();
    expect(
      config.resourceStore.readTaskContext({ taskIds: [], admissionIds: [input.idempotencyKey] }).appTaskAdmissions?.[
        input.idempotencyKey
      ],
    ).toBeUndefined();
    db.exec("DROP TRIGGER fail_topic");
    attachRequestToTask(config, { ...input, attachment: testAttachment("recomputed") });
    expect(readTaskSnapshot(config).resources?.["work/one"]).toBeUndefined();
    expect(readTaskSnapshot(config).resources?.recomputed).toBeDefined();
  });

  it("leaves a request ready when matching work completed before attachment", () => {
    const { db, config, input } = fixture();
    admitTaskRequest(config, { ...input, idempotencyKey: "earlier-request" });
    finishTask(config);
    attachRequestToTask(config, input);
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
    expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
  });

  it("does not treat an older receipt as completion of a changed generation", () => {
    const { db, config, input } = fixture();
    admitTaskRequest(config, { ...input, idempotencyKey: "earlier-request" });
    finishTask(config);
    const changed = testAttachment();
    if (changed.kind !== "desired") throw new Error("fixture");
    changed.intent.outcome = "New generation";
    attachRequestToTask(config, { ...input, attachment: changed });
    expect(config.resourceStore.readTask("work/one")?.metadata.generation).toBe(2);
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeUndefined();
  });

  it("persists a completion wake across processes without an EventBus and scopes it to the App", async () => {
    const { db, path, config, input } = fixture();
    attachRequestToTask(config, input);
    createAppInboxItem(db, {
      id: "other-request",
      appId: "other",
      source: { kind: "system", id: "test" },
      input: input.request.input,
    });
    const other = claimAppInboxItem(db, "other-request", "other-handler", 60_000)!;
    waitAppInboxClaim(db, other, { kind: "task", id: "work/one" });
    expect(await worker(path, "complete")).toEqual({ exitCode: 0, stderr: "" });
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
    expect(getAppInboxItem(db, "other-request")?.availableAt).toBeUndefined();
  });

  it.each(["attention", "cancel"])("persists request readiness for %s without a notification", (operation) => {
    const { db, config, input } = fixture();
    attachRequestToTask(config, input);
    if (operation === "attention") {
      const claim = claimObservedAppTask(config, {
        taskId: "work/one",
        appAgent: "example-owner",
        handler: "agent:example-owner",
      });
      if (claim.kind !== "claimed") throw new Error("expected claim");
      markAppTaskAttention(config, claim, { summary: "Needs a decision", reason: "fixture" });
    } else {
      const current = config.resourceStore.readTask("work/one")!;
      cancelAppTask(config, {
        appId: "example",
        taskId: "work/one",
        expectedGeneration: current.metadata.generation,
        expectedResourceVersion: current.metadata.resourceVersion,
        reason: "stop",
      });
    }
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
  });

  it.each(["complete", "stop"])("cannot commit a Task %s without its durable request wake", (decision) => {
    const { db, config, input } = fixture();
    attachRequestToTask(config, input);
    const claim = claimObservedAppTask(config, {
      taskId: "work/one",
      appAgent: "example-owner",
      handler: "agent:example-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const settle = () =>
      decision === "stop"
        ? stopAppTask(config, claim, { summary: "Optional work is not feasible", evidence: ["fixture:feasibility"] })
        : completeAppTask(config, claim, { summary: "Verified", evidence: [] });
    db.exec(
      "CREATE TRIGGER fail_wake BEFORE UPDATE OF available_at ON app_inbox_items WHEN NEW.available_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'wake failure'); END",
    );
    expect(settle).toThrow("wake failure");
    expect(config.resourceStore.readReceipt("work/one")).toBeNull();
    expect(config.resourceStore.readCancellation("work/one")).toBeNull();
    expect(config.resourceStore.readTask("work/one")?.status.phase).toBe("running");
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeUndefined();
    db.exec("DROP TRIGGER fail_wake");
    expect(settle().status).toBe("applied");
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
  });

  it("durably readies the linked request when retries exhaust without an EventBus or executable parent", async () => {
    const { db, path, config, input } = fixture();
    attachRequestToTask(config, input);
    createAppInboxItem(db, {
      id: "other-request",
      appId: "other",
      source: { kind: "system", id: "test" },
      input: input.request.input,
    });
    const other = claimAppInboxItem(db, "other-request", "other-handler", 60_000)!;
    waitAppInboxClaim(db, other, { kind: "task", id: "work/one" });
    for (let failure = 1; failure <= 3; failure++) {
      expect(failTask(config).status).toBe("retrying");
      expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeUndefined();
    }
    // The last failure commits in a different process; no in-memory wake survives it.
    expect(await worker(path, "fail")).toEqual({ exitCode: 0, stderr: "" });
    expect(config.resourceStore.readTask("work/one")?.status).toMatchObject({
      phase: "attention",
      executionFailures: 4,
    });
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
    expect(getAppInboxItem(db, "other-request")?.availableAt).toBeUndefined();
    const review = claimAppInboxItem(db, input.request.id, "reviewer", 60_000);
    expect(review?.item.waitingOn).toEqual({ kind: "task", id: "work/one" });
    const restarted = openState(path);
    connections.push(restarted.resourceStore.db);
    expect(
      claimObservedAppTask(restarted, {
        taskId: "work/one",
        appAgent: "example-owner",
        handler: "agent:example-owner",
      }).kind,
    ).toBe("attention");
    const tree = restarted.resourceStore.readTaskContext({ taskIds: ["work/one"] });
    expect(Object.values(tree.attempts ?? {})).toHaveLength(4);
    expect(tree.taskTriggers?.["work/one"]?.events).toHaveLength(1);
  });

  it("readies a request attached after exhaustion without authorizing another execution", () => {
    const { db, config, input } = fixture();
    admitTaskRequest(config, { ...input, idempotencyKey: "earlier-request" });
    for (let failure = 0; failure < 4; failure++) failTask(config);
    attachRequestToTask(config, { ...input, attachment: { kind: "existing", taskId: "work/one" } });
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
    expect(
      claimObservedAppTask(config, {
        taskId: "work/one",
        appAgent: "example-owner",
        handler: "agent:example-owner",
      }).kind,
    ).toBe("attention");
    expect(
      config.resourceStore.readTaskContext({ taskIds: ["work/one"] }).taskTriggers?.["work/one"]?.events,
    ).toHaveLength(2);
  });

  it.each(["retry", "revise"])("does not return exhausted attention after an authorized %s", (operation) => {
    const { db, config, input } = fixture();
    admitTaskRequest(config, { ...input, idempotencyKey: "earlier-request" });
    for (let failure = 0; failure < 4; failure++) failTask(config);
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
    attachRequestToTask(config, { ...input, attachment: { kind: "existing", taskId: "work/one" } });
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeUndefined();
    finishTask(config);
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
  });

  it("rolls back the final execution failure if its request wake cannot commit", () => {
    const { db, config, input } = fixture();
    attachRequestToTask(config, input);
    for (let failure = 0; failure < 3; failure++) failTask(config);
    const claim = claimObservedAppTask(config, {
      taskId: "work/one",
      appAgent: "example-owner",
      handler: "agent:example-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    db.exec(
      "CREATE TRIGGER fail_wake BEFORE UPDATE OF available_at ON app_inbox_items WHEN NEW.available_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'wake failure'); END",
    );
    expect(() => failAppTaskAttempt(config, claim, "Fixture execution failure")).toThrow("wake failure");
    expect(config.resourceStore.readTask("work/one")?.status).toMatchObject({ phase: "running", executionFailures: 3 });
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeUndefined();
    db.exec("DROP TRIGGER fail_wake");
    expect(failAppTaskAttempt(config, claim, "Fixture execution failure").status).toBe("attention");
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
  });

  it("does not return an old attention result while new attached input is pending", () => {
    const { db, config, input } = fixture();
    admitTaskRequest(config, { ...input, idempotencyKey: "earlier-request" });
    const claim = claimObservedAppTask(config, {
      taskId: "work/one",
      appAgent: "example-owner",
      handler: "agent:example-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    markAppTaskAttention(config, claim, { summary: "Old blocker", reason: "fixture" });
    attachRequestToTask(config, { ...input, attachment: { kind: "existing", taskId: "work/one" } });
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeUndefined();
    finishTask(config);
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
  });

  it("keeps intentional replacement separate from retry and does not re-admit it on review", () => {
    const { db, config, input } = fixture();
    attachRequestToTask(config, input);
    wakeAppInboxItem(db, input.request.id);
    const claim = claimAppInboxItem(db, input.request.id, "review", 60_000)!;
    attachRequestToTask(config, {
      ...input,
      claim,
      attachment: testAttachment("replacement"),
      idempotencyKey: `task:request-one:replace:${claim.generation}`,
    });
    const revision = config.resourceStore.revision();
    wakeAppInboxItem(db, input.request.id);
    const next = claimAppInboxItem(db, input.request.id, "next-review", 60_000)!;
    attachRequestToTask(config, { ...input, claim: next, attachment: { kind: "existing", taskId: "replacement" } });
    expect(config.resourceStore.revision()).toBe(revision);
    expect(getAppInboxItem(db, input.request.id)?.waitingOn?.id).toBe("replacement");
  });

  it("admits only one binding from competing processes using the same request claim", async () => {
    const { db, path, config, input } = fixture();
    const results = await Promise.all([worker(path, "attach", "left"), worker(path, "attach", "right")]);
    expect(results.filter((result) => result.exitCode === 0)).toHaveLength(1);
    const taskId = getAppInboxItem(db, input.request.id)?.waitingOn?.id;
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
      expect(getAppInboxItem(db, input.request.id)?.waitingOn).toBeUndefined();
      expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(0);
    } else {
      expect(getAppInboxItem(db, input.request.id)?.waitingOn?.id).toBe("work/one");
      expect(listConversationTopicLinksForTask(db, "example", "work/one")).toHaveLength(1);
    }
    attachRequestToTask(config, input);
    finishTask(config);
    expect(getAppInboxItem(db, input.request.id)?.availableAt).toBeNumber();
  });

  it("rolls back nested state writes even when their caller handles the failure", () => {
    const { db, config, input } = fixture();
    stateTransaction(config.resourceStore.db, () => {
      try {
        stateTransaction(config.resourceStore.db, () => {
          admitTaskRequest(config, input);
          throw new Error("reject nested operation");
        });
      } catch {
        /* outer operation can continue; nested writes are gone */
      }
    });
    expect(config.resourceStore.readTask("work/one")).toBeNull();
    expect(getAppInboxItem(db, input.request.id)?.waitingOn).toBeUndefined();
  });
});
