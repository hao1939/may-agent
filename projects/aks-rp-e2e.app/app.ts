import { createHash } from "node:crypto";
import {
  defineProjectApp,
  matchesEventSelector,
  type EventSelector,
  type ProjectAppContext,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";
import { observeAksPipelines } from "./watchers/aks-pipeline.js";

const projectId = "aks-rp-e2e";
const projectPolicyMaxConcurrent = 80;
const specLoopTaskId = "aks-spec-verification-loop";
const featureCompactLoopTaskId = "aks-feature-compact-loop";

type AppRouteEvent = Record<string, unknown>;

function isRouteRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stableRoutePart(value: string, fallback: string): string {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9._/-]+/g, "-")
      .replace(/^[-/]+|[-/]+$/g, "")
      .slice(0, 96) || fallback
  );
}

function routeDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function routeEventType(event: AppRouteEvent): string {
  return typeof event.type === "string" && event.type.trim()
    ? event.type.trim()
    : "event";
}

function routeEventId(event: AppRouteEvent): string {
  for (const key of ["eventId", "event_id", "id"]) {
    const value = event[key];
    if (typeof value === "string" && value.trim())
      return stableRoutePart(value, "event");
    if (typeof value === "number" && Number.isInteger(value) && value > 0)
      return String(value);
  }
  return routeDigest(JSON.stringify(event));
}

function routeTargetTaskId(event: AppRouteEvent): string {
  const direct = event.taskId ?? event.task_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const target = isRouteRecord(event.target) ? event.target : {};
  const targetTask = target.taskId ?? target.task_id;
  return typeof targetTask === "string" && targetTask.trim()
    ? targetTask.trim()
    : "";
}

function routeAction(event: AppRouteEvent): string {
  return typeof event.action === "string" && event.action.trim()
    ? event.action.trim()
    : "";
}

function routeTaskIntent(
  routeName: string,
  event: AppRouteEvent,
  workflow?: string,
): ProjectAppTaskIntent {
  const eventType = routeEventType(event);
  const eventId = routeEventId(event);
  const targetTaskId = routeTargetTaskId(event);
  const action = routeAction(event);
  const routePart = stableRoutePart(routeName, "route");
  const subjectPart = stableRoutePart(
    targetTaskId || action || eventType,
    "event",
  );
  return {
    id: `route/${routePart}/${subjectPart}/${eventId}`,
    parentId: targetTaskId || "project",
    outcome: `Process ${eventType} through ${routeName}.`,
    acceptance: [
      "The matched event is handed to the declared project workflow exactly once for this event id.",
      "The workflow returns structured state, evidence, follow-up actions, an exact wait, or owner attention.",
    ],
    mode: "achieve",
    ...(workflow ? { workflow } : {}),
    ...(workflow ? { owner: "app-ops" } : {}),
    input: {
      eventType,
      eventId,
      targetTaskId: targetTaskId || null,
      action: action || null,
    },
    priority:
      routeName.includes("watchdog") || routeName.includes("stall")
        ? "P0"
        : "P1",
  };
}

const projectTarget = { project: projectId };
const aksTaskRules: Array<{
  name: string;
  workflow?: string;
  accepts: EventSelector[];
}> = [
  {
    name: "owner",
    accepts: [
      { type: "project.owner.requested", target: projectTarget },
      { type: "project.comment.created", target: projectTarget },
      { type: "project.approval.submitted", target: projectTarget },
      { type: "project.test_run.completed", target: projectTarget },
      { type: "project.stall.reviewed", target: projectTarget },
      { type: "project.problem.resolved", target: projectTarget },
      { type: "project.problem.escalated", target: projectTarget },
      { type: "project.problem.inconclusive", target: projectTarget },
      { type: "coverage.gap.detected", target: projectTarget },
      { type: "escalation.resolved", owner: "agent:aks-explorer" },
      { type: "escalation.dismissed", owner: "agent:aks-explorer" },
      { type: "metric.breach", owner: "agent:app-ops" },
      { type: "metric.recovered", owner: "agent:app-ops" },
      { type: "learning.feedback", owner: "agent:aks-explorer" },
      { type: "learning.feedback", owner: "agent:aks-reviewer" },
    ],
  },
  {
    name: "problem-solver",
    workflow: "problem-solver",
    accepts: [
      {
        type: "project.problem.investigation.requested",
        target: projectTarget,
      },
    ],
  },
  {
    name: "project-stall-review",
    workflow: "project-stall-review",
    accepts: [
      { type: "project.stall.review.requested", target: projectTarget },
    ],
  },
  {
    name: "focus-plan",
    workflow: "focus-plan",
    accepts: [
      { type: "project.focus.review.requested", target: projectTarget },
    ],
  },
  {
    name: "approval-dispatch",
    workflow: "approval-dispatch",
    accepts: [{ type: "project.approval.requested", target: projectTarget }],
  },
];

