import { createHash } from "node:crypto";
import { automaticReviewConfig } from "./agents/evaluator/workflows/task-outcome-selector.js";
import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type TaskAction,
  type TaskIntent,
} from "@may-agent/sdk";

const projectId = "evaluation";
const evaluationExecutor = "codex-goal";
export const AFTERMATH_COVERAGE_METRIC_ID =
  "evaluator.aftermath-coverage-rate-3h";
export const LLM_COVERAGE_LAG_METRIC_ID = "eval.llm-coverage-lag-h";
export const LLM_COVERAGE_LAG_SOURCE_QUERY = `SELECT COALESCE(
  ROUND(
    (strftime('%s','now') * 1000 - MAX(createdAt)) / 3600000.0,
    2
  ),
  9999
) AS value
FROM evaluations
WHERE evaluatedByHeuristic = 0`;
export const LLM_EVALUATIONS_24H_METRIC_ID = "eval.llm-evals-24h";
export const LLM_EVALUATIONS_24H_SOURCE_QUERY = `SELECT COUNT(*) AS value
FROM evaluations
WHERE evaluatedByHeuristic = 0
  AND createdAt > (strftime('%s','now') * 1000 - 86400000)
  AND agent NOT IN ('evaluator', 'judge')`;
export const LOW_QUALITY_RATE_24H_METRIC_ID = "evaluator.low-quality-rate-24h";
export const LOW_QUALITY_RATE_24H_SOURCE_QUERY = `WITH counts AS (
  SELECT COUNT(*) AS total,
         SUM(
           CASE
             WHEN verdict IN ('needs_improvement', 'low_quality')
               OR quality < 0.4
               OR efficiency < 0.4
             THEN 1
             ELSE 0
           END
         ) AS low_quality
  FROM evaluations
  WHERE createdAt > (strftime('%s','now') * 1000 - 86400000)
    AND agent NOT IN ('evaluator', 'judge')
    AND verdict != 'skipped'
)
SELECT CASE
         WHEN total = 0 THEN 0
         ELSE ROUND(1.0 * low_quality / total, 4)
       END AS value,
       total AS sampleSize
FROM counts`;
export const SUBSTANTIVE_LOW_QUALITY_RATE_24H_METRIC_ID =
  "evaluator.substantive-low-quality-rate-24h";
export const SUBSTANTIVE_LOW_QUALITY_RATE_24H_SOURCE_QUERY = `WITH counts AS (
  SELECT COUNT(*) AS total,
         SUM(
           CASE
             WHEN lower(COALESCE(issues, '')) LIKE '%tool hallucination%'
               OR lower(COALESCE(issues, '')) LIKE '%verification failure%'
               OR lower(COALESCE(issues, '')) LIKE '%blind overwrite%'
               OR lower(COALESCE(issues, '')) LIKE '%fabricated%'
               OR lower(COALESCE(issues, '')) LIKE '%hallucinated path%'
             THEN 1
             ELSE 0
           END
         ) AS substantive_low_quality
  FROM evaluations
  WHERE createdAt > (strftime('%s','now') * 1000 - 86400000)
    AND agent NOT IN ('evaluator', 'judge')
    AND verdict != 'skipped'
)
SELECT CASE
         WHEN total = 0 THEN 0
         ELSE ROUND(1.0 * substantive_low_quality / total, 4)
       END AS value,
       total AS sampleSize
FROM counts`;
export const MEANINGFUL_REVIEW_RATE_24H_METRIC_ID =
  "evaluator.meaningful-review-rate-24h";
export const MEANINGFUL_REVIEW_RATE_24H_SOURCE_QUERY = `WITH counts AS (
  SELECT COALESCE(SUM(
           CASE
             WHEN event_type = 'evaluation.routed'
               AND json_extract(data, '$.lane') IN ('needs_triage', 'success_candidate')
             THEN 1
             ELSE 0
           END
         ), 0) AS routed,
         COALESCE(SUM(CASE WHEN event_type = 'evaluation.reviewed' THEN 1 ELSE 0 END), 0) AS reviewed
  FROM events
  WHERE timestamp > (strftime('%s','now') * 1000 - 86400000)
    AND event_type IN ('evaluation.routed', 'evaluation.reviewed')
)
SELECT CASE
         WHEN routed = 0 THEN 0
         ELSE ROUND(1.0 * MIN(reviewed, routed) / routed, 4)
       END AS value,
       routed AS sampleSize
FROM counts`;
export const TRIAGE_CLOSURE_RATE_24H_METRIC_ID =
  "evaluator.triage-closure-rate-24h";
export const TRIAGE_CLOSURE_RATE_24H_SOURCE_QUERY = `WITH counts AS (
  SELECT COALESCE(SUM(
           CASE
             WHEN event_type = 'evaluation.routed'
               AND json_extract(data, '$.lane') = 'needs_triage'
             THEN 1
             ELSE 0
           END
         ), 0) AS routed,
         COALESCE(SUM(CASE WHEN event_type = 'evaluation.triage_closed' THEN 1 ELSE 0 END), 0) AS closed
  FROM events
  WHERE timestamp > (strftime('%s','now') * 1000 - 86400000)
    AND event_type IN ('evaluation.routed', 'evaluation.triage_closed')
)
SELECT CASE
         WHEN routed = 0 THEN 0
         ELSE ROUND(1.0 * MIN(closed, routed) / routed, 4)
       END AS value,
       routed AS sampleSize
FROM counts`;
export const FALSE_GOOD_RATE_SAMPLE_METRIC_ID =
  "evaluator.false-good-rate-sample";
