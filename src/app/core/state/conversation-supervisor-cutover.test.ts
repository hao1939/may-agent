import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type TaskIntent } from "@may-agent/sdk";
import { getDb, closeDb } from "../../../lib/requests.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { EventBus, EVENT_ROW_ID } from "../events/bus.js";
import { AppRegistry } from "../apps/registry.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { createAppTaskCapability } from "../tasks/app-task-capability.js";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  admitStandaloneCanonicalAppTaskEvent,
  type AppTaskRuntimeOptions,
} from "../tasks/app-task-runtime.js";
import { standaloneAppTaskAdmissionDescriptors } from "../tasks/runtime-definition.js";
import {
  appTaskContext,
  observeAppTaskIntent,
  claimObservedAppTask,
  completeAppTask,
  closeAppTask,
  assertAppTaskClaimCurrent,
} from "../tasks/app-task-reconciler.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { claimAppInboxItem, assertAppInboxClaim } from "../../../../test/fixtures/legacy-inbox.js";
import { createConversationTopic, linkConversationTopicTask, readConversationTopic } from "./conversations.js";
import { applyConversationRequestUpdates, readConversationRequest } from "./conversation-requests.js";
import {
  createAppEventAdmissionPlan,
  getAppEventAdmissionPlan,
  markAppEventAdmissionCommandAdmitted,
  completeAppEventAdmissionPlan,
} from "./app-event-admission-store.js";
import { migrateConversationInputs } from "./conversation-cutover.js";
import { conversationTaskId, listPendingConversationTaskChanges } from "./conversation-task-turns.js";
import { prepareConversationTaskTurn } from "../../composition/conversation-task-turn.js";
import { startAppInboxRuntime, type AppInboxRuntime } from "../../composition/app-inbox-runtime.js";

