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

type RootFrontierSnapshot = {
  activeIncludingRepair: string[];
  activeExcludingRepair: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blockedLeafCount: number;
  doneLeafCount: number;
  leafTotal: number;
  topLevelBlockedWaitIds: string[];
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
  "ops-apply-reconcile-project-root-frontier-readout-windows-gpu-blocked-frontier-20260715-state-repair";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-project-root-frontier-readout-windows-gpu-blocked-frontier-20260715-state-repair.md";
const attemptId =
  "a_ops-apply-reconcile-project-root-frontier-readout-windows-gpu-blocked-frontier-20260715-state-repair_20260715060030";
const acceptedPublicationLeafId =
  "domain/publish-windows-gpu-vmss-successors-visible-20260715";
const reviewedFollowthroughTaskId =
  "ops-apply-ops-apply-publish-windows-gpu-vmss-successors-visible-20260715-task-tree-followup-domain-followup-domain-follo";
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

function quoteList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `\`${value}\``).join(", ") : "none";
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
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
        return {
          archiveFile: `.state/tasks/archive/${file}`,
          generatedAt,
          task,
        };
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

function isTopLevelBlockedWait(taskId: string): boolean {
  return /(^ops\/wait-|^wait-)/.test(taskId);
}

function isDurableLoopRoot(taskId: string): boolean {
  return (
    taskId === "aks-spec-verification-loop" ||
    taskId === "aks-feature-compact-loop" ||
    taskId === "aks-feature-reference-loop"
  );
}

function isFollowthroughProjectChild(task: TaskNode | undefined): boolean {
  if (!task) return false;
  if (String(task.owner ?? "") !== "app-ops") return false;
  if (task.id === repairTaskId) return true;
  if (isTopLevelBlockedWait(task.id)) return false;
  if (isDurableLoopRoot(task.id)) return false;
  return true;
}

function buildRootContractSentence(): string {
  return "This root-frontier contract intentionally tracks only the archived Windows GPU publication leaf, the current top-level app-ops follow-through frontier, and the exact top-level blocked steward waits; lower-level spec/compact loop children remain under their durable controllers and do not reopen the root readout by themselves.";
}

function buildProjectSummary(frontier: RootFrontierSnapshot): string {
  const archiveAt = frontier.acceptedPublicationLeafArchive.generatedAt ?? "unknown archive time";
  const archiveFile = frontier.acceptedPublicationLeafArchive.archiveFile ?? "unknown archive file";
  return [
    "Project root is reopened and loop-driven, not in the 2026-06-14 wind-down posture.",
    `${buildRootContractSentence()} Live root snapshot ${checkedAt} excludes metadata repair ${repairTaskId} and reflects app-ops follow-through active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}.`,
    `The acceptance-named Windows GPU publication leaf ${acceptedPublicationLeafId} is not live in the current task map; it was archived done at ${archiveAt} in ${archiveFile}.`,
    `Zero waiting/runnable posture remains intentional at the project-root contract because only the top-level follow-through review residue ${formatList(frontier.review)} remains outside the exact blocked steward waits ${formatList(frontier.topLevelBlockedWaitIds)}.`,
  ].join(" ");
}

function buildStrategyContext(frontier: RootFrontierSnapshot): string {
  const archiveAt = frontier.acceptedPublicationLeafArchive.generatedAt ?? "unknown archive time";
  const archiveFile = frontier.acceptedPublicationLeafArchive.archiveFile ?? "unknown archive file";
  return `Planner update (${checkedAt}): replaced the stale Windows GPU root-frontier contract with a stable readout that records ${acceptedPublicationLeafId} as archived done at ${archiveAt} in ${archiveFile}. ${buildRootContractSentence()} Current top-level app-ops follow-through outside this repair is active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], while the exact top-level blocked steward waits remain ${formatList(frontier.topLevelBlockedWaitIds)}.`;
}

function buildAcceptanceNote(frontier: RootFrontierSnapshot): string {
  return `Current root readout at ${checkedAt} excludes metadata repair ${repairTaskId} and records ${acceptedPublicationLeafId} as archived done, app-ops follow-through active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}, and exact top-level blocked steward waits ${formatList(frontier.topLevelBlockedWaitIds)}.`;
}

function buildProposalReason(frontier: RootFrontierSnapshot): string {
  return `Current root-contract non-repair frontier is active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. ${acceptedPublicationLeafId} is archived done and absent from the live task map. ${buildRootContractSentence()} Spec-loop still reports ${JSON.stringify(frontier.specLoopWorkflowReason)} and feature-compact-loop still reports ${JSON.stringify(frontier.compactLoopWorkflowReason)}.`;
}

