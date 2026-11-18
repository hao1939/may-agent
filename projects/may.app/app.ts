import { Type } from "@may-agent/sdk";
import { defineApp, type AppDefinition, type AppEvent, type AppInput, type AppTaskAttachment, type AppTaskInput } from "@may-agent/sdk/app";
import {
  createGitHubPullRequestObservers,
  validateGitHubPullRequestCondition,
} from "./watchers/github-pull-request.js";

import {
  EVALUATION_OPERATION_METRIC,
  reliabilityMetrics,
  REVIEW_LAG_METRIC,
} from "./reliability-metrics.js";

import retiredAksMetrics from "./retired-aks-metrics.json" with { type: "json" };
import { retiredLegacyMetrics } from "./retired-legacy-metrics.js";
import { effortMetrics, EVALUATION_EFFORT_METRIC } from "./effort-metrics.js";

import { createMetricEvidenceObserver } from "./watchers/metric-evidence.js";
import {
  metricReviewInput,
  readMetricReview,
} from "./metric-follow-through.js";

const [, githubPullRequestObserver] = createGitHubPullRequestObservers({
  repository: "hao1939/may-agent",
  author: "hao1939",
  appId: "may",
  project: "may",
});

const detailsSchema = Type.Record(Type.String(), Type.Unknown());
const teamAssignmentSchema = Type.Object(
  { agent: Type.Literal("may") },
  { additionalProperties: false },
);

const mayInputSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("goal"),
      data: Type.Object(
        {
          outcome: Type.String({ minLength: 1 }),
          constraints: Type.Optional(
            Type.Array(Type.String({ minLength: 1 }), { maxItems: 32 }),
          ),
          acceptance: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            maxItems: 32,
          }),
          revision: Type.Optional(
            Type.Object(
              {
                taskId: Type.String({ minLength: 1 }),
                expectedGeneration: Type.Integer({ minimum: 1 }),
              },
              { additionalProperties: false },
            ),
          ),
          assignment: Type.Optional(teamAssignmentSchema),
        },
        { additionalProperties: true },
      ),
    },
    { additionalProperties: false },
  ),
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
]);

function selectedAgent(data: Record<string, unknown>): string {
  const assignment = record(data.assignment);
  if (Object.keys(assignment).length === 0) return "may";
  if (assignment.agent !== "may") {
    throw new Error(
      "May goal assignment must select May; system-improvement specialists are owned by App alex",
    );
  }
  return "may";
}

// One standing intake responsibility; individual publications remain exact Task inputs.
// Keeping its intent fixed lets new evidence reuse work without revising requirements.
const evaluationIntakeContract = {
  outcome: "Review Evaluation findings, verify current concerns and arrange justified follow-through.",
  acceptance: [
    "Record an evidence-backed disposition for each admitted finding; reuse fitting investigation work and retain unresolved obligations through ordinary requests and Conditions.",
  ],
  operationalReview: "evaluation",
};

function evaluationWorkInput(instructions: string, context: Record<string, unknown>): AppInput {
  return { kind: "goal", data: { ...evaluationIntakeContract, instructions, context } };
}

