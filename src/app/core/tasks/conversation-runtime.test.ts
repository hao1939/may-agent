import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type AppInputContext, type ConversationTurnResult, type TaskAttempt } from "@may-agent/sdk";
import type { SubagentManager } from "../../../lib/index.js";
import type { CallOptions, SubagentDefinition } from "../../../lib/types.js";
import { getDb, closeDb } from "../../../lib/requests.js";
import { EventBus, EVENT_DELIVERY_RESULT, EVENT_ROW_ID, type AgentEvent } from "../events/bus.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { AppRegistry } from "../apps/registry.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import { startAppInboxRuntime } from "../../composition/app-inbox-runtime.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitConversationTaskInput, listPendingConversationTaskChanges } from "../state/conversation-task-turns.js";
import { getAppInboxItem, claimAppInboxItem, listAppInboxItems } from "../state/app-inbox-store.js";
import { readAppConversationResource } from "../state/conversations.js";
import { readConversationRequest, applyConversationRequestUpdates } from "../state/conversation-requests.js";
import { createTaskExecutionBackends } from "../../composition/task-execution.js";
import { appTaskContext, observeAppTaskIntent } from "./app-task-reconciler.js";
import { readTaskSnapshot } from "./app-task-store.js";
import { APP_TASK_RECOVERY_OWNER } from "./session-binding.js";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  wakeLoadedAppTasks,
  cancelLoadedAppTask,
  reconcileLoadedAppTaskOnce,
  type AppTaskRuntimeOptions,
} from "./app-task-runtime.js";

const dispose: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of dispose.splice(0)) await close();
});

const app = defineApp({
  id: "chat",
  version: 1,
  agent: "chat-agent",
  requests: { mode: "agent" },
  inputSchema: Type.Object({ kind: Type.String(), data: Type.Object({}, { additionalProperties: true }) }),
});
const answer: ConversationTurnResult = {
  summary: "Compared options",
  response: "A costs less; B is faster.",
  topic: { kind: "new", title: "Options" },
  requestUpdates: [
    {
      id: "compare",
      expectedRevision: 0,
      scope: "Compare A and B",
      disposition: "fulfilled",
      reason: "Compared cost and speed",
    },
  ],
};

function eventAfter(bus: EventBus, match: (event: AgentEvent) => boolean) {
  return new Promise<AgentEvent>((resolve, reject) => {
    const recent: AgentEvent[] = [];
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`Expected runtime event was not emitted: ${JSON.stringify(recent)}`));
    }, 3_000);
    const stop = bus.listen((event) => {
      recent.push(event);
      if (recent.length > 5) recent.shift();
      if (!match(event)) return;
      clearTimeout(timer);
      stop();
      resolve(event);
    });
  });
}
function settled(bus: EventBus, taskId: string) {
  return eventAfter(bus, (event) => event.type === "project.task.reconcile.profiled" && event.data.taskId === taskId);
}

