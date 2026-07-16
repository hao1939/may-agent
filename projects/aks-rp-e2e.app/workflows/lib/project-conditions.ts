import {
  readTaskTree,
  taskRevision,
  taskState,
  withTreeLock,
  type TaskTree,
  type TaskTreeConfig,
} from "./task-tree-store.ts";
import {
  assignTask,
  appendToolJournal,
  peekTaskAssignments,
  saveTaskTreeWithKanbanSnapshot,
  type ProjectConditionMutationAuthorityV2,
  type TaskAssignment,
} from "./task-tree-tools.ts";

export const PROJECT_CONDITION_V2 = "project-condition-v2" as const;

export type ProjectConditionV2Mode = "off" | "exact-ado-revisioned";

export function exactAdoConditionV2Enabled(
  mode: ProjectConditionV2Mode | undefined,
): boolean {
  return mode === "exact-ado-revisioned";
}

export type ProjectConditionV2 = {
  version: typeof PROJECT_CONDITION_V2;
  id: string;
  causeKey: string;
  class: "external";
  type: "pipeline.run.terminal";
  status: "open" | "resolved";
  backend: "ado";
  runId: string;
  runUrl: string;
  subject: { kind: "task"; id: string; revision: number };
  owner: string;
  observer: string;
  observationMethod: string;
  resumeCondition: string;
  nextCheckAt: string;
  fallbackAt: string;
  fallbackAction: string;
  createdAt: string;
  updatedAt: string;
  lastObservedAt?: string;
  lastObservation?: Record<string, unknown>;
  resolvedAt?: string;
  resolution?: Record<string, unknown>;
  fallbackExecution?: {
    recoveryKey: string;
    claimId: string;
    status: "claimed" | "dispatched" | "acknowledged";
    attempts: number;
    claimedAt: string;
    leaseExpiresAt: string;
    observation: Record<string, unknown>;
    dispatchedAt?: string;
    acknowledgementDueAt?: string;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    failedAt?: string;
    lastError?: string;
  };
  continuation?: {
    recoveryKey: string;
    kind: "dispatch-subject";
    status: "pending" | "assigned";
    createdAt: string;
    assignedAt?: string;
    assignment?: TaskAssignment;
  };
};

type ConditionTree = TaskTree & {
  conditions?: Record<string, ProjectConditionV2>;
};

function conditionMutationAuthority(
  condition: ProjectConditionV2,
  action: ProjectConditionMutationAuthorityV2["action"],
): ProjectConditionMutationAuthorityV2 {
  return {
    kind: "project-condition-v2",
    conditionId: condition.id,
    taskId: condition.subject.id,
    taskRevision: condition.subject.revision,
    action,
  };
}

const CONDITION_FALLBACK_ACK_GRACE_MS = 15 * 60_000;
const CONDITION_FALLBACK_MAX_DISPATCH_ATTEMPTS = 2;

function pipelineConditionBlockerProjection(
  condition: ProjectConditionV2,
  blocker: Record<string, unknown>,
  input?: {
    nextCheckAt?: string;
    observedAt?: string;
    observedStatus?: string;
  },
): Record<string, unknown> {
  return {
    ...blocker,
    category: "external-wait",
    owner: condition.owner,
    condition_id: condition.id,
    observed_by: {
      workflow: condition.observer,
      trigger: "project.watchdog.check.requested",
    },
    observation_method: condition.observationMethod,
    next_check_at: input?.nextCheckAt ?? condition.nextCheckAt,
    resume_at: undefined,
    resumeAt: undefined,
    resume_condition: condition.resumeCondition,
    fallback_at: condition.fallbackAt,
    fallback_action: condition.fallbackAction,
    ...(input?.observedAt ? { last_observed_at: input.observedAt } : {}),
    ...(input?.observedStatus
      ? { last_observed_status: input.observedStatus }
      : {}),
  };
}

export function pipelineConditionId(backend: "ado", runId: string): string {
  return `condition:pipeline:${backend}:${runId}:terminal`;
}

export function pipelineConditionCauseKey(
  backend: "ado",
  runId: string,
): string {
  return `pipeline:${backend}:${runId}:terminal`;
}

