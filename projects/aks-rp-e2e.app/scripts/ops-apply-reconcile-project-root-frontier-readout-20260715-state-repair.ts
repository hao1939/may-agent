import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type FrontierSnapshot = {
  activeIncludingRepair: string[];
  activeExcludingRepair: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blocked: string[];
  blockedLeafCount: number;
  doneLeafCount: number;
  leafTotal: number;
  liveFocusIds: string[];
  allLiveLeafIds: string[];
  topLevelBlockedIds: string[];
  topLevelDoneIds: string[];
};

type RuntimeSnapshot = {
  currentStateSummary: string | null;
  currentFocusSummary: string | null;
  currentFocusNextAction: string | null;
  currentFocusActiveTaskIds: string[];
  currentFocusProposedTaskIds: string[];
  currentFocusReviewNote: string | null;
  focusPlanSummary: string | null;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const projectTaskId = "project";
const repairTaskId =
  "ops-apply-reconcile-project-root-frontier-readout-20260715-state-repair";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-project-root-frontier-readout-20260715-state-repair.md";
const attemptId =
  "a_ops-apply-reconcile-project-root-frontier-readout-20260715-state-repair_20260715014423";
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

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stateOf(task: TaskNode | undefined): string {
  if (!task) return "";
  const status = typeof task.status === "string" ? task.status.trim() : "";
  if (status) return status;
  return typeof task.state === "string" ? task.state.trim() : "";
}

function isLeaf(task: TaskNode | undefined): boolean {
  return Array.isArray(task?.children) ? task!.children!.length === 0 : true;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function sampleIds(values: string[], limit = 8): string {
  if (values.length === 0) return "none";
  const picked = values.slice(0, limit);
  return values.length > limit
    ? `${picked.join(", ")} (+${values.length - limit} more)`
    : picked.join(", ");
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function isSuppressedMetadataRepair(task: TaskNode | undefined): boolean {
  if (!task || !isLeaf(task)) return false;
  if (stateOf(task) === "done") return false;
  if (String(task.owner ?? "") !== "app-ops") return false;
  if (task.id === repairTaskId) return true;

  const goal = String(task.goal ?? "");
  const mentionsReadoutSurface =
    /current_root_readout|current_focus_proposal|focus\/?readout|frontier readout/i.test(
      goal,
    );
  const mentionsRepairIntent = /(repair|patch|sync|align|parity|reconcile)/i.test(
    goal,
  );
  const context = asRecord(task.context);

  return mentionsReadoutSurface && (mentionsRepairIntent || "reviewedTask" in context);
}

function filterLiveFrontierIds(tree: ReturnType<typeof readTaskTree>, ids: string[]) {
  return unique(
    ids.filter((taskId) => !isSuppressedMetadataRepair(tree.tasks[taskId])),
  ).sort((left, right) => left.localeCompare(right));
}

function classifyLane(taskId: string): "spec_generation" | "execution_verification" | "process_hygiene" {
  if (
    /(^ops\/|^ops-)|publication-escalation|project-root-frontier-readout/i.test(
      taskId,
    )
  ) {
    return "process_hygiene";
  }
  if (/author-|verify|spec/i.test(taskId)) {
    return "spec_generation";
  }
  return "execution_verification";
}

function activeCompactLaneSentence(frontier: FrontierSnapshot): string {
  const compactRootActive = frontier.activeExcludingRepair.includes(
    "domain/consume-net-integration-multinic-live-run-172268432-return-20260715",
  );
  const compactHasReview = frontier.review.some((taskId) => taskId.includes("compact") || taskId.includes("storage-csi") || taskId.includes("multinic"));
  const compactHasWaiting = frontier.waiting.some((taskId) => taskId.includes("compact"));
  if (!compactRootActive && !compactHasReview && !compactHasWaiting) {
    return "Compact-loop remains represented by its live child frontier and must not be written back as a blocked top-level steward while it has active, review, or waiting children.";
  }
  return `Compact-loop is a live active domain lane, not a blocked root steward: it currently carries active=[${formatList(
    frontier.activeExcludingRepair.filter((taskId) => taskId.includes("multinic")),
  )}], review=[${formatList(frontier.review)}], and waiting=[${formatList(frontier.waiting)}].`;
}

function buildProposalReason(frontier: FrontierSnapshot): string {
  return `Current non-repair frontier is active=[${formatList(
    frontier.activeExcludingRepair,
  )}], review=[${formatList(frontier.review)}], waiting=[${formatList(
    frontier.waiting,
  )}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. Current live focus is ${sampleIds(
    frontier.liveFocusIds,
  )}. Do not reopen stale readout lineages or queue fresh reruns from metadata repair alone.`;
}

function buildRootSummary(frontier: FrontierSnapshot): string {
  return [
    "Project root is reopened and loop-driven, not in the 2026-06-14 wind-down posture.",
    `Live snapshot ${checkedAt} excludes transient metadata repair ${repairTaskId} and shows active=[${formatList(
      frontier.activeExcludingRepair,
    )}], review=[${formatList(frontier.review)}], waiting=[${formatList(
      frontier.waiting,
    )}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}.`,
    activeCompactLaneSentence(frontier),
    `Preserve only the exact top-level blocked stewards ${formatList(
      frontier.topLevelBlockedIds,
    )}. Historical 2026-07-14 root/focus readouts remain provenance only.`,
  ].join(" ");
}

function buildStrategyContext(frontier: FrontierSnapshot): string {
  return `Planner update (${checkedAt}): recomputed the project root frontier readout from the live task tree after prior root metadata stalled on 2026-07-14 values. Current root steering excludes transient metadata repair ${repairTaskId} and reflects active=[${formatList(
    frontier.activeExcludingRepair,
  )}], review=[${formatList(frontier.review)}], waiting=[${formatList(
    frontier.waiting,
  )}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. Keep compact-loop represented by its current child frontier instead of writing it back into the blocked-steward set, preserve the review queue exactly as-is until planner accepts or replaces it, and preserve the exact top-level blocked stewards ${formatList(
    frontier.topLevelBlockedIds,
  )} unchanged until same-lineage returns or sharper replacements land.`;
}

function buildAcceptanceNote(frontier: FrontierSnapshot): string {
  return `Current root readout at ${checkedAt} excludes transient metadata repair ${repairTaskId} and shows active=[${formatList(
    frontier.activeExcludingRepair,
  )}], review=[${formatList(frontier.review)}], waiting=[${formatList(
    frontier.waiting,
  )}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}, with exact top-level blocked stewards ${formatList(
    frontier.topLevelBlockedIds,
  )} still open.`;
}

function buildRuntimeCurrentStateSummary(frontier: FrontierSnapshot): string {
  return `Task-tree summary at ${checkedAt} excludes metadata repair ${repairTaskId} and shows ${frontier.runnable.length} runnable leaves, ${frontier.waiting.length} waiting leaves, ${frontier.activeExcludingRepair.length} active leaves, ${frontier.review.length} review leaves, and ${frontier.blockedLeafCount} blocked leaves. Current live frontier is derived from non-done task-tree leaves first: ${sampleIds(
    frontier.liveFocusIds,
  )}. Loop residue files are diagnostic-only unless backed by a live tree leaf.`;
}

function buildRuntimeCurrentFocusSummary(frontier: FrontierSnapshot): string {
  return `Current live focus is derived from non-done task-tree leaves first: ${sampleIds(
    frontier.liveFocusIds,
  )}.`;
}

function buildRuntimeNextAction(frontier: FrontierSnapshot): string {
  if (frontier.activeExcludingRepair.length > 0) {
    return `Finish the current active live-frontier leaf/leaves first: ${sampleIds(
      frontier.activeExcludingRepair,
    )}. Keep project/app summaries grounded in task-tree live leaves rather than loop residue.`;
  }
  if (frontier.review.length > 0 || frontier.waiting.length > 0 || frontier.runnable.length > 0) {
    return `Work the current non-done task-tree frontier in order: ${sampleIds(
      frontier.liveFocusIds,
    )}. Keep loop residue diagnostic-only unless it is represented by a live leaf.`;
  }
  return `Preserve the exact blocked waits (${sampleIds(
    frontier.liveFocusIds,
  )}) and reopen work only when a named resume condition lands.`;
}

const summaryBefore = summarizeTaskTree(config);
const runtimeBefore = loadProjectReadModel(appDir) as JsonRecord;
const runtimeBeforeCurrentState = asRecord(runtimeBefore.currentState);
const runtimeBeforeCurrentFocus = asRecord(runtimeBefore.currentFocus);
const runtimeBeforeFocusReview = asRecord(runtimeBeforeCurrentFocus.focusReview);
const runtimeBeforeFocusPlan = asRecord(runtimeBefore.focusPlan);

const beforeProject = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);
  const projectContext = asRecord(projectTask.context);
  return {
    summary: typeof projectTask.summary === "string" ? projectTask.summary : null,
    strategyContext:
      typeof projectTask.strategy_context === "string"
        ? projectTask.strategy_context
        : null,
    progress: projectTask.progress ?? null,
    currentRootReadout: projectContext.current_root_readout ?? null,
    currentFocusProposal: projectContext.current_focus_proposal ?? null,
    acceptanceNote:
      typeof projectContext.acceptance_note === "string"
        ? projectContext.acceptance_note
        : null,
  };
});

