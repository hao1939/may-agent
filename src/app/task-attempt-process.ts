import { spawn, type ChildProcess } from "node:child_process";
import { writeSync } from "node:fs";
import { resolve } from "node:path";
import type { Readable } from "node:stream";
import { SubagentManager } from "../lib/index.js";
import { closeAllDbs } from "../lib/requests.js";
import { AppRegistry } from "./app-registry.js";
import { DefinitionSourceReleaseStore } from "./app-source-release.js";
import type { AppTaskDispatch } from "./app-task-controller.js";
import {
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
  recoverInstalledAppTasks,
  type AppTaskRuntimeOptions,
} from "./app-task-runtime.js";
import { attachEventPersistence } from "./daemon-events.js";
import { prepareDaemonAgents } from "./daemon-agents.js";
import { EventBus, EVENT_ROW_ID, type AgentEvent } from "./event-bus.js";
import { HostCapacity } from "./host-capacity.js";
import { isBundled } from "./bundle-mode.js";
import type { ModelRegistry } from "./model-registry.js";

const WORKER_FRAME_LIMIT = 8 * 1024 * 1024;
const WORKER_RELAY_BATCH_SIZE = 1;
const WORKER_RELAY_PAUSE_AT = 256;
const WORKER_RELAY_RESUME_AT = 128;

type WorkerRelayScheduler = {
  pending: Array<() => void>;
  scheduled: boolean;
};

const workerRelaySchedulers = new WeakMap<EventBus, WorkerRelayScheduler>();

/**
 * Share one parent-side relay turn across every Task worker. Independent
 * setImmediate chains are individually bounded but still run together in the
 * same event-loop phase, which can starve socket polling when several workers
 * are active. This scheduler admits one persisted worker Event per turn.
 */
function scheduleWorkerRelay(bus: EventBus, callback: () => void): void {
  let scheduler = workerRelaySchedulers.get(bus);
  if (!scheduler) {
    scheduler = { pending: [], scheduled: false };
    workerRelaySchedulers.set(bus, scheduler);
  }
  scheduler.pending.push(callback);
  if (scheduler.scheduled) return;
  scheduler.scheduled = true;
  const drainOne = () => {
    scheduler!.scheduled = false;
    scheduler!.pending.shift()?.();
    if (scheduler!.pending.length > 0) {
      scheduler!.scheduled = true;
      setImmediate(drainOne);
    }
  };
  setImmediate(drainOne);
}

type WorkerEventFrame = { kind: "event"; eventId: number; event: AgentEvent };
type WorkerResultFrame = { kind: "result"; dependentTaskIds: string[] };
type WorkerErrorFrame = { kind: "error"; error: string };
type WorkerFrame = WorkerEventFrame | WorkerResultFrame | WorkerErrorFrame;

export type TaskAttemptProcessRequest = {
  appId: string;
  taskId: string;
  dispatch: AppTaskDispatch;
};

