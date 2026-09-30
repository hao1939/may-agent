import { readTaskEventTarget } from "../events/task-target.js";
import {
  taskAgentResultSchema as appTaskAgentResultSchema,
  type TaskAttempt,
  type TaskExecutor,
  type TaskExecutorName,
} from "@may-agent/sdk";
import { getDb } from "../../../lib/db/connection.js";
import { appDependencyCatalog } from "../../app-dependency-catalog.js";
import type { EventEnvelope } from "../events/bus.js";
import { EVENT_ROW_ID, eventData, type AgentEvent } from "../events/bus.js";
import { createRuntimeAppRead, readRuntimeTaskView } from "../reads/app-read.js";
import { readInstalledAppContract } from "../reads/app-contract.js";
import {
  readAppTaskLiveEvent,
  readAppTaskReconciliationEvents,
  readAppTaskWaitPromptContext,
} from "./app-task-context.js";
import {
  createAppTaskEvents,
  subscribeAppTaskPublications,
  type AppTaskEmission,
  type AppTaskEvents,
} from "./app-task-emitter.js";
import { type AppTaskExecutionPaths } from "./app-task-output-paths.js";
import {
  APP_TASK_ATTEMPT_LEASE_DURATION_MS,
  recordAppTaskAttemptSession,
  renewAppTaskAttemptLease,
  type AppTaskChildContext,
  type AppTaskClaim,
  type AppTaskLiveSnapshot,
} from "./app-task-reconciler.js";
import { ResourceTaskMutationStaleError } from "./app-task-store.js";
import type { WorkflowCapability } from "./execution.js";
import { normalizeTaskHandlerResult, type TaskCapabilityRun } from "./result.js";
import { appTaskConfig, configuredRegistryEntries, type AppTaskRuntimeDescriptor } from "./runtime-definition.js";
import type { AppTaskRuntimeOptions } from "./runtime-options.js";

const APP_TASK_AGENT_TIMEOUT_MS = 15 * 60_000;

const APP_TASK_WORKFLOW_TIMEOUT_MS = 30 * 60_000;

/** Core-owned input for one claimed execution, before choosing its adapter. */
export type TaskAttemptInput = {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  executionPaths: AppTaskExecutionPaths;
  childContext: AppTaskChildContext;
  taskSnapshot: AppTaskLiveSnapshot;
  event?: EventEnvelope;
};

/** The selected adapter uses the already-open attempt; it does not own its lifetime. */
export type TaskHandlerInput = TaskAttemptInput & {
  attempt: TaskAttempt;
  taskEvents: AppTaskEvents;
  fallbackReason?: string;
};

export function hasLiveAppTaskSession(opts: AppTaskRuntimeOptions, sessionId: string): boolean {
  return opts.sessions?.isLive(sessionId) ?? true;
}

export function interruptSupersededAgentSession(
  opts: AppTaskRuntimeOptions,
  sessionId: string,
  reason: string,
  taskId?: string,
): boolean {
  if (!opts.sessions)
    throw new Error("Task session recovery is unavailable; retained session ownership cannot be replaced safely");
  return opts.sessions.interrupt(sessionId, reason, taskId);
}

export async function runTaskWorkflow(
  input: TaskHandlerInput & { capability: WorkflowCapability },
): Promise<TaskCapabilityRun> {
  const { opts, descriptor, claim, ...execution } = input;
  if (!opts.workflows)
    return {
      handlerResult: {
        state: "error",
        summary: "Task workflow runner is not installed",
        facts: [],
        actions: [],
      },
      runId: null,
      unavailable: true,
    };
  return opts.workflows.execute({
    ...execution,
    handler: claim.handler,
    source: {
      projectRoot: opts.projectRoot,
      projectsRoot: opts.projectsRoot,
      persistDir: opts.persistDir,
      agentsRoot: opts.agentsRoot,
      sharedRoot: opts.sharedRoot,
    },
    descriptor: {
      id: descriptor.id,
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      app: descriptor.app,
    },
    executionTimeoutMs: APP_TASK_WORKFLOW_TIMEOUT_MS,
  });
}

type RuntimeTaskAttempt = {
  attempt: TaskAttempt;
  events: AppTaskEvents;
  acceptedLiveEventIds(): number[];
  close(): void;
};

