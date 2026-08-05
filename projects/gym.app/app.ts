import { createHash } from "node:crypto";
import {
  defineProjectApp,
  eventDetails,
  Type,
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

function isMayEvaluation(event: Record<string, unknown>): boolean {
  return String(eventDetails(event).agent ?? "").toLowerCase() === "may";
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

function telegramFieldReviewRequested(input: unknown = {}): ProjectAppEvent {
  return {
    type: "gym.telegram.field-review.requested",
    project: projectId,
    params: {
      batchSize: 40,
      ...params(input),
    },
  };
}

function designAlignmentRequested(input: unknown = {}): ProjectAppEvent {
  return {
    type: "gym.design-alignment.requested",
    project: projectId,
    params: params(input),
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

function isMayMetricBreach(event: Record<string, unknown>): boolean {
  const details = eventDetails(event);
  const owner = String(details.owner ?? "").toLowerCase();
  const agent = String(details.agent ?? "").toLowerCase();
  const metric = String(
    details.metricId ?? details.metric_id ?? details.id ?? details.name ?? "",
  ).toLowerCase();
  return (
    owner === "may" ||
    owner === "agent:may" ||
    agent === "may" ||
    metric.startsWith("may.") ||
    metric.startsWith("agent.may.")
  );
}

function mayImprovementIntent(): ProjectAppTaskIntent {
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
      curriculumDrain: true,
    },
    outputs: [
      ".state/assessments",
      ".state/candidates",
      ".state/learning/training-drain.json",
      ".state/metrics",
      "../gym/.state/benchmarks",
    ],
    priority: "P1",
  };
}

function gymOwnerReviewIntent(): ProjectAppTaskIntent {
  return {
    id: "runtime/owner-review",
    parentId: "review-proposals",
    outcome:
      "Keep the Gym project reviewed by its accountable owner and organize the smallest useful next step from current evidence.",
    acceptance: [
      "Interpret the exact requested outcome before selecting work; a free-form comment is intent, not an instruction to run the normal May campaign.",
      "Answer, record an evidence-backed no-op, or propose bounded durable follow-up without changing benchmark truth.",
      "Keep task ids, owners, workflows, and wake paths inside Gym; the caller receives the owner disposition and follows any resulting work to terminal proof.",
    ],
    mode: "maintain",
    owner: "gym",
    priority: "P1",
  };
}

export function resolveGymTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  const details = eventDetails(event);
  const eventId = durableEventId(event);
  if (!eventId) return null;

  switch (event.type) {
    case "evaluation.reviewed":
      return isMayEvaluation(event)
        ? {
            id: "runtime/evaluation-intake",
            parentId: "incident-learning",
            outcome:
              "Keep reviewed May evaluations classified and filed, and turn only actionable failures into independently reviewable proposals.",
            acceptance: [
              "Process the oldest unprocessed reviewed May evaluation from durable event history.",
              "Record positive and negative learning evidence without creating per-evaluation evidence tasks.",
              "Create durable incident evidence and one review request only for an actionable May failure.",
              "Wake the same frontier while another unprocessed evaluation remains.",
            ],
            mode: "maintain",
            workflow: "evaluation-intake",
            input: { contractRevision: 1 },
            outputs: [
              ".state/learning/evidence",
              ".state/incidents",
              ".state/learning/evaluation-intake.json",
            ],
            priority: "P1",
          }
        : null;
    case "project.comment.created":
    case "project.owner.requested":
      return gymOwnerReviewIntent();
    case "gym.design-alignment.requested":
      return {
        id: "runtime/design-alignment-review",
        parentId: "review-proposals",
        outcome:
          "Keep Gym and May behavior aligned with their accepted design, and propose the smallest evidence-backed repair when they drift.",
        acceptance: [
          "Establish the latest accepted design and approved change lineage before comparing it with implementation; older approved artifacts are historical evidence, not desired state when a newer accepted revision supersedes them.",
          "Check the newest improve/may task, result, relevant trigger, approval or revision identity, and run evidence as well as the implementation; source code and tests alone cannot prove alignment.",
          "Explicitly verify wake delivery, stable resource identity, resource-local checkpoint coherence, fresh fingerprint-scoped evidence after evaluator changes, the correct consumer benchmark and cases, exact approval boundaries, and continuation or truthful exhaustion.",
          "Mark each promise aligned, drifted, or inconclusive with exact evidence; never call an intentional newer accepted change drift, and never turn missing live proof into an aligned result.",
          "An aligned review records a quiet evidence-backed no-op; speculation is discarded.",
          "For at most three real gaps, identify the root cause, impact, smallest repair, proof needed, and any exact human approval boundary.",
          "The review never changes benchmark truth or production May without exact artifact approval.",
        ],
        mode: "maintain",
        owner: "gym",
        priority: "P2",
      };
    case "gym.resource-migration.requested":
      return {
        id: "runtime/unified-resource-migration-v3",
        parentId: "review-proposals",
        outcome:
          "Retire the named superseded Gym task resources after their durable event and run evidence has been preserved.",
        acceptance: [
          "Only the fixed version-3 superseded resource set is closed at its exact generations, and every closure leaves a completion receipt.",
        ],
        mode: "achieve",
        workflow: "unified-resource-migration",
        input: { migration: "unified-resource-v3" },
        outputs: [],
        priority: "P0",
      };
    case "gym.improvement.requested":
    case "agent.revision.changed":
      return mayImprovementIntent();
    case "project.approval.submitted":
      return String(details.taskId ?? details.pathId ?? "") === "improve/may"
        ? mayImprovementIntent()
        : null;
    case "metric.breach":
      return isMayMetricBreach(event) ? mayImprovementIntent() : null;
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
          ...selected(details, [
            "fieldReviewPath",
            "classification",
            "candidateId",
          ]),
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
          contractRevision: 1,
          reason: String(details.reason ?? "daily"),
          ...selected(details, ["batchSize", "maxBatches"]),
        },
        outputs: [".state/learning/codex"],
        priority: "P2",
      };
    case "gym.telegram.field-review.requested":
      return {
        id: "learning/telegram-field-review",
        parentId: "incident-learning",
        outcome:
          "Review completed May Telegram conversations and preserve only strong evidence that improves deputy behavior or the surrounding system.",
        acceptance: [
          "The review judges Hao's intent, May's handling, the delivered outcome, and any clear human reaction.",
          "Weak or one-off signals are discarded and completed source events advance a durable checkpoint.",
          "Every retained signal names the responsible layer; only strong actionable failures request a proposal.",
        ],
        mode: "maintain",
        workflow: "telegram-field-review",
        input: {
          reason: String(details.reason ?? "daily-field-review"),
          ...selected(details, ["batchSize"]),
        },
        outputs: [".state/learning/telegram"],
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
      const requestIdentity = [
        details.requestKey ?? `event-${eventId}`,
        details.recoveryId,
      ]
        .filter(Boolean)
        .join(":");
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
            "recoveryId",
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
    maxConcurrent: 2,
  },

  schedules: [
    {
      id: "may-training-refill",
      enabled: mayCanary.automatic_schedule_enabled,
      intervalMs: 86_400_000,
      emits: [
        improvementRequested({
          reason: "curriculum-refill",
          curriculumDrain: true,
        }),
      ],
    },
    {
      id: "codex-learning-drain",
      enabled: true,
      intervalMs: 3_600_000,
      emits: [
        codexLearningRequested({
          reason: "continuous-source-drain",
          batchSize: 200,
          maxBatches: 5,
        }),
      ],
    },
    {
      id: "telegram-field-review-daily",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [telegramFieldReviewRequested({ reason: "daily-field-review" })],
    },
    {
      id: "design-alignment-review-daily",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        designAlignmentRequested({ reason: "daily-design-alignment-review" }),
      ],
    },
  ],

  tasks: {
    accepts: [
      { type: "evaluation.reviewed", agents: ["may"] },
      "gym.incident.detected",
      "gym.learning.evidence.observed",
      "gym.codex.learning.requested",
      "gym.telegram.field-review.requested",
      "gym.design-alignment.requested",
      "gym.resource-migration.requested",
      "gym.regression.requested",
      "gym.review.requested",
      "gym.improvement.requested",
      { type: "metric.breach" },
      { type: "agent.revision.changed", agents: ["may"] },
      { type: "project.comment.created", project: projectId },
      { type: "project.owner.requested", project: projectId },
      { type: "project.approval.submitted", project: projectId },
    ],
    resolve: resolveGymTask,
  },

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
    "review-telegram-field": {
      type: "async",
      description:
        "Review a bounded batch of completed May Telegram conversations for strong field evidence.",
      inputSchema: actionInputSchema,
      event(input) {
        return telegramFieldReviewRequested({
          reason: "manual-field-review",
          ...params(input),
        });
      },
    },
  },
});
