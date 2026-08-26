import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  isTypedConditionSubject as isTypedAppTaskConditionSubject,
  MIN_CONDITION_REVIEW_AFTER_MS as MIN_APP_TASK_CONDITION_REVIEW_AFTER_MS,
  type Condition as AppTaskConditionSpec,
  type TaskAcceptanceBasis as AppTaskAcceptanceBasis,
  type TaskAction as AppTaskAction,
  type TaskExecutorName,
  type TaskIntent as AppTaskIntent,
} from "@may-agent/sdk";
import {
  buildAppTaskTreeProjection,
  isLeaf,
  normalizeStringArray,
  readTaskState,
  saveTaskState,
  taskState,
  withTaskStateLock,
  type TaskNode,
  type ResourceTaskStateConfig,
  type TaskTree,
  type TaskStateConfig,
} from "./app-task-store.js";
import { ensureTaskState, projectRuntimePaths } from "./app-task-runtime-state.js";
import { resolveAppTaskOutputPaths } from "./app-task-output-paths.js";
import type {
  AppTaskCondition as AppTaskCondition,
  AppTaskAttempt as AppTaskAttempt,
  AppTaskResource as AppTaskResource,
  AppTaskTriggerEvent,
  AppTaskWorkspace as AppTaskWorkspace,
} from "./app-task-state.js";
import { readSessionMessages, readSessionMeta, sessionDir } from "../lib/persistence.js";
import { readLatestCheckpoint, type CheckpointEntry } from "../lib/tools/checkpoint.js";
import { applyAppTaskConditionEvent } from "./app-task-condition-tracker.js";
import { normalizeTaskAgent } from "./app-agent-selection.js";
import type { AppTaskResourceStore } from "./app-task-resource-store.js";

export const APP_TASK_RECOVERY_OWNER = "app-task-reconciler";
const MAX_UNCHANGED_CONDITION_REVIEWS = 3;
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
      childIds?: string[];
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

export type AppTaskRecoveryAttention = {
  taskId: string;
  summary: string;
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
  task: TaskNode,
  resource: AppTaskResource,
  eventIds: readonly number[] | undefined,
): void {
  const accepted = new Set((eventIds ?? []).filter((eventId) => Number.isSafeInteger(eventId) && eventId > 0));
  if (accepted.size === 0) return;
  const previous = tree.taskTriggers?.[task.id];
  if (!previous) return;
  const pending = taskTriggerEvents(previous);
  const remaining = pending.filter((entry) => {
    const eventId = Number(entry.event.eventId);
    return !Number.isSafeInteger(eventId) || !accepted.has(eventId);
  });
  if (remaining.length === pending.length) return;
  if (remaining.length === 0) {
    delete tree.taskTriggers?.[task.id];
    return;
  }
  tree.taskTriggers = {
    ...(tree.taskTriggers ?? {}),
    [task.id]: {
      ...previous,
      resourceVersion: previous.resourceVersion + 1,
      events: structuredClone(remaining),
      event: structuredClone(preferredTriggerFromEvents(remaining, task.owner ?? resource.spec.owner ?? "")),
      observedAt: remaining[remaining.length - 1]!.observedAt,
    },
  };
}

function hasUnacceptedLiveTaskEvents(tree: TaskTree, taskId: string, eventIds: readonly number[] | undefined): boolean {
  const pending = tree.taskTriggers?.[taskId];
  if (!pending) return false;
  const accepted = new Set((eventIds ?? []).filter((eventId) => Number.isSafeInteger(eventId) && eventId > 0));
  return taskTriggerEvents(pending).some(({ event }) => {
    const eventId = Number(event.eventId);
    return !Number.isSafeInteger(eventId) || eventId <= 0 || !accepted.has(eventId);
  });
}

/** Reject an externally visible effect when newer Task evidence is still unaccepted. */
export function assertAppTaskEffectFresh(
  config: ResourceTaskStateConfig,
  claim: AppTaskClaim,
  acceptedLiveEventIds?: readonly number[],
): void {
  withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const match = matchingTask(tree, claim);
    if (!match) {
      const resource = tree.resources?.[claim.taskId];
      throw new AppTaskActionStaleError({
        taskId: claim.taskId,
        expectedGeneration: claim.generation,
        currentGeneration: resource?.metadata.generation ?? claim.generation,
        currentPhase: resource?.status.phase,
      });
    }
    if (hasUnacceptedLiveTaskEvents(tree, claim.taskId, acceptedLiveEventIds)) {
      throw new AppTaskActionStaleError({
        taskId: claim.taskId,
        expectedGeneration: claim.generation,
        currentGeneration: match.resource.metadata.generation,
        currentPhase: match.resource.status.phase,
        reason: "newer Task evidence is pending",
      });
    }
  });
}

function appendTaskTriggerEvent(
  events: AppTaskTriggerEvent[],
  event: Record<string, unknown>,
  observedAt: string,
): AppTaskTriggerEvent[] {
  const identity = taskEventIdentity(event);
  if (events.some((entry) => taskEventIdentity(entry.event) === identity)) return events;
  return [...events, { event: structuredClone(event), observedAt }];
}

function preferredTriggerFromEvents(events: AppTaskTriggerEvent[], taskAgent: string): Record<string, unknown> {
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

function triggerOverridesWait(trigger: Record<string, unknown> | undefined): boolean {
  if (!trigger) return false;
  if (
    trigger.type === "project.comment.created" ||
    trigger.type === "message.created" ||
    trigger.type === "app.input.requested" ||
    trigger.type === "app.task.requested"
  ) {
    return true;
  }
  const data = isRecord(trigger.data) ? trigger.data : {};
  return trigger.overrideWait === true || data.overrideWait === true;
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
  config: TaskStateConfig,
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

type CreateTaskAction = Extract<AppTaskAction, { kind: "create-task" }>;

function createActionIntent(action: CreateTaskAction): AppTaskIntent {
  return {
    id: action.id,
    parentId: action.parentId,
    outcome: action.outcome.trim(),
    acceptance: [...action.acceptance],
    mode: action.mode,
    ...(action.owner ? { owner: action.owner } : {}),
    ...(action.workflow ? { workflow: action.workflow } : {}),
    ...(action.executor ? { executor: action.executor } : {}),
    ...(action.input ? { input: structuredClone(action.input) } : {}),
    outputs: [...action.outputs],
    ...(action.dependsOn ? { dependsOn: [...action.dependsOn] } : {}),
    priority: action.priority,
    ...(action.category ? { category: action.category } : {}),
  };
}

function createActionMatchesLiveTask(tree: TaskTree, action: CreateTaskAction): boolean {
  const task = tree.tasks[action.id];
  const resource = tree.resources?.[action.id];
  if (!task || !resource) return false;
  return (
    JSON.stringify(stableValue(resource.spec)) === JSON.stringify(stableValue(resourceSpec(createActionIntent(action))))
  );
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

function runtimePersistDirFromAppDir(appDir: string): string {
  return join(dirname(dirname(appDir)), ".state");
}

function summarizeRecoveryTranscriptEntry(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const entry = message as Record<string, unknown>;
  const role = typeof entry.role === "string" ? entry.role : "message";
  const content = Array.isArray(entry.content)
    ? entry.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (!part || typeof part !== "object") return "";
          const text = (part as Record<string, unknown>).text;
          return typeof text === "string" ? text : "";
        })
        .join(" ")
    : typeof entry.content === "string"
      ? entry.content
      : "";
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  const prefix =
    role === "toolResult" ? `tool:${typeof entry.toolName === "string" ? entry.toolName : "unknown"}` : role;
  return `${prefix} ${normalized}`.slice(0, 240);
}

function latestReceiptedTranscriptCheckpoint(messages: unknown[]): Pick<CheckpointEntry, "summary" | "data"> | null {
  const calls = new Map<string, Pick<CheckpointEntry, "summary" | "data">>();
  let latest: Pick<CheckpointEntry, "summary" | "data"> | null = null;
  for (const message of messages) {
    if (!isRecord(message)) continue;
    if (message.role === "assistant" && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (!isRecord(block) || block.type !== "toolCall" || block.name !== "checkpoint") continue;
        if (typeof block.id !== "string" || !isRecord(block.arguments)) continue;
        const summary = block.arguments.summary;
        const data = block.arguments.data;
        if (typeof summary !== "string" || !summary.trim() || (data !== undefined && !isRecord(data))) continue;
        calls.set(block.id, { summary: summary.trim(), data: data ?? {} });
      }
      continue;
    }
    if (
      message.role === "toolResult" &&
      typeof message.toolCallId === "string" &&
      message.isError !== true &&
      (message.toolName === undefined || message.toolName === "checkpoint")
    ) {
      const call = calls.get(message.toolCallId);
      if (call) latest = call;
    }
  }
  return latest;
}

function checkpointRecoveryEvidence(
  checkpointPath: string,
  transcriptPath: string,
  checkpoint: CheckpointEntry | null,
  transcriptCheckpoint: Pick<CheckpointEntry, "summary" | "data"> | null,
  sessionId: string,
): string {
  if (checkpoint) {
    return `Recovered latest durable checkpoint: ${checkpointPath} step=${checkpoint.step} summary=${checkpoint.summary} data=${JSON.stringify(stableValue(checkpoint.data))}`;
  }
  if (transcriptCheckpoint) {
    return `Recovered latest receipted transcript checkpoint: ${transcriptPath} summary=${transcriptCheckpoint.summary} data=${JSON.stringify(stableValue(transcriptCheckpoint.data))}`;
  }
  return `Recovered durable checkpoint: absent for session ${sessionId}; no matching successful checkpoint receipt in ${transcriptPath}`;
}

function buildRecoveredSessionHandoff(
  config: TaskStateConfig,
  attempt: AppTaskAttempt | undefined,
): AppTaskClaim["handoff"] | undefined {
  if (!attempt?.sessionId || attempt.failureReason !== "previous-runtime-attempt-requeued") {
    return undefined;
  }
  const persistDir = runtimePersistDirFromAppDir(config.appDir);
  const interruptedSessionPath = sessionDir(persistDir, attempt.sessionId);
  const metaPath = join(interruptedSessionPath, "meta.json");
  const meta = readSessionMeta(persistDir, attempt.sessionId);
  const resultPath = join(interruptedSessionPath, "result.json");
  const transcriptPath = join(interruptedSessionPath, "session.jsonl");
  const sessionLabel = isManagedAgentHandler(attempt.handler) ? "agent session" : `${attempt.handler} session`;
  const checkpointPath = join(persistDir, "checkpoints", `${attempt.sessionId}.jsonl`);
  const checkpoint = readLatestCheckpoint(persistDir, attempt.sessionId);
  const transcriptMessages = existsSync(transcriptPath) ? readSessionMessages(persistDir, attempt.sessionId) : [];
  const transcriptCheckpoint = checkpoint ? null : latestReceiptedTranscriptCheckpoint(transcriptMessages);
  const evidence = [
    `Recovered interrupted ${sessionLabel} path: ${interruptedSessionPath}`,
    `Recovered interrupted ${sessionLabel} metadata: ${metaPath}`,
    `Recovered interrupted ${sessionLabel} artifact: ${resultPath}`,
    `Recovered interrupted ${sessionLabel} transcript: ${transcriptPath}`,
    checkpointRecoveryEvidence(checkpointPath, transcriptPath, checkpoint, transcriptCheckpoint, attempt.sessionId),
  ];
  if (transcriptMessages.length > 0) {
    for (const snippet of transcriptMessages
      .map(summarizeRecoveryTranscriptEntry)
      .filter((entry): entry is string => Boolean(entry))
      .slice(-3)) {
      evidence.push(`Recovered transcript snippet: ${snippet}`);
    }
  }
  return {
    reason: "recovered-session",
    summary:
      meta?.error?.trim() ||
      `Previous runtime ${sessionLabel} ${attempt.sessionId} was interrupted during recovery before a task decision was persisted`,
    evidence,
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
  }
  resource.status.currentAttemptId = undefined;
}

function matchingCompletionReceipt(tree: TaskTree, resource: AppTaskResource, appAgent: string) {
  const receipt = tree.receipts?.[resource.metadata.id];
  if (
    !receipt ||
    receipt.metadata.id !== resource.metadata.id ||
    receipt.metadata.generation !== resource.metadata.generation
  ) {
    return undefined;
  }
  const intent = resourceIntent(resource);
  if (intent.mode !== "achieve") return undefined;
  const agent = resolvedAgent(tree, intent, appAgent);
  return receipt.specHash === appTaskSpecHash(intent, agent) ? receipt : undefined;
}