/** Build the one fenced Task interface shared by every executor adapter. */
function runtimeTaskAttempt(input: TaskAttemptInput): RuntimeTaskAttempt {
  const { opts, descriptor, claim } = input;
  const task = readRuntimeTaskView(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    claim.taskId,
  );
  if (!task || task.generation !== claim.generation) {
    throw new ResourceTaskMutationStaleError();
  }
  const events = createAppTaskEvents({
    bus: opts.bus,
    db: descriptor.resourceStore.db,
    persistDir: opts.persistDir,
    appId: descriptor.id,
    claim,
    ...(input.event ? { parentEvent: input.event as AgentEvent } : {}),
  });
  const subscriptions = new Set<() => void>();
  const acceptedLiveEventIds = new Set<number>();
  const selfPublishedEventIds = new Set<number>();
  const controller = new AbortController();
  let closed = false;
  // Finish fallible context reads before acquiring subscriptions. If preparation
  // fails, no abandoned observer remains outside the attempt cleanup boundary.
  const attempt: TaskAttempt = {
    appId: descriptor.id,
    attemptId: claim.attemptId,
    signal: controller.signal,
    resourceVersion: claim.resourceVersion,
    role: opts.agents?.role(claim.agent) ?? {
      agent: claim.agent,
      instructions: `Act as the selected May agent ${claim.agent}.`,
    },
    task: structuredClone(task),
    read: {
      contract: async (appId) => readInstalledAppContract(configuredRegistryEntries(opts), appId),
      tasks: createRuntimeAppRead({
        getDb: () => descriptor.resourceStore.db,
        taskStateConfig: appTaskConfig(descriptor),
        readOutcomes: opts.readOutcomes,
      }).tasks,
    },
    ...(claim.previousAttempt ? { previousAttempt: structuredClone(claim.previousAttempt) } : {}),
    cwd: input.executionPaths.workspaceDir,
    declaredOutputPaths: [...claim.declaredOutputPaths],
    children: {
      ...(input.childContext.cancelled ? { cancelled: structuredClone(input.childContext.cancelled) } : {}),
      live: input.childContext.live.map(({ phase, ...child }) => ({
        ...structuredClone(child),
        status: phase === "converged" ? "done" : phase,
      })),
      completed: input.childContext.completed.map((child) => ({
        ...structuredClone(child),
        status: "done" as const,
      })),
    },
    waits: structuredClone(
      readAppTaskWaitPromptContext(
        descriptor.resourceStore,
        opts.persistDir ? getDb(opts.persistDir) : null,
        claim.taskId,
      ),
    ),
    events: readAppTaskReconciliationEvents(descriptor.resourceStore, claim),
    resultSchema: structuredClone(appTaskAgentResultSchema) as unknown as Record<string, unknown>,
    async publish(localKey, event) {
      if (closed) throw new Error(`Task ${descriptor.id}/${claim.taskId} attempt is closed`);
      const { localKey: _embeddedLocalKey, source: _source, ...emitted } = event;
      return { eventId: events.publish(localKey, emitted as AppTaskEmission) };
    },
    async reviseTask(change) {
      if (closed) throw new Error("Task attempt is closed");
      return (await import("./app-task-runtime.js")).reviseLoadedAppTask({
        bus: opts.bus,
        binding: {
          appId: descriptor.id,
          taskId: claim.taskId,
          generation: claim.generation,
          attemptId: claim.attemptId,
        },
        change,
      });
    },
    onEvent(listener) {
      if (closed) throw new Error(`Task ${descriptor.id}/${claim.taskId} attempt is closed`);
      // Each listener receives new input once; registering two listeners
      // must not let one listener's acknowledgment hide it from the other.
      const seenEventIds = new Set(
        claim.events.map(({ event }) => Number(event.eventId)).filter((id) => Number.isSafeInteger(id) && id > 0),
      );
      const unsubscribe = events.onEvent((incoming) => {
        const eventId = Number((incoming as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
        if (closed || selfPublishedEventIds.has(eventId) || seenEventIds.has(eventId)) return;
        if (Number.isSafeInteger(eventId) && eventId > 0) {
          if (descriptor.resourceStore.hasTaskEvent(claim.taskId, { eventId })) {
            const pending = descriptor.resourceStore.readTrigger(claim.taskId);
            if (
              !(pending?.events ?? (pending ? [{ event: pending.event }] : [])).some(
                ({ event }) => Number(event.eventId) === eventId,
              )
            )
              return;
          }
          seenEventIds.add(eventId);
        }
        listener(readAppTaskLiveEvent(appTaskConfig(descriptor), claim.taskId, incoming), () => {
          if (closed || !Number.isSafeInteger(eventId) || eventId <= 0) return;
          acceptedLiveEventIds.add(eventId);
        });
      });
      let subscribed = true;
      const stop = () => {
        if (!subscribed) return;
        subscribed = false;
        subscriptions.delete(stop);
        unsubscribe();
      };
      subscriptions.add(stop);
      return stop;
    },
  };
  // The exact publication receipt is already known to this attempt, including
  // retry-safe returns that skip EventBus fan-out. Only valid settlement may
  // consume it. Tools and executors share the same fenced emitter boundary.
  const unsubscribePublications = subscribeAppTaskPublications(
    opts.bus,
    { appId: descriptor.id, taskId: claim.taskId, generation: claim.generation, attemptId: claim.attemptId },
    (publication, eventId) => {
      const target = readTaskEventTarget((publication as AgentEvent & { target?: unknown }).target);
      if (!closed && target?.appId === descriptor.id && target.taskId === claim.taskId)
        selfPublishedEventIds.add(eventId);
    },
  );
  const unsubscribeCancellation = events.onEvent((incoming) => {
    if (incoming.type !== "app.task.cancelled" && incoming.type !== "app.task.attempt.stopped") return;
    const cancellation =
      incoming.type === "app.task.cancelled" ? descriptor.resourceStore.readCancellation(claim.taskId) : null;
    if (incoming.type === "app.task.cancelled" && !cancellation) return;
    if (
      incoming.type === "app.task.attempt.stopped" &&
      descriptor.resourceStore.readAttempt(claim.attemptId)?.failureReason !== "owner-stopped"
    )
      return;
    const data = eventData(incoming) as Record<string, unknown>;
    if (data.attemptId !== claim.attemptId) return;
    const reason = cancellation?.reason ?? (typeof data.reason === "string" ? data.reason : "Task was cancelled");
    controller.abort(new Error(reason));
  });
  return {
    events,
    attempt,
    acceptedLiveEventIds: () =>
      [...new Set([...acceptedLiveEventIds, ...selfPublishedEventIds])].sort((left, right) => left - right),
    close() {
      if (closed) return;
      closed = true;
      unsubscribePublications();
      unsubscribeCancellation();
      for (const unsubscribe of [...subscriptions]) unsubscribe();
    },
  };
}

/**
 * Open one fenced Task surface around handler selection and execution.
 * Core owns lease renewal, live-event observation and cleanup on every exit;
 * the handler returns a proposal for the caller to settle after this closes.
 */
export async function runTaskExecutorAttempt(input: TaskAttemptInput & {
  execute: (attempt: TaskAttempt, events: AppTaskEvents) => Promise<TaskCapabilityRun>;
}): Promise<TaskCapabilityRun> {
  const taskAttempt = runtimeTaskAttempt(input);
  const leaseTimer = setInterval(
    () => {
      try {
        if (!renewAppTaskAttemptLease(appTaskConfig(input.descriptor), input.claim)) clearInterval(leaseTimer);
      } catch {
        clearInterval(leaseTimer);
      }
    },
    Math.floor(APP_TASK_ATTEMPT_LEASE_DURATION_MS / 3),
  );
  leaseTimer.unref();
  try {
    const result = await input.execute(taskAttempt.attempt, taskAttempt.events);
    const acceptedLiveEventIds = taskAttempt.acceptedLiveEventIds();
    return acceptedLiveEventIds.length > 0 ? { ...result, acceptedLiveEventIds } : result;
  } finally {
    clearInterval(leaseTimer);
    taskAttempt.close();
  }
}

export async function runTaskAgent(input: TaskHandlerInput): Promise<TaskCapabilityRun> {
  const { opts, descriptor, claim, ...execution } = input;
  if (!opts.agents?.available(claim.agent))
    return {
      handlerResult: {
        state: "error",
        summary: `Task agent ${claim.agent} is not available`,
        facts: [],
        actions: [],
      },
      runId: null,
      unavailable: true,
    };
  return opts.agents.execute({
    ...execution,
    executionTimeoutMs: APP_TASK_AGENT_TIMEOUT_MS,
    descriptor: {
      id: descriptor.id,
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      app: descriptor.app,
    },
    dependencies: appDependencyCatalog(configuredRegistryEntries(opts), descriptor.id),
    sessionStarted: (id) => {
      recordAppTaskAttemptSession(appTaskConfig(descriptor), claim, id);
    },
  });
}

export async function runRegisteredTaskExecutor(input: TaskHandlerInput & {
  name: TaskExecutorName;
  execute: TaskExecutor;
}): Promise<TaskCapabilityRun> {
  const runId = `executor:${input.name}:${input.claim.attemptId}`;
  try {
    const result = await input.execute(input.attempt);
    return {
      handlerResult: normalizeTaskHandlerResult(
        result,
        { type: "done", summary: `${input.name} executor completed`, runId },
        {
          allowNeedsAgent: true,
          validateAction: input.descriptor.app.tasks?.validateAction,
          validateCondition: input.descriptor.app.tasks?.validateCondition,
        },
      ),
      runId,
    };
  } catch (error) {
    return {
      handlerResult: {
        state: "error",
        summary: `${input.name} executor failed: ${error instanceof Error ? error.message : String(error)}`,
        facts: [],
        actions: [],
      },
      runId,
      executionFailed: true,
    };
  }
}