async function fixture(
  execute: (
    _definition: SubagentDefinition,
    prompt: string,
    options: CallOptions,
  ) => Promise<{ status: "done"; structuredResult: ConversationTurnResult }>,
  extra: Partial<AppTaskRuntimeOptions> | ((root: string, appDir: string) => Partial<AppTaskRuntimeOptions>) = {},
) {
  const root = mkdtempSync(join(tmpdir(), "may-conversation-runtime-"));
  const appDir = join(root, "chat.app");
  mkdirSync(appDir);
  const configured = typeof extra === "function" ? extra(root, appDir) : extra;
  let bus = new EventBus();
  let db = getDb(root);
  let store: AppTaskResourceStore;
  const manager = {
    getAgentDefinition: () => ({ name: "chat-agent", tools: [] }),
    callAgentDefinition: execute,
  } as unknown as SubagentManager;
  const install = async () => {
    const options: AppTaskRuntimeOptions = {
      projectRoot: root,
      projectsRoot: root,
      persistDir: root,
      bus,
      hostCapacity: new HostCapacity(1),
      conversations: createTaskExecutionBackends({ manager, bus }).conversations,
      appRegistrySnapshot: { id: "conversation-runtime", generation: 1, entries: [{ appDir, definition: app }] },
      ...configured,
    };
    await installAppTaskRuntimes(options, { deferRecovery: true });
    store = AppTaskResourceStore.activeFromDb(db, app.id)!;
    return options;
  };
  const options = await install();
  const context = () =>
    appTaskContext({ appDir, projectDir: appDir, agent: app.agent!, maxConcurrent: 1, resourceStore: store });
  const admit = (id = "ask", text = "Compare A and B") =>
    admitConversationTaskInput(context(), {
      id,
      appId: app.id,
      conversationId: "primary",
      conversationSequence: 1,
      source: { kind: "human", id },
      input: { kind: "message", data: { text } },
      intent: {
        parentId: "root",
        mode: "maintain",
        outcome: "Discuss with the human",
        acceptance: ["Address the input"],
        executor: "conversation",
      },
    });
  dispose.push(async () => {
    await closeInstalledAppTaskRuntimes(bus);
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    appDir,
    options,
    context,
    admit,
    get bus() {
      return bus;
    },
    get db() {
      return db;
    },
    get store() {
      return store;
    },
    async reopen() {
      await closeInstalledAppTaskRuntimes(bus);
      closeDb(root);
      bus = new EventBus();
      db = getDb(root);
      return install();
    },
  };
}

test("Conversation-only App uses normal runtime claims, paced failure and reply settlement", async () => {
  const calls: CallOptions[] = [];
  const f = await fixture(async (_definition, prompt, options) => {
    expect(prompt).toContain("Compare A and B");
    expect(options.recoveryOwner).toBe(APP_TASK_RECOVERY_OWNER);
    expect(options.taskBinding?.appId).toBe(app.id);
    expect(claimAppInboxItem(f.db, "ask", "old-inbox", 1_000)).toBeNull();
    calls.push(options);
    if (calls.length === 1) throw new Error("Model temporarily unavailable");
    return { status: "done", structuredResult: answer };
  });
  expect(f.store.rootTaskId()).toBe("root");
  const admitted = f.admit();
  const failed = settled(f.bus, admitted.taskId);
  wakeLoadedAppTasks({ bus: f.bus, appId: app.id, taskIds: [admitted.taskId, admitted.taskId] });
  await failed;
  expect(calls).toHaveLength(1);
  const cooldown = f.store.readTask(admitted.taskId)!;
  expect(cooldown.status.executionFailures).toBe(1);
  expect(cooldown.status.executionRetryAt).toBeDefined();
  expect(getAppInboxItem(f.db, admitted.item.id)?.status).not.toBe("done");
  expect(readConversationRequest(f.db, app.id, "primary", "compare")).toBeNull();
  const completed = settled(f.bus, admitted.taskId);
  await completed; // The real recovery timer performs the retry; the fixture does not.
  expect(calls).toHaveLength(2);
  expect(new Set(calls.map((call) => call.taskBinding?.taskId))).toEqual(new Set([admitted.taskId]));
  expect(new Set(calls.map((call) => call.taskBinding?.attemptId)).size).toBe(2);
  expect(getAppInboxItem(f.db, admitted.item.id)).toMatchObject({ status: "done" });
  expect(readConversationRequest(f.db, app.id, "primary", "compare")?.status).toBe("closed");
  expect(readAppConversationResource(f.db, app.id, "primary").messages.at(-1)?.text).toBe(answer.response);
  expect(f.store.isCancelled(admitted.taskId)).toBe(false);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(
    f.db.prepare("SELECT id FROM app_inbox_items WHERE lease_owner IS NOT NULL OR lease_generation != 0").all(),
  ).toEqual([]);
});

test("Conversation admission survives reopen and runs without an ingress wake", async () => {
  let calls = 0;
  const f = await fixture(async () => {
    calls++;
    return { status: "done", structuredResult: answer };
  });
  const admitted = f.admit();
  await f.reopen();
  await settled(f.bus, admitted.taskId);
  expect(calls).toBe(1);
  expect(getAppInboxItem(f.db, admitted.item.id)?.status).toBe("done");
  expect(f.admit().created).toBe(false);
  expect(Object.keys(readTaskSnapshot(f.context()).resources!)).toEqual([admitted.taskId]);
});

test("owner closure aborts the common attempt and rejects a late Conversation reply", async () => {
  const started = Promise.withResolvers<CallOptions>();
  const release = Promise.withResolvers<void>();
  const f = await fixture(async (_definition, _prompt, options) => {
    started.resolve(options);
    await release.promise;
    return { status: "done", structuredResult: answer };
  });
  const admitted = f.admit();
  const finished = settled(f.bus, admitted.taskId);
  wakeLoadedAppTasks({ bus: f.bus, appId: app.id, taskIds: [admitted.taskId] });
  const options = await started.promise;
  try {
    const aborted = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Task closure did not abort its executor")), 1_000);
      options.signal!.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
    const current = f.store.readTask(admitted.taskId)!;
    cancelLoadedAppTask({
      bus: f.bus,
      appId: app.id,
      taskId: admitted.taskId,
      expectedGeneration: current.metadata.generation,
      expectedResourceVersion: current.metadata.resourceVersion,
      reason: "Owner withdrew the assignment",
    });
    await aborted;
    expect(options.signal?.aborted).toBe(true);
  } finally {
    release.resolve();
  }
  await finished;
  expect(f.store.isCancelled(admitted.taskId)).toBe(true);
  expect(readConversationRequest(f.db, app.id, "primary", "compare")).toBeNull();
  expect(
    readAppConversationResource(f.db, app.id, "primary").messages.some((message) => message.author.kind === "agent"),
  ).toBe(false);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
});

test("worker execution entry settles Conversation decisions without an inbox controller", async () => {
  const f = await fixture(async () => ({ status: "done", structuredResult: answer }), { installControllers: false });
  const admitted = f.admit();
  await reconcileLoadedAppTaskOnce({
    bus: f.bus,
    appId: app.id,
    taskId: admitted.taskId,
    dispatch: { lane: "ordinary", enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0 },
  });
  expect(getAppInboxItem(f.db, admitted.item.id)?.result?.response).toBe(answer.response);
  expect(f.store.isCancelled(admitted.taskId)).toBe(false);
});

test("an unrelated executor named conversation retains the ordinary Task contract", async () => {
  let conversationCalls = 0;
  const definition = defineApp({ ...app, tasks: { subscriptions: [], resolve: () => null } });
  const f = await fixture(
    async () => {
      conversationCalls++;
      return { status: "done", structuredResult: answer };
    },
    (_root, appDir) => ({
      appRegistrySnapshot: { id: "ordinary", generation: 1, entries: [{ appDir, definition }] },
      executors: { conversation: async () => ({ state: "converged", summary: "Ordinary executor", evidence: [] }) },
    }),
  );
  observeAppTaskIntent(f.context(), {
    appAgent: app.agent!,
    intent: {
      id: "ordinary",
      parentId: "root",
      mode: "achieve",
      executor: "conversation",
      outcome: "Ordinary work",
      acceptance: ["Handled"],
    },
  });
  const completed = settled(f.bus, "ordinary");
  wakeLoadedAppTasks({ bus: f.bus, appId: app.id, taskIds: ["ordinary"] });
  await completed;
  expect(conversationCalls).toBe(0);
  expect(f.store.readTask("ordinary")?.status.summary).toBe("Ordinary executor");
});

const background = defineApp({
  id: "measurement",
  version: 1,
  agent: "measurement-agent",
  inputSchema: Type.Object({ kind: Type.Literal("measure"), data: Type.Object({}) }),
  task: () => ({
    kind: "desired",
    intent: {
      id: "sample",
      parentId: "root",
      mode: "achieve",
      outcome: "Get the sample measurement",
      acceptance: ["Measurement obtained"],
      executor: "measure",
    },
  }),
  tasks: { subscriptions: [], resolve: () => null },
});
const delegated: ConversationTurnResult = {
  summary: "Delegated measurement",
  response: "I will get the measurement and report it here.",
  topic: { kind: "new", title: "Measurement" },
  requestUpdates: [{ id: "measurement", expectedRevision: 0, scope: "Get the measurement", disposition: "open" }],
  followUp: {
    appId: background.id,
    input: { kind: "measure", data: {} },
    requestId: "measurement",
    outcome: "Get the sample measurement",
    acceptance: ["Measurement obtained"],
  },
};
function withBackground(root: string, appDir: string, conversation = app): Partial<AppTaskRuntimeOptions> {
  const targetDir = join(root, "measurement.app");
  mkdirSync(join(targetDir, "tasks"), { recursive: true });
  writeFileSync(
    join(targetDir, "tasks", "seed.json"),
    JSON.stringify({
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    }),
  );
  return {
    appRegistrySnapshot: {
      id: "delegation",
      generation: 1,
      entries: [
        { appDir, definition: conversation },
        { appDir: targetDir, definition: background },
      ],
    },
  };
}

test("failed reply transaction admits no background work; paced retry wakes the other App after commit", async () => {
  let judgments = 0;
  let backgroundRuns = 0;
  const f = await fixture(
    async () => {
      judgments++;
      return { status: "done", structuredResult: delegated };
    },
    (root, appDir) => ({
      ...withBackground(root, appDir),
      executors: {
        measure: async () => {
          backgroundRuns++;
          expect(getAppInboxItem(f.db, "ask")?.result?.response).toBe(delegated.response);
          expect(readConversationRequest(f.db, app.id, "primary", "measurement")?.status).toBe("open");
          return { state: "converged", summary: "Sample is 17", evidence: ["measurement:17"] };
        },
      },
    }),
  );
  f.db.exec(`CREATE TRIGGER reject_reply BEFORE UPDATE OF result ON app_inbox_items
    WHEN NEW.result IS NOT NULL BEGIN SELECT RAISE(ABORT, 'reply unavailable'); END`);
  const admitted = f.admit("ask", "Get the measurement and report it here");
  const failed = settled(f.bus, admitted.taskId);
  wakeLoadedAppTasks({ bus: f.bus, appId: app.id, taskIds: [admitted.taskId] });
  await failed;
  expect(judgments).toBe(1);
  expect(backgroundRuns).toBe(0);
  expect(AppTaskResourceStore.activeFromDb(f.db, background.id)?.readTask("sample")).toBeNull();
  expect(readConversationRequest(f.db, app.id, "primary", "measurement")).toBeNull();
  expect(f.store.readTask(admitted.taskId)?.status.executionRetryAt).toBeDefined();
  f.db.exec("DROP TRIGGER reject_reply");
  await settled(f.bus, "sample");
  expect(judgments).toBe(2);
  expect(backgroundRuns).toBe(1);
  expect(readConversationRequest(f.db, app.id, "primary", "measurement")).toMatchObject({
    status: "open",
    taskRefs: [{ appId: background.id, taskId: "sample" }],
  });
  expect(f.store.isCancelled(admitted.taskId)).toBe(false);
});

test("one-App worker resolves follow-up from its pinned registry and emits a post-commit wake", async () => {
  const f = await fixture(
    async () => ({ status: "done", structuredResult: delegated }),
    (root, appDir) => ({
      ...withBackground(root, appDir),
      installControllers: false,
      taskAppIds: [app.id],
    }),
  );
  expect(AppTaskResourceStore.activeFromDb(f.db, background.id)).toBeNull();
  const admitted = f.admit("ask", "Get the measurement and report it here");
  const ready = eventAfter(f.bus, (event) => event.type === "app.task.ready" && event.data.appId === background.id);
  await reconcileLoadedAppTaskOnce({
    bus: f.bus,
    appId: app.id,
    taskId: admitted.taskId,
    dispatch: { lane: "ordinary", enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0 },
  });
  expect((await ready).type).toBe("app.task.ready");
  expect(AppTaskResourceStore.activeFromDb(f.db, background.id)?.readTask("sample")?.spec.outcome).toBe(
    "Get the sample measurement",
  );
  expect(readConversationRequest(f.db, app.id, "primary", "measurement")?.status).toBe("open");
  expect(getAppInboxItem(f.db, admitted.item.id)?.result?.response).toBe(delegated.response);
});

async function startConversationIngress(f: Awaited<ReturnType<typeof fixture>>) {
  const registry = new AppRegistry(async () => f.options.appRegistrySnapshot!.entries);
  await registry.reload();
  const writer = new DbWriter(f.root);
  f.bus.setPersistenceSubscriber(writer.handler);
  f.bus.setDeliveryRecorder(writer.recordDelivery);
  const tasks = createAppTaskCapability({ bus: f.bus });
  let oldExecutions = 0;
  const runtime = await startAppInboxRuntime({
    registry,
    db: f.db,
    bus: f.bus,
    persistDir: f.root,
    hostCapacity: f.options.hostCapacity,
    conversationAppId: app.id,
    schedulesEnabled: false,
    admitConversation: tasks.admitConversation,
    admitConversationChange: tasks.admitConversationChange,
    stopConversationTurn: tasks.stopTurn,
    admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
      tasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
    hasTaskTarget: (input) => tasks.has(input),
    previewTaskEvent: ({ appId, event, targetedTaskId }) => tasks.previewEvent({ appId, event, targetedTaskId }),
    previewTaskEventRoutes: (input) => tasks.previewEventRoutes(input),
    resolveRequest: async () => {
      oldExecutions++;
      throw new Error("Old inbox must not execute Conversation input");
    },
  });
  const publish = (id: string, text: string) =>
    f.bus.emit({
      type: "conversation.message.created",
      source: "fixture",
      owner: "human:fixture",
      data: {
        appId: app.id,
        conversationId: "primary",
        author: { kind: "human", id },
        text,
        idempotencyKey: `message:${id}`,
      },
    });
  return {
    runtime,
    tasks,
    publish,
    get oldExecutions() {
      return oldExecutions;
    },
  };
}

test("normal event ingress admits and executes one Conversation Task and notifies the interface", async () => {
  let judgments = 0;
  const f = await fixture(async () => {
    judgments++;
    return { status: "done", structuredResult: answer };
  });
  const ingress = await startConversationIngress(f);
  try {
    const replied = eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readAppConversationResource(f.db, app.id, "primary").messages.some(
          (message) => message.text === answer.response,
        ),
    );
    const admitted = ingress.publish("first", "Compare A and B");
    expect(admitted[EVENT_DELIVERY_RESULT]?.accepted).toBe(true);
    await replied;
    // A duplicate returns its original durable receipt without routing again.
    const replay = ingress.publish("first", "Compare A and B");
    expect(replay[EVENT_ROW_ID]).toBe(admitted[EVENT_ROW_ID]);
    expect(
      f.db.prepare("SELECT delivery_status FROM events WHERE id = ?").get(replay[EVENT_ROW_ID]!)?.delivery_status,
    ).toBe("accepted");
    const items = listAppInboxItems(f.db, { appId: app.id });
    expect(items).toHaveLength(1);
    expect(items[0]?.executionTaskId).toBeDefined();
    expect(items[0]?.status).toBe("done");
    expect(items[0]?.lease).toBeUndefined();
    expect(ingress.oldExecutions).toBe(0);
    expect(judgments).toBe(1);
    expect(readConversationRequest(f.db, app.id, "primary", "compare")?.status).toBe("closed");
  } finally {
    ingress.runtime.close();
  }
});