const treeResult = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const frontier: FrontierSnapshot = {
    activeIncludingRepair: filterLiveFrontierIds(tree, summaryBefore.frontier.active.concat([repairTaskId]).filter((taskId, index, arr) => arr.indexOf(taskId) === index).filter((taskId) => {
      const task = tree.tasks[taskId];
      return !!task && stateOf(task) === "active";
    })),
    activeExcludingRepair: [],
    review: filterLiveFrontierIds(tree, summaryBefore.frontier.review ?? []),
    waiting: filterLiveFrontierIds(tree, summaryBefore.frontier.waiting ?? []),
    runnable: filterLiveFrontierIds(tree, summaryBefore.frontier.runnable ?? []),
    blocked: [],
    blockedLeafCount: Number(summaryBefore.counts.blocked ?? 0),
    doneLeafCount: Number(summaryBefore.counts.done ?? 0),
    leafTotal: Number(summaryBefore.leaf_total ?? 0),
    liveFocusIds: [],
    allLiveLeafIds: [],
    topLevelBlockedIds: [],
    topLevelDoneIds: [],
  };

  frontier.activeExcludingRepair = frontier.activeIncludingRepair.filter(
    (taskId) => taskId !== repairTaskId,
  );

  frontier.blocked = unique(
    Object.values(tree.tasks)
      .filter((task) => isLeaf(task) && stateOf(task) === "blocked")
      .map((task) => task.id),
  ).sort((left, right) => left.localeCompare(right));

  frontier.liveFocusIds = unique([
    ...frontier.activeExcludingRepair,
    ...frontier.review,
    ...frontier.waiting,
    ...frontier.runnable,
  ]);
  if (frontier.liveFocusIds.length === 0) {
    frontier.liveFocusIds = [...frontier.blocked];
  }
  frontier.allLiveLeafIds = unique([
    ...frontier.activeExcludingRepair,
    ...frontier.review,
    ...frontier.waiting,
    ...frontier.runnable,
    ...frontier.blocked,
  ]);

  const projectChildren = asStringArray(projectTask.children);
  frontier.topLevelBlockedIds = projectChildren
    .filter((childId) => stateOf(tree.tasks[childId]) === "blocked")
    .sort((left, right) => left.localeCompare(right));
  frontier.topLevelDoneIds = projectChildren
    .filter((childId) => stateOf(tree.tasks[childId]) === "done")
    .sort((left, right) => left.localeCompare(right));

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const proposalContext = asRecord(currentFocusProposal.context);
  const proposalProgressReview = asRecord(proposalContext.progress_review);
  const proposalAnswers = asRecord(proposalProgressReview.answers);
  const previousLinkedBlocked = asStringArray(proposalContext.linked_blocked_task_ids);
  const filteredLinkedBlocked = unique(
    previousLinkedBlocked.filter((taskId) => stateOf(tree.tasks[taskId]) === "blocked"),
  );

  const laneLinks: Record<string, string[]> = {
    spec_generation: [],
    execution_verification: [],
    process_hygiene: [],
  };
  for (const taskId of frontier.liveFocusIds) {
    laneLinks[classifyLane(taskId)].push(taskId);
  }

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.status = "updated";
  currentFocusProposal.reason = buildProposalReason(frontier);
  currentFocusProposal.evidence_path = evidencePath;

  proposalAnswers.learned_or_verified = [
    `Project root frontier now excludes metadata repair ${repairTaskId} and recognizes active live leaves ${formatList(
      frontier.activeExcludingRepair,
    )}.`,
    `The current review frontier is ${formatList(frontier.review)} and the current waiting frontier is ${formatList(
      frontier.waiting,
    )}.`,
    `Compact-loop stays represented by live child work, so it is removed from top-level blocked stewardship while root blocked-family stewards remain ${formatList(
      frontier.topLevelBlockedIds,
    )}.`,
  ];
  proposalAnswers.live_execution_posture =
    "Stay no-live for fresh reruns from bookkeeping alone; use the current active, review, and waiting leaves to reconcile already-returned evidence and exact follow-through work.";
  proposalAnswers.blocker_mix = `Mixed but well-bounded: ${frontier.activeExcludingRepair.length} active leaves, ${frontier.review.length} review leaves, ${frontier.waiting.length} waiting leaves, ${frontier.runnable.length} runnable leaves, and ${frontier.blockedLeafCount} blocked leaves outside the represented live frontier.`;
  proposalAnswers.parallel_leafs = `The non-repair frontier now has ${frontier.activeExcludingRepair.length} active leaves, ${frontier.review.length} review leaves, ${frontier.waiting.length} waiting leaves, and ${frontier.runnable.length} runnable leaves.`;
  proposalAnswers.goal_alignment =
    "The focus still links execution verification, spec authoring, and app-ops hygiene while excluding the metadata repair leaf itself from the live mission readout.";
  proposalProgressReview.reviewed_at = checkedAt;
  proposalProgressReview.result = "updated";
  proposalProgressReview.evidence_path = evidencePath;
  proposalProgressReview.answers = proposalAnswers;

  proposalContext.progress_review = proposalProgressReview;
  proposalContext.active_task_ids = frontier.activeExcludingRepair;
  proposalContext.review_task_ids = frontier.review;
  proposalContext.linked_blocked_task_ids = filteredLinkedBlocked;
  proposalContext.lane_links = Object.fromEntries(
    Object.entries(laneLinks).filter(([, ids]) => ids.length > 0),
  );
  currentFocusProposal.context = proposalContext;

  projectTask.summary = buildRootSummary(frontier);
  projectTask.strategy_context = buildStrategyContext(frontier);
  projectTask.progress = {
    updated_at: checkedAt,
    active_excluding_self: frontier.activeExcludingRepair.length,
    active_including_self: unique(summaryBefore.frontier.active).length,
    review: frontier.review.length,
    waiting: frontier.waiting.length,
    runnable: frontier.runnable.length,
    blocked: frontier.blockedLeafCount,
    done: frontier.doneLeafCount,
    leaf_total: frontier.leafTotal,
    top_level_blocked: frontier.topLevelBlockedIds.length,
  };
  projectTask.updated_at = checkedAt;

  projectContext.acceptance_note = buildAcceptanceNote(frontier);
  projectContext.current_root_readout = {
    updated_at: checkedAt,
    excludes_task_id: repairTaskId,
    active_task_ids_excluding_self: frontier.activeExcludingRepair,
    active_task_ids_including_self: unique(summaryBefore.frontier.active).sort(
      (left, right) => left.localeCompare(right),
    ),
    review_task_ids: frontier.review,
    waiting_task_ids: frontier.waiting,
    runnable_task_ids: frontier.runnable,
    blocked_leaf_count: frontier.blockedLeafCount,
    top_level_blocked_ids: frontier.topLevelBlockedIds,
    top_level_done_ids: frontier.topLevelDoneIds,
    stale_root_frontier_replaced: true,
  };
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...asStringArray(projectTask.outputs), evidencePath]);
  projectTask.trace = {
    ...asRecord(projectTask.trace),
    project_root_frontier_readout_repaired_at: checkedAt,
    project_root_frontier_readout_repaired_by: "app-ops-script",
    project_root_frontier_readout_repair_attempt_id: attemptId,
    project_root_frontier_readout_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    frontier,
    projectAfter: {
      summary: projectTask.summary,
      strategyContext: projectTask.strategy_context,
      progress: projectTask.progress,
      currentRootReadout: asRecord(projectContext.current_root_readout),
      currentFocusProposal,
      acceptanceNote: projectContext.acceptance_note,
    },
  };
});

