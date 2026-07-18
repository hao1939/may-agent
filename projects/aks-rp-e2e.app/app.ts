import { createHash } from "node:crypto";
import {
  defineProjectApp,
  eventDetails,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";

const projectId = "aks-rp-e2e";
const projectPolicyMaxConcurrent = 80;
const specLoopTaskId = "aks-spec-verification-loop";
const featureCompactLoopTaskId = "aks-feature-compact-loop";
const ownerEventTypes = new Set([
  "project.owner.requested",
  "project.comment.created",
  "project.approval.submitted",
  "project.test_run.completed",
  "project.stall.reviewed",
  "project.problem.resolved",
  "project.problem.escalated",
  "project.problem.inconclusive",
  "escalation.resolved",
  "escalation.dismissed",
  "metric.breach",
  "metric.recovered",
  "learning.feedback",
  "coverage.gap.detected",
]);
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

function completionReviewId(details: Record<string, unknown>): string {
  const taskId = detailString(details, "taskId", "task_id");
  const attemptId = detailString(details, "attemptId", "attempt_id");
  const revisionValue = details.taskRevision ?? details.task_revision;
  const taskRevision =
    typeof revisionValue === "number" &&
    Number.isInteger(revisionValue) &&
    revisionValue >= 0
      ? revisionValue
      : 0;
  const digest = createHash("sha256")
    .update(`${taskId}\0${taskRevision}\0${attemptId}`)
    .digest("hex")
    .slice(0, 16);
  const readable = taskId
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `runtime/task-review/${readable || "task"}-${digest}`;
}

function taskExecutionId(details: Record<string, unknown>): string {
  const taskId = detailString(details, "taskId", "task_id");
  const attemptId = detailString(details, "attemptId", "attempt_id");
  const revisionValue = details.taskRevision ?? details.task_revision;
  const taskRevision =
    typeof revisionValue === "number" &&
    Number.isInteger(revisionValue) &&
    revisionValue >= 0
      ? revisionValue
      : 0;
  const digest = createHash("sha256")
    .update(`${taskId}\0${taskRevision}\0${attemptId}`)
    .digest("hex")
    .slice(0, 16);
  const readable = taskId
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `runtime/task-execution/${readable || "task"}-${digest}`;
}

function approvalDispatchId(details: Record<string, unknown>): string {
  const pathId = detailString(details, "pathId", "path_id");
  const rawPacketPath = detailString(details, "packetPath", "packet_path")
    .replace(/\\/g, "/");
  const archiveOffset = rawPacketPath.indexOf("evidence/archive/");
  const packetPath =
    archiveOffset >= 0 ? rawPacketPath.slice(archiveOffset) : rawPacketPath;
  const digest = createHash("sha256")
    .update(`${pathId}\0${packetPath}`)
    .digest("hex")
    .slice(0, 16);
  const readable = pathId
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `runtime/approval-dispatch/${readable || "approval"}-${digest}`;
}

function conditionFallbackId(details: Record<string, unknown>): string {
  const conditionId = detailString(details, "conditionId", "condition_id");
  const recoveryKey = detailString(details, "recoveryKey", "recovery_key");
  const revisionValue = details.taskRevision ?? details.task_revision;
  const taskRevision =
    typeof revisionValue === "number" &&
    Number.isInteger(revisionValue) &&
    revisionValue >= 0
      ? revisionValue
      : 0;
  const digest = createHash("sha256")
    .update(recoveryKey || `${conditionId}\0${taskRevision}`)
    .digest("hex")
    .slice(0, 16);
  const readable = conditionId
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `runtime/condition-fallback/${readable || "condition"}-${digest}`;
}

function ownerEventTaskId(event: Record<string, unknown>): string {
  const eventType = typeof event.type === "string" ? event.type : "event";
  const eventId = event.eventId;
  const readable = eventType
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `runtime/owner-event/${readable || "event"}-${String(eventId)}`;
}

function detailStrings(
  details: Record<string, unknown>,
  ...names: string[]
): string[] {
  for (const name of names) {
    const value = details[name];
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
        .sort();
    }
  }
  return [];
}

function problemInvestigationId(
  event: Record<string, unknown>,
  details: Record<string, unknown>,
): string {
  const problemKey = detailString(details, "problemKey", "problem_key");
  const affectedTasks = detailStrings(
    details,
    "affectedTasks",
    "affected_tasks",
  );
  const eventIdentity = event.id ?? event.eventId ?? event.event_id;
  const digest = createHash("sha256")
    .update(
      eventIdentity === undefined
        ? `${problemKey}\0${affectedTasks.join("\0")}`
        : String(eventIdentity),
    )
    .digest("hex")
    .slice(0, 16);
  const readable = problemKey
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `runtime/problem-investigation/${readable || "problem"}-${digest}`;
}

