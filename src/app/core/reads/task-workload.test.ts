import { afterEach, expect, setSystemTime, spyOn, test } from "bun:test";
import { openDatabase, type SqliteDb } from "../../../lib/db.js";
import { applyDbSchema } from "../../../lib/db/schema.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore } from "../state/task-budget-admission.js";
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
import { AppInboxHost } from "../inbox/app-inbox-host.js";
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

test("workload exposes unfunded received demand when no Task can be created", async () => {
  const f = fixture();
  new TaskBudgetAdmissionStore(f.db).install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "worker" },
    dailyCredits: 0,
    rootCredits: 5,
  });
  const app = defineApp({
    id: "sample",
    version: 1,
    agent: "worker",
    tasks: {},
    inputSchema: Type.Object({ kind: Type.Literal("work"), data: Type.Object({}) }),
    task: (input) => ({
      kind: "desired",
      intent: { id: input.id, parentId: "root", outcome: "Deliver required report", acceptance: ["Report delivered"] },
    }),
  });
  const host = new AppInboxHost({ db: f.db, apps: [app], attachTask: (input) => admitTaskInput(f.config, input) });
  try {
    host.admit({
      id: "required-report",
      appId: "sample",
      source: { kind: "app", id: "exact-caller" },
      input: { kind: "work", data: {} },
    });
    const before = f.db.prepare("SELECT total_changes() AS n").get();
    const observed = f.read();
    expect(observed.coverage.matched).toBe(0);
    expect(observed.counts.pendingInputTasks).toBe(0);
    expect(observed.unadmittedInputs).toMatchObject({
      scope: { appId: "sample" },
      coverage: { scanned: 1, truncated: false },
      omitted: 0,
      items: [
        {
          id: "required-report",
          kind: "work",
          source: { kind: "app", id: "exact-caller" },
          funding: { reason: "sponsor-credit", retryAt: expect.any(Number) },
        },
      ],
    });
    expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
    expect(host.get("required-report")).toMatchObject({ status: "pending", source: { id: "exact-caller" } });
    expect(f.config.resourceStore.readTask("required-report")).toBeNull();
  } finally {
    host.close();
  }
});

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

test("assignment feedback separates canonical roots, contributions and unattributed work within each page and agent", () => {
  const f = fixture();
  f.add("a-legacy");
  const budgets = new TaskBudgetAdmissionStore(f.db);
  budgets.install({ appId: "sample", sponsor: { appId: "sample", agent: "sponsor" }, dailyCredits: 30, rootCredits: 20 });
  f.add("b-root");
  const contribute = (id: string, creatorId: string, agent = "worker") => observeAppTaskIntent(f.config, {
    appAgent: "worker", creator: { appId: "sample", taskId: creatorId },
    intent: { id, parentId: "root", agent, outcome: "Supply a contribution", acceptance: ["Evidence returned"] },
  });
  contribute("c-child", "b-root");
  contribute("d-grandchild", "c-child", "other");
  f.add("e-independent", { parentId: "b-root" }); // Structural parenting grants no account inheritance.
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  expect(f.read()).toMatchObject({ assignments: { rootTasks: 2, contributions: 2, unattributed: 1, representedRoots: 2 } });
  const read = createRuntimeTaskRead({ taskStateConfig: f.config });
  expect(read.workload({ agent: "worker" })).toMatchObject({ coverage: { matched: 4 },
    assignments: { rootTasks: 2, contributions: 1, unattributed: 1, representedRoots: 2 } });
  const first = read.workload({ limit: 2 });
  expect(first).toMatchObject({ coverage: { scanned: 2, matched: 2, truncated: true },
    assignments: { rootTasks: 1, contributions: 0, unattributed: 1, representedRoots: 1 } });
  const second = read.workload({ limit: 2, cursor: first.coverage.nextCursor });
  expect(second).toMatchObject({ coverage: { scanned: 2, matched: 2, truncated: true },
    assignments: { rootTasks: 0, contributions: 2, unattributed: 0, representedRoots: 1 } });
  const third = read.workload({ limit: 2, cursor: second.coverage.nextCursor });
  expect(third).toMatchObject({ coverage: { scanned: 1, matched: 1, truncated: false },
    assignments: { rootTasks: 1, contributions: 0, unattributed: 0, representedRoots: 1 } });
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
});

