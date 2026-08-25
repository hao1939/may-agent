import { createHash } from "node:crypto";
import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type EventSelector,
  type TaskIntent,
} from "@may-agent/sdk";
import mayAlignmentCanary from "./config/may-alignment-canary.json";

const projectId = "gym";
const actionInputSchema = Type.Object({}, { additionalProperties: true });

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
    curriculumDrain: true,
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
  const metric = String(
    details.metricId ?? details.metric_id ?? details.id ?? details.name ?? "",
  )
    .trim()
    .toLowerCase();
  return metric.startsWith("may.") || metric.startsWith("agent.may.");
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

function gymOwnerReviewIntent(input: AppInput, requestId: string): TaskIntent {
  const readableRequestId = requestId
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  const requestDigest = createHash("sha256")
    .update(requestId)
    .digest("hex")
    .slice(0, 16);
  return {
    id: `owner-review/${readableRequestId || "request"}-${requestDigest}`,
    parentId: "review-proposals",
    outcome:
      "Review one request for the Gym project and organize the smallest useful next step from its exact admitted evidence.",
    acceptance: [
      "Interpret the exact requested outcome before selecting work; a free-form comment is intent, not an instruction to run the normal May campaign.",
      "Answer, record an evidence-backed no-op, or propose bounded durable follow-up without changing benchmark truth.",
      "Keep task ids, owners, workflows, and wake paths inside Gym; the caller receives the owner disposition and follows any resulting work to terminal proof.",
    ],
    mode: "achieve",
    agent: "gym",
    input: {
      requestId,
      admittedInput: input,
    },
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
          "Keep observable May behavior, Gym benchmark truth, and the accepted deputy-learning curriculum aligned.",
        acceptance: [
          "Establish the latest accepted May behavior, benchmark truth, and curriculum before comparing them with observed sessions and current Gym evidence.",
          "Mark each behavioral promise aligned, drifted, or inconclusive with exact evidence; never turn missing live proof into an aligned result.",
          "An aligned review records a quiet evidence-backed no-op; speculation is discarded.",
          "For at most three real gaps, propose the smallest benchmark, curriculum, or May-behavior repair and its proof or approval boundary.",
          "Runtime, Host, scheduling, and delivery defects are reported to their owning App instead of being repaired by Gym.",
          "The review never changes benchmark truth or production May without exact artifact approval.",
        ],
        mode: "maintain",
        agent: "gym",
        priority: "P2",
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
      const executionRequestId = String(
        details.executionRequestId ?? requestId,
      ).trim();
      if (!executionRequestId) return null;
      const comparisonShaped = [
        "outcome",
        "scope",
        "acceptanceProof",
        "baseline",
        "candidate",
        "comparisonArtifact",
        "requiredProof",
        "sampleScope",
      ].some((key) => Object.hasOwn(details, key));
      return {
        id: taskIdentity("regression-run", executionRequestId),
        parentId: "regression-assurance",
        outcome: comparisonShaped
          ? "Compare the exact requested frozen baseline and candidate without substituting a standalone benchmark."
          : "Run the requested standalone Gym benchmark and preserve its result or operational failure for review.",
        acceptance: comparisonShaped
          ? [
              "The complete comparison envelope remains correlated by request id through a content-hashed terminal approve, reject, or hold artifact.",
              "Malformed or incomplete comparison input fails closed before any standalone benchmark process is launched.",
            ]
          : [
              "The requested benchmark produces a durable outcome pointer and any review-worthy result emits one review request.",
            ],
        mode: "achieve",
        workflow: "regression-run",
        input: selected(details, [
          "acceptanceProof",
          "agent",
          "baseline",
          "benchmark",
          "candidate",
          "constraints",
          "executionRequestId",
          "outcome",
          "reason",
          "requestId",
          "reviewAndFailureBranch",
          "requiredProof",
          "returnPath",
          "sampleScope",
          "scenario",
          "scope",
          "trials",
        ]),
        outputs: comparisonShaped
          ? [".state/proofs", ".state/runs"]
          : [".state/runs", ".state/failures"],
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

function gymTaskIntentForInput(
  input: AppInput,
  requestId: string,
): TaskIntent | null {
  const supplied = params(input.data);
  const comparisonShaped = [
    "outcome",
    "scope",
    "acceptanceProof",
    "baseline",
    "candidate",
    "comparisonArtifact",
    "requiredProof",
    "sampleScope",
  ].some((key) => Object.hasOwn(supplied, key));
  const sourceRequestId = String(supplied.requestId ?? "").trim();
  const data =
    input.kind === "run-regression" && comparisonShaped
      ? {
          ...supplied,
          requestId: sourceRequestId,
          executionRequestId: requestId,
        }
      : { ...supplied, requestId };
  switch (input.kind) {
    case "owner-review":
      return gymOwnerReviewIntent(input, requestId);
    case "improve-may":
      return mayImprovementIntent();
    case "run-regression":
      return resolveGymTask(gymEvent("gym.regression.requested", data));
    case "report-incident":
      return resolveGymTask(gymEvent("gym.incident.detected", data));
    case "collect-codex-learning":
      return resolveGymTask(gymEvent("gym.codex.learning.requested", data));
    case "review-telegram-field":
      return {
        id: `input/${requestId.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
        parentId: "regression-assurance",
        outcome:
          "Obtain an independent Evaluation review of the requested Telegram field evidence, consider its result, and answer the caller.",
        acceptance: [
          "The evaluation App result is present in the task event evidence.",
          "The accepted result explains the finding and includes a caller-facing response.",
        ],
        mode: "achieve",
        agent: "gym",
        input: {
          ...data,
          dependency: {
            id: "evaluation-review",
            appId: "evaluation",
            input: {
              kind: "deep-scan",
              data: {
                reason: "gym-telegram-field-review",
                requestedBy: "gym",
                ...params(input.data),
              },
            },
          },
        },
        priority: "P1",
      };
    default:
      return null;
  }
}

export function taskForGymInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  const intent = gymTaskIntentForInput(admitted.input, admitted.id) ?? {
    id: `input/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
    parentId: "gym-system",
    outcome: `Interpret and handle admitted Gym input ${admitted.input.kind}.`,
    acceptance: ["The Gym owner returns an evidence-backed accepted result."],
    mode: "achieve" as const,
    agent: "gym",
    input: { kind: admitted.input.kind, data: params(admitted.input.data) },
    priority: "P1" as const,
  };
  return { kind: "desired", intent };
}

const gymTaskSubscriptions: EventSelector[] = [
  "evaluation.recorded",
  "gym.incident.detected",
  "gym.learning.evidence.observed",
  "gym.codex.learning.requested",
  "gym.design-alignment.requested",
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
  agent: "gym",
  description:
    "Owns May behavior learning, reviewed benchmark truth, evaluation, and evidence-gated improvement.",
  workspace: {
    kind: "local",
    localPath: "../gym",
  },
  inputSchema: gymInputSchema,
  task: taskForGymInput,
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
      enabled: mayAlignmentCanary.automatic_schedule_enabled,
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