export function conditionRegistry(
  tree: TaskTree,
): Record<string, ProjectConditionV2> {
  const value = (tree as ConditionTree).conditions;
  return value && typeof value === "object" ? value : {};
}

export function openExactConditionSubjectIdsV2(tree: TaskTree): string[] {
  return Object.values(conditionRegistry(tree))
    .filter((condition) => condition.status === "open")
    .filter((condition) => {
      const task = tree.tasks[condition.subject.id];
      return Boolean(
        task &&
        taskState(task) === "blocked" &&
        taskRevision(task) === condition.subject.revision &&
        task.context?.controlPlaneVersion === 2,
      );
    })
    .map((condition) => condition.subject.id)
    .sort((left, right) => left.localeCompare(right));
}

export function upsertPipelineConditionInTree(
  tree: TaskTree,
  input: {
    mode?: ProjectConditionV2Mode;
    backend: "ado";
    runId: string;
    runUrl: string;
    taskId: string;
    taskRevision: number;
    nextCheckAt: string;
    fallbackAt: string;
    fallbackAction: string;
    now: string;
  },
): ProjectConditionV2 {
  if (!exactAdoConditionV2Enabled(input.mode)) {
    throw new Error("exact ADO Condition V2 writer is disabled");
  }
  const registry = conditionRegistry(tree);
  const id = pipelineConditionId(input.backend, input.runId);
  const existing = registry[id];
  if (
    existing &&
    (existing.subject.id !== input.taskId ||
      existing.subject.revision !== input.taskRevision)
  ) {
    throw new Error(
      `Condition ${id} already belongs to ${existing.subject.id} revision ${existing.subject.revision}`,
    );
  }
  const condition: ProjectConditionV2 = {
    version: PROJECT_CONDITION_V2,
    id,
    causeKey: pipelineConditionCauseKey(input.backend, input.runId),
    class: "external",
    type: "pipeline.run.terminal",
    status: "open",
    backend: input.backend,
    runId: input.runId,
    runUrl: input.runUrl,
    subject: {
      kind: "task",
      id: input.taskId,
      revision: input.taskRevision,
    },
    owner: "ado",
    observer: "project-execution-watchdog",
    observationMethod:
      "Observe the exact Azure DevOps run; resolve only from a terminal backend fact for this exact run and subject revision.",
    resumeCondition: `Azure DevOps run ${input.runId} is terminal and its artifacts are available.`,
    nextCheckAt: input.nextCheckAt,
    fallbackAt: input.fallbackAt,
    fallbackAction: input.fallbackAction,
    createdAt: existing?.createdAt ?? input.now,
    updatedAt: input.now,
  };
  (tree as ConditionTree).conditions = { ...registry, [id]: condition };
  return condition;
}

export type ConditionMutationResultV2 = {
  applied: boolean;
  replayed: boolean;
  conditionId: string;
  taskId?: string;
  taskRevision?: number;
  reconciled?: boolean;
  reason?: string;
};

export type ConditionFallbackClaimV2 = {
  claimed: boolean;
  replayed: boolean;
  conditionId: string;
  recoveryKey?: string;
  claimId?: string;
  taskId?: string;
  taskRevision?: number;
  fallbackAction?: string;
  observation?: Record<string, unknown>;
  reason?: string;
};

