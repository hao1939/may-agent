import { createHash } from "node:crypto";
import {
  Type,
  defineApp,
  type AppDisposition,
  type AppEvent,
  type AppInput,
  type AppRequest,
  type EventSelector,
  type TaskIntent,
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

function eventDetails(event: Record<string, unknown>): Record<string, unknown> {
  const data = params(event.data);
  return {
    ...params(event.target),
    ...params(data.evaluation),
    ...data,
    ...selected(event, ["action", "owner", "source", "urgency"]),
  };
}

function gymEvent(
  type: string,
  input: unknown = {},
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data: { project: projectId, ...params(input) },
    target: { appId: projectId, project: projectId },
  };
}

function improvementRequested(
  input: unknown = {},
): AppEvent<Record<string, unknown>> {
  return gymEvent("gym.improvement.requested", {
    agent: "may",
    benchmark: "may-alignment",
    scenarios: [...mayCanaryScenarios],
    trials: 3,
    ...params(input),
  });
}

function isMayEvaluation(event: Record<string, unknown>): boolean {
  const details = eventDetails(event);
  return (
    String(details.agent ?? "").toLowerCase() === "may" &&
    String(details.verdict ?? "").toLowerCase() !== "skipped"
  );
}

function codexLearningRequested(
  input: unknown = {},
): AppEvent<Record<string, unknown>> {
  return gymEvent("gym.codex.learning.requested", {
    batchSize: 200,
    maxBatches: 1,
    ...params(input),
  });
}

