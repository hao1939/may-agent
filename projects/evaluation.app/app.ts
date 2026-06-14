import {
  defineProjectApp,
  eventDetails,
  type ProjectAppContext,
} from "@may-agent/sdk";

const projectId = "evaluation";
const appTaskContext = "app: /app/projects/evaluation.app";

const evaluationContext = [
  "projects/evaluation.app/project.json",
  "projects/evaluation.app/tasks/tree.json",
  "projects/evaluation.app/criteria/criteria.md",
  "projects/evaluation.app/criteria/scoring.md",
];

function evaluationSessionRequested(params: unknown): Record<string, unknown> {
  return {
    type: "evaluation.session.requested",
    project: projectId,
    params: params && typeof params === "object" ? params : {},
  };
}

function evaluationReviewRequested(
  lane: string,
  params: unknown = {},
): Record<string, unknown> {
  return {
    type: "evaluation.tick",
    project: projectId,
    lane,
    params: params && typeof params === "object" ? params : {},
  };
}

async function routeEvaluationEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (
    event.type === "session.completed" ||
    event.type === "evaluation.session.requested" ||
    event.type === "evaluation.deep.requested" ||
    event.type === "evaluation.tick"
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

  if (event.type === "metric.breach") {
    return ctx.emit(
      evaluationReviewRequested("metric-breach", {
        metric: eventDetails(event),
      }),
    );
  }

  if (event.type === "project.action.invoked") {
    return ctx.emit(
      evaluationReviewRequested("project-action", {
        action: eventDetails(event),
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
      id: "integrity-patrol",
      enabled: true,
      intervalMs: 21_600_000,
      event: {
        type: "evaluation.tick",
        project: projectId,
        lane: "patrol",
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
  ],

  events: [
    "session.completed",
    "evaluation.session.requested",
    "evaluation.deep.requested",
    "evaluation.tick",
    "metric.breach",
    { type: "project.owner.requested", project: projectId },
    { type: "project.planning.requested", project: projectId },
    { type: "project.action.invoked", project: projectId },
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
        emits: ["heartbeat.step_started", "heartbeat.skipped"],
        description: "Reviews evaluation app health and pipeline/system lanes.",
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
        event: "metric.breach",
        emits: ["evaluation.tick"],
        description: "Metric breaches become evaluation health-review ticks.",
      },
      {
        event: "project.action.invoked",
        emits: ["evaluation.tick"],
        description: "Project actions become evaluation health-review ticks.",
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
          params: params && typeof params === "object" ? params : {},
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
