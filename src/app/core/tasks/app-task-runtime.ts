import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { join, resolve } from "node:path";
import { Check } from "typebox/value";
import type { EventEnvelope } from "../events/bus.js";
import { normalizeTaskHandlerResult, type TaskCapabilityRun } from "./result.js";
import type {
  TaskAgentRunner,
  TaskAgentInput,
  TaskSessionRecovery,
  TaskConversationRunner,
  TaskWorkflowRunner,
  TaskWorkflowInput,
  AppTaskExecutionObserver,
} from "./execution.js";
import { appTaskSessionBinding } from "./session-binding.js";
import { getDb } from "../../../lib/db/connection.js";
import { admitTaskRequest } from "../state/inbox.js";
import { appInputFeedbackEvent } from "../inbox/input-result.js";
import {
  admitConversationTaskInput,
  conversationTaskIntent,
  admitConversationTaskChange,
  conversationTaskId,
  completeConversationTaskTurn,
  isConversationTask,
  stopConversationTaskTurn,
  type ConversationTaskChangeRef,
} from "../state/conversation-task-turns.js";
import type { AppTurnTarget, CreateAppInboxItem } from "../state/app-inbox-store.js";
import {
  admitTaskVerificationResult as admitAppTaskVerificationResult,
  taskAgentResultSchema as appTaskAgentResultSchema,
  type AppInputContext,
  type AppTaskAttachment,
  type Condition as AppTaskConditionSpec,
  type TaskAppDependency,
  type TaskAction,
  type TaskAcceptanceBasis as AppTaskAcceptanceBasis,
  type TaskAttempt,
  type TaskExecutor,
  type TaskExecutorName,
  type TaskIntent as AppTaskIntent,
  type TaskReconcileResult as AppTaskHandlerResult,
} from "@may-agent/sdk";
import {
  configuredAppAgent,
  prepareAppTaskRuntimeDescriptors,
  standaloneAppTaskAdmissionDescriptors,
  syncProjectReadModel,
  type AppTaskRuntimeDescriptor,
} from "./runtime-definition.js";
import {
  cacheTaskSnapshots,
  ResourceTaskMutationStaleError,
  type AppTaskContext,
} from "./app-task-store.js";
import { appTaskExecutionPaths, withAppTaskWorkspace, type AppTaskExecutionPaths } from "./app-task-output-paths.js";
import type { TaskDetail, TaskListOptions, TaskOutcomePage, TaskOutcomeProjection, TaskPage } from "@may-agent/sdk/app";
import { listRuntimeTaskViews, readRuntimeTaskView } from "../reads/app-read.js";
import type { TaskOutcomeReader } from "../reads/reporting.js";
import { getAppInboxItem, listOpenAppInboxItemsByIdempotencyPrefix } from "../state/app-inbox-store.js";
import { canonicalAppEvent } from "../../canonical-app-event.js";
import { appDependencyCatalog } from "../../app-dependency-catalog.js";
import { readAppTaskLiveEvent, readAppTaskReconciliationEvents, readAppTaskWaitPromptContext } from "./app-task-context.js";
import type { AppRegistry, AppRegistrySnapshot } from "../apps/registry.js";
import { AppTaskController, type AppTaskDispatch } from "./controller.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { createAppTaskEvents, type AppTaskEmission, type AppTaskEvents } from "./app-task-emitter.js";
import { HostCapacity } from "../scheduling/host-capacity.js";
import type { AppTaskQueueOptions } from "./queue.js";
import {
  matchingAppTaskConditionTaskIds,
  matchesAppTaskCondition,
  trackAppTaskConditionEventForTasks,
} from "./app-task-condition-tracker.js";
import {
  childEventTrace,
  eventData,
  EVENT_DELIVERY_RESULT,
  EVENT_ROW_ID,
  type AgentEvent,
  type DeliveryResult,
  type EventBus,
} from "../events/bus.js";
import {
  assertAppTaskEffectFresh,
  assertAppTaskClaimCurrent,
  hasPendingAppTaskEvidence,
  associateAppTaskSession,
  claimObservedAppTask,
  cancelAppTask,
  stopAppTask,
  completeAppTask,
  deferAppTask,
  failAppTaskAttempt,
  markAppTaskAttention,
  isAppTaskActionStaleError,
  observeAppTaskIntent,
  appTaskQueueEntries,
  readAppTaskChildContext,
  readAppTaskLiveSnapshot,
  readAppTaskAdmissionOutcome,
  readPendingAppTaskTrigger,
  recordAppTaskTrigger,
  repairPreviousRuntimeRecoveryAttention,
  repairUnadmittedAppDependencyWaits,
  repairRunningAppTasksWithoutAttempt,
  recoverableAppTaskAttempts,
  expiredAgentSessionAppTaskAttempt,
  releaseInterruptedAppTaskAttempt,
  releaseLateTerminalWorkflowAppTaskAttempt,
  releaseTerminalSessionExpiredAppTaskAttempt,
  releaseStaleAppTaskResult,
  retryFailedAppTask,
  recordAppTaskAttemptSession,
  recordAppTaskAttemptWorkspace,
  appTaskContext,
  renewAppTaskAttemptLease,
  APP_TASK_ATTEMPT_LEASE_DURATION_MS,
  type AppTaskAttemptRecovery,
  type AppTaskChildContext,
  type AppTaskClaim,
  type AppTaskObservationResult,
} from "./app-task-reconciler.js";
import type { TaskWorkspaces, PreparedTaskWorkspace } from "./workspace.js";

type AppTaskTiming = {
  dispatch: AppTaskDispatch;
  claimMs?: number;
  contextBuildMs?: number;
  providerStartMs?: number;
  providerMs?: number;
  resultPersistenceMs: number;
  promptBytes?: number;
  attemptId?: string;
  generation?: number;
  outcome?: "completed" | "failed";
};

function publishAppTaskTiming(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  taskId: string,
  timing: AppTaskTiming,
): void {
  const finishedAt = Date.now();
  const timer = setTimeout(() => {
    // Execution can drain and release its database before this optional report runs.
    if (!appRouterOptionsByBus.has(opts.bus)) return;
    opts.bus.emit({
      type: "project.task.reconcile.profiled",
      source: `app-task:${descriptor.id}:observer`,
      owner: `agent:${descriptor.agent}`,
      target: { appId: descriptor.id },
      data: {
        project: descriptor.id,
        taskId,
        attemptId: timing.attemptId,
        generation: timing.generation,
        lane: timing.dispatch.lane,
        enqueuedAt: timing.dispatch.enqueuedAt,
        startedAt: timing.dispatch.startedAt,
        finishedAt,
        readyWaitMs: timing.dispatch.readyWaitMs,
        claimMs: timing.claimMs,
        contextBuildMs: timing.contextBuildMs,
        providerStartMs: timing.providerStartMs,
        providerMs: timing.providerMs,
        resultPersistenceMs: timing.resultPersistenceMs,
        promptBytes: timing.promptBytes,
        totalMs: Math.max(0, finishedAt - timing.dispatch.startedAt),
        outcome: timing.outcome,
      },
    } as unknown as AgentEvent);
  }, 0);
  timer.unref?.();
}

const APP_TASK_AGENT_TIMEOUT_MS = 15 * 60_000;
const APP_TASK_WORKFLOW_TIMEOUT_MS = 30 * 60_000;
const APP_DEPENDENCY_REVIEW_AFTER_MS = 300_000;

export interface AppTaskRuntimeOptions {
  projectsRoot: string;
  projectRoot: string;
  persistDir?: string;
  agentsRoot?: string;
  sharedRoot?: string;
  agents?: TaskAgentRunner;
  conversations?: TaskConversationRunner;
  sessions?: TaskSessionRecovery;
  bus: EventBus;
  hostCapacity: HostCapacity;
  /**
   * Optional execution boundary for one claimed Task attempt. Production uses
   * an isolated process; tests and explicit single-process tools may omit it.
   * The canonical Task resource remains the scheduling and fencing authority.
   */
  executeAttempt?: (input: { appId: string; taskId: string; dispatch: AppTaskDispatch }) => Promise<string[]>;
  /** Optional process boundary for the startup repair pass. */
  executeRecovery?: () => Promise<void>;
  /** Install descriptors and routing without starting local controllers. */
  installControllers?: boolean;
  /** Limit descriptor preparation to exact Apps in a one-attempt worker. */
  taskAppIds?: readonly string[];
  /** The parent publishes read models; execution workers reuse them. */
  syncReadModels?: boolean;
  /** Optional host adapters selected by Task intent. Built-ins remain replaceable. */
  executors?: Readonly<Record<string, TaskExecutor>>;
  /** Optional workflow implementation, selected by composition. */
  workflows?: TaskWorkflowRunner;
  /** Optional worktree implementation; required only by worktree-backed attempts. */
  workspaces?: TaskWorkspaces;
  /** Optional projection; canonical Task reads remain available without it. */
  readOutcomes?: TaskOutcomeReader;
  appRegistry?: AppRegistry;
  /** Prospective canonical generation used during one coordinated reload. */
  appRegistrySnapshot?: AppRegistrySnapshot;
  /** Final synchronous publication step inside the atomic generation boundary. */
  afterCommit?: (result: { installed: AppTaskRuntimeDescriptor[] }) => void;
  /** Do not execute queued App work until daemon startup has fenced sessions. */
  startAfter?: PromiseLike<void>;
}

function snapshotTaskExecution(opts: AppTaskRuntimeOptions): AppTaskRuntimeOptions {
  return {
    ...opts,
    appRegistrySnapshot: opts.appRegistrySnapshot ?? opts.appRegistry?.snapshot(),
    agents: opts.agents?.snapshot(),
    conversations: opts.conversations?.snapshot?.() ?? opts.conversations,
    workflows: opts.workflows?.snapshot?.() ?? opts.workflows,
  };
}

function hasLiveAppTaskSession(opts: AppTaskRuntimeOptions, sessionId: string): boolean {
  return opts.sessions?.isLive(sessionId) ?? true;
}

