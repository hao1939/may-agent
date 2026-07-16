import { createHash } from "node:crypto";
import {
  normalizeStringArray,
  taskState,
  type TaskNode,
  type TaskTree,
} from "./task-tree-store.ts";

export const PROJECT_SNAPSHOT_V2 = "project-snapshot-v2" as const;

export type SnapshotTaskState =
  "backlog" | "active" | "review" | "blocked" | "done";

export type SnapshotSession = {
  sessionId: string;
  status: string;
  startedAt: number | null;
  endedAt: number | null;
  lastActivityAt: number | null;
  outcome?: string | null;
  error?: string | null;
};

export type SnapshotAssignment = {
  taskId: string;
  taskRevision: number;
  attemptId: string;
  sessionId: string;
  worker: string;
  assignedAt: string;
};

export type SnapshotReview = {
  reviewId?: string;
  taskId: string;
  taskRevision: number;
  attemptId: string;
  decision: string;
  ts: string;
};

export type SnapshotDeliveryGap = {
  eventId: string;
  eventType: string;
  status: string;
  deliveryStatus: string;
  timestamp: number;
  taskId?: string;
  reason?: string;
};

export type SnapshotAttemptHeartbeat = {
  taskId: string;
  taskRevision: number;
  attemptId: string;
  sessionId: string | null;
  workflow: string;
  heartbeatAt: string;
};

export type SnapshotLoop = {
  taskId: string;
  workflow: string;
  statePath: string;
  stateExists: boolean;
  completionReady: boolean | null;
  stateCounts: Record<string, number>;
  nonTerminalCount: number;
  reportedUnrepresentedNonTerminalCount: number | null;
  updatedAt: string | null;
};

export type SnapshotSourceAvailabilityV2 = "available" | "unavailable";

export type SnapshotCoverageV2 = {
  tree: "available";
  assignments: SnapshotSourceAvailabilityV2;
  sessions: SnapshotSourceAvailabilityV2;
  reviews: SnapshotSourceAvailabilityV2;
  controllers: SnapshotSourceAvailabilityV2;
  controllerLiveness: SnapshotSourceAvailabilityV2;
  delivery: SnapshotSourceAvailabilityV2;
};

export type ProjectSnapshotV2Input = {
  projectId: string;
  tree: TaskTree;
  assignments?: SnapshotAssignment[];
  sessions?: SnapshotSession[];
  reviews?: SnapshotReview[];
  loops?: SnapshotLoop[];
  attemptHeartbeats?: SnapshotAttemptHeartbeat[];
  deliveryGaps?: SnapshotDeliveryGap[];
  sourceCoverage?: Partial<SnapshotCoverageV2>;
  nowMs?: number;
  sessionStartGraceMs?: number;
  staleNoActivityMs?: number;
  reviewGraceMs?: number;
  sourceMeta?: Record<
    string,
    {
      path: string;
      available: boolean;
      updatedAt?: string | null;
      size?: number | null;
      fingerprint?: string | null;
    }
  >;
};

export type WorkFrontierV2 = {
  roots: string[];
  runnable: string[];
  waiting: string[];
  active: string[];
  review: string[];
  blocked: string[];
  done: string[];
  counts: {
    total: number;
    leafTotal: number;
    runnable: number;
    waiting: number;
    active: number;
    review: number;
    blocked: number;
    backlog: number;
    done: number;
  };
  readiness: Record<string, string[]>;
};

export type AttemptProjectionV2 = {
  taskId: string;
  taskRevision: number;
  controlPlaneVersion: number;
  attemptId: string | null;
  sessionId: string | null;
  assignmentState: "queued" | "consumed" | "missing" | "unknown";
  runtimeState:
    "starting" | "running" | "stale" | "terminal" | "missing" | "unknown";
  sessionStatus: string | null;
  sessionOutcome: string | null;
  sessionError: string | null;
  assignedAt: string | null;
  lastActivityAt: string | null;
  reason: string;
};

export type ReviewProjectionV2 = {
  taskId: string;
  taskRevision: number;
  controlPlaneVersion: number;
  attemptId: string | null;
  completedAt: string | null;
  latestDecision: string | null;
  latestDecisionId: string | null;
  latestDecisionAt: string | null;
  deliveryState:
    "within-grace" | "missing" | "decision-pending-apply" | "unknown";
};

export type ConditionCandidateV2 = {
  id: string;
  causeKey: string;
  class: "prerequisite" | "approval" | "external" | "timer" | "invariant";
  type: string;
  status: "open" | "resolved";
  source: "legacy" | "registry";
  subject: {
    kind: "task";
    id: string;
    revision: number;
  };
  owner: string | null;
  observer: string | null;
  observationMethod: string | null;
  resumeCondition: string | null;
  resumeAt: string | null;
  nextCheckAt: string | null;
  fallbackAt: string | null;
  fallbackAction: string | null;
  waitingFor: Record<string, unknown> | null;
  issues: string[];
  legacyTaskId: string;
};

export type InvariantTypeV2 =
  | "tree-relationship-mismatch"
  | "assignment-state-mismatch"
  | "active-attempt-missing"
  | "active-attempt-stale"
  | "active-attempt-terminal"
  | "review-delivery-missing"
  | "review-decision-not-applied"
  | "blocked-condition-incomplete"
  | "resolved-condition-still-blocking"
  | "controller-record-unrepresented"
  | "continuation-delivery-gap";

