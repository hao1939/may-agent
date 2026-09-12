import { afterEach, expect, setSystemTime, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type AppInputContext, type ConversationTurnResult, type TaskAttempt } from "@may-agent/sdk";
import type { SubagentManager } from "../../../lib/index.js";
import type { CallOptions, SubagentDefinition } from "../../../lib/types.js";
import { getDb, closeDb } from "../../../lib/requests.js";
import { EventBus, EVENT_DELIVERY_RESULT, EVENT_ROW_ID, type AgentEvent } from "../events/bus.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { createEventInterface } from "../events/interface.js";
import { AppRegistry } from "../apps/registry.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import { startAppInboxRuntime } from "../../composition/app-inbox-runtime.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitConversationTaskInput, listPendingConversationTaskChanges } from "../state/conversation-task-turns.js";
import { getAppInboxItem, listAppInboxItems } from "../state/app-inbox-store.js";
import { claimAppInboxItem } from "../../../../test/fixtures/legacy-inbox.js";
import { createConversationTopic, linkConversationTopicTask, readAppConversationResource } from "../state/conversations.js";
import { readConversationRequest, applyConversationRequestUpdates } from "../state/conversation-requests.js";
import { createTaskExecutionBackends } from "../../composition/task-execution.js";
import { appTaskContext, cancelAppTask, observeAppTaskIntent } from "./app-task-reconciler.js";
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
  setSystemTime();
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
    run(taskId: string) {
      const now = Date.now();
      return reconcileLoadedAppTaskOnce({
        bus, appId: app.id, taskId,
        dispatch: { lane: "human", enqueuedAt: now, startedAt: now, readyWaitMs: 0 },
      });
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

test.each(["throws", "invalid", "missing-topic"] as const)(
  "Task input survives %s and reaches an exact answer through paced retry",
  async (failure) => {
    const calls: CallOptions[] = [];
    const contexts: AppInputContext[] = [];
    const f = await fixture(async (_definition, prompt, options) => {
      expect(prompt).toContain("Compare A and B");
      expect(options.recoveryOwner).toBe(APP_TASK_RECOVERY_OWNER);
      expect(options.taskBinding?.appId).toBe(app.id);
      expect(claimAppInboxItem(f.db, "ask", "old-inbox", 1_000)).toBeNull();
      calls.push(options);
      contexts.push(JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!));
      if (calls.length === 1) {
        if (failure === "throws") throw new Error("Model temporarily unavailable");
        return {
          status: "done",
          structuredResult:
            failure === "invalid" ? ({} as ConversationTurnResult) : { ...delegated, topic: { kind: "none" } },
        };
      }
      return { status: "done", structuredResult: answer };
    }, withBackground);
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
    const failedAttempt = f.store.readAttempt(calls[0]!.taskBinding!.attemptId)!;
    expect(failedAttempt.state).toBe("failed");
    expect(failedAttempt.summary).toBeTruthy();
    expect(AppTaskResourceStore.activeFromDb(f.db, background.id)?.readTask("sample")).toBeNull();
    if (failure !== "throws") await f.reopen();
    await settled(f.bus, admitted.taskId); // The real recovery timer performs the retry, also after reopen.
    expect(calls).toHaveLength(2);
    expect(contexts[1]).toMatchObject({
      previousAttempt: {
        attemptId: calls[0]!.taskBinding!.attemptId,
        generation: calls[0]!.taskBinding!.generation,
        state: "failed",
        summary: failedAttempt.summary,
      },
    });
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
  },
);

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

test.each(["during failure", "during cooldown and reopen"])(
  "new human input gets a fresh Conversation attempt (%s) without dropping the original Request",
  async (arrival) => {
    const firstStarted = Promise.withResolvers<void>();
    const releaseFailure = Promise.withResolvers<void>();
    const secondStarted = Promise.withResolvers<void>();
    const releaseAnswer = Promise.withResolvers<void>();
    const contexts: AppInputContext[] = [];
    const capacity = new HostCapacity(1);
    const f = await fixture(
      async (_definition, prompt) => {
        contexts.push(JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!));
        if (contexts.length === 1) {
          firstStarted.resolve();
          await releaseFailure.promise;
          throw new Error("Source temporarily unavailable");
        }
        secondStarted.resolve();
        await releaseAnswer.promise;
        return {
          status: "done",
          structuredResult: {
            summary: "Discussed the new source",
            response: "I will use the corrected source; the comparison remains open.",
            topic: { kind: "none" },
          },
        };
      },
      { hostCapacity: capacity },
    );
    applyConversationRequestUpdates(f.db, {
      appId: app.id,
      conversationId: "primary",
      updateKey: "accepted-ask",
      now: Date.now(),
      updates: [{ id: "compare", expectedRevision: 0, scope: "Compare A and B", disposition: "open" }],
    });
    const admitted = f.admit();
    // Seed prior failures so this check cannot accidentally pass by waiting out
    // the first 250 ms delay. The runtime, not the fixture, settles the next failure.
    const resource = f.store.readTask(admitted.taskId)!;
    resource.metadata.resourceVersion++;
    resource.status.executionFailures = 7;
    f.store.commit({
      fences: [{ taskId: admitted.taskId, resourceVersion: resource.metadata.resourceVersion - 1 }],
      tasks: [{ resource, trigger: f.store.readTrigger(admitted.taskId)!, ready: true }],
    });
    f.store.setProjectLifecycle("paused");
    let ingress = await startConversationIngress(f);
    let releaseCapacity: (() => void) | undefined;
    try {
      const failed = settled(f.bus, admitted.taskId);
      wakeLoadedAppTasks({ bus: f.bus, appId: app.id, taskIds: [admitted.taskId] });
      await firstStarted.promise;
      if (arrival === "during failure") ingress.publish("correction", "Use the corrected source");
      releaseFailure.resolve();
      await failed;
      if (arrival === "during cooldown and reopen") {
        const due = f.store.readTask(admitted.taskId)!.status.executionRetryAt!;
        expect(due - Date.now()).toBeGreaterThan(20_000);
        releaseCapacity = await capacity.acquire();
        ingress.publish("correction", "Use the corrected source");
        ingress.publish("correction", "Use the corrected source");
        expect(f.store.readTask(admitted.taskId)?.status.executionRetryAt).toBeUndefined();
        expect(contexts).toHaveLength(1);
        ingress.runtime.close();
        await f.reopen();
        ingress = await startConversationIngress(f);
        expect(contexts).toHaveLength(1);
        releaseCapacity();
        releaseCapacity = undefined;
        expect(Date.now()).toBeLessThan(due);
      }
      await secondStarted.promise;
      expect(contexts).toHaveLength(2);
      expect(contexts[1]!.inputs!.map((input) => input.source.id)).toEqual(["ask", "correction"]);
      expect(contexts[1]!.previousAttempt).toMatchObject({
        state: "failed",
        summary: expect.stringContaining("Source temporarily unavailable"),
      });
      expect(f.store.readTask(admitted.taskId)?.status.executionFailures).toBe(8);
      expect(f.store.projectLifecycle()).toBe("paused");
      expect(readConversationRequest(f.db, app.id, "primary", "compare")?.status).toBe("open");
      const done = settled(f.bus, admitted.taskId);
      releaseAnswer.resolve();
      await done;
      expect(listAppInboxItems(f.db, { appId: app.id }).every((item) => item.status === "done")).toBe(true);
      expect(readConversationRequest(f.db, app.id, "primary", "compare")?.status).toBe("open");
      expect(readAppConversationResource(f.db, app.id, "primary").messages.at(-1)?.text).toBe(
        "I will use the corrected source; the comparison remains open.",
      );
      expect(f.store.listRecoveryCandidates().items).toEqual([]);
      expect(f.store.isCancelled(admitted.taskId)).toBe(false);
    } finally {
      releaseFailure.resolve();
      releaseAnswer.resolve();
      releaseCapacity?.();
      ingress.runtime.close();
    }
  },
);

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

