import { createHash } from "node:crypto";

export const PROJECT_PENDING_ACTION_V2 = "project-pending-action-v2" as const;
export const PROJECT_PENDING_ACTION_DELIVERY_V2 =
  "project-pending-action-delivery-v2" as const;

export type PendingActionKindV2 =
  | "assignment-delivery"
  | "completion-review-delivery"
  | "review-application-delivery"
  | "condition-continuation-delivery"
  | "condition-fallback-delivery";

export type PendingActionStatusV2 =
  | "pending"
  | "leased"
  | "accepted"
  | "satisfied"
  | "exhausted"
  | "superseded"
  | "unknown";

export type PendingActionV2 = {
  version: typeof PROJECT_PENDING_ACTION_V2;
  key: string;
  kind: PendingActionKindV2;
  subject: {
    taskId: string;
    revision: number;
    attemptId?: string;
    conditionId?: string;
  };
  payloadRef: {
    source: string;
    id: string;
    digest: string;
  };
  status: PendingActionStatusV2;
  delivery: {
    attempts: number;
    leaseId?: string;
    leaseExpiresAt?: string;
    acceptedAt?: string;
    nextAttemptAt?: string;
    maxAttempts: number | null;
  };
  postcondition: {
    kind: string;
    correlationKey: string;
    dueAt?: string;
    satisfiedAt?: string;
  };
};

export type PendingActionDeliveryReceiptV2 = {
  version: typeof PROJECT_PENDING_ACTION_DELIVERY_V2;
  actionKey: string;
  actionKind: PendingActionKindV2;
  attempt: number;
  status: "accepted" | "failed";
  recordedAt: string;
  error?: string;
};

export type PendingActionDeliveryResultV2 = {
  dispatched: boolean;
  accepted: boolean;
  replayed: boolean;
  exhausted: boolean;
  reason: string;
  receipt?: PendingActionDeliveryReceiptV2;
};

export function pendingActionDeliveryReceiptsFromSourceV2(
  value: unknown,
  actionKey: string,
  actionKind: PendingActionKindV2,
): PendingActionDeliveryReceiptV2[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): PendingActionDeliveryReceiptV2[] => {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      return [];
    }
    const receipt = candidate as Record<string, unknown>;
    const attempt = receipt.attempt;
    const status = receipt.status;
    const recordedAt = receipt.recordedAt;
    if (
      receipt.version !== PROJECT_PENDING_ACTION_DELIVERY_V2 ||
      receipt.actionKey !== actionKey ||
      receipt.actionKind !== actionKind ||
      typeof attempt !== "number" ||
      !Number.isInteger(attempt) ||
      attempt <= 0 ||
      (status !== "accepted" && status !== "failed") ||
      typeof recordedAt !== "string"
    ) {
      return [];
    }
    return [
      {
        version: PROJECT_PENDING_ACTION_DELIVERY_V2,
        actionKey,
        actionKind,
        attempt,
        status,
        recordedAt,
        ...(typeof receipt.error === "string" ? { error: receipt.error } : {}),
      },
    ];
  });
}

export type PendingActionAttemptSourceV2 = {
  taskId: string;
  taskRevision: number;
  attemptId: string | null;
  sessionId: string | null;
  assignmentState: "queued" | "consumed" | "missing" | "unknown";
  runtimeState:
    "starting" | "running" | "stale" | "terminal" | "missing" | "unknown";
  assignedAt: string | null;
  lastActivityAt: string | null;
};

export type PendingActionReviewSourceV2 = {
  taskId: string;
  taskRevision: number;
  controlPlaneVersion?: number;
  attemptId: string | null;
  completedAt: string | null;
  latestDecision: string | null;
  latestDecisionId: string | null;
  latestDecisionAt: string | null;
  deliveryState:
    "within-grace" | "missing" | "decision-pending-apply" | "unknown";
  actionDeliveryStatus?: "pending" | "accepted" | "failed" | "unknown";
  actionDeliveryAttempts?: number;
  actionAcceptedAt?: string | null;
  completionDeliveryStatus?: "pending" | "accepted" | "failed" | "unknown";
  completionDeliveryAttempts?: number;
  completionAcceptedAt?: string | null;
};

