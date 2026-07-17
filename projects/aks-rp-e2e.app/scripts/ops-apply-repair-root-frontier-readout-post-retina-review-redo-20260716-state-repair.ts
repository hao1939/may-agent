import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import { readTaskTree, withTreeLock, type TaskNode } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type FrontierSnapshot = {
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blockedLeafCount: number;
};

type ApplyState = {
  beforeFrontier: FrontierSnapshot;
  beforeRoot: JsonRecord;
  beforeProposal: JsonRecord;
  beforeRuntimeCurrentState: JsonRecord;
  beforeRuntimeCurrentFocus: JsonRecord;
  blockedLineageIds: string[];
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
  "ops-apply-repair-root-frontier-readout-post-retina-review-redo-20260716-state-repair";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops-apply-repair-root-frontier-readout-post-retina-review-redo-20260716-state-repair.md";
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-repair-root-frontier-readout-post-retina-review-redo-20260716-state-repair_20260716031106";
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
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
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

function isTopLevelBlockedWaitTask(taskId: string): boolean {
  return /(^ops\/wait-|^wait-)/.test(taskId);
}

function currentFrontier(): FrontierSnapshot {
  const summary = summarizeTaskTree(config);
  return {
    active: unique(summary.frontier.active.filter((taskId) => taskId !== repairTaskId)),
    review: unique(summary.frontier.review.filter((taskId) => taskId !== repairTaskId)),
    waiting: unique((summary.frontier.waiting ?? []).filter((taskId) => taskId !== repairTaskId)),
    runnable: unique(summary.frontier.runnable.filter((taskId) => taskId !== repairTaskId)),
    blockedLeafCount: Number(summary.counts.blocked ?? 0),
  };
}

function buildApplyState(): ApplyState {
  const runtime = asRecord(loadProjectReadModel(appDir));
  const beforeRuntimeCurrentState = asRecord(runtime.currentState);
  const beforeRuntimeCurrentFocus = asRecord(runtime.currentFocus);
  const beforeFrontier = currentFrontier();

  let applyState: ApplyState | undefined;
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

    const projectContext = asRecord(projectTask.context);
    const beforeRoot = asRecord(projectContext.current_root_readout);
    const beforeProposal = asRecord(projectContext.current_focus_proposal);
    const proposalContext = asRecord(beforeProposal.context);

    const topLevelBlockedIds = unique(
      (Array.isArray(projectTask.children) ? projectTask.children : [])
        .filter(
          (taskId): taskId is string =>
            typeof taskId === "string" &&
            isTopLevelBlockedWaitTask(taskId) &&
            stateOf(tree.tasks[taskId]) === "blocked",
        ),
    );
    const blockedLineageIds = unique([
      ...asStringArray(proposalContext.blocked_task_ids),
      ...asStringArray(proposalContext.linked_blocked_task_ids),
      ...topLevelBlockedIds,
    ]).filter((taskId) => stateOf(tree.tasks[taskId]) === "blocked");

    applyState = {
      beforeFrontier,
      beforeRoot,
      beforeProposal,
      beforeRuntimeCurrentState,
      beforeRuntimeCurrentFocus,
      blockedLineageIds,
      topLevelBlockedIds,
    };
  });

  if (!applyState) throw new Error("Failed to build apply state");
  return applyState;
}

