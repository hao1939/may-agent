import { createHash } from "node:crypto";
import type { SubjectEvidence } from "./public-task-evidence.js";
import {
  ONGOING_TASK_RUBRIC_VERSION,
  TASK_OUTCOME_RUBRIC_VERSION,
  type AssessmentPurpose,
} from "./task-report-store.js";

export type AssessmentContext = {
  purpose: AssessmentPurpose;
  rubricVersion: string;
  validityIdentity: string;
  validity: {
    phase: "before-due" | "due" | "unknown";
    dueAt: number | null;
    boundaries: Array<{
      conditionId: string;
      dueAt: number;
      phase: "before-due" | "due";
    }>;
  };
};

const MIN_CONDITION_REVIEW_AFTER_MS = 60_000;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function conditionDueBoundaries(
  detail: Record<string, unknown>,
  nowMs: number,
): AssessmentContext["validity"]["boundaries"] {
  const conditions = object(detail.diagnostics).conditions;
  if (!Array.isArray(conditions)) return [];
  return conditions
    .flatMap((value) => {
      const entry = object(value);
      const conditionId = text(entry.id);
      const condition = object(entry.condition);
      const spec = object(condition.spec);
      const status = object(condition.status);
      if (!conditionId || text(status.state) === "true") return [];
      const reviewAfterMs = Number(spec.reviewAfterMs);
      const observedAt = Date.parse(String(status.observedAt ?? ""));
      if (
        !Number.isInteger(reviewAfterMs) ||
        reviewAfterMs < MIN_CONDITION_REVIEW_AFTER_MS ||
        !Number.isFinite(observedAt)
      )
        return [];
      const dueAt = observedAt + reviewAfterMs;
      return [
        {
          conditionId,
          dueAt,
          phase: nowMs < dueAt ? ("before-due" as const) : ("due" as const),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.dueAt - right.dueAt ||
        left.conditionId.localeCompare(right.conditionId),
    );
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
  const boundaries = conditionDueBoundaries(
    object(object(subject.task).detail),
    nowMs,
  );
  const dueAt = boundaries[0]?.dueAt ?? null;
  const phase = !boundaries.length
    ? "unknown"
    : boundaries.some((boundary) => boundary.phase === "due")
      ? "due"
      : "before-due";
  const validityIdentity = boundaries.length
    ? `condition-boundaries:${createHash("sha256")
        .update(JSON.stringify(boundaries))
        .digest("hex")}`
    : "condition-boundaries:none";
  return {
    purpose,
    rubricVersion: ONGOING_TASK_RUBRIC_VERSION,
    validityIdentity,
    validity: { phase, dueAt, boundaries },
  };
}