function interruptSupersededAgentSession(
  opts: AppTaskRuntimeOptions,
  sessionId: string,
  reason: string,
  taskId?: string,
): void {
  if (!opts.sessions)
    throw new Error("Task session recovery is unavailable; retained session ownership cannot be replaced safely");
  opts.sessions.interrupt(sessionId, reason, taskId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

type AppTaskSessionScope = {
  binding: { appId: string; taskId: string; generation: number } | null;
  workflowRunId: string | null;
};

function readAppTaskSessionScope(sessions: TaskSessionRecovery | undefined, sessionId: string): AppTaskSessionScope {
  if (!sessions) {
    return {
      binding: null,
      workflowRunId: null,
    };
  }
  const meta = sessions.read(sessionId);
  if (!meta) {
    return {
      binding: null,
      workflowRunId: null,
    };
  }
  return {
    binding: appTaskSessionBinding(meta.taskBinding),
    workflowRunId: firstNonEmptyString(meta.workflowRunId),
  };
}

function flattenEvent(event: AgentEvent): Record<string, unknown> {
  const record = event as unknown as Record<string, unknown>;
  const data = isRecord(record.data) ? record.data : {};
  const persistedEventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
  return {
    ...data,
    ...record,
    data,
    ...(Number.isInteger(persistedEventId) && Number(persistedEventId) > 0
      ? { eventId: Number(persistedEventId) }
      : {}),
  };
}

/** Canonical durable Task event envelope plus its event-journal identity. */
function canonicalTaskEvent(event: AgentEvent): Record<string, unknown> {
  const canonical = canonicalAppEvent(event) as Record<string, unknown>;
  const envelope = event as unknown as Record<string, unknown>;
  const persistedEventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
  const timestamp = envelope.timestamp;
  return {
    ...canonical,
    ...(typeof timestamp === "number" && Number.isFinite(timestamp)
      ? { timestamp }
      : typeof timestamp === "string" && timestamp.trim()
        ? { timestamp: timestamp.trim() }
        : {}),
    ...(Number.isInteger(persistedEventId) && Number(persistedEventId) > 0
      ? { eventId: Number(persistedEventId) }
      : {}),
  };
}

function taskCompletionDisposition(
  taskId: string,
  actions: TaskAction[],
  taskContinues: boolean | undefined,
): "converged" | "progress" | "revised" {
  if (!taskContinues) return "converged";
  return actions.some((action) => action.kind === "update-task" && action.taskId === taskId) ? "revised" : "progress";
}

async function runTaskCapability(
  input: Omit<TaskWorkflowInput, "source" | "taskRead" | "attempt" | "taskEvents" | "executionTimeoutMs" | "handler"> & {
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
            evidence: [],
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
  const controller = new AbortController();
  let closed = false;
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
        const unsubscribe = events.onEvent((incoming) => {
          const eventId = Number((incoming as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
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
    acceptedLiveEventIds: () => [...acceptedLiveEventIds].sort((left, right) => left - right),
    close() {
      if (closed) return;
      closed = true;
      unsubscribeCancellation();
      for (const unsubscribe of [...subscriptions]) unsubscribe();
    },
  };
}

export function admitTaskAppDependencies(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  dependencies: TaskAppDependency[];
  existingConditions?: AppTaskConditionSpec[];
  acceptedLiveEventIds?: number[];
}): AppTaskConditionSpec[] {
  const dependencyIds = new Set<string>();
  for (const dependency of input.dependencies) {
    if (dependencyIds.has(dependency.id)) {
      throw new Error(`Task result declares App dependency ${dependency.id} more than once`);
    }
    dependencyIds.add(dependency.id);
    assertInstalledAppDependency(input.opts, dependency);
  }

  const existing = (input.existingConditions ?? []).flatMap((condition) => {
    if (condition.type !== "app.dependency.updated" || !condition.id.startsWith("app-request:")) return [];
    const requestId = condition.subject.startsWith("id:") ? condition.subject.slice("id:".length) : "";
    if (!requestId || condition.id !== `app-request:${requestId}`) return [];
    const item = input.opts.persistDir ? getAppInboxItem(getDb(input.opts.persistDir), requestId) : null;
    return [{ condition, requestId, item }];
  });
  const matchedExisting = new Set<string>();
  const matches = new Map<string, (typeof existing)[number]>();
  const requestLineagePrefix = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:${input.claim.generation}:`;
  const detachedOpenByApp = new Map<string, ReturnType<typeof listOpenAppInboxItemsByIdempotencyPrefix>>();
  const detachedOpenFor = (appId: string) => {
    const cached = detachedOpenByApp.get(appId);
    if (cached) return cached;
    const items = input.opts.persistDir
      ? listOpenAppInboxItemsByIdempotencyPrefix(getDb(input.opts.persistDir), {
          appId,
          sourceAppId: input.descriptor.id,
          prefix: requestLineagePrefix,
        })
      : [];
    detachedOpenByApp.set(appId, items);
    return items;
  };
  const detachedMatch = (item: ReturnType<typeof detachedOpenFor>[number]) => ({
    requestId: item.id,
    item,
    condition: {
      id: `app-request:${item.id}`,
      type: "app.dependency.updated",
      subject: `id:${item.id}`,
      expected: { field: "status", equals: "done" },
      owner: `app:${item.appId}`,
      reviewAfterMs: APP_DEPENDENCY_REVIEW_AFTER_MS,
    } satisfies AppTaskConditionSpec,
  });

  for (const dependency of input.dependencies) {
    const direct = existing.filter(
      ({ condition, requestId }) =>
        dependency.id === requestId || dependency.id === condition.id || dependency.id === `app-request:${requestId}`,
    );
    const exact = existing.filter(
      ({ item }) =>
        item &&
        item.appId === dependency.appId &&
        item.targetTaskId === dependency.taskId &&
        isDeepStrictEqual(item.input, dependency.input),
    );
    const detachedRequestId = dependency.id.replace(/^app-request:/, "");
    const detachedItem =
      direct.length === 0 && exact.length === 0 && input.opts.persistDir
        ? getAppInboxItem(getDb(input.opts.persistDir), detachedRequestId)
        : null;
    const detachedById =
      detachedItem &&
      detachedItem.status !== "done" &&
      detachedItem.source.kind === "app" &&
      detachedItem.source.id === input.descriptor.id &&
      detachedItem.idempotencyKey?.startsWith(requestLineagePrefix)
        ? [detachedMatch(detachedItem)]
        : [];
    const detachedByMeaning =
      direct.length === 0 && exact.length === 0 && detachedById.length === 0
        ? detachedOpenFor(dependency.appId)
            .filter(
              (item) => item.targetTaskId === dependency.taskId && isDeepStrictEqual(item.input, dependency.input),
            )
            .map(detachedMatch)
        : [];
    const candidates =
      direct.length > 0
        ? direct
        : exact.length > 0
          ? exact
          : detachedById.length > 0
            ? detachedById
            : detachedByMeaning;
    if (candidates.length > 1) {
      throw new Error(`App dependency ${dependency.id} ambiguously matches multiple open requests`);
    }
    const match = candidates[0];
    if (!match) continue;
    if (match.item && match.item.appId !== dependency.appId) {
      throw new Error(
        `App dependency ${dependency.id} refers to open request ${match.requestId} for App ${match.item.appId}, not ${dependency.appId}`,
      );
    }
    // A create-work request has no original targetTaskId. Once admitted, the
    // inbox records the Task it resolved to in waitingOn. Agents may echo that
    // observed Task while preserving the exact request ID; this is reuse, not
    // authority to retarget or create work.
    const resolvedCreatedTaskMatches = Boolean(
      match.item &&
      match.item.targetTaskId === undefined &&
      match.item.waitingOn?.kind === "task" &&
      match.item.waitingOn.id === dependency.taskId,
    );
    if (match.item && match.item.targetTaskId !== dependency.taskId && !resolvedCreatedTaskMatches) {
      throw new Error(
        `App dependency ${dependency.id} refers to open request ${match.requestId} for Task ${match.item.targetTaskId ?? "new work"}, not ${dependency.taskId ?? "new work"}`,
      );
    }
    if (matchedExisting.has(match.requestId)) {
      throw new Error(`Open App request ${match.requestId} is declared more than once`);
    }
    matchedExisting.add(match.requestId);
    matches.set(dependency.id, match);
  }

  const newDependencies = input.dependencies.filter((dependency) => !matches.has(dependency.id));
  for (const dependency of newDependencies) {
    const unresolvedExisting = existing.find(({ item, requestId }) => !item && !matchedExisting.has(requestId));
    if (unresolvedExisting) {
      throw new Error(
        `Cannot classify App dependency ${dependency.id} while open request ${unresolvedExisting.requestId} is unavailable`,
      );
    }
  }
  // New dependencies add work. Stored waits survive omission; asking the agent
  // to repeat them would turn continuation back into bookkeeping. Exact reuse,
  // duplicate checks and effect fencing still protect already admitted work.
  for (let index = 0; index < newDependencies.length; index += 1) {
    const dependency = newDependencies[index]!;
    const duplicate = newDependencies
      .slice(0, index)
      .find(
        (candidate) =>
          candidate.appId === dependency.appId &&
          candidate.taskId === dependency.taskId &&
          isDeepStrictEqual(candidate.input, dependency.input),
      );
    if (duplicate) {
      throw new Error(
        `App dependencies ${duplicate.id} and ${dependency.id} request the same ${dependency.appId} outcome`,
      );
    }
  }
  if (newDependencies.length > 0) {
    assertAppTaskEffectFresh(appTaskConfig(input.descriptor), input.claim, input.acceptedLiveEventIds);
  }

  const admitted = new Map<string, AppTaskConditionSpec>();
  for (const dependency of newDependencies) {
    const identity = createHash("sha256")
      .update(
        JSON.stringify({
          appId: input.descriptor.id,
          taskId: input.claim.taskId,
          generation: input.claim.generation,
          dependencyId: dependency.id,
          targetAppId: dependency.appId,
          targetTaskId: dependency.taskId,
          targetInput: dependency.input,
        }),
      )
      .digest("hex")
      .slice(0, 24);
    const requestId = `appdep_${identity}`;
    const idempotencyKey = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:${input.claim.generation}:${dependency.id}:${identity}`;
    const requested = input.opts.bus.emit({
      type: "app.input.requested",
      source: `app-task:${input.descriptor.id}`,
      owner: `app:${dependency.appId}`,
      data: {
        requestId,
        appId: dependency.appId,
        ...(dependency.taskId ? { targetTaskId: dependency.taskId } : {}),
        input: dependency.input,
        source: { kind: "app", id: input.descriptor.id },
        idempotencyKey,
      },
    });
    const delivery = requested[EVENT_DELIVERY_RESULT];
    // A worker persists the input before the parent admits its relayed event.
    // Save the exact pending wait once publication is durable; a local receipt
    // is only available when admission runs in this process. Event recovery
    // can redeliver that same input if the worker/parent stops between them.
    if (!delivery && !requested[EVENT_ROW_ID]) {
      throw new Error(
        `App dependency ${dependency.id} was neither admitted nor durably published for App ${dependency.appId}; the Task remains runnable`,
      );
    }
    admitted.set(dependency.id, {
      id: `app-request:${requestId}`,
      type: "app.dependency.updated",
      subject: `id:${requestId}`,
      expected: { field: "status", equals: "done" },
      owner: `app:${dependency.appId}`,
      reviewAfterMs: APP_DEPENDENCY_REVIEW_AFTER_MS,
    });
  }

  return input.dependencies.map((dependency) => {
    const condition = matches.get(dependency.id)?.condition ?? admitted.get(dependency.id)!;
    return {
      ...condition,
      owner: condition.owner ?? `app:${dependency.appId}`,
      reviewAfterMs: condition.reviewAfterMs ?? APP_DEPENDENCY_REVIEW_AFTER_MS,
    };
  });
}

function openTaskAppDependencyConditions(config: AppTaskContext, taskId: string): AppTaskConditionSpec[] {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  return (resource?.status.conditionIds ?? []).flatMap((conditionId) => {
    const condition = tree.conditions?.[conditionId];
    if (!condition || condition.status.state === "true" || condition.spec.type !== "app.dependency.updated") {
      return [];
    }
    return [{ id: condition.metadata.id, ...structuredClone(condition.spec) }];
  });
}

export function mergeTaskConditions(
  conditions: AppTaskConditionSpec[],
  authoritativeIds: ReadonlySet<string> = new Set(),
): AppTaskConditionSpec[] {
  const merged = new Map<string, AppTaskConditionSpec>();
  for (const condition of conditions) {
    const current = merged.get(condition.id);
    if (current && !isDeepStrictEqual(current, condition)) {
      // Persisted Conditions are the reconciliation authority. An executor may
      // echo different advisory metadata from its bounded prompt, but the
      // observable identity must still match. Retargeting the subject, type, or
      // expected fact remains a conflict rather than silently changing a wait.
      if (
        authoritativeIds.has(condition.id) &&
        current.type === condition.type &&
        current.subject === condition.subject &&
        isDeepStrictEqual(current.expected, condition.expected)
      ) {
        continue;
      }
      throw new Error(`Task result conflicts with existing Condition ${condition.id}`);
    }
    merged.set(condition.id, condition);
  }
  return [...merged.values()];
}

function interruptSupersededObservationSessions(
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

function interruptSupersededActionSessions(opts: AppTaskRuntimeOptions, taskId: string, sessionIds: string[]): void {
  for (const sessionId of sessionIds) {
    interruptSupersededAgentSession(
      opts,
      sessionId,
      `Task ${taskId} applied a reconciliation action that superseded the session's task generation`,
      taskId,
    );
  }
}

function configuredRegistryEntries(opts: AppTaskRuntimeOptions): AppRegistrySnapshot["entries"] {
  return opts.appRegistrySnapshot?.entries ?? opts.appRegistry?.snapshot().entries ?? [];
}

function assertInstalledAppDependency(
  opts: AppTaskRuntimeOptions,
  dependency: TaskAppDependency,
): void {
  const registryConfigured = Boolean(opts.appRegistrySnapshot || opts.appRegistry);
  if (!registryConfigured) return;
  const entries = configuredRegistryEntries(opts);
  const target = entries.find(({ definition }) => definition.id === dependency.appId)?.definition;
  if (!target?.task || !target.tasks) {
    throw new Error(`App dependency ${dependency.id} targets unavailable App ${dependency.appId}`);
  }
  if (!Check(target.inputSchema, dependency.input)) {
    throw new Error(`App dependency ${dependency.id} input is not accepted by installed App ${dependency.appId}`);
  }
}

/**
 * Give every agent/CLI executor the same fenced Task surface. Runtime owns
 * attempt lifetime and lease renewal; adapters only translate TaskAttempt to
 * their execution mechanism and return one Task result.
 */
async function runTaskExecutorAttempt(input: {
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

async function runTaskAgent(
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
            evidence: [],
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

async function runRegisteredTaskExecutor(input: {
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
            evidence: [],
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

function emitTaskReconciliationEvent(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  event: EventEnvelope | undefined,
  type: string,
  taskId: string,
  data: Record<string, unknown>,
): void {
  const persistedEventId = Number((event as Record<string, unknown> | undefined)?.eventId);
  const trace =
    Number.isInteger(persistedEventId) && persistedEventId > 0
      ? {
          traceId:
            event?.trace && typeof event.trace === "object" && typeof event.trace.traceId === "string"
              ? event.trace.traceId
              : `event:${persistedEventId}`,
          parentEventId: persistedEventId,
        }
      : childEventTrace(event);
  opts.bus.emit({
    type,
    source: `app-task:${descriptor.id}:task-reconciler`,
    owner: `agent:${descriptor.agent}`,
    target: { appId: descriptor.id },
    data: { project: descriptor.id, taskId, ...data },
    ...(trace ? { trace } : {}),
  } as unknown as AgentEvent);
}

function recoverStaleTaskResult(
  config: AppTaskContext,
  claim: AppTaskClaim,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } {
  const recovery = releaseStaleAppTaskResult(
    config,
    claim,
    `Stale reconciliation result for ${claim.taskId} was rejected; retrying from current task evidence`,
  );
  return {
    staleRecovery: recovery.status,
    reconcileTaskIds: recovery.status === "missing" ? [] : [claim.taskId],
  };
}

function recoverStaleTaskActionResult(
  config: AppTaskContext,
  claim: AppTaskClaim,
  error: unknown,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } | null {
  if (!isAppTaskActionStaleError(error) && !(error instanceof ResourceTaskMutationStaleError)) {
    return null;
  }
  const recovery = releaseStaleAppTaskResult(
    config,
    claim,
    `Stale handler action for ${
      isAppTaskActionStaleError(error) ? error.taskId : claim.taskId
    } was rejected; retrying ${claim.taskId} from current task evidence`,
  );
  return {
    staleRecovery: recovery.status,
    reconcileTaskIds: recovery.status === "missing" ? [] : [claim.taskId],
  };
}

async function establishTaskAcceptance(input: {
  descriptor: AppTaskRuntimeDescriptor;
  intent: AppTaskIntent;
  claim: AppTaskClaim;
  capability: TaskCapabilityRun;
  executionPaths: AppTaskExecutionPaths;
}): Promise<
  { ok: true; acceptanceBasis: AppTaskAcceptanceBasis } | { ok: false; summary: string; evidence: string[] }
> {
  const { descriptor, intent, claim, capability } = input;
  const workflow = claim.handler.startsWith("workflow:");
  if (!capability.verifier) {
    if (!workflow) {
      return {
        ok: true,
        acceptanceBasis: {
          method: "agent-judgment",
          evidence: [...capability.handlerResult.evidence],
        },
      };
    }
    return {
      ok: true,
      acceptanceBasis: {
        method: "workflow-contract",
        evidence: [
          ...capability.handlerResult.evidence,
          ...(capability.runId ? [`workflow-run:${capability.runId}`] : []),
        ],
      },
    };
  }

  try {
    const verificationConfig = appTaskConfig(descriptor);
    const pendingTrigger = readPendingAppTaskTrigger(verificationConfig, claim.taskId);
    const raw = await capability.verifier.verify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        appRoot: descriptor.appDir,
        projectRoot: descriptor.projectDir,
        workspaceDir: input.executionPaths.workspaceDir,
        intent: structuredClone(intent),
        ...(pendingTrigger
          ? {
              pendingTrigger: canonicalAppEvent(pendingTrigger as AgentEvent),
            }
          : {}),
      },
      capability.handlerResult as AppTaskHandlerResult,
    );
    const admitted = admitAppTaskVerificationResult(raw);
    if (!admitted.ok) {
      return {
        ok: false,
        summary: `Verifier ${capability.verifier.name} returned an invalid result: ${admitted.error}`,
        evidence: capability.runId ? [`workflow-run:${capability.runId}`] : [],
      };
    }
    if (!admitted.result.accepted) {
      return {
        ok: false,
        summary: admitted.result.summary,
        evidence: admitted.result.evidence,
      };
    }
    return {
      ok: true,
      acceptanceBasis: {
        method: "deterministic",
        verifier: capability.verifier.name,
        evidence: admitted.result.evidence,
      },
    };
  } catch (error) {
    return {
      ok: false,
      summary: `Verifier ${capability.verifier.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      evidence: capability.runId ? [`workflow-run:${capability.runId}`] : [],
    };
  }
}

async function reconcileTask(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  taskId: string;
  dispatch: AppTaskDispatch;
  reason?: string;
}): Promise<string[]> {
  const { opts, descriptor } = input;

  const timing: AppTaskTiming = {
    dispatch: input.dispatch,
    resultPersistenceMs: 0,
    outcome: "completed",
  };
  let providerStartedAt: number | undefined;
  const observer: AppTaskExecutionObserver = {
    providerStarted(promptBytes) {
      const now = Date.now();
      timing.promptBytes = promptBytes;
      timing.providerStartMs = Math.max(0, now - input.dispatch.startedAt);
      providerStartedAt = now;
    },
    providerFinished() {
      if (providerStartedAt !== undefined) timing.providerMs = Math.max(0, Date.now() - providerStartedAt);
    },
  };
  const persistResult = <T>(operation: () => T): T => {
    const startedAt = performance.now();
    try {
      try {
        return operation();
      } catch (error) {
        if (!(error instanceof ResourceTaskMutationStaleError)) throw error;
        // The failed transaction applied nothing. Re-read current resources
        // and recheck every claim/action fence once, without rerunning the
        // handler or replaying provider effects. Semantic staleness is not
        // transaction contention and must still return to reconciliation.
        return operation();
      }
    } finally {
      timing.resultPersistenceMs += Math.max(0, performance.now() - startedAt);
    }
  };
  let activeConfig: ReturnType<typeof appTaskConfig> | undefined;
  let activeClaim: AppTaskClaim | undefined;
  let cleanupFailed = false;
  const prepareSupersededSessions = (sessionIds: string[]) => {
    try {
      interruptSupersededActionSessions(opts, input.taskId, sessionIds);
    } catch (error) {
      cleanupFailed = true;
      throw error;
    }
  };

  try {
    const config = appTaskConfig(descriptor);
    activeConfig = config;
    const claimStartedAt = performance.now();
    const primary = claimObservedAppTask(config, {
      taskId: input.taskId,
      appAgent: descriptor.agent,
      handler: "auto",
      reason: input.reason ?? "task-controller",
      recoverSessionHandoff: (attempt) => opts.sessions?.handoff(attempt),
    });
    timing.claimMs = Math.max(0, performance.now() - claimStartedAt);
    if (primary.kind !== "claimed") {
      if (primary.kind === "busy") {
        const active = primary.attemptId ? config.resourceStore.readAttempt(primary.attemptId) : null;
        const leaseCheckAt = Date.now();
        const sessionActivity =
          active?.sessionId && opts.persistDir
            ? {
                sessionId: active.sessionId,
                lastActivityAt: opts.sessions?.lastActivityAt(active.sessionId) ?? null,
              }
            : undefined;
        const expired = expiredAgentSessionAppTaskAttempt(config, input.taskId, leaseCheckAt, sessionActivity);
        const sessionId = expired?.sessionId;
        const session = sessionId && opts.persistDir ? opts.sessions?.read(sessionId) : null;
        const terminalStatus =
          session?.status === "done" || session?.status === "error" || session?.status === "interrupted"
            ? session.status
            : null;
        if (expired && sessionId && terminalStatus && !hasLiveAppTaskSession(opts, sessionId)) {
          // A session artifact is evidence, not an accepted Task result. Drain
          // the exact old execution before retrying through normal settlement.
          interruptSupersededAgentSession(opts, sessionId, "Retrying an uncommitted Task attempt", input.taskId);
          const released = releaseTerminalSessionExpiredAppTaskAttempt(
            config,
            { ...expired, sessionId, terminalStatus },
            `Expired reconciliation ${input.taskId} lost its synchronous caller after agent session completion`,
            leaseCheckAt,
            sessionActivity,
          );
          if (released.released) {
            emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.recovery.requeued", input.taskId, {
              route: "task-controller",
              reason: "terminal-agent-session-expired-lease",
              attemptId: expired.attemptId,
              evidenceSessionId: sessionId,
              terminalStatus,
            });
            return [input.taskId];
          }
        }
      }
      const skip =
        primary.kind === "busy"
          ? { reason: "attempt-active", attemptId: primary.attemptId }
          : primary.kind === "waiting"
            ? primary.dependencyIds?.length
              ? { reason: "dependencies-open", dependencyIds: primary.dependencyIds }
              : { reason: "conditions-open", conditionIds: primary.conditionIds }
            : primary.kind === "attention"
              ? { reason: "attention-required", generation: primary.generation, summary: primary.summary }
              : { reason: "already-completed", generation: primary.generation };
      emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.reconcile.skipped", input.taskId, {
        route: "task-controller",
        ...skip,
      });
      return [];
    }
    activeClaim = primary;
    timing.attemptId = primary.attemptId;
    timing.generation = primary.generation;
    for (const sessionId of primary.supersededSessionIds ?? []) {
      interruptSupersededAgentSession(
        opts,
        sessionId,
        `Task ${primary.taskId} superseded an orphaned agent session while recovering the current generation`,
        primary.taskId,
      );
    }
    const intent = primary.intent;
    const conversation = isConversationTask(config, primary.taskId);
    const event = primary.trigger as EventEnvelope | undefined;
    const contextStartedAt = performance.now();
    const childContext = readAppTaskChildContext(config, primary.taskId);
    const taskSnapshot = readAppTaskLiveSnapshot(config, primary.taskId);
    timing.contextBuildMs = Math.max(0, performance.now() - contextStartedAt);
    let executionPaths = appTaskExecutionPaths(descriptor.appDir, descriptor.projectDir);
    const declaredOutputPaths = primary.declaredOutputPaths;
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.started", intent.id, {
      route: "task-controller",
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      owner: primary.agent,
    });

    // Claiming a task rewrites the canonical state plus its disposable route and
    // read projections. On large retained trees that synchronous durability
    // boundary is substantial. Yield before agent/workflow association can
    // perform another state rewrite, so HTTP readiness and accepted event
    // ingress get an observable turn inside one reconciliation (not merely
    // between separate claims).
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const workflowKey = primary.handler.startsWith("workflow:") ? primary.handler.slice("workflow:".length) : "";
    const executorKey = primary.handler.startsWith("executor:")
      ? primary.handler.slice("executor:".length)
      : primary.handler.startsWith("cli:")
        ? primary.handler.slice("cli:".length)
        : "";
    let taskWorkspace: PreparedTaskWorkspace | undefined;
    let workspaceFinalized = false;
    const finalizeWorkspace = async (outcome: "accepted" | "waiting" | "failed") => {
      if (!taskWorkspace || workspaceFinalized) return { ok: true as const };
      try {
        const finalized = await opts.workspaces!.finalize(taskWorkspace, outcome);
        workspaceFinalized = true;
        persistResult(() => recordAppTaskAttemptWorkspace(config, primary, finalized.metadata));
        return finalized;
      } catch (error) {
        workspaceFinalized = true;
        taskWorkspace.metadata.disposition = "retained-for-recovery";
        persistResult(() => recordAppTaskAttemptWorkspace(config, primary, taskWorkspace!.metadata));
        return {
          ok: false as const,
          metadata: taskWorkspace.metadata,
          reason: `Task workspace finalization failed and was retained for recovery: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    };
    let primaryResult: TaskCapabilityRun | undefined;
    const workflowWorkspace =
      workflowKey && opts.workflows
        ? (
            await opts.workflows.inspect({
              source: opts,
              appDir: descriptor.appDir,
              agent: primary.agent,
              workflow: workflowKey,
            })
          ).workspace
        : undefined;
    const workflowNeedsWorktree =
      workflowWorkspace === "task" || (typeof workflowWorkspace === "object" && workflowWorkspace.kind === "task");
    // Both execution paths share workspace lineage, admission fencing, and
    // failure handling. Only the workflow may override the App's base branch.
    if (!conversation && (workflowNeedsWorktree || (executorKey && descriptor.app.workspace?.kind === "git"))) {
      try {
        if (descriptor.app.workspace?.kind !== "git") {
          throw new Error(`Workflow ${workflowKey} requires a task worktree but app workspace is not Git`);
        }
        if (!opts.workspaces) throw new Error("Task workspace backend is not installed");
        const previous = Object.values(
          config.resourceStore.readTaskContext({ taskIds: [primary.taskId] }).attempts ?? {},
        )
          .filter(
            (attempt) =>
              attempt.taskId === primary.taskId &&
              attempt.taskGeneration === primary.generation &&
              attempt.workspace?.kind === "task-worktree",
          )
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]?.workspace;
        taskWorkspace = await opts.workspaces.prepare({
          repoDir: descriptor.projectDir,
          workspaceRoot: join(opts.projectRoot, "worktrees", descriptor.id),
          taskId: primary.taskId,
          generation: primary.generation,
          baseBranch:
            typeof workflowWorkspace === "object"
              ? workflowWorkspace.baseBranch
              : (descriptor.app.workspace.branch ?? "dev"),
          previous,
        });
        executionPaths = withAppTaskWorkspace(executionPaths, taskWorkspace.metadata.path);
        if (!recordAppTaskAttemptWorkspace(config, primary, taskWorkspace.metadata)) {
          throw new Error(`Task attempt ${primary.attemptId} became stale while preparing its workspace`);
        }
      } catch (error) {
        primaryResult = {
          handlerResult: {
            state: "error",
            summary: `Task workspace preparation failed: ${error instanceof Error ? error.message : String(error)}`,
            evidence: [],
            actions: [],
          },
          runId: null,
          workspacePreparationFailed: true,
        };
      }
    }
    if (conversation) {
      primaryResult = await runTaskExecutorAttempt({
        opts,
        descriptor,
        claim: primary,
        executionPaths,
        declaredOutputPaths,
        childContext,
        event,
        execute: async (attempt) => {
          if (!descriptor.app.requests || !opts.conversations)
            throw new Error(`App ${descriptor.id} Conversation executor is unavailable`);
          const registry = opts.appRegistrySnapshot ?? opts.appRegistry?.snapshot();
          if (!registry) throw new Error("Conversation execution requires an installed App registry");
          try {
            observer.providerStarted(0);
            const proposal = await opts.conversations.execute({
              config,
              claim: primary,
              app: descriptor.app,
              registry,
              signal: attempt.signal,
              getTaskApp(appId) {
                const entry = registry.entries.find(({ definition }) => definition.id === appId);
                if (!entry?.definition.tasks || !opts.persistDir)
                  throw new Error(`App ${appId} has no installed Task capability`);
                const target = appId === descriptor.id
                  ? descriptor
                  : standaloneAppTaskAdmissionDescriptors({
                      persistDir: opts.persistDir,
                      projectsRoot: opts.projectsRoot,
                      entries: [entry],
                    }).get(appId)!;
                return { app: target.app, config: appTaskConfig(target) };
              },
            });
            return {
              handlerResult: {
                state: "converged",
                summary: proposal.decision.summary,
                response: proposal.decision.response,
                result: { conversation: proposal.decision },
                evidence: proposal.decision.evidence ?? [],
                actions: [],
              },
              runId: primary.attemptId,
              conversation: proposal,
            };
          } finally {
            observer.providerFinished();
          }
        },
      });
    } else if (workflowKey) {
      primaryResult ??= await runTaskCapability({
        opts,
        descriptor,
        capability: {
          workflow: workflowKey,
          agent: primary.agent,
          task: `Reconcile task through workflow ${workflowKey}`,
        },
        claim: primary,
        executionPaths,
        declaredOutputPaths,
        childContext,
        taskSnapshot,
        event,
        ...(primary.handoff
          ? {
              fallbackReason: `${primary.handoff.reason}: ${primary.handoff.summary}${
                primary.handoff.evidence.length
                  ? `\nHandoff evidence:\n${primary.handoff.evidence.map((entry) => `- ${entry}`).join("\n")}`
                  : ""
              }`,
            }
          : {}),
        observer,
      });
    } else if (executorKey) {
      const registered = opts.executors?.[executorKey];
      if (registered) {
        primaryResult ??= await runRegisteredTaskExecutor({
          opts,
          descriptor,
          claim: primary,
          executionPaths,
          declaredOutputPaths,
          childContext,
          event,
          observer,
          name: executorKey,
          execute: registered,
        });
      } else {
        primaryResult ??= {
          handlerResult: {
            state: "error",
            summary: `Task executor ${executorKey} is not registered`,
            evidence: [],
            actions: [],
          },
          runId: null,
          unavailable: true,
        };
      }
    } else {
      const handoffWorkflow =
        primary.handoff && intent.workflow
          ? await opts.workflows?.inspect({
              source: opts,
              appDir: descriptor.appDir,
              agent: primary.agent,
              workflow: intent.workflow,
            })
          : undefined;
      if (primary.handoff && intent.workflow && !handoffWorkflow?.available) {
        primaryResult = {
          handlerResult: {
            state: "error",
            summary: handoffWorkflow?.error ?? "Task workflow runner is not installed",
            evidence: [],
            actions: [],
          },
          runId: null,
          unavailable: true,
        };
      } else {
        primaryResult = await runTaskAgent({
          opts,
          descriptor,
          claim: primary,
          executionPaths,
          declaredOutputPaths,
          childContext,
          event,
          ...(primary.handoff
            ? {
                fallbackReason: `${primary.handoff.reason}: ${primary.handoff.summary}${
                  primary.handoff.evidence.length
                    ? `\nHandoff evidence:\n${primary.handoff.evidence.map((entry) => `- ${entry}`).join("\n")}`
                    : ""
                }`,
              }
            : {}),
          observer,
        });
      }
      if (handoffWorkflow?.verifier) primaryResult!.verifier = handoffWorkflow.verifier;
    }

    if (!primaryResult) throw new Error(`Task ${primary.taskId} produced no handler result`);

    const primaryHandlerResult = primaryResult.handlerResult;
    const rejectStaleEffect = (error: unknown) => {
      const stale = recoverStaleTaskActionResult(config, primary, error);
      if (!stale) return null;
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: "stale",
        input: intent.input ?? {},
        summary: error instanceof Error ? error.message : String(error),
        evidence: primaryHandlerResult.evidence,
        staleRecovery: stale.staleRecovery,
        workflowRunId: primaryResult.runId,
      });
      return stale;
    };
    const fenceWorkspaceFinalization = async () => {
      if (!taskWorkspace) return null;
      try {
        assertAppTaskClaimCurrent(config, primary);
        return null;
      } catch (error) {
        await finalizeWorkspace("failed");
        const stale = rejectStaleEffect(error);
        if (!stale) throw error;
        return stale;
      }
    };
    if (
      primaryHandlerResult.state === "converged" &&
      primary.handoff?.reason === "needs-agent" &&
      intent.workflow &&
      !primaryResult.verifier
    ) {
      primaryHandlerResult.state = "error";
      primaryHandlerResult.summary = `Agent convergence was rejected because workflow ${intent.workflow} handed off without a verifier`;
      primaryResult.handlerBlocked = true;
    }
    if (primaryResult.unavailable) {
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.handler.unavailable", intent.id, {
        generation: primary.generation,
        handler: primary.handler,
        condition: "HandlerUnavailable",
        reason: primaryHandlerResult.summary,
      });
    }
    if (primaryHandlerResult.state === "stopped") {
      const stale = await fenceWorkspaceFinalization();
      if (stale) return stale.reconcileTaskIds;
      // Stopping does not accept or discard workspace output. Retain it using
      // the existing failed-attempt policy, including any cleanup limitation.
      const finalized = await finalizeWorkspace("failed");
      const evidence = [
        ...primaryHandlerResult.evidence,
        ...(taskWorkspace ? [taskWorkspace.metadata.path] : []),
        ...(!finalized.ok && finalized.reason ? [finalized.reason] : []),
      ];
      try {
        const applied = persistResult(() =>
          stopAppTask(config, primary, {
            ...primaryHandlerResult,
            evidence,
            acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
          }),
        );
        const staleResult = applied.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          disposition: applied.status === "applied" ? "stopped" : "stale",
          summary: applied.summary ?? primaryHandlerResult.summary,
          evidence,
        });
        return staleResult?.reconcileTaskIds ?? [];
      } catch (error) {
        const staleResult = rejectStaleEffect(error);
        if (staleResult) return staleResult.reconcileTaskIds;
        primaryResult.handlerBlocked = true;
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `Stop decision was rejected: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    if (primaryHandlerResult.state === "converged") {
      const accepted = await establishTaskAcceptance({
        descriptor,
        intent,
        claim: primary,
        capability: primaryResult,
        executionPaths,
      });
      const acceptanceBasis = accepted.ok ? accepted.acceptanceBasis : undefined;
      if (!accepted.ok) {
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = accepted.summary;
        primaryHandlerResult.evidence = accepted.evidence;
        // Rejected acceptance needs new evidence or an owner decision, not a
        // transport retry of the same workflow and its external effects.
        primaryResult.handlerBlocked = true;
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.verification.failed", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          summary: accepted.summary,
          evidence: accepted.evidence,
          workflowRunId: primaryResult.runId,
        });
      } else {
        const stale = await fenceWorkspaceFinalization();
        if (stale) return stale.reconcileTaskIds;
        // Keep reusable work when a newer observation still needs judgment.
        // Completion below records progress instead of granting acceptance.
        const finalized = await finalizeWorkspace(
          hasPendingAppTaskEvidence(config, primary, primaryResult.acceptedLiveEventIds) ? "waiting" : "accepted",
        );
        if (!finalized.ok) {
          // A retained dirty/unintegrated workspace needs inspection, not an
          // identical replay of the handler's already rejected completion.
          primaryResult.handlerBlocked = true;
          primaryHandlerResult.state = "error";
          primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
          primaryHandlerResult.evidence = [
            ...primaryHandlerResult.evidence,
            taskWorkspace?.metadata.path ?? executionPaths.workspaceDir,
          ];
        }
      }
      if (primaryHandlerResult.state === "converged" && acceptanceBasis) {
        try {
          const apply: ReturnType<typeof completeConversationTaskTurn> = persistResult(() =>
            primaryResult.conversation
              ? completeConversationTaskTurn(config, primary, primaryResult.conversation.decision, {
                  followUp: primaryResult.conversation.followUp,
                  taskControls: primaryResult.conversation.taskControls,
                  acceptanceBasis,
                })
              : completeAppTask(config, primary, {
                  summary: primaryHandlerResult.summary,
                  response: primaryHandlerResult.response,
                  result: primaryHandlerResult.result,
                  evidence: primaryHandlerResult.evidence,
                  actions: primaryHandlerResult.actions,
                  acceptanceBasis,
                  acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
                  prepareSupersededSessions,
                }),
          );
          const appliedDisposition = taskCompletionDisposition(
            primary.taskId,
            primaryHandlerResult.actions,
            apply.taskContinues,
          );
          const stale = apply.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
          emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
            generation: primary.generation,
            attemptId: primary.attemptId,
            handler: primary.handler,
            disposition: apply.status === "applied" ? appliedDisposition : "stale",
            outcome: intent.outcome,
            mode: intent.mode,
            owner: intent.owner ?? descriptor.agent,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
            ...(intent.executor ? { executor: intent.executor } : {}),
            acceptance: intent.acceptance,
            input: intent.input ?? {},
            summary: primaryHandlerResult.summary,
            ...(primaryHandlerResult.response ? { response: primaryHandlerResult.response } : {}),
            ...(primaryHandlerResult.result ? { result: primaryHandlerResult.result } : {}),
            evidence: primaryHandlerResult.evidence,
            acceptanceBasis,
            actionsApplied: apply.actionsApplied,
            ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
            workflowRunId: primaryResult.runId,
          });
          for (const cancelled of apply.cancelledTasks ?? []) publishTaskCancellation(opts.bus, cancelled);
          if (apply.admittedTasks) {
            for (const admitted of apply.admittedTasks) {
              // This post-commit hint also crosses the existing worker event
              // bridge. Durable readiness remains the recovery authority.
              opts.bus.emit({
                type: "app.task.ready",
                source: `app-task:${descriptor.id}:task-reconciler`,
                owner: `app:${descriptor.id}`,
                target: admitted,
                data: admitted,
              });
            }
          }
          return stale?.reconcileTaskIds ?? apply.dependentTaskIds;
        } catch (error) {
          if (cleanupFailed) throw error;
          const stale = recoverStaleTaskActionResult(config, primary, error);
          if (stale) {
            const summary = error instanceof Error ? error.message : String(error);
            emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
              generation: primary.generation,
              attemptId: primary.attemptId,
              handler: primary.handler,
              disposition: "stale",
              outcome: intent.outcome,
              mode: intent.mode,
              owner: intent.owner ?? descriptor.agent,
              ...(intent.workflow ? { workflow: intent.workflow } : {}),
              ...(intent.executor ? { executor: intent.executor } : {}),
              input: intent.input ?? {},
              summary,
              evidence: primaryHandlerResult.evidence,
              staleRecovery: stale.staleRecovery,
              workflowRunId: primaryResult.runId,
            });
            return stale.reconcileTaskIds;
          }
          primaryHandlerResult.state = "error";
          primaryHandlerResult.summary = `Handler actions were rejected: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      const stale = await fenceWorkspaceFinalization();
      if (stale) return stale.reconcileTaskIds;
      const finalized = await finalizeWorkspace("waiting");
      if (!finalized.ok) {
        primaryResult.handlerBlocked = true;
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
        primaryHandlerResult.evidence = [
          ...primaryHandlerResult.evidence,
          taskWorkspace?.metadata.path ?? executionPaths.workspaceDir,
        ];
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      try {
        const existingAppDependencyConditions = openTaskAppDependencyConditions(config, primary.taskId);
        const dependencyConditions = primaryHandlerResult.dependencies?.length
          ? admitTaskAppDependencies({
              opts,
              descriptor,
              claim: primary,
              dependencies: primaryHandlerResult.dependencies,
              existingConditions: existingAppDependencyConditions,
              acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
            })
          : [];
        const conditions = mergeTaskConditions(
          [...existingAppDependencyConditions, ...(primaryHandlerResult.conditions ?? []), ...dependencyConditions],
          new Set(existingAppDependencyConditions.map((condition) => condition.id)),
        );
        primaryHandlerResult.conditions = conditions.length > 0 ? conditions : undefined;
      } catch (error) {
        const stale = rejectStaleEffect(error);
        if (stale) {
          return stale.reconcileTaskIds;
        }
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `App dependency admission failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      try {
        const apply = persistResult(() =>
          deferAppTask(config, primary, {
            disposition: "waiting",
            summary: primaryHandlerResult.summary,
            response: primaryHandlerResult.response,
            result: primaryHandlerResult.result,
            evidence: primaryHandlerResult.evidence,
            actions: primaryHandlerResult.actions,
            conditions: primaryHandlerResult.conditions,
            acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
            prepareSupersededSessions,
          }),
        );
        const stale = apply.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          disposition: apply.status === "applied" ? primaryHandlerResult.state : "stale",
          ...(primary.trigger?.type === "project.task.condition-review.missed"
            ? { reason: "condition-review-checkpoint-missed" }
            : {}),
          input: intent.input ?? {},
          summary: primaryHandlerResult.summary,
          ...(primaryHandlerResult.response ? { response: primaryHandlerResult.response } : {}),
          ...(primaryHandlerResult.result ? { result: primaryHandlerResult.result } : {}),
          evidence: primaryHandlerResult.evidence,
          actionsApplied: apply.actionsApplied,
          ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
          workflowRunId: primaryResult.runId,
        });
        const recoveredTaskIds =
          apply.status === "applied"
            ? recoverTaskConditions(opts, descriptor, config, {
                conditionIds: primaryHandlerResult.conditions?.map((condition) => condition.id),
              })
            : [];
        return [...new Set([...(stale?.reconcileTaskIds ?? apply.reconcileTaskIds), ...recoveredTaskIds])];
      } catch (error) {
        if (cleanupFailed) throw error;
        const stale = recoverStaleTaskActionResult(config, primary, error);
        if (stale) {
          const summary = error instanceof Error ? error.message : String(error);
          emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
            generation: primary.generation,
            attemptId: primary.attemptId,
            handler: primary.handler,
            disposition: "stale",
            input: intent.input ?? {},
            summary,
            evidence: primaryHandlerResult.evidence,
            staleRecovery: stale.staleRecovery,
            workflowRunId: primaryResult.runId,
          });
          return stale.reconcileTaskIds;
        }
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `Handler result was rejected: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    await finalizeWorkspace("failed");

    const agentHandoff = Boolean(workflowKey && primaryHandlerResult.state === "needs-agent");
    if (
      !primaryResult.unavailable &&
      !primaryResult.handlerBlocked &&
      !primaryResult.workspacePreparationFailed &&
      !agentHandoff &&
      !primaryHandlerResult.resultRejected
    ) {
      const retry = persistResult(() => failAppTaskAttempt(config, primary, primaryHandlerResult.summary));
      if (retry.status === "superseded") return [];
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: retry.status,
        retryAt: retry.retryAt,
        input: intent.input ?? {},
        summary: retry.summary,
      });
      // The persisted deadline and existing recovery scheduler own the retry.
      return [];
    }
    let attention: ReturnType<typeof markAppTaskAttention>;
    try {
      attention = persistResult(() =>
        markAppTaskAttention(config, primary, {
          summary: primaryHandlerResult.summary,
          // A failed workspace/action admission must not report its proposed
          // Task mutations as accepted through the diagnostic path either.
          result: primaryHandlerResult.actions.length ? undefined : primaryHandlerResult.result,
          evidence: primaryHandlerResult.evidence,
          reason: primaryHandlerResult.resultRejected
            ? "HandlerResultInvalid"
            : primaryResult.unavailable
              ? "HandlerUnavailable"
              : primaryResult.executionFailed
                ? "HandlerExecutionFailed"
                : primaryResult.workspacePreparationFailed
                  ? "WorkspacePreparationFailed"
                  : primaryHandlerResult.state === "needs-agent"
                    ? "needs-agent"
                    : "handler-blocked",
        }),
      );
    } catch (error) {
      const stale = rejectStaleEffect(error);
      if (!stale) throw error;
      return stale.reconcileTaskIds;
    }
    if (attention.status === "stale") return [];
    if (!agentHandoff) {
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: "retrying",
        retryAt: attention.retryAt,
        input: intent.input ?? {},
        summary: attention.summary,
      });
      return [];
    }
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      disposition: "agent-handoff",
      input: intent.input ?? {},
      summary: primaryHandlerResult.summary,
    });
    return [intent.id];
  } catch (error) {
    // Cleanup refusal is not a failed execution or rejected result. Preserve
    // the original claim until recovery can drain execution and retry safely.
    if (cleanupFailed) {
      timing.outcome = "failed";
      throw error;
    }
    if (activeConfig && activeClaim) {
      const stale = recoverStaleTaskActionResult(activeConfig, activeClaim, error);
      if (stale) {
        timing.outcome = "completed";
        emitTaskReconciliationEvent(
          opts,
          descriptor,
          activeClaim.trigger as EventEnvelope | undefined,
          "project.task.reconciled",
          activeClaim.taskId,
          {
            generation: activeClaim.generation,
            attemptId: activeClaim.attemptId,
            handler: activeClaim.handler,
            disposition: "stale",
            summary:
              "The claimed Task changed before executor startup; stale work was discarded without retrying it as a handler failure.",
            staleRecovery: stale.staleRecovery,
          },
        );
        return stale.reconcileTaskIds;
      }
    }
    timing.outcome = "failed";
    if (activeConfig && activeClaim) {
      const failedConfig = activeConfig;
      const failedClaim = activeClaim;
      const summary = `Task handler failed before returning a persistable result: ${
        error instanceof Error ? error.message : String(error)
      }`;
      try {
        const retry = persistResult(() => failAppTaskAttempt(failedConfig, failedClaim, summary));
        if (retry.status === "superseded") {
          // The stored owner decision already ended this attempt. Its late
          // executor error must not become a dispatch failure or another retry.
          timing.outcome = "completed";
          return [];
        }
        emitTaskReconciliationEvent(
          opts,
          descriptor,
          failedClaim.trigger as EventEnvelope | undefined,
          "project.task.reconciled",
          failedClaim.taskId,
          {
            generation: failedClaim.generation,
            attemptId: failedClaim.attemptId,
            handler: failedClaim.handler,
            disposition: retry.status,
            retryAt: retry.retryAt,
            summary: retry.summary,
          },
        );
        return [];
      } catch {
        // Preserve the original failure. Recovery still fences attempts whose
        // persistence boundary itself is unavailable.
      }
    }
    throw error;
  } finally {
    publishAppTaskTiming(opts, descriptor, input.taskId, timing);
  }
}

