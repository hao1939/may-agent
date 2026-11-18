import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { DbWriter } from "../../../lib/db-writer.js";
import { closeAllDbs } from "../../../lib/db/connection.js";
import { SubagentManager } from "../../../lib/manager.js";
import { enterTaskWorkerProcess } from "../../../lib/task-worker-context.js";
import { discoverAppDefinitions } from "../../adapters/discovery/app-definitions.js";
import { DefinitionSourceReleaseStore, type DefinitionSourceRelease } from "../../app-source-release.js";
import { isBundled } from "../../bundle-mode.js";
import { AppRegistry } from "../../core/apps/registry.js";
import { EVENT_RECORD_ONLY, EVENT_ROW_ID, EventBus, type AgentEvent } from "../../core/events/bus.js";
import { readEventTaskTarget } from "../../core/events/task-target.js";
import { HostCapacity } from "../../core/scheduling/host-capacity.js";
import {
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
  recoverInstalledAppTasks,
} from "../../core/tasks/app-task-runtime.js";
import type { AppTaskDispatch } from "../../core/tasks/controller.js";
import type { AppTaskRuntimeOptions } from "../../core/tasks/runtime-options.js";
import { mergeTaskChecks, readTaskChecks } from "../../core/tasks/task-check-observations.js";
import { prepareDaemonAgents } from "../../daemon-agents.js";
import type { ModelRegistry } from "@may-agent/sdk/runtime";

const WORKER_FRAME_LIMIT = 8 * 1024 * 1024;
// Execution adapters own the admitted deadline (including ongoing native goals).
// The parent bounds an unresponsive process, rather than imposing another lifetime.
export const DEFAULT_TASK_WORKER_LIVENESS_TIMEOUT_MS = 5 * 60_000;
const WORKER_HEARTBEAT_INTERVAL_MS = 30_000;
export const DEFAULT_TASK_RECOVERY_WORKER_TIMEOUT_MS = 10 * 60_000;
const WORKER_RELAY_BATCH_SIZE = 1;
const WORKER_RELAY_TURN_DELAY_MS = 5;
const WORKER_RELAY_BACKLOG_LIMIT = 256;

type WorkerRelayScheduler = {
  pending: Array<() => void>;
  scheduled: boolean;
};

const workerRelaySchedulers = new WeakMap<EventBus, WorkerRelayScheduler>();

/**
 * Share one parent-side relay turn across every Task worker. Independent
 * zero-delay chains are individually bounded but can still keep background
 * work continuously ready and starve socket polling. This scheduler admits
 * one persisted worker Event per turn and leaves a small poll window before
 * the next background item.
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
      setTimeout(drainOne, WORKER_RELAY_TURN_DELAY_MS);
    }
  };
  setTimeout(drainOne, WORKER_RELAY_TURN_DELAY_MS);
}

type WorkerEventFrame = {
  kind: "event";
  eventId: number;
  event: AgentEvent;
  /** Preserve the producer's observation intent across JSON IPC; this is not acceptance. */
  recordOnly?: true;
};
type WorkerWakeFrame = {
  kind: "wake";
  /** Unjournaled identity-only wake. The parent re-emits it through its complete live fan-out. */
  event: Extract<AgentEvent, { type: "conversation.updated" }>;
};
type WorkerResultFrame = { kind: "result"; dependentTaskIds: string[]; taskChecks?: unknown };
type WorkerErrorFrame = { kind: "error"; error: string; taskChecks?: unknown };
type WorkerFrame = WorkerEventFrame | WorkerWakeFrame | WorkerResultFrame | WorkerErrorFrame | { kind: "heartbeat" };

export type TaskAttemptProcessRequest = {
  appId: string;
  taskId: string;
  dispatch: AppTaskDispatch;
  definitionSource?: TaskWorkerDefinitionSource;
};

