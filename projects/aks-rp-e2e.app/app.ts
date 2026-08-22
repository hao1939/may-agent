import { createHash } from "node:crypto";
import {
  Type,
  defineApp,
  matchesEventSelector as matchesCanonicalEventSelector,
  type AppEvent,
  type AppEventSubscription,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type EventSelector as CanonicalEventSelector,
  type TaskIntent,
  type TaskAction,
} from "@may-agent/sdk";
import {
  featureCompactLoopTaskId,
  legacyBranchReconciliationTaskId,
  masterValidationCompactTaskId,
  repositorySkillMaintenanceTaskId,
  scenarioNormalizationTaskId,
  specLoopTaskId,
  standingLoopIntent,
} from "./task-loops.js";
import { parseApprovalDecision } from "./agents/app-ops/workflows/lib/approval-decision.js";
import { decideDomainWriteRouting } from "./domain-write-routing.js";
import { aksObservers } from "./watchers/observers.js";

const projectId = "aks-rp-e2e";
const domainPolicyMaxConcurrent = 5;
const appOpsSupportConcurrent = 3;
// The runtime shares this budget across hot-reload controller generations.
const appControllerMaxConcurrent =
  domainPolicyMaxConcurrent + appOpsSupportConcurrent;
const scenarioTestFrontierTaskId = scenarioNormalizationTaskId;
export const masterValidationCycleTaskId = "master-validation-staging-cycle";
const scenarioTestFrontierMinLeaves = 3;

/**
 * Reject malformed explicit prepared-source handoffs before task mutation.
 * Omitting both fields delegates task-branch creation from current origin/dev to
 * spec-live-reconciliation; explicit source identifies a dedicated task branch.
 */
export function validateAksTaskAction(action: TaskAction): string | null {
  const writeRouting = decideDomainWriteRouting(action);
  if (writeRouting.reason) return writeRouting.reason;

  if (
    (action.kind !== "create-task" && action.kind !== "update-task") ||
    action.workflow !== "spec-live-reconciliation"
  ) {
    return null;
  }
  const input = action.input;
  if (!input) return null;
  const hasBranch = Object.prototype.hasOwnProperty.call(input, "sourceBranch");
  const hasCommit = Object.prototype.hasOwnProperty.call(input, "sourceCommit");
  if (!hasBranch && !hasCommit) return null;

  const sourceBranch =
    typeof input.sourceBranch === "string" ? input.sourceBranch.trim() : "";
  const sourceCommit =
    typeof input.sourceCommit === "string" ? input.sourceCommit.trim() : "";
  if (!sourceBranch || !sourceCommit) {
    return "binding workflow spec-live-reconciliation requires input.sourceBranch and input.sourceCommit together, or omission of both";
  }
  const normalizedBranch = sourceBranch.replace(/^refs\/heads\//, "");
  if (!normalizedBranch.startsWith("task/")) {
    return "binding workflow spec-live-reconciliation requires explicit input.sourceBranch to be a dedicated task/ branch";
  }
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    return "binding workflow spec-live-reconciliation requires input.sourceCommit to be an exact 40-character Git commit";
  }
  return null;
}
const actionInputSchema = Type.Object({}, { additionalProperties: true });
const targetedTaskActionInputSchema = Type.Object(
  { taskId: Type.Optional(Type.String({ minLength: 1 })) },
  { additionalProperties: true },
);

type AppTaskEvent = Record<string, unknown>;

const canonicalDetailsSchema = Type.Record(Type.String(), Type.Unknown());