export const FALSE_GOOD_RATE_SAMPLE_SOURCE_QUERY = `WITH counts AS (
  SELECT COALESCE(SUM(
           CASE
             WHEN event_type = 'evaluation.reviewed'
               AND json_extract(data, '$.verdict') = 'good'
             THEN 1
             ELSE 0
           END
         ), 0) AS reviewed_good,
         COALESCE(SUM(CASE WHEN event_type = 'evaluation.false_good' THEN 1 ELSE 0 END), 0) AS false_good
  FROM events
  WHERE timestamp > (strftime('%s','now') * 1000 - 86400000)
    AND event_type IN ('evaluation.reviewed', 'evaluation.false_good')
)
SELECT CASE
         WHEN reviewed_good = 0 THEN 0
         ELSE ROUND(1.0 * false_good / reviewed_good, 4)
       END AS value,
       reviewed_good AS sampleSize
FROM counts`;
export const PROJECT_FINDING_DELIVERY_RATE_24H_METRIC_ID =
  "evaluator.project-finding-delivery-rate-24h";
export const PROJECT_FINDING_DELIVERY_RATE_24H_SOURCE_QUERY = `WITH counts AS (
  SELECT COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN delivery_status = 'accepted' THEN 1 ELSE 0 END), 0) AS delivered
  FROM events
  WHERE event_type = 'project.owner.requested'
    AND source = 'evaluation.app'
    AND timestamp > (strftime('%s','now') * 1000 - 86400000)
    AND json_extract(data, '$.reason') = 'evaluation-project-health-feedback'
)
SELECT CASE
         WHEN total = 0 THEN 0
         ELSE ROUND(1.0 * delivered / total, 4)
       END AS value,
       total AS sampleSize
FROM counts`;
export const PROJECT_FEEDBACK_PENDING_AGE_METRIC_ID =
  "evaluator.project-feedback-pending-age-h";
export const PROJECT_FEEDBACK_PENDING_AGE_SOURCE_QUERY = `WITH counts AS (
  SELECT COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN delivery_status = 'accepted' THEN 1 ELSE 0 END), 0) AS delivered,
         MIN(
           CASE
             WHEN delivery_status IN ('pending', 'unhandled') THEN timestamp
             ELSE NULL
           END
         ) AS oldest_pending
  FROM events
  WHERE event_type = 'project.owner.requested'
    AND source = 'evaluation.app'
    AND timestamp > (strftime('%s','now') * 1000 - 86400000)
    AND json_extract(data, '$.reason') = 'evaluation-project-health-feedback'
)
SELECT CASE
         WHEN oldest_pending IS NULL THEN 0
         ELSE ROUND((strftime('%s','now') * 1000 - oldest_pending) / 3600000.0, 2)
       END AS value,
       total - delivered AS sampleSize
FROM counts`;
export const FAILED_TRIAGE_RATE_3H_METRIC_ID = "session.failed-triage-rate-3h";
export const FAILED_TRIAGE_RATE_3H_SOURCE_QUERY = `WITH bounds AS (
  SELECT (strftime('%s','now') * 1000) AS measured_at
), failed_rows AS (
  SELECT s.sessionId,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM evaluations e
             WHERE e.sessionId = s.sessionId
           ) THEN 1
           ELSE 0
         END AS triaged
  FROM sessions s
  CROSS JOIN bounds b
  WHERE s.agent NOT IN ('evaluator', 'judge')
    AND COALESCE(s.endedAt, s.startedAt) > b.measured_at - 10800000
    AND COALESCE(s.endedAt, s.startedAt) <= b.measured_at - 420000
    AND COALESCE(s.error, '') != 'Clean start (fresh)'
    AND COALESCE(s.error, '') NOT IN (
      'Task-bound project session recovery is owned by the app task reconciler',
      'Task-bound execution is recovered through its Task, not by resuming the old session'
    )
    AND COALESCE(s.error, '') NOT LIKE 'Recovered task % interrupted an orphaned owner session from a previous runtime'
    AND COALESCE(s.error, '') NOT LIKE 'Recovered task % interrupted an orphaned agent session from a previous runtime'
    AND NOT (
      s.status = 'done'
      AND COALESCE(s.outcome, '') = 'done'
      AND COALESCE(s.error, '') = 'Cancelled'
    )
    AND (s.status IN ('error', 'interrupted') OR s.error IS NOT NULL)
    AND NOT (s.status = 'interrupted' AND s.error IS NULL)
), counts AS (
  SELECT COUNT(*) AS failed,
         COALESCE(SUM(triaged), 0) AS triaged
  FROM failed_rows
)
SELECT CASE
         WHEN counts.failed = 0 THEN 0
         ELSE ROUND(1.0 * counts.triaged / counts.failed, 4)
       END AS value,
       counts.failed AS sampleSize,
       bounds.measured_at AS measuredAt,
       json_object(
         'failed', counts.failed,
         'triaged', counts.triaged,
         'failedIds', json(COALESCE((
           SELECT json_group_array(sessionId)
           FROM (
             SELECT sessionId
             FROM failed_rows
             ORDER BY sessionId
             LIMIT 20
           )
         ), '[]'))
       ) AS note
FROM counts
CROSS JOIN bounds`;
export const AFTERMATH_COVERAGE_SOURCE_QUERY = `WITH bounds AS (
  SELECT (strftime('%s','now') * 1000 - 420000) AS window_end
), eligible AS (
  SELECT DISTINCT s.sessionId
  FROM sessions s
  CROSS JOIN bounds b
  WHERE s.status IN ('done', 'error', 'interrupted')
    AND s.agent NOT IN ('evaluator', 'judge')
    AND COALESCE(s.endedAt, s.startedAt) > b.window_end - 10800000
    AND COALESCE(s.endedAt, s.startedAt) <= b.window_end
    AND NOT (
      s.status = 'done'
      AND s.agent != 'may'
      AND COALESCE(s.workflowRunId, '') != ''
    )
    AND NOT EXISTS (
      SELECT 1
      FROM events latest
      WHERE latest.id = (
        SELECT MAX(candidate.id)
        FROM events candidate
        WHERE candidate.event_type = 'session.end'
          AND candidate.session_id = s.sessionId
      )
        AND s.status = 'interrupted'
        AND COALESCE(latest.source, '') != 'runtime:auto-resume'
        AND json_extract(latest.data, '$.interruptionKind') = 'observation-timeout'
    )
), counts AS (
  SELECT COUNT(*) AS eligible,
         COUNT(DISTINCT e.sessionId) AS evaluated
  FROM eligible x
  LEFT JOIN evaluations e ON e.sessionId = x.sessionId
)
SELECT CASE
         WHEN counts.eligible = 0 THEN 0.0
         ELSE ROUND(1.0 * counts.evaluated / counts.eligible, 4)
       END AS value,
       counts.eligible AS sampleSize,
       bounds.window_end AS measuredAt,
       json_object(
         'source', 'canonical-terminal-sessions+evaluations',
         'eligible', counts.eligible,
         'evaluated', counts.evaluated,
         'windowStart', bounds.window_end - 10800000,
         'windowEnd', bounds.window_end,
         'graceMs', 420000
       ) AS note
FROM counts
CROSS JOIN bounds`;
const detailsSchema = Type.Record(Type.String(), Type.Unknown());
const sessionSchema = Type.Object(
  {
    sessionId: Type.String({ minLength: 1 }),
    supersedeExisting: Type.Optional(Type.Boolean()),
    correctionId: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: true },
);
const evaluationFeedbackSchema = Type.Object(
  {
    sessionId: Type.String({ minLength: 1 }),
    agent: Type.String({ minLength: 1 }),
    verdict: Type.String({ minLength: 1 }),
    quality: Type.Number({ minimum: 0, maximum: 1 }),
    issues: Type.Array(Type.String()),
    createdAt: Type.Optional(Type.Number()),
  },
  { additionalProperties: true },
);