const appRouterDescriptorsByBus = new WeakMap<EventBus, AppTaskRuntimeDescriptor[]>();
const appRouterOptionsByBus = new WeakMap<EventBus, AppTaskRuntimeOptions>();

function loadedAppTaskRuntimeDescriptor(bus: EventBus, projectId: string): AppTaskRuntimeDescriptor | undefined {
  const normalized = projectId.trim().replace(/\.app$/, "");
  return (appRouterDescriptorsByBus.get(bus) ?? []).find((descriptor) => descriptor.id === normalized);
}

const appTaskControllersByBus = new WeakMap<EventBus, Map<string, AppTaskController>>();
const appTaskRecoverySchedulersByBus = new WeakMap<EventBus, Map<string, AppTaskRecoveryScheduler>>();
type AppTaskControllerBinding = {
  descriptor: AppTaskRuntimeDescriptor;
  opts: AppTaskRuntimeOptions;
  recoveryScheduler?: AppTaskRecoveryScheduler;
};
const appTaskControllerBindingsByBus = new WeakMap<EventBus, Map<string, AppTaskControllerBinding>>();
const APP_TASK_RECOVERY_SAFETY_INTERVAL_MS = 60_000;

function appTaskDelivery(descriptor: AppTaskRuntimeDescriptor, taskId: string, note: string): DeliveryResult {
  return {
    accepted: true,
    by: `app-task:${descriptor.id}:task-reconciler`,
    route: "direct",
    note: `${note}: ${taskId}`,
  };
}