export type TaskWorkerDefinitionSource = Pick<DefinitionSourceRelease, "agentsRoot" | "projectsRoot" | "sharedRoot"> & {
  /** Accepted App folders, not an operator allowlist or a new read of live markers. */
  appDirectories?: readonly string[];
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

function parseWorkerFrame(value: unknown): WorkerFrame {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > WORKER_FRAME_LIMIT)
    throw new Error("Task worker frame is too large");
  if (!value || typeof value !== "object") throw new Error("Task worker returned an invalid frame");
  const parsed = value as Partial<WorkerFrame>;
  if (parsed.kind === "heartbeat") return { kind: "heartbeat" };
  if (parsed.kind === "event") {
    if (
      !Number.isSafeInteger(parsed.eventId) || Number(parsed.eventId) <= 0 || !parsed.event ||
      (parsed.recordOnly !== undefined && parsed.recordOnly !== true)
    ) {
      throw new Error("Task worker returned an invalid event frame");
    }
    return parsed as WorkerEventFrame;
  }
  if (parsed.kind === "wake" && parsed.event && typeof parsed.event === "object") {
    const event = parsed.event as Record<string, unknown>;
    const data = event.data && typeof event.data === "object" && !Array.isArray(event.data)
      ? event.data as Record<string, unknown>
      : null;
    if (
      event.type === "conversation.updated" &&
      (event.source === "app-inbox" || event.source === "app-task-reconciler") &&
      typeof event.owner === "string" && Boolean(event.owner.trim()) &&
      typeof data?.appId === "string" && Boolean(data.appId.trim()) &&
      typeof data.conversationId === "string" && Boolean(data.conversationId.trim())
    ) return parsed as WorkerWakeFrame;
    throw new Error("Task worker returned an invalid wake frame");
  }
  if (parsed.kind === "result" && Array.isArray(parsed.dependentTaskIds)) {
    return {
      kind: "result",
      dependentTaskIds: parsed.dependentTaskIds.map((value) => required(String(value), "dependent Task id")),
      taskChecks: parsed.taskChecks,
    };
  }
  if (parsed.kind === "error" && typeof parsed.error === "string" && parsed.error.trim()) {
    return { kind: "error", error: parsed.error.trim(), taskChecks: parsed.taskChecks };
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
      ...request,
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
    // Retire the inherited marker before this worker can launch ordinary commands.
    env: { ...process.env, MAY_TASK_ATTEMPT_CHILD: undefined },
    // Runtime-owned IPC has one descriptor owner. Wrapping an extra raw pipe
    // lets Bun's collected ChildProcess close a descriptor reused by a later
    // worker. IPC also carries parent lifetime without a second input pipe.
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    serialization: "json",
  });
}

/**
 * Run the expensive Task attempt outside the interface event loop. Task state
 * remains in the shared canonical resource store; IPC carries only wake-like
 * event observations, bounded check counts and final dependent identities.
 */
export function createTaskAttemptProcessExecutor(input: {
  bus: EventBus;
  timeoutMs?: number;
  /** Process responsiveness bound; independent of App execution deadlines. */
  livenessTimeoutMs?: number;
  /** Capture the published source before an asynchronous child startup can race reload. */
  definitionSource?: () => TaskWorkerDefinitionSource | null;
  /** Test seam; production always uses the private current-binary worker. */
  spawnWorker?: (request: TaskAttemptProcessRequest) => ChildProcess;
}): NonNullable<AppTaskRuntimeOptions["executeAttempt"]> {
  return (request) => {
    const source = input.definitionSource?.();
    if (input.definitionSource && !source) throw new Error("No published Task worker definition source");
    const workerRequest: TaskAttemptProcessRequest = source
      ? {
          ...request,
          definitionSource: {
            agentsRoot: source.agentsRoot,
            projectsRoot: source.projectsRoot,
            sharedRoot: source.sharedRoot,
            ...(source.appDirectories ? { appDirectories: [...source.appDirectories] } : {}),
          },
        }
      : request;
    return runWorkerProcess(
      input.bus,
      input.spawnWorker?.(workerRequest) ?? spawnPrivateWorker(workerArguments(workerRequest)),
      input.timeoutMs,
      workerRequest,
      input.livenessTimeoutMs ?? DEFAULT_TASK_WORKER_LIVENESS_TIMEOUT_MS,
    );
  };
}

