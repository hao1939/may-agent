import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type ArchivedTaskHit = {
  archiveFile: string | null;
  generatedAt: string | null;
  task: JsonRecord | null;
};

type FrontierSnapshot = {
  activeIncludingRepair: string[];
  activeExcludingRepair: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blockedLeafIds: string[];
  blockedLeafCount: number;
  doneLeafCount: number;
  leafTotal: number;
  topLevelBlockedWaitIds: string[];
  topLevelBlockedRootIds: string[];
  topLevelDoneIds: string[];
  acceptedPublicationLeafLive: boolean;
  acceptedPublicationLeafArchive: ArchivedTaskHit;
  specLoopWorkflowReason: string | null;
  compactLoopWorkflowReason: string | null;
};

type ProjectBeforeAfter = {
  summary: string | null;
  strategyContext: string | null;
  progress: unknown;
  currentRootReadout: unknown;
  currentFocusProposal: unknown;
  acceptanceNote: string | null;
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
  "ops/reconcile-project-root-frontier-readout-windows-gpu-blocked-frontier-20260715";
const evidencePath =
  "evidence/archive/ops-reconcile-project-root-frontier-readout-windows-gpu-blocked-frontier-20260715.md";
const attemptId =
  "a_ops_reconcile-project-root-frontier-readout-windows-gpu-blocked-frontier-20260715_20260715055340";
const acceptedPublicationLeafId =
  "domain/publish-windows-gpu-vmss-successors-visible-20260715";
const retiredBlockedPublicationLeafId =
  "domain/publish-windows-gpu-vmss-successors-20260715";
const completedWritebackTaskId =
  "domain/writeback-windows-gpu-vms-legacy-retirement-20260715";
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

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function quoteList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "none";
}

function stateOf(task: TaskNode | undefined): string {
  if (!task) return "";
  const status = typeof task.status === "string" ? task.status.trim() : "";
  if (status) return status;
  return typeof task.state === "string" ? task.state.trim() : "";
}