test("assignment feedback distinguishes same-named external roots without scanning or exposing their Tasks", () => {
  const f = fixture();
  const budgets = new TaskBudgetAdmissionStore(f.db);
  const otherStore = AppTaskResourceStore.fromDb(f.db, "other");
  const other = appTaskTestContext({ appDir: "/tmp/workload-fixture/other.app", appId: "other", agent: "worker",
    resourceStore: otherStore, tree: { groups: { root: { id: "root", owner: "worker" } } } });
  for (const appId of ["sample", "other"]) budgets.install({ appId, sponsor: { appId, agent: "sponsor" }, dailyCredits: 20, rootCredits: 15 });
  f.add("work");
  observeAppTaskIntent(other, { appAgent: "worker", intent: { id: "work", parentId: "root", outcome: "Another assignment", acceptance: ["Delivered"] } });
  const destinationStore = AppTaskResourceStore.fromDb(f.db, "destination");
  const destination = appTaskTestContext({ appDir: "/tmp/workload-fixture/destination.app", appId: "destination", agent: "worker",
    resourceStore: destinationStore, tree: { groups: { root: { id: "root", owner: "worker" } } } });
  for (const [id, creator] of [["one", { appId: "sample", taskId: "work" }], ["two", { appId: "other", taskId: "work" }],
    ["three", { appId: "destination", taskId: "one" }]] as const) {
    observeAppTaskIntent(destination, { appAgent: "worker", creator,
      intent: { id, parentId: "root", outcome: "Return scoped facts", acceptance: ["Facts returned"] } });
  }
  const before = f.db.prepare("SELECT total_changes() AS n").get();
  const observed = readTaskWorkload({ taskStateConfig: destination });
  expect(observed).toMatchObject({ scope: { appId: "destination" }, coverage: { matched: 3, truncated: false } });
  expect(observed.assignments).toEqual({ rootTasks: 0, contributions: 3, unattributed: 0, representedRoots: 2 });
  expect(observed.counts.runnable).toBe(3);
  expect(f.db.prepare("SELECT total_changes() AS n").get()).toEqual(before);
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
  new TaskBudgetAdmissionStore(f.db).install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "worker" },
    dailyCredits: 3,
    rootCredits: 3,
  });
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
    funding: { ordinary: { remaining: 2 }, currentRoot: { task: { taskId: "work" }, remaining: 2 } },
    counts: { runnable: 1 },
    assignments: { rootTasks: 1, contributions: 0, unattributed: 0, representedRoots: 1 },
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
  new TaskBudgetAdmissionStore(f.db).install({ appId: "sample", sponsor: { appId: "sample", agent: "worker" }, dailyCredits: 5, rootCredits: 3 });
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
          assignments: { rootTasks: 1, contributions: 0, unattributed: 0, representedRoots: 1 },
          limits: { host: { available: false } }, funding: { ordinary: { remaining: 3 }, currentRoot: { available: true, remaining: 1 } } });
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

test("funding holds are waiting demand with exact reasons, not unknown or usable spare capacity", () => {
  const f = fixture();
  const accounting = new TaskBudgetAdmissionStore(f.db);
  accounting.install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "worker" },
    dailyCredits: 1,
    rootCredits: 3,
  });
  f.add("owed");
  expect(claimObservedAppTask(f.config, { taskId: "owed", appAgent: "worker", handler: "fixture" }).kind).toBe(
    "deferred",
  );
  const before = f.db.prepare("SELECT total_changes() AS count").get();
  const observed = f.read();
  expect(observed.counts).toMatchObject({ waiting: 1, runnable: 0, unknown: 0 });
  expect(observed.examples.blockers).toEqual([
    { taskId: "owed", kind: "funding", reason: "sponsor-credit", retryAt: expect.any(Number) },
  ]);
  expect(observed.funding?.ordinary).toMatchObject({
    available: true,
    sponsor: { appId: "sample", agent: "worker" },
    credits: 1,
    charged: 1,
    remaining: 0,
  });
  expect(observed.funding?.currentRoot).toEqual({ available: false });
  expect(f.db.prepare("SELECT total_changes() AS count").get()).toEqual(before);
});

test("funding readiness and balances keep one snapshot when the clock crosses renewal during a read", () => {
  const beforeRenewal = Date.parse("2026-07-01T23:59:59.999Z");
  const afterRenewal = beforeRenewal + 1;
  setSystemTime(beforeRenewal);
  const f = fixture();
  new TaskBudgetAdmissionStore(f.db).install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "worker" },
    dailyCredits: 1,
    rootCredits: 3,
  });
  f.add("owed");
  expect(claimObservedAppTask(f.config, { taskId: "owed", appAgent: "worker", handler: "fixture" }).kind).toBe(
    "deferred",
  );
  let calls = 0;
  const clock = spyOn(Date, "now").mockImplementation(() => (++calls === 1 ? beforeRenewal : afterRenewal));
  try {
    const observed = f.read();
    expect(observed.observedAt).toBe(new Date(beforeRenewal).toISOString());
    expect(observed.counts).toMatchObject({ waiting: 1, runnable: 0 });
    expect(observed.funding?.ordinary).toMatchObject({ period: "2026-07-01", remaining: 0 });
  } finally {
    clock.mockRestore();
  }
  setSystemTime(afterRenewal);
  expect(f.read()).toMatchObject({
    counts: { waiting: 0, runnable: 1 },
    funding: { ordinary: { period: "2026-07-02", remaining: 1 } },
  });
});

