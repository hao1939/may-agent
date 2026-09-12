import { afterEach, expect, test, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appTaskTestContext } from "../tasks/app-task-test-support.js";
import {
  appTaskContext,
  observeAppTaskIntent,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  failAppTaskAttempt,
  cancelAppTask,
  readAppTaskAdmissionOutcome,
  stopAppTaskAttempt,
  stopAppTask,
  recordAppTaskTrigger,
} from "../tasks/app-task-reconciler.js";
import { readAppTaskReconciliationEvents } from "../tasks/app-task-context.js";
import { trackAppTaskConditionEventForTasks } from "../tasks/app-task-condition-tracker.js";
import type { TaskTree } from "../tasks/app-task-store.js";
import type { AppTaskCancellation } from "../tasks/app-task-state.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { admitTaskRequest } from "./inbox.js";
import { createAppInboxItem, getAppInboxItem } from "./app-inbox-store.js";
import { migrateOpenTaskState } from "./task-state-cutover.js";

const roots: string[] = [];
const stores = new Set<AppTaskResourceStore>();
afterEach(() => {
  setSystemTime();
  for (const store of stores) store.close();
  stores.clear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "may-task-state-cutover-"));
  roots.push(root);
  const databasePath = join(root, "state.sqlite");
  let config = appTaskTestContext({
    appDir: root,
    databasePath,
    agent: "worker",
    maxConcurrent: 2,
    tree: { root_task_id: "root", groups: { root: { id: "root", parent_id: null, owner: "worker" } } },
  });
  stores.add(config.resourceStore);
  const request = (id: string) => ({
    id,
    appId: "sample",
    source: { kind: "app" as const, id: "caller" },
    input: { kind: "measure", data: { id } },
  });
  return {
    get config() {
      return config;
    },
    get store() {
      return config.resourceStore;
    },
    request,
    ask(id: string, taskId = "work") {
      return admitTaskRequest(config, {
        appId: "sample",
        idempotencyKey: `task:${id}`,
        request: request(id),
        attachment: {
          kind: "intent",
          intent: {
            id: taskId,
            parentId: "root",
            mode: "maintain",
            outcome: "Measure samples and explain results",
            acceptance: ["Retain measured evidence"],
          },
        },
      });
    },
    claim(taskId = "work", handler = "agent") {
      const claim = claimObservedAppTask(config, { taskId, appAgent: "worker", handler });
      if (claim.kind !== "claimed") throw new Error(`Expected claim, got ${JSON.stringify(claim)}`);
      return claim;
    },
    // Old Host retained these rows without per-attempt results or input links.
    // The separate old-source trial checks the shape against a real old writer.
    legacy(change?: (tree: TaskTree) => void) {
      const tree = config.resourceStore.readSnapshot();
      for (const attempt of Object.values(tree.attempts ?? {})) delete attempt.acceptedResult;
      for (const admission of Object.values(tree.appTaskAdmissions ?? {})) {
        delete admission.inputEvent;
        delete admission.resultAttemptId;
      }
      for (const resource of Object.values(tree.resources ?? {})) delete resource.status.inputWaits;
      change?.(tree);
      for (const closure of Object.values(tree.cancellations ?? {}))
        config.resourceStore.db.run(
          "UPDATE app_task_cancellations SET cancellation_json = ? WHERE app_id = ? AND task_id = ?",
          [JSON.stringify(closure), closure.appId, closure.taskId],
        );
      config.resourceStore.commit({
        fences: Object.values(tree.resources ?? {}).map((resource) => ({
          taskId: resource.metadata.id,
          resourceVersion: resource.metadata.resourceVersion,
        })),
        tasks: Object.values(tree.resources ?? {}).map((resource) => ({
          resource,
          trigger: tree.taskTriggers?.[resource.metadata.id],
          ready: resource.status.phase === "pending",
        })),
        attempts: Object.values(tree.attempts ?? {}),
        admissions: Object.entries(tree.appTaskAdmissions ?? {}).map(([taskId, value]) => ({ taskId, value })),
      });
    },
    migrate: () => migrateOpenTaskState(config, { oldRuntimeStopped: true }),
    reopen() {
      config.resourceStore.close();
      stores.delete(config.resourceStore);
      const store = AppTaskResourceStore.openStandalone(databasePath, "sample");
      stores.add(store);
      config = appTaskContext({
        appDir: root,
        projectDir: root,
        agent: "worker",
        maxConcurrent: 2,
        resourceStore: store,
      });
    },
    advance() {
      const due = config.resourceStore.readTask("work")!.status.executionRetryAt!;
      expect(due).toBeGreaterThan(Date.now());
      setSystemTime(new Date(due));
    },
  };
}

