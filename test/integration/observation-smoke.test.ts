import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp, defineObserver, observationCondition } from "@may-agent/sdk";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { EventBus } from "../../src/app/core/events/bus.js";
import { HostCapacity } from "../../src/app/core/scheduling/host-capacity.js";
import { createAppTaskCapability } from "../../src/app/core/tasks/app-task-capability.js";
import { startAppInboxRuntime } from "../../src/app/composition/app-inbox-runtime.js";
import { DbWriter } from "../../src/lib/db-writer.js";
import { getDb, closeDb } from "../../src/lib/requests.js";
import { until } from "../fixtures/resource-observer.js";

async function observationSmoke(mode: "prompt" | "periodic") {
  const root = mkdtempSync(join(tmpdir(), "may-observation-smoke-"));
  const appDir = join(root, "sample.app");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks/seed.json"),
    JSON.stringify({ root_task_id: "root", groups: { root: { id: "root", parent_id: null } } }),
  );
  const persistDir = join(root, "state");
  const db = getDb(persistDir);
  const bus = new EventBus();
  const writer = new DbWriter(persistDir);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  let reads = 0;
  let passed = mode === "prompt";
  const attempts: string[] = [];
  const observedAt = "2026-01-01T00:00:00.000Z";
  const detector = defineObserver({
    id: "build",
    type: "build.state",
    description: "Read a known harmless completed build",
    intervalMs: mode === "periodic" ? 50 : 3_600_000,
    timeoutMs: 1_000,
    async inspect(resource) {
      expect(resource).toBe("known-build");
      reads++;
      return { state: passed ? "passed" : "running", observedAt };
    },
  });
  const registry = new AppRegistry(async () => [
    {
      appDir,
      definition: defineApp({
        id: "sample",
        version: 1,
        agent: "sample-owner",
        tasks: {},
        inputSchema: Type.Object({}),
        observers: [detector],
      }),
    },
  ]);
  await registry.reload();
  const tasks = createAppTaskCapability({
    bus,
    runtime: {
      bus,
      projectsRoot: root,
      projectRoot: root,
      persistDir,
      hostCapacity: new HostCapacity(1),
      executors: {
        smoke: async (attempt) => {
          attempts.push(attempt.attemptId);
          const contract = await attempt.read.contract("sample");
          const capability = contract.observations.find((item) => item.id === "build")!;
          const evidence = attempt.events.items.find(
            (item) =>
              item.event.type === capability.type &&
              item.event.source === "app:sample:observer:build" &&
              item.event.data.resource === "known-build" &&
              item.event.data.state === "passed",
          );
          if (!evidence)
            return {
              state: "waiting",
              summary: "Verify the installed observation and return path",
              facts: [],
              conditions: [
                observationCondition(capability, {
                  observerId: capability.id,
                  id: "smoke-build",
                  resource: "known-build",
                  expected: { field: "state", equals: "passed" },
                }),
              ],
            };
          return {
            state: "converged",
            summary: "The installed observer resumed its Task owner",
            facts: [`event:${evidence.eventId}`],
            result: {
              eventId: evidence.eventId,
              observedAt: evidence.event.data.observedAt,
              resource: evidence.event.data.resource,
              receivingAttemptId: attempt.attemptId,
              waitingAttemptId: attempt.previousAttempt?.attemptId,
            },
          };
        },
      },
    },
  });
  let runtime: Awaited<ReturnType<typeof startAppInboxRuntime>> | undefined;
  try {
    await tasks.publishGeneration({
      snapshot: registry.snapshot(),
      definitionSource: { projectsRoot: root },
      publish() {},
    });
    runtime = await startAppInboxRuntime({
      registry,
      db,
      bus,
      persistDir,
      schedulesEnabled: false,
      scanIntervalMs: 3_600_000,
      attachTask: tasks.attach,
      admitTaskEvent: tasks.admitEvent,
      previewTaskEventRoutes: tasks.previewEventRoutes,
      hasTaskTarget: tasks.has,
      wakeAdmittedTasks: tasks.wake,
      observerContext: () => ({
        read: {} as never,
        log: {} as never,
        workspace: { appRoot: appDir, projectRoot: root },
      }),
    });
    await until(() => Boolean(runtime!.observerHealth("sample")[0]?.lastCompletedAt), "initial empty scan");
    await tasks.attach({
      appId: "sample",
      appDir,
      idempotencyKey: "smoke",
      attachment: {
        kind: "desired",
        intent: {
          id: "smoke",
          parentId: "root",
          outcome: "Verify the installed observation path",
          acceptance: ["Exact fact reaches a later owner attempt"],
          executor: "smoke",
        },
      },
      inputContext: { id: "smoke", source: { kind: "human", id: "tester" }, input: { kind: "smoke", data: {} } },
    });
    if (mode === "periodic") {
      await until(
        () => reads > 0 && !runtime!.observerHealth("sample")[0]?.running,
        "first unfinished source observation",
      );
      expect(attempts).toHaveLength(1);
      // Only the provider changes. No Task update, manual scan or wake can
      // conceal coupling to the Host's hour-long recovery interval.
      passed = true;
    }
    await until(
      () => tasks.get({ appId: "sample", taskId: "smoke" })?.status === "done",
      "automatic owner continuation",
    );
    expect(attempts).toHaveLength(2);
    if (mode === "prompt") expect(reads).toBe(1);
    else expect(reads).toBeGreaterThanOrEqual(2);
    const event = db.prepare(
      "SELECT id FROM events WHERE event_type='build.state' AND json_extract(data, '$.state')='passed'",
    ).get() as { id: number };
    expect(tasks.get({ appId: "sample", taskId: "smoke" })?.result).toEqual({
      eventId: event.id,
      observedAt,
      resource: "known-build",
      receivingAttemptId: attempts[1],
      waitingAttemptId: attempts[0],
    });
  } finally {
    runtime?.close();
    await tasks.close();
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
}

test.each(["prompt", "periodic"] as const)(
  "ordinary Task receives a %s observation and resumes its owner without manual wakes",
  observationSmoke,
  10_000,
);