export function resolveAksReconciliationTask(
  event: Record<string, unknown>,
): ProjectAppTaskIntent | null {
  const baseDetails = eventDetails(event);
  const params =
    baseDetails.params &&
    typeof baseDetails.params === "object" &&
    !Array.isArray(baseDetails.params)
      ? (baseDetails.params as Record<string, unknown>)
      : {};
  const details = { ...baseDetails, ...params };
  if (event.type === "project.watchdog.check.requested") {
    return {
      id: "aks-project-runtime-health",
      parentId: "project",
      outcome:
        "Keep task delivery, attempts, exact external waits, and review handoffs mechanically healthy while compatibility recovery remains necessary.",
      acceptance: [
        "Each wake repairs only declared mechanical invariants or emits one typed owner/stall/Condition continuation.",
        "The watchdog does not make domain strategy decisions or create duplicate execution authority.",
      ],
      mode: "maintain",
      owner: "app-ops",
      workflow: "project-watchdog",
      input: {
        supervisor: "review-handoff-revisioned",
        condition: "exact-ado-revisioned",
      },
      outputs: [".state/watchdog-runs.jsonl"],
      priority: "P0",
    };
  }
  if (ownerEventTypes.has(String(event.type ?? ""))) {
    const eventId = event.eventId;
    if (
      typeof eventId !== "number" ||
      !Number.isInteger(eventId) ||
      eventId <= 0
    ) {
      return null;
    }
    const eventType = String(event.type);
    return {
      id: ownerEventTaskId(event),
      parentId: "project",
      outcome: `Disposition durable ${eventType} event ${eventId} through the accountable app owner exactly once.`,
      acceptance: [
        "App-ops records the event's semantic effect, explicit no-op, escalation, or required follow-up in durable project state.",
        "Any resulting assignments or problem investigations are emitted through their canonical event paths.",
      ],
      mode: "achieve",
      owner: "app-ops",
      input: { eventType, eventId },
      outputs: ["tasks/tree.json"],
      priority: "P1",
    };
  }
  if (event.type === "project.focus.review.requested") {
    const rawMode = detailString(details, "mode").toLowerCase();
    const kind =
      rawMode === "plan" || rawMode === "proposal" ? "proposal" : "review";
    return {
      id:
        kind === "proposal"
          ? "aks-focus-plan-strategy-review"
          : "aks-focus-plan-progress-review",
      parentId: "project",
      outcome:
        kind === "proposal"
          ? "Keep the current mid-term project focus explicit, bounded, and approved when direction or risk changes."
          : "Keep the active focus branch aligned with current project evidence and execution progress.",
      acceptance: [
        "Each accepted focus-review wake records one structured focus result in the focus-plan ledger.",
        "App-ops receives the bounded continuation, and material direction changes preserve one exact human-approval lineage.",
      ],
      mode: "maintain",
      owner: "aks-explorer",
      workflow: "focus-plan",
      input: { kind },
      outputs: [".state/focus-plan-runs.jsonl"],
      priority: "P1",
    };
  }
  if (event.type === "project.condition.fallback.requested") {
    const conditionId = detailString(details, "conditionId", "condition_id");
    const subjectTaskId = detailString(details, "taskId", "task_id");
    if (!conditionId || !subjectTaskId) return null;
    const revisionValue = details.taskRevision ?? details.task_revision;
    const taskRevision =
      typeof revisionValue === "number" &&
      Number.isInteger(revisionValue) &&
      revisionValue >= 0
        ? revisionValue
        : 0;
    return {
      id: conditionFallbackId(details),
      parentId: "project",
      outcome: `Judge the overdue fallback for Condition ${conditionId} exactly once and leave one durable owner disposition.`,
      acceptance: [
        "App-ops records whether the exact Condition is refreshed, repaired, escalated, or otherwise terminally dispositioned.",
        "The fallback does not create a duplicate polling wait or replay already-completed work.",
      ],
      mode: "achieve",
      owner: "app-ops",
      input: {
        conditionId,
        subjectTaskId,
        taskRevision,
        recoveryKey: detailString(details, "recoveryKey", "recovery_key"),
        fallbackAction: detailString(
          details,
          "fallbackAction",
          "fallback_action",
        ),
      },
      outputs: ["tasks/tree.json"],
      priority: "P0",
    };
  }
  if (event.type === "project.stall.review.requested") {
    return {
      id: "aks-project-stall-review",
      parentId: "project",
      outcome:
        "Keep project liveness stalls evidence-backed, mechanically repaired where safe, and handed to app-ops as one reviewed disposition.",
      acceptance: [
        "Each accepted stall-review wake produces one structured project.stall.reviewed fact for planner reconciliation.",
        "Mechanical repairs and loop pulses remain bounded, visible, and recorded in the stall-review ledger.",
      ],
      mode: "maintain",
      owner: "app-ops",
      workflow: "project-stall-review",
      input: { maxLoopPulses: 3 },
      outputs: [".state/stall-review-runs.jsonl"],
      priority: "P0",
    };
  }
  if (event.type === "project.approval.requested") {
    const packetPath = detailString(details, "packetPath", "packet_path");
    const pathId = detailString(details, "pathId", "path_id");
    const requestedAction = detailString(
      details,
      "requestedAction",
      "requested_action",
    );
    if (!packetPath || !pathId || !requestedAction) return null;
    return {
      id: approvalDispatchId(details),
      parentId: "project",
      outcome: `Deliver the exact approval packet for ${pathId} once through the human-facing message channel.`,
      acceptance: [
        "A packet-linked message.created event is durably emitted, or prior delivery for the same approval lineage is proven and duplicate delivery is suppressed.",
        "The approval id, wait id, expected response, and resume condition are recorded in the approval-dispatch ledger.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "approval-dispatch",
      input: {
        packetPath,
        pathId,
        requestedAction,
        approvalId: detailString(details, "approvalId", "approval_id"),
        waitId: detailString(details, "waitId", "wait_id"),
      },
      outputs: [".state/approval-dispatch-runs.jsonl"],
      priority: "P1",
    };
  }
  if (event.type === "project.task.assigned") {
    const assignedTaskId = detailString(details, "taskId", "task_id");
    const attemptId = detailString(details, "attemptId", "attempt_id");
    if (!assignedTaskId || !attemptId) return null;
    const revisionValue = details.taskRevision ?? details.task_revision;
    const taskRevision =
      typeof revisionValue === "number" &&
      Number.isInteger(revisionValue) &&
      revisionValue >= 0
        ? revisionValue
        : 0;
    const worker = detailString(details, "worker", "assignedWorker");
    return {
      id: taskExecutionId(details),
      parentId: "project",
      outcome: `Execute assignment ${assignedTaskId} revision ${taskRevision} attempt ${attemptId} exactly once and hand its result to review.`,
      acceptance: [
        "The assignment is rejected as stale or executed under its exact revision and attempt identity.",
        "The worker result is durably recorded and its revisioned completion handoff is delivered for independent review.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "task-execution",
      input: {
        assignedTaskId,
        attemptId,
        taskRevision,
        worker,
      },
      outputs: [".state/task-worker-runs.jsonl"],
      priority: "P0",
    };
  }
  if (event.type === "project.problem.investigation.requested") {
    const problemKey = detailString(details, "problemKey", "problem_key");
    if (!problemKey) return null;
    const affectedTasks = detailStrings(
      details,
      "affectedTasks",
      "affected_tasks",
    );
    return {
      id: problemInvestigationId(event, details),
      parentId: "project",
      outcome: `Investigate problem ${problemKey} once and return an evidence-backed resolved, escalated, or inconclusive disposition.`,
      acceptance: [
        "The investigation records its root cause, action, verification, and exact planner continuation in the durable problem ledger.",
        "Exactly one structured problem result is delivered to the planner without directly mutating the task tree.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "problem-solver",
      input: { problemKey, affectedTasks },
      outputs: [".state/problem-runs.jsonl"],
      priority: "P0",
    };
  }
  if (event.type === "project.task.completed") {
    const completedTaskId = detailString(details, "taskId", "task_id");
    const attemptId = detailString(details, "attemptId", "attempt_id");
    if (!completedTaskId || !attemptId) return null;
    const revisionValue = details.taskRevision ?? details.task_revision;
    const taskRevision =
      typeof revisionValue === "number" &&
      Number.isInteger(revisionValue) &&
      revisionValue >= 0
        ? revisionValue
        : 0;
    return {
      id: completionReviewId(details),
      parentId: "project",
      outcome: `Review completion of ${completedTaskId} attempt ${attemptId} exactly once and deliver its structured disposition.`,
      acceptance: [
        "The completion is checked against the current task revision and attempt without mutating project state directly.",
        "A structured review decision is durably recorded and delivered for application, or the completion is recorded as stale without changing newer task state.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "task-reviewer",
      input: {
        completedTaskId,
        attemptId,
        taskRevision,
      },
      outputs: [".state/task-reviewer-runs.jsonl"],
      priority: "P0",
    };
  }
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
    "project-watchdog": {
      workflow: "project-execution-watchdog",
      agent: "aks-explorer",
      task: `${appTaskContext}\nmaxAttempts: 2\nmaxConcurrent: ${projectPolicyMaxConcurrent}\nsupervisorV2: review-handoff-revisioned\nsupervisorAttemptV2: shadow\nconditionV2: exact-ado-revisioned\npendingActionRedeliveryV2: review-application-revisioned`,
      timeoutMs: 1_800_000,
      context: taskTreeContext,
    },
    "focus-plan": {
      workflow: "focus-plan",
      agent: "aks-explorer",
      task: `${appTaskContext}\nagent: aks-explorer\nmaxConcurrent: 5`,
      timeoutMs: 1_800_000,
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e.app/project.json",
        "projects/aks-rp-e2e/README.md",
      ],
    },
    "project-stall-review": {
      workflow: "project-stall-review",
      agent: "app-ops",
      task: `${appTaskContext}\nagent: app-ops\nmaxAttempts: 1\nmaxConcurrent: ${projectPolicyMaxConcurrent}`,
      timeoutMs: 1_800_000,
      context: taskTreeContext,
    },
    "approval-dispatch": {
      workflow: "approval-dispatch",
      agent: "aks-explorer",
      task: `${appTaskContext}\nagent: aks-explorer\nmaxAttempts: 1`,
      timeoutMs: 600_000,
      context: [
        ...taskTreeContext,
        "projects/aks-rp-e2e.app/project.json",
        "projects/aks-rp-e2e/runs/test-results/",
      ],
    },
    "task-execution": {
      workflow: "task-worker",
      agent: "aks-explorer",
      task: `${appTaskContext}\nmaxAttempts: 1\nmaxConcurrent: ${projectPolicyMaxConcurrent}\npendingActionV2: completion-review-revisioned`,
      timeoutMs: 13 * 60 * 60_000,
      context: taskTreeContext,
    },
    "problem-solver": {
      workflow: "problem-solver",
      agent: "aks-explorer",
      task: `${appTaskContext}\nmaxAttempts: 1`,
      timeoutMs: 1_800_000,
      context: taskTreeContext,
    },
    "task-reviewer": {
      workflow: "task-reviewer",
      agent: "aks-reviewer",
      task: `${appTaskContext}\nagent: aks-reviewer\nmaxAttempts: 1\npendingActionV2: review-application-revisioned`,
      timeoutMs: 900_000,
      context: taskTreeContext,
    },
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
      name: "aks-rp-e2e-task-runtime-health",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Reconciles compatibility delivery and recovery invariants through one standing task.",
      accepts: [
        {
          type: "project.watchdog.check.requested",
          target: { project: projectId },
        },
      ],
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-owner-event",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Routes each durable semantic app event once to the accountable owner entry.",
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
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-focus-review",
      enabled: true,
      maxConcurrentTriggers: 2,
      description:
        "Reconciles standing strategy and progress review responsibilities independently.",
      accepts: [
        {
          type: "project.focus.review.requested",
          target: { project: projectId },
        },
      ],
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-condition-fallback",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Routes each exact Condition fallback identity once to the accountable owner.",
      accepts: [
        {
          type: "project.condition.fallback.requested",
          target: { project: projectId },
        },
      ],
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-stall-review",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Reconciles project liveness stalls through one standing maintain task.",
      accepts: [
        {
          type: "project.stall.review.requested",
          target: { project: projectId },
        },
      ],
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-approval-dispatch",
      enabled: true,
      maxConcurrentTriggers: 1,
      description:
        "Delivers each packet-linked approval request once through a bounded achieve task.",
      accepts: [
        {
          type: "project.approval.requested",
          target: { project: projectId },
        },
      ],
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-execution",
      enabled: true,
      maxConcurrentTriggers: projectPolicyMaxConcurrent,
      description:
        "Executes each revisioned task assignment once through a bounded achieve task.",
      accepts: [
        { type: "project.task.assigned", target: { project: projectId } },
      ],
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-problem-investigation",
      enabled: true,
      maxConcurrentTriggers: 2,
      description:
        "Investigates each correlated project problem through a bounded achieve task.",
      accepts: [
        {
          type: "project.problem.investigation.requested",
          target: { project: projectId },
        },
      ],
      resolve: resolveAksReconciliationTask,
    },
    {
      name: "aks-rp-e2e-task-completion-review",
      enabled: true,
      maxConcurrentTriggers: projectPolicyMaxConcurrent,
      description:
        "Reviews each revisioned task completion once through a bounded achieve task.",
      accepts: [
        { type: "project.task.completed", target: { project: projectId } },
      ],
      resolve: resolveAksReconciliationTask,
    },
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