export type InvariantFindingV2 = {
  type: InvariantTypeV2;
  recoveryKey: string;
  severity: "info" | "warning" | "critical";
  subject: { kind: string; id: string; revision?: number };
  message: string;
  taskIds: string[];
  automaticAction:
    | "none"
    | "reemit-assignment"
    | "recover-completion"
    | "reemit-review"
    | "reconcile-condition"
    | "pulse-controller";
};

export type MirrorDriftV2 = {
  available: boolean;
  active: { expected: string[]; actual: string[]; matches: boolean };
  review: { expected: string[]; actual: string[]; matches: boolean };
  waiting: { expected: string[]; actual: string[]; matches: boolean };
  runnable: { expected: string[]; actual: string[]; matches: boolean };
};

export type ProjectSnapshotV2 = {
  version: typeof PROJECT_SNAPSHOT_V2;
  projectId: string;
  capturedAt: string;
  treeUpdatedAt: string | null;
  coverage: SnapshotCoverageV2;
  sourceMeta: ProjectSnapshotV2Input["sourceMeta"];
  frontier: WorkFrontierV2;
  attempts: AttemptProjectionV2[];
  reviews: ReviewProjectionV2[];
  conditions: ConditionCandidateV2[];
  controllers: SnapshotLoop[];
  deliveryGaps: SnapshotDeliveryGap[];
  mirrorDrift: MirrorDriftV2;
  invariants: InvariantFindingV2[];
};

export type FrontierComparisonV2 = {
  matches: boolean;
  compatible: boolean;
  reason:
    "exact" | "current-truncated" | "current-structural-extra" | "mismatch";
  v2Only: string[];
  currentOnly: string[];
  ignoredCurrentOnly: string[];
};

type SnapshotCoverageKeyV2 = keyof SnapshotCoverageV2;

export const INVARIANT_SOURCE_REQUIREMENTS_V2: Record<
  InvariantTypeV2,
  readonly SnapshotCoverageKeyV2[]
> = {
  "tree-relationship-mismatch": ["tree"],
  "assignment-state-mismatch": ["tree", "assignments"],
  "active-attempt-missing": ["tree", "sessions", "controllerLiveness"],
  "active-attempt-stale": ["tree", "sessions", "controllerLiveness"],
  "active-attempt-terminal": ["tree", "sessions"],
  "review-delivery-missing": ["tree", "reviews"],
  "review-decision-not-applied": ["tree", "reviews"],
  "blocked-condition-incomplete": ["tree"],
  "resolved-condition-still-blocking": ["tree"],
  "controller-record-unrepresented": ["tree", "controllers"],
  "continuation-delivery-gap": ["delivery"],
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function textFrom(recordValue: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = text(recordValue[key]);
    if (value) return value;
  }
  return null;
}

function nestedRecord(
  recordValue: JsonRecord,
  ...keys: string[]
): JsonRecord | null {
  for (const key of keys) {
    const value = recordValue[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonRecord;
    }
  }
  return null;
}

function timestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function sameStrings(left: string[], right: string[]): boolean {
  const a = sortedUnique(left);
  const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function revision(task: TaskNode | undefined): number {
  const value = (task as (TaskNode & { revision?: unknown }) | undefined)
    ?.revision;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function taskById(tree: TaskTree, taskId: string): TaskNode | undefined {
  return (
    tree.tasks[taskId] ??
    Object.values(tree.tasks).find((task) => task.id === taskId)
  );
}

function derivedChildren(tree: TaskTree): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const task of Object.values(tree.tasks)) {
    const parentId = text(task.parent_id);
    if (!parentId) continue;
    result.set(parentId, [...(result.get(parentId) ?? []), task.id]);
  }
  for (const [parentId, children] of result) {
    result.set(parentId, sortedUnique(children));
  }
  return result;
}

function isExecutableKind(task: TaskNode): boolean {
  if (
    ["project", "work", "focus_plan", "durable_lane", "standing_task"].includes(
      String(task.kind ?? ""),
    )
  ) {
    return false;
  }
  return true;
}

function isClearEnough(task: TaskNode): boolean {
  return Boolean(
    text(task.goal) &&
    normalizeStringArray(task.acceptance).length > 0 &&
    normalizeStringArray(task.outputs).length > 0,
  );
}

function conflictOverlap(left: TaskNode, right: TaskNode): boolean {
  const leftScopes = new Set(normalizeStringArray(left.conflict_scope));
  return normalizeStringArray(right.conflict_scope).some((scope) =>
    leftScopes.has(scope),
  );
}

function readinessReasons(
  tree: TaskTree,
  task: TaskNode,
  children: Map<string, string[]>,
  activeTasks: TaskNode[],
): string[] {
  const reasons: string[] = [];
  if (taskState(task) !== "backlog") reasons.push(`state:${taskState(task)}`);
  if ((children.get(task.id) ?? []).length > 0) reasons.push("has-children");
  if (!isExecutableKind(task)) reasons.push(`kind:${String(task.kind ?? "")}`);
  if (!isClearEnough(task)) reasons.push("contract-incomplete");
  for (const dependencyId of normalizeStringArray(task.depends_on)) {
    if (taskState(taskById(tree, dependencyId)) !== "done") {
      reasons.push(`dependency:${dependencyId}`);
    }
  }
  for (const active of activeTasks) {
    if (active.id !== task.id && conflictOverlap(active, task)) {
      reasons.push(`conflict:${active.id}`);
    }
  }
  return sortedUnique(reasons);
}

