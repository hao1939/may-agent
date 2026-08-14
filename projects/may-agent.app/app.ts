import {
  Type,
  defineApp,
  type AppDisposition,
  type AppEvent,
  type AppInput,
  type AppRequest,
  type TaskIntent,
} from "@may-agent/sdk";

const projectId = "may-agent";
const projectOwnerAgent = "tech-lead";
const detailsSchema = Type.Record(Type.String(), Type.Unknown());

export const OWNER_REVIEW_TASK_ID = "runtime/platform-owner-review";
export const PLATFORM_REVIEW_INTERVAL_MS = 28_800_000;
export const OWNER_HEARTBEAT_INTERVAL_MS = 86_400_000;

const platformInputSchema = Type.Union(
  ["owner-review", "ops-health", "ops-digest", "resource-migration"].map(
    (kind) =>
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
    case "ops-digest":
      return {
        id: "runtime/daily-ops-digest",
        parentId: "ops-health",
        outcome:
          "Keep a current deterministic daily platform alert digest, notify the human, and request owner judgment only for actionable conditions.",
        acceptance: [
          "A current digest is recorded and delivered, with any actionable open, noisy, or ownerless condition routed to the platform owner.",
        ],
        mode: "maintain",
        workflow: "daily-ops-digest",
        priority: "P1",
      };
    case "ops-health":
      return {
        id: "runtime/ops-health-observer",
        parentId: "ops-health",
        outcome:
          "Keep a deterministic observation of platform operational health and request owner judgment only for meaningful signals.",
        acceptance: [
          "A current ops-health packet is recorded and meaningful signals produce one owner request without making owner judgments in the observer.",
        ],
        mode: "maintain",
        workflow: "ops-health-review",
        priority: "P1",
      };
    case "resource-migration":
      return {
        id: "runtime/unified-resource-migration-v1",
        parentId: "project",
        outcome:
          "Retire the fixed set of pre-contract May Agent task resources whose outcomes are now implemented or superseded.",
        acceptance: [
          "Only the named version-1 legacy resources are closed, dependent work before its dependency, and every closure leaves a completion receipt.",
          "The unresolved evidence-archive secret-redaction task remains live until its archive-wide guarantee is proven.",
        ],
        mode: "achieve",
        workflow: "unified-resource-migration",
        input: { migration: "unified-resource-v1" },
        priority: "P0",
      };
    case "owner-review":
      return {
        id: OWNER_REVIEW_TASK_ID,
        parentId: "platform-system-review-feedback-loop",
        outcome:
          "Keep platform state reviewed by its accountable owner and organize the smallest useful follow-up from current evidence.",
        acceptance: [
          "The owner performs one useful platform step or records an evidence-backed no-op, with task-tree changes proposed as typed actions.",
        ],
        mode: "maintain",
        workflow: "platform-owner-review",
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
    case "project.ops_digest.tick":
      return { kind: "ops-digest", data };
    case "project.ops_health.tick":
      return { kind: "ops-health", data };
    case "may-agent.resource-migration.requested":
      return { kind: "resource-migration", data };
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

export function routeMayAgentRequest(
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
  const intent = taskIntentForInput(request.input);
  return intent ? { type: "task", task: { kind: "desired", intent } } : null;
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
  route: routeMayAgentRequest,
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
    {
      id: "ops-health-review",
      intervalMs: 3_600_000,
      event: scheduledEvent("project.ops_health.tick", {
        lane: "ops-health-review",
      }),
    },
    {
      id: "daily-ops-digest",
      intervalMs: 86_400_000,
      event: scheduledEvent("project.ops_digest.tick", {
        lane: "daily-ops-digest",
      }),
    },
  ],
  actions: {
    "advance-project": {
      description:
        "Ask tech-lead to review and advance the May-agent platform project.",
      inputSchema: Type.Object({}, { additionalProperties: true }),
      toInput: (data) =>
        platformOwnerReview("manual-advance", { params: data }),
    },
  },
  tasks: {
    attach: true,
    subscriptions: [
      { type: "project.ops_digest.tick", project: projectId },
      { type: "project.ops_health.tick", project: projectId },
      { type: "may-agent.resource-migration.requested", project: projectId },
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
