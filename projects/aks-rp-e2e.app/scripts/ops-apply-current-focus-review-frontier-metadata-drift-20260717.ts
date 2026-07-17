import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type Snapshot = {
  focusTaskGoal: string | null;
  focusTaskAcceptance: string[];
  focusTaskContext: JsonRecord;
  proposal: JsonRecord;
  rootReadout: JsonRecord;
  runtimeCurrentFocus: JsonRecord;
  runtimeFocusMission: JsonRecord;
  repairTaskAcceptance: string[];
};

const appDir = process.cwd();
const projectDir = `${appDir}/../aks-rp-e2e`;
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const apply = process.env.APPLY === "1";
const checkedAt = new Date().toISOString();
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops_apply-current-focus-review-frontier-metadata-drift-20260717_manual";
const projectTaskId = "project";
const focusTaskId = "focus-same-spec-verification-fix-forward-followthrough-20260715";
const selfTaskId = "ops/apply-current-focus-review-frontier-metadata-drift-20260717";
const evidencePath =
  "evidence/archive/ops-apply-current-focus-review-frontier-metadata-drift-20260717.md";

const namedForbiddenIds = [
  "domain/recheck-rp-regional-quota-public-create-path-exhausted-headroom-20260717",
  "domain/recheck-traffic-managed-gateway-api-create-lifecycle-run-172661596-terminal-review-20260717b",
  "fix-private-cluster-private-endpoint-connections-lifecycle-run-172648652",
  "ops/repair-pending-reviewed-event-application-stall-20260717",
  selfTaskId,
] as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asMutableRecord(value: unknown): JsonRecord {
  return asRecord(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function exactEqual(actual: string[], expected: readonly string[]): boolean {
  return JSON.stringify(actual) === JSON.stringify([...expected]);
}

function captureSnapshot(): Snapshot {
  const runtime = asMutableRecord(loadProjectReadModel(appDir));
  const runtimeCurrentFocus = asMutableRecord(runtime.currentFocus);
  const runtimeFocusMission = asMutableRecord(runtimeCurrentFocus.focusMission);

  let snapshot: Snapshot | undefined;
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    const repairTask = tree.tasks[selfTaskId];
    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);
    assert(repairTask, `Task not found: ${selfTaskId}`);

    const projectContext = asMutableRecord(projectTask.context);
    snapshot = {
      focusTaskGoal:
        typeof focusTask.goal === "string" ? (focusTask.goal as string) : null,
      focusTaskAcceptance: asStringArray(focusTask.acceptance),
      focusTaskContext: asMutableRecord(focusTask.context),
      proposal: asMutableRecord(projectContext.current_focus_proposal),
      rootReadout: asMutableRecord(projectContext.current_root_readout),
      runtimeCurrentFocus,
      runtimeFocusMission,
      repairTaskAcceptance: asStringArray(repairTask.acceptance),
    };
  });

  assert(snapshot, "Failed to capture snapshot");
  return snapshot;
}

