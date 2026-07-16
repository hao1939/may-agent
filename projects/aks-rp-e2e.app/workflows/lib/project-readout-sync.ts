import { readFileSync } from "node:fs";
import {
  loadProjectReadModel,
  projectRuntimePaths,
  saveProjectRuntimeState,
} from "@may-agent/sdk";
import { saveTaskTreeWithKanbanSnapshot } from "./task-tree-tools.ts";
import { buildProjectSnapshotV2 } from "./project-snapshot-v2.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
  type TaskTreeConfig,
} from "./task-tree-store.ts";

type ProjectStateRecord = Record<string, unknown>;

type SyncProjectReadoutResult = {
  changed: boolean;
  projectJsonPath: string;
  liveFocusTaskIds: string[];
  allLiveLeafTaskIds: string[];
  activeTaskId: string | null;
  counts: {
    active: number;
    blocked: number;
    review: number;
    waiting: number;
    runnable: number;
  };
  focusPlanId: string | null;
  snapshot: {
    version: "project-snapshot-v2";
    capturedAt: string;
    treeUpdatedAt: string | null;
  };
};

function objectValue(value: unknown): ProjectStateRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ProjectStateRecord)
    : {};
}

function nodeState(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog");
}

function isLeaf(task: TaskNode | undefined): boolean {
  return Array.isArray(task?.children) ? task!.children!.length === 0 : true;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function sampleIds(ids: string[], limit = 8): string {
  const picked = ids.slice(0, limit);
  if (picked.length === 0) return "none";
  return ids.length > limit
    ? `${picked.join(", ")} (+${ids.length - limit} more)`
    : picked.join(", ");
}

function isReadoutParityRepairGoal(goal: string): boolean {
  if (/focus\/?readout metadata/i.test(goal)) return true;
  const mentionsParitySurface =
    /currentfocus\.focusreview\.note|focusplan\.summary|current_focus_proposal|focus surfaces?/i.test(
      goal,
    );
  if (!mentionsParitySurface) return false;
  if (!/(readout|metadata|project-state|focus surfaces?)/i.test(goal))
    return false;
  return /(repair|guard|parity|align|sync|rewrite|reconcile|refresh)/i.test(
    goal,
  );
}

function isSuppressedReadoutRepairLeaf(task: TaskNode | undefined): boolean {
  if (!task || !isLeaf(task)) return false;
  const state = nodeState(task);
  if (state === "done") return false;
  if (String(task.owner ?? "") !== "app-ops") return false;

  const goal = String(task.goal ?? "");
  if (!isReadoutParityRepairGoal(goal)) return false;

  const context = objectValue(task.context);
  const reviewedTask = context.reviewedTask;
  const hasReviewedTask =
    !!reviewedTask &&
    typeof reviewedTask === "object" &&
    !Array.isArray(reviewedTask);

  return hasReviewedTask || /non-repair frontier/i.test(goal);
}

function filterSuppressedReadoutRepairIds(
  tree: ReturnType<typeof readTaskTree>,
  ids: string[],
): string[] {
  return ids.filter(
    (id) =>
      !isSuppressedReadoutRepairLeaf(tree.tasks[id]) &&
      !isRootContractScopedRepairTask(tree.tasks[id]),
  );
}

function liveFocusTaskIds(input: {
  active: string[];
  blocked: string[];
  review: string[];
  runnable: string[];
  waiting: string[];
}): string[] {
  const preferred = unique([
    ...input.active,
    ...input.review,
    ...input.runnable,
    ...input.waiting,
  ]);
  return preferred.length > 0 ? preferred : unique(input.blocked);
}

function allLiveLeafTaskIds(input: {
  active: string[];
  blocked: string[];
  review: string[];
  runnable: string[];
  waiting: string[];
}): string[] {
  return unique([
    ...input.active,
    ...input.review,
    ...input.runnable,
    ...input.waiting,
    ...input.blocked,
  ]);
}

function liveFocusPlan(tree: ReturnType<typeof readTaskTree>): {
  id: string;
  status: string;
} | null {
  const live = Object.values(tree.tasks)
    .filter((task) => task.kind === "focus_plan" && nodeState(task) !== "done")
    .sort((a, b) => a.id.localeCompare(b.id));
  if (live.length === 0) return null;
  return {
    id: live[0].id,
    status: nodeState(live[0]),
  };
}

type BlockedOnlyDisposition = {
  focusTaskId: string;
  governingWaitTaskId: string;
};

function stringValue(record: ProjectStateRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function numberValue(
  record: ProjectStateRecord,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function stringArrayValue(
  record: ProjectStateRecord,
  keys: string[],
): string[] {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    return value
      .filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
      .map((entry) => entry.trim());
  }
  return [];
}

type RootContractReadout = {
  scope: string;
  excludesTaskId: string | null;
  scopedRepairTaskIds: string[];
  acceptedPublicationLeafId: string | null;
  acceptedPublicationLeafLive: boolean;
  acceptedPublicationLeafArchiveFile: string | null;
  acceptedPublicationLeafArchivedAt: string | null;
  activeTaskIdsExcludingSelf: string[];
  activeTaskIdsIncludingSelf: string[];
  reviewTaskIds: string[];
  waitingTaskIds: string[];
  runnableTaskIds: string[];
  topLevelBlockedIds: string[];
  blockedLineageIds: string[];
  blockedLeafCount: number;
};

function isTopLevelBlockedWaitTask(taskId: string): boolean {
  return /(^ops\/wait-|^wait-)/.test(taskId);
}

function isDurableLoopRootTask(taskId: string): boolean {
  return (
    taskId === "aks-spec-verification-loop" ||
    taskId === "aks-feature-compact-loop" ||
    taskId === "aks-feature-reference-loop"
  );
}

function isProjectRootReadoutScopeRepairGoal(goal: string): boolean {
  if (!/(repair|reconcile|sync|refresh|readout|rewrite)/i.test(goal))
    return false;
  return /project[ -]root(?: frontier\/progress)? readout|current_root_readout|project-state|root-contract|scope sync/i.test(
    goal,
  );
}

function isRootContractScopedRepairTask(task: TaskNode | undefined): boolean {
  if (!task || !isLeaf(task)) return false;
  if (String(task.owner ?? "") !== "app-ops") return false;
  return isProjectRootReadoutScopeRepairGoal(String(task.goal ?? ""));
}

function isRootContractFollowthroughChild(task: TaskNode | undefined): boolean {
  if (!task) return false;
  if (String(task.owner ?? "") !== "app-ops") return false;
  if (isTopLevelBlockedWaitTask(task.id)) return false;
  if (isDurableLoopRootTask(task.id)) return false;
  return true;
}

function projectRootContractReadout(
  tree: ReturnType<typeof readTaskTree>,
  frontier: {
    activeTaskIds: string[];
    reviewTaskIds: string[];
    waitingTaskIds: string[];
    runnableTaskIds: string[];
    blockedTaskIds: string[];
    blockedLeafCount: number;
  },
): RootContractReadout | null {
  const projectTask = tree.tasks.project;
  if (!projectTask) return null;
  const projectContext = objectValue(projectTask.context);
  const rootReadout = objectValue(projectContext.current_root_readout);
  const scope = stringValue(rootReadout, ["contract_scope"]);
  if (!scope) return null;

  const projectChildren = Array.isArray(projectTask.children)
    ? projectTask.children.filter(
        (child): child is string =>
          typeof child === "string" && child.trim().length > 0,
      )
    : [];
  const excludesTaskId = stringValue(rootReadout, ["excludes_task_id"]) || null;
  const followthroughChildren = projectChildren
    .map((id) => tree.tasks[id])
    .filter(
      (task): task is TaskNode =>
        !!task && isRootContractFollowthroughChild(task),
    );
  const scopedRepairTaskIds = followthroughChildren
    .filter(
      (task) =>
        nodeState(task) !== "done" && isRootContractScopedRepairTask(task),
    )
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));

  const currentFocusProposal = objectValue(
    projectContext.current_focus_proposal,
  );
  const proposalContext = objectValue(currentFocusProposal.context);
  const activeTaskIdsExcludingSelf = unique(frontier.activeTaskIds).sort(
    (a, b) => a.localeCompare(b),
  );
  const activeTaskIdsIncludingSelf = unique([
    ...activeTaskIdsExcludingSelf,
    ...scopedRepairTaskIds.filter(
      (id) => nodeState(tree.tasks[id]) === "active",
    ),
  ]).sort((a, b) => a.localeCompare(b));
  const reviewTaskIds = unique(frontier.reviewTaskIds).sort((a, b) =>
    a.localeCompare(b),
  );
  const waitingTaskIds = unique(frontier.waitingTaskIds).sort((a, b) =>
    a.localeCompare(b),
  );
  const runnableTaskIds = unique(frontier.runnableTaskIds).sort((a, b) =>
    a.localeCompare(b),
  );
  const topLevelBlockedIds = projectChildren
    .filter(
      (id) =>
        isTopLevelBlockedWaitTask(id) &&
        nodeState(tree.tasks[id]) === "blocked",
    )
    .sort((a, b) => a.localeCompare(b));
  const blockedTaskIdSet = new Set(frontier.blockedTaskIds);
  const blockedLineageIds = unique([
    ...stringArrayValue(proposalContext, ["blocked_task_ids"]),
    ...stringArrayValue(proposalContext, ["linked_blocked_task_ids"]),
    ...topLevelBlockedIds,
  ]).filter((id) => blockedTaskIdSet.has(id));
  const blockedLeafCount = frontier.blockedTaskIds.length;
  const acceptedPublicationLeafId =
    stringValue(rootReadout, ["accepted_publication_leaf_id"]) || null;

  return {
    scope,
    excludesTaskId,
    scopedRepairTaskIds,
    acceptedPublicationLeafId,
    acceptedPublicationLeafLive: acceptedPublicationLeafId
      ? !!tree.tasks[acceptedPublicationLeafId]
      : false,
    acceptedPublicationLeafArchiveFile:
      stringValue(rootReadout, ["accepted_publication_leaf_archive_file"]) ||
      null,
    acceptedPublicationLeafArchivedAt:
      stringValue(rootReadout, ["accepted_publication_leaf_archived_at"]) ||
      null,
    activeTaskIdsExcludingSelf,
    activeTaskIdsIncludingSelf,
    reviewTaskIds,
    waitingTaskIds,
    runnableTaskIds,
    topLevelBlockedIds,
    blockedLineageIds,
    blockedLeafCount,
  };
}

