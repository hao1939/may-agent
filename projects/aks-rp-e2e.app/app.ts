import { createHash } from "node:crypto";
import {
  defineProjectApp,
  eventDetails,
  matchesEventSelector,
  Type,
  type EventSelector,
  type ProjectAppContext,
  type ProjectAppEvent,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";
import { observeAksPipelines } from "./watchers/aks-pipeline.js";
import { observeAksPullRequests } from "./watchers/aks-pull-request.js";
import { observeRepoRefChanges } from "./watchers/repo-ref.js";
import { observeScenarioTestInventory } from "./watchers/scenario-test-inventory.js";
import { observeWorkspaceIntegrityChanges } from "./watchers/workspace-integrity.js";
import {
  featureCompactLoopTaskId,
  legacyBranchReconciliationTaskId,
  loopRefillWakeForTaskEvent,
  scenarioNormalizationTaskId,
  specLoopTaskId,
  standingLoopIntent,
} from "./task-loops.js";
import { syncSpecLiveProof } from "./agents/app-ops/workflows/lib/spec-live-proof-sync.js";

const projectId = "aks-rp-e2e";
const domainPolicyMaxConcurrent = 5;
const appOpsSupportConcurrent = 3;
const appControllerMaxConcurrent =
  domainPolicyMaxConcurrent + appOpsSupportConcurrent;
const scenarioTestFrontierTaskId = scenarioNormalizationTaskId;
export const masterValidationCycleTaskId = "master-validation-staging-cycle";
export const waitingFrontierReviewTaskId = "runtime/waiting-frontier-review";
const scenarioTestFrontierMinLeaves = 3;
const actionInputSchema = Type.Object({}, { additionalProperties: true });
const targetedTaskActionInputSchema = Type.Object(
  { taskId: Type.Optional(Type.String({ minLength: 1 })) },
  { additionalProperties: true },
);

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

function recordDetail(
  details: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = details[key];
    if (isRecord(value)) return value;
  }
  return null;
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
  { type: "project.task.tick", target: projectTarget },
  { type: "pipeline.failure.observed", target: projectTarget },
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

  if (event.type === "pipeline.failure.observed") {
    const specId = stringDetail(details, "specId", "spec_id");
    const failureFingerprint = stringDetail(
      details,
      "failureFingerprint",
      "fingerprint",
    );
    if (!specId || !failureFingerprint) return null;
    return {
      id: `domain/master-validation-failure/${safeTaskIdPart(specId, "spec")}/${safeTaskIdPart(failureFingerprint, "failure")}`,
      parentId: "group/domain-work",
      outcome: `Classify and resolve the progressively observed master-validation failure for ${specId} without waiting for the aggregate pipeline to finish.`,
      acceptance: [
        "The failure is classified as test_issue, prod_issue, or inconclusive from the completed slice artifact.",
        "A test issue remains open until the exact fix has a passing staging proof and the proven change is merged into main, or a later full current-main master-validation run passes it.",
        "A product issue leaves source unchanged, notifies the human operator through message.created for Telegram delivery, and remains open until a deployed product fix passes the affected spec from current main.",
        "Classification, notification, PR creation, and PR merge are progress evidence; none alone is final verification.",
      ],
      mode: "achieve",
      owner: "aks-explorer",
      workflow: "master-validation-failure",
      input: {
        validationTaskId: masterValidationCycleTaskId,
        specId,
        failureFingerprint,
        pipelineRunId: stringDetail(details, "pipelineRunId", "runId"),
        sourceBranch: stringDetail(details, "sourceBranch") || "main",
        sourceCommit: stringDetail(details, "sourceCommit", "sourceVersion"),
        sliceId: stringDetail(details, "sliceId"),
        status: stringDetail(details, "status"),
        category: stringDetail(details, "category"),
        reason: stringDetail(details, "reason"),
        artifactName: stringDetail(details, "artifactName"),
        artifactPath: stringDetail(details, "artifactPath"),
      },
      priority: "P0",
      category: "domain",
    };
  }

  if (event.type === "project.stall.reviewed") {
    const stallReview = recordDetail(details, "stallReview", "stall_review");
    const judgment =
      (stallReview ? stringDetail(stallReview, "judgment") : "") ||
      stringDetail(details, "judgment");
    if (judgment === "needs-work" || judgment === "escalate") {
      const reason =
        stringDetail(details, "reason", "triggerReason", "trigger_reason") ||
        judgment;
      return {
        id: `runtime/stall-review-followup/${safeTaskIdPart(`${judgment}-${reason}`, "review")}`,
        parentId: "group/app-operations",
        outcome: `Act on the reviewed AKS project stall finding (${judgment}) and move the project back toward useful work.`,
        acceptance: [
          "Read the structured stallReview input and current task tree before changing anything.",
          "Take one concrete app-owned next step: repair stale task representation, create exact follow-up work, escalate across an owner boundary, or record why no action is currently supported.",
          "Do not treat receipts, archived done leaves, or completed repair evidence as live coverage; any claimed covering task must exist in the live resource graph with a current nonterminal phase and must match the current affected task ids.",
          "Do not redo the stall diagnosis as the main work; use it as evidence and preserve agent judgment in the resulting task action or summary.",
        ],
        mode: "achieve",
        owner: "app-ops",
        input: {
          reason,
          judgment,
          ...(stallReview ? { stallReview } : {}),
          summary: stringDetail(details, "summary") || null,
        },
        priority: "P0",
      };
    }
  }

  if (ownerReviewEventTypes.has(String(event.type ?? ""))) {
    return {
      id: "runtime/owner-review",
      parentId: "group/app-operations",
      outcome:
        "Keep the AKS project reviewed by its accountable owner and organize the smallest useful next step from current evidence.",
      acceptance: [
        "The owner performs one useful project step or returns an evidence-backed no-op with typed follow-up actions.",
      ],
      mode: "maintain",
      owner: "app-ops",
      priority: "P1",
    };
  }

  switch (event.type) {
    case "project.task.tick": {
      const action = stringDetail(details, "action");
      if (
        action === "waiting-frontier-review" ||
        taskId === waitingFrontierReviewTaskId
      ) {
        return {
          id: waitingFrontierReviewTaskId,
          parentId: "group/app-operations",
          outcome:
            "Continuously review waiting and attention work from current facts and restore a bounded sample to an active recovery path.",
          acceptance: [
            "Read current task state and hot external facts instead of trusting stored summaries.",
            "For each sampled task, choose one truthful outcome: same-task retry after changed evidence, an exact observed wait, a sent escalation across an ownership boundary, or a terminal disposition with evidence.",
            "Do not leave a satisfied Condition, a producerless Condition, or an unattended attention task asleep.",
          ],
          mode: "maintain",
          owner: "app-ops",
          input: {
            maxConcurrent: domainPolicyMaxConcurrent,
            instructions: [
              "Treat runtime phase=waiting as the current blocked representation; do not search only for the retired blocked phase.",
              "Requeue the same task when its exact Condition is already true.",
              "Route valid repository waits through wait-for-repo-ref-advance using aks.repo-ref.observed.",
              "Return stale Conditions with no current producer to the task owner for fresh judgment.",
              "Preserve a human or external wait only with exact correlation and durable send proof.",
              "Review attention tasks that have no active retry or recovery consumer.",
              "Do not act on a fresh Condition wake or workflow-to-owner fallback that is already in flight; inspect current attempts and controller coverage first.",
              "Choose up to maxConcurrent uncovered tasks, re-read every selected generation and phase immediately before finishing, and return only still-applicable state-changing actions.",
            ],
          },
          priority: "P0",
          category: "ops",
        };
      }
      if (action === "spec-loop" || taskId === specLoopTaskId) {
        return standingLoopIntent(specLoopTaskId);
      }
      if (
        action === "feature-compact-loop" ||
        taskId === featureCompactLoopTaskId
      ) {
        return standingLoopIntent(featureCompactLoopTaskId);
      }
      if (taskId === scenarioTestFrontierTaskId) {
        return standingLoopIntent(scenarioNormalizationTaskId);
      }
      if (taskId === masterValidationCycleTaskId) {
        return {
          id: masterValidationCycleTaskId,
          parentId: "group/domain-work",
          outcome:
            "Continuously validate the master-validation feature set against staging from the exact current main commit every six hours, with immediate per-slice failure investigation.",
          acceptance: [
            "Each due cycle queues pipeline 467665 with feature_set=master-validation, target=staging, slices=12, slice_max_parallel=6, branch main, and the exact resolved origin/main commit.",
            "Only one aggregate master-validation cycle is active at a time.",
            "Completed slice artifacts are observed while the aggregate run is still active and each nonpassing spec becomes one stable fingerprinted child task.",
            "A failed run remains explicitly open after classification, notification, or merge; only a later passing full run from current main verifies the standing task green.",
          ],
          mode: "maintain",
          owner: "app-ops",
          workflow: "master-validation-cycle",
          input: {
            featureSet: "master-validation",
            intervalMs: 21_600_000,
            pipelineId: "467665",
            sourceBranch: "main",
            target: "staging",
          },
          priority: "P0",
          category: "domain",
        };
      }
      if (
        action === "legacy-branch-reconciliation" ||
        taskId === legacyBranchReconciliationTaskId
      ) {
        return standingLoopIntent(legacyBranchReconciliationTaskId);
      }
      return null;
    }
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
        parentId: "group/app-operations",
        outcome:
          "Investigate one bounded AKS project blocker and return a verified resolution, exact escalation, or explicit inconclusive result.",
        acceptance: [
          "The investigation reports its root cause, action, verification, and the exact owner next step without taking task-tree scheduling authority.",
        ],
        mode: "achieve",
        owner: "app-ops",
        workflow: "problem-solver",
        input: { problemKey, targetTaskId: taskId || null },
        priority: "P1",
      };
    }
    case "project.stall.review.requested":
      return {
        id: "runtime/project-stall-review",
        parentId: "group/app-operations",
        outcome:
          "Keep suspicious stalled AKS work reviewed against current task, loop, and external-state evidence.",
        acceptance: [
          "The review applies only safe mechanical repair and returns a structured judgment, evidence, and exact follow-up.",
        ],
        mode: "maintain",
        owner: "app-ops",
        workflow: "project-stall-review",
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
        parentId: "group/app-operations",
        outcome:
          "Keep one named AKS focus plan or progress review aligned with the current live frontier.",
        acceptance: [
          "The review proposes or assesses a focus plan from current task and execution evidence without using the task graph as a scheduler.",
        ],
        mode: "maintain",
        owner: "app-ops",
        workflow: "focus-plan",
        input: { focusKey: focusKey || "current" },
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
        parentId: "group/app-operations",
        outcome:
          "Deliver one exact AKS approval packet through the human-facing approval path.",
        acceptance: [
          "A valid packet is delivered once for its semantic correlation key, or missing/invalid input is reported with evidence.",
        ],
        mode: "achieve",
        owner: "app-ops",
        workflow: "approval-dispatch",
        input: { approvalKey, targetTaskId: taskId || null },
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
  if (event.type === "project.task.reconciled") {
    const details = eventDetails(event);
    const reconciledTaskId = targetTaskId(event);
    const specProof = reconciledTaskId
      ? syncSpecLiveProof(ctx.appPath("."), reconciledTaskId)
      : { changed: false };
    const wake = loopRefillWakeForTaskEvent(ctx.appPath("."), event);
    if (wake) ctx.emit(wake);
    const actionsApplied = Array.isArray(details.actionsApplied)
      ? details.actionsApplied.filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        )
      : [];
    const continueWaitingFrontierReview =
      reconciledTaskId === waitingFrontierReviewTaskId &&
      details.disposition === "converged" &&
      actionsApplied.length > 0;
    if (continueWaitingFrontierReview) {
      ctx.emit({
        type: "project.task.tick",
        source: "aks-rp-e2e-app",
        target: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
        },
        urgency: "high",
        action: "waiting-frontier-review",
        data: {
          project: projectId,
          taskId: waitingFrontierReviewTaskId,
          task_id: waitingFrontierReviewTaskId,
          reason: "continue-after-applied-recovery-actions",
        },
      });
    }
    return {
      refillWake: Boolean(wake),
      waitingFrontierContinuation: continueWaitingFrontierReview,
      specProof,
    };
  }
  if (event.type === "aks.pipeline.check") return observeAksPipelines(ctx);
  if (event.type === "pipeline.queue.overdue") {
    const details = eventDetails(event);
    const runId = stringDetail(details, "pipelineRunId", "runId");
    const queueTime = stringDetail(details, "queueTime");
    const message = {
      project: projectId,
      from: "app-ops",
      to: "human:operator",
      intent: "master-validation-queue-overdue",
      priority: "P2",
      pipelineRunId: runId,
      queueTime,
      content: `AKS master-validation run ${runId || "unknown"} has waited at least 90 minutes for hosted-agent capacity. Queue position is preserved; the app did not cancel or duplicate the run.`,
    };
    ctx.emit({
      type: "message.created",
      source: "aks-rp-e2e-app",
      target: { project: projectId, human: true },
      ...message,
      data: message,
    });
    return { operatorNotified: true, pipelineRunId: runId };
  }
  if (event.type === "aks.pull-request.check")
    return observeAksPullRequests(ctx);
  if (event.type === "aks.repo-ref.check") return observeRepoRefChanges(ctx);
  if (event.type === "aks.repo-ref.observed") {
    const details = eventDetails(event);
    return {
      observed: true,
      repoRef: stringDetail(details, "repoRef", "repo_ref"),
      commit: stringDetail(details, "commit"),
    };
  }
  if (event.type === "aks.repo-ref.changed") {
    const details = eventDetails(event);
    const repoRef = stringDetail(details, "repoRef", "repo_ref");
    if (repoRef !== "origin/main") {
      return { masterValidationWake: false, repoRef };
    }
    const commit = stringDetail(details, "commit");
    ctx.emit({
      type: "project.task.tick",
      source: "aks-rp-e2e-app",
      target: {
        project: projectId,
        taskId: masterValidationCycleTaskId,
      },
      action: "master-validation-cycle",
      data: {
        project: projectId,
        taskId: masterValidationCycleTaskId,
        reason: "master-validation-main-advanced",
        repoRef,
        commit,
      },
    });
    return { masterValidationWake: true, repoRef, commit };
  }
  if (event.type === "aks.workspace.integrity.check")
    return observeWorkspaceIntegrityChanges(ctx);
  if (event.type === "aks.workspace.integrity.changed") {
    ctx.emit({
      type: "project.owner.requested",
      target: { project: projectId },
      data: {
        project: projectId,
        reason: "workspace-integrity-changed",
        observation: eventDetails(event),
      },
    });
    return { ownerReviewRequested: true };
  }
  if (event.type === "aks.scenario-test-inventory.check")
    return observeScenarioTestInventory(ctx);
  if (event.type === "aks.scenario-test-inventory.observed") {
    const wake = scenarioTestFrontierWakeEvent(event);
    ctx.emit(wake);
    return { taskId: scenarioTestFrontierTaskId, observed: true };
  }
  return undefined;
}

