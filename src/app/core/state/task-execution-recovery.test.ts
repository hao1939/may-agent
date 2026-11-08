import { afterEach, expect, test, setSystemTime } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { defineApp, Type } from "@may-agent/sdk";
import { spawnFixtureProcess } from "../../../../test/fixtures/owned-process.js";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { SubagentManager } from "../../../lib/manager.js";
import { markSessionActive, sessionDir } from "../../../lib/persistence.js";
import { fakeModel } from "../../../../test/fixtures/model.js";
import { createTaskSessionRecovery } from "../../adapters/executors/session-recovery.js";
import { createTaskAgentRunner } from "../../adapters/executors/managed-agent.js";
import { EventBus } from "../events/bus.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import {
  installAppTaskRuntimes,
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
} from "../tasks/app-task-runtime.js";
import { runTaskAttempt } from "../tasks/attempt-runner.js";
import {
  appTaskContext,
  claimObservedAppTask,
  recoverableAppTaskAttempts,
  releaseInterruptedAppTaskAttempt,
  releaseStaleAppTaskResult,
  repairRunningAppTasksWithoutAttempt,
  observeAppTaskIntent,
  cancelAppTask,
  type AppTaskClaim,
} from "../tasks/app-task-reconciler.js";
import { installTaskExecutionLimit } from "./task-execution-admission.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { AppTaskRecoveryScheduler } from "../tasks/app-task-recovery.js";
import { recoverDeadTaskExecution, taskExecutionRecoveryPage } from "./task-execution-cleanup.js";
import { TaskExecutionStore } from "./task-execution-store.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  setSystemTime();
  for (const close of cleanups.splice(0)) await close();
});
const recipient = { kind: "programmatic" as const, id: "fixture/owner" };
async function workerFixture(live: boolean, managed = false) {
  const root = mkdtempSync(join(tmpdir(), "may-execution-recovery-"));
  const moduleUrl = (path: string) => JSON.stringify(new URL(path, import.meta.url).href);
  const script = `
import { getDb } from ${moduleUrl("../../../lib/db/connection.ts")};
import { AppTaskResourceStore } from ${moduleUrl("./app-task-resource-store.ts")};
import { TaskBudgetAdmissionStore } from ${moduleUrl("./task-budget-admission.ts")};
import { installTaskExecutionLimit } from ${moduleUrl("./task-execution-admission.ts")};
import { appTaskContext, observeAppTaskIntent, claimObservedAppTask, cancelAppTask } from ${moduleUrl("../tasks/app-task-reconciler.ts")};
const root = ${JSON.stringify(root)};
const db = getDb(root);
const tasks = AppTaskResourceStore.fromDb(db, "sample");
tasks.bootstrapSnapshot({ project: "sample", groups: { root: { id: "root", parent_id: null } } }, "seed");
new TaskBudgetAdmissionStore(db).install({ appId: "sample", sponsor: { appId: "sample", agent: "owner" }, dailyCredits: 20, rootCredits: 20 });
const config = appTaskContext({ appDir: root + "/sample.app", projectDir: root, agent: "owner", maxConcurrent: 2, resourceStore: tasks });
const recipient = ${JSON.stringify(recipient)};
installTaskExecutionLimit(db, { kind: "host" }, 4);
installTaskExecutionLimit(db, { kind: "agent", recipient }, 4);
installTaskExecutionLimit(db, { kind: "root", root: { appId: "sample", taskId: "work" } }, ${managed ? 2 : 1});
observeAppTaskIntent(config, { appAgent: "owner", intent: { id: "work", parentId: "root", outcome: "Collect facts", acceptance: ["Facts retained"], executor: "inspect" } });
const claim = claimObservedAppTask(config, { taskId: "work", appAgent: "owner", handler: "auto", execution: { recipient: () => recipient, lane: "background" } });
if (claim.kind !== "claimed") throw new Error("Expected worker claim");
if (${managed}) {
  const { SubagentManager } = await import(${moduleUrl("../../../lib/manager.ts")});
  const { createAgentRun } = await import(${moduleUrl("../../../lib/agent-runner.ts")});
  const { createAssistantMessageEventStream } = await import("@earendil-works/pi-ai");
  const { fakeModel } = await import(${moduleUrl("../../../../test/fixtures/model.ts")});
  const { taskPrimaryStart } = await import(${moduleUrl("./task-budget-managed-start.ts")});
  const started = [Promise.withResolvers(), Promise.withResolvers()];
  let calls = 0;
  const manager = new SubagentManager({ persistDir: root, agentRunFactory: options => createAgentRun({
    ...options, streamFn: () => { started[calls++].resolve(); return createAssistantMessageEventStream(); },
  }) });
  manager.register({ name: "owner", hostIdentity: recipient.id, description: "Fixture owner", domain: "test",
    systemPrompt: "Inspect facts", model: fakeModel(), tools: [] });
  const binding = { appId: "sample", taskId: "work", generation: claim.generation, attemptId: claim.attemptId };
  const primary = manager.run("owner", "Primary", { taskBinding: binding, taskPrimaryStart: taskPrimaryStart(binding) });
  await started[0].promise;
  manager.run("owner", "Helper", { parentSessionId: primary });
  await started[1].promise;
  // Deliberately crash before attaching the primary to the canonical attempt.
}

observeAppTaskIntent(config, { appAgent: "owner", creator: { appId: "sample", taskId: "work" }, intent: { id: "next", parentId: "root", outcome: "Contribute facts", acceptance: ["Facts retained"], executor: "inspect" } });
if (!${live}) { const task = tasks.readTask("work"); cancelAppTask(config, { appId: "sample", taskId: "work", expectedGeneration: task.metadata.generation, expectedResourceVersion: task.metadata.resourceVersion, reason: "Withdrawn" }); }
process.stdout.write("ready\\n");
if (!${live}) process.exit(0);
`;
  const child = spawnFixtureProcess(["--eval", script]);
  const closed = once(child, "close");
  cleanups.push(async () => {
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await closed;
    closeDb(root);
    rmSync(root, { recursive: true, force: true });
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const ready = Promise.withResolvers<void>();
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    if (stdout.includes("ready\n")) ready.resolve();
  });
  child.on("error", ready.reject);
  child.on("close", () => {
    if (!stdout.includes("ready\n")) ready.reject(new Error(stderr || "Worker exited before readiness"));
  });
  await ready.promise;
  if (!live) await closed;
  const db = getDb(root);
  const tasks = AppTaskResourceStore.fromDb(db, "sample");
  const config = appTaskContext({
    appDir: join(root, "sample.app"),
    projectDir: root,
    agent: "owner",
    maxConcurrent: 2,
    resourceStore: tasks,
  });
  return { root, db, tasks, config };
}