function buildFrontier(tree: TaskTree): WorkFrontierV2 {
  const children = derivedChildren(tree);
  const taskIndex = new Map(
    Object.values(tree.tasks).map((task) => [task.id, task]),
  );
  const configuredRootId = text(tree.root_task_id);
  const roots =
    configuredRootId && taskIndex.has(configuredRootId)
      ? [configuredRootId]
      : Object.values(tree.tasks)
          .filter((task) => {
            const parentId = text(task.parent_id);
            return !parentId || !taskIndex.has(parentId);
          })
          .map((task) => task.id);
  const reachableIds = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const taskId = queue.shift();
    if (!taskId || reachableIds.has(taskId) || !taskIndex.has(taskId)) continue;
    reachableIds.add(taskId);
    queue.push(...(children.get(taskId) ?? []));
  }
  const reachableTasks = [...reachableIds].flatMap((taskId) => {
    const task = taskIndex.get(taskId);
    return task ? [task] : [];
  });
  const leafTasks = reachableTasks.filter(
    (task) => (children.get(task.id) ?? []).length === 0,
  );
  const activeTasks = leafTasks.filter(
    (task) => taskState(task) === "active" && isExecutableKind(task),
  );
  const readiness: Record<string, string[]> = {};
  const runnable: string[] = [];
  const waiting: string[] = [];
  const backlog: string[] = [];

  for (const task of leafTasks) {
    if (taskState(task) !== "backlog") continue;
    backlog.push(task.id);
    const reasons = readinessReasons(tree, task, children, activeTasks);
    readiness[task.id] = reasons;
    if (reasons.length === 0) runnable.push(task.id);
    else if (isExecutableKind(task)) {
      waiting.push(task.id);
    }
  }

  const active = activeTasks.map((task) => task.id);
  const review = leafTasks
    .filter((task) => taskState(task) === "review")
    .map((task) => task.id);
  const blocked = leafTasks
    .filter((task) => taskState(task) === "blocked")
    .map((task) => task.id);
  const done = leafTasks
    .filter((task) => taskState(task) === "done")
    .map((task) => task.id);

  return {
    roots: sortedUnique(roots),
    runnable: sortedUnique(runnable),
    waiting: sortedUnique(waiting),
    active: sortedUnique(active),
    review: sortedUnique(review),
    blocked: sortedUnique(blocked),
    done: sortedUnique(done),
    counts: {
      total: reachableTasks.length,
      leafTotal: leafTasks.length,
      runnable: runnable.length,
      waiting: waiting.length,
      active: active.length,
      review: review.length,
      blocked: blocked.length,
      backlog: backlog.length,
      done: done.length,
    },
    readiness,
  };
}

function blockerRecord(task: TaskNode): JsonRecord {
  return typeof task.blocker === "string"
    ? { condition: task.blocker }
    : record(task.blocker);
}

function waitIdentity(waitingFor: JsonRecord | null): string | null {
  if (!waitingFor) return null;
  const runId = textFrom(waitingFor, "runId", "run_id", "buildId", "build_id");
  if (runId) return `run:${runId}`;
  const escalationId = textFrom(waitingFor, "escalationId", "escalation_id");
  if (escalationId) return `escalation:${escalationId}`;
  const taskId = textFrom(waitingFor, "taskId", "task_id");
  if (taskId) return `task:${taskId}`;
  const id = text(waitingFor.id);
  return id ? `id:${id}` : null;
}

function conditionClass(type: string): ConditionCandidateV2["class"] {
  if (/approval|owner\.decision|human/i.test(type)) return "approval";
  if (/timer|time|resume-at/i.test(type)) return "timer";
  if (/invariant|integrity|missing|stale/i.test(type)) return "invariant";
  if (/pipeline|ado|github|event|response|resolved/i.test(type)) {
    return "external";
  }
  return "prerequisite";
}

