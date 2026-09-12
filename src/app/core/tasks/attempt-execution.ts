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
import { listRuntimeTaskViews, readRuntimeTaskView } from "../reads/app-read.js";
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
} from "./app-task-reconciler.js";
import { ResourceTaskMutationStaleError } from "./app-task-store.js";
import type { AppTaskExecutionObserver, TaskAgentInput, TaskWorkflowInput } from "./execution.js";
import { normalizeTaskHandlerResult, type TaskCapabilityRun } from "./result.js";
import { appTaskConfig, configuredRegistryEntries, type AppTaskRuntimeDescriptor } from "./runtime-definition.js";
import type { AppTaskRuntimeOptions } from "./runtime-options.js";

const APP_TASK_AGENT_TIMEOUT_MS = 15 * 60_000;

const APP_TASK_WORKFLOW_TIMEOUT_MS = 30 * 60_000;

export function hasLiveAppTaskSession(opts: AppTaskRuntimeOptions, sessionId: string): boolean {
  return opts.sessions?.isLive(sessionId) ?? true;
}

export function interruptSupersededAgentSession(
  opts: AppTaskRuntimeOptions,
  sessionId: string,
  reason: string,
  taskId?: string,
): void {
  if (!opts.sessions)
    throw new Error("Task session recovery is unavailable; retained session ownership cannot be replaced safely");
  opts.sessions.interrupt(sessionId, reason, taskId);
}

export async function runTaskCapability(
  input: Omit<
    TaskWorkflowInput,
    "source" | "taskRead" | "attempt" | "taskEvents" | "executionTimeoutMs" | "handler"
  > & {
    opts: AppTaskRuntimeOptions;
    descriptor: AppTaskRuntimeDescriptor;
    claim: AppTaskClaim;
    declaredOutputPaths: string[];
  },
): Promise<TaskCapabilityRun> {
  return runTaskExecutorAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    executionPaths: input.executionPaths,
    declaredOutputPaths: input.declaredOutputPaths,
    childContext: input.childContext,
    ...(input.event ? { event: input.event } : {}),
    execute: async (attempt, taskEvents) => {
      if (!input.opts.workflows)
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
      const { opts, descriptor, claim, declaredOutputPaths: _outputs, ...execution } = input;
      const config = { taskStateConfig: appTaskConfig(input.descriptor) };
      return opts.workflows!.execute({
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
        attempt,
        taskEvents,
        executionTimeoutMs: APP_TASK_WORKFLOW_TIMEOUT_MS,
        taskRead: {
          list: async (options) => listRuntimeTaskViews(config, options),
          outcomes: async (projection) => {
            if (!opts.readOutcomes) throw new Error("Task outcome reporting is unavailable");
            return opts.readOutcomes({
              appDir: descriptor.appDir,
              projection,
              tasks: {
                list: (options) => listRuntimeTaskViews(config, options),
                get: (id) => readRuntimeTaskView(config, id),
              },
            });
          },
          get: async (id) => readRuntimeTaskView(config, id),
        },
      });
    },
  });
}

type RuntimeTaskAttempt = {
  attempt: TaskAttempt;
  events: AppTaskEvents;
  acceptedLiveEventIds(): number[];
  close(): void;
};

