import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { execFile, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  Type,
  defineApp,
  taskAgentResultSchema,
  type AppDefinition,
  type AppInputContext,
  type TaskExecutor,
} from "@may-agent/sdk";
import { DbWriter } from "../../../lib/db-writer.js";
import { openDatabase } from "../../../lib/db.js";
import { EVENT_ROW_ID, EventBus, type AgentEvent } from "../events/bus.js";
import { startAppInboxRuntime } from "../../composition/app-inbox-runtime.js";
import { AppInboxHost } from "../inbox/app-inbox-host.js";
import { admitTaskRequest, attachRequestToTask } from "../state/inbox.js";
import { claimAppInboxItem, createAppInboxItem, listAppInboxItems, waitAppInboxClaim } from "../state/app-inbox-store.js";
import { AppRegistry } from "../apps/registry.js";
import { discoverAppDefinitions } from "../../adapters/discovery/app-definitions.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import { projectAppTaskReconciliationEvents, readAppTaskWaitPromptContext } from "./app-task-context.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  admitTaskAppDependencies,
  attachLoadedAppTask,
  cancelLoadedAppTask,
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes as installCoreTaskRuntimes,
  previewLoadedCanonicalAppTaskEvent,
  previewLoadedCanonicalAppTaskEventRoutes,
  readLoadedAppTaskView,
  readLoadedAppTaskInputResult,
  reconcileLoadedAppTaskOnce,
  recoverInstalledAppTasks,
  retryLoadedFailedAppTask,
} from "./app-task-runtime.js";
import { createTaskExecutionBackends } from "../../composition/task-execution.js";
import { createTaskSessionRecovery } from "../../adapters/executors/session-recovery.js";
import { createTaskAgentRunner } from "../../adapters/executors/managed-agent.js";
import type { TaskAgentRunner, TaskWorkflowRunner, TaskSessionRecovery } from "./execution.js";
import type { NormalizedTaskHandlerResult } from "./result.js";
import {
  applyCanonicalAgentResidueCleanup,
  beginCanonicalAgentResidueGuard,
  finishCanonicalAgentResidueGuard,
  planCanonicalAgentResidueCleanup,
  rejectConvergedDirectAgentResidue,
} from "../../adapters/executors/agent-workspace.js";

// These integration fixtures select the shipped backends explicitly.
// Boundary/absence tests below call installCoreTaskRuntimes directly.
function installAppTaskRuntimes(
  opts: Parameters<typeof installCoreTaskRuntimes>[0] & Parameters<typeof createTaskExecutionBackends>[0],
  recovery?: Parameters<typeof installCoreTaskRuntimes>[1],
) {
  const { manager, registerLocalAgent, drainPersistedBashProcessGroups, ...runtime } = opts;
  return installCoreTaskRuntimes(
    {
      ...createTaskExecutionBackends({ manager, registerLocalAgent, drainPersistedBashProcessGroups, ...runtime }),
      ...runtime,
    },
    recovery,
  );
}

import {
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  markAppTaskAttention,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  recordAppTaskAttemptSession,
  releaseStaleAppTaskResult,
  appTaskContext,
} from "./app-task-reconciler.js";
import { readTaskSnapshot, type AppTaskContext } from "./app-task-store.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { closeDb, getDb } from "../../../lib/requests.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { migrateTaskCompletionReceipts } from "../state/task-receipt-cutover.js";
import { appTaskTestContext as createTaskContext } from "./app-task-test-support.js";
import { projectRuntimePaths } from "./app-task-runtime-state.js";
import { HumanTaskService } from "../../human-task-service.js";
import {
  addSessionBashProcessGroup,
  readSessionBashProcessGroups,
  readSessionMeta,
  writeSessionMeta,
} from "../../../lib/persistence.js";

const roots: string[] = [];
const buses: EventBus[] = [];
const stores: AppTaskResourceStore[] = [];

function appTaskTestContext(input: Parameters<typeof createTaskContext>[0]) {
  const config = createTaskContext({ databasePath: ":memory:", ...input });
  stores.push(config.resourceStore);
  return config;
}

function eventBus(): EventBus {
  const bus = new EventBus();
  buses.push(bus);
  return bus;
}

/** Read the exact accepted attempt, independently of whether its Task is closed. */
function acceptedTaskAttempt(config: AppTaskContext, taskId: string) {
  const attemptId = config.resourceStore.readTask(taskId)?.status.observedAttemptId;
  return attemptId ? config.resourceStore.readAttempt(attemptId) : null;
}

