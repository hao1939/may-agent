import {
  defineProjectApp,
  eventDetails,
  type ProjectAppContext,
  type ProjectAppEvent,
} from "@may-agent/sdk";

const projectId = "evaluation";
const appTaskContext = "app: /app/projects/evaluation.app";

const evaluationContext = [
  "projects/evaluation.app/project.json",
  "projects/evaluation.app/.state/tasks/tree.json",
  "projects/evaluation.app/criteria/criteria.md",
  "projects/evaluation.app/criteria/scoring.md",
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

async function routeEvaluationEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (
    event.type === "session.completed" ||
    event.type === "evaluation.session.requested" ||
    event.type === "evaluation.deep.requested" ||
    event.type === "evaluation.tick" ||
    event.type === "evaluation.aftermath.scan" ||
    event.type === "evaluation.deep.scan"
  ) {
    return ctx.noop(`${event.type} is handled by workflowHandlers`);
  }

  if (
    event.type === "project.owner.requested" ||
    event.type === "project.planning.requested"
  ) {
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
    return ctx.emit(
      evaluationReviewRequested(
        event.type === "metric.breach" ? "metric-breach" : "metric-recovered",
        {
          metric: eventDetails(event),
        },
      ),
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(
      evaluationReviewRequested("project-action", {
        action: eventDetails(event),
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
    "Evaluation app: session aftermath scoring, criteria calibration, drift detection, integrity patrol, and strategy learning.",
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
      event: {
        type: "evaluation.tick",
        project: projectId,
        lane: "pipeline-health",
      },
    },
    {
      id: "drift-detection",
      enabled: true,
      intervalMs: 3_600_000,
      event: {
        type: "evaluation.tick",
        project: projectId,
        lane: "drift",
      },
    },
    {
      id: "owner-heartbeat",
      enabled: true,
      intervalMs: 14_400_000,
      event: {
        type: "project.owner.requested",
        project: projectId,
        reason: "owner-heartbeat",
        params: {
          instruction:
            "Low-frequency evaluation owner heartbeat: look for missed evaluation-system issues that fixed drift, patrol, aftermath, and metric loops did not catch. Check recent heartbeat/patrol/drift findings before creating work. Prefer one to three task-tree actions or no-op with reason; do not run session aftermath unless a concrete sessionId is present.",
          reviewChecklist: [
            "Look for stale criteria/scoring assumptions and repeated evaluator misjudgments.",
            "Look for missed session aftermath, deep-eval candidate gaps, or drift patterns not covered by current schedules.",
            "Look for task-tree bloat or findings that should be rolled up into durable evaluation knowledge.",
            "Avoid duplicate heartbeat tasks by inspecting recent owner-review findings first.",
            "No-op is valid when the existing queues already cover the useful next work.",
          ],
        },
      },
    },
    {
      id: "integrity-patrol",
      enabled: true,
      intervalMs: 21_600_000,
      event: {
        type: "evaluation.tick",
        project: projectId,
        lane: "patrol",
      },
    },
    {
      id: "session-aftermath-scan",
      enabled: true,
      intervalMs: 420_000, // 7min — backfill terminal sessions missed by completion event
      event: {
        type: "evaluation.aftermath.scan",
        project: projectId,
      },
    },
    {
      id: "eval-llm-scan",
      enabled: false,
      intervalMs: 1_800_000, // 30min — one deep eval candidate per run
      event: {
        type: "evaluation.deep.scan",
        project: projectId,
      },
    },
  ],

  workflowHandlers: [
    {
      name: "evaluation-aftermath",
      type: "job",
      enabled: true,
      maxConcurrentTriggers: 5,
      description:
        "Evaluates one completed session. It must be triggered with a sessionId.",
      on: ["session.completed", "evaluation.session.requested"],
      handler: {
        workflow: "evaluator-aftermath",
        agent: "evaluator",
        includeEvent: true,
        task: `${appTaskContext}\nEvaluate the completed session from the trigger event.`,
        timeoutMs: 900_000,
      },
      context: evaluationContext,
    },
    {
      name: "evaluation-heartbeat",
      type: "job",
      enabled: true,
      description:
        "Reviews pipeline health, drift, patrol, and strategy-learning lanes.",
      on: ["evaluation.tick"],
      handler: {
        workflow: "evaluator-heartbeat",
        agent: "evaluator",
        includeEvent: true,
        task: `${appTaskContext}\nReview evaluation app health for the trigger lane. Do not run session aftermath unless the trigger includes a concrete sessionId.`,
        timeoutMs: 900_000,
      },
      context: evaluationContext,
    },
    {
      name: "evaluation-deep-eval",
      type: "job",
      enabled: true,
      description:
        "Runs one non-heuristic evaluator review as workflow-traced work.",
      on: ["evaluation.deep.requested"],
      handler: {
        workflow: "evaluator-deep-eval",
        agent: "evaluator",
        includeEvent: true,
        task: `${appTaskContext}\nRun the requested deep evaluation.`,
        timeoutMs: 1_800_000,
      },
      context: evaluationContext,
    },
    {
      name: "evaluation-aftermath-scan",
      type: "job",
      enabled: true,
      description:
        "Backfill safety net: evaluate terminal sessions missed by session.completed event (7min delay, limit 1).",
      on: ["evaluation.aftermath.scan"],
      handler: {
        workflow: "evaluator-aftermath",
        agent: "evaluator",
        includeEvent: true,
        task: `${appTaskContext}\nBackfill: evaluate the oldest terminal session that has no evaluation yet (ended >7min ago).`,
        timeoutMs: 900_000,
      },
      context: evaluationContext,
    },
    {
      name: "evaluation-deep-scan",
      type: "job",
      enabled: true,
      description:
        "Bounded non-heuristic evaluator lane: find one candidate for deep LLM evaluation per run.",
      on: ["evaluation.deep.scan"],
      handler: {
        workflow: "evaluator-deep-eval",
        agent: "evaluator",
        includeEvent: true,
        task: `${appTaskContext}\nFind one recent session eligible for deep (non-heuristic) evaluation and run it.`,
        timeoutMs: 1_800_000,
      },
      context: evaluationContext,
    },
  ],

  events: [
    "session.completed",
    "evaluation.session.requested",
    "evaluation.deep.requested",
    "evaluation.tick",
    "evaluation.aftermath.scan",
    "evaluation.deep.scan",
    { type: "metric.breach", project: projectId },
    { type: "metric.recovered", project: projectId },
    { type: "project.owner.requested", project: projectId },
    { type: "project.planning.requested", project: projectId },
    { type: "project.action.invoked", project: projectId },
    { type: "project.tasks.ready", project: `${projectId}.app` },
  ],

  eventGraph: {
    handlers: {
      "evaluation-aftermath": {
        emits: [
          "evaluation.reviewed",
          "evaluation.success_candidate",
          "evaluation.triage_closed",
          "evaluation.learning_created",
        ],
        description:
          "Scores one concrete session and emits evaluation result events.",
      },
      "evaluation-heartbeat": {
        emits: ["evaluation.owner_review_started", "evaluation.owner_reviewed"],
        description:
          "Runs a bounded evaluation.app owner review against the task tree.",
      },
      "evaluation-deep-eval": {
        emits: ["handler.workflow_dispatched"],
        description:
          "Runs an evaluator worker session for one explicit deep-eval request.",
      },
    },
    adapters: [
      {
        event: "project.owner.requested",
        emits: ["evaluation.tick"],
        description: "Generic owner review wakes evaluation heartbeat.",
      },
      {
        event: "project.planning.requested",
        emits: ["evaluation.tick"],
        description: "Legacy planning alias wakes evaluation heartbeat.",
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
    ],
    externalEvents: [
      "evaluation.reviewed",
      "evaluation.success_candidate",
      "evaluation.triage_closed",
      "evaluation.learning_created",
      "heartbeat.step_started",
      "heartbeat.skipped",
      "handler.workflow_dispatched",
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
  },

  async onEvent(ctx, event) {
    return routeEvaluationEvent(ctx, event);
  },
});