function conditionSubjectCandidates(event: Record<string, unknown>): string[] {
  const containers = [event, isRecord(event.target) ? event.target : {}, isRecord(event.data) ? event.data : {}];
  const values = new Map<string, string>();
  for (const container of containers) {
    for (const [field, value] of Object.entries(container)) {
      if ((typeof value === "string" && value.trim()) || typeof value === "number" || typeof value === "boolean") {
        values.set(field, String(value).trim());
      }
    }
  }
  const candidates = new Set<string>();
  for (const [field, value] of values) candidates.add(`${field}:${value}`);
  const typed: Record<string, string[]> = {
    task: ["taskId", "task_id"],
    session: ["sessionId", "session_id"],
    "workflow-run": ["workflowRunId", "workflow_run_id", "runId"],
    metric: ["metricId", "metric_id"],
    alert: ["alertId", "alert_id"],
    project: ["project", "projectId", "project_id"],
    "pipeline-run": ["pipelineRunId", "pipeline_run_id", "runId", "run_id"],
    "pull-request": ["pullRequestId", "pull_request_id", "prId", "pr_id"],
  };
  for (const [kind, fields] of Object.entries(typed)) {
    const value = fields.map((field) => values.get(field)).find(Boolean);
    if (value) candidates.add(`${kind}:${value}`);
  }
  return [...candidates];
}