test("a changed runtime cannot interrupt a live non-session execution owner", async () => {
  const f = await workerFixture(true);
  const attemptId = f.tasks.readTask("work")!.status.currentAttemptId!;
  expect(
    claimObservedAppTask(f.config, {
      taskId: "work",
      appAgent: "owner",
      handler: "auto",
      execution: { recipient: () => recipient, lane: "background" },
    }).kind,
  ).toBe("busy");
  const attempt = f.tasks.readAttempt(attemptId)!;
  setSystemTime(Date.parse(attempt.lease!.expiresAt) + 1);
  const recovery = recoverableAppTaskAttempts(f.config, Date.now(), false, ["work"])[0];
  expect(recovery).toBeDefined();
  expect(recoverDeadTaskExecution(f.db, { appId: "sample", taskId: "work" })).toBe(0);
  expect(releaseInterruptedAppTaskAttempt(f.config, recovery, "Expired lease").released).toBe(false);
  const retainedClaim: AppTaskClaim = {
    kind: "claimed",
    taskId: "work",
    generation: attempt.taskGeneration,
    resourceVersion: f.tasks.readTask("work")!.metadata.resourceVersion,
    specHash: attempt.specHash,
    attemptId,
    agent: attempt.owner,
    handler: attempt.handler,
    intent: { id: "work", parentId: "root", outcome: "Collect facts", acceptance: ["Facts retained"] },
    events: [],
    eventsTruncated: false,
    declaredOutputPaths: [],
  };
  expect(releaseStaleAppTaskResult(f.config, retainedClaim).status).toBe("busy");
  expect(
    claimObservedAppTask(f.config, {
      taskId: "work",
      appAgent: "owner",
      handler: "auto",
      isAgentRunnable: () => false,
      reason: "attempt-recovery:work",
    }).kind,
  ).toBe("busy");
  expect(f.tasks.readAttempt(attemptId)?.state).toBe("running");
  expect(f.tasks.readTask("work")?.status.currentAttemptId).toBe(attemptId);
  expect(new TaskExecutionStore(f.db).usage({ kind: "root", root: { appId: "sample", taskId: "work" } }).occupied).toBe(
    1,
  );
});

