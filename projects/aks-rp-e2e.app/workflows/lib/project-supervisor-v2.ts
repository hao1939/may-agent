import { createHash } from "node:crypto";
import {
  readTaskTree,
  taskRevision,
  taskState,
  withTreeLock,
  type TaskTree,
  type TaskTreeConfig,
} from "./task-tree-store.ts";
import {
  appendToolJournal,
  saveTaskTreeWithKanbanSnapshot,
} from "./task-tree-tools.ts";
import type {
  InvariantFindingV2,
  ProjectSnapshotV2,
} from "./project-snapshot-v2.ts";

export const PROJECT_SUPERVISOR_RECOVERY_V2 =
  "project-supervisor-recovery-v2" as const;

export type ReviewHandoffInvariantTypeV2 =
  "review-delivery-missing" | "review-decision-not-applied";

export type SupervisorActionKindV2 =
  "reemit-completion" | "reemit-reviewed" | "request-owner";

export type SupervisorRecoveryRecordV2 = {
  version: typeof PROJECT_SUPERVISOR_RECOVERY_V2;
  recoveryKey: string;
  invariantType: ReviewHandoffInvariantTypeV2;
  subject: { kind: "task"; id: string; revision: number };
  attemptId: string | null;
  decisionId: string | null;
  status: "open" | "claimed" | "actioned" | "failed" | "resolved" | "exhausted";
  actionKind: Exclude<SupervisorActionKindV2, "request-owner">;
  actionCount: number;
  maxActions: 1;
  firstObservedAt: string;
  lastObservedAt: string;
  lastActionAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
  ownerRequestedAt?: string;
  resolvedAt?: string;
  leaseId?: string;
  leaseUntil?: string;
};

export type SupervisorActionClaimV2 = {
  claimed: boolean;
  recoveryKey?: string;
  leaseId?: string;
  actionKind?: SupervisorActionKindV2;
  taskId?: string;
  taskRevision?: number;
  attemptId?: string | null;
  decisionId?: string | null;
  reason: string;
};

export type TerminalAttemptRecoveryCandidateV2 = {
  recoveryKey: string;
  taskId: string;
  taskRevision: number;
  attemptId: string;
  sessionId: string;
  sessionStatus: string;
  sessionOutcome: string | null;
};

type SupervisorTree = TaskTree & {
  supervisorRecoveries?: Record<string, SupervisorRecoveryRecordV2>;
};

function reviewHandoffFinding(
  finding: InvariantFindingV2,
): finding is InvariantFindingV2 & {
  type: ReviewHandoffInvariantTypeV2;
  subject: { kind: "task"; id: string; revision: number };
} {
  return (
    (finding.type === "review-delivery-missing" ||
      finding.type === "review-decision-not-applied") &&
    finding.subject.kind === "task" &&
    typeof finding.subject.revision === "number"
  );
}

function findingAttemptId(finding: InvariantFindingV2): string | null {
  const prefix = `${finding.type}:${finding.subject.id}:${finding.subject.revision}:`;
  if (!finding.recoveryKey.startsWith(prefix)) return null;
  const value = finding.recoveryKey.slice(prefix.length).split(":")[0] ?? "";
  return value && value !== "none" ? value : null;
}

function findingDecisionId(finding: InvariantFindingV2): string | null {
  if (finding.type !== "review-decision-not-applied") return null;
  const parts = finding.recoveryKey.split(":");
  return parts.at(-1) || null;
}

function actionKind(
  type: ReviewHandoffInvariantTypeV2,
): SupervisorRecoveryRecordV2["actionKind"] {
  return type === "review-delivery-missing"
    ? "reemit-completion"
    : "reemit-reviewed";
}

export function supervisorRecoveryRegistryV2(
  tree: TaskTree,
): Record<string, SupervisorRecoveryRecordV2> {
  const registry = (tree as SupervisorTree).supervisorRecoveries;
  return registry && typeof registry === "object" ? registry : {};
}