type AppTaskAdmissionResult = {
  delivery?: DeliveryResult;
  taskIds: string[];
  supersededSessionIds: string[];
};

function admitResolvedAppTaskEvent(input: {
  descriptor: AppTaskRuntimeDescriptor;
  controller?: AppTaskController;
  event: Record<string, unknown>;
  intent: AppTaskIntent | null;
  targetedTaskId?: string;
  conditionTaskIds?: string[];
  interruptSuperseded?(observation: AppTaskObservationResult): void;
}): AppTaskAdmissionResult {
  const { descriptor, controller, event, intent } = input;
  const targetedTaskId = input.targetedTaskId?.trim() ?? "";
  const config = appTaskConfig(descriptor);
  const selectedConditionTaskIds = [
    ...new Set((input.conditionTaskIds ?? []).map((taskId) => taskId.trim()).filter(Boolean)),
  ];
  const conditionWakes = trackAppTaskConditionEventForTasks(config, event, selectedConditionTaskIds);
  const wokenTaskIds = new Set(conditionWakes.map((wake) => wake.taskId));
  if (controller) {
    for (const taskId of wokenTaskIds) enqueueAppTask(controller, config, taskId, { promote: true });
  }
  // A frozen Condition route is idempotent admission authority. On recovery,
  // its task may already have consumed the fact or left its wait. Accept that
  // no-op instead of retrying the immutable plan forever. Exact targets with
  // no selected Condition remain strict existing-task references below.
  const conditionDelivery = selectedConditionTaskIds.length
    ? appTaskDelivery(
        descriptor,
        (wokenTaskIds.size ? [...wokenTaskIds] : selectedConditionTaskIds).join(","),
        wokenTaskIds.size ? "task dependency event accepted" : "task dependency event already observed",
      )
    : undefined;
  if (targetedTaskId) {
    // An exact target is feedback for existing work, not another declaration
    // of its goal. Re-observing the resolver's intent here both changed the
    // Task accidentally and loaded its complete subtree before a simple wake.
    const triggerResult = recordAppTaskTrigger(config, targetedTaskId, event);
    if (triggerResult.kind === "recorded") {
      wokenTaskIds.add(targetedTaskId);
      if (controller) enqueueAppTask(controller, config, targetedTaskId, { promote: true });
      return {
        delivery: appTaskDelivery(descriptor, targetedTaskId, "existing targeted task wake accepted"),
        taskIds: [...wokenTaskIds],
        supersededSessionIds: [],
      };
    }
    // An exact target is a reference to existing durable work, never creation
    // authority. Desired task creation is admitted only through App policy.
    return { delivery: conditionDelivery, taskIds: [...wokenTaskIds], supersededSessionIds: [] };
  }
  if (!intent) return { delivery: conditionDelivery, taskIds: [...wokenTaskIds], supersededSessionIds: [] };
  const observation = observeAppTaskIntent(config, {
    intent,
    appAgent: descriptor.agent,
    trigger: event,
  });
  input.interruptSuperseded?.(observation);
  if (observation.kind === "observed") wokenTaskIds.add(observation.taskId);
  if (controller && observation.kind === "observed") {
    enqueueAppTask(controller, config, observation.taskId, {
      promote: event.type === "project.comment.created",
    });
  }
  return {
    delivery: appTaskDelivery(descriptor, observation.taskId, "resolved task event accepted"),
    taskIds: [...wokenTaskIds],
    supersededSessionIds: observation.supersededSessionIds ?? [],
  };
}

/**
 * Host-private bridge from canonical event admission into the retained task
 * engine. Policy has already selected the App and resolved any desired intent.
 */
export function admitLoadedCanonicalAppTaskEvent(input: {
  bus: EventBus;
  appId: string;
  event: AgentEvent;
  intent: AppTaskIntent | null;
  targetedTaskId?: string;
  conditionTaskIds?: string[];
}): DeliveryResult | undefined {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find((candidate) => candidate.id === input.appId);
  if (!descriptor?.app.tasks) {
    throw new Error(`Canonical App ${input.appId} task capability is not loaded`);
  }
  const controller = appTaskControllersByBus.get(input.bus)?.get(descriptor.id);
  const opts = appRouterOptionsByBus.get(input.bus);
  if (!opts || (!controller && !descriptor.reconciliationPaused)) {
    throw new Error(`Canonical App ${input.appId} task reconciliation is not active`);
  }
  return admitResolvedAppTaskEvent({
    descriptor,
    controller,
    event: canonicalTaskEvent(input.event),
    intent: input.intent,
    targetedTaskId: input.targetedTaskId,
    conditionTaskIds: input.conditionTaskIds,
    interruptSuperseded: (observation) => interruptSupersededObservationSessions(opts, observation),
  }).delivery;
}

/**
 * Canonical Task admission without an in-process controller. A persistent
 * admission worker uses this boundary, then returns exact Task wakes to the
 * daemon's lightweight controllers.
 */
export function admitStandaloneCanonicalAppTaskEvent(input: {
  descriptor: AppTaskRuntimeDescriptor;
  event: AgentEvent;
  intent: AppTaskIntent | null;
  targetedTaskId?: string;
  conditionTaskIds?: string[];
}): AppTaskAdmissionResult {
  if (!input.descriptor.app.tasks) throw new Error(`App ${input.descriptor.id} has no Task capability`);
  if (input.descriptor.reconciliationPaused) throw new Error(`App ${input.descriptor.id} reconciliation is paused`);
  return admitResolvedAppTaskEvent({
    descriptor: input.descriptor,
    event: canonicalTaskEvent(input.event),
    intent: input.intent,
    targetedTaskId: input.targetedTaskId,
    conditionTaskIds: input.conditionTaskIds,
  });
}

/** Prepare only canonical Task state needed by the admission worker. */
/** Wake already-admitted Task identities without repeating their mutation. */
export function wakeLoadedAppTasks(input: {
  bus: EventBus;
  appId: string;
  taskIds: string[];
  supersededSessionIds?: string[];
}): void {
  const appId = input.appId.trim().replace(/\.app$/, "");
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, appId);
  const controller = appTaskControllersByBus.get(input.bus)?.get(appId);
  if (!descriptor || !controller) return;
  const config = appTaskConfig(descriptor);
  const opts = appRouterOptionsByBus.get(input.bus);
  const admittedTaskId = input.taskIds.at(-1);
  if (opts && admittedTaskId) {
    interruptSupersededObservationSessions(opts, {
      taskId: admittedTaskId,
      generation: descriptor.resourceStore.readTask(admittedTaskId)?.metadata.generation ?? 1,
      supersededSessionIds: input.supersededSessionIds,
    });
  }
  for (const taskId of new Set(input.taskIds.map((value) => value.trim()).filter(Boolean))) {
    enqueueAppTask(controller, config, taskId, { promote: true });
  }
}