function retireCompletedTaskDuplicate(tree: TaskTree, resource: AppTaskResource, summary: string): string[] {
  const taskId = resource.metadata.id;
  const task = tree.tasks[taskId];
  const liveChildren = (task?.children ?? []).filter((childId) => tree.tasks[childId]);
  if (liveChildren.length > 0) {
    throw new Error(
      `Task ${taskId} has a matching completion receipt but its stale live duplicate cannot be pruned while it has live children: ${liveChildren.slice(0, 8).join(", ")}${
        liveChildren.length > 8 ? ` (+${liveChildren.length - 8} more)` : ""
      }`,
    );
  }

  const now = new Date().toISOString();
  const sessionIds = new Set<string>();
  for (const attempt of Object.values(tree.attempts ?? {})) {
    if (
      attempt.taskId !== taskId ||
      attempt.taskGeneration !== resource.metadata.generation ||
      attempt.state !== "running"
    ) {
      continue;
    }
    if (attempt.sessionId) sessionIds.add(attempt.sessionId);
    attempt.metadata.resourceVersion += 1;
    attempt.state = "interrupted";
    attempt.finishedAt = now;
    attempt.summary = summary;
    attempt.failureReason = "matching-completion-receipt";
  }
  resource.status.currentAttemptId = undefined;
  if (task) {
    unlinkTaskConditions(tree, task);
    const parent = task.parent_id ? tree.tasks[task.parent_id] : undefined;
    if (parent) parent.children = (parent.children ?? []).filter((id) => id !== taskId);
    delete tree.tasks[taskId];
  } else if (resource.status.conditionIds?.length) {
    touchResource(resource, { conditionIds: [] });
    pruneUnlinkedConditions(tree);
  }
  delete tree.resources?.[taskId];
  delete tree.taskTriggers?.[taskId];
  refreshActiveTaskProjection(tree);
  return [...sessionIds];
}

type TaskReconciliationConfigInput = {
  appDir: string;
  /** Stable writable App root when appDir is an immutable definition release. */
  stateAppDir?: string;
  projectDir: string;
  agent?: string;
  /** @deprecated Compatibility for Host callers not yet migrated. */
  owner?: string;
  maxConcurrent: number;
  resourceStore?: AppTaskResourceStore;
};

export function taskReconciliationConfig(
  input: TaskReconciliationConfigInput & { resourceStore: AppTaskResourceStore },
): ResourceTaskStateConfig;
export function taskReconciliationConfig(input: TaskReconciliationConfigInput): TaskStateConfig;
export function taskReconciliationConfig(input: TaskReconciliationConfigInput): TaskStateConfig {
  const paths = projectRuntimePaths(input.resourceStore && input.stateAppDir ? input.stateAppDir : input.appDir);
  const agent = input.agent?.trim() || input.owner?.trim();
  if (!agent) throw new Error("Task reconciliation requires a default agent");
  return {
    appDir: input.appDir,
    ...(input.stateAppDir ? { stateAppDir: input.stateAppDir } : {}),
    projectDir: input.projectDir,
    statePath: input.resourceStore ? paths.taskStatePath : ensureTaskState(input.appDir).path,
    journalPath: paths.journalPath,
    worker: agent,
    maxConcurrent: input.maxConcurrent,
    ...(input.resourceStore ? { resourceStore: input.resourceStore } : {}),
  };
}

function activeTaskIds(tree: TaskTree): string[] {
  return Object.values(tree.resources ?? {})
    .filter((resource) => resource.status.phase === "running")
    .map((resource) => resource.metadata.id)
    .sort();
}

function refreshActiveTaskProjection(tree: TaskTree): void {
  tree.active_task_ids = activeTaskIds(tree);
  tree.active_task_id = tree.active_task_ids[0] ?? null;
}

function resolvedAgent(tree: TaskTree, intent: AppTaskIntent, appAgent: string): string {
  if (intent.owner?.trim()) return intent.owner.trim();
  let parentId: string | null | undefined = intent.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent: TaskNode | undefined = tree.tasks[parentId];
    if (!parent) break;
    if (parent.owner?.trim()) return parent.owner.trim();
    parentId = parent.parent_id;
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

function openTaskConditionIds(tree: TaskTree, task: TaskNode): string[] {
  const ids = taskConditionEntries(tree, task.id)
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

function completedConditionReviewCount(tree: TaskTree, taskId: string, conditionId: string): number {
  const generation = tree.resources?.[taskId]?.metadata.generation;
  if (!Number.isInteger(generation)) return 0;
  const matchingAttempts = Object.values(tree.attempts ?? {})
    .filter(
      (attempt) =>
        attempt.taskId === taskId &&
        attempt.taskGeneration === generation &&
        attempt.state !== "running" &&
        attempt.reason === "condition-review-checkpoint-missed",
    )
    .filter((attempt) => {
      const trigger = attemptTrigger(attempt);
      const data = isRecord(trigger?.data) ? trigger.data : {};
      const conditionIds = Array.isArray(data.conditionIds)
        ? data.conditionIds.filter((value): value is string => typeof value === "string")
        : [];
      return conditionIds.includes(conditionId);
    });
  const highestRecordedAttempt = matchingAttempts.reduce((highest, attempt) => {
    const trigger = attemptTrigger(attempt);
    const data = isRecord(trigger?.data) ? trigger.data : {};
    const reviewAttempt = Number(data.reviewAttempt);
    return Number.isInteger(reviewAttempt) ? Math.max(highest, reviewAttempt) : highest;
  }, 0);
  const legacyAttemptCount = matchingAttempts.filter((attempt) => {
    const trigger = attemptTrigger(attempt);
    const data = isRecord(trigger?.data) ? trigger.data : {};
    return !Number.isInteger(Number(data.reviewAttempt));
  }).length;
  return Math.max(highestRecordedAttempt, legacyAttemptCount);
}

function boundedReviewConditions(
  claim: AppTaskClaim,
  conditions: AppTaskConditionSpec[] | undefined,
): AppTaskConditionSpec[] | undefined {
  if (!conditions?.length || claim.trigger?.type !== "project.task.condition-review.missed") {
    return conditions;
  }
  const data = isRecord(claim.trigger.data) ? claim.trigger.data : {};
  if (data.finalReview !== true) return conditions;
  const exhaustedIds = new Set(
    Array.isArray(data.conditionIds)
      ? data.conditionIds.filter((value): value is string => typeof value === "string")
      : [],
  );
  return conditions.map((condition) => {
    if (!exhaustedIds.has(condition.id) || condition.reviewAfterMs === undefined) {
      return condition;
    }
    const { reviewAfterMs: _reviewAfterMs, ...conditionWithoutReview } = condition;
    return conditionWithoutReview;
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

function unlinkTaskConditions(tree: TaskTree, task: TaskNode): void {
  const resource = tree.resources?.[task.id];
  if (resource?.status.conditionIds?.length) touchResource(resource, { conditionIds: [] });
  pruneUnlinkedConditions(tree);
}

function unlinkSatisfiedTaskConditions(tree: TaskTree, task: TaskNode): void {
  const resource = tree.resources?.[task.id];
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
  task: TaskNode,
  conditions: AppTaskConditionSpec[],
  now: string,
): void {
  const registry = conditionRegistry(tree);
  const ids: string[] = [];
  const previousIds = new Set(taskConditionIds(tree, task.id));
  for (const raw of conditions) {
    const id = raw.id.trim();
    ids.push(id);
    const spec = {
      type: raw.type.trim(),
      subject: raw.subject.trim(),
      expected: raw.expected,
      ...(raw.requestedAction?.trim() ? { requestedAction: raw.requestedAction.trim() } : {}),
      ...(raw.owner?.trim() ? { owner: raw.owner.trim() } : {}),
      ...(raw.reviewAfterMs !== undefined ? { reviewAfterMs: raw.reviewAfterMs } : {}),
    };
    const current = registry[id];
    const sameSpec = current && JSON.stringify(stableValue(current.spec)) === JSON.stringify(stableValue(spec));
    const linkedToAnotherTask = Object.values(tree.resources ?? {}).some(
      (resource) => resource.metadata.id !== task.id && resource.status.conditionIds?.includes(id),
    );
    if (current && !sameSpec && linkedToAnotherTask) {
      throw new Error(`Condition ${id} is already linked to another task with a different specification`);
    }
    registry[id] = sameSpec
      ? previousIds.has(id) && current.status.state !== "true"
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
  const resource = tree.resources?.[task.id];
  if (resource) touchResource(resource, { conditionIds: ids });
  pruneUnlinkedConditions(tree);
}

function syncTaskProjection(task: TaskNode, resource: AppTaskResource, owner: string): void {
  const intent = resourceIntent(resource);
  task.revision = resource.metadata.generation;
  task.parent_id = intent.parentId;
  task.goal = intent.outcome;
  task.acceptance = [...intent.acceptance];
  task.outputs = [...(intent.outputs ?? [])];
  task.depends_on = [...(intent.dependsOn ?? [])];
  task.priority = intent.priority ?? task.priority ?? "P2";
  task.owner = owner;
  task.workflow = intent.workflow;
  task.executor = intent.executor;
  task.reconcile_mode = intent.mode;
  task.kind = intent.category;
  task.summary = resource.status.summary;
  task.state =
    resource.status.phase === "running"
      ? "active"
      : resource.status.phase === "waiting"
        ? "blocked"
        : resource.status.phase === "attention"
          ? "review"
          : "backlog";
}

export function recoverableAppTaskAttempts(
  config: ResourceTaskStateConfig,
  nowMs = Date.now(),
  includeFreshLeases = false,
  candidateTaskIds: Iterable<string>,
): AppTaskAttemptRecovery[] {
  return withTaskStateLock(config, () => {
    const candidates = [...candidateTaskIds];
    if (candidates.length === 0) return [];
    const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
    let changed = false;
    const mutationScope = emptyResourceMutationScope();
    const recoveries = Object.values(tree.resources ?? {}).flatMap((resource) => {
      if (resource.status.phase !== "running") return [];
      if (matchingCompletionReceipt(tree, resource, config.worker)) {
        trackResourceMutationTask(mutationScope, tree, resource.metadata.id);
        retireCompletedTaskDuplicate(
          tree,
          resource,
          "Matching completion receipt already exists; retiring stale recovery state",
        );
        changed = true;
        return [];
      }
      const attempt = currentResourceAttempt(tree, resource);
      if (
        !attempt ||
        attempt.runtimeId === reconcilerRuntimeId ||
        (!includeFreshLeases && leaseIsFresh(attempt, nowMs))
      )
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
    if (changed) {
      saveTaskState(config, tree, {
        resourceMutation: finishResourceMutationScope(mutationScope, tree),
      });
    }
    return recoveries;
  });
}

export function terminalAgentSessionAppTaskClaim(
  config: ResourceTaskStateConfig,
  taskId: string,
  sessionId: string,
): AppTaskClaim | null {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const resource = tree.resources?.[taskId];
    if (!resource || resource.status.phase !== "running") return null;
    const task = tree.tasks[taskId];
    const attempt = currentResourceAttempt(tree, resource);
    if (
      !task ||
      !attempt ||
      attempt.state !== "running" ||
      !isManagedAgentHandler(attempt.handler) ||
      attempt.sessionId !== sessionId ||
      attempt.taskGeneration !== resource.metadata.generation ||
      attempt.specHash !== appTaskSpecHash(resourceIntent(resource), attempt.owner)
    ) {
      return null;
    }
    const intent = resourceIntent(resource);
    const trigger = attemptTrigger(attempt);
    return {
      kind: "claimed",
      taskId,
      generation: resource.metadata.generation,
      resourceVersion: resource.metadata.resourceVersion,
      specHash: attempt.specHash,
      attemptId: attempt.metadata.id,
      agent: attempt.owner,
      handler: attempt.handler,
      mode: intent.mode,
      intent,
      events: structuredClone(
        attempt.events?.length
          ? attempt.events
          : attempt.trigger
            ? [{ event: attempt.trigger, observedAt: attempt.startedAt }]
            : [],
      ),
      eventsTruncated: Boolean(attempt.eventsTruncated),
      ...(trigger ? { trigger: structuredClone(trigger) } : {}),
      declaredOutputPaths: [],
    };
  });
}

export function expiredAgentSessionAppTaskAttempt(
  config: ResourceTaskStateConfig,
  taskId: string,
  nowMs = Date.now(),
  sessionActivity?: AttemptSessionActivity,
): AppTaskAttemptRecovery | null {
  return withTaskStateLock(config, () => {
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
  });
}

export function releaseInterruptedAppTaskAttempt(
  config: ResourceTaskStateConfig,
  recovery: AppTaskAttemptRecovery,
  summary: string,
): { released: boolean; sessionIds: string[] } {
  return withTaskStateLock(config, () => {
    const taskId = recovery.taskId;
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const task = tree.tasks[taskId];
    if (!task) return { released: false, sessionIds: [] };
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
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
    });
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
    return { released: true, sessionIds };
  });
}

/**
 * Reject a late terminal session result whose owning workflow execution stack was
 * lost during restart. Workflow post-processing (verification, actions, and
 * workspace finalization) did not run, so the only safe generic disposition is
 * to interrupt the exact attempt and requeue the same task generation.
 */
export function releaseTerminalSessionExpiredAppTaskAttempt(
  config: ResourceTaskStateConfig,
  recovery: AppTaskTerminalSessionRecovery,
  summary: string,
  nowMs = Date.now(),
  sessionActivity?: AttemptSessionActivity,
): { released: boolean; sessionIds: string[] } {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [recovery.taskId] });
    const task = tree.tasks[recovery.taskId];
    const resource = tree.resources?.[recovery.taskId];
    if (!task || !resource || resource.status.phase !== "running") {
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
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary: recoveredSummary,
      conditionIds: [],
    });
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
    return { released: true, sessionIds: [recovery.sessionId] };
  });
}

