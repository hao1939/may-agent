import { type AppInputContext, type AppTaskAttachment, type TaskIntent as AppTaskIntent } from "@may-agent/sdk";
import type { TaskDetail, TaskListOptions, TaskOutcomePage, TaskOutcomeProjection, TaskPage } from "@may-agent/sdk/app";
import { resolve } from "node:path";
import { Check } from "typebox/value";
import { getDb } from "../../../lib/db/connection.js";
import { canonicalAppEvent } from "../../canonical-app-event.js";
import { EVENT_ROW_ID, eventData, type AgentEvent, type DeliveryResult, type EventBus } from "../events/bus.js";
import { listRuntimeTaskViews, readRuntimeTaskView } from "../reads/app-read.js";
import type { AppTurnTarget, CreateAppInboxItem } from "../state/app-inbox-store.js";
import { getAppInboxItem } from "../state/app-inbox-store.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import {
  admitConversationTaskChange,
  admitConversationTaskInput,
  conversationTaskId,
  conversationTaskIntent,
  stopConversationTaskTurn,
  type ConversationTaskChangeRef,
} from "../state/conversation-task-turns.js";
import { admitTaskInput } from "../state/inbox.js";
import {
  matchesAppTaskCondition,
  matchingAppTaskConditionTaskIds,
  trackAppTaskConditionEventForTasks,
} from "./app-task-condition-tracker.js";
import { createAppTaskEvents, type AppTaskEmission } from "./app-task-emitter.js";
import {
  appTaskContext,
  appTaskQueueEntries,
  associateAppTaskSession,
  cancelAppTask,
  observeAppTaskIntent,
  readAppTaskAdmissionOutcome,
  recordAppTaskTrigger,
  recoverableAppTaskAttempts,
  releaseInterruptedAppTaskAttempt,
  releaseLateTerminalWorkflowAppTaskAttempt,
  repairPreviousRuntimeRecoveryAttention,
  repairRunningAppTasksWithoutAttempt,
  repairUnadmittedAppDependencyWaits,
  retryFailedAppTask,
  type AppTaskAttemptRecovery,
  type AppTaskObservationResult,
} from "./app-task-reconciler.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { type AppTaskContext } from "./app-task-store.js";
import {
  hasLiveAppTaskSession,
  interruptSupersededAgentSession,
  interruptSupersededObservationSessions,
} from "./attempt-execution.js";
import { publishTaskCancellation, runTaskAttempt, type AppTaskTiming } from "./attempt-runner.js";
import { AppTaskController, type AppTaskDispatch } from "./controller.js";
import { recoverTaskConditions } from "./dependency-admission.js";
import type { TaskSessionRecovery } from "./execution.js";
import type { AppTaskQueueOptions } from "./queue.js";
import {
  appTaskConfig,
  configuredAppAgent,
  prepareAppTaskRuntimeDescriptors,
  syncProjectReadModel,
  type AppTaskRuntimeDescriptor,
} from "./runtime-definition.js";
import type { AppTaskRuntimeOptions } from "./runtime-options.js";
import { appTaskSessionBinding } from "./session-binding.js";

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

function snapshotTaskExecution(opts: AppTaskRuntimeOptions): AppTaskRuntimeOptions {
  return {
    ...opts,
    appRegistrySnapshot: opts.appRegistrySnapshot ?? opts.appRegistry?.snapshot(),
    agents: opts.agents?.snapshot(),
    conversations: opts.conversations?.snapshot?.() ?? opts.conversations,
    workflows: opts.workflows?.snapshot?.() ?? opts.workflows,
  };
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
  const requests = descriptor?.app.conversation;
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
  if (!descriptor?.app.conversation) throw new Error("Conversation runtime is unavailable");
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
  if (!descriptor.app.conversation) return { taskId, created: false };
  const source = AppTaskResourceStore.activeFromDb(descriptor.resourceStore.db, input.taskAppId);
  if (
    descriptor.resourceStore.isCancelled(taskId) ||
    (input.taskAppId === descriptor.id && input.taskId === taskId) ||
    !source
  )
    return { taskId, created: false };
  if (input.attemptId !== undefined) {
    const attempt = source.readAttempt(input.attemptId);
    if (attempt?.taskId !== input.taskId || (!attempt.acceptedResult && attempt.state !== "failed"))
      return { taskId, created: false };
  } else if (source.readCancellation(input.taskId)?.generation !== input.closedGeneration)
    return { taskId, created: false };
  const admitted = admitConversationTaskChange(
    appTaskConfig(descriptor),
    { resourceStore: source },
    input,
    descriptor.app.conversation.inputKinds,
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
        foregroundTaskIds: binding.descriptor.app.conversation
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
  inputContext: Readonly<AppInputContext>;
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
  const humanRequested = input.inputContext.source.kind === "human" || input.inputContext.humanRequested === true;

  const observation = admitTaskInput(config, input);
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
  bus: EventBus;
  appDir: string;
  taskId: string;
  admissionKey: string;
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
                  factsSessionId: successfulAgent.sessionId,
                  factsWorkflowRunId: successfulAgent.workflowRunId,
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
/** Wire optional timing publication around the one claimed attempt path. */
function reconcileTask(input: Omit<Parameters<typeof runTaskAttempt>[0], "reportTiming">): Promise<string[]> {
  return runTaskAttempt({
    ...input,
    reportTiming: (timing) => publishAppTaskTiming(input.opts, input.descriptor, input.taskId, timing),
  });
}
