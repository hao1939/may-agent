import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import {
  isTypedConditionSubject as isTypedAppTaskConditionSubject,
  MIN_CONDITION_REVIEW_AFTER_MS as MIN_APP_TASK_CONDITION_REVIEW_AFTER_MS,
  type Condition as AppTaskConditionSpec,
  type TaskAcceptanceBasis as AppTaskAcceptanceBasis,
  type TaskAction as AppTaskAction,
  type TaskExecutorName,
  type TaskIntent as AppTaskIntent,
  type TaskAttempt,
} from "@may-agent/sdk";
import {
  appTaskReadinessById,
  commitTaskMutation,
  ResourceTaskMutationStaleError,
  type AppTaskContext,
  type AppTaskAdmission,
  type AppTaskReadiness,
  type TaskTree,
} from "./app-task-store.js";
import { resolveAppTaskOutputPaths } from "./app-task-output-paths.js";
import { pendingTaskExecutionRetryAt, taskExecutionRetryDelay } from "./app-task-state.js";
import type {
  AppTaskCondition as AppTaskCondition,
  AppTaskAttempt as AppTaskAttempt,
  AppTaskCancellation,
  AppTaskResource as AppTaskResource,
  AppTaskTrigger as AppTaskTrigger,
  AppTaskTriggerEvent,
  AppTaskWorkspace as AppTaskWorkspace,
} from "./app-task-state.js";
import { applyAppTaskConditionEvent } from "./app-task-condition-tracker.js";
import { normalizeTaskAgent } from "../../app-agent-selection.js";
import type { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { continuedTaskInputKeys, retainTaskInputWait, taskInputAdmissionKeys } from "./app-task-inputs.js";

const MAX_TASK_EVENTS_PER_ATTEMPT = 32;

function managedAgentHandler(agent: string): string {
  return `agent:${agent}`;
}

/** Accept retained attempts written before the handler vocabulary migration. */
function isManagedAgentHandler(handler: string, agent?: string): boolean {
  return agent
    ? handler === managedAgentHandler(agent) || handler === `owner:${agent}`
    : handler.startsWith("agent:") || handler.startsWith("owner:");
}

export type AppTaskClaim = {
  kind: "claimed";
  taskId: string;
  generation: number;
  resourceVersion: number;
  specHash: string;
  attemptId: string;
  agent: string;
  handler: string;
  mode: "achieve" | "maintain";
  intent: AppTaskIntent;
  events: AppTaskTriggerEvent[];
  eventsTruncated: boolean;
  continuedInputKeys?: string[];
  previousAttempt?: TaskAttempt["previousAttempt"];
  /** Compatibility projection of the most relevant event in events. */
  trigger?: Record<string, unknown>;
  declaredOutputPaths: string[];
  supersededSessionIds?: string[];
  handoff?: {
    reason: "needs-agent" | "recovered-session";
    summary: string;
    evidence: string[];
  };
};

export type AppTaskClaimResult =
  | AppTaskClaim
  | { kind: "busy"; taskId: string; attemptId: string | null }
  | {
      kind: "waiting";
      taskId: string;
      conditionIds: string[];
      dependencyIds?: string[];
      retryAt?: number;
    }
  | { kind: "attention"; taskId: string; generation: number; summary: string }
  | { kind: "completed"; taskId: string; generation: number };

export type AppTaskObservationResult =
  | {
      kind: "observed";
      taskId: string;
      generation: number;
      changed: boolean;
      supersededSessionIds?: string[];
    }
  | { kind: "completed"; taskId: string; generation: number; supersededSessionIds?: string[] };

export type AppTaskSessionAssociation = {
  status: "recorded" | "superseded" | "missing";
  taskId: string;
};

export class AppTaskActionStaleError extends Error {
  readonly taskId: string;
  readonly expectedGeneration: number;
  readonly currentGeneration: number;
  readonly currentPhase?: AppTaskResource["status"]["phase"];

  constructor(input: {
    taskId: string;
    expectedGeneration: number;
    currentGeneration: number;
    currentPhase?: AppTaskResource["status"]["phase"];
    reason?: string;
  }) {
    super(
      input.reason
        ? `Handler effect for ${input.taskId} is stale: ${input.reason}`
        : input.currentPhase
          ? `Handler action for ${input.taskId} is stale: target phase is now ${input.currentPhase}`
          : `Handler action for ${input.taskId} is stale: expected generation ${input.expectedGeneration}, current ${input.currentGeneration}`,
    );
    this.name = "AppTaskActionStaleError";
    this.taskId = input.taskId;
    this.expectedGeneration = input.expectedGeneration;
    this.currentGeneration = input.currentGeneration;
    this.currentPhase = input.currentPhase;
  }
}

export function isAppTaskActionStaleError(error: unknown): error is AppTaskActionStaleError {
  return error instanceof AppTaskActionStaleError;
}

export type AppTaskAttemptRecovery = {
  taskId: string;
  intent: AppTaskIntent;
  events?: AppTaskTriggerEvent[];
  eventsTruncated?: boolean;
  trigger?: Record<string, unknown>;
  sessionId?: string;
  taskGeneration: number;
  taskResourceVersion: number;
  attemptId: string;
  attemptResourceVersion: number;
  leaseId?: string;
  leaseVersion?: number;
  /** Explicit dual-read marker for attempts persisted before leases existed. */
  legacyLeaseLess: boolean;
};

export type AppTaskTerminalSessionRecovery = AppTaskAttemptRecovery & {
  sessionId: string;
  terminalStatus: "done" | "error" | "interrupted";
};

export type AppTaskRecoveryRepair = {
  taskId: string;
  disposition: "requeued" | "retired";
  summary: string;
  sessionIds?: string[];
};

const reconcilerRuntimeId = randomUUID();
export const APP_TASK_ATTEMPT_LEASE_DURATION_MS = 15 * 60_000;

function boundedLeaseTimes(nowMs = Date.now()): { lastActivityAt: string; expiresAt: string } {
  const activityMs = Number.isFinite(nowMs) ? Math.max(0, Math.min(nowMs, Date.now() + 1_000)) : Date.now();
  return {
    lastActivityAt: new Date(activityMs).toISOString(),
    expiresAt: new Date(activityMs + APP_TASK_ATTEMPT_LEASE_DURATION_MS).toISOString(),
  };
}

type AttemptSessionActivity = { sessionId: string; lastActivityAt: number | null };

function leaseIsFresh(attempt: AppTaskAttempt, nowMs: number, sessionActivity?: AttemptSessionActivity): boolean {
  const lease = attempt.lease;
  if (!lease || lease.runtimeId !== attempt.runtimeId || lease.sessionId !== attempt.sessionId) return false;
  const expiry = Date.parse(lease.expiresAt);
  if (Number.isFinite(expiry) && expiry > nowMs) return true;
  if (
    !attempt.sessionId ||
    !sessionActivity ||
    sessionActivity.sessionId !== attempt.sessionId ||
    typeof sessionActivity.lastActivityAt !== "number" ||
    !Number.isFinite(sessionActivity.lastActivityAt)
  ) {
    return false;
  }
  const activityAt = Math.max(0, Math.min(sessionActivity.lastActivityAt, nowMs + 1_000));
  return activityAt + APP_TASK_ATTEMPT_LEASE_DURATION_MS > nowMs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function taskTriggerPriority(event: Record<string, unknown>, taskAgent: string): number {
  const data = isRecord(event.data) ? event.data : {};
  const params = isRecord(event.params) ? event.params : isRecord(data.params) ? data.params : {};
  const source = String(event.source ?? data.source ?? "");
  const type = String(event.type ?? "");
  const reason = String(event.reason ?? data.reason ?? params.reason ?? "");
  if (triggerHasDirectProjectComment(event)) return 4;
  if (
    type === "project.approval.submitted" ||
    source === "human" ||
    source === "web-ui" ||
    source.startsWith("telegram") ||
    reason === "retry-candidate-verification"
  ) {
    return 3;
  }
  if (source === `agent:${taskAgent}`) return 1;
  return 2;
}

function preferredTaskTrigger(
  previous: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
  taskAgent: string,
): Record<string, unknown> {
  if (!previous) return incoming;
  // A direct human instruction is an unresolved commitment until the owner
  // consumes it. Automated owner requests may wake the same inbox, but must
  // not obscure the instruction that the owner still owes the human.
  if (triggerHasDirectProjectComment(previous) && !triggerHasDirectProjectComment(incoming)) {
    return previous;
  }
  return taskTriggerPriority(incoming, taskAgent) >= taskTriggerPriority(previous, taskAgent) ? incoming : previous;
}

function taskTriggerEvents(trigger: {
  event: Record<string, unknown>;
  events?: AppTaskTriggerEvent[];
  observedAt?: string;
}): AppTaskTriggerEvent[] {
  if (trigger.events?.length) return trigger.events;
  return [{ event: trigger.event, observedAt: trigger.observedAt ?? new Date(0).toISOString() }];
}

function taskEventIdentity(event: Record<string, unknown>): string {
  const eventId = Number(event.eventId);
  if (Number.isSafeInteger(eventId) && eventId > 0) return `event:${eventId}`;
  return `legacy:${createHash("sha256")
    .update(JSON.stringify(stableValue(event)))
    .digest("hex")}`;
}

/**
 * Remove only durable live events explicitly incorporated by this fenced
 * attempt. The caller persists this mutation atomically with the admitted
 * result; an interrupted, failed, or stale attempt therefore cannot lose input.
 */
function consumeAcceptedLiveTaskEvents(
  tree: TaskTree,
  taskId: string,
  agent: string,
  eventIds: readonly number[] | undefined,
): void {
  const accepted = new Set((eventIds ?? []).filter((eventId) => Number.isSafeInteger(eventId) && eventId > 0));
  if (accepted.size === 0) return;
  const previous = tree.taskTriggers?.[taskId];
  if (!previous) return;
  const pending = taskTriggerEvents(previous);
  const remaining = pending.filter((entry) => {
    const eventId = Number(entry.event.eventId);
    return !Number.isSafeInteger(eventId) || !accepted.has(eventId);
  });
  if (remaining.length === pending.length) return;
  if (remaining.length === 0) {
    delete tree.taskTriggers?.[taskId];
    return;
  }
  tree.taskTriggers = {
    ...(tree.taskTriggers ?? {}),
    [taskId]: {
      ...previous,
      resourceVersion: previous.resourceVersion + 1,
      events: structuredClone(remaining),
      event: structuredClone(preferredTriggerFromEvents(remaining, agent)),
      observedAt: remaining[remaining.length - 1]!.observedAt,
    },
  };
}

function hasUnacceptedLiveEvents(
  pending: AppTaskTrigger | undefined,
  eventIds: readonly number[] | undefined,
): boolean {
  if (!pending) return false;
  const accepted = new Set((eventIds ?? []).filter((eventId) => Number.isSafeInteger(eventId) && eventId > 0));
  return taskTriggerEvents(pending).some(({ event }) => {
    // A clock wake carries no new evidence or intent. Normal settlement still
    // handles the wake; passing time alone does not invalidate useful work.
    if (event.type === "project.task.tick") return false;
    const eventId = Number(event.eventId);
    return !Number.isSafeInteger(eventId) || eventId <= 0 || !accepted.has(eventId);
  });
}

function hasUnacceptedLiveTaskEvents(tree: TaskTree, taskId: string, eventIds: readonly number[] | undefined): boolean {
  return hasUnacceptedLiveEvents(tree.taskTriggers?.[taskId], eventIds);
}

/** A new observation does not supersede the executing attempt or its output. */
export function assertAppTaskClaimCurrent(config: AppTaskContext, claim: AppTaskClaim): void {
  const resource = config.resourceStore.readTask(claim.taskId);
  const attempt = config.resourceStore.readAttempt(claim.attemptId);
  const match = matchingClaimAttempt(resource, attempt, claim);
  if (!match) {
    throw new AppTaskActionStaleError({
      taskId: claim.taskId,
      expectedGeneration: claim.generation,
      currentGeneration: resource?.metadata.generation ?? claim.generation,
      currentPhase: resource?.status.phase,
    });
  }
}

export function hasPendingAppTaskEvidence(
  config: AppTaskContext,
  claim: AppTaskClaim,
  acceptedLiveEventIds?: readonly number[],
): boolean {
  return hasUnacceptedLiveEvents(config.resourceStore.readTrigger(claim.taskId) ?? undefined, acceptedLiveEventIds);
}

/** Reject an externally visible effect when newer Task evidence is still unaccepted. */
export function assertAppTaskEffectFresh(
  config: AppTaskContext,
  claim: AppTaskClaim,
  acceptedLiveEventIds?: readonly number[],
): void {
  assertAppTaskClaimCurrent(config, claim);
  if (hasPendingAppTaskEvidence(config, claim, acceptedLiveEventIds)) {
    throw new AppTaskActionStaleError({
      taskId: claim.taskId,
      expectedGeneration: claim.generation,
      currentGeneration: claim.generation,
      reason: "newer Task evidence is pending",
    });
  }
}

export function appendTaskTriggerEvent(
  events: AppTaskTriggerEvent[],
  event: Record<string, unknown>,
  observedAt: string,
): AppTaskTriggerEvent[] {
  const identity = taskEventIdentity(event);
  if (events.some((entry) => taskEventIdentity(entry.event) === identity)) return events;
  if (event.type === "project.task.tick") {
    // Ticks carry no unique work input: one latest durable wake is enough to
    // reconcile current state. Preserve all feedback/facts alongside that wake.
    const previous = events.filter((entry) => entry.event.type === "project.task.tick").at(-1);
    if (previous) {
      const previousId = Number(previous.event.eventId);
      const incomingId = Number(event.eventId);
      if (
        Number.isSafeInteger(previousId) &&
        previousId > 0 &&
        Number.isSafeInteger(incomingId) &&
        incomingId > 0 &&
        previousId > incomingId
      )
        return events;
    }
    return [
      ...events.filter((entry) => entry.event.type !== "project.task.tick"),
      { event: structuredClone(event), observedAt },
    ];
  }
  return [...events, { event: structuredClone(event), observedAt }];
}

export function preferredTriggerFromEvents(events: AppTaskTriggerEvent[], taskAgent: string): Record<string, unknown> {
  const [first, ...rest] = events;
  if (!first) throw new Error("Task trigger event batch cannot be empty");
  return rest.reduce((preferred, entry) => preferredTaskTrigger(preferred, entry.event, taskAgent), first.event);
}

/**
 * New attempts retain the ordered canonical event batch only. Derive the
 * compatibility projection when a caller still needs one; fall back to the
 * persisted field for legacy rows and synthetic attempts without an event.
 */
function attemptTrigger(attempt: AppTaskAttempt): Record<string, unknown> | undefined {
  return attempt.events?.length ? preferredTriggerFromEvents(attempt.events, attempt.owner) : attempt.trigger;
}

function restoreAttemptEvents(
  tree: TaskTree,
  taskId: string,
  resource: AppTaskResource,
  attempt: AppTaskAttempt,
  observedAt: string,
): boolean {
  const attemptEvents = attempt.events?.length
    ? attempt.events
    : attempt.trigger
      ? [{ event: attempt.trigger, observedAt: attempt.startedAt }]
      : [];
  if (attemptEvents.length === 0) return false;
  const previous = tree.taskTriggers?.[taskId];
  const combined = [...attemptEvents];
  for (const entry of previous ? taskTriggerEvents(previous) : []) {
    const next = appendTaskTriggerEvent(combined, entry.event, entry.observedAt);
    combined.splice(0, combined.length, ...next);
  }
  const owner = attempt.owner || resource.spec.owner || "";
  tree.taskTriggers = {
    ...(tree.taskTriggers ?? {}),
    [taskId]: {
      taskId,
      taskGeneration: resource.metadata.generation,
      resourceVersion: (previous?.resourceVersion ?? 0) + 1,
      event: structuredClone(preferredTriggerFromEvents(combined, owner)),
      events: structuredClone(combined),
      observedAt,
    },
  };
  return true;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function projectIdFromAppDir(appDir: string): string {
  const name = basename(appDir.replace(/\\/g, "/"));
  return name.endsWith(".app") ? name.slice(0, -4) : name;
}

function syntheticAttemptTrigger(
  config: AppTaskContext,
  taskId: string,
  reason: string | undefined,
): Record<string, unknown> {
  const project = projectIdFromAppDir(config.appDir) || "unknown-app";
  const normalizedReason = typeof reason === "string" && reason.trim() ? reason.trim() : "task-controller";
  return {
    type: "project.task.tick",
    source: `app-task:${project}:task-controller`,
    target: { project, taskId },
    reason: normalizedReason,
    data: {
      project,
      taskId,
      task_id: taskId,
      reason: normalizedReason,
      synthetic: "controller-recovery-trigger",
    },
  };
}

export function appTaskSpecHash(intent: AppTaskIntent, effectiveAgent?: string): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        stableValue({
          outcome: intent.outcome,
          acceptance: intent.acceptance,
          mode: intent.mode,
          owner: effectiveAgent ?? intent.owner ?? null,
          workflow: intent.workflow ?? null,
          executor: intent.executor ?? "agent",
          input: intent.input ?? {},
          outputs: intent.outputs ?? [],
          dependsOn: intent.dependsOn ?? [],
        }),
      ),
    )
    .digest("hex");
}

function resourceSpec(intent: AppTaskIntent): AppTaskResource["spec"] {
  return {
    parentId: intent.parentId,
    outcome: intent.outcome,
    acceptance: [...intent.acceptance],
    mode: intent.mode,
    ...(intent.owner?.trim() ? { owner: intent.owner.trim() } : {}),
    ...(intent.workflow?.trim() ? { workflow: intent.workflow.trim() } : {}),
    ...(intent.executor ? { executor: intent.executor } : {}),
    ...(intent.input ? { input: stableValue(intent.input) as Record<string, unknown> } : {}),
    ...(intent.outputs ? { outputs: [...intent.outputs] } : {}),
    ...(intent.dependsOn ? { dependsOn: [...intent.dependsOn] } : {}),
    ...(intent.priority ? { priority: intent.priority } : {}),
    ...(intent.category?.trim() ? { category: intent.category.trim() } : {}),
  };
}

function resourceIntent(resource: AppTaskResource): AppTaskIntent {
  return {
    id: resource.metadata.id,
    parentId: resource.spec.parentId,
    outcome: resource.spec.outcome,
    acceptance: [...resource.spec.acceptance],
    mode: resource.spec.mode,
    ...(resource.spec.owner ? { owner: resource.spec.owner } : {}),
    ...(resource.spec.workflow ? { workflow: resource.spec.workflow } : {}),
    ...(resource.spec.executor ? { executor: resource.spec.executor } : {}),
    ...(resource.spec.input ? { input: { ...resource.spec.input } } : {}),
    ...(resource.spec.outputs ? { outputs: [...resource.spec.outputs] } : {}),
    ...(resource.spec.dependsOn ? { dependsOn: [...resource.spec.dependsOn] } : {}),
    ...(resource.spec.priority ? { priority: resource.spec.priority } : {}),
    ...(resource.spec.category ? { category: resource.spec.category } : {}),
  };
}