test("quiet maintained outcomes keep their exact attempt, rest across reopen and accept later input", () => {
  const f = fixture();
  f.ask("first");
  const claim = f.claim();
  completeAppTask(f.config, claim, {
    summary: "Measured first sample",
    result: { value: 17 },
    evidence: ["instrument:17"],
  });
  f.legacy();
  expect(f.migrate()).toMatchObject({ tasks: 1, outcomes: 1, continued: 0, inputs: 1 });
  const first = readAppTaskAdmissionOutcome(f.config, "work", "task:first");
  expect(first).toMatchObject({ attemptId: claim.attemptId, result: { value: 17 }, evidence: ["instrument:17"] });
  expect(first?.acceptanceBasis).toBeUndefined();
  expect(f.store.isCancelled("work")).toBe(false);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
  expect(f.store.nextDueAt()).toBeNull();
  const version = f.store.revision();
  expect(f.migrate()).toEqual({ tasks: 0, outcomes: 0, continued: 0, workerStops: 0, inputs: 0 });
  expect(f.store.revision()).toBe(version);
  f.reopen();
  f.ask("second");
  completeAppTask(f.config, f.claim(), { summary: "Measured second sample", result: { value: 23 } });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:first")).toEqual(first);
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:second")?.result).toEqual({ value: 23 });
});

test("an old child wait carries its original input through unrelated input and another restart", () => {
  const f = fixture();
  f.ask("measurement");
  observeAppTaskIntent(f.config, {
    appAgent: "worker",
    intent: {
      id: "sampler",
      parentId: "work",
      mode: "achieve",
      outcome: "Measure the sample",
      acceptance: ["Read instrument"],
      outputs: [],
    },
  });
  deferAppTask(f.config, f.claim(), {
    disposition: "waiting",
    summary: "Await the instrument",
    evidence: ["instrument:requested"],
  });
  f.legacy();
  expect(f.migrate().outcomes).toBe(1);
  expect(f.store.readTask("work")?.status.inputWaits?.["task:measurement"]?.children).toEqual([
    { id: "sampler", generation: 1 },
  ]);
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:measurement")).toBeNull();
  f.reopen();
  f.ask("explanation");
  completeAppTask(f.config, f.claim(), {
    summary: "Explained the method",
    result: { explanation: "Read the instrument once" },
  });
  f.reopen();
  completeAppTask(f.config, f.claim("sampler"), { summary: "Measured", result: { value: 17 } });
  const returning = f.claim();
  expect(readAppTaskReconciliationEvents(f.store, returning).continuedInputs?.[0]?.event.data.request).toEqual(
    f.request("measurement"),
  );
  completeAppTask(f.config, returning, { summary: "Here is the measurement", result: { value: 17 } });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:measurement")?.result).toEqual({ value: 17 });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:explanation")?.result).toEqual({
    explanation: "Read the instrument once",
  });
});

test("old Condition waits retain their evidence and review deadline, then continue the matching input", () => {
  const f = fixture();
  f.ask("measurement");
  deferAppTask(f.config, f.claim(), {
    disposition: "waiting",
    summary: "Await a measurement",
    evidence: [],
    conditions: [
      {
        id: "measurement",
        type: "project.task.reconciled",
        subject: "task:measurement",
        expected: "done",
        owner: "app:sampler",
        reviewAfterMs: 60_000,
      },
    ],
  });
  f.legacy();
  const due = Date.now() + 60_000;
  f.store.setRecoveryState("work", { ready: false, changed: false, nextCheckAt: due });
  const conditions = f.store.readSnapshot().conditions;
  f.migrate();
  expect(f.store.readSnapshot().conditions).toEqual(conditions);
  expect(f.store.nextDueAt()).toBe(due);
  f.reopen();
  expect(
    trackAppTaskConditionEventForTasks(
      f.config,
      { type: "project.task.reconciled", taskId: "measurement", state: "converged", eventId: 90 },
      ["work"],
    ),
  ).toHaveLength(1);
  const claim = f.claim();
  expect(readAppTaskReconciliationEvents(f.store, claim).continuedInputs?.[0]?.event.data.request).toEqual(
    f.request("measurement"),
  );
  completeAppTask(f.config, claim, { summary: "Observed the sample", result: { value: 17 } });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:measurement")?.result).toEqual({ value: 17 });
});