test.each(["available", "removed"] as const)(
  "failed reply commits no delegation; retry survives reopen with the target App %s",
  async (availability) => {
    let judgments = 0;
    let backgroundRuns = 0;
    let configured: Partial<AppTaskRuntimeOptions>;
    const f = await fixture(
      async () => {
        judgments++;
        return { status: "done", structuredResult: delegated };
      },
      (root, appDir) =>
        (configured = {
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
    expect(getAppInboxItem(f.db, "ask")?.status).not.toBe("done");
    expect(readAppConversationResource(f.db, app.id, "primary").topics).toEqual([]);
    f.db.exec("DROP TRIGGER reject_reply");
    const available = configured!.appRegistrySnapshot!;
    const withoutTarget = {
      ...available,
      generation: available.generation + 1,
      entries: available.entries.filter((entry) => entry.definition.id !== background.id),
    };
    if (availability === "removed") configured!.appRegistrySnapshot = withoutTarget;
    await f.reopen();
    if (availability === "removed") {
      await settled(f.bus, admitted.taskId);
      expect(judgments).toBe(2);
      expect(backgroundRuns).toBe(0);
      expect(getAppInboxItem(f.db, "ask")?.status).not.toBe("done");
      expect(readAppConversationResource(f.db, app.id, "primary").topics).toEqual([]);
      expect(f.store.readTask(admitted.taskId)?.status.executionFailures).toBe(2);
      expect(f.store.isCancelled(admitted.taskId)).toBe(false);
      configured!.appRegistrySnapshot = { ...available, generation: withoutTarget.generation + 1 };
      await f.reopen();
    }
    await settled(f.bus, "sample");
    expect(judgments).toBe(availability === "removed" ? 3 : 2);
    expect(backgroundRuns).toBe(1);
    expect(readConversationRequest(f.db, app.id, "primary", "measurement")).toMatchObject({
      status: "open",
      taskRefs: [{ appId: background.id, taskId: "sample" }],
    });
    expect(f.store.isCancelled(admitted.taskId)).toBe(false);
    const accepted = getAppInboxItem(f.db, "ask")!;
    expect(accepted.result?.response).toBe(delegated.response);
    configured!.appRegistrySnapshot = { ...withoutTarget, generation: available.generation + 3 };
    await f.reopen();
    await f.run(admitted.taskId);
    expect(getAppInboxItem(f.db, "ask")).toEqual(accepted);
    expect(judgments).toBe(availability === "removed" ? 3 : 2);
    expect(backgroundRuns).toBe(1);
    expect(
      readAppConversationResource(f.db, app.id, "primary").messages.filter(
        (message) => message.text === delegated.response,
      ),
    ).toHaveLength(1);
  },
);

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
  const runtime = await startAppInboxRuntime({
    registry,
    db: f.db,
    bus: f.bus,
    persistDir: f.root,
    schedulesEnabled: false,
    attachTask: tasks.attach,
    readDependency: tasks.readDependency,
    admitConversation: tasks.admitConversation,
    admitConversationChange: tasks.admitConversationChange,
    stopConversationTurn: tasks.stopTurn,
    admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
      tasks.admitEvent({ appId, event, intent, targetedTaskId, conditionTaskIds }),
    hasTaskTarget: (input) => tasks.has(input),
    previewTaskEvent: ({ appId, event, targetedTaskId }) => tasks.previewEvent({ appId, event, targetedTaskId }),
    previewTaskEventRoutes: (input) => tasks.previewEventRoutes(input),
  });
  const publish = (id: string, text: string, metadata?: Record<string, unknown>) =>
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
        ...(metadata ? { metadata } : {}),
      },
    });
  return {
    runtime,
    tasks,
    publish,
  };
}

