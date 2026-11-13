import { describe, expect, it } from "bun:test";
import { once } from "node:events";
import { spawnFixtureProcess } from "../../../../test/fixtures/owned-process.js";
import { markStaleSession } from "../../../../test/fixtures/stale-session.js";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineApp, type AppInputContext } from "@may-agent/sdk";
import { DbWriter } from "../../../lib/db-writer.js";
import { listTerminalTaskSessionBindings, upsertSession } from "../../../lib/db/sessions.js";
import { EVENT_ROW_ID, type AgentEvent } from "../events/bus.js";
import { startAppInboxRuntime } from "../../composition/app-inbox-runtime.js";
import { startBackgroundRuntime } from "../../composition/background-startup.js";
import { SubagentManager } from "../../../lib/manager.js";
import { admitTaskInput } from "../state/inbox.js";
import { AppRegistry } from "../apps/registry.js";
import { createAppTaskCapability } from "./app-task-capability.js";
import {
  admitLoadedCanonicalAppTaskEvent,
  admitStandaloneCanonicalAppTaskEvent,
  closeInstalledAppTaskRuntimes,
  installAppTaskRuntimes as installCoreTaskRuntimes,
  reconcileLoadedAppTaskOnce,
  recoverInstalledAppTasks,
  settleTerminalAppTaskSessions,
} from "./app-task-runtime.js";
import { createTaskSessionRecovery } from "../../adapters/executors/session-recovery.js";
import type { TaskAgentRunner, TaskWorkflowRunner, TaskSessionRecovery } from "./execution.js";
import type { NormalizedTaskHandlerResult } from "./result.js";
import {
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  observeAppTaskIntent,
  recordAppTaskTrigger,
  recordAppTaskAttemptSession,
  appTaskContext,
} from "./app-task-reconciler.js";
import { readTaskSnapshot } from "./app-task-store.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import { closeDb, getDb } from "../../../lib/db/connection.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import {
  addSessionBashProcessGroup,
  readSessionBashProcessGroups,
  writeSessionMeta,
} from "../../../lib/persistence.js";
import { appTaskRuntimeTestSuite } from "../../../../test/fixtures/app-task-runtime.js";

