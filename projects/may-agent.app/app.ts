import { createHash } from "node:crypto";
import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type Condition,
  type TaskIntent,
} from "@may-agent/sdk";

const projectId = "may-agent";
const hostOperationsAgent = "tech-lead";
const detailsSchema = Type.Record(Type.String(), Type.Unknown());
const nonEmptyString = Type.String({ minLength: 1 });
const stringList = Type.Array(nonEmptyString, { minItems: 1 });
const platformObligationDataSchema = Type.Object(
  {
    outcome: nonEmptyString,
    constraints: Type.Optional(stringList),
    acceptance: Type.Optional(stringList),
  },
  { additionalProperties: true },
);

export const OWNER_REVIEW_TASK_ID = "runtime/platform-owner-review";
export const OWNER_REVIEW_DELIVERY_ACCEPTANCE = [
  "Before sending any direct owner signal for recurring or previously attempted work, inspect the canonical delivery and remediation receipts and reuse the existing owner lineage when it already covers the obligation.",
  "The terminal result discloses every direct owner signal created during the review and explicitly records zero when none were created.",
] as const;
export const GROUPED_GOAL_ACCEPTANCE = [
  "Repeated timer, event, refill, owner-review, and reconciliation inputs attach to this retained goal; findings, checks, proposals, sessions, and work items remain request evidence or structured Task state rather than becoming Tasks merely because they are separate items.",
  "Create a separate Task only for an explicit independent goal key whose outcome, authority boundary, or external wait is genuinely independent; reuse that key for repeated inputs for the same goal.",
] as const;
export const PLATFORM_REVIEW_INTERVAL_MS = 28_800_000;
export const OWNER_HEARTBEAT_INTERVAL_MS = 86_400_000;

export function validateHostOperationsCondition(
  condition: Condition,
): string | null {
  const owner = condition.owner?.trim().replace(/^(?:app|agent):/, "");
  if (
    (owner === projectId || owner === hostOperationsAgent || owner === "may") &&
    condition.requestedAction?.trim()
  ) {
    return "cannot wait for unfinished work assigned back to Host Operations; perform or durably submit that work first";
  }
  return null;
}

export const platformInputSchema = Type.Union([
  Type.Object(
    { kind: Type.Literal("owner-review"), data: detailsSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("runtime-deployment.adjudicate-current-host-state"),
      data: Type.Intersect([
        platformObligationDataSchema,
        Type.Object({ currentEvidence: detailsSchema }),
      ]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("runtime-capability-request"),
      data: Type.Intersect([
        platformObligationDataSchema,
        Type.Object({ acceptance: stringList, evidence: stringList }),
      ]),
    },
    { additionalProperties: false },
  ),
]);

const deferredMetrics = new Set([
  "project.health.finding-count",
  "project.owner-incomplete-count",
  "project.agent-judgment-needed-count",
  "project.owner-judgment-needed-count",
  "capability.zombie-session-count",
  "runtime.stale-running-session-count",
]);

const platformRuntimeMetrics = new Set([
  "infra.bus.subscriber-failed-count-1h",
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeTaskIdPart(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "goal"
  );
}

function independentGoalTaskId(goalKey: string): string {
  const digest = createHash("sha256")
    .update(goalKey)
    .digest("hex")
    .slice(0, 16);
  return `goal/${safeTaskIdPart(goalKey)}-${digest}`;
}

function eventData(
  event: AppEvent<Record<string, unknown>>,
): Record<string, unknown> {
  return record(event.data);
}

function platformOwnerReview(
  reason: string,
  details: Record<string, unknown> = {},
): AppInput {
  return { kind: "owner-review", data: { reason, ...details } };
}

function isPlatformMetric(event: AppEvent<Record<string, unknown>>): boolean {
  const data = eventData(event);
  const owner = stringValue(
    event.owner ?? data.owner ?? event.target?.owner,
  ).replace(/^agent:/, "");
  return !owner || owner === hostOperationsAgent || owner === "may";
}

export function taskIntentForInput(input: AppInput): TaskIntent | null {
  switch (input.kind) {
    case "owner-review": {
      const data = record(input.data);
      const goalKey = stringValue(data.goalKey);
      const hasIndependentBoundary =
        data.independentGoal === true &&
        Boolean(
          stringValue(data.outcome) ||
          stringValue(data.authorityBoundary) ||
          stringValue(data.externalWait),
        );
      if (goalKey && hasIndependentBoundary) {
        const requestedAcceptance = Array.isArray(data.acceptance)
          ? data.acceptance.filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0,
            )
          : [];
        return {
          id: independentGoalTaskId(goalKey),
          parentId: "platform-system-review-feedback-loop",
          outcome:
            stringValue(data.outcome) ||
            `Complete the independent Host Operations goal ${goalKey}.`,
          acceptance: [
            ...(requestedAcceptance.length > 0
              ? requestedAcceptance
              : [
                  "Return a terminal, evidence-backed platform disposition through the supported control plane.",
                ]),
            ...OWNER_REVIEW_DELIVERY_ACCEPTANCE,
            ...GROUPED_GOAL_ACCEPTANCE,
          ],
          mode: "achieve",
          agent: hostOperationsAgent,
          input: { kind: input.kind, data: { ...data, goalKey } },
          priority: "P1",
        };
      }
      return {
        id: OWNER_REVIEW_TASK_ID,
        parentId: "platform-system-review-feedback-loop",
        outcome:
          "Keep platform state reviewed by its accountable owner and organize the smallest useful follow-up from current evidence.",
        acceptance: [
          "The owner performs one useful platform step or records an evidence-backed no-op, with task-resource changes proposed as typed actions.",
          ...OWNER_REVIEW_DELIVERY_ACCEPTANCE,
          ...GROUPED_GOAL_ACCEPTANCE,
        ],
        mode: "maintain",
        agent: hostOperationsAgent,
        input: { scope: "may-agent-platform" },
        priority: "P1",
      };
    }
    case "runtime-deployment.adjudicate-current-host-state":
    case "runtime-capability-request": {
      const data = record(input.data);
      return {
        id: "",
        parentId: "platform-system-review-feedback-loop",
        outcome: stringValue(data.outcome),
        acceptance: Array.isArray(data.acceptance)
          ? data.acceptance.filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0,
            )
          : [
              "Return a terminal, evidence-backed platform disposition through the supported control plane.",
            ],
        mode: "achieve",
        agent: hostOperationsAgent,
        input: { kind: input.kind, data },
        priority: "P1",
      };
    }
    default:
      return null;
  }
}