export function resolveAksTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  const rule = aksTaskRules.find((candidate) =>
    candidate.accepts.some((selector) => matchesEventSelector(selector, event)),
  );
  return rule ? routeTaskIntent(rule.name, event, rule.workflow) : null;
}

export async function routeAksEvent(
  ctx: ProjectAppContext,
  event: Record<string, unknown>,
): Promise<unknown> {
  return event.type === "aks.pipeline.check"
    ? observeAksPipelines(ctx)
    : undefined;
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  owner: "app-ops",
  description:
    "Event-driven AKS RP e2e feature knowledge, spec verification, and app-ops organizer.",
  workspace: {
    kind: "git",
    repo: "https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner",
    localPath: "../aks-rp-e2e",
    branch: "dev",
  },

  budget: {
    sessionsPerDay: 200,
    tokensPerDay: 5_000_000,
    maxConcurrent: projectPolicyMaxConcurrent,
  },

  schedules: [
    {
      id: "pipeline-observer",
      enabled: true,
      intervalMs: 300_000,
      emits: [
        {
          type: "aks.pipeline.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "regular-learning",
      enabled: true,
      intervalMs: 3_600_000,
      emits: [
        {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "scheduled-learning",
            params: {
              lane: "learning",
              maxConcurrent: projectPolicyMaxConcurrent,
            },
          },
        },
      ],
    },
    {
      id: "durable-loop-pulse",
      enabled: true,
      intervalMs: 600_000,
      emits: [
        {
          type: "project.task.tick",
          target: { project: projectId, taskId: specLoopTaskId },
          action: "spec-loop",
          data: {
            project: projectId,
            reason: "scheduled-durable-loop-pulse",
          },
        },
        {
          type: "project.task.tick",
          target: { project: projectId, taskId: featureCompactLoopTaskId },
          action: "feature-compact-loop",
          data: {
            project: projectId,
            reason: "scheduled-durable-loop-pulse",
          },
        },
      ],
    },
    {
      id: "app-ops-heartbeat",
      enabled: true,
      intervalMs: 14_400_000,
      emits: [
        {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "app-ops-heartbeat",
            params: {
              maxConcurrent: projectPolicyMaxConcurrent,
              instruction:
                "Low-frequency app-ops heartbeat: look for missed project motion opportunities that fixed schedules and metrics did not catch. Check recent heartbeat/focus/watchdog findings before creating work. In aggressive-push mode, refill safe runnable work up to policy capacity, materialize grouped follow-up work for drained non-pass loops, record a finding/context update, request problem-solving, or no-op only with exact external-wait evidence. Do not run multi-step domain work from the app-ops session.",
              reviewChecklist: [
                "Check VM prerelease coverage, feature/spec/test gaps, and whether the current feature set can be planned with bun run plan --features ...",
                "Challenge stale source-holder, devbox, or authoritative-source blockers now that /app/sources/aks-rp is mounted.",
                "Look for stale blocked families, underfilled worker capacity, task-tree bloat needing app-ops rollup, and repeated app-ops/planner failures.",
                "Avoid duplicate heartbeat tasks by inspecting recent heartbeat/focus/watchdog outputs first.",
                "No-op is valid when the task tree already has clear active/review/runnable work.",
              ],
            },
          },
        },
      ],
    },
    {
      id: "blocked-frontier-app-ops-review",
      enabled: true,
      intervalMs: 7_200_000,
      emits: [
        {
          type: "project.owner.requested",
          target: { project: projectId },
          urgency: "high",
          data: {
            project: projectId,
            reason: "scheduled-blocked-frontier-review",
            params: {
              maxConcurrent: projectPolicyMaxConcurrent,
              instruction:
                "Periodic blocked-frontier app-ops review: re-examine blocked and dependency-waiting task leaves and push sampled blockers toward final state. Unblock or replace stale blockers whose resume condition is satisfied, create/link problem-solving work for local/tooling/environment root causes, mark proven terminal/product/environment dispositions done with evidence, convert true external waits into sent/escalated asks or precise response-await tasks, and dispatch unrelated runnable work so the project keeps moving.",
              reviewChecklist: [
                "Do not treat blocked as final.",
                "Do not retry a blocked leaf unchanged.",
                "Do not assign blocked work back to the same worker without a changed condition or a new bounded task.",
                "Prefer one shared problem/unblock task for a shared root cause.",
                "Every sampled blocked task should leave review with a path toward closure: solved, reworked, escalated/sent, terminal-done, or a precise response-await with next review trigger.",
              ],
            },
          },
        },
      ],
    },
    {
      id: "focus-plan-proposal",
      enabled: true,
      intervalMs: 86_400_000,
      emits: [
        {
          type: "project.focus.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "scheduled-mid-term-focus-plan",
            mode: "plan",
          },
        },
      ],
    },
    {
      id: "focus-progress-review",
      enabled: true,
      intervalMs: 21_600_000,
      emits: [
        {
          type: "project.focus.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "scheduled-focus-progress-review",
            mode: "progress",
          },
        },
      ],
    },
  ],

  tasks: {
    accepts: aksTaskRules.flatMap((rule) => rule.accepts),
    resolve: resolveAksTask,
  },

  events: [{ type: "aks.pipeline.check", target: projectTarget }],
  onEvent: routeAksEvent,

  actions: {
    "execute-run": {
      type: "async",
      description: "Request live execution for selected replanned paths.",
      event(params) {
        return {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "execute-run-action",
            params: {
              maxConcurrent: projectPolicyMaxConcurrent,
              action: "execute-run",
              params,
            },
          },
        };
      },
    },
    "advance-project": {
      type: "async",
      description:
        "Advance the project task tree until genuinely blocked, complete, or interrupted by an infra guard.",
      event(params) {
        const input =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-action",
            params: {
              maxConcurrent: projectPolicyMaxConcurrent,
              ...input,
            },
          },
        };
      },
    },
    watch: {
      type: "async",
      description: "Start or resume app-ops review through the task tree.",
      event(params) {
        const input =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "watch-request",
            params: {
              maxConcurrent: projectPolicyMaxConcurrent,
              ...input,
            },
          },
        };
      },
    },
    "investigate-problem": {
      type: "async",
      description:
        "Ask the problem solver to investigate one bounded blocker or root cause.",
      event(params) {
        const input =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.problem.investigation.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-problem-investigation-request",
            params: input,
          },
        };
      },
    },
    "review-stall-risk": {
      type: "async",
      description:
        "Ask the app-ops deep-dive fallback to collect and judge suspicious stalled work without pulsing controllers.",
      event(params) {
        const input =
          params && typeof params === "object" && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.stall.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-stall-risk-review",
            mode: "risk-review",
            params: input,
          },
        };
      },
    },
    "request-focus-plan": {
      type: "async",
      description:
        "Ask app-ops to propose or refresh the next mid-term focus plan.",
      event(params) {
        return {
          type: "project.focus.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-focus-plan-request",
            mode: "plan",
            params:
              params && typeof params === "object" && !Array.isArray(params)
                ? params
                : {},
          },
        };
      },
    },
    "dispatch-approval-packet": {
      type: "async",
      description:
        "Create one packet-linked human-facing approval message record using the proven message.created path.",
      event(params) {
        return {
          type: "project.approval.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-approval-packet-dispatch-request",
            params:
              params && typeof params === "object" && !Array.isArray(params)
                ? params
                : {},
          },
        };
      },
    },
    "review-focus-progress": {
      type: "async",
      description:
        "Ask app-ops to review whether the current focus plan is on track.",
      event(params) {
        return {
          type: "project.focus.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-focus-progress-review",
            mode: "progress",
            params:
              params && typeof params === "object" && !Array.isArray(params)
                ? params
                : {},
          },
        };
      },
    },
    "pulse-spec-loop": {
      type: "async",
      description:
        "Pulse the targeted long-lived spec verification loop task controller.",
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        const taskId =
          typeof input.taskId === "string" && input.taskId.trim()
            ? input.taskId.trim()
            : specLoopTaskId;
        return {
          type: "project.task.tick",
          action: "spec-loop",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            action: "spec-loop",
            taskId,
            task_id: taskId,
            reason: "manual-spec-loop-pulse",
            params: input,
          },
        };
      },
    },
    "pulse-feature-compact-loop": {
      type: "async",
      description:
        "Pulse the targeted long-lived feature compact loop task controller.",
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        const taskId =
          typeof input.taskId === "string" && input.taskId.trim()
            ? input.taskId.trim()
            : featureCompactLoopTaskId;
        return {
          type: "project.task.tick",
          action: "feature-compact-loop",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            action: "feature-compact-loop",
            taskId,
            task_id: taskId,
            reason: "manual-feature-compact-loop-pulse",
            params: input,
          },
        };
      },
    },
  },
});