/** Run startup Task repair outside the interface event loop. */
export function createTaskRecoveryProcessExecutor(input: {
  bus: EventBus;
  timeoutMs?: number;
  definitionSource?: () => TaskWorkerDefinitionSource | null;
  /** Test seam; production always uses the private current-binary worker. */
  spawnWorker?: (source?: TaskWorkerDefinitionSource) => ChildProcess;
}): NonNullable<AppTaskRuntimeOptions["executeRecovery"]> {
  return async () => {
    const source = input.definitionSource?.();
    if (input.definitionSource && !source) throw new Error("No published Task worker definition source");
    await runWorkerProcess(
      input.bus,
      input.spawnWorker?.(source ?? undefined) ??
        spawnPrivateWorker([
          "--task-recovery-once",
          ...(source ? ["--task-worker-source", JSON.stringify(source)] : []),
        ]),
      input.timeoutMs ?? DEFAULT_TASK_RECOVERY_WORKER_TIMEOUT_MS,
    );
  };
}

async function runWorkerProcess(
  bus: EventBus,
  child: ChildProcess,
  timeoutMs?: number,
  task?: TaskAttemptProcessRequest,
  livenessTimeoutMs?: number,
): Promise<string[]> {
  if (!child.connected) {
    child.kill("SIGKILL");
    throw new Error("Task worker IPC is unavailable");
  }

  let result: string[] | undefined;
  let workerError: string | undefined;
  let protocolError: Error | undefined;
  const frames: WorkerFrame[] = [];
  const relayedEvents = new WeakSet<AgentEvent>();
  let relayScheduled = false;
  let relaySettled: (() => void) | undefined;
  const relayDrained = () =>
    frames.length === 0 && !relayScheduled
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          relaySettled = resolve;
        });
  const applyFrame = (frame: WorkerFrame) => {
    if (frame.kind === "event") {
      if (frame.recordOnly) Object.defineProperty(frame.event, EVENT_RECORD_ONLY, { value: true, configurable: true });
      relayedEvents.add(frame.event);
      bus.fanoutPersisted(frame.event, frame.eventId);
    } else if (frame.kind === "wake") {
      relayedEvents.add(frame.event);
      bus.emit(frame.event);
    } else if (frame.kind !== "heartbeat") {
      mergeTaskChecks(bus, frame.taskChecks);
      if (frame.kind === "result") result = frame.dependentTaskIds;
      else workerError = frame.error;
    }
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
    if (frames.length > WORKER_RELAY_BACKLOG_LIMIT) {
      protocolError = new Error("Task worker event backlog exceeded its bound");
      child.kill("SIGKILL");
    }
    if (relayScheduled) return;
    relayScheduled = true;
    scheduleWorkerRelay(bus, drainFrames);
  };
  child.on("message", (message) => {
    if (protocolError) return;
    try {
      const frame = parseWorkerFrame(message);
      // Heartbeats never enter the persisted Event relay or its bounded queue.
      if (frame.kind !== "heartbeat") enqueueFrame(frame);
    } catch (error) {
      protocolError = error instanceof Error ? error : new Error(String(error));
      child.kill("SIGKILL");
    }
  });

  const failInput = (error: Error) => {
    protocolError = error;
    child.kill("SIGKILL");
  };
  let pendingInputBytes = 0;
  const stopInput = task
    ? bus.listen(
        (event) => {
          const target = readEventTaskTarget(event);
          const eventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
          if (
            relayedEvents.has(event) ||
            target?.appId !== task.appId ||
            target?.taskId !== task.taskId ||
            !Number.isSafeInteger(eventId) ||
            Number(eventId) <= 0 ||
            !child.connected
          )
            return;
          const frame = { kind: "event", eventId: Number(eventId), event } satisfies WorkerEventFrame;
          const bytes = Buffer.byteLength(JSON.stringify(frame));
          if (bytes + pendingInputBytes > WORKER_FRAME_LIMIT) {
            failInput(new Error("Task worker input exceeded its bound"));
            return;
          }
          pendingInputBytes += bytes;
          child.send(frame, (error: Error | null) => {
            pendingInputBytes -= bytes;
            if (error) failInput(error);
          });
        },
        { label: "task-worker-input" },
      )
    : () => {};
  try {
    const exit = await waitForChild(child, timeoutMs, livenessTimeoutMs);
    await relayDrained();
    if (protocolError) throw protocolError;
    if (workerError) throw new Error(workerError);
    if (exit.code !== 0) {
      throw new Error(`Task worker exited with ${exit.signal ? `signal ${exit.signal}` : `code ${exit.code}`}`);
    }
    if (!result) throw new Error("Task worker exited without a result frame");
    return result;
  } finally {
    stopInput();
    if (child.connected) child.disconnect();
  }
}