function currentResourceAttempt(tree: TaskTree, resource: AppTaskResource): AppTaskAttempt | null {
  const attemptId = resource.status.currentAttemptId;
  if (!attemptId) return null;
  const attempt = tree.attempts?.[attemptId];
  return attempt?.state === "running" ? attempt : null;
}

function latestTaskAttempt(tree: TaskTree, taskId: string, generation?: number): AppTaskAttempt | undefined {
  return Object.values(tree.attempts ?? {})
    .filter(
      (attempt) => attempt.taskId === taskId && (generation === undefined || attempt.taskGeneration === generation),
    )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
}

function previousAttemptEvidence(attempt: AppTaskAttempt): NonNullable<TaskAttempt["previousAttempt"]> {
  const result = attempt.acceptedResult;
  return {
    attemptId: attempt.metadata.id,
    generation: attempt.taskGeneration,
    state: attempt.state,
    ...(attempt.summary ? { summary: attempt.summary } : {}),
    ...(attempt.failureReason ? { failureReason: attempt.failureReason } : {}),
    ...(attempt.sessionId ? { sessionId: attempt.sessionId } : {}),
    ...(attempt.workspace ? { workspacePath: attempt.workspace.path } : {}),
    ...(result
      ? {
          acceptedResult: {
            state: result.state,
            summary: result.summary,
            ...(result.response ? { response: result.response } : {}),
            ...(result.result ? { result: structuredClone(result.result) } : {}),
            evidence: [...result.evidence],
          },
        }
      : {}),
  };
}

function isAgentHandoffReason(reason: string | undefined): boolean {
  return reason === "needs-agent" || reason === "needs-owner";
}

function needsAgentHandoff(tree: TaskTree, resource: AppTaskResource): boolean {
  if (resource.status.phase !== "attention") return false;
  const attempt = latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation);
  return Boolean(attempt?.handler.startsWith("workflow:") && isAgentHandoffReason(attempt.failureReason));
}

function touchResource(resource: AppTaskResource, status: Partial<AppTaskResource["status"]>): void {
  resource.metadata.resourceVersion += 1;
  resource.status = {
    ...resource.status,
    ...status,
    updatedAt: new Date().toISOString(),
  };
}

function finishAttempt(
  tree: TaskTree,
  resource: AppTaskResource,
  state: "completed" | "failed" | "interrupted",
  summary: string,
  now: string,
): void {
  const attemptId = resource.status.currentAttemptId;
  const attempt = attemptId ? tree.attempts?.[attemptId] : undefined;
  if (attempt) {
    attempt.metadata.resourceVersion += 1;
    attempt.state = state;
    attempt.finishedAt = now;
    attempt.summary = summary;
    if (state === "completed") {
      resource.status.executionFailures = undefined;
      resource.status.executionRetryAt = undefined;
    }
  }
  resource.status.currentAttemptId = undefined;
}

/** Capture accepted evidence inside the same mutation as attempt settlement. */
function acceptedAttemptResult(
  tree: TaskTree,
  taskId: string,
  state: "converged" | "waiting" | "stopped",
  input: {
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence?: string[];
    acceptedLiveEventIds?: number[];
  },
  acceptanceBasis: AppTaskAcceptanceBasis,
): NonNullable<AppTaskAttempt["acceptedResult"]> {
  const acceptedIds = new Set(input.acceptedLiveEventIds ?? []);
  const trigger = tree.taskTriggers?.[taskId];
  const acceptedLiveEventIds = [
    ...new Set(
      (trigger ? taskTriggerEvents(trigger) : []).flatMap(({ event }) => {
        const id = Number(event.eventId);
        return Number.isSafeInteger(id) && id > 0 && acceptedIds.has(id) ? [id] : [];
      }),
    ),
  ];
  return structuredClone({
    state,
    summary: input.summary,
    ...(input.response !== undefined ? { response: input.response } : {}),
    ...(input.result ? { result: input.result } : {}),
    evidence: input.evidence ?? [],
    acceptanceBasis,
    ...(acceptedLiveEventIds.length ? { acceptedLiveEventIds } : {}),
  });
}

function consideredInputKeys(
  config: AppTaskContext,
  tree: TaskTree,
  claim: AppTaskClaim,
  acceptedLiveEventIds: number[] = [],
) {
  const liveIds = new Set(acceptedLiveEventIds);
  const attempt = tree.attempts?.[claim.attemptId];
  const events = [
    ...(attempt?.events ?? []),
    ...(tree.taskTriggers?.[claim.taskId] ? taskTriggerEvents(tree.taskTriggers[claim.taskId]) : [])
      .filter(({ event }) => liveIds.has(Number(event.eventId))),
  ];
  return taskInputAdmissionKeys(events, [
    ...(attempt?.continuedInputKeys ?? []),
    ...continuedTaskInputKeys(tree, claim.taskId, events),
  ]);
}

/** Bind only admitted input actually considered by this accepted judgment. */
function acceptedInputAdmissions(
  config: AppTaskContext,
  tree: TaskTree,
  claim: AppTaskClaim,
  acceptedLiveEventIds: number[] = [],
  kind: "answer" | "report" = "answer",
) {
  const keys = consideredInputKeys(config, tree, claim, acceptedLiveEventIds);
  if (!keys.length) return [];
  const admissions = config.resourceStore.readTaskContext({ taskIds: [], admissionIds: keys }).appTaskAdmissions;
  const writes = keys.flatMap<{ taskId: string; value: AppTaskAdmission }>((key) => {
    const admission = admissions?.[key];
    if (!admission || admission.taskId !== claim.taskId || admission.taskGeneration !== claim.generation ||
      admission.resultAttemptId) return [];
    if (kind === "report")
      return admission.reportAttemptId ? [] : [{ taskId: key, value: { ...admission, reportAttemptId: claim.attemptId } }];
    delete tree.resources?.[claim.taskId]?.status.inputWaits?.[key];
    return [{ taskId: key, value: { ...admission, resultAttemptId: claim.attemptId } }];
  });
  const status = tree.resources?.[claim.taskId]?.status;
  if (status?.inputWaits && Object.keys(status.inputWaits).length === 0) delete status.inputWaits;
  return writes;
}

/** Read one input's exact accepted answer or first report, independently of later Task cycles. */
export function readAppTaskAdmissionOutcome(
  config: Pick<AppTaskContext, "resourceStore">,
  taskId: string,
  admissionKey: string,
  kind: "answer" | "report" = "answer",
) {
  const admission = config.resourceStore.readTaskContext({ taskIds: [], admissionIds: [admissionKey] })
    .appTaskAdmissions?.[admissionKey];
  const attemptId = kind === "answer" ? admission?.resultAttemptId : admission?.reportAttemptId;
  if (admission?.taskId !== taskId || !attemptId) return null;
  const attempt = config.resourceStore.readAttempt(attemptId);
  if (attempt?.taskId !== taskId || attempt.taskGeneration !== admission.taskGeneration ||
    attempt.acceptedResult?.state !== (kind === "answer" ? "converged" : "stopped")) return null;
  return { attemptId: attempt.metadata.id, generation: attempt.taskGeneration, ...attempt.acceptedResult };
}

type AppTaskContextInput = {
  appDir: string;
  projectDir: string;
  agent: string;
  maxConcurrent: number;
  resourceStore: AppTaskResourceStore;
};

export function appTaskContext(input: AppTaskContextInput): AppTaskContext {
  const agent = input.agent.trim();
  if (!agent) throw new Error("Task reconciliation requires a default agent");
  return {
    appDir: input.appDir,
    projectDir: input.projectDir,
    agent,
    maxConcurrent: input.maxConcurrent,
    resourceStore: input.resourceStore,
  };
}

function resolvedAgent(tree: TaskTree, intent: AppTaskIntent, appAgent: string): string {
  if (intent.owner?.trim()) return intent.owner.trim();
  let parentId: string | null | undefined = intent.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parentResource: AppTaskResource | undefined = tree.resources?.[parentId];
    if (parentResource) {
      if (parentResource.spec.owner?.trim()) return parentResource.spec.owner.trim();
      parentId = parentResource.spec.parentId;
      continue;
    }
    const parentGroup: NonNullable<TaskTree["groups"]>[string] | undefined = tree.groups?.[parentId];
    if (!parentGroup) break;
    if (parentGroup.owner?.trim()) return parentGroup.owner.trim();
    parentId = parentGroup.parent_id;
  }
  return appAgent;
}

function isAppTaskCondition(value: unknown): value is AppTaskCondition {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.spec) || !isRecord(value.status)) {
    return false;
  }
  return (
    typeof value.metadata.id === "string" &&
    Number.isInteger(value.metadata.generation) &&
    Number.isInteger(value.metadata.resourceVersion) &&
    typeof value.spec.type === "string" &&
    typeof value.spec.subject === "string" &&
    ["unknown", "false", "true"].includes(String(value.status.state))
  );
}

function isOpenCondition(value: unknown): value is AppTaskCondition {
  return isAppTaskCondition(value) && value.status.state !== "true";
}

function conditionRegistry(tree: TaskTree): Record<string, AppTaskCondition> {
  tree.conditions = tree.conditions ?? {};
  return tree.conditions;
}

function taskConditionIds(tree: TaskTree, taskId: string): string[] {
  return [...(tree.resources?.[taskId]?.status.conditionIds ?? [])];
}

function taskConditionEntries(tree: TaskTree, taskId: string): Array<[string, Record<string, unknown>]> {
  const linked = new Set(taskConditionIds(tree, taskId));
  const entries: Array<[string, Record<string, unknown>]> = [];
  for (const [id, value] of Object.entries(tree.conditions ?? {})) {
    const raw = value as unknown;
    if (!isRecord(raw)) continue;
    if (linked.has(id)) entries.push([id, raw]);
  }
  return entries;
}

function openTaskConditionIds(tree: TaskTree, taskId: string): string[] {
  const ids = taskConditionEntries(tree, taskId)
    .filter(([, condition]) => isOpenCondition(condition))
    .map(([id]) => id);
  return [...new Set(ids)];
}

function missedTaskConditionCheckpointIds(tree: TaskTree, taskId: string, nowMs = Date.now()): string[] {
  return taskConditionEntries(tree, taskId).flatMap(([id, condition]) => {
    if (!isOpenCondition(condition)) return [];
    const reviewAfterMs = condition.spec.reviewAfterMs;
    const observedAtMs = Date.parse(String(condition.status.observedAt ?? ""));
    if (
      !Number.isInteger(reviewAfterMs) ||
      Number(reviewAfterMs) < MIN_APP_TASK_CONDITION_REVIEW_AFTER_MS ||
      !Number.isFinite(observedAtMs)
    ) {
      return [];
    }
    return nowMs >= observedAtMs + Number(reviewAfterMs) ? [id] : [];
  });
}

function hasSatisfiedTaskCondition(tree: TaskTree, taskId: string): boolean {
  return taskConditionEntries(tree, taskId).some(
    ([, condition]) => isAppTaskCondition(condition) && condition.status.state === "true",
  );
}

function pruneUnlinkedConditions(tree: TaskTree): void {
  const linked = new Set<string>();
  for (const resource of Object.values(tree.resources ?? {})) {
    for (const id of resource.status.conditionIds ?? []) linked.add(id);
  }
  for (const [id, value] of Object.entries(tree.conditions ?? {})) {
    if (isAppTaskCondition(value) && !linked.has(id)) delete tree.conditions![id];
  }
}

function unlinkTaskConditions(tree: TaskTree, taskId: string): void {
  const resource = tree.resources?.[taskId];
  if (resource?.status.conditionIds?.length) touchResource(resource, { conditionIds: [] });
  pruneUnlinkedConditions(tree);
}

function unlinkSatisfiedTaskConditions(tree: TaskTree, taskId: string): void {
  const resource = tree.resources?.[taskId];
  if (!resource?.status.conditionIds?.length) return;
  const remaining = resource.status.conditionIds.filter((id) => {
    const condition = tree.conditions?.[id];
    return !isAppTaskCondition(condition) || condition.status.state !== "true";
  });
  if (remaining.length === resource.status.conditionIds.length) return;
  touchResource(resource, { conditionIds: remaining });
  pruneUnlinkedConditions(tree);
}

function materializeWaitingConditions(
  tree: TaskTree,
  taskId: string,
  conditions: AppTaskConditionSpec[],
  now: string,
): void {
  const registry = conditionRegistry(tree);
  const ids: string[] = [];
  const previousIds = new Set(taskConditionIds(tree, taskId));
  for (const raw of conditions) {
    const id = raw.id.trim();
    ids.push(id);
    const spec = {
      type: raw.type.trim(),
      subject: raw.subject.trim(),
      expected: raw.expected,
      ...(raw.requestedAction?.trim() ? { requestedAction: raw.requestedAction.trim() } : {}),
      owner: raw.owner!.trim(),
      reviewAfterMs: raw.reviewAfterMs!,
    };
    const current = registry[id];
    const sameSpec = current && JSON.stringify(stableValue(current.spec)) === JSON.stringify(stableValue(spec));
    const linkedToAnotherTask = Object.values(tree.resources ?? {}).some(
      (resource) => resource.metadata.id !== taskId && resource.status.conditionIds?.includes(id),
    );
    if (current && !sameSpec && linkedToAnotherTask) {
      throw new Error(`Condition ${id} is already linked to another task with a different specification`);
    }
    // Unrelated reevaluation must not postpone a future recovery checkpoint.
    // Once due, an accepted recheck may renew it without satisfying the wait.
    const reviewDue = current && Date.parse(current.status.observedAt ?? "") + spec.reviewAfterMs <= Date.parse(now);
    registry[id] = sameSpec
      ? previousIds.has(id) && current.status.state !== "true" && reviewDue
        ? {
            ...current,
            metadata: {
              ...current.metadata,
              resourceVersion: current.metadata.resourceVersion + 1,
            },
            status: { ...current.status, observedAt: now },
          }
        : current
      : {
          metadata: {
            id,
            generation: (current?.metadata.generation ?? 0) + 1,
            resourceVersion: (current?.metadata.resourceVersion ?? 0) + 1,
          },
          spec,
          status: {
            observedGeneration: 0,
            state: "unknown",
            createdAt: now,
            observedAt: now,
          },
        };
  }
  const resource = tree.resources?.[taskId];
  if (resource) touchResource(resource, { conditionIds: ids });
  pruneUnlinkedConditions(tree);
}

export function recoverableAppTaskAttempts(
  config: AppTaskContext,
  nowMs = Date.now(),
  includeFreshLeases = false,
  candidateTaskIds: Iterable<string>,
): AppTaskAttemptRecovery[] {
  const candidates = [...candidateTaskIds];
  if (candidates.length === 0) return [];
  const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
  return Object.values(tree.resources ?? {}).flatMap((resource) => {
    if (resource.status.phase !== "running") return [];
    const attempt = currentResourceAttempt(tree, resource);
    if (!attempt || attempt.runtimeId === reconcilerRuntimeId || (!includeFreshLeases && leaseIsFresh(attempt, nowMs)))
      return [];
    const trigger = attemptTrigger(attempt);
    return [
      {
        taskId: resource.metadata.id,
        intent: resourceIntent(resource),
        ...(attempt.events?.length ? { events: structuredClone(attempt.events) } : {}),
        ...(attempt.eventsTruncated ? { eventsTruncated: true } : {}),
        ...(trigger ? { trigger: structuredClone(trigger) } : {}),
        ...(attempt.sessionId ? { sessionId: attempt.sessionId } : {}),
        taskGeneration: resource.metadata.generation,
        taskResourceVersion: resource.metadata.resourceVersion,
        attemptId: attempt.metadata.id,
        attemptResourceVersion: attempt.metadata.resourceVersion,
        ...(attempt.lease ? { leaseId: attempt.lease.id, leaseVersion: attempt.lease.version } : {}),
        legacyLeaseLess: !attempt.lease,
      },
    ];
  });
}

export function expiredAgentSessionAppTaskAttempt(
  config: AppTaskContext,
  taskId: string,
  nowMs = Date.now(),
  sessionActivity?: AttemptSessionActivity,
): AppTaskAttemptRecovery | null {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  if (!resource || resource.status.phase !== "running") return null;
  const attempt = currentResourceAttempt(tree, resource);
  if (
    !attempt ||
    !isManagedAgentHandler(attempt.handler) ||
    !attempt.sessionId ||
    !attempt.lease ||
    attempt.lease.sessionId !== attempt.sessionId ||
    attempt.lease.runtimeId !== attempt.runtimeId ||
    leaseIsFresh(attempt, nowMs, sessionActivity)
  ) {
    return null;
  }
  const trigger = attemptTrigger(attempt);
  return {
    taskId,
    intent: resourceIntent(resource),
    ...(attempt.events?.length ? { events: structuredClone(attempt.events) } : {}),
    ...(attempt.eventsTruncated ? { eventsTruncated: true } : {}),
    ...(trigger ? { trigger: structuredClone(trigger) } : {}),
    sessionId: attempt.sessionId,
    taskGeneration: resource.metadata.generation,
    taskResourceVersion: resource.metadata.resourceVersion,
    attemptId: attempt.metadata.id,
    attemptResourceVersion: attempt.metadata.resourceVersion,
    leaseId: attempt.lease.id,
    leaseVersion: attempt.lease.version,
    legacyLeaseLess: false,
  };
}

