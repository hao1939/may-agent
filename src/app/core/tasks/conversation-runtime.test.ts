import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type ConversationTurnResult } from "@may-agent/sdk";
import type { SubagentManager } from "../../../lib/index.js";
import type { CallOptions, SubagentDefinition } from "../../../lib/types.js";
import { getDb, closeDb } from "../../../lib/requests.js";
import { EventBus, type AgentEvent } from "../events/bus.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { admitConversationTaskInput } from "../state/conversation-task-turns.js";
import { getAppInboxItem, claimAppInboxItem } from "../state/app-inbox-store.js";
import { readAppConversationResource } from "../state/conversations.js";
import { readConversationRequest } from "../state/conversation-requests.js";
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
function withBackground(root: string, appDir: string): Partial<AppTaskRuntimeOptions> {
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
        { appDir, definition: app },
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