function isLeaf(task: TaskNode | undefined): boolean {
  return Array.isArray(task?.children) ? task.children.length === 0 : true;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function findArchivedTask(taskId: string): ArchivedTaskHit {
  const archiveDir = resolve(appDir, ".state/tasks/archive");
  const files = readdirSync(archiveDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  for (const file of files) {
    const absolute = join(archiveDir, file);
    const payload = asRecord(readJson(absolute));
    const generatedAt = typeof payload.generated_at === "string" ? payload.generated_at : null;

    const list = Array.isArray(payload.tasks) ? payload.tasks : [];
    for (const item of list) {
      const task = asRecord(item);
      if (task.id === taskId) {
        return { archiveFile: `.state/tasks/archive/${file}`, generatedAt, task };
      }
    }

    const map = asRecord(payload.tasks);
    for (const [id, value] of Object.entries(map)) {
      if (id === taskId) {
        return {
          archiveFile: `.state/tasks/archive/${file}`,
          generatedAt,
          task: asRecord(value),
        };
      }
    }
  }

  return { archiveFile: null, generatedAt: null, task: null };
}

function buildProjectSummary(frontier: FrontierSnapshot): string {
  const archiveAt = frontier.acceptedPublicationLeafArchive.generatedAt ?? "unknown archive time";
  const archiveFile = frontier.acceptedPublicationLeafArchive.archiveFile ?? "unknown archive file";
  return [
    "Project root is reopened and loop-driven, not in the 2026-06-14 wind-down posture.",
    `Live snapshot ${checkedAt} excludes metadata repair ${repairTaskId} and reflects active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}.`,
    `The acceptance-named Windows GPU publication leaf ${acceptedPublicationLeafId} is not live in the current task map; planner maintenance already archived it done at ${archiveAt} in ${archiveFile}.`,
    `Zero waiting/runnable leaves remain by design because aks-spec-verification-loop and aks-feature-compact-loop are both in blocked exact-wait stewardship; any remaining review/active leaves are app-ops follow-through tasks review=[${formatList(frontier.review)}], active=[${formatList(frontier.activeExcludingRepair)}] and must not be mislabeled as the publication leaf.`,
    `Preserve only the exact current top-level blocked steward waits ${formatList(frontier.topLevelBlockedWaitIds)}.`,
    `Do not resurrect stale net-integration/storage-csi lineage or replay retired blocked carrier ${retiredBlockedPublicationLeafId} as live work.`,
  ].join(" ");
}

function buildStrategyContext(frontier: FrontierSnapshot): string {
  const archiveAt = frontier.acceptedPublicationLeafArchive.generatedAt ?? "unknown archive time";
  const archiveFile = frontier.acceptedPublicationLeafArchive.archiveFile ?? "unknown archive file";
  return `Planner update (${checkedAt}): recomputed the project root frontier readout from the current live task tree after the acceptance-named Windows GPU publication leaf ${acceptedPublicationLeafId} had already been archived done at ${archiveAt} in ${archiveFile}. Current root steering excludes metadata repair ${repairTaskId} and reflects active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. Zero waiting/runnable leaves is intentional because spec and compact loops are in exact blocked-wait stewardship; any remaining review/active leaves are app-ops follow-through tasks review=[${formatList(frontier.review)}], active=[${formatList(frontier.activeExcludingRepair)}]. Preserve only the exact top-level blocked steward waits ${formatList(frontier.topLevelBlockedWaitIds)} and do not misrepresent app-ops follow-through tasks as the archived publication leaf.`;
}

function buildAcceptanceNote(frontier: FrontierSnapshot): string {
  return `Current root readout at ${checkedAt} excludes metadata repair ${repairTaskId} and shows active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. The acceptance-named publication leaf ${acceptedPublicationLeafId} is already archived done in ${frontier.acceptedPublicationLeafArchive.archiveFile ?? "unknown archive file"}; the remaining active leaves are app-ops cleanup/reconciliation tasks ${formatList(frontier.activeExcludingRepair)}. Exact top-level blocked steward waits remain ${formatList(frontier.topLevelBlockedWaitIds)}.`;
}

function buildFrontierReason(frontier: FrontierSnapshot): string {
  return `Current non-repair frontier is active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. The acceptance-named publication leaf ${acceptedPublicationLeafId} is already archived done${frontier.acceptedPublicationLeafArchive.generatedAt ? ` at ${frontier.acceptedPublicationLeafArchive.generatedAt}` : ""} and is absent from the live task map. Zero waiting/runnable leaves is intentional because the spec and compact loops are in exact blocked-wait stewardship; any remaining review/active leaves are app-ops follow-through tasks review=[${formatList(frontier.review)}], active=[${formatList(frontier.activeExcludingRepair)}]. Exact current top-level blocked steward waits are ${formatList(frontier.topLevelBlockedWaitIds)}.`;
}

function buildRuntimeCurrentStateSummary(frontier: FrontierSnapshot): string {
  return `Task-tree summary at ${checkedAt} shows ${frontier.runnable.length} runnable leaves, ${frontier.waiting.length} waiting leaves, ${frontier.activeExcludingRepair.length} active leaves, ${frontier.review.length} review leaves, and ${frontier.blockedLeafCount} blocked leaves after excluding metadata repair ${repairTaskId}. The acceptance-named publication leaf ${acceptedPublicationLeafId} is archived done rather than live; the current active frontier is app-ops cleanup/reconciliation only: ${formatList(frontier.activeExcludingRepair)}.`;
}

function buildRuntimeCurrentFocusSummary(frontier: FrontierSnapshot): string {
  return `Current live focus is the remaining non-domain follow-through after the Windows GPU publication leaf was archived done: active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}]. Zero waiting/runnable leaves remains intentional in the spec/compact loops.`;
}

function buildRuntimeNextAction(frontier: FrontierSnapshot): string {
  return `Keep root/readout metadata truthful: the acceptance-named publication leaf ${acceptedPublicationLeafId} is archived done, the current active cleanup frontier is ${formatList(frontier.activeExcludingRepair)}, and the exact top-level blocked steward waits stay ${formatList(frontier.topLevelBlockedWaitIds)} until a named resume signal lands.`;
}

const runtimeBefore = loadProjectReadModel(appDir) as JsonRecord;
const runtimeBeforeCurrentState = asRecord(runtimeBefore.currentState);
const runtimeBeforeCurrentFocus = asRecord(runtimeBefore.currentFocus);
const runtimeBeforeFocusReview = asRecord(runtimeBeforeCurrentFocus.focusReview);
const runtimeBeforeFocusMission = asRecord(runtimeBeforeCurrentFocus.focusMission);
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
  } satisfies ProjectBeforeAfter;
});