function legacyCondition(task: TaskNode): ConditionCandidateV2 {
  const blocker = blockerRecord(task);
  const waitingFor = nestedRecord(blocker, "waiting_for", "waitingFor");
  const observedBy = nestedRecord(blocker, "observed_by", "observedBy");
  const type =
    textFrom(waitingFor ?? {}, "type") ??
    textFrom(blocker, "category") ??
    "legacy.blocker";
  const condition = textFrom(blocker, "condition");
  const owner = textFrom(blocker, "owner");
  const observer = observedBy
    ? textFrom(observedBy, "workflow", "agent", "owner", "trigger")
    : null;
  const observationMethod = textFrom(
    blocker,
    "observation_method",
    "observationMethod",
  );
  const resumeCondition =
    textFrom(blocker, "resume_condition", "resumeCondition") ?? condition;
  const resumeAt = textFrom(blocker, "resume_at", "resumeAt");
  const nextCheckAt = textFrom(blocker, "next_check_at", "nextCheckAt");
  const fallbackAt = textFrom(blocker, "fallback_at", "fallbackAt");
  const fallbackAction = textFrom(blocker, "fallback_action", "fallbackAction");
  const identity = waitIdentity(waitingFor);
  const causeKey = `${type}:${identity ?? `task:${task.id}`}`;
  const issues: string[] = [];
  if (!condition && !resumeCondition) issues.push("missing-condition");
  if (!owner) issues.push("missing-owner");
  if (!waitingFor) issues.push("missing-waiting-for");
  if (!observer) issues.push("missing-observer");
  if (!observationMethod) issues.push("missing-observation-method");
  if (!nextCheckAt && !resumeAt) issues.push("missing-next-check");
  if (!fallbackAt) issues.push("missing-fallback-at");
  if (!fallbackAction) issues.push("missing-fallback-action");

  return {
    id: `condition:${causeKey}`,
    causeKey,
    class: conditionClass(type),
    type,
    status: "open",
    source: "legacy",
    subject: { kind: "task", id: task.id, revision: revision(task) },
    owner,
    observer,
    observationMethod,
    resumeCondition,
    resumeAt,
    nextCheckAt,
    fallbackAt,
    fallbackAction,
    waitingFor,
    issues,
    legacyTaskId: task.id,
  };
}

function registeredCondition(value: unknown): ConditionCandidateV2 | null {
  const condition = record(value);
  if (condition.version !== "project-condition-v2") return null;
  const id = text(condition.id);
  const causeKey = text(condition.causeKey);
  const type = text(condition.type);
  const subject = record(condition.subject);
  const subjectId = text(subject.id);
  const subjectRevision =
    typeof subject.revision === "number" &&
    Number.isInteger(subject.revision) &&
    subject.revision >= 0
      ? subject.revision
      : null;
  if (!id || !causeKey || !type || !subjectId || subjectRevision === null) {
    return null;
  }
  const backend = text(condition.backend);
  const runId = text(condition.runId);
  const runUrl = text(condition.runUrl);
  return {
    id,
    causeKey,
    class: "external",
    type,
    status: condition.status === "resolved" ? "resolved" : "open",
    source: "registry",
    subject: { kind: "task", id: subjectId, revision: subjectRevision },
    owner: text(condition.owner),
    observer: text(condition.observer),
    observationMethod: text(condition.observationMethod),
    resumeCondition: text(condition.resumeCondition),
    resumeAt: null,
    nextCheckAt: text(condition.nextCheckAt),
    fallbackAt: text(condition.fallbackAt),
    fallbackAction: text(condition.fallbackAction),
    waitingFor: backend || runId || runUrl ? { backend, runId, runUrl } : null,
    issues: [],
    legacyTaskId: subjectId,
  };
}

function conditionIdFromBlocker(task: TaskNode): string | null {
  return textFrom(blockerRecord(task), "condition_id", "conditionId");
}

function taskTrace(task: TaskNode): JsonRecord {
  return record(task.trace);
}

function controlPlaneVersion(task: TaskNode): number {
  const value = record(task.context).controlPlaneVersion;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : 1;
}

function attemptId(task: TaskNode): string | null {
  return textFrom(taskTrace(task), "current_attempt_id", "currentAttemptId");
}

function assignmentForTask(
  assignments: SnapshotAssignment[],
  task: TaskNode,
): SnapshotAssignment | null {
  const currentAttemptId = attemptId(task);
  const sessionId = text(task.session_id);
  return (
    assignments.find(
      (assignment) =>
        assignment.taskId === task.id &&
        assignment.taskRevision === revision(task) &&
        (!currentAttemptId || assignment.attemptId === currentAttemptId) &&
        (!sessionId || assignment.sessionId === sessionId),
    ) ?? null
  );
}

function attemptHeartbeatForTask(
  heartbeats: SnapshotAttemptHeartbeat[],
  task: TaskNode,
): number | null {
  const currentAttemptId = attemptId(task);
  if (!currentAttemptId) return null;
  const currentSessionId = text(task.session_id);
  const matching = heartbeats
    .filter(
      (heartbeat) =>
        heartbeat.taskId === task.id &&
        heartbeat.taskRevision === revision(task) &&
        heartbeat.attemptId === currentAttemptId &&
        (!currentSessionId ||
          !heartbeat.sessionId ||
          heartbeat.sessionId === currentSessionId),
    )
    .map((heartbeat) => timestampMs(heartbeat.heartbeatAt))
    .filter((heartbeat): heartbeat is number => heartbeat !== null);
  return matching.length > 0 ? Math.max(...matching) : null;
}

