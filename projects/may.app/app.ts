import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
} from "@may-agent/sdk";
import {
  createGitHubPullRequestObserver,
  validateGitHubPullRequestCondition,
} from "./watchers/github-pull-request.js";

import {
  EVALUATION_OPERATION_METRIC,
  reliabilityMetrics,
  REVIEW_LAG_METRIC,
} from "./reliability-metrics.js";

import { createMetricEvidenceObserver } from "./watchers/metric-evidence.js";
import {
  metricReviewInput,
  readMetricReview,
} from "./metric-follow-through.js";

const githubPullRequestObserver = createGitHubPullRequestObserver({
  repository: "hao1939/may-agent",
  author: "hao1939",
  appId: "may",
  project: "may",
});

const detailsSchema = Type.Record(Type.String(), Type.Unknown());
const teamAssignmentSchema = Type.Object(
  {
    agent: Type.Union([
      Type.Literal("may"),
      Type.Literal("may-bob"),
      Type.Literal("may-tech-lead"),
    ]),
  },
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

const STANDING_RESEARCH_TASK_ID = "research-adoption";
const standingResearchOutcome =
  "Continuously assess qualified Scout findings and older archived research for small, evidence-backed improvements to this installation.";
const standingResearchAcceptance = [
  "Return a current-first Bob recommendation or a supported no-change, negative, or visible deferral outcome; retain source limits, linked evidence, owner and next action without applying a candidate.",
];

function requireStandingResearchContract(
  data: Record<string, unknown>,
  outcome: string,
  acceptance: readonly string[],
): void {
  const matchesAcceptance =
    acceptance.length === standingResearchAcceptance.length &&
    acceptance.every(
      (item, index) => item.trim() === standingResearchAcceptance[index],
    );
  const allowedFields = new Set([
    "outcome",
    "acceptance",
    "assignment",
    "research",
  ]);
  const hasCallerSpecificRequirements = Object.keys(data).some(
    (field) => !allowedFields.has(field),
  );
  if (
    outcome !== standingResearchOutcome ||
    !matchesAcceptance ||
    hasCallerSpecificRequirements
  ) {
    throw new Error(
      "Standing research adoption requires the exact fixed contract without caller-specific requirements; use targeted mode to preserve additional requirements",
    );
  }
}

function selectedAgent(data: Record<string, unknown>): string {
  const assignment = record(data.assignment);
  if (Object.keys(assignment).length === 0) return "may";
  if (
    assignment.agent !== "may" &&
    assignment.agent !== "may-bob" &&
    assignment.agent !== "may-tech-lead"
  ) {
    throw new Error(
      "May goal assignment must select an installed May team role",
    );
  }
  return assignment.agent;
}

function researchMode(
  data: Record<string, unknown>,
  agent: string,
): "standing" | "targeted" | null {
  const research = record(data.research);
  if (research.adoption !== "research-adoption") return null;
  if (
    agent !== "may-bob" ||
    (research.mode !== "standing" && research.mode !== "targeted")
  ) {
    throw new Error(
      "Research adoption requires Bob and a standing or targeted mode",
    );
  }
  return research.mode;
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
  const agent = selectedAgent(data);
  const mode = researchMode(data, agent);
  const metricReview = metricReviewInput(admitted.input);
  if (metricReview !== undefined) {
    readMetricReview(metricReview);
    if (agent !== "may" || mode)
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
  if (mode === "standing") {
    requireStandingResearchContract(data, outcome, acceptance);
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
        : mode === "standing"
          ? STANDING_RESEARCH_TASK_ID
          : `goal/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
      parentId: "may",
      outcome: mode === "standing" ? standingResearchOutcome : outcome,
      acceptance: mode === "standing" ? standingResearchAcceptance : acceptance,
      agent,
      ...(metricReview !== undefined
        ? { workflow: "metric-follow-through" }
        : {}),
      input:
        mode === "standing"
          ? {
              kind: "goal",
              data: {
                outcome: standingResearchOutcome,
                acceptance: standingResearchAcceptance,
                assignment: { agent: "may-bob" },
                research: {
                  adoption: "research-adoption",
                  mode: "standing",
                },
              },
            }
          : { kind: admitted.input.kind, data },
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

export function scoutResearchHandoffInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  if (
    event.source !== "app-task:scout-knowledge-lib" ||
    data.producerAppId !== "scout-knowledge-lib"
  ) {
    return null;
  }
  for (const field of [
    "sourceUrl",
    "sourceRevision",
    "artifact",
    "artifactHash",
    "claim",
    "limits",
    "possibleApplication",
  ]) {
    requiredText(data, field, event.type);
  }
  if (!/^[a-f0-9]{64}$/.test(String(data.artifactHash))) {
    throw new Error(`${event.type} requires SHA-256 artifactHash`);
  }
  return {
    kind: "goal",
    data: {
      outcome: standingResearchOutcome,
      acceptance: standingResearchAcceptance,
      assignment: { agent: "may-bob" },
      research: {
        adoption: "research-adoption",
        mode: "standing",
        opportunity: "scout-qualified-handoff",
        handoff: structuredClone(data),
        transport: {
          source: event.source,
          localKey: event.localKey,
          target: structuredClone(event.target),
        },
      },
    },
  };
}

export function observerFailureInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  if (event.source !== "app-host" || data.appId !== "may") return null;
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
      message: `Review input ${requestId}, which could not reach its Task: ${summary}. Read the saved input and current Task, then close the loop with the requester. Transient recovery retains its backoff; permanent rejection needs a reviewed correction. Distinguish observations from new requirements using the request and current scope. Reopen the same Task only when the user explicitly requested continuation, carrying the new normal App input in the version-fenced task.reopen control so reopening and requirements are applied together. An authorized continuation does not need a reject-and-resubmit cycle; previously rejected input remains history. If authority or information is missing, explain the blocker and ask the human for the specific decision needed. A failure notification itself grants no reopening or deployment authority.`,
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

/** Open one independent May review for each retained Evaluation breach episode. */
export function evaluationOperationAlertInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = record(event.data);
  if (data.metricId !== EVALUATION_OPERATION_METRIC || data.repeat === true)
    return null;
  return {
    kind: "message",
    data: {
      message: `Independently review this Evaluation operation alert episode through the existing metric-response path. Read the exact metric evidence and its alertId, then reread the current Evaluation Tasks and retained attempts named by the bounded sample before judging. The source covers failed/rejected attempts, accepted-incomplete results and stale/requeued interruptions, including runtime/compat/owner-review by ordinary Task identity; it excludes user cancellation and discloses the retained terminal-attempt denominator, six-hour cut and coverage limits. Three unsuccessful attempts for one Task generation in six hours is a trial May attention policy, not a retry cap or proof of waste. Reuse an existing investigation when its scope fits and bind the disposition to this alert episode; do not create a repair or human message for each failure or sample. Preserve original retries, inputs, caller/dependency links and waits. Notification, aggregate recovery and a new investigation do not fulfill the original Evaluation input. Generic supervisor fallback remains deferred.`,
      context: { event: structuredClone(event) },
    },
  };
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

/** Normalize immutable Evaluation publication facts into May's ordinary message path. */
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
  return {
    kind: "message",
    data: {
      message: `This is an automated review, not a new human question. Retain the disposition and evidence in summary/facts; omit response for routine findings, unchanged waits, reused work and background delegation. Use response for a requested answer, a new actionable decision or a material change the human needs to know. Review the published Evaluation report for ${metricId ?? `${appId}/${taskId}`}. Run evaluation-report-intake with this exact context.publication before any duplicate or reuse conclusion; the intake checks exact publication identity before reusing a prior intake, and an unrelated prior disposition is not this report. Then verify material concerns against current evidence and record an ordinary Task disposition. Reuse linked work. Settle the immediate incident separately from the population finding: current recovery does not erase recurring failures, cost or uncertainty. A duplicate or harmless one-off can need no change; a supported recurring pattern can justify the smallest investigation even after recovery. Before proposing a candidate, judge practical value versus cost and whether a simpler solution would suffice. For an unresolved metric concern use metric-response with review:{task,decisions} and the current conversation context to prepare one complete followUp; choose a Condition through the installed metric-evidence contract or commission work through a dependency. Return its complete result, not just a fact. Reuse the exact existing Task when scope fits. Notification, acknowledgment and a patch are not verified recovery; metrics do not authorize stopping retries or reopening work.`,
      context: {
        publication,
        caller: {
          source: event.source,
          owner: event.owner,
          target: structuredClone(event.target),
          localKey: event.localKey,
        },
        event: structuredClone(event),
      },
    },
  };
}

export default defineApp({
  id: "may",
  metrics: reliabilityMetrics,
  version: 1,
  agent: "may",
  workspace: { kind: "git", localPath: ".", branch: "main" },
  description:
    "Hao's deputy: handles conversation and authorized direct work, owns ongoing Tasks, and involves other Apps when useful or required. Use goal for ongoing work. May chooses available tools, specialists and workflows to meet the outcome; procedure parameters belong in context, not new input kinds. The scoped github-pull-request observer discovers exact May Task ownership from PR metadata and supplies targeted may.github.pull-request.state facts without watch registration.",
  inputSchema: mayInputSchema,
  conversation: {
    mode: "agent",
    inputKinds: ["message"],
    conversationId: "may:primary",
  },
  schedules: [
    {
      id: "metric-source-collection",
      intervalMs: 300_000,
      event: {
        type: "trigger.metrics-snapshot",
        source: "app:may:schedule:metric-source-collection",
        owner: "app:may",
        data: {},
      },
    },
    {
      id: "research-adoption-archive-review",
      enabled: true,
      intervalMs: 7 * 24 * 60 * 60 * 1000,
      catchUp: "latest",
      input: {
        kind: "goal",
        data: {
          outcome: standingResearchOutcome,
          acceptance: standingResearchAcceptance,
          assignment: { agent: "may-bob" },
          research: {
            adoption: "research-adoption",
            mode: "standing",
            opportunity: "weekly-archive-review",
            recordLimit: 3,
            candidateLimit: 1,
            navigation:
              "Continue after the last accepted archive cursor and wrap after the final record; retain the next cursor in the current-first result.",
          },
        },
      },
    },
    {
      id: "conversation-supervision-recovery",
      intervalMs: 900_000,
      event: {
        type: "conversation.supervision.review",
        source: "app:may:schedule:conversation-supervision-recovery",
        owner: "app:may",
        target: { appId: "may", project: "may" },
        data: { project: "may", limit: 100 },
      },
    },
    {
      id: "task-hygiene-review",
      intervalMs: 4 * 60 * 60 * 1000,
      event: {
        type: "project.task.tick",
        source: "app:may:schedule:task-hygiene-review",
        owner: "app:may",
        target: {
          appId: "may",
          taskId: "goal/app_224ef63e-ddd6-4f4b-b159-26de9dd60107",
        },
        data: { project: "may", purpose: "task-hygiene-review" },
      },
    },
  ],
  task: taskForMayInput,
  tasks: {
    maxConcurrent: 4,
    validateCondition: validateGitHubPullRequestCondition,
  },
  observers: [githubPullRequestObserver, createMetricEvidenceObserver()],
  subscriptions: [
    {
      id: "evaluation-metric-report",
      event: { type: "evaluation.metric_report_published" },
      toInput: evaluationTaskReportInput,
    },
    {
      id: "evaluation-review-lag",
      event: { type: "metric.breach" },
      toInput(event) {
        if (
          record(event.data).metricId !== REVIEW_LAG_METRIC ||
          record(event.data).repeat === true
        )
          return null;
        return {
          kind: "message",
          data: {
            message:
              "Review the unfinished Evaluation work identified by this metric. Read current review Tasks, allowance and return paths. Preserve retries and reuse linked owner work. If review remains overdue, use metric-response with a complete review and the current conversation context; choose an observable Condition or commission work, then return the prepared handoff. This age threshold requests inspection; it is not a promised deadline or authority to stop work.",
            context: { event: structuredClone(event) },
          },
        };
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
      id: "scout-research-qualified",
      event: { type: "scout.research.qualified", project: "may" },
      toInput: scoutResearchHandoffInput,
    },
    {
      id: "evaluation-human-decision",
      event: {
        type: "evaluation.human_decision.requested",
        project: "may",
      },
      toInput: evaluationHumanDecisionInput,
    },
    {
      id: "evaluation-task-report",
      // Publications target Evaluation; consumer admission must not add a May
      // target/project filter. Host routing of this cross-target subscription
      // is independently exercised during isolated installation review.
      event: { type: "evaluation.task_report_published" },
      toInput: evaluationTaskReportInput,
    },
  ],
});