function taskMatchesFinding(
  tree: TaskTree,
  finding: ReturnType<typeof currentReviewHandoffFindings>[number],
): boolean {
  if (finding.subject.revision === 0) return false;
  const task = tree.tasks[finding.subject.id];
  if (!task) return false;
  const context =
    task.context &&
    typeof task.context === "object" &&
    !Array.isArray(task.context)
      ? task.context
      : {};
  if (context.controlPlaneVersion !== 2) return false;
  if (taskState(task) !== "review") return false;
  if (taskRevision(task) !== finding.subject.revision) return false;
  const attemptId = findingAttemptId(finding);
  if (!attemptId) return false;
  const trace =
    task.trace && typeof task.trace === "object" && !Array.isArray(task.trace)
      ? task.trace
      : {};
  const currentAttemptId =
    typeof trace.current_attempt_id === "string"
      ? trace.current_attempt_id
      : typeof trace.previous_attempt_id === "string"
        ? trace.previous_attempt_id
        : null;
  return currentAttemptId === attemptId;
}

function currentReviewHandoffFindings(snapshot: ProjectSnapshotV2): Array<
  InvariantFindingV2 & {
    type: ReviewHandoffInvariantTypeV2;
    subject: { kind: "task"; id: string; revision: number };
  }
> {
  return snapshot.invariants
    .filter(reviewHandoffFinding)
    .sort((left, right) => left.recoveryKey.localeCompare(right.recoveryKey));
}

export function terminalAttemptRecoveryCandidatesV2(
  snapshot: ProjectSnapshotV2,
): TerminalAttemptRecoveryCandidateV2[] {
  if (snapshot.coverage.sessions !== "available") {
    return [];
  }
  const findingKeys = new Set(
    snapshot.invariants
      .filter(
        (finding) =>
          finding.type === "active-attempt-terminal" &&
          finding.subject.kind === "task" &&
          (finding.subject.revision ?? 0) > 0,
      )
      .map((finding) => finding.recoveryKey),
  );
  return snapshot.attempts
    .flatMap((attempt): TerminalAttemptRecoveryCandidateV2[] => {
      if (attempt.controlPlaneVersion !== 2) return [];
      const recoveryKey = `active-attempt-terminal:${attempt.taskId}:${attempt.taskRevision}:${attempt.attemptId ?? "none"}`;
      if (!findingKeys.has(recoveryKey)) return [];
      if (!attempt.attemptId || !attempt.sessionId || !attempt.sessionStatus) {
        return [];
      }
      if (attempt.sessionError) return [];
      const status = attempt.sessionStatus.toLowerCase();
      const outcome = attempt.sessionOutcome?.toLowerCase() ?? null;
      const terminalSuccess =
        ["done", "success", "completed"].includes(status) ||
        (outcome !== null &&
          ["done", "success", "completed"].includes(outcome));
      const terminalFailure =
        outcome !== null &&
        ["error", "failed", "interrupted"].includes(outcome);
      if (!terminalSuccess || terminalFailure) return [];
      return [
        {
          recoveryKey,
          taskId: attempt.taskId,
          taskRevision: attempt.taskRevision,
          attemptId: attempt.attemptId,
          sessionId: attempt.sessionId,
          sessionStatus: attempt.sessionStatus,
          sessionOutcome: attempt.sessionOutcome,
        },
      ];
    })
    .sort(
      (left, right) =>
        left.taskId.localeCompare(right.taskId) ||
        left.attemptId.localeCompare(right.attemptId),
    );
}

