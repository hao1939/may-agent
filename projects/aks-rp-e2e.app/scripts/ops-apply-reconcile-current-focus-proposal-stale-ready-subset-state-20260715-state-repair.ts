import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type Baseline = {
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blockedLeafCount: number;
  topLevelBlockedIds: string[];
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const repairTaskId =
  "ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair";
const projectTaskId = "project";
const focusProposalId =
  "focus-post-ready-subset-review-blocked-frontier-truth-sync-20260715";
const focusTitle = "Post ready-subset review/blocked frontier truth sync";
const archivedWaveLeafId = "domain/spec-windows-ready-subset-followup-20260715";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-current-focus-proposal-stale-ready-subset-state-20260715-state-repair.md";
const attemptId =
  process.env.ATTEMPT_ID ?? "manual-run-no-attempt-id-supplied";
const checkedAt = new Date().toISOString();

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatList(taskIds: string[]): string {
  return taskIds.length > 0 ? taskIds.join(", ") : "none";
}

function frontierVector(baseline: Baseline): string {
  return `active=[${formatList(baseline.active)}], review=[${formatList(
    baseline.review,
  )}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(
    baseline.runnable,
  )}]`;
}

function representedFrontierIds(baseline: Baseline): string[] {
  return unique([
    ...baseline.active,
    ...baseline.review,
    ...baseline.waiting,
    ...baseline.runnable,
  ]);
}

function representedScopeSentence(baseline: Baseline): string {
  const representedIds = representedFrontierIds(baseline);
  return representedIds.length > 0
    ? `The remaining live frontier holder(s) are ${formatList(representedIds)}.`
    : "No live non-blocked frontier holders remain after excluding this repair leaf.";
}

function nextActionForBaseline(baseline: Baseline): string {
  const representedIds = representedFrontierIds(baseline);
  if (baseline.active.length > 0) {
    return `Work active frontier holder(s) ${formatList(
      baseline.active,
    )} first, preserve the exact top-level blocked steward waits ${formatList(
      baseline.topLevelBlockedIds,
    )}, and reopen broader work only when one named resume condition lands; do not relaunch compact ready-subset dispatch or package reruns from focus bookkeeping alone.`;
  }
  if (baseline.review.length > 0) {
    return `Inspect review holder(s) ${formatList(
      baseline.review,
    )} first, preserve the exact top-level blocked steward waits ${formatList(
      baseline.topLevelBlockedIds,
    )}, and reopen broader work only when one named resume condition lands; do not relaunch compact ready-subset dispatch or package reruns from focus bookkeeping alone.`;
  }
  if (baseline.waiting.length > 0 || baseline.runnable.length > 0) {
    return `Work the current waiting/runnable frontier ${formatList(
      representedIds,
    )}, preserve the exact top-level blocked steward waits ${formatList(
      baseline.topLevelBlockedIds,
    )}, and reopen broader work only when one named resume condition lands; do not relaunch compact ready-subset dispatch or package reruns from focus bookkeeping alone.`;
  }
  return `No new live execution focus is justified from current-focus maintenance. Preserve the exact top-level blocked steward waits ${formatList(
    baseline.topLevelBlockedIds,
  )} until a named resume signal arrives; do not relaunch compact ready-subset dispatch or package reruns from focus bookkeeping alone.`;
}

function defaultReason(baseline: Baseline): string {
  return (
    `Current root-contract non-repair frontier is ${frontierVector(baseline)}, blocked=${baseline.blockedLeafCount}. ` +
    `${archivedWaveLeafId} is archived done and absent from the live task map. ` +
    `Exact top-level blocked steward waits remain ${formatList(baseline.topLevelBlockedIds)}.`
  );
}

function baselineFromCurrentReadout(input: {
  summaryBefore: ReturnType<typeof summarizeTaskTree>;
  currentRootReadout: JsonRecord;
}): Baseline {
  const topLevelBlockedIds = unique(
    asStringArray(input.currentRootReadout.top_level_blocked_ids),
  );
  const activeFromReadout = unique(
    asStringArray(input.currentRootReadout.active_task_ids_excluding_self).filter(
      (taskId) => taskId !== repairTaskId,
    ),
  );
  const reviewFromReadout = unique(
    asStringArray(input.currentRootReadout.review_task_ids).filter(
      (taskId) => taskId !== repairTaskId,
    ),
  );
  const waitingFromReadout = unique(
    asStringArray(input.currentRootReadout.waiting_task_ids).filter(
      (taskId) => taskId !== repairTaskId,
    ),
  );
  const runnableFromReadout = unique(
    asStringArray(input.currentRootReadout.runnable_task_ids).filter(
      (taskId) => taskId !== repairTaskId,
    ),
  );
  const blockedFromReadout = asNumber(input.currentRootReadout.blocked_leaf_count);
  const hasReadoutBaseline =
    typeof input.currentRootReadout.contract_scope === "string" ||
    activeFromReadout.length > 0 ||
    reviewFromReadout.length > 0 ||
    waitingFromReadout.length > 0 ||
    runnableFromReadout.length > 0 ||
    topLevelBlockedIds.length > 0 ||
    blockedFromReadout !== null;

  if (hasReadoutBaseline) {
    return {
      active: activeFromReadout,
      review: reviewFromReadout,
      waiting: waitingFromReadout,
      runnable: runnableFromReadout,
      blockedLeafCount:
        blockedFromReadout ?? Number(input.summaryBefore.counts.blocked ?? 0),
      topLevelBlockedIds,
    };
  }

  return {
    active: unique(
      input.summaryBefore.frontier.active.filter((taskId) => taskId !== repairTaskId),
    ),
    review: unique(
      input.summaryBefore.frontier.review.filter((taskId) => taskId !== repairTaskId),
    ),
    waiting: unique(
      (input.summaryBefore.frontier.waiting ?? []).filter(
        (taskId) => taskId !== repairTaskId,
      ),
    ),
    runnable: unique(
      input.summaryBefore.frontier.runnable.filter(
        (taskId) => taskId !== repairTaskId,
      ),
    ),
    blockedLeafCount: Number(input.summaryBefore.counts.blocked ?? 0),
    topLevelBlockedIds,
  };
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const summaryBefore = summarizeTaskTree(config);
const runtimeBefore = loadProjectReadModel(appDir) as JsonRecord;
const beforeCurrentState = asRecord(runtimeBefore.currentState);
const beforeCurrentFocus = asRecord(runtimeBefore.currentFocus);
const beforeFocusReview = asRecord(beforeCurrentFocus.focusReview);
const beforeFocusMission = asRecord(beforeCurrentFocus.focusMission);
const beforeFocusPlan = asRecord(runtimeBefore.focusPlan);

const syncResult = syncProjectReadout(config, checkedAt);
const runtimeAfterSync = loadProjectReadModel(appDir) as JsonRecord;
const syncedCurrentFocus = asRecord(runtimeAfterSync.currentFocus);
const syncedFocusReview = asRecord(syncedCurrentFocus.focusReview);
const syncedFocusPlan = asRecord(runtimeAfterSync.focusPlan);
const syncedNextAction =
  typeof syncedCurrentFocus.nextAction === "string" &&
  syncedCurrentFocus.nextAction.trim().length > 0
    ? syncedCurrentFocus.nextAction
    : null;

const treeResult = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const projectContext = asRecord(projectTask.context);
  const currentRootReadout = asRecord(projectContext.current_root_readout);
  const baseline = baselineFromCurrentReadout({ summaryBefore, currentRootReadout });
  const currentFrontierVector = frontierVector(baseline);
  const currentRepresentedScopeSentence = representedScopeSentence(baseline);
  const representedIds = representedFrontierIds(baseline);
  const beforeCurrentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const existingReason =
    typeof beforeCurrentFocusProposal.reason === "string" &&
    beforeCurrentFocusProposal.reason.trim().length > 0
      ? beforeCurrentFocusProposal.reason.trim()
      : defaultReason(baseline);
  const proposalContext = {
    horizon: "12-24h",
    success_criteria: [
      `project.context.current_focus_proposal and .state/project-state.json focus surfaces represent ${currentFrontierVector} with the exact current top-level blocked steward waits preserved.`,
      `No archived compact ready-subset leaf, including ${archivedWaveLeafId}, is represented as live focus work after the rewrite. ${currentRepresentedScopeSentence}`,
      "The focus holder no longer carries the compact ready-subset id/title/status/evidence path or compact-wave success criteria.",
      "No new package-level rerun, compact dispatch wave, or approval-gated expansion is introduced from focus maintenance alone.",
    ],
    progress_review: {
      reviewed_at: checkedAt,
      result: "updated",
      evidence_path: evidencePath,
      answers: {
        learned_or_verified: [
          `After excluding this bounded repair leaf, the live root-contract frontier is ${currentFrontierVector} plus the preserved blocked stewardship set.`,
          "The stored compact ready-subset holder was stale because its identity, mission text, and evidence path still described an archived 2026-07-15 wave.",
          `The archived ready-subset execution leaf ${archivedWaveLeafId} is no longer live and must remain settled history only.`,
          `The remaining truthful represented scope is ${currentFrontierVector} plus the current top-level blocked steward waits already preserved in the root contract.`,
        ],
        live_execution_posture:
          syncedNextAction ?? nextActionForBaseline(baseline),
        blocker_mix:
          baseline.active.length > 0
            ? `Current work is an active-plus-blocked frontier: ${formatList(
                baseline.active,
              )} remain active while ${formatList(
                baseline.review,
              )} remain in review, ${formatList(
                baseline.runnable,
              )} remain runnable, and the preserved top-level blocked waits remain unchanged.`
            : baseline.review.length > 0
              ? `Current work is a review-plus-blocked frontier: ${formatList(
                  baseline.review,
                )} remain in review while ${formatList(
                  baseline.runnable,
                )} remain runnable and the preserved top-level blocked waits remain unchanged.`
              : `Current work outside this repair leaf is ${currentFrontierVector} with the preserved top-level blocked waits unchanged and the compact ready-subset wave archived history.`,
        parallel_leafs:
          `Excluding this repair leaf, the current frontier has ${baseline.active.length} active leaves, ${baseline.review.length} review leaves, ${baseline.waiting.length} waiting leaves, and ${baseline.runnable.length} runnable leaves.`,
        goal_alignment:
          "This holder matches the project goal because it restores truthful frontier state without reviving archived ready-subset execution or widening blocked scope.",
      },
    },
    lane_links: {
      execution_verification: representedIds,
      active: baseline.active,
      review: baseline.review,
      waiting: baseline.waiting,
      runnable: baseline.runnable,
      blocked_stewardship: baseline.topLevelBlockedIds,
    },
    active_task_ids: baseline.active,
    review_task_ids: baseline.review,
    waiting_task_ids: baseline.waiting,
    runnable_task_ids: baseline.runnable,
    linked_blocked_task_ids: baseline.topLevelBlockedIds,
  };

  const priorProjectOutputs = asStringArray(projectTask.outputs);
  const projectTraceBefore = asRecord(projectTask.trace);

  projectContext.current_focus_proposal = {
    id: focusProposalId,
    title: focusTitle,
    status: "updated",
    reviewed_at: checkedAt,
    needs_approval: false,
    reason: existingReason,
    evidence_path: evidencePath,
    context: proposalContext,
  };
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_stale_ready_subset_state_repaired_at: checkedAt,
    current_focus_proposal_stale_ready_subset_state_repaired_by:
      "app-ops-script",
    current_focus_proposal_stale_ready_subset_state_repair_attempt_id: attemptId,
    current_focus_proposal_stale_ready_subset_state_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    baseline,
    reason: existingReason,
    beforeCurrentFocusProposal,
    afterCurrentFocusProposal: asRecord(projectContext.current_focus_proposal),
  };
});