function blockedOnlyDisposition(
  tree: ReturnType<typeof readTaskTree>,
): BlockedOnlyDisposition | null {
  const blockedLeaves = Object.values(tree.tasks)
    .filter((task) => isLeaf(task) && nodeState(task) === "blocked")
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const task of blockedLeaves) {
    if (task.kind !== "focus_plan") continue;
    const context = objectValue(task.context);
    if (context.needs_approval !== true) continue;

    const observations = objectValue(context.observations);
    const frontierCounts = [
      numberValue(observations, ["frontier_active_leaf_count"]),
      numberValue(observations, ["frontier_review_leaf_count"]),
      numberValue(observations, ["frontier_waiting_leaf_count"]),
      numberValue(observations, ["frontier_runnable_leaf_count"]),
    ];
    if (frontierCounts.some((value) => value !== 0 && value !== null)) continue;

    const blocker = objectValue(task.blocker);
    if (stringValue(blocker, ["category"]).toLowerCase() !== "external-wait") {
      continue;
    }
    if (stringValue(blocker, ["owner"]).toLowerCase() !== "human") {
      continue;
    }

    const waitingFor = objectValue(blocker.waiting_for);
    if (stringValue(waitingFor, ["type"]).toLowerCase() !== "owner.decision") {
      continue;
    }

    const governingWaitTaskId = stringValue(waitingFor, [
      "governingWaitTaskId",
      "governing_wait_task_id",
      "taskId",
      "task_id",
    ]);
    if (!governingWaitTaskId) continue;

    const governingTask = tree.tasks[governingWaitTaskId];
    if (!governingTask || !isLeaf(governingTask)) continue;
    if (nodeState(governingTask) !== "blocked") continue;

    const governingBlocker = objectValue(governingTask.blocker);
    if (
      stringValue(governingBlocker, ["category"]).toLowerCase() !==
        "external-wait" ||
      stringValue(governingBlocker, ["owner"]).toLowerCase() !== "human"
    ) {
      continue;
    }
    const governingWaitingFor = objectValue(governingBlocker.waiting_for);
    if (
      stringValue(governingWaitingFor, ["type"]).toLowerCase() !==
      "project.approval.submitted"
    ) {
      continue;
    }

    return {
      focusTaskId: task.id,
      governingWaitTaskId,
    };
  }
  return null;
}