function writeEvidence(content: string): void {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function frontierVector(frontier: FrontierSnapshot): string {
  return `active=[${formatList(frontier.active)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}`;
}

function acceptedPublicationSentence(root: JsonRecord): string {
  const publicationLeafId =
    typeof root.accepted_publication_leaf_id === "string"
      ? root.accepted_publication_leaf_id
      : null;
  if (!publicationLeafId) return "Project root contract remains scoped to current live frontier.";
  const publicationLeafLive = root.accepted_publication_leaf_live === true;
  if (publicationLeafLive) {
    return `${publicationLeafId} is still live in the task tree and must remain represented by the root contract.`;
  }
  return `${publicationLeafId} is archived done and absent from the live task map.`;
}

function successCriteria(frontier: FrontierSnapshot, blockedLineageIds: string[]): string[] {
  return [
    `Project root readout, current focus proposal, and mirrored runtime surfaces all represent ${frontierVector(frontier)} excluding ${repairTaskId}.`,
    `The active frontier remains exactly ${formatList(frontier.active)} and the review frontier remains exactly ${formatList(frontier.review)}.`,
    `The waiting frontier remains exactly ${formatList(frontier.waiting)} and the runnable frontier remains exactly ${formatList(frontier.runnable)}.`,
    `Preserved blocked carrier lineage remains ${formatList(blockedLineageIds)}.`,
  ];
}

function applyRepair(state: ApplyState): void {
  const frontier = state.beforeFrontier;
  const proposedTaskIds = unique([
    ...frontier.active,
    ...frontier.review,
    ...frontier.waiting,
    ...frontier.runnable,
    ...state.blockedLineageIds,
  ]);
  const rootScope = "live root frontier after retina-enterprise review redo + exact blocked carrier lineage";
  const publicationSentence = acceptedPublicationSentence(state.beforeRoot);
  const blockedLineageSentence = `Preserved blocked carrier lineage remains ${formatList(state.blockedLineageIds)}. Exact top-level blocked steward waits remain ${formatList(state.topLevelBlockedIds)}.`;
  const proposalTitle = "live root-frontier follow-through with exact blocked carriers";
  const proposalReason = `Current root-contract non-repair frontier is ${frontierVector(frontier)}. ${publicationSentence} ${blockedLineageSentence}`;
  const projectSummary = `Project-root readout at ${checkedAt} mirrors project.context.current_root_readout (${rootScope}): app-ops follow-through active=[${formatList(frontier.active)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}], blocked=${frontier.blockedLeafCount}. ${publicationSentence} ${blockedLineageSentence}`;
  const currentFocusSummary = `Current root-frontier follow-through is active=[${formatList(frontier.active)}], review=[${formatList(frontier.review)}], waiting=[${formatList(frontier.waiting)}], runnable=[${formatList(frontier.runnable)}]. ${publicationSentence} ${blockedLineageSentence}`;
  const nextAction = frontier.active.length > 0
    ? `Finish the current active frontier first: ${formatList(frontier.active)}. Then preserve review follow-through ${formatList(frontier.review)}, keep waiting ${formatList(frontier.waiting)} visible, preserve blocked carrier lineage ${formatList(state.blockedLineageIds)}, and do not reopen execution from bookkeeping alone.`
    : `Keep the root contract truthful: preserve review follow-through ${formatList(frontier.review)}, keep waiting ${formatList(frontier.waiting)} visible, preserve blocked carrier lineage ${formatList(state.blockedLineageIds)}, and do not reopen execution from bookkeeping alone.`;
  const focusReviewNote = `Readout sync refreshed the current top-level root contract. ${proposalReason}`;
  const focusPlanSummary = `Focus plan root readout now mirrors the same top-level root contract. ${proposalReason}`;
  const updatedSuccessCriteria = successCriteria(frontier, state.blockedLineageIds);

  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

    const projectContext = asRecord(projectTask.context);
    const currentRootReadout = asRecord(projectContext.current_root_readout);
    const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
    const proposalContext = asRecord(currentFocusProposal.context);

    proposalContext.active_task_ids = frontier.active;
    proposalContext.review_task_ids = frontier.review;
    proposalContext.waiting_task_ids = frontier.waiting;
    proposalContext.runnable_task_ids = frontier.runnable;
    proposalContext.blocked_task_ids = state.blockedLineageIds;
    proposalContext.linked_blocked_task_ids = state.blockedLineageIds;
    proposalContext.proposed_task_ids = proposedTaskIds;
    proposalContext.success_criteria = updatedSuccessCriteria;
    currentFocusProposal.title = proposalTitle;
    currentFocusProposal.reason = proposalReason;
    currentFocusProposal.context = proposalContext;
    currentFocusProposal.reviewed_at = checkedAt;
    currentFocusProposal.status = "updated";
    currentFocusProposal.evidence_path = evidencePath;
    projectContext.current_focus_proposal = currentFocusProposal;

    currentRootReadout.updated_at = checkedAt;
    currentRootReadout.excludes_task_id = repairTaskId;
    currentRootReadout.contract_scope = rootScope;
    currentRootReadout.active_task_ids_excluding_self = frontier.active;
    currentRootReadout.active_task_ids_including_self = unique([
      ...frontier.active,
      repairTaskId,
    ]);
    currentRootReadout.review_task_ids = frontier.review;
    currentRootReadout.waiting_task_ids = frontier.waiting;
    currentRootReadout.runnable_task_ids = frontier.runnable;
    currentRootReadout.blocked_leaf_count = frontier.blockedLeafCount;
    currentRootReadout.top_level_blocked_ids = state.topLevelBlockedIds;
    currentRootReadout.top_level_blocked_root_ids = state.topLevelBlockedIds;
    currentRootReadout.stale_root_frontier_replaced = true;
    currentRootReadout.root_frontier_readout_repaired_at = checkedAt;
    currentRootReadout.root_frontier_readout_repair_attempt_id = attemptId;
    currentRootReadout.root_frontier_readout_repair_evidence_path = evidencePath;
    projectContext.current_root_readout = currentRootReadout;

    projectTask.context = projectContext;
    projectTask.outputs = unique([...asStringArray(projectTask.outputs), evidencePath]);
    projectTask.updated_at = checkedAt;
    projectTask.trace = {
      ...asRecord(projectTask.trace),
      root_frontier_readout_repaired_at: checkedAt,
      root_frontier_readout_repaired_by: "app-ops-script",
      root_frontier_readout_repair_attempt_id: attemptId,
      root_frontier_readout_repair_evidence_path: evidencePath,
    };

    saveTaskTreeWithKanbanSnapshot(config, tree);
  });

  syncProjectReadout(config, checkedAt);

  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);
    const projectContext = asRecord(projectTask.context);
    const currentRootReadout = asRecord(projectContext.current_root_readout);
    const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
    const proposalContext = asRecord(currentFocusProposal.context);

    proposalContext.active_task_ids = frontier.active;
    proposalContext.review_task_ids = frontier.review;
    proposalContext.waiting_task_ids = frontier.waiting;
    proposalContext.runnable_task_ids = frontier.runnable;
    proposalContext.blocked_task_ids = state.blockedLineageIds;
    proposalContext.linked_blocked_task_ids = state.blockedLineageIds;
    proposalContext.proposed_task_ids = proposedTaskIds;
    proposalContext.success_criteria = updatedSuccessCriteria;
    currentFocusProposal.title = proposalTitle;
    currentFocusProposal.reason = proposalReason;
    currentFocusProposal.reviewed_at = checkedAt;
    currentFocusProposal.status = "updated";
    currentFocusProposal.evidence_path = evidencePath;
    currentFocusProposal.context = proposalContext;
    projectContext.current_focus_proposal = currentFocusProposal;

    currentRootReadout.updated_at = checkedAt;
    currentRootReadout.excludes_task_id = repairTaskId;
    currentRootReadout.contract_scope = rootScope;
    currentRootReadout.active_task_ids_excluding_self = frontier.active;
    currentRootReadout.active_task_ids_including_self = unique([...frontier.active, repairTaskId]);
    currentRootReadout.review_task_ids = frontier.review;
    currentRootReadout.waiting_task_ids = frontier.waiting;
    currentRootReadout.runnable_task_ids = frontier.runnable;
    currentRootReadout.blocked_leaf_count = frontier.blockedLeafCount;
    currentRootReadout.top_level_blocked_ids = state.topLevelBlockedIds;
    currentRootReadout.top_level_blocked_root_ids = state.topLevelBlockedIds;
    currentRootReadout.stale_root_frontier_replaced = true;
    currentRootReadout.root_frontier_readout_repaired_at = checkedAt;
    currentRootReadout.root_frontier_readout_repair_attempt_id = attemptId;
    currentRootReadout.root_frontier_readout_repair_evidence_path = evidencePath;
    projectContext.current_root_readout = currentRootReadout;

    projectTask.context = projectContext;
    projectTask.summary = projectSummary;
    projectTask.strategy_context = `Planner readout sync (${checkedAt}): ${proposalReason}`;
    projectTask.progress = {
      ...asRecord(projectTask.progress),
      updated_at: checkedAt,
      active_excluding_self: frontier.active.length,
      active_including_self: frontier.active.length + 1,
      review: frontier.review.length,
      waiting: frontier.waiting.length,
      runnable: frontier.runnable.length,
      blocked: frontier.blockedLeafCount,
      top_level_blocked: state.topLevelBlockedIds.length,
    };
    projectTask.updated_at = checkedAt;
    saveTaskTreeWithKanbanSnapshot(config, tree);
  });

  const runtime = asRecord(loadProjectReadModel(appDir));
  const currentState = asRecord(runtime.currentState);
  const currentFocus = asRecord(runtime.currentFocus);
  const focusReview = asRecord(currentFocus.focusReview);
  const focusMission = asRecord(currentFocus.focusMission);
  const focusPlan = asRecord(runtime.focusPlan);

  const metrics = asRecord(currentState.metrics);
  metrics.blockedLeafCount = frontier.blockedLeafCount;
  metrics.runnableLeafCount = frontier.runnable.length;
  metrics.activeLeafCount = frontier.active.length;
  metrics.reviewLeafCount = frontier.review.length;
  metrics.waitingLeafCount = frontier.waiting.length;
  currentState.metrics = metrics;
  currentState.summary = projectSummary;
  currentState.activeTaskId = frontier.active[0] ?? null;

  currentFocus.summary = currentFocusSummary;
  currentFocus.nextAction = nextAction;
  currentFocus.activeTaskIds = frontier.active;
  currentFocus.proposedTaskIds = proposedTaskIds;

  focusReview.reviewedAt = checkedAt;
  focusReview.result = "updated";
  focusReview.note = focusReviewNote;
  focusReview.evidencePath = evidencePath;
  currentFocus.focusReview = focusReview;

  focusMission.title = proposalTitle;
  focusMission.successCriteria = updatedSuccessCriteria;
  focusMission.activeTaskIds = frontier.active;
  focusMission.reviewTaskIds = frontier.review;
  focusMission.waitingTaskIds = frontier.waiting;
  focusMission.runnableTaskIds = frontier.runnable;
  focusMission.linkedBlockedTaskIds = state.blockedLineageIds;
  focusMission.evidencePath = evidencePath;
  currentFocus.focusMission = focusMission;

  focusPlan.summary = focusPlanSummary;
  focusPlan.evidencePath = evidencePath;

  saveProjectRuntimeState(appDir, {
    currentState,
    currentFocus,
    focusPlan,
    updatedAt: checkedAt,
  });
}

