import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Type, defineApp } from "@may-agent/sdk";
import { HumanTaskService } from "../../human-task-service.js";
import { EventBus } from "../events/bus.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { getDb, closeDb } from "../../../lib/requests.js";
import { trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import { appTaskTestContext } from "./app-task-test-support.js";
import {
  appTaskContext,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  failAppTaskAttempt,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  repairUnadmittedAppDependencyWaits,
  retryFailedAppTask,
} from "./app-task-reconciler.js";
import {
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "./app-task-runtime.js";

const human = {
  id: "approval",
  type: "approval.decided",
  subject: "approval:release",
  expected: { candidate: "a", decision: "approved" },
  owner: "human",
  reviewAfterMs: 60_000,
  requestedAction: "Approve candidate a.",
};
const dependency = {
  id: "app-request:build",
  type: "app.dependency.updated",
  subject: "id:build",
  expected: { field: "status", equals: "done" },
  owner: "app:builder",
  reviewAfterMs: 60_000,
};
const admittedDependency = {
  ...dependency,
  id: "app-request:deploy",
  subject: "id:deploy",
};
const testResult = {
  id: "tests",
  type: "test.completed",
  subject: "test:release",
  expected: { field: "passed", equals: true },
  owner: "app:tester",
  reviewAfterMs: 60_000,
};

function directFixture(databasePath = ":memory:") {
  const root = mkdtempSync(join(tmpdir(), "task-obligation-coexistence-"));
  let config = appTaskTestContext({
    appDir: root,
    appId: "sample",
    databasePath,
    agent: "owner",
    maxConcurrent: 2,
    tree: {
      project: "sample",
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    },
  });
  observeAppTaskIntent(config, {
    appAgent: "owner",
    intent: { id: "parent", parentId: "root", outcome: "Supervise release", acceptance: ["Release reviewed"] },
  });
  observeAppTaskIntent(config, {
    appAgent: "owner",
    creator: { appId: "sample", taskId: "parent" },
    intent: { id: "work", parentId: "root", outcome: "Deliver release", acceptance: ["Release delivered"] },
  });
  const claim = (taskId = "work") => {
    const result = claimObservedAppTask(config, { taskId, appAgent: "owner", handler: "agent:owner" });
    if (result.kind !== "claimed") throw new Error(`Expected claim, received ${result.kind}`);
    return result;
  };
  const ids = () => [...(config.resourceStore.readTask("work")?.status.conditionIds ?? [])];
  let eventId = 100;
  const wake = () =>
    recordAppTaskTrigger(config, "work", {
      type: "sample.progress",
      eventId: eventId++,
      data: { message: "Reconsider current facts" },
    });
  return {
    root,
    get config() {
      return config;
    },
    claim,
    ids,
    wake,
    reopen() {
      config.resourceStore.close();
      config = appTaskContext({
        appDir: root,
        projectDir: root,
        agent: "owner",
        maxConcurrent: 2,
        resourceStore: AppTaskResourceStore.openStandalone(databasePath, "sample"),
      });
    },
    close() {
      config.resourceStore.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

test("Condition declarations are additive, exact-id updates are fresh, and empty or omitted declarations preserve peers", () => {
  const root = mkdtempSync(join(tmpdir(), "task-obligation-file-"));
  const databasePath = join(root, "tasks.db");
  const f = directFixture(databasePath);
  try {
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Await approval and build",
      conditions: [human, dependency],
    });
    const dependencyBefore = structuredClone(
      f.config.resourceStore.readTaskContext({ taskIds: ["work"] }).conditions?.[dependency.id],
    );

    f.wake();
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Also await tests",
      conditions: [testResult],
    });
    expect(f.ids()).toEqual([human.id, dependency.id, testResult.id]);

    const updatedHuman = {
      ...human,
      expected: { candidate: "b", decision: "approved" },
      requestedAction: "Approve candidate b.",
    };
    f.wake();
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Approval now targets candidate b",
      conditions: [updatedHuman],
    });
    let tree = f.config.resourceStore.readTaskContext({ taskIds: ["work"] });
    expect(f.ids()).toEqual([human.id, dependency.id, testResult.id]);
    expect(tree.conditions?.approval?.metadata.generation).toBe(2);
    expect(tree.conditions?.approval?.status.state).toBe("unknown");
    expect(tree.conditions?.[dependency.id]).toEqual(dependencyBefore);

    for (const conditions of [[], undefined] as const) {
      f.wake();
      deferAppTask(f.config, f.claim(), {
        disposition: "waiting",
        summary: "No obligation changes",
        ...(conditions === undefined ? {} : { conditions }),
      });
      expect(f.ids()).toEqual([human.id, dependency.id, testResult.id]);
    }

    f.reopen();
    tree = f.config.resourceStore.readTaskContext({ taskIds: ["work"] });
    expect(tree.resources?.work?.status.conditionIds).toEqual([human.id, dependency.id, testResult.id]);
    expect(tree.conditions?.approval?.spec).toMatchObject({
      type: updatedHuman.type,
      subject: updatedHuman.subject,
      expected: updatedHuman.expected,
      owner: updatedHuman.owner,
      reviewAfterMs: updatedHuman.reviewAfterMs,
      requestedAction: updatedHuman.requestedAction,
    });
    expect(tree.conditions?.[dependency.id]).toEqual(dependencyBefore);

    const saved = f.config.resourceStore.db
      .prepare("SELECT condition_json FROM app_task_conditions WHERE app_id = ? AND condition_id = ?")
      .get("sample", human.id) as { condition_json: string };
    const legacy = JSON.parse(saved.condition_json) as { spec: Record<string, unknown> };
    delete legacy.spec.owner;
    delete legacy.spec.reviewAfterMs;
    f.config.resourceStore.db
      .prepare("UPDATE app_task_conditions SET condition_json = ? WHERE app_id = ? AND condition_id = ?")
      .run(JSON.stringify(legacy), "sample", human.id);
    f.reopen();
    f.wake();
    deferAppTask(f.config, f.claim(), { disposition: "waiting", summary: "Retain legacy wait without rewriting it" });
    tree = f.config.resourceStore.readTaskContext({ taskIds: ["work"] });
    expect(tree.resources?.work?.status.conditionIds).toEqual([human.id, dependency.id, testResult.id]);
    expect(tree.conditions?.approval?.spec).not.toHaveProperty("owner");
    expect(tree.conditions?.approval?.spec).not.toHaveProperty("reviewAfterMs");
  } finally {
    f.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("repair, failure, retry, unblock, satisfaction, and retirement mutate only their exact obligation", () => {
  const f = directFixture();
  try {
    deferAppTask(f.config, f.claim(), {
      disposition: "waiting",
      summary: "Await independent facts",
      conditions: [human, dependency, admittedDependency, testResult],
    });

    const isAdmitted = (requestId: string) => requestId === "deploy";
    expect(repairUnadmittedAppDependencyWaits(f.config, isAdmitted, ["work"])).toHaveLength(1);
    expect(f.ids()).toEqual([human.id, admittedDependency.id, testResult.id]);
    expect(repairUnadmittedAppDependencyWaits(f.config, isAdmitted, ["work"])).toEqual([]);

    const failed = f.claim();
    failAppTaskAttempt(f.config, failed, "Transient executor failure");
    expect(f.ids()).toEqual([human.id, admittedDependency.id, testResult.id]);
    const failedTask = f.config.resourceStore.readTask("work")!;
    retryFailedAppTask(f.config, {
      appId: "sample",
      taskId: "work",
      expectedGeneration: failedTask.metadata.generation,
      expectedResourceVersion: failedTask.metadata.resourceVersion,
    });
    expect(f.ids()).toEqual([human.id, admittedDependency.id, testResult.id]);
    deferAppTask(f.config, f.claim(), { disposition: "waiting", summary: "Retry still awaits the same facts" });

    completeAppTask(f.config, f.claim("parent"), {
      summary: "Reconsider without fulfilling waits",
      facts: ["diagnostic available"],
      actions: [{ kind: "unblock-task", taskId: "work", expectedGeneration: 1, reason: "Try the diagnostic" }],
    });
    expect(f.ids()).toEqual([human.id, admittedDependency.id, testResult.id]);

    expect(
      trackAppTaskConditionEventForTasks(
        f.config,
        { type: "test.completed", data: { test: "release", passed: true } },
        ["work"],
      ),
    ).toEqual([expect.objectContaining({ conditionId: testResult.id })]);
    f.wake();
    deferAppTask(f.config, f.claim(), { disposition: "waiting", summary: "Tests passed; other obligations remain" });
    expect(f.ids()).toEqual([human.id, admittedDependency.id]);

    f.wake();
    const retirement = f.claim();
    const retireApproval = {
      kind: "retire-condition" as const,
      conditionId: human.id,
      expectedConditionGeneration: 1,
      reason: "The exact candidate will not ship",
    };
    expect(() =>
      deferAppTask(f.config, retirement, {
        disposition: "waiting",
        summary: "Conflicting retirement",
        facts: ["release cancelled by owner"],
        conditions: [human],
        actions: [retireApproval],
      }),
    ).toThrow("cannot retire and redeclare Condition approval");
    expect(f.ids()).toEqual([human.id, admittedDependency.id]);
    deferAppTask(f.config, retirement, {
      disposition: "waiting",
      summary: "Approval request withdrawn",
      facts: ["release cancelled by owner"],
      actions: [retireApproval],
    });
    expect(f.ids()).toEqual([admittedDependency.id]);
    expect(
      deferAppTask(f.config, retirement, {
        disposition: "waiting",
        summary: "Stale result must not restore waits",
        conditions: [human],
      }).status,
    ).toBe("stale");
    expect(f.ids()).toEqual([admittedDependency.id]);
  } finally {
    f.close();
  }
});

test("installed executor omission preserves mixed waits and HumanTaskService projection across reopen", async () => {
  const root = mkdtempSync(join(tmpdir(), "task-obligation-runtime-"));
  const appDir = join(root, "projects/sample.app");
  const persistDir = join(root, "state");
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks/seed.json"),
    JSON.stringify({
      project: "sample",
      project_lifecycle: "active",
      root_task_id: "root",
      groups: { root: { id: "root", parent_id: null } },
    }),
  );
  const db = getDb(persistDir);
  const config = appTaskTestContext({
    appDir,
    agent: "owner",
    maxConcurrent: 1,
    resourceStore: AppTaskResourceStore.fromDb(db, "sample"),
  });
  const bus = new EventBus();
  const definition = defineApp({
    id: "sample",
    version: 1,
    agent: "owner",
    inputSchema: Type.Object({}, { additionalProperties: true }),
    workspace: { kind: "local", localPath: "." },
    tasks: {},
  });
  const snapshot = { id: "obligation-test", generation: 1, entries: [{ appDir, definition }] };
  let calls = 0;
  try {
    await installAppTaskRuntimes({
      projectsRoot: join(root, "projects"),
      projectRoot: root,
      persistDir,
      bus,
      hostCapacity: new HostCapacity(1),
      installControllers: false,
      appRegistrySnapshot: snapshot,
      executors: {
        worker: async () => ({
          state: "waiting" as const,
          summary: "Still waiting",
          facts: [],
          ...(++calls === 1 ? { conditions: [human, dependency] } : {}),
        }),
      },
    });
    observeAppTaskIntent(config, {
      appAgent: "owner",
      intent: {
        id: "release",
        parentId: "root",
        outcome: "Ship release",
        acceptance: ["Released"],
        executor: "worker",
      },
    });
    const run = () =>
      reconcileLoadedAppTaskOnce({
        bus,
        appId: "sample",
        taskId: "release",
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
    await run();
    recordAppTaskTrigger(config, "release", {
      type: "sample.progress",
      eventId: 42,
      data: { message: "Review without changing waits" },
    });
    await run();
    expect(config.resourceStore.readTask("release")?.status.conditionIds).toEqual([human.id, dependency.id]);
    const humanTasks = new HumanTaskService(db, { snapshot: () => snapshot });
    expect(humanTasks.listTasks({ appId: "sample", humanActionOnly: true }).items).toEqual([
      expect.objectContaining({ taskId: "release" }),
    ]);

    await closeInstalledAppTaskRuntimes(bus);
    closeDb(persistDir);
    const reopened = AppTaskResourceStore.openStandalone(join(persistDir, "may.db"), "sample");
    try {
      expect(reopened.readTask("release")?.status.conditionIds).toEqual([human.id, dependency.id]);
    } finally {
      reopened.close();
    }
  } finally {
    await closeInstalledAppTaskRuntimes(bus);
    closeDb(persistDir);
    rmSync(root, { recursive: true, force: true });
  }
});
