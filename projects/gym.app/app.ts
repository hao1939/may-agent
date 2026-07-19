import { createHash } from "node:crypto";
import {
  defineProjectApp,
  eventDetails,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

const projectId = "gym";

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

function durableEventId(event: Record<string, unknown>): number | null {
  const value = event.eventId;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function taskIdentity(prefix: string, value: unknown): string {
  const raw = String(value ?? "").trim();
  const readable = raw
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `runtime/${prefix}/${readable || prefix}-${digest}`;
}

export function resolveGymTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  const details = eventDetails(event);
  const eventId = durableEventId(event);
  if (!eventId) return null;

  switch (event.type) {
    case "gym.incident.detected": {
      const evaluation = params(details.evaluation);
      const incidentIdentity =
        evaluation.sessionId ??
        details.sessionId ??
        details.incidentId ??
        `event-${eventId}`;
      return {
        id: taskIdentity("incident-intake", incidentIdentity),
        parentId: "incident-learning",
        outcome:
          "Capture one actionable May failure as immutable Gym incident evidence and request review.",
        acceptance: [
          "The incident is durably recorded once and a review request names its evidence.",
        ],
        mode: "achieve",
        workflow: "incident-intake",
        input: { ...details, eventId },
        outputs: [".state/incidents"],
        priority: "P1",
      };
    }
    case "gym.regression.requested":
      return {
        id: taskIdentity("regression-run", `event-${eventId}`),
        parentId: "regression-assurance",
        outcome:
          "Run the requested standalone Gym benchmark and preserve its result or operational failure for review.",
        acceptance: [
          "The requested benchmark produces a durable outcome pointer and any review-worthy result emits one review request.",
        ],
        mode: "achieve",
        workflow: "regression-run",
        input: { ...details, eventId },
        outputs: [".state/runs", ".state/failures"],
        priority: "P1",
      };
    case "gym.review.requested": {
      const requestIdentity = details.requestKey ?? `event-${eventId}`;
      return {
        id: taskIdentity("review-proposal", requestIdentity),
        parentId: "review-proposals",
        outcome:
          "Turn one Gym evidence packet into the smallest human-auditable proposal without changing benchmark truth.",
        acceptance: [
          "A review proposal identifies the evidence, classification, next action, and every human approval boundary.",
        ],
        mode: "achieve",
        workflow: "review-and-propose",
        input: { ...details, eventId },
        outputs: [".state/reviews"],
        priority: "P1",
      };
    }
    default:
      return null;
  }
}

export async function routeGymEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
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

  tasks: {
    accepts: [
      "gym.incident.detected",
      "gym.regression.requested",
      "gym.review.requested",
    ],
    resolve: resolveGymTask,
  },

  events: ["evaluation.reviewed"],

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