test("ordinary inbox work and Conversation input share a Conversation without blocking across reopen", async () => {
  const calls: string[] = [];
  const goals: string[] = [];
  const mixed = defineApp({
    ...app,
    requests: { mode: "agent", inputKinds: ["message"], conversationId: "primary" },
    tasks: { maxConcurrent: 2 },
    task: ({ id }) => ({
      kind: "desired",
      intent: {
        id: `goal/${id}`,
        parentId: "root",
        mode: "achieve",
        executor: "measure",
        outcome: "Collect a measurement",
        acceptance: ["Return the measured value"],
      },
    }),
  });
  const f = await fixture(
    async (_definition, prompt) => {
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      expect(context.input.kind).toBe("message");
      calls.push(context.id);
      return {
        status: "done",
        structuredResult: { summary: "Discussed", response: "I am here.", topic: { kind: "none" } },
      };
    },
    (_root, appDir) => ({
      hostCapacity: new HostCapacity(2),
      appRegistrySnapshot: { id: "mixed", generation: 1, entries: [{ appDir, definition: mixed }] },
      executors: {
        measure: async (attempt) => {
          goals.push(attempt.task.id);
          return { state: "converged", summary: "Measured", evidence: [], result: { value: 17 } };
        },
      },
    }),
  );
  let ingress = await startConversationIngress(f);
  try {
    for (const id of ["before", "after"]) {
      if (id === "after") {
        ingress.runtime.close();
        await f.reopen();
        ingress = await startConversationIngress(f);
      }
      const ordinary = ingress.runtime.host.admit({
        id: `ordinary-${id}`,
        appId: app.id,
        conversationId: "primary",
        source: { kind: "system", id },
        input: { kind: "goal", data: {} },
      });
      const returned = eventAfter(
        f.bus,
        (event) =>
          event.type === "conversation.updated" &&
          getAppInboxItem(f.db, ordinary.item.id)?.status === "done" &&
          getAppInboxItem(f.db, id)?.status === "done",
      );
      ingress.tasks.admitConversation({
        id,
        appId: app.id,
        conversationId: "primary",
        source: { kind: "human", id },
        input: { kind: "message", data: { text: "Keep discussing while the measurement runs" } },
      });

      expect(ordinary.item.waitingOn?.kind).toBe("task");
      ingress.runtime.scanNow();
      await returned;
      expect(getAppInboxItem(f.db, ordinary.item.id)).toMatchObject({
        status: "done",
        result: { result: { value: 17 } },
      });
      expect(getAppInboxItem(f.db, ordinary.item.id)?.executionTaskId).toBeUndefined();
      expect(f.store.isCancelled(`goal/${ordinary.item.id}`)).toBe(false);
    }
    expect(calls).toEqual(["before", "after"]);
    expect(goals).toEqual(["goal/ordinary-before", "goal/ordinary-after"]);
  } finally {
    ingress.runtime.close();
  }
});

test("a human Conversation decision cancels the exact running Task after its reply commits", async () => {
  const started = Promise.withResolvers<TaskAttempt>();
  const release = Promise.withResolvers<void>();
  let humanTurns = 0;
  const f = await fixture(
    async (_definition, prompt) => {
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      if (context.source.kind !== "human")
        return {
          status: "done",
          structuredResult: { summary: "Cancellation already explained", topic: { kind: "none" } },
        };
      if (++humanTurns === 1) return { status: "done", structuredResult: delegated };
      expect(context.conversation?.topics?.flatMap((topic) => topic.taskRefs)).toContainEqual(
        expect.objectContaining({
          appId: background.id,
          taskId: "sample",
        }),
      );
      return {
        status: "done",
        structuredResult: {
          summary: "Cancelled the measurement",
          response: "I cancelled the measurement Task as requested.",
          topic: { kind: "existing", id: context.conversation!.topics![0]!.id },
          taskControls: [
            { kind: "cancel", appId: background.id, taskId: "sample", reason: "Human withdrew the assignment" },
          ],
        },
      };
    },
    (root, appDir) => ({
      ...withBackground(root, appDir),
      hostCapacity: new HostCapacity(2),
      executors: {
        measure: async (attempt) => {
          started.resolve(attempt);
          await release.promise;
          return { state: "converged", summary: "Late measurement", evidence: [] };
        },
      },
    }),
  );
  const ingress = await startConversationIngress(f);
  try {
    ingress.publish("ask", "Get the measurement");
    const executing = await started.promise;
    const source = AppTaskResourceStore.activeFromDb(f.db, background.id)!;
    const aborted = new Promise<void>((resolve) =>
      executing.signal.addEventListener("abort", () => resolve(), { once: true }),
    );
    const cancelled = eventAfter(f.bus, (event) => {
      if (event.type !== "app.task.cancelled") return false;
      expect(
        readAppConversationResource(f.db, app.id, "primary").messages.some(
          (message) => message.text === "I cancelled the measurement Task as requested.",
        ),
      ).toBe(true);
      return event.data.taskId === "sample";
    });
    ingress.publish("cancel", "Cancel that measurement Task");
    await cancelled;
    await aborted;
    expect(source.isCancelled("sample")).toBe(true);
    const ended = settled(f.bus, "sample");
    release.resolve();
    await ended;
    expect(source.readAttempt(executing.attemptId)?.acceptedResult).toBeUndefined();
    expect(readConversationRequest(f.db, app.id, "primary", "measurement")?.status).toBe("open");
    expect(f.store.isCancelled(listAppInboxItems(f.db, { appId: app.id })[0]!.executionTaskId!)).toBe(false);
    expect(humanTurns).toBe(2);
  } finally {
    release.resolve();
    ingress.runtime.close();
  }
});