export function claimPipelineConditionFallbackV2(
  config: TaskTreeConfig,
  input: {
    mode?: ProjectConditionV2Mode;
    conditionId: string;
    backend: "ado";
    runId: string;
    taskId: string;
    taskRevision: number;
    claimedAt: string;
    observation: Record<string, unknown>;
    leaseMs?: number;
  },
): ConditionFallbackClaimV2 {
  if (!exactAdoConditionV2Enabled(input.mode)) {
    return {
      claimed: false,
      replayed: false,
      conditionId: input.conditionId,
      reason: "exact ADO Condition V2 writer is disabled",
    };
  }
  const result = withTreeLock(config, () => {
    const tree = readTaskTree(config) as ConditionTree;
    const condition = conditionRegistry(tree)[input.conditionId];
    if (!condition) {
      return {
        claimed: false,
        replayed: false,
        conditionId: input.conditionId,
        reason: "condition not found",
      };
    }
    if (
      condition.status !== "open" ||
      condition.backend !== input.backend ||
      condition.runId !== input.runId ||
      condition.subject.id !== input.taskId ||
      condition.subject.revision !== input.taskRevision
    ) {
      return {
        claimed: false,
        replayed: false,
        conditionId: condition.id,
        reason: "condition fallback correlation mismatch",
      };
    }
    const task = tree.tasks[input.taskId];
    if (
      !task ||
      taskRevision(task) !== input.taskRevision ||
      taskState(task) !== "blocked" ||
      task.context?.controlPlaneVersion !== 2
    ) {
      return {
        claimed: false,
        replayed: false,
        conditionId: condition.id,
        reason: "condition fallback subject is not an exact blocked V2 task",
      };
    }
    const nowMs = Date.parse(input.claimedAt);
    const fallbackMs = Date.parse(condition.fallbackAt);
    if (!Number.isFinite(nowMs) || !Number.isFinite(fallbackMs)) {
      return {
        claimed: false,
        replayed: false,
        conditionId: condition.id,
        reason: "condition fallback time is invalid",
      };
    }
    if (fallbackMs > nowMs) {
      return {
        claimed: false,
        replayed: false,
        conditionId: condition.id,
        reason: "condition fallback is not due",
      };
    }
    const recoveryKey = `condition-fallback:${condition.id}:${condition.subject.revision}`;
    const existing = condition.fallbackExecution;
    if (existing?.status === "acknowledged") {
      return {
        claimed: false,
        replayed: true,
        conditionId: condition.id,
        recoveryKey,
        taskId: input.taskId,
        taskRevision: input.taskRevision,
        fallbackAction: condition.fallbackAction,
        observation: existing.observation,
        reason: "condition fallback was already acknowledged",
      };
    }
    if (existing?.status === "dispatched") {
      const acknowledgementDueMs = Date.parse(
        existing.acknowledgementDueAt ?? "",
      );
      const effectiveAcknowledgementDueMs = Number.isFinite(
        acknowledgementDueMs,
      )
        ? acknowledgementDueMs
        : Date.parse(existing.dispatchedAt ?? "") +
          CONDITION_FALLBACK_ACK_GRACE_MS;
      if (
        Number.isFinite(effectiveAcknowledgementDueMs) &&
        effectiveAcknowledgementDueMs > nowMs
      ) {
        return {
          claimed: false,
          replayed: true,
          conditionId: condition.id,
          recoveryKey,
          taskId: input.taskId,
          taskRevision: input.taskRevision,
          fallbackAction: condition.fallbackAction,
          observation: existing.observation,
          reason: "condition fallback was already dispatched",
        };
      }
      if (existing.attempts >= CONDITION_FALLBACK_MAX_DISPATCH_ATTEMPTS) {
        return {
          claimed: false,
          replayed: true,
          conditionId: condition.id,
          recoveryKey,
          taskId: input.taskId,
          taskRevision: input.taskRevision,
          fallbackAction: condition.fallbackAction,
          observation: existing.observation,
          reason:
            "condition fallback delivery acknowledgement is overdue and its retry budget is exhausted",
        };
      }
    }
    if (
      existing?.status === "claimed" &&
      Date.parse(existing.leaseExpiresAt) > nowMs
    ) {
      return {
        claimed: false,
        replayed: true,
        conditionId: condition.id,
        recoveryKey,
        taskId: input.taskId,
        taskRevision: input.taskRevision,
        fallbackAction: condition.fallbackAction,
        observation: existing.observation,
        reason: "condition fallback has an active dispatch lease",
      };
    }
    const claimId = `${recoveryKey}:${input.claimedAt}`;
    const leaseExpiresAt = new Date(
      nowMs + Math.max(1_000, input.leaseMs ?? 5 * 60_000),
    ).toISOString();
    const fallbackExecution: NonNullable<
      ProjectConditionV2["fallbackExecution"]
    > = {
      recoveryKey,
      claimId,
      status: "claimed",
      attempts: (existing?.attempts ?? 0) + 1,
      claimedAt: input.claimedAt,
      leaseExpiresAt,
      observation: input.observation,
    };
    tree.conditions = {
      ...conditionRegistry(tree),
      [condition.id]: {
        ...condition,
        updatedAt: input.claimedAt,
        lastObservedAt: input.claimedAt,
        lastObservation: input.observation,
        fallbackExecution,
      },
    };
    if (
      task.blocker &&
      typeof task.blocker === "object" &&
      !Array.isArray(task.blocker)
    ) {
      task.blocker = {
        ...pipelineConditionBlockerProjection(condition, task.blocker, {
          observedAt: input.claimedAt,
          observedStatus:
            typeof input.observation.status === "string"
              ? input.observation.status
              : "unknown",
        }),
        fallback_recovery_key: recoveryKey,
        fallback_claimed_at: input.claimedAt,
      } as typeof task.blocker;
    }
    saveTaskTreeWithKanbanSnapshot(
      config,
      tree,
      conditionMutationAuthority(condition, "fallback-claim"),
    );
    return {
      claimed: true,
      replayed: false,
      conditionId: condition.id,
      recoveryKey,
      claimId,
      taskId: input.taskId,
      taskRevision: input.taskRevision,
      fallbackAction: condition.fallbackAction,
      observation: input.observation,
    };
  });
  if (result.claimed) {
    appendToolJournal(config, {
      kind: "project_condition_fallback_claimed_v2",
      condition_id: result.conditionId,
      recovery_key: result.recoveryKey,
      claim_id: result.claimId,
      task_id: result.taskId,
      task_revision: result.taskRevision,
      observation: result.observation,
    });
  }
  return result;
}