export function releaseLateTerminalWorkflowAppTaskAttempt(
  config: ResourceTaskStateConfig,
  binding: { taskId: string; generation: number },
  sessionId: string,
  summary: string,
): { released: boolean; taskId: string } {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [binding.taskId] });
    const task = tree.tasks[binding.taskId];
    const resource = tree.resources?.[binding.taskId];
    if (
      !task ||
      !resource ||
      resource.metadata.generation !== binding.generation ||
      resource.status.phase !== "running"
    ) {
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
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary: recoveredSummary,
      conditionIds: [],
    });
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
    return { released: true, taskId: binding.taskId };
  });
}

export function repairPreviousRuntimeRecoveryAttention(
  config: ResourceTaskStateConfig,
  candidateTaskIds: Iterable<string>,
): AppTaskRecoveryRepair[] {
  return withTaskStateLock(config, () => {
    const candidates = [...candidateTaskIds];
    if (candidates.length === 0) return [];
    const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
    const repairs: AppTaskRecoveryRepair[] = [];
    const mutationScope = emptyResourceMutationScope();
    for (const resource of Object.values(tree.resources ?? {})) {
      if (resource.status.phase !== "attention") continue;
      const task = tree.tasks[resource.metadata.id];
      if (!task) continue;
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
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, attempt.owner);
      repairs.push({
        taskId: resource.metadata.id,
        disposition: "requeued",
        summary,
      });
    }
    if (repairs.length > 0) {
      refreshActiveTaskProjection(tree);
      saveTaskState(config, tree, {
        resourceMutation: finishResourceMutationScope(mutationScope, tree),
      });
    }
    return repairs;
  });
}

/**
 * Release waits created by older runtimes before the destination App had
 * durably admitted the request. Such a request can never complete, so the
 * same Task must be judged again from its current evidence.
 */
export function repairUnadmittedAppDependencyWaits(
  config: ResourceTaskStateConfig,
  isAdmitted: (requestId: string) => boolean,
  candidateTaskIds: Iterable<string>,
): AppTaskRecoveryRepair[] {
  return withTaskStateLock(config, () => {
    const candidates = [...candidateTaskIds];
    if (candidates.length === 0) return [];
    const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
    const repairs: AppTaskRecoveryRepair[] = [];
    const mutationScope = emptyResourceMutationScope();
    for (const resource of Object.values(tree.resources ?? {})) {
      if (resource.status.phase !== "waiting") continue;
      const task = tree.tasks[resource.metadata.id];
      if (!task) continue;
      const missingRequestId = (resource.status.conditionIds ?? []).flatMap((conditionId) => {
        const condition = tree.conditions?.[conditionId];
        if (
          !isAppTaskCondition(condition) ||
          condition.status.state === "true" ||
          condition.spec.type !== "app.dependency.completed" ||
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
      unlinkTaskConditions(tree, task);
      touchResource(resource, {
        phase: "pending",
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, resolvedAgent(tree, resourceIntent(resource), config.worker));
      repairs.push({ taskId: resource.metadata.id, disposition: "requeued", summary });
    }
    if (repairs.length > 0) {
      refreshActiveTaskProjection(tree);
      saveTaskState(config, tree, {
        resourceMutation: finishResourceMutationScope(mutationScope, tree),
      });
    }
    return repairs;
  });
}

export function repairRunningAppTasksWithoutAttempt(
  config: ResourceTaskStateConfig,
  candidateTaskIds: Iterable<string>,
): AppTaskRecoveryRepair[] {
  return withTaskStateLock(config, () => {
    const candidates = [...candidateTaskIds];
    if (candidates.length === 0) return [];
    const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
    const repairs: AppTaskRecoveryRepair[] = [];
    const mutationScope = emptyResourceMutationScope();
    const now = new Date().toISOString();
    for (const resource of Object.values(tree.resources ?? {})) {
      if (resource.status.phase !== "running") continue;
      const task = tree.tasks[resource.metadata.id];
      if (!task) continue;
      const attemptId = resource.status.currentAttemptId;
      const attempt = attemptId ? tree.attempts?.[attemptId] : undefined;
      if (attempt?.state === "running") continue;

      trackResourceMutationTask(mutationScope, tree, resource.metadata.id);
      const agent = resolvedAgent(tree, resourceIntent(resource), config.worker);
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
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, agent);
      repairs.push({
        taskId: resource.metadata.id,
        disposition: "requeued",
        summary,
      });
    }
    if (repairs.length > 0) {
      refreshActiveTaskProjection(tree);
      saveTaskState(config, tree, {
        resourceMutation: finishResourceMutationScope(mutationScope, tree),
      });
    }
    return repairs;
  });
}

export function pendingAppTaskRecoveryAttention(
  config: ResourceTaskStateConfig,
  candidateTaskIds: Iterable<string>,
): AppTaskRecoveryAttention[] {
  return withTaskStateLock(config, () => {
    const candidates = [...candidateTaskIds];
    if (candidates.length === 0) return [];
    const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
    return Object.values(tree.resources ?? {}).flatMap((resource) => {
      const attempts = Object.values(tree.attempts ?? {})
        .filter((attempt) => attempt.taskId === resource.metadata.id)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      const attempt = attempts[0];
      if (
        resource.status.phase !== "attention" ||
        attempt?.failureReason !== "previous-runtime-attempt-not-recoverable" ||
        attempt.attentionNotifiedAt
      ) {
        return [];
      }
      return [
        {
          taskId: resource.metadata.id,
          summary:
            resource.status.summary?.trim() ||
            `Interrupted reconciliation ${resource.metadata.id} requires agent attention`,
        },
      ];
    });
  });
}

export function acknowledgeAppTaskRecoveryAttention(config: ResourceTaskStateConfig, taskId: string): boolean {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const attempt = Object.values(tree.attempts ?? {})
      .filter((candidate) => candidate.taskId === taskId)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    if (!attempt || attempt.failureReason !== "previous-runtime-attempt-not-recoverable" || attempt.attentionNotifiedAt)
      return false;
    const mutationScope = beginResourceMutationScopeForTasks(tree, [taskId]);
    attempt.metadata.resourceVersion += 1;
    attempt.attentionNotifiedAt = new Date().toISOString();
    saveTaskState(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
    return true;
  });
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
  if (!tree.tasks[parentId]) {
    throw new Error(`Task ${taskId} parent does not exist in the live graph: ${parentId}`);
  }
  if (parentId === taskId) throw new Error(`Task ${taskId} cannot be its own parent`);

  const seen = new Set<string>();
  let cursor: string | undefined = parentId;
  while (cursor && !seen.has(cursor)) {
    if (cursor === taskId) throw new Error(`Task ${taskId} parent would create a containment cycle`);
    seen.add(cursor);
    cursor = tree.tasks[cursor]?.parent_id ?? undefined;
  }
  if (cursor) throw new Error(`Task ${taskId} parent chain already contains a containment cycle at ${cursor}`);
}

function upsertTask(tree: TaskTree, resource: AppTaskResource, owner: string): TaskNode {
  const intent = resourceIntent(resource);
  const parent = tree.tasks[intent.parentId];
  if (!parent) {
    throw new Error(`Task ${intent.id} parent does not exist in the live graph: ${intent.parentId}`);
  }

  const task = tree.tasks[intent.id] ?? {
    id: intent.id,
    parent_id: intent.parentId,
    children: [],
    state: "backlog",
  };
  const previousParentId = task.parent_id;
  syncTaskProjection(task, resource, owner);
  if (task.context) delete task.context.reconciliation;
  task.trace = {
    ...(task.trace ?? {}),
    reconciliation: undefined,
    current_attempt_id: undefined,
    current_task_revision: undefined,
    assigned_at: undefined,
    assigned_by: undefined,
    assigned_worker: undefined,
    worker_started_attempt_id: undefined,
    worker_started_at: undefined,
  };
  tree.tasks[intent.id] = task;
  if (previousParentId && previousParentId !== intent.parentId) {
    const previousParent = tree.tasks[previousParentId];
    if (previousParent) previousParent.children = (previousParent.children ?? []).filter((id) => id !== task.id);
  }
  parent.children = [...new Set([...(parent.children ?? []), intent.id])];
  return task;
}

export function observeAppTaskIntent(
  config: ResourceTaskStateConfig,
  input: {
    intent: AppTaskIntent;
    appAgent: string;
    trigger?: Record<string, unknown>;
    admissionKey?: string;
  },
): AppTaskObservationResult {
  input = { ...input, intent: normalizeTaskAgent(input.intent) };
  validateIntent(input.intent);
  const admissionKey = input.admissionKey?.trim();
  if (input.admissionKey !== undefined && !admissionKey) {
    throw new Error("Task admission key must be non-empty when provided");
  }
  return withTaskStateLock(config, () => {
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
      const completed = tree.receipts?.[previousAdmission.taskId];
      if (completed) {
        return {
          kind: "completed",
          taskId: completed.metadata.id,
          generation: completed.metadata.generation,
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
        },
      };
    };
    const receipt = tree.receipts?.[input.intent.id];
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
    const receiptMatchesDesiredIdentity =
      receipt?.metadata.id === input.intent.id &&
      receipt.specHash === specHash &&
      input.intent.mode === "achieve" &&
      (!existingResource || receipt.metadata.generation === existingResource.metadata.generation);
    if (receiptMatchesDesiredIdentity) {
      const mutationScope = beginResourceMutationScopeForTasks(
        tree,
        existingResource ? [existingResource.metadata.id] : [],
      );
      if (!existingResource) mutationScope.createdTaskIds.add(input.intent.id);
      recordAdmission(input.intent.id, receipt.metadata.generation);
      if (existingResource) {
        for (const sessionId of retireCompletedTaskDuplicate(
          tree,
          existingResource,
          "Matching completion receipt already exists; pruning stale live duplicate",
        )) {
          supersededSessionIds.add(sessionId);
        }
      }
      if (existingResource || admissionKey) {
        const resourceMutation = finishResourceMutationScope(mutationScope, tree);
        saveTaskState(config, tree, {
          resourceMutation: {
            ...resourceMutation,
            ...(admissionKey && tree.appTaskAdmissions?.[admissionKey]
              ? {
                  admissions: [{ taskId: admissionKey, value: tree.appTaskAdmissions[admissionKey] }],
                }
              : {}),
          },
        });
      }
      return {
        kind: "completed",
        taskId: input.intent.id,
        generation: receipt.metadata.generation,
        ...(supersededSessionIds.size > 0 ? { supersededSessionIds: [...supersededSessionIds] } : {}),
      };
    }

    const previousGeneration = existingResource
      ? existingResource.metadata.generation
      : receipt && Number.isInteger(receipt.metadata.generation)
        ? receipt.metadata.generation
        : 0;
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
    const task = upsertTask(tree, resource, agent);
    if (generation > previousGeneration) {
      // A new desired generation supersedes pending wakes that were fenced to
      // the older specification. The event store retains their causal history;
      // only the old task-generation link is retired.
      if (tree.taskTriggers) delete tree.taskTriggers[task.id];
    }
    const suppressTrigger =
      input.trigger &&
      resource.status.phase === "waiting" &&
      openTaskConditionIds(tree, task).length > 0 &&
      !hasSatisfiedTaskCondition(tree, task.id) &&
      !triggerOverridesWait(input.trigger);
    if (input.trigger && !suppressTrigger) {
      const previousTrigger = tree.taskTriggers?.[task.id];
      const events = appendTaskTriggerEvent(
        previousTrigger ? taskTriggerEvents(previousTrigger) : [],
        input.trigger,
        now,
      );
      const event = preferredTriggerFromEvents(events, agent);
      tree.taskTriggers = {
        ...(tree.taskTriggers ?? {}),
        [task.id]: {
          taskId: task.id,
          taskGeneration: generation,
          resourceVersion: (previousTrigger?.resourceVersion ?? 0) + 1,
          events,
          event: structuredClone(event),
          observedAt: now,
        },
      };
    }
    recordAdmission(task.id, generation);
    syncTaskProjection(task, resource, agent);
    refreshActiveTaskProjection(tree);
    const relevantConditionIds = new Set([...initialConditionIds, ...(resource.status.conditionIds ?? [])]);
    saveTaskState(config, tree, {
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
      taskId: task.id,
      generation,
      changed,
      ...(supersededSessionIds.size > 0 ? { supersededSessionIds: [...supersededSessionIds] } : {}),
    };
  });
}

export function readAppTaskIntent(config: ResourceTaskStateConfig, taskId: string): AppTaskIntent | null {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const resource = tree.resources?.[taskId];
    return resource ? resourceIntent(resource) : null;
  });
}