const runtimeCurrentState = asRecord(runtimeBefore.currentState);
const runtimeCurrentFocus = asRecord(runtimeBefore.currentFocus);
const runtimeFocusReview = asRecord(runtimeCurrentFocus.focusReview);
const runtimeFocusPlan = asRecord(runtimeBefore.focusPlan);

runtimeCurrentState.summary = buildRuntimeCurrentStateSummary(treeResult.frontier);
runtimeCurrentState.activeTaskId = treeResult.frontier.activeExcludingRepair[0] ?? null;
runtimeCurrentState.metrics = {
  ...asRecord(runtimeCurrentState.metrics),
  blockedLeafCount: treeResult.frontier.blockedLeafCount,
  runnableLeafCount: treeResult.frontier.runnable.length,
  activeLeafCount: treeResult.frontier.activeExcludingRepair.length,
  reviewLeafCount: treeResult.frontier.review.length,
  waitingLeafCount: treeResult.frontier.waiting.length,
};

runtimeCurrentFocus.summary = buildRuntimeCurrentFocusSummary(treeResult.frontier);
runtimeCurrentFocus.nextAction = buildRuntimeNextAction(treeResult.frontier);
runtimeCurrentFocus.activeTaskIds = treeResult.frontier.liveFocusIds;
runtimeCurrentFocus.proposedTaskIds = treeResult.frontier.allLiveLeafIds;
runtimeFocusReview.reviewedAt = checkedAt;
runtimeFocusReview.result = "updated";
runtimeFocusReview.note = `Readout sync refreshed the current non-repair frontier. ${treeResult.projectAfter.currentFocusProposal.reason}`;
runtimeCurrentFocus.focusReview = runtimeFocusReview;

