import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb } from "../../../lib/requests.js";
import { DbWriter } from "../../../lib/db-writer.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { createAppTaskEmitter, createAppTaskEvents } from "./app-task-emitter.js";
import { renewAppTaskAttemptLease } from "./app-task-reconciler.js";
import { EVENT_ROW_ID, EVENT_TASK_EMISSION_FENCE, EventBus } from "../events/bus.js";
import type { AppTaskAttempt, AppTaskResource } from "./app-task-state.js";
import { cacheTaskSnapshots, readTaskSnapshot, type AppTaskContext, type TaskTree } from "./app-task-store.js";

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
    spec: { outcome: "coordinate", acceptance: ["done"], parentId: "project" },
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
    spec: { outcome: "handle child", acceptance: ["done"], parentId: "task-1" },
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

function harness(
  sessionId: string | null = "session-1",
  scopes = [{ taskId: "task-1", generation: 3, attemptId: "attempt-1" }],
) {
  const root = mkdtempSync(join(tmpdir(), "may-task-emitter-"));
  roots.push(root);
  const db = getDb(root);
  const store = AppTaskResourceStore.fromDb(db, "sample");
  const tree = fixture(undefined, sessionId);
  const resource = tree.resources!["task-1"]!;
  const attempt = tree.attempts!["attempt-1"]!;
  delete tree.resources!["task-1"];
  delete tree.attempts!["attempt-1"];
  for (const scope of scopes) {
    tree.resources![scope.taskId] = {
      ...structuredClone(resource),
      metadata: { ...resource.metadata, id: scope.taskId, generation: scope.generation },
      status: { ...resource.status, currentAttemptId: scope.attemptId },
    };
    tree.attempts![scope.attemptId] = {
      ...structuredClone(attempt),
      metadata: { ...attempt.metadata, id: scope.attemptId },
      taskId: scope.taskId,
      taskGeneration: scope.generation,
    };
  }
  store.bootstrapSnapshot(
    tree,
    "revision-1",
    scopes.map((scope) => scope.taskId),
  );
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const emitter = createAppTaskEmitter({
    bus,
    db,
    appId: "sample",
    claim: { ...scopes[0]!, agent: "may" },
  });
  const events = (index = 0) =>
    createAppTaskEvents({ bus, db, persistDir: root, appId: "sample", claim: { ...scopes[index]!, agent: "may" } });
  const legacy = (localKey: string, data: Record<string, unknown>) => {
    const scope = scopes[0]!;
    const event = {
      type: "sample.observed",
      source: "app-task:sample",
      owner: "agent:may",
      data: {
        ...data,
        idempotencyKey: `task:sample:${scope.taskId}:${scope.generation}:emit:${localKey}`,
        emission: { appId: "sample", taskId: scope.taskId, generation: scope.generation, localKey },
      },
    };
    Object.defineProperty(event, EVENT_TASK_EMISSION_FENCE, {
      value: {
        appId: "sample",
        taskId: scope.taskId,
        taskGeneration: scope.generation,
        attemptId: scope.attemptId,
        localKey,
      },
    });
    return Number(bus.emit(event)[EVENT_ROW_ID]);
  };
  return { root, db, bus, emitter, store, events, legacy };
}