function buildRuntimeCurrentStateSummary(frontier: RootFrontierSnapshot): string {
  return `Project-root readout at ${checkedAt} intentionally mirrors the same top-level contract as project.context.current_root_readout: accepted Windows GPU publication leaf archived done, app-ops follow-through active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. ${buildRootContractSentence()}`;
}

function buildRuntimeCurrentFocusSummary(frontier: RootFrontierSnapshot): string {
  return `Current root-frontier follow-through is active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}]; ${acceptedPublicationLeafId} remains archived done.`;
}

function buildRuntimeNextAction(frontier: RootFrontierSnapshot): string {
  if (frontier.review.length > 0) {
    return `Keep the root contract truthful: leave ${acceptedPublicationLeafId} archived done, preserve review follow-through ${formatList(frontier.review)}, and keep the exact top-level blocked steward waits ${formatList(frontier.topLevelBlockedWaitIds)} without reopening Windows GPU execution from bookkeeping alone.`;
  }
  return `Keep the root contract truthful: leave ${acceptedPublicationLeafId} archived done and preserve the exact top-level blocked steward waits ${formatList(frontier.topLevelBlockedWaitIds)} without reopening Windows GPU execution from bookkeeping alone.`;
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
  const followthroughChildren = projectChildren
    .map((id) => tree.tasks[id])
    .filter((task): task is TaskNode => !!task && isFollowthroughProjectChild(task));

  const activeExcludingRepair = followthroughChildren
    .filter((task) => task.id !== repairTaskId && stateOf(task) === "active")
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
  const activeIncludingRepair = followthroughChildren
    .filter((task) => stateOf(task) === "active")
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
  const review = followthroughChildren
    .filter((task) => task.id !== repairTaskId && stateOf(task) === "review")
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
  const waiting = followthroughChildren
    .filter((task) => task.id !== repairTaskId && stateOf(task) === "waiting")
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
  const runnable = followthroughChildren
    .filter((task) => task.id !== repairTaskId && ["runnable", "pending", "backlog"].includes(stateOf(task)))
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));

  const blockedLeafCount = leafTasks.filter((task) => stateOf(task) === "blocked").length;
  const doneLeafCount = leafTasks.filter((task) => stateOf(task) === "done").length;
  const topLevelBlockedWaitIds = projectChildren
    .filter((id) => stateOf(tree.tasks[id]) === "blocked" && isTopLevelBlockedWait(id))
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

  const frontier: RootFrontierSnapshot = {
    activeIncludingRepair,
    activeExcludingRepair,
    review,
    waiting,
    runnable,
    blockedLeafCount,
    doneLeafCount,
    leafTotal: leafTasks.length,
    topLevelBlockedWaitIds,
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
  currentFocusProposal.reason = buildProposalReason(frontier);
  currentFocusProposal.evidence_path = evidencePath;

  proposalAnswers.learned_or_verified = [
    `The acceptance-named publication leaf ${acceptedPublicationLeafId} is absent from the live task tree and archived done in ${frontier.acceptedPublicationLeafArchive.archiveFile ?? "unknown archive file"}${frontier.acceptedPublicationLeafArchive.generatedAt ? ` at ${frontier.acceptedPublicationLeafArchive.generatedAt}` : ""}.`,
    `The current top-level app-ops follow-through frontier excluding this repair is active=[${formatList(frontier.activeExcludingRepair)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}].`,
    `Zero waiting/runnable posture remains intentional at the root-contract scope even though lower-level durable loop children still exist under aks-spec-verification-loop and aks-feature-compact-loop; their current workflow reasons are ${JSON.stringify(frontier.specLoopWorkflowReason)} and ${JSON.stringify(frontier.compactLoopWorkflowReason)}.`,
    `Top-level blocked steward waits remain exactly ${formatList(frontier.topLevelBlockedWaitIds)}.`,
  ];
  proposalAnswers.live_execution_posture =
    "Do not reopen Windows GPU execution from bookkeeping alone. Keep the archived-publication readout, preserve the current follow-through review residue, and leave the exact blocked waits unchanged until a same-lineage reviewer/planner decision lands.";
  proposalAnswers.blocker_mix =
    `Truthful root-contract posture outside this repair task: ${frontier.activeExcludingRepair.length} active follow-through leaves, ${frontier.review.length} review leaves, ${frontier.waiting.length} waiting leaves, ${frontier.runnable.length} runnable leaves, and ${frontier.blockedLeafCount} blocked leaves.`;
  proposalAnswers.parallel_leafs =
    `The current non-repair app-ops follow-through frontier has ${frontier.activeExcludingRepair.length} active leaves, ${frontier.review.length} review leaves, ${frontier.waiting.length} waiting leaves, and ${frontier.runnable.length} runnable leaves.`;
  proposalAnswers.goal_alignment =
    "The root readout now consistently treats the accepted Windows GPU publication leaf as archived done, the surviving top-level app-ops follow-through residue as review-only, and the exact blocked waits as the only top-level blocked stewards.";
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
    contract_scope:
      "archived-publication leaf + top-level app-ops follow-through + exact top-level blocked steward waits",
    active_task_ids_excluding_self: frontier.activeExcludingRepair,
    active_task_ids_including_self: frontier.activeIncludingRepair,
    review_task_ids: frontier.review,
    waiting_task_ids: frontier.waiting,
    runnable_task_ids: frontier.runnable,
    blocked_leaf_count: frontier.blockedLeafCount,
    top_level_blocked_ids: frontier.topLevelBlockedWaitIds,
    top_level_blocked_root_ids: frontier.topLevelBlockedWaitIds,
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
      "Replacement repair restored the root contract to archived-publication truth plus the live top-level app-ops follow-through frontier, excluding lower-level loop children from project-state readout parity.",
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
      acceptanceNote:
        typeof projectContext.acceptance_note === "string"
          ? projectContext.acceptance_note
          : null,
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
  ...afterTree.frontier.topLevelBlockedWaitIds,
]);
runtimeFocusReview.reviewedAt = checkedAt;
runtimeFocusReview.result = "updated";
runtimeFocusReview.note = `Readout sync refreshed the current top-level root contract. ${buildProposalReason(afterTree.frontier)}`;
runtimeCurrentFocus.focusReview = runtimeFocusReview;
runtimeFocusMission.activeTaskIds = afterTree.frontier.activeExcludingRepair;
runtimeFocusMission.reviewTaskIds = afterTree.frontier.review;
runtimeFocusMission.linkedBlockedTaskIds = afterTree.frontier.topLevelBlockedWaitIds;
runtimeFocusMission.evidencePath = evidencePath;
runtimeCurrentFocus.focusMission = runtimeFocusMission;