function buildState() {
  const baseline = captureSnapshot();
  const liveSummary = summarizeTaskTree(config);

  let liveTaskIds = new Set<string>();
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    liveTaskIds = new Set(Object.keys(tree.tasks));
  });

  const rootReadout = asMutableRecord(baseline.rootReadout);
  const useRootReadout = typeof rootReadout.contract_scope === "string" && rootReadout.contract_scope.length > 0;

  const desiredActive = useRootReadout
    ? asStringArray(rootReadout.active_task_ids_excluding_self).filter(
        (id) => id !== selfTaskId,
      )
    : liveSummary.frontier.active.filter((id) => id !== selfTaskId);
  const desiredReview = useRootReadout
    ? asStringArray(rootReadout.review_task_ids).filter((id) => id !== selfTaskId)
    : liveSummary.frontier.review.filter((id) => id !== selfTaskId);
  const desiredWaiting = useRootReadout
    ? asStringArray(rootReadout.waiting_task_ids).filter((id) => id !== selfTaskId)
    : liveSummary.frontier.waiting.filter((id) => id !== selfTaskId);
  const desiredRunnable = useRootReadout
    ? asStringArray(rootReadout.runnable_task_ids).filter((id) => id !== selfTaskId)
    : liveSummary.frontier.runnable.filter((id) => id !== selfTaskId);

  const proposalContext = asMutableRecord(asMutableRecord(baseline.proposal).context);
  const focusContext = asMutableRecord(baseline.focusTaskContext);
  const baselineLaneLinks = asMutableRecord(focusContext.lane_links);

  const dynamicallyForbidden = unique([
    ...namedForbiddenIds,
    ...asStringArray(proposalContext.active_task_ids).filter((id) => !liveTaskIds.has(id) || id === selfTaskId),
    ...asStringArray(proposalContext.review_task_ids).filter((id) => !liveTaskIds.has(id) || id === selfTaskId),
    ...asStringArray(asMutableRecord(baseline.runtimeCurrentFocus).activeTaskIds).filter((id) => !liveTaskIds.has(id) || id === selfTaskId),
    ...asStringArray(asMutableRecord(baseline.runtimeFocusMission).activeTaskIds).filter((id) => !liveTaskIds.has(id) || id === selfTaskId),
  ]);
  const forbiddenSet = new Set(dynamicallyForbidden);

  const preservedBlocked = unique([
    ...asStringArray(proposalContext.blocked_task_ids),
    ...asStringArray(focusContext.linked_blocked_task_ids),
  ]).filter((taskId) => liveTaskIds.has(taskId) && !forbiddenSet.has(taskId));

  const desiredProposed = unique([
    ...desiredActive,
    ...desiredReview,
    ...preservedBlocked,
  ]);

  const activeList = formatList(desiredActive);
  const reviewList = formatList(desiredReview);
  const waitingList = formatList(desiredWaiting);
  const runnableList = formatList(desiredRunnable);

  const successCriteria = [
    `Current focus metadata surfaces advertise the live frontier active=[${activeList}], review=[${reviewList}], waiting=[${waitingList}], runnable=[${runnableList}].`,
    "Review-only leaves remain in review and the assigned metadata-repair leaf is excluded from the represented frontier so the focus packet stays truthful.",
    "The bounded repair only refreshes focus metadata surfaces and preserved blocked lineage; it does not launch cloud work, reopen execution, or change task review decisions.",
  ];

  const focusTitle = "live frontier follow-through parity";
  const focusGoal =
    `Keep one visible 12-24h focus branch aligned to the current live frontier excluding this metadata-repair leaf: active=[${activeList}], review=[${reviewList}], waiting=[${waitingList}], runnable=[${runnableList}], while preserving existing blocked lineage and avoiding new cloud work from bookkeeping alone.`;
  const focusAcceptance = [
    successCriteria[0],
    "No focus metadata field or lane link advertises stale/non-live ids as current frontier work, and review-only leaves are not listed as active.",
    "The repair stays metadata-only: preserve blocked lineage, keep the current frontier visible, and do not launch a new execution wave from bookkeeping alone.",
  ];
  const progressSummary =
    `Focus metadata now represents active=[${activeList}], review=[${reviewList}], waiting=[${waitingList}], runnable=[${runnableList}] while excluding the metadata-repair leaf itself. The stale self-active packet and stale/non-live current-frontier ids were removed from the focus branch, project proposal, and mirrored runtime currentFocus surfaces without mutating live review decisions.`;
  const proposalReason =
    `Current focus metadata surfaces now advertise active=[${activeList}], review=[${reviewList}], waiting=[${waitingList}], runnable=[${runnableList}]. ` +
    "This bounded repair removes stale/non-live current-frontier ids from the focus branch, project current_focus_proposal, and runtime currentFocus/focusMission while preserving blocked lineage and leaving live task states untouched.";
  const nextAction =
    `Keep the represented active band on ${activeList}, review band on ${reviewList}, preserve blocked lineage ${formatList(preservedBlocked)}, and do not promote stale/non-live ids or launch execution from bookkeeping alone.`;

  const laneLinks = {
    source_discovery: asStringArray(baselineLaneLinks.source_discovery).filter(
      (id) => liveTaskIds.has(id) && !forbiddenSet.has(id),
    ),
    feature_extraction: unique([
      ...asStringArray(baselineLaneLinks.feature_extraction).filter(
        (id) => liveTaskIds.has(id) && !forbiddenSet.has(id),
      ),
      ...desiredReview.filter((id) => id === "reconcile-compact-loop-package-partial"),
    ]),
    spec_generation: asStringArray(baselineLaneLinks.spec_generation).filter(
      (id) => liveTaskIds.has(id) && !forbiddenSet.has(id),
    ),
    replay_implementation: asStringArray(
      baselineLaneLinks.replay_implementation,
    ).filter((id) => liveTaskIds.has(id) && !forbiddenSet.has(id)),
    execution_verification: unique([
      ...desiredActive,
      ...desiredReview.filter((id) => id !== focusTaskId),
    ]),
    model_feedback: asStringArray(baselineLaneLinks.model_feedback).filter(
      (id) => liveTaskIds.has(id) && !forbiddenSet.has(id),
    ),
    publication_visibility: preservedBlocked,
  } satisfies JsonRecord;

  const learnedOrVerified = [
    `Live frontier at capture excluding the metadata-repair leaf is active=${JSON.stringify(desiredActive)}, review=${JSON.stringify(desiredReview)}, waiting=${JSON.stringify(desiredWaiting)}, runnable=${JSON.stringify(desiredRunnable)}.`,
    "Before repair, some focus metadata surfaces were self-inclusive or still carried stale/non-live current-frontier bookkeeping; after repair they match the live frontier excluding the repair leaf.",
    "The repair removes stale/non-live current-frontier bookkeeping from the focus branch, project proposal, and mirrored runtime focus surfaces while preserving blocked lineage.",
  ];

  return {
    baseline,
    desiredActive,
    desiredReview,
    desiredWaiting,
    desiredRunnable,
    preservedBlocked,
    desiredProposed,
    successCriteria,
    focusTitle,
    focusGoal,
    focusAcceptance,
    progressSummary,
    proposalReason,
    nextAction,
    laneLinks,
    learnedOrVerified,
    forbiddenIds: dynamicallyForbidden,
  };
}

