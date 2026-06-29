import { defineProjectApp, workflowHandlers } from "@may-agent/sdk";

const projectId = "aks-rp-e2e";
const projectPolicyMaxConcurrent = 80;
const appTaskContext =
  "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nsource: /app/sources/aks-rp";

const taskTreeContext = [
  "projects/aks-rp-e2e.app/project.json",
  "projects/aks-rp-e2e.app/tasks/tree.json",
  "projects/aks-rp-e2e.app/tasks/README.md",
  "sources/aks-rp/test/e2ev3/sigs/rp/virtualmachine/suites/prerelease.go",
  "sources/aks-rp/test/e2ev3/sigs/rp/virtualmachine/suites/checkin.go",
];

export default defineProjectApp({
  id: projectId,
  version: 1,
  description:
    "AKS RP e2e feature knowledge, spec verification, and owner-review app.",
  workspace: {
    kind: "git",
    repo: "git@github.com:hao1939/aks-rp-e2e.git",
    localPath: "../aks-rp-e2e",
    branch: "main",
  },

  budget: {
    sessionsPerDay: 200,
    tokensPerDay: 5_000_000,
    maxConcurrent: projectPolicyMaxConcurrent,
  },

  schedules: [
    {
      id: "regular-learning",
      enabled: true,
      intervalMs: 3_600_000,
      emits: [
        {
          type: "project.tick",
          target: { project: projectId },
          data: {
            project: projectId,
            lane: "learning",
          },
        },
      ],
    },
    {
      id: "project-execution-watchdog",
      enabled: true,
      intervalMs: 300_000,
      emits: [
        {
          type: "project.watchdog.tick",
          target: { project: projectId },
          data: { project: projectId },
        },
      ],
    },
    {
      id: "owner-heartbeat",
      enabled: true,
      intervalMs: 14_400_000,
      emits: [
        {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "owner-heartbeat",
            params: {
              maxConcurrent: projectPolicyMaxConcurrent,
              instruction:
                "Low-frequency owner heartbeat: look for missed project motion opportunities that fixed schedules and metrics did not catch. Check recent heartbeat/focus/watchdog findings before creating work. In aggressive-push mode, refill safe runnable work up to policy capacity, materialize grouped follow-up work for drained non-pass loops, record a finding/context update, request problem-solving, or no-op only with exact external-wait evidence. Do not run multi-step domain work from the owner session.",
              reviewChecklist: [
                "Check VM prerelease coverage, feature/spec/test gaps, and whether the current feature set can be planned with bun run plan --features ...",
                "Challenge stale source-holder, devbox, or authoritative-source blockers now that /app/sources/aks-rp is mounted.",
                "Look for stale blocked families, underfilled worker capacity, task-tree bloat needing owner rollup, and repeated owner-loop/planner failures.",
                "Avoid duplicate heartbeat tasks by inspecting recent heartbeat/focus/watchdog outputs first.",
                "No-op is valid when the task tree already has clear active/review/runnable work.",
              ],
            },
          },
        },
      ],
    },
    {
      id: "blocked-frontier-owner-review",
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
                "Periodic blocked-frontier owner review: re-examine blocked and dependency-waiting task leaves and push sampled blockers toward final state. Unblock or replace stale blockers whose resume condition is satisfied, create/link problem-solving work for local/tooling/environment root causes, mark proven terminal/product/environment dispositions done with evidence, convert true external waits into sent/escalated asks or precise response-await tasks, and assign unrelated runnable work so the project keeps moving.",
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
          type: "project.focus.plan.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "scheduled-mid-term-focus-plan",
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
          },
        },
      ],
    },
  ],

  onEvent: workflowHandlers([
    {
      name: "aks-rp-e2e-project-planner",
      type: "job",
      enabled: true,
      description:
        "Owner loop. Wakes the project owner, which updates tasks/tree.json and explicitly assigns worker tasks.",
      handler: {
        workflow: "project-planner",
        includeEvent: true,
        task: `${appTaskContext}\nmaxConcurrent: ${projectPolicyMaxConcurrent}`,
        timeoutMs: 3_600_000,
      },
      accepts: [
        { type: "project.owner.requested", target: { project: projectId } },
        { type: "project.planning.requested", target: { project: projectId } },
        { type: "project.comment.created", target: { project: projectId } },
        { type: "project.tick", target: { project: projectId } },
        { type: "project.action.invoked", target: { project: projectId } },
        {
          type: "project.focus.approval.submitted",
          target: { project: projectId },
        },
        { type: "project.task.completed", target: { project: projectId } },
        { type: "project.problem.resolved", target: { project: projectId } },
        { type: "project.problem.escalated", target: { project: projectId } },
        { type: "project.problem.unknown", target: { project: projectId } },
        { type: "task.requeued", target: { project: projectId } },
        { type: "escalation.resolved", owner: "agent:aks-explorer" },
        { type: "escalation.dismissed", owner: "agent:aks-explorer" },
        { type: "metric.breach", owner: "agent:aks-explorer" },
        { type: "metric.recovered", owner: "agent:aks-explorer" },
        { type: "coverage.gap.detected", target: { project: projectId } },
      ],
      emits: ["project.task.assigned"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-task-execution-worker",
      type: "job",
      enabled: true,
      description:
        "Worker execution. Executes one task assigned by the project owner and emits task completion.",
      maxConcurrentTriggers: projectPolicyMaxConcurrent,
      handler: {
        workflow: "task-worker",
        includeEvent: true,
        task: `${appTaskContext}\nmaxAttempts: 1\nmaxConcurrent: ${projectPolicyMaxConcurrent}`,
        timeoutMs: 3_600_000,
      },
      accepts: [
        { type: "project.task.assigned", target: { project: projectId } },
      ],
      emits: [
        "project.task.completed",
        "project.spec-loop.tick",
        "project.feature-reference-loop.tick",
        "project.feature-compact-loop.tick",
      ],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-problem-solver",
      type: "job",
      enabled: true,
      description:
        "Focused problem resolver. Investigates blocked/failed work, fixes local causes when possible, and emits problem resolved/escalated for owner reconciliation.",
      maxConcurrentTriggers: 2,
      handler: {
        workflow: "problem-solver",
        includeEvent: true,
        task: `${appTaskContext}\nmaxAttempts: 1`,
        timeoutMs: 1_800_000,
      },
      accepts: [
        { type: "project.problem.requested", target: { project: projectId } },
      ],
      emits: [
        "project.problem.resolved",
        "project.problem.escalated",
        "project.problem.unknown",
      ],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-project-watchdog",
      type: "job",
      enabled: true,
      description:
        "Five-minute liveness guard. Observes task/session state and wakes the owner when review is needed.",
      accepts: [
        { type: "project.watchdog.tick", target: { project: projectId } },
      ],
      handler: {
        workflow: "project-execution-watchdog",
        task: `${appTaskContext}\nmaxAttempts: 2\nmaxConcurrent: ${projectPolicyMaxConcurrent}`,
        timeoutMs: 1_800_000,
      },
      emits: ["project.owner.requested"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-spec-loop-controller",
      type: "job",
      enabled: true,
      description:
        "Deterministic task controller. Pulses long-lived spec verification loop tasks and keeps their bounded child frontier filled.",
      maxConcurrentTriggers: 1,
      handler: {
        workflow: "spec-loop-controller",
        includeEvent: true,
        task: `${appTaskContext}\nmaxConcurrent: ${projectPolicyMaxConcurrent}`,
        timeoutMs: 600_000,
      },
      accepts: [
        { type: "project.spec-loop.tick", target: { project: projectId } },
      ],
      emits: ["project.task.assigned"],
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e/.github/workflows/feature-sets/dev-infra-core.txt",
        "projects/aks-rp-e2e/features/",
        "projects/aks-rp-e2e/design/specs/README.md",
      ],
    },
    {
      name: "aks-rp-e2e-feature-reference-loop-controller",
      type: "job",
      enabled: true,
      description:
        "Deterministic task controller. Pulses long-lived feature reference loop tasks and keeps their bounded child frontier filled.",
      maxConcurrentTriggers: 1,
      handler: {
        workflow: "feature-reference-loop-controller",
        includeEvent: true,
        task: `${appTaskContext}\nmaxConcurrent: 30`,
        timeoutMs: 600_000,
      },
      accepts: [
        {
          type: "project.feature-reference-loop.tick",
          target: { project: projectId },
        },
      ],
      emits: ["project.task.assigned"],
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e/features/README.md",
        "projects/aks-rp-e2e/features/SCHEMA.md",
        "projects/aks-rp-e2e/features/",
      ],
    },
    {
      name: "aks-rp-e2e-feature-compact-loop-controller",
      type: "job",
      enabled: true,
      description:
        "Deterministic task controller. Pulses long-lived feature compact loop tasks and keeps their bounded child frontier filled.",
      maxConcurrentTriggers: 1,
      handler: {
        workflow: "feature-compact-loop-controller",
        includeEvent: true,
        task: `${appTaskContext}\nmaxConcurrent: 20`,
        timeoutMs: 600_000,
      },
      accepts: [
        {
          type: "project.feature-compact-loop.tick",
          target: { project: projectId },
        },
      ],
      emits: ["project.task.assigned"],
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e/design/feature-compact-loop.md",
        "projects/aks-rp-e2e/features/",
        "projects/aks-rp-e2e/runner/feature-compact.ts",
      ],
    },
    {
      name: "aks-rp-e2e-focus-plan",
      type: "job",
      enabled: true,
      description:
        "Mid-term focus review and progress review. Keeps a visible focus branch current and asks for human approval when direction/risk changes.",
      maxConcurrentTriggers: 1,
      handler: {
        workflow: "focus-plan",
        includeEvent: true,
        task: `${appTaskContext}\nagent: aks-explorer\nmaxConcurrent: 5`,
        timeoutMs: 1_800_000,
      },
      accepts: [
        {
          type: "project.focus.plan.requested",
          target: { project: projectId },
        },
        {
          type: "project.focus.review.requested",
          target: { project: projectId },
        },
      ],
      emits: ["project.owner.requested", "message.created"],
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e.app/project.json",
        "projects/aks-rp-e2e/README.md",
      ],
    },
    {
      name: "aks-rp-e2e-approval-dispatch",
      type: "job",
      enabled: true,
      description:
        "Dispatches one packet-linked human-facing approval message using the proven message.created path.",
      maxConcurrentTriggers: 1,
      handler: {
        workflow: "approval-dispatch",
        includeEvent: true,
        task: `${appTaskContext}\nagent: aks-explorer\nmaxAttempts: 1`,
        timeoutMs: 600_000,
      },
      accepts: [
        {
          type: "project.approval.dispatch.requested",
          target: { project: projectId },
        },
        {
          type: "project.approval.dispatch.submitted",
          target: { project: projectId },
        },
      ],
      emits: ["message.created"],
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e.app/project.json",
        "projects/aks-rp-e2e/runs/test-results/",
      ],
    },
  ]),

  eventGraph: {
    externalEvents: ["message.created", "escalation.created"],
    intentionalCycles: [
      {
        id: "owner-worker-review-loop",
        events: [
          "project.owner.requested",
          "project.task.assigned",
          "project.task.completed",
          "project.spec-loop.tick",
          "project.feature-reference-loop.tick",
          "project.feature-compact-loop.tick",
          "project.problem.requested",
          "project.problem.resolved",
          "project.problem.escalated",
          "project.problem.unknown",
          "project.focus.plan.requested",
          "project.focus.review.requested",
        ],
        reason:
          "This is the project control loop. The owner is the state-machine boundary and must review worker/problem-solver/focus-plan output before assigning more work.",
      },
    ],
    limits: {
      maxHandlersPerEvent: 1,
    },
  },

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
      description: "Start or resume owner review through the task tree.",
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
    "request-focus-plan": {
      type: "async",
      description:
        "Ask the project owner to propose or refresh the next mid-term focus plan.",
      event(params) {
        return {
          type: "project.focus.plan.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-focus-plan-request",
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
          type: "project.approval.dispatch.requested",
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
        "Ask the project owner to review whether the current focus plan is on track.",
      event(params) {
        return {
          type: "project.focus.review.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "manual-focus-progress-review",
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
            : "aks-spec-verification-loop";
        return {
          type: "project.spec-loop.tick",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            taskId,
            task_id: taskId,
            reason: "manual-spec-loop-pulse",
            params: input,
          },
        };
      },
    },
    "pulse-feature-reference-loop": {
      type: "async",
      description:
        "Pulse the targeted long-lived feature reference loop task controller.",
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        const taskId =
          typeof input.taskId === "string" && input.taskId.trim()
            ? input.taskId.trim()
            : "aks-feature-reference-loop";
        return {
          type: "project.feature-reference-loop.tick",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            taskId,
            task_id: taskId,
            reason: "manual-feature-reference-loop-pulse",
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
            : "aks-feature-compact-loop";
        return {
          type: "project.feature-compact-loop.tick",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
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