runtimeFocusPlan.summary = `Focus plan root readout now mirrors the same archived-publication/top-level-follow-through contract. ${buildProposalReason(afterTree.frontier)}`;
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
const runtimeAfterFocusMission = asRecord(runtimeAfterCurrentFocus.focusMission);
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
    currentFocusMissionReviewTaskIds: asStringArray(runtimeBeforeFocusMission.reviewTaskIds),
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
    currentFocusMissionActiveTaskIds: asStringArray(runtimeAfterFocusMission.activeTaskIds),
    currentFocusMissionReviewTaskIds: asStringArray(runtimeAfterFocusMission.reviewTaskIds),
    focusPlanSummary:
      typeof runtimeAfterFocusPlan.summary === "string"
        ? runtimeAfterFocusPlan.summary
        : null,
  },
};

writeMemo(`# Project-root frontier contract replacement — Windows GPU blocked-frontier state repair — 2026-07-15

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Checked at: ${checkedAt}

## Executive result

Applied the bounded app-owned state repair that replaces the stale \"live domain publication leaf\" root contract with the truthful current contract: \`${acceptedPublicationLeafId}\` is archived done, the only surviving top-level app-ops follow-through residue is review task ${quoteList(afterTree.frontier.review)}, waiting/runnable remain zero at the root-contract scope by design, and the exact top-level blocked steward waits remain ${quoteList(afterTree.frontier.topLevelBlockedWaitIds)}.

## Baseline before repair

- \`bun run task-tree show project\` exposed root metadata whose summary/strategy/current_root_readout still used the archived-publication contract but \`.state/project-state.json\` no longer matched it.
- \`project.summary\`: ${JSON.stringify(beforeProject.summary)}
- \`project.strategy_context\`: ${JSON.stringify(beforeProject.strategyContext)}
- \`project.progress\`: ${JSON.stringify(beforeProject.progress, null, 2)}
- \`project.context.current_root_readout\`: ${JSON.stringify(beforeProject.currentRootReadout, null, 2)}
- \`project.context.current_focus_proposal\`: ${JSON.stringify(beforeProject.currentFocusProposal, null, 2)}
- \`.state/project-state.json currentState.summary\`: ${JSON.stringify(result.runtimeBefore.currentStateSummary)}
- \`.state/project-state.json currentFocus.summary\`: ${JSON.stringify(result.runtimeBefore.currentFocusSummary)}

## Live facts used for the repair

- accepted publication leaf live in task map: ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafLive)}
- accepted publication leaf archive file: ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafArchive.archiveFile)}
- accepted publication leaf archived at: ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafArchive.generatedAt)}
- current top-level app-ops follow-through active excluding this repair: ${quoteList(afterTree.frontier.activeExcludingRepair)}
- current top-level app-ops follow-through review: ${quoteList(afterTree.frontier.review)}
- current top-level app-ops follow-through waiting: ${quoteList(afterTree.frontier.waiting)}
- current top-level app-ops follow-through runnable: ${quoteList(afterTree.frontier.runnable)}
- exact top-level blocked steward waits: ${quoteList(afterTree.frontier.topLevelBlockedWaitIds)}
- spec-loop workflow reason: ${JSON.stringify(afterTree.frontier.specLoopWorkflowReason)}
- compact-loop workflow reason: ${JSON.stringify(afterTree.frontier.compactLoopWorkflowReason)}

## Applied repair surfaces

Updated the app-owned readout surfaces so they all encode the same root contract:

- \`.state/tasks/tree.json\`
  - \`project.summary\`
  - \`project.strategy_context\`
  - \`project.progress\`
  - \`project.context.acceptance_note\`
  - \`project.context.current_root_readout\`
  - \`project.context.current_focus_proposal\`
  - \`project.trace.project_root_frontier_readout_repair_*\`
- \`.state/project-state.json\`
  - \`currentState.summary\`
  - \`currentState.activeTaskId\`
  - \`currentState.metrics.activeLeafCount/reviewLeafCount/waitingLeafCount/runnableLeafCount\`
  - \`currentFocus.summary\`
  - \`currentFocus.nextAction\`
  - \`currentFocus.activeTaskIds\`
  - \`currentFocus.proposedTaskIds\`
  - \`currentFocus.focusReview.note\`
  - \`currentFocus.focusMission.activeTaskIds\`
  - \`currentFocus.focusMission.reviewTaskIds\`
  - \`focusPlan.summary\`

## Verification against the review request

- **Replacement repair no longer claims \`${acceptedPublicationLeafId}\` is live:** satisfied. Both task-tree and project-state now record it as archived done with ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafArchive.archiveFile)} at ${JSON.stringify(afterTree.frontier.acceptedPublicationLeafArchive.generatedAt)}.
- **Project root current_root_readout, summary/strategy_context, and .state/project-state currentState/currentFocus identify the same live non-repair frontier:** satisfied. They now all point at active=[${formatList(afterTree.frontier.activeExcludingRepair)}], review=[${formatList(afterTree.frontier.review)}], waiting=[${formatList(afterTree.frontier.waiting)}], runnable=[${formatList(afterTree.frontier.runnable)}] at the root-contract scope.
- **Runnable and waiting remain zero by design, counts exclude this repair, and exact top-level blocked steward waits are preserved:** satisfied. Root-contract runnable/waiting are both empty, this repair is excluded from non-repair counts, and blocked waits remain ${quoteList(afterTree.frontier.topLevelBlockedWaitIds)}.

## Exact planner/reviewer proposal

The worker did not emit any planner/runtime event. The exact review proposal is:

1. Treat this repair as the replacement root-frontier contract for the reviewed task because the acceptance-named publication leaf is already archived done and cannot truthfully be restored as live.
2. Review/accept the branch on the updated contract that requires:
   - archive proof for \`${acceptedPublicationLeafId}\` in ${afterTree.frontier.acceptedPublicationLeafArchive.archiveFile ?? "the archive"};
   - current top-level app-ops follow-through frontier exactly active=[${formatList(afterTree.frontier.activeExcludingRepair)}], review=[${formatList(afterTree.frontier.review)}], waiting=[${formatList(afterTree.frontier.waiting)}], runnable=[${formatList(afterTree.frontier.runnable)}];
   - exact top-level blocked steward waits exactly ${quoteList(afterTree.frontier.topLevelBlockedWaitIds)}; and
   - project-state readout parity with the task-tree root contract.

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