function projectAttempts(input: {
  tree: TaskTree;
  frontier: WorkFrontierV2;
  assignments: SnapshotAssignment[];
  sessions: SnapshotSession[];
  attemptHeartbeats: SnapshotAttemptHeartbeat[];
  coverage: SnapshotCoverageV2;
  nowMs: number;
  startGraceMs: number;
  staleMs: number;
}): AttemptProjectionV2[] {
  const sessionById = new Map(
    input.sessions.map((session) => [session.sessionId, session]),
  );
  return input.frontier.active.map((taskId) => {
    const task = taskById(input.tree, taskId)!;
    const trace = taskTrace(task);
    const currentAttemptId = attemptId(task);
    const currentSessionId = text(task.session_id);
    const assignment = assignmentForTask(input.assignments, task);
    const assignedAt =
      assignment?.assignedAt ?? textFrom(trace, "assigned_at", "assignedAt");
    const session = currentSessionId
      ? (sessionById.get(currentSessionId) ?? null)
      : null;
    const heartbeat = attemptHeartbeatForTask(input.attemptHeartbeats, task);
    const sessionActivityAt =
      session?.lastActivityAt ?? session?.startedAt ?? null;
    const lastActivityAt =
      sessionActivityAt === null
        ? heartbeat
        : heartbeat === null
          ? sessionActivityAt
          : Math.max(sessionActivityAt, heartbeat);
    const ageSinceAssignment =
      assignedAt && timestampMs(assignedAt) !== null
        ? input.nowMs - (timestampMs(assignedAt) as number)
        : Number.POSITIVE_INFINITY;

    let runtimeState: AttemptProjectionV2["runtimeState"];
    let reason: string;
    const freshSession =
      session?.status === "running" &&
      sessionActivityAt !== null &&
      input.nowMs - sessionActivityAt <= input.staleMs;
    const freshHeartbeat =
      heartbeat !== null && input.nowMs - heartbeat <= input.staleMs;
    const negativeRuntimeCoverageComplete =
      input.coverage.sessions === "available" &&
      input.coverage.controllerLiveness === "available";

    if (freshSession) {
      runtimeState = "running";
      reason = "runtime session is running";
    } else if (freshHeartbeat) {
      runtimeState = "running";
      reason =
        "matching task revision and attempt controller heartbeat is fresh";
    } else if (assignedAt && ageSinceAssignment <= input.startGraceMs) {
      runtimeState = "starting";
      reason = "recorded assignment is within session-start grace";
    } else if (session && session.status !== "running") {
      runtimeState = "terminal";
      reason = `runtime session is terminal (${session.status})`;
    } else if (!negativeRuntimeCoverageComplete) {
      runtimeState = "unknown";
      reason = "runtime reconciliation sources are incomplete";
    } else if (session?.status === "running") {
      runtimeState = "stale";
      reason = "running session activity exceeded stale threshold";
    } else if (heartbeat !== null) {
      runtimeState = "stale";
      reason = "matching controller heartbeat exceeded stale threshold";
    } else {
      runtimeState = "missing";
      reason = "no viable runtime session or fresh loop heartbeat";
    }

    return {
      taskId,
      taskRevision: revision(task),
      controlPlaneVersion: controlPlaneVersion(task),
      attemptId: currentAttemptId,
      sessionId: currentSessionId,
      assignmentState: assignment
        ? "queued"
        : session
          ? "consumed"
          : input.coverage.assignments === "available"
            ? "missing"
            : "unknown",
      runtimeState,
      sessionStatus: session?.status ?? null,
      sessionOutcome: session?.outcome ?? null,
      sessionError: session?.error ?? null,
      assignedAt: assignedAt ?? null,
      lastActivityAt: iso(lastActivityAt),
      reason,
    };
  });
}

function latestReviewForTask(
  reviews: SnapshotReview[],
  taskId: string,
  taskRevision: number,
  currentAttemptId: string | null,
  notBeforeAt: string | null,
): SnapshotReview | null {
  const notBeforeMs = timestampMs(notBeforeAt);
  return (
    reviews
      .filter(
        (review) =>
          review.taskId === taskId &&
          review.taskRevision === taskRevision &&
          (!currentAttemptId || review.attemptId === currentAttemptId) &&
          (notBeforeMs === null ||
            (timestampMs(review.ts) ?? Number.NEGATIVE_INFINITY) >=
              notBeforeMs),
      )
      .sort((left, right) => Date.parse(right.ts) - Date.parse(left.ts))[0] ??
    null
  );
}

function reviewEpochAt(
  task: TaskNode,
  currentAttemptId: string | null,
): string | null {
  const trace = taskTrace(task);
  const terminalObservedAt = textFrom(
    trace,
    "terminal_wait_review_attempt_created_at",
    "terminalWaitReviewAttemptCreatedAt",
  );
  if (
    currentAttemptId?.includes("terminal_wait_review") &&
    terminalObservedAt
  ) {
    return terminalObservedAt;
  }
  const workerAttemptId = textFrom(
    trace,
    "worker_started_attempt_id",
    "workerStartedAttemptId",
  );
  if (!workerAttemptId || workerAttemptId === currentAttemptId) {
    return textFrom(trace, "last_worker_completed_at", "lastWorkerCompletedAt");
  }
  return null;
}

export function snapshotReviewIdentityV2(
  review: SnapshotReview | null,
): string | null {
  if (!review) return null;
  if (review.reviewId?.trim()) return review.reviewId.trim();
  return createHash("sha256")
    .update(
      JSON.stringify({
        taskId: review.taskId,
        taskRevision: review.taskRevision,
        attemptId: review.attemptId,
        decision: review.decision,
        ts: review.ts,
      }),
    )
    .digest("hex")
    .slice(0, 24);
}