/** Recovery replaces execution, not the accepted Task generation or its waits. */
export function releaseInterruptedAppTaskAttempt(
  config: AppTaskContext,
  recovery: AppTaskAttemptRecovery,
  summary: string,
): { released: boolean; sessionIds: string[] } {
  const taskId = recovery.taskId;
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  if (!resource || resource.status.phase !== "running") return { released: false, sessionIds: [] };
  const attempt = currentResourceAttempt(tree, resource);
  if (!attempt || attempt.runtimeId === reconcilerRuntimeId) return { released: false, sessionIds: [] };
  if (
    resource.metadata.generation !== recovery.taskGeneration ||
    resource.metadata.resourceVersion !== recovery.taskResourceVersion ||
    resource.status.currentAttemptId !== recovery.attemptId ||
    attempt.metadata.id !== recovery.attemptId ||
    attempt.metadata.resourceVersion !== recovery.attemptResourceVersion ||
    (recovery.legacyLeaseLess
      ? attempt.lease !== undefined
      : !attempt.lease || attempt.lease.id !== recovery.leaseId || attempt.lease.version !== recovery.leaseVersion)
  )
    return { released: false, sessionIds: [] };
  const mutationScope = beginResourceMutationScopeForTasks(tree, [taskId]);
  const now = new Date().toISOString();
  const recoveredSummary = `${summary}; retrying from current task evidence`;
  const sessionIds = attempt.sessionId ? [attempt.sessionId] : [];
  restoreAttemptEvents(tree, taskId, resource, attempt, now);
  finishAttempt(tree, resource, "interrupted", recoveredSummary, now);
  attempt.metadata.resourceVersion += 1;
  attempt.failureReason = "previous-runtime-attempt-requeued";
  touchResource(resource, {
    phase: "pending",
    currentAttemptId: undefined,
  });
  commitTaskMutation(config, tree, {
    resourceMutation: finishResourceMutationScope(mutationScope, tree),
  });
  return { released: true, sessionIds };
}

/**
 * A terminal session does not prove Task settlement. After its caller lease
 * expires, interrupt the exact attempt and retry the same generation through
 * normal execution and result validation.
 */
export function releaseTerminalSessionExpiredAppTaskAttempt(
  config: AppTaskContext,
  recovery: AppTaskTerminalSessionRecovery,
  summary: string,
  nowMs = Date.now(),
  sessionActivity?: AttemptSessionActivity,
): { released: boolean; sessionIds: string[] } {
  const tree = config.resourceStore.readTaskContext({ taskIds: [recovery.taskId] });
  const resource = tree.resources?.[recovery.taskId];
  if (!resource || resource.status.phase !== "running") {
    return { released: false, sessionIds: [] };
  }
  const attempt = currentResourceAttempt(tree, resource);
  if (
    !attempt ||
    !isManagedAgentHandler(attempt.handler) ||
    attempt.state !== "running" ||
    resource.metadata.generation !== recovery.taskGeneration ||
    resource.metadata.resourceVersion !== recovery.taskResourceVersion ||
    resource.status.currentAttemptId !== recovery.attemptId ||
    attempt.metadata.id !== recovery.attemptId ||
    attempt.metadata.resourceVersion !== recovery.attemptResourceVersion ||
    attempt.sessionId !== recovery.sessionId ||
    !attempt.lease ||
    attempt.lease.id !== recovery.leaseId ||
    attempt.lease.version !== recovery.leaseVersion ||
    attempt.lease.sessionId !== recovery.sessionId ||
    attempt.lease.runtimeId !== attempt.runtimeId ||
    leaseIsFresh(attempt, nowMs, sessionActivity)
  ) {
    return { released: false, sessionIds: [] };
  }

  const mutationScope = beginResourceMutationScopeForTasks(tree, [recovery.taskId]);
  const now = new Date(nowMs).toISOString();
  const recoveredSummary = `${summary}; terminal agent session ${recovery.sessionId} (${recovery.terminalStatus}) cannot return this expired attempt; retrying from current task evidence`;
  restoreAttemptEvents(tree, recovery.taskId, resource, attempt, now);
  finishAttempt(tree, resource, "interrupted", recoveredSummary, now);
  attempt.metadata.resourceVersion += 1;
  attempt.failureReason = "terminal-agent-session-expired-lease-requeued";
  touchResource(resource, {
    phase: "pending",
    currentAttemptId: undefined,
    summary: recoveredSummary,
  });
  commitTaskMutation(config, tree, {
    resourceMutation: finishResourceMutationScope(mutationScope, tree),
  });
  return { released: true, sessionIds: [recovery.sessionId] };
}

export function releaseLateTerminalWorkflowAppTaskAttempt(
  config: AppTaskContext,
  binding: { taskId: string; generation: number },
  sessionId: string,
  summary: string,
): { released: boolean; taskId: string } {
  const tree = config.resourceStore.readTaskContext({ taskIds: [binding.taskId] });
  const resource = tree.resources?.[binding.taskId];
  if (!resource || resource.metadata.generation !== binding.generation || resource.status.phase !== "running") {
    return { released: false, taskId: binding.taskId };
  }
  const attempt = currentResourceAttempt(tree, resource);
  if (!attempt || attempt.state !== "running" || attempt.sessionId !== sessionId) {
    return { released: false, taskId: binding.taskId };
  }

  const mutationScope = beginResourceMutationScopeForTasks(tree, [binding.taskId]);
  const now = new Date().toISOString();
  const recoveredSummary = `${summary}; retrying the same task from current evidence`;
  restoreAttemptEvents(tree, binding.taskId, resource, attempt, now);
  finishAttempt(tree, resource, "interrupted", recoveredSummary, now);
  attempt.metadata.resourceVersion += 1;
  attempt.failureReason = "late-terminal-workflow-result-requeued";
  touchResource(resource, {
    phase: "pending",
    currentAttemptId: undefined,
    summary: recoveredSummary,
  });
  commitTaskMutation(config, tree, {
    resourceMutation: finishResourceMutationScope(mutationScope, tree),
  });
  return { released: true, taskId: binding.taskId };
}