test("historical execution without owner evidence remains occupied and cannot be requeued", async () => {
  const f = await workerFixture(false);
  f.db.prepare(`UPDATE task_execution_reservations SET receipt_json = json_remove(receipt_json, '$.owner')`).run();
  expect(recoverDeadTaskExecution(f.db, { appId: "sample", taskId: "work" })).toBe(0);
  expect(new TaskExecutionStore(f.db).usage({ kind: "host" }).occupied).toBe(1);
  expect(taskExecutionRecoveryPage(f.db, "sample", 1).taskIds).toEqual([]);
});

test("recovery confirms the unattached primary and every helper, retaining all capacity after failed Bash cleanup", async () => {
  const f = await workerFixture(false, true);
  const executions = new TaskExecutionStore(f.db);
  expect(executions.usage({ kind: "host" }).occupied).toBe(2);
  const primary = f.db
    .prepare(`SELECT session_id, attempt_id FROM task_budget_managed_starts WHERE primary_covered = 1`)
    .get()!;
  const helper = f.db.prepare(`SELECT session_id FROM task_budget_managed_starts WHERE primary_covered = 0`).get()!;
  expect(f.tasks.readAttempt(primary.attempt_id as string)?.sessionId).toBeUndefined();
  const drained: string[] = [];
  let helperCanDrain = false;
  const sessions = createTaskSessionRecovery({
    manager: new SubagentManager({ persistDir: f.root }),
    persistDir: f.root,
    bus: new EventBus(),
    drainPersistedBashProcessGroups: (_root, id) => {
      drained.push(id);
      return id !== helper.session_id || helperCanDrain;
    },
  });
  const confirm = (id: string, binding: Parameters<typeof sessions.interrupt>[3]) =>
    !sessions.isLive(id) && sessions.interrupt(id, "Recovering stopped execution", "work", binding);
  const marker = join(sessionDir(f.root, helper.session_id as string), "[ACTIVE]");
  const deadOwner = readFileSync(marker);
  // The attempt's worker is dead, but a separately owned helper is still live.
  markSessionActive(f.root, helper.session_id as string);
  expect(recoverDeadTaskExecution(f.db, { appId: "sample", taskId: "work" }, confirm)).toBe(0);
  expect(executions.usage({ kind: "host" }).occupied).toBe(2);
  expect(drained).not.toContain(helper.session_id as string);
  writeFileSync(marker, deadOwner);
  expect(recoverDeadTaskExecution(f.db, { appId: "sample", taskId: "work" }, confirm)).toBe(0);
  expect(executions.usage({ kind: "host" }).occupied).toBe(2);
  expect(drained).toContain(helper.session_id as string);
  helperCanDrain = true;
  expect(recoverDeadTaskExecution(f.db, { appId: "sample", taskId: "work" }, confirm)).toBe(1);
  expect(drained).toContain(primary.session_id as string);
  expect(executions.usage({ kind: "host" }).occupied).toBe(0);
  expect(f.tasks.isCancelled("work")).toBe(true);
  expect(recoverDeadTaskExecution(f.db, { appId: "sample", taskId: "work" }, confirm)).toBe(0);
});