describe("AppTaskEmitter", () => {
  it.each([false, true])(
    "keeps delimiter-bearing Task scopes distinct, including legacy publication (%s)",
    (legacy) => {
      const f = harness(null, [
        { taskId: "a", generation: 1, attemptId: "attempt-1" },
        { taskId: "a:1:emit:b", generation: 2, attemptId: "attempt-2" },
      ]);
      const fact = { type: "sample.observed", data: { value: "first" } };
      const first = legacy ? f.legacy("b:2:emit:c", fact.data) : f.events(0).publish("b:2:emit:c", fact);
      expect(f.events(1).read(fact.type, "c")).toBeNull();
      const second = f.events(1).publish("c", { ...fact, data: { value: "second" } });
      expect(second).not.toBe(first);
      expect(f.events(0).read(fact.type, "b:2:emit:c")).toMatchObject({ eventId: first, data: fact.data });
      expect(f.events(1).read(fact.type, "c")).toMatchObject({ eventId: second, data: { value: "second" } });
      expect(f.events(0).publish("b:2:emit:c", fact)).toBe(first);
      expect(() => f.events(0).publish("b:2:emit:c", { ...fact, data: { value: "changed" } })).toThrow(
        "different event input",
      );
    },
  );

  it.each([false, true])("replays the full large fact after reopen, including legacy publication (%s)", (legacy) => {
    const f = harness(null);
    const data = { text: "Original café facts. ".repeat(1000), nested: { verdict: "supported" } };
    const id = legacy ? f.legacy("large", data) : f.events().publish("large", { type: "sample.observed", data });
    expect(f.db.prepare("SELECT body_ref FROM events WHERE id = ?").get(id)?.body_ref).toBeString();
    closeDb(f.root);
    const reopened = createAppTaskEvents({
      bus: new EventBus(),
      db: getDb(f.root),
      persistDir: f.root,
      appId: "sample",
      claim: { taskId: "task-1", generation: 3, attemptId: "replacement", agent: "may" },
    });
    expect(reopened.read("sample.observed", "large")).toMatchObject({ eventId: id, data });
  });

  it.each(["missing", "corrupt", "inline"])(
    "does not treat an unverifiable published fact as absent (%s)",
    (failure) => {
      const f = harness(null);
      const data = { text: failure === "inline" ? "small" : "facts ".repeat(1000) };
      const id = f.events().publish("damaged", { type: "sample.observed", data });
      const row = f.db.prepare("SELECT body_ref FROM events WHERE id = ?").get(id)!;
      if (failure === "missing") rmSync(join(f.root, String(row.body_ref)));
      else if (failure === "corrupt") writeFileSync(join(f.root, String(row.body_ref)), '{"text":"changed"}');
      else f.db.prepare("UPDATE events SET data = ? WHERE id = ?").run("{broken", id);
      expect(() => f.events().read("sample.observed", "damaged")).toThrow("could not be verified");
      expect(f.events().read("sample.observed", "absent")).toBeNull();
    },
  );

  it("reads the original published fact after reopen only within its exact scope", () => {
    const { root, emitter } = harness(null);
    const eventId = emitter.emit("original", { type: "sample.observed", data: { value: 0.92, createdAt: 100 } });
    closeDb(root);
    const db = getDb(root);
    const read = (appId = "sample", taskId = "task-1", generation = 3) =>
      createAppTaskEvents({
        bus: new EventBus(),
        db,
        appId,
        claim: { taskId, generation, attemptId: "replacement-attempt", agent: "may" },
      });
    expect(read().read("sample.observed", "original")).toMatchObject({
      eventId,
      data: { value: 0.92, createdAt: 100 },
    });
    expect(read("other").read("sample.observed", "original")).toBeNull();
    expect(read("sample", "other").read("sample.observed", "original")).toBeNull();
    expect(read("sample", "task-1", 4).read("sample.observed", "original")).toBeNull();
    expect(read().read("sample.other", "original")).toBeNull();
    expect(read().read("sample.observed", "missing")).toBeNull();
  });

  it("exposes one scoped publish and live inbound-event interface", async () => {
    const { bus, db } = harness();
    const events = createAppTaskEvents({
      bus,
      db,
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
      data: { executor: "codex-goal-poc", stage: "intermediate", message: "Inspecting facts" },
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
    const { db, bus, emitter, store } = harness();
    const stale = store.readTask("child-1")!;
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
    expect(
      store.replaceTask({
        expectedResourceVersion: stale.metadata.resourceVersion,
        resource: stale,
        ready: false,
      }),
    ).toBeFalse();
    expect(store.readTrigger("child-1")).not.toBeNull();
  });

  it("invalidates a cached task snapshot after an immediate exact wake", () => {
    const { root, emitter, store } = harness();
    const appDir = join(root, "sample.app");
    mkdirSync(appDir, { recursive: true });
    const config: AppTaskContext = {
      appDir,
      projectDir: root,
      agent: "may",
      maxConcurrent: 2,
      resourceStore: store,
    };
    cacheTaskSnapshots(config);
    expect(readTaskSnapshot(config).taskTriggers?.["child-1"]).toBeUndefined();

    emitter.emit("wake-cached-child", {
      type: "sample.child.requested",
      target: { appId: "sample", taskId: "child-1" },
      data: { child: "one" },
    });

    expect(readTaskSnapshot(config).taskTriggers?.["child-1"]?.event).toMatchObject({
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
    const config: AppTaskContext = {
      appDir,
      projectDir: root,
      agent: "may",
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
      intent: {
        id: "task-1",
        parentId: "project",
        outcome: "coordinate",
        acceptance: ["done"],
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