test("old exhausted work keeps its input and failure count, respects pause, then retries without owner intervention", () => {
  const f = fixture();
  f.ask("measurement");
  failAppTaskAttempt(f.config, f.claim(), "Provider unavailable");
  f.legacy((tree) => {
    tree.resources!.work!.status.phase = "attention";
    tree.resources!.work!.status.executionFailures = 6;
    delete tree.resources!.work!.status.executionRetryAt;
    delete tree.taskTriggers!.work;
  });
  f.store.setProjectLifecycle("paused");
  expect(f.migrate().continued).toBe(1);
  const retry = f.store.readTask("work")!.status.executionRetryAt;
  expect(retry).toBeGreaterThan(Date.now());
  expect(f.store.readTask("work")?.status.executionFailures).toBe(6);
  expect(f.migrate().tasks).toBe(0);
  expect(f.store.readTask("work")!.status.executionRetryAt).toBe(retry);
  f.reopen();
  f.advance();
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "worker", handler: "agent" }).kind).toBe("waiting");
  f.store.setProjectLifecycle("active");
  const claim = f.claim();
  expect(claim.previousAttempt?.summary).toBe("Provider unavailable");
  expect(claim.events[0]?.event.data).toMatchObject({ request: f.request("measurement") });
  completeAppTask(f.config, claim, { summary: "Provider restored; measured", result: { value: 17 } });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:measurement")?.result).toEqual({ value: 17 });
});

test("offline interruption fences the old attempt and retains the original ask for redo", () => {
  const f = fixture();
  f.ask("measurement");
  recordAppTaskTrigger(f.config, "work", { type: "sample.before", eventId: 20, data: { measured: 17 } });
  const obsolete = f.claim();
  recordAppTaskTrigger(f.config, "work", { type: "sample.after", eventId: 21, data: { corrected: 23 } });
  f.legacy();
  expect(f.migrate().continued).toBe(1);
  expect(completeAppTask(f.config, obsolete, { summary: "Late result" }).status).toBe("stale");
  expect(f.store.readAttempt(obsolete.attemptId)).toMatchObject({
    state: "interrupted",
    failureReason: "offline-task-cutover",
  });
  expect(f.store.readAttempt(obsolete.attemptId)?.lease).toBeUndefined();
  f.reopen();
  f.advance();
  const claim = f.claim();
  expect(claim.previousAttempt?.attemptId).toBe(obsolete.attemptId);
  expect(claim.events[0]?.event.data).toMatchObject({ request: f.request("measurement") });
  expect(claim.events.map(({ event }) => event.type)).toEqual(["app.task.requested", "sample.before", "sample.after"]);
});

function stoppedFixture() {
  const f = fixture();
  f.ask("measurement");
  const old = f.claim();
  const current = f.store.readTask("work")!;
  const cancelled = cancelAppTask(f.config, {
    appId: "sample",
    taskId: "work",
    expectedGeneration: 1,
    expectedResourceVersion: current.metadata.resourceVersion,
    reason: "Instrument unavailable",
  }).cancellation;
  const selfStop: AppTaskCancellation = {
    ...cancelled,
    kind: undefined,
    decidedBy: { kind: "app", agent: old.agent, attemptId: old.attemptId },
  };
  f.legacy((tree) => {
    tree.cancellations!.work = selfStop;
  });
  return { f, old, selfStop };
}

test("an old worker self-stop becomes retained failure evidence and paced continuation on the same Task", () => {
  const { f, old, selfStop } = stoppedFixture();
  expect(f.migrate()).toMatchObject({ continued: 1, workerStops: 1 });
  expect(f.store.readCancellation("work")).toBeNull();
  expect(f.store.readAttempt(old.attemptId)?.retiredCancellation).toEqual(selfStop);
  expect(f.store.readAttempt(old.attemptId)?.acceptedResult).toMatchObject({
    state: "stopped",
    summary: "Instrument unavailable",
  });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:measurement")).toBeNull();
  expect(f.migrate().tasks).toBe(0);
  f.reopen();
  f.advance();
  const claim = f.claim();
  expect(claim.previousAttempt?.acceptedResult?.state).toBe("stopped");
  completeAppTask(f.config, claim, { summary: "Instrument is now available", result: { value: 17 } });
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:measurement")?.result).toEqual({ value: 17 });
  expect(f.store.isCancelled("work")).toBe(false);
});