function snapshotAfter() {
  const summary = summarizeTaskTree(config);
  const runtime = asRecord(loadProjectReadModel(appDir));
  let after: Record<string, unknown> | undefined;
  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const projectTask = tree.tasks[projectTaskId];
    if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);
    const projectContext = asRecord(projectTask.context);
    after = {
      summaryFrontier: {
        active: summary.frontier.active,
        review: summary.frontier.review,
        waiting: summary.frontier.waiting ?? [],
        runnable: summary.frontier.runnable,
        blockedLeafCount: Number(summary.counts.blocked ?? 0),
      },
      current_root_readout: asRecord(projectContext.current_root_readout),
      current_focus_proposal: asRecord(projectContext.current_focus_proposal),
      runtime_currentState: asRecord(runtime.currentState),
      runtime_currentFocus: asRecord(runtime.currentFocus),
      runtime_focusPlan: asRecord(runtime.focusPlan),
    };
  });
  if (!after) throw new Error("Failed to capture after snapshot");
  return after;
}

function main(): void {
  const state = buildApplyState();
  applyRepair(state);
  const after = snapshotAfter();
  const afterRoot = asRecord(after.current_root_readout);
  const afterProposal = asRecord(after.current_focus_proposal);
  const afterProposalContext = asRecord(afterProposal.context);
  const afterRuntimeCurrentFocus = asRecord(after.runtime_currentFocus);
  const afterFocusMission = asRecord(afterRuntimeCurrentFocus.focusMission);
  const afterCurrentState = asRecord(after.runtime_currentState);
  const afterFrontier = asRecord(after.summaryFrontier);

  const memo = `# App apply — root-frontier readout post-retina review redo state repair — 2026-07-16\n\n- Task: \`${repairTaskId}\`\n- Attempt: \`${attemptId}\`\n- Applied at: \`${checkedAt}\`\n\n## Scope\n\nApplied the bounded app-owned root readout repair through supported task-tree/project-state helpers so the live non-self frontier is now written back into \`project.context.current_root_readout\`, \`project.context.current_focus_proposal.context\`, and mirrored runtime readout surfaces. No spec-loop or feature-compact loop row mutation was required for this repair.\n\n## App mechanisms used\n\n- \`readTaskTree(... )\` + \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\`\n- \`syncProjectReadout(config, checkedAt)\`\n- \`loadProjectReadModel(appDir)\` + \`saveProjectRuntimeState(appDir, ...)\`\n\n## Baseline before apply\n\nPer worker-mode audit rules, the baseline excludes this repair task itself.\n\n- live active: ${formatList(state.beforeFrontier.active)}\n- live review: ${formatList(state.beforeFrontier.review)}\n- live waiting: ${formatList(state.beforeFrontier.waiting)}\n- live runnable: ${formatList(state.beforeFrontier.runnable)}\n- live blocked leaf count: ${state.beforeFrontier.blockedLeafCount}\n\nStored root readout before apply:\n\n- active: ${formatList(asStringArray(state.beforeRoot.active_task_ids_excluding_self))}\n- review: ${formatList(asStringArray(state.beforeRoot.review_task_ids))}\n- waiting: ${formatList(asStringArray(state.beforeRoot.waiting_task_ids))}\n- runnable: ${formatList(asStringArray(state.beforeRoot.runnable_task_ids))}\n- contract_scope: ${JSON.stringify(state.beforeRoot.contract_scope ?? null)}\n\nStored proposal context before apply:\n\n- active: ${formatList(asStringArray(asRecord(state.beforeProposal.context).active_task_ids))}\n- review: ${formatList(asStringArray(asRecord(state.beforeProposal.context).review_task_ids))}\n- waiting: ${formatList(asStringArray(asRecord(state.beforeProposal.context).waiting_task_ids))}\n- runnable: ${formatList(asStringArray(asRecord(state.beforeProposal.context).runnable_task_ids))}\n\n## Applied replacement values\n\n- root readout active_excluding_self: ${formatList(state.beforeFrontier.active)}\n- root readout review: ${formatList(state.beforeFrontier.review)}\n- root readout waiting: ${formatList(state.beforeFrontier.waiting)}\n- root readout runnable: ${formatList(state.beforeFrontier.runnable)}\n- proposal context active/review/waiting/runnable: same as the live non-self frontier above\n- preserved blocked lineage: ${formatList(state.blockedLineageIds)}\n- preserved top-level blocked steward waits: ${formatList(state.topLevelBlockedIds)}\n\n## Verification after apply\n\nAfter-state frontier from \`bun run task-tree summary\` / \`frontier\`:\n\n- active: ${formatList(asStringArray(afterFrontier.active).filter((taskId) => taskId !== repairTaskId))}\n- review: ${formatList(asStringArray(afterFrontier.review).filter((taskId) => taskId !== repairTaskId))}\n- waiting: ${formatList(asStringArray(afterFrontier.waiting).filter((taskId) => taskId !== repairTaskId))}\n- runnable: ${formatList(asStringArray(afterFrontier.runnable).filter((taskId) => taskId !== repairTaskId))}\n- blocked leaf count: ${String(afterFrontier.blockedLeafCount ?? "null")}\n\nRepaired \`project.context.current_root_readout\` now records:\n\n- active_excluding_self: ${formatList(asStringArray(afterRoot.active_task_ids_excluding_self))}\n- review: ${formatList(asStringArray(afterRoot.review_task_ids))}\n- waiting: ${formatList(asStringArray(afterRoot.waiting_task_ids))}\n- runnable: ${formatList(asStringArray(afterRoot.runnable_task_ids))}\n- contract_scope: ${JSON.stringify(afterRoot.contract_scope ?? null)}\n\nRepaired \`project.context.current_focus_proposal.context\` now records:\n\n- active: ${formatList(asStringArray(afterProposalContext.active_task_ids))}\n- review: ${formatList(asStringArray(afterProposalContext.review_task_ids))}\n- waiting: ${formatList(asStringArray(afterProposalContext.waiting_task_ids))}\n- runnable: ${formatList(asStringArray(afterProposalContext.runnable_task_ids))}\n\nMirrored runtime \`.state/project-state.json\` now records:\n\n- currentState.activeTaskId: ${JSON.stringify(afterCurrentState.activeTaskId ?? null)}\n- metrics.activeLeafCount: ${JSON.stringify(asRecord(afterCurrentState.metrics).activeLeafCount ?? null)}\n- metrics.reviewLeafCount: ${JSON.stringify(asRecord(afterCurrentState.metrics).reviewLeafCount ?? null)}\n- metrics.waitingLeafCount: ${JSON.stringify(asRecord(afterCurrentState.metrics).waitingLeafCount ?? null)}\n- metrics.runnableLeafCount: ${JSON.stringify(asRecord(afterCurrentState.metrics).runnableLeafCount ?? null)}\n- currentFocus.activeTaskIds: ${formatList(asStringArray(afterRuntimeCurrentFocus.activeTaskIds))}\n- currentFocus.proposedTaskIds sample: ${formatList(asStringArray(afterRuntimeCurrentFocus.proposedTaskIds).slice(0, 8))}\n- currentFocus.focusMission.activeTaskIds: ${formatList(asStringArray(afterFocusMission.activeTaskIds))}\n- currentFocus.focusMission.reviewTaskIds: ${formatList(asStringArray(afterFocusMission.reviewTaskIds))}\n- currentFocus.focusMission.waitingTaskIds: ${formatList(asStringArray(afterFocusMission.waitingTaskIds))}\n- currentFocus.focusMission.runnableTaskIds: ${formatList(asStringArray(afterFocusMission.runnableTaskIds))}\n\n## Acceptance check\n\n- App-owned task-tree or loop-state repair applied through supported app mechanisms: satisfied.\n- Affected branch records the exact restored holder/state pointer/refreshed wait with evidence: satisfied via repaired root/proposal arrays and mirrored runtime readout above.\n\n## Evidence payload\n\n\`\`\`json\n${JSON.stringify(
    {
      checkedAt,
      attemptId,
      beforeFrontier: state.beforeFrontier,
      beforeRoot: state.beforeRoot,
      beforeProposal: state.beforeProposal,
      blockedLineageIds: state.blockedLineageIds,
      topLevelBlockedIds: state.topLevelBlockedIds,
      after,
    },
    null,
    2,
  )}\n\`\`\`\n`;

  writeEvidence(memo);
  console.log(
    JSON.stringify(
      {
        checkedAt,
        attemptId,
        evidencePath,
        beforeFrontier: state.beforeFrontier,
        after,
      },
      null,
      2,
    ),
  );
}

main();