export type PendingActionConditionSourceV2 = {
  id: string;
  status: "open" | "resolved";
  subject: { id: string; revision: number };
  subjectState?: string | null;
  fallbackAction: string | null;
  fallbackExecution: {
    recoveryKey: string | null;
    claimId: string | null;
    status: string | null;
    attempts: number | null;
    claimedAt: string | null;
    leaseExpiresAt: string | null;
    dispatchedAt: string | null;
    acknowledgementDueAt: string | null;
    acknowledgedAt: string | null;
  } | null;
  continuation: {
    recoveryKey: string | null;
    status: string | null;
    createdAt: string | null;
    assignedAt: string | null;
    assignmentAttemptId: string | null;
    assignmentSessionId: string | null;
  } | null;
};

export type ProjectPendingActionsV2Input = {
  nowMs: number;
  reviewGraceMs: number;
  reviewApplicationGraceMs: number;
  attempts: PendingActionAttemptSourceV2[];
  reviews: PendingActionReviewSourceV2[];
  conditions: PendingActionConditionSourceV2[];
};

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 24);
}

function addMs(value: string | null, durationMs: number): string | undefined {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed)
    ? new Date(parsed + durationMs).toISOString()
    : undefined;
}

function assignmentAction(
  attempt: PendingActionAttemptSourceV2,
): PendingActionV2 | null {
  if (!attempt.attemptId) return null;
  const satisfied =
    attempt.runtimeState === "running" ||
    attempt.runtimeState === "stale" ||
    attempt.runtimeState === "terminal";
  const status: PendingActionStatusV2 = satisfied
    ? "satisfied"
    : attempt.assignmentState === "queued"
      ? "pending"
      : attempt.assignmentState === "consumed" ||
          attempt.assignmentState === "missing"
        ? "accepted"
        : "unknown";
  const key = `assignment-delivery:${attempt.taskId}:${attempt.taskRevision}:${attempt.attemptId}`;
  return {
    version: PROJECT_PENDING_ACTION_V2,
    key,
    kind: "assignment-delivery",
    subject: {
      taskId: attempt.taskId,
      revision: attempt.taskRevision,
      attemptId: attempt.attemptId,
    },
    payloadRef: {
      source:
        attempt.assignmentState === "queued"
          ? "assignment-outbox"
          : "task-attempt",
      id: attempt.attemptId,
      digest: digest({
        taskId: attempt.taskId,
        taskRevision: attempt.taskRevision,
        attemptId: attempt.attemptId,
        sessionId: attempt.sessionId,
        assignedAt: attempt.assignedAt,
      }),
    },
    status,
    delivery: {
      attempts: attempt.assignmentState === "queued" ? 0 : 1,
      ...(attempt.assignmentState === "queued" && attempt.assignedAt
        ? { nextAttemptAt: attempt.assignedAt }
        : {}),
      maxAttempts: null,
    },
    postcondition: {
      kind: "matching-worker-session-started",
      correlationKey: `${attempt.taskId}:${attempt.taskRevision}:${attempt.attemptId}:${attempt.sessionId ?? "none"}`,
      ...(satisfied && attempt.lastActivityAt
        ? { satisfiedAt: attempt.lastActivityAt }
        : {}),
    },
  };
}