export const aksInputSchema = Type.Union(
  [
    "owner-review",
    "approval-decision",
    "problem-investigation",
    "stall-review",
    "approval-dispatch",
    "task-control",
  ].map((kind) =>
    Type.Object(
      { kind: Type.Literal(kind), data: canonicalDetailsSchema },
      { additionalProperties: false },
    ),
  ),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** Compatibility-normalize existing resolver inputs without importing the legacy SDK. */
function eventDetails(event: AppTaskEvent): Record<string, unknown> {
  const data = isRecord(event.data) ? event.data : {};
  const params = isRecord(data.params) ? data.params : {};
  const target = isRecord(event.target) ? event.target : {};
  return { ...target, ...data, ...params, ...event };
}

function canonicalEventData(
  event: AppEvent<Record<string, unknown>>,
): Record<string, unknown> {
  return isRecord(event.data) ? event.data : {};
}

function canonicalInput(
  kind: AppInput["kind"],
  data: Record<string, unknown>,
): AppInput {
  return { kind, data };
}

export function inputForAksEvent(
  event: AppEvent<Record<string, unknown>>,
): AppInput | null {
  const data = canonicalEventData(event);
  switch (event.type) {
    case "project.owner.requested":
    case "project.comment.created":
      return canonicalInput("owner-review", data);
    case "message.created":
      return data.intent === "approval-decision"
        ? canonicalInput("approval-decision", {
            ...data,
            ...(event.owner ? { sourceMessageOwner: event.owner } : {}),
          })
        : null;
    case "project.problem.investigation.requested":
      return canonicalInput("problem-investigation", data);
    case "project.stall.review.requested":
      return canonicalInput("stall-review", data);
    case "project.approval.requested":
      return canonicalInput("approval-dispatch", data);
    default:
      return null;
  }
}

export const canonicalAksSubscriptions: AppEventSubscription[] = [
  {
    id: "project-owner-request",
    event: { type: "project.owner.requested", project: projectId },
    toInput: inputForAksEvent,
  },
  {
    id: "project-comment",
    event: { type: "project.comment.created", project: projectId },
    toInput: inputForAksEvent,
  },
  {
    id: "approval-message",
    event: {
      type: "message.created",
      owner: "agent:app-ops",
      intents: ["approval-decision"],
    },
    toInput: inputForAksEvent,
  },
  {
    id: "problem-investigation",
    event: {
      type: "project.problem.investigation.requested",
      project: projectId,
    },
    toInput: inputForAksEvent,
  },
  {
    id: "stall-review",
    event: { type: "project.stall.review.requested", project: projectId },
    toInput: inputForAksEvent,
  },
  {
    id: "approval-dispatch",
    event: { type: "project.approval.requested", project: projectId },
    toInput: inputForAksEvent,
  },
];

/**
 * Watcher facts that are intentionally observational after exact task,
 * Condition, and App routes have had the first opportunity to consume them.
 * Source constraints keep unknown producers visible as unexpected signals.
 */
export const canonicalAksObservations: CanonicalEventSelector[] = [
  ...[
    "pipeline-run.state",
    "pipeline.spec.observed",
    "pipeline-artifact.available",
    "pipeline.completed",
  ].map(
    (type) =>
      ({
        type,
        project: projectId,
        source: "aks-pipeline-watcher",
      }) as CanonicalEventSelector,
  ),
  ...["aks.repo-ref.observed", "aks.repo-ref.changed"].map(
    (type) =>
      ({
        type,
        project: projectId,
        source: "aks-repo-ref-watcher",
      }) as CanonicalEventSelector,
  ),
];

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

function masterValidationFailureTaskId(specId: string): string {
  return `domain/master-validation-failure/${safeTaskIdPart(specId, "spec")}`;
}

function masterValidationEvidenceCarrierTaskId(
  pipelineRunId: string,
  sliceId: string,
): string {
  return `ops/master-validation-evidence-carrier/${safeTaskIdPart(
    `${pipelineRunId}-${sliceId}`,
    "pipeline-artifact",
  )}`;
}

const masterValidationCycleIntervalMs = 21_600_000;
const ownerReviewEventTypes = new Set([
  "project.owner.review.requested",
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

function ownerReviewPriority(event: AppTaskEvent): "P0" | "P1" {
  const details = eventDetails(event);
  const reason = stringDetail(details, "reason");
  const inputEventType = stringDetail(details, "inputEventType");
  return event.type === "project.comment.created" ||
    event.type === "project.approval.submitted" ||
    reason === "owner-message" ||
    reason === "human-goal-follow-through" ||
    inputEventType === "message.created"
    ? "P0"
    : "P1";
}

function ownerReviewTaskIntent(event: AppTaskEvent): TaskIntent {
  return {
    id: "runtime/owner-review",
    parentId: "group/app-operations",
    outcome:
      "Keep the AKS project reviewed by its accountable owner and organize the smallest useful next step from current evidence.",
    acceptance: [
      "The owner performs one useful project step or returns an evidence-backed no-op with typed follow-up actions.",
      "Any finite follow-up created by owner review must be a sibling under group/app-operations or group/domain-work; runtime/owner-review is an inbox and never waits on unrelated child work.",
      "A progressive master-validation nonpassing event without an artifact-backed stable failure carrier is progress evidence only: inspect or report it, but do not classify it, change source, or queue a retry before pipeline.failure.observed supplies the terminal artifact.",
      "Do not create domain/normalize-plain-scenario-carrier-* tasks from owner review. scenario-normalization is the sole frontier and live-capacity owner for that work.",
      "When scenario inventory is red or normalization capacity appears free, wake the existing scenario-normalization task with current evidence and let its workflow select any new leaves.",
    ],
    mode: "maintain",
    owner: "app-ops",
    priority: ownerReviewPriority(event),
  };
}

/**
 * Canonical task admission excludes addressed inputs and exact task wakes.
 * `project.task.tick` is intentionally absent: its `(appId, taskId)` target is
 * already the complete routing decision.
 */
export const canonicalAksTaskSelectors: CanonicalEventSelector[] = [
  { type: "project.owner.review.requested", project: projectId },
  {
    type: "aks.waiting-frontier-retirement.requested",
    project: projectId,
  },
  { type: "pipeline.failure.observed", project: projectId },
  { type: "project.test_run.completed", project: projectId },
  { type: "project.stall.reviewed", project: projectId },
  { type: "project.problem.resolved", project: projectId },
  { type: "project.problem.escalated", project: projectId },
  { type: "project.problem.inconclusive", project: projectId },
  { type: "coverage.gap.detected", project: projectId },
  { type: "escalation.resolved", owner: "agent:aks-explorer" },
  { type: "escalation.dismissed", owner: "agent:aks-explorer" },
  { type: "metric.breach", owner: "agent:app-ops" },
  { type: "metric.recovered", owner: "agent:app-ops" },
  { type: "learning.feedback", owner: "agent:aks-explorer" },
  { type: "learning.feedback", owner: "agent:aks-reviewer" },
  { type: "pipeline.test.nonpassing", project: projectId },
  { type: "aks.workspace.integrity.changed", project: projectId },
  {
    type: "aks.scenario-test-inventory.observed",
    project: projectId,
  },
  { type: "pipeline.queue.overdue", project: projectId },
];

export function resolveAksTask(
  event: Record<string, unknown>,
): TaskIntent | null {
  const details = eventDetails(event);
  const taskId = targetTaskId(event);

  if (event.type === "aks.waiting-frontier-retirement.requested") {
    return {
      id: "runtime/waiting-frontier-review",
      parentId: "group/app-operations",
      outcome:
        "Finish the existing direct children of the retired waiting-frontier scheduler, then leave the live graph.",
      acceptance: [
        "Create no new recovery, review, holder, or scheduling tasks.",
        "While an existing direct child is live, wait on that child and rely on shared parent wakeup.",
        "Converge after the last existing direct child leaves the live graph.",
      ],
      mode: "achieve",
      owner: "app-ops",
      workflow: "retire-waiting-frontier",
      input: { migration: "waiting-frontier-retirement-v1" },
      priority: "P0",
      category: "ops",
    };
  }

  if (event.type === "pipeline.failure.observed") {
    const specId = stringDetail(details, "specId", "spec_id");
    const failureFingerprint = stringDetail(
      details,
      "failureFingerprint",
      "fingerprint",
    );
    if (!specId || !failureFingerprint) return null;
    const failureCategory = stringDetail(details, "category");
    const pipelineRunId = stringDetail(details, "pipelineRunId", "runId");
    const sliceId = stringDetail(details, "sliceId");
    if (failureCategory === "terminal_artifact_unavailable") {
      return {
        id: masterValidationEvidenceCarrierTaskId(pipelineRunId, sliceId),
        parentId: "group/app-operations",
        outcome: `Reconcile the terminal evidence-carrier gap for master-validation run ${pipelineRunId || "unknown"} without treating its watcher incident identifier as an executable repository spec.`,
        acceptance: [
          "Inspect the exact terminal build, timeline/log, and available artifact facts before deciding whether the gap is cancellation, app observation failure, repository pipeline failure, or a product/spec result.",
          "Never send a watcher-generated pipeline incident identifier through spec-catalog or live-spec admission.",
          "A manual cancellation or other terminal attempt disposition is recorded without inventing a source repair; a concrete repository or product defect is routed as the smallest exact domain task with the real selected spec or campaign scope.",
          "Leave one truthful disposition for the affected run and do not queue an unchanged retry from evidence-carrier absence alone.",
        ],
        mode: "achieve",
        owner: "app-ops",
        input: {
          validationTaskId: masterValidationCycleTaskId,
          pipelineRunId,
          sourceBranch: stringDetail(details, "sourceBranch") || "main",
          sourceCommit: stringDetail(details, "sourceCommit", "sourceVersion"),
          sliceId,
          status: stringDetail(details, "status"),
          category: failureCategory,
          reason: stringDetail(details, "reason"),
          artifactName: stringDetail(details, "artifactName"),
          artifactPath: stringDetail(details, "artifactPath"),
          watcherIncidentId: specId,
          failureFingerprint,
        },
        priority: "P0",
        category: "ops",
      };
    }
    const pipelineFailure =
      failureCategory === "pipeline_failure" || specId.startsWith("pipeline.");
    return {
      id: masterValidationFailureTaskId(specId),
      parentId: "group/domain-work",
      outcome: pipelineFailure
        ? "Repair the repository-owned master-validation pipeline/bootstrap failure that prevented any parseable spec verdict, then prove the accumulated fix through the frozen campaign and current main."
        : `Classify and resolve the progressively observed master-validation failure or temporary admission exclusion for ${specId} without waiting for the aggregate pipeline to finish.`,
      acceptance: pipelineFailure
        ? [
            "Inspect the exact failed Azure pipeline step and logs; absence of a spec verdict is actionable pipeline repair, not an inconclusive product result.",
            "Keep the repair in one focused PR to current main and replay only its focused patch onto the frozen campaign without waiting for PR merge or importing main ancestry.",
            "A later campaign must progress beyond the failed bootstrap; any newly exposed failure remains active repair work on the same campaign.",
            "The issue remains open until the focused fix merges and a full run from current main passes.",
          ]
        : [
            "The failure is classified as test_issue, prod_issue, or inconclusive from the completed slice artifact or machine-readable admission report.",
            "A temporary admission exclusion keeps unrelated slices running but remains a test issue until the intended carrier is admitted and later passes from current main.",
            "Recovery follows the claim-bearing execution route. Usually that is the current-main aggregate; when generic staging cannot exercise the claim, one direct spec-live child must produce an applicable current-main pass on the recorded standalone target and integrate any repair.",
            "Excluding a misrouted spec may keep the aggregate moving, but exclusion alone never verifies the claim and never closes the issue.",
            "A squash or rebase merge is valid when Azure reports the exact tested PR head and its resulting merged commit is present in main; the PR head itself does not need to remain in main ancestry.",
            "A product issue leaves source unchanged, notifies the human operator through message.created for Telegram delivery, and remains open until a deployed product fix passes the affected spec from current main.",
            "Repeated observations and changed failure fingerprints revise this one current spec task and its Condition; fingerprints remain episode evidence and do not create parallel carriers or per-run recovery tasks.",
            "Classification, notification, PR creation, PR merge, and unrelated main advancement are progress evidence; none alone is final verification.",
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
        category: failureCategory,
        failureScope: pipelineFailure ? "pipeline" : "spec",
        reason: stringDetail(details, "reason"),
        artifactName: stringDetail(details, "artifactName"),
        artifactPath: stringDetail(details, "artifactPath"),
        progressiveObservation: details.progressiveObservation === true,
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
    return ownerReviewTaskIntent(event);
  }

  switch (event.type) {
    case "project.task.tick": {
      const action = stringDetail(details, "action");
      if (action === "spec-loop" || taskId === specLoopTaskId) {
        return standingLoopIntent(specLoopTaskId);
      }
      if (
        action === "feature-compact-loop" ||
        taskId === featureCompactLoopTaskId
      ) {
        return standingLoopIntent(featureCompactLoopTaskId);
      }
      if (
        action === "master-validation-compact" ||
        taskId === masterValidationCompactTaskId
      ) {
        return standingLoopIntent(masterValidationCompactTaskId);
      }
      if (taskId === scenarioTestFrontierTaskId) {
        return standingLoopIntent(scenarioNormalizationTaskId);
      }
      if (taskId === masterValidationCycleTaskId) {
        return {
          id: masterValidationCycleTaskId,
          parentId: "group/domain-work",
          outcome:
            "Preserve all 79 Go source lanes mapped to all 82 master-validation specs, pass every aggregate-runnable spec in one fresh exact-current-main staging run, and preserve an exact current-main standalone pass for every standalone-only spec.",
          acceptance: [
            "Each due cycle queues pipeline 467665 with feature_set=master-validation, target=staging, slices=9, slice_max_parallel=9, parallel=3, branch main, and the exact resolved origin/main commit.",
            "The source-to-spec inventory remains complete: all 79 goal Go source lanes are represented by all 82 mapped specs, with no lane or mapped spec silently dropped.",
            "Every aggregate-runnable spec passes in one fresh staging aggregate run from the exact current origin/main commit.",
            "Every standalone-only spec has a passing direct standalone run from the exact current origin/main commit; aggregate exclusion is routing evidence only and never counts as a pass.",
            "Only one aggregate master-validation cycle is active at a time.",
            "Completed slice artifacts are observed while the aggregate run is still active and each nonpassing spec has one current sibling known-issue task; changed failure fingerprints remain episode history on that task.",
            "A failed main run forks one campaign branch from that exact commit; focused issue patches replay onto it in stable order and its focused PRs continue targeting main.",
            "A failed campaign reruns immediately when its accumulated focused patches change and every six hours when unchanged, so repository fixes and deployed product recovery are both observed.",
            "When main advances, an already-active aggregate may finish without overlap; meanwhile one successor carries the same isolated patch set onto the exact new main base, avoiding rediscovery of known failures while preserving one ordered campaign.",
            "A focused-patch replay conflict waits on the exact pull-request state or source-head change; it does not hand the standing cycle to an owner or create campaign-repair scheduling work.",
            "Keep only draft PRs that still carry a required, unmerged repair: abandon a draft when exact current-main proof makes it unnecessary or a newer same-task PR supersedes it, and never publish an unverified draft for human review.",
            "Publish a focused PR only after its affected spec passes from the exact branch and commit still at that PR head; a green combined campaign is integration evidence but cannot publish an individually unverified draft. Any later commit requires fresh exact-head proof. The standing task is green only when the later fresh exact-current-main aggregate passes every aggregate-runnable spec and exact-current-main standalone proof passes every standalone-only spec.",
          ],
          mode: "maintain",
          owner: "app-ops",
          workflow: "master-validation-cycle",
          input: {
            featureSet: "master-validation",
            intervalMs: 21_600_000,
            pipelineId: "467665",
            sourceBranch: "main",
            campaignBranchConvention:
              "validation/master-validation-<baseline-run-id>",
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
      if (
        action === "repository-skill-maintenance" ||
        taskId === repositorySkillMaintenanceTaskId
      ) {
        return standingLoopIntent(repositorySkillMaintenanceTaskId);
      }
      return null;
    }
    case "project.problem.investigation.requested": {
      const problemKey = stringDetail(
        details,
        "problemKey",
        "problem_key",
        "correlationKey",
        "correlation_key",
        "taskId",
        "task_id",
        "reason",
      );
      const affectedTaskId =
        taskId || stringDetail(details, "taskId", "task_id") || null;
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
        input: {
          problemKey,
          targetTaskId: affectedTaskId,
          requestedOutcome: stringDetail(details, "outcome") || null,
          constraints: Array.isArray(details.constraints)
            ? details.constraints
            : [],
          requiredProof: Array.isArray(details.requiredProof)
            ? details.requiredProof
            : [],
          requestContext: details,
        },
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
    case "project.approval.requested": {
      const params = recordDetail(details, "params") ?? {};
      const approvalKey =
        stringDetail(
          details,
          "approvalId",
          "approval_id",
          "pathId",
          "path_id",
          "packetPath",
          "packet_path",
          "taskId",
          "task_id",
        ) ||
        stringDetail(
          params,
          "approvalId",
          "approval_id",
          "pathId",
          "path_id",
          "packetPath",
          "packet_path",
          "taskId",
          "task_id",
        );
      const packetPath =
        stringDetail(details, "packetPath", "packet_path") ||
        stringDetail(params, "packetPath", "packet_path");
      const pathId =
        stringDetail(details, "pathId", "path_id") ||
        stringDetail(params, "pathId", "path_id");
      const requestedAction =
        stringDetail(details, "requestedAction", "requested_action") ||
        stringDetail(params, "requestedAction", "requested_action");
      const reason =
        stringDetail(details, "reason") || stringDetail(params, "reason");
      const summary =
        stringDetail(details, "summary") || stringDetail(params, "summary");
      const target =
        stringDetail(details, "target") || stringDetail(params, "target");
      const authority =
        stringDetail(details, "authority") || stringDetail(params, "authority");
      const requiresHumanDecision =
        details.requiresHumanDecision === true ||
        details.requires_human_decision === true ||
        params.requiresHumanDecision === true ||
        params.requires_human_decision === true;
      const approvalId =
        stringDetail(details, "approvalId", "approval_id") ||
        stringDetail(params, "approvalId", "approval_id");
      const waitId =
        stringDetail(details, "waitId", "wait_id") ||
        stringDetail(params, "waitId", "wait_id");
      return {
        id: `runtime/approval-dispatch/${safeTaskIdPart(approvalKey, "pending")}`,
        parentId: "group/app-operations",
        outcome:
          "Route one exact AKS decision packet to its declared owner and use the human channel only for an explicit human authority boundary.",
        acceptance: [
          "A valid packet is delivered once for its semantic correlation key, or missing/invalid input is reported with evidence.",
        ],
        mode: "achieve",
        owner: "app-ops",
        workflow: "approval-dispatch",
        input: {
          approvalKey,
          approvalId,
          packetPath,
          pathId,
          reason,
          requestedAction,
          summary,
          target,
          authority,
          requiresHumanDecision,
          targetTaskId: taskId || null,
          waitId,
        },
        priority: "P1",
      };
    }
    default:
      return null;
  }
}

export function resolveCanonicalAksTask(
  event: AppEvent<Record<string, unknown>>,
): TaskIntent | null {
  if (
    !canonicalAksTaskSelectors.some((selector) =>
      matchesCanonicalEventSelector(selector, event),
    )
  ) {
    return null;
  }

  const legacyShape = event as unknown as Record<string, unknown>;
  if (
    event.type === "pipeline.test.nonpassing" ||
    event.type === "aks.workspace.integrity.changed"
  ) {
    return ownerReviewTaskIntent(legacyShape) as TaskIntent;
  }
  if (event.type === "aks.scenario-test-inventory.observed") {
    return standingLoopIntent(scenarioNormalizationTaskId) as TaskIntent;
  }
  if (event.type === "pipeline.queue.overdue") {
    const details = canonicalEventData(event);
    const runId = stringDetail(details, "pipelineRunId", "runId");
    if (!runId) return null;
    return {
      id: `runtime/pipeline-queue-overdue/${safeTaskIdPart(runId, "unknown")}`,
      parentId: "group/app-operations",
      outcome: `Notify the human operator once that AKS master-validation run ${runId} is still waiting for hosted-agent capacity without canceling or duplicating the run.`,
      acceptance: [
        "The exact overdue run and queue scope are reported once through durable human delivery, or the task records why notification is no longer applicable.",
      ],
      mode: "achieve",
      owner: "app-ops",
      input: details,
      priority: "P2",
      category: "ops",
    };
  }
  return resolveAksTask(legacyShape) as TaskIntent | null;
}

function taskIntentForAksInput(input: AppInput): TaskIntent | null {
  const data = isRecord(input.data) ? input.data : {};
  const event = (type: string): Record<string, unknown> => ({
    type,
    target: { project: projectId },
    data: { project: projectId, ...data },
  });

  switch (input.kind) {
    case "owner-review":
      return ownerReviewTaskIntent(
        event("project.owner.requested"),
      ) as TaskIntent;
    case "problem-investigation":
      return resolveAksTask(
        event("project.problem.investigation.requested"),
      ) as TaskIntent | null;
    case "stall-review":
      return resolveAksTask(
        event("project.stall.review.requested"),
      ) as TaskIntent | null;
    case "approval-dispatch":
      return resolveAksTask(
        event("project.approval.requested"),
      ) as TaskIntent | null;
    case "approval-decision": {
      const decision = parseApprovalDecision(data);
      if (!decision) return null;
      return {
        id: `runtime/approval-decision/${safeTaskIdPart(`${decision.approvalId}-${decision.decision}`, "decision")}`,
        parentId: "group/app-operations",
        outcome: `Apply the ${decision.decision} reply for approval ${decision.approvalId} to its exact declared AKS wait and close the source message.`,
        acceptance: [
          "The reply matches one exact open approval wait and publishes project.approval.submitted with the preserved approval and wait identities.",
          "The source message is resolved only after the decision fact is durably emitted.",
        ],
        mode: "achieve",
        owner: "app-ops",
        workflow: "approval-decision",
        input: { ...data, ...decision },
        priority: "P0",
        category: "ops",
      };
    }
    case "task-control": {
      const intent = resolveAksTask({
        ...event("project.task.tick"),
        action: stringDetail(data, "action"),
      }) as TaskIntent | null;
      const pulseId = stringDetail(
        recordDetail(data, "params") ?? {},
        "pulseId",
      );
      if (intent && pulseId) {
        intent.input = { ...(intent.input ?? {}), pulseId };
      }
      return intent;
    }
    default:
      return null;
  }
}

function requestedOwnerWorkIntent(
  admitted: Readonly<AppTaskInput>,
): TaskIntent | null {
  if (admitted.input.kind !== "owner-review") return null;
  const data = isRecord(admitted.input.data) ? admitted.input.data : {};
  const params = recordDetail(data, "params") ?? {};
  const outcome = stringDetail(params, "outcome");
  if (!outcome) return null;
  const requestedAcceptance = [
    ...(Array.isArray(params.constraints) ? params.constraints : []),
    ...(Array.isArray(params.requiredProof) ? params.requiredProof : []),
  ].filter(
    (value): value is string =>
      typeof value === "string" && Boolean(value.trim()),
  );
  return {
    id: `ops/app-request/${safeTaskIdPart(admitted.id, "owner-work")}`,
    parentId: "group/app-operations",
    outcome,
    acceptance: requestedAcceptance.length
      ? requestedAcceptance
      : [
          "Return a terminal result with exact change and verification evidence.",
        ],
    mode: "achieve",
    owner: "app-ops",
    input: {
      requestId: admitted.id,
      source: admitted.source,
      ...data,
      params,
    },
    priority: "P0",
    category: "ops",
  };
}

export function taskForCanonicalAksInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  const requestedWork = requestedOwnerWorkIntent(admitted);
  if (requestedWork) {
    return { kind: "desired", intent: requestedWork };
  }
  const intent = taskIntentForAksInput(admitted.input);
  if (intent?.workflow === "approval-decision") {
    const sourceMessageEventId = Number(
      admitted.source.id.replace(/^event:/, ""),
    );
    intent.input = {
      ...(intent.input ?? {}),
      ...(Number.isSafeInteger(sourceMessageEventId) && sourceMessageEventId > 0
        ? { sourceMessageEventId }
        : {}),
    };
  }
  return {
    kind: "desired",
    intent: intent ?? {
      id: `ops/app-request/${safeTaskIdPart(admitted.id, "input")}`,
      parentId: "group/app-operations",
      outcome: `Interpret and handle admitted AKS input ${admitted.input.kind}.`,
      acceptance: [
        "The app-ops owner returns an evidence-backed result or an exact observable wait.",
      ],
      mode: "achieve",
      owner: "app-ops",
      input: {
        requestId: admitted.id,
        source: admitted.source,
        kind: admitted.input.kind,
        data: isRecord(admitted.input.data) ? admitted.input.data : {},
      },
      priority: "P0",
      category: "ops",
    },
  };
}

function actionParams(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function ownerReviewInput(reason: string, params: unknown = {}): AppInput {
  return canonicalInput("owner-review", {
    project: projectId,
    reason,
    params: actionParams(params),
  });
}

function taskControlInput(
  action: string,
  taskId: string,
  params: unknown,
): AppInput {
  return canonicalInput("task-control", {
    project: projectId,
    action,
    taskId,
    task_id: taskId,
    params: {
      ...actionParams(params),
      pulseId: crypto.randomUUID(),
    },
  });
}

function scheduledTaskWake(
  taskId: string,
  action: string,
  reason: string,
): AppEvent<Record<string, unknown>> {
  return {
    type: "project.task.tick",
    source: "aks-rp-e2e-app",
    action,
    target: { appId: projectId, project: projectId, taskId },
    data: {
      project: projectId,
      taskId,
      task_id: taskId,
      action,
      reason,
    },
  };
}

function scheduledOwnerReviewWake(
  reason: string,
  params: Record<string, unknown>,
): AppEvent<Record<string, unknown>> {
  return {
    type: "project.owner.review.requested",
    source: "aks-rp-e2e-app",
    target: { appId: projectId, project: projectId },
    data: { project: projectId, reason, params },
  };
}

const app = defineApp({
  id: projectId,
  version: 1,
  owner: "app-ops",
  description:
    "AKS RP E2E feature knowledge, spec verification, and project reconciliation.",
  inputSchema: aksInputSchema,
  inbox: { maxConcurrent: appOpsSupportConcurrent },
  task: taskForCanonicalAksInput,
  workspace: {
    kind: "git",
    localPath: "../aks-rp-e2e",
    branch: "dev",
  },
  subscriptions: canonicalAksSubscriptions,
  observations: canonicalAksObservations,
  observers: aksObservers,
  schedules: [
    {
      id: "master-validation-staging-cycle",
      intervalMs: masterValidationCycleIntervalMs,
      event: scheduledTaskWake(
        masterValidationCycleTaskId,
        "master-validation-cycle",
        "scheduled-six-hour-master-validation",
      ),
    },
    {
      id: "regular-learning",
      intervalMs: 3_600_000,
      event: scheduledOwnerReviewWake("scheduled-learning", {
        lane: "learning",
        maxConcurrent: domainPolicyMaxConcurrent,
      }),
    },
    {
      id: "durable-spec-loop-pulse",
      intervalMs: 600_000,
      event: scheduledTaskWake(
        specLoopTaskId,
        "spec-loop",
        "scheduled-durable-loop-pulse",
      ),
    },
    {
      id: "durable-feature-compact-loop-pulse",
      intervalMs: 605_000,
      event: scheduledTaskWake(
        featureCompactLoopTaskId,
        "feature-compact-loop",
        "scheduled-durable-loop-pulse",
      ),
    },
    {
      id: "durable-master-validation-compact-pulse",
      intervalMs: 610_000,
      event: scheduledTaskWake(
        masterValidationCompactTaskId,
        "master-validation-compact",
        "scheduled-durable-loop-pulse",
      ),
    },
    {
      id: "repository-skill-maintenance",
      intervalMs: 86_400_000,
      event: scheduledTaskWake(
        repositorySkillMaintenanceTaskId,
        "repository-skill-maintenance",
        "scheduled-repository-skill-maintenance",
      ),
    },
    {
      id: "app-ops-heartbeat",
      intervalMs: 14_400_000,
      event: scheduledOwnerReviewWake("app-ops-heartbeat", {
        maxConcurrent: domainPolicyMaxConcurrent,
        instruction:
          "Review missed project motion opportunities that fixed schedules and metrics did not catch; take one bounded useful step or record an exact evidence-backed no-op.",
      }),
    },
  ],
  actions: {
    "execute-run": {
      description: "Request live execution for selected replanned paths.",
      inputSchema: actionInputSchema,
      toInput: (params) => ownerReviewInput("execute-run-action", params),
    },
    "advance-project": {
      description:
        "Advance the project task tree until genuinely blocked, complete, or interrupted by an infra guard.",
      inputSchema: actionInputSchema,
      toInput: (params) => ownerReviewInput("manual-action", params),
    },
    watch: {
      description: "Start or resume app-ops review through the task tree.",
      inputSchema: actionInputSchema,
      toInput: (params) => ownerReviewInput("watch-request", params),
    },
    "investigate-problem": {
      description:
        "Ask the problem solver to investigate one bounded blocker or root cause.",
      inputSchema: actionInputSchema,
      toInput: (params) =>
        canonicalInput("problem-investigation", {
          project: projectId,
          reason: "manual-problem-investigation-request",
          params: actionParams(params),
        }),
    },
    "review-stall-risk": {
      description:
        "Collect and judge suspicious stalled work without pulsing controllers.",
      inputSchema: actionInputSchema,
      toInput: (params) =>
        canonicalInput("stall-review", {
          project: projectId,
          reason: "manual-stall-risk-review",
          mode: "risk-review",
          params: actionParams(params),
        }),
    },
    "dispatch-approval-packet": {
      description:
        "Route one packet-linked decision to the project owner, escalating only for an explicit human authority boundary.",
      inputSchema: actionInputSchema,
      toInput: (params) =>
        canonicalInput("approval-dispatch", {
          project: projectId,
          reason: "manual-approval-packet-dispatch-request",
          params: actionParams(params),
        }),
    },
    "pulse-spec-loop": {
      description: "Pulse the stable spec verification loop.",
      inputSchema: targetedTaskActionInputSchema,
      toInput: (params) =>
        taskControlInput(
          "spec-loop",
          stringDetail(actionParams(params), "taskId") || specLoopTaskId,
          params,
        ),
    },
    "pulse-feature-compact-loop": {
      description: "Pulse the stable feature compact loop.",
      inputSchema: targetedTaskActionInputSchema,
      toInput: (params) =>
        taskControlInput(
          "feature-compact-loop",
          stringDetail(actionParams(params), "taskId") ||
            featureCompactLoopTaskId,
          params,
        ),
    },
    "pulse-master-validation-compact": {
      description:
        "Pulse the stable staging master-validation compact campaign.",
      inputSchema: targetedTaskActionInputSchema,
      toInput: (params) =>
        taskControlInput(
          "master-validation-compact",
          stringDetail(actionParams(params), "taskId") ||
            masterValidationCompactTaskId,
          params,
        ),
    },
    "pulse-scenario-frontier": {
      description: "Pulse the scenario normalization frontier.",
      inputSchema: actionInputSchema,
      toInput: (params) =>
        taskControlInput(
          "scenario-normalization",
          scenarioTestFrontierTaskId,
          params,
        ),
    },
    "pulse-legacy-branch-reconciliation": {
      description: "Reconcile retained legacy task branches into origin/dev.",
      inputSchema: actionInputSchema,
      toInput: (params) =>
        taskControlInput(
          "legacy-branch-reconciliation",
          legacyBranchReconciliationTaskId,
          params,
        ),
    },
    "pulse-repository-skill-maintenance": {
      description: "Evaluate the checked-in AKS RP E2E repository skill.",
      inputSchema: actionInputSchema,
      toInput: (params) =>
        taskControlInput(
          "repository-skill-maintenance",
          repositorySkillMaintenanceTaskId,
          params,
        ),
    },
  },
  tasks: {
    subscriptions: canonicalAksTaskSelectors,
    resolve: resolveCanonicalAksTask,
    validateAction: validateAksTaskAction,
    maxConcurrent: appControllerMaxConcurrent,
    resyncIntervalMs: 60_000,
  },
});

export default app;