function measurementReply(context: AppInputContext): ConversationTurnResult {
  const ask = context.conversation!.requests!.find((request) => request.id === "measurement")!;
  const input = context.input.data as {
    appId: string;
    taskId: string;
    attemptId: string;
    outcome: { state: string; result?: { value: number } };
  };
  expect(context.source.kind).toBe("system");
  expect(context.humanRequested).toBeUndefined();
  expect(input.appId).toBe(background.id);
  expect(input.taskId).toBe("sample");
  expect(input.attemptId).toBeTruthy();
  if (input.outcome.state === "stopped")
    return {
      summary: "Observed failed measurement attempt",
      response: "The measurement is unavailable. Its Task is still trying.",
      topic: { kind: "existing", id: context.conversation!.current!.topicId! },
    };
  expect(input.outcome.result?.value).toBe(17);
  return {
    summary: "Reported measurement",
    response: "The measurement is 17.",
    topic: { kind: "existing", id: context.conversation!.current!.topicId! },
    requestUpdates: [
      {
        id: ask.id,
        scope: ask.scope,
        expectedRevision: ask.revision,
        disposition: "fulfilled",
        reason: "Returned the measured value",
      },
    ],
  };
}

test.each(["live", "restart", "admission-write-failure"])(
  "linked outcomes enter the Conversation controller (%s)",
  async (route) => {
    const missed = route === "restart";
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const contexts: AppInputContext[] = [];
    const legacy = defineApp({
      ...app,
      tasks: {
        subscriptions: [{ type: "conversation.task.changed" }],
        resolve: () => ({
          id: "legacy-review",
          parentId: "root",
          mode: "maintain",
          outcome: "Old follow-up owner",
          acceptance: ["Review Task update"],
          executor: "legacy",
        }),
      },
    });
    const f = await fixture(
      async (_definition, prompt) => {
        const context = JSON.parse(
          prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
        ) as AppInputContext;
        contexts.push(context);
        return {
          status: "done",
          structuredResult: context.source.kind === "human" ? delegated : measurementReply(context),
        };
      },
      (root, appDir) => ({
        ...withBackground(root, appDir, legacy),
        executors: {
          legacy: async () => {
            throw new Error("The old follow-up Task must not execute");
          },
          measure: async () => {
            started.resolve();
            await release.promise;
            return { state: "converged", summary: "Sample is 17", result: { value: 17 }, evidence: ["measurement:17"] };
          },
        },
      }),
    );
    let ingress = await startConversationIngress(f);
    try {
      const replyObserved = () =>
        eventAfter(
          f.bus,
          (event) =>
            event.type === "conversation.updated" &&
            readConversationRequest(f.db, app.id, "primary", "measurement")?.status === "closed",
        );
      let replied = route === "live" ? replyObserved() : undefined;
      ingress.publish("ask", "Get the measurement and report it here");
      await started.promise;
      const topicId = readAppConversationResource(f.db, app.id, "primary").topics[0]!.id;
      const unknown = f.bus.emit({
        type: "conversation.task.changed",
        source: "fixture",
        data: {
          appId: app.id,
          conversationId: "primary",
          topicId,
          taskRef: { appId: background.id, taskId: "sample" },
          summary: "Legacy summary without an outcome",
        },
      });
      expect(unknown[EVENT_DELIVERY_RESULT]?.accepted).toBe(true);
      expect(f.store.readTask("legacy-review")).toBeNull();
      if (route === "admission-write-failure")
        f.db.exec(`
      CREATE TRIGGER reject_outcome_input BEFORE INSERT ON app_inbox_items
      WHEN NEW.input_kind = 'task-outcome' BEGIN SELECT RAISE(ABORT, 'outcome input unavailable'); END`);
      if (missed) ingress.runtime.close();
      const childSettled = settled(f.bus, "sample");
      release.resolve();
      await childSettled;
      if (missed) {
        expect(contexts).toHaveLength(1);
        expect(listPendingConversationTaskChanges(f.db, app.id)).toHaveLength(1);
        await f.reopen();
        ingress = await startConversationIngress(f);
        replied = replyObserved();
      }
      if (route === "admission-write-failure") {
        expect(contexts).toHaveLength(1);
        f.bus.emit({ type: "conversation.supervision.review", source: "timer", data: { project: app.id, limit: 1 } });
        expect(listPendingConversationTaskChanges(f.db, app.id)).toHaveLength(1);
        f.db.exec("DROP TRIGGER reject_outcome_input");
        replied = replyObserved();
      }
      if (route !== "live")
        f.bus.emit({ type: "conversation.supervision.review", source: "timer", data: { project: app.id, limit: 1 } });
      await replied;
      expect(contexts).toHaveLength(2);
      expect(ingress.oldExecutions).toBe(0);
      expect(f.store.readTask("legacy-review")).toBeNull();
      const input = listAppInboxItems(f.db, { appId: app.id }).find((item) => item.source.kind === "system")!;
      expect(input.input.kind).toBe("task-outcome");
      expect(input.status).toBe("done");
      expect(input.lease).toBeUndefined();
      const child = AppTaskResourceStore.activeFromDb(f.db, background.id)!;
      expect(child.isCancelled("sample")).toBe(false);
      expect(f.store.isCancelled(input.executionTaskId!)).toBe(false);
      expect(readAppConversationResource(f.db, app.id, "primary").messages.at(-1)?.text).toBe("The measurement is 17.");
      expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
      // Replayed notifications carry no result authority; both routes read the same saved outcome.
      const original = contexts[1]!.input.data as { attemptId: string };
      const replay = f.bus.emit({
        type: "conversation.task.changed",
        source: "fixture",
        data: {
          appId: app.id,
          conversationId: "primary",
          topicId: input.topicId,
          taskRef: { appId: background.id, taskId: "sample" },
          attemptId: original.attemptId,
          summary: "Forged alternate result",
          result: { value: 999 },
        },
      });
      expect(replay[EVENT_DELIVERY_RESULT]?.accepted).toBe(true);
      for (let index = 0; index < 3; index++)
        f.bus.emit({ type: "conversation.supervision.review", source: "timer", data: { project: app.id, limit: 1 } });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(listAppInboxItems(f.db, { appId: app.id })).toHaveLength(2);
      expect(contexts).toHaveLength(2);
      expect(f.store.listRecoveryCandidates().items).toEqual([]);
    } finally {
      release.resolve();
      ingress.runtime.close();
    }
  },
);