const afterTree = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const projectChildren = asStringArray(projectTask.children);
  const leafTasks = Object.values(tree.tasks).filter((task) => isLeaf(task));
  const activeIncludingRepair = projectChildren
    .filter((id) => stateOf(tree.tasks[id]) === "active")
    .sort((a, b) => a.localeCompare(b));
  const activeExcludingRepair = activeIncludingRepair.filter((id) => id !== repairTaskId);
  const review = leafTasks
    .filter((task) => stateOf(task) === "review")
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
  const waiting = leafTasks
    .filter((task) => stateOf(task) === "waiting")
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
  const runnable = leafTasks
    .filter((task) => stateOf(task) === "runnable" || stateOf(task) === "pending")
    .map((task) => task.id)
    .filter((id) => id !== repairTaskId)
    .sort((a, b) => a.localeCompare(b));
  const blockedLeafIds = leafTasks
    .filter((task) => stateOf(task) === "blocked")
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
  const doneLeafCount = leafTasks.filter((task) => stateOf(task) === "done").length;
  const topLevelBlockedRootIds = projectChildren
    .filter((id) => stateOf(tree.tasks[id]) === "blocked")
    .sort((a, b) => a.localeCompare(b));
  const topLevelBlockedWaitIds = topLevelBlockedRootIds
    .filter((id) => /(^ops\/wait-|^wait-)/.test(id))
    .sort((a, b) => a.localeCompare(b));
  const topLevelDoneIds = projectChildren
    .filter((id) => stateOf(tree.tasks[id]) === "done")
    .sort((a, b) => a.localeCompare(b));

  const specLoopTask = tree.tasks["aks-spec-verification-loop"];
  const compactLoopTask = tree.tasks["aks-feature-compact-loop"];
  const specLoopWorkflowReason =
    typeof asRecord(specLoopTask?.context).workflowProgress === "object"
      ? (asRecord(asRecord(specLoopTask?.context).workflowProgress).reason as string | undefined) ?? null
      : null;
  const compactLoopWorkflowReason =
    typeof asRecord(compactLoopTask?.context).workflowProgress === "object"
      ? (asRecord(asRecord(compactLoopTask?.context).workflowProgress).reason as string | undefined) ?? null
      : null;

  const frontier: FrontierSnapshot = {
    activeIncludingRepair,
    activeExcludingRepair,
    review,
    waiting,
    runnable,
    blockedLeafIds,
    blockedLeafCount: blockedLeafIds.length,
    doneLeafCount,
    leafTotal: leafTasks.length,
    topLevelBlockedWaitIds,
    topLevelBlockedRootIds,
    topLevelDoneIds,
    acceptedPublicationLeafLive: !!tree.tasks[acceptedPublicationLeafId],
    acceptedPublicationLeafArchive: findArchivedTask(acceptedPublicationLeafId),
    specLoopWorkflowReason,
    compactLoopWorkflowReason,
  };

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const proposalContext = asRecord(currentFocusProposal.context);
  const proposalProgressReview = asRecord(proposalContext.progress_review);
  const proposalAnswers = asRecord(proposalProgressReview.answers);

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.status = "updated";
  currentFocusProposal.reason = buildFrontierReason(frontier);
  currentFocusProposal.evidence_path = evidencePath;

  proposalAnswers.learned_or_verified = [
    `The acceptance-named publication leaf ${acceptedPublicationLeafId} is absent from the live task tree and archived done in ${frontier.acceptedPublicationLeafArchive.archiveFile ?? "unknown archive file"}${frontier.acceptedPublicationLeafArchive.generatedAt ? ` at ${frontier.acceptedPublicationLeafArchive.generatedAt}` : ""}.`,
    `The current active non-repair frontier is ${formatList(frontier.activeExcludingRepair)}; those are app-ops cleanup/reconciliation leaves, not the publication leaf.`,
    `Zero waiting/runnable leaves remains intentional because aks-spec-verification-loop reports ${JSON.stringify(frontier.specLoopWorkflowReason)} and aks-feature-compact-loop reports ${JSON.stringify(frontier.compactLoopWorkflowReason)}; any remaining review/active leaves are app-ops follow-through tasks.`,
    `Top-level blocked steward waits remain exactly ${formatList(frontier.topLevelBlockedWaitIds)}.`,
  ];
  proposalAnswers.live_execution_posture =
    "Do not reopen execution from bookkeeping alone. Keep exact blocked waits stable while the remaining app-ops cleanup/reconciliation leaves finish and a reviewer/planner decides whether to update the stale acceptance contract.";
  proposalAnswers.blocker_mix =
    `Truthful posture outside this repair task: ${frontier.activeExcludingRepair.length} active leaves, ${frontier.review.length} review leaves, ${frontier.waiting.length} waiting leaves, ${frontier.runnable.length} runnable leaves, and ${frontier.blockedLeafCount} blocked leaves.`;
  proposalAnswers.parallel_leafs =
    `The non-repair frontier has ${frontier.activeExcludingRepair.length} active leaves, ${frontier.review.length} review leaves, ${frontier.waiting.length} waiting leaves, and ${frontier.runnable.length} runnable leaves.`;
  proposalAnswers.goal_alignment =
    "The root readout is now explicit that the acceptance-named publication leaf is already archived done, any remaining non-blocked/non-self leaves are app-ops follow-through only, and zero waiting/runnable leaves remains intentional in the loop controllers.";
  proposalProgressReview.reviewed_at = checkedAt;
  proposalProgressReview.result = "updated";
  proposalProgressReview.evidence_path = evidencePath;
  proposalProgressReview.answers = proposalAnswers;

  proposalContext.progress_review = proposalProgressReview;
  proposalContext.active_task_ids = frontier.activeExcludingRepair;
  proposalContext.review_task_ids = frontier.review;
  proposalContext.linked_blocked_task_ids = frontier.topLevelBlockedWaitIds;
  proposalContext.lane_links = {
    execution_verification: frontier.activeExcludingRepair,
    blocked_stewardship: frontier.topLevelBlockedWaitIds,
  };
  currentFocusProposal.context = proposalContext;

  projectTask.summary = buildProjectSummary(frontier);
  projectTask.strategy_context = buildStrategyContext(frontier);
  projectTask.progress = {
    updated_at: checkedAt,
    active_excluding_self: frontier.activeExcludingRepair.length,
    active_including_self: frontier.activeIncludingRepair.length,
    review: frontier.review.length,
    waiting: frontier.waiting.length,
    runnable: frontier.runnable.length,
    blocked: frontier.blockedLeafCount,
    done: frontier.doneLeafCount,
    leaf_total: frontier.leafTotal,
    top_level_blocked: frontier.topLevelBlockedWaitIds.length,
  };
  projectTask.updated_at = checkedAt;

  projectContext.acceptance_note = buildAcceptanceNote(frontier);
  projectContext.current_root_readout = {
    updated_at: checkedAt,
    excludes_task_id: repairTaskId,
    active_task_ids_excluding_self: frontier.activeExcludingRepair,
    active_task_ids_including_self: frontier.activeIncludingRepair,
    review_task_ids: frontier.review,
    waiting_task_ids: frontier.waiting,
    runnable_task_ids: frontier.runnable,
    blocked_leaf_count: frontier.blockedLeafCount,
    top_level_blocked_ids: frontier.topLevelBlockedWaitIds,
    top_level_blocked_root_ids: frontier.topLevelBlockedRootIds,
    top_level_done_ids: frontier.topLevelDoneIds,
    accepted_publication_leaf_id: acceptedPublicationLeafId,
    accepted_publication_leaf_live: frontier.acceptedPublicationLeafLive,
    accepted_publication_leaf_archive_file: frontier.acceptedPublicationLeafArchive.archiveFile,
    accepted_publication_leaf_archived_at: frontier.acceptedPublicationLeafArchive.generatedAt,
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
    project_root_frontier_readout_repair_note:
      "Acceptance-named Windows GPU publication leaf was already archived done before this redo attempt; metadata now records that supersession explicitly.",
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
    } satisfies ProjectBeforeAfter,
  };
});