function waitForChild(
  child: ChildProcess,
  timeoutMs?: number,
  livenessTimeoutMs?: number,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveExit, reject) => {
    let timeoutError: Error | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = (error: Error) => {
      if (timeoutError) return;
      timeoutError = error;
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      killTimer.unref();
    };
    const timer = timeoutMs && timeoutMs > 0
      ? setTimeout(() => stop(new Error(`Task worker exceeded ${timeoutMs}ms`)), timeoutMs)
      : undefined;
    timer?.unref();
    const armHeartbeat = () => {
      if (!livenessTimeoutMs || livenessTimeoutMs <= 0 || timeoutError) return;
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(
        () => stop(new Error(`Task worker heartbeat missed for ${livenessTimeoutMs}ms`)), livenessTimeoutMs,
      );
      heartbeatTimer.unref();
    };
    const heartbeat = (message: unknown) => {
      if (message && typeof message === "object" && "kind" in message && message.kind === "heartbeat") armHeartbeat();
    };
    child.on("message", heartbeat);
    armHeartbeat();
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      if (killTimer) clearTimeout(killTimer);
      child.off("message", heartbeat);
      child.off("error", onError);
    };
    function onError(error: Error) {
      // A failed termination request does not confirm the spawned worker exited.
      if (timeoutError && child.pid !== undefined) return;
      cleanup();
      reject(error);
    }
    child.on("error", onError);
    // close follows the final IPC messages; there is no separate raw-pipe end
    // promise that can hold a capacity slot forever after the worker exits.
    child.once("close", (code, signal) => {
      cleanup();
      // The timeout requests shutdown. Keep dispatch ownership until exit is
      // observed, then surface the timeout even if the worker exited cleanly.
      if (timeoutError) reject(timeoutError);
      else resolveExit({ code, signal });
    });
  });
}

function writeWorkerFrame(frame: WorkerFrame): Promise<void> {
  return new Promise((resolveSent, reject) => {
    if (!process.send || !process.connected) return reject(new Error("Task worker IPC is unavailable"));
    process.send(frame, (error: Error | null) => (error ? reject(error) : resolveSent()));
  });
}

export function parseTaskWorkerDefinitionSource(raw: string): TaskWorkerDefinitionSource {
  const parsed = JSON.parse(raw) as Partial<TaskWorkerDefinitionSource>;
  if (
    parsed.appDirectories !== undefined &&
    (!Array.isArray(parsed.appDirectories) ||
      parsed.appDirectories.some((name) => typeof name !== "string" || !/^[^/\\]+\.app$/.test(name)))
  )
    throw new Error("Task worker App directories must be App folder names");
  return {
    agentsRoot: required(String(parsed.agentsRoot ?? ""), "Task worker agentsRoot"),
    projectsRoot: required(String(parsed.projectsRoot ?? ""), "Task worker projectsRoot"),
    sharedRoot: required(String(parsed.sharedRoot ?? ""), "Task worker sharedRoot"),
    ...(parsed.appDirectories ? { appDirectories: [...parsed.appDirectories] } : {}),
  };
}