/** Build the one fenced Task interface shared by every executor adapter. */
function runtimeTaskAttempt(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  cwd: string;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
}): RuntimeTaskAttempt {
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
    attempt: {
      appId: descriptor.id,
      attemptId: claim.attemptId,
      signal: controller.signal,
      resourceVersion: claim.resourceVersion,
      role: opts.agents?.role(claim.agent) ?? {
        agent: claim.agent,
        instructions: `Act as the selected May agent ${claim.agent}.`,
      },
      task: structuredClone(task),
      ...(claim.previousAttempt ? { previousAttempt: structuredClone(claim.previousAttempt) } : {}),
      cwd: input.cwd,
      declaredOutputPaths: [...input.declaredOutputPaths],
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
    },
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

export function interruptSupersededObservationSessions(
  opts: AppTaskRuntimeOptions,
  observation: { taskId: string; generation: number; supersededSessionIds?: string[] },
): void {
  for (const sessionId of observation.supersededSessionIds ?? []) {
    interruptSupersededAgentSession(
      opts,
      sessionId,
      `Task ${observation.taskId} advanced to generation ${observation.generation}; the previous reconciliation session is obsolete`,
      observation.taskId,
    );
  }
}

export function interruptSupersededActionSessions(
  opts: AppTaskRuntimeOptions,
  taskId: string,
  sessionIds: string[],
): void {
  for (const sessionId of sessionIds) {
    interruptSupersededAgentSession(
      opts,
      sessionId,
      `Task ${taskId} applied a reconciliation action that superseded the session's task generation`,
      taskId,
    );
  }
}

/**
 * Give every agent/CLI executor the same fenced Task surface. Runtime owns
 * attempt lifetime and lease renewal; adapters only translate TaskAttempt to
 * their execution mechanism and return one Task result.
 */
export async function runTaskExecutorAttempt(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  executionPaths: AppTaskExecutionPaths;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
  execute: (attempt: TaskAttempt, events: AppTaskEvents) => Promise<TaskCapabilityRun>;
}): Promise<TaskCapabilityRun> {
  const taskAttempt = runtimeTaskAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    cwd: input.executionPaths.workspaceDir,
    declaredOutputPaths: input.declaredOutputPaths,
    childContext: input.childContext,
    ...(input.event ? { event: input.event } : {}),
  });
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

export async function runTaskAgent(
  input: Omit<TaskAgentInput, "attempt" | "sessionStarted" | "dependencies" | "executionTimeoutMs"> & {
    opts: AppTaskRuntimeOptions;
    descriptor: AppTaskRuntimeDescriptor;
    claim: AppTaskClaim;
    declaredOutputPaths: string[];
  },
): Promise<TaskCapabilityRun> {
  return runTaskExecutorAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    executionPaths: input.executionPaths,
    declaredOutputPaths: input.declaredOutputPaths,
    childContext: input.childContext,
    ...(input.event ? { event: input.event } : {}),
    execute: async (attempt) => {
      const { opts, descriptor, claim: _claim, declaredOutputPaths: _outputs, ...execution } = input;
      if (!opts.agents?.available(input.claim.agent))
        return {
          handlerResult: {
            state: "error",
            summary: `Task agent ${input.claim.agent} is not available`,
            facts: [],
            actions: [],
          },
          runId: null,
          unavailable: true,
        };
      return opts.agents.execute({
        ...execution,
        attempt,
        executionTimeoutMs: APP_TASK_AGENT_TIMEOUT_MS,
        descriptor: {
          id: descriptor.id,
          appDir: descriptor.appDir,
          projectDir: descriptor.projectDir,
          app: descriptor.app,
        },
        dependencies: appDependencyCatalog(configuredRegistryEntries(opts), descriptor.id),
        sessionStarted: (id) => {
          recordAppTaskAttemptSession(appTaskConfig(descriptor), input.claim, id);
        },
      });
    },
  });
}

export async function runRegisteredTaskExecutor(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  executionPaths: AppTaskExecutionPaths;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
  observer?: AppTaskExecutionObserver;
  name: TaskExecutorName;
  execute: TaskExecutor;
}): Promise<TaskCapabilityRun> {
  return runTaskExecutorAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    executionPaths: input.executionPaths,
    declaredOutputPaths: input.declaredOutputPaths,
    childContext: input.childContext,
    ...(input.event ? { event: input.event } : {}),
    execute: async (attempt) => {
      const runId = `executor:${input.name}:${input.claim.attemptId}`;
      try {
        input.observer?.providerStarted(0);
        const result = await input.execute(attempt);
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
      } finally {
        input.observer?.providerFinished();
      }
    },
  });
}