test("a failed child report returns to Conversation without closing its assignment or human Request", async () => {
  const repair = Promise.withResolvers<void>();
  let runs = 0;
  const f = await fixture(
    async (_definition, prompt) => {
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      return {
        status: "done",
        structuredResult: context.source.kind === "human" ? delegated : measurementReply(context),
      };
    },
    (root, appDir) => ({
      ...withBackground(root, appDir),
      executors: {
        measure: async () => {
          if (++runs === 1)
            return {
              state: "stopped",
              summary: "Could not obtain measurement: source offline",
              evidence: ["measurement source: unavailable"],
            };
          await repair.promise;
          return { state: "converged", summary: "Sample is 17", result: { value: 17 }, evidence: ["measurement:17"] };
        },
      },
    }),
  );
  const ingress = await startConversationIngress(f);
  try {
    const reported = eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readAppConversationResource(f.db, app.id, "primary").messages.some((message) =>
          message.text.includes("still trying"),
        ),
    );
    ingress.publish("ask", "Get the measurement and report it here");
    await reported;
    expect(readConversationRequest(f.db, app.id, "primary", "measurement")?.status).toBe("open");
    const child = AppTaskResourceStore.activeFromDb(f.db, background.id)!;
    expect(child.isCancelled("sample")).toBe(false);
    expect(child.readTask("sample")?.status.executionFailures).toBe(1);
    const finished = eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readConversationRequest(f.db, app.id, "primary", "measurement")?.status === "closed",
    );
    repair.resolve();
    await finished;
    expect(runs).toBe(2);
    expect(ingress.oldExecutions).toBe(0);
    expect(listAppInboxItems(f.db, { appId: app.id }).filter((item) => item.source.kind === "system")).toHaveLength(2);
    expect(child.isCancelled("sample")).toBe(false);
  } finally {
    repair.resolve();
    ingress.runtime.close();
  }
});