export function parseTaskAttemptProcessRequest(raw: string): TaskAttemptProcessRequest {
  const parsed = JSON.parse(raw) as Partial<TaskAttemptProcessRequest>;
  const dispatch = parsed.dispatch as Partial<AppTaskDispatch> | undefined;
  if (
    !dispatch ||
    !Number.isFinite(dispatch.enqueuedAt) ||
    !Number.isFinite(dispatch.startedAt) ||
    !Number.isFinite(dispatch.readyWaitMs) ||
    (dispatch.coordination !== undefined && dispatch.coordination !== true) ||
    (dispatch.lane !== "human" && dispatch.lane !== "normal")
  ) {
    throw new Error("Task worker request has an invalid dispatch context");
  }
  const host = dispatch.hostCapacityAtDispatch;
  if (host !== undefined && (
    !host || host.available !== true || host.scope !== "controller-host-process" ||
    typeof host.observedAt !== "string" || !Number.isFinite(Date.parse(host.observedAt)) ||
    !Number.isSafeInteger(host.maxConcurrent) || host.maxConcurrent < 1 ||
    !Number.isSafeInteger(host.backgroundMaxConcurrent) || host.backgroundMaxConcurrent < 1 ||
    host.backgroundMaxConcurrent > host.maxConcurrent ||
    !Number.isSafeInteger(host.reservedSlots) || host.reservedSlots < 0 ||
    !Number.isSafeInteger(host.waitingAcquisitions) || host.waitingAcquisitions < 0
  )) throw new Error("Task worker request has an invalid Host capacity observation");
  return {
    appId: required(String(parsed.appId ?? ""), "Task worker appId"),
    taskId: required(String(parsed.taskId ?? ""), "Task worker taskId"),
    dispatch: dispatch as AppTaskDispatch,
    ...(parsed.definitionSource
      ? {
          definitionSource: parseTaskWorkerDefinitionSource(JSON.stringify(parsed.definitionSource)),
        }
      : {}),
  };
}

/** Entry used only by a parent Task controller through private IPC. */
export async function runTaskAttemptWorker(input: {
  request: TaskAttemptProcessRequest;
  roots: TaskAttemptWorkerRoots;
  models: ModelRegistry;
}): Promise<void> {
  return runTaskWorker({
    roots: input.roots,
    models: input.models,
    appIds: [input.request.appId],
    task: input.request,
    definitionSource: input.request.definitionSource,
    run: (bus) => reconcileLoadedAppTaskOnce({ bus, ...input.request }),
  });
}

/** Entry used only for the isolated startup repair pass. */
export async function runTaskRecoveryWorker(input: {
  roots: TaskAttemptWorkerRoots;
  models: ModelRegistry;
  definitionSource?: TaskWorkerDefinitionSource;
}): Promise<void> {
  return runTaskWorker({
    ...input,
    run: async (bus, isDefinitionCurrent) => {
      await recoverInstalledAppTasks(bus, isDefinitionCurrent);
      return [];
    },
  });
}