function parseMs(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function leaseId(recoveryKey: string, now: string): string {
  return `lease:${createHash("sha256")
    .update(`${recoveryKey}:${now}`)
    .digest("hex")
    .slice(0, 20)}`;
}

function newRecord(
  finding: ReturnType<typeof currentReviewHandoffFindings>[number],
  now: string,
): SupervisorRecoveryRecordV2 {
  return {
    version: PROJECT_SUPERVISOR_RECOVERY_V2,
    recoveryKey: finding.recoveryKey,
    invariantType: finding.type,
    subject: {
      kind: "task",
      id: finding.subject.id,
      revision: finding.subject.revision,
    },
    attemptId: findingAttemptId(finding),
    decisionId: findingDecisionId(finding),
    status: "open",
    actionKind: actionKind(finding.type),
    actionCount: 0,
    maxActions: 1,
    firstObservedAt: now,
    lastObservedAt: now,
  };
}

export function claimNextReviewHandoffActionV2(
  config: TaskTreeConfig,
  snapshot: ProjectSnapshotV2,
  input: {
    now: string;
    leaseMs?: number;
    postconditionGraceMs?: number;
  },
): SupervisorActionClaimV2 {
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) {
    return { claimed: false, reason: "invalid supervisor timestamp" };
  }
  if (snapshot.coverage.reviews !== "available") {
    return { claimed: false, reason: "review source coverage is unavailable" };
  }
  const result = withTreeLock(config, () => {
    const tree = readTaskTree(config) as SupervisorTree;
    if (tree.updated_at !== snapshot.treeUpdatedAt) {
      return {
        changed: false,
        claim: {
          claimed: false,
          reason: "snapshot tree generation is stale",
        } satisfies SupervisorActionClaimV2,
      };
    }
    const findings = currentReviewHandoffFindings(snapshot).filter((finding) =>
      taskMatchesFinding(tree, finding),
    );
    const findingKeys = new Set(findings.map((finding) => finding.recoveryKey));
    const registry = { ...supervisorRecoveryRegistryV2(tree) };
    let changed = false;

    for (const [key, record] of Object.entries(registry)) {
      if (
        (record.invariantType === "review-delivery-missing" ||
          record.invariantType === "review-decision-not-applied") &&
        !findingKeys.has(key) &&
        record.status !== "resolved"
      ) {
        registry[key] = {
          ...record,
          status: "resolved",
          lastObservedAt: input.now,
          resolvedAt: input.now,
          leaseId: undefined,
          leaseUntil: undefined,
        };
        changed = true;
      }
    }

    for (const finding of findings) {
      let record =
        registry[finding.recoveryKey] ?? newRecord(finding, input.now);
      if (!registry[finding.recoveryKey]) changed = true;
      record = { ...record, lastObservedAt: input.now };
      registry[finding.recoveryKey] = record;

      const leaseUntilMs = parseMs(record.leaseUntil);
      if (
        record.status === "claimed" &&
        leaseUntilMs !== null &&
        leaseUntilMs > nowMs
      ) {
        continue;
      }

      if (record.actionCount < record.maxActions) {
        const id = leaseId(record.recoveryKey, input.now);
        registry[record.recoveryKey] = {
          ...record,
          status: "claimed",
          leaseId: id,
          leaseUntil: new Date(
            nowMs + (input.leaseMs ?? 2 * 60_000),
          ).toISOString(),
        };
        (tree as SupervisorTree).supervisorRecoveries = registry;
        saveTaskTreeWithKanbanSnapshot(config, tree);
        return {
          changed: true,
          claim: {
            claimed: true,
            recoveryKey: record.recoveryKey,
            leaseId: id,
            actionKind: record.actionKind,
            taskId: record.subject.id,
            taskRevision: record.subject.revision,
            attemptId: record.attemptId,
            decisionId: record.decisionId,
            reason: "claimed automatic review-handoff recovery",
          } satisfies SupervisorActionClaimV2,
        };
      }

      const lastActionMs = parseMs(record.lastActionAt);
      const postconditionGraceMs = input.postconditionGraceMs ?? 5 * 60_000;
      if (
        !record.ownerRequestedAt &&
        lastActionMs !== null &&
        nowMs - lastActionMs >= postconditionGraceMs
      ) {
        const id = leaseId(`${record.recoveryKey}:owner`, input.now);
        registry[record.recoveryKey] = {
          ...record,
          status: "claimed",
          leaseId: id,
          leaseUntil: new Date(
            nowMs + (input.leaseMs ?? 2 * 60_000),
          ).toISOString(),
        };
        (tree as SupervisorTree).supervisorRecoveries = registry;
        saveTaskTreeWithKanbanSnapshot(config, tree);
        return {
          changed: true,
          claim: {
            claimed: true,
            recoveryKey: record.recoveryKey,
            leaseId: id,
            actionKind: "request-owner",
            taskId: record.subject.id,
            taskRevision: record.subject.revision,
            attemptId: record.attemptId,
            decisionId: record.decisionId,
            reason: "automatic action budget exhausted without postcondition",
          } satisfies SupervisorActionClaimV2,
        };
      }
    }

    if (changed) {
      (tree as SupervisorTree).supervisorRecoveries = registry;
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }
    return {
      changed,
      claim: {
        claimed: false,
        reason:
          findings.length > 0
            ? "review-handoff recovery is leased, within grace, or exhausted"
            : "no current review-handoff invariant",
      } satisfies SupervisorActionClaimV2,
    };
  });
  return result.claim;
}