/** Normal Conversation admission uses a conventional Task, never an inbox execution lease. */
export function admitLoadedConversationInput(input: {
  bus: EventBus;
  item: CreateAppInboxItem & { conversationId: string };
}) {
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, input.item.appId);
  const requests = descriptor?.app.requests;
  if (!descriptor || !requests || (requests.inputKinds && !requests.inputKinds.includes(input.item.input.kind)))
    throw new Error(`App ${input.item.appId} has no loaded Conversation capability for this input`);
  if (!Check(descriptor.app.inputSchema, input.item.input)) throw new Error("Invalid Conversation input");
  const config = appTaskConfig(descriptor);
  const admitted = admitConversationTaskInput(config, {
    ...input.item,
    intent: conversationTaskIntent(config),
    conversationInputKinds: requests.inputKinds,
  });
  wakeLoadedAppTasks({ bus: input.bus, appId: descriptor.id, taskIds: [admitted.taskId] });
  return admitted;
}

export function stopLoadedConversationTurn(input: { bus: EventBus; target: AppTurnTarget }) {
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, input.target.appId);
  if (!descriptor?.app.requests) throw new Error("Conversation runtime is unavailable");
  const result = stopConversationTaskTurn(appTaskConfig(descriptor), input.target);
  input.bus.emit({
    type: "app.task.attempt.stopped",
    source: "app-task-reconciler",
    owner: "human:operator",
    target: { appId: descriptor.id, taskId: result.taskId },
    data: {
      appId: descriptor.id,
      taskId: result.taskId,
      attemptId: input.target.turnId,
      reason: "Human stopped this turn",
    },
  });
  input.bus.emit({
    type: "conversation.updated",
    source: "app-task-reconciler",
    owner: `app:${descriptor.id}`,
    data: { appId: descriptor.id, conversationId: input.target.conversationId },
  });
  wakeLoadedAppTasks({ bus: input.bus, appId: descriptor.id, taskIds: [result.taskId] });
  return result;
}

/** Notification text is a hint. Only the exact stored outcome or closure can become input. */
export function admitLoadedConversationChange(input: ConversationTaskChangeRef & { bus: EventBus }) {
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, input.appId);
  const taskId = conversationTaskId(input.appId, input.conversationId);
  if (!descriptor || !descriptor.resourceStore.readTask(taskId)) return null;
  if (!descriptor.app.requests) return { taskId, created: false };
  const source = AppTaskResourceStore.activeFromDb(descriptor.resourceStore.db, input.taskAppId);
  if (
    descriptor.resourceStore.isCancelled(taskId) ||
    (input.taskAppId === descriptor.id && input.taskId === taskId) ||
    !source
  )
    return { taskId, created: false };
  if (input.attemptId !== undefined) {
    const attempt = source.readAttempt(input.attemptId);
    if (attempt?.taskId !== input.taskId || !attempt.acceptedResult || attempt.acceptedResult.state === "waiting")
      return { taskId, created: false };
  } else if (source.readCancellation(input.taskId)?.generation !== input.closedGeneration)
    return { taskId, created: false };
  const admitted = admitConversationTaskChange(
    appTaskConfig(descriptor),
    { resourceStore: source },
    input,
    descriptor.app.requests.inputKinds,
  );
  wakeLoadedAppTasks({ bus: input.bus, appId: descriptor.id, taskIds: [admitted.taskId] });
  return { taskId: admitted.taskId, created: admitted.created };
}

/** Bounded exact-identity check used before asynchronously admitting feedback. */
export function hasLoadedAppTask(input: { bus: EventBus; appId: string; taskId: string }): boolean {
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, input.appId.trim().replace(/\.app$/, ""));
  return Boolean(descriptor?.resourceStore.readTask(input.taskId.trim()));
}

/** Read-only canonical-state task-Condition preflight for the App coordinator. */
export function previewLoadedCanonicalAppTaskEvent(input: {
  bus: EventBus;
  appId: string;
  event: AgentEvent;
  targetedTaskId?: string;
}): string[] {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find((candidate) => candidate.id === input.appId);
  if (!descriptor?.app.tasks) return [];
  const allowed = input.targetedTaskId ? [input.targetedTaskId] : undefined;
  return matchingAppTaskConditionTaskIds(appTaskConfig(descriptor), canonicalTaskEvent(input.event), allowed);
}

/** Read-only event-type-first Condition preflight across loaded Task Apps. */
export function previewLoadedCanonicalAppTaskEventRoutes(input: {
  bus: EventBus;
  event: AgentEvent;
}): Array<{ appId: string; taskIds: string[] }> {
  const descriptors = (appRouterDescriptorsByBus.get(input.bus) ?? []).filter((descriptor) => descriptor.app.tasks);
  if (descriptors.length === 0) return [];
  const event = canonicalTaskEvent(input.event);
  const subjects = conditionSubjectCandidates(event);
  const matchesByApp = new Map<string, Set<string>>();
  const loadedApps = new Set(descriptors.map((descriptor) => descriptor.id));
  const store = descriptors[0]!.resourceStore;
  for (const route of store.readConditionRoutesForAllApps(String(event.type ?? ""), subjects)) {
    if (!loadedApps.has(route.appId) || !matchesAppTaskCondition(route.condition, event)) continue;
    const taskIds = matchesByApp.get(route.appId) ?? new Set<string>();
    for (const taskId of route.taskIds) taskIds.add(taskId);
    matchesByApp.set(route.appId, taskIds);
  }
  return [...matchesByApp]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([appId, taskIds]) => ({ appId, taskIds: [...taskIds].sort() }));
}

function recoverTaskConditions(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  config: AppTaskContext,
  input: { conditionIds?: string[] } = {},
): string[] {
  if (!opts.persistDir) return [];
  const resourceScope = config.resourceStore.readOpenConditionReplayScope(input.conditionIds);
  const eventTypes = resourceScope.eventTypes;
  if (eventTypes.length === 0) return [];

  const placeholders = eventTypes.map(() => "?").join(", ");
  const db = getDb(opts.persistDir);
  const rows = db
    .prepare(
      `SELECT event_type, source, timestamp, data
       FROM events
       WHERE (
         project_id = ?
         OR (
           json_valid(data) = 1
           AND (
             json_extract(data, '$.project') = ?
             OR json_extract(data, '$.target.project') = ?
           )
         )
       )
         AND event_type IN (${placeholders})
       ORDER BY id DESC
       LIMIT 2000`,
    )
    .all(descriptor.id, descriptor.id, descriptor.id, ...eventTypes) as Array<{
    event_type?: unknown;
    source?: unknown;
    timestamp?: unknown;
    data?: unknown;
  }>;

  const events: Record<string, unknown>[] = [];
  for (const row of rows.reverse()) {
    if (typeof row.data !== "string" || !row.data.trim()) continue;
    try {
      const parsed = JSON.parse(row.data);
      if (!isRecord(parsed)) continue;
      const event: Record<string, unknown> = {
        ...parsed,
        type: typeof row.event_type === "string" ? row.event_type : parsed.type,
        ...(typeof row.source === "string" && row.source.trim() ? { source: row.source } : {}),
        ...(typeof row.timestamp === "number" ? { timestamp: row.timestamp } : {}),
      };
      events.push(event);
    } catch {
      // Ignore malformed persisted events; they cannot prove a Condition.
    }
  }

  // A feedback notification can be lost before it reaches the journal.
  // Read each wait's exact saved answer or first report, not a later Task result.
  // Use the normal Condition transition and trigger.
  const allowed = new Set(resourceScope.taskIds);
  const recoveredTaskIds = new Set<string>();
  if (eventTypes.includes("app.dependency.updated")) {
    for (const { condition, taskIds } of config.resourceStore.readConditionRoutes("app.dependency.updated")) {
      if (input.conditionIds && !input.conditionIds.includes(condition.metadata.id)) continue;
      if (!condition.spec.subject.startsWith("id:")) continue;
      const item = getAppInboxItem(db, condition.spec.subject.slice(3));
      if (!item || item.source.kind !== "app" || item.source.id !== descriptor.id) continue;
      const source = AppTaskResourceStore.activeFromDb(db, item.appId);
      const report = item.status !== "done" && item.taskAdmissionKey && item.waitingOn?.kind === "task" &&
        source && !source.isCancelled(item.waitingOn.id)
        ? readAppTaskAdmissionOutcome({ resourceStore: source }, item.waitingOn.id, item.taskAdmissionKey, "report") : null;
      const result = item.status === "done" ? item.result : report;
      if (!result) continue;
      const event = appInputFeedbackEvent(item, result, item.status === "done" ? "done" : "blocked")!;
      if (!matchesAppTaskCondition(condition, event)) continue;
      for (const wake of trackAppTaskConditionEventForTasks(
        config,
        event,
        taskIds.filter((id) => allowed.has(id)),
      ))
        recoveredTaskIds.add(wake.taskId);
    }
  }
  const wakes = events.flatMap((event) => {
    const taskIds = matchingAppTaskConditionTaskIds(config, event).filter((taskId) => allowed.has(taskId));
    return trackAppTaskConditionEventForTasks(config, event, taskIds);
  });
  return [...new Set([...recoveredTaskIds, ...wakes.map((wake) => wake.taskId)])];
}

function installConventionTaskControllers(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
): Map<string, AppTaskController> {
  if (opts.installControllers === false) {
    const previous = appTaskControllersByBus.get(opts.bus);
    for (const scheduler of appTaskRecoverySchedulersByBus.get(opts.bus)?.values() ?? []) scheduler.close();
    for (const controller of previous?.values() ?? []) controller.close();
    const empty = new Map<string, AppTaskController>();
    appTaskControllersByBus.set(opts.bus, empty);
    appTaskRecoverySchedulersByBus.set(opts.bus, new Map());
    appTaskControllerBindingsByBus.set(opts.bus, new Map());
    return empty;
  }
  const controllers = appTaskControllersByBus.get(opts.bus) ?? new Map<string, AppTaskController>();
  const recoverySchedulers =
    appTaskRecoverySchedulersByBus.get(opts.bus) ?? new Map<string, AppTaskRecoveryScheduler>();
  const bindings = appTaskControllerBindingsByBus.get(opts.bus) ?? new Map<string, AppTaskControllerBinding>();
  const installedIds = new Set(descriptors.map((descriptor) => descriptor.id));
  for (const previous of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
    if (installedIds.has(previous.id)) continue;
    if (previous.resourceStore.hasUnfinishedTasks()) {
      throw new Error(`Cannot remove App ${previous.id} while it has unfinished Tasks`);
    }
  }

  for (const descriptor of descriptors) {
    const existingController = controllers.get(descriptor.id);
    const existingBinding = bindings.get(descriptor.id);
    if (existingController && existingBinding) {
      // Publication swaps one immutable definition pointer. A reconcile that
      // already started retains its local descriptor; the next one reads this.
      existingBinding.descriptor = descriptor;
      existingBinding.opts = opts;
      existingController.updateMaxConcurrent(descriptor.app.tasks?.maxConcurrent ?? 1);
      // Eligibility is read from current storage per Task, including while paused.
      existingController.setEnabled(true);
      continue;
    }

    const binding: AppTaskControllerBinding = { descriptor, opts };
    const controller = new AppTaskController({
      maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
      capacity: opts.hostCapacity,
      readScheduling: () => ({
        backgroundPaused: binding.descriptor.resourceStore.projectLifecycle() !== "active",
        foregroundTaskIds: binding.descriptor.app.requests
          ? binding.descriptor.resourceStore.pendingHumanConversationTaskIds()
          : new Set(),
      }),
      startAfter: opts.startAfter,
      reconcile: async (taskId, dispatch) => {
        const activeDescriptor = binding.descriptor;
        const activeOpts = binding.opts;
        const config = appTaskConfig(activeDescriptor);
        try {
          const dependentTaskIds = activeOpts.executeAttempt
            ? await activeOpts.executeAttempt({ appId: activeDescriptor.id, taskId, dispatch })
            : await reconcileTask({
                opts: activeOpts,
                descriptor: activeDescriptor,
                taskId,
                dispatch,
                reason: "task-controller",
              });
          const dependentEntries = new Map(
            appTaskQueueEntries(config, dependentTaskIds).map((entry) => [entry.taskId, entry]),
          );
          for (const dependentTaskId of dependentTaskIds) {
            // A same-task result is an immediate continuation, such as a
            // workflow-to-agent handoff. Other children/dependents enter the
            // priority-ordered ordinary lane so continuation bursts stay bounded.
            controller.enqueue(dependentTaskId, {
              promote: dependentTaskId === taskId,
              priority: dependentEntries.get(dependentTaskId)?.options.priority,
            });
          }
        } finally {
          binding.recoveryScheduler?.stateChanged();
        }
      },
      onError: (taskId, error, willRetry) => {
        const activeDescriptor = binding.descriptor;
        binding.opts.bus.emit({
          type: "handler.failed",
          source: "app-task-controller",
          owner: `app:${activeDescriptor.id}`,
          data: {
            handler: `app-task-controller:${taskId}`,
            agent: activeDescriptor.agent,
            error: error instanceof Error ? error.message : String(error),
            appId: activeDescriptor.id,
            taskId,
            stage: "task-reconciliation",
            disposition: willRetry ? "retry-scheduled" : "not-retrying",
            willRetry,
            durationMs: 0,
          },
        });
      },
    });
    controllers.set(descriptor.id, controller);
    bindings.set(descriptor.id, binding);
    const config = appTaskConfig(descriptor);
    const recoveryScheduler = new AppTaskRecoveryScheduler({
      source: config.resourceStore,
      safetyIntervalMs: APP_TASK_RECOVERY_SAFETY_INTERVAL_MS,
      enqueue: (taskId, options) => {
        enqueueAppTask(controller, config, taskId, options);
      },
    });
    binding.recoveryScheduler = recoveryScheduler;
    recoverySchedulers.set(descriptor.id, recoveryScheduler);
    recoveryScheduler.start();
  }

  for (const [appId, controller] of controllers) {
    if (installedIds.has(appId)) continue;
    controller.close();
    controllers.delete(appId);
    bindings.delete(appId);
    recoverySchedulers.get(appId)?.close();
    recoverySchedulers.delete(appId);
  }

  appTaskControllersByBus.set(opts.bus, controllers);
  appTaskRecoverySchedulersByBus.set(opts.bus, recoverySchedulers);
  appTaskControllerBindingsByBus.set(opts.bus, bindings);
  return controllers;
}

