import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppDefinition, AppObserver, TaskAttempt, TaskReconcileResult } from "@may-agent/sdk";
import { createTestAppRead, createTestAppLogger } from "@may-agent/sdk/testing";
import { DbWriter } from "../../src/lib/db-writer.js";
import { closeDb, getDb } from "../../src/lib/requests.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { HostCapacity } from "../../src/app/core/scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { appTaskTestContext } from "../../src/app/core/tasks/app-task-test-support.js";
import { observeAppTaskIntent } from "../../src/app/core/tasks/app-task-reconciler.js";
import { readTaskSnapshot } from "../../src/app/core/tasks/app-task-store.js";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  admitLoadedCanonicalAppTaskEvent,
  previewLoadedCanonicalAppTaskEvent,
  previewLoadedCanonicalAppTaskEventRoutes,
  readLoadedAppTaskView,
  reconcileLoadedAppTaskOnce,
  attachLoadedAppTask,
} from "../../src/app/core/tasks/app-task-runtime.js";
import { startAppInboxRuntime } from "../../src/app/composition/app-inbox-runtime.js";
import { createAppObserverRuntime } from "../../src/app/adapters/producers/app-observer-runtime.js";

/** Portable paired-App proof: real publication, inbox, Task storage and executor.
 * Only provider reads and the final executor are fixtures. Controllers are gated;
 * installation paths, credentials, subprocess agents or model calls. */
export async function observerFeedbackFixture(definition: AppDefinition, observer: AppObserver, rootGroup = "root") {
  const root = mkdtempSync(join(tmpdir(), "may-observer-feedback-"));
  const appDir = join(root, "projects", `${definition.id}.app`);
  mkdirSync(appDir, { recursive: true });
  const bus = new EventBus(),
    db = getDb(root),
    writer = new DbWriter(root);
  const capacity = new HostCapacity(2);
  let failPublication = false,
    failAdmission = false,
    now = Date.now();
  bus.setPersistenceSubscriber((event) => {
    if (failPublication && event.type !== "app.observer.failed") throw new Error("fixture persistence unavailable");
    writer.handler(event);
  });
  bus.setDeliveryRecorder(writer.recordDelivery);
  const app = { ...definition, observers: [], schedules: [], workspace: { kind: "local" as const, localPath: "." } };
  const registry = new AppRegistry(async () => [{ appDir, definition: app }]);
  const config = appTaskTestContext({
    appId: app.id,
    appDir,
    agent: app.agent ?? app.owner ?? "worker",
    maxConcurrent: 2,
    resourceStore: AppTaskResourceStore.fromDb(db, app.id),
    tree: {
      project: app.id,
      project_lifecycle: "active",
      root_task_id: rootGroup,
      groups: {
        [rootGroup]: { id: rootGroup, parent_id: null, state: "backlog", children: [] },
      },
    },
  });
  const attempts: TaskAttempt[] = [];
  const controllerGate = Promise.withResolvers<void>();
  let execute = async (_attempt: TaskAttempt): Promise<TaskReconcileResult> => ({
    state: "converged",
    summary: "Fixture reviewed the input",
    facts: ["fixture:reviewed"],
  });
  await registry.reload();
  await installAppTaskRuntimes(
    {
      projectRoot: root,
      projectsRoot: join(root, "projects"),
      persistDir: root,
      bus,
      hostCapacity: capacity,
      appRegistrySnapshot: registry.snapshot(),
      startAfter: controllerGate.promise,
      executors: {
        fixture: async (attempt) => {
          attempts.push(attempt);
          return execute(attempt);
        },
      },
    },
    { deferRecovery: true },
  );
  const inbox = await startAppInboxRuntime({
    registry,
    db,
    bus,
    persistDir: root,
    deferStart: true,
    schedulesEnabled: false,
    attachTask: (input) => attachLoadedAppTask({ ...input, bus }),
    admitTaskEvent: (input) => {
      if (failAdmission) throw new Error("fixture Task admission unavailable");
      return admitLoadedCanonicalAppTaskEvent({ ...input, bus });
    },
    previewTaskEvent: (input) => previewLoadedCanonicalAppTaskEvent({ ...input, bus }),
    previewTaskEventRoutes: (input) => previewLoadedCanonicalAppTaskEventRoutes({ ...input, bus }),
  });
  const read = createTestAppRead();
  read.tasks.get = async (taskId) => readLoadedAppTaskView({ bus, appDir, taskId });
  let current: ReturnType<AppObserver["run"]> | undefined;
  let dispatchId = 0;
  const runtime = createAppObserverRuntime({
    bus,
    now: () => now,
    context: () => ({ read, log: createTestAppLogger(), workspace: { appRoot: appDir, projectRoot: appDir } }),
  });
  runtime.replace([
    {
      appDir,
      definition: {
        ...app,
        observers: [
          {
            ...observer,
            run(ctx) {
              current = observer.run(ctx);
              return current;
            },
          },
        ],
      },
    },
  ]);
  return {
    root,
    appDir,
    bus,
    db,
    config,
    inbox,
    attempts,
    read,
    publicationUnavailable(value: boolean) {
      failPublication = value;
    },
    admissionUnavailable(value: boolean) {
      failAdmission = value;
    },
    executeWith(fn: typeof execute) {
      execute = fn;
    },
    createTask(id: string) {
      return observeAppTaskIntent(config, {
        appAgent: config.agent,
        intent: {
          id,

          parentId: rootGroup,
          outcome: `Review ${id}`,
          acceptance: ["Input reviewed"],
          executor: "fixture",
        },
      });
    },
    snapshot: () => readTaskSnapshot(config),
    async scan() {
      runtime.scanNow();
      // Host registers its publication continuation before this waiter.
      await current?.catch(() => undefined);
      now += observer.intervalMs;
    },
    async runTask(taskId: string) {
      const startedAt = ++dispatchId;
      const profiled = Promise.withResolvers<void>();
      const unsubscribe = bus.subscribe((event) => {
        if (event.type === "project.task.reconcile.profiled" && event.data.startedAt === startedAt) profiled.resolve();
      });
      try {
        return await reconcileLoadedAppTaskOnce({
          bus,
          appId: app.id,
          taskId,
          dispatch: { enqueuedAt: startedAt, startedAt, readyWaitMs: 0, lane: "normal" },
        });
      } finally {
        // Reconciliation's deferred profiling append must drain before closing SQLite.
        await profiled.promise;
        unsubscribe();
      }
    },
    async close() {
      runtime.close();
      inbox.close();
      const drained = closeInstalledAppTaskRuntimes(bus);
      controllerGate.resolve();
      await drained;
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    },
  };
}
