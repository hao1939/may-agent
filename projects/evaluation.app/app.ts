import { createHash } from "node:crypto";
import {
  defineProjectApp,
  eventDetails,
  Type,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk/legacy";
import { observeEvaluationPipeline } from "./watchers/evaluation-pipeline.js";
import { projectEvaluationFeedback } from "./watchers/feedback-projection.js";
import {
  evaluationAppRuntimeCanarySchema,
  evaluationCanaryDataSchema,
} from "./canary-contract.js";

const projectId = "evaluation";
const actionInputSchema = Type.Object({}, { additionalProperties: true });

const watchedProjectTargets = [
  {
    targetProject: "aks-rp-e2e.app",
    targetAppDir: "/app/projects/aks-rp-e2e.app",
    targetDomainDir: "/app/projects/aks-rp-e2e",
  },
  {
    targetProject: "may-agent.app",
    targetAppDir: "/app/projects/may-agent.app",
    targetDomainDir: "/app/projects/may-agent",
  },
  {
    targetProject: "scout-knowledge-lib.app",
    targetAppDir: "/app/projects/scout-knowledge-lib.app",
    targetDomainDir: "/app/projects/scout-knowledge-lib",
  },
  {
    targetProject: "gym.app",
    targetAppDir: "/app/projects/gym.app",
    targetDomainDir: "/app/projects/gym",
  },
  {
    targetProject: "evaluation.app",
    targetAppDir: "/app/projects/evaluation.app",
    targetDomainDir: "/app/projects/evaluation.app",
  },
];

function eventParams(params: unknown): Record<string, unknown> {
  return params && typeof params === "object" && !Array.isArray(params)
    ? (params as Record<string, unknown>)
    : {};
}

function evaluationSessionRequested(params: unknown): ProjectAppEvent {
  return {
    type: "evaluation.session.requested",
    project: projectId,
    params: eventParams(params),
  };
}

function evaluationReviewRequested(
  lane: string,
  params: unknown = {},
): ProjectAppEvent {
  return {
    type: "evaluation.tick",
    project: projectId,
    lane,
    params: eventParams(params),
  };
}

function projectHealthReviewRequested(params: unknown = {}): ProjectAppEvent {
  const details = eventParams(params);
  const requestedTarget =
    typeof details.targetProject === "string"
      ? details.targetProject
      : typeof details.target === "string"
        ? details.target
        : watchedProjectTargets[0].targetProject;
  const watchedTarget =
    watchedProjectTargets.find(
      (target) =>
        target.targetProject === requestedTarget ||
        target.targetProject.replace(/\.app$/, "") === requestedTarget,
    ) ?? watchedProjectTargets[0];
  const reason = typeof details.reason === "string" ? details.reason : "manual";

  return {
    type: "evaluation.project.review.requested",
    project: projectId,
    params: {
      ...details,
      ...watchedTarget,
      reason,
    },
  };
}

export function appInboxCanaryRequested(params: unknown): ProjectAppEvent {
  return {
    type: "app.input.requested",
    data: {
      appId: "evaluation-canary",
      input: { kind: "probe", data: eventParams(params) },
      source: { kind: "system", id: "evaluation.app:manual-canary" },
    },
  };
}

export function appRuntimeCanaryRequested(params: unknown): ProjectAppEvent {
  return {
    type: "evaluation.app_runtime_canary.requested",
    project: projectId,
    params: eventParams(params),
  };
}

function metricId(event: Record<string, unknown>): string {
  const details = eventDetails(event);
  const value = details.metricId ?? details.metric_id ?? details.metric;
  return typeof value === "string" ? value : "";
}

function isEvaluationMetric(event: Record<string, unknown>): boolean {
  const details = eventDetails(event);
  const project = details.project;
  const owner = details.owner ?? event.owner;
  const id = metricId(event);
  return (
    project === projectId ||
    project === `${projectId}.app` ||
    owner === "evaluator" ||
    owner === "agent:evaluator" ||
    id.startsWith("evaluator.") ||
    id.startsWith("evaluation.") ||
    id.startsWith("eval.")
  );
}

function isEvaluatorOwnerMessage(event: Record<string, unknown>): boolean {
  const details = eventDetails(event);
  const owner = String(event.owner ?? details.owner ?? "");
  const to = String(details.to ?? "");
  const target = details.target;
  const targetProject =
    target && typeof target === "object" && !Array.isArray(target)
      ? String((target as Record<string, unknown>).project ?? "")
      : "";
  const targetOwner =
    target && typeof target === "object" && !Array.isArray(target)
      ? String((target as Record<string, unknown>).owner ?? "")
      : "";
  const project = String(details.project ?? details.projectId ?? "");

  return (
    owner === "agent:evaluator" ||
    owner === "evaluator" ||
    to === "evaluator" ||
    targetOwner === "agent:evaluator" ||
    targetOwner === "evaluator" ||
    project === projectId ||
    project === `${projectId}.app` ||
    targetProject === projectId ||
    targetProject === `${projectId}.app`
  );
}

function safeTaskIdPart(value: unknown): string {
  const raw = String(value ?? "").trim();
  const normalized = raw
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized === raw && normalized.length <= 120) return normalized;

  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  const prefix = normalized.slice(0, 107) || "id";
  return `${prefix}-${digest}`;
}