runtimeFocusPlan.summary = `Focus plan readout now mirrors the current non-repair frontier. ${treeResult.projectAfter.currentFocusProposal.reason}`;

saveProjectRuntimeState(appDir, {
  currentState: runtimeCurrentState,
  currentFocus: runtimeCurrentFocus,
  focusPlan: runtimeFocusPlan,
  updatedAt: checkedAt,
});

const runtimeAfter = loadProjectReadModel(appDir) as JsonRecord;
const runtimeAfterCurrentState = asRecord(runtimeAfter.currentState);
const runtimeAfterCurrentFocus = asRecord(runtimeAfter.currentFocus);
const runtimeAfterFocusReview = asRecord(runtimeAfterCurrentFocus.focusReview);
const runtimeAfterFocusPlan = asRecord(runtimeAfter.focusPlan);

const runtimeSnapshot: { before: RuntimeSnapshot; after: RuntimeSnapshot } = {
  before: {
    currentStateSummary:
      typeof runtimeBeforeCurrentState.summary === "string"
        ? runtimeBeforeCurrentState.summary
        : null,
    currentFocusSummary:
      typeof runtimeBeforeCurrentFocus.summary === "string"
        ? runtimeBeforeCurrentFocus.summary
        : null,
    currentFocusNextAction:
      typeof runtimeBeforeCurrentFocus.nextAction === "string"
        ? runtimeBeforeCurrentFocus.nextAction
        : null,
    currentFocusActiveTaskIds: asStringArray(runtimeBeforeCurrentFocus.activeTaskIds),
    currentFocusProposedTaskIds: asStringArray(
      runtimeBeforeCurrentFocus.proposedTaskIds,
    ),
    currentFocusReviewNote:
      typeof runtimeBeforeFocusReview.note === "string"
        ? runtimeBeforeFocusReview.note
        : null,
    focusPlanSummary:
      typeof runtimeBeforeFocusPlan.summary === "string"
        ? runtimeBeforeFocusPlan.summary
        : null,
  },
  after: {
    currentStateSummary:
      typeof runtimeAfterCurrentState.summary === "string"
        ? runtimeAfterCurrentState.summary
        : null,
    currentFocusSummary:
      typeof runtimeAfterCurrentFocus.summary === "string"
        ? runtimeAfterCurrentFocus.summary
        : null,
    currentFocusNextAction:
      typeof runtimeAfterCurrentFocus.nextAction === "string"
        ? runtimeAfterCurrentFocus.nextAction
        : null,
    currentFocusActiveTaskIds: asStringArray(runtimeAfterCurrentFocus.activeTaskIds),
    currentFocusProposedTaskIds: asStringArray(
      runtimeAfterCurrentFocus.proposedTaskIds,
    ),
    currentFocusReviewNote:
      typeof runtimeAfterFocusReview.note === "string"
        ? runtimeAfterFocusReview.note
        : null,
    focusPlanSummary:
      typeof runtimeAfterFocusPlan.summary === "string"
        ? runtimeAfterFocusPlan.summary
        : null,
  },
};

