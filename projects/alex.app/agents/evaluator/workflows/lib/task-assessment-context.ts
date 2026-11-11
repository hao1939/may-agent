import { createHash } from "node:crypto";
import type { SubjectEvidence } from "./public-task-evidence.js";
import {
  ONGOING_TASK_RUBRIC_VERSION,
  SYSTEMIC_TASK_RUBRIC_VERSION,
  TASK_OUTCOME_RUBRIC_VERSION,
  type AssessmentPurpose,
} from "./task-report-store.js";

type ValidityBoundary =
  | {
      taskReviewAt: true;
      dueAt: number;
      phase: "before-due" | "due";
    }
  | {
      inputWaitKey: string;
      dueAt: number;
      phase: "before-due" | "due";
    };

export type AssessmentContext = {
  purpose: AssessmentPurpose;
  rubricVersion: string;
  validityIdentity: string;
  validity: {
    phase: "before-due" | "due" | "unknown";
    dueAt: number | null;
    boundaries: ValidityBoundary[];
  };
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function deadline(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
function boundaryIdentity(boundary: ValidityBoundary): string {
  if ("inputWaitKey" in boundary) return `input-wait:${boundary.inputWaitKey}`;
  return "task:reviewAt";
}

function currentObligationBoundaries(
  appTask: Record<string, unknown>,
  nowMs: number,
): ValidityBoundary[] {
  const obligations = object(appTask.currentObligations);
  if (obligations.available !== true) return [];
  const boundaries: ValidityBoundary[] = [];
  const taskReviewAt = deadline(obligations.reviewAt);
  if (taskReviewAt !== null)
    boundaries.push({
      taskReviewAt: true,
      dueAt: taskReviewAt,
      phase: nowMs < taskReviewAt ? "before-due" : "due",
    });
  const waits = object(obligations.inputWaits).items;
  if (!Array.isArray(waits)) return boundaries;
  for (const value of waits) {
    const wait = object(value);
    const inputWaitKey = text(wait.key);
    const dueAt = deadline(wait.reviewAt);
    if (!inputWaitKey || dueAt === null) continue;
    boundaries.push({
      inputWaitKey,
      dueAt,
      phase: nowMs < dueAt ? "before-due" : "due",
    });
  }
  return boundaries;
}

export function taskReviewValidity(
  appTask: Record<string, unknown>,
  nowMs = Date.now(),
): AssessmentContext["validity"] {
  const boundaries = currentObligationBoundaries(appTask, nowMs).sort(
    (left, right) =>
      left.dueAt - right.dueAt ||
      boundaryIdentity(left).localeCompare(boundaryIdentity(right)),
  );
  const dueAt = boundaries[0]?.dueAt ?? null;
  const phase = !boundaries.length
    ? "unknown"
    : boundaries.some((boundary) => boundary.phase === "due")
      ? "due"
      : "before-due";
  return { phase, dueAt, boundaries };
}

export function assessmentContext(
  subject: SubjectEvidence,
  requested: unknown,
  nowMs = Date.now(),
): AssessmentContext {
  const purpose: AssessmentPurpose =
    requested === "ongoing" ? "ongoing" : "outcome";
  if (purpose === "outcome")
    return {
      purpose,
      rubricVersion: TASK_OUTCOME_RUBRIC_VERSION,
      validityIdentity: "",
      validity: { phase: "unknown", dueAt: null, boundaries: [] },
    };
  const task = object(subject.task);
  const { phase, dueAt, boundaries } = taskReviewValidity(
    object(task.appTask),
    nowMs,
  );
  const validityIdentity = boundaries.length
    ? `current-obligation-boundaries:${createHash("sha256")
        .update(JSON.stringify(boundaries))
        .digest("hex")}`
    : "condition-boundaries:none";
  return {
    purpose,
    rubricVersion: subject.task?.population
      ? SYSTEMIC_TASK_RUBRIC_VERSION
      : ONGOING_TASK_RUBRIC_VERSION,
    validityIdentity,
    validity: { phase, dueAt, boundaries },
  };
}