const runtimeCurrentState = asRecord(runtimeAfterSync.currentState);
const runtimeCurrentFocus = asRecord(runtimeAfterSync.currentFocus);
const runtimeFocusReview = asRecord(runtimeCurrentFocus.focusReview);
const runtimeFocusPlan = asRecord(runtimeAfterSync.focusPlan);
const representedIds = representedFrontierIds(treeResult.baseline);
const currentFrontierVector = frontierVector(treeResult.baseline);
const currentRepresentedScopeSentence = representedScopeSentence(treeResult.baseline);

runtimeCurrentState.activeTaskId = treeResult.baseline.active[0] ?? null;
runtimeCurrentState.metrics = {
  ...asRecord(runtimeCurrentState.metrics),
  blockedLeafCount: treeResult.baseline.blockedLeafCount,
  runnableLeafCount: treeResult.baseline.runnable.length,
  activeLeafCount: treeResult.baseline.active.length,
  reviewLeafCount: treeResult.baseline.review.length,
  waitingLeafCount: treeResult.baseline.waiting.length,
};
runtimeCurrentFocus.activeTaskIds = treeResult.baseline.active;
runtimeCurrentFocus.proposedTaskIds = unique([
  ...representedIds,
  ...treeResult.baseline.topLevelBlockedIds,
]);
runtimeFocusReview.reviewedAt = checkedAt;
runtimeFocusReview.result = "updated";
runtimeCurrentFocus.focusReview = runtimeFocusReview;
runtimeCurrentFocus.focusMission = {
  id: focusProposalId,
  title: focusTitle,
  horizon: "12-24h",
  successCriteria: [
    `project-state focus surfaces reflect the current post-ready-subset frontier ${currentFrontierVector} without reviving archived compact-wave work.`,
    `No archived compact ready-subset leaf, including ${archivedWaveLeafId}, is represented as active focus work. ${currentRepresentedScopeSentence}`,
    "The exact current top-level blocked steward waits remain preserved as the represented blocked frontier.",
    "No new dispatch or broad rerun is implied by this metadata repair.",
  ],
  activeTaskIds: treeResult.baseline.active,
  reviewTaskIds: treeResult.baseline.review,
  waitingTaskIds: treeResult.baseline.waiting,
  runnableTaskIds: treeResult.baseline.runnable,
  linkedBlockedTaskIds: treeResult.baseline.topLevelBlockedIds,
  evidencePath,
};
runtimeFocusPlan.currentProposalId = focusProposalId;
runtimeFocusPlan.evidencePath = evidencePath;

