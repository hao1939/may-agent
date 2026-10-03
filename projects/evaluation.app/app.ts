import { createHash } from "node:crypto";
import { automaticReviewConfig } from "./agents/evaluator/workflows/task-outcome-selector.js";
import { metricReviewTaskId } from "./agents/evaluator/workflows/lib/metric-selection.js";
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
const subjectGenerationSchema = Type.Integer({
  minimum: 1,
  maximum: Number.MAX_SAFE_INTEGER,
});
const detailsSchema = Type.Record(Type.String(), Type.Unknown());
const metricReviewDataSchema = Type.Object(
  {
    metricId: Type.String({ minLength: 1, maxLength: 512 }),
    end: Type.Integer({ minimum: 1 }),
    reviewer: Type.Optional(
      Type.Union([
        Type.Literal("evaluator"),
        Type.Literal("evaluator-deepseek"),
      ]),
    ),
    automatic: Type.Optional(Type.Boolean()),
    alertId: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);
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
const exactAutomaticReviewInputKeysSchema = Type.Array(
  Type.String({ minLength: 1, maxLength: 512, pattern: "^\\S+$" }),
  { minItems: 1, maxItems: 8, uniqueItems: true },
);

// Legacy exports remain readable for old tooling, but production selection is
// deliberately not a fixed allow-list. The owner review discovers loaded Apps
// through the normal catalog/control surface and creates ordinary App handoffs.
export const watchedProjectTargets: ReadonlyArray<{ targetProject: string }> =
  [];

const EVALUATION_APP_IDS = new Set(["evaluation", "evaluation.app"]);
const EVALUATION_AGENT_IDS = new Set([
  "evaluator",
  "evaluator-deepseek",
  "judge",
]);

function canonicalAppId(value: unknown): string {
  return stringValue(value)
    .toLowerCase()
    .replace(/^(?:app|agent):/, "")
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
          subjectGeneration: Type.Optional(subjectGenerationSchema),
          evidenceHash: Type.Optional(
            Type.String({ minLength: 64, maxLength: 64 }),
          ),
          populationEnd: Type.Optional(Type.Integer({ minimum: 1 })),
          assessmentPurpose: Type.Optional(
            Type.Union([Type.Literal("outcome"), Type.Literal("ongoing")]),
          ),
          reviewer: Type.Optional(
            Type.Union([
              Type.Literal("evaluator"),
              Type.Literal("evaluator-deepseek"),
            ]),
          ),
          // Internal automatic requests retain their origin so an acquisition
          // failure can return to Evaluation's existing owner path.
          automatic: Type.Optional(Type.Literal(true)),
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
    { kind: Type.Literal("review-metric"), data: metricReviewDataSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal("automatic-review"), data: detailsSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("reconcile-automatic-review-inputs"),
      data: Type.Object(
        { inputKeys: exactAutomaticReviewInputKeysSchema },
        { additionalProperties: false },
      ),
    },
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
    case "review-metric": {
      const metricId = stringValue(data.metricId);
      const end = Number(data.end);
      const reviewer = stringValue(data.reviewer) || "evaluator";
      const automatic = data.automatic === true;
      const alertId = data.alertId;
      if (
        !metricId ||
        !Number.isSafeInteger(end) ||
        end <= 0 ||
        !["evaluator", "evaluator-deepseek"].includes(reviewer) ||
        (alertId !== undefined &&
          (!Number.isSafeInteger(alertId) || Number(alertId) <= 0))
      )
        return null;
      return {
        id: metricReviewTaskId(
          metricId,
          reviewer as "evaluator" | "evaluator-deepseek",
        ),
        parentId: "evaluation-system",
        outcome: `Review observations of metric ${metricId} and return an evidence-backed recommendation.`,
        acceptance: [
          "Preserve the exact metric evidence and review cutoff.",
          "Publish a bounded assessment to the accountable owner without changing original work or retry policy.",
        ],
        workflow: "metric-review",
        input: {
          metricId,
          end,
          reviewer,
          automatic,
          ...(alertId !== undefined ? { alertId } : {}),
        },
        priority: alertId !== undefined ? "P1" : "P2",
      };
    }
    case "review-task-outcome": {
      const appId = stringValue(data.appId);
      const taskId = stringValue(data.taskId);
      if (!appId || !taskId) return null;
      const subjectGeneration = Number(data.subjectGeneration);
      const evidenceHash = stringValue(data.evidenceHash);
      const reviewer = stringValue(data.reviewer);
      const automatic = data.automatic === true;
      if (
        reviewer &&
        reviewer !== "evaluator" &&
        reviewer !== "evaluator-deepseek"
      )
        return null;
      const assessmentPurpose =
        stringValue(data.assessmentPurpose) === "ongoing"
          ? "ongoing"
          : "outcome";
      const generationIdentity =
        Number.isSafeInteger(subjectGeneration) && subjectGeneration > 0
          ? `/generation-${subjectGeneration}`
          : "";
      const evidenceIdentity = evidenceHash
        ? `/evidence-${safeTaskIdPart(evidenceHash)}`
        : "";
      const normalizedInput = {
        appId,
        taskId,
        ...(Number.isSafeInteger(subjectGeneration) && subjectGeneration > 0
          ? { subjectGeneration }
          : {}),
        ...(evidenceHash ? { evidenceHash } : {}),
        assessmentPurpose,
        ...(Number.isSafeInteger(data.populationEnd) &&
        Number(data.populationEnd) > 0
          ? { populationEnd: Number(data.populationEnd) }
          : {}),
        ...(reviewer === "evaluator-deepseek" ? { reviewer } : {}),
        ...(automatic ? { automatic: true } : {}),
      };
      const contractHash = createHash("sha256")
        .update(JSON.stringify(normalizedInput))
        .digest("hex");
      const reviewerIdentity =
        reviewer === "evaluator-deepseek" ? "/reviewer-evaluator-deepseek" : "";
      return {
        id: `runtime/task-outcome/v2/${safeTaskIdPart(appId)}/${safeTaskIdPart(taskId)}/${assessmentPurpose}${generationIdentity}${evidenceIdentity}${reviewerIdentity}/contract-${contractHash}`,
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
        input: normalizedInput,
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
        outcome:
          "Select at most one external Task or metric observation for review.",
        acceptance: [
          "Selection uses bounded public App and Task lists and excludes Evaluation.",
          "At most one canonical Task or metric review request is published using the shared allowance.",
        ],
        workflow: "task-outcome-selector",
        input: { reason: stringValue(data.reason) || "scheduled" },
        priority: "P2",
      };
    case "reconcile-automatic-review-inputs": {
      const rawInputKeys = Array.isArray(data.inputKeys) ? data.inputKeys : [];
      const inputKeys = rawInputKeys.map(stringValue);
      if (
        inputKeys.length < 1 ||
        inputKeys.length > 8 ||
        rawInputKeys.some(
          (key, index) =>
            typeof key !== "string" ||
            key !== inputKeys[index] ||
            !/^\S+$/.test(key),
        ) ||
        new Set(inputKeys).size !== inputKeys.length
      )
        return null;
      return {
        id: "runtime/task-outcome-selector",
        parentId: "evaluation-system",
        outcome:
          "Select at most one external Task or metric observation for review.",
        acceptance: [
          "Selection uses bounded public App and Task lists and excludes Evaluation.",
          "At most one canonical Task or metric review request is published using the shared allowance.",
          "Exact automatic-review admissions are settled only after their original events are read and judged by the same attempt, without replaying selector side effects.",
        ],
        workflow: "task-outcome-selector",
        input: { reconcileInputKeys: inputKeys },
        priority: "P1",
      };
    }
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
          "Each local failure is checked against current Task evidence; any remaining obstacle and next step are retained without replacing ordinary retry or waits.",
          "The owner does not take remediation ownership for findings about target projects.",
        ],
        agent: "evaluator",
        executor: evaluationExecutor,
        // Per-wake context is retained in the admitted trigger batch. Keep the
        // standing desired input stable so observations never revise or fence
        // an owner attempt that is already handling earlier evidence.
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
    // Report reads are caller-scoped operations. Reusing one desired Task for
    // different inbox rows lets a later caller appear to revise the first
    // caller's creator-owned spec when list limits differ. The durable input id
    // is stable across retry and keeps creator authority exact.
    const intent =
      admitted.input.kind === "read-reports"
        ? {
            ...configured,
            id: `${configured.id}/request-${safeTaskIdPart(admitted.id)}`,
          }
        : configured;
    return { kind: "desired", intent };
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
    case "evaluation.metric.review.requested":
      return {
        kind: "review-metric",
        data: { ...eventData(event), automatic: true },
      };
    case "metric.breach":
    case "metric.recovered": {
      const data = eventData(event);
      if (isExplicitlyEvaluationOwned(data, event)) return null;
      // State transitions commission review; updates to an open episode are evidence.
      if (event.type === "metric.breach" && data.repeat === true) return null;
      const metricId = stringValue(
        data.metricId ?? data.metric_id ?? event.target?.metricId,
      );
      // Canonical App events do not expose the private envelope timestamp.
      // Only metric signals with an explicit observation time can pin an exact
      // end-exclusive evidence cut; other signals use periodic bounded discovery.
      const observedAt = Number(data.measuredAt ?? data.measured_at);
      const automatic = automaticReviewConfig();
      if (!automatic.enabled) return null;
      return metricId &&
        metricId.length <= 512 &&
        Number.isSafeInteger(observedAt) &&
        observedAt > 0 &&
        observedAt < Number.MAX_SAFE_INTEGER
        ? {
            kind: "review-metric",
            data: {
              metricId,
              end: observedAt + 1,
              reviewer: automatic.reviewer ?? "evaluator",
              automatic: true,
              ...(Number.isSafeInteger(data.alertId) && Number(data.alertId) > 0
                ? { alertId: data.alertId }
                : {}),
            },
          }
        : { kind: "automatic-review", data: { reason: event.type } };
    }
    case "session.end":
      // Session identity and metadata cannot establish canonical work ownership.
      // New semantic evaluation is selected from public external App Tasks.
      return null;
    case "evaluation.task.review.requested": {
      const data = eventData(event);
      const appId = stringValue(data.appId);
      const taskId = stringValue(data.taskId);
      const assessmentPurpose = stringValue(data.assessmentPurpose);
      const reviewer = stringValue(data.reviewer);
      if (
        reviewer &&
        reviewer !== "evaluator" &&
        reviewer !== "evaluator-deepseek"
      )
        return null;
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
              ...(reviewer ? { reviewer } : {}),
              automatic: true,
              ...(Number.isSafeInteger(data.populationEnd) &&
              Number(data.populationEnd) > 0
                ? { populationEnd: Number(data.populationEnd) }
                : {}),
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
      if (
        !appId ||
        !taskId ||
        (data.disposition !== "incomplete" && data.disposition !== "retrying")
      )
        return null;
      // Operational ownership is independent of semantic self-assessment.
      // The standing owner keeps its own normal retry instead of waking itself.
      if (canonicalAppId(appId) === projectId) {
        return taskId === "runtime/compat/owner-review"
          ? null
          : {
              kind: "owner-review",
              data: { reason: "task-execution-failed", reviewFailure: data },
            };
      }
      const automatic = automaticReviewConfig();
      return automatic.enabled && !isEvaluationOwnedReference(appId)
        ? {
            kind: "review-task-outcome",
            data: {
              appId,
              taskId,
              assessmentPurpose: "ongoing",
              automatic: true,
              ...(automatic.reviewer === "evaluator-deepseek"
                ? { reviewer: automatic.reviewer }
                : {}),
            },
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
// Upgrade declarations only: obsolete calculation and alert policy live in Git history.
const evaluationMetricDefinitions = [
  ["session.failed-triage-rate-3h", "Failed session triage rate (3h)", "ratio"],
  [
    "evaluator.project-feedback-pending-age-h",
    "Oldest pending evaluation finding delivery (hours)",
    "hours",
  ],
  [
    "evaluator.project-finding-delivery-rate-24h",
    "Evaluation findings handled by target owner workflows (24h)",
    "ratio",
  ],
  [
    "evaluator.false-good-rate-sample",
    "Reviewed good sessions overturned (24h)",
    "ratio",
  ],
  [
    "evaluator.triage-closure-rate-24h",
    "Evaluator triage closure rate (24h)",
    "ratio",
  ],
  [
    "evaluator.meaningful-review-rate-24h",
    "Evaluator meaningful review rate (24h)",
    "ratio",
  ],
  [
    "evaluator.substantive-low-quality-rate-24h",
    "Substantive evaluator quality failures (24h)",
    "ratio",
  ],
  [
    "evaluator.low-quality-rate-24h",
    "Broad needs-improvement/low-score evaluated sessions (24h, dashboard only)",
    "ratio",
  ],
  ["eval.llm-evals-24h", "LLM-evaluated sessions (24h)", "count"],
  [
    "eval.llm-coverage-lag-h",
    "LLM evaluation lag (hours since last non-heuristic eval)",
    "hours",
  ],
  [
    "evaluator.aftermath-coverage-rate-3h",
    "Evaluator aftermath liveness (3h)",
    "ratio",
  ],
].map(([id, name, unit]) => ({
  id,
  name,
  unit,
  owner: "evaluator",
  project: projectId,
  status: "retired" as const,
  description:
    "Retired session-era evaluation metric; current Task and metric reviews use App-owned evidence.",
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
    ...["metric.breach", "metric.recovered"].map((event) => ({
      id: event,
      event,
      toInput: taskInputForEvent,
    })),
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
    "review-metric": {
      description:
        "Review one metric observation at a fixed cut and return an evidence-backed recommendation.",
      inputSchema: metricReviewDataSchema,
      toInput: (data) => ({ kind: "review-metric", data }),
    },
    "review-task-outcome": {
      description:
        "Evaluate one exact external App Task outcome using bounded public evidence.",
      inputSchema: Type.Object(
        {
          appId: Type.String({ minLength: 1 }),
          taskId: Type.String({ minLength: 1 }),
          subjectGeneration: Type.Optional(subjectGenerationSchema),
          evidenceHash: Type.Optional(
            Type.String({ minLength: 64, maxLength: 64 }),
          ),
          populationEnd: Type.Optional(Type.Integer({ minimum: 1 })),
          assessmentPurpose: Type.Optional(
            Type.Union([Type.Literal("outcome"), Type.Literal("ongoing")]),
          ),
          reviewer: Type.Optional(
            Type.Union([
              Type.Literal("evaluator"),
              Type.Literal("evaluator-deepseek"),
            ]),
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
      { type: "evaluation.metric.review.requested", project: projectId },
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
