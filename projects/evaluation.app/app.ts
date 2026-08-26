import { createHash } from "node:crypto";
import { shouldDeferResumableInterruption } from "./agents/evaluator/workflows/evaluator-aftermath.js";
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
         WHEN counts.eligible = 0 THEN 1.0
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

export const watchedProjectTargets = [
  { targetProject: "aks-rp-e2e.app" },
  { targetProject: "may-agent.app" },
  { targetProject: "scout-knowledge-lib.app" },
  { targetProject: "gym.app" },
  { targetProject: "evaluation.app" },
] as const;

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
  const taskId = action.kind === "create-task" ? action.id : action.taskId;
  if (taskId.startsWith("runtime/")) {
    return `${action.kind} cannot mutate reconciler-owned task ${taskId}`;
  }
  if (
    action.kind === "create-task" &&
    action.parentId !== "runtime/owner-review" &&
    !action.parentId.startsWith("input/")
  ) {
    return `create-task ${taskId} must remain under its open-ended Evaluation task`;
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

function projectTarget(value: unknown): (typeof watchedProjectTargets)[number] {
  const requested = stringValue(value);
  return (
    watchedProjectTargets.find(
      (target) =>
        target.targetProject === requested ||
        target.targetProject.replace(/\.app$/, "") === requested,
    ) ?? watchedProjectTargets[0]
  );
}

function projectReviewInput(value: unknown): AppInput {
  const data = record(value);
  const target = projectTarget(data.targetProject ?? data.target);
  return {
    kind: "project-review",
    data: {
      ...data,
      ...target,
      reason: stringValue(data.reason) || "manual",
    },
  };
}

function metricId(event: AppEvent<Record<string, unknown>>): string {
  const data = eventData(event);
  return stringValue(
    data.metricId ?? data.metric_id ?? data.metric ?? event.target?.metricId,
  );
}

function isEvaluationMetric(event: AppEvent<Record<string, unknown>>): boolean {
  const data = eventData(event);
  const project = stringValue(
    data.project ?? data.projectId ?? event.target?.project,
  );
  const owner = stringValue(
    event.owner ?? data.owner ?? event.target?.owner,
  ).replace(/^agent:/, "");
  const id = metricId(event);
  return (
    project === projectId ||
    project === `${projectId}.app` ||
    owner === "evaluator" ||
    id.startsWith("evaluator.") ||
    id.startsWith("evaluation.") ||
    id.startsWith("eval.")
  );
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
    case "evaluate-session": {
      const sessionId = stringValue(data.sessionId);
      if (!sessionId) return null;
      const supersedeExisting = data.supersedeExisting === true;
      const correctionId = stringValue(data.correctionId);
      if (supersedeExisting && !correctionId) return null;
      return {
        id: supersedeExisting
          ? `runtime/session-aftermath-repair/${safeTaskIdPart(sessionId)}/${safeTaskIdPart(correctionId)}`
          : `runtime/session-aftermath/${safeTaskIdPart(sessionId)}`,
        parentId: "session-audit",
        outcome: `Evaluate completed session ${sessionId} and publish its evidence-backed disposition.`,
        acceptance: [
          "A durable evaluation record or structured skip is linked to the exact source session.",
          "Any required review emits its structured outcome, while a review-process failure remains visible as evaluation.review_failed.",
        ],
        mode: "achieve",
        agent: "evaluator",
        workflow: "evaluator-aftermath",
        input: {
          sessionId,
          ...(supersedeExisting ? { supersedeExisting, correctionId } : {}),
        },
        priority: "P1",
      };
    }
    case "deep-eval": {
      const sessionId = stringValue(data.sessionId);
      if (!sessionId) return null;
      return {
        id: `runtime/deep-eval/${safeTaskIdPart(sessionId)}`,
        parentId: "session-audit",
        outcome: `Run one deep evaluator review for session ${sessionId}.`,
        acceptance: [
          "The deep evaluator returns a workflow-traced judgment linked to the exact requested session.",
        ],
        mode: "achieve",
        workflow: "evaluator-deep-eval",
        input: { sessionId },
        priority: "P1",
      };
    }
    case "deep-scan":
      return {
        id: "runtime/deep-eval-scan",
        parentId: "pipeline-health",
        outcome:
          "Find and deeply evaluate at most one eligible recent session.",
        acceptance: [
          "At most one eligible recent session receives a workflow-traced deep evaluation.",
          "If no candidate exists, the reconciliation records that observation without duplicate work.",
        ],
        mode: "maintain",
        workflow: "evaluator-deep-eval",
        input: { scope: "deep-evaluation-candidates" },
        priority: "P2",
      };
    case "project-review": {
      const target = projectTarget(data.targetProject ?? data.target);
      return {
        id: `runtime/project-audit/${safeTaskIdPart(target.targetProject)}`,
        parentId: "project-app-audit",
        outcome: `Maintain an independent, evidence-backed health assessment for ${target.targetProject}.`,
        acceptance: [
          "The current meaningful-state fingerprint is persisted for the target.",
          "Material changes or a due baseline produce an owner-facing report; unchanged scheduled samples remain no-op.",
          "New actionable findings are deduplicated and routed to the target owner.",
        ],
        mode: "maintain",
        workflow: "project-health-evaluator",
        input: { ...target },
        priority: "P1",
      };
    }
    case "codex-goal-trial": {
      const target = projectTarget(data.targetProject);
      const focus = stringValue(data.focus);
      if (!focus) return null;
      const trialKey = createHash("sha256")
        .update(`${target.targetProject}\u0000${focus}`)
        .digest("hex")
        .slice(0, 12);
      return {
        id: `runtime/codex-goal-trial/${safeTaskIdPart(target.targetProject)}/${trialKey}`,
        parentId: "project-app-audit",
        outcome: `Produce one bounded read-only assessment of ${target.targetProject}: ${focus}`,
        acceptance: [
          "The assessment answers the requested focus directly.",
          "Every material claim cites an exact current file, command result, or durable observation.",
          "No file, Task, external system, or repository state is changed.",
        ],
        mode: "achieve",
        agent: "evaluator",
        executor: evaluationExecutor,
        input: { ...target, focus, trial: true, readOnly: true },
        priority: "P2",
        category: "executor-trial",
      };
    }
    case "workflow-trial": {
      const target = projectTarget(data.targetProject);
      const focus = stringValue(data.focus);
      if (!focus) return null;
      const trialKey = createHash("sha256")
        .update(`${target.targetProject}\u0000${focus}`)
        .digest("hex")
        .slice(0, 12);
      return {
        id: `runtime/workflow-trial/${safeTaskIdPart(target.targetProject)}/${trialKey}`,
        parentId: "project-app-audit",
        outcome: `Produce one bounded read-only assessment of ${target.targetProject}: ${focus}`,
        acceptance: [
          "The assessment answers the requested focus directly.",
          "Every material claim cites an exact current file, command result, or durable observation.",
          "No file, Task, external system, or repository state is changed.",
        ],
        mode: "achieve",
        workflow: "executor-trial",
        input: { ...target, focus, trial: true, readOnly: true },
        priority: "P2",
        category: "executor-trial",
      };
    }
    case "feedback-record": {
      const evaluation = record(data.evaluation);
      const agent = stringValue(evaluation.agent);
      if (!agent) return null;
      const feedbackKey = safeTaskIdPart(agent);
      return {
        id: `runtime/evaluation-feedback/${feedbackKey}`,
        parentId: "finding-delivery",
        outcome: `Keep ${agent}'s generated last-eval feedback projection aligned with the latest durable evaluation fact.`,
        acceptance: [
          "The latest evaluation issues are projected to the matching agent feedback file.",
          "An issue-free latest evaluation removes stale generated feedback.",
        ],
        mode: "maintain",
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
        id: "runtime/owner-review",
        parentId: "evaluator-reliability",
        outcome:
          "Keep evaluation.app's own organization coherent and act on evaluator-local exceptions.",
        acceptance: [
          "The owner returns revision-checked typed actions or a justified no-op with evidence.",
          "The owner does not take remediation ownership for findings about target projects.",
        ],
        mode: "maintain",
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
  const taskId = safeTaskIdPart(admitted.id);
  return {
    kind: "desired",
    intent: {
      id: `input/${taskId}`,
      parentId: "evaluator-reliability",
      outcome: `Interpret and handle admitted evaluation input ${admitted.input.kind}.`,
      acceptance: [
        "The evaluator returns an evidence-backed result and a caller response when one is owed.",
      ],
      mode: "achieve",
      agent: "evaluator",
      executor: evaluationExecutor,
      input: {
        kind: admitted.input.kind,
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
    case "session.end": {
      const data = eventData(event);
      const agent = stringValue(data.agent);
      const sessionId = eventSessionId(event);
      const status = stringValue(data.status ?? data.outcome);
      const workflowRunId = stringValue(data.workflowRunId);
      const routineWorkflowSession =
        status === "done" && agent !== "may" && Boolean(workflowRunId);
      const awaitingSameSessionAutoResume = shouldDeferResumableInterruption(
        event.source,
        data,
      );
      return agent === "evaluator" ||
        agent === "judge" ||
        !sessionId ||
        routineWorkflowSession ||
        awaitingSameSessionAutoResume
        ? null
        : {
            kind: "evaluate-session",
            data: { sessionId },
          };
    }
    case "evaluation.session.requested": {
      const sessionId = eventSessionId(event);
      return sessionId
        ? {
            kind: "evaluate-session",
            data: { ...eventData(event), sessionId },
          }
        : null;
    }
    case "evaluation.deep.requested": {
      const sessionId = eventSessionId(event);
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
      return projectReviewInput({
        targetProject: "evaluation.app",
        reason: "review-failed",
        reviewFailure: eventData(event),
      });
    case "metric.breach":
    case "metric.recovered":
      if (event.type === "metric.breach" && eventData(event).repeat === true)
        return null;
      return isEvaluationMetric(event)
        ? {
            kind: "owner-review",
            data: { reason: event.type, metric: eventData(event) },
          }
        : null;
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

export const evaluationMetricDefinitions = [
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

const baseApp = defineApp({
  id: projectId,
  version: 1,
  agent: "evaluator",
  description:
    "Independent session and App auditing with evidence-backed owner and human reporting.",
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
    {
      id: "owner-heartbeat",
      intervalMs: 86_400_000,
      event: {
        type: "evaluation.tick",
        data: { reason: "owner-heartbeat" },
        target: { appId: projectId, project: projectId },
      },
    },
    {
      id: "deep-evaluation-scan",
      intervalMs: 1_800_000,
      event: {
        type: "evaluation.deep.scan",
        data: { reason: "scheduled" },
        target: { appId: projectId, project: projectId },
      },
    },
    ...watchedProjectTargets.map((target) => ({
      id: `project-health-loop-${target.targetProject}`,
      intervalMs: 7_200_000,
      event: {
        type: "evaluation.project.review.requested",
        data: { ...target, reason: "scheduled" },
        target: { appId: projectId, project: projectId },
      },
    })),
  ],
  actions: {
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
        "Run one manual, read-only evaluation task through Evaluation's resumable Codex executor.",
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
      "session.end",
      { type: "evaluation.session.requested", project: projectId },
      { type: "evaluation.deep.requested", project: projectId },
      { type: "evaluation.deep.scan", project: projectId },
      { type: "evaluation.project.review.requested", project: projectId },
      { type: "evaluation.tick", project: projectId },
      "evaluation.review_failed",
      "metric.breach",
      "metric.recovered",
      { type: "evaluation.recorded", project: projectId },
      { type: "evaluation.deep_recorded", project: projectId },
    ],
    resolve: taskIntentForEvent,
    validateAction: validateEvaluationTaskAction,
    // Aftermath production must keep pace with bursty direct-session traffic.
    // The previous cap of five allowed old backlog work to consume roughly
    // half of the available lanes while fresh eligible sessions aged out of
    // the three-hour coverage window.
    maxConcurrent: 16,
  },
});
const app = { ...baseApp, metrics: evaluationMetricDefinitions };

export default app;