test("human cancellation and a human-stopped Turn remain quiet during migration", () => {
  const f = fixture();
  f.ask("cancel", "cancelled");
  const current = f.store.readTask("cancelled")!;
  cancelAppTask(f.config, {
    appId: "sample",
    taskId: "cancelled",
    expectedGeneration: 1,
    expectedResourceVersion: current.metadata.resourceVersion,
    reason: "No longer needed",
  });
  f.ask("stop");
  const claim = f.claim();
  stopAppTaskAttempt(f.config, {
    taskId: "work",
    attemptId: claim.attemptId,
    expectedGeneration: 1,
    reason: "Human stopped this turn",
  });
  f.legacy();
  const before = f.store.readSnapshot();
  expect(f.migrate().tasks).toBe(0);
  expect(f.store.readSnapshot()).toEqual(before);
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
});

test("failed import restores a worker's original stop and leaves all state unchanged", () => {
  const { f } = stoppedFixture();
  const before = f.store.readSnapshot();
  const version = f.store.revision();
  f.store.db.exec(
    "CREATE TRIGGER reject_import BEFORE UPDATE ON app_task_attempts BEGIN SELECT RAISE(ABORT, 'evidence unavailable'); END",
  );
  expect(() => f.migrate()).toThrow("evidence unavailable");
  expect(f.store.readSnapshot()).toEqual(before);
  expect(f.store.revision()).toBe(version);
});

test("workflow-to-agent handoff retains its original input without turning into another workflow retry", () => {
  const f = fixture();
  f.ask("measurement");
  failAppTaskAttempt(f.config, f.claim("work", "workflow:measure"), "Needs judgment");
  f.legacy((tree) => {
    tree.resources!.work!.status.phase = "attention";
    delete tree.resources!.work!.status.executionRetryAt;
    Object.values(tree.attempts!)[0]!.failureReason = "needs-agent";
  });
  f.migrate();
  const version = f.store.revision();
  expect(f.migrate().tasks).toBe(0);
  expect(f.store.revision()).toBe(version);
  const claim = f.claim("work", "auto");
  expect(claim.handler).toBe("agent:worker");
  expect(claim.handoff?.reason).toBe("needs-agent");
  expect(claim.events[0]?.event.data).toMatchObject({ request: f.request("measurement") });
});

test("a recorded older caller answer remains intact and is never linked to a newer unrelated outcome", () => {
  const f = fixture();
  createAppInboxItem(f.store.db, { ...f.request("first"), idempotencyKey: "first" });
  f.ask("first");
  completeAppTask(f.config, f.claim(), { summary: "Measured", result: { value: 17 } });
  f.store.db.run("UPDATE app_inbox_items SET status = 'done', result = ? WHERE id = 'first'", [
    JSON.stringify({ summary: "Measured", result: { value: 17 } }),
  ]);
  const answered = getAppInboxItem(f.store.db, "first");
  f.ask("explanation");
  completeAppTask(f.config, f.claim(), { summary: "Explained", result: { explanation: "Read the instrument" } });
  f.legacy();
  f.migrate();
  expect(getAppInboxItem(f.store.db, "first")).toEqual(answered);
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:first")).toBeNull();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:explanation")?.result).toEqual({
    explanation: "Read the instrument",
  });
  expect(f.store.listRecoveryCandidates().items).toEqual([]);
});

test("missing original input or conflicting acceptance aborts rather than assigning another answer", () => {
  const f = fixture();
  f.ask("measurement");
  completeAppTask(f.config, f.claim(), { summary: "Measured", result: { value: 17 } });
  f.legacy((tree) => {
    Object.values(tree.attempts!)[0]!.events = undefined;
  });
  const before = f.store.readSnapshot();
  expect(() => f.migrate()).toThrow("Original input is missing");
  expect(f.store.readSnapshot()).toEqual(before);
  expect(() => migrateOpenTaskState(f.config, { oldRuntimeStopped: false })).toThrow(
    "old Host and all workers to be stopped",
  );
});

test.each(["missing", "different-spec"])(
  "an accepted cycle with %s attempt evidence is preserved for explicit repair",
  (problem) => {
    const f = fixture();
    f.ask("measurement");
    completeAppTask(f.config, f.claim(), { summary: "Measured", result: { value: 17 } });
    f.legacy((tree) => {
      if (problem === "missing") tree.resources!.work!.status.observedAttemptId = "missing-attempt";
      else Object.values(tree.attempts!)[0]!.specHash = "another-specification";
    });
    const before = f.store.readSnapshot();
    expect(() => f.migrate()).toThrow("Accepted attempt is missing or conflicts");
    expect(f.store.readSnapshot()).toEqual(before);
  },
);