function applyState(state: ReturnType<typeof buildState>) {
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    const focusTask = tree.tasks[focusTaskId];
    assert(projectTask, `Task not found: ${projectTaskId}`);
    assert(focusTask, `Task not found: ${focusTaskId}`);

    focusTask.goal = state.focusGoal;
    focusTask.acceptance = state.focusAcceptance;

    const focusContext = asMutableRecord(focusTask.context);
    focusContext.horizon = "12-24h";
    focusContext.success_criteria = state.successCriteria;
    focusContext.lane_links = state.laneLinks;
    focusContext.active_task_ids = state.desiredActive;
    focusContext.review_task_ids = state.desiredReview;
    focusContext.waiting_task_ids = state.desiredWaiting;
    focusContext.runnable_task_ids = state.desiredRunnable;
    focusContext.linked_blocked_task_ids = state.preservedBlocked;
    focusContext.live_review_frontier_task_ids = state.desiredReview;
    focusContext.excluded_review_task_ids = [];
    focusContext.needs_approval = false;
    focusContext.allowed_risk =
      "Allow only metadata parity repair, existing follow-through visibility, and preserved blocked-lineage stewardship. Do not launch new cloud work from focus maintenance alone.";

    const focusProgressReview = asMutableRecord(focusContext.progress_review);
    focusProgressReview.last_reviewed_at = checkedAt;
    focusProgressReview.status = "updated";
    focusProgressReview.summary = state.progressSummary;
    focusProgressReview.evidence = [
      `Attempt ${attemptId} refreshed current focus metadata surfaces to the live frontier excluding the metadata-repair leaf: active=[${formatList(state.desiredActive)}], review=[${formatList(state.desiredReview)}], waiting=[${formatList(state.desiredWaiting)}], runnable=[${formatList(state.desiredRunnable)}].`,
      `Evidence memo: ${evidencePath}`,
    ];
    focusProgressReview.answers = {
      learned_or_verified: state.learnedOrVerified,
      live_execution_posture:
        "Stay in metadata-parity and existing follow-through mode only. This repair does not justify a new cloud mutation or rerun wave.",
      blocker_mix:
        "The represented frontier remains the current live active/review packet excluding the repair task itself; broader blocked waits are preserved rather than re-triaged here.",
      parallel_leafs: `Represent active=${state.desiredActive.length}, review=${state.desiredReview.length}, waiting=${state.desiredWaiting.length}, runnable=${state.desiredRunnable.length} exactly as the live frontier excluding self.`,
      goal_alignment:
        "Removing stale/non-live current-frontier ids keeps the focus packet truthful for owner judgment.",
    };
    focusContext.progress_review = focusProgressReview;

    const focusObservations = asMutableRecord(focusContext.observations);
    focusObservations.frontier_active_leaf_count = state.desiredActive.length;
    focusObservations.frontier_review_leaf_count = state.desiredReview.length;
    focusObservations.frontier_waiting_leaf_count = state.desiredWaiting.length;
    focusObservations.frontier_runnable_leaf_count = state.desiredRunnable.length;
    focusObservations.parallel_work_gap =
      "Represent only the current live active/review packet excluding the metadata-repair leaf itself, and keep blocked lineage preserved without inventing new work.";
    focusObservations.structural_status =
      "Focus metadata surfaces now advertise the current live frontier excluding the metadata-repair leaf rather than stale/non-live packet residue.";
    focusContext.observations = focusObservations;
    focusTask.context = focusContext;
    focusTask.outputs = unique([...asStringArray(focusTask.outputs), evidencePath]);
    focusTask.updated_at = checkedAt;
    focusTask.trace = {
      ...asRecord(focusTask.trace),
      current_focus_review_frontier_metadata_drift_repaired_at: checkedAt,
      current_focus_review_frontier_metadata_drift_repaired_by: "app-ops-script",
      current_focus_review_frontier_metadata_drift_repair_attempt_id: attemptId,
      current_focus_review_frontier_metadata_drift_repair_evidence_path:
        evidencePath,
    };

    const projectContext = asMutableRecord(projectTask.context);
    const proposal = asMutableRecord(projectContext.current_focus_proposal);
    proposal.title = state.focusTitle;
    proposal.reviewed_at = checkedAt;
    proposal.reason = state.proposalReason;
    proposal.evidence_path = evidencePath;

    const proposalContext = asMutableRecord(proposal.context);
    proposalContext.horizon = "12-24h";
    proposalContext.success_criteria = state.successCriteria;
    proposalContext.active_task_ids = state.desiredActive;
    proposalContext.review_task_ids = state.desiredReview;
    proposalContext.waiting_task_ids = state.desiredWaiting;
    proposalContext.runnable_task_ids = state.desiredRunnable;
    proposalContext.blocked_task_ids = state.preservedBlocked;
    proposalContext.proposed_task_ids = state.desiredProposed;
    proposalContext.linked_blocked_task_ids = state.preservedBlocked;
    proposalContext.live_review_frontier_task_ids = state.desiredReview;
    proposalContext.excluded_review_task_ids = [];
    proposalContext.lane_links = state.laneLinks;
    proposalContext.progress_review = {
      reviewed_at: checkedAt,
      result: "updated",
      evidence_path: evidencePath,
      answers: {
        learned_or_verified: state.learnedOrVerified,
        live_execution_posture:
          "This proposal refresh is metadata-only; do not launch new cloud work from the repaired packet.",
        blocker_mix:
          "Preserve blocked lineage while mirroring the live active/review frontier excluding the repair task itself.",
        parallel_leafs: `Represent active=${state.desiredActive.length}, review=${state.desiredReview.length}, waiting=${state.desiredWaiting.length}, runnable=${state.desiredRunnable.length} exactly.`,
        goal_alignment:
          "Removing stale/non-live current-frontier ids keeps planner-visible focus judgment aligned with the live frontier.",
      },
    };
    proposal.context = proposalContext;

    projectContext.current_focus_proposal = proposal;
    projectContext.current_focus_proposal_progress_review_refreshed_at = checkedAt;
    projectContext.current_focus_proposal_progress_review_refreshed_by =
      "app-ops-script";
    projectContext.current_focus_proposal_progress_review_evidence_path =
      evidencePath;
    projectTask.context = projectContext;
    projectTask.outputs = unique([...asStringArray(projectTask.outputs), evidencePath]);
    projectTask.updated_at = checkedAt;
    projectTask.trace = {
      ...asRecord(projectTask.trace),
      current_focus_review_frontier_metadata_drift_repaired_at: checkedAt,
      current_focus_review_frontier_metadata_drift_repaired_by: "app-ops-script",
      current_focus_review_frontier_metadata_drift_repair_attempt_id: attemptId,
      current_focus_review_frontier_metadata_drift_repair_evidence_path:
        evidencePath,
    };

    saveTaskTreeWithKanbanSnapshot(config, tree);
  });

  const runtime = asMutableRecord(loadProjectReadModel(appDir));
  const currentFocus = asMutableRecord(runtime.currentFocus);
  const focusMission = asMutableRecord(currentFocus.focusMission);
  const focusReview = asMutableRecord(currentFocus.focusReview);
  const focusPlan = asMutableRecord(runtime.focusPlan);

  currentFocus.summary = state.progressSummary;
  currentFocus.nextAction = state.nextAction;
  currentFocus.activeTaskIds = state.desiredActive;
  currentFocus.proposedTaskIds = state.desiredProposed;

  focusReview.reviewedAt = checkedAt;
  focusReview.result = "updated";
  focusReview.note = state.proposalReason;
  focusReview.evidencePath = evidencePath;
  currentFocus.focusReview = focusReview;

  focusMission.id = focusTaskId;
  focusMission.title = state.focusTitle;
  focusMission.horizon = "12-24h";
  focusMission.successCriteria = state.successCriteria;
  focusMission.activeTaskIds = state.desiredActive;
  focusMission.reviewTaskIds = state.desiredReview;
  focusMission.waitingTaskIds = state.desiredWaiting;
  focusMission.runnableTaskIds = state.desiredRunnable;
  focusMission.linkedBlockedTaskIds = state.preservedBlocked;
  focusMission.liveReviewFrontierTaskIds = state.desiredReview;
  focusMission.excludedReviewTaskIds = [];
  focusMission.evidencePath = evidencePath;
  currentFocus.focusMission = focusMission;

  focusPlan.summary = state.progressSummary;
  focusPlan.currentProposalId = focusTaskId;
  focusPlan.evidencePath = evidencePath;

  saveProjectRuntimeState(appDir, {
    currentState: asMutableRecord(runtime.currentState),
    currentFocus,
    focusPlan,
    updatedAt: checkedAt,
  });
}

