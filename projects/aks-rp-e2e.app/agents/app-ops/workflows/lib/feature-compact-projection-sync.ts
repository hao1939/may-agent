import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import {
  saveFeatureCompactLoopState,
  type FeatureCompactLoopState,
} from "./feature-compact-loop-store.js";

type SyncResult = {
  changed: boolean;
  taskId?: string;
  featureKey?: string;
  conditionId?: string;
};

type TaskStateSnapshot = {
  resources?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string => typeof entry === "string" && Boolean(entry),
      )
    : [];
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function appStatePath(appDir: string): string {
  return join(appDir, ".state", "feature-compact-loop", "state.json");
}

function projectStatePath(appDir: string): string | null {
  const base = basename(appDir);
  if (!base.endsWith(".app")) return null;
  const projectDir = join(dirname(appDir), base.slice(0, -4));
  const path = join(projectDir, ".state", "feature-compact-loop", "state.json");
  return existsSync(path) ? path : null;
}

function firstReviewEvidencePath(evidence: string[]): string | null {
  const path = evidence.find((entry) => entry.startsWith("evidence/archive/"));
  return path ?? null;
}

function phaseToStatus(phase: string): "pending" | "running" | "blocked" | null {
  if (phase === "waiting") return "blocked";
  if (phase === "running") return "running";
  if (phase === "pending" || phase === "ready" || phase === "attention") {
    return "pending";
  }
  return null;
}

function projectedWait(condition: Record<string, unknown>): {
  waitingCondition: string | null;
  waitingFor: Record<string, unknown> | null;
  resumeCondition: string | null;
} {
  const spec = record(condition.spec);
  const conditionId = text(record(condition.metadata).id);
  const type = text(spec.type);
  const subject = text(spec.subject);
  const expected = record(spec.expected);
  if (
    (type === "task.phase" || type === "task-phase" || type === "task-field") &&
    subject.startsWith("task:")
  ) {
    const taskId = subject.slice("task:".length);
    const equals = text(expected.equals);
    const field = text(expected.field) || (type === "task-field" ? "field" : "phase");
    const hasNotEquals = Object.prototype.hasOwnProperty.call(expected, "notEquals");
    const notEquals = hasNotEquals ? expected.notEquals : undefined;
    return {
      waitingCondition: conditionId || null,
      waitingFor: {
        type,
        taskId,
        field,
        ...(equals ? { equals } : {}),
        ...(hasNotEquals ? { notEquals } : {}),
        representedTaskIds: [taskId],
      },
      resumeCondition:
        taskId && equals
          ? `Resume when ${taskId} reports ${field}=${equals}.`
          : taskId && hasNotEquals
            ? `Resume when ${taskId} reports ${field} != ${JSON.stringify(notEquals)}.`
            : conditionId
              ? `Resume when condition ${conditionId} is satisfied.`
              : null,
    };
  }
  if (type === "aks.repo-ref.observed") {
    return {
      waitingCondition: conditionId || null,
      waitingFor: {
        type,
        subject,
        expected,
      },
      resumeCondition: conditionId
        ? `Resume when condition ${conditionId} is satisfied.`
        : null,
    };
  }
  return {
    waitingCondition: conditionId || null,
    waitingFor: conditionId ? { type, subject, expected } : null,
    resumeCondition: conditionId
      ? `Resume when condition ${conditionId} is satisfied.`
      : null,
  };
}

function projectedWaitTarget(
  waitingFor: Record<string, unknown> | null,
  conditionId: string | null,
): string | null {
  if (!waitingFor) {
    return conditionId ? `the exact wait ${conditionId}` : null;
  }

  const type = text(waitingFor.type);
  const taskId = text(waitingFor.taskId);
  const field = text(waitingFor.field) || (type === "task-field" ? "field" : "phase");
  const equals = text(waitingFor.equals);
  const hasNotEquals = Object.prototype.hasOwnProperty.call(waitingFor, "notEquals");
  const notEquals = hasNotEquals ? waitingFor.notEquals : undefined;

  if (taskId && equals) {
    return `the exact wait for ${taskId} to report ${field}=${equals}`;
  }
  if (taskId && hasNotEquals) {
    return `the exact wait for ${taskId} to report ${field} != ${JSON.stringify(notEquals)}`;
  }

  const subject = text(waitingFor.subject);
  if (type === "aks.repo-ref.observed" && subject) {
    return `the exact repo-ref wait on ${subject}`;
  }

  return conditionId ? `the exact wait ${conditionId}` : null;
}