export function scenarioTestFrontierWakeEvent(
  event: Record<string, unknown>,
): ProjectAppEvent {
  const details = eventDetails(event);
  return {
    type: "project.task.tick",
    source: "aks-rp-e2e-app",
    target: { project: projectId, taskId: scenarioTestFrontierTaskId },
    reason: "strict-scenario-test-inventory-observed",
    data: {
      project: projectId,
      taskId: scenarioTestFrontierTaskId,
      task_id: scenarioTestFrontierTaskId,
      reason: "strict-scenario-test-inventory-observed",
      overrideWait: true,
      desiredRunnableLeaves: {
        min: scenarioTestFrontierMinLeaves,
        max: domainPolicyMaxConcurrent,
      },
      capacityRule:
        "For this normalization frontier, count only concrete one-spec domain leaves that are active/running, runnable/backlog, or exact accepted dispositions for current missingAdapterFiles. Review/attention residue, runtime/ops/focus work, spec-loop status, and compact-loop status do not satisfy moving normalization capacity.",
      instructions:
        "If strict inventory is red, account for each current missingAdapterFiles path. Create or advance enough concrete one-spec domain leaves to keep 3-5 useful leaves moving, or return an evidence-backed no-op only when each missing adapter already has exact active work, exact wait/escalation, or terminal disposition.",
      ...(isRecord(details.observation)
        ? { observation: details.observation }
        : {}),
    },
  };
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
    maxConcurrent: appControllerMaxConcurrent,
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
      id: "master-validation-staging-cycle",
      enabled: true,
      // The workflow receipt owns the six-hour due rule. Keep the level
      // reconciliation pulse short so daemon/app reloads cannot postpone a due
      // cycle by another six hours.
      intervalMs: 300_000,
      emits: [
        {
          type: "project.task.tick",
          target: {
            project: projectId,
            taskId: masterValidationCycleTaskId,
          },
          action: "master-validation-cycle",
          data: {
            project: projectId,
            taskId: masterValidationCycleTaskId,
            reason: "scheduled-six-hour-master-validation",
          },
        },
      ],
    },
    {
      id: "pull-request-observer",
      enabled: true,
      intervalMs: 300_000,
      emits: [
        {
          type: "aks.pull-request.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "workspace-integrity-observer",
      enabled: true,
      intervalMs: 3_600_000,
      emits: [
        {
          type: "aks.workspace.integrity.check",
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
              maxConcurrent: domainPolicyMaxConcurrent,
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
              maxConcurrent: domainPolicyMaxConcurrent,
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
      id: "scenario-test-frontier-observer",
      enabled: true,
      intervalMs: 1_800_000,
      emits: [
        {
          type: "aks.scenario-test-inventory.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "repo-ref-observer",
      enabled: true,
      intervalMs: 600_000,
      emits: [
        {
          type: "aks.repo-ref.check",
          target: { project: projectId },
        },
      ],
    },
    {
      id: "blocked-frontier-app-ops-review",
      enabled: true,
      intervalMs: 1_800_000,
      emits: [
        {
          type: "project.task.tick",
          target: { project: projectId, taskId: waitingFrontierReviewTaskId },
          urgency: "high",
          action: "waiting-frontier-review",
          data: {
            project: projectId,
            taskId: waitingFrontierReviewTaskId,
            task_id: waitingFrontierReviewTaskId,
            reason: "scheduled-blocked-frontier-review",
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

  events: [
    { type: "project.task.reconciled", target: projectTarget },
    { type: "aks.pipeline.check", target: projectTarget },
    { type: "aks.pull-request.check", target: projectTarget },
    { type: "aks.repo-ref.check", target: projectTarget },
    { type: "aks.repo-ref.observed", target: projectTarget },
    { type: "aks.repo-ref.changed", target: projectTarget },
    { type: "aks.workspace.integrity.check", target: projectTarget },
    { type: "aks.workspace.integrity.changed", target: projectTarget },
    { type: "aks.scenario-test-inventory.check", target: projectTarget },
    { type: "aks.scenario-test-inventory.observed", target: projectTarget },
    { type: "pipeline-run.state", target: projectTarget },
    { type: "pipeline.completed", target: projectTarget },
    { type: "pipeline.run.completed", target: projectTarget },
    { type: "pipeline-artifact.available", target: projectTarget },
    { type: "pipeline.spec.observed", target: projectTarget },
    { type: "pipeline.queue.overdue", target: projectTarget },
  ],
  onEvent: routeAksEvent,

  actions: {
    "execute-run": {
      type: "async",
      description: "Request live execution for selected replanned paths.",
      inputSchema: actionInputSchema,
      event(params) {
        return {
          type: "project.owner.requested",
          target: { project: projectId },
          data: {
            project: projectId,
            reason: "execute-run-action",
            params: {
              maxConcurrent: domainPolicyMaxConcurrent,
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
      inputSchema: actionInputSchema,
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
              maxConcurrent: domainPolicyMaxConcurrent,
              ...input,
            },
          },
        };
      },
    },
    watch: {
      type: "async",
      description: "Start or resume app-ops review through the task tree.",
      inputSchema: actionInputSchema,
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
              maxConcurrent: domainPolicyMaxConcurrent,
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
      inputSchema: actionInputSchema,
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
      inputSchema: actionInputSchema,
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
      inputSchema: actionInputSchema,
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
      inputSchema: actionInputSchema,
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
      inputSchema: actionInputSchema,
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
      inputSchema: targetedTaskActionInputSchema,
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
      inputSchema: targetedTaskActionInputSchema,
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
    "pulse-scenario-frontier": {
      type: "async",
      description:
        "Pulse the targeted scenario-test missing-adapter normalization frontier.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.task.tick",
          target: { project: projectId, taskId: scenarioTestFrontierTaskId },
          data: {
            project: projectId,
            taskId: scenarioTestFrontierTaskId,
            task_id: scenarioTestFrontierTaskId,
            reason: "manual-scenario-frontier-pulse",
            desiredRunnableLeaves: {
              min: scenarioTestFrontierMinLeaves,
              max: domainPolicyMaxConcurrent,
            },
            params: input,
          },
        };
      },
    },
    "pulse-legacy-branch-reconciliation": {
      type: "async",
      description:
        "Reconcile legacy AKS task branches into origin/dev or an explicit rejected disposition.",
      inputSchema: actionInputSchema,
      event(params) {
        const input =
          params && typeof params === "object"
            ? (params as Record<string, unknown>)
            : {};
        return {
          type: "project.task.tick",
          action: "legacy-branch-reconciliation",
          target: {
            project: projectId,
            taskId: legacyBranchReconciliationTaskId,
          },
          data: {
            project: projectId,
            action: "legacy-branch-reconciliation",
            taskId: legacyBranchReconciliationTaskId,
            task_id: legacyBranchReconciliationTaskId,
            reason: "manual-legacy-branch-reconciliation-pulse",
            params: input,
          },
        };
      },
    },
  },
});