// Legacy exports remain readable for old tooling, but production selection is
// deliberately not a fixed allow-list. The owner review discovers loaded Apps
// through the normal catalog/control surface and creates ordinary App handoffs.
export const watchedProjectTargets: ReadonlyArray<{ targetProject: string }> =
  [];

const EVALUATION_APP_IDS = new Set(["evaluation", "evaluation.app"]);
const EVALUATION_AGENT_IDS = new Set(["evaluator", "judge"]);

function canonicalAppId(value: unknown): string {
  return stringValue(value)
    .toLowerCase()
    .replace(/\.app$/, "");
}

export function isEvaluationOwnedReference(value: unknown): boolean {
  const normalized = canonicalAppId(value);
  return (
    EVALUATION_APP_IDS.has(normalized) || EVALUATION_AGENT_IDS.has(normalized)
  );
}

/**
 * Cheap ingress guard only. Workflows must repeat the ownership check after
 * resolving canonical Task/session lineage; an absent hint is unknown, never
 * proof that the work belongs to another App.
 */
export function isExplicitlyEvaluationOwned(
  data: Record<string, unknown>,
  event?: AppEvent<Record<string, unknown>>,
): boolean {
  const target = record(data.target);
  return [
    data.appId,
    data.app_id,
    data.ownerAppId,
    data.owner_app_id,
    data.sourceAppId,
    data.source_app_id,
    data.project,
    data.projectId,
    data.targetProject,
    data.agent,
    data.owner,
    target.appId,
    target.project,
    event?.target?.appId,
    event?.target?.project,
    event?.owner,
  ].some(isEvaluationOwnedReference);
}

const evaluationInputSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("message"),
      data: Type.Object(
        {
          message: Type.String({ minLength: 1 }),
          context: Type.Optional(detailsSchema),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("evaluate-session"), data: sessionSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("review-task-outcome"),
      data: Type.Object(
        {
          appId: Type.String({ minLength: 1 }),
          taskId: Type.String({ minLength: 1 }),
          subjectGeneration: Type.Optional(Type.Number({ minimum: 1 })),
          evidenceHash: Type.Optional(
            Type.String({ minLength: 64, maxLength: 64 }),
          ),
          assessmentPurpose: Type.Optional(
            Type.Union([Type.Literal("outcome"), Type.Literal("ongoing")]),
          ),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("read-reports"),
      data: Type.Object(
        {
          operation: Type.Union([Type.Literal("list"), Type.Literal("read")]),
          path: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("automatic-review"), data: detailsSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("deep-eval"), data: sessionSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("owner-review"), data: detailsSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("feedback-record"),
      data: Type.Object(
        { evaluation: evaluationFeedbackSchema },
        { additionalProperties: true },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("project-review"),
      data: Type.Object(
        {
          targetProject: Type.Optional(Type.String({ minLength: 1 })),
          reason: Type.Optional(Type.String({ minLength: 1 })),
        },
        { additionalProperties: true },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("codex-goal-trial"),
      data: Type.Object(
        {
          targetProject: Type.String({ minLength: 1 }),
          focus: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("workflow-trial"),
      data: Type.Object(
        {
          targetProject: Type.String({ minLength: 1 }),
          focus: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("deep-scan"), data: detailsSchema },
    { additionalProperties: false },
  ),
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function eventData(
  event: AppEvent<Record<string, unknown>>,
): Record<string, unknown> {
  return record(event.data);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeTaskIdPart(value: unknown): string {
  const raw = String(value ?? "").trim();
  const normalized = raw
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (
    normalized === raw &&
    normalized.length <= 120 &&
    normalized !== "." &&
    normalized !== ".."
  ) {
    return normalized;
  }
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  return `${normalized.slice(0, 107) || "id"}-${digest}`;
}

export function validateEvaluationTaskAction(
  action: TaskAction,
): string | null {
  if (action.kind === "unblock-task" && action.taskId.startsWith("runtime/")) {
    return `${action.kind} cannot mutate reconciler-owned task ${action.taskId}`;
  }
  return null;
}

function eventSessionId(event: AppEvent<Record<string, unknown>>): string {
  const data = eventData(event);
  return stringValue(
    data.sessionId ??
      data.session_id ??
      event.target?.sessionId ??
      record(data.target).sessionId,
  );
}

function projectTarget(value: unknown): { targetProject: string } | null {
  const requested = stringValue(value);
  if (!requested) return null;
  const normalized = requested.endsWith(".app")
    ? requested
    : `${requested}.app`;
  return { targetProject: normalized };
}

function projectReviewInput(value: unknown): AppInput | null {
  const data = record(value);
  const target = projectTarget(data.targetProject ?? data.target);
  if (!target) return null;
  return {
    kind: "project-review",
    data: {
      ...data,
      ...target,
      reason: stringValue(data.reason) || "manual",
    },
  };
}

function isEvaluatorOwnerMessage(
  event: AppEvent<Record<string, unknown>>,
): boolean {
  const data = eventData(event);
  const target = record(data.target);
  const values = [
    event.owner,
    data.owner,
    data.to,
    event.target?.owner,
    target.owner,
  ].map((value) => stringValue(value).replace(/^agent:/, ""));
  const projects = [
    data.project,
    data.projectId,
    event.target?.project,
    target.project,
  ].map(stringValue);
  return (
    values.includes("evaluator") ||
    projects.includes(projectId) ||
    projects.includes(`${projectId}.app`)
  );
}

function ownerMessageInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  if (!isEvaluatorOwnerMessage(event)) return null;
  const data = eventData(event);
  const message =
    stringValue(data.message ?? data.text ?? data.comment) ||
    "Review the addressed evaluator request.";
  return { kind: "message", data: { message, context: data } };
}

export function taskIntentForInput(input: AppInput): TaskIntent | null {
  const data = record(input.data);
  switch (input.kind) {
    case "review-task-outcome": {
      const appId = stringValue(data.appId);
      const taskId = stringValue(data.taskId);
      if (!appId || !taskId) return null;
      const subjectGeneration = Number(data.subjectGeneration);
      const evidenceHash = stringValue(data.evidenceHash);
      const assessmentPurpose = stringValue(data.assessmentPurpose);
      const pinnedIdentity =
        Number.isSafeInteger(subjectGeneration) &&
        subjectGeneration > 0 &&
        evidenceHash
          ? `/generation-${subjectGeneration}/${safeTaskIdPart(evidenceHash)}`
          : "";
      const purposeIdentity = assessmentPurpose === "ongoing" ? "/ongoing" : "";
      return {
        id: `runtime/task-outcome/${safeTaskIdPart(appId)}/${safeTaskIdPart(taskId)}${purposeIdentity}${pinnedIdentity}`,
        parentId: "evaluation-system",
        outcome:
          assessmentPurpose === "ongoing"
            ? `Assess the current obligations of ${appId}/${taskId}.`
            : `Evaluate the accepted outcome of ${appId}/${taskId}.`,
        acceptance: [
          "Canonical public Task identity and evidence are read before judgment.",
          "An immutable report and machine-readable facts are read back before publication.",
        ],
        workflow: "task-outcome-review",
        input: {
          appId,
          taskId,
          ...(Number.isSafeInteger(subjectGeneration) && subjectGeneration > 0
            ? { subjectGeneration }
            : {}),
          ...(evidenceHash ? { evidenceHash } : {}),
          ...(assessmentPurpose === "ongoing" || assessmentPurpose === "outcome"
            ? { assessmentPurpose }
            : {}),
        },
        priority: "P1",
      };
    }
    case "read-reports": {
      const operation = stringValue(data.operation);
      const path = stringValue(data.path);
      if (!operation || (operation === "read" && !path)) return null;
      const key = operation === "read" ? safeTaskIdPart(path) : "latest";
      return {
        id: `runtime/report-reader/${key}`,
        parentId: "evaluation-system",
        outcome:
          operation === "read"
            ? `Read retained Evaluation report ${path}.`
            : "List retained Evaluation reports without starting a review.",
        acceptance: [
          "Only the configured durable report root is read.",
          "The operation does not invoke an evaluator or create a target finding.",
        ],
        workflow: "evaluation-report-reader",
        input: {
          operation,
          ...(path ? { path } : {}),
          ...(typeof data.limit === "number" ? { limit: data.limit } : {}),
        },
        priority: "P2",
      };
    }
    case "automatic-review":
      return {
        id: "runtime/task-outcome-selector",
        parentId: "evaluation-system",
        outcome: "Select at most one fair external Task outcome for review.",
        acceptance: [
          "Selection uses bounded public App and Task lists and excludes Evaluation.",
          "At most one canonical task-outcome review request is published.",
        ],
        workflow: "task-outcome-selector",
        input: { reason: stringValue(data.reason) || "scheduled" },
        priority: "P2",
      };
    case "evaluate-session": {
      const sessionId = stringValue(data.sessionId);
      if (!sessionId) return null;
      const supersedeExisting = data.supersedeExisting === true;
      const correctionId = stringValue(data.correctionId);
      if (supersedeExisting && !correctionId) return null;
      return {
        id: supersedeExisting
          ? `runtime/compat/session-aftermath-repair/${safeTaskIdPart(sessionId)}/${safeTaskIdPart(correctionId)}`
          : `runtime/compat/session-aftermath/${safeTaskIdPart(sessionId)}`,
        parentId: "evaluation-system",
        outcome: `Evaluate completed session ${sessionId} and publish its evidence-backed disposition.`,
        acceptance: [
          "A durable evaluation record or structured skip is linked to the exact source session.",
          "Any required review emits its structured outcome, while a review-process failure remains visible as evaluation.review_failed.",
        ],
        agent: "evaluator",
        workflow: "evaluator-aftermath",
        input: {
          sessionId,
          ...(stringValue(data.subjectAppId ?? data.appId)
            ? { subjectAppId: stringValue(data.subjectAppId ?? data.appId) }
            : {}),
          ...(supersedeExisting ? { supersedeExisting, correctionId } : {}),
        },
        priority: "P1",
      };
    }
    case "deep-eval": {
      const sessionId = stringValue(data.sessionId);
      if (!sessionId) return null;
      return {
        id: `runtime/compat/deep-eval/${safeTaskIdPart(sessionId)}`,
        parentId: "evaluation-system",
        outcome: `Run one deep evaluator review for session ${sessionId}.`,
        acceptance: [
          "The deep evaluator returns a workflow-traced judgment linked to the exact requested session.",
        ],
        workflow: "evaluator-deep-eval",
        input: {
          sessionId,
          ...(stringValue(data.subjectAppId ?? data.appId)
            ? { subjectAppId: stringValue(data.subjectAppId ?? data.appId) }
            : {}),
        },
        priority: "P1",
      };
    }
    case "deep-scan":
      return {
        id: "runtime/compat/deep-eval-scan",
        parentId: "evaluation-system",
        outcome:
          "Find and deeply evaluate at most one eligible recent session.",
        acceptance: [
          "At most one eligible recent session receives a workflow-traced deep evaluation.",
          "If no candidate exists, the reconciliation records that observation without duplicate work.",
        ],
        workflow: "evaluator-deep-eval",
        input: { scope: "deep-evaluation-candidates" },
        priority: "P2",
      };
    case "project-review": {
      const target = projectTarget(data.targetProject ?? data.target);
      if (!target) return null;
      return {
        id: `runtime/compat/project-audit/${safeTaskIdPart(target.targetProject)}`,
        parentId: "evaluation-system",
        outcome: `Maintain an independent, evidence-backed health assessment for ${target.targetProject}.`,
        acceptance: [
          "The current meaningful-state fingerprint is persisted for the target.",
          "Material changes or a due baseline produce an owner-facing report; unchanged scheduled samples remain no-op.",
          "New actionable findings are deduplicated and routed to the target owner.",
        ],
        workflow: "project-health-evaluator",
        input: { ...target },
        priority: "P1",
      };
    }
    case "codex-goal-trial": {
      const target = projectTarget(data.targetProject);
      const focus = stringValue(data.focus);
      if (!target || !focus) return null;
      const trialKey = createHash("sha256")
        .update(`${target.targetProject}\u0000${focus}`)
        .digest("hex")
        .slice(0, 12);
      return {
        id: `runtime/compat/codex-goal-trial/${safeTaskIdPart(target.targetProject)}/${trialKey}`,
        parentId: "evaluation-system",
        outcome: `Produce one bounded read-only assessment of ${target.targetProject}: ${focus}`,
        acceptance: [
          "The assessment answers the requested focus directly.",
          "Every material claim cites an exact current file, command result, or durable observation.",
          "No file, Task, external system, or repository state is changed.",
        ],
        // Retained compatibility action: project hints cannot prove canonical
        // external ownership, so the guarded workflow returns a neutral
        // insufficient-evidence result without invoking a semantic evaluator.
        workflow: "executor-trial",
        input: { ...target, focus, trial: true, readOnly: true },
        priority: "P2",
        category: "executor-trial",
      };
    }
    case "workflow-trial": {
      const target = projectTarget(data.targetProject);
      const focus = stringValue(data.focus);
      if (!target || !focus) return null;
      const trialKey = createHash("sha256")
        .update(`${target.targetProject}\u0000${focus}`)
        .digest("hex")
        .slice(0, 12);
      return {
        id: `runtime/compat/workflow-trial/${safeTaskIdPart(target.targetProject)}/${trialKey}`,
        parentId: "evaluation-system",
        outcome: `Produce one bounded read-only assessment of ${target.targetProject}: ${focus}`,
        acceptance: [
          "The assessment answers the requested focus directly.",
          "Every material claim cites an exact current file, command result, or durable observation.",
          "No file, Task, external system, or repository state is changed.",
        ],
        workflow: "executor-trial",
        input: { ...target, focus, trial: true, readOnly: true },
        priority: "P2",
        category: "executor-trial",
      };
    }
    case "feedback-record": {
      const evaluation = record(data.evaluation);
      const agent = stringValue(evaluation.agent);
      if (!agent || isEvaluationOwnedReference(agent)) return null;
      const feedbackKey = safeTaskIdPart(agent);
      return {
        id: `runtime/compat/evaluation-feedback/${feedbackKey}`,
        parentId: "evaluation-system",
        outcome: `Keep ${agent}'s generated last-eval feedback projection aligned with the latest durable evaluation fact.`,
        acceptance: [
          "The latest evaluation issues are projected to the matching agent feedback file.",
          "An issue-free latest evaluation removes stale generated feedback.",
        ],
        workflow: "evaluation-feedback-projection",
        input: {
          evaluation,
          feedbackKey,
          ...(data.exactReplay === true ? { exactReplay: true } : {}),
        },
        priority: "P2",
      };
    }
    case "owner-review":
      return {
        id: "runtime/compat/owner-review",
        parentId: "evaluation-system",
        outcome:
          "Keep evaluation.app's own organization coherent and act on evaluator-local exceptions.",
        acceptance: [
          "The owner returns revision-checked typed actions or a justified no-op with evidence.",
          "The owner does not take remediation ownership for findings about target projects.",
        ],
        agent: "evaluator",
        executor: evaluationExecutor,
        input: { scope: "evaluation.app" },
        priority: "P1",
      };
    default:
      return null;
  }
}

export function taskForEvaluationInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  const configured = taskIntentForInput(admitted.input);
  if (configured) {
    return { kind: "desired", intent: configured };
  }
  if (admitted.input.kind !== "message") {
    throw new Error(
      `Unsupported structured Evaluation input: ${admitted.input.kind}`,
    );
  }
  const taskId = safeTaskIdPart(admitted.id);
  return {
    kind: "desired",
    intent: {
      id: `runtime/compat/input/${taskId}`,
      parentId: "evaluation-system",
      outcome:
        "Interpret and handle one admitted free-form Evaluation message.",
      acceptance: [
        "The evaluator returns an evidence-backed result and a caller response when one is owed.",
      ],
      agent: "evaluator",
      executor: evaluationExecutor,
      input: {
        kind: "message",
        data: record(admitted.input.data),
      },
      priority: "P1",
    },
  };
}

function eventInput(
  kind: string,
  event: AppEvent<Record<string, unknown>>,
): AppInput {
  return { kind, data: eventData(event) };
}

export function taskInputForEvent(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  switch (event.type) {
    case "session.end":
      // Session identity and metadata cannot establish canonical work ownership.
      // New semantic evaluation is selected from public external App Tasks.
      return null;
    case "evaluation.task.review.requested": {
      const data = eventData(event);
      const appId = stringValue(data.appId);
      const taskId = stringValue(data.taskId);
      const assessmentPurpose = stringValue(data.assessmentPurpose);
      const subjectGeneration = Number(data.subjectGeneration);
      const evidenceHash = stringValue(data.evidenceHash);
      return appId && taskId && !isEvaluationOwnedReference(appId)
        ? {
            kind: "review-task-outcome",
            data: {
              appId,
              taskId,
              ...(Number.isSafeInteger(subjectGeneration) &&
              subjectGeneration > 0
                ? { subjectGeneration }
                : {}),
              ...(evidenceHash ? { evidenceHash } : {}),
              ...(assessmentPurpose === "ongoing" ||
              assessmentPurpose === "outcome"
                ? { assessmentPurpose }
                : {}),
            },
          }
        : null;
    }
    case "evaluation.task.select":
      return { kind: "automatic-review", data: eventData(event) };
    case "project.task.reconciled": {
      const data = eventData(event);
      const appId = stringValue(data.project ?? data.appId);
      const taskId = stringValue(data.taskId);
      return automaticReviewConfig().enabled &&
        (data.disposition === "incomplete" ||
          data.disposition === "retrying") &&
        appId &&
        taskId &&
        !isEvaluationOwnedReference(appId)
        ? {
            kind: "review-task-outcome",
            data: { appId, taskId, assessmentPurpose: "ongoing" },
          }
        : null;
    }
    case "evaluation.session.requested": {
      const sessionId = eventSessionId(event);
      if (isExplicitlyEvaluationOwned(eventData(event))) return null;
      return sessionId
        ? {
            kind: "evaluate-session",
            data: { ...eventData(event), sessionId },
          }
        : null;
    }
    case "evaluation.deep.requested": {
      const sessionId = eventSessionId(event);
      if (isExplicitlyEvaluationOwned(eventData(event))) return null;
      return sessionId
        ? { kind: "deep-eval", data: { ...eventData(event), sessionId } }
        : null;
    }
    case "evaluation.deep.scan":
      return eventInput("deep-scan", event);
    case "evaluation.project.review.requested":
      return projectReviewInput(eventData(event));
    case "evaluation.tick":
      return eventInput("owner-review", event);
    case "evaluation.review_failed":
      return {
        kind: "owner-review",
        data: { reason: "review-failed", reviewFailure: eventData(event) },
      };
    case "evaluation.recorded":
    case "evaluation.deep_recorded": {
      const evaluation = record(eventData(event).evaluation);
      return stringValue(evaluation.agent)
        ? { kind: "feedback-record", data: { evaluation } }
        : null;
    }
    default:
      return null;
  }
}

export function taskIntentForEvent(
  event: AppEvent<Record<string, unknown>>,
): TaskIntent | null {
  const input = taskInputForEvent(event);
  return input ? taskIntentForInput(input) : null;
}

// Legacy session/deep/project metric definitions remain declared so normal App
// activation can retire their persisted Host rows while preserving historical
// measurements. They have no breach/recovery wake lane.
export const retiredLegacyEvaluationMetricDefinitions = [
  {
    id: FAILED_TRIAGE_RATE_3H_METRIC_ID,
    name: "Failed session triage rate (3h)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 1,
    threshold: 0.8,
    unit: "ratio",
    priority: "P1" as const,
    status: "active",
    source: "recent failed sessions and evaluations",
    sourceQuery: FAILED_TRIAGE_RATE_3H_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: "<" as const,
    speed: "fast",
    description:
      "Share of failed non-evaluator sessions outside the seven-minute grace period that have any durable evaluation; windows below five failures remain neutral.",
  },
  {
    id: PROJECT_FEEDBACK_PENDING_AGE_METRIC_ID,
    name: "Oldest pending evaluation finding delivery (hours)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 0,
    threshold: 12,
    unit: "hours",
    priority: "P1" as const,
    status: "active",
    source: "Evaluation project-owner request events",
    sourceQuery: PROJECT_FEEDBACK_PENDING_AGE_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: ">" as const,
    speed: "fast",
    description:
      "Age in hours of the oldest recent pending or unhandled Evaluation project-health finding delivery.",
  },
  {
    id: PROJECT_FINDING_DELIVERY_RATE_24H_METRIC_ID,
    name: "Evaluation findings handled by target owner workflows (24h)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 0.8,
    threshold: 0.5,
    unit: "ratio",
    priority: "P1" as const,
    status: "active",
    source: "Evaluation project-owner request events",
    sourceQuery: PROJECT_FINDING_DELIVERY_RATE_24H_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: "<" as const,
    speed: "fast",
    description:
      "Share of recent Evaluation project-health finding requests accepted by target owner workflows.",
  },
  {
    id: FALSE_GOOD_RATE_SAMPLE_METRIC_ID,
    name: "Reviewed good sessions overturned (24h)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 0.05,
    threshold: 0.6,
    unit: "ratio",
    priority: "P2" as const,
    status: "active",
    source: "evaluation review and false-good events",
    sourceQuery: FALSE_GOOD_RATE_SAMPLE_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: ">" as const,
    speed: "fast",
    description:
      "Ratio of recent false-good overturn events to review events whose verdict was good.",
  },
  {
    id: TRIAGE_CLOSURE_RATE_24H_METRIC_ID,
    name: "Evaluator triage closure rate (24h)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 0.9,
    threshold: 0.7,
    unit: "ratio",
    priority: "P2" as const,
    status: "active",
    source: "evaluation triage route and closure events",
    sourceQuery: TRIAGE_CLOSURE_RATE_24H_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: "<" as const,
    speed: "fast",
    description:
      "Share of recent needs-triage routes covered by triage-closure events, capped at the routed count.",
  },
  {
    id: MEANINGFUL_REVIEW_RATE_24H_METRIC_ID,
    name: "Evaluator meaningful review rate (24h)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 0.9,
    threshold: 0.7,
    unit: "ratio",
    priority: "P2" as const,
    status: "active",
    source: "evaluation routing and review events",
    sourceQuery: MEANINGFUL_REVIEW_RATE_24H_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: "<" as const,
    speed: "fast",
    description:
      "Share of recent needs-triage and success-candidate routes covered by evaluation review events, capped at the routed count.",
  },
  {
    id: SUBSTANTIVE_LOW_QUALITY_RATE_24H_METRIC_ID,
    name: "Substantive evaluator quality failures (24h)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 0.1,
    threshold: 0.3,
    unit: "ratio",
    priority: "P1" as const,
    status: "active",
    source: "recent non-skipped evaluation issues",
    sourceQuery: SUBSTANTIVE_LOW_QUALITY_RATE_24H_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: ">" as const,
    speed: "fast",
    description:
      "Share of recent non-skipped evaluations whose issues name a substantive hallucination, verification, fabrication, or overwrite failure.",
  },
  {
    id: LOW_QUALITY_RATE_24H_METRIC_ID,
    name: "Broad needs-improvement/low-score evaluated sessions (24h, dashboard only)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 0.1,
    threshold: 0.8,
    unit: "ratio",
    priority: "P3" as const,
    status: "active",
    source: "recent non-skipped evaluations",
    sourceQuery: LOW_QUALITY_RATE_24H_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: ">" as const,
    speed: "fast",
    description:
      "Dashboard share of recent non-skipped evaluations with a needs-improvement verdict or quality or efficiency below 0.4.",
  },
  {
    id: LLM_EVALUATIONS_24H_METRIC_ID,
    name: "LLM-evaluated sessions (24h)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 4,
    threshold: 1,
    unit: "count",
    priority: "P2" as const,
    status: "active",
    source: "non-heuristic evaluations",
    sourceQuery: LLM_EVALUATIONS_24H_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: "<" as const,
    speed: "fast",
    description:
      "Count of durable non-heuristic evaluations for non-evaluator sessions in the trailing 24 hours.",
  },
  {
    id: LLM_COVERAGE_LAG_METRIC_ID,
    name: "LLM evaluation lag (hours since last non-heuristic eval)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 1,
    threshold: 4,
    unit: "hours",
    priority: "P0" as const,
    status: "active",
    source: "non-heuristic evaluations",
    sourceQuery: LLM_COVERAGE_LAG_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: ">" as const,
    speed: "fast",
    description:
      "Hours since the newest durable non-heuristic evaluation, or 9999 when no such evaluation exists.",
  },
  {
    id: AFTERMATH_COVERAGE_METRIC_ID,
    name: "Evaluator aftermath liveness (3h)",
    owner: "evaluator",
    project: projectId,
    type: "gauge" as const,
    target: 0.8,
    threshold: 0.2,
    unit: "ratio",
    priority: "P3" as const,
    status: "active",
    source: "canonical terminal sessions and evaluations",
    sourceQuery: AFTERMATH_COVERAGE_SOURCE_QUERY,
    measureInterval: 300_000,
    alertOp: "<" as const,
    speed: "fast",
    description:
      "Share of canonical terminal non-evaluator sessions in the trailing three-hour window, after a seven-minute evaluation grace period, that have a durable evaluation.",
  },
];

export const evaluationMetricDefinitions =
  retiredLegacyEvaluationMetricDefinitions.map((definition) => ({
    ...definition,
    status: "retired" as const,
  }));

const automaticReview = automaticReviewConfig();

const baseApp = defineApp({
  id: projectId,
  version: 1,
  agent: "evaluator",
  description:
    "Reviews external App Task outcomes. Use read-reports with operation list/read to discover retained results without starting an evaluation.",
  inputSchema: evaluationInputSchema,
  task: taskForEvaluationInput,
  workspace: { kind: "local", localPath: "." },
  subscriptions: [
    {
      id: "project-comment",
      event: { type: "project.comment.created", project: projectId },
      toInput: ownerMessageInput,
    },
    {
      id: "project-owner-request",
      event: { type: "project.owner.requested", project: projectId },
      toInput(event) {
        return { kind: "owner-review", data: eventData(event) };
      },
    },
    {
      id: "telegram-owner-reply",
      event: "telegram.reply",
      toInput: ownerMessageInput,
    },
    {
      id: "task-incomplete-review",
      event: "project.task.reconciled",
      toInput: taskInputForEvent,
    },
  ],
  observations: [
    "evaluation.deep_dispatched",
    "evaluation.deep_failed",
    "evaluation.owner_review_started",
    "evaluation.owner_review_failed",
    "evaluation.owner_reviewed",
    "evaluation.project.review_started",
    "evaluation.project.review_failed",
    "evaluation.project.review_skipped",
    "evaluation.project.reviewed",
  ],
  schedules: [
    // No selector schedule exists unless the explicit rollout flag is true.
    ...(automaticReview.enabled
      ? [
          {
            id: "task-outcome-selector",
            intervalMs: automaticReview.intervalMs,
            input: { kind: "automatic-review", data: { reason: "scheduled" } },
            catchUp: "latest" as const,
          },
        ]
      : []),
  ],
  actions: {
    "review-task-outcome": {
      description:
        "Evaluate one exact external App Task outcome using bounded public evidence.",
      inputSchema: Type.Object(
        {
          appId: Type.String({ minLength: 1 }),
          taskId: Type.String({ minLength: 1 }),
          subjectGeneration: Type.Optional(Type.Number({ minimum: 1 })),
          evidenceHash: Type.Optional(
            Type.String({ minLength: 64, maxLength: 64 }),
          ),
          assessmentPurpose: Type.Optional(
            Type.Union([Type.Literal("outcome"), Type.Literal("ongoing")]),
          ),
        },
        { additionalProperties: false },
      ),
      toInput: (data) => ({ kind: "review-task-outcome", data }),
    },
    "list-evaluation-reports": {
      description:
        "List retained Evaluation reports without starting an evaluation.",
      inputSchema: Type.Object(
        { limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })) },
        { additionalProperties: false },
      ),
      toInput: (data) => ({
        kind: "read-reports",
        data: { operation: "list", ...record(data) },
      }),
    },
    "read-evaluation-report": {
      description:
        "Read one retained Evaluation report by its listed relative path.",
      inputSchema: Type.Object(
        { path: Type.String({ minLength: 1, maxLength: 512 }) },
        { additionalProperties: false },
      ),
      toInput: (data) => ({
        kind: "read-reports",
        data: { operation: "read", ...record(data) },
      }),
    },
    "evaluate-session": {
      description: "Evaluate a specific session by sessionId.",
      inputSchema: sessionSchema,
      toInput: (data) => ({ kind: "evaluate-session", data }),
    },
    "repair-session-evaluation": {
      description:
        "Supersede an evaluation that does not reflect the complete terminal lifecycle.",
      inputSchema: Type.Object(
        {
          sessionId: Type.String({ minLength: 1 }),
          correctionId: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
      toInput: (data) => {
        const repair = record(data);
        return {
          kind: "evaluate-session",
          data: {
            sessionId: stringValue(repair.sessionId),
            correctionId: stringValue(repair.correctionId),
            supersedeExisting: true,
          },
        };
      },
    },
    "deep-eval": {
      description: "Run one deep evaluator review for a specific session.",
      inputSchema: sessionSchema,
      toInput: (data) => ({ kind: "deep-eval", data }),
    },
    "project-evaluation-feedback": {
      description:
        "Replay one durable evaluation fact through the canonical feedback projection task.",
      inputSchema: Type.Object(
        { evaluation: evaluationFeedbackSchema },
        { additionalProperties: false },
      ),
      toInput: (data) => ({
        kind: "feedback-record",
        data: { ...record(data), exactReplay: true },
      }),
    },
    "review-evaluation-project": {
      description: "Run the learned evaluation owner-review workflow.",
      inputSchema: Type.Object({}, { additionalProperties: true }),
      toInput: (data) => ({ kind: "owner-review", data }),
    },
    "review-agent-app": {
      description:
        "Review a target App from the outside and write owner-facing health feedback.",
      inputSchema: Type.Object(
        {
          targetProject: Type.Optional(Type.String({ minLength: 1 })),
          reason: Type.Optional(Type.String({ minLength: 1 })),
        },
        { additionalProperties: true },
      ),
      toInput: (data) => projectReviewInput(data),
    },
    "trial-codex-goal-review": {
      description:
        "Retained compatibility action: return a neutral bounded result because a project hint cannot prove canonical external Task ownership.",
      inputSchema: Type.Object(
        {
          targetProject: Type.String({ minLength: 1 }),
          focus: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
      toInput: (data) => ({ kind: "codex-goal-trial", data }),
    },
    "trial-workflow-review": {
      description:
        "Run one manual, read-only evaluation task through Evaluation's workflow executor.",
      inputSchema: Type.Object(
        {
          targetProject: Type.String({ minLength: 1 }),
          focus: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
      toInput: (data) => ({ kind: "workflow-trial", data }),
    },
  },
  tasks: {
    subscriptions: [
      { type: "evaluation.task.review.requested", project: projectId },
      { type: "evaluation.task.select", project: projectId },
      { type: "evaluation.session.requested", project: projectId },
      { type: "evaluation.deep.requested", project: projectId },
      { type: "evaluation.deep.scan", project: projectId },
      { type: "evaluation.project.review.requested", project: projectId },
      { type: "evaluation.tick", project: projectId },
      "evaluation.review_failed",
      { type: "evaluation.recorded", project: projectId },
      { type: "evaluation.deep_recorded", project: projectId },
    ],
    resolve: taskIntentForEvent,
    validateAction: validateEvaluationTaskAction,
    // Initial rollout is deliberately serialized. Automatic semantic sampling
    // is disabled above; explicit trials cannot create a review storm.
    maxConcurrent: 1,
  },
});
const app = { ...baseApp, metrics: evaluationMetricDefinitions };

export default app;
