import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../lib/requests.js";
import { DbWriter } from "../lib/db-writer.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { createAppTaskEmitter, createAppTaskEvents } from "./app-task-emitter.js";
import { renewAppTaskAttemptLease } from "./app-task-reconciler.js";
import { EventBus } from "./event-bus.js";
import type { AppTaskAttempt, AppTaskResource } from "./app-task-state.js";
import { cacheTaskStateReads, readTaskState, type TaskStateConfig, type TaskTree } from "./app-task-store.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(
  expiresAt = new Date(Date.now() + 60_000).toISOString(),
  sessionId: string | null = "session-1",
): TaskTree {
  const resource: AppTaskResource = {
    metadata: { id: "task-1", generation: 3, resourceVersion: 8 },
    spec: { outcome: "coordinate", acceptance: ["done"], parentId: "project", mode: "achieve" },
    status: {
      observedGeneration: 2,
      phase: "running",
      currentAttemptId: "attempt-1",
      updatedAt: new Date().toISOString(),
    },
  };
  const attempt: AppTaskAttempt = {
    metadata: { id: "attempt-1", resourceVersion: 1 },
    taskId: "task-1",
    taskGeneration: 3,
    specHash: "hash",
    owner: "may",
    handler: "workflow:test",
    runtimeId: "runtime-1",
    state: "running",
    reason: "test",
    startedAt: new Date().toISOString(),
    ...(sessionId ? { sessionId } : {}),
    lease: {
      id: "lease-1",
      version: 1,
      lastActivityAt: new Date().toISOString(),
      expiresAt,
      runtimeId: "runtime-1",
      ...(sessionId ? { sessionId } : {}),
    },
  };
  const child: AppTaskResource = {
    metadata: { id: "child-1", generation: 1, resourceVersion: 1 },
    spec: { outcome: "handle child", acceptance: ["done"], parentId: "task-1", mode: "achieve" },
    status: { observedGeneration: 1, phase: "waiting", updatedAt: new Date().toISOString() },
  };
  return {
    project: "sample",
    project_lifecycle: "paused",
    root_task_id: "project",
    groups: { project: { id: "project", parent_id: null } },
    resources: { "task-1": resource, "child-1": child },
    attempts: { "attempt-1": attempt },
    tasks: {},
  };
}

function harness(sessionId: string | null = "session-1") {
  const root = mkdtempSync(join(tmpdir(), "may-task-emitter-"));
  roots.push(root);
  const db = getDb(root);
  const store = AppTaskResourceStore.fromDb(db, "sample");
  store.importPausedSnapshot(fixture(undefined, sessionId), "revision-1", ["task-1"]);
  store.activate("revision-1");
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const emitter = createAppTaskEmitter({
    bus,
    appId: "sample",
    claim: { taskId: "task-1", generation: 3, attemptId: "attempt-1", owner: "may" },
  });
  return { root, db, bus, emitter, store };
}

