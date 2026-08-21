import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../lib/db.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { listRuntimeTaskViews, readRuntimeTaskView } from "./app-read.js";
import type { AppTaskResource } from "./app-task-state.js";
import {
  cacheTaskStateReads,
  readTaskState,
  saveTaskState,
  setProjectLifecycle,
  type TaskStateConfig,
  type TaskTree,
} from "./app-task-store.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";
import {
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  recordAppTaskTrigger,
} from "./app-task-reconciler.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function resource(id: string, phase: AppTaskResource["status"]["phase"] = "pending"): AppTaskResource {
  return {
    metadata: { id, generation: 1, resourceVersion: 1 },
    spec: {
      outcome: `finish ${id}`,
      acceptance: ["done"],
      parentId: "project",
      mode: "achieve",
      priority: "P2",
    },
    status: {
      observedGeneration: 0,
      phase,
      lane: id === "human" ? "human" : "normal",
      updatedAt: "2026-08-21T00:00:00.000Z",
    },
  };
}

function fixture(): TaskTree {
  const active = resource("active", "running");
  active.status.currentAttemptId = "attempt-1";
  return {
    version: 1,
    project: "example",
    project_lifecycle: "paused",
    root_task_id: "project",
    groups: { project: { id: "project", parent_id: null, goal: "example" } },
    resources: { human: resource("human"), normal: resource("normal", "waiting"), active },
    attempts: {
      "attempt-1": {
        metadata: { id: "attempt-1", resourceVersion: 1 },
        taskId: "active",
        taskGeneration: 1,
        specHash: "hash",
        owner: "may",
        handler: "owner",
        runtimeId: "old-runtime",
        state: "running",
        reason: "test",
        startedAt: "2026-08-21T00:00:00.000Z",
        lease: {
          id: "lease-1",
          version: 1,
          lastActivityAt: "2026-08-21T00:00:00.000Z",
          expiresAt: "2026-08-21T00:00:01.000Z",
          runtimeId: "old-runtime",
          sessionId: "session-1",
        },
        sessionId: "session-1",
      },
    },
    taskTriggers: {
      human: {
        taskId: "human",
        taskGeneration: 1,
        resourceVersion: 1,
        event: { type: "message.created", eventId: 7 },
        observedAt: "2026-08-21T00:00:00.000Z",
      },
    },
    tasks: {},
  };
}

function open() {
  const root = mkdtempSync(join(tmpdir(), "may-task-resources-"));
  roots.push(root);
  return AppTaskResourceStore.openStandalone(join(root, "host.sqlite"), "example");
}