export function completeReviewHandoffActionV2(
  config: TaskTreeConfig,
  input: {
    recoveryKey: string;
    leaseId: string;
    actionKind: SupervisorActionKindV2;
    completedAt: string;
  },
): boolean {
  const completed = withTreeLock(config, () => {
    const tree = readTaskTree(config) as SupervisorTree;
    const registry = { ...supervisorRecoveryRegistryV2(tree) };
    const record = registry[input.recoveryKey];
    if (
      !record ||
      record.status !== "claimed" ||
      record.leaseId !== input.leaseId
    ) {
      return false;
    }
    registry[input.recoveryKey] =
      input.actionKind === "request-owner"
        ? {
            ...record,
            status: "exhausted",
            ownerRequestedAt: input.completedAt,
            leaseId: undefined,
            leaseUntil: undefined,
          }
        : {
            ...record,
            status: "actioned",
            actionCount: record.actionCount + 1,
            lastActionAt: input.completedAt,
            leaseId: undefined,
            leaseUntil: undefined,
          };
    tree.supervisorRecoveries = registry;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    return true;
  });
  if (completed) {
    appendToolJournal(config, {
      kind: "project_supervisor_review_handoff_action_v2",
      recovery_key: input.recoveryKey,
      action_kind: input.actionKind,
      completed_at: input.completedAt,
    });
  }
  return completed;
}

export function failReviewHandoffActionV2(
  config: TaskTreeConfig,
  input: {
    recoveryKey: string;
    leaseId: string;
    actionKind: SupervisorActionKindV2;
    failedAt: string;
    reason: string;
  },
): boolean {
  const failed = withTreeLock(config, () => {
    const tree = readTaskTree(config) as SupervisorTree;
    const registry = { ...supervisorRecoveryRegistryV2(tree) };
    const record = registry[input.recoveryKey];
    if (
      !record ||
      record.status !== "claimed" ||
      record.leaseId !== input.leaseId
    ) {
      return false;
    }
    registry[input.recoveryKey] = {
      ...record,
      status: input.actionKind === "request-owner" ? "exhausted" : "failed",
      actionCount:
        input.actionKind === "request-owner"
          ? record.actionCount
          : record.actionCount + 1,
      lastActionAt: input.failedAt,
      lastFailureAt: input.failedAt,
      lastFailureReason: input.reason.slice(0, 1000),
      ownerRequestedAt:
        input.actionKind === "request-owner"
          ? input.failedAt
          : record.ownerRequestedAt,
      leaseId: undefined,
      leaseUntil: undefined,
    };
    tree.supervisorRecoveries = registry;
    saveTaskTreeWithKanbanSnapshot(config, tree);
    return true;
  });
  if (failed) {
    appendToolJournal(config, {
      kind: "project_supervisor_review_handoff_action_failed_v2",
      recovery_key: input.recoveryKey,
      action_kind: input.actionKind,
      failed_at: input.failedAt,
      reason: input.reason.slice(0, 1000),
    });
  }
  return failed;
}