export function taskInputForEvent(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = eventData(event);
  switch (event.type) {
    case "project.tick":
      return platformOwnerReview("scheduled-project-review", data);
    case "project.tasks.ready":
      return platformOwnerReview("ready-tasks-available", data);
    case "metric.recovered":
      return null;
    case "metric.breach":
    case "metric.stalled": {
      const metricId = stringValue(
        data.metricId ?? data.metric_id ?? event.target?.metricId,
      );
      return (isPlatformMetric(event) ||
        platformRuntimeMetrics.has(metricId)) &&
        !deferredMetrics.has(metricId)
        ? platformOwnerReview("metric-signal", {
            metricId,
            metric: data,
          })
        : null;
    }
    default:
      return null;
  }
}

export function resolveHostOperationsTask(
  event: AppEvent<Record<string, unknown>>,
): TaskIntent | null {
  const input = taskInputForEvent(event);
  return input ? taskIntentForInput(input) : null;
}

export function taskForHostOperationsInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  const resolved = taskIntentForInput(admitted.input);
  if (!resolved) {
    throw new Error(
      `Unsupported Host Operations input kind: ${admitted.input.kind}`,
    );
  }
  const requestTaskId = `app-request/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
  return {
    kind: "desired",
    intent: resolved.id
      ? resolved
      : {
          ...resolved,
          id: requestTaskId,
        },
  };
}

function scheduledEvent(
  type: string,
  data: Record<string, unknown>,
): AppEvent<Record<string, unknown>> {
  return {
    type,
    data,
    target: { appId: projectId, project: projectId },
  };
}

const app = defineApp({
  id: projectId,
  version: 1,
  agent: hostOperationsAgent,
  description:
    "Maintains May: runtime contracts, execution, persistence, SDK, UI, and App conventions.",
  inputSchema: platformInputSchema,
  task: taskForHostOperationsInput,
  workspace: { kind: "local", localPath: "../may-agent" },
  subscriptions: [
    {
      id: "project-comment",
      event: { type: "project.comment.created", project: projectId },
      toInput(event) {
        return platformOwnerReview("project-comment", eventData(event));
      },
    },
    {
      id: "project-owner-request",
      event: { type: "project.owner.requested", project: projectId },
      toInput(event) {
        const data = eventData(event);
        return platformOwnerReview(
          stringValue(data.reason) || "project-owner-request",
          data,
        );
      },
    },
  ],
  observations: [
    "runtime.daemon.heartbeat",
    "metric.recovered",
    "handler.workflow_dispatched",
    "handler.skipped",
    "metric.feedback.routed",
    "metric.alert_judged",
    "project.task.handler.recovered",
    "project.task.handler.unavailable",
    "project.task.verification.failed",
    "guard.triggered",
    "skill.loaded",
  ],
  schedules: [
    {
      id: "platform-review",
      intervalMs: PLATFORM_REVIEW_INTERVAL_MS,
      event: scheduledEvent("project.tick", {
        reason: "scheduled-project-review",
        lane: "platform-review",
      }),
    },
    {
      id: "owner-heartbeat",
      intervalMs: OWNER_HEARTBEAT_INTERVAL_MS,
      event: scheduledEvent("project.tick", {
        reason: "owner-heartbeat",
        lane: "owner-heartbeat",
      }),
    },
  ],
  actions: {
    "advance-project": {
      description: "Request review and advancement of the May Host project.",
      inputSchema: Type.Object({}, { additionalProperties: true }),
      toInput: (data) =>
        platformOwnerReview("manual-advance", { params: data }),
    },
  },
  tasks: {
    subscriptions: [
      { type: "project.tick", project: projectId },
      { type: "project.tasks.ready", project: projectId },
      "metric.breach",
      "metric.stalled",
    ],
    resolve: resolveHostOperationsTask,
    validateCondition: validateHostOperationsCondition,
    maxConcurrent: 2,
  },
});

export default app;