export function finishPipelineConditionFallbackV2(
  config: TaskTreeConfig,
  input: {
    mode?: ProjectConditionV2Mode;
    conditionId: string;
    claimId: string;
    finishedAt: string;
    dispatched: boolean;
    error?: string;
  },
): boolean {
  if (!exactAdoConditionV2Enabled(input.mode)) return false;
  const finished = withTreeLock(config, () => {
    const tree = readTaskTree(config) as ConditionTree;
    const condition = conditionRegistry(tree)[input.conditionId];
    const fallback = condition?.fallbackExecution;
    if (!condition || !fallback || fallback.claimId !== input.claimId) {
      return false;
    }
    tree.conditions = {
      ...conditionRegistry(tree),
      [condition.id]: {
        ...condition,
        updatedAt: input.finishedAt,
        fallbackExecution: {
          ...fallback,
          ...(input.dispatched
            ? {
                status: "dispatched" as const,
                dispatchedAt: input.finishedAt,
                acknowledgementDueAt: new Date(
                  Date.parse(input.finishedAt) +
                    CONDITION_FALLBACK_ACK_GRACE_MS,
                ).toISOString(),
              }
            : {
                status: "claimed" as const,
                failedAt: input.finishedAt,
                lastError: input.error ?? "condition fallback dispatch failed",
              }),
        },
      },
    };
    saveTaskTreeWithKanbanSnapshot(
      config,
      tree,
      conditionMutationAuthority(condition, "fallback-dispatch"),
    );
    return true;
  });
  if (finished) {
    appendToolJournal(config, {
      kind: input.dispatched
        ? "project_condition_fallback_dispatched_v2"
        : "project_condition_fallback_dispatch_failed_v2",
      condition_id: input.conditionId,
      claim_id: input.claimId,
      error: input.error,
    });
  }
  return finished;
}