test("a retained parent wait follows its child after migration reopens that child's worker self-stop", () => {
  const f = fixture();
  f.ask("measurement");
  observeAppTaskIntent(f.config, {
    appAgent: "worker",
    intent: {
      id: "sampler",
      parentId: "work",
      mode: "achieve",
      outcome: "Measure",
      acceptance: ["Read instrument"],
      outputs: [],
    },
  });
  deferAppTask(f.config, f.claim(), {
    disposition: "waiting",
    summary: "Await child measurement",
    evidence: ["instrument:requested"],
  });
  const child = f.claim("sampler");
  cancelAppTask(f.config, {
    appId: "sample",
    taskId: "sampler",
    expectedGeneration: 1,
    expectedResourceVersion: f.store.readTask("sampler")!.metadata.resourceVersion,
    reason: "Instrument unavailable",
  });
  f.legacy((tree) => {
    tree.cancellations!.sampler!.kind = undefined;
    tree.cancellations!.sampler!.decidedBy = { kind: "app", agent: child.agent, attemptId: child.attemptId };
    delete tree.taskTriggers!.work; // The old notification was missed before shutdown.
  });
  f.migrate();
  expect(f.store.readTask("work")?.status.inputWaits?.["task:measurement"]?.children).toEqual([
    { id: "sampler", generation: 1 },
  ]);
  f.reopen();
  setSystemTime(new Date(f.store.readTask("sampler")!.status.executionRetryAt!));
  completeAppTask(f.config, f.claim("sampler"), { summary: "Instrument restored", result: { value: 17 } });
  const returned = f.claim();
  expect(readAppTaskReconciliationEvents(f.store, returned).continuedInputs?.[0]?.event.data.request).toEqual(
    f.request("measurement"),
  );
});

test("worker-stop conversion is scoped to its App even when another App has the same Task ID", () => {
  const { f } = stoppedFixture();
  const other = AppTaskResourceStore.fromDb(f.store.db, "other");
  const seed = f.store.readSnapshot();
  seed.project = "other";
  for (const closure of Object.values(seed.cancellations!)) closure.appId = "other";
  other.bootstrapSnapshot(seed, "other-app");
  const before = other.readSnapshot();
  f.migrate();
  expect(other.readSnapshot()).toEqual(before);
  expect(f.store.isCancelled("work")).toBe(false);
  expect(other.isCancelled("work")).toBe(true);
});


test("offline cutover renames caller waits and retains their identity across replay and restart", () => {
  const f = fixture();
  f.ask("assignment", "caller");
  const old = f.claim("caller");
  const id = "app-request:child-input";
  deferAppTask(f.config, old, { disposition: "waiting", summary: "Waiting for child", conditions: [{
    id, type: "app.dependency.completed", subject: "id:child-input",
    expected: { field: "status", equals: "done" }, owner: "app:sample", reviewAfterMs: 300_000,
  }] });
  const before = f.store.readTaskConditions("caller")[0]!;
  f.migrate();
  f.reopen();
  const condition = f.store.readTaskConditions("caller")[0]!;
  expect(condition.spec.type).toBe("app.dependency.updated");
  expect(condition.metadata.generation).toBe(before.metadata.generation);
  expect(f.migrate().tasks).toBe(0);
  expect(trackAppTaskConditionEventForTasks(f.config, {
    type: "app.dependency.updated", source: "app-inbox:sample", data: {
      kind: "app", id: "child-input", status: "blocked", summary: "Source unavailable",
    },
  }, ["caller"])).toHaveLength(1);
  expect(f.store.readTaskConditions("caller")[0]!.status.state).toBe("false");
});

test("offline cutover restores only the first accepted failure for its exact input", () => {
  const f = fixture();
  f.ask("first");
  const first = f.claim();
  stopAppTask(f.config, first, { summary: "Source unavailable", evidence: ["HTTP:503"] });
  f.advance();
  stopAppTask(f.config, f.claim(), { summary: "Source still unavailable", evidence: ["HTTP:503"] });
  const saved = f.store.readTaskContext({ taskIds: [], admissionIds: ["task:first"] }).appTaskAdmissions!["task:first"]!;
  delete saved.reportAttemptId;
  f.store.commit({ fences: [{ taskId: "work", resourceVersion: f.store.readTask("work")!.metadata.resourceVersion }],
    admissions: [{ taskId: "task:first", value: saved }] });
  expect(f.migrate().inputs).toBe(1);
  f.reopen();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:first", "report")?.attemptId).toBe(first.attemptId);
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:unrelated", "report")).toBeNull();
  expect(readAppTaskAdmissionOutcome(f.config, "work", "task:first")).toBeNull();
  expect(f.migrate().tasks).toBe(0);
});
