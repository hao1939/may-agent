import {
  defineProjectApp,
  eventDetails,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

const projectId = "evaluation";
const appTaskContext = "app: /app/projects/evaluation.app";

const evaluationContext = [
  "projects/evaluation.app/project.json",
  "projects/evaluation.app/.state/tasks/tree.json",
  "projects/evaluation.app/criteria/criteria.md",
  "projects/evaluation.app/criteria/scoring.md",
];

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
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
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
    case "evaluation.pipeline.check":
      return {
        id: "runtime/pipeline-monitor",
        parentId: "pipeline-health",
        outcome:
          "Keep the evaluation pipeline health projection current and wake the owner only for changed anomalies.",
        acceptance: [
          "The current pipeline snapshot is recorded and changed anomalies emit one owner wake.",
        ],
        mode: "maintain",
        workflow: "evaluator-pipeline-monitor",
        input: details,
        priority: "P0",
      };
    case "session.end":
    case "evaluation.session.requested": {
      const sessionId = eventSessionId(event);
      if (!sessionId) return null;
      const agent = String(details.agent ?? "").trim();
      if (
        event.type === "session.end" &&
        (agent === "evaluator" || agent === "judge")
      )
        return null;
      return {
        id: `runtime/session-aftermath/${safeTaskIdPart(sessionId)}`,
        parentId: "session-audit",
        outcome: `Evaluate completed session ${sessionId} and publish its evidence-backed disposition.`,
        acceptance: [
          "The session is evaluated or explicitly skipped with a structured reason.",
        ],
        mode: "achieve",
        workflow: "evaluator-aftermath",
        input: { ...details, sessionId },
        priority: "P1",
      };
    }
    case "evaluation.aftermath.scan":
      return {
        id: "runtime/aftermath-backfill",
        parentId: "pipeline-health",
        outcome:
          "Reconcile terminal sessions missed by direct session-end evaluation.",
        acceptance: [
          "At most one eligible missed session is evaluated, or the scan proves there is no candidate.",
        ],
        mode: "maintain",
        workflow: "evaluator-aftermath",
        input: details,
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
          "The deep evaluation returns a workflow-traced judgment for the requested session.",
        ],
        mode: "achieve",
        workflow: "evaluator-deep-eval",
        input: { ...details, sessionId },
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
          "One eligible session is deeply evaluated, or the scan proves no candidate is available.",
        ],
        mode: "maintain",
        workflow: "evaluator-deep-eval",
        input: details,
        priority: "P2",
      };
    case "evaluation.project.review.requested": {
      const project = targetProject(event);
      if (!project) return null;
      return {
        id: `runtime/project-audit/${safeTaskIdPart(project)}`,
        parentId: "project-app-audit",
        outcome: `Maintain an independent, evidence-backed health assessment for ${project}.`,
        acceptance: [
          "Material changes produce an owner-facing report; unchanged scheduled samples remain no-op.",
        ],
        mode: "maintain",
        workflow: "project-health-evaluator",
        input: details,
        priority: "P1",
      };
    }
    case "evaluation.tick":
      return {
        id: "runtime/owner-review",
        parentId: "evaluator-reliability",
        outcome:
          "Keep evaluation.app's own organization coherent and act on evaluator-local exceptions.",
        acceptance: [
          "The owner applies a useful task-tree decision or records a justified no-op.",
        ],
        mode: "maintain",
        input: details,
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
  if (
    event.type === "session.end" ||
    event.type === "evaluation.session.requested" ||
    event.type === "evaluation.deep.requested" ||
    event.type === "evaluation.pipeline.check" ||
    event.type === "evaluation.tick" ||
    event.type === "evaluation.project.review.requested" ||
    event.type === "evaluation.aftermath.scan" ||
    event.type === "evaluation.deep.scan"
  ) {
    return ctx.noop(`${event.type} is handled by taskRoutes`);
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

  if (event.type === "message.created" || event.type === "telegram.reply") {
    if (!isEvaluatorOwnerMessage(event)) {
      return ctx.noop(`${event.type} not targeted to evaluation`);
    }
    return ctx.emit(
      evaluationReviewRequested("owner-message", {
        message: eventDetails(event),
      }),
    );
  }

  if (event.type === "project.owner.requested") {
    return ctx.emit(
      evaluationReviewRequested("owner-review", {
        ownerRequest: eventDetails(event),
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

  if (event.type === "project.action.invoked") {
    const action = eventDetails(event);
    if (action.action === "review-project-app") {
      return ctx.emit(
        projectHealthReviewRequested({
          ...(eventParams(action.params) as Record<string, unknown>),
          reason: action.reason ?? "manual-action",
        }),
      );
    }
    return ctx.emit(
      evaluationReviewRequested("project-action", {
        action,
      }),
    );
  }

  if (event.type === "project.tasks.ready") {
    return ctx.emit(
      evaluationReviewRequested("task-ready", {
        taskReady: eventDetails(event),
      }),
    );
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
    sessionsPerDay: 100,
    tokensPerDay: 2_000_000,
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
      id: "eval-llm-scan",
      enabled: false,
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

  ownerEntry: {
    workflow: "evaluator-heartbeat",
    task: `${appTaskContext}\nReview evaluation.app's organization for the reconciled task. Handle unfamiliar work and workflow exceptions; do not run session aftermath without a concrete sessionId.`,
    timeoutMs: 900_000,
    context: evaluationContext,
  },

  taskWorkflows: {
    "evaluator-pipeline-monitor": {
      workflow: "evaluator-pipeline-monitor",
      agent: "evaluator",
      task: `${appTaskContext}\nCheck evaluation pipeline health without invoking an agent unless anomaly state changes.`,
      timeoutMs: 120_000,
      context: evaluationContext,
    },
    "evaluator-aftermath": {
      workflow: "evaluator-aftermath",
      agent: "evaluator",
      task: `${appTaskContext}\nEvaluate the completed session from the trigger event, or perform one bounded backfill scan.`,
      timeoutMs: 900_000,
      context: evaluationContext,
    },
    "evaluator-deep-eval": {
      workflow: "evaluator-deep-eval",
      agent: "evaluator",
      task: `${appTaskContext}\nRun the requested deep evaluation or one bounded candidate scan.`,
      timeoutMs: 1_800_000,
      context: evaluationContext,
    },
    "project-health-evaluator": {
      workflow: "project-health-evaluator",
      agent: "evaluator",
      task: `${appTaskContext}\nIndependently audit the target project/app from the trigger event. Report evidence-backed findings to its owner and notify a human only when useful; do not own target remediation.`,
      timeoutMs: 900_000,
      context: [
        ...evaluationContext,
        "projects/evaluation.app/design/project-app-evaluation.md",
      ],
    },
  },

  taskRoutes: [
    {
      name: "evaluation-task-pipeline-monitor",
      enabled: true,
      maxConcurrentTriggers: 1,
      description: "Reconciles the standing evaluation-pipeline health task.",
      accepts: ["evaluation.pipeline.check"],
      resolve: resolveEvaluationTask,
    },
    {
      name: "evaluation-task-aftermath",
      enabled: true,
      maxConcurrentTriggers: 5,
      description:
        "Creates one short-lived evaluation task per completed session.",
      accepts: ["session.end", "evaluation.session.requested"],
      resolve: resolveEvaluationTask,
    },
    {
      name: "evaluation-task-owner",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Routes unfamiliar evaluation.app maintenance through its owner entry.",
      accepts: ["evaluation.tick"],
      resolve: resolveEvaluationTask,
    },
    {
      name: "evaluation-task-deep",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Creates one short-lived task for an explicit deep evaluation.",
      accepts: ["evaluation.deep.requested"],
      resolve: resolveEvaluationTask,
    },
    {
      name: "evaluation-task-aftermath-scan",
      enabled: true,
      maxConcurrentTriggers: 1,
      description: "Reconciles the standing missed-session backfill task.",
      accepts: ["evaluation.aftermath.scan"],
      resolve: resolveEvaluationTask,
    },
    {
      name: "evaluation-task-deep-scan",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Reconciles the standing deep-evaluation candidate scan task.",
      accepts: ["evaluation.deep.scan"],
      resolve: resolveEvaluationTask,
    },
    {
      name: "evaluation-task-project-audit",
      enabled: true,
      maxConcurrentTriggers: 4,
      description:
        "Reconciles one standing independent audit task per target project app.",
      accepts: ["evaluation.project.review.requested"],
      resolve: resolveEvaluationTask,
    },
  ],

  events: [
    "session.end",
    "evaluation.session.requested",
    "evaluation.deep.requested",
    "evaluation.pipeline.check",
    "evaluation.tick",
    "evaluation.review_failed",
    "evaluation.aftermath.scan",
    "evaluation.deep.scan",
    "evaluation.project.review.requested",
    "evaluation.project.reviewed",
    "evaluation.project.notification.requested",
    "message.created",
    "telegram.reply",
    { type: "metric.breach", project: projectId },
    { type: "metric.recovered", project: projectId },
    { type: "project.owner.requested", project: projectId },
    { type: "project.action.invoked", project: projectId },
    { type: "project.tasks.ready", project: `${projectId}.app` },
  ],

  eventGraph: {
    handlers: {
      "evaluation-task-aftermath": {
        emits: [
          "evaluation.reviewed",
          "evaluation.review_failed",
          "evaluation.success_candidate",
          "evaluation.triage_closed",
          "evaluation.learning_created",
          "project.task.reconciled",
        ],
        description:
          "Creates a short-lived task, scores one concrete session, absorbs the result, and emits evaluation events.",
      },
      "evaluation-task-owner": {
        emits: [
          "evaluation.owner_review_started",
          "evaluation.owner_reviewed",
          "project.task.reconciled",
        ],
        description:
          "Routes unfamiliar evaluation.app maintenance through the accountable owner entry.",
      },
      "evaluation-task-pipeline-monitor": {
        emits: ["evaluation.tick", "project.task.reconciled"],
        description:
          "Reconciles the standing pipeline task and emits a tick only when anomaly state changes.",
      },
      "evaluation-task-deep": {
        emits: ["handler.workflow_dispatched", "project.task.reconciled"],
        description: "Creates and absorbs a short-lived deep-evaluation task.",
      },
      "evaluation-task-aftermath-scan": {
        emits: [
          "evaluation.reviewed",
          "evaluation.review_failed",
          "evaluation.success_candidate",
          "evaluation.triage_closed",
          "evaluation.learning_created",
          "project.task.reconciled",
        ],
        description: "Reconciles the standing missed-session backfill task.",
      },
      "evaluation-task-deep-scan": {
        emits: ["handler.workflow_dispatched", "project.task.reconciled"],
        description:
          "Reconciles the standing deep-evaluation candidate scan task.",
      },
      "evaluation-task-project-audit": {
        emits: [
          "evaluation.project.review_started",
          "evaluation.project.reviewed",
          "evaluation.project.notification.requested",
          "project.owner.requested",
          "project.task.reconciled",
        ],
        description:
          "Reconciles one standing target-project audit and writes an independent owner-facing report.",
      },
    },
    adapters: [
      {
        event: "metric.breach",
        emits: ["evaluation.pipeline.check"],
        description:
          "Evaluation metric breaches run through the deterministic anomaly gate before any owner wake.",
      },
      {
        event: "metric.recovered",
        emits: ["evaluation.pipeline.check"],
        description:
          "Evaluation metric recoveries run through the deterministic anomaly gate before any owner wake.",
      },
      {
        event: "project.owner.requested",
        emits: ["evaluation.tick"],
        description: "Generic owner review wakes evaluation heartbeat.",
      },
      {
        event: "project.action.invoked",
        emits: ["evaluation.tick"],
        description: "Project actions become evaluation health-review ticks.",
      },
      {
        event: "project.tasks.ready",
        emits: ["evaluation.tick"],
        description:
          "Ready task-tree leaves wake the evaluation owner through the existing heartbeat lane.",
      },
      {
        event: "message.created",
        emits: ["evaluation.tick"],
        description:
          "Evaluator-targeted owner messages wake evaluation owner review.",
      },
      {
        event: "telegram.reply",
        emits: ["evaluation.tick"],
        description:
          "Human replies attached to evaluator notifications wake evaluation owner review.",
      },
      {
        event: "evaluation.review_failed",
        emits: ["evaluation.project.review.requested"],
        description:
          "Review-process failures request the same project/app review path for evaluation.app.",
      },
      {
        event: "evaluation.project.review.requested",
        emits: ["evaluation.project.reviewed"],
        description:
          "Project/app review requests dispatch the project health evaluator workflow.",
      },
    ],
    externalEvents: [
      "evaluation.reviewed",
      "evaluation.success_candidate",
      "evaluation.triage_closed",
      "evaluation.learning_created",
      "evaluation.project.review_started",
      "project.owner.requested",
      "heartbeat.step_started",
      "heartbeat.skipped",
      "handler.workflow_dispatched",
      "project.task.reconcile.started",
      "project.task.reconcile.skipped",
      "project.task.handler.unavailable",
      "project.task.reconciled",
    ],
    intentionalCycles: [
      {
        id: "evaluation-health-tick",
        events: ["evaluation.tick"],
        reason:
          "Periodic ticks keep evaluation pipeline health visible without running session aftermath blindly.",
      },
    ],
  },

  actions: {
    "evaluate-session": {
      type: "async",
      description: "Evaluate a specific session by sessionId.",
      event(params) {
        return evaluationSessionRequested(params);
      },
    },
    "deep-eval": {
      type: "async",
      description: "Run one deep evaluator review for a specific session.",
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
      event(params) {
        return evaluationReviewRequested("manual-review", params);
      },
    },
    "review-project-app": {
      type: "async",
      description:
        "Review a target project app from the outside and write owner-facing health feedback.",
      event(params) {
        return projectHealthReviewRequested(params);
      },
    },
  },

  async onEvent(ctx, event) {
    return routeEvaluationEvent(ctx, event);
  },
});
