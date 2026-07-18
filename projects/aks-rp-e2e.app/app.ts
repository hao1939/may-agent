import { createHash } from "node:crypto";
import {
  defineProjectApp,
  eventDetails,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

const projectId = "aks-rp-e2e";
const projectPolicyMaxConcurrent = 80;
const specLoopTaskId = "aks-spec-verification-loop";
const featureReferenceLoopTaskId = "aks-feature-reference-loop";
const featureCompactLoopTaskId = "aks-feature-compact-loop";
const appTaskContext =
  "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e\nsource: /app/sources/aks-rp";

const taskTreeContext = [
  "projects/aks-rp-e2e.app/project.json",
  "projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "projects/aks-rp-e2e.app/tasks/README.md",
  "sources/aks-rp/test/e2ev3/sigs/rp/virtualmachine/suites/prerelease.go",
  "sources/aks-rp/test/e2ev3/sigs/rp/virtualmachine/suites/checkin.go",
];

function taskIdFromEvent(event: Record<string, unknown>): string {
  const target =
    event.target &&
    typeof event.target === "object" &&
    !Array.isArray(event.target)
      ? (event.target as Record<string, unknown>)
      : {};
  const value = target.taskId ?? event.taskId ?? event.task_id;
  return typeof value === "string" ? value.trim() : "";
}

function detailString(
  details: Record<string, unknown>,
  ...names: string[]
): string {
  for (const name of names) {
    const value = details[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function reviewedApplicationId(details: Record<string, unknown>): string {
  const taskId = detailString(details, "taskId", "task_id");
  const reviewId = detailString(details, "reviewId", "review_id");
  const attemptId = detailString(details, "attemptId", "attempt_id");
  const decision = detailString(details, "decision");
  const digest = createHash("sha256")
    .update(reviewId || `${taskId}\0${attemptId}\0${decision}`)
    .digest("hex")
    .slice(0, 16);
  const readable = taskId
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `runtime/review-application/${readable || "task"}-${digest}`;
}

export function resolveAksReconciliationTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  const details = eventDetails(event);
  if (event.type === "project.task.reviewed") {
    const reviewedTaskId = detailString(details, "taskId", "task_id");
    const attemptId = detailString(details, "attemptId", "attempt_id");
    const reviewId = detailString(details, "reviewId", "review_id");
    const decision = detailString(details, "decision");
    if (!reviewedTaskId || !attemptId || !decision) return null;
    const revisionValue = details.taskRevision ?? details.task_revision;
    const taskRevision = Number.isInteger(Number(revisionValue))
      ? Number(revisionValue)
      : null;
    return {
      id: reviewedApplicationId(details),
      parentId: "project",
      outcome: `Apply review ${reviewId || "decision"} for ${reviewedTaskId} attempt ${attemptId} exactly once.`,
      acceptance: [
        "The revision-checked review decision is applied, or it is recorded as stale or invalid without mutating newer task state.",
        "Any resulting assignment, owner request, problem investigation, or escalation transition is emitted through the existing planner contract.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "reviewed-task-applier",
      input: {
        reviewedTaskId,
        attemptId,
        reviewId,
        decision,
        taskRevision,
      },
      outputs: [".state/tasks/tree.json", ".state/planner-runs.jsonl"],
      priority: "P0",
    };
  }
  const action = String(event.action ?? details.action ?? "");
  if (event.type !== "project.task.tick" || action !== "feature-compact-loop") {
    return null;
  }
  const taskId = taskIdFromEvent(event) || featureCompactLoopTaskId;
  return {
    id: taskId,
    parentId: "project",
    outcome:
      "Generate feature-owned compact plans that cover every spec in each feature and prove each compacted test package with a passing live Azure DevOps staging pipeline run.",
    acceptance: [
      "Every compact state item is done only after the feature compact plan covers the full feature-owned spec set and the live ADO staging pipeline passed.",
      "Local package generation or check-mode Vitest success is intermediate evidence only; records without an ADO run id or failed live run remain pending/error.",
      "Each non-pass compact feature has an exact repair-and-rerun path or an escalation record after bounded repo-local fixes are exhausted.",
      "Controller pulses keep a bounded child frontier filled from pending/error compact features until all feature compact packages pass live through ADO.",
    ],
    mode: "maintain",
    owner: "aks-explorer",
    workflow: "feature-compact-loop-controller",
    input: { maxConcurrent: 20 },
    outputs: [
      ".state/feature-compact-loop/state.json",
      "../aks-rp-e2e/features/",
    ],
    priority: "P1",
  };
}

export default defineProjectApp({
  id: projectId,
  version: 1,
  description:
    "AKS RP e2e feature knowledge, spec verification, and app-ops project organizer.",
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
      id: "project-execution-watchdog",
      enabled: true,
      intervalMs: 300_000,
      emits: [
        {
          type: "project.watchdog.check.requested",
          target: { project: projectId },
          data: { project: projectId },
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
          target: { project: projectId, taskId: featureReferenceLoopTaskId },
          action: "feature-reference-loop",
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

  ownerEntry: {
    workflow: "project-planner",
    agent: "app-ops",
    task: `${appTaskContext}\nagent: app-ops\nworker: aks-explorer\ndomainWorker: aks-explorer\nopsWorker: app-ops\nmaxConcurrent: ${projectPolicyMaxConcurrent}\nconditionV2: exact-ado-revisioned`,
    timeoutMs: 3_600_000,
    context: taskTreeContext,
  },

  taskWorkflows: {
    "reviewed-task-applier": {
      workflow: "project-planner",
      agent: "app-ops",
      task: `${appTaskContext}\nagent: app-ops\nworker: aks-explorer\ndomainWorker: aks-explorer\nopsWorker: app-ops\nmaxConcurrent: ${projectPolicyMaxConcurrent}\nconditionV2: exact-ado-revisioned`,
      timeoutMs: 600_000,
      context: taskTreeContext,
    },
    "feature-compact-loop-controller": {
      workflow: "feature-compact-loop-controller",
      agent: "aks-explorer",
      task: `${appTaskContext}\nmaxConcurrent: 20`,
      timeoutMs: 600_000,
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e/design/feature-compact-loop.md",
        "projects/aks-rp-e2e/features/",
        "projects/aks-rp-e2e/runner/feature-compact.ts",
      ],
    },
  },

  taskRoutes: [
    {
      name: "aks-rp-e2e-task-reviewed-application",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Applies each revisioned task-review result once through a bounded achieve task.",
      accepts: [
        { type: "project.task.reviewed", target: { project: projectId } },
      ],
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-feature-compact-loop",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Reconciles the standing feature-compact responsibility through its proven bounded workflow.",
      accepts: [
        {
          type: "project.task.tick",
          target: { project: projectId },
          actions: ["feature-compact-loop"],
        },
      ],
      resolve: resolveAksReconciliationTask,
    },
  ],

  workflowHandlers: [
    {
      name: "aks-rp-e2e-project-planner",
      type: "job",
      enabled: true,
      description:
        "App-ops planner. Wakes app-ops, applies task-tree decisions, and explicitly dispatches worker tasks.",
      handler: {
        workflow: "project-planner",
        includeEvent: true,
        task: `${appTaskContext}\nagent: app-ops\nworker: aks-explorer\ndomainWorker: aks-explorer\nopsWorker: app-ops\nmaxConcurrent: ${projectPolicyMaxConcurrent}\nconditionV2: exact-ado-revisioned`,
        timeoutMs: 3_600_000,
      },
      accepts: [
        { type: "project.owner.requested", target: { project: projectId } },
        { type: "project.comment.created", target: { project: projectId } },
        {
          type: "project.approval.submitted",
          target: { project: projectId },
        },
        { type: "project.test_run.completed", target: { project: projectId } },
        { type: "project.stall.reviewed", target: { project: projectId } },
        { type: "project.problem.resolved", target: { project: projectId } },
        { type: "project.problem.escalated", target: { project: projectId } },
        {
          type: "project.problem.inconclusive",
          target: { project: projectId },
        },
        { type: "escalation.resolved", owner: "agent:aks-explorer" },
        { type: "escalation.dismissed", owner: "agent:aks-explorer" },
        { type: "metric.breach", owner: "agent:app-ops" },
        { type: "metric.recovered", owner: "agent:app-ops" },
        { type: "learning.feedback", owner: "agent:aks-explorer" },
        { type: "learning.feedback", owner: "agent:aks-reviewer" },
        { type: "coverage.gap.detected", target: { project: projectId } },
      ],
      emits: [
        "project.task.assigned",
        "project.problem.investigation.requested",
      ],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-condition-fallback-planner",
      type: "job",
      enabled: true,
      description:
        "Dedicated delivery lane for one correlated Condition fallback owner disposition.",
      maxConcurrentTriggers: 1,
      handler: {
        workflow: "project-planner",
        includeEvent: true,
        task: `${appTaskContext}\nagent: app-ops\nworker: aks-explorer\ndomainWorker: aks-explorer\nopsWorker: app-ops\nmaxConcurrent: ${projectPolicyMaxConcurrent}\nconditionV2: exact-ado-revisioned`,
        timeoutMs: 1_200_000,
      },
      accepts: [
        {
          type: "project.condition.fallback.requested",
          target: { project: projectId },
        },
      ],
      emits: ["project.task.assigned", "project.owner.requested"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-task-reviewer",
      type: "job",
      enabled: true,
      description:
        "Read-only task completion review. Emits structured review decisions for the planner to apply.",
      maxConcurrentTriggers: projectPolicyMaxConcurrent,
      handler: {
        workflow: "task-reviewer",
        includeEvent: true,
        task: `${appTaskContext}\nagent: aks-reviewer\nmaxAttempts: 1\npendingActionV2: review-application-revisioned`,
        timeoutMs: 900_000,
      },
      accepts: [
        { type: "project.task.completed", target: { project: projectId } },
      ],
      emits: ["project.task.reviewed"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-task-execution-worker",
      type: "job",
      enabled: true,
      description:
        "Worker execution. Executes one dispatched task and emits task completion.",
      maxConcurrentTriggers: projectPolicyMaxConcurrent,
      handler: {
        workflow: "task-worker",
        includeEvent: true,
        task: `${appTaskContext}\nmaxAttempts: 1\nmaxConcurrent: ${projectPolicyMaxConcurrent}\npendingActionV2: completion-review-revisioned`,
        timeoutMs: 13 * 60 * 60_000,
      },
      accepts: [
        { type: "project.task.assigned", target: { project: projectId } },
      ],
      emits: ["project.task.completed", "project.task.tick"],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-problem-solver",
      type: "job",
      enabled: true,
      description:
        "Focused problem resolver. Investigates blocked/failed work, fixes local causes when possible, and emits problem resolved/escalated for planner reconciliation.",
      maxConcurrentTriggers: 2,
      handler: {
        workflow: "problem-solver",
        includeEvent: true,
        task: `${appTaskContext}\nmaxAttempts: 1`,
        timeoutMs: 1_800_000,
      },
      accepts: [
        {
          type: "project.problem.investigation.requested",
          target: { project: projectId },
        },
      ],
      emits: [
        "project.problem.resolved",
        "project.problem.escalated",
        "project.problem.inconclusive",
      ],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-project-watchdog",
      type: "job",
      enabled: true,
      description:
        "Five-minute liveness guard. Observes task/session state and wakes app-ops when review is needed.",
      accepts: [
        {
          type: "project.watchdog.check.requested",
          target: { project: projectId },
        },
      ],
      handler: {
        workflow: "project-execution-watchdog",
        task: `${appTaskContext}\nmaxAttempts: 2\nmaxConcurrent: ${projectPolicyMaxConcurrent}\nsupervisorV2: review-handoff-revisioned\nsupervisorAttemptV2: shadow\nconditionV2: exact-ado-revisioned\npendingActionRedeliveryV2: review-application-revisioned`,
        timeoutMs: 1_800_000,
      },
      emits: [
        "project.owner.requested",
        "project.condition.fallback.requested",
        "project.stall.review.requested",
        "project.task.assigned",
        "project.task.tick",
      ],
      context: taskTreeContext,
    },
    {
      name: "aks-rp-e2e-project-stall-review",
      type: "job",
      enabled: true,
      description:
        "App-ops deep-dive fallback. Collects liveness state, performs safe mechanical repair, asks app-ops to judge the stall, and emits a reviewed fact for planner reconciliation.",
      maxConcurrentTriggers: 1,
      accepts: [
        {
          type: "project.stall.review.requested",
          target: { project: projectId },
        },
      ],
      handler: {
        workflow: "project-stall-review",
        includeEvent: true,
        task: `${appTaskContext}\nagent: app-ops\nmaxAttempts: 1\nmaxConcurrent: ${projectPolicyMaxConcurrent}`,
        timeoutMs: 1_800_000,
      },
      emits: ["project.stall.reviewed", "project.task.tick"],
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
        {
          type: "project.task.tick",
          target: { project: projectId },
          actions: ["spec-loop"],
        },
      ],
      emits: ["project.task.assigned"],
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e/ci/feature-sets/dev-infra-core.txt",
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
          type: "project.task.tick",
          target: { project: projectId },
          actions: ["feature-reference-loop"],
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
          type: "project.approval.requested",
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
  ],

  eventGraph: {
    externalEvents: [
      "message.created",
      "project.comment.created",
      "project.approval.submitted",
      "project.test_run.completed",
      "metric.breach",
      "metric.recovered",
      "learning.feedback",
      "escalation.resolved",
      "escalation.dismissed",
      "coverage.gap.detected",
    ],
    intentionalCycles: [
      {
        id: "app-ops-worker-review-loop",
        events: [
          "project.owner.requested",
          "project.task.assigned",
          "project.task.completed",
          "project.task.reviewed",
          "project.task.tick",
          "project.stall.review.requested",
          "project.stall.reviewed",
          "project.problem.investigation.requested",
          "project.problem.resolved",
          "project.problem.escalated",
          "project.problem.inconclusive",
          "escalation.resolved",
          "escalation.dismissed",
          "project.focus.review.requested",
        ],
        reason:
          "This is the project control loop. App-ops is the state-machine boundary and must review worker/problem-solver/focus-plan output before dispatching more work.",
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
            : featureReferenceLoopTaskId;
        return {
          type: "project.task.tick",
          action: "feature-reference-loop",
          target: { project: projectId, taskId },
          data: {
            project: projectId,
            action: "feature-reference-loop",
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