export function acknowledgePipelineConditionFallbackV2(
  config: TaskTreeConfig,
  input: {
    mode?: ProjectConditionV2Mode;
    conditionId: string;
    recoveryKey: string;
    taskId: string;
    taskRevision: number;
    acknowledgedAt: string;
    acknowledgedBy: string;
  },
): ConditionMutationResultV2 {
  if (!exactAdoConditionV2Enabled(input.mode)) {
    return {
      applied: false,
      replayed: false,
      conditionId: input.conditionId,
      reason: "exact ADO Condition V2 writer is disabled",
    };
  }
  const result = withTreeLock(config, () => {
    const tree = readTaskTree(config) as ConditionTree;
    const condition = conditionRegistry(tree)[input.conditionId];
    const fallback = condition?.fallbackExecution;
    if (
      !condition ||
      !fallback ||
      fallback.recoveryKey !== input.recoveryKey ||
      condition.subject.id !== input.taskId ||
      condition.subject.revision !== input.taskRevision
    ) {
      return {
        applied: false,
        replayed: false,
        conditionId: input.conditionId,
        reason: "condition fallback acknowledgement correlation mismatch",
      };
    }
    if (fallback.status === "acknowledged") {
      return {
        applied: true,
        replayed: true,
        conditionId: condition.id,
        taskId: input.taskId,
        taskRevision: input.taskRevision,
      };
    }
    if (fallback.status !== "dispatched") {
      return {
        applied: false,
        replayed: false,
        conditionId: condition.id,
        reason: "condition fallback has not been dispatched",
      };
    }
    tree.conditions = {
      ...conditionRegistry(tree),
      [condition.id]: {
        ...condition,
        updatedAt: input.acknowledgedAt,
        fallbackExecution: {
          ...fallback,
          status: "acknowledged",
          acknowledgedAt: input.acknowledgedAt,
          acknowledgedBy: input.acknowledgedBy,
        },
      },
    };
    saveTaskTreeWithKanbanSnapshot(
      config,
      tree,
      conditionMutationAuthority(condition, "fallback-acknowledge"),
    );
    return {
      applied: true,
      replayed: false,
      conditionId: condition.id,
      taskId: input.taskId,
      taskRevision: input.taskRevision,
    };
  });
  if (result.applied && !result.replayed) {
    appendToolJournal(config, {
      kind: "project_condition_fallback_acknowledged_v2",
      condition_id: result.conditionId,
      recovery_key: input.recoveryKey,
      task_id: input.taskId,
      task_revision: input.taskRevision,
      acknowledged_by: input.acknowledgedBy,
    });
  }
  return result;
}

export function observePipelineConditionV2(
  config: TaskTreeConfig,
  input: {
    mode?: ProjectConditionV2Mode;
    conditionId: string;
    backend: "ado";
    runId: string;
    taskId: string;
    taskRevision: number;
    observedAt: string;
    observation: Record<string, unknown>;
    nextCheckAt: string;
  },
): ConditionMutationResultV2 {
  if (!exactAdoConditionV2Enabled(input.mode)) {
    return {
      applied: false,
      replayed: false,
      conditionId: input.conditionId,
      reason: "exact ADO Condition V2 writer is disabled",
    };
  }
  return withTreeLock(config, () => {
    const tree = readTaskTree(config) as ConditionTree;
    const condition = conditionRegistry(tree)[input.conditionId];
    if (!condition) {
      return {
        applied: false,
        replayed: false,
        conditionId: input.conditionId,
        reason: "condition not found",
      };
    }
    if (
      condition.backend !== input.backend ||
      condition.runId !== input.runId ||
      condition.subject.id !== input.taskId ||
      condition.subject.revision !== input.taskRevision
    ) {
      return {
        applied: false,
        replayed: false,
        conditionId: input.conditionId,
        reason: "condition correlation mismatch",
      };
    }
    if (condition.status === "resolved") {
      return {
        applied: true,
        replayed: true,
        conditionId: condition.id,
        taskId: input.taskId,
        taskRevision: input.taskRevision,
      };
    }
    const task = tree.tasks[input.taskId];
    if (
      !task ||
      taskRevision(task) !== input.taskRevision ||
      task.context?.controlPlaneVersion !== 2
    ) {
      return {
        applied: false,
        replayed: false,
        conditionId: condition.id,
        reason: "condition subject revision or V2 cohort is stale",
      };
    }
    if (taskState(task) !== "blocked") {
      return {
        applied: false,
        replayed: false,
        conditionId: condition.id,
        reason: `condition subject is ${taskState(task)}, not blocked`,
      };
    }
    tree.conditions = {
      ...conditionRegistry(tree),
      [condition.id]: {
        ...condition,
        updatedAt: input.observedAt,
        lastObservedAt: input.observedAt,
        lastObservation: input.observation,
        nextCheckAt: input.nextCheckAt,
      },
    };
    if (
      task.blocker &&
      typeof task.blocker === "object" &&
      !Array.isArray(task.blocker)
    ) {
      task.blocker = pipelineConditionBlockerProjection(
        condition,
        task.blocker,
        {
          nextCheckAt: input.nextCheckAt,
          observedAt: input.observedAt,
          observedStatus:
            typeof input.observation.status === "string"
              ? input.observation.status
              : "unknown",
        },
      );
    }
    saveTaskTreeWithKanbanSnapshot(
      config,
      tree,
      conditionMutationAuthority(condition, "observe"),
    );
    return {
      applied: true,
      replayed: false,
      conditionId: condition.id,
      taskId: input.taskId,
      taskRevision: input.taskRevision,
    };
  });
}