function buildCurrentStateSummary(input: {
  updatedAt: string;
  counts: SyncProjectReadoutResult["counts"];
  liveFocusTaskIds: string[];
  blockedDisposition: BlockedOnlyDisposition | null;
}): string {
  const { updatedAt, counts, liveFocusTaskIds, blockedDisposition } = input;
  const blockedOnly =
    counts.active === 0 &&
    counts.review === 0 &&
    counts.runnable === 0 &&
    counts.waiting === 0 &&
    counts.blocked > 0;
  if (blockedOnly && blockedDisposition) {
    return `Task-tree summary at ${updatedAt} shows 0 runnable leaves, 0 waiting leaves, 0 active leaves, 0 review leaves, and ${counts.blocked} blocked leaves. Live frontier is an approval-gated blocked disposition: focus ${blockedDisposition.focusTaskId} is governed by exact human external-wait ${blockedDisposition.governingWaitTaskId}, so loop residue files stay diagnostic-only unless a live tree leaf changes.`;
  }
  if (blockedOnly) {
    return `Task-tree summary at ${updatedAt} shows 0 runnable leaves, 0 waiting leaves, 0 active leaves, 0 review leaves, and ${counts.blocked} blocked leaves. Live frontier is blocked-only exact wait stewardship from non-done task-tree leaves; loop residue files are diagnostic-only unless backed by a live tree leaf.`;
  }
  return `Task-tree summary at ${updatedAt} shows ${counts.runnable} runnable leaves, ${counts.waiting} waiting leaves, ${counts.active} active leaves, ${counts.review} review leaves, and ${counts.blocked} blocked leaves. Current live frontier is derived from non-done task-tree leaves first: ${sampleIds(liveFocusTaskIds)}. Loop residue files are diagnostic-only unless backed by a live tree leaf.`;
}