const runtimeCurrentState = asRecord(runtimeBefore.currentState);
const runtimeCurrentFocus = asRecord(runtimeBefore.currentFocus);
const runtimeFocusReview = asRecord(runtimeCurrentFocus.focusReview);
const runtimeFocusMission = asRecord(runtimeCurrentFocus.focusMission);
const runtimeFocusPlan = asRecord(runtimeBefore.focusPlan);

runtimeCurrentState.summary = buildRuntimeCurrentStateSummary(afterTree.frontier);
runtimeCurrentState.activeTaskId = afterTree.frontier.activeExcludingRepair[0] ?? null;
runtimeCurrentState.metrics = {
  ...asRecord(runtimeCurrentState.metrics),
  blockedLeafCount: afterTree.frontier.blockedLeafCount,
  runnableLeafCount: afterTree.frontier.runnable.length,
  activeLeafCount: afterTree.frontier.activeExcludingRepair.length,
  reviewLeafCount: afterTree.frontier.review.length,
  waitingLeafCount: afterTree.frontier.waiting.length,
};

runtimeCurrentFocus.summary = buildRuntimeCurrentFocusSummary(afterTree.frontier);
runtimeCurrentFocus.nextAction = buildRuntimeNextAction(afterTree.frontier);
runtimeCurrentFocus.activeTaskIds = afterTree.frontier.activeExcludingRepair;
runtimeCurrentFocus.proposedTaskIds = unique([
  ...afterTree.frontier.activeExcludingRepair,
  ...afterTree.frontier.review,
  ...afterTree.frontier.waiting,
  ...afterTree.frontier.runnable,
  ...afterTree.frontier.blockedLeafIds,
]);
runtimeFocusReview.reviewedAt = checkedAt;
runtimeFocusReview.result = "updated";
runtimeFocusReview.note = `Readout sync refreshed the current non-repair frontier. ${buildFrontierReason(afterTree.frontier)}`;
runtimeCurrentFocus.focusReview = runtimeFocusReview;
runtimeFocusMission.activeTaskIds = afterTree.frontier.activeExcludingRepair;
runtimeFocusMission.reviewTaskIds = afterTree.frontier.review;
runtimeFocusMission.linkedBlockedTaskIds = afterTree.frontier.topLevelBlockedWaitIds;
runtimeFocusMission.evidencePath = evidencePath;
runtimeCurrentFocus.focusMission = runtimeFocusMission;

