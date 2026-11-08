import { afterEach, expect, test } from "bun:test";
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
import { readAppContract } from "./app-contract.js";
import type { TaskTree } from "../tasks/app-task-store.js";

const databases: SqliteDb[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

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
  expect((await read.tasks.workload!()).limits.host).toEqual({ available: true, scope: "current-host-process",
    maxConcurrent: 4, backgroundMaxConcurrent: 3, reservedSlots: 1, waitingAcquisitions: 0 });
  const worker = readTaskWorkload({ taskStateConfig: f.config, workloadSource: runtimeWorkloadSource({ ...opts, installControllers: false }) });
  expect(worker.limits.host).toEqual({ available: false });
  release();
  await expect(createRuntimeAppRead({ getDb: () => f.db }).tasks.workload!()).rejects.toThrow("App scope");
});

test("the scoped model tool exposes the same facts and rejects unavailable reads", async () => {
  const f = fixture(); f.add("work");
  const canonical = createRuntimeTaskRead({ taskStateConfig: f.config });
  const tool = createAppTaskReadTool({ bus: new EventBus(), appId: () => "sample", reader: {
    list: () => canonical.list(), get: () => null,
    workload: ({ options }) => canonical.workload(options),
  } });
  const result = await tool.execute("read", { action: "workload", agent: "worker", limit: 1 });
  const content = result.content[0];
  if (content.type !== "text") throw new Error("Expected workload facts");
  expect(JSON.parse(content.text)).toMatchObject({ scope: { appId: "sample", agent: "worker" },
    counts: { runnable: 1 }, coverage: { limit: 1, matched: 1, scanned: 1, truncated: false } });
  const old = createAppTaskReadTool({ bus: new EventBus(), appId: () => "sample", reader: {
    list: () => canonical.list(), get: () => null,
  } });
  expect((await old.execute("read", { action: "workload" })).content).toMatchObject([
    { type: "text", text: expect.stringContaining("Workload read is unavailable") },
  ]);
});

test.each([undefined, "sample"])("attempt feedback is opt-in and shares workflow context (pilot=%s)", async pilot => {
  const f = fixture(); f.add("work");
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
          limits: { host: { available: false } } });
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
