// Isolated composition of real Host components. No model or live service.
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, type Condition, type ResourceObserver, observationCondition } from "@may-agent/sdk";
import { DbWriter } from "../../src/lib/db-writer.js";
import { getDb, closeDb } from "../../src/lib/requests.js";
import { EventBus, EVENT_ROW_ID } from "../../src/app/core/events/bus.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { normalizeAppAgent } from "../../src/app/app-agent-selection.js";
import { startAppInboxRuntime } from "../../src/app/composition/app-inbox-runtime.js";
import { createAppObserverRuntime } from "../../src/app/adapters/producers/app-observer-runtime.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import {
  appTaskContext,
  observeAppTaskIntent,
  claimObservedAppTask,
  deferAppTask,
  completeAppTask,
  listRunnableAppTaskIds,
  cancelAppTask,
} from "../../src/app/core/tasks/app-task-reconciler.js";
import {
  matchesAppTaskCondition,
  trackAppTaskConditionEventForTasks,
} from "../../src/app/core/tasks/app-task-condition-tracker.js";
import { readRuntimeTaskView } from "../../src/app/core/reads/app-read.js";
import { AppTaskRecoveryScheduler } from "../../src/app/core/tasks/app-task-recovery.js";
import { HumanTaskService } from "../../src/app/human-task-service.js";
import { observationDemandReader } from "../../src/app/core/state/observation-demand.js";
import { appObservationSelectors } from "../../src/app/core/reads/app-contract.js";

export async function until(predicate: () => boolean, label = "condition") {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise<void>((resolve) => setTimeout(resolve, 1));
  }
}