export function completionReviewPendingActionV2(
  review: PendingActionReviewSourceV2,
  reviewGraceMs: number,
): PendingActionV2 | null {
  if (!review.attemptId || !review.completedAt) return null;
  const satisfied = review.latestDecision !== null;
  const deliveryStatus = review.completionDeliveryStatus ?? "unknown";
  const status: PendingActionStatusV2 = satisfied
    ? "satisfied"
    : deliveryStatus === "accepted"
      ? "accepted"
      : deliveryStatus === "pending" || deliveryStatus === "failed"
        ? "pending"
        : review.deliveryState === "missing"
          ? "pending"
          : "unknown";
  const key = `completion-review-delivery:${review.taskId}:${review.taskRevision}:${review.attemptId}`;
  return {
    version: PROJECT_PENDING_ACTION_V2,
    key,
    kind: "completion-review-delivery",
    subject: {
      taskId: review.taskId,
      revision: review.taskRevision,
      attemptId: review.attemptId,
    },
    payloadRef: {
      source: "task-completion",
      id: `${review.taskId}:${review.taskRevision}:${review.attemptId}`,
      digest: digest({
        taskId: review.taskId,
        taskRevision: review.taskRevision,
        attemptId: review.attemptId,
        completedAt: review.completedAt,
      }),
    },
    status,
    delivery: {
      attempts: review.completionDeliveryAttempts ?? (satisfied ? 1 : 0),
      ...(review.completionAcceptedAt
        ? { acceptedAt: review.completionAcceptedAt }
        : {}),
      maxAttempts:
        review.taskRevision > 0 && review.controlPlaneVersion === 2 ? 2 : 1,
    },
    postcondition: {
      kind: "matching-reviewer-decision-recorded",
      correlationKey: `${review.taskId}:${review.taskRevision}:${review.attemptId}`,
      ...(addMs(review.completedAt, reviewGraceMs)
        ? { dueAt: addMs(review.completedAt, reviewGraceMs) }
        : {}),
      ...(satisfied && review.latestDecisionAt
        ? { satisfiedAt: review.latestDecisionAt }
        : {}),
    },
  };
}

export function reviewApplicationPendingActionV2(
  review: PendingActionReviewSourceV2,
  reviewGraceMs: number,
): PendingActionV2 | null {
  if (
    review.deliveryState !== "decision-pending-apply" ||
    !review.attemptId ||
    !review.latestDecisionId ||
    !review.latestDecisionAt
  ) {
    return null;
  }
  const key = `review-application-delivery:${review.taskId}:${review.taskRevision}:${review.attemptId}:${review.latestDecisionId}`;
  const deliveryStatus = review.actionDeliveryStatus ?? "unknown";
  return {
    version: PROJECT_PENDING_ACTION_V2,
    key,
    kind: "review-application-delivery",
    subject: {
      taskId: review.taskId,
      revision: review.taskRevision,
      attemptId: review.attemptId,
    },
    payloadRef: {
      source: "reviewer-result",
      id: review.latestDecisionId,
      digest: digest({
        taskId: review.taskId,
        taskRevision: review.taskRevision,
        attemptId: review.attemptId,
        decision: review.latestDecision,
        decisionId: review.latestDecisionId,
        decidedAt: review.latestDecisionAt,
      }),
    },
    status:
      deliveryStatus === "accepted"
        ? "accepted"
        : deliveryStatus === "pending" || deliveryStatus === "failed"
          ? "pending"
          : "unknown",
    delivery: {
      attempts: review.actionDeliveryAttempts ?? 0,
      ...(review.actionAcceptedAt
        ? { acceptedAt: review.actionAcceptedAt }
        : {}),
      maxAttempts: 2,
    },
    postcondition: {
      kind: "matching-review-decision-applied",
      correlationKey: `${review.taskId}:${review.taskRevision}:${review.attemptId}:${review.latestDecisionId}`,
      ...(addMs(review.latestDecisionAt, reviewGraceMs)
        ? { dueAt: addMs(review.latestDecisionAt, reviewGraceMs) }
        : {}),
    },
  };
}