const {
  eventBus,
  fixture,
  definition,
  loadedTaskConfig,
  readAcceptedRuntimeAttempt,
  advanceRuntimeTaskRetry,
  mutateRuntimeAttemptFixture,
} = appTaskRuntimeTestSuite();

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
      facts: ["fixture:decision"],
      actions: [],
    };
    let agentCalls = 0;
    let previousAttemptSeen: import("@may-agent/sdk").TaskAttempt["previousAttempt"] | undefined;
    const agents: TaskAgentRunner = {
      available: () => true,
      prepare: async () => true,
      snapshot: () => agents,
      role: (agent) => ({ agent, instructions: "Fixture" }),
      async execute(input) {
        agentCalls++;
        previousAttemptSeen = input.attempt.previousAttempt;
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
    const observe = (id: string, workflow?: string, creatorTaskId?: string) =>
      observeAppTaskIntent(config, {
        appAgent: "sample-owner",
        ...(creatorTaskId ? { creator: { appId: "sample", taskId: creatorTaskId } } : {}),
        intent: {
          id,
          parentId: "operations",
          outcome: "Produce a checked decision",
          acceptance: ["Decision is checked and retained"],
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
    const writeTerminalSession = (
      sessionId: string,
      taskBinding: { appId: string; taskId: string; generation: number; attemptId: string },
    ) => {
      writeSessionMeta(persistDir, sessionId, {
        agent: "sample-owner",
        task: "Produce a checked decision",
        status: "done",
        startedAt: Date.now(),
        endedAt: Date.now(),
        taskBinding,
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
              ...(terminalResult.state === "incomplete" ? { actions: undefined } : {}),
            },
          },
        }),
      );
    };
    const saveTerminalSession = (taskId: string, handler = "auto") => {
      const claim = claimObservedAppTask(config, {
        taskId,
        appAgent: "sample-owner",
        handler,
        reason: "test",
      });
      if (claim.kind !== "claimed") throw new Error("expected agent claim");
      expect(claim.handler).toBe("agent:sample-owner");
      const sessionId = `session-${taskId}`;
      expect(recordAppTaskAttemptSession(config, claim, sessionId)).toBe(true);
      writeTerminalSession(sessionId, {
        appId: "sample",
        taskId: claim.taskId,
        generation: claim.generation,
        attemptId: claim.attemptId,
      });
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
      previousAttempt: () => previousAttemptSeen,
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

  it.each(["appId", "taskId", "generation", "attemptId", "damaged-status"] as const)(
    "controller recovery preserves the original claim when session %s is invalid",
    async (field) => {
      const f = setup();
      const touched: string[] = [];
      await installCoreTaskRuntimes({ ...f.base, sessions: createTaskSessionRecovery({
        persistDir: f.base.persistDir, bus: f.base.bus,
        manager: { hasActiveSession: () => true, cancel: () => touched.push("cancel") } as never,
        drainPersistedBashProcessGroups: () => { touched.push("drain"); return true; },
      }) });
      f.observe("owner");
      recordAppTaskTrigger(f.config, "owner", { type: "sample.changed", data: { instruction: "Continue work" } });
      const claim = f.saveTerminalSession("owner");
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.runtimeId = "previous-runtime";
        attempt.lease!.runtimeId = "previous-runtime";
      });
      const path = join(f.base.persistDir, "sessions", "session-owner", "meta.json");
      const meta = JSON.parse(readFileSync(path, "utf8"));
      if (field === "damaged-status") {
        meta.status = ["running"];
        meta.taskBinding.attemptId = "another-owner";
      } else
        meta.taskBinding[field] = field === "generation" ? claim.generation + 1 : "another-owner";
      const bytes = JSON.stringify(meta);
      writeFileSync(path, bytes);
      const before = readTaskSnapshot(f.config);
      await expect(f.run("owner")).rejects.toThrow("session Task binding");
      expect(readTaskSnapshot(f.config)).toEqual(before);
      expect(f.config.resourceStore.readTask("owner")?.status.currentAttemptId).toBe(claim.attemptId);
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("running");
      expect(touched).toEqual([]);
      expect(f.agentCalls()).toBe(0);
      expect(readFileSync(path, "utf8")).toBe(bytes);
    },
  );

  it.each((["startup", "claim"] as const).flatMap((route) =>
    (["missing", "unreadable", "invalid-status", "no-binding"] as const).map((metadata) => ({ route, metadata })),
  ))(
    "continues the retained Task through $route recovery with $metadata metadata",
    async ({ route, metadata }) => {
      const f = setup();
      await installCoreTaskRuntimes(f.base);
      f.observe("owner");
      recordAppTaskTrigger(f.config, "owner", { type: "sample.changed", data: { instruction: "Continue work" } });
      const claim = f.saveTerminalSession("owner");
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.runtimeId = "previous-runtime";
        attempt.lease!.runtimeId = "previous-runtime";
      });
      const directory = join(f.base.persistDir, "sessions", "session-owner");
      const result = readFileSync(join(directory, "result.json"), "utf8");
      const metadataPath = join(directory, "meta.json");
      const meta = JSON.parse(readFileSync(metadataPath, "utf8"));
      if (metadata === "invalid-status") meta.status = ["running"];
      if (metadata === "no-binding") delete meta.taskBinding;
      const bytes = metadata === "unreadable" ? '{"status":"running"' : JSON.stringify(meta);
      if (metadata === "missing") rmSync(metadataPath);
      else writeFileSync(metadataPath, bytes);
      writeFileSync(join(directory, "session.jsonl"), '{"role":"user","content":"First sample collected"}\n');

      if (route === "startup") await recoverInstalledAppTasks(f.base.bus);
      await f.run("owner");

      expect(f.agentCalls()).toBe(1);
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
      expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
      expect(f.previousAttempt()).toMatchObject({
        attemptId: claim.attemptId,
        sessionId: "session-owner",
        state: "interrupted",
      });
      if (metadata === "missing") expect(existsSync(metadataPath)).toBe(false);
      else expect(readFileSync(metadataPath, "utf8")).toBe(bytes);
      expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);
    },
  );

  it.each(["missing", "unreadable", "running", "done"] as const)(
    "startup preserves a live worker and its Task claim with %s metadata until the worker exits",
    async (metadata) => {
      const f = setup();
      const recoveryBus = eventBus();
      const gate = Promise.withResolvers<void>();
      const settled = Promise.withResolvers<void>();
      // Use the production startup entry point. Hold its asynchronous worker
      // recovery until the generic session scan has completed.
      await installCoreTaskRuntimes({ ...f.base, bus: recoveryBus });
      await installCoreTaskRuntimes({ ...f.base, executeRecovery: async () => {
        await gate.promise;
        await recoverInstalledAppTasks(recoveryBus);
      } });
      f.observe("owner");
      const claim = f.saveTerminalSession("owner");
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.runtimeId = "previous-runtime";
        attempt.lease!.runtimeId = "previous-runtime";
      });
      const sessionId = "session-owner";
      const directory = join(f.base.persistDir, "sessions", sessionId);
      const path = join(directory, "meta.json");
      const meta = JSON.parse(readFileSync(path, "utf8"));
      upsertSession(f.base.persistDir, {
        sessionId, agent: "sample-owner", task: "work", status: "running", startedAt: 1, taskBinding: meta.taskBinding,
      });
      if (metadata === "missing") rmSync(path);
      else writeFileSync(path, metadata === "unreadable" ? '{"status":' : JSON.stringify({ ...meta, status: metadata }));
      const result = readFileSync(join(directory, "result.json"), "utf8");
      const before = readTaskSnapshot(f.config);
      const worker = spawnFixtureProcess(["--eval", `
        import { markSessionActive } from ${JSON.stringify(fileURLToPath(new URL("../../../lib/persistence.ts", import.meta.url)))};
        import { writeFileSync } from "node:fs";
        markSessionActive(${JSON.stringify(f.base.persistDir)}, ${JSON.stringify(sessionId)});
        writeFileSync(${JSON.stringify(join(directory, "[STARTED]"))}, "started");
        console.log("ready");
        setInterval(() => {}, 1000);
      `]);
      const exited = once(worker, "exit");
      try {
        const ready = await Promise.race([
          once(worker.stdout, "data").then(([chunk]) => String(chunk)),
          exited.then(() => { throw new Error("Session owner exited before startup"); }),
        ]);
        expect(ready.trim()).toBe("ready");
        const active = readFileSync(join(directory, "[ACTIVE]"), "utf8");
        const manager = new SubagentManager({ persistDir: f.base.persistDir });
        startBackgroundRuntime({
          manager, bus: f.base.bus, persistDir: f.base.persistDir,
          onTaskRecoverySettled: () => settled.resolve(),
        });
        gate.resolve();
        await settled.promise;

        expect(readTaskSnapshot(f.config)).toEqual(before);
        expect(readFileSync(join(directory, "[ACTIVE]"), "utf8")).toBe(active);
        expect(existsSync(join(directory, "[STARTED]"))).toBe(true);
        expect(f.agentCalls()).toBe(0);
        expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);

        worker.kill("SIGTERM");
        await exited;
        await recoverInstalledAppTasks(f.base.bus);
        await f.run("owner");
        expect(f.agentCalls()).toBe(1);
        expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
        expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
        expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);
        expect(existsSync(join(directory, "[ACTIVE]"))).toBe(false);
      } finally {
        gate.resolve();
        worker.kill("SIGTERM");
        await exited;
      }
    },
  );

  it.each((["present", "missing"] as const).flatMap((projection) =>
    (["absent", "retained"] as const).map((conflict) => ({ projection, conflict })),
  ))("startup leaves conflicting $conflict attempt untouched with $projection SQL projection", async ({ projection, conflict }) => {
    const f = setup();
    const recoveryBus = eventBus();
    const gate = Promise.withResolvers<void>();
    const settled = Promise.withResolvers<void>();
    const failures: string[] = [];
    await installCoreTaskRuntimes({ ...f.base, bus: recoveryBus });
    await installCoreTaskRuntimes({ ...f.base, executeRecovery: async () => {
      await gate.promise;
      await recoverInstalledAppTasks(recoveryBus);
    } });
    f.base.bus.subscribe((event) => { if (event.type === "info") failures.push(JSON.stringify(event)); });
    f.observe("owner");
    const claim = f.saveTerminalSession("owner");
    mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
      attempt.lease!.runtimeId = "previous-runtime";
    });
    const sessionId = "session-owner";
    const directory = join(f.base.persistDir, "sessions", sessionId);
    const path = join(directory, "meta.json");
    const meta = JSON.parse(readFileSync(path, "utf8"));
    if (projection === "present") upsertSession(f.base.persistDir, {
      sessionId, agent: "sample-owner", task: "work", status: "running", startedAt: 1, taskBinding: meta.taskBinding,
    });
    if (conflict === "retained") {
      const other = structuredClone(f.config.resourceStore.readAttempt(claim.attemptId)!);
      other.metadata = { id: "another-attempt", resourceVersion: 1 };
      other.sessionId = "another-session";
      other.state = "interrupted";
      delete other.lease;
      const resource = f.config.resourceStore.readTask(claim.taskId)!;
      expect(f.config.resourceStore.commit({
        fences: [{ taskId: claim.taskId, resourceVersion: resource.metadata.resourceVersion,
          generation: resource.metadata.generation, currentAttemptId: claim.attemptId }],
        attempts: [other],
      })).toBe(true);
    }
    const bytes = JSON.stringify({ ...meta, taskBinding: { ...meta.taskBinding, attemptId: "another-attempt" } });
    writeFileSync(path, bytes);
    markStaleSession(f.base.persistDir, sessionId);
    writeFileSync(join(directory, "[STARTED]"), "started");
    const active = readFileSync(join(directory, "[ACTIVE]"), "utf8");
    const result = readFileSync(join(directory, "result.json"), "utf8");
    const before = readTaskSnapshot(f.config);
    const child = spawnFixtureProcess(["--eval", 'console.log("ready"); setInterval(() => {}, 1000);'], { detached: true });
    const exited = once(child, "exit");
    try {
      await Promise.race([
        once(child.stdout, "data"),
        exited.then(() => { throw new Error("Descendant exited before recovery"); }),
      ]);
      addSessionBashProcessGroup(f.base.persistDir, sessionId, child.pid!);
      const manager = new SubagentManager({ persistDir: f.base.persistDir });
      startBackgroundRuntime({ manager, bus: f.base.bus, persistDir: f.base.persistDir,
        onTaskRecoverySettled: () => settled.resolve() });
      gate.resolve();
      await settled.promise;
      expect(failures.join("\n")).toContain("session Task binding");
      expect(readTaskSnapshot(f.config)).toEqual(before);
      expect(readSessionBashProcessGroups(f.base.persistDir, sessionId)).toEqual([child.pid!]);
      expect(process.kill(child.pid!, 0)).toBe(true);
      expect(readFileSync(join(directory, "[ACTIVE]"), "utf8")).toBe(active);
      expect(existsSync(join(directory, "[STARTED]"))).toBe(true);
      expect(readFileSync(path, "utf8")).toBe(bytes);
      expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);
      expect(f.agentCalls()).toBe(0);

      writeFileSync(path, JSON.stringify(meta));
      await recoverInstalledAppTasks(f.base.bus);
      await exited;
      await f.run("owner");
      expect(readSessionBashProcessGroups(f.base.persistDir, sessionId)).toEqual([]);
      expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
    } finally {
      gate.resolve();
      child.kill("SIGKILL");
      await exited;
    }
  });

  it.each((["endedAt", "error"] as const).flatMap((field) =>
    (["present", "missing"] as const).map((projection) => ({ field, projection })),
  ))("startup recovers damaged optional $field with $projection SQL projection", async ({ field, projection }) => {
    const f = setup();
    const recoveryBus = eventBus();
    const gate = Promise.withResolvers<void>();
    const settled = Promise.withResolvers<void>();
    await installCoreTaskRuntimes({ ...f.base, bus: recoveryBus });
    await installCoreTaskRuntimes({ ...f.base, executeRecovery: async () => {
      await gate.promise;
      await recoverInstalledAppTasks(recoveryBus);
    } });
    f.observe("owner");
    const claim = f.saveTerminalSession("owner");
    mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
      attempt.lease!.runtimeId = "previous-runtime";
    });
    const sessionId = "session-owner";
    const directory = join(f.base.persistDir, "sessions", sessionId);
    const path = join(directory, "meta.json");
    const meta = JSON.parse(readFileSync(path, "utf8"));
    if (projection === "present") upsertSession(f.base.persistDir, {
      sessionId, agent: "sample-owner", task: "work", status: "running", startedAt: 1, taskBinding: meta.taskBinding,
    });
    const bytes = JSON.stringify({ ...meta, [field]: { invalid: true } });
    writeFileSync(path, bytes);
    markStaleSession(f.base.persistDir, sessionId);
    const result = readFileSync(join(directory, "result.json"), "utf8");
    try {
      expect(() => startBackgroundRuntime({
        manager: new SubagentManager({ persistDir: f.base.persistDir }), bus: f.base.bus, persistDir: f.base.persistDir,
        onTaskRecoverySettled: () => settled.resolve(),
      })).not.toThrow();
    } finally {
      gate.resolve();
      await settled.promise;
    }
    await f.run("owner");
    expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
    expect(readFileSync(path, "utf8")).toBe(bytes);
    expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);
    expect(existsSync(join(directory, "[ACTIVE]"))).toBe(false);
    const row = getDb(f.base.persistDir).prepare("SELECT status, endedAt, error FROM sessions WHERE sessionId = ?")
      .get(sessionId) as { status: string; endedAt: number | null; error: string | null } | undefined;
    if (projection === "present") {
      expect(row?.status).toBe("interrupted");
      expect(typeof row?.endedAt).toBe("number");
      expect(row?.error).toBeNull();
    } else {
      expect(row).toBeNull();
    }
  });

  it.each(["terminal", "damaged"] as const)("startup and Task recovery ignore a reused detached PID with %s metadata", async (kind) => {
    const f = setup();
    const recoveryBus = eventBus();
    const gate = Promise.withResolvers<void>();
    const settled = Promise.withResolvers<void>();
    await installCoreTaskRuntimes({ ...f.base, bus: recoveryBus });
    await installCoreTaskRuntimes({ ...f.base, executeRecovery: async () => {
      await gate.promise;
      await recoverInstalledAppTasks(recoveryBus);
    } });
    f.observe("owner");
    const claim = f.saveTerminalSession("owner");
    mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
      attempt.lease!.runtimeId = "previous-runtime";
    });
    const sessionId = "session-owner";
    const directory = join(f.base.persistDir, "sessions", sessionId);
    const path = join(directory, "meta.json");
    const meta = JSON.parse(readFileSync(path, "utf8"));
    meta.detached = true;
    meta.pid = process.pid;
    meta.startedAt = 1;
    if (kind === "damaged") meta.error = { invalid: true };
    const bytes = JSON.stringify(meta);
    writeFileSync(path, bytes);
    upsertSession(f.base.persistDir, {
      sessionId, agent: "sample-owner", task: "work", status: "running", startedAt: 1, taskBinding: meta.taskBinding,
    });
    markStaleSession(f.base.persistDir, sessionId);
    writeFileSync(join(directory, "[STARTED]"), "started");
    const result = readFileSync(join(directory, "result.json"), "utf8");
    try {
      startBackgroundRuntime({
        manager: new SubagentManager({ persistDir: f.base.persistDir }), bus: f.base.bus, persistDir: f.base.persistDir,
        onTaskRecoverySettled: () => settled.resolve(),
      });
      // The scanner removes the marker before Task recovery runs. The
      // detached PID in retained history must not resurrect the old owner.
      expect(existsSync(join(directory, "[ACTIVE]"))).toBe(false);
    } finally {
      gate.resolve();
      await settled.promise;
    }
    await f.run("owner");
    await recoverInstalledAppTasks(f.base.bus);
    expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
    expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
    expect(readFileSync(path, "utf8")).toBe(bytes);
    expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);
    expect(existsSync(join(directory, "[STARTED]"))).toBe(false);
  });

  it.each(["helper", "prior-workflow-step"] as const)("startup uses the independent SQL association for a readable %s", (kind) => {
    const f = setup();
    f.observe("owner");
    f.saveTerminalSession("owner");
    const ownerDirectory = join(f.base.persistDir, "sessions", "session-owner");
    const ownerMeta = JSON.parse(readFileSync(join(ownerDirectory, "meta.json"), "utf8"));
    const before = readTaskSnapshot(f.config);
    const result = readFileSync(join(ownerDirectory, "result.json"), "utf8");
    const sessionId = "helper-session";
    const directory = join(f.base.persistDir, "sessions", sessionId);
    const meta = { ...ownerMeta, ...(kind === "helper" ? { parentSessionId: "session-owner" } : {}) };
    const projectSession = () => upsertSession(f.base.persistDir, {
      sessionId, agent: "helper", task: "contribute", status: "running", startedAt: 1, taskBinding: meta.taskBinding,
    });
    projectSession();
    markStaleSession(f.base.persistDir, sessionId);
    const path = join(directory, "meta.json");
    const damaged = JSON.stringify({ ...meta, error: { invalid: true } });
    writeFileSync(path, damaged);
    const manager = new SubagentManager({ persistDir: f.base.persistDir });
    manager.cleanupStaleSessions();
    // The attempt belongs to the owner session. It cannot authorize cleanup
    // of a damaged helper just because the helper inherited its binding.
    expect(existsSync(join(directory, "[ACTIVE]"))).toBe(true);
    expect(readFileSync(path, "utf8")).toBe(damaged);
    expect(getDb(f.base.persistDir).prepare("SELECT status FROM sessions WHERE sessionId = ?").get(sessionId))
      .toEqual({ status: "running" });

    writeFileSync(path, JSON.stringify(meta));
    getDb(f.base.persistDir).prepare("DELETE FROM sessions WHERE sessionId = ?").run(sessionId);
    manager.cleanupStaleSessions();
    // A readable copy alone cannot verify a non-owner session. Restoration
    // of the independent association admits ordinary session cleanup.
    expect(existsSync(join(directory, "[ACTIVE]"))).toBe(true);
    expect(readTaskSnapshot(f.config)).toEqual(before);
    projectSession();
    manager.cleanupStaleSessions();
    expect(existsSync(join(directory, "[ACTIVE]"))).toBe(false);
    expect(getDb(f.base.persistDir).prepare("SELECT status FROM sessions WHERE sessionId = ?").get(sessionId))
      .toEqual({ status: "done" });
    expect(readTaskSnapshot(f.config)).toEqual(before);
    expect(readFileSync(join(ownerDirectory, "result.json"), "utf8")).toBe(result);
  });

  it.each(["missing", "unreadable", "invalid-status", "no-binding"] as const)(
    "recovers persisted SQL session history across repeated startup with %s metadata",
    async (metadata) => {
      const f = setup();
      await installCoreTaskRuntimes(f.base);
      f.observe("owner");
      const claim = f.saveTerminalSession("owner");
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.runtimeId = "previous-runtime";
        attempt.lease!.runtimeId = "previous-runtime";
      });
      const sessionId = "session-owner";
      const directory = join(f.base.persistDir, "sessions", sessionId);
      const path = join(directory, "meta.json");
      const meta = JSON.parse(readFileSync(path, "utf8"));
      const binding = meta.taskBinding;
      upsertSession(f.base.persistDir, {
        sessionId, agent: "sample-owner", task: "work", status: "running", startedAt: 1, taskBinding: binding,
      });
      meta.status = metadata === "invalid-status" ? ["running"] : "running";
      delete meta.endedAt;
      if (metadata === "no-binding") delete meta.taskBinding;
      const bytes = metadata === "unreadable" ? '{"status":' : JSON.stringify(meta);
      if (metadata === "missing") rmSync(path);
      else writeFileSync(path, bytes);
      const result = readFileSync(join(directory, "result.json"), "utf8");

      await recoverInstalledAppTasks(f.base.bus);
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
      await closeInstalledAppTaskRuntimes(f.base.bus);
      await installCoreTaskRuntimes(f.base);
      await recoverInstalledAppTasks(f.base.bus);
      expect(listTerminalTaskSessionBindings(f.base.persistDir, "sample")).toEqual([]);
      await f.run("owner");
      expect(f.agentCalls()).toBe(1);
      expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
      expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);
      if (metadata === "missing") expect(existsSync(path)).toBe(false);
      else if (metadata !== "no-binding") expect(readFileSync(path, "utf8")).toBe(bytes);
    },
  );

  it.each(["missing", "damaged", "conflict", "helper"] as const)(
    "uses retained terminal-attempt ownership when sweeping %s session evidence",
    async (kind) => {
      const f = setup();
      await installCoreTaskRuntimes(f.base);
      f.observe("owner");
      const claim = f.saveTerminalSession("owner");
      const sessionId = "session-owner";
      const path = join(f.base.persistDir, "sessions", sessionId, "meta.json");
      const meta = JSON.parse(readFileSync(path, "utf8"));
      upsertSession(f.base.persistDir, {
        sessionId, agent: "sample-owner", task: "work", status: "running", startedAt: 1, taskBinding: meta.taskBinding,
      });
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.state = "interrupted";
        if (kind === "helper") attempt.sessionId = "another-session";
      });
      meta.status = ["running"];
      if (kind === "conflict") meta.taskBinding.attemptId = "another-attempt";
      if (kind === "missing") rmSync(path);
      else writeFileSync(path, JSON.stringify(meta));
      const before = readTaskSnapshot(f.config);
      const cleanup: string[] = [];
      const opts = { ...f.base, sessions: createTaskSessionRecovery({
        persistDir: f.base.persistDir, bus: f.base.bus,
        manager: { hasActiveSession: () => false } as never,
        drainPersistedBashProcessGroups: (_root, id) => { cleanup.push(id); return true; },
      }) };
      const sweep = () => settleTerminalAppTaskSessions(opts, { id: "sample" });
      if (kind === "conflict") expect(sweep).toThrow("session Task binding");
      else expect(sweep()).toEqual(kind === "helper" ? [] : [sessionId]);
      expect(cleanup).toEqual(kind === "helper" || kind === "conflict" ? [] : [sessionId]);
      expect(readTaskSnapshot(f.config)).toEqual(before);
      expect(f.agentCalls()).toBe(0);
      if (kind === "missing") expect(existsSync(path)).toBe(false);
      else expect(readFileSync(path, "utf8")).toBe(JSON.stringify(meta));
      if (kind !== "helper" && kind !== "conflict") expect(sweep()).toEqual([]);
    },
  );

  it.each(["startup", "claim"] as const)(
    "preserves the retained Task through %s recovery until managed cancellation finishes",
    async (route) => {
      const f = setup();
      let active = true;
      let cancellations = 0;
      await installCoreTaskRuntimes({ ...f.base, sessions: createTaskSessionRecovery({
        persistDir: f.base.persistDir, bus: f.base.bus,
        manager: {
          hasActiveSession: () => active,
          cancel: () => { cancellations++; },
        } as never,
      }) });
      f.observe("owner");
      recordAppTaskTrigger(f.config, "owner", { type: "sample.changed", data: { instruction: "Continue work" } });
      const claim = f.saveTerminalSession("owner");
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.runtimeId = "previous-runtime";
        attempt.lease!.runtimeId = "previous-runtime";
      });
      const directory = join(f.base.persistDir, "sessions", "session-owner");
      rmSync(join(directory, "meta.json"));
      const result = readFileSync(join(directory, "result.json"), "utf8");
      const before = readTaskSnapshot(f.config);
      const recover = () => route === "startup" ? recoverInstalledAppTasks(f.base.bus) : f.run("owner");

      // Startup already leaves a live session alone. Claim recovery requests
      // cancellation, but must retain ownership until that request completes.
      if (route === "startup") await recover();
      else await expect(recover()).rejects.toThrow("managed execution cleanup is still pending");
      expect(cancellations).toBe(route === "startup" ? 0 : 1);
      expect(readTaskSnapshot(f.config)).toEqual(before);
      expect(f.agentCalls()).toBe(0);
      expect(existsSync(join(directory, "meta.json"))).toBe(false);
      expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);

      active = false;
      await recover();
      if (route === "startup") await f.run("owner");
      expect(f.agentCalls()).toBe(1);
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
      expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
      expect(readFileSync(join(directory, "result.json"), "utf8")).toBe(result);
    },
  );

  it("controller recovery drains the original generation before replacing its claim and passes incomplete history", async () => {
    const f = setup();
    let drained = false;
    let original: { taskId: string; attemptId: string };
    await installCoreTaskRuntimes({ ...f.base, sessions: createTaskSessionRecovery({
      persistDir: f.base.persistDir, bus: f.base.bus,
      manager: { hasActiveSession: () => false } as never,
      drainPersistedBashProcessGroups: () => {
        expect(f.config.resourceStore.readTask(original.taskId)?.status.currentAttemptId).toBe(original.attemptId);
        return drained;
      },
    }) });
    f.observe("owner");
    recordAppTaskTrigger(f.config, "owner", { type: "sample.changed", data: { instruction: "Continue work" } });
    const claim = f.saveTerminalSession("owner");
    original = claim;
    mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
      attempt.lease!.runtimeId = "previous-runtime";
    });
    const resource = f.config.resourceStore.readTask("owner")!;
    observeAppTaskIntent(f.config, { appAgent: "sample-owner", intent: {
      ...resource.spec, id: "owner", outcome: "Produce the revised decision",
    } });
    expect(f.config.resourceStore.readTask("owner")!.metadata.generation).toBe(claim.generation + 1);
    writeFileSync(join(f.base.persistDir, "sessions", "session-owner", "session.jsonl"), '{"role":"user","content":"Known progress"}\n{"damaged":');
    await expect(f.run("owner")).rejects.toThrow("did not exit");
    expect(f.config.resourceStore.readTask("owner")?.status.currentAttemptId).toBe(claim.attemptId);
    expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("running");
    expect(f.agentCalls()).toBe(0);
    drained = true;
    await f.run("owner");
    expect(f.agentCalls()).toBe(1);
    expect(f.previousAttempt()).toMatchObject({
      attemptId: claim.attemptId,
      sessionId: "session-owner",
      state: "interrupted",
    });
    expect(readAcceptedRuntimeAttempt(f.config, "owner")?.taskGeneration).toBe(claim.generation + 1);
  });

  it.each(["converged", "continuing"] as const)(
    "runs new work after accepted %s results despite damaged old history",
    async (outcome) => {
      const f = setup();
      await installCoreTaskRuntimes(f.base);
      f.observe("accepted");
      const claim = f.saveTerminalSession("accepted");
      if (outcome === "converged") {
        expect(completeAppTask(f.config, claim, { summary: "Accepted measurement", result: { value: 17 } }).status).toBe("applied");
        admitTaskInput(f.config, {
          appId: "sample", attachment: { kind: "existing", taskId: "accepted" }, idempotencyKey: "new-human-requirement",
          inputContext: { id: "new-human-requirement", source: { kind: "human", id: "human" },
            input: { kind: "message", data: { message: "Measure the second sample" } } },
        });
      } else {
        expect(deferAppTask(f.config, claim, { disposition: "waiting", continue: true,
          summary: "First measurement accepted; continue the second", facts: ["value:17"] }).status).toBe("applied");
      }
      const accepted = f.config.resourceStore.readAttempt(claim.attemptId)!.acceptedResult;
      expect(accepted).toBeDefined();
      mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
        attempt.runtimeId = "previous-runtime";
      });
      writeFileSync(join(f.base.persistDir, "sessions", "session-accepted", "session.jsonl"), '{"damaged":');
      await closeInstalledAppTaskRuntimes(f.base.bus);
      closeDb(f.base.persistDir);
      await installCoreTaskRuntimes(f.base);
      await f.run("accepted");
      expect(f.agentCalls()).toBe(1);
      const reopened = AppTaskResourceStore.activeFromDb(getDb(f.base.persistDir), "sample")!;
      expect(reopened.readTask("accepted")?.status.observedAttemptId).not.toBe(claim.attemptId);
      expect(reopened.readAttempt(claim.attemptId)?.acceptedResult).toEqual(accepted);
    },
  );

  it.each(["startup", "busy"] as const)(
    "passes incomplete history to the replacement agent through %s recovery",
    async (route) => {
      const f = setup();
      await installCoreTaskRuntimes(f.base);
      f.observe("damaged");
      const claim = f.saveTerminalSession("damaged");
      const transcript = join(f.base.persistDir, "sessions", "session-damaged", "session.jsonl");
      const bytes = '{"role":"user","content":"Known progress"}\n{"damaged":';
      writeFileSync(transcript, bytes);
      await requeueSavedAttempt(f, claim, route);
      await f.run("damaged");
      expect(f.agentCalls()).toBe(1);
      expect(f.previousAttempt()).toMatchObject({
        attemptId: claim.attemptId,
        sessionId: "session-damaged",
        state: "interrupted",
      });
      expect(readAcceptedRuntimeAttempt(f.config, "damaged")?.metadata.id).not.toBe(claim.attemptId);
      expect(readFileSync(transcript, "utf8")).toBe(bytes);
    },
  );

  it.each(["startup", "busy"] as const)(
    "recovers the old execution after a requirement revision through %s",
    async (route) => {
      const f = setup();
      await installCoreTaskRuntimes(f.base);
      f.observe("revised");
      const claim = f.saveTerminalSession("revised");
      observeAppTaskIntent(f.config, {
        appAgent: "sample-owner",
        intent: { id: "revised", parentId: "operations", outcome: "Produce the revised decision",
          acceptance: ["Decision includes the new requirement"] },
      });
      expect(f.config.resourceStore.readTask("revised")?.metadata.generation).toBe(2);
      expect(f.config.resourceStore.readAttempt(claim.attemptId)?.taskGeneration).toBe(1);
      writeFileSync(join(f.base.persistDir, "sessions", "session-revised", "session.jsonl"), '{"damaged":');
      await requeueSavedAttempt(f, claim, route);
      await f.run("revised");
      expect(f.agentCalls()).toBe(1);
      expect(f.previousAttempt()).toMatchObject({
        attemptId: claim.attemptId,
        sessionId: "session-revised",
        state: "interrupted",
      });
      expect(readAcceptedRuntimeAttempt(f.config, "revised")?.taskGeneration).toBe(2);
      await f.run("revised");
      expect(f.agentCalls()).toBe(1);
    },
  );

  it.each(["startup", "busy"] as const)(
    "retries uncommitted session output through %s before accepting effects",
    async (route) => {
      const f = setup();
      await installCoreTaskRuntimes(f.base);
      f.observe("owner");
      f.observe("other");
      admitTaskInput(f.config, {
        appId: "sample",
        attachment: { kind: "existing", taskId: "owner" },
        idempotencyKey: "original-input",
        inputContext: {
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
      // The replacement judges current facts; it need not repeat the old proposal.
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

  it.each(["startup", "busy", "claim"] as const)("reports unconfirmed session recovery without releasing ownership through %s", async (route) => {
    const f = setup();
    let confirmed = false;
    const sessions: TaskSessionRecovery = {
      ...f.base.sessions,
      interrupt: (...args) => confirmed ? f.base.sessions.interrupt(...args) : false,
    };
    await installCoreTaskRuntimes({ ...f.base, sessions });
    f.observe("owner");
    recordAppTaskTrigger(f.config, "owner", { type: "sample.changed", data: { instruction: "Continue work" } });
    const claim = f.saveTerminalSession("owner");
    mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.lease!.expiresAt = new Date(Date.now() - 1_000).toISOString();
      if (route !== "busy") {
        attempt.runtimeId = "previous-runtime";
        attempt.lease!.runtimeId = "previous-runtime";
      }
    });
    const before = readTaskSnapshot(f.config);
    const recover = () => route === "startup" ? recoverInstalledAppTasks(f.base.bus) : f.run("owner");
    await expect(recover()).rejects.toThrow("Task session recovery was not confirmed");
    expect(readTaskSnapshot(f.config)).toEqual(before);
    expect(f.agentCalls()).toBe(0);

    confirmed = true;
    await recover();
    if (route !== "claim") await f.run("owner");
    expect(f.agentCalls()).toBe(1);
    expect(f.config.resourceStore.readAttempt(claim.attemptId)?.state).toBe("interrupted");
    expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
  });

  it("delivers failed recovery to declared agent work while retaining the unresolved attempt", async () => {
    const f = setup();
    let drained = false;
    const sessions = createTaskSessionRecovery({
      persistDir: f.base.persistDir,
      bus: f.base.bus,
      manager: { hasActiveSession: () => false } as never,
      drainPersistedBashProcessGroups: () => drained,
    });
    const app = defineApp({
      ...definition(),
      tasks: {},
      subscriptions: [{id:"recovery",event:"handler.failed",toInput(event) {
        return event.data.taskId === "owner" ? {kind:"recovery",data:event.data} : null;
      }}],
      task: () => ({kind:"desired",intent:{id:"recovery",parentId:"operations",
        outcome:"Assess the unresolved recovery and choose the next action",acceptance:["Preserve confirmed facts and explicit uncertainty"]}}),
    });
    const registry = new AppRegistry(async () => [
      { appDir: f.base.appRegistrySnapshot.entries[0].appDir, definition: app },
    ]);
    await registry.reload();
    let decisions = 0;
    const agents: TaskAgentRunner = {
      ...f.base.agents,
      snapshot: () => agents,
      async execute(input) {
        if (input.attempt.task.id !== "recovery") return f.base.agents.execute(input);
        const failure = input.attempt.events.items.find(({ event }) => event.type === "app.task.requested")?.event.data.request as AppInputContext;
        expect(failure?.input.data).toMatchObject({ appId: "sample", taskId: "owner", stage: "task-reconciliation" });
        expect((failure?.input.data as Record<string,string>).error).toContain("session-owner");
        expect((failure?.input.data as Record<string,string>).error).toContain("did not exit");
        decisions++;
        return {
          handlerResult: {
            state: "waiting",
            summary: "Wait for confirmed process cleanup before retrying the original work",
            reviewAt: Date.now() + 60 * 60_000,
            facts: ["Stop attempt failed; old execution remains unconfirmed"],
            actions: [],
          },
          runId: null,
        };
      },
    };
    const opts = { ...f.base, sessions, agents, appRegistrySnapshot: registry.snapshot() };
    await installCoreTaskRuntimes(opts);
    f.observe("owner");
    recordAppTaskTrigger(f.config, "owner", { type: "sample.changed", data: { instruction: "Continue work" } });
    const claim = f.saveTerminalSession("owner");
    mutateRuntimeAttemptFixture(f.config, claim.taskId, claim.attemptId, (attempt) => {
      attempt.runtimeId = "previous-runtime";
      attempt.lease!.runtimeId = "previous-runtime";
      attempt.lease!.expiresAt = new Date(Date.now() - 1_000).toISOString();
    });
    const original = f.config.resourceStore.readAttempt(claim.attemptId);
    const writer = new DbWriter(f.base.persistDir, { housekeepingIntervalMs: 0 });
    f.base.bus.setPersistenceSubscriber(writer.handler);
    f.base.bus.setDeliveryRecorder(writer.recordDelivery);
    const inbox = await startAppInboxRuntime({
      db: getDb(f.base.persistDir),
      bus: f.base.bus,
      registry,
      deferStart: true,
      admitTaskEvent: (input) => admitLoadedCanonicalAppTaskEvent({ ...input, bus: f.base.bus }),
      attachTask: createAppTaskCapability({ bus: f.base.bus }).attach,
    });
    const settled = Promise.withResolvers<void>();
    f.base.bus.subscribe((event) => {
      if (event.type === "project.task.reconciled" && event.data.taskId === "recovery") {
        if (event.data.disposition === "waiting") settled.resolve();
        else settled.reject(new Error(`Recovery decision was not accepted: ${event.data.summary}`));
      }
    });
    try {
      await installCoreTaskRuntimes({ ...opts, installControllers: true }, { deferRecovery: true });
      await settled.promise;
      await closeInstalledAppTaskRuntimes(f.base.bus);
      expect(decisions).toBeGreaterThan(0);
      expect(f.agentCalls()).toBe(0);
      expect(f.config.resourceStore.readAttempt(claim.attemptId)).toEqual(original);
      expect(f.config.resourceStore.readTask("owner")?.status.currentAttemptId).toBe(claim.attemptId);
      expect(readAcceptedRuntimeAttempt(f.config, "recovery")?.acceptedResult).toMatchObject({
        state: "waiting",
        summary: "Wait for confirmed process cleanup before retrying the original work",
      });
      expect(getDb(f.base.persistDir).prepare("SELECT delivery_status FROM events WHERE event_type = 'handler.failed' ORDER BY id LIMIT 1").get())
        .toEqual({ delivery_status: "accepted" });

      // Once the missing fact changes, ordinary recovery can continue the
      // original Task. The diagnostic Task did not grant replacement ownership.
      drained = true;
      await installCoreTaskRuntimes(opts);
      await f.run("owner");
      expect(f.agentCalls()).toBe(1);
      expect(readAcceptedRuntimeAttempt(f.config, "owner")?.acceptedResult?.result).toEqual(f.payload);
    } finally {
      inbox.close();
      await closeInstalledAppTaskRuntimes(f.base.bus);
    }
  });

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

  it.each(["progress", "self-revision", "waiting", "incomplete"] as const)(
    "handles %s without closing the Task",
    async (disposition) => {
      const addInput = (taskId: string) =>
        recordAppTaskTrigger(f.config, taskId, {
          type: "sample.feedback",
          eventId: 101,
          data: { instruction: "Check the new facts" },
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
      } else if (disposition === "incomplete") {
        f.terminalResult.state = "incomplete";
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
        expect(emitted.filter((event) => event.type === "app.dependency.updated")).toHaveLength(0);
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
      } else if (disposition === "incomplete") {
        expect(f.config.resourceStore.readCancellation(taskId)).toBeNull();
        expect(readAcceptedRuntimeAttempt(f.config, taskId)?.acceptedResult).toMatchObject({
          state: "incomplete",
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
      expect(emitted.filter((event) => event.type === "app.dependency.updated")).toHaveLength(0);
      // Progress and retry reports stay readable without starting a caller
      // attempt. Saved answers are projected from the Task fact above.
      expect(emitted.filter((event) => event.type === "app.dependency.updated")).toHaveLength(0);
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
      const { installed } = await installCoreTaskRuntimes(f.base);
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
      // A route selected before recovery may deliver after journal readback.
      for (let delivery = 0; delivery < 2; delivery++) {
        admitStandaloneCanonicalAppTaskEvent({
          descriptor: installed[0]!,
          event: fact,
          intent: null,
          conditionTaskIds: [claim.taskId],
        });
        expect(f.config.resourceStore.readTrigger(claim.taskId)?.events).toHaveLength(1);
      }
      expect(f.config.resourceStore.readTrigger(claim.taskId)?.event.eventId).toBe(fact[EVENT_ROW_ID]);
      expect(f.config.resourceStore.readReceipt(claim.taskId)).toBeNull();
      expect(f.agentCalls()).toBe(1);
      f.terminalResult.state = "converged";
      delete f.terminalResult.conditions;
      await f.run(claim.taskId);
      expect(readAcceptedRuntimeAttempt(f.config, claim.taskId)?.acceptedResult?.result).toEqual(f.payload);
      expect(f.config.resourceStore.isCancelled(claim.taskId)).toBe(false);
      expect(f.agentCalls()).toBe(2);
      await closeInstalledAppTaskRuntimes(f.base.bus);
      closeDb(f.base.persistDir);
      const reopened = await installCoreTaskRuntimes(f.base);
      f.config = appTaskContext({
        ...f.config,
        resourceStore: AppTaskResourceStore.activeFromDb(getDb(f.base.persistDir), "sample")!,
      });
      await recoverInstalledAppTasks(f.base.bus);
      admitStandaloneCanonicalAppTaskEvent({
        descriptor: reopened.installed[0]!,
        event: fact,
        intent: null,
        conditionTaskIds: [claim.taskId],
      });
      expect(f.config.resourceStore.readTrigger(claim.taskId)).toBeNull();
      await f.run(claim.taskId);
      expect(f.agentCalls()).toBe(2);
    },
  );

  it("reads a consumed journal fact for a newly declared Condition after restart", async () => {
    const f = setup();
    const sourceBus = eventBus();
    sourceBus.setPersistenceSubscriber(new DbWriter(f.base.persistDir).handler);
    await installCoreTaskRuntimes(f.base);
    f.observe("readback");
    f.terminalResult.state = "waiting";
    delete f.terminalResult.response;
    const condition = {
      id: "first-proof",
      type: "sample.proof.ready",
      subject: "id:proof-1",
      expected: "ready",
      owner: "app:sample",
    };
    f.terminalResult.conditions = [condition];
    const fact = sourceBus.emit({
      type: "sample.proof.ready",
      source: "fixture",
      owner: "app:sample",
      target: { project: "sample" },
      data: { project: "sample", id: "proof-1", status: "ready" },
    } as AgentEvent);
    await f.run("readback");
    expect(readTaskSnapshot(f.config).conditions?.["first-proof"]?.status.state).toBe("true");
    await closeInstalledAppTaskRuntimes(f.base.bus);
    closeDb(f.base.persistDir);
    await installCoreTaskRuntimes(f.base);
    f.config = appTaskContext({
      ...f.config,
      resourceStore: AppTaskResourceStore.activeFromDb(getDb(f.base.persistDir), "sample")!,
    });
    // Consuming the first wake does not erase evidence for a different wait.
    f.terminalResult.conditions = [{ ...condition, id: "second-proof" }];
    await f.run("readback");
    expect(f.agentCalls()).toBe(2);
    expect(readTaskSnapshot(f.config).conditions?.["second-proof"]?.status.state).toBe("true");
    expect(f.config.resourceStore.readTrigger("readback")?.events).toHaveLength(1);
    expect(f.config.resourceStore.readTrigger("readback")?.event.eventId).toBe(fact[EVENT_ROW_ID]);
    f.terminalResult.state = "converged";
    delete f.terminalResult.conditions;
    await f.run("readback");
    await recoverInstalledAppTasks(f.base.bus);
    await f.run("readback");
    expect(f.agentCalls()).toBe(3);
    expect(f.config.resourceStore.readTrigger("readback")).toBeNull();
  });





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
      `resumes a historical agent session through its workflow after ${route} with a %s verifier`,
      async (verification) => {
        const f = setup();
        let workflowCalls = 0;
        let verificationCalls = 0;
        // The historical attempt already performed this external operation.
        let externalCreates = 1;
        const operations = new Set<string>([String(f.payload.operationId)]);
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
                          facts: ["fixture:verified"],
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
              handlerResult: f.terminalResult,
              verifier: (await workflows.inspect({} as never)).verifier,
              runId: "fixture-workflow",
            };
          },
        };
        await installCoreTaskRuntimes({ ...f.base, workflows });
        f.observe("handoff", "must-verify");
        const claim = f.saveTerminalSession("handoff", "agent:sample-owner");
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
        // Retry the declared workflow; its stable operation key prevents duplicate effects.
        await f.run(claim.taskId);
        await f.run(claim.taskId);
        expect(workflowCalls).toBe(1);
        expect(externalCreates).toBe(1);
        expect(f.agentCalls()).toBe(0);
        expect(verificationCalls).toBe(verification === "missing" ? 0 : 1);
        if (verification !== "reject") {
          expect(readAcceptedRuntimeAttempt(f.config, claim.taskId)).toMatchObject({
            taskGeneration: claim.generation,
            acceptedResult: {
              result: f.payload,
              acceptanceBasis: verification === "accept"
                ? { method: "deterministic", verifier: "required-proof" }
                : { method: "workflow-contract" },
            },
          });
        } else {
          expect(f.config.resourceStore.readReceipt(claim.taskId)).toBeNull();
          expect(f.config.resourceStore.readTask(claim.taskId)?.metadata.generation).toBe(claim.generation);
          expect(f.config.resourceStore.readTask(claim.taskId)?.status).toMatchObject({
            phase: "pending",
            summary: "Fixture postcondition",
          });
          expect(f.config.resourceStore.readTask(claim.taskId)?.status.executionRetryAt).toBeGreaterThan(Date.now());
        }
        expect(f.config.resourceStore.isCancelled(claim.taskId)).toBe(false);
        await f.run(claim.taskId);
        expect(workflowCalls).toBe(1);
        expect(f.agentCalls()).toBe(0);
      },
    );
  }
});