/**
 * Return whether the requested task generation has produced a converged fact.
 * A live resource takes precedence over an older immutable receipt with the
 * same task id, so a newly revised generation cannot look complete by accident.
 */
export function isAppTaskConverged(config: ResourceTaskStateConfig, taskId: string, generation?: number): boolean {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const resource = tree.resources?.[taskId];
    if (resource) {
      return (
        (generation === undefined || resource.metadata.generation === generation) &&
        resource.status.phase === "converged" &&
        resource.status.observedGeneration === resource.metadata.generation
      );
    }
    const receipt = tree.receipts?.[taskId];
    return Boolean(receipt && (generation === undefined || receipt.metadata.generation === generation));
  });
}

export type AppTaskChildContext = {
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
        | "child-blocked"
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
      | "child-blocked"
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

function boundedChildContextText(value: string): string {
  return value.length <= MAX_CHILD_CONTEXT_TEXT ? value : `${value.slice(0, MAX_CHILD_CONTEXT_TEXT - 3)}...`;
}

function boundedChildEvidence(evidence: string[]): string[] {
  return evidence.slice(0, MAX_CHILD_EVIDENCE).map(boundedChildContextText);
}

function liveTaskContext(
  tree: TaskTree,
  resource: AppTaskResource,
  readiness: ReturnType<typeof buildAppTaskTreeProjection>["tasks"][string]["readiness"],
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
    hasLiveChildren: (tree.tasks[resource.metadata.id]?.children ?? []).some((childId) =>
      Boolean(tree.resources?.[childId]),
    ),
    updatedAt: resource.status.updatedAt,
    ...(resource.status.summary ? { summary: boundedChildContextText(resource.status.summary) } : {}),
    evidence: boundedChildEvidence([...(resource.status.evidence ?? [])]),
  };
}

function liveTaskSnapshotContext(
  tree: TaskTree,
  resource: AppTaskResource,
  readiness: ReturnType<typeof buildAppTaskTreeProjection>["tasks"][string]["readiness"],
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
    hasLiveChildren: (tree.tasks[resource.metadata.id]?.children ?? []).some((childId) =>
      Boolean(tree.resources?.[childId]),
    ),
    updatedAt: resource.status.updatedAt,
  };
}

/** Bounded current child state supplied to an executable parent reconciliation. */
export function readAppTaskChildContext(config: ResourceTaskStateConfig, taskId: string): AppTaskChildContext {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const projection = buildAppTaskTreeProjection(tree, config.maxConcurrent);
    const live = (tree.tasks[taskId]?.children ?? [])
      .map((childId) => tree.resources?.[childId])
      .filter((resource): resource is AppTaskResource => Boolean(resource))
      .sort((left, right) => left.metadata.id.localeCompare(right.metadata.id))
      .slice(0, MAX_LIVE_CHILD_CONTEXT)
      .map((resource) => liveTaskContext(tree, resource, projection.tasks[resource.metadata.id]?.readiness));
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
    return { live, completed };
  });
}

export type AppTaskLiveSnapshot = {
  live: AppTaskSnapshotContext[];
  truncated: boolean;
};

/** Bounded App-wide live-task facts, excluding the task performing the review. */
export function readAppTaskLiveSnapshot(config: ResourceTaskStateConfig, currentTaskId: string): AppTaskLiveSnapshot {
  return withTaskStateLock(config, () => {
    const indexedIds = config.resourceStore.listLiveTaskIds(currentTaskId, MAX_APP_TASK_LIVE_SNAPSHOT + 1);
    const tree = config.resourceStore.readTaskContext({ taskIds: indexedIds });
    const projection = buildAppTaskTreeProjection(tree, config.maxConcurrent);
    const candidates = Object.values(tree.resources ?? {})
      .filter((resource) => resource.metadata.id !== currentTaskId && resource.status.phase !== "converged")
      .sort((left, right) => left.metadata.id.localeCompare(right.metadata.id));
    return {
      live: candidates
        .slice(0, MAX_APP_TASK_LIVE_SNAPSHOT)
        .map((resource) => liveTaskSnapshotContext(tree, resource, projection.tasks[resource.metadata.id]?.readiness)),
      truncated: indexedIds.length > MAX_APP_TASK_LIVE_SNAPSHOT,
    };
  });
}

export function readAppTaskTrigger(
  config: ResourceTaskStateConfig,
  taskId: string,
): Record<string, unknown> | undefined {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const pending = tree.taskTriggers?.[taskId];
    if (pending) return structuredClone(pending.event);
    const resource = tree.resources?.[taskId];
    const attempt = resource ? currentResourceAttempt(tree, resource) : null;
    const trigger = attempt ? attemptTrigger(attempt) : undefined;
    return trigger ? structuredClone(trigger) : undefined;
  });
}

/** Return only a wake that is still pending beyond the active attempt. */
export function readPendingAppTaskTrigger(
  config: ResourceTaskStateConfig,
  taskId: string,
): Record<string, unknown> | undefined {
  return withTaskStateLock(config, () => {
    const event = config.resourceStore.readTrigger(taskId)?.event;
    return event ? structuredClone(event) : undefined;
  });
}

function resourceWrite(tree: TaskTree, resource: AppTaskResource, ready = false) {
  const nextCheckAt = taskConditionEntries(tree, resource.metadata.id)
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
    .sort((left, right) => left - right)[0];
  return {
    resource,
    ...(tree.taskTriggers?.[resource.metadata.id] ? { trigger: tree.taskTriggers[resource.metadata.id] } : {}),
    ready,
    nextCheckAt: nextCheckAt ?? null,
  };
}

/** Persist a wake observation for an existing task without resubmitting desired state. */
export function recordAppTaskTrigger(
  config: ResourceTaskStateConfig,
  taskId: string,
  event: Record<string, unknown>,
): { kind: "recorded" | "waiting" | "missing" } {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const resource = tree.resources?.[taskId];
    const task = tree.tasks[taskId];
    if (!resource || !task) return { kind: "missing" };
    if (
      resource.status.phase === "waiting" &&
      openTaskConditionIds(tree, task).length > 0 &&
      !hasSatisfiedTaskCondition(tree, taskId) &&
      !triggerOverridesWait(event)
    ) {
      return { kind: "waiting" };
    }
    const previous = tree.taskTriggers?.[taskId];
    const observedAt = new Date().toISOString();
    const events = appendTaskTriggerEvent(previous ? taskTriggerEvents(previous) : [], event, observedAt);
    const next = preferredTriggerFromEvents(events, task.owner ?? resource.spec.owner ?? "");
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
    saveTaskState(config, tree, {
      resourceMutation: {
        fences: [
          {
            taskId,
            resourceVersion: resource.metadata.resourceVersion,
            generation: resource.metadata.generation,
            currentAttemptId: resource.status.currentAttemptId ?? null,
          },
        ],
        tasks: [resourceWrite(tree, resource, true)],
      },
    });
    return { kind: "recorded" };
  });
}

function dependenciesSatisfied(tree: TaskTree, intent: AppTaskIntent): boolean {
  return [...(intent.dependsOn ?? [])].every((id) => {
    if (tree.receipts?.[id]) return true;
    const dependency = tree.resources?.[id];
    return Boolean(
      dependency?.status.phase === "converged" &&
      dependency.status.observedGeneration === dependency.metadata.generation,
    );
  });
}

function isRunnableOnPassiveResync(tree: TaskTree, resource: AppTaskResource): boolean {
  const task = tree.tasks[resource.metadata.id];
  if (!task) return false;
  const intent = resourceIntent(resource);
  if (!dependenciesSatisfied(tree, intent)) return false;
  if (currentResourceAttempt(tree, resource)) return false;
  const pendingTrigger = tree.taskTriggers?.[task.id]?.event;
  if (pendingTrigger) return true;
  if (resource.metadata.generation > resource.status.observedGeneration) return true;
  if (resource.status.phase === "pending") return true;
  if (resource.status.phase === "waiting") {
    if (hasSatisfiedTaskCondition(tree, task.id)) return true;
    if (missedTaskConditionCheckpointIds(tree, task.id).length > 0) return true;
    return liveChildTaskIds(tree, task).length === 0 && !(resource.status.conditionIds?.length ?? 0);
  }
  if (resource.status.phase === "attention") return needsAgentHandoff(tree, resource);
  if (resource.status.phase === "running") return true;
  return false;
}

function acknowledgeIndexedRecoveryWait(config: ResourceTaskStateConfig, taskId: string): void {
  // The indexed wake has been consumed and the Task is durably blocked. Its
  // dependency, child, or Condition transition will record the next exact
  // wake; leaving any recovery signal set would make safety recovery retry a no-op.
  config.resourceStore.setRecoveryState(taskId, {
    ready: false,
    changed: false,
    nextCheckAt: null,
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

export function listRunnableAppTaskQueueEntries(config: ResourceTaskStateConfig): AppTaskQueueEntry[] {
  return withTaskStateLock(config, () => {
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
  });
}

export function listRunnableAppTaskIds(config: ResourceTaskStateConfig): string[] {
  return listRunnableAppTaskQueueEntries(config).map((entry) => entry.taskId);
}

export function appTaskQueueEntries(config: ResourceTaskStateConfig, taskIds: Iterable<string>): AppTaskQueueEntry[] {
  const requested = new Set(taskIds);
  if (requested.size === 0) return [];
  return withTaskStateLock(config, () => {
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
  });
}

export type AppTaskHandlerRepairCandidate = {
  taskId: string;
  agent: string;
  workflow: string;
};

export type AppTaskExecutionRepairCandidate = {
  taskId: string;
  agent: string;
  failedAt: string;
  failureReason: "HandlerExecutionFailed" | "handler-blocked";
  sessionId?: string;
};

/** Bindings to retry once their owning app reload proves the workflow now resolves. */
export function listHandlerUnavailableAppTasks(
  config: ResourceTaskStateConfig,
  appAgent: string,
  candidateTaskIds: Iterable<string>,
): AppTaskHandlerRepairCandidate[] {
  return withTaskStateLock(config, () => {
    const candidates = [...candidateTaskIds];
    if (candidates.length === 0) return [];
    const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
    return Object.values(tree.resources ?? {})
      .filter((resource) => {
        if (resource.status.phase !== "attention" || !resource.spec.workflow?.trim()) return false;
        const attempt = latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation);
        return attempt?.handler.startsWith("workflow:") && attempt.failureReason === "HandlerUnavailable";
      })
      .map((resource) => {
        const intent = resourceIntent(resource);
        return {
          taskId: resource.metadata.id,
          agent: resolvedAgent(tree, intent, appAgent),
          workflow: intent.workflow!.trim(),
        };
      })
      .sort((left, right) => left.taskId.localeCompare(right.taskId));
  });
}

/** Release attention only after the host has proved the named workflow resolves again. */
export function releaseHandlerUnavailableAppTask(config: ResourceTaskStateConfig, taskId: string): boolean {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const resource = tree.resources?.[taskId];
    const task = tree.tasks[taskId];
    if (!resource || !task || resource.status.phase !== "attention") return false;
    const attempt = latestTaskAttempt(tree, taskId, resource.metadata.generation);
    if (!attempt?.handler.startsWith("workflow:") || attempt.failureReason !== "HandlerUnavailable") return false;
    const mutationScope = beginResourceMutationScopeForTasks(tree, [taskId]);
    const summary = `Workflow binding ${attempt.handler} resolved after app reload; retrying current task generation`;
    touchResource(resource, {
      phase: "pending",
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary,
      conditionIds: [],
    });
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
    return true;
  });
}