export function repairPreviousRuntimeRecoveryAttention(
  config: AppTaskContext,
  candidateTaskIds: Iterable<string>,
): AppTaskRecoveryRepair[] {
  const candidates = [...candidateTaskIds];
  if (candidates.length === 0) return [];
  const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
  const repairs: AppTaskRecoveryRepair[] = [];
  const mutationScope = emptyResourceMutationScope(tree);
  for (const resource of Object.values(tree.resources ?? {})) {
    if (resource.status.phase !== "attention") continue;
    const attempt = Object.values(tree.attempts ?? {})
      .filter((candidate) => candidate.taskId === resource.metadata.id)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    if (attempt?.failureReason !== "previous-runtime-attempt-not-recoverable") continue;

    trackResourceMutationTask(mutationScope, tree, resource.metadata.id);
    const baseSummary =
      resource.status.summary?.trim() ||
      `Interrupted reconciliation ${resource.metadata.id} cannot resume because its previous runtime did not persist the trigger packet`;
    const summary = `${baseSummary}; retrying from current task evidence`;
    attempt.metadata.resourceVersion += 1;
    attempt.failureReason = "previous-runtime-attempt-requeued";
    touchResource(resource, {
      phase: "pending",
      currentAttemptId: undefined,
      summary,
    });
    repairs.push({
      taskId: resource.metadata.id,
      disposition: "requeued",
      summary,
    });
  }
  if (repairs.length > 0) {
    commitTaskMutation(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
  }
  return repairs;
}

/**
 * Release waits created by older runtimes before the destination App had
 * durably admitted the request. Such a request can never complete, so the
 * same Task must be judged again from its current evidence.
 */
export function repairUnadmittedAppDependencyWaits(
  config: AppTaskContext,
  isAdmitted: (requestId: string) => boolean,
  candidateTaskIds: Iterable<string>,
): AppTaskRecoveryRepair[] {
  const candidates = [...candidateTaskIds];
  if (candidates.length === 0) return [];
  const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
  const repairs: AppTaskRecoveryRepair[] = [];
  const mutationScope = emptyResourceMutationScope(tree);
  for (const resource of Object.values(tree.resources ?? {})) {
    if (resource.status.phase !== "waiting") continue;
    const missingRequestId = (resource.status.conditionIds ?? []).flatMap((conditionId) => {
      const condition = tree.conditions?.[conditionId];
      if (
        !isAppTaskCondition(condition) ||
        condition.status.state === "true" ||
        condition.spec.type !== "app.dependency.updated" ||
        !condition.spec.subject.startsWith("id:")
      ) {
        return [];
      }
      const requestId = condition.spec.subject.slice("id:".length).trim();
      return requestId && !isAdmitted(requestId) ? [requestId] : [];
    })[0];
    if (!missingRequestId) continue;

    trackResourceMutationTask(mutationScope, tree, resource.metadata.id);
    const summary = `App dependency request ${missingRequestId} was not admitted; retrying the same Task from current evidence`;
    unlinkTaskConditions(tree, resource.metadata.id);
    touchResource(resource, {
      phase: "pending",
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary,
      conditionIds: [],
    });
    repairs.push({ taskId: resource.metadata.id, disposition: "requeued", summary });
  }
  if (repairs.length > 0) {
    commitTaskMutation(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
  }
  return repairs;
}

export function repairRunningAppTasksWithoutAttempt(
  config: AppTaskContext,
  candidateTaskIds: Iterable<string>,
): AppTaskRecoveryRepair[] {
  const candidates = [...candidateTaskIds];
  if (candidates.length === 0) return [];
  const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
  const repairs: AppTaskRecoveryRepair[] = [];
  const mutationScope = emptyResourceMutationScope(tree);
  const now = new Date().toISOString();
  for (const resource of Object.values(tree.resources ?? {})) {
    if (resource.status.phase !== "running") continue;
    const attemptId = resource.status.currentAttemptId;
    const attempt = attemptId ? tree.attempts?.[attemptId] : undefined;
    if (attempt?.state === "running") continue;

    trackResourceMutationTask(mutationScope, tree, resource.metadata.id);
    const summary = attemptId
      ? `Running reconciliation ${resource.metadata.id} referenced missing or non-running attempt ${attemptId}; retrying from current task evidence`
      : `Running reconciliation ${resource.metadata.id} had no current attempt; retrying from current task evidence`;
    if (attempt) {
      attempt.metadata.resourceVersion += 1;
      attempt.failureReason = "running-without-current-attempt-requeued";
      attempt.summary = summary;
      attempt.finishedAt ??= now;
    }
    touchResource(resource, {
      phase: "pending",
      currentAttemptId: undefined,
      summary,
    });
    repairs.push({
      taskId: resource.metadata.id,
      disposition: "requeued",
      summary,
    });
  }
  if (repairs.length > 0) {
    commitTaskMutation(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
  }
  return repairs;
}

function validateIntent(intent: AppTaskIntent): void {
  if (!intent.id.trim()) throw new Error("Task reconciliation requires a non-empty task id");
  if (!intent.parentId.trim()) throw new Error(`Task ${intent.id} requires a parentId`);
  if (!intent.outcome.trim()) throw new Error(`Task ${intent.id} requires an outcome`);
  if (intent.acceptance.length === 0) throw new Error(`Task ${intent.id} requires acceptance criteria`);
  if (intent.workflow !== undefined) {
    const workflow = intent.workflow.trim();
    if (!workflow) throw new Error(`Task ${intent.id} workflow must be a non-empty string when present`);
    if (workflow === "project") {
      throw new Error(
        `Task ${intent.id} workflow must name a real workflow; omit workflow for agent-handled project work`,
      );
    }
  }
  if (intent.executor !== undefined && !/^[a-z][a-z0-9-]{0,63}$/.test(intent.executor)) {
    throw new Error(`Task ${intent.id} executor must be a lowercase name of at most 64 characters`);
  }
  if (intent.workflow && intent.executor) {
    throw new Error(`Task ${intent.id} cannot configure both workflow and executor`);
  }
}

function validateParentReference(tree: TaskTree, taskId: string, parentId: string): void {
  if (tree.resources?.[taskId]?.spec.parentId !== parentId && tree.cancellations?.[parentId]) {
    throw new Error(`Cannot attach ${taskId} to cancelled parent ${parentId}`);
  }
  if (!tree.resources?.[parentId] && !tree.groups?.[parentId]) {
    throw new Error(`Task ${taskId} parent does not exist in the live graph: ${parentId}`);
  }
  if (parentId === taskId) throw new Error(`Task ${taskId} cannot be its own parent`);

  const seen = new Set<string>();
  let cursor: string | undefined = parentId;
  while (cursor && !seen.has(cursor)) {
    if (cursor === taskId) throw new Error(`Task ${taskId} parent would create a containment cycle`);
    seen.add(cursor);
    cursor = tree.resources?.[cursor]?.spec.parentId ?? tree.groups?.[cursor]?.parent_id ?? undefined;
  }
  if (cursor) throw new Error(`Task ${taskId} parent chain already contains a containment cycle at ${cursor}`);
}

export function observeAppTaskIntent(
  config: AppTaskContext,
  input: {
    intent: AppTaskIntent;
    appAgent: string;
    trigger?: Record<string, unknown>;
    admissionKey?: string;
  },
): AppTaskObservationResult {
  input = { ...input, intent: normalizeTaskAgent(input.intent) };
  validateIntent(input.intent);
  if (config.resourceStore.isCancelled(input.intent.id)) {
    throw new Error(`Cannot admit intent for cancelled task ${input.intent.id}; create a new linked task`);
  }
  const admissionKey = input.admissionKey?.trim();
  if (input.admissionKey !== undefined && !admissionKey) {
    throw new Error("Task admission key must be non-empty when provided");
  }
  const tree = config.resourceStore.readTaskContext({
    taskIds: [input.intent.id, input.intent.parentId, ...(input.intent.dependsOn ?? [])],
    ...(admissionKey ? { admissionIds: [admissionKey] } : {}),
  });
  const supersededSessionIds = new Set<string>();
  validateParentReference(tree, input.intent.id, input.intent.parentId);
  const agent = resolvedAgent(tree, input.intent, input.appAgent);
  const specHash = appTaskSpecHash(input.intent, agent);
  const previousAdmission = admissionKey ? tree.appTaskAdmissions?.[admissionKey] : undefined;
  if (previousAdmission) {
    if (previousAdmission.taskId !== input.intent.id || previousAdmission.specHash !== specHash) {
      throw new Error(`Task admission key ${admissionKey} was already used for different desired work`);
    }
    const current = tree.resources?.[previousAdmission.taskId];
    if (current) {
      return {
        kind: "observed",
        taskId: current.metadata.id,
        generation: current.metadata.generation,
        changed: false,
      };
    }
    delete tree.appTaskAdmissions?.[admissionKey!];
  }

  const recordAdmission = (taskId: string, taskGeneration: number): void => {
    if (!admissionKey) return;
    tree.appTaskAdmissions = {
      ...(tree.appTaskAdmissions ?? {}),
      [admissionKey]: {
        taskId,
        taskGeneration,
        specHash,
        admittedAt: new Date().toISOString(),
        ...(input.trigger ? { inputEvent: structuredClone(input.trigger) } : {}),
      },
    };
  };
  const existingResource = tree.resources?.[input.intent.id];
  const existingFence = existingResource
    ? {
        taskId: existingResource.metadata.id,
        resourceVersion: existingResource.metadata.resourceVersion,
        generation: existingResource.metadata.generation,
        currentAttemptId: existingResource.status.currentAttemptId ?? null,
      }
    : undefined;
  const initialConditionIds = new Set(existingResource?.status.conditionIds ?? []);
  const existingAttempt = existingResource ? currentResourceAttempt(tree, existingResource) : null;
  const previousGeneration = existingResource?.metadata.generation ?? 0;
  const existingIntent = existingResource ? resourceIntent(existingResource) : null;
  const existingAgent = existingIntent ? resolvedAgent(tree, existingIntent, input.appAgent) : null;
  const sameSpec = existingIntent ? appTaskSpecHash(existingIntent, existingAgent ?? undefined) === specHash : false;
  const generation = sameSpec ? previousGeneration : Math.max(1, previousGeneration + 1);
  const nextSpec = resourceSpec(input.intent);
  const desiredStateChanged =
    !existingResource || JSON.stringify(stableValue(existingResource.spec)) !== JSON.stringify(stableValue(nextSpec));
  const requestedLane = taskTriggerLane(input.trigger);
  const laneChanged = requestedLane === "human" && existingResource?.status.lane !== "human";
  const changed = !existingResource || generation !== previousGeneration || desiredStateChanged || laneChanged;
  const now = new Date().toISOString();
  let resource: AppTaskResource;
  if (existingResource && sameSpec) {
    resource =
      desiredStateChanged || laneChanged
        ? {
            ...existingResource,
            metadata: {
              ...existingResource.metadata,
              resourceVersion: existingResource.metadata.resourceVersion + 1,
            },
            spec: nextSpec,
            status: {
              ...existingResource.status,
              ...(laneChanged ? { lane: "human" as const } : {}),
              updatedAt: now,
            },
          }
        : existingResource;
  } else {
    if (existingResource?.status.currentAttemptId) {
      const existingAttempt = currentResourceAttempt(tree, existingResource);
      if (existingAttempt?.sessionId) supersededSessionIds.add(existingAttempt.sessionId);
      finishAttempt(
        tree,
        existingResource,
        "interrupted",
        "Task specification changed while the attempt was active",
        now,
      );
    }
    resource = {
      metadata: {
        id: input.intent.id,
        generation,
        resourceVersion: (existingResource?.metadata.resourceVersion ?? 0) + 1,
      },
      spec: nextSpec,
      status: {
        observedGeneration: Math.min(existingResource?.status.observedGeneration ?? 0, generation - 1),
        phase: "pending",
        ...(existingResource?.status.lane === "human" || requestedLane === "human" ? { lane: "human" as const } : {}),
        updatedAt: now,
      },
    };
  }
  tree.resources = { ...(tree.resources ?? {}), [input.intent.id]: resource };
  if (generation > previousGeneration) {
    // A new desired generation supersedes pending wakes that were fenced to
    // the older specification. The event store retains their causal history;
    // only the old task-generation link is retired.
    if (tree.taskTriggers) delete tree.taskTriggers[input.intent.id];
  }
  // Routing establishes relevance. Open waits never filter admitted input.
  if (input.trigger) {
    const previousTrigger = tree.taskTriggers?.[input.intent.id];
    const events = appendTaskTriggerEvent(
      previousTrigger ? taskTriggerEvents(previousTrigger) : [],
      input.trigger,
      now,
    );
    const event = preferredTriggerFromEvents(events, agent);
    tree.taskTriggers = {
      ...(tree.taskTriggers ?? {}),
      [input.intent.id]: {
        taskId: input.intent.id,
        taskGeneration: generation,
        resourceVersion: (previousTrigger?.resourceVersion ?? 0) + 1,
        events,
        event: structuredClone(event),
        observedAt: now,
      },
    };
  }
  // Only a newly admitted human message can waive pacing. Replays returned
  // above; a Task fact, timer or delegated humanRequested flag is not a new ask.
  const request =
    input.trigger && isRecord(input.trigger.data) && isRecord(input.trigger.data.request)
      ? input.trigger.data.request
      : undefined;
  if (
    admissionKey &&
    input.trigger?.type === "app.task.requested" &&
    request &&
    isRecord(request.source) &&
    request.source.kind === "human"
  ) {
    touchResource(resource, { executionRetryAt: undefined, freshHumanInput: true });
  }
  recordAdmission(input.intent.id, generation);
  const relevantConditionIds = new Set([...initialConditionIds, ...(resource.status.conditionIds ?? [])]);
  commitTaskMutation(config, tree, {
    resourceMutation: {
      fences: existingFence ? [existingFence] : [],
      ...(!existingFence ? { expectMissingTaskIds: [resource.metadata.id] } : {}),
      tasks: [resourceWrite(tree, resource, isRunnableOnPassiveResync(tree, resource))],
      ...(existingAttempt ? { attempts: [existingAttempt] } : {}),
      conditions: [...relevantConditionIds].flatMap((id) => (tree.conditions?.[id] ? [tree.conditions[id]] : [])),
      deleteConditionIds: [...relevantConditionIds].filter((id) => !tree.conditions?.[id]),
      ...(generation > previousGeneration ? { pruneConditionIds: [...initialConditionIds] } : {}),
      ...(admissionKey && tree.appTaskAdmissions?.[admissionKey]
        ? { admissions: [{ taskId: admissionKey, value: tree.appTaskAdmissions[admissionKey] }] }
        : {}),
    },
  });
  return {
    kind: "observed",
    taskId: input.intent.id,
    generation,
    changed,
    ...(supersededSessionIds.size > 0 ? { supersededSessionIds: [...supersededSessionIds] } : {}),
  };
}

export function readAppTaskIntent(config: AppTaskContext, taskId: string): AppTaskIntent | null {
  const resource = config.resourceStore.readTask(taskId);
  return resource ? resourceIntent(resource) : null;
}

/** Resolve the exact Task's agent, including inheritance, before worker loading. */
export function readAppTaskAgent(config: AppTaskContext, taskId: string): string | null {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  return resource ? resolvedAgent(tree, resourceIntent(resource), config.agent) : null;
}

/**
 * Return whether the requested task generation has produced a converged fact.
 * Historical completion receipts never satisfy a revised assignment.
 */
export function isAppTaskConverged(config: AppTaskContext, taskId: string, generation?: number): boolean {
  const resource = config.resourceStore.readTask(taskId);
  if (resource) {
    return (
      (generation === undefined || resource.metadata.generation === generation) &&
      resource.status.phase === "converged" &&
      resource.status.observedGeneration === resource.metadata.generation
    );
  }
  return false;
}

export type AppTaskChildContext = {
  cancelled?: TaskAttempt["children"]["cancelled"];
  live: Array<{
    taskId: string;
    parentId: string;
    generation: number;
    phase: AppTaskResource["status"]["phase"];
    outcome: string;
    agent?: string;
    workflow?: string;
    executor?: TaskExecutorName;
    input: Record<string, unknown>;
    priority?: "P0" | "P1" | "P2" | "P3";
    category?: string;
    dependsOn?: string[];
    conditions: AppTaskConditionSpec[];
    readiness?: {
      state:
        | "ready"
        | "dependency-blocked"
        | "condition-blocked"
        | "capacity-blocked"
        | "paused"
        | "not-applicable";
      reason: string;
      relatedTaskIds: string[];
    };
    latestAttempt?: { handler: string; failureReason?: string };
    hasLiveChildren: boolean;
    updatedAt?: string;
    summary?: string;
    evidence: string[];
  }>;
  completed: Array<{
    taskId: string;
    parentId: string;
    generation: number;
    outcome: string;
    agent: string;
    workflow?: string;
    executor?: TaskExecutorName;
    input: Record<string, unknown>;
    priority?: "P0" | "P1" | "P2" | "P3";
    conditions: AppTaskConditionSpec[];
    hasLiveChildren: false;
    summary: string;
    evidence: string[];
    completedAt: string;
  }>;
};

export type AppTaskSnapshotContext = {
  taskId: string;
  parentId: string;
  generation: number;
  phase: AppTaskResource["status"]["phase"];
  outcome: string;
  agent?: string;
  executor?: TaskExecutorName;
  priority?: "P0" | "P1" | "P2" | "P3";
  category?: string;
  dependsOn?: string[];
  conditions: Array<
    Pick<AppTaskConditionSpec, "id" | "type" | "subject" | "requestedAction" | "owner" | "reviewAfterMs">
  >;
  readiness?: {
    state:
      | "ready"
      | "dependency-blocked"
      | "condition-blocked"
      | "capacity-blocked"
      | "paused"
      | "not-applicable";
    reason: string;
    relatedTaskIds: string[];
  };
  hasLiveChildren: boolean;
  updatedAt?: string;
};

const MAX_LIVE_CHILD_CONTEXT = 16;
const MAX_COMPLETED_CHILD_CONTEXT = 8;
const MAX_APP_TASK_LIVE_SNAPSHOT = 64;
const MAX_CHILD_EVIDENCE = 4;
const MAX_CHILD_CONTEXT_TEXT = 512;
const MAX_SNAPSHOT_CONTEXT_TEXT = 256;
const MAX_SNAPSHOT_RELATED_TASK_IDS = 8;

function appTaskConcurrencyLimit(config: AppTaskContext): number {
  return Number.isInteger(config.maxConcurrent) && config.maxConcurrent > 0 ? config.maxConcurrent : 1;
}

function boundedChildContextText(value: string): string {
  return value.length <= MAX_CHILD_CONTEXT_TEXT ? value : `${value.slice(0, MAX_CHILD_CONTEXT_TEXT - 3)}...`;
}

function boundedChildEvidence(evidence: string[]): string[] {
  return evidence.slice(0, MAX_CHILD_EVIDENCE).map(boundedChildContextText);
}

function liveTaskContext(
  tree: TaskTree,
  resource: AppTaskResource,
  readiness: AppTaskReadiness | undefined,
): AppTaskChildContext["live"][number] {
  const attempt = currentResourceAttempt(tree, resource);
  return {
    taskId: resource.metadata.id,
    parentId: resource.spec.parentId,
    generation: resource.metadata.generation,
    phase: resource.status.phase,
    outcome: boundedChildContextText(resource.spec.outcome),
    ...(resource.spec.owner ? { agent: resource.spec.owner } : {}),
    ...(resource.spec.workflow ? { workflow: resource.spec.workflow } : {}),
    ...(resource.spec.executor ? { executor: resource.spec.executor } : {}),
    input: structuredClone(resource.spec.input ?? {}),
    ...(resource.spec.priority ? { priority: resource.spec.priority } : {}),
    ...(resource.spec.category ? { category: resource.spec.category } : {}),
    ...(resource.spec.dependsOn?.length ? { dependsOn: [...resource.spec.dependsOn] } : {}),
    conditions: (resource.status.conditionIds ?? []).flatMap((conditionId) => {
      const condition = tree.conditions?.[conditionId];
      return condition ? [{ id: condition.metadata.id, ...structuredClone(condition.spec) }] : [];
    }),
    ...(readiness
      ? {
          readiness: {
            state: readiness.state,
            reason: boundedChildContextText(readiness.reason),
            relatedTaskIds: readiness.related_ids.slice(0, MAX_LIVE_CHILD_CONTEXT),
          },
        }
      : {}),
    ...(attempt
      ? {
          latestAttempt: {
            handler: attempt.handler,
            ...(attempt.failureReason ? { failureReason: attempt.failureReason } : {}),
          },
        }
      : {}),
    hasLiveChildren: liveChildTaskIds(tree, resource.metadata.id).length > 0,
    updatedAt: resource.status.updatedAt,
    ...(resource.status.summary ? { summary: boundedChildContextText(resource.status.summary) } : {}),
    evidence: boundedChildEvidence([...(resource.status.evidence ?? [])]),
  };
}

function liveTaskSnapshotContext(
  tree: TaskTree,
  resource: AppTaskResource,
  readiness: AppTaskReadiness | undefined,
): AppTaskSnapshotContext {
  return {
    taskId: resource.metadata.id,
    parentId: resource.spec.parentId,
    generation: resource.metadata.generation,
    phase: resource.status.phase,
    outcome: boundedChildContextText(resource.spec.outcome).slice(0, MAX_SNAPSHOT_CONTEXT_TEXT),
    ...(resource.spec.owner ? { agent: resource.spec.owner } : {}),
    ...(resource.spec.executor ? { executor: resource.spec.executor } : {}),
    ...(resource.spec.priority ? { priority: resource.spec.priority } : {}),
    ...(resource.spec.category ? { category: resource.spec.category } : {}),
    ...(resource.spec.dependsOn?.length ? { dependsOn: resource.spec.dependsOn.slice(0, MAX_LIVE_CHILD_CONTEXT) } : {}),
    conditions: (resource.status.conditionIds ?? []).flatMap((conditionId) => {
      const condition = tree.conditions?.[conditionId];
      if (!condition) return [];
      return [
        {
          id: condition.metadata.id,
          type: condition.spec.type,
          subject: condition.spec.subject,
          ...(condition.spec.requestedAction ? { requestedAction: condition.spec.requestedAction } : {}),
          ...(condition.spec.owner ? { owner: condition.spec.owner } : {}),
          ...(condition.spec.reviewAfterMs === undefined ? {} : { reviewAfterMs: condition.spec.reviewAfterMs }),
        },
      ];
    }),
    ...(readiness
      ? {
          readiness: {
            state: readiness.state,
            reason: boundedChildContextText(readiness.reason).slice(0, MAX_SNAPSHOT_CONTEXT_TEXT),
            relatedTaskIds: readiness.related_ids.slice(0, MAX_SNAPSHOT_RELATED_TASK_IDS),
          },
        }
      : {}),
    hasLiveChildren: liveChildTaskIds(tree, resource.metadata.id).length > 0,
    updatedAt: resource.status.updatedAt,
  };
}

/** Bounded current child state supplied to an executable parent reconciliation. */
export function readAppTaskChildContext(config: AppTaskContext, taskId: string): AppTaskChildContext {
  const runningIds = config.resourceStore.listTaskIdsByPhase(["running"], appTaskConcurrencyLimit(config));
  const tree = config.resourceStore.readTaskContext(
    { taskIds: new Set([taskId, ...runningIds]) },
    { childLimit: MAX_LIVE_CHILD_CONTEXT },
  );
  const readinessById = appTaskReadinessById(tree, config.maxConcurrent);
  const live = Object.values(tree.resources ?? {})
    .filter((resource) => resource.spec.parentId === taskId && !tree.cancellations?.[resource.metadata.id])
    .sort((left, right) => left.metadata.id.localeCompare(right.metadata.id))
    .slice(0, MAX_LIVE_CHILD_CONTEXT)
    .map((resource) => liveTaskContext(tree, resource, readinessById[resource.metadata.id]));
  const completed = Object.values(tree.receipts ?? {})
    .filter((receipt) => receipt.parentId === taskId)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, MAX_COMPLETED_CHILD_CONTEXT)
    .map((receipt) => ({
      taskId: receipt.metadata.id,
      parentId: receipt.parentId,
      generation: receipt.metadata.generation,
      outcome: boundedChildContextText(receipt.outcome),
      agent: receipt.owner,
      ...(receipt.workflow ? { workflow: receipt.workflow } : {}),
      ...(receipt.executor ? { executor: receipt.executor } : {}),
      input: structuredClone(receipt.input ?? {}),
      ...(receipt.priority ? { priority: receipt.priority } : {}),
      conditions: [],
      hasLiveChildren: false as const,
      summary: boundedChildContextText(receipt.summary),
      evidence: boundedChildEvidence([...receipt.evidence]),
      completedAt: receipt.completedAt,
    }));
  const cancelled = config.resourceStore.readCancelledChildren(taskId, MAX_COMPLETED_CHILD_CONTEXT).map((child) => ({
    kind: child.kind ?? "cancelled",
    taskId: child.taskId,
    parentId: taskId,
    generation: child.generation,
    outcome: boundedChildContextText(child.outcome),
    summary: boundedChildContextText(child.summary),
    evidence: boundedChildEvidence(child.evidence ?? []),
    cancelledAt: child.cancelledAt,
  }));
  return { live, completed, ...(cancelled.length ? { cancelled } : {}) };
}

export type AppTaskLiveSnapshot = {
  live: AppTaskSnapshotContext[];
  truncated: boolean;
};

/** Bounded App-wide live-task facts, excluding the task performing the review. */
export function readAppTaskLiveSnapshot(config: AppTaskContext, currentTaskId: string): AppTaskLiveSnapshot {
  const indexedIds = config.resourceStore.listLiveTaskIds(currentTaskId, MAX_APP_TASK_LIVE_SNAPSHOT + 1);
  const indexedIdSet = new Set(indexedIds);
  const runningIds = config.resourceStore.listTaskIdsByPhase(["running"], appTaskConcurrencyLimit(config));
  const contextIds = [...new Set([...indexedIds, ...runningIds])];
  const tree = config.resourceStore.readTaskContext({ taskIds: contextIds }, { includeHistory: false, childLimit: 1 });
  const readinessById = appTaskReadinessById(tree, config.maxConcurrent);
  const candidates = Object.values(tree.resources ?? {})
    .filter((resource) => indexedIdSet.has(resource.metadata.id) && resource.status.phase !== "converged")
    .sort((left, right) => left.metadata.id.localeCompare(right.metadata.id));
  return {
    live: candidates
      .slice(0, MAX_APP_TASK_LIVE_SNAPSHOT)
      .map((resource) => liveTaskSnapshotContext(tree, resource, readinessById[resource.metadata.id])),
    truncated: indexedIds.length > MAX_APP_TASK_LIVE_SNAPSHOT,
  };
}

export function readAppTaskTrigger(config: AppTaskContext, taskId: string): Record<string, unknown> | undefined {
  const pending = config.resourceStore.readTrigger(taskId);
  if (pending) return structuredClone(pending.event);
  const attemptId = config.resourceStore.readTask(taskId)?.status.currentAttemptId;
  const current = attemptId ? config.resourceStore.readAttempt(attemptId) : null;
  const attempt = current?.state === "running" ? current : null;
  const trigger = attempt ? attemptTrigger(attempt) : undefined;
  return trigger ? structuredClone(trigger) : undefined;
}

/** Return only a wake that is still pending beyond the active attempt. */
export function readPendingAppTaskTrigger(config: AppTaskContext, taskId: string): Record<string, unknown> | undefined {
  const event = config.resourceStore.readTrigger(taskId)?.event;
  return event ? structuredClone(event) : undefined;
}

function nextTaskConditionReviewAt(tree: TaskTree, taskId: string): number | null {
  return (
    taskConditionEntries(tree, taskId)
      .flatMap(([, condition]) => {
        if (!isOpenCondition(condition)) return [];
        const reviewAfterMs = Number(condition.spec.reviewAfterMs);
        const observedAt = Date.parse(String(condition.status.observedAt ?? ""));
        return Number.isInteger(reviewAfterMs) &&
          reviewAfterMs >= MIN_APP_TASK_CONDITION_REVIEW_AFTER_MS &&
          Number.isFinite(observedAt)
          ? [observedAt + reviewAfterMs]
          : [];
      })
      .sort((left, right) => left - right)[0] ?? null
  );
}

function resourceWrite(tree: TaskTree, resource: AppTaskResource, ready = false) {
  const nextCheckAt = nextTaskConditionReviewAt(tree, resource.metadata.id);
  return {
    resource,
    ...(tree.taskTriggers?.[resource.metadata.id] ? { trigger: tree.taskTriggers[resource.metadata.id] } : {}),
    ready,
    nextCheckAt,
  };
}

/** Persist a wake observation for an existing task without resubmitting desired state. */
export function recordAppTaskTrigger(
  config: AppTaskContext,
  taskId: string,
  event: Record<string, unknown>,
): { kind: "recorded" | "missing" | "closed" } {
  // A wake updates one existing Task. Its children and attempt history do
  // not participate in trigger selection, so keep this interface-path read
  // proportional to the exact Task rather than its whole subtree.
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] }, { includeHistory: false, childLimit: 0 });
  const resource = tree.resources?.[taskId];
  if (!resource) return { kind: "missing" };
  if (config.resourceStore.isCancelled(taskId)) return { kind: "closed" };
  const previous = tree.taskTriggers?.[taskId];
  const resourceVersion = resource.metadata.resourceVersion;
  // Input shares the Task row; invalidate writers that read before this wake.
  resource.metadata.resourceVersion += 1;
  const observedAt = new Date().toISOString();
  const events = appendTaskTriggerEvent(previous ? taskTriggerEvents(previous) : [], event, observedAt);
  if (previous && events === previous.events) return { kind: "recorded" };
  const next = preferredTriggerFromEvents(events, resolvedAgent(tree, resourceIntent(resource), config.agent));
  tree.taskTriggers = {
    ...(tree.taskTriggers ?? {}),
    [taskId]: {
      taskId,
      taskGeneration: resource.metadata.generation,
      resourceVersion: (previous?.resourceVersion ?? 0) + 1,
      events,
      event: structuredClone(next),
      observedAt,
    },
  };
  commitTaskMutation(config, tree, {
    resourceMutation: {
      fences: [
        {
          taskId,
          resourceVersion,
          generation: resource.metadata.generation,
          currentAttemptId: resource.status.currentAttemptId ?? null,
        },
      ],
      tasks: [resourceWrite(tree, resource, true)],
    },
  });
  return { kind: "recorded" };
}

function dependenciesSatisfied(tree: TaskTree, intent: AppTaskIntent): boolean {
  return [...(intent.dependsOn ?? [])].every((id) => {
    const dependency = tree.resources?.[id];
    return Boolean(
      dependency?.status.phase === "converged" &&
      dependency.status.observedGeneration === dependency.metadata.generation,
    );
  });
}

function isRunnableOnPassiveResync(tree: TaskTree, resource: AppTaskResource): boolean {
  if (tree.cancellations?.[resource.metadata.id]) return false;
  if (pendingTaskExecutionRetryAt(resource)) return false;
  const taskId = resource.metadata.id;
  const intent = resourceIntent(resource);
  if (!dependenciesSatisfied(tree, intent)) return false;
  if (currentResourceAttempt(tree, resource)) return false;
  const pendingTrigger = tree.taskTriggers?.[taskId]?.event;
  if (pendingTrigger) return true;
  if (resource.metadata.generation > resource.status.observedGeneration) return true;
  if (resource.status.phase === "pending") return true;
  if (resource.status.phase === "waiting") {
    if (hasSatisfiedTaskCondition(tree, taskId)) return true;
    if (missedTaskConditionCheckpointIds(tree, taskId).length > 0) return true;
    return !(resource.status.conditionIds?.length ?? 0);
  }
  if (resource.status.phase === "attention") return needsAgentHandoff(tree, resource);
  if (resource.status.phase === "running") return true;
  return false;
}