test("offline cutover drains frozen supervisor admission, closes its owner, and returns missed results through Conversation", async () => {
  const root = mkdtempSync(join(tmpdir(), "may-supervisor-cutover-"));
  let bus = new EventBus();
  let db = getDb(root);
  let runtime: AppInboxRuntime | undefined;
  let supervisorRuns = 0;
  let reportedOutcomes = 0;
  const app = defineApp({
    id: "chat",
    version: 1,
    agent: "chat",
    requests: { mode: "agent", inputKinds: ["message"] },
    tasks: { maxConcurrent: 2 },
    inputSchema: Type.Object({ kind: Type.String(), data: Type.Object({}, { additionalProperties: true }) }),
  });
  let store = AppTaskResourceStore.fromDb(db, app.id);
  store.bootstrapSnapshot(
    {
      project: app.id,
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
    "cutover",
  );
  const config = () =>
    appTaskContext({ appDir: root, projectDir: root, agent: app.id, resourceStore: store, maxConcurrent: 2 });
  const options = (): AppTaskRuntimeOptions => ({
    projectRoot: root,
    projectsRoot: root,
    persistDir: root,
    bus,
    appRegistrySnapshot: { id: "without-supervisor", generation: 2, entries: [{ appDir: root, definition: app }] },
    executors: {
      supervisor: async () => {
        supervisorRuns++;
        throw new Error("Retired supervisor executed");
      },
    },
    conversations: {
      execute: (turn) =>
        prepareConversationTaskTurn({
          ...turn,
          resolveRequest: async ({ request }) => {
            const outcomes = request.inputs?.filter((item) => item.input.kind === "task-outcome") ?? [];
            if (!outcomes.length)
              return {
                summary: "Continuing discussion",
                response: "I will bring back the result.",
                topic: { kind: "existing", id: "measurement" },
              };
            expect(outcomes).toHaveLength(1);
            expect(outcomes[0]!.input.data).toMatchObject({
              taskId: "measurement",
              outcome: { result: { value: 17 } },
            });
            reportedOutcomes++;
            return {
              summary: "Measurement verified",
              response: "The measurement is 17.",
              topic: { kind: "existing", id: "measurement" },
              requestUpdates: [
                {
                  id: "measurement",
                  expectedRevision: 1,
                  scope: "Measure the sample",
                  disposition: "fulfilled",
                  reason: "The measured value is 17",
                },
              ],
            };
          },
        }),
    },
  });
  const persist = () => {
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber(writer.handler);
    bus.setDeliveryRecorder(writer.recordDelivery);
  };
  persist();
  try {
    createAppInboxItem(db, {
      id: "ask",
      appId: app.id,
      conversationId: "primary",
      conversationSequence: 1,
      source: { kind: "human", id: "ask" },
      input: { kind: "message", data: { text: "Measure the sample" } },
    });
    const obsoleteInbox = claimAppInboxItem(db, "ask", "old-inbox", 60_000)!;
    createConversationTopic(db, {
      id: "measurement",
      appId: app.id,
      conversationId: "primary",
      title: "Measurement",
      openedBy: "human",
      originMessageId: "ask",
    });
    applyConversationRequestUpdates(db, {
      appId: app.id,
      conversationId: "primary",
      topicId: "measurement",
      updateKey: "accepted",
      now: Date.now(),
      updates: [{ id: "measurement", expectedRevision: 0, scope: "Measure the sample", disposition: "open" }],
    });
    const workerIntent: TaskIntent = {
      id: "measurement",
      parentId: "root",
      executor: "measure",
      outcome: "Measure the sample",
      acceptance: ["Retain the value"],
    };
    observeAppTaskIntent(config(), { appAgent: app.id, intent: workerIntent });
    const worker = claimObservedAppTask(config(), {
      taskId: workerIntent.id,
      appAgent: app.id,
      handler: "executor:measure",
    });
    if (worker.kind !== "claimed") throw new Error("Worker was not claimed");
    completeAppTask(config(), worker, { summary: "Measured", evidence: ["instrument:17"], result: { value: 17 } });
    linkConversationTopicTask(db, "measurement", app.id, workerIntent.id);
    const supervisorIntent: TaskIntent = {
      id: "conversation/follow-up",
      parentId: "root",
      executor: "supervisor",
      outcome: "Return linked results",
      acceptance: ["Close the loop"],
    };
    observeAppTaskIntent(config(), { appAgent: app.id, intent: supervisorIntent });
    const obsoleteSupervisor = claimObservedAppTask(config(), {
      taskId: supervisorIntent.id,
      appAgent: app.id,
      handler: "executor:supervisor",
    });
    if (obsoleteSupervisor.kind !== "claimed") throw new Error("Supervisor was not claimed");
    const event = bus.emit({
      type: "conversation.task.changed",
      source: "fixture",
      owner: "app:chat",
      data: {
        appId: app.id,
        conversationId: "primary",
        topicId: "measurement",
        taskRef: { appId: app.id, taskId: workerIntent.id },
        attemptId: worker.attemptId,
      },
    });
    const eventId = Number(event[EVENT_ROW_ID]);
    createAppEventAdmissionPlan(db, {
      eventId,
      registrySnapshotId: "old-supervisor",
      registryGeneration: 1,
      routes: [
        { appId: app.id, kind: "task", routeId: "task-resolver", intent: supervisorIntent, conditionTaskIds: [] },
      ],
    });
    const originalWorker = store.readTaskContext({ taskIds: [workerIntent.id] });
    const originalRequest = readConversationRequest(db, app.id, "primary", "measurement");
    const originalTopic = readConversationTopic(db, app.id, "primary", "measurement");

    // Offline storage admission only: no controller or provider can execute the drained intent.
    const descriptor = standaloneAppTaskAdmissionDescriptors({
      persistDir: root,
      projectsRoot: root,
      entries: [{ appDir: root, definition: app }],
    }).get(app.id)!;
    const cutover = () =>
      stateTransaction(db, () => {
        const plan = getAppEventAdmissionPlan(db, eventId)!;
        const command = plan.commands[0]!;
        if (command.kind !== "task") throw new Error("Expected frozen supervisor admission");
        expect(
          admitStandaloneCanonicalAppTaskEvent({
            descriptor,
            event,
            intent: command.intent,
            conditionTaskIds: command.conditionTaskIds,
          }).delivery,
        ).toBeDefined();
        markAppEventAdmissionCommandAdmitted(db, { eventId, appId: app.id });
        expect(completeAppEventAdmissionPlan(db, eventId)).toBe(true);
        migrateConversationInputs(config(), { app, conversationId: "primary", oldRuntimeStopped: true });
        const supervisor = store.readTask(supervisorIntent.id)!;
        closeAppTask(config(), {
          appId: app.id,
          taskId: supervisorIntent.id,
          expectedGeneration: supervisor.metadata.generation,
          expectedResourceVersion: supervisor.metadata.resourceVersion,
          reason: "Owner moved follow-through into Conversation",
        });
      });
    db.exec(
      "CREATE TRIGGER fail_retirement BEFORE INSERT ON app_task_cancellations BEGIN SELECT RAISE(ABORT, 'retirement unavailable'); END",
    );
    expect(cutover).toThrow("retirement unavailable");
    expect(getAppEventAdmissionPlan(db, eventId)?.status).toBe("pending");
    expect(store.readTask(conversationTaskId(app.id, "primary"))).toBeNull();
    expect(() => assertAppTaskClaimCurrent(config(), obsoleteSupervisor)).not.toThrow();
    expect(() => assertAppInboxClaim(db, obsoleteInbox)).not.toThrow();
    db.exec("DROP TRIGGER fail_retirement");
    cutover();
    expect(getAppEventAdmissionPlan(db, eventId)?.status).toBe("completed");
    expect(store.readCancellation(supervisorIntent.id)?.decidedBy).toEqual({ kind: "app-policy" });
    expect(completeAppTask(config(), obsoleteSupervisor, { summary: "Obsolete supervisor reply" }).status).toBe(
      "stale",
    );
    expect(() => assertAppInboxClaim(db, obsoleteInbox)).toThrow();
    expect(store.readTaskContext({ taskIds: [workerIntent.id] })).toEqual(originalWorker);
    expect(readConversationRequest(db, app.id, "primary", "measurement")).toEqual(originalRequest);
    expect(readConversationTopic(db, app.id, "primary", "measurement")).toEqual(originalTopic);
    expect(supervisorRuns).toBe(0);

    await closeInstalledAppTaskRuntimes(bus);
    closeDb(root);
    db = getDb(root);
    store = AppTaskResourceStore.fromDb(db, app.id);
    bus = new EventBus();
    persist();
    let stopWatching: (() => void) | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const returned = new Promise<void>((resolve, reject) => {
      deadline = setTimeout(() => {
        stopWatching?.();
        reject(new Error("Migrated result did not return"));
      }, 5_000);
      stopWatching = bus.listen((fact) => {
        if (
          fact.type !== "conversation.updated" ||
          readConversationRequest(db, app.id, "primary", "measurement")?.status !== "closed"
        )
          return;
        clearTimeout(deadline);
        stopWatching?.();
        resolve();
      });
    });
    try {
      await installAppTaskRuntimes(options(), { deferRecovery: true });
      const registry = new AppRegistry(async () => [{ appDir: root, definition: app }]);
      await registry.reload();
      const current = createAppTaskCapability({ bus });
      runtime = await startAppInboxRuntime({
        registry,
        db,
        bus,
        persistDir: root,
        schedulesEnabled: false,
        admitConversation: current.admitConversation,
        admitConversationChange: current.admitConversationChange,
        admitTaskEvent: current.admitEvent,
        readDependency: current.readDependency,
        attachTask: current.attach,
      });
      bus.emit({
        type: "conversation.supervision.review",
        source: "fixture-timer",
        owner: "app:chat",
        data: { project: app.id },
      });
      await returned;
    } finally {
      clearTimeout(deadline);
      stopWatching?.();
    }
    expect(reportedOutcomes).toBe(1);
    expect(supervisorRuns).toBe(0);
    expect(store.isCancelled(supervisorIntent.id)).toBe(true);
    expect(store.isCancelled(workerIntent.id)).toBe(false);
    expect(store.isCancelled(conversationTaskId(app.id, "primary"))).toBe(false);
    expect(getAppInboxItem(db, "ask")?.status).toBe("done");
    expect(listPendingConversationTaskChanges(db, app.id)).toEqual([]);
    expect(getAppEventAdmissionPlan(db, eventId)?.status).toBe("completed");
    expect(store.listRecoveryCandidates().items).toEqual([]);
  } finally {
    runtime?.close();
    await closeInstalledAppTaskRuntimes(bus);
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});