export function resolvePipelineConditionV2(
  config: TaskTreeConfig,
  input: {
    mode?: ProjectConditionV2Mode;
    conditionId: string;
    backend: "ado";
    runId: string;
    taskId: string;
    taskRevision: number;
    resolvedAt: string;
    resolution: Record<string, unknown>;
  },
): ConditionMutationResultV2 {
  if (!exactAdoConditionV2Enabled(input.mode)) {
    return {
      applied: false,
      replayed: false,
      conditionId: input.conditionId,
      reason: "exact ADO Condition V2 writer is disabled",
    };
  }
  const result = withTreeLock(config, () => {
    const tree = readTaskTree(config) as ConditionTree;
    const registry = conditionRegistry(tree);
    const condition = registry[input.conditionId];
    if (!condition) {
      return {
        applied: false,
        replayed: false,
        conditionId: input.conditionId,
        reason: "condition not found",
      };
    }
    if (
      condition.backend !== input.backend ||
      condition.runId !== input.runId ||
      condition.subject.id !== input.taskId ||
      condition.subject.revision !== input.taskRevision
    ) {
      return {
        applied: false,
        replayed: false,
        conditionId: input.conditionId,
        reason: "condition correlation mismatch",
      };
    }
    if (condition.status === "resolved") {
      return {
        applied: true,
        replayed: true,
        conditionId: condition.id,
        taskId: input.taskId,
        taskRevision: input.taskRevision,
      };
    }
    const task = tree.tasks[input.taskId];
    const subjectRevisionMatches =
      Boolean(task) && taskRevision(task) === input.taskRevision;
    const subjectInV2Cohort =
      subjectRevisionMatches && task?.context?.controlPlaneVersion === 2;
    const workCanReconcile =
      subjectInV2Cohort && taskState(task!) === "blocked";

    tree.conditions = {
      ...registry,
      [condition.id]: {
        ...condition,
        status: "resolved",
        updatedAt: input.resolvedAt,
        lastObservedAt: input.resolvedAt,
        lastObservation: input.resolution,
        resolvedAt: input.resolvedAt,
        resolution: input.resolution,
        ...(workCanReconcile
          ? {
              continuation: {
                recoveryKey: `condition-continuation:${condition.id}:${input.taskRevision}`,
                kind: "dispatch-subject" as const,
                status: "pending" as const,
                createdAt: input.resolvedAt,
              },
            }
          : {}),
      },
    };
    if (workCanReconcile && task) {
      task.state = "backlog";
      delete task.status;
      task.blocker = undefined;
      task.context = {
        ...(task.context ?? {}),
        conditionContinuationKey: `condition-continuation:${condition.id}:${input.taskRevision}`,
        terminalPipelineWaitReview: {
          conditionId: condition.id,
          runId: condition.runId,
          runUrl: condition.runUrl,
          runStatus: input.resolution.status ?? "completed",
          runConclusion: input.resolution.conclusion ?? null,
          observedAt: input.resolvedAt,
          subjectRevision: input.taskRevision,
        },
      };
      task.trace = {
        ...(task.trace ?? {}),
        condition_resolved_at: input.resolvedAt,
        condition_id: condition.id,
        condition_resolution: input.resolution,
        current_attempt_id: undefined,
      };
    }
    saveTaskTreeWithKanbanSnapshot(
      config,
      tree,
      conditionMutationAuthority(condition, "resolve"),
    );
    return {
      applied: true,
      replayed: false,
      conditionId: condition.id,
      taskId: input.taskId,
      taskRevision: input.taskRevision,
      reconciled: workCanReconcile,
      ...(!workCanReconcile
        ? {
            reason: !subjectRevisionMatches
              ? "condition resolved; subject revision is stale and was not reconciled"
              : !subjectInV2Cohort
                ? "condition resolved; subject is outside the V2 cohort and was not reconciled"
                : `condition resolved; subject is ${taskState(task!)}, not blocked`,
          }
        : {}),
    };
  });
  if (result.applied && !result.replayed) {
    appendToolJournal(config, {
      kind: "project_condition_resolved_v2",
      condition_id: result.conditionId,
      task_id: input.taskId,
      task_revision: input.taskRevision,
      backend: input.backend,
      run_id: input.runId,
      resolution: input.resolution,
      work_reconciled:
        "reconciled" in result ? (result.reconciled ?? false) : false,
    });
  }
  return result;
}