saveProjectRuntimeState(appDir, {
  currentState: runtimeCurrentState,
  currentFocus: runtimeCurrentFocus,
  focusPlan: runtimeFocusPlan,
  updatedAt: checkedAt,
});

const runtimeAfter = loadProjectReadModel(appDir) as JsonRecord;
const afterCurrentState = asRecord(runtimeAfter.currentState);
const afterCurrentFocus = asRecord(runtimeAfter.currentFocus);
const afterFocusReview = asRecord(afterCurrentFocus.focusReview);
const afterFocusMission = asRecord(afterCurrentFocus.focusMission);
const afterFocusPlan = asRecord(runtimeAfter.focusPlan);
const afterTree = readTaskTree(config);
const afterProjectContext = asRecord(afterTree.tasks[projectTaskId]?.context);
const afterCurrentFocusProposal = asRecord(afterProjectContext.current_focus_proposal);
const afterCurrentRootReadout = asRecord(afterProjectContext.current_root_readout);

const result = {
  checkedAt,
  attemptId,
  repairTaskId,
  focusProposalId,
  syncResult,
  baselineExcludingRepair: treeResult.baseline,
  before: {
    currentFocusProposal: treeResult.beforeCurrentFocusProposal,
    runtimeCurrentStateSummary:
      typeof beforeCurrentState.summary === "string"
        ? beforeCurrentState.summary
        : null,
    runtimeCurrentFocusSummary:
      typeof beforeCurrentFocus.summary === "string"
        ? beforeCurrentFocus.summary
        : null,
    runtimeNextAction:
      typeof beforeCurrentFocus.nextAction === "string"
        ? beforeCurrentFocus.nextAction
        : null,
    runtimeFocusReviewNote:
      typeof beforeFocusReview.note === "string" ? beforeFocusReview.note : null,
    runtimeFocusMission: beforeFocusMission,
    runtimeFocusPlanSummary:
      typeof beforeFocusPlan.summary === "string"
        ? beforeFocusPlan.summary
        : null,
    runtimeFocusPlanProposalId:
      typeof beforeFocusPlan.currentProposalId === "string"
        ? beforeFocusPlan.currentProposalId
        : null,
    runtimeFocusPlanEvidencePath:
      typeof beforeFocusPlan.evidencePath === "string"
        ? beforeFocusPlan.evidencePath
        : null,
  },
  after: {
    currentFocusProposal: afterCurrentFocusProposal,
    currentRootReadout: afterCurrentRootReadout,
    runtimeCurrentStateSummary:
      typeof afterCurrentState.summary === "string"
        ? afterCurrentState.summary
        : null,
    runtimeCurrentFocusSummary:
      typeof afterCurrentFocus.summary === "string"
        ? afterCurrentFocus.summary
        : null,
    runtimeNextAction:
      typeof afterCurrentFocus.nextAction === "string"
        ? afterCurrentFocus.nextAction
        : null,
    runtimeFocusReviewNote:
      typeof afterFocusReview.note === "string" ? afterFocusReview.note : null,
    runtimeFocusMission: afterFocusMission,
    runtimeFocusPlanSummary:
      typeof afterFocusPlan.summary === "string"
        ? afterFocusPlan.summary
        : null,
    runtimeFocusPlanProposalId:
      typeof afterFocusPlan.currentProposalId === "string"
        ? afterFocusPlan.currentProposalId
        : null,
    runtimeFocusPlanEvidencePath:
      typeof afterFocusPlan.evidencePath === "string"
        ? afterFocusPlan.evidencePath
        : null,
  },
};