export function taskForMayInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  if (admitted.input.kind === "message") {
    const message = optionalText(record(admitted.input.data).message);
    if (!message) throw new Error("May message requires non-empty message");
    return {
      kind: "desired",
      intent: {
        id: `request/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
        parentId: "may",
        outcome: message,
        acceptance: [
          "Address the requested work and return its answer with supporting evidence. An acknowledgment or handoff alone does not fulfill the request; report missing information or blockers while keeping it open.",
        ],
        agent: "may",
        input: { kind: admitted.input.kind, data: admitted.input.data },
        priority: "P1",
      },
    };
  }
  if (admitted.input.kind !== "goal") {
    throw new Error(
      `Unsupported durable May input kind: ${admitted.input.kind}`,
    );
  }
  const data = record(admitted.input.data);
  if (data.operationalReview === "evaluation") {
    if (data.outcome !== evaluationIntakeContract.outcome ||
        JSON.stringify(data.acceptance) !== JSON.stringify(evaluationIntakeContract.acceptance) ||
        data.revision !== undefined || data.assignment !== undefined) {
      throw new Error("Evaluation intake requires its fixed responsibility; use an ordinary goal for different work");
    }
    return {
      kind: "desired",
      intent: {
        id: "evaluation-intake",
        parentId: "may",
        agent: "may",
        outcome: evaluationIntakeContract.outcome,
        acceptance: [...evaluationIntakeContract.acceptance],
        input: { kind: "goal", data: evaluationIntakeContract },
        priority: "P1",
      },
    };
  }
  const agent = selectedAgent(data);
  if (record(data.research).adoption === "research-adoption") {
    throw new Error("Research adoption is owned by App alex");
  }
  const metricReview = metricReviewInput(admitted.input);
  if (metricReview !== undefined) {
    readMetricReview(metricReview);
    if (agent !== "may")
      throw new Error("Metric follow-through requires May");
  }
  const outcome = String(data.outcome ?? "").trim();
  const acceptance = Array.isArray(data.acceptance)
    ? data.acceptance.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
  if (!outcome || acceptance.length === 0) {
    throw new Error("May goal requires outcome and acceptance");
  }
  const hasRevision = Object.prototype.hasOwnProperty.call(data, "revision");
  const revision = record(data.revision);
  const revisionTaskId = optionalText(revision.taskId);
  const expectedGeneration = revision.expectedGeneration;
  const revisesExisting =
    hasRevision &&
    revisionTaskId.length > 0 &&
    Number.isSafeInteger(expectedGeneration) &&
    Number(expectedGeneration) > 0;
  if (hasRevision && !revisesExisting) {
    throw new Error(
      "May goal revision requires an exact taskId and positive expectedGeneration",
    );
  }
  const attachment = {
    kind: "desired" as const,
    ...(revisesExisting
      ? { expectedGeneration: Number(expectedGeneration) }
      : {}),
    intent: {
      id: revisesExisting
        ? revisionTaskId
        : `goal/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
      parentId: "may",
      outcome,
      acceptance,
      agent,
      ...(metricReview !== undefined
        ? { workflow: "metric-follow-through" }
        : {}),
      input: { kind: admitted.input.kind, data },
      priority: "P1" as const,
    },
  };
  return attachment;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requiredText(
  data: Record<string, unknown>,
  field: string,
  eventType: string,
): string {
  const value = typeof data[field] === "string" ? data[field].trim() : "";
  if (!value) {
    throw new Error(`${eventType} requires non-empty ${field}`);
  }
  return value;
}

export function observerFailureInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  if (data.appId !== "may") return null;
  const isResourceFailure =
    data.observerId === "github-pull-request" &&
    event.source === "app:may:observer:github-pull-request";
  if (event.source !== "app-host" && !isResourceFailure) return null;
  const observerId = requiredText(data, "observerId", event.type);
  const error = requiredText(data, "error", event.type);
  return {
    kind: "message",
    data: {
      message: `Review the failed May observer run for ${observerId}. Verify current provider and runtime evidence, allow normal retry and recovery, preserve unrelated work, and report only actionable persistent impact. This fact alone is not an operation failure or a reason for human escalation.`,
      context: {
        observerFailure: { observerId, error },
        event: structuredClone(event),
      },
    },
  };
}

export function admissionFailureInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  if (event.source !== "app-inbox" || data.appId !== "may") return null;
  const requestId = requiredText(data, "requestId", event.type);
  const summary = requiredText(data, "summary", event.type);
  requiredText(data, "fingerprint", event.type);
  if (
    data.disposition !== "admission-rejected" &&
    data.disposition !== "recovery-pending"
  )
    return null;
  return {
    kind: "message",
    data: {
      message: `Review input ${requestId} (${summary}): inspect the saved input and target Task, allow transient backoff or ask the human for the specific decision needed, and use task.reopen with the new normal App input only when the user explicitly requested continuation so reopening and requirements are applied together.`,
      context: {
        admissionFailure: structuredClone(data),
        event: structuredClone(event),
      },
    },
  };
}

export function evaluationHumanDecisionInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput {
  const data = record(event.data);
  const message = requiredText(data, "message", event.type);
  requiredText(data, "dedupeKey", event.type);
  return {
    kind: "message",
    data: {
      message,
      // Preserve the original fact and its correlation data. An escalation
      // requests judgment; it is not a human decision or new authority.
      context: { event: structuredClone(event) },
    },
  };
}

/** Admit each retained breach episode to ordinary accountable May work. */
export function evaluationOperationAlertInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  if (
    event.type !== "metric.breach" ||
    ![EVALUATION_OPERATION_METRIC, EVALUATION_EFFORT_METRIC].includes(
      String(data.metricId),
    ) ||
    data.repeat === true
  )
    return null;
  return evaluationWorkInput(`Independently review this Evaluation operation alert episode through the existing metric-response path. Read its exact evidence, alertId, cohort and accounting limits, then the named Tasks or pre-attempt inputs, accepted results and remaining requirements. Judge whether repeated effort, unsuccessful attempts or retained input-admission recovery warrant a useful correction; high effort can produce valuable partial work. Reuse a fitting investigation and bind the disposition to this episode. Preserve retries, inputs, caller links and Conditions. Operational recovery, a quieter metric, notification or new investigation does not fulfill the original input.`,
    { event: structuredClone(event) },
  );
}

function reportHash(data: Record<string, unknown>, field: string): string {
  const value = requiredText(data, field, "evaluation.task_report_published");
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(
      `evaluation.task_report_published requires SHA-256 ${field}`,
    );
  }
  return value;
}

