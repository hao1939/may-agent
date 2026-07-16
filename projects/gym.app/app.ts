import {
  defineProjectApp,
  eventDetails,
  type ProjectAppContext,
  type ProjectAppEvent,
} from "@may-agent/sdk";

const projectId = "gym";
const appTaskContext = [
  "app: /app/projects/gym.app",
  "project: /app/projects/gym",
  "persistent-task: skip",
].join("\n");

const appContext = [
  "projects/gym.app/project.json",
  "projects/gym/README.md",
  "projects/gym/docs/test-improve-verify-loop.md",
  "projects/gym/benchmarks/may-alignment/README.md",
];

function params(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function regressionRequested(input: unknown = {}): ProjectAppEvent {
  return {
    type: "gym.regression.requested",
    project: projectId,
    params: {
      benchmark: "may-alignment",
      agent: "may",
      trials: 3,
      ...params(input),
    },
  };
}

function incidentDetected(input: unknown = {}): ProjectAppEvent {
  return {
    type: "gym.incident.detected",
    project: projectId,
    params: params(input),
  };
}

function isMayFailure(event: Record<string, unknown>): boolean {
  const details = eventDetails(event);
  if (String(details.agent ?? "").toLowerCase() !== "may") return false;

  const lane = String(details.lane ?? "").toLowerCase();
  const verdict = String(
    details.reviewedVerdict ?? details.verdict ?? "",
  ).toLowerCase();
  return (
    lane === "needs_triage" ||
    [
      "fail",
      "failed",
      "partial",
      "poor",
      "needs_improvement",
      "blocked",
    ].includes(verdict)
  );
}

export async function routeGymEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  if (
    event.type === "gym.regression.requested" ||
    event.type === "gym.incident.detected" ||
    event.type === "gym.review.requested"
  ) {
    return ctx.noop(`${event.type} is handled by workflowHandlers`);
  }

  if (
    event.type === "gym.regression.completed" ||
    event.type === "gym.regression.failed" ||
    event.type === "gym.review.ready"
  ) {
    return ctx.noop(`${event.type} is a terminal Gym output event`);
  }

  if (event.type === "evaluation.reviewed") {
    if (!isMayFailure(event)) {
      return ctx.noop("evaluation is not an actionable May failure");
    }
    return ctx.emit(
      incidentDetected({
        reason: "may-evaluation-failure",
        evaluation: eventDetails(event),
      }),
    );
  }

  return undefined;
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  owner: "gym",
  description:
    "Autonomous operator for incident-derived benchmark proposals and May regression runs.",
  workspace: {
    kind: "local",
    localPath: "../gym",
  },

  budget: {
    sessionsPerDay: 20,
    tokensPerDay: 500_000,
    maxConcurrent: 2,
  },

  schedules: [
    {
      id: "may-alignment-nightly",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        regressionRequested({
          reason: "nightly",
          trials: 3,
        }),
      ],
    },
  ],

  workflowHandlers: [
    {
      name: "gym-incident-intake",
      type: "job",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Captures one May failure as immutable incident evidence and queues benchmark review.",
      accepts: ["gym.incident.detected"],
      handler: {
        workflow: "incident-intake",
        agent: "gym",
        includeEvent: true,
        task: `${appTaskContext}\nCapture this incident without changing May or approved benchmark truth.`,
        timeoutMs: 120_000,
      },
      context: appContext,
    },
    {
      name: "gym-regression-run",
      type: "job",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Runs the standalone Gym benchmark and queues human-relevant results for review.",
      accepts: ["gym.regression.requested"],
      handler: {
        workflow: "regression-run",
        agent: "gym",
        includeEvent: true,
        task: `${appTaskContext}\nRun the requested benchmark through the standalone Gym CLI.`,
        timeoutMs: 7_200_000,
      },
      context: appContext,
    },
    {
      name: "gym-review-and-propose",
      type: "job",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Reviews an incident or regression result and prepares a bounded human-review proposal.",
      accepts: ["gym.review.requested"],
      handler: {
        workflow: "review-and-propose",
        agent: "gym",
        includeEvent: true,
        task: `${appTaskContext}\nReview the supplied evidence and prepare the smallest useful proposal.`,
        timeoutMs: 900_000,
      },
      context: appContext,
    },
  ],

  events: [
    "evaluation.reviewed",
    "gym.regression.completed",
    "gym.regression.failed",
    "gym.review.ready",
  ],

  eventGraph: {
    handlers: {
      "gym-incident-intake": {
        emits: ["gym.review.requested"],
        description:
          "Persists incident evidence and queues it for benchmark-owner review.",
      },
      "gym-regression-run": {
        emits: [
          "gym.regression.completed",
          "gym.regression.failed",
          "gym.review.requested",
        ],
        description:
          "Executes the standalone benchmark and emits a durable result pointer.",
      },
      "gym-review-and-propose": {
        emits: ["gym.review.ready"],
        description:
          "Uses the Gym owner agent to prepare a reviewable scenario or remediation proposal.",
      },
    },
    adapters: [
      {
        event: "evaluation.reviewed",
        emits: ["gym.incident.detected"],
        description:
          "Actionable May evaluation failures enter Gym incident intake.",
      },
    ],
    externalEvents: [
      "gym.regression.completed",
      "gym.regression.failed",
      "gym.review.ready",
    ],
    limits: {
      maxHandlersPerEvent: 2,
    },
  },

  actions: {
    "run-regression": {
      type: "async",
      description:
        "Run May alignment regression now, optionally for one scenario.",
      event(input) {
        return regressionRequested(input);
      },
    },
    "report-incident": {
      type: "async",
      description:
        "Submit a concrete May failure or human correction for benchmark review.",
      event(input) {
        return incidentDetected({ reason: "manual", ...params(input) });
      },
    },
  },

  async onEvent(ctx, event) {
    return routeGymEvent(ctx, event);
  },
});