function projectReviews(input: {
  tree: TaskTree;
  frontier: WorkFrontierV2;
  reviews: SnapshotReview[];
  reviewsAvailable: boolean;
  nowMs: number;
  reviewGraceMs: number;
}): ReviewProjectionV2[] {
  return input.frontier.review.map((taskId) => {
    const task = taskById(input.tree, taskId)!;
    const trace = taskTrace(task);
    const currentAttemptId =
      attemptId(task) ??
      textFrom(trace, "previous_attempt_id", "previousAttemptId");
    const completedAt = reviewEpochAt(task, currentAttemptId);
    const latest = latestReviewForTask(
      input.reviews,
      taskId,
      revision(task),
      currentAttemptId,
      completedAt,
    );
    const completedMs = timestampMs(completedAt);
    const withinGrace =
      completedMs !== null && input.nowMs - completedMs <= input.reviewGraceMs;
    const deliveryState: ReviewProjectionV2["deliveryState"] =
      !input.reviewsAvailable
        ? "unknown"
        : latest
          ? "decision-pending-apply"
          : withinGrace
            ? "within-grace"
            : "missing";
    return {
      taskId,
      taskRevision: revision(task),
      controlPlaneVersion: controlPlaneVersion(task),
      attemptId: currentAttemptId,
      completedAt,
      latestDecision: latest?.decision ?? null,
      latestDecisionId: snapshotReviewIdentityV2(latest),
      latestDecisionAt: latest?.ts ?? null,
      deliveryState,
    };
  });
}

function relationshipFindings(
  tree: TaskTree,
  children: Map<string, string[]>,
): InvariantFindingV2[] {
  const findings: InvariantFindingV2[] = [];
  for (const task of Object.values(tree.tasks)) {
    const persisted = sortedUnique(normalizeStringArray(task.children));
    const derived = children.get(task.id) ?? [];
    if (sameStrings(persisted, derived)) continue;
    findings.push({
      type: "tree-relationship-mismatch",
      recoveryKey: `tree-relationship:${task.id}:${revision(task)}`,
      severity: "warning",
      subject: { kind: "task", id: task.id, revision: revision(task) },
      message: `Persisted children ${JSON.stringify(persisted)} differ from parent-derived children ${JSON.stringify(derived)}.`,
      taskIds: sortedUnique([task.id, ...persisted, ...derived]),
      automaticAction: "none",
    });
  }
  return findings;
}

function mirrorArrays(tree: TaskTree): {
  available: boolean;
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
} {
  const rootId = text(tree.root_task_id) ?? "project";
  const context = record(taskById(tree, rootId)?.context);
  const readout = record(context.current_root_readout);
  const available = Object.keys(readout).length > 0;
  return {
    available,
    active: normalizeStringArray(
      readout.active_task_ids_excluding_self ?? readout.active_task_ids,
    ),
    review: normalizeStringArray(readout.review_task_ids),
    waiting: normalizeStringArray(readout.waiting_task_ids),
    runnable: normalizeStringArray(readout.runnable_task_ids),
  };
}

function buildMirrorDrift(
  tree: TaskTree,
  frontier: WorkFrontierV2,
): MirrorDriftV2 {
  const mirror = mirrorArrays(tree);
  const compare = (expected: string[], actual: string[]) => ({
    expected: sortedUnique(expected),
    actual: sortedUnique(actual),
    matches: sameStrings(expected, actual),
  });
  return {
    available: mirror.available,
    active: compare(frontier.active, mirror.active),
    review: compare(frontier.review, mirror.review),
    waiting: compare(frontier.waiting, mirror.waiting),
    runnable: compare(frontier.runnable, mirror.runnable),
  };
}