test.each(["delivered", "failed"] as const)(
  "event ingress executes one Task; accepted reply survives a %s interface notification",
  async (notification) => {
    let judgments = 0;
    const f = await fixture(async () => {
      judgments++;
      return { status: "done", structuredResult: answer };
    });
    const ingress = await startConversationIngress(f);
    let notificationFailures = 0;
    f.bus.listen((event) => {
      if (
        notification === "failed" &&
        event.type === "conversation.updated" &&
        readAppConversationResource(f.db, app.id, "primary").messages.some(
          (message) => message.text === answer.response,
        )
      ) {
        notificationFailures++;
        throw new Error("fixture interface unavailable");
      }
    });
    try {
      const replied = eventAfter(
        f.bus,
        (event) =>
          (notification === "failed"
            ? event.type === "subscriber.failed" && event.data.originalEventType === "conversation.updated"
            : event.type === "conversation.updated") &&
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
      expect(judgments).toBe(1);
      if (notification === "failed") expect(notificationFailures).toBeGreaterThan(0);
      else expect(notificationFailures).toBe(0);
      expect(readConversationRequest(f.db, app.id, "primary", "compare")?.status).toBe("closed");
      ingress.runtime.close();
      await f.reopen();
      await f.run(items[0]!.executionTaskId!);
      expect(getAppInboxItem(f.db, items[0]!.id)).toEqual(items[0]);
      expect(
        readAppConversationResource(f.db, app.id, "primary").messages.filter(
          (message) => message.text === answer.response,
        ),
      ).toHaveLength(1);
      expect(judgments).toBe(1);
    } finally {
      ingress.runtime.close();
    }
  },
);

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

test("a waiting report reaches Conversation, survives reopen and finishes the same assignment after repair", async () => {
  let ready = false;
  const attempts: TaskAttempt[] = [];
  const seen: AppInputContext[] = [];
  const f = await fixture(
    async (_definition, prompt) => {
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      seen.push(context);
      return {
        status: "done",
        structuredResult:
          context.source.kind === "human"
            ? delegated
            : (context.input.data as { outcome: { state: string } }).outcome.state === "waiting"
              ? {
                  summary: "Asked for source repair",
                  response: "Please restore source access; I will keep the measurement open.",
                  topic: { kind: "existing", id: context.conversation!.current!.topicId! },
                }
              : measurementReply(context),
      };
    },
    (root, appDir) => ({
      ...withBackground(root, appDir),
      executors: {
        measure: async (attempt) => {
          attempts.push(attempt);
          return ready
            ? { state: "converged", summary: "Sample is 17", result: { value: 17 }, evidence: ["measurement:17"] }
            : {
                state: "waiting",
                report: true,
                summary: "Please restore source access",
                evidence: ["source:denied"],
                conditions: [
                  {
                    id: "source-ready",
                    type: "source.access",
                    subject: "resource:sample",
                    expected: { field: "ready", equals: true },
                    owner: "app:measurement",
                    reviewAfterMs: 300_000,
                  },
                ],
              };
        },
      },
    }),
  );
  let ingress = await startConversationIngress(f);
  try {
    const reported = eventAfter(f.bus, (event) => event.type === "conversation.updated" && seen.length === 2);
    ingress.publish("ask", "Get the measurement and report it here");
    await reported;
    expect(seen[1]!.input.data).toMatchObject({
      taskId: "sample",
      attemptId: attempts[0]!.attemptId,
      outcome: { state: "waiting", report: true, summary: "Please restore source access" },
    });
    expect(readAppConversationResource(f.db, app.id, "primary").messages.at(-1)?.text).toContain(
      "Please restore source access",
    );
    expect(readConversationRequest(f.db, app.id, "primary", "measurement")?.status).toBe("open");
    ingress.runtime.close();
    await f.reopen();
    ingress = await startConversationIngress(f);
    f.bus.emit({ type: "conversation.supervision.review", source: "timer", data: { project: app.id, limit: 10 } });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
    expect(seen).toHaveLength(2);
    expect(attempts).toHaveLength(1);
    const child = AppTaskResourceStore.activeFromDb(f.db, background.id)!;
    expect(child.readTask("sample")?.status.phase).toBe("waiting");
    const finished = eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readConversationRequest(f.db, app.id, "primary", "measurement")?.status === "closed",
    );
    ready = true;
    const repaired = f.bus.emit({
      type: "source.access",
      source: "fixture",
      owner: "app:measurement",
      target: { appId: background.id, taskId: "sample" },
      data: { resource: "sample", ready: true },
    } as unknown as AgentEvent);
    expect(repaired[EVENT_DELIVERY_RESULT]?.accepted).toBe(true);
    await finished;
    expect(attempts).toHaveLength(2);
    expect(seen).toHaveLength(3);
    expect(new Set(attempts.map((attempt) => attempt.task.id))).toEqual(new Set(["sample"]));
    expect(child.isCancelled("sample")).toBe(false);
    expect(readAppConversationResource(f.db, app.id, "primary").messages.at(-1)?.text).toBe("The measurement is 17.");
  } finally {
    ingress.runtime.close();
  }
});