function buildCurrentFocusSummary(input: {
  counts: SyncProjectReadoutResult["counts"];
  liveFocusTaskIds: string[];
  blockedDisposition: BlockedOnlyDisposition | null;
}): string {
  const { counts, liveFocusTaskIds, blockedDisposition } = input;
  const blockedOnly =
    counts.active === 0 &&
    counts.review === 0 &&
    counts.runnable === 0 &&
    counts.waiting === 0 &&
    counts.blocked > 0;
  if (blockedOnly && blockedDisposition) {
    return `Current live focus is approval-gated blocked stewardship: ${blockedDisposition.focusTaskId} is paused on governing wait ${blockedDisposition.governingWaitTaskId}. Do not reopen compact/spec execution from loop residue alone.`;
  }
  if (blockedOnly) {
    return `Current live focus is blocked-only wait stewardship from the task tree: ${sampleIds(liveFocusTaskIds)}. Do not reopen compact/spec execution from loop residue alone.`;
  }
  return `Current live focus is derived from non-done task-tree leaves first: ${sampleIds(liveFocusTaskIds)}.`;
}

function buildNextAction(input: {
  counts: SyncProjectReadoutResult["counts"];
  liveFocusTaskIds: string[];
  activeTaskIds: string[];
  blockedDisposition: BlockedOnlyDisposition | null;
}): string {
  const { counts, liveFocusTaskIds, activeTaskIds, blockedDisposition } = input;
  if (counts.active > 0) {
    return `Finish the current active live-frontier leaf/leaves first: ${sampleIds(activeTaskIds)}. Keep project/app summaries grounded in task-tree live leaves rather than loop residue.`;
  }
  if (counts.review > 0 || counts.runnable > 0 || counts.waiting > 0) {
    return `Work the current non-done task-tree frontier in order: ${sampleIds(liveFocusTaskIds)}. Keep loop residue diagnostic-only unless it is represented by a live leaf.`;
  }
  if (blockedDisposition) {
    return `Preserve governing wait ${blockedDisposition.governingWaitTaskId} for focus ${blockedDisposition.focusTaskId}, and reopen work only when that same approval lineage changes or returns a decision.`;
  }
  return `Preserve the exact blocked waits (${sampleIds(liveFocusTaskIds)}) and reopen work only when one named resume condition lands; do not dispatch from loop residue alone.`;
}