function designAlignmentRequested(
  input: unknown = {},
): AppEvent<Record<string, unknown>> {
  return gymEvent("gym.design-alignment.requested", input);
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

function mayImprovementIntent(): TaskIntent {
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

function gymOwnerReviewIntent(): TaskIntent {
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
): TaskIntent | null {
  const details = eventDetails(event);

  switch (event.type) {
    case "evaluation.recorded":
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
          "Cancel the invalid resource-retirement attempt while preserving Gym's standing owner-review and design-alignment responsibilities.",
        acceptance: [
          "No standing runtime resource is mutated, and this one-time migration carrier records the correction before it converges.",
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
        details.requestId;
      if (!incidentIdentity) return null;
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
        details.reviewSessionId ??
        details.sessionId;
      if (!evidenceIdentity) return null;
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
    case "gym.regression.requested": {
      const requestId = String(details.requestId ?? "").trim();
      if (!requestId) return null;
      return {
        id: taskIdentity("regression-run", requestId),
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
    }
    case "gym.review.requested": {
      const evidenceIdentity =
        details.requestKey ??
        details.failurePath ??
        details.incidentId ??
        details.runId;
      if (!evidenceIdentity) return null;
      const requestIdentity = [evidenceIdentity, details.recoveryId]
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

const gymInputKinds = [
  "owner-review",
  "improve-may",
  "run-regression",
  "report-incident",
  "collect-codex-learning",
  "review-telegram-field",
] as const;

const gymInputSchema = Type.Object(
  {
    kind: Type.Union(gymInputKinds.map((kind) => Type.Literal(kind))),
    data: Type.Record(Type.String(), Type.Unknown()),
  },
  { additionalProperties: false },
);

function gymInput(
  kind: (typeof gymInputKinds)[number],
  data: unknown,
): AppInput {
  return { kind, data: params(data) };
}

function taskForGymInput(
  input: AppInput,
  requestId: string,
): TaskIntent | null {
  const data = { ...params(input.data), requestId };
  switch (input.kind) {
    case "owner-review":
      return gymOwnerReviewIntent();
    case "improve-may":
      return mayImprovementIntent();
    case "run-regression":
      return resolveGymTask(gymEvent("gym.regression.requested", data));
    case "report-incident":
      return resolveGymTask(gymEvent("gym.incident.detected", data));
    case "collect-codex-learning":
      return resolveGymTask(gymEvent("gym.codex.learning.requested", data));
    default:
      return null;
  }
}

export function routeGymRequest(
  request: Readonly<AppRequest>,
): AppDisposition | null {
  if (request.dependency) {
    return request.dependency.status === "done"
      ? {
          type: "complete",
          summary:
            request.dependency.summary ?? `${request.input.kind} completed`,
          response: request.dependency.response,
          evidence: request.dependency.evidence,
        }
      : null;
  }
  if (request.input.kind === "review-telegram-field") {
    return {
      type: "delegate",
      appId: "evaluation",
      input: {
        kind: "deep-scan",
        data: {
          reason: "gym-telegram-field-review",
          requestedBy: "gym",
          ...params(request.input.data),
        },
      },
    };
  }
  const intent = taskForGymInput(request.input, request.id);
  return intent ? { type: "task", task: { kind: "desired", intent } } : null;
}

const gymTaskSubscriptions: EventSelector[] = [
  "evaluation.recorded",
  "gym.incident.detected",
  "gym.learning.evidence.observed",
  "gym.codex.learning.requested",
  "gym.design-alignment.requested",
  "gym.resource-migration.requested",
  "gym.regression.requested",
  "gym.review.requested",
  "gym.improvement.requested",
  { type: "metric.breach" },
  { type: "agent.revision.changed", agents: ["may"] },
  { type: "project.approval.submitted", project: projectId },
];

export default defineApp({
  id: projectId,
  version: 1,
  owner: "gym",
  description:
    "Autonomous operator for incident-derived benchmark proposals and May regression runs.",
  workspace: {
    kind: "local",
    localPath: "../gym",
  },
  inputSchema: gymInputSchema,
  inbox: { batch: "single", maxConcurrent: 2 },
  route: routeGymRequest,
  subscriptions: [
    {
      id: "project-comment",
      event: { type: "project.comment.created", project: projectId },
      toInput(event) {
        return gymInput("owner-review", eventDetails(event));
      },
    },
    {
      id: "project-owner-request",
      event: { type: "project.owner.requested", project: projectId },
      toInput(event) {
        return gymInput("owner-review", eventDetails(event));
      },
    },
  ],

  schedules: [
    {
      id: "may-training-refill",
      enabled: mayCanary.automatic_schedule_enabled,
      intervalMs: 86_400_000,
      event: improvementRequested({
        reason: "curriculum-refill",
        curriculumDrain: true,
      }),
    },
    {
      id: "codex-learning-drain",
      enabled: true,
      intervalMs: 3_600_000,
      event: codexLearningRequested({
        reason: "continuous-source-drain",
        batchSize: 200,
        maxBatches: 5,
      }),
    },
    {
      id: "design-alignment-review-daily",
      enabled: true,
      intervalMs: 86_400_000,
      event: designAlignmentRequested({
        reason: "daily-design-alignment-review",
      }),
    },
  ],

  tasks: {
    attach: true,
    maxConcurrent: 2,
    subscriptions: [...gymTaskSubscriptions],
    resolve: resolveGymTask,
  },

  actions: {
    "improve-may-now": {
      description:
        "Run one bounded May improvement cycle against approved Gym evidence.",
      inputSchema: actionInputSchema,
      toInput(input) {
        return gymInput("improve-may", { reason: "manual", ...params(input) });
      },
    },
    "run-regression": {
      description:
        "Run May alignment regression now, optionally for one scenario.",
      inputSchema: actionInputSchema,
      toInput(input) {
        return gymInput("run-regression", input);
      },
    },
    "report-incident": {
      description:
        "Submit a concrete May failure or human correction for benchmark review.",
      inputSchema: actionInputSchema,
      toInput(input) {
        return gymInput("report-incident", {
          reason: "manual",
          ...params(input),
        });
      },
    },
    "collect-codex-learning": {
      description:
        "Collect a bounded batch of strong Hao preference and decision signals from Codex sessions.",
      inputSchema: actionInputSchema,
      toInput(input) {
        return gymInput("collect-codex-learning", {
          reason: "manual-backfill",
          batchSize: 200,
          maxBatches: 5,
          ...params(input),
        });
      },
    },
    "review-telegram-field": {
      description:
        "Ask Evaluation to review current May field behavior through its canonical evidence pipeline.",
      inputSchema: actionInputSchema,
      toInput(input) {
        return gymInput("review-telegram-field", {
          reason: "manual-field-review",
          ...params(input),
        });
      },
    },
  },
});