export async function fixture(detector: ResourceObserver) {
  const root = mkdtempSync(join(tmpdir(), "may-observation-poc-"));
  let db = getDb(root);
  let bus: EventBus;
  let runtime: Awaited<ReturnType<typeof startAppInboxRuntime>>;
  let observers: ReturnType<typeof createAppObserverRuntime>;
  let registry: AppRegistry;
  let clock = Date.now();
  let failPublication = false;
  let failAdmission = false;
  const configs = new Map<string, ReturnType<typeof appTaskContext>>();

  async function open() {
    db = getDb(root);
    for (const id of ["sample", "peer", "builds"]) {
      const appDir = join(root, `${id}.app`);
      mkdirSync(appDir, { recursive: true });
      const store = AppTaskResourceStore.fromDb(db, id);
      if (!store.isActive())
        store.bootstrapSnapshot({ root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }, "fixture");
      configs.set(
        id,
        appTaskContext({ appDir, projectDir: appDir, agent: `${id}-owner`, maxConcurrent: 8, resourceStore: store }),
      );
    }
    bus = new EventBus();
    const writer = new DbWriter(root);
    bus.setPersistenceSubscriber((event) => {
      if (failPublication && event.type === detector.type) throw new Error("injected publication failure");
      return writer.handler(event);
    });
    bus.setDeliveryRecorder(writer.recordDelivery);
    const entries = [...configs].map(([id, context]) => ({
      appDir: context.appDir,
      definition: defineApp({
        id,
        version: 1,
        agent: `${id}-owner`,
        inputSchema: Type.Object({}),
        tasks: {},
        // Lower-level registration is compiler output, not App-authored plumbing.
        observations:
          id === "builds"
            ? appObservationSelectors(
                defineApp({ id, version: 1, agent: id, inputSchema: Type.Object({}), observers: [detector] }),
              )
            : [],
      }),
    }));
    registry = new AppRegistry(async () => entries);
    await registry.reload();
    runtime = await startAppInboxRuntime({
      registry,
      db,
      bus,
      persistDir: root,
      now: () => clock,
      schedulesEnabled: false,
      scanIntervalMs: 60_000,
      observerContext: () => ({ read: {} as never, log: {} as never, workspace: { appRoot: root, projectRoot: root } }),
      previewTaskEventRoutes({ event }) {
        const grouped = new Map<string, Set<string>>();
        for (const route of configs.get("sample")!.resourceStore.readConditionRoutesForAllApps(event.type)) {
          if (!matchesAppTaskCondition(route.condition, event as never)) continue;
          const ids = grouped.get(route.appId) ?? new Set<string>();
          for (const id of route.taskIds) ids.add(id);
          grouped.set(route.appId, ids);
        }
        return [...grouped].map(([appId, ids]) => ({ appId, taskIds: [...ids] }));
      },
      admitTaskEvent({ appId, event, conditionTaskIds }) {
        if (failAdmission) throw new Error("injected admission failure");
        trackAppTaskConditionEventForTasks(
          configs.get(appId)!,
          { ...event, eventId: (event as typeof event & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID] } as never,
          conditionTaskIds ?? [],
        );
        return { accepted: true, by: "poc:existing-condition-tracker", route: "direct" };
      },
    });
    observers = createAppObserverRuntime({
      bus,
      now: () => clock,
      readDemand: observationDemandReader(db),
      context: () => ({
        read: {} as never,
        log: { info() {}, warn() {}, error() {}, debug() {} },
        workspace: { appRoot: root, projectRoot: root },
      }),
    });
    observers.replace([
      {
        appDir: root,
        definition: normalizeAppAgent(
          defineApp({
            id: "builds",
            version: 1,
            agent: "builds-owner",
            inputSchema: Type.Object({}),
            observers: [detector],
          }),
        ),
      },
    ]);
  }
  await open();
  const config = (appId = "sample") => configs.get(appId)!;
  const claim = (id: string, appId = "sample") => {
    const result = claimObservedAppTask(config(appId), { taskId: id, appAgent: `${appId}-owner`, handler: "agent" });
    if (result.kind !== "claimed") throw new Error(`Expected claim for ${id}, got ${result.kind}`);
    return result;
  };
  return {
    config,
    claim,
    async useHostObserver() {
      observers.close();
      clock += detector.intervalMs;
      await runtime.reload(undefined, async () =>
        [...configs].map(([id, context]) => ({
          appDir: context.appDir,
          definition: defineApp({
            id,
            version: 1,
            agent: `${id}-owner`,
            inputSchema: Type.Object({}),
            tasks: {},
            observers: id === "builds" ? [detector] : [],
          }),
        })),
      );
      await until(() => runtime.observerHealth("builds")[0]?.lastCompletedAt === clock, "installed detector");
    },
    async scanHost() {
      clock += detector.intervalMs;
      runtime.scanNow();
      await until(() => runtime.observerHealth("builds")[0]?.lastCompletedAt === clock, "installed detector scan");
    },
    appHealth() {
      return new HumanTaskService(db, registry, runtime.observerHealth).listApps("builds")[0]!;
    },
    get db() {
      return db;
    },
    get bus() {
      return bus;
    },
    health() {
      return observers.health("builds")[0]!;
    },
    capability: {
      waitFor(id: string, resource: string, expected: Record<string, unknown>, reviewAfterMs?: number) {
        return observationCondition(
          { ...detector, appId: "builds" },
          { observerId: detector.id, id, resource, expected, reviewAfterMs },
        );
      },
    },
    set publicationFails(value: boolean) {
      failPublication = value;
    },
    set admissionFails(value: boolean) {
      failAdmission = value;
    },
    view(id: string, appId = "sample") {
      return readRuntimeTaskView({ taskStateConfig: config(appId) }, id)!;
    },
    runnable(appId = "sample") {
      return listRunnableAppTaskIds(config(appId));
    },
    events(type = detector.type) {
      return db.prepare("SELECT id, data FROM events WHERE event_type=? ORDER BY id").all(type) as Array<{
        id: number;
        data: string;
      }>;
    },
    add(id: string, conditions: Condition[], appId = "sample", result = { prepared: true }) {
      observeAppTaskIntent(config(appId), {
        appAgent: `${appId}-owner`,
        creator: { appId },
        intent: { id, parentId: "root", outcome: `Review ${id}`, acceptance: ["Observed evidence reviewed"] },
      });
      deferAppTask(config(appId), claim(id, appId), {
        disposition: "waiting",
        summary: "Waiting for evidence",
        conditions,
        result,
        report: true,
      });
    },
    defer(held: ReturnType<typeof claim>, conditions?: Condition[], continueWork = false) {
      return deferAppTask(config(), held, {
        disposition: "waiting",
        summary: "Useful progress retained",
        conditions,
        ...(continueWork ? { continue: true } : {}),
      });
    },
    complete(id: string, appId = "sample") {
      return completeAppTask(config(appId), claim(id, appId), {
        summary: "Evidence reviewed",
        facts: ["Terminal provider state read"],
      });
    },
    cancel(id: string, appId = "sample") {
      const task = config(appId).resourceStore.readTask(id)!;
      return cancelAppTask(config(appId), {
        appId,
        taskId: id,
        expectedGeneration: task.metadata.generation,
        expectedResourceVersion: task.metadata.resourceVersion,
        actor: { appId },
        reason: "Trial no longer needs this observation",
      });
    },
    async scan(waitForAdmission = true) {
      clock += detector.intervalMs;
      observers.scanNow();
      await until(() => observers.health("builds")[0]?.lastCompletedAt === clock, "observer run to return");
      if (waitForAdmission)
        await until(() => {
          const row = db
            .prepare("SELECT count(*) AS n FROM app_event_admission_plans WHERE status='pending'")
            .get() as { n: number };
          return row.n === 0;
        }, "durable event admission");
    },
    async recover() {
      clock += 180_000;
      runtime.scanNow();
      await until(
        () =>
          (
            db.prepare("SELECT count(*) AS n FROM app_event_admission_plans WHERE status='pending'").get() as {
              n: number;
            }
          ).n === 0,
        "admission recovery",
      );
    },
    due(id: string, appId = "sample") {
      const store = config(appId).resourceStore;
      const task = store.readTask(id)!;
      const conditions = store.readTaskConditions(id);
      for (const condition of conditions) {
        condition.status.observedAt = new Date(Date.now() - 7_200_000).toISOString();
        condition.metadata.resourceVersion++;
      }
      if (
        !store.commit({
          fences: [
            { taskId: id, resourceVersion: task.metadata.resourceVersion, generation: task.metadata.generation },
          ],
          conditions,
        })
      )
        throw new Error("Unable to advance fixture wait clock");
      store.setRecoveryState(id, { nextCheckAt: Date.now() - 1 });
    },
    recoveryCandidates(appId = "sample") {
      const ids: string[] = [];
      const scheduler = new AppTaskRecoveryScheduler({
        source: config(appId).resourceStore,
        enqueue(id) {
          ids.push(id);
        },
      });
      try {
        scheduler.recover();
      } finally {
        scheduler.close();
      }
      return ids;
    },
    stopObserver() {
      observers.close();
    },
    async restart() {
      observers.close();
      runtime.close();
      closeDb(root);
      configs.clear();
      await open();
    },
    close() {
      observers.close();
      runtime.close();
      closeDb(root);
      rmSync(root, { recursive: true, force: true });
    },
  };
}
