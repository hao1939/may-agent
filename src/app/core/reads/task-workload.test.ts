import { afterEach, expect, setSystemTime, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { appTaskTestContext } from "../tasks/app-task-test-support.js";
import { claimObservedAppTask, closeAppTask, completeAppTask, deferAppTask, failAppTaskAttempt, observeAppTaskIntent, recordAppTaskTrigger } from "../tasks/app-task-reconciler.js";
import { createRuntimeAppRead, createRuntimeTaskRead } from "./app-read.js";
import { readTaskWorkload, runtimeWorkloadSource } from "./task-workload.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import type { AppTaskRuntimeOptions } from "../tasks/runtime-options.js";
import { createAppTaskReadTool } from "../../app-task-read-tool.js";
import { EventBus } from "../events/bus.js";
import { runTaskExecutorAttempt } from "../tasks/attempt-execution.js";
import { taskExecutionContext } from "../../adapters/executors/task-context.js";
import { defineApp, Type } from "@may-agent/sdk";
import type { TaskAgentInput } from "../tasks/execution.js";
import { admitTaskInput } from "../state/inbox.js";
import { readAppContract } from "./app-contract.js";
import type { TaskTree } from "../tasks/app-task-store.js";
import { createAppInboxItem } from "../state/app-inbox-store.js";

const databases: SqliteDb[] = [];
afterEach(() => { setSystemTime(); databases.splice(0).forEach(db => db.close()); });

test("the installed contract advertises workload only for Apps with a Task runtime", () => {
  const plain = defineApp({ id: "sample", version: 1, agent: "worker", inputSchema: Type.Object({}) });
  expect(readAppContract(plain).taskReads).toBeUndefined();
  expect(readAppContract({ ...plain, tasks: {} }).taskReads).toEqual({ workload: 1 });
  expect(readAppContract({ ...plain, conversation: { mode: "task" } }).taskReads).toEqual({ workload: 1 });
});

function fixture(appId = "sample", lifecycle: "active" | "paused" = "active", tree?: TaskTree) {
  const db = openDatabase(":memory:"); databases.push(db); applyDbSchema(db);
  const config = appTaskTestContext({ appDir: `/tmp/workload-fixture/${appId}.app`, appId,
    agent: "worker", maxConcurrent: 3, lifecycle,
    tree: tree ?? { groups: { root: { id: "root", owner: "worker" } } },
    resourceStore: AppTaskResourceStore.fromDb(db, appId) });
  const add = (id: string, extra = {}) => observeAppTaskIntent(config, { appAgent: "worker",
    intent: { id, parentId: "root", outcome: "One scoped obligation", acceptance: ["Evidence retained"], ...extra } });
  const claim = (taskId: string) => {
    const result = claimObservedAppTask(config, { taskId, appAgent: "worker", handler: "fixture" });
    if (result.kind !== "claimed") throw new Error(`Not claimed: ${taskId}: ${result.kind}`);
    return result;
  };
  return { db, config, add, claim, read: () => readTaskWorkload({ taskStateConfig: config }) };
}

test("unadmitted input discovery has its own App-scoped continuation and excludes attached or ended input", () => {
  const f = fixture();
  for (let index = 0; index < 7; index++)
    createAppInboxItem(f.db, {
      id: `input-${index}`,
      appId: "sample",
      source: { kind: "system", id: "fixture" },
      input: { kind: "work", data: { privatePayload: "not a workload preview" } },
    });
  createAppInboxItem(f.db, {
    id: "other-app",
    appId: "other",
    source: { kind: "system", id: "fixture" },
    input: { kind: "work", data: {} },
  });
  f.db.prepare("UPDATE app_inbox_items SET status = 'done' WHERE id = 'input-5'").run();
  f.db.prepare("UPDATE app_inbox_items SET execution_task_id = 'attached' WHERE id = 'input-6'").run();
  f.db.prepare("UPDATE app_inbox_items SET status = 'handling', waiting_on_kind = 'analysis' WHERE id = 'input-2'").run();
  const reader = createRuntimeTaskRead({ taskStateConfig: f.config });
  const first = reader.workload({ agent: "other-agent", limit: 1 });
  expect(first.unadmittedInputs).toMatchObject({
    scope: { appId: "sample" },
    coverage: { limit: 5, scanned: 5, truncated: false },
    items: Array.from({ length: 5 }, (_, i) => ({ id: `input-${i}` })),
  });
  createAppInboxItem(f.db, {
    id: "tail",
    appId: "sample",
    source: { kind: "system", id: "fixture" },
    input: { kind: "work", data: {} },
  });
  const page = reader.workload().unadmittedInputs!;
  expect(page.coverage.truncated).toBe(true);
  expect(
    reader.workload({ inputCursor: page.coverage.nextCursor }).unadmittedInputs?.items.map((item) => item.id),
  ).toEqual(["tail"]);
  expect(JSON.stringify(page)).not.toContain("privatePayload");
  expect(() => reader.workload({ inputCursor: "!bad" })).toThrow("input cursor");
});

test.each([
  { status: "pending", waiting: null, leaseUntil: null, attached: null, visible: true },
  { status: "handling", waiting: null, leaseUntil: 1, attached: null, visible: true },
  { status: "handling", waiting: "app", leaseUntil: null, attached: null, visible: true },
  { status: "handling", waiting: "session", leaseUntil: null, attached: null, visible: true },
  { status: "handling", waiting: "analysis", leaseUntil: Number.MAX_SAFE_INTEGER, attached: null, visible: true },
  { status: "handling", waiting: "task", leaseUntil: null, attached: null, visible: false },
  { status: "handling", waiting: "task", leaseUntil: 1, attached: null, visible: false },
  { status: "handling", waiting: "task", leaseUntil: Number.MAX_SAFE_INTEGER, attached: null, visible: false },
  { status: "handling", waiting: null, leaseUntil: null, attached: "existing-task", visible: false },
  { status: "done", waiting: null, leaseUntil: null, attached: null, visible: false },
])("input discovery preserves admission-state coverage independently of dispatch eligibility: %j", row => {
  const f = fixture();
  createAppInboxItem(f.db, {
    id: "retained", appId: "sample", source: { kind: "app", id: "caller" }, input: { kind: "work", data: {} },
  });
  f.db.prepare(`UPDATE app_inbox_items SET status = ?, waiting_on_kind = ?, lease_owner = ?,
    lease_expires_at = ?, available_at = ?, execution_task_id = ? WHERE id = 'retained'`)
    .run(row.status, row.waiting, row.leaseUntil === null ? null : "old-worker", row.leaseUntil, Number.MAX_SAFE_INTEGER, row.attached);
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  expect(f.read().unadmittedInputs?.items.map(item => item.id)).toEqual(row.visible ? ["retained"] : []);
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
});

test("input discovery upgrades the old pending-only index without losing retained handling rows", () => {
  const f = fixture();
  f.db.exec(`DROP INDEX IF EXISTS idx_app_inbox_admission_read;
    CREATE INDEX IF NOT EXISTS idx_app_inbox_pending_admission_read ON app_inbox_items(app_id, id)
    WHERE status = 'pending' AND execution_task_id IS NULL AND waiting_on_kind IS NULL`);
  createAppInboxItem(f.db, {
    id: "retained", appId: "sample", source: { kind: "app", id: "caller" }, input: { kind: "work", data: {} },
  });
  f.db.prepare("UPDATE app_inbox_items SET status = 'handling' WHERE id = 'retained'").run();
  applyDbSchema(f.db);
  applyDbSchema(f.db); // Restart/standalone schema setup must be idempotent too.
  expect(f.read().unadmittedInputs?.items.map(item => item.id)).toEqual(["retained"]);
});

test("feedback separates actual runnable work, blockers, idle results and closed history without mutations", () => {
  const f = fixture();
  f.add("running"); f.claim("running");
  f.add("ready");
  f.add("dependency", { dependsOn: ["running"] });
  f.add("waiting");
  deferAppTask(f.config, f.claim("waiting"), { disposition: "waiting", summary: "Waiting for approval",
    conditions: [{ id: "approval", type: "approval.observed", subject: "draft:one", expected: { approved: true },
      owner: "human:reviewer", requestedAction: "Approve the draft" }] });
  f.add("idle");
  completeAppTask(f.config, f.claim("idle"), { summary: "Assessment published", response: "Report retained", facts: ["published"] });
  f.add("closed");
  const closed = f.claim("closed");
  completeAppTask(f.config, closed, { summary: "Delivered", facts: ["verified"] });
  const resource = f.config.resourceStore.readTask("closed")!;
  closeAppTask(f.config, { appId: "sample", taskId: "closed", expectedGeneration: resource.metadata.generation,
    expectedResourceVersion: resource.metadata.resourceVersion, afterResult: closed.attemptId, reason: "Consumed" });
  const before = f.db.prepare("SELECT total_changes() AS count").get();
  const observed = f.read();
  expect(observed.coverage).toMatchObject({ scanned: 5, matched: 5, truncated: false });
  expect(observed.counts).toEqual({ running: 1, runnable: 1, waiting: 2, attention: 0, idle: 1,
    paused: 0, cooldown: 0, unknown: 0, pendingInputTasks: 0 });
  expect(observed.assignments).toEqual({ rootTasks: 0, contributions: 0, unattributed: 5, representedRoots: 0 });
  expect(observed.examples.blockers).toEqual([{ taskId: "dependency", kind: "dependency" }, { taskId: "waiting", kind: "waiting" }]);
  expect(observed.examples.dispositionCandidates).toEqual([{ taskId: "idle", acceptedAttemptId: expect.any(String) }]);
  expect(observed.limits).toMatchObject({ app: { backgroundMaxConcurrent: 3, interactiveAdditional: 1 },
    host: { available: false }, agent: { available: false }, root: { available: false } });
  expect(observed.queueWait).toEqual({ available: false });
  expect(f.db.prepare("SELECT total_changes() AS count").get()).toEqual(before);
  recordAppTaskTrigger(f.config, "idle", { type: "correction.observed", eventId: 1, data: {} });
  expect(f.read().counts).toMatchObject({ idle: 0, runnable: 2, pendingInputTasks: 1 });
});

test("agent-scoped counts preserve bounded App coverage and continuation instead of claiming fleet totals", () => {
  const f = fixture();
  for (let index = 0; index < 4; index++) f.add(`task-${index}`, { agent: index % 2 ? "other" : "worker" });
  const reader = createRuntimeTaskRead({ taskStateConfig: f.config });
  const first = reader.workload({ agent: "worker", limit: 2 });
  expect(first.scope).toEqual({ appId: "sample", agent: "worker" });
  expect(first.coverage).toMatchObject({ scanned: 2, matched: 1, truncated: true });
  expect(first.counts.runnable).toBe(1);
  const second = reader.workload({ agent: "worker", limit: 2, cursor: first.coverage.nextCursor });
  expect(second.coverage).toMatchObject({ scanned: 2, matched: 1, truncated: false });
  expect(second.counts.runnable).toBe(1);
  expect(() => reader.workload({ limit: 101 })).toThrow("between 1 and 100");
  expect(() => reader.workload({ cursor: "!bad" })).toThrow("cursor");
  expect(() => reader.workload({ agent: " " })).toThrow("agent");
  // Invalid queries release their read snapshot too.
  f.add("another");
});

test("paused input and full capacity do not look like useful spare execution", () => {
  const paused = fixture("paused", "paused"); paused.add("work");
  expect(paused.read().counts).toMatchObject({ runnable: 0, paused: 1 });
  const f = fixture();
  for (let index = 0; index < 3; index++) { f.add(`active-${index}`); f.claim(`active-${index}`); }
  f.add("queued");
  expect(f.read().counts).toMatchObject({ running: 3, runnable: 1 });
});

test.each(["retained-work", "waiting"] as const)("%s remains visible as pending input after its trigger is consumed", kind => {
  const f = fixture(); f.add("work");
  admitTaskInput(f.config, { appId: "sample", attachment: { kind: "existing", taskId: "work" },
    idempotencyKey: "ask:work", inputContext: { id: "ask", source: { kind: "app", id: "caller" },
      input: { kind: "request", data: {} } } });
  const due = Date.now() + 60_000;
  const claim = f.claim("work");
  if (kind === "waiting") deferAppTask(f.config, claim, { disposition: "waiting", summary: "Await review", reviewAt: due });
  else completeAppTask(f.config, claim, { summary: "Partial evidence retained", inputKeys: [] });
  expect(f.config.resourceStore.readTrigger("work")).toBeNull();
  expect(f.config.resourceStore.readTask("work")!.status.inputWaits).toHaveProperty("ask:work");
  const before = f.db.prepare("SELECT total_changes() AS count").get();
  expect(f.read().counts).toMatchObject({ pendingInputTasks: 1, ...(kind === "waiting" ? { waiting: 1, runnable: 0 } : { runnable: 1 }) });
  expect(f.db.prepare("SELECT total_changes() AS count").get()).toEqual(before);
  if (kind === "waiting") setSystemTime(due);
  completeAppTask(f.config, f.claim("work"), { summary: "Request answered" });
  expect(f.read().counts).toMatchObject({ pendingInputTasks: 0, idle: 1 });
});

test("retry cooldown and exhausted execution remain distinct from runnable demand", () => {
  const f = fixture(); f.add("retry");
  failAppTaskAttempt(f.config, f.claim("retry"), "Transient provider failure");
  expect(f.read().counts).toMatchObject({ runnable: 0, cooldown: 1, attention: 0 });
  const stopped = fixture("stopped"); stopped.config.maxConsecutiveFailures = 1;
  stopped.add("exhausted");
  failAppTaskAttempt(stopped.config, stopped.claim("exhausted"), "Needs owner recovery");
  expect(stopped.read().counts).toMatchObject({ runnable: 0, cooldown: 0, attention: 1 });
});

test("blocker examples stay bounded while counts preserve inspected demand", () => {
  const f = fixture();
  for (let index = 0; index < 7; index++) f.add(`blocked-${index}`, { dependsOn: ["missing"] });
  const result = f.read();
  expect(result.counts.waiting).toBe(7);
  expect(result.examples.blockers).toHaveLength(5);
  expect(result.examples.truncated).toBe(true);
});

test("feedback bounds graph expansion and leaves a failed read usable for a smaller scope", () => {
  const groups = Object.fromEntries(Array.from({ length: 520 }, (_, index) => [
    `group-${index}`, { id: `group-${index}`, parent_id: index < 519 ? `group-${index + 1}` : null },
  ]));
  const f = fixture("sample", "active", { groups: { ...groups, root: { id: "root", owner: "worker" } } });
  f.add("deep", { parentId: "group-0" });
  expect(f.read).toThrow("bounded relation limit");
  f.add("a-plain");
  const small = readTaskWorkload({ taskStateConfig: f.config }, { agent: "worker", limit: 1 });
  expect(small.counts.runnable).toBe(1);
  expect(small.coverage.truncated).toBe(true);
});

test("an accepted summary-only result is inspectable without loading historical attempts", () => {
  const f = fixture(); f.add("report");
  const claim = f.claim("report");
  completeAppTask(f.config, claim, { summary: "Publication retained", facts: ["published"] });
  // Historical body damage must not turn a current-state observation into an
  // unbounded history read or a failed workload observation.
  f.db.prepare("UPDATE app_task_attempts SET attempt_json = json_set(attempt_json, '$.acceptedResult.state', 'damaged') WHERE app_id = ? AND attempt_id = ?")
    .run("sample", claim.attemptId);
  expect(f.read().examples.dispositionCandidates).toEqual([{ taskId: "report", acceptedAttemptId: claim.attemptId }]);
});

test("SDK reads share the projection and isolated worker limiters never masquerade as Host capacity", async () => {
  const f = fixture(); f.add("work");
  const capacity = new HostCapacity(4);
  const release = capacity.tryAcquire()!;
  const opts = { hostCapacity: capacity, installControllers: true } as AppTaskRuntimeOptions;
  const read = createRuntimeAppRead({ getDb: () => f.db, taskStateConfig: f.config, workloadSource: runtimeWorkloadSource(opts) });
  expect((await read.tasks.workload!()).limits.host).toEqual({ available: true, scope: "controller-host-process", observedAt: expect.any(String),
    maxConcurrent: 4, backgroundMaxConcurrent: 3, reservedSlots: 1, waitingAcquisitions: 0 });
  const worker = readTaskWorkload({ taskStateConfig: f.config, workloadSource: runtimeWorkloadSource({ ...opts, installControllers: false }) });
  expect(worker.limits.host).toEqual({ available: false });
  release();
  await expect(createRuntimeAppRead({ getDb: () => f.db }).tasks.workload!()).rejects.toThrow("App scope");
});

test("worker feedback preserves parent capacity time and dispatch timing instead of using its private limiter", () => {
  const f = fixture(); f.add("work");
  const parent = new HostCapacity(5);
  const release = parent.tryAcquire()!;
  const host = parent.workloadSnapshot();
  const dispatch = { enqueuedAt: 100, startedAt: 250, readyWaitMs: 150, lane: "normal" as const, hostCapacityAtDispatch: host };
  const worker = { hostCapacity: new HostCapacity(1), installControllers: false } as AppTaskRuntimeOptions;
  const read = () => readTaskWorkload({ taskStateConfig: f.config, workloadSource: runtimeWorkloadSource(worker, undefined, dispatch, "work") });
  release(); // A subsequent read cannot present this older parent snapshot as fresh.
  const observation = read();
  expect(observation.limits.host).toEqual(host);
  expect(observation.queueWait).toEqual({ available: true, scope: "current-task-dispatch", appId: "sample", taskId: "work", enqueuedAt: 100, dispatchedAt: 250, elapsedMs: 150, lifetime: "current-controller" });
  if (!observation.limits.host.available) throw new Error("Missing parent observation");
  observation.limits.host.reservedSlots = 999;
  expect(read().limits.host).toEqual(host);
  const noParent = readTaskWorkload({ taskStateConfig: f.config, workloadSource: runtimeWorkloadSource(worker) });
  expect(noParent.limits.host).toEqual({ available: false });
  expect(noParent.queueWait).toEqual({ available: false });
});

test("the scoped model tool exposes the same facts and rejects unavailable reads", async () => {
  const f = fixture();

  f.add("work");
  const canonical = createRuntimeTaskRead({ taskStateConfig: f.config, workloadSource: { currentTaskId: "work" } });
  const tool = createAppTaskReadTool({
    bus: new EventBus(),
    appId: () => "sample",
    reader: {
      list: () => canonical.list(),
      get: () => null,
      workload: ({ options }) => canonical.workload(options),
    },
  });
  const result = await tool.execute("read", {
    action: "workload",
    agent: "worker",
    limit: 1,
    taskId: "unread-other-task",
  });
  const content = result.content[0];
  if (content.type !== "text") throw new Error("Expected workload facts");
  expect(JSON.parse(content.text)).toMatchObject({
    scope: { appId: "sample", agent: "worker" },
    funding: { ordinary: { available: false }, currentRoot: { available: false } },
    counts: { runnable: 1 },
    assignments: { rootTasks: 0, contributions: 0, unattributed: 1, representedRoots: 0 },
    coverage: { limit: 1, matched: 1, scanned: 1, truncated: false },
  });
  const old = createAppTaskReadTool({
    bus: new EventBus(),
    appId: () => "sample",
    reader: {
      list: () => canonical.list(),
      get: () => null,
    },
  });
  expect((await old.execute("read", { action: "workload" })).content).toMatchObject([
    { type: "text", text: expect.stringContaining("Workload read is unavailable") },
  ]);
});

test.each([undefined, "sample"])("attempt feedback is opt-in and shares workflow context (pilot=%s)", async pilot => {
  const f = fixture();
  f.add("work");
  const claim = f.claim("work");
  const app = defineApp({ id: "sample", version: 1, agent: "worker", inputSchema: Type.Object({}), tasks: {} });
  expect(readAppContract(app).taskReads).toEqual({ workload: 1 });
  await runTaskExecutorAttempt({
    opts: { projectsRoot: "/tmp/workload-fixture", projectRoot: "/tmp/workload-fixture", bus: new EventBus(),
      hostCapacity: new HostCapacity(1), installControllers: false, workloadFeedbackAppId: pilot },
    descriptor: { id: "sample", app, agent: "worker", appDir: f.config.appDir, projectDir: f.config.projectDir,
      reconciliationPaused: false, resourceStore: f.config.resourceStore },
    claim, executionPaths: { appDir: f.config.appDir, projectDir: f.config.projectDir, workspaceDir: f.config.projectDir },
    childContext: { live: [], completed: [] }, taskSnapshot: { live: [], truncated: false },
    execute: async attempt => {
      if (pilot) {
        expect(attempt.workload).toMatchObject({ scope: { appId: "sample", agent: "worker" }, counts: { running: 1 },
          assignments: { rootTasks: 0, contributions: 0, unattributed: 1, representedRoots: 0 },
          limits: { host: { available: false } }, funding: { ordinary: { available: false }, currentRoot: { available: false } } });
      } else expect(attempt.workload).toBeUndefined();
      const context = taskExecutionContext({ descriptor: { id: "sample" }, attempt,
        executionPaths: { appDir: f.config.appDir, projectDir: f.config.projectDir, workspaceDir: f.config.projectDir },
        taskEvents: {}, taskSnapshot: { live: [], truncated: false },
      } as TaskAgentInput);
      expect(context.reconciliation.workload).toEqual(attempt.workload);
      expect((await attempt.read.tasks.workload!()).counts.running).toBe(1);
      return { handlerResult: { state: "converged", summary: "Inspected", facts: [], actions: [] }, runId: null };
    },
  });
});


test.each(["review", "retained-input"] as const)("elapsed %s deadline is visible before recovery without changing the wake hint", kind => {
  const f = fixture();
  f.add("gate"); completeAppTask(f.config, f.claim("gate"), { summary: "Dependency accepted" });
  f.add("review", { dependsOn: ["gate"] });
  const now = 1_800_000_000_000;
  setSystemTime(now);
  const due = now + 60_000;
  if (kind === "retained-input") admitTaskInput(f.config, {
    appId: "sample", attachment: { kind: "existing", taskId: "review" }, idempotencyKey: "ask:review",
    inputContext: { id: "review", source: { kind: "app", id: "caller" }, input: { kind: "review", data: {} } },
  });
  deferAppTask(f.config, f.claim("review"), { disposition: "waiting", summary: "Review when due", reviewAt: due });
  if (kind === "retained-input") {
    admitTaskInput(f.config, { appId: "sample", attachment: { kind: "existing", taskId: "review" }, idempotencyKey: "ask:other",
      inputContext: { id: "other", source: { kind: "app", id: "caller" }, input: { kind: "review", data: {} } } });
    completeAppTask(f.config, f.claim("review"), { summary: "Unrelated ask answered" });
    // Older retained records may carry only the exact input deadline.
    const retained = f.config.resourceStore.readTask("review")!;
    const resourceVersion = retained.metadata.resourceVersion;
    delete retained.status.reviewAt;
    retained.metadata.resourceVersion++;
    f.config.resourceStore.commit({ fences: [{ taskId: "review", resourceVersion }], tasks: [{ resource: retained }] });
    expect(f.config.resourceStore.readTask("review")!.status.inputWaits?.["ask:review"]?.reviewAt).toBe(due);
  }
  expect(f.read().counts).toMatchObject({ waiting: 1, runnable: 0 });
  setSystemTime(due);
  const before = f.db.prepare("SELECT total_changes() AS count").get();
  expect(f.read().counts).toMatchObject({ waiting: 0, runnable: 1 });
  expect(f.db.prepare("SELECT total_changes() AS count").get()).toEqual(before);
  f.add("gate", { outcome: "Recheck changed evidence" });
  expect(f.read().counts).toMatchObject({ waiting: 1, runnable: 1 });
  expect(f.read().examples.blockers).toContainEqual({ taskId: "review", kind: "dependency" });
  completeAppTask(f.config, f.claim("gate"), { summary: "Changed dependency accepted" });
  f.config.resourceStore.setProjectLifecycle("paused");
  expect(f.read().counts).toMatchObject({ runnable: 0, paused: 1 });
  f.config.resourceStore.setProjectLifecycle("active");
  expect(f.claim("review").trigger?.type).toBe("project.task.review-at.reached");
});

test("fresh human admission is runnable while the retained phase is attention and replay grants no second retry", () => {
  const f = fixture(); f.config.maxConsecutiveFailures = 1; f.add("repair");
  failAppTaskAttempt(f.config, f.claim("repair"), "Needs a corrected source");
  const ask = { appId: "sample", attachment: { kind: "existing" as const, taskId: "repair" }, idempotencyKey: "human:correction",
    inputContext: { id: "correction", source: { kind: "human" as const, id: "person" }, input: { kind: "message", data: { text: "Use source B" } } } };
  admitTaskInput(f.config, ask);
  expect(f.config.resourceStore.readTask("repair")!.status.phase).toBe("attention");
  const before = f.db.prepare("SELECT total_changes() AS count").get();
  expect(f.read().counts).toMatchObject({ runnable: 1, attention: 0 });
  expect(f.db.prepare("SELECT total_changes() AS count").get()).toEqual(before);
  f.config.resourceStore.setProjectLifecycle("paused");
  expect(f.read().counts).toMatchObject({ runnable: 0, paused: 1 });
  expect(readTaskWorkload({ taskStateConfig: f.config, workloadSource: { foregroundTaskIds: () => new Set(["repair"]) } }).counts)
    .toMatchObject({ runnable: 1, paused: 0 });
  f.config.resourceStore.setProjectLifecycle("active");
  failAppTaskAttempt(f.config, f.claim("repair"), "Correction did not repair the source");
  admitTaskInput(f.config, ask);
  expect(f.read().counts).toMatchObject({ runnable: 0, attention: 1 });
});