test.each(["live", "restart", "stop"])("owner closure returns without manufacturing a result (%s)", async (route) => {
  const started = Promise.withResolvers<TaskAttempt>();
  const releaseChild = Promise.withResolvers<void>();
  const reviewStarted = Promise.withResolvers<CallOptions>();
  const releaseReview = Promise.withResolvers<void>();
  const seen: AppInputContext[] = [];
  const f = await fixture(
    async (_definition, prompt, options) => {
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      seen.push(context);
      if (context.source.kind === "human" && context.source.id !== "withdraw")
        return { status: "done", structuredResult: delegated };
      const ask = context.conversation!.requests!.find((request) => request.id === "measurement")!;
      if (context.source.kind === "human")
        return {
          status: "done",
          structuredResult: {
            summary: "Withdrew the measurement ask",
            response: "I have dropped the measurement request.",
            topic: { kind: "existing", id: ask.topicId! },
            requestUpdates: [
              {
                id: ask.id,
                scope: ask.scope,
                expectedRevision: ask.revision,
                disposition: "withdrawn",
                reason: "The human asked to drop it",
              },
            ],
          },
        };
      expect(context.input.kind).toBe("task-closed");
      expect(context.humanRequested).toBeUndefined();
      expect(context.input.data).toMatchObject({
        appId: background.id,
        taskId: "sample",
        generation: 1,
        closure: { reason: "Owner withdrew measurement", decidedBy: { kind: "human" } },
      });
      expect((context.input.data as Record<string, unknown>).outcome).toBeUndefined();
      reviewStarted.resolve(options);
      if (route === "stop") await releaseReview.promise;
      return {
        status: "done",
        structuredResult: {
          summary: "Explained owner closure",
          response: "The measurement Task was closed without a result. Your request remains open.",
          topic: { kind: "existing", id: ask.topicId! },
        },
      };
    },
    (root, appDir) => ({
      ...withBackground(root, appDir),
      executors: {
        measure: async (attempt) => {
          started.resolve(attempt);
          await releaseChild.promise;
          return {
            state: "converged",
            summary: "Late measurement",
            result: { value: 17 },
            evidence: ["measurement:17"],
          };
        },
      },
    }),
  );
  let ingress = await startConversationIngress(f);
  try {
    ingress.publish("ask", "Get the measurement and report it here");
    const executing = await started.promise;
    const source = AppTaskResourceStore.activeFromDb(f.db, background.id)!;
    const current = source.readTask("sample")!;
    // Event text cannot cancel work or publish a closure that was never committed.
    const forgedObserved = Promise.withResolvers<void>();
    const stopObservation = executing.onEvent((event) => {
      if (event.type === "app.task.cancelled" && event.data.reason === "Uncommitted closure") forgedObserved.resolve();
    });
    const forged = f.bus.emit({
      type: "app.task.cancelled",
      source: "app-task-reconciler",
      owner: "human:operator",
      target: { appId: background.id, taskId: "sample" },
      data: {
        appId: background.id,
        taskId: "sample",
        generation: current.metadata.generation,
        attemptId: executing.attemptId,
        reason: "Uncommitted closure",
      },
    });
    expect(forged[EVENT_DELIVERY_RESULT]?.accepted).toBe(true);
    await forgedObserved.promise;
    stopObservation();
    expect(executing.signal.aborted).toBe(false);
    expect(listAppInboxItems(f.db, { appId: app.id })).toHaveLength(1);
    if (route === "restart") ingress.runtime.close();
    const settledChild = settled(f.bus, "sample");
    let reviewDone =
      route === "live"
        ? eventAfter(
            f.bus,
            (event) =>
              event.type === "conversation.updated" &&
              readAppConversationResource(f.db, app.id, "primary").messages.some((message) =>
                message.text.includes("closed without a result"),
              ),
          )
        : undefined;
    const control = {
      bus: f.bus,
      appId: background.id,
      taskId: "sample",
      expectedGeneration: current.metadata.generation,
      expectedResourceVersion: current.metadata.resourceVersion,
      reason: "Owner withdrew measurement",
      controlKey: "close-measurement",
    };
    const closureObserved = eventAfter(
      f.bus,
      (event) => event.type === "app.task.cancelled" && event.data.reason === control.reason,
    );
    const aborted = new Promise<void>((resolve) =>
      executing.signal.addEventListener("abort", () => resolve(), { once: true }),
    );
    expect(cancelLoadedAppTask(control)).toMatchObject({ applied: true, cancelledAttemptId: executing.attemptId });
    expect(cancelLoadedAppTask(control).applied).toBe(false);
    const notification = await closureObserved;
    expect(notification.data).toMatchObject({ attemptId: executing.attemptId, generation: 1 });
    await aborted;
    expect(executing.signal.aborted).toBe(true);
    releaseChild.resolve();
    await settledChild;
    expect(source.readAttempt(executing.attemptId)?.acceptedResult).toBeUndefined();
    if (route === "restart") {
      expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([
        {
          appId: app.id,
          conversationId: "primary",
          topicId: readAppConversationResource(f.db, app.id, "primary").topics[0]!.id,
          taskAppId: background.id,
          taskId: "sample",
          closedGeneration: 1,
        },
      ]);
      await f.reopen();
      ingress = await startConversationIngress(f);
      reviewDone = eventAfter(
        f.bus,
        (event) =>
          event.type === "conversation.updated" &&
          readAppConversationResource(f.db, app.id, "primary").messages.some((message) =>
            message.text.includes("closed without a result"),
          ),
      );
      f.bus.emit({ type: "conversation.supervision.review", source: "timer", data: { project: app.id, limit: 1 } });
    }
    const review = await reviewStarted.promise;
    if (route === "stop") {
      const ended = settled(f.bus, review.taskBinding!.taskId);
      ingress.tasks.stopTurn({
        appId: app.id,
        conversationId: "primary",
        turnId: review.taskBinding!.attemptId,
        expectedRevision: review.taskBinding!.generation,
      });
      releaseReview.resolve();
      await ended;
    } else await reviewDone;
    const closureInput = listAppInboxItems(f.db, { appId: app.id }).find((item) => item.input.kind === "task-closed")!;
    expect(closureInput.status).toBe("done");
    if (route === "stop") expect(closureInput.handling?.phase).toBe("stopped");
    expect(readConversationRequest(f.db, app.id, "primary", "measurement")?.status).toBe("open");
    expect(seen).toHaveLength(2);
    f.bus.emit({ type: "conversation.supervision.review", source: "timer", data: { project: app.id, limit: 1 } });
    expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
    expect(listAppInboxItems(f.db, { appId: app.id }).filter((item) => item.input.kind === "task-closed")).toHaveLength(
      1,
    );
    const withdrawn = eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readConversationRequest(f.db, app.id, "primary", "measurement")?.status === "closed",
    );
    ingress.publish("withdraw", "Drop the measurement request");
    await withdrawn;
    expect(readConversationRequest(f.db, app.id, "primary", "measurement")?.closure?.disposition).toBe("withdrawn");
    expect(f.store.isCancelled(closureInput.executionTaskId!)).toBe(false);
    expect(ingress.oldExecutions).toBe(0);
  } finally {
    releaseChild.resolve();
    releaseReview.resolve();
    ingress.runtime.close();
  }
});