async function runTaskWorker(input: {
  roots: TaskAttemptWorkerRoots;
  models: ModelRegistry;
  appIds?: readonly string[];
  task?: TaskAttemptProcessRequest;
  definitionSource?: TaskAttemptProcessRequest["definitionSource"];
  run(bus: EventBus, isDefinitionCurrent: () => boolean): Promise<string[]>;
}): Promise<void> {
  enterTaskWorkerProcess();
  const stopWithParent = () => process.exit(143);
  process.once("disconnect", stopWithParent);
  const bus = new EventBus();
  // Workers append facts, but only the parent has the complete durable routes.
  // Do not install a delivery recorder here: a local fallback must not hide a
  // later parent-consumer failure or a lost relay. The parent's fan-out records
  // acceptance against this same journal row after its routes have run.
  const writer = new DbWriter(input.roots.persistDir);
  bus.setPersistenceSubscriber(writer.handler);
  const receivedEvents = new WeakSet<AgentEvent>();
  const incoming = (message: unknown) => {
    const frame = parseWorkerFrame(message);
    if (frame.kind !== "event") throw new Error("Task worker input must be a persisted event");
    receivedEvents.add(frame.event);
    bus.fanoutPersisted(frame.event, frame.eventId);
  };
  process.on("message", incoming);
  bus.subscribe(
    (event) => {
      if (receivedEvents.has(event)) return;
      const eventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
      if (Number.isSafeInteger(eventId) && Number(eventId) > 0) {
        const recordOnly = (event as AgentEvent & { [EVENT_RECORD_ONLY]?: boolean })[EVENT_RECORD_ONLY];
        void writeWorkerFrame({
          kind: "event", eventId: Number(eventId), event,
          ...(recordOnly ? { recordOnly: true } : {}),
        }).catch(stopWithParent);
      } else if (event.type === "conversation.updated") {
        // Conversation wakes are intentionally identity-only and unjournaled.
        // They still need the parent process's HTTP/WebSocket subscribers.
        void writeWorkerFrame({ kind: "wake", event }).catch(stopWithParent);
      }
    },
    { label: "task-worker-event-relay" },
  );

  const sendHeartbeat = () => { void writeWorkerFrame({ kind: "heartbeat" }).catch(stopWithParent); };
  const heartbeatTimer = setInterval(sendHeartbeat, WORKER_HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();
  sendHeartbeat();
  try {
    const manager = new SubagentManager({
      persistDir: input.roots.persistDir,
      projectRoot: input.roots.projectRoot,
      bus,
    });
    const appSources = new DefinitionSourceReleaseStore(input.roots.projectRoot, input.roots.persistDir);
    const activeSource = input.definitionSource ?? appSources.ensureCurrent();
    const registry = new AppRegistry(
      discoverAppDefinitions(
        activeSource.projectsRoot,
        input.roots.projectsRoot,
        {},
        input.definitionSource?.appDirectories,
      ),
    );
    await registry.reload();
    // Task scheduling remains scoped by taskAppIds below. Callable discovery is
    // the ordinary full active profile/catalog captured from this pinned source,
    // so the caller's App does not hide registered helpers from another App.
    const hostCapacity = new HostCapacity(1);
    await prepareDaemonAgents({
      agentsRoot: activeSource.agentsRoot,
      sharedRoot: input.roots.sharedRoot,
      definitionSharedRoot: activeSource.sharedRoot,
      projectsRoot: activeSource.projectsRoot,
      canonicalProjectsRoot: input.roots.projectsRoot,
      appDirectories: input.definitionSource?.appDirectories,
      projectRoot: input.roots.projectRoot,
      persistDir: input.roots.persistDir,
      models: input.models,
      manager,
      bus,
      appRegistry: registry,
      hostCapacity,
      taskRuntimeMode: "manual",
      ...(input.appIds ? { taskAppIds: input.appIds } : {}),
    });
    // Immutable release paths carry the selected source identity. A recovery
    // child cannot observe a parent reload through its own in-memory registry.
    // Attempt workers deliberately ignore this fence and finish pinned work.
    const dependentTaskIds = await input.run(
      bus,
      () => appSources.current()?.projectsRoot === activeSource.projectsRoot,
    );
    await writeWorkerFrame({ kind: "result", dependentTaskIds, taskChecks: readTaskChecks(bus) });
  } catch (error) {
    await writeWorkerFrame({
      kind: "error",
      error: error instanceof Error ? error.message : String(error),
      taskChecks: readTaskChecks(bus),
    });
    throw error;
  } finally {
    clearInterval(heartbeatTimer);
    process.off("message", incoming);
    process.off("disconnect", stopWithParent);
    await closeInstalledAppTaskRuntimes(bus);
    closeAllDbs();
  }
}