/** Executions to retry only after a later successful session proves their selected agent is runnable again. */
export function listHandlerExecutionFailedAppTasks(
  config: ResourceTaskStateConfig,
  candidateTaskIds: Iterable<string>,
): AppTaskExecutionRepairCandidate[] {
  const candidates = [...candidateTaskIds];
  if (candidates.length === 0) return [];
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: candidates });
    return Object.values(tree.resources ?? {})
      .flatMap((resource): AppTaskExecutionRepairCandidate[] => {
        if (resource.status.phase !== "attention") return [];
        const attempt = latestTaskAttempt(tree, resource.metadata.id, resource.metadata.generation);
        if (!attempt?.finishedAt) return [];
        if (attempt.failureReason === "HandlerExecutionFailed") {
          return [
            {
              taskId: resource.metadata.id,
              agent: attempt.owner,
              failedAt: attempt.finishedAt,
              failureReason: "HandlerExecutionFailed",
              ...(attempt.sessionId ? { sessionId: attempt.sessionId } : {}),
            },
          ];
        }
        // Compatibility for direct-agent failures recorded before execution
        // failures received their own structured reason. The loader must prove
        // the referenced session itself ended in error before releasing it.
        if (
          attempt.failureReason === "handler-blocked" &&
          isManagedAgentHandler(attempt.handler, attempt.owner) &&
          attempt.sessionId
        ) {
          return [
            {
              taskId: resource.metadata.id,
              agent: attempt.owner,
              failedAt: attempt.finishedAt,
              failureReason: "handler-blocked",
              sessionId: attempt.sessionId,
            },
          ];
        }
        return [];
      })
      .sort((left, right) => left.failedAt.localeCompare(right.failedAt) || left.taskId.localeCompare(right.taskId));
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
  config: ResourceTaskStateConfig,
  input: {
    appId: string;
    taskId: string;
    expectedGeneration: number;
  },
): AppTaskRetryReceipt {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [input.taskId] });
    const task = tree.tasks[input.taskId];
    const resource = tree.resources?.[input.taskId];
    if (!task || !resource) throw new Error(`Task ${input.appId}/${input.taskId} was not found`);
    if (resource.metadata.generation !== input.expectedGeneration) {
      throw new Error(
        `Task ${input.appId}/${input.taskId} generation changed: expected ${input.expectedGeneration}, current ${resource.metadata.generation}`,
      );
    }
    if (resource.status.phase !== "attention") {
      throw new Error(
        `Task ${input.appId}/${input.taskId} is not eligible for retry: phase is ${resource.status.phase}, expected attention`,
      );
    }
    const attempt = latestTaskAttempt(tree, input.taskId, input.expectedGeneration);
    if (!attempt || attempt.state !== "failed" || resource.status.currentAttemptId) {
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
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
    });
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
    return {
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
  });
}

/** Release one execution failure after structured evidence from a newer successful agent session. */
export function releaseHandlerExecutionFailedAppTask(
  config: ResourceTaskStateConfig,
  taskId: string,
  evidence: {
    agent: string;
    sessionId: string;
    observedAt: string;
    allowLegacyHandlerBlocked?: boolean;
  },
): boolean {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
    const resource = tree.resources?.[taskId];
    const task = tree.tasks[taskId];
    if (!resource || !task || resource.status.phase !== "attention") return false;
    const attempt = latestTaskAttempt(tree, taskId, resource.metadata.generation);
    if (!attempt?.finishedAt || attempt.owner !== evidence.agent) return false;
    const executionFailed = attempt.failureReason === "HandlerExecutionFailed";
    const legacyExecutionFailed =
      evidence.allowLegacyHandlerBlocked === true &&
      attempt.failureReason === "handler-blocked" &&
      isManagedAgentHandler(attempt.handler, attempt.owner) &&
      Boolean(attempt.sessionId);
    if (!executionFailed && !legacyExecutionFailed) return false;
    const repeatedExecutionFailure =
      executionFailed &&
      Object.values(tree.attempts ?? {}).filter(
        (candidate) =>
          candidate.taskId === taskId &&
          candidate.taskGeneration === resource.metadata.generation &&
          candidate.failureReason === "HandlerExecutionFailed",
      ).length > 1;
    // One later agent success is enough to prove that a transient agent/runtime
    // failure may be retried. Repeated task-specific failures require fresh
    // task input instead of being revived by unrelated successful agent work.
    if (repeatedExecutionFailure) return false;
    const observedAt = Date.parse(evidence.observedAt);
    const failedAt = Date.parse(attempt.finishedAt);
    if (!Number.isFinite(observedAt) || !Number.isFinite(failedAt) || observedAt <= failedAt) return false;
    const mutationScope = beginResourceMutationScopeForTasks(tree, [taskId]);
    const summary = `Agent ${evidence.agent} completed session ${evidence.sessionId} after the failed execution; retrying current task generation`;
    touchResource(resource, {
      phase: "pending",
      observedGeneration: Math.max(0, resource.metadata.generation - 1),
      currentAttemptId: undefined,
      summary,
      conditionIds: [],
    });
    // Replay the unaccepted attempt batch before any newer event that arrived
    // after the failed attempt; neither source may erase the other.
    restoreAttemptEvents(tree, taskId, resource, attempt, evidence.observedAt);
    syncTaskProjection(task, resource, attempt.owner);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, {
      resourceMutation: finishResourceMutationScope(mutationScope, tree),
    });
    return true;
  });
}

export function claimObservedAppTask(
  config: ResourceTaskStateConfig,
  input: {
    taskId: string;
    appAgent: string;
    handler: string;
    reason?: string;
    isAgentRunnable?: (agent: string) => boolean;
  },
): AppTaskClaimResult {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [input.taskId] });
    const task = tree.tasks[input.taskId];
    const resource = tree.resources?.[input.taskId];
    if (config.resourceStore.isCancelled(input.taskId)) {
      return {
        kind: "completed",
        taskId: input.taskId,
        generation: resource?.metadata.generation ?? tree.receipts?.[input.taskId]?.metadata.generation ?? 0,
      };
    }
    if (!task || !resource) {
      return {
        kind: "completed",
        taskId: input.taskId,
        generation: tree.receipts?.[input.taskId]?.metadata.generation ?? 0,
      };
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
    const completedReceipt = matchingCompletionReceipt(tree, resource, input.appAgent);
    if (completedReceipt) {
      retireCompletedTaskDuplicate(
        tree,
        resource,
        "Matching completion receipt already exists; retiring stale claim state",
      );
      saveTaskState(config, tree, {
        resourceMutation: finishResourceMutationScope(mutationScope, tree),
      });
      return {
        kind: "completed",
        taskId: input.taskId,
        generation: completedReceipt.metadata.generation,
      };
    }
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
      // This wake was evaluated and produced a durable attention result. Keeping
      // it pending would make passive resync immediately retry the same invalid
      // task forever; a later external wake can record a fresh trigger.
      if (tree.taskTriggers) delete tree.taskTriggers[task.id];
      touchResource(resource, {
        phase: "attention",
        observedGeneration: resource.metadata.generation,
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, agent);
      refreshActiveTaskProjection(tree);
      saveTaskState(config, tree, {
        resourceMutation: finishResourceMutationScope(mutationScope, tree),
      });
      return {
        kind: "attention",
        taskId: task.id,
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
    const handoffAttempt = agentHandoff ? latestAttempt : undefined;
    const recoveredSessionHandoff = !agentHandoff ? buildRecoveredSessionHandoff(config, latestAttempt) : undefined;
    const previousAttempt = currentResourceAttempt(tree, resource);
    if (resource.status.phase === "running" && !previousAttempt) {
      const now = new Date().toISOString();
      const attemptId = resource.status.currentAttemptId;
      const summary = attemptId
        ? `Running reconciliation ${task.id} referenced missing or non-running attempt ${attemptId}; retrying from current task evidence`
        : `Running reconciliation ${task.id} had no current attempt; retrying from current task evidence`;
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
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, agent);
      refreshActiveTaskProjection(tree);
    }
    const canRecoverPreviousRuntime = Boolean(
      previousAttempt &&
      previousAttempt.runtimeId !== reconcilerRuntimeId &&
      (input.reason === `attempt-recovery:${task.id}` || attemptTrigger(previousAttempt)),
    );
    const supersededSessionIds = new Set<string>();
    const pendingTrigger = tree.taskTriggers?.[task.id];
    const previousUnacceptedEvents =
      previousAttempt && previousAttempt.state !== "completed"
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
    const claimedEvents = pendingEvents.slice(0, MAX_TASK_EVENTS_PER_ATTEMPT);
    const remainingEvents = pendingEvents.slice(MAX_TASK_EVENTS_PER_ATTEMPT);
    const hasTrigger = Boolean(
      pendingTrigger?.event ?? (previousAttempt ? attemptTrigger(previousAttempt) : undefined),
    );
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
        observedGeneration: Math.max(0, resource.metadata.generation - 1),
        currentAttemptId: undefined,
        summary,
        conditionIds: [],
      });
      syncTaskProjection(task, resource, resolvedAgent(tree, intent, input.appAgent));
      refreshActiveTaskProjection(tree);
    }
    if (resource.status.phase === "running" && previousAttempt && !canRecoverPreviousRuntime) {
      return { kind: "busy", taskId: task.id, attemptId: previousAttempt.metadata.id };
    }
    if (
      resource.status.phase === "converged" &&
      resource.status.observedGeneration >= resource.metadata.generation &&
      !pendingTrigger
    ) {
      return {
        kind: "completed",
        taskId: task.id,
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
        taskId: task.id,
        generation: resource.metadata.generation,
        summary: resource.status.summary ?? "Task is waiting for agent/reviewer attention",
      };
    }
    const dependencyIds = [...(intent.dependsOn ?? [])].filter((id) => {
      if (tree.receipts?.[id]) return false;
      const dependency = tree.resources?.[id];
      return !(
        dependency?.status.phase === "converged" &&
        dependency.status.observedGeneration === dependency.metadata.generation
      );
    });
    if (dependencyIds.length > 0) {
      acknowledgeIndexedRecoveryWait(config, task.id);
      return { kind: "waiting", taskId: task.id, conditionIds: [], dependencyIds };
    }

    if (resource.metadata.generation > resource.status.observedGeneration && resource.status.conditionIds?.length) {
      unlinkTaskConditions(tree, task);
    }
    const openConditionIds = openTaskConditionIds(tree, task);
    const hasSatisfiedCondition = hasSatisfiedTaskCondition(tree, task.id);
    const missedCheckpointConditionIds = missedTaskConditionCheckpointIds(tree, task.id);
    const conditionReviewAttempt =
      missedCheckpointConditionIds.length > 0
        ? Math.max(
            ...missedCheckpointConditionIds.map(
              (conditionId) => completedConditionReviewCount(tree, task.id, conditionId) + 1,
            ),
          )
        : 0;
    const childIds = liveChildTaskIds(tree, task);
    if (
      resource.status.phase === "waiting" &&
      childIds.length > 0 &&
      !pendingTrigger &&
      !hasSatisfiedCondition &&
      missedCheckpointConditionIds.length === 0
    ) {
      acknowledgeIndexedRecoveryWait(config, task.id);
      return { kind: "waiting", taskId: task.id, conditionIds: openConditionIds, childIds };
    }
    if (
      resource.status.phase === "waiting" &&
      openConditionIds.length > 0 &&
      !pendingTrigger &&
      !hasSatisfiedCondition &&
      missedCheckpointConditionIds.length === 0
    ) {
      acknowledgeIndexedRecoveryWait(config, task.id);
      return { kind: "waiting", taskId: task.id, conditionIds: openConditionIds };
    }

    if (resource.status.phase === "waiting" && hasSatisfiedCondition) {
      // Consume only the Conditions represented by this attempt. Other waits
      // stay linked while it runs so a later matching fact can still find the
      // task and remain pending for the next attempt.
      unlinkSatisfiedTaskConditions(tree, task);
    }

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
            ...syntheticAttemptTrigger(config, task.id, "condition-review-checkpoint-missed"),
            type: "project.task.condition-review.missed",
            data: {
              project: projectIdFromAppDir(config.appDir) || "unknown-app",
              taskId: task.id,
              task_id: task.id,
              reason: "condition-review-checkpoint-missed",
              conditionIds: missedCheckpointConditionIds,
              reviewAttempt: conditionReviewAttempt,
              finalReview: conditionReviewAttempt >= MAX_UNCHANGED_CONDITION_REVIEWS,
              synthetic: "controller-review-trigger",
            },
          }
        : syntheticAttemptTrigger(config, task.id, input.reason));
    const specHash = appTaskSpecHash(intent, agent);
    const attempt: AppTaskAttempt = {
      metadata: { id: attemptId, resourceVersion: 1 },
      taskId: task.id,
      taskGeneration: generation,
      specHash,
      owner: agent,
      handler,
      runtimeId: reconcilerRuntimeId,
      state: "running",
      reason:
        missedCheckpointConditionIds.length > 0 ? "condition-review-checkpoint-missed" : (input.reason ?? "event"),
      ...(claimedEvents.length > 0 ? { events: structuredClone(claimedEvents) } : {}),
      ...(remainingEvents.length > 0 ? { eventsTruncated: true } : {}),
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
        tree.taskTriggers[task.id] = {
          ...pendingTrigger,
          event: structuredClone(preferredTriggerFromEvents(remainingEvents, agent)),
          events: structuredClone(remainingEvents),
          observedAt: remainingEvents[remainingEvents.length - 1]!.observedAt,
        };
      } else {
        delete tree.taskTriggers[task.id];
      }
    }
    touchResource(resource, {
      phase: "running",
      currentAttemptId: attemptId,
    });
    syncTaskProjection(task, resource, agent);
    refreshActiveTaskProjection(tree);
    const currentConditionIds = new Set(resource.status.conditionIds ?? []);
    const relevantConditionIds = new Set([...initialConditionIds, ...currentConditionIds]);
    saveTaskState(config, tree, {
      resourceMutation: {
        fences: [resourceFence],
        tasks: [resourceWrite(tree, resource, false)],
        attempts: [...changedAttempts],
        conditions: [...relevantConditionIds].flatMap((id) => (tree.conditions?.[id] ? [tree.conditions[id]] : [])),
        deleteConditionIds: [...relevantConditionIds].filter((id) => !tree.conditions?.[id]),
      },
    });
    return {
      kind: "claimed",
      taskId: task.id,
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
  });
}