export function deliverPendingActionV2(input: {
  action: PendingActionV2;
  now: string;
  priorReceipts?: PendingActionDeliveryReceiptV2[];
  redeliverAccepted?: boolean;
  dispatch: () => void;
}): PendingActionDeliveryResultV2 {
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) {
    return {
      dispatched: false,
      accepted: false,
      replayed: false,
      exhausted: false,
      reason: "invalid pending-action delivery timestamp",
    };
  }
  const receipts = (input.priorReceipts ?? [])
    .filter(
      (receipt) =>
        receipt.version === PROJECT_PENDING_ACTION_DELIVERY_V2 &&
        receipt.actionKey === input.action.key &&
        receipt.actionKind === input.action.kind,
    )
    .sort((left, right) => left.attempt - right.attempt);
  const accepted = receipts.find((receipt) => receipt.status === "accepted");
  if (
    (accepted || input.action.status === "accepted") &&
    !input.redeliverAccepted
  ) {
    return {
      dispatched: false,
      accepted: true,
      replayed: true,
      exhausted: false,
      reason: "pending action delivery was already accepted",
    };
  }
  if (
    input.action.status === "satisfied" ||
    input.action.status === "superseded"
  ) {
    return {
      dispatched: false,
      accepted: input.action.status === "satisfied",
      replayed: true,
      exhausted: false,
      reason: `pending action is already ${input.action.status}`,
    };
  }
  const attempt = receipts.length + 1;
  if (
    input.action.delivery.maxAttempts !== null &&
    attempt > input.action.delivery.maxAttempts
  ) {
    return {
      dispatched: false,
      accepted: false,
      replayed: false,
      exhausted: true,
      reason: "pending action delivery budget is exhausted",
    };
  }
  try {
    input.dispatch();
    return {
      dispatched: true,
      accepted: true,
      replayed: false,
      exhausted: false,
      reason: "pending action delivery was accepted",
      receipt: {
        version: PROJECT_PENDING_ACTION_DELIVERY_V2,
        actionKey: input.action.key,
        actionKind: input.action.kind,
        attempt,
        status: "accepted",
        recordedAt: input.now,
      },
    };
  } catch (error) {
    return {
      dispatched: true,
      accepted: false,
      replayed: false,
      exhausted: false,
      reason: "pending action delivery failed",
      receipt: {
        version: PROJECT_PENDING_ACTION_DELIVERY_V2,
        actionKey: input.action.key,
        actionKind: input.action.kind,
        attempt,
        status: "failed",
        recordedAt: input.now,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function conditionContinuationAction(
  condition: PendingActionConditionSourceV2,
  attempts: PendingActionAttemptSourceV2[],
): PendingActionV2 | null {
  const continuation = condition.continuation;
  if (!continuation?.recoveryKey) return null;
  const attempt = continuation.assignmentAttemptId
    ? attempts.find(
        (candidate) =>
          candidate.taskId === condition.subject.id &&
          candidate.taskRevision === condition.subject.revision &&
          candidate.attemptId === continuation.assignmentAttemptId,
      )
    : null;
  const satisfied = Boolean(
    attempt &&
    (attempt.runtimeState === "running" ||
      attempt.runtimeState === "stale" ||
      attempt.runtimeState === "terminal"),
  );
  const status: PendingActionStatusV2 = satisfied
    ? "satisfied"
    : continuation.status === "pending"
      ? "pending"
      : continuation.status === "assigned"
        ? condition.subjectState === "review" ||
          condition.subjectState === "done"
          ? "satisfied"
          : condition.subjectState === "active"
            ? "accepted"
            : "superseded"
        : "unknown";
  return {
    version: PROJECT_PENDING_ACTION_V2,
    key: continuation.recoveryKey,
    kind: "condition-continuation-delivery",
    subject: {
      taskId: condition.subject.id,
      revision: condition.subject.revision,
      ...(continuation.assignmentAttemptId
        ? { attemptId: continuation.assignmentAttemptId }
        : {}),
      conditionId: condition.id,
    },
    payloadRef: {
      source: "condition-continuation",
      id: continuation.recoveryKey,
      digest: digest({
        conditionId: condition.id,
        taskId: condition.subject.id,
        taskRevision: condition.subject.revision,
        createdAt: continuation.createdAt,
      }),
    },
    status,
    delivery: {
      attempts: continuation.status === "assigned" ? 1 : 0,
      ...(continuation.status === "pending" && continuation.createdAt
        ? { nextAttemptAt: continuation.createdAt }
        : {}),
      maxAttempts: null,
    },
    postcondition: {
      kind: "matching-continuation-worker-session-started",
      correlationKey: `${condition.id}:${condition.subject.revision}:${continuation.assignmentAttemptId ?? "none"}:${continuation.assignmentSessionId ?? "none"}`,
      ...(satisfied && attempt?.lastActivityAt
        ? { satisfiedAt: attempt.lastActivityAt }
        : {}),
    },
  };
}

function conditionFallbackAction(
  condition: PendingActionConditionSourceV2,
  nowMs: number,
): PendingActionV2 | null {
  const fallback = condition.fallbackExecution;
  if (!fallback) return null;
  const key =
    fallback.recoveryKey ??
    `condition-fallback:${condition.id}:${condition.subject.revision}`;
  const attempts = fallback.attempts ?? 0;
  const leaseExpiresMs = Date.parse(fallback.leaseExpiresAt ?? "");
  const acknowledgementDueMs = Date.parse(fallback.acknowledgementDueAt ?? "");
  let status: PendingActionStatusV2;
  if (fallback.status === "acknowledged") {
    status = "satisfied";
  } else if (fallback.status === "claimed") {
    status =
      Number.isFinite(leaseExpiresMs) && leaseExpiresMs > nowMs
        ? "leased"
        : "pending";
  } else if (fallback.status === "dispatched") {
    status =
      attempts >= 3 &&
      Number.isFinite(acknowledgementDueMs) &&
      acknowledgementDueMs <= nowMs
        ? "exhausted"
        : "accepted";
  } else {
    status = "unknown";
  }
  return {
    version: PROJECT_PENDING_ACTION_V2,
    key,
    kind: "condition-fallback-delivery",
    subject: {
      taskId: condition.subject.id,
      revision: condition.subject.revision,
      conditionId: condition.id,
    },
    payloadRef: {
      source: "condition-fallback",
      id: key,
      digest: digest({
        conditionId: condition.id,
        taskId: condition.subject.id,
        taskRevision: condition.subject.revision,
        fallbackAction: condition.fallbackAction,
      }),
    },
    status,
    delivery: {
      attempts,
      ...(fallback.claimId ? { leaseId: fallback.claimId } : {}),
      ...(fallback.leaseExpiresAt
        ? { leaseExpiresAt: fallback.leaseExpiresAt }
        : {}),
      ...(fallback.dispatchedAt ? { acceptedAt: fallback.dispatchedAt } : {}),
      ...(fallback.status === "dispatched" && fallback.acknowledgementDueAt
        ? { nextAttemptAt: fallback.acknowledgementDueAt }
        : {}),
      maxAttempts: 3,
    },
    postcondition: {
      kind: "correlated-condition-fallback-acknowledged",
      correlationKey: `${condition.id}:${condition.subject.revision}:${key}`,
      ...(fallback.acknowledgementDueAt
        ? { dueAt: fallback.acknowledgementDueAt }
        : {}),
      ...(fallback.acknowledgedAt
        ? { satisfiedAt: fallback.acknowledgedAt }
        : {}),
    },
  };
}

export function projectPendingActionsV2(
  input: ProjectPendingActionsV2Input,
): PendingActionV2[] {
  const actions = [
    ...input.attempts.map(assignmentAction),
    ...input.reviews.map((review) =>
      completionReviewPendingActionV2(review, input.reviewGraceMs),
    ),
    ...input.reviews.map((review) =>
      reviewApplicationPendingActionV2(review, input.reviewApplicationGraceMs),
    ),
    ...input.conditions.map((condition) =>
      conditionContinuationAction(condition, input.attempts),
    ),
    ...input.conditions.map((condition) =>
      conditionFallbackAction(condition, input.nowMs),
    ),
  ].filter((action): action is PendingActionV2 => action !== null);
  return actions.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) || left.key.localeCompare(right.key),
  );
}
