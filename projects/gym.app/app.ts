import { createHash } from "node:crypto";
import {
  defineProjectApp,
  eventDetails,
  Type,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";
import mayCanary from "../gym/benchmarks/may-alignment/canary.json";

const projectId = "gym";
const actionInputSchema = Type.Object({}, { additionalProperties: true });
const mayCanaryScenarios = mayCanary.scenarios;

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
      trials: mayCanary.development_trials,
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

function improvementRequested(input: unknown = {}): ProjectAppEvent {
  return {
    type: "gym.improvement.requested",
    project: projectId,
    params: {
      agent: "may",
      benchmark: "may-alignment",
      scenarios: [...mayCanaryScenarios],
      trials: 3,
      ...params(input),
    },
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

function isMayEvaluation(event: Record<string, unknown>): boolean {
  return String(eventDetails(event).agent ?? "").toLowerCase() === "may";
}

function learningEvidenceObserved(
  polarity: "positive" | "negative",
  evaluation: Record<string, unknown>,
): ProjectAppEvent {
  return {
    type: "gym.learning.evidence.observed",
    project: projectId,
    params: { polarity, evaluation },
  };
}

function codexLearningRequested(input: unknown = {}): ProjectAppEvent {
  return {
    type: "gym.codex.learning.requested",
    project: projectId,
    params: {
      batchSize: 200,
      maxBatches: 1,
      ...params(input),
    },
  };
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

function selected(
  source: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  return Object.fromEntries(
    keys.flatMap((key) =>
      source[key] === undefined ? [] : [[key, source[key]]],
    ),
  );
}

export function resolveGymTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  const details = eventDetails(event);
  const eventId = durableEventId(event);
  if (!eventId) return null;

  switch (event.type) {
    case "project.owner.requested":
      return {
        id: "runtime/owner-review",
        parentId: "review-proposals",
        outcome:
          "Keep the Gym project reviewed by its accountable owner and organize the smallest useful next step from current evidence.",
        acceptance: [
          "The owner answers, records an evidence-backed no-op, or proposes bounded durable follow-up without changing benchmark truth.",
        ],
        mode: "maintain",
        owner: "gym",
        priority: "P1",
      };
    case "project.comment.created":
    case "gym.improvement.requested":
    case "agent.revision.changed":
      return {
        id: "improve/may",
        parentId: "regression-assurance",
        outcome:
          "Keep May on the best behavior supported by approved Gym evidence and bring one verified improvement proposal to Hao when a better candidate is ready.",
        acceptance: [
          "The selected benchmark truth is human-approved before agent failures are acted on.",
          "Every non-pass is assigned to May, benchmark truth, scoring, runtime, or non-actionable noise.",
          "An exact candidate passes targeted and full approved verification without regression before promotion is requested.",
          "Production May changes only after approval of the exact fingerprinted artifact.",
        ],
        mode: "maintain",
        workflow: "improve-agent",
        input: {
          agent: "may",
          benchmark: "may-alignment",
          reason:
            event.type === "agent.revision.changed"
              ? "may-revision-confirmation"
              : event.type === "project.comment.created"
                ? "project-intent"
                : String(details.reason ?? "manual"),
          ...selected(details, [
            "benchmark",
            "revision",
            "artifactFingerprint",
            "approvalId",
            "scenario",
            "scenarios",
            "trials",
          ]),
        },
        outputs: [
          ".state/assessments",
          ".state/candidates",
          ".state/metrics",
          "../gym/.state/benchmarks",
        ],
        priority: "P1",
      };
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
        input: {
          kind: "incident",
          ...selected(details, ["incidentId", "sessionId", "reason"]),
          ...selected(evaluation, [
            "agent",
            "artifactFound",
            "artifactPath",
            "lane",
            "reviewedVerdict",
            "reviewSessionId",
            "sessionId",
            "verdict",
          ]),
        },
        outputs: [".state/incidents"],
        priority: "P1",
      };
    }
    case "gym.learning.evidence.observed": {
      const evaluation = params(details.evaluation);
      const evidenceIdentity =
        evaluation.reviewSessionId ??
        evaluation.sessionId ??
        details.sessionId ??
        `event-${eventId}`;
      return {
        id: taskIdentity("learning-evidence", evidenceIdentity),
        parentId: "incident-learning",
        outcome:
          "Preserve one reviewed May session as positive or negative learning evidence without starting an expensive improvement run.",
        acceptance: [
          "The observation is recorded once with its polarity and source evaluation evidence.",
        ],
        mode: "achieve",
        workflow: "learning-evidence-intake",
        input: {
          kind: "learning-evidence",
          polarity: String(details.polarity ?? "unknown"),
          ...selected(evaluation, [
            "agent",
            "artifactFound",
            "artifactPath",
            "lane",
            "reviewedVerdict",
            "reviewSessionId",
            "sessionId",
            "verdict",
          ]),
        },
        outputs: [".state/learning/evidence"],
        priority: "P2",
      };
    }
    case "gym.codex.learning.requested":
      return {
        id: "learning/codex-sessions",
        parentId: "incident-learning",
        outcome:
          "Continuously collect only strong, reusable Hao intent signals from Codex sessions as reviewable May learning candidates.",
        acceptance: [
          "Only Hao-authored turns absent from the durable checkpoint are reviewed.",
          "Ordinary requests and weak inference are discarded; retained signals are explicit, repeated, or independently validated.",
          "Raw conversation text stays in Codex storage while Gym preserves hashes, source pointers, and plain-language candidates.",
          "Every changed candidate catalog is reviewed against the May deputy curriculum and accepted May-agent design before the checkpoint advances.",
          "Collected evidence remains a candidate until a later learning or benchmark proposal passes its own approval boundary.",
        ],
        mode: "maintain",
        workflow: "codex-learning-intake",
        input: {
          reason: String(details.reason ?? "daily"),
          ...selected(details, ["batchSize", "maxBatches"]),
        },
        outputs: [".state/learning/codex"],
        priority: "P2",
      };
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
        input: selected(details, [
          "agent",
          "benchmark",
          "reason",
          "scenario",
          "trials",
        ]),
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
        input: {
          kind: String(details.kind ?? "unknown"),
          ...selected(details, [
            "failurePath",
            "incidentId",
            "incidentPath",
            "outcomePath",
            "requestKey",
            "runDir",
            "runId",
          ]),
        },
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
    if (!isMayEvaluation(event)) {
      return ctx.noop("evaluation is not for May");
    }
    const details = eventDetails(event);
    const failure = isMayFailure(event);
    ctx.emit(
      learningEvidenceObserved(failure ? "negative" : "positive", details),
    );
    if (failure) {
      return ctx.emit(
        incidentDetected({
          reason: "may-evaluation-failure",
          evaluation: details,
        }),
      );
    }
    return { recorded: "positive-learning-evidence" };
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
    sessionsPerDay: 6,
    tokensPerDay: 250_000,
    maxConcurrent: 1,
  },

  schedules: [
    {
      id: "may-improvement-weekly",
      enabled: mayCanary.automatic_schedule_enabled,
      intervalMs: 604_800_000,
      emits: [
        improvementRequested({
          reason: "weekly",
          trials: 3,
        }),
      ],
    },
    {
      id: "codex-learning-daily",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        codexLearningRequested({
          reason: "daily",
          batchSize: 200,
          maxBatches: 1,
        }),
      ],
    },
  ],

  tasks: {
    accepts: [
      "gym.incident.detected",
      "gym.learning.evidence.observed",
      "gym.codex.learning.requested",
      "gym.regression.requested",
      "gym.review.requested",
      "gym.improvement.requested",
      { type: "agent.revision.changed", agents: ["may"] },
      { type: "project.comment.created", project: projectId },
      { type: "project.owner.requested", project: projectId },
    ],
    resolve: resolveGymTask,
  },

  events: [
    {
      type: "evaluation.reviewed",
      agents: ["may"],
      lanes: ["needs_triage", "success_candidate"],
    },
  ],

  actions: {
    "improve-may-now": {
      type: "async",
      description:
        "Run one bounded May improvement cycle against approved Gym evidence.",
      inputSchema: actionInputSchema,
      event(input) {
        return improvementRequested({ reason: "manual", ...params(input) });
      },
    },
    "run-regression": {
      type: "async",
      description:
        "Run May alignment regression now, optionally for one scenario.",
      inputSchema: actionInputSchema,
      event(input) {
        return regressionRequested(input);
      },
    },
    "report-incident": {
      type: "async",
      description:
        "Submit a concrete May failure or human correction for benchmark review.",
      inputSchema: actionInputSchema,
      event(input) {
        return incidentDetected({ reason: "manual", ...params(input) });
      },
    },
    "collect-codex-learning": {
      type: "async",
      description:
        "Collect a bounded batch of strong Hao preference and decision signals from Codex sessions.",
      inputSchema: actionInputSchema,
      event(input) {
        return codexLearningRequested({
          reason: "manual-backfill",
          batchSize: 200,
          maxBatches: 5,
          ...params(input),
        });
      },
    },
  },

  async onEvent(ctx, event) {
    return routeGymEvent(ctx, event);
  },
});