function fixture() {
  const root = join(tmpdir(), `app-task-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  const projectsRoot = join(root, "projects");
  const appDir = join(projectsRoot, "sample.app");
  mkdirSync(join(appDir, "agents", "owner"), { recursive: true });
  mkdirSync(join(appDir, "tasks"), { recursive: true });
  writeFileSync(
    join(appDir, "tasks", "seed.json"),
    JSON.stringify({
      root_task_id: "root",
      groups: {
        root: {
          id: "root",
          parent_id: null,
          state: "backlog",
          agent: "sample-owner",
          children: ["operations"],
        },
        operations: {
          id: "operations",
          parent_id: "root",
          state: "backlog",
          children: [],
        },
      },
    }),
  );
  return { root, projectsRoot, appDir };
}

function definition(): AppDefinition {
  return defineApp({
    id: "sample",
    version: 1,
    agent: "sample-owner",
    inputSchema: Type.Object({}, { additionalProperties: true }),
    workspace: { kind: "local", localPath: "." },
    tasks: {
      subscriptions: ["sample.work"],
      resolve(event) {
        const itemId = String(event.data.itemId ?? "");
        return itemId
          ? {
              id: `work/${itemId}`,
              parentId: "operations",
              outcome: `Process ${itemId}`,
              acceptance: ["Work converges"],
              mode: "achieve",
              agent: "sample-owner",
            }
          : null;
      },
    },
  });
}

function options(f: ReturnType<typeof fixture>, bus: EventBus) {
  return {
    projectsRoot: f.projectsRoot,
    projectRoot: f.root,
    persistDir: join(f.root, "state"),
    manager: { hasAgent: () => true } as never,
    bus,
    hostCapacity: new HostCapacity(2),
  };
}

it("recovers legacy attention as the same Tasks without inventing App review input", async () => {
  const f = fixture();
  const persistDir = join(f.root, "state");
  let config = loadedTaskConfig(f);
  const legacyIds = ["work/legacy", "work/legacy-notified"];
  const taskIds = [...legacyIds, "work/domain-blocker"];
  for (const id of taskIds) {
    observeAppTaskIntent(config, {
      appAgent: "sample-owner",
      intent: {
        id,
        parentId: "operations",
        outcome: `Complete ${id}`,
        acceptance: ["Verified"],
        mode: "achieve",
        executor: "fixture",
      },
    });
    const claim = claimObservedAppTask(config, { taskId: id, appAgent: "sample-owner", handler: "executor:fixture" });
    if (claim.kind !== "claimed") throw new Error("expected fixture claim");
    markAppTaskAttention(config, claim, {
      reason: legacyIds.includes(id) ? "previous-runtime-attempt-not-recoverable" : "DomainDecisionRequired",
      summary: `Retained evidence for ${id}`,
    });
    const resource = config.resourceStore.readTask(id)!;
    const attempt = config.resourceStore.readAttempt(claim.attemptId)!;
    attempt.state = "interrupted";
    attempt.runtimeId = "previous-runtime";
    delete attempt.trigger;
    // Old notification metadata may still exist in persisted attempt JSON.
    if (id === "work/legacy-notified") Object.assign(attempt, { attentionNotifiedAt: "2020-01-01T00:00:00.000Z" });
    attempt.metadata.resourceVersion += 1;
    const resourceVersion = resource.metadata.resourceVersion;
    resource.metadata.resourceVersion += 1;
    resource.status.phase = "attention";
    delete resource.status.executionFailures;
    delete resource.status.executionRetryAt;
    expect(
      config.resourceStore.commit({
        fences: [{ taskId: id, resourceVersion, generation: resource.metadata.generation }],
        attempts: [attempt],
        tasks: [{ resource, ready: false }],
      }),
    ).toBe(true);
  }
  const before = readTaskSnapshot(config);
  closeDb(persistDir);

  const bus = eventBus();
  const writer = new DbWriter(persistDir);
  bus.setPersistenceSubscriber(writer.handler);
  bus.setDeliveryRecorder(writer.recordDelivery);
  const calls: string[] = [];
  await installCoreTaskRuntimes(
    {
      ...options(f, bus),
      installControllers: false,
      executors: {
        fixture: async ({ task }) => {
          calls.push(task.id);
          return { state: "converged", summary: "Recovered same work", evidence: ["fixture:verified"] };
        },
      },
      appRegistrySnapshot: {
        id: "legacy-attention-recovery",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    },
    { deferRecovery: true },
  );
  config = loadedTaskConfig(f);
  await recoverInstalledAppTasks(bus);
  const recovered = readTaskSnapshot(config);
  expect(Object.keys(recovered.resources ?? {}).sort()).toEqual(Object.keys(before.resources ?? {}).sort());
  expect(Object.keys(recovered.attempts ?? {}).sort()).toEqual(Object.keys(before.attempts ?? {}).sort());
  for (const id of legacyIds) {
    expect(recovered.resources?.[id]).toMatchObject({
      metadata: { id, generation: before.resources![id].metadata.generation },
      spec: before.resources![id].spec,
      status: { phase: "pending", summary: `Retained evidence for ${id}; retrying from current task evidence` },
    });
  }
  expect(recovered.resources?.["work/domain-blocker"]).toEqual(before.resources?.["work/domain-blocker"]);
  await recoverInstalledAppTasks(bus);
  expect(readTaskSnapshot(config)).toEqual(recovered);
  expect(
    getDb(persistDir)
      .prepare(
        "SELECT event_type FROM events WHERE event_type IN ('app.input.requested', 'project.task.recovery.repaired')",
      )
      .all(),
  ).toEqual([{ event_type: "project.task.recovery.repaired" }]);
  expect(calls).toEqual([]);
  for (const taskId of legacyIds) {
    const profiled = Promise.withResolvers<void>();
    const stop = bus.listen((event) => {
      if (event.type === "project.task.reconcile.profiled" && "data" in event && event.data.taskId === taskId)
        profiled.resolve();
    });
    try {
      await reconcileLoadedAppTaskOnce({
        bus,
        appId: "sample",
        taskId,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
      // Profiling is deferred; let its real persistence finish before closing the fixture DB.
      await profiled.promise;
    } finally {
      stop();
    }
    expect(readAcceptedRuntimeAttempt(config, taskId)).toMatchObject({
      taskGeneration: before.resources![taskId].metadata.generation,
      acceptedResult: { evidence: ["fixture:verified"] },
    });
    expect(config.resourceStore.isCancelled(taskId)).toBe(false);
  }
  expect(calls).toEqual(legacyIds);
});

it("keeps omitted workflows visible, continues unrelated work, and recovers with a supplied runner", async () => {
  const f = fixture();
  const bus = eventBus();
  const base = {
    projectsRoot: f.projectsRoot,
    projectRoot: f.root,
    persistDir: join(f.root, "state"),
    bus,
    hostCapacity: new HostCapacity(2),
    installControllers: false,
    appRegistrySnapshot: {
      id: "workflow-boundary:1",
      generation: 1,
      entries: [{ appDir: f.appDir, definition: definition() }],
    },
    executors: {
      fixture: async () => ({ state: "converged" as const, summary: "Independent work completed", evidence: [] }),
    },
  };
  await installCoreTaskRuntimes(base);
  const config = loadedTaskConfig(f);
  for (const [id, selection] of [
    ["work/workflow", { workflow: "verify" }],
    ["work/independent", { executor: "fixture" }],
  ] as const) {
    observeAppTaskIntent(config, {
      appAgent: "sample-owner",
      intent: {
        id,
        parentId: "operations",
        outcome: `Complete ${id}`,
        acceptance: ["Verified"],
        mode: "achieve",
        ...selection,
      },
    });
  }
  const run = (taskId: string) =>
    reconcileLoadedAppTaskOnce({
      bus,
      appId: "sample",
      taskId,
      dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
    });
  await run("work/workflow");
  const waiting = config.resourceStore.readTask("work/workflow")!;
  expect(waiting.status.phase).toBe("pending");
  expect(waiting.status.executionRetryAt).toBeGreaterThan(Date.now());
  expect(waiting.status.summary).toContain("workflow runner is not installed");
  const attempts = Object.values(readTaskSnapshot(config).attempts ?? {});
  expect(attempts).toHaveLength(1);
  await run("work/workflow");
  expect(Object.values(readTaskSnapshot(config).attempts ?? {})).toEqual(attempts);
  await run("work/independent");
  expect(readAcceptedRuntimeAttempt(config, "work/independent")?.acceptedResult?.summary).toBe(
    "Independent work completed",
  );

  let calls = 0;
  await installCoreTaskRuntimes({
    ...base,
    workflows: {
      async inspect({ workflow }) {
        expect(workflow).toBe("verify");
        return { available: true, error: null, workspace: "shared" };
      },
      async execute(input) {
        calls++;
        expect(input.attempt.task.id).toBe("work/workflow");
        expect(input.attempt.signal.aborted).toBeFalse();
        expect((await input.taskRead.get("work/workflow"))?.status).toBe("running");
        expect("resourceStore" in input.descriptor).toBeFalse();
        expect("manager" in input.source).toBeFalse();
        return {
          handlerResult: { state: "converged", summary: "Verified by supplied runner", evidence: [], actions: [] },
          runId: "fixture-run",
        };
      },
    },
  });
  expect(config.resourceStore.readTask("work/workflow")?.status.phase).toBe("pending");
  await run("work/workflow");
  expect(calls).toBe(0);
  advanceRuntimeTaskRetry(config, "work/workflow");
  await run("work/workflow");
  expect(calls).toBe(1);
  expect(readAcceptedRuntimeAttempt(config, "work/workflow")).toMatchObject({
    taskGeneration: waiting.metadata.generation,
    acceptedResult: { summary: "Verified by supplied runner" },
  });
  expect(
    Object.values(readTaskSnapshot(config).attempts ?? {}).find((a) => a.metadata.id === attempts[0]!.metadata.id),
  ).toEqual(attempts[0]);
});

it("retains an App and exact agent work when its agent capability is removed, then restores it", async () => {
  const f = fixture();
  const bus = eventBus();
  const base = {
    projectRoot: f.root,
    projectsRoot: f.projectsRoot,
    persistDir: join(f.root, "state"),
    bus,
    hostCapacity: new HostCapacity(2),
    installControllers: false,
    appRegistrySnapshot: {
      id: "agent-boundary:1",
      generation: 1,
      entries: [{ appDir: f.appDir, definition: definition() }],
    },
  };
  let calls = 0;
  const agents: TaskAgentRunner = {
    available: () => true,
    prepare: async () => true,
    role: (agent) => ({ agent, instructions: "Fixture role" }),
    snapshot: () => agents,
    async execute(input) {
      calls++;
      expect(input.attempt.role.instructions).toBe("Fixture role");
      expect(input.attempt.signal.aborted).toBeFalse();
      expect("resourceStore" in input.descriptor).toBeFalse();
      expect(input).not.toHaveProperty("claim");
      expect(input).not.toHaveProperty("intent");
      expect(input).not.toHaveProperty("declaredOutputPaths");
      expect(input.attempt.task.outcome).toBe("Keep accepted work");
      return {
        handlerResult: { state: "converged", summary: "Current goal verified", evidence: [], actions: [] },
        runId: null,
      };
    },
  };
  await installCoreTaskRuntimes({ ...base, agents });
  const config = loadedTaskConfig(f);
  const taskId = "work/agent-removed";
  observeAppTaskIntent(config, {
    appAgent: "sample-owner",
    intent: {
      id: taskId,
      parentId: "operations",
      outcome: "Keep accepted work",
      acceptance: ["Verified"],
      mode: "achieve",
    },
  });
  const removed = await installCoreTaskRuntimes(base);
  expect(removed.installed.map((app) => app.id)).toEqual(["sample"]);
  const run = () =>
    reconcileLoadedAppTaskOnce({
      bus,
      appId: "sample",
      taskId,
      dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
    });
  await run();
  expect(config.resourceStore.readTask(taskId)?.status.phase).toBe("pending");
  const attempts = Object.values(readTaskSnapshot(config).attempts ?? {});
  expect(attempts).toHaveLength(1);
  expect(attempts[0]?.failureReason).toBe("HandlerUnavailable");
  await run();
  expect(Object.values(readTaskSnapshot(config).attempts ?? {})).toEqual(attempts);
  expect(calls).toBe(0);
  await installCoreTaskRuntimes({ ...base, agents });
  expect(config.resourceStore.readTask(taskId)?.status.phase).toBe("pending");
  await run();
  expect(calls).toBe(0);
  advanceRuntimeTaskRetry(config, taskId);
  await run();
  expect(readAcceptedRuntimeAttempt(config, taskId)).toMatchObject({
    taskGeneration: 1,
    acceptedResult: { summary: "Current goal verified" },
  });
  expect(calls).toBe(1);
});

it("does not release an agent handoff until its required workflow verifier is available", async () => {
  const f = fixture();
  const bus = eventBus();
  let agentCalls = 0;
  let verified = 0;
  const agents: TaskAgentRunner = {
    available: () => true,
    prepare: async () => true,
    snapshot: () => agents,
    role: (agent) => ({ agent, instructions: "Fixture" }),
    async execute() {
      agentCalls++;
      return {
        handlerResult: { state: "converged", summary: "Agent proposes completion", evidence: [], actions: [] },
        runId: null,
      };
    },
  };
  const workflows: TaskWorkflowRunner = {
    async inspect() {
      return {
        available: true,
        error: null,
        workspace: "shared",
        verifier: {
          name: "required-proof",
          sourcePath: "fixture",
          verify: async () => {
            verified++;
            return { accepted: true, summary: "Postcondition verified", evidence: ["fixture:verified"] };
          },
        },
      };
    },
    async execute() {
      return {
        handlerResult: { state: "needs-agent", summary: "Agent judgment required", evidence: [], actions: [] },
        runId: "fixture-handoff",
      };
    },
  };
  const base = {
    projectsRoot: f.projectsRoot,
    projectRoot: f.root,
    persistDir: join(f.root, "state"),
    bus,
    hostCapacity: new HostCapacity(2),
    installControllers: false,
    agents,
    appRegistrySnapshot: {
      id: "handoff-boundary:1",
      generation: 1,
      entries: [{ appDir: f.appDir, definition: definition() }],
    },
  };
  await installCoreTaskRuntimes({ ...base, workflows });
  const config = loadedTaskConfig(f);
  const taskId = "work/handoff";
  observeAppTaskIntent(config, {
    appAgent: "sample-owner",
    intent: {
      id: taskId,
      parentId: "operations",
      outcome: "Verify before completion",
      acceptance: ["Required verifier passes"],
      mode: "achieve",
      workflow: "verify",
    },
  });
  const run = () =>
    reconcileLoadedAppTaskOnce({
      bus,
      appId: "sample",
      taskId,
      dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
    });
  await run();
  await installCoreTaskRuntimes(base);
  await run();
  expect(agentCalls).toBe(0);
  expect(config.resourceStore.readTask(taskId)?.status.phase).toBe("pending");
  await installCoreTaskRuntimes(base);
  expect(config.resourceStore.readTask(taskId)?.status.phase).toBe("pending");
  expect(config.resourceStore.readReceipt(taskId)).toBeNull();
  const before = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const withoutVerifier: TaskWorkflowRunner = {
    ...workflows,
    async inspect(input) {
      return { ...(await workflows.inspect(input)), verifier: undefined };
    },
  };
  await installCoreTaskRuntimes({ ...base, workflows: withoutVerifier });
  expect(config.resourceStore.readTaskContext({ taskIds: [taskId] })).toEqual(before);
  expect(agentCalls).toBe(0);
  expect(verified).toBe(0);
  await installCoreTaskRuntimes({ ...base, workflows });
  advanceRuntimeTaskRetry(config, taskId);
  await run();
  // A fresh workflow pass may re-establish its handoff after recovery.
  if (!readAcceptedRuntimeAttempt(config, taskId)?.acceptedResult) await run();
  expect(verified).toBe(1);
  expect(agentCalls).toBe(1);
  expect(readAcceptedRuntimeAttempt(config, taskId)?.acceptedResult?.acceptanceBasis.method).toBe("deterministic");
  expect(config.resourceStore.isCancelled(taskId)).toBe(false);
});

function activateTaskResources(config: AppTaskContext, persistDir: string, appId = "sample"): AppTaskContext {
  const tree = readTaskSnapshot(config);
  tree.project ||= appId;
  const finalLifecycle = tree.project_lifecycle === "paused" ? "paused" : "active";
  tree.project_lifecycle = "paused";
  const sourceRevision = `test:${appId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const staging = AppTaskResourceStore.fromDb(getDb(persistDir), appId);
  staging.bootstrapSnapshot(tree, sourceRevision);
  staging.setProjectLifecycle(finalLifecycle);
  const active = AppTaskResourceStore.activeFromDb(getDb(persistDir), appId);
  if (!active) throw new Error(`expected active resource store for ${appId}`);
  return appTaskContext({
    appDir: config.appDir,
    projectDir: config.projectDir,
    agent: config.agent,
    maxConcurrent: config.maxConcurrent,
    resourceStore: active,
  });
}

function loadedTaskConfig(f: ReturnType<typeof fixture>, persistDir = join(f.root, "state")) {
  const resourceStore = AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample");
  if (!resourceStore) {
    // Bootstrap the intended authority once, not a temporary DB plus a copy.
    return createTaskContext({
      appDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
      resourceStore: AppTaskResourceStore.fromDb(getDb(persistDir), "sample"),
    });
  }
  return appTaskContext({
    appDir: f.appDir,
    projectDir: f.appDir,
    agent: "sample-owner",
    maxConcurrent: 1,
    resourceStore,
  });
}

function readAcceptedRuntimeAttempt(config: AppTaskContext, taskId: string) {
  const id = config.resourceStore.readTask(taskId)?.status.observedAttemptId;
  return id ? config.resourceStore.readAttempt(id) : null;
}

function advanceRuntimeTaskRetry(config: AppTaskContext, taskId: string) {
  const deadline = config.resourceStore.readTask(taskId)!.status.executionRetryAt!;
  expect(deadline).toBeGreaterThan(Date.now());
  setSystemTime(new Date(deadline));
}

function mutateRuntimeAttemptFixture(
  config: ReturnType<typeof loadedTaskConfig>,
  taskId: string,
  attemptId: string,
  mutate: (attempt: NonNullable<ReturnType<typeof readTaskSnapshot>["attempts"]>[string]) => void,
): void {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  const attempt = tree.attempts?.[attemptId];
  if (!resource || !attempt) throw new Error("expected resource-backed attempt fixture");
  mutate(attempt);
  attempt.metadata.resourceVersion += 1;
  expect(
    config.resourceStore.commit({
      fences: [
        {
          taskId,
          resourceVersion: resource.metadata.resourceVersion,
          generation: resource.metadata.generation,
          currentAttemptId: attemptId,
        },
      ],
      attempts: [attempt],
    }),
  ).toBe(true);
}

afterEach(async () => {
  setSystemTime();
  await Promise.all(buses.splice(0).map((bus) => closeInstalledAppTaskRuntimes(bus)));
  for (const store of stores.splice(0)) store.close();
  for (const root of roots.splice(0)) {
    closeDb(join(root, "state"));
    closeDb(join(root, ".state"));
    rmSync(root, { recursive: true, force: true });
  }
});

function gitResidueFixture() {
  const root = join(tmpdir(), `app-task-residue-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "-b", "main", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Test"]);
  writeFileSync(join(root, "tracked.txt"), "tracked baseline\n");
  writeFileSync(join(root, "concurrent-index.txt"), "index baseline\n");
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "-m", "baseline"]);
  return root;
}

describe("canonical direct-agent residue cleanup", () => {
  it("restores agent file and index edits that remain unchanged since planning", async () => {
    const projectDir = gitResidueFixture();
    writeFileSync(join(projectDir, "preexisting.txt"), "preexisting baseline\n");
    const guard = await beginCanonicalAgentResidueGuard({ appDir: projectDir, projectDir, workspaceDir: projectDir });

    writeFileSync(join(projectDir, "tracked.txt"), "agent edit\n");
    writeFileSync(join(projectDir, "preexisting.txt"), "agent changed preexisting\n");
    writeFileSync(join(projectDir, "created.txt"), "agent created\n");
    execFileSync("git", ["-C", projectDir, "add", "tracked.txt"]);

    const plan = await planCanonicalAgentResidueCleanup(guard);
    const restored = await applyCanonicalAgentResidueCleanup(plan);

    expect(restored).toContain("file:tracked.txt");
    expect(restored).toContain("file:preexisting.txt");
    expect(restored).toContain("file:created.txt");
    expect(restored).toContain("index");
    expect(readFileSync(join(projectDir, "tracked.txt"), "utf8")).toBe("tracked baseline\n");
    expect(readFileSync(join(projectDir, "preexisting.txt"), "utf8")).toBe("preexisting baseline\n");
    expect(existsSync(join(projectDir, "created.txt"))).toBe(false);
    expect(execFileSync("git", ["-C", projectDir, "status", "--porcelain"], { encoding: "utf8" })).toBe(
      "?? preexisting.txt\n",
    );
  });

  it("preserves concurrent file and index edits while applying other planned cleanup", async () => {
    const projectDir = gitResidueFixture();
    const guard = await beginCanonicalAgentResidueGuard({ appDir: projectDir, projectDir, workspaceDir: projectDir });

    writeFileSync(join(projectDir, "tracked.txt"), "agent edit\n");
    writeFileSync(join(projectDir, "created.txt"), "agent created\n");
    execFileSync("git", ["-C", projectDir, "add", "tracked.txt"]);
    const plan = await planCanonicalAgentResidueCleanup(guard);

    writeFileSync(join(projectDir, "tracked.txt"), "concurrent file edit\n");
    writeFileSync(join(projectDir, "concurrent-index.txt"), "concurrent index edit\n");
    execFileSync("git", ["-C", projectDir, "add", "concurrent-index.txt"]);
    const restored = await applyCanonicalAgentResidueCleanup(plan);

    expect(restored).toEqual(["file:created.txt"]);
    expect(readFileSync(join(projectDir, "tracked.txt"), "utf8")).toBe("concurrent file edit\n");
    expect(execFileSync("git", ["-C", projectDir, "diff", "--cached", "--name-only"], { encoding: "utf8" })).toBe(
      "concurrent-index.txt\ntracked.txt\n",
    );
  });

  it("rejects only converged direct-agent results whose edits were restored", async () => {
    const converged = {
      state: "converged" as const,
      summary: "claimed convergence",
      evidence: ["agent-result"],
      actions: [],
    };
    expect(rejectConvergedDirectAgentResidue(converged, ["file:tracked.txt"])).toMatchObject({
      state: "error",
      evidence: ["agent-result", "agent-residue-restored:file:tracked.txt"],
    });
    expect(rejectConvergedDirectAgentResidue(converged, [])).toBe(converged);

    const worktree = join(projectDirForBypass(), "workflow-output.txt");
    writeFileSync(worktree, "mutation-capable output\n");
    expect(await finishCanonicalAgentResidueGuard(null)).toEqual([]);
    expect(readFileSync(worktree, "utf8")).toBe("mutation-capable output\n");
  });
});

describe("App Task persisted prompt context", () => {
  it("shows the executor the exact accepted wait before it judges feedback", () => {
    const f = fixture();
    const persistDir = join(f.root, "state");
    const config = loadedTaskConfig(f, persistDir);
    const taskIntent = {
      id: "work/focused-feedback",
      parentId: "operations",
      outcome: "Resolve the human concern on this Task",
      acceptance: ["The concern is resolved"],
      mode: "achieve" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent: taskIntent, appAgent: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: taskIntent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    createAppInboxItem(getDb(persistDir), {
      id: "existing-proof",
      appId: "gym",
      source: { kind: "app", id: "sample" },
      input: { kind: "probe", data: { value: "compare current behavior" } },
      now: 1,
    });
    const dependencyClaim = claimAppInboxItem(getDb(persistDir), "existing-proof", "gym", 1_000, 2);
    if (!dependencyClaim) throw new Error("expected dependency claim");
    expect(
      waitAppInboxClaim(
        getDb(persistDir),
        dependencyClaim,
        { kind: "task", id: "runtime/regression-run/existing-proof" },
        { now: 3 },
      ),
    ).toBe(true);
    expect(
      deferAppTask(config, claim, {
        disposition: "waiting",
        summary: "Gym is comparing current behavior",
        evidence: ["comparison requested"],
        conditions: [
          {
            id: "app-request:existing-proof",
            type: "app.dependency.completed",
            subject: "id:existing-proof",
            expected: { field: "status", equals: "done" },
            owner: "app:gym",
            reviewAfterMs: 300_000,
          },
        ],
      }),
    ).toMatchObject({ status: "applied" });
    const resourceStore = config.resourceStore;

    expect(readAppTaskWaitPromptContext(resourceStore, getDb(persistDir), taskIntent.id)).toMatchObject({
      open: [
        {
          conditionId: "app-request:existing-proof",
          type: "app.dependency.completed",
          state: "unknown",
          dependency: {
            requestId: "existing-proof",
            appId: "gym",
            status: "handling",
            resolvedTaskId: "runtime/regression-run/existing-proof",
          },
        },
      ],
    });
  });
});

function projectDirForBypass(): string {
  const root = join(tmpdir(), `app-task-workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  roots.push(root);
  mkdirSync(root, { recursive: true });
  return root;
}

describe("canonical App task runtime", () => {
  it("rejects a dependency that is not accepted by the installed App contract", () => {
    const f = fixture();
    const bus = eventBus();
    const config = loadedTaskConfig(f);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/invalid-owner",
        parentId: "operations",
        outcome: "Choose one installed accountable App",
        acceptance: ["The target accepts the typed input"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/invalid-owner",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const target = defineApp({
      id: "evaluation",
      version: 1,
      agent: "evaluator",
      inputSchema: Type.Object({
        kind: Type.Literal("owner-review"),
        data: Type.Record(Type.String(), Type.Unknown()),
      }),
      task: () => ({
        kind: "desired" as const,
        intent: {
          id: "review",
          parentId: "evaluation",
          outcome: "Review evidence",
          acceptance: ["Reviewed"],
          mode: "achieve" as const,
        },
      }),
      tasks: {},
    });
    const opts = {
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "dependency:1",
        generation: 1,
        entries: [{ appDir: join(f.projectsRoot, "evaluation.app"), definition: target }],
      },
    };

    expect(() =>
      admitTaskAppDependencies({
        opts,
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: true,
        },
        claim,
        dependencies: [{ id: "review", appId: "evaluation", input: { kind: "invented", data: {} } }],
      }),
    ).toThrow("input is not accepted by installed App evaluation");
  });

  it("rejects a dependency when the configured registry has no target Apps", () => {
    const f = fixture();
    const bus = eventBus();
    const config = loadedTaskConfig(f);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/missing-owner",
        parentId: "operations",
        outcome: "Use one installed accountable App",
        acceptance: ["The target is installed"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/missing-owner",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");

    expect(() =>
      admitTaskAppDependencies({
        opts: {
          ...options(f, bus),
          appRegistrySnapshot: { id: "empty:1", generation: 1, entries: [] },
        },
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: true,
        },
        claim,
        dependencies: [{ id: "review", appId: "evaluation", input: { kind: "review", data: {} } }],
      }),
    ).toThrow("targets unavailable App evaluation");
  });

  it("does not publish a dependency requested from a stale task result", () => {
    const f = fixture();
    const bus = eventBus();
    const config = activateTaskResources(
      appTaskTestContext({
        appDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
      }),
      join(f.root, "state"),
    );
    const resourceStore = config.resourceStore;
    observeAppTaskIntent(config, {
      intent: {
        id: "work/stale-dependency",
        parentId: "operations",
        outcome: "Use current evidence before requesting review",
        acceptance: ["Only a current result can request review"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/stale-dependency",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    recordAppTaskTrigger(config, claim.taskId, {
      type: "app.dependency.completed",
      eventId: 42,
      data: { kind: "app", id: "earlier-review" },
    });

    const emitted: AgentEvent[] = [];
    bus.subscribe((event) => emitted.push(event));
    expect(() =>
      admitTaskAppDependencies({
        opts: options(f, bus),
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: true,
          resourceStore,
        },
        claim,
        dependencies: [
          {
            id: "new-review",
            appId: "evaluation",
            input: { kind: "deep-scan", data: { reason: "stale-snapshot" } },
          },
        ],
      }),
    ).toThrow("newer Task evidence is pending");
    expect(emitted.filter((event) => event.type === "app.input.requested")).toEqual([]);
    expect(readTaskSnapshot(config).taskTriggers?.[claim.taskId]?.event).toMatchObject({ eventId: 42 });
  });

  it("accepts a recovered frozen Condition route after its task has already left the wait", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    writeFileSync(
      join(f.appDir, "app.js"),
      `export default {
        id: "sample", version: 1, agent: "sample-owner",
        inputSchema: { type: "object", properties: {} },
        tasks: {}
      };\n`,
    );
    activateTaskResources(
      appTaskTestContext({
        appDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
        lifecycle: "paused",
      }),
      persistDir,
    );
    const registry = new AppRegistry(discoverAppDefinitions(f.projectsRoot));
    await registry.reload();
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: registry.snapshot(),
    });

    expect(
      admitLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: { type: "pipeline-run.state", data: { pipelineRunId: "42", state: "completed" } },
        intent: null,
        conditionTaskIds: ["retired-task"],
      }),
    ).toMatchObject({
      accepted: true,
      route: "direct",
      note: expect.stringContaining("already observed: retired-task"),
    });
  });

  it("preserves event time through Runtime preview so stale level observations stay blocked", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const config = loadedTaskConfig(f, persistDir);
    const intent = {
      id: "work/credential",
      parentId: "operations",
      outcome: "Wait for a fresh credential observation",
      acceptance: ["A fresh ready observation is received"],
      mode: "maintain" as const,
    };
    const observed = observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    if (observed.kind === "completed") throw new Error("expected observed task");
    const claim = claimObservedAppTask(config, {
      taskId: observed.taskId,
      appAgent: "sample-owner",
      handler: "owner:sample-owner",
    });
    if (claim.kind !== "claimed") throw new Error("expected claimed task");
    deferAppTask(config, claim, {
      disposition: "waiting",
      summary: "Waiting for credential readiness",
      conditions: [
        {
          id: "credential-ready:xhs",
          type: "credential.state",
          subject: "credential:xhs",
          expected: { field: "state", equals: "ready" },
          owner: "app:credential-provider",
          reviewAfterMs: 300_000,
        },
      ],
    });
    const establishedAt = Date.parse(
      readTaskSnapshot(config).conditions?.["credential-ready:xhs"]?.status.observedAt ?? "",
    );
    expect(Number.isFinite(establishedAt)).toBeTrue();
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: {
        id: "boot:condition-time",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    const observation = (timestamp: number): AgentEvent => ({
      type: "credential.state",
      timestamp,
      data: { credential: "xhs", state: "ready" },
    });
    expect(
      previewLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: observation(establishedAt - 1),
      }),
    ).toEqual([]);
    expect(
      previewLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: observation(establishedAt + 1),
      }),
    ).toEqual([intent.id]);
  });

  it.each(["event", "recovery"])("returns the exact cross-App answer after a later Task cycle through %s", async (wake) => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const evaluationDir = join(f.projectsRoot, "evaluation.app");
    mkdirSync(join(evaluationDir, "tasks"), { recursive: true });
    writeFileSync(
      join(evaluationDir, "tasks", "seed.json"),
      JSON.stringify({
        root_task_id: "root",
        groups: {
          root: { id: "root", parent_id: null, state: "backlog", agent: "evaluator", children: [] },
        },
      }),
    );
    writeFileSync(
      join(f.appDir, "app.js"),
      `export default {
        id: "sample", version: 1, agent: "sample-owner",
        inputSchema: { type: "object", properties: {} },
        tasks: {}
      };\n`,
    );
    writeFileSync(
      join(evaluationDir, "app.js"),
      `export default {
        id: "evaluation", version: 1, owner: "evaluator",
        inputSchema: {
          type: "object", additionalProperties: false, required: ["kind", "data"],
          properties: {
            kind: { const: "deep-scan" },
            data: { type: "object", additionalProperties: false, required: ["reason"], properties: { reason: { type: "string" } } }
          }
        },
        task(input) {
          return {
            kind: "desired",
            intent: {
              id: "review/" + input.id,
              parentId: "root",
              outcome: "Complete independent review",
              acceptance: ["Review accepted"],
              mode: "achieve"
            }
          };
        },
        tasks: {}
      };\n`,
    );

    activateTaskResources(
      appTaskTestContext({
        appDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
        lifecycle: "active",
      }),
      persistDir,
    );

    const registry = new AppRegistry(discoverAppDefinitions(f.projectsRoot));
    await registry.reload();
    const evaluationSourceConfig = appTaskTestContext({
      appDir: evaluationDir,
      agent: "evaluator",
      maxConcurrent: 1,
      lifecycle: "active",
      appId: "evaluation",
    });
    const evaluationConfig = activateTaskResources(evaluationSourceConfig, persistDir, "evaluation");
    observeAppTaskIntent(evaluationConfig, {
      intent: {
        id: "review/current",
        parentId: "root",
        outcome: "Review the current evidence",
        acceptance: ["The accepted human decision is applied"],
        mode: "achieve",
        agent: "evaluator",
      },
      appAgent: "evaluator",
    });
    const waitingTarget = claimObservedAppTask(evaluationConfig, {
      taskId: "review/current",
      appAgent: "evaluator",
      handler: "agent:evaluator",
      reason: "await-human-decision",
    });
    if (waitingTarget.kind !== "claimed") throw new Error("expected target Task claim");
    deferAppTask(evaluationConfig, waitingTarget, {
      disposition: "waiting",
      summary: "Waiting for the human decision",
      conditions: [
        {
          id: "original-decision",
          type: "session.end",
          subject: "session:original-decision",
          expected: "done",
          owner: "human:operator",
          reviewAfterMs: 300_000,
        },
      ],
    });
    const startGate = Promise.withResolvers<void>();
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: registry.snapshot(),
      // Drive claims explicitly while retaining the real admission/result routes.
      startAfter: startGate.promise,
    });

    const db = getDb(persistDir);
    const dependencyEvents: Array<Record<string, unknown>> = [];
    const dependencyUpdateEvents: Array<Record<string, unknown>> = [];
    const dependencyRequests: Array<Record<string, unknown>> = [];
    const conditionPreviews: string[][] = [];
    bus.setPersistenceSubscriber((event) => {
      const row = db
        .prepare("INSERT INTO events(event_type, data, timestamp) VALUES (?, ?, ?)")
        .run(event.type, JSON.stringify(event.data), Date.now());
      Object.defineProperty(event, EVENT_ROW_ID, { value: Number(row.lastInsertRowid), configurable: true });
    });
    bus.subscribe((event) => {
      if (event.type === "app.input.requested") {
        dependencyRequests.push(event as unknown as Record<string, unknown>);
      }
      if (event.type === "app.dependency.completed" && event.data.kind === "app") {
        dependencyEvents.push(event as unknown as Record<string, unknown>);
      }
      if (event.type === "app.dependency.updated" && event.data.kind === "app") {
        dependencyUpdateEvents.push(event as unknown as Record<string, unknown>);
      }
    });
    let attachedDependencyTaskId: string | undefined;
    let attachedDependencyTaskCount = 0;
    const inbox = await startAppInboxRuntime({
      registry,
      db,
      bus,
      hostCapacity: new HostCapacity(2),
      attachTask: async (input) => {
        const taskId = input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id;
        const result = attachLoadedAppTask({ ...input, bus });
        attachedDependencyTaskId ??= taskId;
        attachedDependencyTaskCount += 1;
        return result;
      },
      readDependency: createAppTaskCapability({ bus }).readDependency,
      previewTaskEvent: ({ appId, event, targetedTaskId }) => {
        const taskIds = previewLoadedCanonicalAppTaskEvent({ bus, appId, event, targetedTaskId });
        if (event.type === "app.dependency.completed") conditionPreviews.push(taskIds);
        return taskIds;
      },
      previewTaskEventRoutes: ({ event }) => {
        const routes = previewLoadedCanonicalAppTaskEventRoutes({ bus, event });
        if (event.type === "app.dependency.completed") {
          conditionPreviews.push(routes.flatMap((route) => route.taskIds));
        }
        return routes;
      },
      admitTaskEvent: ({ appId, event, intent, targetedTaskId, conditionTaskIds }) =>
        admitLoadedCanonicalAppTaskEvent({ bus, appId, event, intent, targetedTaskId, conditionTaskIds }),
      scanIntervalMs: 10_000,
    });

    try {
      const sampleStore = AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample");
      if (!sampleStore) throw new Error("expected sample resource authority");
      const config = appTaskContext({
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
        resourceStore: sampleStore,
      });
      observeAppTaskIntent(config, {
        intent: {
          id: "work/cross-app-roundtrip",
          parentId: "operations",
          outcome: "Use one independent review",
          acceptance: ["The review result is considered"],
          mode: "achieve",
          agent: "sample-owner",
        },
        appAgent: "sample-owner",
      });
      const initial = claimObservedAppTask(config, {
        taskId: "work/cross-app-roundtrip",
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "test",
      });
      if (initial.kind !== "claimed") throw new Error("expected initial claim");
      const descriptor = {
        id: "sample",
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        app: definition(),
        reconciliationPaused: false,
        resourceStore: sampleStore,
      };
      const conditions = admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim: initial,
        dependencies: [
          {
            id: "review",
            appId: "evaluation",
            taskId: "review/current",
            input: { kind: "deep-scan", data: { reason: "parent-needs-review" } },
          },
        ],
      });
      expect(
        deferAppTask(config, initial, {
          disposition: "waiting",
          summary: "Waiting for the independent review",
          conditions,
        }).status,
      ).toBe("applied");

      const requestId = conditions[0]!.subject.slice("id:".length);
      const attachmentDeadline = Date.now() + 5_000;
      while (!attachedDependencyTaskId && Date.now() < attachmentDeadline) await Bun.sleep(5);
      if (!attachedDependencyTaskId) throw new Error("expected child App request to attach to a Task");
      expect(attachedDependencyTaskId).toBe("review/current");
      expect(readTaskSnapshot(evaluationConfig).taskTriggers?.["review/current"]?.event).toMatchObject({
        type: "app.task.requested",
        data: {
          taskId: "review/current",
          request: {
            input: { kind: "deep-scan", data: { reason: "parent-needs-review" } },
          },
        },
      });
      expect(
        Object.keys(readTaskSnapshot(evaluationConfig).resources ?? {}).filter((id) => id.startsWith("review/")),
      ).toEqual(["review/current"]);
      createAppInboxItem(getDb(persistDir), {
        id: requestId,
        appId: "evaluation",
        targetTaskId: "review/current",
        source: { kind: "app", id: "sample" },
        input: { kind: "deep-scan", data: { reason: "parent-needs-review" } },
      });

      expect(
        recordAppTaskTrigger(config, initial.taskId, {
          type: "message.created",
          data: { message: "Review the current dependency without replacing it" },
        }),
      ).toEqual({ kind: "recorded" });
      const checkpointReview = claimObservedAppTask(config, {
        taskId: initial.taskId,
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "checkpoint-review",
      });
      if (checkpointReview.kind !== "claimed") throw new Error("expected checkpoint review claim");
      const reused = admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim: checkpointReview,
        existingConditions: conditions,
        dependencies: [
          {
            id: requestId,
            appId: "evaluation",
            taskId: "review/current",
            input: { kind: "deep-scan", data: { reason: "parent-needs-review " } },
          },
        ],
      });
      expect(reused).toEqual(conditions);
      expect(
        deferAppTask(config, checkpointReview, {
          disposition: "waiting",
          summary: "The original independent review remains in progress",
          conditions: reused,
        }).status,
      ).toBe("applied");
      expect(readTaskSnapshot(config).resources?.[initial.taskId]?.status.conditionIds).toEqual([conditions[0]!.id]);
      await Bun.sleep(10);
      expect(dependencyRequests).toHaveLength(1);
      expect(attachedDependencyTaskCount).toBe(1);

      expect(
        recordAppTaskTrigger(config, initial.taskId, {
          type: "message.created",
          data: { message: "Add one distinct second review" },
        }),
      ).toEqual({ kind: "recorded" });
      const expandedReview = claimObservedAppTask(config, {
        taskId: initial.taskId,
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "second-review-requested",
      });
      if (expandedReview.kind !== "claimed") throw new Error("expected expanded review claim");
      const expanded = admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim: expandedReview,
        existingConditions: conditions,
        dependencies: [
          {
            id: requestId,
            appId: "evaluation",
            taskId: "review/current",
            input: { kind: "deep-scan", data: { reason: "parent-needs-review " } },
          },
          {
            id: "second-independent-review",
            appId: "evaluation",
            input: { kind: "deep-scan", data: { reason: "a-distinct-review" } },
          },
        ],
      });
      expect(expanded[0]).toEqual(conditions[0]);
      expect(expanded[1]?.subject).not.toBe(conditions[0]?.subject);
      expect(
        deferAppTask(config, expandedReview, {
          disposition: "waiting",
          summary: "Waiting for both independent reviews",
          conditions: expanded,
        }).status,
      ).toBe("applied");
      const secondAttachmentDeadline = Date.now() + 5_000;
      while (attachedDependencyTaskCount < 2 && Date.now() < secondAttachmentDeadline) await Bun.sleep(5);
      expect(dependencyRequests).toHaveLength(2);
      expect(attachedDependencyTaskCount).toBe(2);

      const firstDependencyReadyDeadline = Date.now() + 5_000;
      while (!inbox.host.get(requestId)?.waitingOn && Date.now() < firstDependencyReadyDeadline) await Bun.sleep(5);
      expect(inbox.host.get(requestId)).toMatchObject({
        status: "handling",
        waitingOn: { kind: "task", id: attachedDependencyTaskId },
      });

      bus.emit({
        type: "app.dependency.updated",
        source: "test:evaluation-task",
        owner: "app:evaluation",
        data: { kind: "task", id: attachedDependencyTaskId, appId: "evaluation" },
      });
      const progressDeadline = Date.now() + 5_000;
      while (!readTaskSnapshot(config).taskTriggers?.[initial.taskId] && Date.now() < progressDeadline) {
        await Bun.sleep(5);
      }
      expect(dependencyUpdateEvents).toContainEqual(
        expect.objectContaining({
          data: expect.objectContaining({ kind: "app", id: requestId, appId: "sample" }),
        }),
      );
      const progressReview = claimObservedAppTask(config, {
        taskId: initial.taskId,
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "dependency-progress",
      });
      if (progressReview.kind !== "claimed") {
        throw new Error(`expected progress review claim, got ${progressReview.kind}`);
      }
      expect(progressReview.events).toHaveLength(1);
      expect(progressReview.events[0]?.event).toMatchObject({
        type: "app.dependency.updated",
        data: { kind: "app", id: requestId },
      });
      expect(
        deferAppTask(config, progressReview, {
          disposition: "waiting",
          summary: "The linked reviews remain in progress",
          conditions: expanded,
        }).status,
      ).toBe("applied");

      const resumedTarget = claimObservedAppTask(evaluationConfig, {
        taskId: attachedDependencyTaskId,
        appAgent: "evaluator",
        handler: "agent:evaluator",
        reason: "typed-human-feedback",
      });
      if (resumedTarget.kind !== "claimed") throw new Error(`expected resumed target claim, got ${resumedTarget.kind}`);
      expect(resumedTarget.events).toHaveLength(1);
      expect(resumedTarget.events[0]?.event).toMatchObject({
        type: "app.task.requested",
        data: {
          request: { input: { kind: "deep-scan", data: { reason: "parent-needs-review" } } },
        },
      });
      completeAppTask(evaluationConfig, resumedTarget, {
        summary: "Independent review completed",
        response: "The dependency result is ready for the parent.",
        result: { disposition: "accepted", score: 0.92 },
        evidence: ["review:accepted"],
      });
      // The original caller has not read its answer yet. Reuse the same Task
      // and prove that neither its latest result nor its retained wait replaces it.
      admitTaskRequest(evaluationConfig, {
        appId: "evaluation", attachment: { kind: "existing", taskId: attachedDependencyTaskId },
        idempotencyKey: "task:later-input",
        request: { id: "later-input", source: { kind: "app", id: "another-caller" },
          input: { kind: "deep-scan", data: { reason: "a later independent question" } } },
      });
      const later = claimObservedAppTask(evaluationConfig, { taskId: attachedDependencyTaskId,
        appAgent: "evaluator", handler: "agent:evaluator" });
      if (later.kind !== "claimed") throw new Error("Expected later input claim");
      completeAppTask(evaluationConfig, later, { summary: "Later result", result: { score: 0.1 }, evidence: ["later:0.1"] });
      expect(readLoadedAppTaskView({ bus, appDir: evaluationDir, taskId: attachedDependencyTaskId })).toMatchObject({
        status: "waiting", result: { score: 0.1 },
      });
      if (wake === "event") bus.emit({
          type: "app.dependency.completed", source: "test:evaluation-task", owner: "app:evaluation",
          data: { kind: "task", id: attachedDependencyTaskId },
        });
      else {
        const recovered = await inbox.host.recoverTaskDependencies();
        expect(recovered.woken).toBe(1);
        inbox.scanNow();
      }
      const deadline = Date.now() + 5_000;
      while (!readTaskSnapshot(config).taskTriggers?.[initial.taskId] && Date.now() < deadline) {
        await Bun.sleep(5);
      }
      expect(dependencyEvents).toHaveLength(1);
      expect(conditionPreviews).toContainEqual([initial.taskId]);
      expect(inbox.host.get(requestId)).toMatchObject({
        status: "done",
        result: {
          summary: "Independent review completed",
          response: "The dependency result is ready for the parent.",
          result: { disposition: "accepted", score: 0.92 },
          evidence: ["review:accepted"],
        },
      });

      const resumed = claimObservedAppTask(config, {
        taskId: initial.taskId,
        appAgent: "sample-owner",
        handler: "agent:sample-owner",
        reason: "dependency-completed",
      });
      if (resumed.kind !== "claimed") throw new Error(`expected resumed claim, got ${resumed.kind}`);
      expect(resumed.events).toHaveLength(1);
      expect(resumed.events[0]?.event).toMatchObject({
        type: "app.dependency.completed",
        data: {
          kind: "app",
          id: requestId,
          status: "done",
          summary: "Independent review completed",
          response: "The dependency result is ready for the parent.",
          result: { disposition: "accepted", score: 0.92 },
          evidence: ["review:accepted"],
        },
      });
    } finally {
      inbox.close();
      const drained = closeInstalledAppTaskRuntimes(bus);
      startGate.resolve();
      await drained;
      // The runtime and inbox share the Host connection; fixture cleanup owns it.
    }
  });

  it("adds distinct work for the same App without replaying retained waits, including after restart", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const taskId = "work/two-reviews";
    const admissions: string[] = [];
    bus.subscribe((event) => {
      if (event.type !== "app.input.requested") return;
      const data = event.data;
      createAppInboxItem(getDb(persistDir), {
        id: String(data.requestId), appId: "sample", source: { kind: "app", id: "sample" },
        input: data.input as { kind: string; data: unknown }, idempotencyKey: String(data.idempotencyKey),
      });
      admissions.push(String(data.requestId));
      return { accepted: true, by: "fixture-input-admission", route: "direct" };
    });
    let calls = 0;
    const install = () => installCoreTaskRuntimes({
      ...options(f, bus), installControllers: false,
      executors: { worker: async () => {
        calls++;
        return { state: "waiting", summary: "Review in progress", evidence: [],
          dependencies: calls <= 2 ? [{ id: `review-${calls}`, appId: "sample",
            input: { kind: "review", data: { sample: calls } } }] : [] };
      } },
      appRegistrySnapshot: { id: "additive-work", generation: 1, entries: [{ appDir: f.appDir,
        definition: { ...definition(), task: () => ({ kind: "existing", taskId: "review" }) } }] },
    }, { deferRecovery: true });
    await install();
    let config = loadedTaskConfig(f);
    observeAppTaskIntent(config, { appAgent: "sample-owner", intent: {
      id: taskId, parentId: "operations", outcome: "Obtain the requested independent reviews",
      acceptance: ["Both observations considered"], mode: "achieve", executor: "worker",
    } });
    const run = () => reconcileLoadedAppTaskOnce({ bus, appId: "sample", taskId,
      dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" } });
    await run();
    const firstWait = config.resourceStore.readTask(taskId)!.status.conditionIds![0]!;
    expect(firstWait).toBe(`app-request:${admissions[0]}`);
    await closeInstalledAppTaskRuntimes(bus);
    closeDb(persistDir);
    await install();
    config = loadedTaskConfig(f);
    recordAppTaskTrigger(config, taskId, { type: "sample.work", data: { message: "Also review the second sample" } });
    await run();
    expect(calls).toBe(2);
    expect(admissions).toHaveLength(2);
    expect(config.resourceStore.readTask(taskId)?.status).toMatchObject({
      phase: "waiting", conditionIds: [firstWait, `app-request:${admissions[1]}`],
    });
    recordAppTaskTrigger(config, taskId, { type: "sample.work", data: { message: "Keep both reviews" } });
    await run();
    expect(calls).toBe(3);
    expect(admissions).toHaveLength(2);
    expect(config.resourceStore.readTask(taskId)?.status.conditionIds).toEqual([firstWait, `app-request:${admissions[1]}`]);
    expect(listAppInboxItems(getDb(persistDir), { appId: "sample" }).map((item) => item.input.data))
      .toEqual(expect.arrayContaining([{ sample: 1 }, { sample: 2 }]));
  });

  it("preserves one accepted App request across a rejected attempt and its retry", () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const emitted: AgentEvent[] = [];
    bus.subscribe((event) => {
      emitted.push(event);
      if (event.type === "app.input.requested") {
        return { accepted: true, by: "test-app-inbox", route: "direct" };
      }
    });
    const config = loadedTaskConfig(f, persistDir);
    const intent = {
      id: "work/rejected-attempt-retry",
      parentId: "operations",
      outcome: "Use one independent review",
      acceptance: ["The review result is considered"],
      mode: "achieve" as const,
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const initial = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (initial.kind !== "claimed") throw new Error("expected initial claim");
    const resourceStore = config.resourceStore;
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
      resourceStore,
    };
    const dependency = {
      id: "review",
      appId: "evaluation",
      input: { kind: "deep-scan", data: { reason: "one durable review" } },
    };
    const conditions = admitTaskAppDependencies({
      opts: { ...options(f, bus), persistDir },
      descriptor,
      claim: initial,
      dependencies: [dependency],
    });
    const requestId = conditions[0]!.subject.slice("id:".length);
    const requestedEvent = emitted.find(
      (event) => event.type === "app.input.requested" && event.data.requestId === requestId,
    );
    const idempotencyKey = requestedEvent?.data.idempotencyKey;
    if (typeof idempotencyKey !== "string") throw new Error("expected emitted App request lineage key");
    createAppInboxItem(getDb(persistDir), {
      id: requestId,
      appId: "evaluation",
      source: { kind: "app", id: "sample" },
      input: dependency.input,
      idempotencyKey,
    });
    expect(
      deferAppTask(config, initial, {
        disposition: "waiting",
        summary: "Waiting for the independent review",
        evidence: ["review request accepted"],
        conditions,
      }),
    ).toMatchObject({ status: "applied" });

    observeAppTaskIntent(config, {
      intent,
      appAgent: "sample-owner",
      trigger: {
        type: "app.task.requested",
        source: "human",
        target: { project: "sample", taskId: intent.id },
        data: { message: "Why is this still waiting?" },
      },
    });
    const rejected = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "feedback",
    });
    if (rejected.kind !== "claimed") throw new Error("expected feedback claim");
    expect(releaseStaleAppTaskResult(config, rejected, "invalid handler result")).toMatchObject({
      status: "released",
    });

    const retry = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "retry",
    });
    if (retry.kind !== "claimed") throw new Error("expected retry claim");
    expect(readTaskSnapshot(config).resources?.[intent.id]?.status).toMatchObject({
      phase: "running",
      observedGeneration: 1,
      conditionIds: [`app-request:${requestId}`],
    });
    expect(readAppTaskWaitPromptContext(resourceStore, getDb(persistDir), intent.id)).toMatchObject({
      open: [
        {
          conditionId: `app-request:${requestId}`,
          dependency: { requestId, appId: "evaluation", status: "pending" },
        },
      ],
    });

    const emittedBeforeRetry = emitted.length;
    expect(
      admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim: retry,
        existingConditions: [],
        dependencies: [dependency],
      }),
    ).toEqual(conditions);
    expect(emitted).toHaveLength(emittedBeforeRetry);
    expect(
      listAppInboxItems(getDb(persistDir), { appId: "evaluation" }).filter(
        (item) => item.source.kind === "app" && item.source.id === "sample",
      ),
    ).toHaveLength(1);
  });

  it("reuses a create-work request when the agent reports its resolved Task", () => {
    const f = fixture();
    const bus = eventBus();
    bus.subscribe((event) =>
      event.type === "app.input.requested" ? { accepted: true, by: "test-app-inbox", route: "direct" } : undefined,
    );
    const persistDir = join(f.root, "state");
    const config = loadedTaskConfig(f, persistDir);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/reuse-created-task",
        parentId: "operations",
        outcome: "Reuse one independent review",
        acceptance: ["The review result is considered"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/reuse-created-task",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const resourceStore = config.resourceStore;
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
      resourceStore,
    };
    const dependency = { kind: "deep-scan", data: { reason: "original" } };
    const first = admitTaskAppDependencies({
      opts: { ...options(f, bus), persistDir },
      descriptor,
      claim,
      dependencies: [{ id: "review", appId: "evaluation", input: dependency }],
    });
    const requestId = first[0]!.subject.slice("id:".length);
    const db = getDb(persistDir);
    createAppInboxItem(db, {
      id: requestId,
      appId: "evaluation",
      source: { kind: "app", id: "sample" },
      input: dependency,
      now: 1,
    });
    const requestClaim = claimAppInboxItem(db, requestId, "test", 1_000, 2);
    if (!requestClaim) throw new Error("expected request claim");
    expect(waitAppInboxClaim(db, requestClaim, { kind: "task", id: "review/resolved" }, { now: 3 })).toBe(true);

    expect(
      admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor,
        claim,
        existingConditions: first,
        dependencies: [
          {
            id: requestId,
            appId: "evaluation",
            taskId: "review/resolved",
            input: { kind: "deep-scan", data: { reason: "agent restatement is not authority" } },
          },
        ],
      }),
    ).toEqual(first);
  });

  it("reattaches an exact live request from the same Task generation after recovery", () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const emitted: Array<Record<string, unknown>> = [];
    bus.subscribe((event) => emitted.push(event as unknown as Record<string, unknown>));
    const config = loadedTaskConfig(f, persistDir);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/reattach-request",
        parentId: "operations",
        outcome: "Recover one independent review",
        acceptance: ["The review result is considered"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/reattach-request",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "recovery",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const requestId = "appdep_existing";
    const requestInput = { kind: "deep-scan", data: { reason: "original" } };
    const db = getDb(persistDir);
    createAppInboxItem(db, {
      id: requestId,
      appId: "evaluation",
      source: { kind: "app", id: "sample" },
      input: requestInput,
      idempotencyKey: `task-dependency:sample:${claim.taskId}:${claim.generation}:review:existing`,
      now: 1,
    });
    const requestClaim = claimAppInboxItem(db, requestId, "test", 1_000, 2);
    if (!requestClaim) throw new Error("expected request claim");
    expect(waitAppInboxClaim(db, requestClaim, { kind: "task", id: "review/resolved" }, { now: 3 })).toBe(true);
    const emittedBeforeReuse = emitted.length;

    expect(
      admitTaskAppDependencies({
        opts: { ...options(f, bus), persistDir },
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: false,
        },
        claim,
        existingConditions: [],
        dependencies: [
          {
            id: requestId,
            appId: "evaluation",
            taskId: "review/resolved",
            input: { kind: "deep-scan", data: { reason: "restated" } },
          },
        ],
      }),
    ).toEqual([
      {
        id: `app-request:${requestId}`,
        type: "app.dependency.completed",
        subject: `id:${requestId}`,
        expected: { field: "status", equals: "done" },
        owner: "app:evaluation",
        reviewAfterMs: 300_000,
      },
    ]);
    expect(emitted).toHaveLength(emittedBeforeReuse);
  });

  it("turns a typed child App dependency into deterministic input and an exact completion Condition", () => {
    const f = fixture();
    const bus = eventBus();
    const emitted: Array<Record<string, unknown>> = [];
    bus.subscribe((event) => {
      emitted.push(event as unknown as Record<string, unknown>);
      if (event.type === "app.input.requested") {
        return { accepted: true, by: "test-app-inbox", route: "direct" };
      }
    });
    const config = loadedTaskConfig(f);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/cross-app",
        parentId: "operations",
        outcome: "Use one independent review",
        acceptance: ["The review result is considered"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/cross-app",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const resourceStore = config.resourceStore;
    const descriptor = {
      id: "sample",
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      app: definition(),
      reconciliationPaused: false,
      resourceStore,
    };

    const conditions = admitTaskAppDependencies({
      opts: options(f, bus),
      descriptor,
      claim,
      dependencies: [
        {
          id: "review",
          appId: "evaluation",
          taskId: "review/current",
          input: { kind: "deep-scan", data: { reason: "sample-review" } },
        },
      ],
    });
    const requested = emitted.find((event) => event.type === "app.input.requested");
    expect(requested).toMatchObject({
      source: "app-task:sample",
      owner: "app:evaluation",
      data: {
        appId: "evaluation",
        targetTaskId: "review/current",
        input: { kind: "deep-scan", data: { reason: "sample-review" } },
        source: { kind: "app", id: "sample" },
      },
    });
    const requestId = (requested?.data as { requestId?: string } | undefined)?.requestId;
    expect(requestId).toMatch(/^appdep_[a-f0-9]{24}$/);
    expect(conditions).toEqual([
      {
        id: `app-request:${requestId}`,
        type: "app.dependency.completed",
        subject: `id:${requestId}`,
        expected: { field: "status", equals: "done" },
        owner: "app:evaluation",
        reviewAfterMs: 300_000,
      },
    ]);
  });

  it("keeps the source Task runnable when its dependency is neither admitted nor durably published", () => {
    const f = fixture();
    const bus = eventBus();
    const emitted: AgentEvent[] = [];
    bus.subscribe((event) => emitted.push(event));
    const config = loadedTaskConfig(f);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/unaccepted-dependency",
        parentId: "operations",
        outcome: "Obtain one accepted independent review",
        acceptance: ["The destination App accepts real work"],
        mode: "achieve",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/unaccepted-dependency",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    const resourceStore = config.resourceStore;

    expect(() =>
      admitTaskAppDependencies({
        opts: options(f, bus),
        descriptor: {
          id: "sample",
          appDir: f.appDir,
          projectDir: f.appDir,
          agent: "sample-owner",
          app: definition(),
          reconciliationPaused: false,
          resourceStore,
        },
        claim,
        dependencies: [
          {
            id: "review",
            appId: "evaluation",
            input: { kind: "deep-scan", data: { reason: "sample-review" } },
          },
        ],
      }),
    ).toThrow("was neither admitted nor durably published for App evaluation; the Task remains runnable");
    expect(emitted.some((event) => event.type === "app.input.requested")).toBe(true);
    expect(Object.keys(readTaskSnapshot(config).conditions ?? {})).toEqual([]);
  });

  it("projects the exact ordered claimed event batch into workflow context", () => {
    const f = fixture();
    const config = loadedTaskConfig(f);
    const observedAt = ["2026-08-19T00:00:01.000Z", "2026-08-19T00:00:02.000Z"];
    const intent = {
      id: "work/event-context",
      parentId: "operations",
      outcome: "Receive the exact event context",
      acceptance: ["The workflow sees the ordered events"],
      mode: "maintain" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const initial = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "workflow:sample",
      reason: "test",
    });
    if (initial.kind !== "claimed") throw new Error("expected initial claim");

    const tree = config.resourceStore.readTaskContext({ taskIds: [intent.id] });
    const resource = tree.resources?.[intent.id];
    const attempt = tree.attempts?.[initial.attemptId];
    if (!resource || !attempt) throw new Error("expected event-context resource fixture");
    const trigger = {
      taskId: intent.id,
      taskGeneration: initial.generation,
      resourceVersion: 2,
      event: { type: "sample.second", eventId: 12, data: { value: "second" } },
      events: [
        {
          event: { type: "sample.first", eventId: 11, data: { value: "first" } },
          observedAt: observedAt[0]!,
        },
        {
          event: { type: "sample.second", eventId: 12, data: { value: "second" } },
          observedAt: observedAt[1]!,
        },
      ],
      observedAt: observedAt[1]!,
    };
    attempt.metadata.resourceVersion += 1;
    attempt.state = "completed";
    resource.metadata.resourceVersion += 1;
    resource.status = {
      ...resource.status,
      phase: "pending",
      currentAttemptId: undefined,
    };
    expect(
      config.resourceStore.commit({
        fences: [
          {
            taskId: intent.id,
            resourceVersion: resource.metadata.resourceVersion - 1,
            generation: resource.metadata.generation,
            currentAttemptId: initial.attemptId,
          },
        ],
        tasks: [{ resource, trigger, ready: true }],
        attempts: [attempt],
      }),
    ).toBe(true);

    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "workflow:sample",
      reason: "event",
    });
    if (claim.kind !== "claimed") throw new Error("expected event claim");

    expect(projectAppTaskReconciliationEvents(claim)).toEqual({
      items: [
        {
          eventId: 11,
          observedAt: observedAt[0],
          event: { type: "sample.first", data: { value: "first" } },
        },
        {
          eventId: 12,
          observedAt: observedAt[1],
          event: { type: "sample.second", data: { value: "second" } },
        },
      ],
      throughEventId: 12,
      truncated: false,
    });
  });

  it("does not rewrite App task state for high-volume session progress", async () => {
    const f = fixture();
    const bus = eventBus();
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:progress",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    const config = loadedTaskConfig(f);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/progress",
        parentId: "operations",
        outcome: "Process progress",
        acceptance: ["Work converges"],
        mode: "achieve",
        agent: "sample-owner",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/progress",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-progress")).toBe(true);

    const before = config.resourceStore.revision();
    for (let index = 0; index < 100; index += 1) {
      bus.emit({
        type: "tool_call",
        sessionId: "session-progress",
        agent: "sample-owner",
        tool: "read",
        args: { index },
      });
    }
    expect(config.resourceStore.revision()).toBe(before);
  });

  it("limits successful-session recovery reads to the session's bound App", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const foreignAppDir = join(f.projectsRoot, "foreign.app");
    mkdirSync(join(foreignAppDir, "agents", "foreign-owner"), { recursive: true });
    mkdirSync(join(foreignAppDir, "tasks"), { recursive: true });
    writeFileSync(
      join(foreignAppDir, "tasks", "seed.json"),
      JSON.stringify({
        root_task_id: "root",
        groups: {
          root: { id: "root", parent_id: null, state: "backlog", owner: "foreign-owner", children: [] },
        },
      }),
    );
    const foreignDefinition = defineApp({
      id: "foreign",
      version: 1,
      owner: "foreign-owner",
      inputSchema: Type.Object({}, { additionalProperties: true }),
      workspace: { kind: "local", localPath: "." },
      tasks: { subscriptions: [] },
    });
    await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: {
        id: "boot:scoped-session-recovery",
        generation: 1,
        entries: [
          { appDir: f.appDir, definition: definition() },
          { appDir: foreignAppDir, definition: foreignDefinition },
        ],
      },
    });

    const sessionId = "session-bound-to-sample";
    writeSessionMeta(persistDir, sessionId, {
      agent: "sample-owner",
      task: [
        "Owner reconciliation",
        "## Reconciliation Task",
        "```json",
        JSON.stringify({ appId: "sample", taskId: "work/scoped", generation: 1 }),
        "```",
      ].join("\n"),
      status: "done",
      startedAt: Date.now() - 100,
      endedAt: Date.now(),
      source: "app-task-owner",
      projectId: "sample",
      kind: "call",
    });

    const foreignStatePath = join(foreignAppDir, ".state", "tasks", "state.json");
    const failures: string[] = [];
    bus.subscribe((event) => {
      if (event.type === "subscriber.failed") failures.push(String(event.data.error ?? ""));
    });
    mkdirSync(join(foreignAppDir, ".state", "tasks"), { recursive: true });
    writeFileSync(foreignStatePath, "not valid JSON");
    try {
      bus.emit({
        type: "session.end",
        agent: "sample-owner",
        sessionId,
        status: "done",
        projectId: "sample",
        data: { sessionId, agent: "sample-owner", status: "done", projectId: "sample" },
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
    } finally {
      rmSync(foreignStatePath, { force: true });
    }

    expect(failures).toEqual([]);
  });

  it("does not discover or import App definitions independently", async () => {
    const f = fixture();
    const bus = eventBus();
    writeFileSync(join(f.appDir, "app.ts"), `throw new Error("the task runtime must not import app.ts");`);

    expect(await installAppTaskRuntimes(options(f, bus))).toEqual({ installed: [] });

    const result = await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:1",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    expect(result.installed).toHaveLength(1);
    expect(result.installed[0]).toMatchObject({
      id: "sample",
      appDir: f.appDir,
      agent: "sample-owner",
    });
  });

  it("installs an activated resource-backed App without recreating state.json", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const sourceConfig = appTaskTestContext({
      appDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
      lifecycle: "paused",
    });
    const tree = readTaskSnapshot(sourceConfig);

    const store = AppTaskResourceStore.fromDb(getDb(persistDir), "sample");
    store.bootstrapSnapshot(tree, "test-source-revision");
    store.setProjectLifecycle("active");
    const config = appTaskContext({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
      resourceStore: store,
    });
    observeAppTaskIntent(config, {
      intent: {
        id: "work/resource-dependency",
        parentId: "operations",
        outcome: "Read one resource-backed dependency",
        acceptance: ["Dependency reads do not parse legacy state"],
        mode: "achieve",
        agent: "sample-owner",
      },
      appAgent: "sample-owner",
      admissionKey: "attach:resource-dependency",
    });

    const result = await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: {
        id: "boot:resource-store",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    expect(result.installed).toHaveLength(1);
    expect(result.installed[0]?.resourceStore?.isActive()).toBeTrue();
    expect(result.installed[0]?.reconciliationPaused).toBeFalse();
    expect(existsSync(projectRuntimePaths(f.appDir).taskStatePath)).toBeFalse();

    expect(
      await createAppTaskCapability({ bus }).readDependency({
        appDir: f.appDir,
        dependency: { kind: "task", id: "work/resource-dependency" },
      }),
    ).toMatchObject({
      id: "work/resource-dependency",
      status: "pending",
      outcome: "Read one resource-backed dependency",
      acceptance: ["Dependency reads do not parse legacy state"],
      conditions: [],
    });
    expect(existsSync(projectRuntimePaths(f.appDir).taskStatePath)).toBeFalse();
  });

  it("bootstraps a brand-new App directly into resource authority", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const statePath = projectRuntimePaths(f.appDir).taskStatePath;

    const result = await installAppTaskRuntimes({
      ...options(f, bus),
      persistDir,
      appRegistrySnapshot: {
        id: "boot:new-resource-store",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    const store = result.installed[0]?.resourceStore;
    expect(store?.isActive()).toBeTrue();
    expect(store?.projectLifecycle()).toBe("active");
    expect(store?.sourceRevision()).toMatch(/^seed:[0-9a-f]{64}$/);
    expect(store?.readSnapshot().root_task_id).toBe("root");
    expect(existsSync(statePath)).toBeFalse();
  });

  it("refuses historical JSON state without canonical resource authority", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, "state");
    const historicalStatePath = projectRuntimePaths(f.appDir).taskStatePath;
    mkdirSync(join(f.appDir, ".state", "tasks"), { recursive: true });
    writeFileSync(historicalStatePath, `${JSON.stringify({ project_lifecycle: "active" })}\n`);

    await expect(
      installAppTaskRuntimes({
        ...options(f, bus),
        persistDir,
        appRegistrySnapshot: {
          id: "boot:retained-legacy-store",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      }),
    ).rejects.toThrow("unsupported historical JSON task state");
    expect(existsSync(historicalStatePath)).toBeTrue();
    expect(AppTaskResourceStore.activeFromDb(getDb(persistDir), "sample")).toBeNull();
  });

  it("yields readiness inside one large reconciliation after claim persistence", async () => {
    const f = fixture();
    const bus = eventBus();
    const retainedEvidence = "x".repeat(4 * 1024 * 1024);
    const historicalReceipt = {
      metadata: { id: "historical", generation: 1, resourceVersion: 1 },
      specHash: "historical",
      parentId: "operations",
      outcome: "Preserve retained evidence",
      acceptance: ["Evidence remains immutable"],
      owner: "sample-owner",
      handler: "agent:sample-owner",
      summary: "Historical receipt",
      evidence: [retainedEvidence],
      acceptanceBasis: { method: "agent-judgment" as const, evidence: ["historical"] },
      failureFingerprints: [],
      completedAt: "2026-08-19T00:00:00.000Z",
    };
    const seed = JSON.parse(readFileSync(join(f.appDir, "tasks", "seed.json"), "utf8"));
    const sourceConfig = appTaskTestContext({
      appDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
      tree: { ...seed, receipts: { historical: historicalReceipt } },
    });
    const config = activateTaskResources(sourceConfig, join(f.root, "state"));

    expect(migrateTaskCompletionReceipts(config, { oldRuntimeStopped: true }).imported).toBe(1);
    let readinessTurnObserved = false;
    let ownerObservedReadinessTurn: boolean | undefined;
    let ownerCalls = 0;
    bus.subscribe((event) => {
      if (event.type !== "project.task.reconcile.started" || event.data.taskId !== "work/large-state") return;
      setTimeout(() => {
        readinessTurnObserved = true;
      }, 0);
    });

    await installAppTaskRuntimes({
      ...options(f, bus),
      manager: {
        hasAgent: () => true,
        async callAgent() {
          ownerCalls += 1;
          ownerObservedReadinessTurn = readinessTurnObserved;
          return {
            sessionId: "large-state-owner",
            status: "done",
            structuredResult: {
              state: "waiting",
              summary: "Waiting on an exact external fact",
              evidence: ["large-state-owner-dispatched"],
              actions: [],
              conditions: [
                {
                  id: "large-state-proof",
                  type: "project.state",
                  subject: "project:sample",
                  expected: { field: "ready", equals: true },
                },
              ],
            },
            lastAssistantText: "Waiting on an exact external fact",
            messages: [],
            duration: "0s",
            outputDir: "",
          };
        },
      } as never,
      appRegistrySnapshot: {
        id: "boot:large-state-yield",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/large-state",
          parentId: "operations",
          outcome: "Reconcile one task without starving readiness",
          acceptance: ["Readiness gets a turn after durable claim persistence"],
          mode: "achieve",
          agent: "sample-owner",
        },
      },
      idempotencyKey: "attach:large-state",
      request: {
        id: "request-large-state",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    const deadline = Date.now() + 2_000;
    while (ownerCalls === 0 && Date.now() < deadline) await Bun.sleep(5);
    expect(ownerCalls).toBe(1);
    expect(ownerObservedReadinessTurn).toBe(true);
    expect(readTaskSnapshot(config).receipts?.historical?.evidence).toEqual([retainedEvidence]);
  });

  it.each([
    { name: "executor uses App branch", git: true, branch: "main", expectedBase: "main" },
    { name: "executor defaults to dev", git: true, expectedBase: "dev" },
    { name: "local executor needs no worktree", git: false },
    { name: "local executor needs no workspace backend", git: false, withoutBackend: true },
    {
      name: "Git executor rejects a missing workspace backend",
      git: true,
      withoutBackend: true,
      preparationFails: true,
    },
    { name: "workflow uses App branch", git: true, branch: "main", workspace: "task", expectedBase: "main" },
    { name: "workflow defaults to dev", git: true, workspace: "task", expectedBase: "dev" },
    {
      name: "workflow overrides App branch",
      git: true,
      branch: "main",
      workspace: { kind: "task", baseBranch: "release" },
      expectedBase: "release",
    },
    { name: "shared workflow needs no worktree", git: true, branch: "main", workspace: "shared" },
    { name: "shared workflow needs no workspace backend", git: true, workspace: "shared", withoutBackend: true },
    {
      name: "task workflow rejects a missing workspace backend",
      git: true,
      workspace: "task",
      withoutBackend: true,
      preparationFails: true,
    },
    { name: "task workflow rejects a local App", git: false, workspace: "task", preparationFails: true },
    {
      name: "failed Git preparation can recover on the same Task",
      git: true,
      branch: "main",
      missingRemote: true,
      preparationFails: true,
    },
  ])("preserves workspace admission: $name", async (scenario) => {
    const f = fixture();
    const bus = eventBus();
    const agentsRoot = join(f.root, "agents");
    const workflowDir = join(agentsRoot, "sample-owner", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    if (scenario.workspace) {
      writeFileSync(
        join(workflowDir, "workspace-check.ts"),
        `export const name = "workspace-check";
           export const description = "Deterministic workspace admission fixture";
           export const workspace = ${JSON.stringify(scenario.workspace)};
           export async function execute(ctx) {
             return ctx.done("Fixture workflow ran", {
               state: "converged", summary: "Fixture workflow ran", evidence: [ctx.workspace.root]
             });
           }`,
      );
    }
    if (scenario.git) {
      const git = (...args: string[]) => promisify(execFile)("git", ["-C", f.appDir, ...args], { timeout: 10_000 });
      await git("init", "-b", "main");
      await git("config", "user.email", "test@example.com");
      await git("config", "user.name", "Test");
      await git("add", ".");
      await git("commit", "-m", "fixture baseline");
      await git("branch", "dev");
      await git("branch", "release");
      if (scenario.missingRemote) await git("remote", "add", "origin", join(f.root, "provider.git"));
    }

    let executorCwd: string | undefined;
    const runtimeOptions: Parameters<typeof installAppTaskRuntimes>[0] = {
      ...options(f, bus),
      ...(scenario.withoutBackend ? { workspaces: undefined } : {}),
      agentsRoot,
      sharedRoot: join(f.root, "shared"),
      installControllers: false,
      executors: {
        reviewer: async (attempt) => {
          executorCwd = attempt.cwd;
          return { state: "converged", summary: "Fixture executor ran", evidence: [attempt.cwd] };
        },
      },
      appRegistrySnapshot: {
        id: "boot:workspace-admission",
        generation: 1,
        entries: [
          {
            appDir: f.appDir,
            definition: {
              ...definition(),
              workspace: scenario.git
                ? { kind: "git", localPath: ".", ...(scenario.branch ? { branch: scenario.branch } : {}) }
                : { kind: "local", localPath: "." },
            },
          },
        ],
      },
    };
    await installAppTaskRuntimes(runtimeOptions);
    const config = loadedTaskConfig(f);
    const taskId = "work/workspace-admission";
    observeAppTaskIntent(config, {
      appAgent: "sample-owner",
      intent: {
        id: taskId,
        parentId: "operations",
        outcome: "Execute through the selected workspace",
        acceptance: ["Selected handler ran in the correct workspace"],
        mode: "achieve",
        agent: "sample-owner",
        ...(scenario.workspace ? { workflow: "workspace-check" } : { executor: "reviewer" }),
      },
    });
    setSystemTime(new Date());
    const reconciliation = reconcileLoadedAppTaskOnce({
      bus,
      appId: "sample",
      taskId,
      dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
    });
    await reconciliation;
    const tree = readTaskSnapshot(config);
    if (scenario.preparationFails) {
      expect(tree.receipts?.[taskId]).toBeUndefined();
      expect(tree.resources?.[taskId]?.status).toMatchObject({
        phase: "pending",
        executionFailures: 1,
        executionRetryAt: expect.any(Number),
      });
      expect(config.resourceStore.isCancelled(taskId)).toBe(false);
      expect(Object.values(tree.attempts ?? {})).toEqual([
        expect.objectContaining({
          state: "failed",
          failureReason: "WorkspacePreparationFailed",
          summary: expect.stringContaining(
            scenario.missingRemote
              ? "git ls-remote"
              : scenario.withoutBackend
                ? "Task workspace backend is not installed"
                : "requires a task worktree but app workspace is not Git",
          ),
        }),
      ]);
      await reconcileLoadedAppTaskOnce({
        bus,
        appId: "sample",
        taskId,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
      expect(Object.keys(readTaskSnapshot(config).attempts ?? {})).toHaveLength(1);
      expect(executorCwd).toBeUndefined();
      expect(existsSync(join(f.root, "worktrees"))).toBe(false);
      if (scenario.withoutBackend) {
        // Restore composition; the persisted retry deadline is enough.
        const { workspaces: _missing, ...restored } = runtimeOptions;
        await installAppTaskRuntimes(restored);
        setSystemTime(new Date(config.resourceStore.readTask(taskId)!.status.executionRetryAt!));
        await reconcileLoadedAppTaskOnce({
          bus,
          appId: "sample",
          taskId,
          dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
        });
        const recovered = readTaskSnapshot(config);
        expect(acceptedTaskAttempt(config, taskId)?.acceptedResult?.summary).toBe(
          scenario.workspace ? "Fixture workflow ran" : "Fixture executor ran",
        );
        expect(Object.keys(recovered.attempts ?? {})).toHaveLength(2);
      }
      if (scenario.missingRemote) {
        const git = (...args: string[]) => promisify(execFile)("git", args, { timeout: 10_000 });
        const privateRefs = () => git("-C", f.appDir, "for-each-ref", "--format=%(refname)", "refs/may/workspaces/");
        expect((await privateRefs()).stdout.trim()).toBe("");
        await git("init", "--bare", join(f.root, "provider.git"));
        await git("-C", f.appDir, "push", "origin", "main");
        // Repair the prerequisite, then let the same Task retry when due.
        setSystemTime(new Date(config.resourceStore.readTask(taskId)!.status.executionRetryAt!));
        await reconcileLoadedAppTaskOnce({
          bus,
          appId: "sample",
          taskId,
          dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
        });
        const recovered = readTaskSnapshot(config);
        expect(acceptedTaskAttempt(config, taskId)?.acceptedResult?.summary).toBe("Fixture executor ran");
        expect(Object.keys(recovered.attempts ?? {})).toHaveLength(2);
        expect(executorCwd).toBeDefined();
        expect((await privateRefs()).stdout.trim()).toBe("");
      }
      return;
    }
    const attempt = acceptedTaskAttempt(config, taskId)!;
    expect(attempt.acceptedResult).toMatchObject({
      state: "converged",
      summary: scenario.workspace ? "Fixture workflow ran" : "Fixture executor ran",
    });
    expect(tree.resources?.[taskId]?.status.phase).toBe("converged");
    expect(tree.receipts?.[taskId]).toBeUndefined();
    expect(config.resourceStore.isCancelled(taskId)).toBe(false);
    expect(config.resourceStore.listRecoveryCandidates().items).toEqual([]);
    if (scenario.expectedBase) {
      expect(attempt.workspace).toMatchObject({
        kind: "task-worktree",
        baseRef: scenario.expectedBase,
        disposition: "removed",
      });
      expect(attempt.workspace?.path).not.toBe(f.appDir);
      expect(attempt.acceptedResult?.evidence).toContain(attempt.workspace!.path);
      if (!scenario.workspace) expect(executorCwd).toBe(attempt.workspace!.path);
      expect(existsSync(attempt.workspace!.path)).toBe(false);
    } else {
      expect(attempt.workspace).toBeUndefined();
      expect(attempt.acceptedResult?.evidence).toContain(f.appDir);
      expect(existsSync(join(f.root, "worktrees"))).toBe(false);
    }
  });

  it.each(["waiting", "converged"] as const)(
    "retains %s output when new facts arrive during a worktree attempt",
    async (state) => {
      const f = fixture();
      const bus = eventBus();
      const git = (...args: string[]) => promisify(execFile)("git", ["-C", f.appDir, ...args], { timeout: 10_000 });
      await git("init", "-b", "main");
      await git("config", "user.email", "test@example.com");
      await git("config", "user.name", "Test");
      await git("add", ".");
      await git("commit", "-m", "fixture baseline");
      const taskId = "work/facts-during-attempt";
      const condition = {
        id: "run:42", type: "sample.run.finished", subject: "run:42",
        expected: { field: "status", equals: "done" }, owner: "app:sample", reviewAfterMs: 60_000,
      };
      let config: AppTaskContext;
      let calls = 0;
      let retainedPath = "";
      await installAppTaskRuntimes({
        ...options(f, bus), installControllers: false,
        executors: {
          worker: async (attempt) => {
            calls++;
            if (calls === 1) {
              retainedPath = attempt.cwd;
              recordAppTaskTrigger(config, taskId, {
                type: "sample.review.changed", eventId: 101, data: { comment: "Please check cleanup" },
              });
            } else {
              expect(attempt.cwd).toBe(retainedPath);
              expect(config.resourceStore.readTask(taskId)?.status.result).toEqual({ runId: 42, head: "abc" });
              expect(attempt.events.items.some((item) => item.eventId === 101)).toBeTrue();
            }
            return {
              state: calls === 1 ? state : "waiting", summary: "Observed exact-head run 42",
              result: { runId: 42, head: "abc" }, evidence: ["run:42/head:abc"],
              ...(calls > 1 || state === "waiting" ? { conditions: [condition] } : {}),
            };
          },
        },
        appRegistrySnapshot: {
          id: "boot:facts-during-attempt", generation: 1,
          entries: [{ appDir: f.appDir, definition: {
            ...definition(), workspace: { kind: "git", localPath: ".", branch: "main" },
          } }],
        },
      });
      config = loadedTaskConfig(f);
      observeAppTaskIntent(config, { appAgent: "sample-owner", intent: {
        id: taskId, parentId: "operations", outcome: "Reevaluate without repeating completed work",
        acceptance: ["Current evidence reviewed"], mode: "achieve", agent: "sample-owner", executor: "worker",
      } });
      const run = () => reconcileLoadedAppTaskOnce({ bus, appId: "sample", taskId,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" } });
      await run();
      const tree = readTaskSnapshot(config);
      expect(tree.resources?.[taskId]?.status.result).toEqual({ runId: 42, head: "abc" });
      expect(tree.resources?.[taskId]?.status.evidence).toEqual(["run:42/head:abc"]);
      expect(tree.receipts?.[taskId]).toBeUndefined();
      expect(tree.taskTriggers?.[taskId]?.events?.map((entry) => entry.event.eventId)).toEqual([101]);
      expect(Object.values(tree.attempts ?? {})[0]?.state).toBe("completed");
      expect(existsSync(retainedPath)).toBeTrue();
      if (state === "waiting") expect(tree.conditions?.[condition.id]?.spec.subject).toBe("run:42");
      await run();
      expect(calls).toBe(2);
      expect(config.resourceStore.readTask(taskId)?.status.phase).toBe("waiting");
      await run();
      expect(calls).toBe(2); // An unchanged open wait is not another attempt.
    },
  );

  it.each(["fact", "intent", "action", "persistent"] as const)("rechecks persistence after a concurrent %s without repeating execution", async (change) => {
    const f = fixture();
    const bus = eventBus();
    let calls = 0;
    await installAppTaskRuntimes({
      ...options(f, bus), installControllers: false,
      executors: {
        worker: async () => {
          calls++;
          return { state: "waiting", summary: "Recorded run 42", result: { runId: 42 },
            ...(change === "action" ? { actions: [{ kind: "create-task" as const, id: "work/persistence-child",
              parentId: taskId, outcome: "Follow current intent", acceptance: ["Reviewed"], mode: "achieve" as const,
              outputs: [] }] } : {}),
            evidence: ["run:42"], conditions: [{ id: "run:42", type: "sample.run.done", subject: "run:42",
              expected: "done", owner: "app:sample", reviewAfterMs: 60_000 }] };
        },
      },
      appRegistrySnapshot: { id: "boot:persistence-contention", generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }] },
    });
    const config = loadedTaskConfig(f);
    const taskId = "work/persistence-contention";
    const taskIntent = { id: taskId, parentId: "operations", outcome: "Retain completed work",
      acceptance: ["Current outcome"], mode: "achieve" as const, agent: "sample-owner", executor: "worker" };
    observeAppTaskIntent(config, { appAgent: "sample-owner", intent: taskIntent });
    const store = AppTaskResourceStore.prototype;
    const commit = store.commit;
    let injected = false;
    let saveAttempts = 0;
    store.commit = function (mutation) {
      if (mutation.tasks?.some((write) => write.resource.metadata.id === taskId && write.resource.status.result?.runId === 42)) {
        saveAttempts++;
        if (change === "persistent") { injected = true; return false; }
      }
      if (!injected && saveAttempts === 1) {
        injected = true;
        if (change === "fact" || change === "action") recordAppTaskTrigger(config, taskId, { type: "sample.changed", eventId: 101 });
        else observeAppTaskIntent(config, { appAgent: "sample-owner", intent: { ...taskIntent, outcome: "Replacement intent" } });
      }
      return commit.call(this, mutation);
    };
    try {
      await reconcileLoadedAppTaskOnce({ bus, appId: "sample", taskId,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" } });
    } finally {
      store.commit = commit;
    }
    expect(injected).toBeTrue();
    expect(calls).toBe(1);
    const tree = readTaskSnapshot(config);
    expect(tree.receipts?.[taskId]).toBeUndefined();
    if (change === "fact") {
      expect(tree.resources?.[taskId]?.status.result).toEqual({ runId: 42 });
      expect(tree.conditions?.["run:42"]?.spec.subject).toBe("run:42");
      expect(tree.taskTriggers?.[taskId]?.events?.map((row) => row.event.eventId)).toEqual([101]);
      expect(Object.values(tree.attempts ?? {})[0]?.state).toBe("completed");
      expect(saveAttempts).toBe(2);
    } else if (change === "intent") {
      expect(tree.resources?.[taskId]?.metadata.generation).toBe(2);
      expect(tree.resources?.[taskId]?.spec.outcome).toBe("Replacement intent");
      expect(tree.resources?.[taskId]?.status.result).toBeUndefined();
    } else {
      expect(tree.resources?.[taskId]?.status.result).toBeUndefined();
      expect(tree.resources?.["work/persistence-child"]).toBeUndefined();
      expect(Object.values(tree.attempts ?? {})[0]?.state).toBe("interrupted");
      expect(saveAttempts).toBe(change === "persistent" ? 2 : 1);
      if (change === "action")
        expect(tree.taskTriggers?.[taskId]?.events?.map((row) => row.event.eventId)).toContain(101);
    }
  });

  it("does not create task worktrees while startup installs and recovers work", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    execFileSync("git", ["init", "-b", "main", f.appDir], { stdio: "ignore" });
    execFileSync("git", ["-C", f.appDir, "config", "user.email", "test@example.com"]);
    execFileSync("git", ["-C", f.appDir, "config", "user.name", "Test"]);
    execFileSync("git", ["-C", f.appDir, "add", "."]);
    execFileSync("git", ["-C", f.appDir, "commit", "-m", "baseline"], { stdio: "ignore" });

    const sourceConfig = appTaskTestContext({
      appDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
    });
    const config = activateTaskResources(sourceConfig, persistDir);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/retry-workspace",
        parentId: "operations",
        outcome: "Retry a task workspace only after startup is ready",
        acceptance: ["No task worktree exists before explicit recovery"],
        mode: "achieve",
        agent: "sample-owner",
        executor: "codex",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/retry-workspace",
      appAgent: "sample-owner",
      handler: "executor:codex",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected workspace claim");
    markAppTaskAttention(config, claim, {
      summary: "workspace preparation failed",
      reason: "WorkspacePreparationFailed",
    });
    let openControllerGate = () => {};
    const controllerGate = new Promise<void>((resolve) => {
      openControllerGate = resolve;
    });
    const worktreeRoot = join(f.root, "worktrees", "sample");
    await installAppTaskRuntimes(
      {
        ...options(f, bus),
        persistDir,
        startAfter: controllerGate,
        appRegistrySnapshot: {
          id: "boot:deferred-recovery",
          generation: 1,
          entries: [
            {
              appDir: f.appDir,
              definition: {
                ...definition(),
                workspace: { kind: "git", localPath: ".", branch: "main" },
              },
            },
          ],
        },
      },
      { deferRecovery: true },
    );

    expect(existsSync(worktreeRoot)).toBe(false);
    expect(readTaskSnapshot(config).resources?.["work/retry-workspace"]?.status.phase).toBe("pending");

    await recoverInstalledAppTasks(bus);

    expect(existsSync(worktreeRoot)).toBe(false);
    expect(readTaskSnapshot(config).resources?.["work/retry-workspace"]?.status).toMatchObject({
      phase: "pending",
      observedGeneration: 1,
    });
    openControllerGate();
    await closeInstalledAppTaskRuntimes(bus);
  });

  it("releases a fresh previous-runtime attempt and requeues it through bounded task capacity", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const runtimeOptions = {
      ...options(f, bus),
      persistDir,
      manager: { hasAgent: () => true, hasActiveSession: () => false } as never,
      appRegistrySnapshot: {
        id: "boot:fresh-session",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    };
    const config = loadedTaskConfig(f, persistDir);
    observeAppTaskIntent(config, {
      intent: {
        id: "work/resumable",
        parentId: "operations",
        outcome: "Resume exact task session",
        acceptance: ["Session is fenced once"],
        mode: "achieve",
        agent: "sample-owner",
      },
      appAgent: "sample-owner",
    });
    const claim = claimObservedAppTask(config, {
      taskId: "work/resumable",
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected claim");
    expect(recordAppTaskAttemptSession(config, claim, "session-resumable")).toBe(true);
    mutateRuntimeAttemptFixture(config, claim.taskId, claim.attemptId, (attempt) => {
      if (!attempt.lease) throw new Error("expected leased attempt");
      attempt.runtimeId = "previous-runtime";
      attempt.lease.runtimeId = "previous-runtime";
    });
    writeSessionMeta(persistDir, "session-resumable", {
      agent: "sample-owner",
      task: "resume",
      status: "running",
      startedAt: Date.now(),
      source: "app-task-owner",
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
      kind: "call",
    });

    const recovered = await installAppTaskRuntimes(runtimeOptions, { includeFreshLeases: true });

    expect(recovered.installed).toHaveLength(1);
    expect(readTaskSnapshot(config).resources?.["work/resumable"]?.status).toMatchObject({
      phase: "pending",
      observedGeneration: 0,
    });
    expect(readSessionMeta(persistDir, "session-resumable")?.status).toBe("interrupted");
  });

  it("drains an orphaned setsid owner's exact process group before replacement recovery", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const config = loadedTaskConfig(f, persistDir);
    const intent = {
      id: "work/orphan-owner",
      parentId: "operations",
      outcome: "Recover orphan agent session",
      acceptance: ["Replacement ownership cannot overlap stale process mutation"],
      mode: "achieve" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected orphan agent claim");
    expect(recordAppTaskAttemptSession(config, claim, "owner-old")).toBe(true);
    mutateRuntimeAttemptFixture(config, claim.taskId, claim.attemptId, (attempt) => {
      if (!attempt.lease) throw new Error("expected leased orphan agent attempt");
      attempt.runtimeId = "previous-runtime";
      attempt.lease.runtimeId = "previous-runtime";
      attempt.lease.expiresAt = new Date(Date.now() - 1_000).toISOString();
    });
    writeSessionMeta(persistDir, "owner-old", {
      agent: "sample-owner",
      task: "Recover orphan agent session",
      status: "running",
      startedAt: Date.now() - 60_000,
      source: "app-task-owner",
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
      kind: "call",
    });

    const staleMutation = join(f.root, "superseded-owner-mutation");
    const stalePgidPath = join(f.root, "superseded-owner-pgid");
    const staleCommand = `trap '' TERM; sleep 3; printf stale > ${JSON.stringify(staleMutation)}; sleep 30`;
    const externalReaper = spawn(
      "/usr/bin/python3",
      [
        "-c",
        [
          "import os, sys",
          "pid = os.fork()",
          "if pid == 0:",
          "    os.setsid()",
          "    with open(sys.argv[2], 'w') as pgid_file:",
          "        pgid_file.write(f'{os.getpid()}\\n')",
          "    os.execl('/bin/bash', 'bash', '-c', sys.argv[1])",
          "os.waitpid(pid, 0)",
        ].join("\n"),
        staleCommand,
        stalePgidPath,
      ],
      { stdio: "ignore" },
    );
    const externalReaperExit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      externalReaper.once("exit", (code, signal) => resolve({ code, signal }));
    });
    const stalePgidDeadline = Date.now() + 2_000;
    let stalePgid = 0;
    while (stalePgid <= 0 && Date.now() < stalePgidDeadline) {
      if (existsSync(stalePgidPath)) stalePgid = Number(readFileSync(stalePgidPath, "utf8").trim());
      if (stalePgid <= 0) await Bun.sleep(5);
    }
    expect(stalePgid).toBeGreaterThan(0);
    expect(
      Number(execFileSync("ps", ["-o", "pgid=", "-p", String(externalReaper.pid)], { encoding: "utf8" }).trim()),
    ).not.toBe(stalePgid);
    addSessionBashProcessGroup(persistDir, "owner-old", stalePgid);
    expect(readSessionBashProcessGroups(persistDir, "owner-old")).toEqual([stalePgid]);
    execFileSync("git", ["init", "-b", "main", f.root], { stdio: "ignore" });
    let replacementCalls = 0;
    let preReplacementState:
      | { groupDead: boolean; pgids: number[]; mutated: boolean; sessionStatus?: string; resultPersisted: boolean }
      | undefined;
    try {
      await installAppTaskRuntimes({
        ...options(f, bus),
        persistDir,
        manager: {
          hasAgent: () => true,
          hasActiveSession: () => false,
          cancel: () => {
            throw new Error("startup recovery should drain the persisted agent session directly");
          },
          async callAgent() {
            let groupDead = true;
            for (const entry of readdirSync("/proc")) {
              if (!/^\d+$/.test(entry)) continue;
              try {
                const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
                const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
                if (Number(fields[2]) === stalePgid && fields[0] !== "Z") {
                  groupDead = false;
                  break;
                }
              } catch {
                // A process may exit while /proc is being scanned.
              }
            }
            preReplacementState = {
              groupDead,
              pgids: readSessionBashProcessGroups(persistDir, "owner-old"),
              mutated: existsSync(staleMutation),
              sessionStatus: readSessionMeta(persistDir, "owner-old")?.status,
              resultPersisted: existsSync(join(persistDir, "sessions", "owner-old", "result.json")),
            };
            replacementCalls += 1;
            return {
              sessionId: "owner-replacement",
              status: "done",
              structuredResult: {
                state: "converged",
                summary: "replacement owner completed",
                evidence: ["replacement terminal result"],
                actions: [],
              },
              lastAssistantText: "replacement owner completed",
              messages: [],
              duration: "0s",
              outputDir: "",
            };
          },
        } as never,
        appRegistrySnapshot: {
          id: "boot:orphan-owner",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      });

      const replacementDeadline = Date.now() + 2_000;
      while (replacementCalls === 0 && Date.now() < replacementDeadline) await Bun.sleep(5);
      expect(replacementCalls).toBe(1);
      expect(preReplacementState).toEqual({
        groupDead: true,
        pgids: [],
        mutated: false,
        sessionStatus: "interrupted",
        resultPersisted: true,
      });

      const resultDeadline = Date.now() + 2_000;
      while (!readAcceptedRuntimeAttempt(config, intent.id)?.acceptedResult && Date.now() < resultDeadline)
        await Bun.sleep(5);
      const terminalResult = JSON.stringify(readAcceptedRuntimeAttempt(config, intent.id)?.acceptedResult);
      expect(terminalResult).not.toBeUndefined();
      expect(await externalReaperExit).toEqual({ code: 0, signal: null });
      await Bun.sleep(700);
      expect(existsSync(staleMutation)).toBe(false);
      expect(JSON.stringify(readAcceptedRuntimeAttempt(config, intent.id)?.acceptedResult)).toBe(terminalResult);
    } finally {
      try {
        process.kill(-stalePgid, "SIGKILL");
      } catch {
        // Recovery already drained the exact orphaned group.
      }
      externalReaper.kill("SIGKILL");
    }
  });

  it("fails startup recovery closed when a durable owner process group cannot be confirmed drained", async () => {
    const f = fixture();
    const bus = eventBus();
    const persistDir = join(f.root, ".state");
    const config = loadedTaskConfig(f, persistDir);
    const intent = {
      id: "work/undrained-owner",
      parentId: "operations",
      outcome: "Do not overlap an undrained owner",
      acceptance: ["Recovery remains fenced until exact process-group exit is confirmed"],
      mode: "achieve" as const,
      agent: "sample-owner",
    };
    observeAppTaskIntent(config, { intent, appAgent: "sample-owner" });
    const claim = claimObservedAppTask(config, {
      taskId: intent.id,
      appAgent: "sample-owner",
      handler: "agent:sample-owner",
      reason: "test",
    });
    if (claim.kind !== "claimed") throw new Error("expected undrained agent claim");
    expect(recordAppTaskAttemptSession(config, claim, "owner-undrained")).toBe(true);
    mutateRuntimeAttemptFixture(config, claim.taskId, claim.attemptId, (attempt) => {
      if (!attempt.lease) throw new Error("expected leased undrained attempt");
      attempt.runtimeId = "previous-runtime";
      attempt.lease.runtimeId = "previous-runtime";
      attempt.lease.expiresAt = new Date(Date.now() - 1_000).toISOString();
    });
    writeSessionMeta(persistDir, "owner-undrained", {
      agent: "sample-owner",
      task: "Do not overlap an undrained owner",
      status: "running",
      startedAt: Date.now() - 60_000,
      source: "app-task-owner",
      projectId: "sample",
      recoveryOwner: "app-task-reconciler",
      kind: "call",
    });
    addSessionBashProcessGroup(persistDir, "owner-undrained", 424_242);
    execFileSync("git", ["init", "-b", "main", f.root], { stdio: "ignore" });
    let replacementCalls = 0;
    let sessionEndEvents = 0;
    bus.subscribe((event) => {
      if (event.type === "session.end" && event.sessionId === "owner-undrained") sessionEndEvents += 1;
    });
    await expect(
      installAppTaskRuntimes({
        ...options(f, bus),
        persistDir,
        drainPersistedBashProcessGroups: () => false,
        manager: {
          hasAgent: () => true,
          hasActiveSession: () => false,
          cancel: () => undefined,
          async callAgent() {
            replacementCalls += 1;
            throw new Error("replacement must remain fenced");
          },
        } as never,
        appRegistrySnapshot: {
          id: "boot:undrained-owner",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      }),
    ).rejects.toThrow("did not exit after bounded SIGTERM/SIGKILL drain");

    expect(replacementCalls).toBe(0);
    expect(sessionEndEvents).toBe(0);
    expect(readSessionMeta(persistDir, "owner-undrained")?.status).toBe("running");
    expect(existsSync(join(persistDir, "sessions", "owner-undrained", "result.json"))).toBe(false);
    expect(readSessionBashProcessGroups(persistDir, "owner-undrained")).toEqual([424_242]);
    const afterRecovery = readTaskSnapshot(config);
    expect(afterRecovery.resources?.[intent.id]?.status.phase).toBe("running");
    expect(afterRecovery.resources?.[intent.id]?.status.currentAttemptId).toBe(claim.attemptId);
    expect(afterRecovery.receipts?.[intent.id]).toBeUndefined();
  });

  it("admits desired attachments and resolved events through the one loaded generation", async () => {
    const f = fixture();
    const bus = eventBus();
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:1",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    const request: Readonly<AppInputContext> = {
      id: "request-1",
      source: { kind: "human", id: "operator" },
      input: { kind: "sample", data: {} },
    };
    const attached = await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/attached",
          parentId: "operations",
          outcome: "Process attached work",
          acceptance: ["Work converges"],
          mode: "achieve",
          agent: "sample-owner",
        },
      },
      idempotencyKey: "attach:request-1",
      request,
    });
    expect(attached.taskId).toBe("work/attached");
    expect(
      readLoadedAppTaskView({
        bus,
        appDir: f.appDir,
        taskId: "work/attached",
      }),
    ).toMatchObject({ id: "work/attached", status: "pending" });

    const intent = definition().tasks!.resolve!({
      type: "sample.work",
      data: { itemId: "event" },
    })!;
    expect(
      admitLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event: {
          type: "sample.work",
          source: "test",
          owner: "agent:sample-owner",
          data: { itemId: "event" },
        },
        intent,
      }),
    ).toMatchObject({ accepted: true, route: "direct" });
    expect(
      readLoadedAppTaskView({
        bus,
        appDir: f.appDir,
        taskId: "work/event",
      }),
    ).toMatchObject({ id: "work/event", status: "pending" });
  });

  it("discards a post-claim superseded attempt without a handler failure or retry loop", async () => {
    const f = fixture();
    const bus = eventBus();
    const failures: AgentEvent[] = [];
    const staleDispositions: AgentEvent[] = [];
    let superseded = false;
    let executorCalls = 0;

    bus.subscribe((event) => {
      if (event.type === "handler.failed") failures.push(event);
      if (event.type === "project.task.reconciled" && event.data.disposition === "stale") {
        staleDispositions.push(event);
      }
      if (
        !superseded &&
        event.type === "project.task.reconcile.started" &&
        event.data.taskId === "work/post-claim-superseded"
      ) {
        superseded = true;
        attachLoadedAppTask({
          bus,
          appDir: f.appDir,
          appId: "sample",
          attachment: {
            kind: "desired",
            intent: {
              id: "work/post-claim-superseded",
              parentId: "operations",
              outcome: "Run only the replacement generation",
              acceptance: ["The replacement executor returns once"],
              mode: "achieve",
              agent: "sample-owner",
              executor: "race-proof",
            },
          },
          idempotencyKey: "attach:post-claim-superseded:replacement",
          request: {
            id: "request-post-claim-superseded-replacement",
            source: { kind: "human", id: "operator" },
            input: { kind: "test", data: {} },
          },
        });
      }
    });

    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        "race-proof": async () => {
          executorCalls += 1;
          return {
            state: "converged",
            summary: "The replacement generation completed",
            evidence: ["test:post-claim-superseded"],
          };
        },
      },
      appRegistrySnapshot: {
        id: "boot:post-claim-superseded",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/post-claim-superseded",
          parentId: "operations",
          outcome: "Run the original generation",
          acceptance: ["The original executor returns"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "race-proof",
        },
      },
      idempotencyKey: "attach:post-claim-superseded:original",
      request: {
        id: "request-post-claim-superseded-original",
        source: { kind: "human", id: "operator" },
        input: { kind: "test", data: {} },
      },
    });

    const config = loadedTaskConfig(f);
    const deadline = Date.now() + 2_000;
    while (!readAcceptedRuntimeAttempt(config, "work/post-claim-superseded")?.acceptedResult && Date.now() < deadline) {
      await Bun.sleep(5);
    }

    expect(superseded).toBeTrue();
    expect(executorCalls).toBe(1);
    expect(failures).toEqual([]);
    expect(staleDispositions).toHaveLength(1);
    expect(staleDispositions[0]?.data).toMatchObject({
      taskId: "work/post-claim-superseded",
      generation: 1,
      disposition: "stale",
      staleRecovery: "superseded",
    });
    expect(readAcceptedRuntimeAttempt(config, "work/post-claim-superseded")).toMatchObject({
      taskGeneration: 2,
      acceptedResult: { summary: "The replacement generation completed" },
    });
  });

  it("atomically consumes live input incorporated by a registered executor", async () => {
    const f = fixture();
    const bus = eventBus();
    let nextEventId = 1;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: nextEventId++, configurable: true });
    });
    const published: AgentEvent[] = [];
    bus.subscribe((event) => {
      if (event.type === "sample.progress") published.push(event);
    });
    let calls = 0;
    let sawLiveFeedback = false;
    let wakeFirstAttempt = () => {};
    const firstAttemptReady = new Promise<void>((resolve) => {
      wakeFirstAttempt = resolve;
    });

    await installAppTaskRuntimes({
      ...options(f, bus),
      agents: createTaskAgentRunner(
        { manager: { hasAgent: () => true } as never },
        new Map([
          [
            "sample-owner",
            {
              name: "sample-owner",
              description: "Sample owner",
              domain: "sample",
              systemPrompt: "Use the immutable sample owner role.",
              tools: [],
              model: {},
            } as never,
          ],
        ]),
      ),
      executors: {
        reviewer: async (attempt) => {
          calls += 1;
          expect(attempt.appId).toBe("sample");
          expect(attempt.task.id).toBe("work/registered-executor");
          expect(attempt.cwd).toBe(f.appDir);
          expect(attempt.role).toEqual({
            agent: "sample-owner",
            instructions: "Use the immutable sample owner role.",
          });
          expect(attempt.declaredOutputPaths).toEqual([]);
          expect(attempt.children).toEqual({ live: [], completed: [] });
          expect(attempt.waits).toMatchObject({ open: [] });
          expect(attempt.resultSchema).toEqual(structuredClone(taskAgentResultSchema));
          expect(
            await attempt.publish(`pass-${calls}`, {
              type: "sample.progress",
              data: { pass: calls },
            }),
          ).toMatchObject({ eventId: expect.any(Number) });
          if (calls === 1) {
            await new Promise<void>((resolve) => {
              const unsubscribe = attempt.onEvent((event, accept) => {
                if (event.type !== "sample.feedback") return;
                sawLiveFeedback = true;
                accept();
                unsubscribe();
                resolve();
              });
              wakeFirstAttempt();
            });
          } else {
            expect(attempt.events.items.some((item) => item.event.type === "sample.feedback")).toBeTrue();
          }
          return {
            state: "converged",
            summary: "Registered executor completed the Task",
            evidence: [`test:reviewer:${calls}`],
          };
        },
      },
      appRegistrySnapshot: {
        id: "boot:registered-executor",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/registered-executor",
          parentId: "operations",
          outcome: "Run one replaceable executor",
          acceptance: ["The registered executor returns evidence"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "reviewer",
        },
      },
      idempotencyKey: "attach:registered-executor",
      request: {
        id: "request-registered-executor",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    await firstAttemptReady;
    const feedback = {
      type: "sample.feedback",
      source: "human",
      owner: "agent:sample-owner",
      target: { appId: "sample", taskId: "work/registered-executor" },
      data: { instruction: "include this review" },
    } as AgentEvent;
    bus.emit(feedback);

    const deadline = Date.now() + 2_000;
    while (readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: "work/registered-executor" })?.status !== "done" && Date.now() < deadline) {
      await Bun.sleep(5);
    }
    expect(calls).toBe(1);
    expect(sawLiveFeedback).toBeTrue();
    expect(published).toHaveLength(1);
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: "work/registered-executor" })).toMatchObject({
      status: "done",
      executor: "reviewer",
      summary: "Registered executor completed the Task",
      evidence: ["test:reviewer:1"],
    });
  });

  it("queues the loaded executable parent when its child is cancelled by a human", async () => {
    const f = fixture();
    const bus = eventBus();
    const parentId = "work/assessment";
    const childId = "work/optional";
    const seen: Parameters<TaskExecutor>[0][] = [];
    await installCoreTaskRuntimes({
      ...options(f, bus),
      hostCapacity: new HostCapacity(1),
      executors: {
        assess: async (attempt) => {
          seen.push(attempt);
          return {
            state: "converged",
            summary: "Assessment delivered; optional implementation was cancelled",
            evidence: ["assessment:reviewed"],
          };
        },
      },
      appRegistrySnapshot: {
        id: "parent-cancel",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    // Admission is storage-only. The parent's only queue entry below must come
    // from cancelLoadedAppTask, not attachment, a child return, or recovery.
    const config = loadedTaskConfig(f);
    const intent = {
      id: parentId,
      parentId: "operations",
      outcome: "Assess the optional feature",
      acceptance: ["Return a useful assessment"],
      mode: "achieve" as const,
      executor: "assess",
    };
    observeAppTaskIntent(config, { appAgent: "sample-owner", intent });
    observeAppTaskIntent(config, {
      appAgent: "sample-owner",
      intent: {
        ...intent,
        id: childId,
        parentId,
        outcome: "Try an optional implementation",
      },
    });
    const parent = claimObservedAppTask(config, { taskId: parentId, appAgent: "sample-owner", handler: "auto" });
    if (parent.kind !== "claimed") throw new Error("expected parent claim");
    deferAppTask(config, parent, { disposition: "waiting", summary: "Await child findings", evidence: [] });
    expect(seen).toHaveLength(0);
    const settled = new Promise<AgentEvent>((resolve) => {
      bus.subscribe((event) => {
        if (event.type === "project.task.reconciled" && event.data.taskId === parentId) resolve(event);
      });
    });
    const child = config.resourceStore.readTask(childId)!;
    expect(
      cancelLoadedAppTask({
        bus,
        appId: "sample",
        taskId: childId,
        expectedGeneration: child.metadata.generation,
        expectedResourceVersion: child.metadata.resourceVersion,
        reason: "Optional implementation no longer needed",
      }).applied,
    ).toBe(true);
    expect((await settled).data.disposition).toBe("converged");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.task.id).toBe(parentId);
    expect(seen[0]?.children).toMatchObject({
      live: [],
      completed: [],
      cancelled: [{ taskId: childId, summary: expect.stringContaining("Cancelled by human") }],
    });
    expect(readAcceptedRuntimeAttempt(config, parentId)?.acceptedResult?.summary).toContain("Assessment delivered");
    expect(config.resourceStore.isCancelled(parentId)).toBe(false);
    expect(config.resourceStore.readReceipt(childId)).toBeNull();
    expect(config.resourceStore.readCancellation(childId)?.decidedBy).toEqual({ kind: "human" });
  }, 5_000);

  it("aborts the exact registered executor attempt after durable Task cancellation", async () => {
    const f = fixture();
    const bus = eventBus();
    let startedAttemptId = "";
    let activeSignal: AbortSignal | undefined;
    let markStarted = () => {};
    let markAborted = () => {};
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const aborted = new Promise<void>((resolve) => {
      markAborted = resolve;
    });

    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        reviewer: async (attempt) => {
          startedAttemptId = attempt.attemptId;
          activeSignal = attempt.signal;
          markStarted();
          await new Promise<never>((_, reject) => {
            const stop = () => {
              markAborted();
              reject(attempt.signal.reason);
            };
            attempt.signal.addEventListener("abort", stop, { once: true });
            if (attempt.signal.aborted) stop();
          });
        },
      },
      appRegistrySnapshot: {
        id: "boot:registered-executor-cancel",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/cancel-executor",
          parentId: "operations",
          outcome: "Cancel one replaceable executor",
          acceptance: ["The active attempt stops"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "reviewer",
        },
      },
      idempotencyKey: "attach:cancel-executor",
      request: {
        id: "request-cancel-executor",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });
    await started;
    bus.emit({
      type: "app.task.cancelled",
      source: "app-task-reconciler",
      owner: "human:operator",
      target: { appId: "sample", taskId: "work/cancel-executor" },
      data: {
        appId: "sample",
        taskId: "work/cancel-executor",
        attemptId: "older-attempt",
        reason: "stale cancellation signal",
      },
    });
    await Bun.sleep(1);
    expect(activeSignal?.aborted).toBeFalse();

    const humanTasks = new HumanTaskService(getDb(join(f.root, "state")), {
      snapshot: () => ({
        id: "test:cancel",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      }),
    });
    const current = humanTasks.getTask({ appId: "sample", taskId: "work/cancel-executor" });
    if (!current) throw new Error("expected cancellable Task");
    expect(
      cancelLoadedAppTask({
        bus,
        appId: current.appId,
        taskId: current.taskId,
        expectedGeneration: current.generation,
        expectedResourceVersion: current.resourceVersion,
        reason: "no longer needed",
      }),
    ).toMatchObject({ applied: true, cancelledAttemptId: startedAttemptId });
    await aborted;
    expect(startedAttemptId).not.toBe("");
    expect(humanTasks.getTask({ appId: "sample", taskId: "work/cancel-executor" })).toMatchObject({
      status: "cancelled",
    });
  });

  it("retries a restored executor through durable eligibility while independent Tasks keep working", async () => {
    const f = fixture();
    const bus = eventBus();
    const calls: string[] = [];
    const startedAt = new Map<string, number>();
    const execute: TaskExecutor = async (attempt) => {
      calls.push(attempt.task.id);
      startedAt.set(attempt.task.id, Date.now());
      return { state: "converged", summary: "Verified by fixture executor", evidence: ["test:executor-restored"] };
    };
    const runtimeOptions = options(f, bus);
    let generation = 0;
    const install = (available: boolean) => installAppTaskRuntimes({
      ...runtimeOptions, executors: { other: execute, ...(available ? { reviewer: execute } : {}) },
      appRegistrySnapshot: { id: `boot:executor-recovery:${++generation}`, generation,
        entries: [{ appDir: f.appDir, definition: definition() }] },
    });
    const attach = (id: string, executor = "reviewer") => attachLoadedAppTask({
      bus, appDir: f.appDir, appId: "sample",
      attachment: { kind: "desired", intent: { id, parentId: "operations", outcome: `Verify ${id}`,
        acceptance: ["Verified"], mode: "achieve", executor } },
      idempotencyKey: `attach:${id}`, request: { id: `request:${id}`, source: { kind: "human", id: "operator" },
        input: { kind: "test", data: {} } },
    });
    const accepted = (taskId: string) => readLoadedAppTaskInputResult({ bus, appDir: f.appDir, taskId, admissionKey: `attach:${taskId}` });
    const until = async (condition: () => boolean) => {
      const deadline = Date.now() + 3_000;
      while (!condition() && Date.now() < deadline) await Bun.sleep(5);
      expect(condition()).toBeTrue();
    };

    await install(true);
    const store = loadedTaskConfig(f).resourceStore;
    attach("work/completed");
    await until(() => accepted("work/completed")?.state === "converged");
    const completed = accepted("work/completed");

    await install(false);
    attach("work/missing");
    await until(() => Boolean(store.readTask("work/missing")?.status.executionRetryAt));
    const failure = Object.values(store.readTaskContext({ taskIds: ["work/missing"] }).attempts ?? {})
      .find((attempt) => attempt.failureReason === "HandlerUnavailable")!;
    expect(failure).toMatchObject({ handler: "executor:reviewer", state: "failed" });
    expect(accepted("work/missing")).toBeNull();
    attach("work/independent", "other");
    await until(() => accepted("work/independent")?.state === "converged");
    expect(calls).not.toContain("work/missing");
    const retryAt = store.readTask("work/missing")!.status.executionRetryAt!;
    await install(true);
    await until(() => accepted("work/missing")?.state === "converged");
    expect(startedAt.get("work/missing")).toBeGreaterThanOrEqual(retryAt);
    expect(store.readAttempt(failure.metadata.id)).toEqual(failure);
    expect(store.readTask("work/missing")?.metadata.generation).toBe(failure.taskGeneration);
    expect(store.readCancellation("work/missing")).toBeNull();
    expect(store.nextDueAt()).toBeNull();
    expect(store.listRecoveryCandidates().items).toEqual([]);
    await recoverInstalledAppTasks(bus);
    await install(true);
    expect(calls).toEqual(["work/completed", "work/independent", "work/missing"]);
    expect(accepted("work/completed")).toEqual(completed);
  });

  it.each(["reload", "close and reinstall", "rejected reload"] as const)(
    "uses current session adapters after %s without adding another listener",
    async (replacement) => {
      const f = fixture();
      const bus = eventBus();
      const calls: string[] = [];
      const publications: number[] = [];
      let handled = () => {};
      const sessions = (name: string): TaskSessionRecovery => ({
        handoff: () => undefined,
        isLive: () => false,
        lastActivityAt: () => null,
        workflowInterrupted: () => false,
        read(sessionId) {
          calls.push(`${name}:read:${sessionId}`);
          handled();
          return null;
        },
        interrupt(sessionId, _reason, taskId) {
          calls.push(`${name}:interrupt:${sessionId}:${taskId}`);
          handled();
        },
      });
      const install = (generation: number) => installCoreTaskRuntimes({
        ...options(f, bus),
        sessions: sessions(`generation-${generation}`),
        afterCommit: () => {
          publications.push(generation);
          if (generation === 2 && replacement === "rejected reload") {
            throw new Error("Rejected candidate publication");
          }
        },
        installControllers: false,
        appRegistrySnapshot: {
          id: `session-adapter:${generation}`,
          generation,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      }, { deferRecovery: true });

      await install(1);
      const listeners = bus.listenerCount;
      if (replacement === "close and reinstall") await closeInstalledAppTaskRuntimes(bus);
      if (replacement === "rejected reload") {
        await expect(install(2)).rejects.toThrow("Rejected candidate publication");
      } else {
        await install(2);
      }
      const acceptedGeneration = replacement === "rejected reload" ? 1 : 2;
      expect(publications).toEqual([1, 2]); // Rollback must not publish the old generation again.
      expect(bus.listenerCount).toBe(listeners);

      // A stale session must be interrupted by the current adapter. It cannot
      // create Task ownership merely because its start event arrived late.
      const interrupted = new Promise<void>((resolve) => { handled = resolve; });
      bus.emit({
        type: "session.start",
        owner: "agent:sample-owner",
        data: {
          sessionId: "obsolete-session", agent: "sample-owner", task: "obsolete",
          trigger: "test", firedAt: Date.now(),
          taskBinding: { appId: "sample", taskId: "work/absent", generation: 1 },
        },
      } as AgentEvent);
      await interrupted;
      expect(calls).toEqual([`generation-${acceptedGeneration}:interrupt:obsolete-session:work/absent`]);
      expect(loadedTaskConfig(f).resourceStore.readTask("work/absent")).toBeNull();

      const inspected = new Promise<void>((resolve) => { handled = resolve; });
      bus.emit({
        type: "session.end",
        owner: "agent:sample-owner",
        data: {
          sessionId: "terminal-session", agent: "sample-owner", status: "done",
          outcome: "done", summary: "finished", durationMs: 1,
        },
      });
      await inspected;
      expect(calls).toEqual([
        `generation-${acceptedGeneration}:interrupt:obsolete-session:work/absent`,
        `generation-${acceptedGeneration}:read:terminal-session`,
      ]);
    },
  );

  it("leaves rejected initial publication inactive and allows a later installation", async () => {
    const f = fixture();
    const bus = eventBus();
    const calls: string[] = [];
    const publications: number[] = [];
    const install = (generation: number) => installCoreTaskRuntimes({
      ...options(f, bus),
      sessions: {
        handoff: () => undefined,
        isLive: () => false,
        lastActivityAt: () => null,
        workflowInterrupted: () => false,
        interrupt: () => {},
        read: (sessionId) => {
          calls.push(`${generation}:read:${sessionId}`);
          return null;
        },
      },
      executeRecovery: async () => { calls.push(`${generation}:recover`); },
      afterCommit: () => {
        publications.push(generation);
        if (generation === 1) throw new Error("Rejected initial publication");
      },
      installControllers: false,
      appRegistrySnapshot: {
        id: `initial-publication:${generation}`,
        generation,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    }, { deferRecovery: true });
    const endSession = async (sessionId: string) => {
      const observed = Promise.withResolvers<void>();
      // Registered after the synchronous Task listener: observing this exact
      // event lets us check absence of adapter calls without a fixed sleep.
      const stop = bus.listen(() => observed.resolve(), { types: ["session.end"] });
      try {
        bus.emit({
          type: "session.end",
          owner: "agent:sample-owner",
          data: {
            sessionId, agent: "sample-owner", status: "done",
            outcome: "done", summary: "finished", durationMs: 1,
          },
        });
        await observed.promise;
      } finally {
        stop();
      }
    };

    await expect(install(1)).rejects.toThrow("Rejected initial publication");
    const listeners = bus.listenerCount;
    await endSession("after-rejection");
    await recoverInstalledAppTasks(bus);
    expect(calls).toEqual([]);
    expect(publications).toEqual([1]);

    expect((await install(2)).installed).toHaveLength(1);
    expect(bus.listenerCount).toBe(listeners);
    await endSession("after-installation");
    await recoverInstalledAppTasks(bus);
    expect(calls).toEqual(["2:read:after-installation", "2:recover"]);
    expect(publications).toEqual([1, 2]);
  });

  it("starts new work from a reloaded definition while an old attempt is still running", async () => {
    const f = fixture();
    const bus = eventBus();
    const started: string[] = [];
    let releaseOld = () => {};
    const oldBlocked = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    const app = definition();
    const concurrentApp = {
      ...app,
      tasks: { ...app.tasks!, maxConcurrent: 2 },
    } as AppDefinition;
    const runtimeOptions = {
      ...options(f, bus),
      // Two Task attempts must be able to overlap while the Host still keeps
      // its foreground slot available for a live May conversation.
      hostCapacity: new HostCapacity(3),
      executors: {
        reviewer: async (attempt: Parameters<TaskExecutor>[0]) => {
          started.push(attempt.task.id);
          if (attempt.task.id === "work/before-reload") await oldBlocked;
          return { state: "converged" as const, summary: "done", evidence: ["test:reload"] };
        },
      },
    };

    await installAppTaskRuntimes({
      ...runtimeOptions,
      appRegistrySnapshot: {
        id: "boot:stable-controller:1",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: concurrentApp }],
      },
    });
    expect(
      AppTaskResourceStore.activeFromDb(getDb(join(f.root, "state")), "sample")?.configuredMaxConcurrent(),
    ).toBe(2);
    const attach = (taskId: string) =>
      attachLoadedAppTask({
        bus,
        appDir: f.appDir,
        appId: "sample",
        attachment: {
          kind: "desired",
          intent: {
            id: taskId,
            parentId: "operations",
            outcome: `Run ${taskId}`,
            acceptance: ["Executor returns"],
            mode: "achieve",
            agent: "sample-owner",
            executor: "reviewer",
          },
        },
        idempotencyKey: `attach:${taskId}`,
        request: {
          id: `request:${taskId}`,
          source: { kind: "human", id: "operator" },
          input: { kind: "test", data: {} },
        },
      });

    await attach("work/before-reload");
    while (!started.includes("work/before-reload")) await Bun.sleep(1);

    await expect(
      installAppTaskRuntimes({
        ...runtimeOptions,
        appRegistrySnapshot: { id: "boot:stable-controller:remove", generation: 2, entries: [] },
      }),
    ).rejects.toThrow("Cannot remove App sample while it has unfinished Tasks");

    await installAppTaskRuntimes({
      ...runtimeOptions,
      appRegistrySnapshot: {
        id: "boot:stable-controller:2",
        generation: 3,
        entries: [{ appDir: f.appDir, definition: concurrentApp }],
      },
    });
    await attach("work/after-reload");

    const deadline = Date.now() + 1_000;
    while (!started.includes("work/after-reload") && Date.now() < deadline) await Bun.sleep(5);
    expect(started).toEqual(["work/before-reload", "work/after-reload"]);
    releaseOld();
  });

  it.each([true, false])(
    "keeps the registered executor role without a CLI lifecycle (controllers=%s)",
    async (controllers) => {
      const f = fixture();
      const bus = eventBus();
      let cliRequests = 0;
      bus.subscribeDurableRoute((event) => {
        if (event.type !== "cli.task.requested") return;
        cliRequests += 1;
        return { accepted: true, by: "unexpected-cli-runner", route: "direct" };
      });
      let calls = 0;
      const runtimeOptions = options(f, bus);
      Object.assign(runtimeOptions.manager, {
        agentNames: () => ["sample-owner"],
        getAgentDefinition: () => ({ name: "sample-owner", systemPrompt: "Fixture selected role" }),
      });
      await installAppTaskRuntimes({
        ...runtimeOptions,
        installControllers: controllers,
        executors: {
          codex: async (attempt) => {
            calls += 1;
            expect(attempt.task.executor).toBe("codex");
            expect(attempt.role.instructions).toBe("Fixture selected role");
            return {
              state: "converged",
              summary: "Replacement Codex adapter completed the Task",
              evidence: ["test:replacement-codex"],
            };
          },
        },
        appRegistrySnapshot: {
          id: "boot:replacement-executor",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      });

      const replacementIntent = {
        id: "work/replacement-executor",
        parentId: "operations",
        outcome: "Use the Host-provided Codex adapter",
        acceptance: ["The replacement adapter returns evidence"],
        mode: "achieve" as const,
        agent: "sample-owner",
        executor: "codex",
      };
      if (controllers)
        await attachLoadedAppTask({
          bus,
          appDir: f.appDir,
          appId: "sample",
          attachment: { kind: "desired", intent: replacementIntent },
          idempotencyKey: "attach:replacement-executor",
          request: {
            id: "request-replacement-executor",
            source: { kind: "human", id: "operator" },
            input: { kind: "sample", data: {} },
          },
        });

      if (!controllers) {
        observeAppTaskIntent(loadedTaskConfig(f), { intent: replacementIntent, appAgent: "sample-owner" });
        await reconcileLoadedAppTaskOnce({
          bus,
          appId: "sample",
          taskId: "work/replacement-executor",
          dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
        });
      }

      const config = loadedTaskConfig(f);
      const deadline = Date.now() + 2_000;
      while (
        !readAcceptedRuntimeAttempt(config, "work/replacement-executor")?.acceptedResult &&
        Date.now() < deadline
      ) {
        await Bun.sleep(5);
      }
      expect(calls).toBe(1);
      expect(cliRequests).toBe(0);
      expect(readAcceptedRuntimeAttempt(config, "work/replacement-executor")).toMatchObject({
        handler: "executor:codex",
        acceptedResult: {
          summary: "Replacement Codex adapter completed the Task",
          evidence: ["test:replacement-codex"],
        },
      });
      expect(config.resourceStore.readTask("work/replacement-executor")?.spec.executor).toBe("codex");
    },
  );

  it("delegates a controller attempt across the configured execution boundary", async () => {
    const f = fixture();
    const bus = eventBus();
    const calls: Array<{ appId: string; taskId: string; lane: string }> = [];

    await installAppTaskRuntimes({
      ...options(f, bus),
      executeAttempt: async ({ appId, taskId, dispatch }) => {
        calls.push({ appId, taskId, lane: dispatch.lane });
        return [];
      },
      appRegistrySnapshot: {
        id: "boot:isolated-attempt",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/isolated",
          parentId: "operations",
          outcome: "Run outside the interface event loop",
          acceptance: ["The configured attempt boundary receives the exact Task"],
          mode: "achieve",
          agent: "sample-owner",
        },
      },
      idempotencyKey: "attach:isolated",
      request: {
        id: "request-isolated",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    const deadline = Date.now() + 1_000;
    while (calls.length === 0 && Date.now() < deadline) await Bun.sleep(5);
    expect(calls).toEqual([{ appId: "sample", taskId: "work/isolated", lane: "human" }]);
  });

  it("delegates startup Task recovery across the configured execution boundary", async () => {
    const f = fixture();
    const bus = eventBus();
    let recoveries = 0;

    await installAppTaskRuntimes({
      ...options(f, bus),
      executeRecovery: async () => {
        recoveries += 1;
      },
      appRegistrySnapshot: {
        id: "boot:isolated-recovery",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await recoverInstalledAppTasks(bus);
    expect(recoveries).toBe(1);
  });

  it("retains an explicit workflow blocker across recovery and rechecks the same Task after corrected input", async () => {
    const f = fixture();
    const bus = eventBus();
    const agentsRoot = join(f.root, "agents");
    const workflowDir = join(agentsRoot, "sample-owner", "workflows");
    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(
      join(workflowDir, "claim-check.ts"),
      `
      export const name = "claim-check";
      export const description = "Recheck a previously blocked claim from current input";
      export async function execute(ctx) {
        if (ctx.reconciliation.input.confirmed !== true)
          return ctx.blocked("Current evidence does not confirm the requirement", { finding: "exact assertion missing", runId: "123" });
        return ctx.done("Fresh evidence confirmed the requirement", {
          state: "converged", summary: "Fresh evidence confirmed the requirement",
          evidence: ["verified:current-input"]
        });
      }
    `,
    );
    const runtimeOptions = {
      ...options(f, bus),
      agentsRoot,
      sharedRoot: join(f.root, "shared"),
      appRegistrySnapshot: {
        id: "boot:explicit-workflow-blocker",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    };
    await installAppTaskRuntimes(runtimeOptions);
    const taskId = "work/claim-check";
    const attach = (confirmed: boolean) =>
      attachLoadedAppTask({
        bus,
        appDir: f.appDir,
        appId: "sample",
        attachment: {
          kind: "desired",
          intent: {
            id: taskId,
            parentId: "operations",
            mode: "achieve",
            agent: "sample-owner",
            workflow: "claim-check",
            outcome: "Confirm the requirement from current evidence",
            acceptance: ["Fresh verified facts, not a previous failed judgment, decide completion"],
            input: { confirmed },
          },
        },
        idempotencyKey: `claim-check:${confirmed}`,
        request: {
          id: `request-claim-check:${confirmed}`,
          source: { kind: "human", id: "operator" },
          input: { kind: "sample", data: { confirmed } },
        },
      });
    await attach(false);
    const config = loadedTaskConfig(f);
    const deadline = Date.now() + 1500;
    while (!config.resourceStore.readTask(taskId)?.status.executionRetryAt && Date.now() < deadline) await Bun.sleep(5);
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })).toMatchObject({
      id: taskId,
      status: "pending",
      generation: 1,
      summary: "Current evidence does not confirm the requirement",
      conditions: [],
      evidence: expect.arrayContaining([
        'workflow-blocker-context:{"finding":"exact assertion missing","runId":"123"}',
      ]),
    });
    const attemptsBefore = Object.values(readTaskSnapshot(config).attempts ?? {});
    expect(attemptsBefore).toHaveLength(1);
    expect(attemptsBefore[0]).toMatchObject({ state: "failed", failureReason: "handler-blocked" });
    for (let index = 0; index < 3; index++) await recoverInstalledAppTasks(bus);
    await closeInstalledAppTaskRuntimes(bus);
    await installAppTaskRuntimes(runtimeOptions);
    await recoverInstalledAppTasks(bus);
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })?.status).toBe("pending");
    expect(Object.values(readTaskSnapshot(config).attempts ?? {})).toHaveLength(1);
    const humanTasks = new HumanTaskService(getDb(join(f.root, "state")), {
      snapshot: () => runtimeOptions.appRegistrySnapshot,
    });
    const blocked = humanTasks.getTask({ appId: "sample", taskId });
    if (!blocked) throw new Error("expected blocked Task");
    retryLoadedFailedAppTask({
      bus,
      appId: "sample",
      taskId,
      expectedGeneration: blocked.generation,
      expectedResourceVersion: blocked.resourceVersion,
    });
    const retryDeadline = Date.now() + 1500;
    while (
      (Object.values(readTaskSnapshot(config).attempts ?? {}).length < 2 ||
        !config.resourceStore.readTask(taskId)?.status.executionRetryAt) &&
      Date.now() < retryDeadline
    )
      await Bun.sleep(5);
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })).toMatchObject({
      status: "pending",
      generation: 1,
      conditions: [],
    });
    expect(Object.values(readTaskSnapshot(config).attempts ?? {})).toHaveLength(2);
    await attach(true);
    const completionDeadline = Date.now() + 1500;
    while (
      readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })?.status !== "done" &&
      Date.now() < completionDeadline
    )
      await Bun.sleep(5);
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })).toMatchObject({
      id: taskId,
      status: "done",
      generation: 2,
      evidence: ["verified:current-input"],
    });
  });

  it.each([
    { state: "converged", committed: false },
    { state: "converged", committed: true },
    { state: "waiting", committed: false },
    { state: "waiting", committed: false, actions: true },
    { state: "stopped", committed: false },
    { state: "stopped", committed: true },
  ] as const)("retains workspace after rejection or stop ($state, committed=$committed)", async (scenario) => {
    const f = fixture();
    const bus = eventBus();
    const git = (cwd: string, ...args: string[]) =>
      promisify(execFile)("git", ["-C", cwd, ...args], { timeout: 10_000 });
    await git(f.appDir, "init", "-b", "main");
    await git(f.appDir, "config", "user.email", "test@example.com");
    await git(f.appDir, "config", "user.name", "Test");
    await git(f.appDir, "add", ".");
    await git(f.appDir, "commit", "-m", "fixture baseline");
    let calls = 0;
    await installAppTaskRuntimes({
      ...options(f, bus),
      installControllers: false,
      executors: {
        residue: async (attempt) => {
          calls++;
          if (calls === 1) {
            writeFileSync(join(attempt.cwd, "retained.txt"), "unfinished source\n");
            if (scenario.committed) {
              await git(attempt.cwd, "add", "retained.txt");
              await git(attempt.cwd, "commit", "-m", "retained change");
            }
          }
          return {
            state: calls === 1 ? scenario.state : "converged",
            summary: "Claimed handler outcome",
            evidence: ["provider:evidence"],
            ...("actions" in scenario && calls === 1
              ? {
                  result: { admittedChild: "work/proposed-child" },
                  actions: [
                    {
                      kind: "create-task" as const,
                      id: "work/proposed-child",
                      parentId: "work/workspace-rejection",
                      outcome: "Must not be reported as admitted",
                      acceptance: ["Current intent"],
                      mode: "achieve" as const,
                      outputs: [],
                    },
                  ],
                }
              : {}),
          };
        },
      },
      appRegistrySnapshot: {
        id: "boot:workspace-rejection",
        generation: 1,
        entries: [
          {
            appDir: f.appDir,
            definition: {
              ...definition(),
              workspace: { kind: "git", localPath: ".", branch: "main" },
            },
          },
        ],
      },
    });
    const config = loadedTaskConfig(f);
    const taskId = "work/workspace-rejection";
    observeAppTaskIntent(config, {
      appAgent: "sample-owner",
      intent: {
        id: taskId,
        parentId: "operations",
        outcome: "Preserve unfinished work",
        acceptance: ["Preserve the workspace and pace retries until integration succeeds"],
        mode: "achieve",
        agent: "sample-owner",
        executor: "residue",
      },
    });
    const run = () =>
      reconcileLoadedAppTaskOnce({
        bus,
        appId: "sample",
        taskId,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
    setSystemTime(new Date());
    await run();
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId })).toMatchObject({
      status: "pending",
      summary: expect.stringContaining(
        scenario.state === "stopped" ? "Outcome not achieved" : scenario.committed ? "not integrated" : "dirty",
      ),
      evidence: expect.arrayContaining(["provider:evidence"]),
    });
    for (let index = 0; index < 3; index++) await recoverInstalledAppTasks(bus);
    await run();
    expect(calls).toBe(1);
    const tree = readTaskSnapshot(config);
    expect(tree.receipts?.[taskId]).toBeUndefined();
    expect(tree.resources?.[taskId]?.status.result).toBeUndefined();
    expect(tree.resources?.["work/proposed-child"]).toBeUndefined();
    expect(Object.values(tree.attempts ?? {})).toEqual([
      expect.objectContaining({
        ...(scenario.state === "stopped"
          ? { state: "completed", acceptedResult: expect.objectContaining({ state: "stopped" }) }
          : { state: "failed", failureReason: "handler-blocked" }),
        workspace: expect.objectContaining({
          disposition: scenario.committed && scenario.state !== "stopped" ? "branch-retained" : "retained-for-recovery",
        }),
      }),
    ]);
    const retained = Object.values(tree.attempts ?? {})[0]!.workspace!;
    expect(config.resourceStore.readCancellation(taskId)).toBeNull();
    if (retained.disposition === "branch-retained") {
      expect(existsSync(retained.path)).toBe(false);
      expect((await git(f.appDir, "show", `${retained.branch}:retained.txt`)).stdout).toBe("unfinished source\n");
    } else expect(readFileSync(join(retained.path, "retained.txt"), "utf8")).toBe("unfinished source\n");
    if (scenario.state === "stopped")
      expect(acceptedTaskAttempt(config, taskId)?.acceptedResult?.evidence).toEqual(
        expect.arrayContaining(["provider:evidence", retained.path]),
      );
    // Simulate explicit repair/integration in this local Git fixture. A prior
    // guard rejection must not make the same Task permanently unfinishable.
    if (!scenario.committed) {
      await git(retained.path, "add", "retained.txt");
      await git(retained.path, "commit", "-m", "explicit fixture recovery");
    }
    await git(f.appDir, "merge", "--ff-only", retained.branch);
    setSystemTime(new Date(config.resourceStore.readTask(taskId)!.status.executionRetryAt!));
    await run();
    expect(calls).toBe(2);
    expect(acceptedTaskAttempt(config, taskId)).toMatchObject({
      taskGeneration: 1,
      acceptedResult: { state: "converged", summary: "Claimed handler outcome" },
      workspace: { disposition: "removed" },
    });
    expect(config.resourceStore.isCancelled(taskId)).toBe(false);
    expect(config.resourceStore.listRecoveryCandidates().items).toEqual([]);
    expect(readFileSync(join(f.appDir, "retained.txt"), "utf8")).toBe("unfinished source\n");
  });

  it("paces invalid output and accepts a corrected result on the same Task", async () => {
    const f = fixture();
    const bus = eventBus();
    let calls = 0;
    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        invalid: async () => {
          calls += 1;
          return calls === 1
            ? ({ state: "error", summary: "Invalid authored state", evidence: [] } as never)
            : { state: "converged", summary: "Corrected result", evidence: ["fixture:corrected"] };
        },
      },
      appRegistrySnapshot: {
        id: "boot:invalid-handler-result",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/invalid-result",
          parentId: "operations",
          outcome: "Settle a rejected result",
          acceptance: ["Invalid output is rejected and the same work can continue"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "invalid",
        },
      },
      idempotencyKey: "attach:invalid-result",
      request: {
        id: "request-invalid-result",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });
    const config = appTaskContext({
      appDir: f.appDir,
      projectDir: f.projectDir,
      agent: "sample-owner",
      maxConcurrent: 1,
      resourceStore: AppTaskResourceStore.activeFromDb(getDb(join(f.root, "state")), "sample")!,
    });
    const deadline = Date.now() + 1_000;
    while (!config.resourceStore.readTask("work/invalid-result")?.status.executionRetryAt && Date.now() < deadline) {
      await Bun.sleep(5);
    }
    expect(config.resourceStore.readTask("work/invalid-result")?.status).toMatchObject({
      phase: "pending",
      observedGeneration: 1,
      summary: "Handler result was rejected: state must be converged, waiting, stopped, or needs-agent",
    });
    for (let index = 0; index < 3; index += 1) await recoverInstalledAppTasks(bus);
    expect(calls).toBe(1);
    expect(config.resourceStore.listRecoveryCandidates().items.map((item) => item.taskId)).not.toContain(
      "work/invalid-result",
    );
    expect(Object.values(readTaskSnapshot(config).attempts ?? {})).toContainEqual(
      expect.objectContaining({
        taskId: "work/invalid-result",
        state: "failed",
        failureReason: "HandlerResultInvalid",
      }),
    );
    expect(config.resourceStore.readTask("work/invalid-result")?.status.executionRetryAt).toBeGreaterThan(Date.now());
    const correctedDeadline = Date.now() + 1500;
    while (!readAcceptedRuntimeAttempt(config, "work/invalid-result")?.acceptedResult && Date.now() < correctedDeadline)
      await Bun.sleep(5);
    expect(readAcceptedRuntimeAttempt(config, "work/invalid-result")?.acceptedResult?.summary).toBe("Corrected result");
    expect(calls).toBe(2);
    expect(config.resourceStore.isCancelled("work/invalid-result")).toBe(false);
  });

  it("paces controller retries beyond the old limit while unrelated work progresses", async () => {
    const f = fixture();
    const bus = eventBus();
    let calls = 0;
    await installCoreTaskRuntimes({
      ...options(f, bus),
      executors: {
        broken: async () => {
          calls += 1;
          throw new Error("fixture execution failed");
        },
        healthy: async () => ({
          state: "converged",
          summary: "Verified independent work",
          evidence: ["test:verified"],
        }),
      },
      appRegistrySnapshot: {
        id: "boot:controller-retry",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    const config = loadedTaskConfig(f);
    const attach = (executor: string) =>
      attachLoadedAppTask({
        bus,
        appDir: f.appDir,
        appId: "sample",
        idempotencyKey: `attach:${executor}`,
        attachment: {
          kind: "desired",
          intent: {
            id: `work/${executor}`,
            parentId: "operations",
            outcome: `Complete ${executor}`,
            acceptance: ["Verified result"],
            mode: "achieve",
            executor,
          },
        },
        request: {
          id: `request-${executor}`,
          source: { kind: "human", id: "operator" },
          input: { kind: "sample", data: {} },
        },
      });
    await attach("broken");
    const deadline = Date.now() + 6_000;
    while ((config.resourceStore.readTask("work/broken")?.status.executionFailures ?? 0) < 5 && Date.now() < deadline) {
      await Bun.sleep(5);
    }
    expect(calls).toBe(5);
    expect(config.resourceStore.readTask("work/broken")?.status).toMatchObject({
      phase: "pending",
      executionFailures: 5,
    });
    for (let index = 0; index < 3; index += 1) await recoverInstalledAppTasks(bus);
    await attach("healthy");
    const healthyDeadline = Date.now() + 1_000;
    while (!readAcceptedRuntimeAttempt(config, "work/healthy")?.acceptedResult && Date.now() < healthyDeadline)
      await Bun.sleep(5);
    expect(readAcceptedRuntimeAttempt(config, "work/healthy")?.acceptedResult?.summary).toBe(
      "Verified independent work",
    );
    expect(calls).toBe(5);
    expect(config.resourceStore.readTask("work/broken")?.status.executionRetryAt).toBeGreaterThan(Date.now());
    expect(config.resourceStore.isCancelled("work/broken")).toBe(false);
    expect(config.resourceStore.listRecoveryCandidates().items.map((item) => item.taskId)).not.toContain("work/broken");
  });

  it.each([false, true])(
    "lets the parent repair a prerequisite while its child continues through normal retry (restart: %j)",
    async (restart) => {
      const f = fixture();
      let bus = eventBus();
      const persistDir = join(f.root, "state");
      const parentId = "work/delivery";
      const childId = "work/verification";
      let childCalls = 0;
      let repaired = false;
      const reviews: Array<Pick<Parameters<TaskExecutor>[0], "children" | "events">> = [];
      const pendingCallerStates: Array<ReturnType<AppInboxHost["get"]>> = [];
      let host: AppInboxHost;
      const executors: Record<string, TaskExecutor> = {
        owner: async ({ children, events }) => {
          reviews.push(structuredClone({ children, events }));
          pendingCallerStates.push(host.get("request-delivery"));
          const child = children.live.find((entry) => entry.taskId === childId);
          if (child?.status === "pending" && child.summary?.includes("Verification prerequisite unavailable")) {
            // The App repairs the prerequisite. The existing controller retries
            // the same child at its saved deadline without a separate unblock decision.
            repaired = true;
            return {
              state: "waiting",
              summary: "Prerequisite repaired; verify the same child again",
              evidence: ["test:prerequisite-repaired"],
            };
          }
          if (child?.status === "done") {
            return {
              state: "converged",
              summary: "Owner accepted the verified delivery",
              response: "Delivered and independently verified.",
              evidence: ["test:aggregate-accepted"],
            };
          }
          return {
            state: "waiting",
            summary: "Verify the delivery before accepting it",
            evidence: ["test:verification-required"],
            actions: [
              {
                kind: "create-task",
                id: childId,
                parentId,
                outcome: "Verify the delivery",
                acceptance: ["Verification passes"],
                mode: "achieve",
                outputs: [],
                priority: "P2",
                executor: "verify",
              },
            ],
          };
        },
        verify: async () => {
          childCalls += 1;
          if (!repaired) throw new Error("Verification prerequisite unavailable");
          return {
            state: "converged",
            summary: "Delivery verification passed",
            evidence: ["test:verification-passed"],
          };
        },
      };
      const app = defineApp({
        ...definition(),
        task: () => ({
          kind: "desired" as const,
          intent: {
            id: parentId,
            parentId: "operations",
            outcome: "Deliver a verified result",
            acceptance: ["Owner accepts the verified delivery"],
            mode: "achieve" as const,
            executor: "owner",
          },
        }),
      });
      const install = async (controllers: boolean) => {
        await installCoreTaskRuntimes({
          ...options(f, bus),
          hostCapacity: new HostCapacity(1),
          installControllers: controllers,
          executors,
          appRegistrySnapshot: {
            id: "boot:parent-review",
            generation: 1,
            entries: [{ appDir: f.appDir, definition: app }],
          },
        });
        host = new AppInboxHost({
          db: getDb(persistDir),
          apps: [app],
          attachTask: async (input) => {
            if (controllers) return attachLoadedAppTask({ ...input, bus, appDir: f.appDir });
            if (!input.claim) throw new Error("expected request claim");
            return attachRequestToTask(loadedTaskConfig(f), { ...input, claim: input.claim });
          },
          readDependency: async ({ dependency }) => {
            const task = readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: dependency.id });
            return task
              ? {
                  ...dependency,
                  status: task.status,
                  summary: task.summary,
                  response: task.response,
                  result: task.result,
                  evidence: task.evidence,
                }
              : null;
          },
        });
      };
      await install(!restart);
      host!.admit({
        id: "request-delivery",
        appId: "sample",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      });
      expect(await host!.reconcileOnce("sample")).toMatchObject({ admitted: 1, errors: [] });

      if (restart) {
        const run = (taskId: string) =>
          reconcileLoadedAppTaskOnce({
            bus,
            appId: "sample",
            taskId,
            dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
          });
        await run(parentId);
        expect(await run(childId)).toEqual([parentId]);
        const config = loadedTaskConfig(f);
        expect(config.resourceStore.readTask(childId)?.status).toMatchObject({
          phase: "pending",
          executionFailures: 1,
        });
        expect(config.resourceStore.readTask(parentId)?.status.phase).toBe("waiting");
        const parentTrigger = readTaskSnapshot(config).taskTriggers?.[parentId];
        expect(parentTrigger?.events).toHaveLength(1);
        for (let index = 0; index < 3; index += 1) expect(await run(childId)).toEqual([]);
        expect(childCalls).toBe(1);
        expect(readTaskSnapshot(config).taskTriggers?.[parentId]).toEqual(parentTrigger);
        expect(await host!.recoverTaskDependencies()).toMatchObject({ woken: 0, errors: [] });
        expect(host!.readyCount("sample")).toBe(0);
        // Drop all in-memory wake hints before the owner reviews the failure.
        // Startup must find the persisted parent trigger, not rerun the child.
        await closeInstalledAppTaskRuntimes(bus);
        closeDb(persistDir);
        bus = eventBus();
        await install(true);
      }

      const config = loadedTaskConfig(f);
      const deadline = Date.now() + 5_000;
      while (
        readAcceptedRuntimeAttempt(config, parentId)?.acceptedResult?.state !== "converged" &&
        Date.now() < deadline
      )
        await Bun.sleep(5);
      expect(readAcceptedRuntimeAttempt(config, parentId)?.acceptedResult?.summary).toBe(
        "Owner accepted the verified delivery",
      );
      expect(childCalls).toBe(2);
      expect(reviews).toHaveLength(3);
      expect(reviews[1]!.children.live).toContainEqual(
        expect.objectContaining({
          taskId: childId,
          generation: 1,
          status: "pending",
          summary: expect.stringContaining("Verification prerequisite unavailable"),
        }),
      );
      expect(JSON.stringify(reviews[1]!.events)).toContain("Verification prerequisite unavailable");
      expect(reviews[2]!.children.live).toContainEqual(
        expect.objectContaining({
          taskId: childId,
          generation: 1,
          status: "done",
          summary: "Delivery verification passed",
          evidence: ["test:verification-passed"],
        }),
      );
      expect(pendingCallerStates).toHaveLength(3);
      for (const item of pendingCallerStates) {
        expect(item).toMatchObject({ status: "handling", waitingOn: { kind: "task", id: parentId } });
      }
      expect(host!.readyCount("sample")).toBe(1);
      expect(await host!.reconcileOnce("sample")).toMatchObject({ admitted: 1, errors: [] });
      expect(host!.get("request-delivery")).toMatchObject({
        status: "done",
        result: {
          summary: "Owner accepted the verified delivery",
          response: "Delivered and independently verified.",
          evidence: ["test:aggregate-accepted"],
        },
      });
      const snapshot = readTaskSnapshot(config);
      expect(Object.keys(snapshot.resources ?? {}).sort()).toEqual([parentId, childId].sort());
      expect(Object.keys(snapshot.receipts ?? {})).toEqual([]);
      expect(config.resourceStore.isCancelled(parentId)).toBe(false);
      expect(config.resourceStore.isCancelled(childId)).toBe(false);
      expect(Object.values(snapshot.attempts ?? {}).filter((attempt) => attempt.taskId === childId)).toHaveLength(2);
      for (let index = 0; index < 3; index += 1) await recoverInstalledAppTasks(bus);
      expect(reviews).toHaveLength(3);
      expect(childCalls).toBe(2);
    },
  );

  it.each(["normal", "direct-agent"])(
    "retains a worker failure report and resumes the same input after reopen (%s)",
    async (route) => {
      setSystemTime(new Date());
      const f = fixture();
      let bus = eventBus();
      const persistDir = join(f.root, "state");
      const taskId = "work/optional";
      const decision = {
        state: "stopped" as const,
        summary: "Optional feature is not feasible",
        evidence: ["analysis:feasibility"],
        result: { partial: "Feasibility findings" },
      };
      let repaired = false;
      let calls = 0;
      const currentOutcome = () =>
        repaired
          ? {
              state: "converged" as const,
              summary: "Feature verified",
              evidence: ["test:feature"],
              result: { feature: "working" },
            }
          : decision;
      const agents: TaskAgentRunner = {
        available: () => true,
        prepare: async () => true,
        role: (agent) => ({ agent, instructions: "Finish the assigned feature" }),
        snapshot: () => agents,
        async execute(attempt) {
          calls++;
          if (repaired) expect(attempt.attempt.previousAttempt?.acceptedResult).toMatchObject(decision);
          return { handlerResult: { ...currentOutcome(), actions: [] }, runId: null };
        },
      };
      const app = defineApp({
        ...definition(),
        task: () => ({
          kind: "desired" as const,
          intent: {
            id: taskId,
            parentId: "operations",
            outcome: "Build optional feature",
            acceptance: ["Feature works"],
            mode: "achieve" as const,
            ...(route === "normal" ? { executor: "fixture" } : {}),
          },
        }),
      });
      const install = () =>
        installCoreTaskRuntimes({
          ...options(f, bus),
          installControllers: false,
          agents,
          executors: {
            fixture: async (attempt) => {
              calls++;
              if (repaired) expect(attempt.previousAttempt?.acceptedResult).toMatchObject(decision);
              return currentOutcome();
            },
          },
          appRegistrySnapshot: {
            id: "boot:failure-report",
            generation: 1,
            entries: [{ appDir: f.appDir, definition: app }],
          },
        });
      await install();
      const config = loadedTaskConfig(f);
      const createHost = (state: AppTaskContext) =>
        new AppInboxHost({
          db: state.resourceStore.db,
          apps: [app],
          attachTask: async (input) => {
            if (!input.claim) throw new Error("expected input claim");
            return attachRequestToTask(state, { ...input, claim: input.claim });
          },
          readDependency: ({ dependency, admissionKey }) =>
            createAppTaskCapability({ bus }).readDependency({
              appDir: f.appDir,
              dependency,
              admissionKey,
            }),
        });
      const host = createHost(config);
      host.admit({
        id: "request-feature",
        appId: "sample",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      });
      expect(await host.reconcileOnce("sample")).toMatchObject({ admitted: 1, errors: [] });
      const run = () =>
        reconcileLoadedAppTaskOnce({
          bus,
          appId: "sample",
          taskId,
          dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
        });
      const events: AgentEvent[] = [];
      bus.subscribe((event) => events.push(event));
      expect(await run()).toEqual([]);
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "app.dependency.updated",
          data: expect.objectContaining({ id: taskId }),
        }),
      );
      expect(events).not.toContainEqual(expect.objectContaining({ type: "app.dependency.completed" }));
      const reported = readAcceptedRuntimeAttempt(config, taskId)!;
      expect(reported.acceptedResult).toMatchObject(decision);
      expect(config.resourceStore.isCancelled(taskId)).toBe(false);
      expect(host.readyCount("sample")).toBe(0);
      expect(host.get("request-feature")).toMatchObject({
        status: "handling",
        waitingOn: { kind: "task", id: taskId },
      });
      const admissionKey = host.get("request-feature")!.taskAdmissionKey!;
      expect(readLoadedAppTaskInputResult({ bus, appDir: f.appDir, taskId, admissionKey })).toBeNull();

      await closeInstalledAppTaskRuntimes(bus);
      closeDb(persistDir);
      bus = eventBus();
      await install();
      const reopened = loadedTaskConfig(f);
      const resumedHost = createHost(reopened);
      recordAppTaskTrigger(reopened, taskId, { type: "sample.wake", eventId: 88 });
      for (let index = 0; index < 3; index++) {
        await recoverInstalledAppTasks(bus);
        expect(await run()).toEqual([]);
      }
      expect(calls).toBe(1);
      expect(reopened.resourceStore.readAttempt(reported.metadata.id)).toEqual(reported);
      expect(Object.values(readTaskSnapshot(reopened).attempts ?? {})).toHaveLength(1);
      const tasks = new HumanTaskService(getDb(persistDir), {
        snapshot: () => ({ id: "failure:read", generation: 1, entries: [{ appDir: f.appDir, definition: app }] }),
      });
      expect(tasks.getTask({ appId: "sample", taskId })).toMatchObject({
        status: "pending",
        terminal: false,
        result: decision.result,
        evidence: decision.evidence,
        summary: expect.stringContaining("continuing after backoff"),
      });
      repaired = true;
      advanceRuntimeTaskRetry(reopened, taskId);
      await run();
      expect(calls).toBe(2);
      expect(readLoadedAppTaskInputResult({ bus, appDir: f.appDir, taskId, admissionKey })).toMatchObject({
        state: "converged",
        summary: "Feature verified",
        result: { feature: "working" },
      });
      expect(await resumedHost.reconcileOnce("sample")).toMatchObject({ admitted: 1, errors: [] });
      expect(resumedHost.get("request-feature")).toMatchObject({
        status: "done",
        result: { summary: "Feature verified" },
      });
      expect(reopened.resourceStore.isCancelled(taskId)).toBe(false);
      expect(tasks.getTask({ appId: "sample", taskId })?.result).toEqual({ feature: "working" });
      expect(reopened.resourceStore.readAttempt(reported.metadata.id)).toEqual(reported);
      expect(reopened.resourceStore.readReceipt(taskId)).toBeNull();
    },
  );

  it("counts failed executions once when another connection admits input during failure persistence", async () => {
    const f = fixture();
    const bus = eventBus();
    let calls = 0;
    await installCoreTaskRuntimes({
      ...options(f, bus),
      installControllers: false,
      executors: {
        broken: async () => {
          calls++;
          throw new Error("fixture execution failed");
        },
      },
      appRegistrySnapshot: {
        id: "boot:failure-contention",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    const config = loadedTaskConfig(f);
    const taskId = "work/failure-contention";
    observeAppTaskIntent(config, {
      appAgent: "sample-owner",
      intent: {
        id: taskId,
        parentId: "operations",
        outcome: "Bound genuine failures despite new input",
        acceptance: ["Failures remain counted"],
        mode: "achieve",
        executor: "broken",
      },
      trigger: { type: "sample.work", eventId: 100 },
    });
    const db = openDatabase(join(f.root, "state", "may.db"));
    const concurrent = appTaskContext({
      appDir: f.appDir,
      projectDir: f.appDir,
      agent: "sample-owner",
      maxConcurrent: 1,
      resourceStore: AppTaskResourceStore.activeFromDb(db, "sample")!,
    });
    const commit = AppTaskResourceStore.prototype.commit;
    const racedAttempts = new Set<string>();
    let saves = 0;
    AppTaskResourceStore.prototype.commit = function (mutation) {
      const failure = mutation.attempts?.find(
        (attempt) =>
          attempt.taskId === taskId && attempt.state === "failed" && attempt.failureReason === "HandlerExecutionFailed",
      );
      if (failure) {
        saves++;
        if (!racedAttempts.has(failure.metadata.id)) {
          racedAttempts.add(failure.metadata.id);
          recordAppTaskTrigger(concurrent, taskId, { type: "sample.changed", eventId: 100 + racedAttempts.size });
        }
      }
      return commit.call(this, mutation);
    };
    try {
      for (let index = 0; index < 4; index++) {
        if (index) advanceRuntimeTaskRetry(config, taskId);
        await reconcileLoadedAppTaskOnce({
          bus,
          appId: "sample",
          taskId,
          dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
        }).catch(() => {});
      }
    } finally {
      AppTaskResourceStore.prototype.commit = commit;
      db.close();
    }
    expect(calls).toBe(4);
    expect(racedAttempts.size).toBe(4);
    expect(saves).toBe(8); // Each failed transaction is retried, not the executor.
    expect(config.resourceStore.readTask(taskId)?.status).toMatchObject({ phase: "pending", executionFailures: 4 });
    const tree = readTaskSnapshot(config);
    expect(Object.values(tree.attempts ?? {})).toHaveLength(4);
    for (const attempt of Object.values(tree.attempts ?? {})) {
      expect(attempt).toMatchObject({ state: "failed", failureReason: "HandlerExecutionFailed" });
    }
    expect(tree.taskTriggers?.[taskId]?.events?.map((entry) => entry.event.eventId).sort()).toEqual([
      100, 101, 102, 103, 104,
    ]);
  });

  it("persists retry backoff across independent wakes and a fresh process", async () => {
    const f = fixture();
    const bus = eventBus();
    let calls = 0;
    await installCoreTaskRuntimes({
      ...options(f, bus),
      installControllers: false,
      executors: {
        broken: async () => {
          calls += 1;
          throw new Error("fixture execution failed");
        },
      },
      appRegistrySnapshot: {
        id: "boot:durable-retry",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    const config = loadedTaskConfig(f);
    const taskId = "work/bounded-retry";
    observeAppTaskIntent(config, {
      appAgent: "sample-owner",
      intent: {
        id: taskId,
        parentId: "operations",
        outcome: "Finish despite transient failures",
        acceptance: ["The result is verified"],
        mode: "achieve",
        executor: "broken",
      },
      trigger: { type: "sample.work", eventId: 100, data: { itemId: "bounded-retry" } },
    });
    const run = () =>
      reconcileLoadedAppTaskOnce({
        bus,
        appId: "sample",
        taskId,
        dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
      });
    // Each call is an independent wake, not a controller's own retry timer.
    for (let index = 0; index < 5; index += 1) {
      if (index) advanceRuntimeTaskRetry(config, taskId);
      await run().catch(() => {});
      const failureCount = calls;
      await run();
      expect(calls).toBe(failureCount);
    }
    expect(calls).toBe(5);
    const cooling = config.resourceStore.readTask(taskId)!;
    expect(cooling.status.phase).toBe("pending");
    expect(cooling.status.executionRetryAt).toBeGreaterThan(Date.now());
    expect(readTaskSnapshot(config).taskTriggers?.[taskId]?.events).toEqual([
      expect.objectContaining({ event: expect.objectContaining({ eventId: 100 }) }),
    ]);
    expect(Object.values(readTaskSnapshot(config).attempts ?? {})).toHaveLength(5);

    // A new diagnostic/event ID cannot shorten the persisted cooldown.
    recordAppTaskTrigger(config, taskId, { type: "sample.diagnostic", eventId: 101, data: {} });
    expect(
      config.resourceStore
        .readTaskContext({ taskIds: [taskId] })
        .taskTriggers?.[taskId]?.events?.map((entry) => entry.event.eventId),
    ).toEqual([100, 101]);
    await run();
    expect(calls).toBe(5);
    const coolingVersion = config.resourceStore.readTask(taskId)!.metadata.resourceVersion;
    await run();
    expect(
      config.resourceStore
        .readTaskContext({ taskIds: [taskId] })
        .taskTriggers?.[taskId]?.events?.map((entry) => entry.event.eventId),
    ).toEqual([100, 101]);
    expect(config.resourceStore.readTask(taskId)!.metadata.resourceVersion).toBe(coolingVersion);

    await closeInstalledAppTaskRuntimes(bus);
    closeDb(join(f.root, "state"));
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--eval",
        `
      import { getDb, closeDb } from ${JSON.stringify(new URL("../../../lib/requests.ts", import.meta.url).pathname)};
      import { AppTaskResourceStore } from ${JSON.stringify(new URL("../state/app-task-resource-store.ts", import.meta.url).pathname)};
      import { appTaskContext, claimObservedAppTask } from ${JSON.stringify(new URL("./app-task-reconciler.ts", import.meta.url).pathname)};
      const persistDir = ${JSON.stringify(join(f.root, "state"))};
      // This probe is a Task worker, not a second Host schema owner.
      const resourceStore = AppTaskResourceStore.activeFromDb(getDb(persistDir, { existingSchemaOnly: true }), "sample");
      const config = appTaskContext({ appDir: ${JSON.stringify(f.appDir)}, projectDir: ${JSON.stringify(f.appDir)}, agent: "sample-owner", maxConcurrent: 1, resourceStore });
      const result = claimObservedAppTask(config, { taskId: ${JSON.stringify(taskId)}, appAgent: "sample-owner", handler: "auto", reason: "attempt-recovery" });
      console.log(JSON.stringify({ kind: result.kind, attempts: Object.keys(resourceStore.readSnapshot().attempts).length }));
      closeDb(persistDir);
    `,
      ],
      { timeout: 10_000 },
    );
    expect(JSON.parse(stdout)).toEqual({ kind: "waiting", attempts: 5 });

    const restarted = loadedTaskConfig(f);
    expect(
      restarted.resourceStore
        .readTaskContext({ taskIds: [taskId] })
        .taskTriggers?.[taskId]?.events?.map((entry) => entry.event.eventId),
    ).toEqual([100, 101]);
    advanceRuntimeTaskRetry(restarted, taskId);
    expect(
      restarted.resourceStore
        .readTaskContext({ taskIds: [taskId] })
        .taskTriggers?.[taskId]?.events?.map((entry) => entry.event.eventId),
    ).toEqual([100, 101]);
    const retry = claimObservedAppTask(restarted, { taskId, appAgent: "sample-owner", handler: "auto" });
    expect(retry.kind).toBe("claimed");
    if (retry.kind !== "claimed") throw new Error("expected due retry");
    expect(retry.generation).toBe(1);
    expect(retry.events.map((entry) => entry.event.eventId)).toEqual([100, 101]);
    expect(completeAppTask(restarted, retry, { summary: "Repair verified", evidence: ["test:verified"] }).status).toBe(
      "applied",
    );
  });

  it("retries the same Task after an executor process failure", async () => {
    const f = fixture();
    const bus = eventBus();
    let calls = 0;

    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        "codex-goal": async (attempt) => {
          calls += 1;
          expect(attempt.task.id).toBe("work/resume-codex-goal");
          if (calls === 1) throw new Error("temporary Codex process failure");
          return {
            state: "converged",
            summary: "The same Task resumed and completed",
            evidence: ["test:same-task-resumed"],
          };
        },
      },
      appRegistrySnapshot: {
        id: "boot:resume-codex-goal",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/resume-codex-goal",
          parentId: "operations",
          outcome: "Finish one goal despite a process restart",
          acceptance: ["The same Task reaches an accepted result"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "codex-goal",
        },
      },
      idempotencyKey: "attach:resume-codex-goal",
      request: {
        id: "request-resume-codex-goal",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    const config = loadedTaskConfig(f);
    const deadline = Date.now() + 3_000;
    while (!readAcceptedRuntimeAttempt(config, "work/resume-codex-goal")?.acceptedResult && Date.now() < deadline) {
      await Bun.sleep(5);
    }

    const tree = readTaskSnapshot(config);
    expect(calls).toBe(2);
    expect(readAcceptedRuntimeAttempt(config, "work/resume-codex-goal")?.acceptedResult).toMatchObject({
      summary: "The same Task resumed and completed",
      evidence: ["test:same-task-resumed"],
    });
    expect(Object.values(tree.attempts ?? {}).filter((attempt) => attempt.taskId === "work/resume-codex-goal")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ state: "failed", failureReason: "HandlerExecutionFailed" }),
        expect.objectContaining({ state: "completed" }),
      ]),
    );
  });

  it("schedules unexpected exact-task input without replacing outstanding waits", async () => {
    const f = fixture();
    const bus = eventBus();
    const taskId = "work/open-waits";
    const conditions = [
      {
        id: "ci",
        type: "pipeline-run.state",
        subject: "pipeline-run:42",
        expected: "completed",
        owner: "app:ci",
        reviewAfterMs: 60_000,
      },
      {
        id: "review",
        type: "project.task.reconciled",
        subject: "task:review",
        expected: "done",
        owner: "app:review",
        reviewAfterMs: 120_000,
      },
    ];
    const batches: string[][] = [];
    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        waiting: async (attempt) => {
          batches.push(attempt.events.items.map((item) => item.event.type));
          if (batches.length === 2) {
            const newer = {
              type: "sample.update-during-attempt",
              source: "test",
              target: { appId: "sample", taskId },
              data: { revision: 3 },
            } as AgentEvent;
            Object.defineProperty(newer, EVENT_ROW_ID, { value: 1235 });
            expect(
              admitLoadedCanonicalAppTaskEvent({ bus, appId: "sample", event: newer, intent: null, targetedTaskId: taskId }),
            ).toMatchObject({ accepted: true });
          }
          return { state: "waiting", summary: "External facts still outstanding", evidence: [], conditions };
        },
      },
      appRegistrySnapshot: {
        id: "boot:open-waits",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });
    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: taskId,
          parentId: "operations",
          outcome: "Reconcile current facts",
          acceptance: ["Both facts verified"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "waiting",
        },
      },
      idempotencyKey: "attach:open-waits",
      request: {
        id: "request-open-waits",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });
    const config = loadedTaskConfig(f);
    const waitForPass = async (count: number) => {
      const deadline = Date.now() + 3_000;
      while (
        (batches.length < count || readTaskSnapshot(config).resources?.[taskId]?.status.phase !== "waiting") &&
        Date.now() < deadline
      )
        await Bun.sleep(5);
      expect(batches).toHaveLength(count);
      expect(readTaskSnapshot(config).resources?.[taskId]?.status.phase).toBe("waiting");
    };
    await waitForPass(1);
    const before = readTaskSnapshot(config).conditions;
    const feedback = {
      type: "sample.unexpected-update",
      source: "test",
      owner: "agent:sample-owner",
      target: { appId: "sample", taskId },
      data: { revision: 2 },
    } as AgentEvent;
    Object.defineProperty(feedback, EVENT_ROW_ID, { value: 1234 });
    expect(
      admitLoadedCanonicalAppTaskEvent({ bus, appId: "sample", event: feedback, intent: null, targetedTaskId: taskId }),
    ).toMatchObject({ accepted: true });
    await waitForPass(3);
    expect(batches[1]).toEqual(["sample.unexpected-update"]);
    expect(batches[2]).toEqual(["sample.update-during-attempt"]);
    expect(readTaskSnapshot(config).conditions).toEqual(before);
    expect(readTaskSnapshot(config).resources?.[taskId]?.metadata.generation).toBe(1);
    expect(readTaskSnapshot(config).resources?.[taskId]?.status.conditionIds).toEqual(["ci", "review"]);
  });

  it("coalesces an exact-task event storm into bounded fresh reconciliations", async () => {
    const f = fixture();
    const bus = eventBus();
    let nextEventId = 1;
    bus.setPersistenceSubscriber((event) => {
      Object.defineProperty(event, EVENT_ROW_ID, { value: nextEventId++, configurable: true });
    });
    let calls = 0;
    const followUpBatchSizes: number[] = [];
    let releaseFirst = () => {};
    let announceFirst = () => {};
    const firstStarted = new Promise<void>((resolve) => {
      announceFirst = resolve;
    });
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    await installAppTaskRuntimes({
      ...options(f, bus),
      executors: {
        storm: async (attempt) => {
          calls += 1;
          if (calls === 1) {
            announceFirst();
            await firstBlocked;
          } else {
            followUpBatchSizes.push(
              attempt.events.items.filter((item) => item.event.type === "sample.feedback").length,
            );
          }
          return {
            state: "converged",
            summary: "Event storm was reconciled",
            evidence: [`test:storm:${calls}`],
          };
        },
      },
      appRegistrySnapshot: {
        id: "boot:event-storm",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/event-storm",
          parentId: "operations",
          outcome: "Reconcile every exact feedback event",
          acceptance: ["Every linked event is observed"],
          mode: "achieve",
          agent: "sample-owner",
          executor: "storm",
        },
      },
      idempotencyKey: "attach:event-storm",
      request: {
        id: "request-event-storm",
        source: { kind: "human", id: "operator" },
        input: { kind: "sample", data: {} },
      },
    });

    await firstStarted;
    const admissions = [];
    for (let index = 0; index < 64; index++) {
      const feedback = {
        type: "sample.feedback",
        source: "test",
        owner: "agent:sample-owner",
        target: { appId: "sample", taskId: "work/event-storm" },
        data: { index },
      } as AgentEvent;
      // Model the durable EventHub boundary: persistence assigns the row id
      // before the exact Task route links and wakes the owner.
      Object.defineProperty(feedback, EVENT_ROW_ID, { value: nextEventId++, configurable: true });
      admissions.push(
        admitLoadedCanonicalAppTaskEvent({
          bus,
          appId: "sample",
          event: feedback,
          intent:
            index === 0
              ? {
                  id: "work/event-storm",
                  parentId: "operations",
                  outcome: "Incorrectly replace the existing goal from a feedback event",
                  acceptance: ["This replacement must be ignored"],
                  mode: "achieve",
                  agent: "sample-owner",
                  executor: "storm",
                }
              : null,
          targetedTaskId: "work/event-storm",
        }),
      );
    }
    releaseFirst();
    expect(admissions).toHaveLength(64);
    expect(admissions.every((admission) => admission?.accepted && admission.route === "direct")).toBeTrue();

    const config = loadedTaskConfig(f);
    const deadline = Date.now() + 3_000;
    while (!readAcceptedRuntimeAttempt(config, "work/event-storm")?.acceptedResult && Date.now() < deadline)
      await Bun.sleep(5);

    expect(calls).toBe(3);
    expect(followUpBatchSizes).toEqual([32, 32]);
    expect(readAcceptedRuntimeAttempt(config, "work/event-storm")).toMatchObject({
      handler: "executor:storm",
      acceptedResult: { summary: "Event storm was reconciled", evidence: ["test:storm:3"] },
    });
    expect(config.resourceStore.readTask("work/event-storm")?.spec.outcome).toBe(
      "Reconcile every exact feedback event",
    );
  });

  it("keeps task admission durable while paused without starting reconciliation", async () => {
    const f = fixture();
    const bus = eventBus();
    activateTaskResources(
      appTaskTestContext({
        appDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
        lifecycle: "paused",
      }),
      join(f.root, "state"),
    );
    await installAppTaskRuntimes({
      ...options(f, bus),
      appRegistrySnapshot: {
        id: "boot:paused",
        generation: 1,
        entries: [{ appDir: f.appDir, definition: definition() }],
      },
    });

    const request: Readonly<AppInputContext> = {
      id: "request-paused",
      source: { kind: "human", id: "operator" },
      input: { kind: "sample", data: {} },
    };
    const attached = await attachLoadedAppTask({
      bus,
      appDir: f.appDir,
      appId: "sample",
      attachment: {
        kind: "desired",
        intent: {
          id: "work/paused-attachment",
          parentId: "operations",
          outcome: "Retain work while paused",
          acceptance: ["Work runs after resume"],
          mode: "achieve",
        },
      },
      idempotencyKey: "attach:paused",
      request,
    });
    expect(attached.taskId).toBe("work/paused-attachment");

    const largePayload = "x".repeat(128 * 1024);
    const event = {
      type: "sample.work",
      source: "test",
      owner: "agent:sample-owner",
      timestamp: 1_787_500_000_000,
      data: { itemId: "paused-event", payload: largePayload },
    } as AgentEvent;
    Object.defineProperty(event, EVENT_ROW_ID, { value: 42, configurable: true });
    expect(
      admitLoadedCanonicalAppTaskEvent({
        bus,
        appId: "sample",
        event,
        intent: {
          id: "work/paused-event",
          parentId: "operations",
          outcome: "Retain event work while paused",
          acceptance: ["Work runs after resume"],
          mode: "achieve",
        },
      }),
    ).toMatchObject({ accepted: true, route: "direct" });
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: attached.taskId })).toMatchObject({
      id: "work/paused-attachment",
      status: "pending",
    });
    expect(readLoadedAppTaskView({ bus, appDir: f.appDir, taskId: "work/paused-event" })).toMatchObject({
      id: "work/paused-event",
      status: "pending",
    });
    const persisted = readTaskSnapshot(
      appTaskContext({
        appDir: f.appDir,
        projectDir: f.appDir,
        agent: "sample-owner",
        maxConcurrent: 1,
        resourceStore: AppTaskResourceStore.activeFromDb(getDb(join(f.root, "state")), "sample")!,
      }),
      { taskIds: ["work/paused-event"] },
    ).taskTriggers?.["work/paused-event"]?.event;
    expect(persisted).toMatchObject({
      type: "sample.work",
      eventId: 42,
      timestamp: 1_787_500_000_000,
      data: { itemId: "paused-event", payload: largePayload },
    });
    expect(persisted).not.toHaveProperty("payload");
    expect(JSON.stringify(persisted).split(largePayload).length - 1).toBe(1);
  });

  describe("terminal completion recovery", () => {
    function setup(beforeResult?: (taskId: string) => void) {
      const f = fixture();
      const bus = eventBus();
      const persistDir = join(f.root, "state");
      const config = loadedTaskConfig(f, persistDir);
      const payload = { verdict: "approved", operationId: "fixture-operation" };
      const terminalResult: NormalizedTaskHandlerResult = {
        state: "converged",
        summary: "Decision ready",
        response: "The result is ready",
        result: payload,
        evidence: ["fixture:decision"],
        actions: [],
      };
      let agentCalls = 0;
      const agents: TaskAgentRunner = {
        available: () => true,
        prepare: async () => true,
        snapshot: () => agents,
        role: (agent) => ({ agent, instructions: "Fixture" }),
        async execute(input) {
          agentCalls++;
          beforeResult?.(input.attempt.task.id);
          return { handlerResult: structuredClone(terminalResult), runId: null };
        },
      };
      const base = {
        projectsRoot: f.projectsRoot,
        projectRoot: f.root,
        persistDir,
        bus,
        hostCapacity: new HostCapacity(2),
        installControllers: false,
        agents,
        sessions: createTaskSessionRecovery({
          persistDir,
          bus,
          manager: { hasActiveSession: () => false } as never,
        }),
        appRegistrySnapshot: {
          id: "terminal-recovery:1",
          generation: 1,
          entries: [{ appDir: f.appDir, definition: definition() }],
        },
      };
      const observe = (id: string, workflow?: string) =>
        observeAppTaskIntent(config, {
          appAgent: "sample-owner",
          intent: {
            id,
            parentId: "operations",
            outcome: "Produce a checked decision",
            acceptance: ["Decision is checked and retained"],
            mode: "achieve",
            input: { operationId: payload.operationId },
            ...(workflow ? { workflow } : {}),
          },
        });
      const run = (taskId: string) =>
        reconcileLoadedAppTaskOnce({
          bus,
          appId: "sample",
          taskId,
          dispatch: { enqueuedAt: 1, startedAt: 2, readyWaitMs: 1, lane: "normal" },
        });
      const writeTerminalSession = (sessionId: string) => {
        writeSessionMeta(persistDir, sessionId, {
          agent: "sample-owner",
          task: "Produce a checked decision",
          status: "done",
          startedAt: Date.now(),
          endedAt: Date.now(),
        });
        writeFileSync(
          join(persistDir, "sessions", sessionId, "result.json"),
          JSON.stringify({
            status: "done",
            finishParams: {
              status: "success",
              result: {
                ...terminalResult,
                // Stored provider output follows the SDK contract, not Host normalization.
                ...(terminalResult.state === "stopped" ? { actions: undefined } : {}),
              },
            },
          }),
        );
      };
      const saveTerminalSession = (taskId: string) => {
        const claim = claimObservedAppTask(config, {
          taskId,
          appAgent: "sample-owner",
          handler: "auto",
          reason: "test",
        });
        if (claim.kind !== "claimed") throw new Error("expected agent claim");
        expect(claim.handler).toBe("agent:sample-owner");
        const sessionId = `session-${taskId}`;
        expect(recordAppTaskAttemptSession(config, claim, sessionId)).toBe(true);
        writeTerminalSession(sessionId);
        return claim;
      };
      return {
        base,
        config,
        payload,
        terminalResult,
        observe,
        run,
        saveTerminalSession,
        writeTerminalSession,
        agentCalls: () => agentCalls,
      };
    }

    async function requeueSavedAttempt(
      f: ReturnType<typeof setup>,
      claim: { taskId: string; attemptId: string },
      route: "startup" | "busy",
    ) {
      if (route === "startup") {
        mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
          attempt.runtimeId = "previous-runtime";
          attempt.lease!.runtimeId = "previous-runtime";
        });
        await recoverInstalledAppTasks(f.base.bus);
      } else {
        expect(await f.run(claim.taskId)).toEqual([]);
        expect(f.config.resourceStore.readTask(claim.taskId)?.status.currentAttemptId).toBe(claim.attemptId);
        mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
          attempt.lease!.expiresAt = new Date(Date.now() - 1_000).toISOString();
        });
        expect(await f.run(claim.taskId)).toContain(claim.taskId);
      }
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
    }

    it.each(["startup", "busy"] as const)(
      "retries uncommitted session output through %s before accepting effects",
      async (route) => {
        const f = setup();
        await installCoreTaskRuntimes(f.base);
        f.observe("owner");
        f.observe("other");
        admitTaskRequest(f.config, {
          appId: "sample",
          attachment: { kind: "existing", taskId: "owner" },
          idempotencyKey: "original-input",
          request: {
            id: "original-input",
            source: { kind: "app", id: "sample" },
            input: { kind: "work", data: { operationId: f.payload.operationId } },
          },
        });
        f.terminalResult.actions = [
          { kind: "update-task", taskId: "other", expectedGeneration: 1, acceptance: ["Uncommitted proposal"] },
        ];
        const claim = f.saveTerminalSession("owner");
        await requeueSavedAttempt(f, claim, route);
        expect(f.agentCalls()).toBe(0);
        expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
        expect(f.config.resourceStore.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
        expect(f.config.resourceStore.readTask("other")?.metadata.generation).toBe(1);
        expect(readTaskSnapshot(f.config).taskTriggers?.owner?.events?.[0]?.event.idempotencyKey).toBe(
          "original-input",
        );
        // The replacement judges current evidence; it need not repeat the old proposal.
        f.terminalResult.actions = [];
        await f.run("owner");
        const accepted = readAcceptedRuntimeAttempt(f.config, "owner");
        expect(accepted?.metadata.id).not.toBe(claim.attemptId);
        expect(accepted?.taskGeneration).toBe(claim.generation);
        expect(accepted?.acceptedResult?.result).toEqual(f.payload);
        expect(f.config.resourceStore.readTask("other")?.metadata.generation).toBe(1);
        expect(f.config.resourceStore.isCancelled("owner")).toBe(false);
        await closeInstalledAppTaskRuntimes(f.base.bus);
        closeDb(f.base.persistDir);
        await installCoreTaskRuntimes(f.base);
        await recoverInstalledAppTasks(f.base.bus);
        await f.run("owner");
        expect(f.agentCalls()).toBe(1);
      },
    );

    it.each(["startup", "busy"] as const)("requires confirmed session drain before %s redo", async (route) => {
      const f = setup();
      let drained = false;
      const sessions = createTaskSessionRecovery({
        persistDir: f.base.persistDir,
        bus: f.base.bus,
        manager: { hasActiveSession: () => false } as never,
        drainPersistedBashProcessGroups: () => drained,
      });
      await installCoreTaskRuntimes({ ...f.base, sessions });
      f.observe("owner");
      const claim = f.saveTerminalSession("owner");
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.lease!.expiresAt = new Date(Date.now() - 1_000).toISOString();
        if (route === "startup") {
          attempt.runtimeId = "previous-runtime";
          attempt.lease!.runtimeId = "previous-runtime";
        }
      });
      const recover = () => (route === "startup" ? recoverInstalledAppTasks(f.base.bus) : f.run("owner"));
      await expect(recover()).rejects.toThrow("did not exit");
      expect(f.config.resourceStore.readTask("owner")?.status.currentAttemptId).toBe(claim.attemptId);
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("running");
      expect(f.agentCalls()).toBe(0);
      drained = true;
      await recover();
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
      await f.run("owner");
      expect(f.agentCalls()).toBe(1);
    });

    it.each(["progress", "self-revision", "waiting", "stopped"] as const)(
      "handles %s without closing the Task",
      async (disposition) => {
        const addInput = (taskId: string) =>
          recordAppTaskTrigger(f.config, taskId, {
            type: "sample.feedback",
            eventId: 101,
            data: { instruction: "Check the new evidence" },
          });
        const f = setup(disposition === "progress" ? addInput : undefined);
        await installCoreTaskRuntimes(f.base);
        const taskId = "continued";
        f.observe(taskId);
        if (disposition === "self-revision") {
          f.terminalResult.actions = [
            {
              kind: "update-task",
              taskId,
              expectedGeneration: 1,
              acceptance: ["Decision includes the revised proof"],
            },
          ];
        } else if (disposition === "stopped") {
          f.terminalResult.state = "stopped";
          f.terminalResult.summary = "The optional experiment is not feasible";
          f.terminalResult.result = { feasible: false };
          delete f.terminalResult.response;
        } else if (disposition === "waiting") {
          f.terminalResult.state = "waiting";
          delete f.terminalResult.response;
          f.terminalResult.conditions = [
            {
              id: "external-proof",
              type: "sample.proof.ready",
              subject: "id:proof-1",
              expected: "ready",
              owner: "app:sample",
              reviewAfterMs: 60_000,
            },
          ];
        }
        const emitted: AgentEvent[] = [];
        f.base.bus.subscribe((event) => emitted.push(event));
        await f.run(taskId);
        expect(f.config.resourceStore.readReceipt(taskId)).toBeNull();
        expect(f.config.resourceStore.isCancelled(taskId)).toBe(false);
        expect(f.config.resourceStore.readTask(taskId)?.status.phase).toBe(
          disposition === "waiting" ? "waiting" : "pending",
        );
        if (disposition === "progress") {
          expect(f.config.resourceStore.readTask(taskId)?.status.result).toEqual(f.payload);
          expect(readTaskSnapshot(f.config).taskTriggers?.[taskId]?.events?.map((row) => row.event.eventId)).toEqual([
            101,
          ]);
        } else if (disposition === "self-revision") {
          expect(f.config.resourceStore.readTask(taskId)).toMatchObject({
            metadata: { generation: 1 },
            spec: { acceptance: ["Decision is checked and retained"] },
          });
          expect(readAcceptedRuntimeAttempt(f.config, taskId)?.acceptedResult).toBeUndefined();
          expect(emitted.filter((event) => event.type === "app.dependency.completed")).toHaveLength(0);
          expect(f.agentCalls()).toBe(1);
          // The rejected worker action cannot alter the assignment, but execution can redo safely.
          f.terminalResult.actions = [];
          if (f.config.resourceStore.readTask(taskId)?.status.executionRetryAt)
            advanceRuntimeTaskRetry(f.config, taskId);
          await f.run(taskId);
          expect(readAcceptedRuntimeAttempt(f.config, taskId)).toMatchObject({
            taskGeneration: 1,
            acceptedResult: { state: "converged", result: f.payload },
          });
          expect(f.config.resourceStore.isCancelled(taskId)).toBe(false);
          return;
        } else if (disposition === "stopped") {
          expect(f.config.resourceStore.readCancellation(taskId)).toBeNull();
          expect(readAcceptedRuntimeAttempt(f.config, taskId)?.acceptedResult).toMatchObject({
            state: "stopped",
            summary: "The optional experiment is not feasible",
            result: { feasible: false },
          });
          expect(f.config.resourceStore.readTask(taskId)?.status.executionRetryAt).toBeGreaterThan(Date.now());
        } else {
          expect(f.config.resourceStore.readTask(taskId)?.status.conditionIds).toEqual(["external-proof"]);
        }
        expect(
          emitted.filter((event) => event.type === "project.task.reconciled").map((event) => event.data.disposition),
        ).toEqual([disposition]);
        expect(emitted.filter((event) => event.type === "app.dependency.completed")).toHaveLength(0);
        expect(emitted.filter((event) => event.type === "app.dependency.updated").map((event) => event.data)).toEqual([
          { kind: "task", id: taskId, appId: "sample" },
        ]);
        expect(f.agentCalls()).toBe(1);
      },
    );

    it.each(["startup", "busy"] as const)(
      "replays an early external fact for a wait recovered through %s",
      async (route) => {
        const f = setup();
        const writer = new DbWriter(f.base.persistDir);
        const sourceBus = eventBus();
        sourceBus.setPersistenceSubscriber(writer.handler);
        await installCoreTaskRuntimes(f.base);
        f.observe("external-wait");
        f.terminalResult.state = "waiting";
        delete f.terminalResult.response;
        f.terminalResult.conditions = [
          {
            id: "proof-ready",
            type: "sample.proof.ready",
            subject: "id:proof-1",
            expected: "ready",
            owner: "app:sample",
            reviewAfterMs: 60_000,
          },
        ];
        const claim = f.saveTerminalSession("external-wait");
        // The source published before recovery could install the saved Condition.
        const fact = sourceBus.emit({
          type: "sample.proof.ready",
          source: "fixture",
          owner: "app:sample",
          target: { project: "sample" },
          data: { project: "sample", id: "proof-1", status: "ready" },
        } as AgentEvent);
        expect(fact[EVENT_ROW_ID]).toBeGreaterThan(0);
        await requeueSavedAttempt(f, claim, route);
        await f.run(claim.taskId);
        expect(readTaskSnapshot(f.config).conditions?.["proof-ready"]?.status.state).toBe("true");
        expect(f.config.resourceStore.readReceipt(claim.taskId)).toBeNull();
        expect(f.agentCalls()).toBe(1);
        f.terminalResult.state = "converged";
        delete f.terminalResult.conditions;
        await f.run(claim.taskId);
        expect(readAcceptedRuntimeAttempt(f.config, claim.taskId)?.acceptedResult?.result).toEqual(f.payload);
        expect(f.config.resourceStore.isCancelled(claim.taskId)).toBe(false);
        expect(f.agentCalls()).toBe(2);
        await recoverInstalledAppTasks(f.base.bus);
        await f.run(claim.taskId);
        expect(f.agentCalls()).toBe(2);
      },
    );

    it.each([
      ["converged", "drain"],
      ["waiting", "drain"],
      ["converged", "live owner"],
    ] as const)("retries uncommitted %s after failed %s cleanup and restart", async (state, failure) => {
      const f = setup();
      let drained = false;
      const interrupts: string[] = [];
      const sessions = createTaskSessionRecovery({
        persistDir: f.base.persistDir,
        bus: f.base.bus,
        manager: { hasActiveSession: () => false } as never,
        drainPersistedBashProcessGroups: (_root, id) => {
          interrupts.push(id);
          return drained;
        },
      });
      await installCoreTaskRuntimes({ ...f.base, sessions });
      f.observe("owner");
      f.observe("other");
      f.terminalResult.state = state;
      f.terminalResult.actions = [
        { kind: "update-task", taskId: "other", expectedGeneration: 1, acceptance: ["Use the revised proof"] },
      ];
      if (state === "waiting") {
        delete f.terminalResult.response;
        f.terminalResult.conditions = [
          {
            id: "proof-ready",
            type: "sample.proof.ready",
            subject: "id:proof-1",
            expected: "ready",
            owner: "app:sample",
            reviewAfterMs: 60_000,
          },
        ];
      }
      const claim = { taskId: "owner", attemptId: "" };
      const execute = f.base.agents.execute;
      f.base.agents.execute = async (input) => {
        claim.attemptId ||= input.attempt.attemptId;
        input.sessionStarted("session-owner");
        const result = await execute(input);
        f.writeTerminalSession("session-owner");
        return result;
      };
      const other = claimObservedAppTask(f.config, { taskId: "other", appAgent: "sample-owner", handler: "auto" });
      if (other.kind !== "claimed") throw new Error("expected other attempt");
      expect(recordAppTaskAttemptSession(f.config, other, "other-session")).toBeTrue();
      // A terminal marker is not proof that shell descendants exited.
      writeSessionMeta(f.base.persistDir, "other-session", {
        agent: "sample-owner",
        task: "Old proof",
        startedAt: Date.now(),
        ...(failure === "live owner"
          ? { status: "running" as const, detached: true, pid: process.pid }
          : { status: "done" as const }),
      });
      const emitted: AgentEvent[] = [];
      f.base.bus.subscribe((event) => emitted.push(event));
      await expect(f.run(claim.taskId)).rejects.toThrow(
        failure === "live owner" ? "external owner is still live" : "did not exit",
      );
      expect(f.config.resourceStore.readReceipt("owner")).toBeNull();
      expect(f.config.resourceStore.readTask("owner")?.status.currentAttemptId).toBe(claim.attemptId);
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("running");
      expect(f.config.resourceStore.readTask("owner")?.status.executionFailures ?? 0).toBe(0);
      expect(f.config.resourceStore.readTask("other")).toMatchObject({
        metadata: { generation: 1 },
        status: { phase: "running", currentAttemptId: other.attemptId },
      });
      expect(emitted.filter((event) => event.type.startsWith("app.dependency."))).toHaveLength(0);

      // Restart retries the uncommitted attempt; normal settlement applies its effects.
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.runtimeId = "previous-runtime";
        attempt.lease!.runtimeId = "previous-runtime";
      });
      await closeInstalledAppTaskRuntimes(f.base.bus);
      closeDb(f.base.persistDir);
      await installCoreTaskRuntimes({ ...f.base, sessions });
      drained = true;
      if (failure === "live owner") {
        writeSessionMeta(f.base.persistDir, "other-session", {
          agent: "sample-owner",
          task: "Old proof",
          status: "done",
          startedAt: Date.now(),
        });
      }
      await recoverInstalledAppTasks(f.base.bus);
      await f.run("owner");
      const store = AppTaskResourceStore.activeFromDb(getDb(f.base.persistDir), "sample")!;
      expect(interrupts).toEqual(
        failure === "live owner"
          ? ["session-owner", "other-session"]
          : ["other-session", "session-owner", "other-session"],
      );
      expect(store.readAttempt(other.attemptId)?.state).toBe("interrupted");
      expect(store.readTask("other")?.metadata.generation).toBe(2);
      expect(store.readAttempt(claim.attemptId)?.state).toBe("interrupted");
      expect(store.readAttempt(claim.attemptId)?.acceptedResult).toBeUndefined();
      expect(store.readAttempt(store.readTask("owner")!.status.observedAttemptId!)?.acceptedResult).toMatchObject({
        state,
        result: f.payload,
      });
      expect(store.isCancelled("owner")).toBe(false);
      expect(emitted.filter((event) => event.type.startsWith("app.dependency.")).map((event) => event.type)).toEqual([
        state === "converged" ? "app.dependency.completed" : "app.dependency.updated",
      ]);
      await recoverInstalledAppTasks(f.base.bus);
      expect(interrupts).toHaveLength(failure === "live owner" ? 2 : 3);
      expect(f.agentCalls()).toBe(2);
    });

    it.each(["converged", "waiting"] as const)(
      "settles %s actions and interrupts the superseded session",
      async (state) => {
        const f = setup();
        const interrupted: string[] = [];
        await installCoreTaskRuntimes({
          ...f.base,
          sessions: {
            ...f.base.sessions,
            isLive: (id) => id === "other-session",
            interrupt: (id) => {
              expect(f.config.resourceStore.readTask("other")?.metadata.generation).toBe(1);
              interrupted.push(id);
            },
          },
        });
        f.observe("owner");
        f.observe("other");
        f.terminalResult.state = state;
        f.terminalResult.actions = [
          { kind: "update-task", taskId: "other", expectedGeneration: 1, acceptance: ["Use the revised proof"] },
        ];
        if (state === "waiting") {
          delete f.terminalResult.response;
          f.terminalResult.conditions = [
            {
              id: "proof-ready",
              type: "sample.proof.ready",
              subject: "id:proof-1",
              expected: "ready",
              owner: "app:sample",
              reviewAfterMs: 60_000,
            },
          ];
        }
        const other = claimObservedAppTask(f.config, { taskId: "other", appAgent: "sample-owner", handler: "auto" });
        if (other.kind !== "claimed") throw new Error("expected other attempt");
        expect(recordAppTaskAttemptSession(f.config, other, "other-session")).toBeTrue();
        expect(await f.run("owner")).toContain("other");
        expect(interrupted).toEqual(["other-session"]);
        expect(f.config.resourceStore.readAttempt(other.attemptId)?.state).toBe("interrupted");
        expect(f.config.resourceStore.readTask("other")?.metadata.generation).toBe(2);
        expect(f.agentCalls()).toBe(1);
      },
    );

    it.each(["startup", "busy"] as const)("accepts a replacement direct-agent result through %s", async (route) => {
      const f = setup();
      await installCoreTaskRuntimes(f.base);
      f.observe("normal");
      await f.run("normal");
      f.observe("recovered");
      const claim = f.saveTerminalSession("recovered");
      await requeueSavedAttempt(f, claim, route);
      await f.run(claim.taskId);
      for (const taskId of ["normal", "recovered"]) {
        expect(readAcceptedRuntimeAttempt(f.config, taskId)?.acceptedResult).toMatchObject({
          result: f.payload,
          response: "The result is ready",
          acceptanceBasis: { method: "agent-judgment" },
        });
        expect(f.config.resourceStore.isCancelled(taskId)).toBe(false);
      }
      // Reading a settled Task must not execute or consume its session again.
      await recoverInstalledAppTasks(f.base.bus);
      await f.run(claim.taskId);
      expect(f.agentCalls()).toBe(2);
      expect(readAcceptedRuntimeAttempt(f.config, claim.taskId)?.taskGeneration).toBe(claim.generation);
    });

    for (const route of ["startup", "busy"] as const) {
      it.each(["accept", "reject", "missing"] as const)(
        `retries a terminal workflow handoff through ${route} with a %s verifier`,
        async (verification) => {
          const f = setup();
          let workflowCalls = 0;
          let verificationCalls = 0;
          let externalCreates = 0;
          const operations = new Set<string>();
          const workflows: TaskWorkflowRunner = {
            async inspect() {
              return {
                available: true,
                error: null,
                workspace: "shared",
                ...(verification === "missing"
                  ? {}
                  : {
                      verifier: {
                        name: "required-proof",
                        sourcePath: "fixture",
                        async verify() {
                          verificationCalls++;
                          return {
                            accepted: verification === "accept",
                            summary: "Fixture postcondition",
                            evidence: ["fixture:verified"],
                          };
                        },
                      },
                    }),
              };
            },
            async execute(input) {
              workflowCalls++;
              // The App checks its provider's operation identity before a write.
              // Runtime recovery must preserve that input, not invent a new key.
              const operationId = String(input.attempt.task.input.operationId);
              expect(operationId).toBe(f.payload.operationId);
              expect(input).not.toHaveProperty("claim");
              expect(input).not.toHaveProperty("intent");
              expect(input).not.toHaveProperty("declaredOutputPaths");
              if (!operations.has(operationId)) {
                operations.add(operationId);
                externalCreates++;
              }
              return {
                handlerResult: { state: "needs-agent", summary: "Check external operation", evidence: [], actions: [] },
                runId: "fixture-workflow",
              };
            },
          };
          await installCoreTaskRuntimes({ ...f.base, workflows });
          f.observe("handoff", "must-verify");
          await f.run("handoff");
          const claim = f.saveTerminalSession("handoff");
          expect(claim.handoff?.reason).toBe("needs-agent");
          expect(externalCreates).toBe(1);

          if (route === "startup") {
            mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
              attempt.runtimeId = "previous-runtime";
              attempt.lease!.runtimeId = "previous-runtime";
            });
            await recoverInstalledAppTasks(f.base.bus);
          } else {
            // A fresh lease may still belong to a live workflow caller.
            await f.run(claim.taskId);
            expect(f.config.resourceStore.readReceipt(claim.taskId)).toBeNull();
            expect(f.config.resourceStore.readTask(claim.taskId)?.status.currentAttemptId).toBe(claim.attemptId);
            mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
              attempt.lease!.expiresAt = new Date(Date.now() - 1_000).toISOString();
            });
            expect(await f.run(claim.taskId)).toContain(claim.taskId);
          }
          expect(f.config.resourceStore.readReceipt(claim.taskId)).toBeNull();
          expect(f.config.resourceStore.readTask(claim.taskId)?.status.phase).toBe("pending");
          expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
          // Exercise the replacement workflow and its sequential agent handoff.
          await f.run(claim.taskId);
          await f.run(claim.taskId);
          expect(workflowCalls).toBe(2);
          expect(externalCreates).toBe(1);
          expect(f.agentCalls()).toBe(1);
          expect(verificationCalls).toBe(verification === "missing" ? 0 : 1);
          if (verification === "accept") {
            expect(readAcceptedRuntimeAttempt(f.config, claim.taskId)).toMatchObject({
              taskGeneration: claim.generation,
              acceptedResult: {
                result: f.payload,
                acceptanceBasis: { method: "deterministic", verifier: "required-proof" },
              },
            });
          } else {
            expect(f.config.resourceStore.readReceipt(claim.taskId)).toBeNull();
            expect(f.config.resourceStore.readTask(claim.taskId)?.metadata.generation).toBe(claim.generation);
            expect(f.config.resourceStore.readTask(claim.taskId)?.status).toMatchObject({
              phase: "pending",
              summary:
                verification === "missing"
                  ? "Agent convergence was rejected because workflow must-verify handed off without a verifier"
                  : "Fixture postcondition",
            });
            expect(f.config.resourceStore.readTask(claim.taskId)?.status.executionRetryAt).toBeGreaterThan(Date.now());
          }
          expect(f.config.resourceStore.isCancelled(claim.taskId)).toBe(false);
          await f.run(claim.taskId);
          expect(workflowCalls).toBe(2);
          expect(f.agentCalls()).toBe(1);
        },
      );
    }
  });

});