/** Execute one exact Task locally inside an already prepared worker process. */
export async function reconcileLoadedAppTaskOnce(input: {
  bus: EventBus;
  appId: string;
  taskId: string;
  dispatch: AppTaskDispatch;
}): Promise<string[]> {
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, input.appId);
  const opts = appRouterOptionsByBus.get(input.bus);
  if (!descriptor || !opts) {
    throw new Error(`App ${input.appId} has no loaded Task runtime`);
  }
  return reconcileTask({
    opts: snapshotTaskExecution(opts),
    descriptor,
    taskId: input.taskId,
    dispatch: input.dispatch,
    reason: "task-worker-process",
  });
}

/**
 * Stop the task-controller generation currently attached to one process bus.
 * Closing is synchronous; the returned promise additionally waits for work
 * already inside a reconcile to release its resources.
 */
export async function closeInstalledAppTaskRuntimes(bus: EventBus): Promise<void> {
  const controllers = appTaskControllersByBus.get(bus);
  if (!controllers) return;

  appTaskControllersByBus.delete(bus);
  appTaskControllerBindingsByBus.delete(bus);
  for (const scheduler of appTaskRecoverySchedulersByBus.get(bus)?.values() ?? []) scheduler.close();
  appTaskRecoverySchedulersByBus.delete(bus);
  for (const controller of controllers.values()) controller.close();
  await Promise.all([...controllers.values()].map((controller) => controller.whenDrained()));

  // The event subscriber is process-scoped and intentionally remains attached
  // to the bus. Once in-flight reconciliation has drained, empty its selected
  // generation unless a newer controller generation was installed meanwhile.
  if (!appTaskControllersByBus.has(bus)) {
    appRouterDescriptorsByBus.get(bus)?.splice(0);
    appRouterOptionsByBus.delete(bus);
  }
}

export function retryLoadedFailedAppTask(input: {
  bus: EventBus;
  appId: string;
  taskId: string;
  expectedGeneration: number;
  expectedResourceVersion: number;
  controlKey?: string;
}): ReturnType<typeof retryFailedAppTask> & { queued: boolean } {
  const appId = input.appId.trim().replace(/\.app$/, "");
  const taskId = input.taskId.trim();
  if (!appId || !taskId) throw new Error("App Task retry requires exact appId and taskId");
  if (!Number.isSafeInteger(input.expectedGeneration) || input.expectedGeneration < 1) {
    throw new Error("App Task retry requires a positive integer expectedGeneration");
  }
  if (!Number.isSafeInteger(input.expectedResourceVersion) || input.expectedResourceVersion < 1) {
    throw new Error("App Task retry requires a positive integer expectedResourceVersion");
  }
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, appId);
  if (!descriptor) throw new Error(`App ${appId} has no loaded task runtime`);
  const controller = appTaskControllersByBus.get(input.bus)?.get(appId);
  if (!controller || descriptor.reconciliationPaused) {
    throw new Error(`App ${appId} task reconciliation is unavailable`);
  }
  const config = appTaskConfig(descriptor);
  const receipt = retryFailedAppTask(config, {
    appId,
    taskId,
    expectedGeneration: input.expectedGeneration,
    expectedResourceVersion: input.expectedResourceVersion,
    ...(input.controlKey ? { controlKey: input.controlKey } : {}),
  });
  const queued = enqueueAppTask(controller, config, taskId, { promote: true });
  return { ...receipt, queued };
}

export function cancelLoadedAppTask(input: {
  bus: EventBus;
  appId: string;
  taskId: string;
  expectedGeneration: number;
  expectedResourceVersion: number;
  reason: string;
  controlKey?: string;
}): ReturnType<typeof cancelAppTask> {
  const appId = input.appId.trim().replace(/\.app$/, "");
  const taskId = input.taskId.trim();
  if (!appId || !taskId) throw new Error("App Task cancellation requires exact appId and taskId");
  if (!Number.isSafeInteger(input.expectedGeneration) || input.expectedGeneration < 1) {
    throw new Error("App Task cancellation requires a positive integer expectedGeneration");
  }
  if (!Number.isSafeInteger(input.expectedResourceVersion) || input.expectedResourceVersion < 1) {
    throw new Error("App Task cancellation requires a positive integer expectedResourceVersion");
  }
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, appId);
  if (!descriptor) throw new Error(`App ${appId} has no loaded task runtime`);
  const result = cancelAppTask(appTaskConfig(descriptor), {
    appId,
    taskId,
    expectedGeneration: input.expectedGeneration,
    expectedResourceVersion: input.expectedResourceVersion,
    reason: input.reason,
    ...(input.controlKey ? { controlKey: input.controlKey } : {}),
  });
  publishTaskCancellation(input.bus, result);
  return result;
}

/** Publish only after the caller's complete state transaction has committed. */
function publishTaskCancellation(bus: EventBus, result: ReturnType<typeof cancelAppTask>): void {
  if (result.applied) {
    const { appId, taskId } = result.cancellation;
    bus.emit({
      type: "app.task.cancelled",
      source: "app-task-reconciler",
      owner: "human:operator",
      target: { appId, taskId },
      data: {
        appId,
        taskId,
        generation: result.cancellation.generation,
        ...(result.cancelledAttemptId ? { attemptId: result.cancelledAttemptId } : {}),
        reason: result.cancellation.reason,
      },
    });
  }
}

function enqueueAppTask(
  controller: AppTaskController,
  config: AppTaskContext,
  taskId: string,
  overrides: AppTaskQueueOptions = {},
): boolean {
  const current = appTaskQueueEntries(config, [taskId])[0]?.options;
  return controller.enqueue(taskId, {
    ...current,
    ...overrides,
  });
}

const appTaskConfigs = new WeakMap<AppTaskRuntimeDescriptor, AppTaskContext>();

function appTaskConfig(descriptor: AppTaskRuntimeDescriptor): AppTaskContext {
  const existing = appTaskConfigs.get(descriptor);
  if (existing) return existing;
  const config = appTaskContext({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    agent: descriptor.agent,
    maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
    resourceStore: descriptor.resourceStore,
  });
  cacheTaskSnapshots(config);
  appTaskConfigs.set(descriptor, config);
  return config;
}

/**
 * Attach App-owned work to the canonical App that shares its .app directory.
 * The existing reconciler remains the sole owner of task validation, state,
 * concurrency, session fencing, and execution.
 */
export function attachLoadedAppTask(input: {
  bus: EventBus;
  appDir: string;
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
  request: Readonly<AppInputContext>;
  /** Persist the exact input return link with admission. */
  inboxInputId?: string;
  now?: number;
  authorize?: () => void;
  topicId?: string;
  requestLink?: { appId: string; conversationId: string; id: string; revision: number };
}): { taskId: string } {
  const normalizedAppDir = resolve(input.appDir);
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => resolve(candidate.appDir) === normalizedAppDir,
  );
  if (!descriptor) {
    throw new Error(`App ${input.appId} has no loaded task runtime in ${normalizedAppDir}`);
  }
  if (!descriptor.app.tasks) {
    throw new Error(`App ${descriptor.id} does not declare task reconciliation`);
  }
  const controller = appTaskControllersByBus.get(input.bus)?.get(descriptor.id);
  if (!controller && !descriptor.reconciliationPaused) {
    throw new Error(`App ${descriptor.id} task reconciliation is not active`);
  }
  const loaderOptions = appRouterOptionsByBus.get(input.bus);
  if (!loaderOptions) throw new Error(`App ${descriptor.id} task runtime is not attached`);

  const config = appTaskConfig(descriptor);
  const humanRequested = input.request.source.kind === "human" || input.request.humanRequested === true;

  const observation = admitTaskRequest(config, input);
  interruptSupersededObservationSessions(loaderOptions, observation);
  if (controller && observation.kind === "observed") {
    enqueueAppTask(controller, config, observation.taskId, {
      lane: humanRequested ? "human" : "normal",
    });
  }
  return { taskId: observation.taskId };
}

/** Read one input's accepted answer without using a later Task cycle's result. */
export function readLoadedAppTaskInputResult(input: {
  bus: EventBus; appDir: string; taskId: string; admissionKey: string;
  kind?: "answer" | "report";
}) {
  const appDir = resolve(input.appDir);
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find((entry) => resolve(entry.appDir) === appDir);
  return descriptor
    ? readAppTaskAdmissionOutcome(appTaskConfig(descriptor), input.taskId, input.admissionKey, input.kind)
    : null;
}

/** Read the stable task projection for an inbox dependency after any restart. */
export function readLoadedAppTaskView(input: { bus: EventBus; appDir: string; taskId: string }): TaskDetail | null {
  const normalizedAppDir = resolve(input.appDir);
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => resolve(candidate.appDir) === normalizedAppDir,
  );
  if (!descriptor) return null;
  return readRuntimeTaskView(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    input.taskId,
  );
}

export function listLoadedAppTaskViews(input: { bus: EventBus; appId: string; options?: TaskListOptions }): TaskPage {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => candidate.id === input.appId.trim().replace(/\.app$/, ""),
  );
  if (!descriptor) throw new Error(`App ${input.appId} has no loaded Task runtime`);
  return listRuntimeTaskViews(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    input.options,
  );
}

export function listLoadedAppTaskOutcomeViews(input: {
  bus: EventBus;
  appId: string;
  projection?: TaskOutcomeProjection;
}): TaskOutcomePage {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => candidate.id === input.appId.trim().replace(/\.app$/, ""),
  );
  if (!descriptor) throw new Error(`App ${input.appId} has no loaded Task runtime`);
  const report = appRouterOptionsByBus.get(input.bus)?.readOutcomes;
  if (!report) throw new Error("Task outcome reporting is unavailable");
  const config = { taskStateConfig: appTaskConfig(descriptor) };
  return report({
    appDir: descriptor.appDir,
    projection: input.projection,
    tasks: {
      list: (options) => listRuntimeTaskViews(config, options),
      get: (id) => readRuntimeTaskView(config, id),
    },
  });
}

export function getLoadedAppTaskView(input: { bus: EventBus; appId: string; taskId: string }): TaskDetail | null {
  const appId = input.appId.trim().replace(/\.app$/, "");
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find((candidate) => candidate.id === appId);
  if (!descriptor) {
    // A one-App worker installs only its execution runtime, but supervision
    // still needs exact reads of other Apps in its accepted registry. Reuse
    // existing resource authority without loading agents, bootstrapping state,
    // installing controllers, or making disabled Apps available.
    const opts = appRouterOptionsByBus.get(input.bus);
    const entry = opts?.taskAppIds
      ? (opts.appRegistrySnapshot ?? opts.appRegistry?.snapshot())?.entries.find(
          ({ definition }) => definition.id === appId && definition.tasks,
        )
      : undefined;
    const resourceStore =
      entry && opts?.persistDir ? AppTaskResourceStore.activeFromDb(getDb(opts.persistDir), appId) : null;
    if (!entry || !resourceStore) throw new Error(`App ${input.appId} has no loaded Task runtime`);
    return readRuntimeTaskView(
      {
        taskStateConfig: appTaskContext({
          appDir: entry.appDir,
          projectDir: entry.appDir,
          agent: configuredAppAgent(entry.definition, entry.appDir),
          maxConcurrent: entry.definition.tasks?.maxConcurrent ?? 1,
          resourceStore,
        }),
      },
      input.taskId,
    );
  }
  return readRuntimeTaskView(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    input.taskId,
  );
}