function assertAfterState(
  after: Snapshot,
  state: ReturnType<typeof buildState>,
) {
  const focusContext = asMutableRecord(after.focusTaskContext);
  const proposal = asMutableRecord(after.proposal);
  const proposalContext = asMutableRecord(proposal.context);
  const runtimeCurrentFocus = asMutableRecord(after.runtimeCurrentFocus);
  const runtimeFocusMission = asMutableRecord(after.runtimeFocusMission);

  assert(
    exactEqual(asStringArray(focusContext.active_task_ids), state.desiredActive),
    "Focus task active_task_ids do not match live frontier excluding self",
  );
  assert(
    exactEqual(asStringArray(focusContext.review_task_ids), state.desiredReview),
    "Focus task review_task_ids do not match live frontier excluding self",
  );
  assert(
    exactEqual(asStringArray(proposalContext.active_task_ids), state.desiredActive),
    "Proposal active_task_ids do not match live frontier excluding self",
  );
  assert(
    exactEqual(asStringArray(proposalContext.review_task_ids), state.desiredReview),
    "Proposal review_task_ids do not match live frontier excluding self",
  );
  assert(
    exactEqual(asStringArray(runtimeCurrentFocus.activeTaskIds), state.desiredActive),
    "Runtime currentFocus.activeTaskIds do not match live frontier excluding self",
  );
  assert(
    exactEqual(asStringArray(runtimeFocusMission.activeTaskIds), state.desiredActive),
    "Runtime focusMission.activeTaskIds do not match live frontier excluding self",
  );
  assert(
    exactEqual(asStringArray(runtimeFocusMission.reviewTaskIds), state.desiredReview),
    "Runtime focusMission.reviewTaskIds do not match live frontier excluding self",
  );

  const surfaces = [
    JSON.stringify(focusContext),
    JSON.stringify(proposal),
    JSON.stringify(runtimeCurrentFocus),
    JSON.stringify(runtimeFocusMission),
  ].join("\n");
  for (const forbiddenId of state.forbiddenIds) {
    assert(
      !surfaces.includes(forbiddenId),
      `Forbidden stale current-frontier id still present after repair: ${forbiddenId}`,
    );
  }
}