describe("AppTaskResourceStore", () => {
  it("backfills normalized Condition routes when opening a legacy resource database", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-legacy-"));
    roots.push(root);
    const db = openDatabase(join(root, "host.sqlite"));
    const legacy = resource("legacy");
    legacy.status.conditionIds = ["legacy-condition"];
    db.exec(`
      CREATE TABLE app_tasks (
        app_id TEXT NOT NULL, task_id TEXT NOT NULL,
        generation INTEGER NOT NULL, resource_version INTEGER NOT NULL,
        observed_generation INTEGER NOT NULL, phase TEXT NOT NULL,
        lane TEXT NOT NULL, changed INTEGER NOT NULL, ready INTEGER NOT NULL,
        next_check_at INTEGER, lease_until INTEGER, current_attempt_id TEXT,
        updated_at INTEGER NOT NULL, resource_json TEXT NOT NULL, trigger_json TEXT,
        PRIMARY KEY(app_id, task_id)
      );
      CREATE TABLE app_task_conditions (
        app_id TEXT NOT NULL, condition_id TEXT NOT NULL, state TEXT NOT NULL, condition_json TEXT NOT NULL,
        PRIMARY KEY(app_id, condition_id)
      );
    `);
    db.prepare(
      `INSERT INTO app_tasks(
         app_id, task_id, generation, resource_version, observed_generation, phase, lane,
         changed, ready, updated_at, resource_json
       ) VALUES (?, ?, 1, 1, 0, 'waiting', 'normal', 0, 0, 0, ?)`,
    ).run("example", "legacy", JSON.stringify(legacy));
    db.prepare(
      "INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json) VALUES (?, ?, 'unknown', ?)",
    ).run(
      "example",
      "legacy-condition",
      JSON.stringify({
        metadata: { id: "legacy-condition", generation: 1, resourceVersion: 1 },
        spec: { type: "legacy.completed", subject: "legacy", expected: "done" },
        status: { state: "unknown", observedGeneration: 0, updatedAt: "2026-08-21T00:00:00.000Z" },
      }),
    );

    const store = AppTaskResourceStore.fromDb(db, "example");
    expect(store.readConditionRoutes("legacy.completed")).toEqual([expect.objectContaining({ taskIds: ["legacy"] })]);
    db.close();
  });

  it("imports and shadow-compares a paused App snapshot", () => {
    const store = open();
    const tree = fixture();
    store.importPausedSnapshot(tree, "revision-1", ["human"]);

    expect(store.sourceRevision()).toBe("revision-1");
    expect(store.isActive()).toBeFalse();
    expect(store.readTask("human")).toEqual(tree.resources?.human);
    expect(store.shadowCompare(tree)).toEqual([]);
    expect(store.listRecoveryCandidates().items).toEqual([
      expect.objectContaining({ taskId: "human", lane: "human", ready: true, changed: true }),
      expect.objectContaining({ taskId: "active", lane: "normal", leaseUntil: 1_787_270_401_000 }),
      expect.objectContaining({ taskId: "normal", lane: "normal", ready: false, changed: true }),
    ]);
    store.activate("revision-1");
    expect(store.isActive()).toBeTrue();
    expect(store.readSnapshot().resources).toEqual(tree.resources);
    store.close();
  });

  it("updates one fenced task and exposes due work through the index", () => {
    const store = open();
    const tree = fixture();
    store.importPausedSnapshot(tree, "revision-1");
    const next = structuredClone(tree.resources!.normal!);
    next.metadata.resourceVersion = 2;
    next.status.observedGeneration = 1;
    next.status.updatedAt = "2026-08-21T00:01:00.000Z";

    expect(
      store.replaceTask({
        expectedResourceVersion: 1,
        resource: next,
        ready: false,
        nextCheckAt: 100,
      }),
    ).toBeTrue();
    expect(store.replaceTask({ expectedResourceVersion: 1, resource: next, ready: true })).toBeFalse();
    expect(store.readTask("human")).toEqual(tree.resources?.human);
    expect(store.listRecoveryCandidates(100).items.map((entry) => entry.taskId)).toContain("normal");
    expect(store.nextDueAt()).toBe(100);
    store.close();
  });

  it("pages through every indexed recovery candidate", () => {
    const store = open();
    store.importPausedSnapshot(fixture(), "revision-1", ["human"]);

    const first = store.listRecoveryCandidates(Date.now() + 10_000, 2);
    const second = store.listRecoveryCandidates(Date.now() + 10_000, 2, first.nextCursor ?? undefined);
    expect(first.nextCursor).not.toBeNull();
    expect([...first.items, ...second.items].map((entry) => entry.taskId)).toEqual(["human", "active", "normal"]);
    expect(second.nextCursor).toBeNull();
    store.close();
  });

  it("reads a bounded task context without pulling unrelated App history", () => {
    const store = open();
    const tree = fixture();
    tree.resources!.human!.status.response = "unrelated".repeat(100_000);
    for (let index = 0; index < 40; index += 1) {
      tree.groups![`unrelated-${index}`] = {
        id: `unrelated-${index}`,
        parent_id: null,
        goal: "history".repeat(1_000),
      };
      const attempt = structuredClone(tree.attempts!["attempt-1"]!);
      attempt.metadata.id = `normal-history-${index}`;
      attempt.taskId = "normal";
      attempt.state = "completed";
      attempt.startedAt = new Date(Date.parse("2026-08-20T00:00:00.000Z") + index).toISOString();
      delete attempt.lease;
      delete attempt.sessionId;
      tree.attempts![attempt.metadata.id] = attempt;
    }
    store.importPausedSnapshot(tree, "revision-1");

    const context = store.readTaskContext({ taskIds: ["normal"] });
    expect(Object.keys(context.resources ?? {})).toEqual(["normal"]);
    expect(context.resources?.human).toBeUndefined();
    expect(context.resources?.active).toBeUndefined();
    expect(Object.keys(context.groups ?? {})).toEqual(["project"]);
    expect(Object.keys(context.attempts ?? {})).toHaveLength(16);
    store.close();
  });

  it("indexes a resource-backed Condition checkpoint and wakes it when due", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-due-"));
    roots.push(root);
    const appDir = join(root, "resource-due.app");
    mkdirSync(appDir, { recursive: true });
    const store = AppTaskResourceStore.openStandalone(join(root, "host.sqlite"), "example");
    const tree = fixture();
    delete tree.resources?.active;
    delete tree.attempts?.["attempt-1"];
    delete tree.taskTriggers?.human;
    tree.resources!.human!.status.observedGeneration = 1;
    store.importPausedSnapshot(tree, "revision-1");
    store.activate("revision-1");
    const paths = projectRuntimePaths(appDir, root);
    const config: TaskStateConfig = {
      appDir,
      projectDir: root,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskStateReads(config);
    recordAppTaskTrigger(config, "normal", { type: "example.changed", eventId: 92 });
    const claim = claimObservedAppTask(config, {
      taskId: "normal",
      appOwner: "may",
      handler: "owner",
      isOwnerRunnable: () => true,
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const before = Date.now();
    expect(
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "check again later",
        conditions: [
          {
            id: "example:later",
            type: "example.completed",
            subject: "example:later",
            expected: "done",
            reviewAfterMs: 60_000,
          },
        ],
      }).status,
    ).toBe("applied");
    const dueAt = store.nextDueAt();
    expect(dueAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(dueAt).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(store.readConditionRoutes("example.completed")).toEqual([expect.objectContaining({ taskIds: ["normal"] })]);
    expect(store.readConditionRoutes("unrelated.event")).toEqual([]);

    const queued: string[] = [];
    const scheduler = new AppTaskRecoveryScheduler({
      source: store,
      enqueue: (taskId) => queued.push(taskId),
      now: () => dueAt! + 1,
    });
    expect(scheduler.recover()).toBe(1);
    expect(queued).toEqual(["normal"]);
    scheduler.close();
    store.close();
  });

  it("does not treat an unchanged running attempt as a fresh wake", () => {
    const store = open();
    store.importPausedSnapshot(fixture(), "revision-1");
    const active = store.listRecoveryCandidates(Date.now() + 10_000).items.find((entry) => entry.taskId === "active");
    expect(active).toMatchObject({ ready: false, changed: false });
    store.close();
  });

  it("serializes competing transitions with the task resource fence", () => {
    const store = open();
    const tree = fixture();
    store.importPausedSnapshot(tree, "revision-1");
    const first = structuredClone(tree.resources!.normal!);
    first.metadata.resourceVersion = 2;
    first.status.summary = "first";
    const second = structuredClone(tree.resources!.normal!);
    second.metadata.resourceVersion = 2;
    second.status.summary = "second";

    expect(
      store.commit({
        fences: [{ taskId: "normal", generation: 1, resourceVersion: 1, currentAttemptId: null }],
        tasks: [{ resource: first, ready: false }],
      }),
    ).toBeTrue();
    expect(
      store.commit({
        fences: [{ taskId: "normal", generation: 1, resourceVersion: 1, currentAttemptId: null }],
        tasks: [{ resource: second, ready: false }],
      }),
    ).toBeFalse();
    expect(store.readTask("normal")?.status.summary).toBe("first");
    store.close();
  });

  it("persists an exact configured mutation without recreating whole-App JSON", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-config-"));
    roots.push(root);
    const appDir = join(root, "resource-test.app");
    mkdirSync(appDir, { recursive: true });
    const store = AppTaskResourceStore.openStandalone(join(root, "host.sqlite"), "example");
    store.importPausedSnapshot(fixture(), "revision-1");
    store.activate("revision-1");
    const paths = projectRuntimePaths(appDir, root);
    const config: TaskStateConfig = {
      appDir,
      projectDir: root,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "test",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskStateReads(config);
    const tree = readTaskState(config);
    const next = tree.resources!.normal!;
    next.metadata.resourceVersion += 1;
    next.status.summary = "resource local";

    saveTaskState(config, tree, {
      resourceMutation: {
        fences: [{ taskId: "normal", resourceVersion: 1 }],
        tasks: [{ resource: next, ready: false }],
      },
    });

    expect(store.readTask("normal")?.status.summary).toBe("resource local");
    expect(existsSync(paths.taskStatePath)).toBeFalse();
    expect(
      readRuntimeTaskView({ executionPaths: { appDir, projectDir: root }, taskStateConfig: config }, "normal"),
    ).toMatchObject({ id: "normal", summary: "resource local" });
    expect(
      listRuntimeTaskViews(
        { executionPaths: { appDir, projectDir: root }, taskStateConfig: config },
        { limit: 2 },
      ).items.map((item) => item.id),
    ).toEqual(["active", "human"]);
    setProjectLifecycle(config, "paused", "resource lifecycle test");
    expect(store.projectLifecycle()).toBe("paused");
    expect(existsSync(paths.taskStatePath)).toBeFalse();
    store.close();
  });

  it("records and claims one resource-backed task without whole-App persistence", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-claim-"));
    roots.push(root);
    const appDir = join(root, "resource-claim.app");
    mkdirSync(appDir, { recursive: true });
    const store = AppTaskResourceStore.openStandalone(join(root, "host.sqlite"), "example");
    const tree = fixture();
    delete tree.resources?.active;
    delete tree.attempts?.["attempt-1"];
    store.importPausedSnapshot(tree, "revision-1");
    store.activate("revision-1");
    const paths = projectRuntimePaths(appDir, root);
    const config: TaskStateConfig = {
      appDir,
      projectDir: root,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskStateReads(config);

    expect(recordAppTaskTrigger(config, "normal", { type: "example.changed", eventId: 91 })).toEqual({
      kind: "recorded",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "normal",
      appOwner: "may",
      handler: "owner",
      isOwnerRunnable: () => true,
    });

    expect(claim.kind).toBe("claimed");
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(store.readTask("normal")?.status.currentAttemptId).toBe(claim.attemptId);
    expect(store.readAttempt(claim.attemptId)?.state).toBe("running");
    expect(store.readTrigger("normal")).toBeNull();
    expect(completeAppTask(config, claim, { summary: "resource task complete", evidence: ["test"] }).status).toBe(
      "applied",
    );
    expect(store.readTask("normal")).toBeNull();
    expect(store.readAttempt(claim.attemptId)?.state).toBe("completed");
    expect(store.readSnapshot().receipts?.normal?.summary).toBe("resource task complete");
    expect(
      observeAppTaskIntent(config, {
        appOwner: "may",
        admissionKey: "new-task-admission",
        intent: {
          id: "new-task",
          parentId: "project",
          outcome: "handle new task",
          acceptance: ["done"],
          mode: "achieve",
        },
      }),
    ).toMatchObject({ kind: "observed", taskId: "new-task", generation: 1 });
    expect(store.readTask("new-task")?.spec.outcome).toBe("handle new task");
    expect(store.readSnapshot().appTaskAdmissions?.["new-task-admission"]?.taskId).toBe("new-task");
    expect(existsSync(paths.taskStatePath)).toBeFalse();
    store.close();
  });

  it("retires a durable dependency wait and atomically indexes its completion wake", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-dependency-"));
    roots.push(root);
    const appDir = join(root, "resource-dependency.app");
    mkdirSync(appDir, { recursive: true });
    const store = AppTaskResourceStore.openStandalone(join(root, "host.sqlite"), "example");
    const tree = fixture();
    const dependency = resource("dependency");
    const dependent = resource("dependent");
    dependent.spec.dependsOn = [dependency.metadata.id];
    tree.resources = { dependency, dependent };
    tree.attempts = {};
    tree.taskTriggers = {};
    store.importPausedSnapshot(tree, "revision-1");
    store.activate("revision-1");
    const paths = projectRuntimePaths(appDir, root);
    const config: TaskStateConfig = {
      appDir,
      projectDir: root,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskStateReads(config);

    expect(
      claimObservedAppTask(config, {
        taskId: dependent.metadata.id,
        appOwner: "may",
        handler: "owner",
        isOwnerRunnable: () => true,
      }),
    ).toMatchObject({
      kind: "waiting",
      dependencyIds: [dependency.metadata.id],
    });
    expect(store.listRecoveryCandidates().items.map((entry) => entry.taskId)).not.toContain(dependent.metadata.id);

    const claim = claimObservedAppTask(config, {
      taskId: dependency.metadata.id,
      appOwner: "may",
      handler: "owner",
      isOwnerRunnable: () => true,
    });
    expect(claim.kind).toBe("claimed");
    if (claim.kind !== "claimed") throw new Error("expected dependency claim");
    expect(completeAppTask(config, claim, { summary: "dependency complete", evidence: ["test"] })).toMatchObject({
      status: "applied",
      dependentTaskIds: [dependent.metadata.id],
    });
    expect(store.listRecoveryCandidates().items).toContainEqual(
      expect.objectContaining({ taskId: dependent.metadata.id, ready: true }),
    );
    store.close();
  });

  it("refuses to import a live mutable authority", () => {
    const store = open();
    const tree = fixture();
    tree.project_lifecycle = "active";
    expect(() => store.importPausedSnapshot(tree, "revision-1")).toThrow("project_lifecycle=paused");
    store.close();
  });
});