function formatFrontierIds(ids: string[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}

function isBlockedOnly(counts: SyncProjectReadoutResult["counts"]): boolean {
  return (
    counts.active === 0 &&
    counts.review === 0 &&
    counts.runnable === 0 &&
    counts.waiting === 0 &&
    counts.blocked > 0
  );
}

type ReadoutParityBundle = {
  frontierSentence: string;
  focusReviewNote: string;
  focusPlanSummary: string;
  proposalReason: string;
};

function buildFrontierVector(input: {
  counts: SyncProjectReadoutResult["counts"];
  activeTaskIds: string[];
  reviewTaskIds: string[];
  waitingTaskIds: string[];
  runnableTaskIds: string[];
}): string {
  const {
    counts,
    activeTaskIds,
    reviewTaskIds,
    waitingTaskIds,
    runnableTaskIds,
  } = input;
  return `active=[${formatFrontierIds(activeTaskIds)}], review=[${formatFrontierIds(reviewTaskIds)}], waiting=[${formatFrontierIds(waitingTaskIds)}], runnable=[${formatFrontierIds(runnableTaskIds)}], blocked=${counts.blocked}`;
}

function buildFrontierSentence(input: {
  counts: SyncProjectReadoutResult["counts"];
  activeTaskIds: string[];
  reviewTaskIds: string[];
  waitingTaskIds: string[];
  runnableTaskIds: string[];
  liveFocusTaskIds: string[];
  blockedDisposition: BlockedOnlyDisposition | null;
}): string {
  const {
    counts,
    activeTaskIds,
    reviewTaskIds,
    waitingTaskIds,
    runnableTaskIds,
    liveFocusTaskIds,
    blockedDisposition,
  } = input;
  const frontierVector = buildFrontierVector({
    counts,
    activeTaskIds,
    reviewTaskIds,
    waitingTaskIds,
    runnableTaskIds,
  });
  if (isBlockedOnly(counts) && blockedDisposition) {
    return `Current non-repair frontier is ${frontierVector}. Focus disposition is approval-gated blocked stewardship: focus ${blockedDisposition.focusTaskId} remains governed by wait ${blockedDisposition.governingWaitTaskId}.`;
  }
  if (isBlockedOnly(counts)) {
    return `Current non-repair frontier is ${frontierVector}. Focus disposition is blocked-only exact wait stewardship: live focus remains on ${sampleIds(liveFocusTaskIds)}.`;
  }
  return `Current non-repair frontier is ${frontierVector}. Current live focus is ${sampleIds(liveFocusTaskIds)}.`;
}

function buildReadoutParityBundle(input: {
  counts: SyncProjectReadoutResult["counts"];
  activeTaskIds: string[];
  reviewTaskIds: string[];
  waitingTaskIds: string[];
  runnableTaskIds: string[];
  liveFocusTaskIds: string[];
  blockedDisposition: BlockedOnlyDisposition | null;
}): ReadoutParityBundle {
  const frontierSentence = buildFrontierSentence(input);
  return {
    frontierSentence,
    focusReviewNote: `Readout sync refreshed the current non-repair frontier. ${frontierSentence}`,
    focusPlanSummary: `Focus plan readout now mirrors the current non-repair frontier. ${frontierSentence}`,
    proposalReason: frontierSentence,
  };
}

function rootContractPublicationSentence(root: RootContractReadout): string {
  if (!root.acceptedPublicationLeafId) {
    return `Project root contract remains scoped to ${root.scope}.`;
  }
  if (root.acceptedPublicationLeafLive) {
    return `${root.acceptedPublicationLeafId} is still live in the task tree and must remain represented by the root contract.`;
  }
  const archiveAt = root.acceptedPublicationLeafArchivedAt
    ? ` at ${root.acceptedPublicationLeafArchivedAt}`
    : "";
  const archiveFile = root.acceptedPublicationLeafArchiveFile
    ? ` in ${root.acceptedPublicationLeafArchiveFile}`
    : "";
  return `${root.acceptedPublicationLeafId} is archived done and absent from the live task map${archiveAt}${archiveFile}.`;
}

function rootContractBlockedLineageSentence(root: RootContractReadout): string {
  const blockedLineage = formatFrontierIds(root.blockedLineageIds);
  const topLevelBlocked = formatFrontierIds(root.topLevelBlockedIds);
  if (
    root.blockedLineageIds.length === root.topLevelBlockedIds.length &&
    root.blockedLineageIds.every(
      (id, index) => id === root.topLevelBlockedIds[index],
    )
  ) {
    return `Exact top-level blocked steward waits remain ${topLevelBlocked}.`;
  }
  return `Preserved blocked carrier lineage remains ${blockedLineage}. Exact top-level blocked steward waits remain ${topLevelBlocked}.`;
}

function buildRootContractCurrentStateSummary(input: {
  updatedAt: string;
  root: RootContractReadout;
  counts: SyncProjectReadoutResult["counts"];
}): string {
  const { updatedAt, root, counts } = input;
  return `Project-root readout at ${updatedAt} mirrors project.context.current_root_readout (${root.scope}): app-ops follow-through active=[${formatFrontierIds(root.activeTaskIdsExcludingSelf)}], review=[${formatFrontierIds(root.reviewTaskIds)}], waiting=[${formatFrontierIds(root.waitingTaskIds)}], runnable=[${formatFrontierIds(root.runnableTaskIds)}], blocked=${counts.blocked}. ${rootContractPublicationSentence(root)} ${rootContractBlockedLineageSentence(root)}`;
}

function buildRootContractCurrentFocusSummary(
  root: RootContractReadout,
): string {
  return `Current root-frontier follow-through is active=[${formatFrontierIds(root.activeTaskIdsExcludingSelf)}], review=[${formatFrontierIds(root.reviewTaskIds)}], waiting=[${formatFrontierIds(root.waitingTaskIds)}], runnable=[${formatFrontierIds(root.runnableTaskIds)}]. ${rootContractPublicationSentence(root)} ${rootContractBlockedLineageSentence(root)}`;
}

function buildRootContractNextAction(root: RootContractReadout): string {
  if (root.reviewTaskIds.length > 0) {
    return `Keep the root contract truthful: preserve review follow-through ${formatFrontierIds(root.reviewTaskIds)}, keep blocked carrier lineage ${formatFrontierIds(root.blockedLineageIds)}, and do not reopen execution from bookkeeping alone.`;
  }
  return `Keep the root contract truthful: preserve blocked carrier lineage ${formatFrontierIds(root.blockedLineageIds)} and do not reopen execution from bookkeeping alone.`;
}

function buildRootContractParityBundle(input: {
  counts: SyncProjectReadoutResult["counts"];
  root: RootContractReadout;
}): ReadoutParityBundle {
  const { counts, root } = input;
  const frontierSentence = `Current root-contract non-repair frontier is ${buildFrontierVector(
    {
      counts,
      activeTaskIds: root.activeTaskIdsExcludingSelf,
      reviewTaskIds: root.reviewTaskIds,
      waitingTaskIds: root.waitingTaskIds,
      runnableTaskIds: root.runnableTaskIds,
    },
  )}. ${rootContractPublicationSentence(root)} ${rootContractBlockedLineageSentence(root)}`;
  return {
    frontierSentence,
    focusReviewNote: `Readout sync refreshed the current top-level root contract. ${frontierSentence}`,
    focusPlanSummary: `Focus plan root readout now mirrors the same top-level root contract. ${frontierSentence}`,
    proposalReason: frontierSentence,
  };
}

function assertReadoutParityBundle(bundle: ReadoutParityBundle): void {
  for (const [surface, text] of Object.entries({
    focusReviewNote: bundle.focusReviewNote,
    focusPlanSummary: bundle.focusPlanSummary,
    proposalReason: bundle.proposalReason,
  })) {
    if (!text.includes(bundle.frontierSentence)) {
      throw new Error(
        `Readout parity drift for ${surface}: generated text no longer includes the shared frontier sentence`,
      );
    }
  }
}

export function syncProjectReadout(
  config: TaskTreeConfig,
  nowIso = new Date().toISOString(),
): SyncProjectReadoutResult {
  const projectJsonPath = projectRuntimePaths(config.appDir).projectStatePath;
  const project = loadProjectReadModel(config.appDir);
  const tree = readTaskTree(config);
  const parsedNowMs = Date.parse(nowIso);
  const projectSnapshot = buildProjectSnapshotV2({
    projectId: "aks-rp-e2e",
    tree,
    nowMs: Number.isFinite(parsedNowMs) ? parsedNowMs : Date.now(),
  });
  const currentState = objectValue(project.currentState);
  const currentFocus = objectValue(project.currentFocus);
  const currentFocusReview = objectValue(currentFocus.focusReview);
  const focusPlanState = objectValue(project.focusPlan);
  const liveLeaves = {
    active: filterSuppressedReadoutRepairIds(
      tree,
      projectSnapshot.frontier.active,
    ),
    blocked: filterSuppressedReadoutRepairIds(
      tree,
      projectSnapshot.frontier.blocked,
    ),
    review: filterSuppressedReadoutRepairIds(
      tree,
      projectSnapshot.frontier.review,
    ),
  };
  const filteredRunnable = filterSuppressedReadoutRepairIds(
    tree,
    projectSnapshot.frontier.runnable,
  );
  const filteredWaiting = filterSuppressedReadoutRepairIds(
    tree,
    projectSnapshot.frontier.waiting,
  );
  const liveFocusIds = liveFocusTaskIds({
    active: liveLeaves.active,
    blocked: liveLeaves.blocked,
    review: liveLeaves.review,
    runnable: filteredRunnable,
    waiting: filteredWaiting,
  });
  const allLiveIds = allLiveLeafTaskIds({
    active: liveLeaves.active,
    blocked: liveLeaves.blocked,
    review: liveLeaves.review,
    runnable: filteredRunnable,
    waiting: filteredWaiting,
  });
  const rootContract = projectRootContractReadout(tree, {
    activeTaskIds: liveLeaves.active,
    reviewTaskIds: liveLeaves.review,
    waitingTaskIds: filteredWaiting,
    runnableTaskIds: filteredRunnable,
    blockedTaskIds: liveLeaves.blocked,
    blockedLeafCount: liveLeaves.blocked.length,
  });
  const focusPlan = liveFocusPlan(tree);
  const rawCounts = {
    active: liveLeaves.active.length,
    blocked: liveLeaves.blocked.length,
    review: liveLeaves.review.length,
    waiting: filteredWaiting.length,
    runnable: filteredRunnable.length,
  };
  const counts = rootContract
    ? {
        active: rootContract.activeTaskIdsExcludingSelf.length,
        blocked: rootContract.blockedLeafCount,
        review: rootContract.reviewTaskIds.length,
        waiting: rootContract.waitingTaskIds.length,
        runnable: rootContract.runnableTaskIds.length,
      }
    : rawCounts;
  const disposition = rootContract ? null : blockedOnlyDisposition(tree);
  const activeTaskIds = rootContract
    ? rootContract.activeTaskIdsExcludingSelf
    : liveLeaves.active;
  const reviewTaskIds = rootContract
    ? rootContract.reviewTaskIds
    : liveLeaves.review;
  const waitingTaskIds = rootContract
    ? rootContract.waitingTaskIds
    : filteredWaiting;
  const runnableTaskIds = rootContract
    ? rootContract.runnableTaskIds
    : filteredRunnable;
  const visibleFocusIds = rootContract
    ? unique([
        ...activeTaskIds,
        ...reviewTaskIds,
        ...waitingTaskIds,
        ...runnableTaskIds,
      ])
    : liveFocusIds;
  const proposedTaskIds = rootContract
    ? unique([...visibleFocusIds, ...rootContract.blockedLineageIds])
    : allLiveIds;
  const activeTaskId = activeTaskIds[0] ?? null;
  const snapshotMetadata = {
    version: projectSnapshot.version,
    capturedAt: projectSnapshot.capturedAt,
    treeUpdatedAt: projectSnapshot.treeUpdatedAt,
  };

  const existingMetrics = objectValue(currentState.metrics);
  currentState.summary = rootContract
    ? buildRootContractCurrentStateSummary({
        updatedAt: projectSnapshot.treeUpdatedAt ?? nowIso,
        root: rootContract,
        counts,
      })
    : buildCurrentStateSummary({
        updatedAt: projectSnapshot.treeUpdatedAt ?? nowIso,
        counts,
        liveFocusTaskIds: liveFocusIds,
        blockedDisposition: disposition,
      });
  currentState.activeTaskId = activeTaskId;
  currentState.snapshot = snapshotMetadata;
  currentState.metrics = {
    ...existingMetrics,
    blockedLeafCount: counts.blocked,
    runnableLeafCount: counts.runnable,
    activeLeafCount: counts.active,
    reviewLeafCount: counts.review,
    waitingLeafCount: counts.waiting,
  };

  const parityBundle = rootContract
    ? buildRootContractParityBundle({
        counts,
        root: rootContract,
      })
    : buildReadoutParityBundle({
        counts,
        activeTaskIds,
        reviewTaskIds,
        waitingTaskIds,
        runnableTaskIds,
        liveFocusTaskIds: liveFocusIds,
        blockedDisposition: disposition,
      });
  assertReadoutParityBundle(parityBundle);

  currentFocus.summary = rootContract
    ? buildRootContractCurrentFocusSummary(rootContract)
    : buildCurrentFocusSummary({
        counts,
        liveFocusTaskIds: liveFocusIds,
        blockedDisposition: disposition,
      });
  currentFocus.nextAction = rootContract
    ? buildRootContractNextAction(rootContract)
    : buildNextAction({
        counts,
        liveFocusTaskIds: liveFocusIds,
        activeTaskIds,
        blockedDisposition: disposition,
      });
  currentFocus.activeTaskIds = rootContract ? activeTaskIds : liveFocusIds;
  currentFocus.proposedTaskIds = proposedTaskIds;
  currentFocus.snapshot = snapshotMetadata;
  if (rootContract) {
    const currentFocusMission = objectValue(currentFocus.focusMission);
    currentFocusMission.activeTaskIds = activeTaskIds;
    currentFocusMission.reviewTaskIds = reviewTaskIds;
    currentFocusMission.liveReviewFrontierTaskIds = reviewTaskIds;
    currentFocusMission.excludedReviewTaskIds = [];
    delete currentFocusMission.exclusionRule;
    delete currentFocusMission.exclusionReason;
    currentFocusMission.waitingTaskIds = waitingTaskIds;
    currentFocusMission.runnableTaskIds = runnableTaskIds;
    currentFocusMission.linkedBlockedTaskIds = rootContract.blockedLineageIds;
    currentFocus.focusMission = currentFocusMission;
  }
  currentFocusReview.reviewedAt = nowIso;
  currentFocusReview.result = "updated";
  currentFocusReview.note = parityBundle.focusReviewNote;
  currentFocus.focusReview = currentFocusReview;
  focusPlanState.summary = parityBundle.focusPlanSummary;
  if (focusPlan) {
    currentFocus.focusPlanId = focusPlan.id;
    currentFocus.focusPlanStatus = focusPlan.status;
  } else {
    delete currentFocus.focusPlanId;
    delete currentFocus.focusPlanStatus;
  }

  const runtimePatch = {
    currentState,
    currentFocus,
    focusPlan: focusPlanState,
    updatedAt: nowIso,
  };
  const next = `${JSON.stringify(runtimePatch, null, 2)}\n`;
  const previous = (() => {
    try {
      return readFileSync(projectJsonPath, "utf8");
    } catch {
      return "";
    }
  })();
  const changed = previous !== next;
  if (changed) saveProjectRuntimeState(config.appDir, runtimePatch);

  const proposalReason = parityBundle.proposalReason;
  withTreeLock(config, () => {
    const lockedTree = readTaskTree(config);
    const projectTask = lockedTree.tasks.project;
    if (!projectTask) return;
    const projectContext = objectValue(projectTask.context);
    const currentFocusProposal = objectValue(
      projectContext.current_focus_proposal,
    );
    if (Object.keys(currentFocusProposal).length === 0) return;
    const beforeProjectTask = JSON.stringify({
      summary: projectTask.summary ?? null,
      strategy_context: projectTask.strategy_context ?? null,
      progress: projectTask.progress ?? null,
      updated_at: projectTask.updated_at ?? null,
      context: projectContext,
    });
    currentFocusProposal.reason = proposalReason;
    if (rootContract) {
      const proposalContext = objectValue(currentFocusProposal.context);
      proposalContext.active_task_ids = activeTaskIds;
      proposalContext.review_task_ids = reviewTaskIds;
      proposalContext.live_review_frontier_task_ids = reviewTaskIds;
      proposalContext.excluded_review_task_ids = [];
      delete proposalContext.exclusion_rule;
      delete proposalContext.exclusion_reason;
      proposalContext.waiting_task_ids = waitingTaskIds;
      proposalContext.runnable_task_ids = runnableTaskIds;
      proposalContext.blocked_task_ids = rootContract.blockedLineageIds;
      proposalContext.linked_blocked_task_ids = rootContract.blockedLineageIds;
      proposalContext.proposed_task_ids = proposedTaskIds;
      currentFocusProposal.context = proposalContext;

      const currentRootReadout = objectValue(
        projectContext.current_root_readout,
      );
      currentRootReadout.updated_at = nowIso;
      currentRootReadout.snapshot_version = projectSnapshot.version;
      currentRootReadout.snapshot_captured_at = projectSnapshot.capturedAt;
      currentRootReadout.source_tree_updated_at = projectSnapshot.treeUpdatedAt;
      currentRootReadout.contract_scope = rootContract.scope;
      currentRootReadout.excludes_task_id =
        rootContract.scopedRepairTaskIds[0] ?? rootContract.excludesTaskId;
      currentRootReadout.active_task_ids_excluding_self =
        rootContract.activeTaskIdsExcludingSelf;
      currentRootReadout.active_task_ids_including_self =
        rootContract.activeTaskIdsIncludingSelf;
      currentRootReadout.review_task_ids = rootContract.reviewTaskIds;
      currentRootReadout.live_review_frontier_task_ids =
        rootContract.reviewTaskIds;
      currentRootReadout.excluded_review_task_ids = [];
      delete currentRootReadout.exclusion_rule;
      delete currentRootReadout.exclusion_reason;
      currentRootReadout.waiting_task_ids = rootContract.waitingTaskIds;
      currentRootReadout.runnable_task_ids = rootContract.runnableTaskIds;
      currentRootReadout.blocked_leaf_count = rootContract.blockedLeafCount;
      currentRootReadout.top_level_blocked_ids =
        rootContract.topLevelBlockedIds;
      currentRootReadout.top_level_blocked_root_ids =
        rootContract.topLevelBlockedIds;
      currentRootReadout.accepted_publication_leaf_id =
        rootContract.acceptedPublicationLeafId;
      currentRootReadout.accepted_publication_leaf_live =
        rootContract.acceptedPublicationLeafLive;
      currentRootReadout.accepted_publication_leaf_archive_file =
        rootContract.acceptedPublicationLeafArchiveFile;
      currentRootReadout.accepted_publication_leaf_archived_at =
        rootContract.acceptedPublicationLeafArchivedAt;
      projectContext.current_root_readout = currentRootReadout;
    }
    projectContext.current_focus_proposal = currentFocusProposal;
    projectTask.summary = rootContract
      ? buildRootContractCurrentStateSummary({
          updatedAt: projectSnapshot.treeUpdatedAt ?? nowIso,
          root: rootContract,
          counts,
        })
      : buildCurrentStateSummary({
          updatedAt: projectSnapshot.treeUpdatedAt ?? nowIso,
          counts,
          liveFocusTaskIds: liveFocusIds,
          blockedDisposition: disposition,
        });
    projectTask.strategy_context = `Planner readout sync (${nowIso}): ${parityBundle.frontierSentence}`;
    projectTask.progress = {
      updated_at: nowIso,
      active_excluding_self: activeTaskIds.length,
      active_including_self: rootContract
        ? rootContract.activeTaskIdsIncludingSelf.length
        : liveLeaves.active.length,
      review: reviewTaskIds.length,
      waiting: waitingTaskIds.length,
      runnable: runnableTaskIds.length,
      blocked: counts.blocked,
      done: projectSnapshot.frontier.counts.done,
      leaf_total: projectSnapshot.frontier.counts.leafTotal,
      top_level_blocked: rootContract
        ? rootContract.topLevelBlockedIds.length
        : Array.isArray(projectTask.children)
          ? projectTask.children.filter(
              (child): child is string =>
                typeof child === "string" &&
                nodeState(lockedTree.tasks[child]) === "blocked",
            ).length
          : 0,
    };
    projectTask.updated_at = nowIso;
    projectTask.context = projectContext;
    const afterProjectTask = JSON.stringify({
      summary: projectTask.summary ?? null,
      strategy_context: projectTask.strategy_context ?? null,
      progress: projectTask.progress ?? null,
      updated_at: projectTask.updated_at ?? null,
      context: projectContext,
    });
    if (beforeProjectTask === afterProjectTask) return;
    saveTaskTreeWithKanbanSnapshot(config, lockedTree);
  });

  return {
    changed,
    projectJsonPath,
    liveFocusTaskIds: rootContract ? visibleFocusIds : liveFocusIds,
    allLiveLeafTaskIds: rootContract ? proposedTaskIds : allLiveIds,
    activeTaskId,
    counts,
    focusPlanId: focusPlan?.id ?? null,
    snapshot: snapshotMetadata,
  };
}