test("missing Conversation capability cannot return retained work to the old routing owner", async () => {
  const definition = defineApp({ ...app, requests: undefined, tasks: { subscriptions: [], resolve: () => null } });
  const replacement: Partial<AppTaskRuntimeOptions> = {};
  const f = await fixture(async () => {
    throw new Error("Unavailable Conversation must not execute");
  }, replacement);
  const retained = f.admit();
  replacement.appRegistrySnapshot = {
    id: "without-conversation",
    generation: 2,
    entries: [{ appDir: f.appDir, definition }],
  };
  await f.reopen();
  const tasks = createAppTaskCapability({ bus: f.bus });
  expect(
    tasks.admitConversationChange({
      appId: app.id,
      conversationId: "primary",
      topicId: "retained-topic",
      taskAppId: background.id,
      taskId: "sample",
      closedGeneration: 1,
    }),
  ).toEqual({ taskId: retained.taskId, created: false });
  expect(getAppInboxItem(f.db, retained.item.id)?.status).not.toBe("done");
  expect(f.store.isCancelled(retained.taskId)).toBe(false);
});

test("normal Stop fences only the observed Turn, preserves newer input and survives reopen", async () => {
  const firstStarted = Promise.withResolvers<CallOptions>();
  const releaseFirst = Promise.withResolvers<void>();
  const secondStarted = Promise.withResolvers<CallOptions>();
  const releaseSecond = Promise.withResolvers<void>();
  const batches: string[][] = [];
  const f = await fixture(async (_definition, prompt, options) => {
    const context = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!);
    batches.push(context.inputs.map((input: { source: { id: string } }) => input.source.id));
    if (batches.length === 1) {
      firstStarted.resolve(options);
      await releaseFirst.promise;
      return { status: "done", structuredResult: answer };
    }
    secondStarted.resolve(options);
    await releaseSecond.promise;
    return {
      status: "done",
      structuredResult: {
        summary: "Answered newer input",
        response: "A threshold is a comparison boundary.",
        topic: { kind: "none" },
      },
    };
  });
  applyConversationRequestUpdates(f.db, {
    appId: app.id,
    conversationId: "primary",
    updateKey: "accepted-before-turn",
    now: Date.now(),
    updates: [{ id: "compare", expectedRevision: 0, scope: "Compare A and B", disposition: "open" }],
  });
  const ingress = await startConversationIngress(f);
  const failures: AgentEvent[] = [];
  const unsubscribeFailures = f.bus.subscribe((event) => {
    if (event.type === "handler.failed") failures.push(event);
  });
  try {
    ingress.publish("first", "Compare A and B");
    const first = await firstStarted.promise;
    const observed = readAppConversationResource(f.db, app.id, "primary").activeTurn!;
    expect(observed).toEqual({ id: first.taskBinding!.attemptId, revision: first.taskBinding!.generation });
    // A notification cannot grant control authority or become fresh input.
    const notification = eventAfter(f.bus, (event) => event.type === "app.task.attempt.stopped");
    f.bus.emit({
      type: "app.task.attempt.stopped",
      source: "app-task-reconciler",
      owner: "human:operator",
      target: { appId: app.id, taskId: first.taskBinding!.taskId },
      data: {
        appId: app.id,
        taskId: first.taskBinding!.taskId,
        attemptId: observed.id,
        reason: "Uncommitted notification",
      },
    });
    await notification;
    expect(first.signal?.aborted).toBe(false);
    expect(listAppInboxItems(f.db, { appId: app.id })).toHaveLength(1);
    ingress.publish("second", "What is a threshold?");
    const aborted = new Promise<void>((resolve) =>
      first.signal!.addEventListener("abort", () => resolve(), { once: true }),
    );
    f.bus.emit({
      type: "conversation.turn.stop.requested",
      source: "fixture",
      owner: "human:fixture",
      data: { appId: app.id, conversationId: "primary", turnId: observed.id, expectedRevision: observed.revision },
    });
    await aborted;
    expect(readConversationRequest(f.db, app.id, "primary", "compare")?.status).toBe("open");
    expect(f.store.isCancelled(first.taskBinding!.taskId)).toBe(false);
    releaseFirst.resolve();
    const second = await secondStarted.promise;
    expect(batches).toEqual([["first"], ["second"]]);
    const replay = ingress.tasks.stopTurn({
      appId: app.id,
      conversationId: "primary",
      turnId: observed.id,
      expectedRevision: observed.revision,
    });
    expect(replay.changed).toBe(false);
    expect(second.signal?.aborted).toBe(false);
    const finished = settled(f.bus, second.taskBinding!.taskId);
    releaseSecond.resolve();
    await finished;
    const messages = readAppConversationResource(f.db, app.id, "primary").messages;
    expect(messages.some((message) => message.text === answer.response)).toBe(false);
    expect(messages.some((message) => message.text === "A threshold is a comparison boundary.")).toBe(true);
    expect(readAppConversationResource(f.db, app.id, "primary").activeTurn).toBeUndefined();
    expect(ingress.oldExecutions).toBe(0);
    expect(failures).toEqual([]);
    ingress.runtime.close();
    await f.reopen();
    expect(f.store.listRecoveryCandidates().items).toEqual([]);
    expect(listAppInboxItems(f.db, { appId: app.id }).find((item) => item.source.id === "first")?.handling?.phase).toBe(
      "stopped",
    );
    expect(readConversationRequest(f.db, app.id, "primary", "compare")?.status).toBe("open");
  } finally {
    unsubscribeFailures();
    releaseFirst.resolve();
    releaseSecond.resolve();
    ingress.runtime.close();
  }
});