writeMemo(`# Apply reconcile current-focus proposal stale ready-subset state repair — 2026-07-15

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Checked at: ${checkedAt}

## Result

Applied the bounded app-owned state repair to keep \`project.context.current_focus_proposal\` and mirrored \`.state/project-state.json\` focus surfaces aligned with the same recomputed root-contract non-self frontier.

## App mechanism used

- Ran supported readout recomputation first via \`syncProjectReadout(config, checkedAt)\`
- Rewrote the focus holder through task-tree lock/save helpers
- Rewrote mirrored project runtime state through \`saveProjectRuntimeState(appDir, ...)\`

## Baseline used (excluding this repair leaf)

- active: ${result.baselineExcludingRepair.active.length > 0 ? result.baselineExcludingRepair.active.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${result.baselineExcludingRepair.review.length > 0 ? result.baselineExcludingRepair.review.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${result.baselineExcludingRepair.waiting.length > 0 ? result.baselineExcludingRepair.waiting.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${result.baselineExcludingRepair.runnable.length > 0 ? result.baselineExcludingRepair.runnable.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- blocked leaf count: ${result.baselineExcludingRepair.blockedLeafCount}
- exact top-level blocked steward waits: ${result.baselineExcludingRepair.topLevelBlockedIds.map((taskId) => `\`${taskId}\``).join(", ")}