function buildInvariants(input: {
  tree: TaskTree;
  coverage: SnapshotCoverageV2;
  assignments: SnapshotAssignment[];
  attempts: AttemptProjectionV2[];
  reviews: ReviewProjectionV2[];
  conditions: ConditionCandidateV2[];
  loops: SnapshotLoop[];
  deliveryGaps: SnapshotDeliveryGap[];
}): InvariantFindingV2[] {
  const canEvaluate = (type: InvariantTypeV2): boolean =>
    INVARIANT_SOURCE_REQUIREMENTS_V2[type].every(
      (source) => input.coverage[source] === "available",
    );
  const findings = relationshipFindings(
    input.tree,
    derivedChildren(input.tree),
  );

  for (const assignment of canEvaluate("assignment-state-mismatch")
    ? input.assignments
    : []) {
    const task = taskById(input.tree, assignment.taskId);
    const matches =
      !!task &&
      taskState(task) === "active" &&
      (!text(task.session_id) || task.session_id === assignment.sessionId) &&
      (!attemptId(task) || attemptId(task) === assignment.attemptId) &&
      revision(task) === assignment.taskRevision;
    if (matches) continue;
    findings.push({
      type: "assignment-state-mismatch",
      recoveryKey: `assignment-mismatch:${assignment.taskId}:${assignment.attemptId}`,
      severity: "warning",
      subject: {
        kind: "assignment",
        id: assignment.attemptId,
        revision: revision(task),
      },
      message: `Queued assignment does not match current active task state.`,
      taskIds: [assignment.taskId],
      automaticAction: "none",
    });
  }

  for (const attempt of input.attempts) {
    if (
      attempt.runtimeState === "running" ||
      attempt.runtimeState === "starting"
    ) {
      continue;
    }
    const type: InvariantTypeV2 =
      attempt.runtimeState === "stale"
        ? "active-attempt-stale"
        : attempt.runtimeState === "terminal"
          ? "active-attempt-terminal"
          : "active-attempt-missing";
    if (!canEvaluate(type)) continue;
    findings.push({
      type,
      recoveryKey: `${type}:${attempt.taskId}:${attempt.taskRevision}:${attempt.attemptId ?? "none"}`,
      severity: type === "active-attempt-terminal" ? "warning" : "critical",
      subject: {
        kind: "task",
        id: attempt.taskId,
        revision: attempt.taskRevision,
      },
      message: attempt.reason,
      taskIds: [attempt.taskId],
      automaticAction:
        type === "active-attempt-terminal" ? "recover-completion" : "none",
    });
  }

  for (const review of canEvaluate("review-delivery-missing")
    ? input.reviews
    : []) {
    if (review.deliveryState === "within-grace") continue;
    const hasDecision = review.deliveryState === "decision-pending-apply";
    const type: InvariantTypeV2 = hasDecision
      ? "review-decision-not-applied"
      : "review-delivery-missing";
    findings.push({
      type,
      recoveryKey: hasDecision
        ? `${type}:${review.taskId}:${review.taskRevision}:${review.attemptId ?? "none"}:${review.latestDecisionId ?? "unknown"}`
        : `${type}:${review.taskId}:${review.taskRevision}:${review.attemptId ?? "none"}`,
      severity: "warning",
      subject: {
        kind: "task",
        id: review.taskId,
        revision: review.taskRevision,
      },
      message: hasDecision
        ? `A reviewer decision exists but the task remains in review.`
        : `No reviewer decision exists beyond the review grace window.`,
      taskIds: [review.taskId],
      automaticAction: hasDecision ? "none" : "reemit-review",
    });
  }

  for (const condition of input.conditions) {
    if (condition.status === "resolved") {
      const subject = taskById(input.tree, condition.subject.id);
      if (
        subject &&
        revision(subject) === condition.subject.revision &&
        taskState(subject) === "blocked"
      ) {
        findings.push({
          type: "resolved-condition-still-blocking",
          recoveryKey: `resolved-condition-still-blocking:${condition.id}:${condition.subject.revision}`,
          severity: "critical",
          subject: condition.subject,
          message: `Resolved Condition ${condition.id} still has a blocked subject.`,
          taskIds: [condition.subject.id],
          automaticAction: "reconcile-condition",
        });
      }
      continue;
    }
    if (condition.issues.length === 0) continue;
    findings.push({
      type: "blocked-condition-incomplete",
      recoveryKey: `blocked-condition-incomplete:${condition.subject.id}:${condition.subject.revision}`,
      severity: "warning",
      subject: condition.subject,
      message: `Legacy blocker is missing ${condition.issues.join(", ")}.`,
      taskIds: [condition.subject.id],
      automaticAction: "none",
    });
  }

  for (const loop of canEvaluate("controller-record-unrepresented")
    ? input.loops
    : []) {
    if ((loop.reportedUnrepresentedNonTerminalCount ?? 0) <= 0) continue;
    findings.push({
      type: "controller-record-unrepresented",
      recoveryKey: `controller-unrepresented:${loop.taskId}:${loop.updatedAt ?? "unknown"}`,
      severity: "critical",
      subject: { kind: "controller", id: loop.taskId },
      message: `${loop.reportedUnrepresentedNonTerminalCount} nonterminal ledger record(s) are reported unrepresented.`,
      taskIds: [loop.taskId],
      automaticAction: "pulse-controller",
    });
  }

  for (const gap of canEvaluate("continuation-delivery-gap")
    ? input.deliveryGaps
    : []) {
    findings.push({
      type: "continuation-delivery-gap",
      recoveryKey: `continuation-delivery:${gap.eventId}`,
      severity: gap.deliveryStatus === "failed" ? "critical" : "warning",
      subject: { kind: "event", id: gap.eventId },
      message: `${gap.eventType} delivery is ${gap.deliveryStatus}/${gap.status}.`,
      taskIds: gap.taskId ? [gap.taskId] : [],
      automaticAction: "none",
    });
  }

  return findings.sort(
    (left, right) =>
      left.type.localeCompare(right.type) ||
      left.recoveryKey.localeCompare(right.recoveryKey),
  );
}

