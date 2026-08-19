import { createHash } from "node:crypto";
import {
  Type,
  defineApp,
  type AppDisposition,
  type AppEvent,
  type AppInput,
  type AppRequest,
  type TaskIntent,
} from "@may-agent/sdk";
import {
  evaluationAppRuntimeCanarySchema,
  evaluationCanaryDataSchema,
} from "./canary-contract.js";

const projectId = "evaluation";
const detailsSchema = Type.Record(Type.String(), Type.Unknown());
const sessionSchema = Type.Object(
  { sessionId: Type.String({ minLength: 1 }) },
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
    { kind: Type.Literal("canary-probe"), data: evaluationCanaryDataSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("runtime-canary"),
      data: evaluationAppRuntimeCanarySchema,
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
  ...["aftermath-scan", "aftermath-coverage-snapshot", "deep-scan"].map(
    (kind) =>
      Type.Object(
        { kind: Type.Literal(kind), data: detailsSchema },
        { additionalProperties: false },
      ),
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
    case "runtime-canary": {
      const itemId = stringValue(data.itemId);
      if (!itemId) return null;
      return {
        id: `runtime/app-inbox-canary/${safeTaskIdPart(itemId)}`,
        parentId: "evaluator-reliability",
        outcome: `Verify the capability-scoped runtime against completed App inbox item ${itemId}.`,
        acceptance: [
          "The workflow reads the exact item through AppRead and publishes one canary observation without using host internals.",
        ],
        mode: "achieve",
        workflow: "evaluation-app-runtime-canary",
        input: { itemId },
        priority: "P2",
      };
    }
    case "evaluate-session": {
      const sessionId = stringValue(data.sessionId);
      if (!sessionId) return null;
      return {
        id: `runtime/session-aftermath/${safeTaskIdPart(sessionId)}`,
        parentId: "session-audit",
        outcome: `Evaluate completed session ${sessionId} and publish its evidence-backed disposition.`,
        acceptance: [
          "A durable evaluation record or structured skip is linked to the exact source session.",
          "Any required review emits its structured outcome, while a review-process failure remains visible as evaluation.review_failed.",
        ],
        mode: "achieve",
        workflow: "evaluator-aftermath",
        input: { sessionId },
        priority: "P1",
      };
    }
    case "aftermath-scan":
      return {
        id: "runtime/aftermath-backfill",
        parentId: "pipeline-health",
        outcome:
          "Keep the eligible terminal-session evaluation frontier current, prioritizing failed sessions and the recent 3h coverage window before stale done-session backlog.",
        acceptance: [
          "The highest-priority eligible unevaluated session receives its normal aftermath evaluation.",
          "The workflow records whether the frontier is current or emits one compact continuation wake.",
        ],
        mode: "maintain",
        workflow: "evaluator-aftermath",
        input: { scope: "session-aftermath-frontier" },
        priority: "P1",
      };
    case "aftermath-coverage-snapshot":
      return {
        id: "runtime/aftermath-coverage-snapshot",
        parentId: "pipeline-health",
        outcome:
          "Publish one fresh 3h aftermath coverage sample from bounded eligible and evaluated session counts.",
        acceptance: [
          "A responsible executor terminates with exact eligible and evaluated counts for the trailing 3h window.",
          "The evaluator.aftermath-coverage-rate-3h sample persists with sample-size and count/source evidence.",
        ],
        mode: "achieve",
        workflow: "evaluator-aftermath-coverage-snapshot",
        input: data,
        priority: "P0",
      };
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
        input: { evaluation, feedbackKey },
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
        workflow: "evaluator-heartbeat",
        input: { scope: "evaluation.app" },
        priority: "P1",
      };
    default:
      return null;
  }
}

export function routeEvaluationRequest(
  request: Readonly<AppRequest>,
): AppDisposition | null {
  if (request.dependency) {
    if (request.dependency.status === "done") {
      return {
        type: "complete",
        summary:
          request.dependency.summary ?? `${request.input.kind} completed`,
        evidence: request.dependency.evidence,
      };
    }
    return null;
  }
  if (request.input.kind === "message") return null;
  if (request.input.kind === "canary-probe") {
    return {
      type: "delegate",
      appId: "evaluation-canary-worker",
      input: { kind: "probe", data: request.input.data },
    };
  }
  const intent = taskIntentForInput(request.input);
  return intent ? { type: "task", task: { kind: "desired", intent } } : null;
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
      const agent = stringValue(eventData(event).agent);
      const sessionId = eventSessionId(event);
      return agent === "evaluator" || agent === "judge" || !sessionId
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
    case "evaluation.aftermath.scan":
      return eventInput("aftermath-scan", event);
    case "evaluation.aftermath.coverage_snapshot.requested":
      return eventInput("aftermath-coverage-snapshot", event);
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
    case "evaluation.app_runtime_canary.requested": {
      const itemId = stringValue(eventData(event).itemId);
      return itemId ? { kind: "runtime-canary", data: { itemId } } : null;
    }
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

const app = defineApp({
  id: projectId,
  version: 1,
  owner: "evaluator",
  description:
    "Independent session and App auditing with evidence-backed owner and human reporting.",
  inputSchema: evaluationInputSchema,
  inbox: { batch: "single", maxConcurrent: 5 },
  route: routeEvaluationRequest,
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
    "evaluation.app_runtime_canary.observed",
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
      id: "session-aftermath-scan",
      intervalMs: 420_000,
      event: {
        type: "evaluation.aftermath.scan",
        data: { reason: "scheduled" },
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
    "app-inbox-canary": {
      description:
        "Submit one manual probe through canonical App delegation and delivery.",
      inputSchema: evaluationCanaryDataSchema,
      toInput: (data) => ({ kind: "canary-probe", data }),
    },
    "app-runtime-canary": {
      description:
        "Run the capability-scoped workflow against one completed App inbox probe.",
      inputSchema: evaluationAppRuntimeCanarySchema,
      toInput: (data) => ({ kind: "runtime-canary", data }),
    },
    "evaluate-session": {
      description: "Evaluate a specific session by sessionId.",
      inputSchema: sessionSchema,
      toInput: (data) => ({ kind: "evaluate-session", data }),
    },
    "snapshot-aftermath-coverage": {
      description:
        "Compute and persist one bounded trailing-3h aftermath coverage sample.",
      inputSchema: Type.Object({}, { additionalProperties: true }),
      toInput: (data) => ({ kind: "aftermath-coverage-snapshot", data }),
    },
    "deep-eval": {
      description: "Run one deep evaluator review for a specific session.",
      inputSchema: sessionSchema,
      toInput: (data) => ({ kind: "deep-eval", data }),
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
  },
  tasks: {
    attach: true,
    subscriptions: [
      "session.end",
      { type: "evaluation.session.requested", project: projectId },
      { type: "evaluation.aftermath.scan", project: projectId },
      {
        type: "evaluation.aftermath.coverage_snapshot.requested",
        project: projectId,
      },
      { type: "evaluation.deep.requested", project: projectId },
      { type: "evaluation.deep.scan", project: projectId },
      { type: "evaluation.project.review.requested", project: projectId },
      {
        type: "evaluation.app_runtime_canary.requested",
        project: projectId,
      },
      { type: "evaluation.tick", project: projectId },
      "evaluation.review_failed",
      "metric.breach",
      "metric.recovered",
      { type: "evaluation.recorded", project: projectId },
      { type: "evaluation.deep_recorded", project: projectId },
    ],
    resolve: taskIntentForEvent,
    maxConcurrent: 5,
    resyncIntervalMs: 60_000,
  },
});

export default app;