test.each(["stopped", "execution-error"])(
  "a failed child report returns to Conversation without closing its assignment or human Request (%s)",
  async (failure) => {
    const repair = Promise.withResolvers<void>();
    let runs = 0;
    const priorAttempts: TaskAttempt["previousAttempt"][] = [];
    const f = await fixture(
      async (_definition, prompt) => {
        const context = JSON.parse(
          prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
        ) as AppInputContext;
        return {
          status: "done",
          structuredResult:
            context.source.kind === "human"
              ? delegated
              : (context.input.data as { outcome: { state: string } }).outcome.state === "error"
                ? {
                    summary: "Observed execution failure",
                    response: "The measurement is unavailable. Its Task is still trying.",
                    topic: { kind: "existing", id: context.conversation!.current!.topicId! },
                  }
                : measurementReply(context),
        };
      },
      (root, appDir) => ({
        ...withBackground(root, appDir),
        executors: {
          measure: async (attempt) => {
            priorAttempts.push(attempt.previousAttempt);
            if (++runs <= 3) {
              if (failure === "execution-error") throw new Error(`Synthetic source offline (${runs})`);
              return {
                state: "stopped",
                summary: `Could not obtain measurement: source offline (${runs})`,
                evidence: ["measurement source: unavailable"],
              };
            }
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
      const repeated = eventAfter(
        f.bus,
        (event) => event.type === "project.task.reconciled" && event.data.taskId === "sample" && runs === 3,
      );
      ingress.publish("ask", "Get the measurement and report it here");
      await reported;
      expect(readConversationRequest(f.db, app.id, "primary", "measurement")?.status).toBe("open");
      const child = AppTaskResourceStore.activeFromDb(f.db, background.id)!;
      expect(child.isCancelled("sample")).toBe(false);
      await repeated;
      expect(child.readTask("sample")?.status.executionFailures).toBe(3);
      f.bus.emit({ type: "conversation.supervision.review", source: "timer", data: { project: app.id, limit: 10 } });
      expect(listPendingConversationTaskChanges(f.db, app.id)).toEqual([]);
      expect(listAppInboxItems(f.db, { appId: app.id }).filter((item) => item.source.kind === "system")).toHaveLength(
        1,
      );
      const finished = eventAfter(
        f.bus,
        (event) =>
          event.type === "conversation.updated" &&
          readConversationRequest(f.db, app.id, "primary", "measurement")?.status === "closed",
      );
      repair.resolve();
      await finished;
      expect(runs).toBe(4);
      expect(priorAttempts[0]).toBeUndefined();
      expect(priorAttempts[1]).toMatchObject(
        failure === "execution-error"
          ? {
              state: "failed",
              summary: expect.stringContaining("Synthetic source offline (1)"),
            }
          : {
              state: "completed",
              acceptedResult: {
                state: "stopped",
                summary: "Could not obtain measurement: source offline (1)",
                evidence: ["measurement source: unavailable"],
              },
            },
      );
      if (failure === "execution-error") expect(priorAttempts[1]?.acceptedResult).toBeUndefined();
      expect(listAppInboxItems(f.db, { appId: app.id }).filter((item) => item.source.kind === "system")).toHaveLength(
        2,
      );
      expect(child.isCancelled("sample")).toBe(false);
    } finally {
      repair.resolve();
      ingress.runtime.close();
    }
  },
);

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
    const firstSurface = {
      channel: "telegram", channelTargetId: "-1000001", channelThreadId: "7", channelMessageId: 101,
    };
    const secondSurface = {
      channel: "telegram", channelTargetId: "-1000002", channelThreadId: "8", channelMessageId: 102,
    };
    ingress.publish("first", "Compare A and B", firstSurface);
    const first = await firstStarted.promise;
    const observed = readAppConversationResource(f.db, app.id, "primary").activeTurn!;
    expect(observed).toEqual({
      id: first.taskBinding!.attemptId, revision: first.taskBinding!.generation, ...firstSurface,
    });
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
    ingress.publish("second", "What is a threshold?", secondSurface);
    expect(readAppConversationResource(f.db, app.id, "primary").activeTurn).toEqual(observed);
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
    expect(readAppConversationResource(f.db, app.id, "primary").activeTurn).toEqual({
      id: second.taskBinding!.attemptId,
      revision: second.taskBinding!.generation,
      ...secondSurface,
    });
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

test("public Stop commits before abort and preserves queued input across Task runtime reopen", async () => {
  const entered = Promise.withResolvers<CallOptions>();
  const finish = Promise.withResolvers<void>();
  const correction = "Discuss costs before implementing";
  let calls = 0;
  let committedBeforeAbort = false;
  const f = await fixture(
    async (_definition, prompt, options) => {
      calls++;
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      if (calls === 1) {
        options.signal!.addEventListener(
          "abort",
          () => {
            committedBeforeAbort = getAppInboxItem(f.db, context.id)?.handling?.phase === "stopped";
          },
          { once: true },
        );
        entered.resolve(options);
        await finish.promise;
        return { status: "done", structuredResult: answer };
      }
      expect(context.input.data.message).toBe(correction);
      expect(context.conversation?.requests).toContainEqual(
        expect.objectContaining({ id: "compare", revision: 1, status: "open", scope: "Compare A and B" }),
      );
      return {
        status: "done",
        structuredResult: {
          summary: "Scope corrected",
          response: "Let's discuss the costs first.",
          topic: { kind: "none" },
          requestUpdates: [{ id: "compare", expectedRevision: 1, scope: correction, disposition: "open" }],
        },
      };
    },
    { installControllers: false },
  );
  observeAppTaskIntent(f.context(), {
    appAgent: app.agent!,
    intent: {
      id: "independent",
      parentId: "root",
      mode: "achieve",
      outcome: "Independent work",
      acceptance: ["Verified"],
    },
  });
  const independent = f.store.readTask("independent");
  applyConversationRequestUpdates(f.db, {
    appId: app.id,
    conversationId: "primary",
    updateKey: "accepted",
    now: Date.now(),
    updates: [{ id: "compare", expectedRevision: 0, scope: "Compare A and B", disposition: "open" }],
  });
  const ingress = await startConversationIngress(f);
  const events = createEventInterface({
    bus: f.bus,
    db: f.db,
    acceptsAppInput: () => true,
    hasApp: (id) => id === app.id,
    hasAgent: () => true,
    hasSession: () => true,
  });
  ingress.publish("first", "Compare A and B");
  const first = listAppInboxItems(f.db, { appId: app.id }).find((item) => item.source.id === "first")!;
  const work = f.run(first.executionTaskId!);
  const running = await entered.promise;
  const target = {
    appId: app.id,
    conversationId: "primary",
    turnId: running.taskBinding!.attemptId,
    expectedRevision: running.taskBinding!.generation,
  };
  const control = {
    type: "conversation.turn.stop.requested",
    target: { appId: app.id },
    data: { conversationId: target.conversationId, turnId: target.turnId, expectedRevision: target.expectedRevision },
    idempotencyKey: "stop-first",
  };
  try {
    const aborted = new Promise<void>((resolve) =>
      running.signal!.addEventListener("abort", () => resolve(), { once: true }),
    );
    expect(events.publish(control, { source: "fixture-human" }).delivery).toBe("accepted");
    await aborted;
    expect(committedBeforeAbort).toBe(true);
    expect(events.publish(control, { source: "fixture-human" }).delivery).toBe("accepted");
    expect(f.store.readTask("independent")).toEqual(independent);
    ingress.publish("correction", correction);
    const next = listAppInboxItems(f.db, { appId: app.id }).find((item) => item.source.id === "correction")!;
    expect(next.status).not.toBe("done");
    finish.resolve();
    await work;
    expect(getAppInboxItem(f.db, first.id)?.result?.response).toContain("Stopped this turn");
    expect(
      readAppConversationResource(f.db, app.id, "primary").messages.some((message) => message.text === answer.response),
    ).toBe(false);
    ingress.runtime.close();
    await f.reopen();
    expect(readAppConversationResource(f.db, app.id, "primary").messages).toContainEqual(
      expect.objectContaining({ author: { kind: "human", id: "correction" }, text: correction }),
    );
    expect(getAppInboxItem(f.db, next.id)?.executionTaskId).toBe(first.executionTaskId);
    await f.run(first.executionTaskId!);
    const tasks = createAppTaskCapability({ bus: f.bus });
    expect(tasks.stopTurn(target).changed).toBe(false);
    expect(() => tasks.stopTurn({ ...target, conversationId: "wrong" })).toThrow();
    expect(getAppInboxItem(f.db, first.id)?.handling?.phase).toBe("stopped");
    expect(getAppInboxItem(f.db, next.id)?.result?.response).toBe("Let's discuss the costs first.");
    expect(readConversationRequest(f.db, app.id, "primary", "compare")).toMatchObject({
      status: "open",
      revision: 2,
      scope: correction,
    });
    expect(f.store.isCancelled(first.executionTaskId!)).toBe(false);
    await f.run(first.executionTaskId!);
    expect(calls).toBe(2);
  } finally {
    finish.resolve();
    await work;
    ingress.runtime.close();
  }
});

test("failed Task Stop persistence cannot abort execution or change accepted output", async () => {
  const entered = Promise.withResolvers<CallOptions>();
  const finish = Promise.withResolvers<void>();
  const f = await fixture(
    async (_definition, _prompt, options) => {
      entered.resolve(options);
      await finish.promise;
      return { status: "done", structuredResult: answer };
    },
    { installControllers: false },
  );
  const input = f.admit();
  const work = f.run(input.taskId);
  const running = await entered.promise;
  const tasks = createAppTaskCapability({ bus: f.bus });
  const target = {
    appId: app.id,
    conversationId: "primary",
    turnId: running.taskBinding!.attemptId,
    expectedRevision: running.taskBinding!.generation,
  };
  try {
    const before = readTaskSnapshot(f.context());
    f.db.exec(`CREATE TRIGGER no_stop BEFORE UPDATE ON app_inbox_items
      WHEN json_extract(NEW.handling, '$.phase') = 'stopped'
      BEGIN SELECT RAISE(ABORT, 'fixture Stop persistence failure'); END`);
    expect(() => tasks.stopTurn(target)).toThrow("fixture Stop persistence failure");
    expect(readTaskSnapshot(f.context())).toEqual(before);
    expect(running.signal?.aborted).toBe(false);
    expect(() => tasks.stopTurn({ ...target, expectedRevision: target.expectedRevision + 1 })).toThrow();
    f.db.exec("DROP TRIGGER no_stop");
    finish.resolve();
    await work;
    const accepted = f.store.readAttempt(target.turnId);
    expect(() => tasks.stopTurn(target)).toThrow("stale");
    expect(f.store.readAttempt(target.turnId)).toEqual(accepted);
    expect(getAppInboxItem(f.db, input.item.id)?.result?.response).toBe(answer.response);
    expect(running.signal?.aborted).toBe(false);
  } finally {
    finish.resolve();
    await work;
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
  } finally {
    ingress.runtime.close();
  }
});

test("the Conversation delegates and steers same-App work through the Task runtime across reopen", async () => {
  let humanTurns = 0;
  let backgroundRuns = 0;
  let linkedTopic = "";
  const ownApp = defineApp({
    ...app,
    requests: { mode: "agent", inputKinds: ["message"], conversationId: "primary" },
    inputSchema: Type.Union([
      Type.Object({ kind: Type.Literal("message"), data: Type.Object({}, { additionalProperties: true }) }),
      Type.Object({ kind: Type.Literal("goal"), data: Type.Object({ outcome: Type.String() }) }),
    ]),
    tasks: {},
    task: () => ({
      kind: "desired",
      intent: {
        id: "goal/review",
        parentId: "root",
        mode: "achieve",
        executor: "inspect",
        outcome: "Review the design",
        acceptance: ["Return evidence-backed findings"],
      },
    }),
  });
  const f = await fixture(
    async (_definition, prompt, options) => {
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      expect(context.source.kind).toBe("human");
      expect(options.toolPolicy).toBe("app-agent-full");
      const catalog = JSON.parse(prompt.split("## Installed Apps\n```json\n")[1]!.split("\n```")[0]!);
      expect(catalog.find((entry: { appId: string }) => entry.appId === app.id)?.inputs).toEqual([
        expect.objectContaining({ kind: "goal" }),
      ]);
      const next = ++humanTurns > 1;
      if (next)
        expect(context.conversation?.topics?.find((topic) => topic.id === linkedTopic)?.taskRefs).toContainEqual(
          expect.objectContaining({ appId: app.id, taskId: "goal/review" }),
        );
      return {
        status: "done",
        structuredResult: {
          summary: next ? "Review extended" : "Review accepted",
          response: next ? "I'll include recovery in the same review." : "I'll review it and return the findings here.",
          topic: next ? { kind: "existing", id: linkedTopic } : { kind: "new", title: "Design review" },
          followUp: {
            appId: app.id,
            ...(next ? { task: { appId: app.id, taskId: "goal/review" } } : {}),
            outcome: next ? "Include recovery in the review" : "Review the design",
            acceptance: ["Return evidence-backed findings"],
            input: { kind: "goal", data: { outcome: next ? "Include recovery" : "Review the design" } },
          },
        },
      };
    },
    (_root, appDir) => ({
      hostCapacity: new HostCapacity(2),
      appRegistrySnapshot: { id: "same-App", generation: 1, entries: [{ appDir, definition: ownApp }] },
      executors: {
        inspect: async () => {
          backgroundRuns++;
          return {
            state: "waiting",
            summary: "Waiting for the evidence source",
            conditions: [
              {
                id: "source",
                type: "source.ready",
                subject: "review",
                expected: true,
                owner: "app:source",
                reviewAfterMs: 60_000,
              },
            ],
          };
        },
      },
    }),
  );
  let ingress = await startConversationIngress(f);
  try {
    const waiting = eventAfter(
      f.bus,
      (event) => event.type === "project.task.reconcile.profiled" && event.data.taskId === "goal/review",
    );
    ingress.publish("first", "Review the design in the background");
    await waiting;
    const original = listAppInboxItems(f.db, { appId: app.id }).find((item) => item.source.kind === "human")!;
    linkedTopic = original.topicId!;
    expect(original.result?.response).toBe("I'll review it and return the findings here.");
    expect(backgroundRuns).toBe(1);
    const executionTaskId = original.executionTaskId!;
    ingress.runtime.close();
    await f.reopen();
    ingress = await startConversationIngress(f);
    expect(humanTurns).toBe(1);
    const resumed = eventAfter(
      f.bus,
      (event) =>
        event.type === "project.task.reconcile.profiled" && event.data.taskId === "goal/review" && backgroundRuns === 2,
    );
    ingress.publish("correction", "Include recovery in that same review");
    await resumed;
    expect(backgroundRuns).toBe(2);
    expect(humanTurns).toBe(2);
    expect(Object.keys(readTaskSnapshot(f.context()).resources!).sort()).toEqual(
      [executionTaskId, "goal/review"].sort(),
    );
    expect(new Set(listAppInboxItems(f.db, { appId: app.id }).map((item) => item.executionTaskId))).toEqual(
      new Set([executionTaskId]),
    );
    expect(readAppConversationResource(f.db, app.id, "primary").messages.at(-1)?.text).toBe(
      "I'll include recovery in the same review.",
    );
    expect(f.store.isCancelled("goal/review")).toBe(false);
  } finally {
    ingress.runtime.close();
  }
});

test("a subscribed App input executes in the default Conversation without a supervisor Task", async () => {
  let turns = 0;
  const f = await fixture(
    async (_definition, prompt) => {
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      expect(context.source.kind).toBe("system");
      expect(context.humanRequested).toBeUndefined();
      expect(context.input).toEqual({ kind: "message", data: { text: "Provider changed" } });
      turns++;
      return {
        status: "done",
        structuredResult: { summary: "Change explained", response: "The provider changed.", topic: { kind: "none" } },
      };
    },
    (_root, appDir) => ({
      appRegistrySnapshot: {
        id: "subscribed",
        generation: 1,
        entries: [
          {
            appDir,
            definition: defineApp({
              ...app,
              requests: { mode: "agent", conversationId: "primary" },
              subscriptions: [
                {
                  id: "provider",
                  event: { type: "provider.changed" },
                  toInput: () => ({ kind: "message", data: { text: "Provider changed" } }),
                },
              ],
            }),
          },
        ],
      },
    }),
  );
  const ingress = await startConversationIngress(f);
  try {
    const answered = eventAfter(
      f.bus,
      (event) =>
        event.type === "conversation.updated" &&
        readAppConversationResource(f.db, app.id, "primary").messages.some(
          (message) => message.text === "The provider changed.",
        ),
    );
    f.bus.emit({
      type: "provider.changed",
      source: "fixture",
      owner: "app:provider",
      target: { appId: app.id, project: app.id },
      data: {},
      idempotencyKey: "provider-change",
    });
    await answered;
    const items = listAppInboxItems(f.db, { appId: app.id });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: "done", conversationId: "primary", source: { kind: "system" } });
    expect(Object.keys(readTaskSnapshot(f.context()).resources!)).toEqual([items[0]!.executionTaskId!]);
    expect(turns).toBe(1);
  } finally {
    ingress.runtime.close();
  }
});

// Context and handoff contracts formerly exercised an independently executing
// inbox callback. These checks use real Task claims, preparation and settlement.
const contextTaskApp = defineApp({
  ...app,
  requests: { mode: "agent", inputKinds: ["message"], conversationId: "primary" },
  tasks: {},
  task: ({ id }) => ({
    kind: "desired",
    intent: {
      id: `work/${id}`,
      parentId: "root",
      mode: "achieve",
      outcome: "Review the current evidence",
      acceptance: ["Return supported findings"],
    },
  }),
});
const manualContextTasks = (_root: string, appDir: string): Partial<AppTaskRuntimeOptions> => ({
  installControllers: false,
  appRegistrySnapshot: { id: "context-tasks", generation: 1, entries: [{ appDir, definition: contextTaskApp }] },
});
const olderReview = {
  id: "work/older",
  parentId: "root",
  mode: "achieve" as const,
  outcome: "Review earlier evidence",
  acceptance: ["Return supported findings"],
};

test.each(["focus", "command"])(
  "Task-backed advice reads canonical %s context without changing the referenced work",
  async (source) => {
    let calls = 0;
    const f = await fixture(async (_definition, prompt) => {
      calls++;
      const context = JSON.parse(
        prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
      ) as AppInputContext;
      const observed = source === "focus" ? context.focusedTask : context.referencedTasks?.[0];
      expect(observed).toMatchObject({ appId: app.id, task: { id: olderReview.id, outcome: olderReview.outcome } });
      if (source === "command") expect(observed?.ref).toMatch(/^[0-9a-f]{8}$/);
      return {
        status: "done",
        structuredResult: {
          summary: "Explained the existing work",
          response: "That review is still open.",
          topic: { kind: "none" },
        },
      };
    }, manualContextTasks);
    observeAppTaskIntent(f.context(), { appAgent: app.agent!, intent: olderReview });
    const original = f.store.readTask(olderReview.id);
    if (source === "command")
      f.db
        .prepare(
          `INSERT INTO events (id, event_type, source, owner, data, timestamp)
     VALUES (10, 'conversation.message.created', 'console', 'app:chat', ?, 10)`,
        )
        .run(
          JSON.stringify({
            appId: app.id,
            conversationId: "primary",
            author: { kind: "command", id: "console" },
            text: "The earlier review is open",
            metadata: { command: "/tasks", taskRefs: [{ appId: app.id, taskId: olderReview.id }] },
          }),
        );
    const admitted = createAppTaskCapability({ bus: f.bus }).admitConversation({
      id: "advice",
      appId: app.id,
      conversationId: "primary",
      conversationSequence: 11,
      source: { kind: "human", id: "advice" },
      input: {
        kind: "message",
        data: {
          message: "Explain that review",
          ...(source === "focus" ? { context: { focusedTask: { appId: app.id, taskId: olderReview.id } } } : {}),
        },
      },
    });
    await f.run(admitted.taskId);
    expect(calls).toBe(1);
    expect(f.store.readTask(olderReview.id)).toEqual(original);
    expect(Object.keys(f.store.readSnapshot().resources!).sort()).toEqual([olderReview.id, admitted.taskId].sort());
    expect(getAppInboxItem(f.db, "advice")).toMatchObject({
      status: "done",
      result: { response: "That review is still open." },
    });
    expect(readAppConversationResource(f.db, app.id, "primary").topics).toEqual([]);
  },
);

test("a selected old Topic steers its exact Task even outside the bounded prompt context", async () => {
  const topicId = "topic_00000000abcdef0123456789";
  const f = await fixture(async (_definition, prompt) => {
    const context = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!) as AppInputContext;
    expect(context.conversation?.topics?.some((topic) => topic.id === topicId)).toBe(false);
    return {
      status: "done",
      structuredResult: {
        summary: "Continued the earlier review",
        response: "I will include the new evidence in that review.",
        topic: { kind: "existing", id: "00000000" },
        followUp: {
          appId: app.id,
          task: { appId: app.id, taskId: olderReview.id },
          outcome: "Include the new evidence",
          acceptance: ["Review the new evidence"],
          input: { kind: "goal", data: { message: "Include the latest sample" } },
        },
      },
    };
  }, manualContextTasks);
  observeAppTaskIntent(f.context(), { appAgent: app.agent!, intent: olderReview });
  for (let i = 0; i < 13; i++)
    createConversationTopic(f.db, {
      id: `topic_${i.toString(16).padStart(8, "0")}abcdef0123456789`,
      appId: app.id,
      conversationId: "primary",
      title: `Review ${i}`,
      openedBy: "human",
      originMessageId: `old-${i}`,
      now: i,
    });
  linkConversationTopicTask(f.db, topicId, app.id, olderReview.id);
  const admitted = f.admit("continue-old", "Continue review 00000000");
  await f.run(admitted.taskId);
  expect(getAppInboxItem(f.db, "continue-old"), f.store.readTask(admitted.taskId)?.status.summary).toMatchObject({
    status: "done",
    topicId,
  });
  expect(Object.keys(f.store.readSnapshot().resources!).sort()).toEqual([olderReview.id, admitted.taskId].sort());
  expect(f.store.readSnapshot().taskTriggers?.[olderReview.id]?.event).toMatchObject({
    data: { request: { input: { kind: "goal", data: { message: "Include the latest sample" } } } },
  });
  expect(
    readAppConversationResource(f.db, app.id, "primary", { topicId }).topics?.find((topic) => topic.id === topicId)
      ?.taskRefs,
  ).toEqual([expect.objectContaining({ appId: app.id, taskId: olderReview.id })]);
});

test.each(["handoff", "control"] as const)(
  "rejected guessed %s retains Task input for a corrected attempt after reopen",
  async (effect) => {
    let calls = 0;
    const f = await fixture(async (_definition, prompt) => {
      calls++;
      if (calls > 1) {
        const context = JSON.parse(
          prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!,
        ) as AppInputContext;
        expect(JSON.stringify(context.previousAttempt)).toContain("absent from Conversation context");
        return { status: "done", structuredResult: answer };
      }
      return {
        status: "done",
        structuredResult: {
          summary: `Tried a guessed ${effect}`,
          response: "I continued it.",
          topic: { kind: "new", title: "Guessed review" },
          ...(effect === "control"
            ? {
                taskControls: [
                  { kind: "cancel" as const, appId: app.id, taskId: olderReview.id, reason: "Human requested" },
                ],
              }
            : {
                followUp: {
                  appId: app.id,
                  task: { appId: app.id, taskId: olderReview.id },
                  outcome: "Continue the review",
                  acceptance: ["Review the evidence"],
                  input: { kind: "goal", data: {} },
                },
              }),
        },
      };
    }, manualContextTasks);
    observeAppTaskIntent(f.context(), { appAgent: app.agent!, intent: olderReview });
    const original = f.store.readTask(olderReview.id);
    const admitted = f.admit("unknown-target", "Continue it");
    await f.run(admitted.taskId);
    expect(f.store.readTask(admitted.taskId)?.status.summary).toContain("absent from Conversation context");
    expect(f.store.readTask(admitted.taskId)?.status.executionRetryAt).toBeGreaterThan(Date.now());
    expect(f.store.readTask(olderReview.id)).toEqual(original);
    expect(getAppInboxItem(f.db, "unknown-target")?.status).not.toBe("done");
    const discussion = readAppConversationResource(f.db, app.id, "primary");
    expect(discussion.topics).toEqual([]);
    expect(discussion.messages.some((message) => message.author.kind === "agent")).toBe(false);
    const due = f.store.readTask(admitted.taskId)!.status.executionRetryAt!;
    await f.reopen();
    setSystemTime(new Date(due));
    await f.run(admitted.taskId);
    expect(calls).toBe(2);
    expect(getAppInboxItem(f.db, "unknown-target")).toMatchObject({
      status: "done",
      result: { response: answer.response },
    });
    expect(f.store.readTask(olderReview.id)).toEqual(original);
    expect(f.store.isCancelled(admitted.taskId)).toBe(false);
  },
);

test("closed Task reuse retains the caller input for a corrected attempt after reopen", async () => {
  let calls = 0;
  const f = await fixture(async (_definition, prompt) => {
    const context = JSON.parse(prompt.match(/## Input and context\n```json\n([\s\S]*?)\n```/)![1]!) as AppInputContext;
    calls++;
    expect(context.conversation?.topics?.find((topic) => topic.id === "old-review")?.taskRefs).toContainEqual(
      expect.objectContaining({ appId: app.id, taskId: olderReview.id }),
    );
    if (calls > 1) expect(JSON.stringify(context.previousAttempt)).toContain("cancelled");
    return {
      status: "done",
      structuredResult: {
        summary: calls === 1 ? "Tried to reuse closed work" : "Recognized a new review",
        response: calls === 1 ? "I will reuse that review." : "That review is closed; I will start a new review.",
        topic: { kind: "existing", id: "old-review" },
        followUp: {
          appId: app.id,
          ...(calls === 1 ? { task: { appId: app.id, taskId: olderReview.id } } : {}),
          outcome: "Review the current evidence",
          acceptance: ["Return supported findings"],
          input: { kind: "goal", data: {} },
        },
      },
    };
  }, manualContextTasks);
  observeAppTaskIntent(f.context(), { appAgent: app.agent!, intent: olderReview });
  const prior = f.store.readTask(olderReview.id)!;
  cancelAppTask(f.context(), {
    appId: app.id,
    taskId: olderReview.id,
    expectedGeneration: prior.metadata.generation,
    expectedResourceVersion: prior.metadata.resourceVersion,
    reason: "The earlier assignment ended",
  });
  const closure = f.store.readCancellation(olderReview.id);
  createConversationTopic(f.db, {
    id: "old-review",
    appId: app.id,
    conversationId: "primary",
    title: "Earlier review",
    openedBy: "human",
    originMessageId: "earlier",
    now: 1,
  });
  linkConversationTopicTask(f.db, "old-review", app.id, olderReview.id);
  const admitted = createAppTaskCapability({ bus: f.bus }).admitConversation({
    id: "new-review",
    appId: app.id,
    conversationId: "primary",
    topicId: "old-review",
    source: { kind: "human", id: "new-review" },
    input: { kind: "message", data: { message: "Review the current evidence" } },
  });
  await f.run(admitted.taskId);
  expect(calls, f.store.readTask(admitted.taskId)?.status.summary).toBe(1);
  expect(getAppInboxItem(f.db, "new-review")?.status).not.toBe("done");
  expect(
    readAppConversationResource(f.db, app.id, "primary").messages.some((message) => message.author.kind === "agent"),
  ).toBe(false);
  const due = f.store.readTask(admitted.taskId)!.status.executionRetryAt!;
  expect(due).toBeGreaterThan(Date.now());
  await f.run(admitted.taskId);
  expect(calls, f.store.readTask(admitted.taskId)?.status.summary).toBe(1);
  await f.reopen();
  setSystemTime(new Date(due));
  await f.run(admitted.taskId);
  expect(calls).toBe(2);
  expect(getAppInboxItem(f.db, "new-review"), f.store.readTask(admitted.taskId)?.status.summary).toMatchObject({
    status: "done",
    result: { response: "That review is closed; I will start a new review." },
  });
  expect(f.store.readTask("work/new-review")).not.toBeNull();
  expect(f.store.readCancellation(olderReview.id)).toEqual(closure);
  expect(f.store.isCancelled(admitted.taskId)).toBe(false);
});
