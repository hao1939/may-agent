import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { taskForGymInput } from "../../../gym.app/app.ts";
import { canonicalGymTestContext } from "../../../gym.app/agents/gym/workflows/lib/test-context.ts";
import { regressionEmissionLocalKey, runRegression } from "../../../gym.app/agents/gym/workflows/regression-run.ts";
import { closeDb, getDb } from "../lib/requests.js";
import { DbWriter } from "../lib/db-writer.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { createAppTaskEmitter, createAppTaskEvents } from "./app-task-emitter.js";
import { renewAppTaskAttemptLease, type AppTaskClaim } from "./app-task-reconciler.js";
import { EventBus } from "./event-bus.js";
import type { AppTaskAttempt, AppTaskResource } from "./app-task-state.js";
import { cacheTaskStateReads, readTaskState, type ResourceTaskStateConfig, type TaskTree } from "./app-task-store.js";
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

function supportedGymAdmissionHarness() {
  const root = mkdtempSync(join(tmpdir(), "may-gym-admission-emitter-"));
  roots.push(root);
  const requestId = "app_scope_binding_golden_1";
  const admittedInput = {
    id: requestId,
    source: { kind: "system" as const, id: "golden-test" },
    input: {
      kind: "run-regression",
      data: {
        benchmark: "may-alignment",
        agent: "may",
        scenario: "may-align-proof-before-adopt",
        trials: 1,
      },
    },
  };
  const attachment = taskForGymInput(admittedInput);
  if (attachment.kind !== "desired") throw new Error("expected desired Gym task attachment");
  const intent = attachment.intent;
  const attemptId = "attempt-gym-scope-golden-1";
  const now = new Date().toISOString();
  const tree: TaskTree = {
    project: "gym",
    project_lifecycle: "paused",
    root_task_id: "gym-system",
    groups: {
      "gym-system": { id: "gym-system", parent_id: null },
      "regression-assurance": {
        id: "regression-assurance",
        parent_id: "gym-system",
      },
    },
    resources: {
      [intent.id]: {
        metadata: { id: intent.id, generation: 1, resourceVersion: 8 },
        spec: {
          outcome: intent.outcome,
          acceptance: intent.acceptance,
          parentId: intent.parentId,
          mode: intent.mode,
          workflow: intent.workflow,
          input: intent.input,
        },
        status: {
          observedGeneration: 0,
          phase: "running",
          currentAttemptId: attemptId,
          updatedAt: now,
        },
      },
    },
    attempts: {
      [attemptId]: {
        metadata: { id: attemptId, resourceVersion: 1 },
        taskId: intent.id,
        taskGeneration: 1,
        specHash: "gym-scope-golden-spec",
        owner: "gym",
        handler: "workflow:regression-run",
        runtimeId: "runtime-gym-scope-golden",
        state: "running",
        reason: "golden supported admission",
        startedAt: now,
        lease: {
          id: "lease-gym-scope-golden",
          version: 1,
          lastActivityAt: now,
          expiresAt: new Date(Date.now() - 1).toISOString(),
          runtimeId: "runtime-gym-scope-golden",
        },
      },
    },
    tasks: {},
  };
  const db = getDb(root);
  const store = AppTaskResourceStore.fromDb(db, "gym");
  store.importPausedSnapshot(tree, "gym-scope-golden-revision", [intent.id]);
  store.activate("gym-scope-golden-revision");
  const bus = new EventBus();
  const writer = new DbWriter(root);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const claim: AppTaskClaim = {
    kind: "claimed",
    taskId: intent.id,
    generation: 1,
    resourceVersion: 8,
    specHash: "gym-scope-golden-spec",
    attemptId,
    owner: "gym",
    handler: "workflow:regression-run",
    mode: "achieve",
    intent,
    events: [],
    eventsTruncated: false,
    declaredOutputPaths: [],
  };
  return { root, requestId, admittedInput, intent, attemptId, db, store, bus, claim };
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
    const config: ResourceTaskStateConfig = {
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
    const config: ResourceTaskStateConfig = {
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

  it("carries one supported Gym admission through exact scope and a renewed terminal emission fence", async () => {
    const { root, requestId, admittedInput, intent, attemptId, db, store, bus, claim } = supportedGymAdmissionHarness();
    expect(admittedInput).toMatchObject({
      id: requestId,
      input: {
        kind: "run-regression",
        data: {
          benchmark: "may-alignment",
          agent: "may",
          scenario: "may-align-proof-before-adopt",
          trials: 1,
        },
      },
    });
    expect(intent).toMatchObject({
      id: "runtime/regression-run/app_scope_binding_golden_1-5ff43f0edf5508f9",
      workflow: "regression-run",
      input: {
        requestId,
        benchmark: "may-alignment",
        agent: "may",
        scenario: "may-align-proof-before-adopt",
        trials: 1,
      },
    });

    const appDir = join(root, "projects", "gym-scope-fence-test.app");
    const projectDir = join(root, "projects", "gym");
    mkdirSync(appDir, { recursive: true });
    const paths = projectRuntimePaths(appDir, join(root, "projects"));
    const config: ResourceTaskStateConfig = {
      appDir,
      stateAppDir: paths.stateAppDir,
      projectDir,
      statePath: paths.taskStatePath,
      journalPath: paths.journalPath,
      worker: "gym",
      maxConcurrent: 2,
      resourceStore: store,
    };
    expect(renewAppTaskAttemptLease(config, claim)).toBe(true);

    const emitter = createAppTaskEmitter({ bus, appId: "gym", claim });
    const runDir = join(projectDir, ".state", "benchmarks", "scope_golden");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(
      join(runDir, "manifest.json"),
      JSON.stringify({
        run_id: "scope_golden",
        benchmark: "may-alignment",
        agent: "may",
        scenarios: ["may-align-proof-before-adopt"],
        trials_per_scenario: 1,
        completed_at: "2026-08-25T00:00:00.000Z",
        trials: [
          {
            scenario: "may-align-proof-before-adopt",
            machine_verdict: "pass",
            label_status: "approved",
          },
        ],
      }),
    );
    const reconciliationTask = {
      appId: "gym",
      taskId: intent.id,
      generation: 1,
      resourceVersion: 8,
      owner: "gym",
      agent: "gym",
      mode: "achieve",
      outcome: intent.outcome,
      acceptance: intent.acceptance,
      input: intent.input,
      children: { live: [], completed: [] },
    };
    const ctx = canonicalGymTestContext({
      task: `## Reconciliation Task\n\n\`\`\`json\n${JSON.stringify(reconciliationTask, null, 2)}\n\`\`\``,
      projectsRoot: join(root, "projects"),
      emit: (event) => emitter.emit(String(event.localKey), event),
    });
    let observedCommand: string[] = [];
    const result = await runRegression(ctx, async (command) => {
      observedCommand = command;
      return { exitCode: 0, stdout: `${runDir}\n`, stderr: "" };
    });

    expect(result).toMatchObject({ status: "done" });
    expect(observedCommand).toEqual([
      "bun",
      "run",
      "loop",
      "--",
      "test",
      "--benchmark",
      "may-alignment",
      "--agent",
      "may",
      "--trials",
      "1",
      "--scenario",
      "may-align-proof-before-adopt",
    ]);
    const terminalKey = regressionEmissionLocalKey(ctx, "completed");
    expect(
      db
        .prepare(
          "SELECT event_type, task_id, attempt_id, data FROM events WHERE event_type = 'gym.regression.completed'",
        )
        .all()
        .map((row: any) => ({ ...row, data: JSON.parse(row.data) })),
    ).toEqual([
      expect.objectContaining({
        event_type: "gym.regression.completed",
        task_id: intent.id,
        attempt_id: attemptId,
        data: expect.objectContaining({
          run_id: "scope_golden",
          emission: {
            appId: "gym",
            taskId: intent.id,
            generation: 1,
            localKey: terminalKey,
          },
        }),
      }),
    ]);
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