test("human Conversation input keeps capacity beside same-App background work; system reviews do not", async () => {
  const backgroundStarted = Promise.withResolvers<void>();
  const releaseBackground = Promise.withResolvers<void>();
  const reviews: string[] = [];
  let humanTurns = 0;
  let backgroundRuns = 0;
  const definition = defineApp({ ...app, tasks: { maxConcurrent: 1, subscriptions: [], resolve: () => null } });
  const capacity = new HostCapacity(2);
  const f = await fixture(
    async (_agent, prompt) => {
      const context = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!);
      const human = context.inputs.some((input: { source: { kind: string } }) => input.source.kind === "human");
      if (human) {
        humanTurns++;
        expect(backgroundRuns).toBe(1);
        expect(capacity.snapshot().running).toBe(2);
      } else reviews.push(context.inputs[0].source.id);
      return {
        status: "done",
        structuredResult: {
          summary: human ? "Answered the human" : "Reviewed the fact quietly",
          ...(human ? { response: `Human answer ${humanTurns}` } : {}),
          topic: { kind: "none" },
        },
      };
    },
    (_root, appDir) => ({
      hostCapacity: capacity,
      appRegistrySnapshot: { id: "shared-app", generation: 1, entries: [{ appDir, definition }] },
      executors: {
        hold: async () => {
          backgroundRuns++;
          backgroundStarted.resolve();
          await releaseBackground.promise;
          return { state: "converged", summary: "Background finished", evidence: [] };
        },
      },
    }),
  );
  const ingress = await startConversationIngress(f);
  try {
    for (const id of ["background", "urgent-background"])
      observeAppTaskIntent(f.context(), {
        appAgent: app.agent!,
        intent: {
          id,
          parentId: "root",
          mode: "achieve",
          executor: "hold",
          priority: "P0",
          outcome: "Independent work",
          acceptance: ["Handled"],
        },
      });
    wakeLoadedAppTasks({ bus: f.bus, appId: app.id, taskIds: ["background"] });
    await backgroundStarted.promise;
    wakeLoadedAppTasks({ bus: f.bus, appId: app.id, taskIds: ["urgent-background"] });
    const review = ingress.tasks.admitConversation({
      appId: app.id,
      conversationId: "review-chat",
      source: { kind: "system", id: "review" },
      input: { kind: "review", data: {} },
      idempotencyKey: "review",
    });
    for (const index of [1, 2]) {
      const replied = eventAfter(
        f.bus,
        (event) =>
          event.type === "conversation.updated" &&
          readAppConversationResource(f.db, app.id, "primary").messages.some(
            (message) => message.text === `Human answer ${index}`,
          ),
      );
      ingress.publish(`human-${index}`, "Discuss the work while it runs");
      await replied;
      expect(reviews).toEqual([]);
      expect(backgroundRuns).toBe(1);
    }
    expect(f.store.readTask(review.taskId)?.status.currentAttemptId).toBeUndefined();
    const reviewed = settled(f.bus, review.taskId);
    releaseBackground.resolve();
    await reviewed;
    expect(reviews).toEqual(["review"]);
    expect(backgroundRuns).toBe(2);
    expect(ingress.oldExecutions).toBe(0);
  } finally {
    releaseBackground.resolve();
    ingress.runtime.close();
  }
});