test("budget feedback keeps the current root and App sponsor scopes distinct through UTC renewal without writes", () => {
  setSystemTime(new Date("2026-07-01T23:59:00Z"));
  const f = fixture();
  const accounting = new TaskBudgetAdmissionStore(f.db);
  accounting.install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "sponsor" },
    dailyCredits: 5,
    rootCredits: 3,
  });
  f.add("root-work");
  f.claim("root-work");
  const read = () => readTaskWorkload({ taskStateConfig: f.config, workloadSource: { currentTaskId: "root-work" } });
  expect(read().funding).toMatchObject({
    ordinary: { available: true, credits: 5, charged: 2, remaining: 3 },
    currentRoot: {
      available: true,
      task: { appId: "sample", taskId: "root-work" },
      root: { appId: "sample", taskId: "root-work" },
      purpose: "ordinary",
      renewal: "lifetime",
      credits: 3,
      charged: 2,
      remaining: 1,
      sponsorRemaining: 3,
    },
  });
  setSystemTime(new Date("2026-07-02T00:01:00Z"));
  const before = f.db.prepare("SELECT total_changes() AS count").get();
  expect(read().funding).toMatchObject({
    ordinary: { period: "2026-07-02", credits: 5, charged: 0, remaining: 5 },
    currentRoot: { period: "lifetime", charged: 2, remaining: 1, sponsorRemaining: 5 },
  });
  expect(f.db.prepare("SELECT total_changes() AS count").get()).toEqual(before);
  expect(f.db.prepare("SELECT count(*) AS n FROM task_credit_grants").get()?.n).toBe(1);
});

test("cross-App contribution feedback reports the destination's ordinary sponsor and its original shared root", () => {
  const f = fixture();
  const accounting = new TaskBudgetAdmissionStore(f.db);
  accounting.install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "sponsor" },
    dailyCredits: 5,
    rootCredits: 4,
  });
  f.add("caller");
  f.claim("caller");
  accounting.install({
    appId: "service",
    sponsor: { appId: "service", agent: "recipient" },
    dailyCredits: 7,
    rootCredits: 3,
  });
  const store = AppTaskResourceStore.fromDb(f.db, "service");
  const config = appTaskTestContext({
    appDir: "/tmp/workload-fixture/service.app",
    appId: "service",
    agent: "recipient",
    maxConcurrent: 2,
    resourceStore: store,
    tree: { groups: { root: { id: "root", owner: "recipient" } } },
  });
  observeAppTaskIntent(config, {
    appAgent: "recipient",
    creator: { appId: "sample", taskId: "caller" },
    intent: { id: "contribution", parentId: "root", outcome: "Supply facts", acceptance: ["Facts returned"] },
  });
  const observed = readTaskWorkload({ taskStateConfig: config, workloadSource: { currentTaskId: "contribution" } });
  expect(observed.funding).toMatchObject({
    ordinary: { sponsor: { appId: "service", agent: "recipient" }, credits: 7, remaining: 7 },
    currentRoot: {
      task: { appId: "service", taskId: "contribution" },
      root: { appId: "sample", taskId: "caller" },
      sponsor: { appId: "sample", agent: "sponsor" },
      credits: 4,
      charged: 3,
      remaining: 1,
      sponsorRemaining: 2,
    },
  });
});

test("protected coordination feedback does not turn its reserved credits into ordinary funds", () => {
  const f = fixture();
  new TaskBudgetAdmissionStore(f.db).install({
    appId: "sample",
    sponsor: { appId: "sample", agent: "worker" },
    dailyCredits: 0,
    rootCredits: 3,
    coordination: {
      taskId: "review",
      workflow: "review",
      agent: "worker",
      maxAttemptMs: 60_000,
      dailyCredits: 5,
      credits: 4,
    },
  });
  f.add("review", { workflow: "review" });
  expect(claimObservedAppTask(f.config, { taskId: "review", appAgent: "worker", handler: "auto" }).kind).toBe(
    "claimed",
  );
  const observed = readTaskWorkload({ taskStateConfig: f.config, workloadSource: { currentTaskId: "review" } });
  expect(observed.funding).toMatchObject({
    ordinary: { available: true, remaining: 0 },
    currentRoot: { purpose: "coordination", remaining: 2, sponsorRemaining: 3 },
  });
  expect(f.db.prepare("SELECT count(*) AS n FROM task_credit_grants WHERE purpose = 'ordinary'").get()?.n).toBe(0);
  expect(fixture("unconfigured").read().funding).toEqual({
    ordinary: { available: false },
    currentRoot: { available: false },
  });
});