describe("AppTaskEmitter", () => {
  it("exposes one scoped publish and live inbound-event interface", async () => {
    const { bus } = harness();
    const events = createAppTaskEvents({
      bus,
      appId: "sample",
      claim: { taskId: "task-1", generation: 3, attemptId: "attempt-1", owner: "may" },
    });
    const observed: string[] = [];
    let resolveObserved!: () => void;
    const received = new Promise<void>((resolve) => {
      resolveObserved = resolve;
    });
    const unsubscribe = events.onEvent((event) => {
      observed.push(event.type);
      resolveObserved();
    });

    const published = events.publish("finding", { type: "sample.finding", data: { result: "useful" } });
    bus.emit({
      type: "sample.feedback",
      source: "human",
      owner: "app:sample",
      target: { appId: "sample", taskId: "child-1" },
      data: { message: "not for this task" },
    } as any);
    bus.emit({
      type: "sample.feedback",
      source: "human",
      owner: "app:sample",
      target: { appId: "sample", taskId: "task-1" },
      data: { message: "continue with the finding" },
    } as any);

    await received;
    expect(published).toBeGreaterThan(0);
    expect(observed).toEqual(["sample.feedback"]);
    unsubscribe();
  });

  it("persists before immediate visibility and deduplicates a stable local key", () => {
    const { db, bus, emitter } = harness();
    const visible: number[] = [];
    bus.subscribe((event) => {
      if (event.type !== "sample.child.requested") return;
      visible.push(
        Number((db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = ?").get(event.type) as any).count),
      );
    });

    const first = emitter.emit("child-one", { type: "sample.child.requested", data: { child: "one" } });
    const retry = emitter.emit("child-one", { type: "sample.child.requested", data: { child: "one" } });

    expect(first).toBeGreaterThan(0);
    expect(retry).toBe(first);
    expect(visible).toEqual([1]);
  });

  it("persists a task-owned workflow's first fenced event before any child Agent session", () => {
    const { db, emitter } = harness(null);

    const eventId = emitter.emit("pre-session", {
      type: "sample.workflow.started",
      data: { stage: "before-first-agent" },
    });

    expect(eventId).toBeGreaterThan(0);
    expect(db.prepare("SELECT event_type, task_id, attempt_id FROM events WHERE id = ?").get(eventId)).toMatchObject({
      event_type: "sample.workflow.started",
      task_id: "task-1",
      attempt_id: "attempt-1",
    });
    expect(
      db
        .prepare("SELECT attempt_json FROM app_task_attempts WHERE app_id = ? AND attempt_id = ?")
        .get("sample", "attempt-1"),
    ).toMatchObject({
      attempt_json: expect.not.stringContaining("sessionId"),
    });
  });

  it("correlates a passive progress event without waking its own Task", () => {
    const { db, emitter } = harness();
    const before = db
      .prepare("SELECT changed, ready, trigger_json FROM app_tasks WHERE app_id = ? AND task_id = ?")
      .get("sample", "task-1");

    const eventId = emitter.emit("executor-progress", {
      type: "project.task.executor.progress",
      data: { executor: "codex-goal-poc", stage: "intermediate", message: "Inspecting evidence" },
    });

    expect(db.prepare("SELECT task_id, attempt_id FROM events WHERE id = ?").get(eventId)).toEqual({
      task_id: "task-1",
      attempt_id: "attempt-1",
    });
    expect(
      db
        .prepare("SELECT changed, ready, trigger_json FROM app_tasks WHERE app_id = ? AND task_id = ?")
        .get("sample", "task-1"),
    ).toEqual(before);
    expect(
      db
        .prepare("SELECT COUNT(*) AS count FROM app_task_events WHERE app_id = ? AND task_id = ?")
        .get("sample", "task-1"),
    ).toEqual({ count: 0 });
  });

  it("records an exact target wake in the event transaction before subscribers run", () => {
    const { db, bus, emitter } = harness();
    const observed: Array<{ changed: number; linked: number }> = [];
    bus.subscribe((event) => {
      if (event.type !== "sample.child.requested") return;
      const task = db
        .prepare("SELECT changed FROM app_tasks WHERE app_id = ? AND task_id = ?")
        .get("sample", "child-1") as { changed: number };
      const link = db
        .prepare("SELECT COUNT(*) AS count FROM app_task_events WHERE app_id = ? AND task_id = ?")
        .get("sample", "child-1") as { count: number };
      observed.push({ changed: task.changed, linked: link.count });
    });

    emitter.emit("wake-child", {
      type: "sample.child.requested",
      target: { appId: "sample", taskId: "child-1" },
      data: { child: "one" },
    });

    expect(observed).toEqual([{ changed: 1, linked: 1 }]);
  });

  it("invalidates a cached task snapshot after an immediate exact wake", () => {
    const { root, emitter, store } = harness();
    const appDir = join(root, "sample.app");
    mkdirSync(appDir, { recursive: true });
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
    expect(readTaskState(config).taskTriggers?.["child-1"]).toBeUndefined();

    emitter.emit("wake-cached-child", {
      type: "sample.child.requested",
      target: { appId: "sample", taskId: "child-1" },
      data: { child: "one" },
    });

    expect(readTaskState(config).taskTriggers?.["child-1"]?.event).toMatchObject({
      type: "sample.child.requested",
    });
  });

  it("returns an accepted retry after completion but rejects a new stale emission", () => {
    const { db, emitter } = harness();
    const first = emitter.emit("child-one", { type: "sample.child.requested", data: { child: "one" } });
    db.prepare("UPDATE app_task_attempts SET state = 'completed' WHERE app_id = ? AND attempt_id = ?").run(
      "sample",
      "attempt-1",
    );
    db.prepare("UPDATE app_tasks SET current_attempt_id = NULL WHERE app_id = ? AND task_id = ?").run(
      "sample",
      "task-1",
    );

    expect(emitter.emit("child-one", { type: "sample.child.requested", data: { child: "one" } })).toBe(first);
    expect(() => emitter.emit("child-two", { type: "sample.child.requested", data: { child: "two" } })).toThrow(
      "rejected stale attempt",
    );
  });

  it("rejects an expired attempt before publishing", () => {
    const { db, emitter } = harness();
    db.prepare("UPDATE app_task_attempts SET lease_until = ? WHERE app_id = ? AND attempt_id = ?").run(
      Date.now() - 1,
      "sample",
      "attempt-1",
    );
    expect(() => emitter.emit("late", { type: "sample.fact", data: {} })).toThrow("rejected stale attempt");
    expect(db.prepare("SELECT COUNT(*) AS count FROM events WHERE event_type = 'sample.fact'").get()).toMatchObject({
      count: 0,
    });
  });

  it("accepts a terminal task-owned emission after the current workflow renews its lease", () => {
    const { root, db, emitter, store } = harness();
    const appDir = join(root, "sample.app");
    mkdirSync(appDir, { recursive: true });
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
    const claim: AppTaskClaim = {
      kind: "claimed",
      taskId: "task-1",
      generation: 3,
      resourceVersion: 8,
      specHash: "hash",
      attemptId: "attempt-1",
      owner: "may",
      handler: "workflow:test",
      mode: "achieve",
      intent: {
        id: "task-1",
        parentId: "project",
        outcome: "coordinate",
        acceptance: ["done"],
        mode: "achieve",
      },
      events: [],
      eventsTruncated: false,
      declaredOutputPaths: [],
    };

    db.prepare("UPDATE app_task_attempts SET lease_until = ? WHERE app_id = ? AND attempt_id = ?").run(
      Date.now() - 1,
      "sample",
      "attempt-1",
    );
    expect(renewAppTaskAttemptLease(config, claim)).toBe(true);

    const eventId = emitter.emit("terminal-after-renewal", {
      type: "sample.workflow.completed",
      data: { status: "done" },
    });
    expect(eventId).toBeGreaterThan(0);
    expect(db.prepare("SELECT event_type, attempt_id FROM events WHERE id = ?").get(eventId)).toMatchObject({
      event_type: "sample.workflow.completed",
      attempt_id: "attempt-1",
    });
  });

  it("keeps cross-App result correlation on the typed dependency contract", () => {
    const { emitter } = harness();
    expect(() =>
      emitter.emit("foreign-result", {
        type: "app.input.requested",
        data: { appId: "foreign", input: { kind: "review", data: {} } },
      }),
    ).toThrow("must use a typed Task dependency");
  });
});