function projectedNextStepClassification(input: {
  status: "pending" | "running" | "blocked";
  summary: string;
  waitTarget: string | null;
  currentValue: unknown;
}): string | null {
  if (input.status !== "blocked") {
    return text(input.currentValue) || null;
  }
  if (input.waitTarget) {
    return `Preserve the current feature-level compact holder and wait only for ${input.waitTarget} before reconsidering same-surface frontier changes.`;
  }
  return input.summary || null;
}

function projectedVerificationBlocker(input: {
  status: "pending" | "running" | "blocked";
  summary: string;
  waitTarget: string | null;
  currentValue: unknown;
}): string | null {
  if (input.status !== "blocked") {
    return text(input.currentValue) || null;
  }
  const existing = text(input.currentValue);
  const reason =
    input.summary ||
    (input.waitTarget
      ? `The truthful remaining compact blocker is ${input.waitTarget}.`
      : "");
  if (!reason) return existing || null;
  return reason.startsWith("Do not ")
    ? reason
    : `Do not rerun the unchanged whole package. ${reason}`;
}

function projectedOwnerReason(input: {
  status: "pending" | "running" | "blocked";
  taskId: string;
  summary: string;
  waitTarget: string | null;
  currentValue: unknown;
}): string | null {
  if (input.status !== "blocked") {
    return text(input.currentValue) || null;
  }
  if (input.summary) {
    return `Current task ${input.taskId} is the exact feature-level compact holder. ${input.summary}`;
  }
  if (input.waitTarget) {
    return `Current task ${input.taskId} is the exact feature-level compact holder and ${input.waitTarget} is the only remaining wake before same-surface frontier changes should be reconsidered.`;
  }
  return text(input.currentValue) || null;
}

function projectedResumeAction(input: {
  status: "pending" | "running" | "blocked";
  taskId: string;
  waitTarget: string | null;
  currentValue: unknown;
}): string | null {
  if (input.status !== "blocked") {
    return text(input.currentValue) || null;
  }
  if (input.waitTarget) {
    return `Keep the feature represented by ${input.taskId} while ${input.waitTarget} remains the exact wake.`;
  }
  return `Keep the feature represented by ${input.taskId}.`;
}

function projectedAttemptedFixes(input: {
  status: "pending" | "running" | "blocked";
  taskId: string;
  summary: string;
  waitTarget: string | null;
  currentValue: unknown;
}): string[] | null {
  if (input.status !== "blocked") {
    return stringList(input.currentValue) || null;
  }
  const reason =
    input.summary ||
    (input.waitTarget
      ? `Preserved the exact blocked holder until ${input.waitTarget}.`
      : `Preserved the exact blocked holder ${input.taskId}.`);
  return [
    `Projected ${input.taskId} into the feature-compact ledger and rewrote current blocked-state text to the exact remaining wake. ${reason}`,
  ];
}

function updateStateFile(
  path: string,
  featureKey: string,
  nextItem: Record<string, unknown>,
): boolean {
  const state = readJson<FeatureCompactLoopState>(path);
  if (!state?.features?.[featureKey]) return false;
  const current = state.features[featureKey] as Record<string, unknown>;
  if (JSON.stringify(current) === JSON.stringify(nextItem)) return false;
  saveFeatureCompactLoopState(path, {
    loopTaskId: state.loopTaskId,
    windowSize: state.windowSize,
    cursor: state.cursor,
    features: {
      [featureKey]: nextItem as FeatureCompactLoopState["features"][string],
    },
  });
  return true;
}

/**
 * Project a live feature-holder reconciliation into the app-owned compact-loop ledger.
 * This keeps the feature row synchronized when the holder advances to an exact wait.
 */