function acknowledgeIndexedRecoveryWait(
  config: AppTaskContext,
  taskId: string,
  expectedRevision: number,
  nextCheckAt: number | null = null,
): void {
  // The indexed wake has been consumed and the Task is durably blocked. Its
  // dependency or Condition transition will record the next exact
  // wake. Clear consumed signals, but preserve a Condition's future review.
  // Another writer may have changed a trigger, dependency, or Condition since
  // our read. Reuse the store revision so its newer wake remains recoverable.
  config.resourceStore.setRecoveryState(taskId, {
    ready: false,
    changed: false,
    nextCheckAt,
    expectedRevision,
  });
}

function triggerHasDirectProjectComment(event: Record<string, unknown> | undefined): boolean {
  return event?.type === "project.comment.created" || event?.type === "message.created";
}

function taskTriggerLane(event: Record<string, unknown> | undefined): "human" | "normal" {
  if (!event) return "normal";
  const request = isRecord(event.data) && isRecord(event.data.request) ? event.data.request : undefined;
  const requestSource = request && isRecord(request.source) ? request.source : undefined;
  return event.source === "human" || requestSource?.kind === "human" ? "human" : "normal";
}

function hasSatisfiedConditionReconciliation(tree: TaskTree, resource: AppTaskResource): boolean {
  return resource.status.phase === "waiting" && hasSatisfiedTaskCondition(tree, resource.metadata.id);
}

export type AppTaskQueueEntry = {
  taskId: string;
  options: {
    priority: "P0" | "P1" | "P2" | "P3";
    lane: "human" | "normal";
  };
};

const appTaskPriorityOrder = ["P0", "P1", "P2", "P3"] as const;
const appTaskPriorityAgingIntervalMs = 5 * 60 * 1_000;

function effectiveAppTaskPriority(
  resource: AppTaskResource,
  nowMs: number,
  readyAt = resource.status.updatedAt,
): (typeof appTaskPriorityOrder)[number] {
  const declaredPriority = resource.spec.priority ?? "P2";
  const declaredRank = appTaskPriorityOrder.indexOf(declaredPriority);
  const readyAtMs = Date.parse(readyAt ?? "");
  if (!Number.isFinite(readyAtMs)) return declaredPriority;
  const ageMs = Math.max(0, nowMs - readyAtMs);
  const highestAgedRank = declaredRank === 0 ? 0 : 1;
  const promotedRank = Math.max(highestAgedRank, declaredRank - Math.floor(ageMs / appTaskPriorityAgingIntervalMs));
  return appTaskPriorityOrder[promotedRank] ?? declaredPriority;
}

export function listRunnableAppTaskQueueEntries(config: AppTaskContext): AppTaskQueueEntry[] {
  const candidates = config.resourceStore.listRecoveryCandidates(Date.now(), 10_000).items;
  const candidateIds = [...new Set(candidates.map((candidate) => candidate.taskId))];
  const tree = config.resourceStore.readTaskContext({ taskIds: candidateIds });
  const nowMs = Date.now();
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
  const hasDirectProjectComment = (resource: AppTaskResource): boolean =>
    triggerHasDirectProjectComment(tree.taskTriggers?.[resource.metadata.id]?.event);
  const hasPersistedTrigger = (resource: AppTaskResource): boolean =>
    Boolean(tree.taskTriggers?.[resource.metadata.id]?.event);
  const effectivePriority = (resource: AppTaskResource) =>
    hasDirectProjectComment(resource) || hasSatisfiedConditionReconciliation(tree, resource)
      ? "P0"
      : effectiveAppTaskPriority(resource, nowMs, tree.taskTriggers?.[resource.metadata.id]?.observedAt);
  const recoveryOrder = new Map(candidateIds.map((taskId, index) => [taskId, index]));
  return candidateIds
    .flatMap((taskId) => (tree.resources?.[taskId] ? [tree.resources[taskId]] : []))
    .filter((resource) => isRunnableOnPassiveResync(tree, resource))
    .sort((left, right) => {
      const laneOrder =
        Number((right.status.lane ?? taskTriggerLane(tree.taskTriggers?.[right.metadata.id]?.event)) === "human") -
        Number((left.status.lane ?? taskTriggerLane(tree.taskTriggers?.[left.metadata.id]?.event)) === "human");
      const triggerOrder = Number(hasPersistedTrigger(right)) - Number(hasPersistedTrigger(left));
      const leftPriority = priorityOrder[effectivePriority(left)];
      const rightPriority = priorityOrder[effectivePriority(right)];
      return (
        laneOrder ||
        leftPriority - rightPriority ||
        triggerOrder ||
        (recoveryOrder.get(left.metadata.id) ?? Number.MAX_SAFE_INTEGER) -
          (recoveryOrder.get(right.metadata.id) ?? Number.MAX_SAFE_INTEGER) ||
        left.metadata.id.localeCompare(right.metadata.id)
      );
    })
    .map((resource) => ({
      taskId: resource.metadata.id,
      options: {
        priority: effectivePriority(resource),
        lane: resource.status.lane ?? taskTriggerLane(tree.taskTriggers?.[resource.metadata.id]?.event),
      },
    }));
}

export function listRunnableAppTaskIds(config: AppTaskContext): string[] {
  return listRunnableAppTaskQueueEntries(config).map((entry) => entry.taskId);
}

export function appTaskQueueEntries(config: AppTaskContext, taskIds: Iterable<string>): AppTaskQueueEntry[] {
  const requested = new Set(taskIds);
  if (requested.size === 0) return [];
  const tree = config.resourceStore.readTaskContext({ taskIds: requested });
  const nowMs = Date.now();
  return [...requested].flatMap((taskId) => {
    const resource = tree.resources?.[taskId];
    if (!resource) return [];
    const trigger = tree.taskTriggers?.[taskId];
    return [
      {
        taskId,
        options: {
          priority:
            triggerHasDirectProjectComment(trigger?.event) || hasSatisfiedConditionReconciliation(tree, resource)
              ? "P0"
              : effectiveAppTaskPriority(resource, nowMs, trigger?.observedAt),
          lane: resource.status.lane ?? taskTriggerLane(trigger?.event),
        },
      },
    ];
  });
}

export type AppTaskRetryReceipt = {
  receiptId: string;
  action: "app.task.retry";
  disposition: "requeued";
  appId: string;
  taskId: string;
  generation: number;
  previousResourceVersion: number;
  resourceVersion: number;
  previousAttemptId: string;
  acceptedAt: string;
};

/**
 * Requeue one exact failed Task generation after an operator has reviewed its
 * retained input. The failed attempt remains immutable operational evidence;
 * its input batch is copied back to the pending trigger without replacing any
 * newer evidence.
 */
export function retryFailedAppTask(
  config: AppTaskContext,
  input: {
    appId: string;
    taskId: string;
    expectedGeneration: number;
    expectedResourceVersion: number;
    controlKey?: string;
  },
): AppTaskRetryReceipt {
  if (config.resourceStore.isCancelled(input.taskId)) {
    throw new Error(`Cannot retry cancelled task ${input.appId}/${input.taskId}; create a new linked task`);
  }
  const priorControl = input.controlKey ? config.resourceStore.readControlReceipt(input.controlKey) : null;
  if (priorControl) {
    if (
      priorControl.action !== "retry" ||
      priorControl.appId !== input.appId ||
      priorControl.taskId !== input.taskId ||
      priorControl.expectedGeneration !== input.expectedGeneration ||
      priorControl.expectedResourceVersion !== input.expectedResourceVersion
    ) {
      throw new Error(`Task control key ${input.controlKey} was already used for a different operation`);
    }
    if (!priorControl.result || typeof priorControl.result !== "object" || Array.isArray(priorControl.result)) {
      throw new Error(`Task retry control receipt ${input.controlKey} has no valid result`);
    }
    return priorControl.result as AppTaskRetryReceipt;
  }
  const tree = config.resourceStore.readTaskContext({ taskIds: [input.taskId] });
  const resource = tree.resources?.[input.taskId];
  if (!resource) throw new Error(`Task ${input.appId}/${input.taskId} was not found`);
  if (resource.metadata.generation !== input.expectedGeneration) {
    throw new Error(
      `Task ${input.appId}/${input.taskId} generation changed: expected ${input.expectedGeneration}, current ${resource.metadata.generation}`,
    );
  }
  if (resource.metadata.resourceVersion !== input.expectedResourceVersion) {
    throw new Error(
      `Task ${input.appId}/${input.taskId} resource version changed: expected ${input.expectedResourceVersion}, current ${resource.metadata.resourceVersion}`,
    );
  }
  const cooling = resource.status.phase === "pending" && resource.status.executionRetryAt !== undefined;
  if (resource.status.phase !== "attention" && !cooling) {
    throw new Error(
      `Task ${input.appId}/${input.taskId} is not eligible for retry: phase is ${resource.status.phase}, expected a failed attempt awaiting retry`,
    );
  }
  const attempt = latestTaskAttempt(tree, input.taskId, input.expectedGeneration);
  const unsuccessful = attempt?.state === "failed" ||
    (attempt?.state === "completed" && attempt.acceptedResult?.state === "stopped");
  if (!attempt || !unsuccessful || resource.status.currentAttemptId) {
    throw new Error(
      `Task ${input.appId}/${input.taskId} is not eligible for retry: its current generation has no completed failed attempt`,
    );
  }

  const previousResourceVersion = resource.metadata.resourceVersion;
  const acceptedAt = new Date().toISOString();
  const mutationScope = beginResourceMutationScopeForTasks(tree, [input.taskId]);
  restoreAttemptEvents(tree, input.taskId, resource, attempt, acceptedAt);
  touchResource(resource, {
    phase: "pending",
    executionFailures: undefined,
    executionRetryAt: undefined,
    observedGeneration: Math.max(0, resource.metadata.generation - 1),
    currentAttemptId: undefined,
  });
  const receipt: AppTaskRetryReceipt = {
    receiptId: randomUUID(),
    action: "app.task.retry",
    disposition: "requeued",
    appId: input.appId,
    taskId: input.taskId,
    generation: input.expectedGeneration,
    previousResourceVersion,
    resourceVersion: resource.metadata.resourceVersion,
    previousAttemptId: attempt.metadata.id,
    acceptedAt,
  };
  commitTaskMutation(config, tree, {
    resourceMutation: {
      ...finishResourceMutationScope(mutationScope, tree),
      ...(input.controlKey
        ? {
            controlReceipts: [
              {
                controlKey: input.controlKey,
                appId: input.appId,
                taskId: input.taskId,
                action: "retry" as const,
                expectedGeneration: input.expectedGeneration,
                expectedResourceVersion: input.expectedResourceVersion,
                appliedResourceVersion: resource.metadata.resourceVersion,
                appliedAt: Date.parse(acceptedAt),
                result: receipt,
              },
            ],
          }
        : {}),
    },
  });
  return receipt;
}

export type AppTaskCancellationResult = {
  cancellation: AppTaskCancellation;
  cancelledAttemptId?: string;
  applied: boolean;
};

type AppTaskCloseInput = {
  appId: string;
  taskId: string;
  expectedGeneration: number;
  expectedResourceVersion: number;
  reason: string;
};

/** Explicit owner control. A conventional close must still match the consumed result. */
export function closeAppTask(
  config: AppTaskContext,
  input: AppTaskCloseInput & { afterResult?: string },
): { closure: AppTaskCancellation; interruptedAttemptId?: string; applied: boolean } {
  const closed = closeTask(config, input, "closed");
  return {
    closure: closed.cancellation,
    ...(closed.cancelledAttemptId ? { interruptedAttemptId: closed.cancelledAttemptId } : {}),
    applied: closed.applied,
  };
}

/** Cancel one exact Task through the same fenced resource authority used by reconciliation. */
export function cancelAppTask(
  config: AppTaskContext,
  input: AppTaskCloseInput & { controlKey?: string },
): AppTaskCancellationResult {
  return closeTask(config, input, "cancelled");
}

function closeTask(
  config: AppTaskContext,
  input: AppTaskCloseInput & { controlKey?: string; afterResult?: string },
  kind: "closed" | "cancelled",
): AppTaskCancellationResult {
  if (input.appId !== config.resourceStore.appId) {
    throw new Error(`Task cancellation belongs to another App: ${input.appId}`);
  }
  const priorControl = input.controlKey ? config.resourceStore.readControlReceipt(input.controlKey) : null;
  if (priorControl) {
    if (
      priorControl.action !== "cancel" ||
      priorControl.appId !== input.appId ||
      priorControl.taskId !== input.taskId ||
      priorControl.expectedGeneration !== input.expectedGeneration ||
      priorControl.expectedResourceVersion !== input.expectedResourceVersion
    ) {
      throw new Error(`Task control key ${input.controlKey} was already used for a different operation`);
    }
    const cancellation = config.resourceStore.readCancellation(input.taskId);
    if (!cancellation) throw new Error(`Task cancellation receipt ${input.controlKey} has no terminal evidence`);
    return { cancellation, applied: false };
  }

  const existingCancellation = config.resourceStore.readCancellation(input.taskId);
  if (existingCancellation) {
    if (
      existingCancellation.generation !== input.expectedGeneration ||
      existingCancellation.resourceVersion !== input.expectedResourceVersion + 1
    ) {
      throw new Error(`Task ${input.appId}/${input.taskId} was already cancelled at another version`);
    }
    if (input.afterResult && existingCancellation.acceptedResultAttemptId !== input.afterResult) {
      throw new Error("The Task was closed against a different accepted result");
    }
    return { cancellation: existingCancellation, applied: false };
  }

  const tree = config.resourceStore.readTaskContext({ taskIds: [input.taskId] });
  const resource = tree.resources?.[input.taskId];
  if (!resource) throw new Error(`Task ${input.appId}/${input.taskId} was not found`);
  if (resource.metadata.generation !== input.expectedGeneration) {
    throw new Error(
      `Task ${input.appId}/${input.taskId} generation changed: expected ${input.expectedGeneration}, current ${resource.metadata.generation}`,
    );
  }
  if (resource.metadata.resourceVersion !== input.expectedResourceVersion) {
    throw new Error(
      `Task ${input.appId}/${input.taskId} resource version changed: expected ${input.expectedResourceVersion}, current ${resource.metadata.resourceVersion}`,
    );
  }
  if (input.afterResult) {
    const accepted = config.resourceStore.readAttempt(input.afterResult);
    if (
      accepted?.taskId !== input.taskId ||
      accepted.taskGeneration !== input.expectedGeneration ||
      !["converged", "stopped"].includes(accepted.acceptedResult?.state ?? "") ||
      resource.status.observedAttemptId !== input.afterResult ||
      resource.status.currentAttemptId ||
      tree.taskTriggers?.[input.taskId]?.event
    ) {
      throw new Error("Cannot close after a result while newer or unresolved work remains");
    }
  }

  const reason = input.reason.trim() || (kind === "closed" ? "owner ended the Task" : "human requested cancellation");
  return commitTaskCancellation(config, tree, {
    ...input,
    kind,
    reason,
    summary: kind === "closed" ? `Closed by App policy: ${reason}` : `Cancelled by human: ${reason}`,
    decidedBy: kind === "closed" ? { kind: "app-policy" } : { kind: "human" },
  });
}

/** Retain an honest failure report and the unfinished assignment for a later attempt. */
export function stopAppTask(
  config: AppTaskContext,
  claim: AppTaskClaim,
  input: {
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence: string[];
    acceptedLiveEventIds?: number[];
  },
): { status: "applied" | "stale"; summary?: string } {
  const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
  const match = matchingTaskAttempt(tree, claim);
  if (!match) return { status: "stale" };
  if (hasUnacceptedLiveTaskEvents(tree, claim.taskId, input.acceptedLiveEventIds)) {
    throw new AppTaskActionStaleError({
      taskId: claim.taskId,
      expectedGeneration: claim.generation,
      currentGeneration: match.resource.metadata.generation,
      reason: "newer Task evidence is pending",
    });
  }
  requireNonEmptyString(input.summary, "Stop decision summary");
  requireStringList(input.evidence, "Stop decision evidence");
  const summary = `Outcome not achieved: ${input.summary.trim()}; continuing after backoff`;
  const { resource, attempt } = match;
  const mutationScope = beginResourceMutationScope(tree, claim, []);
  const now = new Date().toISOString();
  attempt.acceptedResult = acceptedAttemptResult(tree, claim.taskId, "stopped", input, defaultTaskAcceptance(claim, input.evidence));
  const admissions = acceptedInputAdmissions(config, tree, claim, input.acceptedLiveEventIds, "report");
  const failures = (resource.status.executionFailures ?? 0) + 1;
  // Accepted evidence is not a final answer to the original assignment.
  // Preserve input, including accepted live feedback and earlier linked waits.
  restoreAttemptEvents(tree, claim.taskId, resource, attempt, now);
  finishAttempt(tree, resource, "completed", summary, now);
  touchResource(resource, {
    phase: "pending",
    executionFailures: failures,
    executionRetryAt: resource.status.freshHumanInput ? undefined : Date.parse(now) + taskExecutionRetryDelay(failures),
    observedGeneration: claim.generation,
    observedAttemptId: claim.attemptId,
    currentAttemptId: undefined,
    summary,
    response: input.response,
    result: input.result ? structuredClone(input.result) : undefined,
    evidence: [...input.evidence],
  });
  commitTaskMutation(config, tree, { resourceMutation: { ...finishResourceMutationScope(mutationScope, tree), admissions } });
  return { status: "applied", summary };
}