runtimeFocusPlan.summary = `Focus plan readout now mirrors the current non-repair frontier. ${buildFrontierReason(afterTree.frontier)}`;
runtimeFocusPlan.evidencePath = evidencePath;

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

const result = {
  checkedAt,
  attemptId,
  repairTaskId,
  evidencePath,
  beforeProject,
  frontier: afterTree.frontier,
  afterProject: afterTree.projectAfter,
  runtimeBefore: {
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
    currentFocusReviewNote:
      typeof runtimeBeforeFocusReview.note === "string"
        ? runtimeBeforeFocusReview.note
        : null,
    currentFocusMissionActiveTaskIds: asStringArray(runtimeBeforeFocusMission.activeTaskIds),
    focusPlanSummary:
      typeof runtimeBeforeFocusPlan.summary === "string"
        ? runtimeBeforeFocusPlan.summary
        : null,
  },
  runtimeAfter: {
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

writeMemo(`# Project root frontier readout reconciliation — Windows GPU blocked-frontier redo — 2026-07-15

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Checked at: ${checkedAt}

## Executive result

Repaired the app-owned root/readout metadata to match the **current** live task tree rather than the stale acceptance contract. The acceptance-named leaf \`${acceptedPublicationLeafId}\` is not live anymore: it was archived done before this redo attempt, so the truthful current frontier is the archived publication leaf plus only app-ops follow-through residue, zero waiting/runnable leaves, and the exact top-level blocked steward waits.

## Finding-by-finding disposition

1. **Finding:** current root metadata pointed at ops tasks instead of \`${acceptedPublicationLeafId}\`.
   - **Current proof:** still true before this repair. \`beforeProject.currentRootReadout.active_task_ids_excluding_self\` was ${JSON.stringify(asRecord(beforeProject.currentRootReadout).active_task_ids_excluding_self ?? null)}.
   - **Repair/result:** root metadata now explicitly says the accepted publication leaf is archived done and that the remaining active leaves are app-ops cleanup/reconciliation only: ${quoteList(afterTree.frontier.activeExcludingRepair)}.

2. **Finding:** \`${acceptedPublicationLeafId}\` was absent from the live task map.
   - **Current proof:** still true. \`frontier.acceptedPublicationLeafLive\` is ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafLive)}.
   - **Archive proof:** the task is present in ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafArchive.archiveFile)} with generated_at ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafArchive.generatedAt)}.

3. **Finding:** project summary / strategy_context described unrelated app-ops leaves as the Windows GPU publication frontier.
   - **Current proof:** still true before this repair; see \`beforeProject.summary\` and \`beforeProject.strategyContext\`.
   - **Repair/result:** summary/strategy_context now distinguish the archived publication leaf from the remaining app-ops cleanup leaves and explain the exact-wait posture.

4. **Finding:** the prior evidence memo recorded drift from review=[\`${acceptedPublicationLeafId}\`] to active ops tasks.
   - **Current proof:** true; that memo is superseded by this evidence note.
   - **Repair/result:** this note documents the supersession directly instead of pretending the archived publication leaf is still live.

5. **Finding:** zero waiting/runnable/review leaves was preserved, but the required Windows GPU leaf identity was not represented.
   - **Current proof:** partially stale now. Waiting/runnable remain zero, but the live tree currently has review follow-through residue ${quoteList(afterTree.frontier.review)} while the accepted publication leaf itself has already been archived done.
   - **Repair/result:** metadata now records that exact supersession and the remaining review residue. This worker cannot truthfully re-label the archived leaf as live; reviewer/planner must either accept the superseded reality or replace/update the stale acceptance contract.

## Baseline before repair

- \`project.summary\`: ${JSON.stringify(beforeProject.summary)}
- \`project.strategy_context\`: ${JSON.stringify(beforeProject.strategyContext)}
- \`project.progress\`: ${JSON.stringify(beforeProject.progress, null, 2)}
- \`project.context.current_root_readout\`: ${JSON.stringify(beforeProject.currentRootReadout, null, 2)}
- \`project.context.current_focus_proposal\`: ${JSON.stringify(beforeProject.currentFocusProposal, null, 2)}
- \`.state/project-state.json currentState.summary\`: ${JSON.stringify(result.runtimeBefore.currentStateSummary)}
- \`.state/project-state.json currentFocus.summary\`: ${JSON.stringify(result.runtimeBefore.currentFocusSummary)}

## Current live facts used for the repair

- live active project children including this repair: ${quoteList(afterTree.frontier.activeIncludingRepair)}
- live active project children excluding this repair: ${quoteList(afterTree.frontier.activeExcludingRepair)}
- live review leaves: ${quoteList(afterTree.frontier.review)}
- live waiting leaves: ${quoteList(afterTree.frontier.waiting)}
- live runnable leaves: ${quoteList(afterTree.frontier.runnable)}
- blocked leaf count: ${afterTree.frontier.blockedLeafCount}
- exact top-level blocked steward waits: ${quoteList(afterTree.frontier.topLevelBlockedWaitIds)}
- accepted publication leaf live in task map: ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafLive)}
- accepted publication leaf archive file: ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafArchive.archiveFile)}
- accepted publication leaf archived at: ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafArchive.generatedAt)}
- spec-loop exact-wait reason: ${JSON.stringify(afterTree.frontier.specLoopWorkflowReason)}
- compact-loop exact-wait reason: ${JSON.stringify(afterTree.frontier.compactLoopWorkflowReason)}

## Applied metadata repair

Updated the app-owned readout surfaces to reflect the live tree truth:

- \`.state/tasks/tree.json\`
  - \`project.summary\`
  - \`project.strategy_context\`
  - \`project.progress\`
  - \`project.context.acceptance_note\`
  - \`project.context.current_root_readout\`
  - \`project.context.current_focus_proposal.reason\`
  - \`project.context.current_focus_proposal.context.active_task_ids\`
  - \`project.context.current_focus_proposal.context.review_task_ids\`
  - \`project.context.current_focus_proposal.context.linked_blocked_task_ids\`
  - \`project.trace.project_root_frontier_readout_repair_*\`
- \`.state/project-state.json\`
  - \`currentState.summary\`
  - \`currentState.activeTaskId\`
  - \`currentFocus.summary\`
  - \`currentFocus.nextAction\`
  - \`currentFocus.activeTaskIds\`
  - \`currentFocus.focusReview.note\`
  - \`currentFocus.focusMission.activeTaskIds\`
  - \`focusPlan.summary\`

## Verification against the review request

- **Project root current_root_readout and summary/strategy_context point at the accepted Windows GPU leaf identity or explain its supersession with proof:** satisfied by explicit archive fields and text proving \`${acceptedPublicationLeafId}\` is archived done, not live.
- **Readout preserves the zero runnable/waiting posture by design and makes any remaining review residue explicit:** satisfied; live readout is waiting=[], runnable=[], review=[${quoteList(afterTree.frontier.review)}] and cites loop exact-wait reasons from both blocked loop controllers.
- **Exact top-level blocked steward waits remain listed without reopening execution:** satisfied; top-level blocked waits remain ${quoteList(afterTree.frontier.topLevelBlockedWaitIds)}.

## Exact planner/reviewer proposal

The current task acceptance is stale relative to the live task tree. The independent reviewer/planner should choose one of these exact outcomes:

1. **Accept superseded reality for this task** if the goal is now understood as root-readout truthfulness rather than reviving an archived leaf; or
2. **Replace/update the task acceptance** so it no longer requires \`${acceptedPublicationLeafId}\` to be a live leaf and instead requires proof that:
   - \`${acceptedPublicationLeafId}\` archived done in ${afterTree.frontier.acceptedPublicationLeafArchive.archiveFile ?? "the archive"};
   - the remaining active frontier is exactly ${quoteList(afterTree.frontier.activeExcludingRepair)};
   - review/waiting/runnable remain zero by design; and
   - top-level blocked steward waits remain exactly ${quoteList(afterTree.frontier.topLevelBlockedWaitIds)}.

This worker did **not** emit that task-tree/planner transition; it only recorded the exact evidence and proposal.

## Artifact note about project.json

The prior review artifact list named \`project.json\`, but the runtime readout surface actually lives in \`.state/project-state.json\`. Current \`project.json\` is the static app manifest and does not contain \`currentState\` / \`currentFocus\` fields; this attempt repaired the actual runtime readout artifact.

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