export function ensureResolvedPipelineConditionAssignmentsV2(
  config: TaskTreeConfig,
  input: { mode?: ProjectConditionV2Mode; limit?: number },
): TaskAssignment[] {
  if (!exactAdoConditionV2Enabled(input.mode)) return [];
  const limit = Math.max(1, input.limit ?? 20);
  const pending = Object.values(conditionRegistry(readTaskTree(config)))
    .filter(
      (condition) =>
        condition.status === "resolved" &&
        condition.continuation?.kind === "dispatch-subject" &&
        condition.continuation.status === "pending",
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, limit);

  for (const snapshot of pending) {
    const recoveryKey = snapshot.continuation!.recoveryKey;
    let assignment = snapshot.continuation?.assignment;
    const currentTree = readTaskTree(config);
    const task = currentTree.tasks[snapshot.subject.id];
    if (
      !task ||
      taskRevision(task) !== snapshot.subject.revision ||
      task.context?.controlPlaneVersion !== 2 ||
      task.context?.conditionContinuationKey !== recoveryKey
    ) {
      continue;
    }
    if (!assignment && taskState(task) === "backlog") {
      try {
        assignment = assignTask(config, {
          taskId: task.id,
          expectedRevision: snapshot.subject.revision,
        });
      } catch {
        continue;
      }
    }
    if (!assignment && taskState(task) === "active") {
      const attemptId = task.trace?.current_attempt_id;
      const assignedAt = task.trace?.assigned_at;
      if (
        typeof attemptId === "string" &&
        typeof task.session_id === "string" &&
        typeof assignedAt === "string" &&
        typeof task.owner === "string"
      ) {
        assignment = {
          taskId: task.id,
          taskRevision: taskRevision(task),
          attemptId,
          sessionId: task.session_id,
          worker: task.owner,
          assignedAt,
        };
      }
    }
    if (!assignment) continue;

    const recorded = withTreeLock(config, () => {
      const tree = readTaskTree(config) as ConditionTree;
      const condition = conditionRegistry(tree)[snapshot.id];
      if (
        !condition ||
        condition.status !== "resolved" ||
        condition.continuation?.recoveryKey !== recoveryKey
      ) {
        return false;
      }
      if (condition.continuation.status === "assigned") return true;
      tree.conditions = {
        ...conditionRegistry(tree),
        [condition.id]: {
          ...condition,
          continuation: {
            ...condition.continuation,
            status: "assigned",
            assignedAt: assignment!.assignedAt,
            assignment,
          },
        },
      };
      saveTaskTreeWithKanbanSnapshot(config, tree);
      return true;
    });
    if (recorded && snapshot.continuation?.status !== "assigned") {
      appendToolJournal(config, {
        kind: "project_condition_continuation_assigned_v2",
        condition_id: snapshot.id,
        recovery_key: recoveryKey,
        task_id: assignment.taskId,
        task_revision: assignment.taskRevision,
        attempt_id: assignment.attemptId,
        session_id: assignment.sessionId,
      });
    }
  }

  const continuations = new Map(
    Object.values(conditionRegistry(readTaskTree(config)))
      .filter(
        (condition) =>
          condition.status === "resolved" &&
          condition.continuation?.status === "assigned" &&
          condition.continuation.assignment,
      )
      .map((condition) => [
        condition.continuation!.assignment!.attemptId,
        condition.continuation!.assignment!,
      ]),
  );
  return peekTaskAssignments(config).filter((assignment) =>
    continuations.has(assignment.attemptId),
  );
}