/** Explicit owner closure and human cancellation share one atomic terminal boundary. */
function commitTaskCancellation(
  config: AppTaskContext,
  tree: TaskTree,
  input: {
    appId: string;
    taskId: string;
    expectedGeneration: number;
    expectedResourceVersion: number;
    reason: string;
    summary: string;
    decidedBy: NonNullable<AppTaskCancellation["decidedBy"]>;
    response?: string;
    result?: Record<string, unknown>;
    evidence?: string[];
    controlKey?: string;
    kind?: "closed" | "cancelled";
    afterResult?: string;
  },
): AppTaskCancellationResult {
  const resource = tree.resources![input.taskId]!;
  const { reason, summary } = input;
  const cancelledAt = new Date().toISOString();
  const mutationScope = beginResourceMutationScopeForTasks(tree, [input.taskId]);
  const cancelledAttemptId = resource.status.currentAttemptId;
  const attempt = cancelledAttemptId ? tree.attempts?.[cancelledAttemptId] : undefined;
  if (attempt) {
    finishAttempt(tree, resource, "interrupted", summary, cancelledAt);
    attempt.reason = summary;
    attempt.lease = undefined;
  }
  if (tree.taskTriggers) delete tree.taskTriggers[input.taskId];
  const conditionIds = [...(resource.status.conditionIds ?? [])];
  touchResource(resource, {
    // Ending responsibility does not turn an accepted answer into a failure.
    phase: input.kind === "closed" && resource.status.phase === "converged" ? "converged" : "attention",
    observedGeneration: resource.metadata.generation,
    currentAttemptId: undefined,
    ...(input.kind === "closed" ? {} : {
      summary,
      response: input.response ?? summary,
      result: input.result ? structuredClone(input.result) : undefined,
    }),
    evidence: [...(input.evidence ?? resource.status.evidence ?? [])],
    conditionIds: [],
  });
  resource.status.updatedAt = cancelledAt;
  const cancellation: AppTaskCancellation = {
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.afterResult ? { acceptedResultAttemptId: input.afterResult } : {}),
    appId: input.appId,
    taskId: input.taskId,
    generation: resource.metadata.generation,
    resourceVersion: resource.metadata.resourceVersion,
    outcome: resource.spec.outcome,
    reason,
    summary,
    cancelledAt,
    decidedBy: input.decidedBy,
    response: resource.status.response,
    result: resource.status.result,
    evidence: resource.status.evidence,
  };
  commitTaskMutation(config, tree, {
    resourceMutation: {
      ...finishResourceMutationScope(mutationScope, tree),
      cancellations: [cancellation],
      pruneConditionIds: conditionIds,
      ...(input.controlKey
        ? {
            controlReceipts: [
              {
                controlKey: input.controlKey,
                appId: input.appId,
                taskId: input.taskId,
                action: "cancel" as const,
                expectedGeneration: input.expectedGeneration,
                expectedResourceVersion: input.expectedResourceVersion,
                appliedResourceVersion: resource.metadata.resourceVersion,
                appliedAt: Date.parse(cancelledAt),
              },
            ],
          }
        : {}),
    },
  });
  return {
    cancellation,
    ...(cancelledAttemptId ? { cancelledAttemptId } : {}),
    applied: true,
  };
}

export function claimObservedAppTask(
  config: AppTaskContext,
  input: {
    taskId: string;
    appAgent: string;
    handler: string;
    reason?: string;
    isAgentRunnable?: (agent: string) => boolean;
    recoverSessionHandoff?: (attempt: AppTaskAttempt | undefined) => AppTaskClaim["handoff"];
  },
): AppTaskClaimResult {
  const snapshotRevision = config.resourceStore.revision();
  const tree = config.resourceStore.readTaskContext({ taskIds: [input.taskId] });
  const resource = tree.resources?.[input.taskId];
  if (config.resourceStore.isCancelled(input.taskId)) {
    return {
      kind: "completed",
      taskId: input.taskId,
      generation: resource?.metadata.generation ?? 0,
    };
  }
  if (!resource) {
    return {
      kind: "completed",
      taskId: input.taskId,
      generation: 0,
    };
  }
  if (!config.resourceStore.allowsTaskExecution(input.taskId)) {
    return { kind: "waiting", taskId: input.taskId, conditionIds: [] };
  }
  const retryAt = pendingTaskExecutionRetryAt(resource);
  if (retryAt !== undefined) {
    acknowledgeIndexedRecoveryWait(config, input.taskId, snapshotRevision, retryAt);
    return { kind: "waiting", taskId: input.taskId, conditionIds: [], retryAt };
  }
  const resourceFence = {
    taskId: resource.metadata.id,
    resourceVersion: resource.metadata.resourceVersion,
    generation: resource.metadata.generation,
    currentAttemptId: resource.status.currentAttemptId ?? null,
  };
  const mutationScope = beginResourceMutationScopeForTasks(tree, [resource.metadata.id]);
  const initialConditionIds = new Set(resource.status.conditionIds ?? []);
  const changedAttempts = new Set<AppTaskAttempt>();
  const intent = resourceIntent(resource);
  const agent = resolvedAgent(tree, intent, input.appAgent);
  let declaredOutputPaths: string[] = [];
  let outputAdmissionError: string | undefined;
  try {
    declaredOutputPaths = resolveAppTaskOutputPaths(intent.outputs ?? [], config);
  } catch (error) {
    outputAdmissionError = `Task output admission failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  const admissionError =
    outputAdmissionError ??
    (input.isAgentRunnable && !input.isAgentRunnable(agent)
      ? `Resolved agent ${agent} is not a runnable agent`
      : undefined);
  if (admissionError) {
    const summary = admissionError;
    if (resource.status.currentAttemptId) {
      finishAttempt(tree, resource, "interrupted", summary, new Date().toISOString());
    }
    // Capability/admission failure does not withdraw the assignment. Recheck
    // current state after backoff; an owner revision may repair it sooner.
    const failures = (resource.status.executionFailures ?? 0) + 1;
    touchResource(resource, {
      phase: "pending",
      executionFailures: failures,
      executionRetryAt: Date.now() + taskExecutionRetryDelay(failures),
      freshHumanInput: undefined,
      observedGeneration: resource.metadata.generation,
      currentAttemptId: undefined,
      summary,
    });
    commitTaskMutation(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
    return {
      kind: "attention",
      taskId: input.taskId,
      generation: resource.metadata.generation,
      summary,
    };
  }
  const handler =
    input.handler === "auto"
      ? needsAgentHandoff(tree, resource)
        ? managedAgentHandler(agent)
        : intent.workflow?.trim()
          ? `workflow:${intent.workflow.trim()}`
          : intent.executor && intent.executor !== "agent"
            ? `executor:${intent.executor}`
            : managedAgentHandler(agent)
      : input.handler === "agent" || input.handler === "owner"
        ? managedAgentHandler(agent)
        : input.handler;
  const agentHandoff = needsAgentHandoff(tree, resource) && isManagedAgentHandler(handler, agent);
  const latestAttempt = latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation);
  const priorEvidence = latestAttempt ?? latestTaskAttempt(tree, resource.metadata.id);
  const handoffAttempt = agentHandoff ? latestAttempt : undefined;
  const recoveredSessionHandoff = !agentHandoff ? input.recoverSessionHandoff?.(latestAttempt) : undefined;
  const previousAttempt = currentResourceAttempt(tree, resource);
  if (resource.status.phase === "running" && !previousAttempt) {
    const now = new Date().toISOString();
    const attemptId = resource.status.currentAttemptId;
    const summary = attemptId
      ? `Running reconciliation ${input.taskId} referenced missing or non-running attempt ${attemptId}; retrying from current task evidence`
      : `Running reconciliation ${input.taskId} had no current attempt; retrying from current task evidence`;
    const staleAttempt = attemptId ? tree.attempts?.[attemptId] : undefined;
    if (staleAttempt) {
      staleAttempt.metadata.resourceVersion += 1;
      staleAttempt.failureReason = "running-without-current-attempt-requeued";
      staleAttempt.summary = summary;
      staleAttempt.finishedAt ??= now;
      changedAttempts.add(staleAttempt);
    }
    touchResource(resource, {
      phase: "pending",
      currentAttemptId: undefined,
      summary,
    });
  }
  const canRecoverPreviousRuntime = Boolean(
    previousAttempt &&
    previousAttempt.runtimeId !== reconcilerRuntimeId &&
    (input.reason === `attempt-recovery:${input.taskId}` || attemptTrigger(previousAttempt)),
  );
  const supersededSessionIds = new Set<string>();
  const pendingTrigger = tree.taskTriggers?.[input.taskId];
  const previousUnacceptedEvents =
    previousAttempt && previousAttempt.state !== "completed" && previousAttempt.failureReason !== "owner-stopped"
      ? previousAttempt.events?.length
        ? previousAttempt.events
        : previousAttempt.trigger
          ? [{ event: previousAttempt.trigger, observedAt: previousAttempt.startedAt }]
          : []
      : [];
  let pendingEvents = [...previousUnacceptedEvents];
  for (const entry of pendingTrigger ? taskTriggerEvents(pendingTrigger) : []) {
    pendingEvents = appendTaskTriggerEvent(pendingEvents, entry.event, entry.observedAt);
  }
  // Include admitted human input before a system backlog fills the bounded batch.
  // Keep admission order among selected events, including retained failure input.
  const selected = new Set(
    [...pendingEvents]
      .sort(
        (left, right) =>
          Number(taskTriggerLane(left.event) !== "human") - Number(taskTriggerLane(right.event) !== "human"),
      )
      .slice(0, MAX_TASK_EVENTS_PER_ATTEMPT),
  );
  const claimedEvents = pendingEvents.filter((entry) => selected.has(entry));
  const remainingEvents = pendingEvents.filter((entry) => !selected.has(entry));
  const hasTrigger = Boolean(pendingTrigger?.event ?? (previousAttempt ? attemptTrigger(previousAttempt) : undefined));
  if (canRecoverPreviousRuntime && previousAttempt && !hasTrigger) {
    const now = new Date().toISOString();
    const summary = "Previous runtime attempt had no persisted trigger; retrying from current task evidence";
    if (previousAttempt.sessionId) supersededSessionIds.add(previousAttempt.sessionId);
    finishAttempt(tree, resource, "interrupted", summary, now);
    previousAttempt.metadata.resourceVersion += 1;
    previousAttempt.failureReason = "previous-runtime-attempt-requeued";
    changedAttempts.add(previousAttempt);
    touchResource(resource, {
      phase: "pending",
      currentAttemptId: undefined,
      summary,
    });
  }
  if (resource.status.phase === "running" && previousAttempt && !canRecoverPreviousRuntime) {
    return { kind: "busy", taskId: input.taskId, attemptId: previousAttempt.metadata.id };
  }
  if (
    resource.status.phase === "converged" &&
    resource.status.observedGeneration >= resource.metadata.generation &&
    !pendingTrigger
  ) {
    return {
      kind: "completed",
      taskId: input.taskId,
      generation: resource.metadata.generation,
    };
  }
  if (
    resource.status.phase === "attention" &&
    resource.status.observedGeneration >= resource.metadata.generation &&
    !pendingTrigger &&
    !agentHandoff &&
    input.reason !== "workflow-fallback"
  ) {
    return {
      kind: "attention",
      taskId: input.taskId,
      generation: resource.metadata.generation,
      summary: resource.status.summary ?? "Task is waiting for agent/reviewer attention",
    };
  }
  const dependencyIds = [...(intent.dependsOn ?? [])].filter((id) => {
    const dependency = tree.resources?.[id];
    return !(
      dependency?.status.phase === "converged" &&
      dependency.status.observedGeneration === dependency.metadata.generation
    );
  });
  if (dependencyIds.length > 0) {
    acknowledgeIndexedRecoveryWait(config, input.taskId, snapshotRevision);
    return { kind: "waiting", taskId: input.taskId, conditionIds: [], dependencyIds };
  }

  if (resource.metadata.generation > resource.status.observedGeneration && resource.status.conditionIds?.length) {
    unlinkTaskConditions(tree, input.taskId);
  }
  const openConditionIds = openTaskConditionIds(tree, input.taskId);
  const hasSatisfiedCondition = hasSatisfiedTaskCondition(tree, input.taskId);
  const missedCheckpointConditionIds = missedTaskConditionCheckpointIds(tree, input.taskId);
  if (
    resource.status.phase === "waiting" &&
    openConditionIds.length > 0 &&
    !pendingTrigger &&
    !hasSatisfiedCondition &&
    missedCheckpointConditionIds.length === 0
  ) {
    acknowledgeIndexedRecoveryWait(
      config,
      input.taskId,
      snapshotRevision,
      nextTaskConditionReviewAt(tree, input.taskId),
    );
    return { kind: "waiting", taskId: input.taskId, conditionIds: openConditionIds };
  }

  const continuedInputKeys = continuedTaskInputKeys(tree, input.taskId, claimedEvents, [
    ...missedCheckpointConditionIds,
    ...taskConditionEntries(tree, input.taskId)
      .filter(([, condition]) => isAppTaskCondition(condition) && condition.status.state === "true").map(([id]) => id),
  ]);
  // Claiming is not acceptance. Retain satisfied waits until settlement so
  // interrupted execution can still find their original inputs and evidence.

  const generation = resource.metadata.generation;
  const attemptId = `r_${generation}_${randomUUID()}`;
  const now = new Date().toISOString();
  if (canRecoverPreviousRuntime && previousAttempt) {
    if (previousAttempt.sessionId) supersededSessionIds.add(previousAttempt.sessionId);
    finishAttempt(tree, resource, "interrupted", "Previous runtime attempt was superseded during recovery", now);
    changedAttempts.add(previousAttempt);
  }
  const trigger =
    (claimedEvents.length > 0 ? preferredTriggerFromEvents(claimedEvents, agent) : undefined) ??
    (previousAttempt ? attemptTrigger(previousAttempt) : undefined) ??
    (missedCheckpointConditionIds.length > 0
      ? {
          ...syntheticAttemptTrigger(config, input.taskId, "condition-review-checkpoint-missed"),
          type: "project.task.condition-review.missed",
          data: {
            project: projectIdFromAppDir(config.appDir) || "unknown-app",
            taskId: input.taskId,
            task_id: input.taskId,
            reason: "condition-review-checkpoint-missed",
            conditionIds: missedCheckpointConditionIds,
            synthetic: "controller-review-trigger",
          },
        }
      : syntheticAttemptTrigger(config, input.taskId, input.reason));
  const specHash = appTaskSpecHash(intent, agent);
  const attempt: AppTaskAttempt = {
    metadata: { id: attemptId, resourceVersion: 1 },
    taskId: input.taskId,
    taskGeneration: generation,
    specHash,
    owner: agent,
    handler,
    runtimeId: reconcilerRuntimeId,
    state: "running",
    reason: missedCheckpointConditionIds.length > 0 ? "condition-review-checkpoint-missed" : (input.reason ?? "event"),
    ...(claimedEvents.length > 0 ? { events: structuredClone(claimedEvents) } : {}),
    ...(remainingEvents.length > 0 ? { eventsTruncated: true } : {}),
    ...(continuedInputKeys.length ? { continuedInputKeys } : {}),
    // Event-backed attempts retain one canonical copy in `events`. Keep a
    // persisted trigger only for synthetic and legacy-compatible attempts
    // that have no durable event batch.
    ...(claimedEvents.length === 0 && trigger ? { trigger } : {}),
    startedAt: now,
  };
  // The canonical attempt, not its optional first Agent session, owns the
  // execution fence. Persist a finite lease with the claim so a task-owned
  // workflow can publish facts before it starts any child session.
  refreshAttemptLease(attempt);
  tree.attempts = { ...(tree.attempts ?? {}), [attemptId]: attempt };
  changedAttempts.add(attempt);
  if (tree.taskTriggers) {
    if (remainingEvents.length > 0 && pendingTrigger) {
      tree.taskTriggers[input.taskId] = {
        ...pendingTrigger,
        event: structuredClone(preferredTriggerFromEvents(remainingEvents, agent)),
        events: structuredClone(remainingEvents),
        observedAt: remainingEvents[remainingEvents.length - 1]!.observedAt,
      };
    } else {
      delete tree.taskTriggers[input.taskId];
    }
  }
  touchResource(resource, {
    phase: "running",
    currentAttemptId: attemptId,
    executionRetryAt: undefined,
    freshHumanInput: undefined,
  });
  const currentConditionIds = new Set(resource.status.conditionIds ?? []);
  const relevantConditionIds = new Set([...initialConditionIds, ...currentConditionIds]);
  try {
    commitTaskMutation(config, tree, {
      resourceMutation: {
        requireUnpausedTask: input.taskId,
        fences: [resourceFence],
        tasks: [resourceWrite(tree, resource, false)],
        attempts: [...changedAttempts],
        conditions: [...relevantConditionIds].flatMap((id) => (tree.conditions?.[id] ? [tree.conditions[id]] : [])),
        deleteConditionIds: [...relevantConditionIds].filter((id) => !tree.conditions?.[id]),
      },
    });
  } catch (error) {
    if (error instanceof ResourceTaskMutationStaleError && !config.resourceStore.allowsTaskExecution(input.taskId)) {
      return { kind: "waiting", taskId: input.taskId, conditionIds: [] };
    }
    throw error;
  }
  return {
    kind: "claimed",
    taskId: input.taskId,
    generation,
    resourceVersion: resource.metadata.resourceVersion,
    specHash,
    attemptId,
    agent,
    handler,
    mode: intent.mode,
    intent: structuredClone(intent),
    events: structuredClone(claimedEvents),
    eventsTruncated: remainingEvents.length > 0,
    ...(continuedInputKeys.length ? { continuedInputKeys: [...continuedInputKeys] } : {}),
    ...(priorEvidence ? { previousAttempt: previousAttemptEvidence(priorEvidence) } : {}),
    ...(trigger ? { trigger: structuredClone(trigger) } : {}),
    declaredOutputPaths,
    ...(supersededSessionIds.size > 0 ? { supersededSessionIds: [...supersededSessionIds] } : {}),
    ...((handoffAttempt && isAgentHandoffReason(handoffAttempt.failureReason)) || recoveredSessionHandoff
      ? {
          handoff:
            handoffAttempt && isAgentHandoffReason(handoffAttempt.failureReason)
              ? {
                  reason: "needs-agent",
                  summary:
                    resource.status.summary ??
                    handoffAttempt.summary ??
                    handoffAttempt.failureReason ??
                    "Workflow requested an agent handoff",
                  evidence: [...(resource.status.evidence ?? [])],
                }
              : recoveredSessionHandoff,
        }
      : {}),
  };
}

function matchingClaimAttempt(
  resource: AppTaskResource | null | undefined,
  attempt: AppTaskAttempt | null | undefined,
  claim: AppTaskClaim,
): { resource: AppTaskResource; attempt: AppTaskAttempt } | null {
  if (!resource || resource.metadata.generation !== claim.generation) return null;
  if (resource.status.currentAttemptId !== claim.attemptId) return null;
  if (
    !attempt ||
    attempt.state !== "running" ||
    attempt.taskGeneration !== claim.generation ||
    attempt.handler !== claim.handler ||
    attempt.specHash !== claim.specHash
  ) {
    return null;
  }
  return { resource, attempt };
}

function matchingTaskAttempt(
  tree: TaskTree,
  claim: AppTaskClaim,
): { resource: AppTaskResource; attempt: AppTaskAttempt } | null {
  return matchingClaimAttempt(tree.resources?.[claim.taskId], tree.attempts?.[claim.attemptId], claim);
}

/** Record an execution failure, not a stale-result rejection. Preserve all unaccepted input. */
export function failAppTaskAttempt(
  config: AppTaskContext,
  claim: AppTaskClaim,
  failure: string,
  details: { reason?: string; result?: Record<string, unknown>; evidence?: string[] } = {},
): { status: "retrying" | "handoff" | "superseded"; summary: string } {
  const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
  const match = matchingTaskAttempt(tree, claim);
  // New input may have changed the version. Fence fresh state while still
  // requiring this exact attempt and generation.
  if (!match) return { status: "superseded", summary: failure };
  const { resource, attempt } = match;
  const mutationScope = beginResourceMutationScope(tree, claim, []);
  const handoff = isAgentHandoffReason(details.reason);
  const failures = (resource.status.executionFailures ?? 0) + 1;
  const summary = failure;
  const now = new Date().toISOString();
  restoreAttemptEvents(tree, claim.taskId, resource, attempt, now);
  finishAttempt(tree, resource, "failed", failure, now);
  attempt.failureReason = details.reason ?? "HandlerExecutionFailed";
  touchResource(resource, {
    phase: handoff ? "attention" : "pending",
    ...(handoff
      ? {}
      : {
          executionFailures: failures,
          executionRetryAt: resource.status.freshHumanInput
            ? undefined
            : Date.parse(now) + taskExecutionRetryDelay(failures),
        }),
    observedGeneration: claim.generation,
    currentAttemptId: undefined,
    summary,
    ...(details.evidence ? { evidence: [...details.evidence] } : {}),
    ...(details.result ? { result: structuredClone(details.result) } : {}),
  });
  commitTaskMutation(config, tree, { resourceMutation: finishResourceMutationScope(mutationScope, tree) });
  return { status: handoff ? "handoff" : "retrying", summary };
}

export function releaseStaleAppTaskResult(
  config: AppTaskContext,
  claim: AppTaskClaim,
  summary = "Stale reconciliation result was rejected; retrying from current task evidence",
): { status: "released" | "superseded" | "missing"; taskId: string } {
  const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
  const resource = tree.resources?.[claim.taskId];
  if (!resource) return { status: "missing", taskId: claim.taskId };
  if (resource.metadata.generation !== claim.generation || resource.status.currentAttemptId !== claim.attemptId) {
    return { status: "superseded", taskId: claim.taskId };
  }
  const attempt = tree.attempts?.[claim.attemptId];
  if (!attempt || attempt.state !== "running") {
    return { status: "superseded", taskId: claim.taskId };
  }
  // The rejected claim's version predates the very update we must preserve.
  // Fence this freshly read state, still requiring the same intent/attempt.
  const resourceVersion = resource.metadata.resourceVersion;
  const now = new Date().toISOString();
  restoreAttemptEvents(tree, claim.taskId, resource, attempt, now);
  finishAttempt(tree, resource, "interrupted", summary, now);
  attempt.metadata.resourceVersion += 1;
  attempt.failureReason = "stale-reconciliation-result";
  touchResource(resource, {
    phase: "pending",
    currentAttemptId: undefined,
    // An open Condition belongs to the latest accepted result. Older
    // runtimes marked a running attempt unobserved; repair that retained
    // execution state instead of letting the retry detach accepted waits.
    ...(resource.status.conditionIds?.length ? { observedGeneration: resource.metadata.generation } : {}),
  });
  commitTaskMutation(config, tree, {
    resourceMutation: {
      fences: [
        {
          taskId: claim.taskId,
          resourceVersion,
          generation: claim.generation,
          currentAttemptId: claim.attemptId,
        },
      ],
      tasks: [resourceWrite(tree, resource, true)],
      attempts: [attempt],
      deleteConditionIds: [],
    },
  });
  return { status: "released", taskId: claim.taskId };
}

/** An assigning owner can stop this attempt's input without closing the Task. */
export function stopAppTaskAttempt(
  config: AppTaskContext,
  input: { taskId: string; attemptId: string; expectedGeneration: number; reason: string },
) {
  const tree = config.resourceStore.readTaskContext({ taskIds: [input.taskId] });
  const resource = tree.resources?.[input.taskId];
  const attempt = config.resourceStore.readAttempt(input.attemptId);
  if (!resource || !attempt || attempt.taskId !== input.taskId || attempt.taskGeneration !== input.expectedGeneration)
    throw new Error("Attempt stop is stale or mismatched");
  const inputKeys = taskInputAdmissionKeys(attempt.events ?? [], attempt.continuedInputKeys);
  if (attempt.failureReason === "owner-stopped") return { changed: false, inputKeys };
  if (
    resource.metadata.generation !== input.expectedGeneration ||
    resource.status.currentAttemptId !== input.attemptId ||
    attempt.state !== "running"
  )
    throw new Error("Attempt stop is stale or mismatched");
  const scope = beginResourceMutationScopeForTasks(tree, [input.taskId]);
  const current = tree.attempts![input.attemptId]!;
  finishAttempt(tree, resource, "interrupted", input.reason, new Date().toISOString());
  current.failureReason = "owner-stopped";
  for (const key of inputKeys) delete resource.status.inputWaits?.[key];
  if (resource.status.inputWaits && Object.keys(resource.status.inputWaits).length === 0)
    delete resource.status.inputWaits;
  touchResource(resource, {
    phase: "attention",
    observedGeneration: resource.metadata.generation,
    currentAttemptId: undefined,
    executionRetryAt: undefined,
    executionFailures: undefined,
    summary: input.reason,
  });
  commitTaskMutation(config, tree, { resourceMutation: finishResourceMutationScope(scope, tree) });
  return { changed: true, inputKeys };
}

/** Attach observed workspace lineage to the current attempt without changing desired task state. */
export function recordAppTaskAttemptWorkspace(
  config: AppTaskContext,
  claim: AppTaskClaim,
  workspace: AppTaskWorkspace,
): boolean {
  const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
  const match = matchingTaskAttempt(tree, claim);
  if (!match) return false;
  match.attempt.metadata.resourceVersion += 1;
  match.attempt.workspace = structuredClone(workspace);
  commitTaskMutation(config, tree, {
    resourceMutation: {
      fences: [
        {
          taskId: claim.taskId,
          resourceVersion: match.resource.metadata.resourceVersion,
          generation: claim.generation,
          currentAttemptId: claim.attemptId,
        },
      ],
      attempts: [match.attempt],
    },
  });
  return true;
}

function refreshAttemptLease(attempt: AppTaskAttempt, sessionId?: string, nowMs = Date.now()): void {
  const times = boundedLeaseTimes(nowMs);
  const existing = attempt.lease;
  attempt.lease = {
    id: existing?.id ?? randomUUID(),
    version: (existing?.version ?? 0) + 1,
    ...times,
    runtimeId: attempt.runtimeId,
    ...(sessionId ? { sessionId } : {}),
  };
}

/** Keep one currently executing bounded workflow attempt current without weakening its claim fence. */
export function renewAppTaskAttemptLease(config: AppTaskContext, claim: AppTaskClaim, nowMs = Date.now()): boolean {
  const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
  const match = matchingTaskAttempt(tree, claim);
  if (!match) return false;
  match.attempt.metadata.resourceVersion += 1;
  refreshAttemptLease(match.attempt, match.attempt.sessionId, nowMs);
  commitTaskMutation(config, tree, {
    resourceMutation: {
      fences: [
        {
          taskId: claim.taskId,
          resourceVersion: match.resource.metadata.resourceVersion,
          generation: claim.generation,
          currentAttemptId: claim.attemptId,
        },
      ],
      attempts: [match.attempt],
    },
  });
  return true;
}

/** Attach the launched agent-session id and refresh the current attempt lease. */
export function recordAppTaskAttemptSession(config: AppTaskContext, claim: AppTaskClaim, sessionId: string): boolean {
  const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
  const match = matchingTaskAttempt(tree, claim);
  if (!match) return false;
  if (match.attempt.sessionId === sessionId && match.attempt.lease) return true;
  match.attempt.metadata.resourceVersion += 1;
  match.attempt.sessionId = sessionId;
  refreshAttemptLease(match.attempt, sessionId);
  commitTaskMutation(config, tree, {
    resourceMutation: {
      fences: [
        {
          taskId: claim.taskId,
          resourceVersion: match.resource.metadata.resourceVersion,
          generation: claim.generation,
          currentAttemptId: claim.attemptId,
        },
      ],
      attempts: [match.attempt],
    },
  });
  return true;
}

/**
 * Associate a session launched inside a task workflow with the current
 * reconciliation attempt. The session-start notification can arrive after a
 * task revision, so stale bindings are rejected instead of reviving obsolete
 * work.
 */
export function associateAppTaskSession(
  config: AppTaskContext,
  binding: { taskId: string; generation: number },
  sessionId: string,
): AppTaskSessionAssociation {
  const tree = config.resourceStore.readTaskContext({ taskIds: [binding.taskId] });
  const resource = tree.resources?.[binding.taskId];
  if (!resource) return { status: "missing", taskId: binding.taskId };
  if (
    resource.metadata.generation !== binding.generation ||
    resource.status.phase !== "running" ||
    !resource.status.currentAttemptId
  ) {
    return { status: "superseded", taskId: binding.taskId };
  }
  const attempt = tree.attempts?.[resource.status.currentAttemptId];
  if (
    !attempt ||
    attempt.state !== "running" ||
    attempt.taskId !== binding.taskId ||
    attempt.taskGeneration !== binding.generation
  ) {
    return { status: "superseded", taskId: binding.taskId };
  }
  if (attempt.sessionId !== sessionId || !attempt.lease) {
    attempt.metadata.resourceVersion += 1;
    attempt.sessionId = sessionId;
    refreshAttemptLease(attempt, sessionId);
    commitTaskMutation(config, tree, {
      resourceMutation: {
        fences: [
          {
            taskId: binding.taskId,
            resourceVersion: resource.metadata.resourceVersion,
            generation: binding.generation,
            currentAttemptId: attempt.metadata.id,
          },
        ],
        attempts: [attempt],
      },
    });
  }
  return { status: "recorded", taskId: binding.taskId };
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} requires a non-empty string`);
  return value.trim();
}

