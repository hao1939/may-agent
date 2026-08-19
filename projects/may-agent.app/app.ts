import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type TaskIntent,
} from "@may-agent/sdk";

const projectId = "may-agent";
const projectOwnerAgent = "may";
const detailsSchema = Type.Record(Type.String(), Type.Unknown());

export const OWNER_REVIEW_TASK_ID = "runtime/platform-owner-review";
export const PLATFORM_REVIEW_INTERVAL_MS = 28_800_000;
export const PLATFORM_METRIC_INTERVAL_MS = 300_000;
export const OWNER_HEARTBEAT_INTERVAL_MS = 86_400_000;

const platformInputSchema = Type.Union(
  ["owner-review"].map((kind) =>
    Type.Object(
      { kind: Type.Literal(kind), data: detailsSchema },
      { additionalProperties: false },
    ),
  ),
);

const deferredMetrics = new Set([
  "project.health.finding-count",
  "project.owner-incomplete-count",
  "project.owner-judgment-needed-count",
  "capability.zombie-session-count",
  "runtime.stale-running-session-count",
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
  return !owner || owner === projectOwnerAgent || owner === "may";
}

export function taskIntentForInput(input: AppInput): TaskIntent | null {
  switch (input.kind) {
    case "owner-review":
      return {
        id: OWNER_REVIEW_TASK_ID,
        parentId: "platform-system-review-feedback-loop",
        outcome:
          "Keep platform state reviewed by its accountable owner and organize the smallest useful follow-up from current evidence.",
        acceptance: [
          "The owner performs one useful platform step or records an evidence-backed no-op, with task-resource changes proposed as typed actions.",
        ],
        mode: "maintain",
        owner: projectOwnerAgent,
        input: { scope: "may-agent-platform" },
        priority: "P1",
      };
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
      return isPlatformMetric(event) && !deferredMetrics.has(metricId)
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

export function resolveMayAgentTask(
  event: AppEvent<Record<string, unknown>>,
): TaskIntent | null {
  const input = taskInputForEvent(event);
  return input ? taskIntentForInput(input) : null;
}

export function taskForMayAgentInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  const intent = taskIntentForInput(admitted.input) ?? {
    id: `input/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
    parentId: "platform-system-review-feedback-loop",
    outcome: `Interpret and handle admitted may-agent input ${admitted.input.kind}.`,
    acceptance: [
      "The accountable platform owner returns an evidence-backed result or revises the same task to the exact required platform outcome.",
    ],
    mode: "achieve" as const,
    owner: projectOwnerAgent,
    input: { kind: admitted.input.kind, data: record(admitted.input.data) },
    priority: "P1" as const,
  };
  return { kind: "desired", intent };
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
  owner: projectOwnerAgent,
  description:
    "May-agent platform App: runtime contracts, execution, persistence, SDK, UI, and App conventions.",
  inputSchema: platformInputSchema,
  inbox: { batch: "single", maxConcurrent: 2 },
  task: taskForMayAgentInput,
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
    "project.task.reconcile.started",
    "project.task.reconcile.skipped",
    "project.task.reconciled",
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
      id: "platform-metrics",
      intervalMs: PLATFORM_METRIC_INTERVAL_MS,
      event: scheduledEvent("trigger.metrics-snapshot", {
        reason: "scheduled-platform-measurement",
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
      description:
        "Ask May to review and advance the May-agent platform project.",
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
    resolve: resolveMayAgentTask,
    maxConcurrent: 2,
    resyncIntervalMs: 60_000,
  },
});

export default app;