export function buildProjectSnapshotV2(
  input: ProjectSnapshotV2Input,
): ProjectSnapshotV2 {
  const nowMs = input.nowMs ?? Date.now();
  const coverage: SnapshotCoverageV2 = {
    tree: "available",
    assignments:
      input.sourceCoverage?.assignments ??
      (input.assignments === undefined ? "unavailable" : "available"),
    sessions:
      input.sourceCoverage?.sessions ??
      (input.sessions === undefined ? "unavailable" : "available"),
    reviews:
      input.sourceCoverage?.reviews ??
      (input.reviews === undefined ? "unavailable" : "available"),
    controllers:
      input.sourceCoverage?.controllers ??
      (input.loops === undefined ? "unavailable" : "available"),
    controllerLiveness:
      input.sourceCoverage?.controllerLiveness ??
      (input.attemptHeartbeats === undefined ? "unavailable" : "available"),
    delivery:
      input.sourceCoverage?.delivery ??
      (input.deliveryGaps === undefined ? "unavailable" : "available"),
  };
  const assignments = input.assignments ?? [];
  const sessions = input.sessions ?? [];
  const reviews = input.reviews ?? [];
  const loops = input.loops ?? [];
  const attemptHeartbeats = input.attemptHeartbeats ?? [];
  const deliveryGaps = input.deliveryGaps ?? [];
  const frontier = buildFrontier(input.tree);
  const attempts = projectAttempts({
    tree: input.tree,
    frontier,
    assignments,
    sessions,
    attemptHeartbeats,
    coverage,
    nowMs,
    startGraceMs: input.sessionStartGraceMs ?? 2 * 60_000,
    staleMs: input.staleNoActivityMs ?? 10 * 60_000,
  });
  const reviewProjections = projectReviews({
    tree: input.tree,
    frontier,
    reviews,
    reviewsAvailable: coverage.reviews === "available",
    nowMs,
    reviewGraceMs: input.reviewGraceMs ?? 15 * 60_000,
  });
  const registeredConditions = Object.values(input.tree.conditions ?? {})
    .map(registeredCondition)
    .filter(
      (condition): condition is ConditionCandidateV2 => condition !== null,
    );
  const registeredIds = new Set(
    registeredConditions.map((condition) => condition.id),
  );
  const legacyConditions = frontier.blocked
    .filter((taskId) => {
      const conditionId = conditionIdFromBlocker(taskById(input.tree, taskId)!);
      return !conditionId || !registeredIds.has(conditionId);
    })
    .map((taskId) => legacyCondition(taskById(input.tree, taskId)!));
  const conditions = [...registeredConditions, ...legacyConditions].sort(
    (left, right) => left.id.localeCompare(right.id),
  );
  const mirrorDrift = buildMirrorDrift(input.tree, frontier);
  const invariants = buildInvariants({
    tree: input.tree,
    coverage,
    assignments,
    attempts,
    reviews: reviewProjections,
    conditions,
    loops,
    deliveryGaps,
  });

  return {
    version: PROJECT_SNAPSHOT_V2,
    projectId: input.projectId,
    capturedAt: new Date(nowMs).toISOString(),
    treeUpdatedAt: text(input.tree.updated_at),
    coverage,
    sourceMeta: input.sourceMeta ?? {},
    frontier,
    attempts,
    reviews: reviewProjections,
    conditions,
    controllers: [...loops].sort((left, right) =>
      left.taskId.localeCompare(right.taskId),
    ),
    deliveryGaps: [...deliveryGaps].sort((left, right) =>
      left.eventId.localeCompare(right.eventId),
    ),
    mirrorDrift,
    invariants,
  };
}

export function compareFrontiersV2(
  snapshot: ProjectSnapshotV2,
  current: {
    runnable: string[];
    waiting: string[];
    active: string[];
    review: string[];
    blocked: string[];
  },
  options: {
    ignoredCurrentOnly?: Partial<
      Record<"runnable" | "waiting" | "active" | "review" | "blocked", string[]>
    >;
  } = {},
): Record<
  "runnable" | "waiting" | "active" | "review" | "blocked",
  FrontierComparisonV2
> {
  const compare = (
    key: "runnable" | "waiting" | "active" | "review" | "blocked",
    v2: string[],
    existing: string[],
  ) => {
    const ignoredSet = new Set(options.ignoredCurrentOnly?.[key] ?? []);
    const effectiveExisting = existing.filter((id) => !ignoredSet.has(id));
    const v2Set = new Set(v2);
    const existingSet = new Set(effectiveExisting);
    const matches = sameStrings(v2, effectiveExisting);
    const currentOnly = sortedUnique(
      effectiveExisting.filter((id) => !v2Set.has(id)),
    );
    const ignoredCurrentOnly = sortedUnique(
      existing.filter((id) => ignoredSet.has(id) && !v2Set.has(id)),
    );
    const currentTruncated =
      !matches && existing.length === 20 && currentOnly.length === 0;
    const structuralExtraOnly =
      matches && ignoredCurrentOnly.length > 0 && !sameStrings(v2, existing);
    return {
      matches: matches && ignoredCurrentOnly.length === 0,
      compatible: matches || currentTruncated,
      reason: structuralExtraOnly
        ? ("current-structural-extra" as const)
        : matches
          ? ("exact" as const)
          : currentTruncated
            ? ("current-truncated" as const)
            : ("mismatch" as const),
      v2Only: sortedUnique(v2.filter((id) => !existingSet.has(id))),
      currentOnly,
      ignoredCurrentOnly,
    };
  };
  return {
    runnable: compare("runnable", snapshot.frontier.runnable, current.runnable),
    waiting: compare("waiting", snapshot.frontier.waiting, current.waiting),
    active: compare("active", snapshot.frontier.active, current.active),
    review: compare("review", snapshot.frontier.review, current.review),
    blocked: compare("blocked", snapshot.frontier.blocked, current.blocked),
  };
}