test("a paused App answers human input through its Task across restart while background work waits", async () => {
  let backgroundRuns = 0;
  const inputs: string[] = [];
  const definition = defineApp({ ...app, tasks: { subscriptions: [], resolve: () => null } });
  const f = await fixture(
    async (_agent, prompt) => {
      const context = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!);
      const id = context.inputs[0].source.id;
      inputs.push(id);
      return {
        status: "done",
        structuredResult: { summary: "Handled input", response: `Handled ${id}`, topic: { kind: "none" } },
      };
    },
    (_root, appDir) => {
      mkdirSync(join(appDir, "tasks"));
      writeFileSync(join(appDir, "tasks", "seed.json"), JSON.stringify({ project_lifecycle: "paused" }));
      return {
        appRegistrySnapshot: { id: "paused-app", generation: 1, entries: [{ appDir, definition }] },
        executors: {
          count: async () => {
            backgroundRuns++;
            return { state: "converged", summary: "Resumed work", evidence: [] };
          },
        },
      };
    },
  );
  let ingress = await startConversationIngress(f);
  try {
    observeAppTaskIntent(f.context(), {
      appAgent: app.agent!,
      intent: {
        id: "background",
        parentId: "root",
        mode: "achieve",
        executor: "count",
        outcome: "Wait while paused",
        acceptance: ["Handled"],
      },
    });
    wakeLoadedAppTasks({ bus: f.bus, appId: app.id, taskIds: ["background"] });
    const review = ingress.tasks.admitConversation({
      appId: app.id,
      conversationId: "review-chat",
      source: { kind: "system", id: "review" },
      input: { kind: "review", data: {} },
      idempotencyKey: "review",
    });
    // A direct worker call must obey storage's pause fence as well as the queue.
    for (const taskId of ["background", review.taskId])
      await reconcileLoadedAppTaskOnce({
        bus: f.bus,
        appId: app.id,
        taskId,
        dispatch: { lane: "human", enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0 },
      });
    const reply = eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readAppConversationResource(f.db, app.id, "primary").messages.some(
          (message) => message.text === "Handled before",
        ),
    );
    ingress.publish("before", "Discuss the paused project");
    await reply;
    expect(inputs).toEqual(["before"]);
    expect(backgroundRuns).toBe(0);
    ingress.runtime.close();
    const options = await f.reopen();
    ingress = await startConversationIngress(f);
    const next = eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readAppConversationResource(f.db, app.id, "primary").messages.some(
          (message) => message.text === "Handled after",
        ),
    );
    ingress.publish("after", "Keep discussing without resuming background work");
    await next;
    expect(inputs).toEqual(["before", "after"]);
    expect(backgroundRuns).toBe(0);
    expect(f.store.projectLifecycle()).toBe("paused");
    const reviewed = settled(f.bus, review.taskId);
    const resumed = settled(f.bus, "background");
    f.store.setProjectLifecycle("active");
    await installAppTaskRuntimes(options, { deferRecovery: true });
    await Promise.all([reviewed, resumed]);
    expect(inputs).toEqual(["before", "after", "review"]);
    expect(backgroundRuns).toBe(1);
    expect(ingress.oldExecutions).toBe(0);
  } finally {
    ingress.runtime.close();
  }
});