function matchingTask(
  tree: TaskTree,
  claim: AppTaskClaim,
): { task: TaskNode; resource: AppTaskResource; attempt: AppTaskAttempt } | null {
  const task = tree.tasks[claim.taskId];
  if (!task) return null;
  const resource = tree.resources?.[claim.taskId];
  if (!resource || resource.metadata.generation !== claim.generation) return null;
  if (resource.status.currentAttemptId !== claim.attemptId) return null;
  const attempt = tree.attempts?.[claim.attemptId];
  if (
    !attempt ||
    attempt.state !== "running" ||
    attempt.taskGeneration !== claim.generation ||
    attempt.handler !== claim.handler ||
    attempt.specHash !== claim.specHash
  ) {
    return null;
  }
  return { task, resource, attempt };
}

export function releaseStaleAppTaskResult(
  config: ResourceTaskStateConfig,
  claim: AppTaskClaim,
  summary = "Stale reconciliation result was rejected; retrying from current task evidence",
): { status: "released" | "superseded" | "missing"; taskId: string } {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const task = tree.tasks[claim.taskId];
    const resource = tree.resources?.[claim.taskId];
    if (!task || !resource) return { status: "missing", taskId: claim.taskId };
    if (resource.status.currentAttemptId !== claim.attemptId) {
      return { status: "superseded", taskId: claim.taskId };
    }
    const attempt = tree.attempts?.[claim.attemptId];
    if (!attempt || attempt.state !== "running") {
      return { status: "superseded", taskId: claim.taskId };
    }
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
    syncTaskProjection(task, resource, claim.agent);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, {
      resourceMutation: {
        fences: [
          {
            taskId: claim.taskId,
            resourceVersion: claim.resourceVersion,
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
  });
}

/** Attach observed workspace lineage to the current attempt without changing desired task state. */
export function recordAppTaskAttemptWorkspace(
  config: ResourceTaskStateConfig,
  claim: AppTaskClaim,
  workspace: AppTaskWorkspace,
): boolean {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const match = matchingTask(tree, claim);
    if (!match) return false;
    match.attempt.metadata.resourceVersion += 1;
    match.attempt.workspace = structuredClone(workspace);
    saveTaskState(config, tree, {
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
  });
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
export function renewAppTaskAttemptLease(
  config: ResourceTaskStateConfig,
  claim: AppTaskClaim,
  nowMs = Date.now(),
): boolean {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const match = matchingTask(tree, claim);
    if (!match) return false;
    match.attempt.metadata.resourceVersion += 1;
    refreshAttemptLease(match.attempt, match.attempt.sessionId, nowMs);
    saveTaskState(config, tree, {
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
  });
}

/** Attach the launched agent-session id and refresh the current attempt lease. */
export function recordAppTaskAttemptSession(
  config: ResourceTaskStateConfig,
  claim: AppTaskClaim,
  sessionId: string,
): boolean {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const match = matchingTask(tree, claim);
    if (!match) return false;
    if (match.attempt.sessionId === sessionId && match.attempt.lease) return true;
    match.attempt.metadata.resourceVersion += 1;
    match.attempt.sessionId = sessionId;
    refreshAttemptLease(match.attempt, sessionId);
    saveTaskState(config, tree, {
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
  });
}

/**
 * Associate a session launched inside a task workflow with the current
 * reconciliation attempt. The session-start notification can arrive after a
 * task revision, so stale bindings are rejected instead of reviving obsolete
 * work.
 */
export function associateAppTaskSession(
  config: ResourceTaskStateConfig,
  binding: { taskId: string; generation: number },
  sessionId: string,
): AppTaskSessionAssociation {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [binding.taskId] });
    const task = tree.tasks[binding.taskId];
    const resource = tree.resources?.[binding.taskId];
    if (!task || !resource) return { status: "missing", taskId: binding.taskId };
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
      saveTaskState(config, tree, {
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
  });
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

function mutableActionResource(
  tree: TaskTree,
  action: Exclude<AppTaskAction, { kind: "create-task" }>,
): { task: TaskNode; resource: AppTaskResource } {
  const task = tree.tasks[action.taskId];
  if (!task) throw new Error(`Handler action task not found: ${action.taskId}`);
  const resource = tree.resources?.[action.taskId];
  if (!resource) throw new Error(`Handler action resource not found: ${action.taskId}`);
  if (resource.metadata.generation !== action.expectedGeneration) {
    throw new AppTaskActionStaleError({
      taskId: action.taskId,
      expectedGeneration: action.expectedGeneration,
      currentGeneration: resource.metadata.generation,
    });
  }
  return { task, resource };
}

function actionTargetAlreadyReceipted(
  tree: TaskTree,
  action: Exclude<AppTaskAction, { kind: "create-task" }>,
): boolean {
  return Boolean(!tree.tasks[action.taskId] && !tree.resources?.[action.taskId] && tree.receipts?.[action.taskId]);
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
    if (!["create-task", "update-task", "close-task", "unblock-task"].includes(String(kind))) {
      throw new Error(`Handler result contains an unsupported action kind: ${String(kind)}`);
    }

    const action = rawAction as unknown as AppTaskAction;
    const identity = requireNonEmptyString(
      action.kind === "create-task" ? action.id : action.taskId,
      `Handler ${action.kind} action identity`,
    );
    if (identities.has(identity)) throw new Error(`Handler result contains multiple actions for ${identity}`);
    identities.add(identity);

    if (action.kind === "create-task") {
      requireNonEmptyString(action.parentId, `Handler create action ${action.id} parentId`);
      requireNonEmptyString(action.outcome, `Handler create action ${action.id} outcome`);
      if (!["achieve", "maintain"].includes(String(action.mode))) {
        throw new Error(`Handler create action ${action.id} requires mode achieve or maintain`);
      }
      requireStringList(action.outputs, `Handler create action ${action.id} outputs`, true);
      resolveAppTaskOutputPaths(action.outputs, paths);
      requireStringList(action.acceptance, `Handler create action ${action.id} acceptance`);
      if (action.priority !== undefined && !["P0", "P1", "P2", "P3"].includes(action.priority)) {
        throw new Error(`Handler create action ${action.id} has an invalid priority`);
      }
      if (action.owner !== undefined) requireNonEmptyString(action.owner, `Handler create action ${action.id} owner`);
      if (action.workflow !== undefined) {
        requireValidTaskWorkflow(action.workflow, `Handler create action ${action.id} workflow`);
      }
      validateIntent(createActionIntent(action));
      if (action.input !== undefined && !isRecord(action.input)) {
        throw new Error(`Handler create action ${action.id} input must be an object`);
      }
      if (
        action.dependsOn !== undefined &&
        (!Array.isArray(action.dependsOn) ||
          !action.dependsOn.every((entry) => typeof entry === "string" && entry.trim()))
      ) {
        throw new Error(`Handler create action ${action.id} dependsOn must contain non-empty strings`);
      }
      if (tree.receipts?.[action.id]) {
        throw new Error(`Handler action task already exists or completed: ${action.id}`);
      }
      if (tree.tasks[action.id] || tree.resources?.[action.id]) {
        if (createActionMatchesLiveTask(tree, action)) continue;
        throw new Error(`Handler action task already exists with a different specification: ${action.id}`);
      }
      validateParentReference(validationTree, action.id, action.parentId);
      const parent = validationTree.tasks[action.parentId];
      validationTree.tasks[action.id] = {
        id: action.id,
        parent_id: action.parentId,
        children: [],
        state: "backlog",
      };
      validationTree.resources = {
        ...(validationTree.resources ?? {}),
        [action.id]: {
          metadata: { id: action.id, generation: 1, resourceVersion: 1 },
          spec: resourceSpec({
            id: action.id,
            parentId: action.parentId,
            outcome: action.outcome.trim(),
            acceptance: [...action.acceptance],
            mode: action.mode,
            outputs: [...action.outputs],
            priority: action.priority,
            ...(action.owner ? { owner: action.owner } : {}),
            ...(action.workflow ? { workflow: action.workflow } : {}),
            ...(action.executor ? { executor: action.executor } : {}),
            ...(action.input ? { input: structuredClone(action.input) } : {}),
            ...(action.dependsOn ? { dependsOn: [...action.dependsOn] } : {}),
            ...(action.category ? { category: action.category } : {}),
          }),
          status: { observedGeneration: 0, phase: "pending", updatedAt: "" },
        },
      };
      parent.children = [...new Set([...(parent.children ?? []), action.id])];
      continue;
    }

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
    if (action.kind === "close-task") {
      requireNonEmptyString(action.summary, `Handler close for ${action.taskId} summary`);
    }
    if (action.kind === "unblock-task") {
      requireNonEmptyString(action.reason, `Handler unblock for ${action.taskId} reason`);
    }
    if (actionTargetAlreadyReceipted(validationTree, action)) {
      if (action.kind === "close-task") continue;
      throw new Error(
        `Handler ${action.kind} action cannot mutate completed task ${action.taskId}; create a new linked task`,
      );
    }
    const { task, resource } = mutableActionResource(validationTree, action);
    if (action.kind === "close-task") {
      const liveChildren = liveChildTaskIds(validationTree, task);
      if (liveChildren.length > 0) {
        throw new Error(
          `Handler close action cannot absorb ${task.id} while it has live children: ${liveChildren.slice(0, 8).join(", ")}${
            liveChildren.length > 8 ? ` (+${liveChildren.length - 8} more)` : ""
          }`,
        );
      }
    }
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
    if (action.kind === "update-task" && action.parentId !== undefined && action.parentId !== task.parent_id) {
      const previousParent = task.parent_id ? validationTree.tasks[task.parent_id] : undefined;
      if (previousParent) previousParent.children = (previousParent.children ?? []).filter((id) => id !== task.id);
      const nextParent = validationTree.tasks[action.parentId];
      nextParent.children = [...new Set([...(nextParent.children ?? []), task.id])];
      task.parent_id = action.parentId;
      if (resource.spec) resource.spec.parentId = action.parentId;
    }
    if (action.kind === "close-task") {
      const parent = task.parent_id ? validationTree.tasks[task.parent_id] : undefined;
      if (parent) parent.children = (parent.children ?? []).filter((id) => id !== task.id);
      delete validationTree.tasks[task.id];
      delete validationTree.resources?.[task.id];
    }
  }
}

function taskActionContextIds(actions: unknown[]): string[] {
  return actions.flatMap((rawAction) => {
    if (!isRecord(rawAction)) return [];
    const values =
      rawAction.kind === "create-task"
        ? [rawAction.id, rawAction.parentId, ...(Array.isArray(rawAction.dependsOn) ? rawAction.dependsOn : [])]
        : rawAction.kind === "update-task"
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
    if (
      condition.reviewAfterMs !== undefined &&
      (!Number.isInteger(condition.reviewAfterMs) ||
        Number(condition.reviewAfterMs) < MIN_APP_TASK_CONDITION_REVIEW_AFTER_MS)
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
  evidence: string[],
  config: TaskStateConfig,
  acceptanceBasis: AppTaskAcceptanceBasis,
): { actionsApplied: string[]; supersededSessionIds: string[] } {
  validateTaskActions(tree, actions, config);
  const now = new Date().toISOString();
  const applied: string[] = [];
  const supersededSessionIds = new Set<string>();

  for (const action of actions) {
    if (action.kind !== "create-task" && action.taskId === claim.taskId && action.kind !== "update-task") {
      throw new Error(`Handler action cannot mutate its own running task ${claim.taskId}`);
    }
    if (action.kind === "close-task" && actionTargetAlreadyReceipted(tree, action)) {
      applied.push(`already completed ${action.taskId}`);
      continue;
    }

    switch (action.kind) {
      case "create-task": {
        if (createActionMatchesLiveTask(tree, action)) {
          applied.push(`already exists ${action.id}`);
          break;
        }
        const parent = tree.tasks[action.parentId];
        const intent = createActionIntent(action);
        const resource: AppTaskResource = {
          metadata: { id: action.id, generation: 1, resourceVersion: 1 },
          spec: resourceSpec(intent),
          status: {
            observedGeneration: 0,
            phase: "pending",
            updatedAt: now,
          },
        };
        const task: TaskNode = {
          id: action.id,
          parent_id: action.parentId,
          children: [],
          state: "backlog",
        };
        tree.resources = { ...(tree.resources ?? {}), [action.id]: resource };
        tree.tasks[action.id] = task;
        parent.children = [...new Set([...(parent.children ?? []), action.id])];
        syncTaskProjection(task, resource, action.owner ?? claim.agent);
        applied.push(`created ${task.id}`);
        break;
      }
      case "update-task": {
        const { task, resource } = mutableActionResource(tree, action);
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
        const currentAgent = resolvedAgent(tree, current, config.worker);
        const nextAgent = resolvedAgent(tree, nextIntent, config.worker);
        const executionChanged = appTaskSpecHash(current, currentAgent) !== appTaskSpecHash(nextIntent, nextAgent);
        const generation = executionChanged ? resource.metadata.generation + 1 : resource.metadata.generation;
        if (executionChanged) {
          if (resource.status.currentAttemptId) {
            const supersededSessionId = tree.attempts?.[resource.status.currentAttemptId]?.sessionId;
            if (action.taskId !== claim.taskId && supersededSessionId) {
              supersededSessionIds.add(supersededSessionId);
            }
            finishAttempt(
              tree,
              resource,
              action.taskId === claim.taskId ? "completed" : "interrupted",
              action.taskId === claim.taskId
                ? "Current handler revised the task execution intent"
                : "Task execution intent changed by reconciliation action",
              now,
            );
          }
          unlinkTaskConditions(tree, task);
        }
        const previousParentId = task.parent_id;
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
        tree.resources![task.id] = nextResource;
        syncTaskProjection(task, nextResource, nextAgent);
        if (previousParentId && previousParentId !== nextIntent.parentId) {
          const previousParent = tree.tasks[previousParentId];
          if (previousParent) previousParent.children = (previousParent.children ?? []).filter((id) => id !== task.id);
          const nextParent = tree.tasks[nextIntent.parentId];
          nextParent.children = [...new Set([...(nextParent.children ?? []), task.id])];
        }
        applied.push(`updated ${task.id}`);
        break;
      }
      case "close-task": {
        const { task, resource } = mutableActionResource(tree, action);
        const intent = resourceIntent(resource);
        unlinkTaskConditions(tree, task);
        if (resource.status.currentAttemptId) {
          const supersededSessionId = tree.attempts?.[resource.status.currentAttemptId]?.sessionId;
          if (supersededSessionId) supersededSessionIds.add(supersededSessionId);
          finishAttempt(tree, resource, "interrupted", action.summary.trim(), now);
        }
        const failureFingerprints = [
          ...new Set(
            Object.values(tree.attempts ?? {})
              .filter((attempt) => attempt.taskId === task.id && attempt.failureReason)
              .map((attempt) => String(attempt.failureReason)),
          ),
        ];
        tree.receipts = {
          ...(tree.receipts ?? {}),
          [task.id]: {
            metadata: {
              id: task.id,
              generation: resource.metadata.generation,
              resourceVersion: 1,
            },
            specHash: appTaskSpecHash(intent, intent.owner ?? task.owner ?? claim.agent),
            parentId: intent.parentId,
            outcome: intent.outcome,
            acceptance: [...intent.acceptance],
            owner: intent.owner ?? task.owner ?? claim.agent,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
            ...(intent.executor ? { executor: intent.executor } : {}),
            input: structuredClone(intent.input ?? {}),
            ...(intent.priority ? { priority: intent.priority } : {}),
            handler: claim.handler,
            summary: action.summary.trim(),
            evidence: [...evidence],
            acceptanceBasis: structuredClone(acceptanceBasis),
            failureFingerprints,
            completedAt: now,
            ...(latestTaskAttempt(tree, task.id, resource.metadata.generation)?.workspace
              ? {
                  workspace: structuredClone(
                    latestTaskAttempt(tree, task.id, resource.metadata.generation)!.workspace!,
                  ),
                }
              : {}),
          },
        };
        const parent = task.parent_id ? tree.tasks[task.parent_id] : undefined;
        if (parent) parent.children = (parent.children ?? []).filter((id) => id !== task.id);
        delete tree.tasks[task.id];
        delete tree.resources?.[task.id];
        delete tree.taskTriggers?.[task.id];
        applied.push(`closed ${task.id}`);
        break;
      }
      case "unblock-task": {
        const { task, resource } = mutableActionResource(tree, action);
        unlinkTaskConditions(tree, task);
        touchResource(resource, {
          phase: "pending",
          observedGeneration: Math.max(0, resource.metadata.generation - 1),
          currentAttemptId: undefined,
          summary: action.reason.trim(),
          conditionIds: [],
        });
        syncTaskProjection(task, resource, resource.spec.owner ?? task.owner ?? claim.agent);
        applied.push(`unblocked ${task.id}`);
        break;
      }
    }
  }
  return { actionsApplied: applied, supersededSessionIds: [...supersededSessionIds] };
}

function liveChildTaskIds(tree: TaskTree, task: TaskNode): string[] {
  return (task.children ?? []).filter((childId) => Boolean(tree.tasks[childId]));
}

function recordExecutableParentTrigger(
  tree: TaskTree,
  child: TaskNode,
  disposition: "converged" | "attention",
  summary: string,
  evidence: string[] | undefined,
  now: string,
): string | undefined {
  const parentTaskId = child.parent_id ?? undefined;
  if (!parentTaskId) return undefined;
  const parent = tree.resources?.[parentTaskId];
  if (!parent) return undefined;
  const previous = tree.taskTriggers?.[parentTaskId];
  const event: Record<string, unknown> = {
    type: "project.task.child-transitioned",
    source: APP_TASK_RECOVERY_OWNER,
    target: { taskId: parentTaskId },
    taskId: parentTaskId,
    childTaskId: child.id,
    disposition,
    summary,
    evidence: [...(evidence ?? [])],
  };
  const events = appendTaskTriggerEvent(previous ? taskTriggerEvents(previous) : [], event, now);
  tree.taskTriggers = {
    ...(tree.taskTriggers ?? {}),
    [parentTaskId]: {
      taskId: parentTaskId,
      taskGeneration: parent.metadata.generation,
      resourceVersion: (previous?.resourceVersion ?? 0) + 1,
      events,
      event: structuredClone(preferredTriggerFromEvents(events, parent.spec.owner ?? "")),
      observedAt: now,
    },
  };
  return parentTaskId;
}

type ResourceMutationScope = {
  taskIds: Set<string>;
  originalTaskIds: Set<string>;
  createdTaskIds: Set<string>;
  conditionIds: Set<string>;
  attemptIds: Set<string>;
  groupIds: Set<string>;
  receiptIds: Set<string>;
  fences: Array<{
    taskId: string;
    resourceVersion: number;
    generation: number;
    currentAttemptId: string | null;
  }>;
};

function emptyResourceMutationScope(): ResourceMutationScope {
  return {
    taskIds: new Set(),
    originalTaskIds: new Set(),
    createdTaskIds: new Set(),
    conditionIds: new Set(),
    attemptIds: new Set(),
    groupIds: new Set(),
    receiptIds: new Set(),
    fences: [],
  };
}

function beginResourceMutationScopeForTasks(tree: TaskTree, taskIds: Iterable<string>): ResourceMutationScope {
  const scope = emptyResourceMutationScope();
  for (const taskId of taskIds) trackResourceMutationTask(scope, tree, taskId);
  return scope;
}

function beginResourceMutationScope(
  tree: TaskTree,
  claim: AppTaskClaim,
  actions: AppTaskAction[],
): ResourceMutationScope {
  const scope = emptyResourceMutationScope();
  const track = (taskId: string | undefined) => trackResourceMutationTask(scope, tree, taskId);
  track(claim.taskId);
  track(tree.resources?.[claim.taskId]?.spec.parentId);
  for (const action of actions) {
    if (action.kind === "create-task") {
      if (!tree.resources?.[action.id] && !tree.receipts?.[action.id]) scope.createdTaskIds.add(action.id);
      track(action.id);
      track(action.parentId);
    } else {
      track(action.taskId);
      if (action.kind === "update-task") track(action.parentId);
    }
  }
  return scope;
}

function trackResourceMutationTask(scope: ResourceMutationScope, tree: TaskTree, taskId: string | undefined): void {
  if (!taskId) return;
  scope.taskIds.add(taskId);
  const resource = tree.resources?.[taskId];
  if (!resource) return;
  if (!scope.createdTaskIds.has(taskId) && !scope.fences.some((candidate) => candidate.taskId === taskId)) {
    scope.originalTaskIds.add(taskId);
    scope.fences.push({
      taskId,
      resourceVersion: resource.metadata.resourceVersion,
      generation: resource.metadata.generation,
      currentAttemptId: resource.status.currentAttemptId ?? null,
    });
  }
  for (const id of resource.status.conditionIds ?? []) scope.conditionIds.add(id);
  for (const attempt of Object.values(tree.attempts ?? {})) {
    if (attempt.taskId === taskId) scope.attemptIds.add(attempt.metadata.id);
  }
  scope.receiptIds.add(taskId);
  const parentId = tree.tasks[taskId]?.parent_id ?? resource.spec.parentId;
  if (parentId && tree.groups?.[parentId]) scope.groupIds.add(parentId);
}

function finishResourceMutationScope(scope: ResourceMutationScope, tree: TaskTree) {
  for (const taskId of scope.taskIds) trackResourceMutationTask(scope, tree, taskId);
  const tasks = [...scope.taskIds].flatMap((taskId) => {
    const resource = tree.resources?.[taskId];
    return resource ? [resourceWrite(tree, resource, isRunnableOnPassiveResync(tree, resource))] : [];
  });
  const receipts = [...scope.taskIds].flatMap((taskId) => (tree.receipts?.[taskId] ? [tree.receipts[taskId]] : []));
  return {
    fences: scope.fences,
    expectMissingTaskIds: [...scope.createdTaskIds].filter((taskId) => !scope.originalTaskIds.has(taskId)),
    tasks,
    deleteTaskIds: [...scope.originalTaskIds].filter((taskId) => !tree.resources?.[taskId]),
    attempts: [...scope.attemptIds].flatMap((id) => (tree.attempts?.[id] ? [tree.attempts[id]] : [])),
    conditions: [...scope.conditionIds].flatMap((id) => (tree.conditions?.[id] ? [tree.conditions[id]] : [])),
    deleteConditionIds: [...scope.conditionIds].filter((id) => !tree.conditions?.[id]),
    receipts,
    deleteReceiptIds: [...scope.receiptIds].filter((id) => !tree.receipts?.[id]),
    groups: [...scope.groupIds].flatMap((id) => (tree.groups?.[id] ? [tree.groups[id]] : [])),
    deleteGroupIds: [...scope.groupIds].filter((id) => !tree.groups?.[id]),
  };
}

export function completeAppTask(
  config: ResourceTaskStateConfig,
  claim: AppTaskClaim,
  input: {
    summary: string;
    response?: string;
    result?: Record<string, unknown>;
    evidence?: string[];
    actions?: AppTaskAction[];
    acceptanceBasis?: AppTaskAcceptanceBasis;
    acceptedLiveEventIds?: number[];
  },
): {
  status: "applied" | "stale";
  actionsApplied: string[];
  dependentTaskIds: string[];
  supersededSessionIds: string[];
  taskContinues?: true;
} {
  return withTaskStateLock(config, () => {
    const actions = input.actions ?? [];
    const tree = config.resourceStore.readTaskContext({
      taskIds: [claim.taskId, ...taskActionContextIds(actions)],
    });
    const match = matchingTask(tree, claim);
    if (!match) {
      return {
        status: "stale",
        actionsApplied: [],
        dependentTaskIds: [],
        supersededSessionIds: [],
      };
    }
    const { task, resource } = match;
    if (actions.length > 0 && hasUnacceptedLiveTaskEvents(tree, task.id, input.acceptedLiveEventIds)) {
      throw new AppTaskActionStaleError({
        taskId: task.id,
        expectedGeneration: claim.generation,
        currentGeneration: resource.metadata.generation,
        currentPhase: resource.status.phase,
        reason: "newer Task evidence is pending",
      });
    }
    validateActionEvidence(claim.taskId, input.evidence, input.actions?.length ?? 0);
    const selfUpdates = actions.filter(
      (action): action is Extract<AppTaskAction, { kind: "update-task" }> =>
        action.kind === "update-task" && action.taskId === claim.taskId,
    );
    if (selfUpdates.length > 0 && actions.length !== 1) {
      throw new Error(`Handler self-update for ${claim.taskId} must be the only reconciliation action`);
    }
    const acceptanceBasis = input.acceptanceBasis ?? defaultTaskAcceptance(claim, input.evidence ?? []);
    const mutationScope = beginResourceMutationScope(tree, claim, actions);
    const { actionsApplied, supersededSessionIds } = applyTaskActions(
      tree,
      claim,
      actions,
      input.evidence ?? [],
      config,
      acceptanceBasis,
    );
    if (selfUpdates.length === 1) {
      const revised = tree.resources?.[claim.taskId];
      if (!revised || revised.metadata.generation <= claim.generation) {
        throw new Error(`Handler self-update for ${claim.taskId} must change task execution intent`);
      }
      refreshActiveTaskProjection(tree);
      saveTaskState(config, tree, { resourceMutation: finishResourceMutationScope(mutationScope, tree) });
      return {
        status: "applied",
        actionsApplied,
        dependentTaskIds: [claim.taskId],
        supersededSessionIds,
        taskContinues: true,
      };
    }
    const liveChildren = liveChildTaskIds(tree, task);
    if (claim.mode === "achieve" && liveChildren.length > 0) {
      throw new Error(
        `Task ${task.id} cannot converge while it has live children: ${liveChildren.slice(0, 8).join(", ")}${
          liveChildren.length > 8 ? ` (+${liveChildren.length - 8} more)` : ""
        }`,
      );
    }
    const now = new Date().toISOString();
    consumeAcceptedLiveTaskEvents(tree, task, resource, input.acceptedLiveEventIds);
    unlinkTaskConditions(tree, task);
    finishAttempt(tree, resource, "completed", input.summary, now);
    const reconcileActionTaskIds = actions.flatMap((action) =>
      action.kind === "create-task"
        ? [action.id]
        : action.kind === "update-task" || action.kind === "unblock-task"
          ? [action.taskId]
          : [],
    );
    const pendingSelfTrigger = Boolean(tree.taskTriggers?.[task.id]?.event);
    const satisfiedTaskIds = [
      ...(claim.mode === "achieve" && !pendingSelfTrigger ? [task.id] : []),
      ...actions.filter((action) => action.kind === "close-task").map((action) => action.taskId),
    ];
    const parentTaskId =
      claim.mode === "maintain" || !pendingSelfTrigger
        ? recordExecutableParentTrigger(tree, task, "converged", input.summary, input.evidence, now)
        : undefined;
    trackResourceMutationTask(mutationScope, tree, parentTaskId);
    const maintainHasLiveChildren = claim.mode === "maintain" && liveChildren.length > 0;
    const dependentTaskIds = [
      ...new Set([
        ...reconcileActionTaskIds,
        ...(pendingSelfTrigger ? [task.id] : []),
        ...(parentTaskId ? [parentTaskId] : []),
        ...Object.values(tree.resources ?? {})
          .filter((candidate) => candidate.spec.dependsOn?.some((id) => satisfiedTaskIds.includes(id)))
          .map((candidate) => candidate.metadata.id),
      ]),
    ];
    for (const dependentTaskId of dependentTaskIds) {
      trackResourceMutationTask(mutationScope, tree, dependentTaskId);
    }
    if (claim.mode === "maintain" || pendingSelfTrigger) {
      touchResource(resource, {
        phase: pendingSelfTrigger
          ? "pending"
          : claim.mode === "maintain" && maintainHasLiveChildren
            ? "waiting"
            : "converged",
        observedGeneration: claim.generation,
        observedAttemptId: claim.attemptId,
        currentAttemptId: undefined,
        summary: input.summary,
        response: input.response,
        result: input.result ? structuredClone(input.result) : undefined,
        evidence: [...(input.evidence ?? [])],
        conditionIds: [],
      });
      syncTaskProjection(task, resource, claim.agent);
    } else {
      const intent = resourceIntent(resource);
      const failureFingerprints = [
        ...new Set(
          Object.values(tree.attempts ?? {})
            .filter((attempt) => attempt.taskId === task.id && attempt.failureReason)
            .map((attempt) => String(attempt.failureReason)),
        ),
      ];
      tree.receipts = {
        ...(tree.receipts ?? {}),
        [task.id]: {
          metadata: {
            id: task.id,
            generation: claim.generation,
            resourceVersion: 1,
          },
          specHash: claim.specHash,
          parentId: intent.parentId,
          outcome: intent.outcome,
          acceptance: [...intent.acceptance],
          owner: claim.agent,
          ...(intent.workflow ? { workflow: intent.workflow } : {}),
          ...(intent.executor ? { executor: intent.executor } : {}),
          input: structuredClone(intent.input ?? {}),
          ...(intent.priority ? { priority: intent.priority } : {}),
          handler: claim.handler,
          summary: input.summary,
          ...(input.response ? { response: input.response } : {}),
          ...(input.result ? { result: structuredClone(input.result) } : {}),
          evidence: [...(input.evidence ?? [])],
          acceptanceBasis: structuredClone(acceptanceBasis),
          failureFingerprints,
          completedAt: now,
          ...(match.attempt.workspace ? { workspace: structuredClone(match.attempt.workspace) } : {}),
        },
      };
      const parent = task.parent_id ? tree.tasks[task.parent_id] : undefined;
      if (parent) parent.children = (parent.children ?? []).filter((id) => id !== task.id);
      delete tree.tasks[task.id];
      if (tree.resources) delete tree.resources[task.id];
      if (tree.taskTriggers) delete tree.taskTriggers[task.id];
    }
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, { resourceMutation: finishResourceMutationScope(mutationScope, tree) });
    return {
      status: "applied",
      actionsApplied,
      dependentTaskIds,
      supersededSessionIds,
      ...(pendingSelfTrigger || (claim.mode === "maintain" && maintainHasLiveChildren)
        ? { taskContinues: true as const }
        : {}),
    };
  });
}

export function deferAppTask(
  config: ResourceTaskStateConfig,
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
  },
): {
  status: "applied" | "stale";
  actionsApplied: string[];
  reconcileTaskIds: string[];
  supersededSessionIds: string[];
} {
  return withTaskStateLock(config, () => {
    const actions = input.actions ?? [];
    const tree = config.resourceStore.readTaskContext({
      taskIds: [claim.taskId, ...taskActionContextIds(actions)],
      conditionIds: (input.conditions as unknown[] | undefined)?.flatMap((condition) =>
        isRecord(condition) && typeof condition.id === "string" && condition.id.trim() ? [condition.id] : [],
      ),
    });
    const match = matchingTask(tree, claim);
    if (!match) return { status: "stale", actionsApplied: [], reconcileTaskIds: [], supersededSessionIds: [] };
    const { task, resource } = match;
    if (actions.length > 0 && hasUnacceptedLiveTaskEvents(tree, task.id, input.acceptedLiveEventIds)) {
      throw new AppTaskActionStaleError({
        taskId: task.id,
        expectedGeneration: claim.generation,
        currentGeneration: resource.metadata.generation,
        currentPhase: resource.status.phase,
        reason: "newer Task evidence is pending",
      });
    }
    consumeAcceptedLiveTaskEvents(tree, task, resource, input.acceptedLiveEventIds);
    const conditions = boundedReviewConditions(claim, input.conditions);
    const waitsForChildren =
      liveChildTaskIds(tree, task).length > 0 ||
      actions.some((action) => action.kind === "create-task" && action.parentId === claim.taskId);
    const pendingTriggerRecord = tree.taskTriggers?.[task.id];
    const pendingEvents = pendingTriggerRecord ? taskTriggerEvents(pendingTriggerRecord) : [];
    const pendingTrigger = pendingTriggerRecord?.event;
    if (
      input.disposition === "waiting" &&
      !conditions?.length &&
      !waitsForChildren &&
      pendingTrigger?.type === "project.task.child-transitioned"
    ) {
      throw new AppTaskActionStaleError({
        taskId: claim.taskId,
        expectedGeneration: claim.generation,
        currentGeneration: resource.metadata.generation,
        currentPhase: resource.status.phase,
      });
    }
    validateConditions(conditions, {
      required: input.disposition === "waiting" && !waitsForChildren,
      taskId: claim.taskId,
    });
    validateActionEvidence(claim.taskId, input.evidence, actions.length);
    const acceptanceBasis = defaultTaskAcceptance(claim, input.evidence ?? []);
    const mutationScope = beginResourceMutationScope(tree, claim, actions);
    const { actionsApplied, supersededSessionIds } = applyTaskActions(
      tree,
      claim,
      actions,
      input.evidence ?? [],
      config,
      acceptanceBasis,
    );
    if (!conditions?.length && liveChildTaskIds(tree, task).length === 0) {
      throw new Error(`Waiting task ${claim.taskId} requires an exact Condition or live direct child`);
    }
    const now = new Date().toISOString();
    finishAttempt(tree, resource, "completed", input.summary, now);
    if (conditions?.length) {
      materializeWaitingConditions(tree, task, conditions, now);
    } else {
      unlinkTaskConditions(tree, task);
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
      ...(!conditions?.length ? { conditionIds: [] } : {}),
    });

    // A trigger can arrive while the attempt is running. Re-evaluate it against
    // the wait the attempt just installed instead of replaying it blindly. A
    // matching semantic observation wakes the task again; an unrelated stale
    // pulse is consumed. Explicit human/override triggers still bypass the wait.
    if (pendingEvents.length > 0) {
      delete tree.taskTriggers![task.id];
      for (const entry of pendingEvents.filter(({ event }) => !triggerOverridesWait(event))) {
        for (const wake of applyAppTaskConditionEvent(tree, entry.event)) {
          trackResourceMutationTask(mutationScope, tree, wake.taskId);
        }
      }
      for (const entry of pendingEvents.filter(({ event }) => triggerOverridesWait(event))) {
        const previous = tree.taskTriggers?.[task.id];
        const events = appendTaskTriggerEvent(
          previous ? taskTriggerEvents(previous) : [],
          entry.event,
          entry.observedAt,
        );
        tree.taskTriggers = {
          ...(tree.taskTriggers ?? {}),
          [task.id]: {
            taskId: task.id,
            taskGeneration: resource.metadata.generation,
            resourceVersion: (previous?.resourceVersion ?? 0) + 1,
            event: structuredClone(preferredTriggerFromEvents(events, claim.agent)),
            events,
            observedAt: entry.observedAt,
          },
        };
      }
    }
    syncTaskProjection(task, resource, claim.agent);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, { resourceMutation: finishResourceMutationScope(mutationScope, tree) });
    const satisfiedTaskIds = actions.filter((action) => action.kind === "close-task").map((action) => action.taskId);
    const reconcileTaskIds = [
      ...new Set([
        ...actions.flatMap((action) =>
          action.kind === "create-task"
            ? [action.id]
            : action.kind === "update-task" || action.kind === "unblock-task"
              ? [action.taskId]
              : [],
        ),
        ...Object.values(tree.resources ?? {})
          .filter((candidate) => candidate.spec.dependsOn?.some((id) => satisfiedTaskIds.includes(id)))
          .map((candidate) => candidate.metadata.id),
      ]),
    ];
    return { status: "applied", actionsApplied, reconcileTaskIds, supersededSessionIds };
  });
}