test("bounded recovery paging reaches an ended Task beyond a live reservation without rereading history", async () => {
  const f = await workerFixture(false);
  const live = { appId: "sample", taskId: "a-live" };
  installTaskExecutionLimit(f.db, { kind: "root", root: live }, 1);
  observeAppTaskIntent(f.config, {
    appAgent: "owner",
    intent: {
      id: live.taskId,
      parentId: "root",
      outcome: "Retain live work",
      acceptance: ["Facts retained"],
      executor: "inspect",
    },
  });
  expect(
    claimObservedAppTask(f.config, {
      taskId: live.taskId,
      appAgent: "owner",
      handler: "auto",
      execution: { recipient: () => recipient, lane: "background" },
    }).kind,
  ).toBe("claimed");
  const queued: string[] = [];
  const scheduler = new AppTaskRecoveryScheduler({
    source: f.tasks,
    pageSize: 1,
    executionCandidates: (limit, after) => taskExecutionRecoveryPage(f.db, "sample", limit, after),
    enqueue: (id) => queued.push(id),
  });
  try {
    scheduler.recover();
    expect(queued).not.toContain("work");
    scheduler.recover();
    expect(queued).toContain("work");
    expect(recoverDeadTaskExecution(f.db, { appId: "sample", taskId: "work" })).toBe(1);
    expect(taskExecutionRecoveryPage(f.db, "sample", 1, live.taskId).taskIds).toEqual([]);
    expect(new TaskExecutionStore(f.db).usage({ kind: "host" }).occupied).toBe(1);
  } finally {
    scheduler.close();
  }
});

test("running-without-attempt repair cannot discard unconfirmed execution ownership", async () => {
  const f = await workerFixture(true);
  const task = f.tasks.readTask("work")!;
  const attemptId = task.status.currentAttemptId!;
  // Model retained resource damage while its real worker is still alive.
  f.db.prepare("DELETE FROM app_task_attempts WHERE app_id = ? AND attempt_id = ?").run("sample", attemptId);
  expect(repairRunningAppTasksWithoutAttempt(f.config, ["work"])).toEqual([]);
  expect(claimObservedAppTask(f.config, { taskId: "work", appAgent: "owner", handler: "auto" }).kind).toBe("busy");
  expect(f.tasks.readTask("work")?.status.currentAttemptId).toBe(attemptId);
});

test("a dead owner's reservation is recovered even when its Task has ended", async () => {
  const f = await workerFixture(false);
  expect(f.tasks.isCancelled("work")).toBe(true);
  const bus = new EventBus();
  const manager = new SubagentManager({ persistDir: f.root, bus });
  manager.register({
    name: "owner",
    hostIdentity: recipient.id,
    description: "Fixture owner",
    domain: "test",
    systemPrompt: "Inspect facts",
    model: fakeModel(),
    tools: [],
  });
  let executions = 0;
  const run = (taskId: string) =>
    runTaskAttempt({
      taskId,
      descriptor: {
        id: "sample",
        appDir: f.config.appDir,
        projectDir: f.root,
        agent: "owner",
        resourceStore: f.tasks,
        reconciliationPaused: false,
        app: defineApp({ id: "sample", version: 1, agent: "owner", inputSchema: Type.Object({}), tasks: {} }),
      },
      opts: {
        projectRoot: f.root,
        projectsRoot: f.root,
        persistDir: f.root,
        agentsRoot: f.root,
        sharedRoot: join(f.root, "shared"),
        bus,
        hostCapacity: new HostCapacity(4),
        agents: createTaskAgentRunner({ manager }).snapshot(),
        executors: {
          inspect: async () => {
            executions++;
            return { state: "converged", summary: "Facts retained", facts: [] };
          },
        },
      },
      dispatch: { lane: "normal", enqueuedAt: Date.now(), startedAt: Date.now(), readyWaitMs: 0 },
      reportTiming: () => {},
    });
  const queued: string[] = [];
  const scheduler = new AppTaskRecoveryScheduler({
    source: f.tasks,
    executionCandidates: (limit, after) => taskExecutionRecoveryPage(f.db, "sample", limit, after),
    enqueue: (taskId) => queued.push(taskId),
  });
  try {
    scheduler.recover();
  } finally {
    scheduler.close();
  }
  expect(queued).toContain("work");
  // Ordinary dispatch performs cleanup even though this Task has ended.
  await run("work");
  expect(f.tasks.isCancelled("work")).toBe(true);
  await run("next");
  expect(executions).toBe(1);
  expect(new TaskExecutionStore(f.db).usage({ kind: "host" }).occupied).toBe(0);
});