## Applied repair

### Task-tree project focus holder

- kept holder id/title/status/evidence at:
  - id: \`${focusProposalId}\`
  - title: \`${focusTitle}\`
  - status: \`updated\`
  - needs_approval: \`false\`
  - evidence_path: \`${evidencePath}\`
- refreshed \`project.context.current_focus_proposal.reason\` and context from the same root-contract frontier reflected in \`current_root_readout\`
- added/updated \`context.active_task_ids\`, \`review_task_ids\`, \`waiting_task_ids\`, \`runnable_task_ids\`, and \`linked_blocked_task_ids\`
- replaced stale compact-wave success criteria/progress-review answers with the current root-contract frontier truth

### Runtime project-state focus surfaces

- preserved the synced \`.state/project-state.json -> currentState.summary\`, \`currentFocus.summary\`, \`currentFocus.nextAction\`, \`currentFocus.focusReview.note\`, and \`focusPlan.summary\`
- refreshed \`.state/project-state.json -> currentFocus.activeTaskIds\`
- refreshed \`.state/project-state.json -> currentFocus.proposedTaskIds\`
- replaced \`.state/project-state.json -> currentFocus.focusMission\`
- refreshed \`.state/project-state.json -> focusPlan.currentProposalId\`
- refreshed \`.state/project-state.json -> focusPlan.evidencePath\`

## Before / after highlights

### Before holder id + evidence

- holder id: ${JSON.stringify(result.before.currentFocusProposal.id ?? null)}
- holder title: ${JSON.stringify(result.before.currentFocusProposal.title ?? null)}
- holder evidence_path: ${JSON.stringify(result.before.currentFocusProposal.evidence_path ?? null)}
- focusPlan.currentProposalId: ${JSON.stringify(result.before.runtimeFocusPlanProposalId)}
- focusPlan.evidencePath: ${JSON.stringify(result.before.runtimeFocusPlanEvidencePath)}

### After holder id + evidence

- holder id: ${JSON.stringify(result.after.currentFocusProposal.id ?? null)}
- holder title: ${JSON.stringify(result.after.currentFocusProposal.title ?? null)}
- holder evidence_path: ${JSON.stringify(result.after.currentFocusProposal.evidence_path ?? null)}
- focusPlan.currentProposalId: ${JSON.stringify(result.after.runtimeFocusPlanProposalId)}
- focusPlan.evidencePath: ${JSON.stringify(result.after.runtimeFocusPlanEvidencePath)}

### After focus/readout text

- \`project.context.current_focus_proposal.reason\`
  > ${String(result.after.currentFocusProposal.reason ?? "")}

- \`project.context.current_focus_proposal.context.success_criteria[0]\`
  > ${String(asRecord(result.after.currentFocusProposal.context).success_criteria ? (Array.isArray(asRecord(result.after.currentFocusProposal.context).success_criteria) ? asRecord(result.after.currentFocusProposal.context).success_criteria[0] : "") : "")}

- \`currentFocus.summary\`
  > ${String(result.after.runtimeCurrentFocusSummary ?? "")}

- \`currentFocus.nextAction\`
  > ${String(result.after.runtimeNextAction ?? "")}

- \`currentFocus.focusReview.note\`
  > ${String(result.after.runtimeFocusReviewNote ?? "")}

- \`focusPlan.summary\`
  > ${String(result.after.runtimeFocusPlanSummary ?? "")}

## Verification targets satisfied

- stale holder \`focus-compact-ready-subset-adjudication-and-bounded-dispatch-20260715\` is absent from the live task-tree focus holder and project-state focus proposal id
- current focus holder reason, success criteria, progress review, lane links, and task-id fields now represent the same active/review/waiting/runnable frontier as \`project.context.current_root_readout\`
- currentFocus.focusMission now carries the same active/review/waiting/runnable task ids as the repaired task-tree focus holder
- stale compact ready-subset evidence path is replaced by this current repair memo
- exact top-level blocked steward waits remain preserved without widening scope
`);

console.log(JSON.stringify(result, null, 2));