export function markAppTaskAttention(
  config: ResourceTaskStateConfig,
  claim: AppTaskClaim,
  input: {
    summary: string;
    reason: string;
    evidence?: string[];
    acceptedLiveEventIds?: number[];
    wakeParent?: boolean;
  },
): { status: "applied" | "stale"; parentTaskId?: string } {
  return withTaskStateLock(config, () => {
    const tree = config.resourceStore.readTaskContext({ taskIds: [claim.taskId] });
    const match = matchingTask(tree, claim);
    if (!match) return { status: "stale" };
    const { task, resource, attempt } = match;
    if (hasUnacceptedLiveTaskEvents(tree, task.id, input.acceptedLiveEventIds)) {
      throw new AppTaskActionStaleError({
        taskId: task.id,
        expectedGeneration: claim.generation,
        currentGeneration: resource.metadata.generation,
        currentPhase: resource.status.phase,
        reason: "newer Task evidence is pending",
      });
    }
    consumeAcceptedLiveTaskEvents(tree, task, resource, input.acceptedLiveEventIds);
    const mutationScope = beginResourceMutationScope(tree, claim, []);
    const now = new Date().toISOString();
    finishAttempt(tree, resource, "failed", input.summary, now);
    attempt.metadata.resourceVersion += 1;
    attempt.failureReason = input.reason;
    unlinkTaskConditions(tree, task);
    touchResource(resource, {
      phase: "attention",
      observedGeneration: claim.generation,
      currentAttemptId: undefined,
      summary: input.summary,
      evidence: [...(input.evidence ?? [])],
      conditionIds: [],
    });
    const parentTaskId =
      input.wakeParent === false
        ? undefined
        : recordExecutableParentTrigger(tree, task, "attention", input.summary, input.evidence, now);
    trackResourceMutationTask(mutationScope, tree, parentTaskId);
    syncTaskProjection(task, resource, claim.agent);
    refreshActiveTaskProjection(tree);
    saveTaskState(config, tree, { resourceMutation: finishResourceMutationScope(mutationScope, tree) });
    return { status: "applied", ...(parentTaskId ? { parentTaskId } : {}) };
  });
}
