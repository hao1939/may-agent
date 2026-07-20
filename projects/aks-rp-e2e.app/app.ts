import { createHash } from "node:crypto";
import {
  defineProjectApp,
  eventDetails,
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

type AppTaskEvent = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function targetTaskId(event: AppTaskEvent): string {
  const details = eventDetails(event);
  const direct = details.taskId ?? details.task_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const target = isRecord(details.target) ? details.target : {};
  const targetTask = target.taskId ?? target.task_id;
  return typeof targetTask === "string" && targetTask.trim()
    ? targetTask.trim()
    : "";
}

function stringDetail(
  details: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function safeTaskIdPart(value: string, fallback: string): string {
  const raw = value.trim();
  if (!raw) return fallback;
  const normalized = raw
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized === raw && normalized.length <= 96) return normalized;
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  return `${normalized.slice(0, 83) || fallback}-${digest}`;
}

const projectTarget = { project: projectId };
const ownerReviewEventTypes = new Set([
  "project.owner.requested",
  "project.comment.created",
  "project.approval.submitted",
  "project.test_run.completed",
  "project.stall.reviewed",
  "project.problem.resolved",
  "project.problem.escalated",
  "project.problem.inconclusive",
  "coverage.gap.detected",
  "escalation.resolved",
  "escalation.dismissed",
  "metric.breach",
  "metric.recovered",
  "learning.feedback",
]);

const aksTaskSelectors: EventSelector[] = [
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
  {
    type: "project.problem.investigation.requested",
    target: projectTarget,
  },
  { type: "project.stall.review.requested", target: projectTarget },
  { type: "project.focus.review.requested", target: projectTarget },
  { type: "project.approval.requested", target: projectTarget },
];

export function resolveAksTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  if (
    !aksTaskSelectors.some((selector) => matchesEventSelector(selector, event))
  )
    return null;

  const details = eventDetails(event);
  const taskId = targetTaskId(event);
  const input = { ...details, targetTaskId: taskId || null };

  if (ownerReviewEventTypes.has(String(event.type ?? ""))) {
    return {
      id: "runtime/owner-review",
      parentId: "project",
      outcome:
        "Keep the AKS project reviewed by its accountable owner and organize the smallest useful next step from current evidence.",
      acceptance: [
        "The owner performs one useful project step or returns an evidence-backed no-op with typed follow-up actions.",
      ],
      mode: "maintain",
      owner: "app-ops",
      input,
      priority: "P1",
    };
  }

  switch (event.type) {
    case "project.problem.investigation.requested": {
      const problemKey = stringDetail(
        details,
        "problemKey",
        "problem_key",
        "taskId",
        "task_id",
      );
      return {
        id: `runtime/problem-solver/${safeTaskIdPart(problemKey, "project")}`,
        parentId: taskId || "project",
        outcome:
          "Investigate one bounded AKS project blocker and return a verified resolution, exact escalation, or explicit inconclusive result.",
        acceptance: [
          "The investigation reports its root cause, action, verification, and the exact owner next step without taking task-tree scheduling authority.",
        ],
        mode: "achieve",
        owner: "app-ops",
        workflow: "problem-solver",
        input,
        priority: "P1",
      };
    }
    case "project.stall.review.requested":
      return {
        id: "runtime/project-stall-review",
        parentId: "project",
        outcome:
          "Keep suspicious stalled AKS work reviewed against current task, loop, and external-state evidence.",
        acceptance: [
          "The review applies only safe mechanical repair and returns a structured judgment, evidence, and exact follow-up.",
        ],
        mode: "maintain",
        owner: "app-ops",
        workflow: "project-stall-review",
        input,
        priority: "P0",
      };
    case "project.focus.review.requested": {
      const focusKey = stringDetail(
        details,
        "focusId",
        "focus_id",
        "planId",
        "plan_id",
        "taskId",
        "task_id",
        "mode",
      );
      return {
        id: `runtime/focus-review/${safeTaskIdPart(focusKey, "current")}`,
        parentId: taskId || "project",
        outcome:
          "Keep one named AKS focus plan or progress review aligned with the current live frontier.",
        acceptance: [
          "The review proposes or assesses a focus plan from current task and execution evidence without using the task graph as a scheduler.",
        ],
        mode: "maintain",
        owner: "app-ops",
        workflow: "focus-plan",
        input,
        priority: "P1",
      };
    }
    case "project.approval.requested": {
      const approvalKey = stringDetail(
        details,
        "approvalId",
        "approval_id",
        "pathId",
        "path_id",
        "packetPath",
        "packet_path",
        "taskId",
        "task_id",
      );
      return {
        id: `runtime/approval-dispatch/${safeTaskIdPart(approvalKey, "pending")}`,
        parentId: taskId || "project",
        outcome:
          "Deliver one exact AKS approval packet through the human-facing approval path.",
        acceptance: [
          "A valid packet is delivered once for its semantic correlation key, or missing/invalid input is reported with evidence.",
        ],
        mode: "achieve",
        owner: "app-ops",
        workflow: "approval-dispatch",
        input,
        priority: "P1",
      };
    }
    default:
      return null;
  }
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
    accepts: aksTaskSelectors,
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
