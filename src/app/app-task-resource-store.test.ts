import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../lib/db.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { trackAppTaskConditionEventForTasks } from "./app-task-condition-tracker.js";
import { listRuntimeTaskViews, readRuntimeTaskView } from "./core/reads/app-read.js";
import type { AppTaskAttempt, AppTaskResource } from "./app-task-state.js";
import {
  cacheTaskSnapshots,
  readTaskSnapshot,
  commitTaskMutation,
  ResourceTaskMutationStaleError,
  type AppTaskContext,
  type TaskTree,
} from "./app-task-store.js";
import {
  claimObservedAppTask,
  cancelAppTask,
  appTaskContext,
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
    groups: { project: { id: "project", parent_id: null } },
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
      db
        .prepare(
          `SELECT source_task_id, relation_kind, target_task_id
         FROM app_task_relations WHERE app_id = 'example'`,
        )
        .all(),
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
    store.bootstrapSnapshot(tree, "revision-1");

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

  it("bounds direct children for read-only context without loading dependents", () => {
    const store = open();
    const tree = fixture();
    tree.resources = { normal: tree.resources!.normal! };
    tree.attempts = {};
    tree.taskTriggers = {};
    for (let index = 0; index < 20; index += 1) {
      const suffix = String(index).padStart(2, "0");
      const child = resource(`child-${suffix}`);
      child.spec.parentId = "normal";
      tree.resources[child.metadata.id] = child;
      const dependent = resource(`dependent-${suffix}`);
      dependent.spec.dependsOn = ["normal"];
      tree.resources[dependent.metadata.id] = dependent;
    }
    store.bootstrapSnapshot(tree, "revision-1");

    const context = store.readTaskContext({ taskIds: ["normal"] }, { includeHistory: false, childLimit: 2 });

    expect(Object.keys(context.resources ?? {}).sort()).toEqual(["child-00", "child-01", "normal"]);
    expect(Object.keys(context.attempts ?? {})).toEqual([]);
    store.close();
  });

  it("keeps cancelled children out of the live context limit and reads their terminal evidence separately", () => {
    const store = open();
    try {
      const tree = fixture();
      tree.resources = { normal: tree.resources!.normal! };
      tree.attempts = {};
      tree.taskTriggers = {};
      for (let index = 0; index < 20; index += 1) {
        const child = resource(`child-${String(index).padStart(2, "0")}`);
        child.spec.parentId = "normal";
        tree.resources[child.metadata.id] = child;
      }
      store.bootstrapSnapshot(tree, "revision-1");
      const config = appTaskContext({
        appDir: roots.at(-1)!,
        agent: "owner",
        maxConcurrent: 1,
        resourceStore: store,
      });
      for (let index = 0; index < 18; index += 1) {
        const child = store.readTask(`child-${String(index).padStart(2, "0")}`)!;
        cancelAppTask(config, {
          appId: "example",
          taskId: child.metadata.id,
          expectedGeneration: child.metadata.generation,
          expectedResourceVersion: child.metadata.resourceVersion,
          reason: "Optional work no longer needed",
        });
      }

      const bounded = store.readTaskContext({ taskIds: ["normal"] }, { includeHistory: false, childLimit: 2 });
      expect(Object.keys(bounded.resources ?? {}).sort()).toEqual(["child-18", "child-19", "normal"]);
      const terminal = store.readCancelledChildren("normal", 2);
      expect(terminal).toHaveLength(2);
      expect(terminal.every((child) => child.summary.includes("Cancelled by human"))).toBe(true);
      expect(store.readCancelledChildren("unrelated", 2)).toEqual([]);
      const full = store.readTaskContext({ taskIds: ["normal"] });
      expect(Object.keys(full.cancellations ?? {})).toHaveLength(18);
      expect(full.cancellations).toEqual(store.readSnapshot().cancellations);
      expect(full.receipts).toEqual({});
    } finally {
      store.close();
    }
  });

  it("can read one exact Task without loading its children or attempt history", () => {
    const store = open();
    const tree = fixture();
    tree.resources = { normal: tree.resources!.normal! };
    tree.attempts = {};
    tree.taskTriggers = {};
    for (let index = 0; index < 20; index += 1) {
      const child = resource(`child-${index}`);
      child.spec.parentId = "normal";
      tree.resources[child.metadata.id] = child;
    }
    store.bootstrapSnapshot(tree, "revision-1");

    const context = store.readTaskContext({ taskIds: ["normal"] }, { includeHistory: false, childLimit: 0 });

    expect(Object.keys(context.resources ?? {})).toEqual(["normal"]);
    expect(Object.keys(context.attempts ?? {})).toEqual([]);
    store.close();
  });

  it("prunes a detached Condition only after its final Task reference is gone", () => {
    const store = open();
    const tree = fixture();
    const shared = resource("shared", "waiting");
    tree.resources!.normal!.status.conditionIds = ["shared-condition"];
    shared.status.conditionIds = ["shared-condition"];
    tree.resources!.shared = shared;
    tree.conditions = {
      "shared-condition": {
        metadata: { id: "shared-condition", generation: 1, resourceVersion: 1 },
        spec: { type: "review.completed", subject: "shared", expected: "done" },
        status: {
          observedGeneration: 0,
          state: "unknown",
          createdAt: "2026-08-21T00:00:00.000Z",
          observedAt: "2026-08-21T00:00:00.000Z",
        },
      },
    };
    store.bootstrapSnapshot(tree, "revision-1");

    for (const taskId of ["normal", "shared"]) {
      const current = store.readTask(taskId)!;
      const next = structuredClone(current);
      next.metadata.resourceVersion += 1;
      next.status.conditionIds = [];
      expect(
        store.commit({
          fences: [{ taskId, resourceVersion: current.metadata.resourceVersion }],
          tasks: [{ resource: next, ready: false }],
          pruneConditionIds: ["shared-condition"],
        }),
      ).toBeTrue();
      expect(store.readSnapshot().conditions?.["shared-condition"] !== undefined).toBe(taskId === "normal");
    }
    store.close();
  });

  it("bootstraps a normalized resource snapshot", () => {
    const store = open();
    const tree = fixture() as TaskTree & { satisfied_dependency_ids?: string[] };
    const legacyGroup = tree.groups!.project as TaskTree["groups"][string] & {
      children?: string[];
      goal?: string;
      state?: string;
    };
    legacyGroup.children = ["human", "normal", "active"];
    legacyGroup.goal = "legacy group task";
    legacyGroup.state = "backlog";
    tree.satisfied_dependency_ids = ["legacy-derived-copy"];
    store.bootstrapSnapshot(tree, "revision-1", ["human"]);

    expect(store.sourceRevision()).toBe("revision-1");
    expect(store.isActive()).toBeTrue();
    expect(store.readTask("human")).toEqual(tree.resources?.human);
    expect(store.listRecoveryCandidates().items).toEqual([
      expect.objectContaining({ taskId: "human", lane: "human", ready: true, changed: true }),
      expect.objectContaining({ taskId: "active", lane: "normal", leaseUntil: 1_787_270_401_000 }),
      expect.objectContaining({ taskId: "normal", lane: "normal", ready: false, changed: true }),
    ]);
    expect(store.isActive()).toBeTrue();
    const snapshot = store.readSnapshot();
    expect(snapshot.resources).toEqual(tree.resources);
    expect(snapshot.groups?.project).not.toHaveProperty("state");
    expect(snapshot.groups?.project).not.toHaveProperty("children");
    expect(snapshot.groups?.project).not.toHaveProperty("goal");
    expect(snapshot).not.toHaveProperty("satisfied_dependency_ids");
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

  it("projects loaded App concurrency without changing it when the value is unchanged", () => {
    const root = mkdtempSync(join(tmpdir(), "app-task-config-"));
    roots.push(root);
    const store = AppTaskResourceStore.openStandalone(join(root, "tasks.sqlite"), "example");
    store.bootstrapSnapshot({ project: "example", resources: {} }, "seed:empty");

    const before = store.revision();
    store.setConfiguredMaxConcurrent(4);
    expect(store.configuredMaxConcurrent()).toBe(4);
    expect(store.revision()).toBe(before + 1);

    store.setConfiguredMaxConcurrent(4);
    expect(store.revision()).toBe(before + 1);
    expect(() => store.setConfiguredMaxConcurrent(0)).toThrow("positive safe integer");
    store.close();
  });

  it("does not overwrite existing resource authority during bootstrap", () => {
    const store = open();
    const tree = fixture();
    store.bootstrapSnapshot(tree, "initial-revision");
    const seed = fixture();
    seed.project_lifecycle = "active";

    expect(() => store.bootstrapSnapshot(seed, "seed:revision-1")).toThrow("existing resources authority");
    expect(store.sourceRevision()).toBe("initial-revision");
    expect(store.isActive()).toBeTrue();
    store.close();
  });

  it("updates one fenced task and exposes due work through the index", () => {
    const store = open();
    const tree = fixture();
    store.bootstrapSnapshot(tree, "revision-1");
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

  it("updates the private recovery index without invalidating the canonical snapshot", () => {
    const store = open();
    store.bootstrapSnapshot(fixture(), "revision-1");
    const revision = store.revision();

    expect(store.setRecoveryState("normal", { ready: true, changed: false, nextCheckAt: null })).toBeTrue();

    expect(store.revision()).toBe(revision);
    expect(store.listRecoveryCandidates().items).toContainEqual(
      expect.objectContaining({ taskId: "normal", ready: true, changed: false }),
    );
    expect(store.setRecoveryState("normal", { ready: true, changed: false, nextCheckAt: null })).toBeFalse();
    store.close();
  });

  it("pages through every indexed recovery candidate", () => {
    const store = open();
    store.bootstrapSnapshot(fixture(), "revision-1", ["human"]);

    const first = store.listRecoveryCandidates(Date.now() + 10_000, 2);
    const second = store.listRecoveryCandidates(Date.now() + 10_000, 2, first.nextCursor ?? undefined);
    expect(first.nextCursor).not.toBeNull();
    expect([...first.items, ...second.items].map((entry) => entry.taskId)).toEqual(["human", "active", "normal"]);
    expect(second.nextCursor).toBeNull();
    store.close();
  });

  it("shares bounded handler-recovery pages without changing canonical Task state", () => {
    const root = mkdtempSync(join(tmpdir(), "may-handler-recovery-cursor-"));
    roots.push(root);
    const path = join(root, "host.sqlite");
    const first = AppTaskResourceStore.openStandalone(path, "example");
    const second = AppTaskResourceStore.openStandalone(path, "example");
    try {
      const tree = fixture();
      tree.resources = Object.fromEntries(["one", "two", "three"].map((id) => [id, resource(id, "attention")]));
      tree.attempts = {};
      tree.taskTriggers = {};
      first.bootstrapSnapshot(tree, "fixture");
      const revision = first.revision();
      const before = first.readTaskContext({ taskIds: ["one", "two", "three"] });
      expect(first.takeHandlerRecoveryTaskIds(2)).toEqual(["one", "three"]);
      expect(second.takeHandlerRecoveryTaskIds(2)).toEqual(["two"]);
      expect(first.takeHandlerRecoveryTaskIds(2)).toEqual(["one", "three"]);
      expect(first.revision()).toBe(revision);
      expect(first.readTaskContext({ taskIds: ["one", "two", "three"] })).toEqual(before);
    } finally {
      first.close();
      second.close();
    }
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
    store.bootstrapSnapshot(tree, "revision-1");

    const context = store.readTaskContext({ taskIds: ["normal"] });
    expect(Object.keys(context.resources ?? {})).toEqual(["normal"]);
    expect(context.resources?.human).toBeUndefined();
    expect(context.resources?.active).toBeUndefined();
    expect(Object.keys(context.groups ?? {})).toEqual(["project"]);
    expect(Object.keys(context.attempts ?? {})).toHaveLength(16);
    const currentOnly = store.readTaskContext({ taskIds: ["active"] }, { includeHistory: false });
    expect(Object.keys(currentOnly.attempts ?? {})).toEqual([]);
    expect(currentOnly.resources?.active?.status.currentAttemptId).toBe("attempt-1");
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
    store.bootstrapSnapshot(tree, "revision-1");

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
    const config: AppTaskContext = {
      appDir,
      projectDir: configRoot,
      agent: "test",
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
    store.bootstrapSnapshot(tree, "revision-1");

    const context = store.readTaskContext({ taskIds: ["first-request", "project"] });

    expect(context.groups).toEqual({
      project: { id: "project", parent_id: null },
    });
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
    store.bootstrapSnapshot(tree, "revision-1");
    const config: AppTaskContext = {
      appDir,
      projectDir: root,
      agent: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskSnapshots(config);
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
            owner: "app:example-observer",
            reviewAfterMs: 60_000,
          },
        ],
      }).status,
    ).toBe("applied");
    const dueAt = store.nextDueAt();
    expect(dueAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(dueAt).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(store.readConditionRoutes("example.completed")).toEqual([expect.objectContaining({ taskIds: ["normal"] })]);
    expect(store.readConditionRoutesForAllApps("example.completed")).toEqual([
      expect.objectContaining({ appId: "example", taskIds: ["normal"] }),
    ]);
    expect(store.readConditionRoutesForAllApps("example.completed", ["example:later"])).toEqual([
      expect.objectContaining({ appId: "example", taskIds: ["normal"] }),
    ]);
    expect(store.readConditionRoutesForAllApps("example.completed", ["example:other"])).toEqual([]);
    expect(store.readTaskConditions("normal")).toEqual([
      expect.objectContaining({
        metadata: expect.objectContaining({ id: "example:later" }),
        spec: expect.objectContaining({ type: "example.completed", expected: "done" }),
      }),
    ]);
    expect(readRuntimeTaskView({ taskStateConfig: config }, "normal")).toMatchObject({
      id: "normal",
      conditions: [expect.objectContaining({ id: "example:later", type: "example.completed", expected: "done" })],
    });
    expect(listRuntimeTaskViews({ taskStateConfig: config }, { status: ["waiting"] }).items[0]).not.toHaveProperty(
      "conditions",
    );
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
    store.bootstrapSnapshot(tree, "revision-1");

    expect(store.readConditionRoutes("pipeline-run.state")).toEqual([]);
    store.close();
  });

  it("does not treat an unchanged running attempt as a fresh wake", () => {
    const store = open();
    store.bootstrapSnapshot(fixture(), "revision-1");
    const active = store.listRecoveryCandidates(Date.now() + 10_000).items.find((entry) => entry.taskId === "active");
    expect(active).toMatchObject({ ready: false, changed: false });
    store.close();
  });

  it("fences competing connections and retains the accepted transition after reopening", () => {
    const store = open();
    const databasePath = join(roots.at(-1)!, "host.sqlite");
    const tree = fixture();
    store.bootstrapSnapshot(tree, "revision-1");
    const first = structuredClone(tree.resources!.normal!);
    first.metadata.resourceVersion = 2;
    first.status.summary = "first";
    const second = structuredClone(tree.resources!.normal!);
    second.metadata.resourceVersion = 2;
    second.status.summary = "second";

    const peer = AppTaskResourceStore.openStandalone(databasePath, "example");
    try {
      expect(
        store.commit({
          fences: [{ taskId: "normal", generation: 1, resourceVersion: 1, currentAttemptId: null }],
          tasks: [{ resource: first, ready: false }],
        }),
      ).toBeTrue();
      expect(
        peer.commit({
          fences: [{ taskId: "normal", generation: 1, resourceVersion: 1, currentAttemptId: null }],
          tasks: [{ resource: second, ready: false }],
        }),
      ).toBeFalse();
      expect(peer.readTask("normal")).toEqual(first);
    } finally {
      peer.close();
      store.close();
    }

    // Reopen only after both connections close; no surviving connection can
    // supply the accepted state or its stale-write fence.
    const reopened = AppTaskResourceStore.openStandalone(databasePath, "example");
    try {
      expect(reopened.readTask("normal")).toEqual(first);
      expect(
        reopened.commit({
          fences: [{ taskId: "normal", generation: 1, resourceVersion: 1, currentAttemptId: null }],
          tasks: [{ resource: second, ready: false }],
        }),
      ).toBeFalse();
    } finally {
      reopened.close();
    }
  });

  it("rejects a stale transition at commit without replacing the accepted snapshot", () => {
    const store = open();
    store.bootstrapSnapshot(fixture(), "revision-1");
    const config: AppTaskContext = {
      appDir: roots.at(-1)!,
      projectDir: roots.at(-1)!,
      agent: "test",
      maxConcurrent: 2,
      resourceStore: store,
    };
    try {
      cacheTaskSnapshots(config);
      const accepted = readTaskSnapshot(config);
      const stale = structuredClone(accepted);
      for (const [tree, summary] of [
        [accepted, "accepted"],
        [stale, "stale"],
      ] as const) {
        const resource = tree.resources!.normal!;
        resource.metadata.resourceVersion += 1;
        resource.status.summary = summary;
      }
      const commit = (tree: TaskTree) =>
        commitTaskMutation(config, tree, {
          resourceMutation: {
            fences: [{ taskId: "normal", generation: 1, resourceVersion: 1, currentAttemptId: null }],
            tasks: [{ resource: tree.resources!.normal!, ready: false }],
          },
        });
      commit(accepted);
      expect(() => commit(stale)).toThrow(ResourceTaskMutationStaleError);
      expect(store.readTask("normal")?.status.summary).toBe("accepted");
      expect(readTaskSnapshot(config).resources!.normal!.status.summary).toBe("accepted");
    } finally {
      store.close();
    }
  });

  it("persists an exact configured mutation without recreating whole-App JSON", () => {
    const root = mkdtempSync(join(tmpdir(), "may-task-resource-config-"));
    roots.push(root);
    const appDir = join(root, "resource-test.app");
    mkdirSync(appDir, { recursive: true });
    const store = AppTaskResourceStore.openStandalone(join(root, "host.sqlite"), "example");
    store.bootstrapSnapshot(fixture(), "revision-1");
    const config: AppTaskContext = {
      appDir,
      projectDir: root,
      agent: "test",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskSnapshots(config);
    const tree = readTaskSnapshot(config);
    const next = tree.resources!.normal!;
    next.metadata.resourceVersion += 1;
    next.status.summary = "resource local";

    commitTaskMutation(config, tree, {
      resourceMutation: {
        fences: [{ taskId: "normal", resourceVersion: 1 }],
        tasks: [{ resource: next, ready: false }],
      },
    });

    expect(store.readTask("normal")?.status.summary).toBe("resource local");
    expect(existsSync(join(appDir, ".state", "tasks", "state.json"))).toBeFalse();
    expect(readRuntimeTaskView({ taskStateConfig: config }, "normal")).toMatchObject({
      id: "normal",
      summary: "resource local",
    });
    expect(listRuntimeTaskViews({ taskStateConfig: config }, { limit: 2 }).items.map((item) => item.id)).toEqual([
      "active",
      "human",
    ]);
    store.setProjectLifecycle("paused");
    expect(store.projectLifecycle()).toBe("paused");
    expect(existsSync(join(appDir, ".state", "tasks", "state.json"))).toBeFalse();
    store.close();
  });

  it.each(["trigger", "condition"])("fences a stale Task write after a newer %s wake", (ingress) => {
    const store = open();
    store.bootstrapSnapshot(fixture(), "revision-1");
    const config: AppTaskContext = {
      appDir: "/fixture/example.app",
      projectDir: "/fixture",
      agent: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    const claim = claimObservedAppTask(config, { taskId: "normal", appAgent: "may", handler: "agent" });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "Wait for review",
      evidence: [],
      conditions: [
        {
          id: "review",
          type: "review.completed",
          subject: "task:review",
          expected: "done",
          owner: "human",
          reviewAfterMs: 60_000,
        },
      ],
    });
    const stale = store.readTask("normal")!;
    const event = { type: "review.completed", taskId: "review", state: "done", overrideWait: true };
    if (ingress === "trigger") recordAppTaskTrigger(config, "normal", event);
    else trackAppTaskConditionEventForTasks(config, event, ["normal"]);
    try {
      expect(store.readTrigger("normal")).not.toBeNull();
      expect(
        store.replaceTask({ expectedResourceVersion: stale.metadata.resourceVersion, resource: stale, ready: false }),
      ).toBeFalse();
      expect(store.readTrigger("normal")).not.toBeNull();
    } finally {
      store.close();
    }
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
    store.bootstrapSnapshot(tree, "revision-1");
    const config: AppTaskContext = {
      appDir,
      projectDir: root,
      agent: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskSnapshots(config);

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
    expect(existsSync(join(appDir, ".state", "tasks", "state.json"))).toBeFalse();
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
    store.bootstrapSnapshot(tree, "revision-1");
    const config: AppTaskContext = {
      appDir,
      projectDir: root,
      agent: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskSnapshots(config);

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
    store.bootstrapSnapshot(tree, "revision-1");
    const config: AppTaskContext = {
      appDir,
      projectDir: root,
      agent: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskSnapshots(config);

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
});
