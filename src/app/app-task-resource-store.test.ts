import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../lib/db.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { listRuntimeTaskViews, readRuntimeTaskView } from "./app-read.js";
import type { AppTaskAttempt, AppTaskResource } from "./app-task-state.js";
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
  listHandlerExecutionFailedAppTasks,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  releaseHandlerExecutionFailedAppTask,
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
        handler: "agent",
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
  it("backfills normalized Condition and Task relationship routes when opening a legacy resource database", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-legacy-"));
    roots.push(root);
    const db = openDatabase(join(root, "host.sqlite"));
    const legacy = resource("legacy");
    legacy.status.conditionIds = ["legacy-condition"];
    db.exec(`
      CREATE TABLE app_task_store_meta (
        app_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
        PRIMARY KEY(app_id, key)
      );
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
    db.prepare("INSERT INTO app_task_store_meta(app_id, key, value) VALUES (?, 'schema_version', '1')").run("example");
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
    expect(
      db.prepare("SELECT value FROM app_task_store_meta WHERE app_id = ? AND key = 'schema_version'").get("example"),
    ).toEqual({ value: "2" });
    expect(store.readConditionRoutes("legacy.completed")).toEqual([expect.objectContaining({ taskIds: ["legacy"] })]);
    expect(
      db.prepare(
        `SELECT source_task_id, relation_kind, target_task_id
         FROM app_task_relations WHERE app_id = 'example'`,
      ).all(),
    ).toEqual([{ source_task_id: "legacy", relation_kind: "parent", target_task_id: "project" }]);
    db.close();
  });

  it("reads direct children and dependents through exact relationship indexes", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-relations-"));
    roots.push(root);
    const db = openDatabase(join(root, "host.sqlite"));
    const store = AppTaskResourceStore.fromDb(db, "example");
    const tree = fixture();
    const child = resource("child");
    child.spec.parentId = "normal";
    const dependent = resource("dependent");
    dependent.spec.dependsOn = ["normal"];
    const unrelated = resource("unrelated");
    tree.resources = { normal: tree.resources!.normal!, child, dependent, unrelated };
    tree.attempts = {};
    tree.taskTriggers = {};
    store.importPausedSnapshot(tree, "revision-1");

    const context = store.readTaskContext({ taskIds: ["normal"] });
    expect(Object.keys(context.resources ?? {}).sort()).toEqual(["child", "dependent", "normal"]);
    expect(context.resources?.unrelated).toBeUndefined();
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT task.task_id
         FROM app_task_relations relation
         JOIN app_tasks task
           ON task.app_id = relation.app_id AND task.task_id = relation.source_task_id
         WHERE relation.app_id = ? AND relation.target_task_id IN (?)`,
      )
      .all("example", "normal") as Array<{ detail?: string }>;
    expect(plan.some(({ detail }) => detail?.includes("idx_app_task_relations_target"))).toBeTrue();
    expect(plan.some(({ detail }) => detail?.includes("sqlite_autoindex_app_tasks_1"))).toBeTrue();
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

  it("atomically bootstraps a new active resource authority", () => {
    const store = open();
    const tree = fixture();
    tree.project_lifecycle = "active";

    store.bootstrapSnapshot(tree, "seed:revision-1");

    expect(store.isActive()).toBeTrue();
    expect(store.projectLifecycle()).toBe("active");
    expect(store.sourceRevision()).toBe("seed:revision-1");
    expect(store.readTask("human")).toEqual(tree.resources?.human);
    store.close();
  });

  it("does not overwrite an existing shadow authority during bootstrap", () => {
    const store = open();
    const tree = fixture();
    store.importPausedSnapshot(tree, "migration-revision");
    const seed = fixture();
    seed.project_lifecycle = "active";

    expect(() => store.bootstrapSnapshot(seed, "seed:revision-1")).toThrow("existing shadow authority");
    expect(store.sourceRevision()).toBe("migration-revision");
    expect(store.isActive()).toBeFalse();
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

  it("finds only exact agent execution-recovery candidates in a large attention cohort", () => {
    const store = open();
    const tree = fixture();
    tree.resources = {};
    tree.attempts = {};
    tree.taskTriggers = {};
    const attempt = (
      taskId: string,
      attemptId: string,
      startedAt: string,
      options: {
        owner?: string;
        handler?: string;
        failureReason?: string;
        sessionId?: string;
        state?: AppTaskAttempt["state"];
      } = {},
    ): AppTaskAttempt => ({
      metadata: { id: attemptId, resourceVersion: 1 },
      taskId,
      taskGeneration: 1,
      specHash: `hash-${taskId}`,
      owner: options.owner ?? "target-owner",
      handler: options.handler ?? `owner:${options.owner ?? "target-owner"}`,
      runtimeId: "runtime",
      state: options.state ?? "failed",
      reason: "test",
      startedAt,
      ...(options.state === "completed"
        ? { finishedAt: startedAt }
        : {
            finishedAt: startedAt,
            failureReason: options.failureReason ?? "needs-agent",
            ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
          }),
    });
    const add = (taskId: string, candidate: AppTaskAttempt) => {
      tree.resources![taskId] = resource(taskId, "attention");
      tree.attempts![candidate.metadata.id] = candidate;
    };
    for (let index = 0; index < 2_000; index += 1) {
      const id = `unrelated-${index.toString().padStart(4, "0")}`;
      add(
        id,
        attempt(id, `attempt-${id}`, new Date(Date.parse("2026-08-21T00:00:00.000Z") + index).toISOString(), {
          failureReason: "needs-agent",
          sessionId: `session-${id}`,
        }),
      );
    }
    add(
      "execution-failed",
      attempt("execution-failed", "attempt-execution", "2026-08-21T01:00:00.000Z", {
        failureReason: "HandlerExecutionFailed",
        sessionId: "failed-execution-session",
      }),
    );
    add(
      "legacy-failed",
      attempt("legacy-failed", "attempt-legacy", "2026-08-21T01:00:01.000Z", {
        failureReason: "handler-blocked",
        sessionId: "failed-legacy-session",
      }),
    );
    add(
      "other-owner",
      attempt("other-owner", "attempt-other-owner", "2026-08-21T01:00:02.000Z", {
        owner: "other-owner",
        failureReason: "HandlerExecutionFailed",
        sessionId: "failed-other-agent-session",
      }),
    );
    add(
      "legacy-not-direct",
      attempt("legacy-not-direct", "attempt-legacy-not-direct", "2026-08-21T01:00:03.000Z", {
        handler: "workflow:legacy",
        failureReason: "handler-blocked",
        sessionId: "failed-indirect-session",
      }),
    );
    add(
      "failure-without-session",
      attempt("failure-without-session", "attempt-without-session", "2026-08-21T01:00:04.000Z", {
        failureReason: "HandlerExecutionFailed",
      }),
    );
    add(
      "superseded-failure",
      attempt("superseded-failure", "attempt-old-failure", "2026-08-21T01:00:05.000Z", {
        failureReason: "HandlerExecutionFailed",
        sessionId: "old-failed-session",
      }),
    );
    tree.attempts!["attempt-new-success"] = attempt(
      "superseded-failure",
      "attempt-new-success",
      "2026-08-21T01:00:06.000Z",
      { state: "completed" },
    );
    store.importPausedSnapshot(tree, "revision-1");
    store.activate("revision-1");

    const taskIds = store.listHandlerExecutionRecoveryTaskIds("target-owner");
    expect(taskIds).toEqual(["execution-failed", "legacy-failed"]);

    const readScopes: string[][] = [];
    const readTaskContext = store.readTaskContext.bind(store);
    store.readTaskContext = (input) => {
      readScopes.push([...input.taskIds]);
      return readTaskContext(input);
    };
    const configRoot = mkdtempSync(join(tmpdir(), "may-task-recovery-config-"));
    roots.push(configRoot);
    const appDir = join(configRoot, "example.app");
    mkdirSync(appDir, { recursive: true });
    const paths = projectRuntimePaths(appDir, configRoot);
    const config: TaskStateConfig = {
      appDir,
      projectDir: configRoot,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "test",
      maxConcurrent: 2,
      resourceStore: store,
    };
    expect(listHandlerExecutionFailedAppTasks(config, taskIds).map((candidate) => candidate.taskId)).toEqual(taskIds);
    expect(readScopes).toEqual([taskIds]);
    expect(listHandlerExecutionFailedAppTasks(config, [])).toEqual([]);
    expect(readScopes).toEqual([taskIds]);
    expect(
      releaseHandlerExecutionFailedAppTask(config, "execution-failed", {
        agent: "target-owner",
        sessionId: "later-successful-session",
        observedAt: "2099-01-01T00:00:00.000Z",
      }),
    ).toBeTrue();
    expect(store.readTask("execution-failed")?.status.phase).toBe("pending");
    store.close();
  });

  it("loads an explicitly requested root group before the App has any task resources", () => {
    const store = open();
    const tree = fixture();
    tree.resources = {};
    tree.attempts = {};
    tree.taskTriggers = {};
    store.importPausedSnapshot(tree, "revision-1");

    const context = store.readTaskContext({ taskIds: ["first-request", "project"] });

    expect(context.groups).toEqual({
      project: { id: "project", parent_id: null, goal: "example" },
    });
    expect(context.tasks?.project).toMatchObject({ id: "project", parent_id: null });
    expect(context.resources).toEqual({});
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
      appAgent: "may",
      handler: "agent",
      isAgentRunnable: () => true,
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
    expect(store.readTaskConditions("normal")).toEqual([
      expect.objectContaining({
        metadata: expect.objectContaining({ id: "example:later" }),
        spec: expect.objectContaining({ type: "example.completed", expected: "done" }),
      }),
    ]);
    expect(
      readRuntimeTaskView({ executionPaths: { appDir, projectDir: root }, taskStateConfig: config }, "normal"),
    ).toMatchObject({
      id: "normal",
      conditions: [expect.objectContaining({ id: "example:later", type: "example.completed", expected: "done" })],
    });
    expect(
      listRuntimeTaskViews(
        { executionPaths: { appDir, projectDir: root }, taskStateConfig: config },
        { status: ["waiting"] },
      ).items[0],
    ).not.toHaveProperty("conditions");
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

  it("routes only open Conditions owned by live waiting or running tasks", () => {
    const store = open();
    const tree = fixture();
    const completed = resource("completed", "converged");
    completed.status.conditionIds = ["completed-condition"];
    const satisfied = resource("satisfied", "waiting");
    satisfied.status.conditionIds = ["satisfied-condition"];
    tree.resources = { ...tree.resources, completed, satisfied };
    tree.conditions = {
      "completed-condition": {
        metadata: { id: "completed-condition", generation: 1, resourceVersion: 1 },
        spec: { type: "pipeline-run.state", subject: "pipeline-run:1", expected: "completed" },
        status: { observedGeneration: 0, state: "unknown" },
      },
      "satisfied-condition": {
        metadata: { id: "satisfied-condition", generation: 1, resourceVersion: 1 },
        spec: { type: "pipeline-run.state", subject: "pipeline-run:2", expected: "completed" },
        status: { observedGeneration: 1, state: "true" },
      },
    };
    store.importPausedSnapshot(tree, "revision-1");

    expect(store.readConditionRoutes("pipeline-run.state")).toEqual([]);
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
      appAgent: "may",
      handler: "agent",
      isAgentRunnable: () => true,
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
        appAgent: "may",
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

  it("admits the first task into an active resource-backed App", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-first-admission-"));
    roots.push(root);
    const appDir = join(root, "resource-first-admission.app");
    mkdirSync(appDir, { recursive: true });
    const store = AppTaskResourceStore.openStandalone(join(root, "host.sqlite"), "example");
    const tree = fixture();
    tree.resources = {};
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
      observeAppTaskIntent(config, {
        appAgent: "may",
        admissionKey: "first-request-admission",
        intent: {
          id: "first-request",
          parentId: "project",
          outcome: "handle the first request",
          acceptance: ["done"],
          mode: "achieve",
        },
      }),
    ).toMatchObject({ kind: "observed", taskId: "first-request", generation: 1 });
    expect(store.readTask("first-request")?.spec.outcome).toBe("handle the first request");
    expect(store.readSnapshot().appTaskAdmissions?.["first-request-admission"]?.taskId).toBe("first-request");
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
        appAgent: "may",
        handler: "agent",
        isAgentRunnable: () => true,
      }),
    ).toMatchObject({
      kind: "waiting",
      dependencyIds: [dependency.metadata.id],
    });
    expect(store.listRecoveryCandidates().items.map((entry) => entry.taskId)).not.toContain(dependent.metadata.id);

    const claim = claimObservedAppTask(config, {
      taskId: dependency.metadata.id,
      appAgent: "may",
      handler: "agent",
      isAgentRunnable: () => true,
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