function writeEvidence(
  before: Snapshot,
  after: Snapshot,
  state: ReturnType<typeof buildState>,
) {
  const beforeFocusContext = asMutableRecord(before.focusTaskContext);
  const beforeProposal = asMutableRecord(before.proposal);
  const beforeProposalContext = asMutableRecord(beforeProposal.context);
  const beforeRuntimeCurrentFocus = asMutableRecord(before.runtimeCurrentFocus);
  const beforeRuntimeFocusMission = asMutableRecord(before.runtimeFocusMission);

  const afterFocusContext = asMutableRecord(after.focusTaskContext);
  const afterProposal = asMutableRecord(after.proposal);
  const afterProposalContext = asMutableRecord(afterProposal.context);
  const afterRuntimeCurrentFocus = asMutableRecord(after.runtimeCurrentFocus);
  const afterRuntimeFocusMission = asMutableRecord(after.runtimeFocusMission);

  const beforeBlob = [
    JSON.stringify(beforeFocusContext),
    JSON.stringify(beforeProposal),
    JSON.stringify(beforeRuntimeCurrentFocus),
    JSON.stringify(beforeRuntimeFocusMission),
  ].join("\n");
  const staleHits = state.forbiddenIds.filter((taskId) => beforeBlob.includes(taskId));

  const memo = `# App apply — current focus review-frontier metadata drift — 2026-07-17

- Attempt: \`${attemptId}\`
- Applied at: \`${checkedAt}\`
- Task: \`${selfTaskId}\`

## Scope

Refresh only the focus metadata surfaces named in the task: the focus branch task, \`project.context.current_focus_proposal\`, and mirrored runtime \`currentFocus\` / \`currentFocus.focusMission\`. No cloud work was launched and no task state/review decision was changed.

## Assigned task acceptance snapshot

The assigned task still asked for:

- ${before.repairTaskAcceptance.join("\n- ")}

## Live frontier used for the repair

Per worker-mode audit rules, the represented frontier excludes the repair task itself.

- active: ${JSON.stringify(state.desiredActive)}
- review: ${JSON.stringify(state.desiredReview)}
- waiting: ${JSON.stringify(state.desiredWaiting)}
- runnable: ${JSON.stringify(state.desiredRunnable)}
- preserved blocked lineage: ${JSON.stringify(state.preservedBlocked)}

## Before-state

### Focus branch before repair

- goal: ${JSON.stringify(before.focusTaskGoal)}
- active_task_ids: ${JSON.stringify(asStringArray(beforeFocusContext.active_task_ids))}
- review_task_ids: ${JSON.stringify(asStringArray(beforeFocusContext.review_task_ids))}
- execution_verification lane: ${JSON.stringify(asStringArray(asMutableRecord(beforeFocusContext.lane_links).execution_verification))}
- success_criteria[0]: ${JSON.stringify(asStringArray(beforeFocusContext.success_criteria)[0] ?? null)}

### project.context.current_focus_proposal before repair

- title: ${JSON.stringify(beforeProposal.title ?? null)}
- active_task_ids: ${JSON.stringify(asStringArray(beforeProposalContext.active_task_ids))}
- review_task_ids: ${JSON.stringify(asStringArray(beforeProposalContext.review_task_ids))}
- proposed_task_ids: ${JSON.stringify(asStringArray(beforeProposalContext.proposed_task_ids))}
- reason: ${JSON.stringify(beforeProposal.reason ?? null)}

### runtime currentFocus before repair

- activeTaskIds: ${JSON.stringify(asStringArray(beforeRuntimeCurrentFocus.activeTaskIds))}
- proposedTaskIds: ${JSON.stringify(asStringArray(beforeRuntimeCurrentFocus.proposedTaskIds))}
- summary: ${JSON.stringify(beforeRuntimeCurrentFocus.summary ?? null)}
- nextAction: ${JSON.stringify(beforeRuntimeCurrentFocus.nextAction ?? null)}

### runtime currentFocus.focusMission before repair

- activeTaskIds: ${JSON.stringify(asStringArray(beforeRuntimeFocusMission.activeTaskIds))}
- reviewTaskIds: ${JSON.stringify(asStringArray(beforeRuntimeFocusMission.reviewTaskIds))}
- successCriteria[0]: ${JSON.stringify(asStringArray(beforeRuntimeFocusMission.successCriteria)[0] ?? null)}
- liveReviewFrontierTaskIds: ${JSON.stringify(asStringArray(beforeRuntimeFocusMission.liveReviewFrontierTaskIds))}

### Stale/non-live current-frontier ids found before repair

${staleHits.length > 0 ? staleHits.map((taskId) => `- ${taskId}`).join("\n") : "- none of the named stale ids were present, but the represented active/review packet still drifted from the live frontier excluding the repair task."}

## After-state

### Focus branch after repair

- goal: ${JSON.stringify(after.focusTaskGoal)}
- active_task_ids: ${JSON.stringify(asStringArray(afterFocusContext.active_task_ids))}
- review_task_ids: ${JSON.stringify(asStringArray(afterFocusContext.review_task_ids))}
- execution_verification lane: ${JSON.stringify(asStringArray(asMutableRecord(afterFocusContext.lane_links).execution_verification))}
- success_criteria[0]: ${JSON.stringify(asStringArray(afterFocusContext.success_criteria)[0] ?? null)}

### project.context.current_focus_proposal after repair

- title: ${JSON.stringify(afterProposal.title ?? null)}
- active_task_ids: ${JSON.stringify(asStringArray(afterProposalContext.active_task_ids))}
- review_task_ids: ${JSON.stringify(asStringArray(afterProposalContext.review_task_ids))}
- proposed_task_ids: ${JSON.stringify(asStringArray(afterProposalContext.proposed_task_ids))}
- reason: ${JSON.stringify(afterProposal.reason ?? null)}

### runtime currentFocus after repair

- activeTaskIds: ${JSON.stringify(asStringArray(afterRuntimeCurrentFocus.activeTaskIds))}
- proposedTaskIds: ${JSON.stringify(asStringArray(afterRuntimeCurrentFocus.proposedTaskIds))}
- summary: ${JSON.stringify(afterRuntimeCurrentFocus.summary ?? null)}
- nextAction: ${JSON.stringify(afterRuntimeCurrentFocus.nextAction ?? null)}

### runtime currentFocus.focusMission after repair

- activeTaskIds: ${JSON.stringify(asStringArray(afterRuntimeFocusMission.activeTaskIds))}
- reviewTaskIds: ${JSON.stringify(asStringArray(afterRuntimeFocusMission.reviewTaskIds))}
- successCriteria[0]: ${JSON.stringify(asStringArray(afterRuntimeFocusMission.successCriteria)[0] ?? null)}
- liveReviewFrontierTaskIds: ${JSON.stringify(asStringArray(afterRuntimeFocusMission.liveReviewFrontierTaskIds))}

## Verification

- Focus branch active/review arrays match the live frontier excluding \`${selfTaskId}\`: yes
- Project current_focus_proposal active/review arrays match the live frontier excluding \`${selfTaskId}\`: yes
- Runtime currentFocus / focusMission active/review arrays match the live frontier excluding \`${selfTaskId}\`: yes
- Named stale/non-live current-frontier ids removed from those surfaces: yes
- Task states and review decisions were not edited by this repair: yes (metadata-only repair)
`;

  const targetPath = `${appDir}/${evidencePath}`;
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, memo);
}

const state = buildState();
if (apply) {
  applyState(state);
}
const after = apply ? captureSnapshot() : state.baseline;
if (apply) {
  assertAfterState(after, state);
  writeEvidence(state.baseline, after, state);
}

console.log(
  JSON.stringify(
    {
      apply,
      checkedAt,
      attemptId,
      evidencePath,
      liveFrontierExcludingSelf: {
        active: state.desiredActive,
        review: state.desiredReview,
        waiting: state.desiredWaiting,
        runnable: state.desiredRunnable,
      },
      forbiddenIds: state.forbiddenIds,
      before: {
        focusTaskContext: state.baseline.focusTaskContext,
        proposal: state.baseline.proposal,
        runtimeCurrentFocus: state.baseline.runtimeCurrentFocus,
        runtimeFocusMission: state.baseline.runtimeFocusMission,
      },
      after,
      applyCommand: `cd ${appDir} && APPLY=1 ATTEMPT_ID=${attemptId} bun run ./scripts/ops-apply-current-focus-review-frontier-metadata-drift-20260717.ts`,
    },
    null,
    2,
  ),
);