function requireValidTaskWorkflow(value: unknown, label: string): string {
  const workflow = requireNonEmptyString(value, label);
  if (workflow === "project") {
    throw new Error(`${label} must name a real workflow; omit workflow for agent-handled project work`);
  }
  return workflow;
}

function requireStringList(value: unknown, label: string, allowEmpty = false): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    !value.every((entry) => typeof entry === "string" && entry.trim())
  ) {
    throw new Error(`${label} requires one or more non-empty strings`);
  }
}

function requireExpectedGeneration(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} requires a non-negative expectedGeneration`);
  }
}

function mutableActionResource(tree: TaskTree, action: AppTaskAction): AppTaskResource {
  const resource = tree.resources?.[action.taskId];
  if (!resource) throw new Error(`Handler action task not found: ${action.taskId}`);
  if (resource.metadata.generation !== action.expectedGeneration) {
    throw new AppTaskActionStaleError({
      taskId: action.taskId,
      expectedGeneration: action.expectedGeneration,
      currentGeneration: resource.metadata.generation,
    });
  }
  return resource;
}

function validateTaskActions(
  tree: TaskTree,
  actions: AppTaskAction[],
  paths: { appDir: string; projectDir: string },
): void {
  if (actions.length > 16) throw new Error(`Handler result exceeds the 16-action reconciliation budget`);
  const identities = new Set<string>();
  const validationTree = structuredClone(tree);
  for (const rawAction of actions as unknown[]) {
    if (!isRecord(rawAction)) throw new Error("Handler result contains a non-object action");
    const kind = rawAction.kind;
    if (!["update-task", "unblock-task"].includes(String(kind))) {
      throw new Error(`Handler result contains an unsupported action kind: ${String(kind)}`);
    }

    const action = rawAction as unknown as AppTaskAction;
    const identity = requireNonEmptyString(action.taskId, `Handler ${action.kind} action identity`);
    if (identities.has(identity)) throw new Error(`Handler result contains multiple actions for ${identity}`);
    identities.add(identity);

    requireExpectedGeneration(action.expectedGeneration, `Handler ${action.kind} action ${action.taskId}`);
    if (action.kind === "update-task" && action.parentId !== undefined) {
      requireNonEmptyString(action.parentId, `Handler update for ${action.taskId} parentId`);
      validateParentReference(validationTree, action.taskId, action.parentId);
    }
    if (action.kind === "update-task" && action.outcome !== undefined) {
      requireNonEmptyString(action.outcome, `Handler update for ${action.taskId} outcome`);
    }
    if (action.kind === "update-task" && action.mode !== undefined && !["achieve", "maintain"].includes(action.mode)) {
      throw new Error(`Handler update for ${action.taskId} has invalid mode ${String(action.mode)}`);
    }
    if (action.kind === "update-task" && action.outputs !== undefined) {
      requireStringList(action.outputs, `Handler update for ${action.taskId} outputs`, true);
      resolveAppTaskOutputPaths(action.outputs, paths);
    }
    if (action.kind === "update-task" && action.acceptance !== undefined) {
      requireStringList(action.acceptance, `Handler update for ${action.taskId} acceptance`);
    }
    if (
      action.kind === "update-task" &&
      action.priority !== undefined &&
      !["P0", "P1", "P2", "P3"].includes(action.priority)
    ) {
      throw new Error(`Handler update for ${action.taskId} has an invalid priority`);
    }
    if (action.kind === "update-task" && action.owner !== undefined && action.owner !== null) {
      requireNonEmptyString(action.owner, `Handler update for ${action.taskId} owner`);
    }
    if (action.kind === "update-task" && action.workflow !== undefined && action.workflow !== null) {
      requireValidTaskWorkflow(action.workflow, `Handler update for ${action.taskId} workflow`);
    }
    if (action.kind === "update-task" && action.input !== undefined && !isRecord(action.input)) {
      throw new Error(`Handler update for ${action.taskId} input must be an object`);
    }
    if (action.kind === "update-task" && action.dependsOn !== undefined) {
      requireStringList(action.dependsOn, `Handler update for ${action.taskId} dependsOn`, true);
    }
    if (action.kind === "update-task" && action.category !== undefined && action.category !== null) {
      requireNonEmptyString(action.category, `Handler update for ${action.taskId} category`);
    }
    if (action.kind === "unblock-task") {
      requireNonEmptyString(action.reason, `Handler unblock for ${action.taskId} reason`);
    }
    const resource = mutableActionResource(validationTree, action);
    if (
      action.kind === "update-task" &&
      action.parentId === undefined &&
      action.outcome === undefined &&
      action.mode === undefined &&
      action.outputs === undefined &&
      action.acceptance === undefined &&
      action.priority === undefined &&
      action.owner === undefined &&
      action.workflow === undefined &&
      action.executor === undefined &&
      action.input === undefined &&
      action.dependsOn === undefined &&
      action.category === undefined
    ) {
      throw new Error(`Handler update for ${action.taskId} contains no change`);
    }
    if (action.kind === "unblock-task") {
      if (resource.status.phase !== "waiting" && resource.status.phase !== "attention") {
        throw new AppTaskActionStaleError({
          taskId: action.taskId,
          expectedGeneration: action.expectedGeneration,
          currentGeneration: resource.metadata.generation,
          currentPhase: resource.status.phase,
        });
      }
    }
    if (action.kind === "update-task" && action.parentId !== undefined) {
      resource.spec.parentId = action.parentId;
    }
  }
}

function taskActionContextIds(actions: unknown[]): string[] {
  return actions.flatMap((rawAction) => {
    if (!isRecord(rawAction)) return [];
    const values =
      rawAction.kind === "update-task"
        ? [rawAction.taskId, rawAction.parentId, ...(Array.isArray(rawAction.dependsOn) ? rawAction.dependsOn : [])]
        : [rawAction.taskId];
    return values.filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  });
}

function validateConditions(
  conditions: AppTaskConditionSpec[] | undefined,
  input: { required: boolean; taskId: string },
): void {
  if (input.required && !conditions?.length) {
    throw new Error(`Waiting result for ${input.taskId} requires at least one exact Condition`);
  }
  for (const condition of (conditions ?? []) as unknown[]) {
    if (!isRecord(condition)) {
      throw new Error(`Handler result for ${input.taskId} contains a non-object Condition`);
    }
    const identity = requireNonEmptyString(condition.id, `Handler result Condition for ${input.taskId} identity`);
    requireNonEmptyString(condition.type, `Handler result Condition ${identity} type`);
    const subject = requireNonEmptyString(condition.subject, `Handler result Condition ${identity} subject`);
    if (!isTypedAppTaskConditionSubject(subject)) {
      throw new Error(`Handler result Condition ${identity} has an invalid subject`);
    }
    if (!("expected" in condition)) {
      throw new Error(`Handler result Condition ${identity} requires an expected value`);
    }
    if (condition.requestedAction !== undefined) {
      requireNonEmptyString(condition.requestedAction, `Handler result Condition ${identity} requestedAction`);
    }
    const owner = requireNonEmptyString(condition.owner, `Handler result Condition ${identity} owner`);
    if (owner !== "human" && !/^[a-z][a-z0-9-]*:[^\s:]+$/.test(owner)) {
      throw new Error(`Handler result Condition ${identity} owner must be a canonical kind:identity`);
    }
    if (
      !Number.isInteger(condition.reviewAfterMs) ||
      Number(condition.reviewAfterMs) < MIN_APP_TASK_CONDITION_REVIEW_AFTER_MS
    ) {
      throw new Error(
        `Handler result Condition ${identity} reviewAfterMs must be an integer of at least ${MIN_APP_TASK_CONDITION_REVIEW_AFTER_MS}`,
      );
    }
  }
}

function validateActionEvidence(taskId: string, evidence: string[] | undefined, actionCount: number): void {
  if (actionCount > 0 && !evidence?.some((entry) => typeof entry === "string" && entry.trim())) {
    throw new Error(`Handler actions for ${taskId} require non-empty evidence`);
  }
}

function defaultTaskAcceptance(claim: AppTaskClaim, evidence: string[]): AppTaskAcceptanceBasis {
  return {
    method: claim.handler.startsWith("workflow:") ? "workflow-contract" : "agent-judgment",
    evidence: [...evidence],
  };
}

function applyTaskActions(
  tree: TaskTree,
  claim: AppTaskClaim,
  actions: AppTaskAction[],
  config: AppTaskContext,
): { actionsApplied: string[]; supersededSessionIds: string[] } {
  validateTaskActions(tree, actions, config);
  const now = new Date().toISOString();
  const applied: string[] = [];
  const supersededSessionIds = new Set<string>();

  for (const action of actions) {
    const targetId = action.taskId;
    if (config.resourceStore.isCancelled(targetId)) {
      throw new Error(`Handler action cannot mutate cancelled task ${targetId}; create a new linked task`);
    }
    if (action.taskId === claim.taskId) {
      throw new Error(
        `Handler action cannot mutate its own running task ${claim.taskId}; assignment changes belong to its assigning owner`,
      );
    }
    switch (action.kind) {
      case "update-task": {
        const resource = mutableActionResource(tree, action);
        const current = resourceIntent(resource);
        const nextIntent: AppTaskIntent = {
          ...current,
          parentId: action.parentId ?? current.parentId,
          outcome: action.outcome?.trim() ?? current.outcome,
          acceptance: action.acceptance ? [...action.acceptance] : current.acceptance,
          mode: action.mode ?? current.mode,
          outputs: action.outputs ? [...action.outputs] : current.outputs,
          priority: action.priority ?? current.priority,
          ...(action.input ? { input: structuredClone(action.input) } : {}),
          ...(action.dependsOn ? { dependsOn: [...action.dependsOn] } : {}),
        };
        if (action.owner !== undefined) {
          if (action.owner === null) delete nextIntent.owner;
          else nextIntent.owner = action.owner;
        }
        if (action.workflow !== undefined) {
          if (action.workflow === null) delete nextIntent.workflow;
          else nextIntent.workflow = action.workflow;
        }
        if (action.executor !== undefined) {
          if (action.executor === null) delete nextIntent.executor;
          else nextIntent.executor = action.executor;
        }
        validateIntent(nextIntent);
        if (action.category !== undefined) {
          if (action.category === null) delete nextIntent.category;
          else nextIntent.category = action.category;
        }
        const currentAgent = resolvedAgent(tree, current, config.agent);
        const nextAgent = resolvedAgent(tree, nextIntent, config.agent);
        const executionChanged = appTaskSpecHash(current, currentAgent) !== appTaskSpecHash(nextIntent, nextAgent);
        const generation = executionChanged ? resource.metadata.generation + 1 : resource.metadata.generation;
        if (executionChanged) {
          if (resource.status.currentAttemptId) {
            const supersededSessionId = tree.attempts?.[resource.status.currentAttemptId]?.sessionId;
            if (supersededSessionId) {
              supersededSessionIds.add(supersededSessionId);
            }
            finishAttempt(
              tree,
              resource,
              "interrupted",
              "Task execution intent changed by reconciliation action",
              now,
            );
          }
          unlinkTaskConditions(tree, action.taskId);
        }
        const nextResource: AppTaskResource = {
          metadata: {
            id: resource.metadata.id,
            generation,
            resourceVersion: resource.metadata.resourceVersion + 1,
          },
          spec: resourceSpec(nextIntent),
          status: executionChanged
            ? {
                observedGeneration: Math.min(resource.status.observedGeneration, generation - 1),
                phase: "pending",
                ...(resource.status.lane ? { lane: resource.status.lane } : {}),
                evidence: resource.status.evidence,
                updatedAt: now,
              }
            : { ...resource.status, updatedAt: now },
        };
        tree.resources![action.taskId] = nextResource;
        applied.push(`updated ${action.taskId}`);
        break;
      }
      case "unblock-task": {
        const resource = mutableActionResource(tree, action);
        unlinkTaskConditions(tree, action.taskId);
        touchResource(resource, {
          phase: "pending",
          executionFailures: undefined,
          executionRetryAt: undefined,
          observedGeneration: Math.max(0, resource.metadata.generation - 1),
          currentAttemptId: undefined,
          summary: action.reason.trim(),
          conditionIds: [],
        });
        applied.push(`unblocked ${action.taskId}`);
        break;
      }
    }
  }
  return { actionsApplied: applied, supersededSessionIds: [...supersededSessionIds] };
}

function liveChildTaskIds(tree: TaskTree, taskId: string): string[] {
  return Object.values(tree.resources ?? {})
    .filter((resource) => resource.spec.parentId === taskId && !tree.cancellations?.[resource.metadata.id])
    .map((resource) => resource.metadata.id);
}

type ResourceMutationScope = {
  writeTaskIds: Set<string>;
  conditionIds: Set<string>;
  originalConditionVersions: Map<string, number>;
  originalAttemptVersions: Map<string, number>;
  fences: Array<{
    taskId: string;
    resourceVersion: number;
    generation: number;
    currentAttemptId: string | null;
  }>;
};

function emptyResourceMutationScope(tree: TaskTree): ResourceMutationScope {
  return {
    writeTaskIds: new Set(),
    conditionIds: new Set(),
    originalConditionVersions: new Map(
      Object.values(tree.conditions ?? {}).flatMap((condition) =>
        isAppTaskCondition(condition) ? [[condition.metadata.id, condition.metadata.resourceVersion] as const] : [],
      ),
    ),
    originalAttemptVersions: new Map(
      Object.values(tree.attempts ?? {}).map((attempt) => [attempt.metadata.id, attempt.metadata.resourceVersion]),
    ),
    fences: [],
  };
}

function beginResourceMutationScopeForTasks(tree: TaskTree, taskIds: Iterable<string>): ResourceMutationScope {
  const scope = emptyResourceMutationScope(tree);
  for (const taskId of taskIds) trackResourceMutationTask(scope, tree, taskId);
  return scope;
}

function beginResourceMutationScope(
  tree: TaskTree,
  claim: AppTaskClaim,
  actions: AppTaskAction[],
): ResourceMutationScope {
  const scope = emptyResourceMutationScope(tree);
  const track = (taskId: string | undefined) => trackResourceMutationTask(scope, tree, taskId);
  const fence = (taskId: string | undefined) => fenceResourceMutationTask(scope, tree, taskId);
  track(claim.taskId);
  fence(tree.resources?.[claim.taskId]?.spec.parentId);
  for (const action of actions) {
    track(action.taskId);
    if (action.kind === "update-task") fence(action.parentId);
  }
  return scope;
}

function fenceResourceMutationTask(scope: ResourceMutationScope, tree: TaskTree, taskId: string | undefined): void {
  if (!taskId) return;
  const resource = tree.resources?.[taskId];
  if (!resource) return;
  if (!scope.fences.some((candidate) => candidate.taskId === taskId)) {
    scope.fences.push({
      taskId,
      resourceVersion: resource.metadata.resourceVersion,
      generation: resource.metadata.generation,
      currentAttemptId: resource.status.currentAttemptId ?? null,
    });
  }
}

function trackResourceMutationTask(scope: ResourceMutationScope, tree: TaskTree, taskId: string | undefined): void {
  if (!taskId) return;
  scope.writeTaskIds.add(taskId);
  fenceResourceMutationTask(scope, tree, taskId);
  const resource = tree.resources?.[taskId];
  if (!resource) return;
  for (const id of resource.status.conditionIds ?? []) scope.conditionIds.add(id);
}

function finishResourceMutationScope(scope: ResourceMutationScope, tree: TaskTree) {
  for (const taskId of scope.writeTaskIds) trackResourceMutationTask(scope, tree, taskId);
  const tasks = [...scope.writeTaskIds].flatMap((taskId) => {
    const resource = tree.resources?.[taskId];
    return resource ? [resourceWrite(tree, resource, isRunnableOnPassiveResync(tree, resource))] : [];
  });
  return {
    fences: scope.fences,
    tasks,
    attempts: Object.values(tree.attempts ?? {}).filter(
      (attempt) =>
        scope.writeTaskIds.has(attempt.taskId) &&
        scope.originalAttemptVersions.get(attempt.metadata.id) !== attempt.metadata.resourceVersion,
    ),
    conditions: [...scope.conditionIds].flatMap((id) => {
      const condition = tree.conditions?.[id];
      return isAppTaskCondition(condition) &&
        scope.originalConditionVersions.get(id) !== condition.metadata.resourceVersion
        ? [condition]
        : [];
    }),
    deleteConditionIds: [...scope.conditionIds].filter((id) => !tree.conditions?.[id]),
  };
}

// Retain the bounded output, not its proposed effects or terminal judgment.
// The next attempt receives this result alongside the still-pending input.
// Existing waits remain attached: newer input does not undo those facts.
function recordPendingAppTaskResult(
  config: AppTaskContext,
  tree: TaskTree,
  claim: AppTaskClaim,
  input: {
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence?: string[];
    acceptedLiveEventIds?: number[];
    reason?: string;
  },
): void {
  const resource = tree.resources![claim.taskId]!;
  const attempt = tree.attempts![claim.attemptId]!;
  const mutationScope = beginResourceMutationScope(tree, claim, []);
  // Keep unresolved asks as context for the newer evidence. Replaying the
  // consumed event prefix would starve later input in a bounded batch.
  retainTaskInputWait(config, resource, consideredInputKeys(config, tree, claim, input.acceptedLiveEventIds), {
    taskGeneration: claim.generation, conditions: [],
  });
  consumeAcceptedLiveTaskEvents(tree, claim.taskId, claim.agent, input.acceptedLiveEventIds);
  finishAttempt(tree, resource, input.reason ? "failed" : "completed", input.summary, new Date().toISOString());
  if (input.reason) attempt.failureReason = input.reason;
  touchResource(resource, {
    phase: "pending",
    observedGeneration: claim.generation,
    observedAttemptId: claim.attemptId,
    currentAttemptId: undefined,
    summary: input.summary,
    ...(input.response !== undefined ? { response: input.response } : {}),
    ...(input.result ? { result: structuredClone(input.result) } : {}),
    evidence: [...(input.evidence ?? [])],
  });
  commitTaskMutation(config, tree, { resourceMutation: finishResourceMutationScope(mutationScope, tree) });
}

export function completeAppTask(
  config: AppTaskContext,
  claim: AppTaskClaim,
  input: {
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence?: string[];
    actions?: AppTaskAction[];
    acceptanceBasis?: AppTaskAcceptanceBasis;
    acceptedLiveEventIds?: number[];
    /** Retire only validated action targets, before the fenced commit exposes replacements. */
    prepareSupersededSessions?: (sessionIds: string[]) => void;
  },
): {
  status: "applied" | "stale";
  actionsApplied: string[];
  dependentTaskIds: string[];
  supersededSessionIds: string[];
  taskContinues?: true;
} {
  const actions = input.actions ?? [];
  const tree = config.resourceStore.readTaskContext({
    taskIds: [claim.taskId, ...taskActionContextIds(actions)],
  });
  const match = matchingTaskAttempt(tree, claim);
  if (!match) {
    return {
      status: "stale",
      actionsApplied: [],
      dependentTaskIds: [],
      supersededSessionIds: [],
    };
  }
  const { resource } = match;
  if (hasUnacceptedLiveTaskEvents(tree, claim.taskId, input.acceptedLiveEventIds)) {
    // Result and Task actions are one contract. A result may report those
    // actions as done, so never expose it as accepted while dropping them.
    if (actions.length > 0) {
      throw new AppTaskActionStaleError({
        taskId: claim.taskId,
        expectedGeneration: claim.generation,
        currentGeneration: resource.metadata.generation,
        currentPhase: resource.status.phase,
        reason: "newer Task evidence is pending",
      });
    }
    recordPendingAppTaskResult(config, tree, claim, input);
    return {
      status: "applied", actionsApplied: [], dependentTaskIds: [claim.taskId],
      supersededSessionIds: [], taskContinues: true,
    };
  }
  validateActionEvidence(claim.taskId, input.evidence, input.actions?.length ?? 0);
  const acceptanceBasis = input.acceptanceBasis ?? defaultTaskAcceptance(claim, input.evidence ?? []);
  const mutationScope = beginResourceMutationScope(tree, claim, actions);
  const { actionsApplied, supersededSessionIds } = applyTaskActions(
    tree,
    claim,
    actions,
    config,
  );
  const now = new Date().toISOString();
  match.attempt.acceptedResult = acceptedAttemptResult(tree, claim.taskId, "converged", input, acceptanceBasis);
  const admissions = acceptedInputAdmissions(config, tree, claim, input.acceptedLiveEventIds);
  consumeAcceptedLiveTaskEvents(tree, claim.taskId, claim.agent, input.acceptedLiveEventIds);
  unlinkSatisfiedTaskConditions(tree, claim.taskId);
  finishAttempt(tree, resource, "completed", input.summary, now);
  const reconcileActionTaskIds = actions.map((action) => action.taskId);
  const pendingSelfTrigger = Boolean(tree.taskTriggers?.[claim.taskId]?.event);
  const satisfiedTaskIds = [
    ...(!pendingSelfTrigger ? [claim.taskId] : []),
  ];
  const dependentTaskIds = [
    ...new Set([
      ...reconcileActionTaskIds,
      ...(pendingSelfTrigger ? [claim.taskId] : []),
      ...Object.values(tree.resources ?? {})
        .filter((candidate) => candidate.spec.dependsOn?.some((id) => satisfiedTaskIds.includes(id)))
        .map((candidate) => candidate.metadata.id),
    ]),
  ];
  for (const dependentTaskId of dependentTaskIds) {
    trackResourceMutationTask(mutationScope, tree, dependentTaskId);
  }
  touchResource(resource, {
    phase: pendingSelfTrigger ? "pending" : resource.status.conditionIds?.length ? "waiting" : "converged",
    observedGeneration: claim.generation,
    observedAttemptId: claim.attemptId,
    currentAttemptId: undefined,
    summary: input.summary,
    response: input.response,
    result: input.result ? structuredClone(input.result) : undefined,
    evidence: [...(input.evidence ?? [])],
  });
  const resourceMutation = finishResourceMutationScope(mutationScope, tree);
  input.prepareSupersededSessions?.(supersededSessionIds);
  commitTaskMutation(config, tree, { resourceMutation: { ...resourceMutation, admissions } });
  return {
    status: "applied",
    actionsApplied,
    dependentTaskIds,
    supersededSessionIds,
    ...(pendingSelfTrigger ? { taskContinues: true as const } : {}),
  };
}

export function deferAppTask(
  config: AppTaskContext,
  claim: AppTaskClaim,
  input: {
    disposition: "waiting";
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence?: string[];
    actions?: AppTaskAction[];
    conditions?: AppTaskConditionSpec[];
    acceptedLiveEventIds?: number[];
    /** Retire only validated action targets, before the fenced commit exposes replacements. */
    prepareSupersededSessions?: (sessionIds: string[]) => void;
  },
): {
  status: "applied" | "stale";
  actionsApplied: string[];
  reconcileTaskIds: string[];
  supersededSessionIds: string[];
} {
  const actions = input.actions ?? [];
  const tree = config.resourceStore.readTaskContext({
    taskIds: [claim.taskId, ...taskActionContextIds(actions)],
    conditionIds: (input.conditions as unknown[] | undefined)?.flatMap((condition) =>
      isRecord(condition) && typeof condition.id === "string" && condition.id.trim() ? [condition.id] : [],
    ),
  });
  const match = matchingTaskAttempt(tree, claim);
  if (!match) {
    return { status: "stale", actionsApplied: [], reconcileTaskIds: [], supersededSessionIds: [] };
  }
  const { resource } = match;
  if (actions.length > 0 && hasUnacceptedLiveTaskEvents(tree, claim.taskId, input.acceptedLiveEventIds)) {
    throw new AppTaskActionStaleError({
      taskId: claim.taskId,
      expectedGeneration: claim.generation,
      currentGeneration: resource.metadata.generation,
      currentPhase: resource.status.phase,
      reason: "newer Task evidence is pending",
    });
  }
  const acceptedResult = acceptedAttemptResult(
    tree,
    claim.taskId,
    "waiting",
    input,
    defaultTaskAcceptance(claim, input.evidence ?? []),
  );
  const inputKeys = consideredInputKeys(config, tree, claim, input.acceptedLiveEventIds);
  consumeAcceptedLiveTaskEvents(tree, claim.taskId, claim.agent, input.acceptedLiveEventIds);
  // A review checkpoint is recovery insurance for an event-driven wait. It
  // never makes the awaited fact true, so preserve the owner's Conditions.
  // Retained and redeclared waits must renew due checkpoints the same way.
  const conditions = input.conditions ?? taskConditionIds(tree, claim.taskId).flatMap((id) => {
    const condition = tree.conditions?.[id];
    return condition && condition.status.state !== "true" ? [{ id, ...condition.spec }] : [];
  });
  const pendingTriggerRecord = tree.taskTriggers?.[claim.taskId];
  const pendingEvents = pendingTriggerRecord ? taskTriggerEvents(pendingTriggerRecord) : [];
  validateActionEvidence(claim.taskId, input.evidence, actions.length);
  const mutationScope = beginResourceMutationScope(tree, claim, actions);
  const { actionsApplied, supersededSessionIds } = applyTaskActions(tree, claim, actions, config);
  validateConditions(conditions, {
    required: input.disposition === "waiting",
    taskId: claim.taskId,
  });
  const now = new Date().toISOString();
  unlinkSatisfiedTaskConditions(tree, claim.taskId);
  match.attempt.acceptedResult = acceptedResult;
  finishAttempt(tree, resource, "completed", input.summary, now);
  if (conditions.length) {
    materializeWaitingConditions(tree, claim.taskId, conditions, now);
  } else {
    unlinkTaskConditions(tree, claim.taskId);
  }
  if (inputKeys.length) {
    const wait = {
      taskGeneration: claim.generation,
      conditions: (input.conditions?.map(({ id }) => id) ?? resource.status.conditionIds ?? [])
        .flatMap((id) => tree.conditions?.[id] ? [{ id, generation: tree.conditions[id].metadata.generation }] : []),
    };
    retainTaskInputWait(config, resource, inputKeys, wait);
  }
  touchResource(resource, {
    phase: input.disposition,
    observedGeneration: claim.generation,
    observedAttemptId: claim.attemptId,
    currentAttemptId: undefined,
    summary: input.summary,
    response: input.response,
    result: input.result ? structuredClone(input.result) : undefined,
    evidence: [...(input.evidence ?? [])],
    ...(!conditions.length ? { conditionIds: [] } : {}),
  });

  // New input remains pending until accepted, whether or not it satisfies a
  // Condition. Also apply matching facts to waits installed by this attempt.
  for (const entry of pendingEvents) {
    for (const wake of applyAppTaskConditionEvent(tree, entry.event)) {
      trackResourceMutationTask(mutationScope, tree, wake.taskId);
    }
  }
  const resourceMutation = finishResourceMutationScope(mutationScope, tree);
  input.prepareSupersededSessions?.(supersededSessionIds);
  commitTaskMutation(config, tree, { resourceMutation });
  const reconcileTaskIds = actions.map((action) => action.taskId);
  return { status: "applied", actionsApplied, reconcileTaskIds, supersededSessionIds };
}

/** Exceptional workflow handoff and failure diagnostics share the normal retry transition. */
export function markAppTaskAttention(
  config: AppTaskContext,
  claim: AppTaskClaim,
  input: {
    summary: string;
    reason: string;
    result?: Record<string, unknown>;
    evidence?: string[];
  },
): { status: "applied" | "stale"; summary: string } {
  const failure = failAppTaskAttempt(config, claim, input.summary, input);
  return { status: failure.status === "superseded" ? "stale" : "applied", summary: failure.summary };
}