const result = {
  checkedAt,
  attemptId,
  repairTaskId,
  evidencePath,
  beforeProject,
  frontier: treeResult.frontier,
  afterProject: treeResult.projectAfter,
  runtime: runtimeSnapshot,
};

writeMemo(`# Project root frontier readout state repair — 2026-07-15

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Checked at: ${checkedAt}

## Result

Applied the bounded app-owned state repair to recompute the project root frontier readout from the current live task tree, exclude this metadata repair leaf from the non-repair frontier, refresh the root summary/strategy/progress/current_root_readout fields, and align \`project.context.current_focus_proposal\` plus runtime project readout surfaces to the same live active/review/waiting set.

## Baseline before repair

- \`project.summary\`: ${JSON.stringify(beforeProject.summary)}
- \`project.strategy_context\`: ${JSON.stringify(beforeProject.strategyContext)}
- \`project.progress\`: ${JSON.stringify(beforeProject.progress, null, 2)}
- \`project.context.current_root_readout\`: ${JSON.stringify(beforeProject.currentRootReadout, null, 2)}
- \`project.context.current_focus_proposal\`: ${JSON.stringify(beforeProject.currentFocusProposal, null, 2)}
- \`project.context.acceptance_note\`: ${JSON.stringify(beforeProject.acceptanceNote)}

## Live frontier used for the repair

- active including repair: ${formatList(unique(summaryBefore.frontier.active).sort((left, right) => left.localeCompare(right)))}
- active excluding repair: ${formatList(result.frontier.activeExcludingRepair)}
- review: ${formatList(result.frontier.review)}
- waiting: ${formatList(result.frontier.waiting)}
- runnable: ${formatList(result.frontier.runnable)}
- blocked leaves: ${result.frontier.blockedLeafCount}
- done leaves: ${result.frontier.doneLeafCount}
- leaf total: ${result.frontier.leafTotal}
- top-level blocked stewards: ${formatList(result.frontier.topLevelBlockedIds)}
- top-level done lanes: ${formatList(result.frontier.topLevelDoneIds)}

## Applied tree repair

Updated these app-owned fields through task-tree locking/save helpers:

- \`project.summary\`
- \`project.strategy_context\`
- \`project.progress\`
- \`project.context.acceptance_note\`
- \`project.context.current_root_readout\`
- \`project.context.current_focus_proposal.reason\`
- \`project.context.current_focus_proposal.context.active_task_ids\`
- \`project.context.current_focus_proposal.context.review_task_ids\`
- \`project.context.current_focus_proposal.context.linked_blocked_task_ids\`
- \`project.context.current_focus_proposal.context.lane_links\`
- \`project.context.current_focus_proposal.context.progress_review.answers\`
- \`project.trace.project_root_frontier_readout_repaired_*\`

## Runtime readout sync

Also refreshed project runtime readout surfaces in \`project.json\` so currentState/currentFocus/focusReview/focusPlan describe the same non-repair frontier and no longer leak this repair leaf as live focus work.

## After repair

- \`project.summary\`: ${JSON.stringify(result.afterProject.summary)}
- \`project.strategy_context\`: ${JSON.stringify(result.afterProject.strategyContext)}
- \`project.progress\`: ${JSON.stringify(result.afterProject.progress, null, 2)}
- \`project.context.current_root_readout\`: ${JSON.stringify(result.afterProject.currentRootReadout, null, 2)}
- \`project.context.current_focus_proposal\`: ${JSON.stringify(result.afterProject.currentFocusProposal, null, 2)}
- \`project.context.acceptance_note\`: ${JSON.stringify(result.afterProject.acceptanceNote)}

## Runtime before → after

### Before

- \`currentState.summary\`: ${JSON.stringify(runtimeSnapshot.before.currentStateSummary)}
- \`currentFocus.summary\`: ${JSON.stringify(runtimeSnapshot.before.currentFocusSummary)}
- \`currentFocus.nextAction\`: ${JSON.stringify(runtimeSnapshot.before.currentFocusNextAction)}
- \`currentFocus.activeTaskIds\`: ${JSON.stringify(runtimeSnapshot.before.currentFocusActiveTaskIds)}
- \`currentFocus.proposedTaskIds\`: ${JSON.stringify(runtimeSnapshot.before.currentFocusProposedTaskIds)}
- \`currentFocus.focusReview.note\`: ${JSON.stringify(runtimeSnapshot.before.currentFocusReviewNote)}
- \`focusPlan.summary\`: ${JSON.stringify(runtimeSnapshot.before.focusPlanSummary)}

### After

- \`currentState.summary\`: ${JSON.stringify(runtimeSnapshot.after.currentStateSummary)}
- \`currentFocus.summary\`: ${JSON.stringify(runtimeSnapshot.after.currentFocusSummary)}
- \`currentFocus.nextAction\`: ${JSON.stringify(runtimeSnapshot.after.currentFocusNextAction)}
- \`currentFocus.activeTaskIds\`: ${JSON.stringify(runtimeSnapshot.after.currentFocusActiveTaskIds)}
- \`currentFocus.proposedTaskIds\`: ${JSON.stringify(runtimeSnapshot.after.currentFocusProposedTaskIds)}
- \`currentFocus.focusReview.note\`: ${JSON.stringify(runtimeSnapshot.after.currentFocusReviewNote)}
- \`focusPlan.summary\`: ${JSON.stringify(runtimeSnapshot.after.focusPlanSummary)}

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