/** Publish one event from the currently fenced Task attempt used by an executor tool. */
export function publishLoadedAppTaskEvent(input: {
  bus: EventBus;
  binding: { appId: string; taskId: string; generation: number; attemptId: string };
  localKey: string;
  event: AppTaskEmission;
}): number {
  const appId = input.binding.appId.trim().replace(/\.app$/, "");
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find((candidate) => candidate.id === appId);
  if (!descriptor) throw new Error(`App ${input.binding.appId} has no loaded Task runtime`);
  const resource = descriptor.resourceStore.readTask(input.binding.taskId);
  const attempt = descriptor.resourceStore.readAttempt(input.binding.attemptId);
  if (
    !resource ||
    resource.metadata.generation !== input.binding.generation ||
    resource.status.phase !== "running" ||
    resource.status.currentAttemptId !== input.binding.attemptId ||
    !attempt ||
    attempt.state !== "running" ||
    attempt.taskId !== input.binding.taskId ||
    attempt.taskGeneration !== input.binding.generation
  ) {
    throw new Error(`Task ${appId}/${input.binding.taskId} attempt is no longer current`);
  }
  return createAppTaskEvents({
    bus: input.bus,
    db: descriptor.resourceStore.db,
    persistDir: appRouterOptionsByBus.get(input.bus)?.persistDir,
    appId,
    claim: {
      taskId: input.binding.taskId,
      generation: input.binding.generation,
      attemptId: input.binding.attemptId,
      agent: attempt.owner,
    },
  }).publish(input.localKey, input.event);
}

function recoverInterruptedAppTasks(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
  controllers: Map<string, AppTaskController>,
  includeFreshLeases = false,
): void {
  for (const descriptor of descriptors) {
    const controller = controllers.get(descriptor.id);
    const config = appTaskConfig(descriptor);
    const runningRecoveryTaskIds = config.resourceStore.listTaskIdsByPhase(["running"], 512);
    const attentionRecoveryTaskIds = config.resourceStore.listTaskIdsByPhase(["attention"], 512);
    const waitingRecoveryTaskIds = config.resourceStore.listTaskIdsByPhase(["waiting"], 512);
    const releaseRecovery = (recovery: AppTaskAttemptRecovery, reason?: string) => {
      if (recovery.sessionId) {
        interruptSupersededAgentSession(
          opts,
          recovery.sessionId,
          `Recovered task ${recovery.taskId} interrupted an orphaned agent session from a previous runtime`,
          recovery.taskId,
        );
      }
      const released = releaseInterruptedAppTaskAttempt(
        config,
        recovery,
        reason ?? `Interrupted reconciliation ${recovery.taskId} belonged to a previous runtime`,
      );
      if (released.released && controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, recovery.taskId);
      }
    };
    for (const recovery of recoverableAppTaskAttempts(config, Date.now(), includeFreshLeases, runningRecoveryTaskIds)) {
      if (recovery.sessionId && hasLiveAppTaskSession(opts, recovery.sessionId)) {
        continue;
      }
      releaseRecovery(recovery);
    }
    const missingAttemptRepairs = repairRunningAppTasksWithoutAttempt(config, runningRecoveryTaskIds);
    for (const repair of missingAttemptRepairs) {
      if (controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, repair.taskId);
      }
    }
    const appDb = opts.persistDir ? getDb(opts.persistDir) : undefined;
    const dependencyRepairs = appDb
      ? repairUnadmittedAppDependencyWaits(
          config,
          (requestId) => Boolean(getAppInboxItem(appDb, requestId)),
          waitingRecoveryTaskIds,
        )
      : [];
    for (const repair of dependencyRepairs) {
      if (controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, repair.taskId);
      }
    }
    const repairs = repairPreviousRuntimeRecoveryAttention(config, attentionRecoveryTaskIds);
    if (repairs.length > 0) {
      opts.bus.emit({
        type: "project.task.recovery.repaired",
        source: `app-task:${descriptor.id}:task-recovery`,
        owner: `agent:${descriptor.agent}`,
        target: { project: descriptor.id },
        data: {
          project: descriptor.id,
          repaired: repairs.length,
          requeued: repairs.filter((repair) => repair.disposition === "requeued").length,
          retired: repairs.filter((repair) => repair.disposition === "retired").length,
          taskIds: repairs.slice(0, 50).map((repair) => repair.taskId),
        },
      } as unknown as AgentEvent);
      for (const repair of repairs) {
        if (repair.disposition === "requeued" && controller && !descriptor.reconciliationPaused) {
          enqueueAppTask(controller, config, repair.taskId);
        }
      }
    }
    for (const taskId of recoverTaskConditions(opts, descriptor, config)) {
      if (controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, taskId, { promote: true });
      }
    }
  }
}

/**
 * Run the canonical App task recovery path for the descriptors and task
 * controllers already installed on this event bus. Startup calls this before
 * generic stale-session resumption so task-owned sessions are reconciled by
 * their durable task state first.
 */
export async function recoverInstalledAppTasks(
  bus: EventBus,
  isDefinitionCurrent: () => boolean = () => true,
): Promise<void> {
  if (!isDefinitionCurrent()) return;
  const opts = appRouterOptionsByBus.get(bus);
  if (!opts) return;
  if (opts.executeRecovery) {
    await opts.executeRecovery();
    if (!isDefinitionCurrent()) return;
    for (const scheduler of appTaskRecoverySchedulersByBus.get(bus)?.values() ?? []) scheduler.recover();
    return;
  }
  const descriptors = appRouterDescriptorsByBus.get(bus) ?? [];
  const controllers = appTaskControllersByBus.get(bus) ?? new Map();
  recoverInterruptedAppTasks(opts, descriptors, controllers, true);
  for (const scheduler of appTaskRecoverySchedulersByBus.get(bus)?.values() ?? []) scheduler.recover();
}

function attachAppEventRouter(opts: AppTaskRuntimeOptions, descriptors: AppTaskRuntimeDescriptor[]): void {
  appRouterOptionsByBus.set(opts.bus, opts);
  const existing = appRouterDescriptorsByBus.get(opts.bus);
  if (existing) {
    existing.splice(0, existing.length, ...descriptors);
    return;
  }

  appRouterDescriptorsByBus.set(opts.bus, descriptors);
  const bus = opts.bus;
  bus.listen(
    (rawEvent): void => {
      if (rawEvent.type === "app.task.ready") {
        const data = eventData(rawEvent) as Record<string, unknown>;
        if (typeof data.appId === "string" && typeof data.taskId === "string")
          wakeLoadedAppTasks({ bus, appId: data.appId, taskIds: [data.taskId] });
        return;
      }
      if (rawEvent.type !== "session.start" && rawEvent.type !== "session.end") return;
      // The listener outlives reloads and close/reinstall. Read adapters from
      // the same published generation as the descriptors for this event.
      const opts = appRouterOptionsByBus.get(bus);
      if (!opts) return;
      const event = flattenEvent(rawEvent);
      const startedSessionId =
        event.type === "session.start" && typeof event.sessionId === "string" ? event.sessionId.trim() : "";
      const sessionBinding = startedSessionId ? appTaskSessionBinding(event.taskBinding) : null;
      if (sessionBinding) {
        const descriptor = (appRouterDescriptorsByBus.get(opts.bus) ?? []).find(
          (candidate) => candidate.id === sessionBinding.appId,
        );
        if (descriptor) {
          const association = associateAppTaskSession(appTaskConfig(descriptor), sessionBinding, startedSessionId);
          if (association.status !== "recorded") {
            interruptSupersededAgentSession(
              opts,
              startedSessionId,
              association.status === "missing"
                ? `Task ${sessionBinding.taskId} no longer exists; the reconciliation session is obsolete`
                : `Task ${sessionBinding.taskId} generation ${sessionBinding.generation} was superseded before its reconciliation session started`,
              sessionBinding.taskId,
            );
          }
        }
      }
      const successfulAgent =
        event.type === "session.end" &&
        event.status === "done" &&
        typeof event.agent === "string" &&
        event.agent.trim() &&
        typeof event.sessionId === "string" &&
        event.sessionId.trim()
          ? (() => {
              const sessionId = event.sessionId.trim();
              const scope = readAppTaskSessionScope(opts.sessions, sessionId);
              const eventAppId = firstNonEmptyString(
                event.projectId,
                isRecord(event.data) ? event.data.projectId : undefined,
              )?.replace(/\.app$/, "");
              return {
                agent: event.agent.trim(),
                sessionId,
                appId: scope.binding?.appId ?? eventAppId ?? null,
                observedAt: new Date(typeof event.timestamp === "number" ? event.timestamp : Date.now()).toISOString(),
                binding: scope.binding,
                workflowRunId: firstNonEmptyString(
                  scope.workflowRunId,
                  event.workflowRunId,
                  isRecord(event.data) ? event.data.workflowRunId : undefined,
                ),
              };
            })()
          : null;
      const hasTaskRecoveryScope = Boolean(successfulAgent?.binding || successfulAgent?.workflowRunId);
      for (const descriptor of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
        if (descriptor.reconciliationPaused) continue;
        const taskController = appTaskControllersByBus.get(opts.bus)?.get(descriptor.id);
        if (successfulAgent && hasTaskRecoveryScope && taskController) {
          // A terminal session wakes only its bound Task. Task retries use
          // durable eligibility, never another session's success as permission.
          if (successfulAgent.appId && successfulAgent.appId !== descriptor.id) continue;
          const config = appTaskConfig(descriptor);
          if (
            successfulAgent.binding?.appId === descriptor.id &&
            opts.sessions?.workflowInterrupted(successfulAgent.workflowRunId)
          ) {
            const released = releaseLateTerminalWorkflowAppTaskAttempt(
              config,
              successfulAgent.binding,
              successfulAgent.sessionId,
              `Late terminal session ${successfulAgent.sessionId} cannot reattach to restart-interrupted workflow ${successfulAgent.workflowRunId}`,
            );
            if (released.released) {
              enqueueAppTask(taskController, config, released.taskId, { promote: true });
              opts.bus.emit({
                type: "project.task.recovery.requeued",
                source: `app-task:${descriptor.id}:task-recovery`,
                owner: `agent:${successfulAgent.agent}`,
                target: { appId: descriptor.id },
                data: {
                  project: descriptor.id,
                  taskId: released.taskId,
                  reason: "late-terminal-session-after-workflow-restart",
                  evidenceSessionId: successfulAgent.sessionId,
                  evidenceWorkflowRunId: successfulAgent.workflowRunId,
                },
              } as unknown as AgentEvent);
            }
          }
          if (successfulAgent.binding?.appId === descriptor.id) {
            enqueueAppTask(taskController, config, successfulAgent.binding.taskId, { promote: true });
          }
        }
      }
      return undefined;
    },
    { label: "app-task-session", types: ["session.start", "session.end", "app.task.ready"] },
  );
}

async function commitAppTaskRuntimeDescriptors(
  opts: AppTaskRuntimeOptions,
  prepared: AppTaskRuntimeDescriptor[],
  recovery: { includeFreshLeases: boolean; deferred: boolean },
): Promise<{ installed: AppTaskRuntimeDescriptor[] }> {
  const installed: AppTaskRuntimeDescriptor[] = [];
  for (const descriptor of prepared) {
    const { id } = descriptor;
    if (
      opts.agents &&
      !(await opts.agents.prepare({ source: opts, appDir: descriptor.appDir, agent: descriptor.agent }))
    ) {
      opts.bus.emit({
        type: "info",
        message: `[app-task] App ${id} agent "${descriptor.agent}" is unavailable; retained Tasks remain visible`,
      });
    }
    if (opts.syncReadModels !== false) syncProjectReadModel(opts, descriptor);
    installed.push(descriptor);
  }

  const controllers = installConventionTaskControllers(opts, installed);

  if (installed.length > 0 || appRouterDescriptorsByBus.has(opts.bus)) {
    attachAppEventRouter(opts, installed);
  }
  // This is the one synchronous publication boundary. Controller bindings,
  // App routing, agent definitions, and the public registry become visible in
  // one turn; queued reconciliation cannot run until the turn is released.
  opts.afterCommit?.({ installed });
  const execution = snapshotTaskExecution(opts);
  for (const descriptor of installed) {
    const binding = appTaskControllerBindingsByBus.get(opts.bus)?.get(descriptor.id);
    if (binding) binding.opts = execution;
  }
  if (!recovery.deferred) {
    recoverInterruptedAppTasks(opts, installed, controllers, recovery.includeFreshLeases);
  }

  return { installed };
}

export async function installAppTaskRuntimes(
  opts: AppTaskRuntimeOptions,
  recovery: { includeFreshLeases?: boolean; deferRecovery?: boolean } = {},
): Promise<{ installed: AppTaskRuntimeDescriptor[] }> {
  const prepared = await prepareAppTaskRuntimeDescriptors(opts);
  const previous = [...(appRouterDescriptorsByBus.get(opts.bus) ?? [])];
  const previousOptions = appRouterOptionsByBus.get(opts.bus);
  let published = false;
  try {
    return await commitAppTaskRuntimeDescriptors(
      {
        ...opts,
        afterCommit: (result) => {
          opts.afterCommit?.(result);
          published = true;
        },
      },
      prepared,
      {
        includeFreshLeases: recovery.includeFreshLeases === true,
        deferred: recovery.deferRecovery === true,
      },
    );
  } catch (error) {
    // Once publication succeeded, recovery errors must not roll the visible
    // generation backward. Normal indexed recovery will retry the work.
    if (published) throw error;
    try {
      // Restore the accepted adapters and source roots with their descriptors.
      // A rejected candidate cannot supply the options for the old generation.
      await commitAppTaskRuntimeDescriptors({ ...(previousOptions ?? opts), afterCommit: undefined }, previous, {
        includeFreshLeases: false,
        deferred: false,
      });
      // No accepted runtime existed: leave the process-scoped listener inert
      // and prevent later recovery from using the rejected candidate's options.
      if (!previousOptions) appRouterOptionsByBus.delete(opts.bus);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "App task runtime reload failed and the previous App set could not be restored",
      );
    }
    throw error;
  }
}