/** Normalize immutable Evaluation publication facts into May's ordinary work path. */
export function evaluationTaskReportInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  const appId =
    event.type === "evaluation.metric_report_published"
      ? optionalText(data.appId)
      : requiredText(data, "appId", event.type);
  if (appId === "evaluation" || appId === "evaluation.app") return null;
  const metricId =
    event.type === "evaluation.metric_report_published"
      ? requiredText(data, "metricId", event.type)
      : undefined;
  const taskId = metricId
    ? undefined
    : requiredText(data, "taskId", event.type);
  const evidenceHash = reportHash(data, "evidenceHash");
  const executionId = requiredText(data, "executionId", event.type);
  const report = requiredText(data, "report", event.type);
  const facts = requiredText(data, "facts", event.type);
  const jsonHash = reportHash(data, "jsonHash");
  const markdownHash = reportHash(data, "markdownHash");
  const reviewer = optionalText(data.reviewer);
  const assessmentPurpose = optionalText(data.assessmentPurpose);
  const rubricVersion = optionalText(data.rubricVersion);
  const validityIdentity = optionalText(data.validityIdentity);
  const publication = {
    ...(appId ? { appId } : {}),
    ...(metricId ? { metricId } : { taskId }),
    ...(metricId && data.alertId !== undefined
      ? { alertId: data.alertId }
      : {}),
    evidenceHash,
    executionId,
    report,
    facts,
    jsonHash,
    markdownHash,
    ...(reviewer ? { reviewer } : {}),
    ...(assessmentPurpose ? { assessmentPurpose } : {}),
    ...(rubricVersion ? { rubricVersion } : {}),
    ...(validityIdentity ? { validityIdentity } : {}),
  };
  return evaluationWorkInput(
    `Review the published Evaluation report for ${metricId ?? `${appId}/${taskId}`} using the evaluation-and-metric-intake skill (stay quiet in response unless human action or a requested answer is owed). Run evaluation-report-intake with this exact context.publication before any duplicate or reuse conclusion; the intake checks exact publication identity before reusing a prior intake, and an unrelated prior disposition is not this report. Then verify material concerns against current evidence, reuse fitting work, and record the Task disposition (using metric-response when a metric concern remains).`,
    {
        publication,
        caller: {
          source: event.source,
          owner: event.owner,
          target: structuredClone(event.target),
          localKey: event.localKey,
        },
        event: structuredClone(event),
    },
  );
}

export default defineApp({
  id: "may",
  metrics: [
    ...reliabilityMetrics,
    ...effortMetrics,
    ...retiredLegacyMetrics,
    ...(retiredAksMetrics as NonNullable<AppDefinition["metrics"]>),
  ],
  version: 1,
  agent: "may",
  workspace: { kind: "git", localPath: "/app/projects/may-agent", branch: "main" },
  description:
    "Hao's deputy: handles conversation and authorized direct work, owns ongoing Tasks, and involves other Apps when useful or required. Use goal for ongoing work. May chooses available tools, specialists and workflows to meet the outcome; procedure parameters belong in context, not new input kinds. Live GitHub observation routes active PR changes by Task metadata; the github-pull-request observation capability checks exact saved Conditions, including changes missed during downtime. Both supply may.github.pull-request.state facts without watch registration.",
  inputSchema: mayInputSchema,
  conversation: {
    mode: "task",
    inputKinds: ["message"],
    conversationId: "may:primary",
  },
  task: taskForMayInput,
  tasks: {
    maxConcurrent: 4,
    validateCondition: validateGitHubPullRequestCondition,
  },
  observers: [githubPullRequestObserver, createMetricEvidenceObserver()],
  subscriptions: [
    {
      id: "evaluation-review-lag",
      event: { type: "metric.breach" },
      toInput(event) {
        if (
          record(event.data).metricId !== REVIEW_LAG_METRIC ||
          record(event.data).repeat === true
        )
          return null;
        return evaluationWorkInput(
          "Review overdue Alex-hosted review work identified by this metric breach using the evaluation-and-metric-intake skill and metric-response; preserve retries, reuse linked owner work, and treat new samples as evidence rather than triggers.",
          { event: structuredClone(event) },
        );
      },
    },
    {
      id: "evaluation-operation-oversight",
      // One retained metric alert episode gives May bounded independent
      // operational oversight without a model call for every failed attempt.
      event: { type: "metric.breach" },
      toInput: evaluationOperationAlertInput,
    },
    {
      id: "input-admission-failure-review",
      event: { type: "app.input.admission.failed", target: { appId: "may" } },
      toInput: admissionFailureInput,
    },
    {
      id: "observer-failure-review",
      event: { type: "app.observer.failed", project: "may" },
      toInput: observerFailureInput,
    },
    {
      id: "evaluation-human-decision",
      event: {
        type: "evaluation.human_decision.requested",
        project: "may",
      },
      toInput: evaluationHumanDecisionInput,
    },
  ],
});
