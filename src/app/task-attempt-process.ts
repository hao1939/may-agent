import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { SubagentManager } from "../lib/index.js";
import { closeAllDbs, getDb } from "../lib/requests.js";
import { AppRegistry } from "./core/apps/registry.js";
import { discoverAppDefinitions } from "./adapters/discovery/app-definitions.js";
import { DefinitionSourceReleaseStore, type DefinitionSourceRelease } from "./app-source-release.js";
import type { AppTaskDispatch } from "./core/tasks/controller.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { appTaskContext, readAppTaskAgent } from "./app-task-reconciler.js";
import {
  closeInstalledAppTaskRuntimes,
  reconcileLoadedAppTaskOnce,
  recoverInstalledAppTasks,
  type AppTaskRuntimeOptions,
} from "./app-task-runtime.js";
import { attachEventPersistence } from "./daemon-events.js";
import { prepareDaemonAgents } from "./daemon-agents.js";
import { readTaskOutcomes } from "./adapters/reporting/task-outcomes.js";
import { EventBus, EVENT_ROW_ID, type AgentEvent } from "./core/events/bus.js";
import { HostCapacity } from "./host-capacity.js";
import { isBundled } from "./bundle-mode.js";
import type { ModelRegistry } from "./model-registry.js";

const WORKER_FRAME_LIMIT = 8 * 1024 * 1024;
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

type WorkerEventFrame = { kind: "event"; eventId: number; event: AgentEvent };
type WorkerResultFrame = { kind: "result"; dependentTaskIds: string[] };
type WorkerErrorFrame = { kind: "error"; error: string };
type WorkerFrame = WorkerEventFrame | WorkerResultFrame | WorkerErrorFrame;

export type TaskAttemptProcessRequest = {
  appId: string;
  taskId: string;
  dispatch: AppTaskDispatch;
  definitionSource?: Pick<DefinitionSourceRelease, "agentsRoot" | "projectsRoot" | "sharedRoot">;
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
    env: { ...process.env, MAY_TASK_ATTEMPT_CHILD: "1" },
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
 * event observations and the final dependent identities back to the parent.
 */
export function createTaskAttemptProcessExecutor(input: {
  bus: EventBus;
  timeoutMs?: number;
  /** Capture the published source before an asynchronous child startup can race reload. */
  definitionSource?: () => DefinitionSourceRelease | null;
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
          },
        }
      : request;
    return runWorkerProcess(
      input.bus,
      input.spawnWorker?.(workerRequest) ?? spawnPrivateWorker(workerArguments(workerRequest)),
      input.timeoutMs,
      workerRequest,
    );
  };
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

async function runWorkerProcess(
  bus: EventBus,
  child: ChildProcess,
  timeoutMs?: number,
  task?: TaskAttemptProcessRequest,
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
      relayedEvents.add(frame.event);
      bus.fanoutPersisted(frame.event, frame.eventId);
    } else if (frame.kind === "result") result = frame.dependentTaskIds;
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
      enqueueFrame(parseWorkerFrame(message));
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
          const target = (event as AgentEvent & { target?: Record<string, unknown> }).target;
          const appId = String(target?.appId ?? target?.project ?? "")
            .trim()
            .replace(/\.app$/, "");
          const eventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
          if (
            relayedEvents.has(event) ||
            appId !== task.appId ||
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
    const exit = await waitForChild(child, timeoutMs);
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
    // close follows the final IPC messages; there is no separate raw-pipe end
    // promise that can hold a capacity slot forever after the worker exits.
    child.once("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolveExit({ code, signal });
    });
  });
}

function writeWorkerFrame(frame: WorkerFrame): Promise<void> {
  return new Promise((resolveSent, reject) => {
    if (!process.send || !process.connected) return reject(new Error("Task worker IPC is unavailable"));
    process.send(frame, (error: Error | null) => (error ? reject(error) : resolveSent()));
  });
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
    ...(parsed.definitionSource
      ? {
          definitionSource: {
            agentsRoot: required(String(parsed.definitionSource.agentsRoot ?? ""), "Task worker agentsRoot"),
            projectsRoot: required(String(parsed.definitionSource.projectsRoot ?? ""), "Task worker projectsRoot"),
            sharedRoot: required(String(parsed.definitionSource.sharedRoot ?? ""), "Task worker sharedRoot"),
          },
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
  if (process.env.MAY_TASK_ATTEMPT_CHILD !== "1") {
    throw new Error("Task worker mode is private to the parent runtime");
  }
  const stopWithParent = () => process.exit(143);
  process.once("disconnect", stopWithParent);
  const bus = new EventBus();
  attachEventPersistence({ bus, persistDir: input.roots.persistDir });
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
        void writeWorkerFrame({ kind: "event", eventId: Number(eventId), event }).catch(stopWithParent);
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
  const activeSource = input.definitionSource ?? appSources.ensureCurrent();
  const registry = new AppRegistry(discoverAppDefinitions(activeSource.projectsRoot, input.roots.projectsRoot));
  await registry.reload();
  const selectedAppIds = input.appIds ? new Set(input.appIds) : null;
  const task = input.task;
  // Attempts load only their selected agents. Recovery needs the whole active
  // catalog: retained Tasks can select or inherit a non-default agent.
  const agentNames = task
    ? registry
        .snapshot()
        .entries.filter(({ definition }) => definition.tasks && (!selectedAppIds || selectedAppIds.has(definition.id)))
        .flatMap(({ appDir, definition }) => {
          const configured = typeof definition.agent === "string" ? definition.agent : definition.owner;
          const agent = (typeof configured === "string" && configured.trim() ? configured : definition.id).replace(
            /^agent:/,
            "",
          );
          const resourceStore = AppTaskResourceStore.activeFromDb(getDb(input.roots.persistDir), definition.id);
          if (!resourceStore) return [agent];
          const selected = readAppTaskAgent(
            appTaskContext({
              appDir,
              projectDir: appDir,
              agent,
              maxConcurrent: 1,
              resourceStore,
            }),
            task.taskId,
          );
          return selected && selected !== agent ? [agent, selected] : [agent];
        })
    : undefined;
  const hostCapacity = new HostCapacity(1);
  try {
    await prepareDaemonAgents({
      readOutcomes: readTaskOutcomes,
      agentsRoot: activeSource.agentsRoot,
      sharedRoot: input.roots.sharedRoot,
      definitionSharedRoot: activeSource.sharedRoot,
      projectsRoot: activeSource.projectsRoot,
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
    // Immutable release paths carry the selected source identity. A recovery
    // child cannot observe a parent reload through its own in-memory registry.
    // Attempt workers deliberately ignore this fence and finish pinned work.
    const dependentTaskIds = await input.run(
      bus,
      () => appSources.current()?.projectsRoot === activeSource.projectsRoot,
    );
    await writeWorkerFrame({ kind: "result", dependentTaskIds });
  } catch (error) {
    await writeWorkerFrame({ kind: "error", error: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    process.off("message", incoming);
    process.off("disconnect", stopWithParent);
    await closeInstalledAppTaskRuntimes(bus);
    closeAllDbs();
  }
}