test("the installed paused runtime dispatches ended-Task cleanup without starting or charging business work", async () => {
  const f = await workerFixture(false);
  f.tasks.setProjectLifecycle("paused");
  const bus = new EventBus();
  const done = Promise.withResolvers<void>();
  const starts: string[] = [];
  const base = {
    projectRoot: f.root,
    projectsRoot: f.root,
    persistDir: f.root,
    bus,
    syncReadModels: false,
    hostCapacity: new HostCapacity(2),
  };
  const charged = f.db.prepare("SELECT count(*) AS n FROM task_budget_operations").get();
  try {
    await installAppTaskRuntimes(
      {
        ...base,
        appRegistrySnapshot: {
          id: "fixture:recovery",
          generation: 1,
          entries: [
            {
              appDir: f.config.appDir,
              definition: defineApp({
                id: "sample",
                version: 1,
                agent: "owner",
                inputSchema: Type.Object({}),
                tasks: {},
              }),
            },
          ],
        },
        executeAttempt: async (input) => {
          try {
            starts.push(input.taskId);
            return await reconcileLoadedAppTaskOnce({ bus, ...input });
          } finally {
            done.resolve();
          }
        },
      },
      { deferRecovery: true },
    );
    await done.promise;
    expect(starts).toEqual(["work"]);
    expect(new TaskExecutionStore(f.db).usage({ kind: "host" }).occupied).toBe(0);
    expect(f.tasks.isCancelled("work")).toBe(true);
    expect(f.tasks.readTask("next")?.status.phase).toBe("pending");
    expect(f.db.prepare("SELECT count(*) AS n FROM task_budget_operations").get()).toEqual(charged);
  } finally {
    await closeInstalledAppTaskRuntimes(bus);
  }
});

test("runtime removal cannot orphan unconfirmed execution after every business Task ends", async () => {
  const f = await workerFixture(true);
  for (const taskId of ["work", "next"]) {
    const task = f.tasks.readTask(taskId)!;
    cancelAppTask(f.config, {
      appId: "sample",
      taskId,
      expectedGeneration: task.metadata.generation,
      expectedResourceVersion: task.metadata.resourceVersion,
      reason: "Withdrawn",
    });
  }
  const bus = new EventBus();
  const gate = Promise.withResolvers<void>();
  const base = {
    projectRoot: f.root,
    projectsRoot: f.root,
    persistDir: f.root,
    bus,
    syncReadModels: false,
    hostCapacity: new HostCapacity(2),
    startAfter: gate.promise,
  };
  try {
    await installAppTaskRuntimes(
      {
        ...base,
        appRegistrySnapshot: {
          id: "fixture:present",
          generation: 1,
          entries: [
            {
              appDir: f.config.appDir,
              definition: defineApp({
                id: "sample",
                version: 1,
                agent: "owner",
                inputSchema: Type.Object({}),
                tasks: {},
              }),
            },
          ],
        },
      },
      { deferRecovery: true },
    );
    await expect(
      installAppTaskRuntimes(
        { ...base, appRegistrySnapshot: { id: "fixture:removed", generation: 2, entries: [] } },
        { deferRecovery: true },
      ),
    ).rejects.toThrow("unconfirmed Task execution");
    expect(new TaskExecutionStore(f.db).usage({ kind: "host" }).occupied).toBe(1);
  } finally {
    const closed = closeInstalledAppTaskRuntimes(bus);
    gate.resolve();
    await closed;
  }
});