export type TaskAttemptWorkerRoots = {
  projectRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  persistDir: string;
};

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be non-empty`);
  return normalized;
}

function parseWorkerFrame(line: string): WorkerFrame {
  if (Buffer.byteLength(line, "utf8") > WORKER_FRAME_LIMIT) throw new Error("Task worker frame is too large");
  const parsed = JSON.parse(line) as Partial<WorkerFrame>;
  if (parsed.kind === "event") {
    if (!Number.isSafeInteger(parsed.eventId) || Number(parsed.eventId) <= 0 || !parsed.event) {
      throw new Error("Task worker returned an invalid event frame");
    }
    return parsed as WorkerEventFrame;
  }
  if (parsed.kind === "result" && Array.isArray(parsed.dependentTaskIds)) {
    return {
      kind: "result",
      dependentTaskIds: parsed.dependentTaskIds.map((value) => required(String(value), "dependent Task id")),
    };
  }
  if (parsed.kind === "error" && typeof parsed.error === "string" && parsed.error.trim()) {
    return { kind: "error", error: parsed.error.trim() };
  }
  throw new Error("Task worker returned an unknown frame");
}

function workerInvocation(): { command: string; prefix: string[] } {
  if (isBundled()) return { command: process.execPath, prefix: [] };
  const entry = process.argv[1];
  if (!entry || entry === "binary-entry.ts") {
    throw new Error("Cannot resolve the source entrypoint for the Task worker process");
  }
  return { command: process.execPath, prefix: [resolve(entry)] };
}

function workerArguments(request: TaskAttemptProcessRequest): string[] {
  return [
    "--task-worker-once",
    JSON.stringify({
      appId: required(request.appId, "Task worker appId"),
      taskId: required(request.taskId, "Task worker taskId"),
      dispatch: request.dispatch,
    }),
  ];
}

function spawnPrivateWorker(args: string[]): ChildProcess {
  const invocation = workerInvocation();
  return spawn(invocation.command, [...invocation.prefix, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, MAY_TASK_ATTEMPT_CHILD: "1" },
    // Stdin is a private lifetime pipe. If the daemon exits, the pipe closes
    // and the worker stops instead of surviving as an orphaned old Runtime.
    stdio: ["pipe", "inherit", "inherit", "pipe"],
  });
}

/**
 * Run the expensive Task attempt outside the interface event loop. Task state
 * remains in the shared canonical resource store; fd 3 carries only wake-like
 * event observations and the final dependent identities back to the parent.
 */
export function createTaskAttemptProcessExecutor(input: {
  bus: EventBus;
  timeoutMs?: number;
  /** Test seam; production always uses the private current-binary worker. */
  spawnWorker?: (request: TaskAttemptProcessRequest) => ChildProcess;
}): NonNullable<AppTaskRuntimeOptions["executeAttempt"]> {
  return (request) =>
    runWorkerProcess(
      input.bus,
      input.spawnWorker?.(request) ?? spawnPrivateWorker(workerArguments(request)),
      input.timeoutMs,
    );
}

/** Run startup Task repair outside the interface event loop. */
export function createTaskRecoveryProcessExecutor(input: {
  bus: EventBus;
  timeoutMs?: number;
  /** Test seam; production always uses the private current-binary worker. */
  spawnWorker?: () => ChildProcess;
}): NonNullable<AppTaskRuntimeOptions["executeRecovery"]> {
  return async () => {
    await runWorkerProcess(
      input.bus,
      input.spawnWorker?.() ?? spawnPrivateWorker(["--task-recovery-once"]),
      input.timeoutMs,
    );
  };
}

async function runWorkerProcess(bus: EventBus, child: ChildProcess, timeoutMs?: number): Promise<string[]> {
  const relay = child.stdio[3] as Readable | null;
  if (!relay) {
    child.kill("SIGKILL");
    throw new Error("Task worker event pipe is unavailable");
  }

  let buffer = "";
  let result: string[] | undefined;
  let workerError: string | undefined;
  let protocolError: Error | undefined;
  const frames: WorkerFrame[] = [];
  let relayScheduled = false;
  let relaySettled: (() => void) | undefined;
  const relayDrained = () =>
    frames.length === 0 && !relayScheduled
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          relaySettled = resolve;
        });
  const applyFrame = (frame: WorkerFrame) => {
    if (frame.kind === "event") bus.fanoutPersisted(frame.event, frame.eventId);
    else if (frame.kind === "result") result = frame.dependentTaskIds;
    else workerError = frame.error;
  };
  const drainFrames = () => {
    relayScheduled = false;
    try {
      for (let count = 0; count < WORKER_RELAY_BATCH_SIZE && frames.length > 0; count += 1) {
        applyFrame(frames.shift()!);
      }
    } catch (error) {
      protocolError = error instanceof Error ? error : new Error(String(error));
      frames.length = 0;
      child.kill("SIGKILL");
    }
    if (relay.isPaused() && frames.length <= WORKER_RELAY_RESUME_AT) relay.resume();
    if (frames.length > 0) {
      relayScheduled = true;
      scheduleWorkerRelay(bus, drainFrames);
      return;
    }
    relaySettled?.();
    relaySettled = undefined;
  };
  const enqueueFrame = (frame: WorkerFrame) => {
    frames.push(frame);
    if (frames.length >= WORKER_RELAY_PAUSE_AT) relay.pause();
    if (relayScheduled) return;
    relayScheduled = true;
    scheduleWorkerRelay(bus, drainFrames);
  };
  relay.setEncoding("utf8");
  relay.on("data", (chunk: string) => {
    if (protocolError) return;
    buffer += chunk;
    if (Buffer.byteLength(buffer, "utf8") > WORKER_FRAME_LIMIT) {
      protocolError = new Error("Task worker event buffer exceeded its bound");
      child.kill("SIGKILL");
      return;
    }
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        enqueueFrame(parseWorkerFrame(line));
      } catch (error) {
        protocolError = error instanceof Error ? error : new Error(String(error));
        child.kill("SIGKILL");
        return;
      }
    }
  });
  const relayEnded = new Promise<void>((resolveEnd, rejectEnd) => {
    relay.once("end", resolveEnd);
    relay.once("error", rejectEnd);
  });

  const exit = await waitForChild(child, timeoutMs);
  await relayEnded;
  if (protocolError) throw protocolError;
  if (buffer.trim()) {
    enqueueFrame(parseWorkerFrame(buffer));
  }
  await relayDrained();
  if (protocolError) throw protocolError;
  if (workerError) throw new Error(workerError);
  if (exit.code !== 0) {
    throw new Error(`Task worker exited with ${exit.signal ? `signal ${exit.signal}` : `code ${exit.code}`}`);
  }
  if (!result) throw new Error("Task worker exited without a result frame");
  return result;
}

function waitForChild(
  child: ChildProcess,
  timeoutMs?: number,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveExit, reject) => {
    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(() => {
            child.kill("SIGTERM");
            setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
            reject(new Error(`Task worker exceeded ${timeoutMs}ms`));
          }, timeoutMs)
        : undefined;
    timer?.unref();
    child.once("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolveExit({ code, signal });
    });
  });
}

function writeWorkerFrame(frame: WorkerFrame): void {
  writeSync(3, `${JSON.stringify(frame)}\n`);
}

export function parseTaskAttemptProcessRequest(raw: string): TaskAttemptProcessRequest {
  const parsed = JSON.parse(raw) as Partial<TaskAttemptProcessRequest>;
  const dispatch = parsed.dispatch as Partial<AppTaskDispatch> | undefined;
  if (
    !dispatch ||
    !Number.isFinite(dispatch.enqueuedAt) ||
    !Number.isFinite(dispatch.startedAt) ||
    !Number.isFinite(dispatch.readyWaitMs) ||
    (dispatch.lane !== "human" && dispatch.lane !== "normal")
  ) {
    throw new Error("Task worker request has an invalid dispatch context");
  }
  return {
    appId: required(String(parsed.appId ?? ""), "Task worker appId"),
    taskId: required(String(parsed.taskId ?? ""), "Task worker taskId"),
    dispatch: dispatch as AppTaskDispatch,
  };
}

/** Entry used only by a parent Task controller through the private fd-3 protocol. */
export async function runTaskAttemptWorker(input: {
  request: TaskAttemptProcessRequest;
  roots: TaskAttemptWorkerRoots;
  models: ModelRegistry;
}): Promise<void> {
  return runTaskWorker({
    roots: input.roots,
    models: input.models,
    appIds: [input.request.appId],
    run: (bus) => reconcileLoadedAppTaskOnce({ bus, ...input.request }),
  });
}

/** Entry used only for the isolated startup repair pass. */
export async function runTaskRecoveryWorker(input: {
  roots: TaskAttemptWorkerRoots;
  models: ModelRegistry;
}): Promise<void> {
  return runTaskWorker({
    ...input,
    run: async (bus) => {
      await recoverInstalledAppTasks(bus);
      return [];
    },
  });
}

async function runTaskWorker(input: {
  roots: TaskAttemptWorkerRoots;
  models: ModelRegistry;
  appIds?: readonly string[];
  run(bus: EventBus): Promise<string[]>;
}): Promise<void> {
  if (process.env.MAY_TASK_ATTEMPT_CHILD !== "1") {
    throw new Error("Task worker mode is private to the parent runtime");
  }
  const stopWithParent = () => process.exit(143);
  process.stdin.once("end", stopWithParent);
  process.stdin.once("error", stopWithParent);
  process.stdin.resume();
  const bus = new EventBus();
  attachEventPersistence({ bus, persistDir: input.roots.persistDir });
  bus.subscribe(
    (event) => {
      const eventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
      if (Number.isSafeInteger(eventId) && Number(eventId) > 0) {
        writeWorkerFrame({ kind: "event", eventId: Number(eventId), event });
      }
    },
    { label: "task-worker-event-relay" },
  );

  const manager = new SubagentManager({
    persistDir: input.roots.persistDir,
    projectRoot: input.roots.projectRoot,
    bus,
  });
  const appSources = new DefinitionSourceReleaseStore(input.roots.projectRoot, input.roots.persistDir);
  const activeSource = appSources.ensureCurrent();
  const registry = new AppRegistry(activeSource.projectsRoot, input.roots.projectsRoot);
  await registry.reload();
  const selectedAppIds = input.appIds ? new Set(input.appIds) : null;
  const agentNames = registry
    .snapshot()
    .entries.filter(({ definition }) => definition.tasks && (!selectedAppIds || selectedAppIds.has(definition.id)))
    .map(({ definition }) => {
      const configured = typeof definition.agent === "string" ? definition.agent : definition.owner;
      return (typeof configured === "string" && configured.trim() ? configured : definition.id).replace(/^agent:/, "");
    });
  const hostCapacity = new HostCapacity(1);
  try {
    await prepareDaemonAgents({
      agentsRoot: activeSource.agentsRoot,
      sharedRoot: input.roots.sharedRoot,
      definitionSharedRoot: activeSource.sharedRoot,
      projectsRoot: activeSource.projectsRoot,
      stateProjectsRoot: input.roots.projectsRoot,
      projectRoot: input.roots.projectRoot,
      persistDir: input.roots.persistDir,
      models: input.models,
      manager,
      bus,
      cronEnabled: false,
      appRegistry: registry,
      hostCapacity,
      taskRuntimeMode: "manual",
      ...(input.appIds ? { taskAppIds: input.appIds } : {}),
      syncTaskReadModels: false,
      agentNames,
    });
    const dependentTaskIds = await input.run(bus);
    writeWorkerFrame({ kind: "result", dependentTaskIds });
  } catch (error) {
    writeWorkerFrame({ kind: "error", error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    process.stdin.off("end", stopWithParent);
    process.stdin.off("error", stopWithParent);
    process.stdin.pause();
    await closeInstalledAppTaskRuntimes(bus);
    closeAllDbs();
  }
}