function eventSessionId(event: Record<string, unknown>): string {
  const details = eventDetails(event);
  const target =
    details.target &&
    typeof details.target === "object" &&
    !Array.isArray(details.target)
      ? (details.target as Record<string, unknown>)
      : {};
  return String(
    details.sessionId ?? details.session_id ?? target.sessionId ?? "",
  ).trim();
}

function targetProject(event: Record<string, unknown>): string {
  const details = eventDetails(event);
  return String(details.targetProject ?? details.target ?? "").trim();
}

export function resolveEvaluationTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  const details = eventDetails(event);
  switch (event.type) {
    case "evaluation.app_runtime_canary.requested": {
      const itemId = String(details.itemId ?? "").trim();
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
    case "evaluation.session.requested": {
      const sessionId = eventSessionId(event);
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
    case "evaluation.aftermath.scan":
      return {
        id: "runtime/aftermath-backfill",
        parentId: "pipeline-health",
        outcome:
          "Keep the eligible terminal-session evaluation frontier current, prioritizing failed sessions and the recent 3h coverage window before stale done-session backlog.",
        acceptance: [
          "The highest-priority eligible unevaluated session receives its normal aftermath evaluation: failed/interrupted sessions first, then done sessions inside the recent 3h coverage window, then older done-session backlog.",
          "If more eligible sessions remain, the workflow emits one compact continuation wake; otherwise it records that the frontier is current.",
        ],
        mode: "maintain",
        workflow: "evaluator-aftermath",
        input: { scope: "session-aftermath-frontier" },
        priority: "P1",
      };
    case "evaluation.deep.requested": {
      const sessionId = eventSessionId(event);
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
    case "evaluation.deep.scan":
      return {
        id: "runtime/deep-eval-scan",
        parentId: "pipeline-health",
        outcome:
          "Find and deeply evaluate at most one eligible recent session.",
        acceptance: [
          "At most one eligible recent session receives a workflow-traced deep evaluation.",
          "If no candidate exists, the reconciliation records that observation without creating duplicate work.",
        ],
        mode: "maintain",
        workflow: "evaluator-deep-eval",
        input: { scope: "deep-evaluation-candidates" },
        priority: "P2",
      };
    case "evaluation.project.review.requested": {
      const project = targetProject(event);
      if (!project) return null;
      const watchedTarget = watchedProjectTargets.find(
        (target) =>
          target.targetProject === project ||
          target.targetProject.replace(/\.app$/, "") === project,
      );
      return {
        id: `runtime/project-audit/${safeTaskIdPart(project)}`,
        parentId: "project-app-audit",
        outcome: `Maintain an independent, evidence-backed health assessment for ${project}.`,
        acceptance: [
          "The current meaningful-state fingerprint is persisted for the target.",
          "Material changes or a due baseline produce an owner-facing report with raw facts, judgment, and verification; unchanged scheduled samples remain no-op.",
          "New actionable findings are deduplicated and routed to the target owner, with human notification only when policy requires it.",
        ],
        mode: "maintain",
        workflow: "project-health-evaluator",
        input: watchedTarget
          ? { ...watchedTarget }
          : { targetProject: project },
        priority: "P1",
      };
    }
    case "project.comment.created":
    case "project.owner.requested":
    case "evaluation.tick":
      return {
        id: "runtime/owner-review",
        parentId: "evaluator-reliability",
        outcome:
          "Keep evaluation.app's own organization coherent and act on evaluator-local exceptions.",
        acceptance: [
          "The owner returns revision-checked typed actions that the reconciler applies atomically, or a justified no-op with evidence.",
          "The owner does not directly mutate the task tree or create evaluator work for target-project remediation.",
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

export async function routeEvaluationEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (event.type === "session.end") {
    const details = eventDetails(event);
    const agent = String(details.agent ?? "").trim();
    if (agent === "evaluator" || agent === "judge") {
      return ctx.noop(`ignored ${agent} session aftermath`);
    }
    const sessionId = eventSessionId(event);
    if (sessionId) {
      return ctx.emit({
        type: "evaluation.session.requested",
        project: projectId,
        params: { sessionId, reason: "session-end" },
      });
    }
    return ctx.emit({
      type: "evaluation.aftermath.scan",
      project: projectId,
      params: { reason: "session-end-missing-session-id" },
    });
  }

  if (event.type === "evaluation.pipeline.check") {
    if (!ctx.query)
      throw new Error(
        "evaluation pipeline watcher requires the hosted read-only query capability",
      );
    return observeEvaluationPipeline({ ...ctx, query: ctx.query });
  }

  if (event.type === "evaluation.feedback.project") {
    if (!ctx.query)
      throw new Error(
        "evaluation feedback projection requires the hosted read-only query capability",
      );
    return projectEvaluationFeedback({ ...ctx, query: ctx.query });
  }

  if (event.type === "evaluation.review_failed") {
    return ctx.emit(
      projectHealthReviewRequested({
        targetProject: "evaluation.app",
        reason: "review-failed",
        reviewFailure: eventDetails(event),
      }),
    );
  }

  if (event.type === "telegram.reply") {
    if (!isEvaluatorOwnerMessage(event)) {
      return ctx.noop(`${event.type} not targeted to evaluation`);
    }
    return ctx.emit(
      evaluationReviewRequested("owner-message", {
        message: eventDetails(event),
      }),
    );
  }

  if (event.type === "metric.breach" || event.type === "metric.recovered") {
    if (!isEvaluationMetric(event)) {
      return ctx.noop(
        `ignored ${event.type} for non-evaluation metric ${metricId(event) || "<unknown>"}`,
      );
    }
    return ctx.emit({
      type: "evaluation.pipeline.check",
      project: projectId,
      params: {
        reason: event.type,
        metric: eventDetails(event),
      },
    });
  }

  return undefined;
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  owner: "evaluator",
  description:
    "Independent session and project-app auditing with evidence-backed owner and human reporting.",
  workspace: {
    kind: "local",
    localPath: ".",
  },

  budget: {
    maxConcurrent: 5,
  },

  schedules: [
    {
      id: "evaluation-pipeline-review",
      enabled: true,
      intervalMs: 300_000,
      emits: [
        {
          type: "evaluation.pipeline.check",
          project: projectId,
        },
      ],
    },
    {
      id: "evaluation-feedback-projection",
      enabled: true,
      intervalMs: 3_600_000,
      emits: [
        {
          type: "evaluation.feedback.project",
          project: projectId,
        },
      ],
    },
    {
      id: "owner-heartbeat",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        {
          type: "project.owner.requested",
          project: projectId,
          reason: "owner-heartbeat",
          params: {
            instruction:
              "Daily evaluation owner review: maintain the auditing system and look for evaluator-local issues that deterministic monitoring did not catch. Prefer one to three task-tree actions or no-op with reason; do not take remediation ownership for findings about target projects, and do not run session aftermath unless a concrete sessionId is present.",
            reviewChecklist: [
              "Look for stale criteria/scoring assumptions and repeated evaluator misjudgments.",
              "Look for missed session aftermath, deep-eval candidate gaps, or recurring findings not covered by current monitors.",
              "Look for task-tree bloat; only evaluator-local defects belong in this task tree.",
              "Avoid duplicate heartbeat tasks by inspecting recent owner-review findings first.",
              "No-op is valid when the existing queues already cover the useful next work.",
            ],
          },
        },
      ],
    },
    {
      id: "session-aftermath-scan",
      enabled: true,
      intervalMs: 420_000, // 7min — backfill terminal sessions missed by session.end handling
      emits: [
        {
          type: "evaluation.aftermath.scan",
          project: projectId,
        },
      ],
    },
    {
      id: "deep-evaluation-scan",
      enabled: true,
      intervalMs: 1_800_000, // 30min — one deep eval candidate per run
      emits: [
        {
          type: "evaluation.deep.scan",
          project: projectId,
        },
      ],
    },
    ...watchedProjectTargets.map((target) => ({
      id: `project-health-loop-${target.targetProject}`,
      enabled: true,
      intervalMs: 7_200_000, // 2h owner-facing app/project review baseline
      emits: [
        {
          type: "evaluation.project.review.requested",
          project: projectId,
          params: {
            ...target,
            reason: "scheduled",
          },
        },
      ],
    })),
  ],

  tasks: {
    accepts: [
      "evaluation.session.requested",
      "evaluation.tick",
      "evaluation.deep.requested",
      "evaluation.aftermath.scan",
      "evaluation.deep.scan",
      "evaluation.project.review.requested",
      "evaluation.app_runtime_canary.requested",
      { type: "project.comment.created", project: projectId },
      { type: "project.owner.requested", project: projectId },
    ],
    resolve: resolveEvaluationTask,
  },

  events: [
    "session.end",
    { type: "evaluation.pipeline.check", project: projectId },
    { type: "evaluation.feedback.project", project: projectId },
    "evaluation.review_failed",
    "telegram.reply",
    "metric.breach",
    "metric.recovered",
  ],

  actions: {
    "app-inbox-canary": {
      type: "async",
      description:
        "Submit one manual probe through the opt-in App inbox without changing production evaluation routing.",
      inputSchema: evaluationCanaryDataSchema,
      event(params) {
        return appInboxCanaryRequested(params);
      },
    },
    "app-runtime-canary": {
      type: "async",
      description:
        "Run the capability-scoped workflow against one completed manual App inbox probe.",
      inputSchema: evaluationAppRuntimeCanarySchema,
      event(params) {
        return appRuntimeCanaryRequested(params);
      },
    },
    "evaluate-session": {
      type: "async",
      description: "Evaluate a specific session by sessionId.",
      inputSchema: Type.Object(
        { sessionId: Type.String({ minLength: 1 }) },
        { additionalProperties: true },
      ),
      event(params) {
        return evaluationSessionRequested(params);
      },
    },
    "deep-eval": {
      type: "async",
      description: "Run one deep evaluator review for a specific session.",
      inputSchema: Type.Object(
        { sessionId: Type.String({ minLength: 1 }) },
        { additionalProperties: true },
      ),
      event(params) {
        return {
          type: "evaluation.deep.requested",
          project: projectId,
          params: eventParams(params),
        };
      },
    },
    "review-evaluation-project": {
      type: "async",
      description: "Ask the evaluation app owner to review project state.",
      inputSchema: actionInputSchema,
      event(params) {
        return evaluationReviewRequested("manual-review", params);
      },
    },
    "review-project-app": {
      type: "async",
      description:
        "Review a target project app from the outside and write owner-facing health feedback.",
      inputSchema: Type.Object(
        {
          targetProject: Type.Optional(Type.String({ minLength: 1 })),
          reason: Type.Optional(Type.String({ minLength: 1 })),
        },
        { additionalProperties: true },
      ),
      event(params) {
        return projectHealthReviewRequested(params);
      },
    },
  },

  async onEvent(ctx, event) {
    return routeEvaluationEvent(ctx, event);
  },
});