export function syncFeatureCompactProjection(
  appDir: string,
  taskId: string,
): SyncResult {
  const taskState = readJson<TaskStateSnapshot>(
    join(appDir, ".state", "tasks", "state.json"),
  );
  const appState = readJson<FeatureCompactLoopState>(appStatePath(appDir));
  if (!taskState?.resources || !appState?.features) {
    return { changed: false, taskId };
  }

  const resource = record(taskState.resources[taskId]);
  const spec = record(resource.spec);
  const status = record(resource.status);
  const input = record(spec.input);
  const phase = text(status.phase);
  const mappedStatus = phaseToStatus(phase);
  if (!mappedStatus) return { changed: false, taskId };

  const discoveredFeatureKey = Object.entries(appState.features).find(
    ([, item]) => {
      const row = record(item);
      const frontierTaskIds = stringList(row.frontierTaskIds);
      return row.taskId === taskId || frontierTaskIds.includes(taskId);
    },
  )?.[0];
  const featureKey = discoveredFeatureKey || text(input.featureKey);
  if (!featureKey) return { changed: false, taskId };

  const currentItem = record(appState.features[featureKey]);
  if (!Object.keys(currentItem).length) {
    return { changed: false, taskId, featureKey };
  }

  const evidence = stringList(status.evidence);
  const conditionId = stringList(status.conditionIds)[0] || "";
  const wait = conditionId
    ? projectedWait(record(taskState.conditions?.[conditionId]))
    : {
        waitingCondition: null,
        waitingFor: null,
        resumeCondition: null,
      };
  const summary = text(status.summary);
  const statusUpdatedAt = text(status.updatedAt) || new Date().toISOString();
  const waitTarget =
    mappedStatus === "blocked"
      ? projectedWaitTarget(wait.waitingFor, wait.waitingCondition)
      : null;
  const nextItem: Record<string, unknown> = {
    ...currentItem,
    status: mappedStatus,
    retryable: mappedStatus === "blocked" ? false : true,
    taskId,
    frontierTaskIds: [taskId],
    lastSummary: summary || currentItem.lastSummary || null,
    summary: summary || currentItem.summary || null,
    blockedReason:
      mappedStatus === "blocked"
        ? summary || currentItem.blockedReason || null
        : null,
    waitingCondition:
      mappedStatus === "blocked" ? wait.waitingCondition : null,
    waitingFor: mappedStatus === "blocked" ? wait.waitingFor : null,
    resumeCondition:
      mappedStatus === "blocked"
        ? wait.resumeCondition || currentItem.resumeCondition || null
        : currentItem.resumeCondition || null,
    retryReason:
      mappedStatus === "blocked"
        ? summary || currentItem.retryReason || null
        : currentItem.retryReason || null,
    ownerReason: projectedOwnerReason({
      status: mappedStatus,
      taskId,
      summary,
      waitTarget,
      currentValue: currentItem.ownerReason,
    }),
    attemptedFixes: projectedAttemptedFixes({
      status: mappedStatus,
      taskId,
      summary,
      waitTarget,
      currentValue: currentItem.attemptedFixes,
    }),
    nextStepClassification: projectedNextStepClassification({
      status: mappedStatus,
      summary,
      waitTarget,
      currentValue: currentItem.nextStepClassification,
    }),
    resumeAction: projectedResumeAction({
      status: mappedStatus,
      taskId,
      waitTarget,
      currentValue: currentItem.resumeAction,
    }),
    verificationBlocker: projectedVerificationBlocker({
      status: mappedStatus,
      summary,
      waitTarget,
      currentValue: currentItem.verificationBlocker,
    }),
    blockerOwner:
      mappedStatus === "blocked"
        ? text(spec.owner) || currentItem.blockerOwner || null
        : currentItem.blockerOwner || null,
    lastCheckedAt: statusUpdatedAt,
    updatedAt: statusUpdatedAt,
    reviewEvidencePath:
      firstReviewEvidencePath(evidence) || currentItem.reviewEvidencePath || null,
    evidencePaths:
      evidence.length > 0
        ? [...new Set([...(stringList(currentItem.evidencePaths) ?? []), ...evidence])]
        : currentItem.evidencePaths || null,
  };

  const appChanged = updateStateFile(appStatePath(appDir), featureKey, nextItem);
  const pairedProjectPath = projectStatePath(appDir);
  const projectChanged = pairedProjectPath
    ? updateStateFile(pairedProjectPath, featureKey, nextItem)
    : false;

  return {
    changed: appChanged || projectChanged,
    taskId,
    featureKey,
    conditionId: conditionId || undefined,
  };
}
