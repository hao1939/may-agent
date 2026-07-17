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
  updatedAt: string;
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blockedLeafCount: number;
  scopedRepairTaskIds: string[];
  topLevelBlockedIds: string[];
  blockedLineageIds: string[];
  vector: string;
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
  "ops-apply-retry-project-root-frontier-review-parity-after-auth-expiry-20260716-task-tree-followup";
const evidencePath =
  "evidence/archive/ops-apply-retry-project-root-frontier-review-parity-after-auth-expiry-20260716-task-tree-followup.md";
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-retry-project-root-frontier-review-parity-after-auth-expiry-20260716-task-tree-followup_20260716042155";
const checkedAt = new Date().toISOString();

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim())
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

function isLeaf(task: TaskNode | undefined): boolean {
  return Array.isArray(task?.children) ? task.children.length === 0 : true;
}

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function isReadoutParityRepairGoal(goal: string): boolean {
  if (/focus\/?readout metadata/i.test(goal)) return true;
  const mentionsParitySurface =
    /currentfocus\.focusreview\.note|focusplan\.summary|current_focus_proposal|focus surfaces?/i.test(
      goal,
    );
  if (!mentionsParitySurface) return false;
  if (!/(readout|metadata|project-state|focus surfaces?)/i.test(goal)) return false;
  return /(repair|guard|parity|align|sync|rewrite|reconcile|refresh)/i.test(goal);
}

function isSuppressedReadoutRepairLeaf(task: TaskNode | undefined): boolean {
  if (!task || !isLeaf(task)) return false;
  const state = stateOf(task);
  if (state === "done") return false;
  if (String(task.owner ?? "") !== "app-ops") return false;

  const goal = String(task.goal ?? "");
  if (!isReadoutParityRepairGoal(goal)) return false;

  const context = objectValue(task.context);
  const reviewedTask = context.reviewedTask;
  const hasReviewedTask =
    !!reviewedTask && typeof reviewedTask === "object" && !Array.isArray(reviewedTask);

  return hasReviewedTask || /non-repair frontier/i.test(goal);
}

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
  if (!/(repair|reconcile|sync|refresh|readout|rewrite)/i.test(goal)) return false;
  return /project[ -]root(?: frontier\/progress)? readout|current_root_readout|project-state|root-contract|scope sync/i.test(
    goal,
  );
}

function isRootContractScopedRepairTask(task: TaskNode | undefined): boolean {
  if (!task || !isLeaf(task)) return false;
  if (String(task.owner ?? "") !== "app-ops") return false;
  return isProjectRootReadoutScopeRepairGoal(String(task.goal ?? ""));
}

function liveLeafIdsByState(tree: ReturnType<typeof readTaskTree>) {
  const active: string[] = [];
  const blocked: string[] = [];
  const review: string[] = [];
  for (const task of Object.values(tree.tasks)) {
    if (!isLeaf(task)) continue;
    const state = stateOf(task);
    if (state === "done") continue;
    if (isSuppressedReadoutRepairLeaf(task)) continue;
    if (state === "active") active.push(task.id);
    else if (state === "blocked") blocked.push(task.id);
    else if (state === "review") review.push(task.id);
  }
  return {
    active: unique(active),
    blocked: unique(blocked),
    review: unique(review),
  };
}

function frontierVector(input: {
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blockedLeafCount: number;
}) {
  return `active=[${formatList(input.active)}], review=[${formatList(input.review)}], waiting=[${formatList(input.waiting)}], runnable=[${formatList(input.runnable)}], blocked=${input.blockedLeafCount}`;
}

function computeFrontierSnapshotFromData(
  tree: ReturnType<typeof readTaskTree>,
  summary: ReturnType<typeof summarizeTaskTree>,
): FrontierSnapshot {
  const projectTask = tree.tasks.project;
  if (!projectTask) throw new Error("Task not found: project");

  const liveLeaves = liveLeafIdsByState(tree);
  const projectChildren = Array.isArray(projectTask.children)
    ? projectTask.children.filter(
        (child): child is string => typeof child === "string" && child.trim().length > 0,
      )
    : [];
  const scopedRepairTaskIds = unique(
    projectChildren
      .map((id) => tree.tasks[id])
      .filter(
        (task): task is TaskNode =>
          !!task &&
          String(task.owner ?? "") === "app-ops" &&
          !isTopLevelBlockedWaitTask(task.id) &&
          !isDurableLoopRootTask(task.id) &&
          stateOf(task) !== "done" &&
          isRootContractScopedRepairTask(task),
      )
      .map((task) => task.id),
  );
  const shouldExcludeScopedRepair = (id: string) => scopedRepairTaskIds.includes(id);
  const filteredRunnable = unique(
    (summary.frontier.runnable ?? []).filter((id) => !shouldExcludeScopedRepair(id)),
  );
  const filteredWaiting = unique(
    (summary.frontier.waiting ?? []).filter((id) => !shouldExcludeScopedRepair(id)),
  );
  const active = unique(liveLeaves.active.filter((id) => !shouldExcludeScopedRepair(id)));
  const review = unique(liveLeaves.review.filter((id) => !shouldExcludeScopedRepair(id)));
  const topLevelBlockedIds = unique(
    projectChildren.filter(
      (id) => isTopLevelBlockedWaitTask(id) && stateOf(tree.tasks[id]) === "blocked",
    ),
  );

  const currentFocusProposal = objectValue(objectValue(projectTask.context).current_focus_proposal);
  const proposalContext = objectValue(currentFocusProposal.context);
  const blockedLineageIds = unique([
    ...asStringArray(proposalContext.blocked_task_ids),
    ...asStringArray(proposalContext.linked_blocked_task_ids),
    ...topLevelBlockedIds,
  ].filter((id) => stateOf(tree.tasks[id]) === "blocked"));

  return {
    updatedAt: String(summary.updated_at ?? tree.updated_at ?? checkedAt),
    active,
    review,
    waiting: filteredWaiting,
    runnable: filteredRunnable,
    blockedLeafCount: liveLeaves.blocked.length,
    scopedRepairTaskIds,
    topLevelBlockedIds,
    blockedLineageIds,
    vector: frontierVector({
      active,
      review,
      waiting: filteredWaiting,
      runnable: filteredRunnable,
      blockedLeafCount: liveLeaves.blocked.length,
    }),
  };
}

function computeFrontierSnapshot(): FrontierSnapshot {
  const summary = summarizeTaskTree(config);
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return computeFrontierSnapshotFromData(tree, summary);
  });
}

function writeEvidence(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

function runtimeModel(): JsonRecord {
  return asRecord(loadProjectReadModel(appDir));
}

const beforeTree = withTreeLock(config, () => readTaskTree(config));
const beforeProjectTask = beforeTree.tasks.project;
if (!beforeProjectTask) throw new Error("Task not found: project");
const beforeProjectContext = objectValue(beforeProjectTask.context);
const beforeRootReadout = objectValue(beforeProjectContext.current_root_readout);
const beforeFocusProposal = objectValue(beforeProjectContext.current_focus_proposal);
const beforeProposalContext = objectValue(beforeFocusProposal.context);
const runtimeBefore = runtimeModel();
const beforeRuntimeState = objectValue(runtimeBefore.currentState);
const beforeRuntimeFocus = objectValue(runtimeBefore.currentFocus);
const beforeRuntimePlan = objectValue(runtimeBefore.focusPlan);
const baselineBefore = computeFrontierSnapshot();
const mutationSummary = summarizeTaskTree(config);

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const summary = mutationSummary;
  const projectTask = tree.tasks.project;
  if (!projectTask) throw new Error("Task not found: project");

  const baseline = computeFrontierSnapshotFromData(tree, summary);
  const projectContext = objectValue(projectTask.context);
  const currentRootReadout = objectValue(projectContext.current_root_readout);
  const currentFocusProposal = objectValue(projectContext.current_focus_proposal);
  const proposalContext = objectValue(currentFocusProposal.context);

  currentRootReadout.updated_at = checkedAt;
  currentRootReadout.excludes_task_id = repairTaskId;
  currentRootReadout.active_task_ids_excluding_self = baseline.active;
  currentRootReadout.active_task_ids_including_self = unique([
    ...baseline.active,
    repairTaskId,
  ]);
  currentRootReadout.review_task_ids = baseline.review;
  currentRootReadout.waiting_task_ids = baseline.waiting;
  currentRootReadout.runnable_task_ids = baseline.runnable;
  currentRootReadout.blocked_leaf_count = baseline.blockedLeafCount;
  currentRootReadout.top_level_blocked_ids = baseline.topLevelBlockedIds;
  currentRootReadout.top_level_blocked_root_ids = baseline.topLevelBlockedIds;
  currentRootReadout.stale_root_frontier_replaced = true;
  currentRootReadout.root_frontier_readout_repaired_at = checkedAt;
  currentRootReadout.root_frontier_readout_repaired_by = "app-ops";
  currentRootReadout.root_frontier_readout_repair_attempt_id = attemptId;
  currentRootReadout.root_frontier_readout_repair_evidence_path = evidencePath;

  proposalContext.active_task_ids = baseline.active;
  proposalContext.review_task_ids = baseline.review;
  proposalContext.waiting_task_ids = baseline.waiting;
  proposalContext.runnable_task_ids = baseline.runnable;
  proposalContext.blocked_task_ids = baseline.blockedLineageIds;
  proposalContext.linked_blocked_task_ids = baseline.blockedLineageIds;
  proposalContext.proposed_task_ids = unique([
    ...baseline.active,
    ...baseline.review,
    ...baseline.waiting,
    ...baseline.runnable,
    ...baseline.blockedLineageIds,
  ]);

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.status = "updated";
  currentFocusProposal.evidence_path = evidencePath;
  currentFocusProposal.context = proposalContext;

  projectContext.current_root_readout = currentRootReadout;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.updated_at = checkedAt;

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const syncResult = syncProjectReadout(config, checkedAt);
const runtimePatched = runtimeModel();
const runtimePatchedFocus = objectValue(runtimePatched.currentFocus);
const runtimePatchedFocusReview = objectValue(runtimePatchedFocus.focusReview);
runtimePatchedFocusReview.evidencePath = evidencePath;
runtimePatchedFocus.focusReview = runtimePatchedFocusReview;
const runtimePatchedFocusMission = objectValue(runtimePatchedFocus.focusMission);
if (Object.keys(runtimePatchedFocusMission).length > 0) {
  runtimePatchedFocusMission.evidencePath = evidencePath;
  runtimePatchedFocus.focusMission = runtimePatchedFocusMission;
}
const runtimePatchedPlan = objectValue(runtimePatched.focusPlan);
runtimePatchedPlan.evidencePath = evidencePath;
runtimePatched.currentFocus = runtimePatchedFocus;
runtimePatched.focusPlan = runtimePatchedPlan;
runtimePatched.updatedAt = checkedAt;
saveProjectRuntimeState(appDir, runtimePatched);

const afterTree = withTreeLock(config, () => readTaskTree(config));
const afterProjectTask = afterTree.tasks.project;
if (!afterProjectTask) throw new Error("Task not found after sync: project");
const afterProjectContext = objectValue(afterProjectTask.context);
const afterRootReadout = objectValue(afterProjectContext.current_root_readout);
const afterFocusProposal = objectValue(afterProjectContext.current_focus_proposal);
const afterProposalContext = objectValue(afterFocusProposal.context);
const runtimeAfter = runtimeModel();
const afterRuntimeState = objectValue(runtimeAfter.currentState);
const afterRuntimeFocus = objectValue(runtimeAfter.currentFocus);
const afterRuntimePlan = objectValue(runtimeAfter.focusPlan);
const expectedAfter = computeFrontierSnapshot();

const expectedActiveIncludingSelf = unique([...expectedAfter.active, repairTaskId]);
const expectedVector = expectedAfter.vector;
const verification = {
  currentRootReadoutActiveMatches:
    JSON.stringify(asStringArray(afterRootReadout.active_task_ids_excluding_self)) ===
    JSON.stringify(expectedAfter.active),
  currentRootReadoutActiveIncludingSelfMatches:
    JSON.stringify(asStringArray(afterRootReadout.active_task_ids_including_self)) ===
    JSON.stringify(expectedActiveIncludingSelf),
  currentRootReadoutReviewMatches:
    JSON.stringify(asStringArray(afterRootReadout.review_task_ids)) ===
    JSON.stringify(expectedAfter.review),
  currentRootReadoutWaitingMatches:
    JSON.stringify(asStringArray(afterRootReadout.waiting_task_ids)) ===
    JSON.stringify(expectedAfter.waiting),
  currentRootReadoutRunnableMatches:
    JSON.stringify(asStringArray(afterRootReadout.runnable_task_ids)) ===
    JSON.stringify(expectedAfter.runnable),
  currentRootReadoutBlockedCountMatches:
    Number(afterRootReadout.blocked_leaf_count ?? -1) === expectedAfter.blockedLeafCount,
  proposalActiveMatches:
    JSON.stringify(asStringArray(afterProposalContext.active_task_ids)) ===
    JSON.stringify(expectedAfter.active),
  proposalReviewMatches:
    JSON.stringify(asStringArray(afterProposalContext.review_task_ids)) ===
    JSON.stringify(expectedAfter.review),
  proposalWaitingMatches:
    JSON.stringify(asStringArray(afterProposalContext.waiting_task_ids)) ===
    JSON.stringify(expectedAfter.waiting),
  proposalRunnableMatches:
    JSON.stringify(asStringArray(afterProposalContext.runnable_task_ids)) ===
    JSON.stringify(expectedAfter.runnable),
  projectSummaryMirrorsVector:
    String(afterProjectTask.summary ?? "").includes(expectedVector),
  projectStrategyMirrorsVector:
    String(afterProjectTask.strategy_context ?? "").includes(expectedVector),
  runtimeCurrentStateMirrorsVector:
    String(afterRuntimeState.summary ?? "").includes(expectedVector),
  runtimeCurrentFocusMirrorsFrontier:
    String(afterRuntimeFocus.summary ?? "").includes(
      `active=[${formatList(expectedAfter.active)}], review=[${formatList(expectedAfter.review)}], waiting=[${formatList(expectedAfter.waiting)}], runnable=[${formatList(expectedAfter.runnable)}]`,
    ),
  runtimeFocusReviewEvidencePathMatches:
    String(objectValue(afterRuntimeFocus.focusReview).evidencePath ?? "") === evidencePath,
  runtimeFocusMissionEvidencePathMatches:
    (() => {
      const focusMission = objectValue(afterRuntimeFocus.focusMission);
      return Object.keys(focusMission).length === 0 || String(focusMission.evidencePath ?? "") === evidencePath;
    })(),
  runtimeFocusPlanMirrorsVector:
    String(afterRuntimePlan.summary ?? "").includes(expectedVector),
  runtimeFocusPlanEvidencePathMatches:
    String(afterRuntimePlan.evidencePath ?? "") === evidencePath,
  runtimeMetricsMatch: JSON.stringify({
    active: Number(objectValue(afterRuntimeState.metrics).activeLeafCount ?? -1),
    review: Number(objectValue(afterRuntimeState.metrics).reviewLeafCount ?? -1),
    waiting: Number(objectValue(afterRuntimeState.metrics).waitingLeafCount ?? -1),
    runnable: Number(objectValue(afterRuntimeState.metrics).runnableLeafCount ?? -1),
    blocked: Number(objectValue(afterRuntimeState.metrics).blockedLeafCount ?? -1),
  }) === JSON.stringify({
    active: expectedAfter.active.length,
    review: expectedAfter.review.length,
    waiting: expectedAfter.waiting.length,
    runnable: expectedAfter.runnable.length,
    blocked: expectedAfter.blockedLeafCount,
  }),
};

const verificationFailures = Object.entries(verification)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
if (verificationFailures.length > 0) {
  throw new Error(`Verification failed: ${verificationFailures.join(", ")}`);
}

writeEvidence(`# Apply root-frontier parity follow-up — 2026-07-16\n\n- Task: \`${repairTaskId}\`\n- Attempt: \`${attemptId}\`\n- Checked at: \`${checkedAt}\`\n- Repair script: \`scripts/ops-apply-retry-project-root-frontier-review-parity-after-auth-expiry-20260716-task-tree-followup.ts\`\n\n## Scope\n\nApplied the bounded app-owned repair requested by the accepted retry review: recomputed the project-root frontier from the current live task tree, replaced stale explicit frontier arrays in \`project.context.current_root_readout\` plus \`project.context.current_focus_proposal.context\`, reran \`syncProjectReadout(config, checkedAt)\`, and verified the mirrored runtime/project summaries now represent the same frontier.\n\nNo project/runtime events were emitted. No domain workspace artifacts were changed.\n\n## Supported mutation path used\n\n- \`readTaskTree(config)\` + \`withTreeLock(config, ...)\` + \`saveTaskTreeWithKanbanSnapshot(config, tree)\`\n- \`syncProjectReadout(config, checkedAt)\`\n\n## Baseline before mutation\n\nLive frontier snapshot under current root-contract exclusion rules (exclude only scoped root-readout repair leaves, including this apply leaf):\n\n\`\`\`json\n${JSON.stringify(baselineBefore, null, 2)}\n\`\`\`\n\nStored explicit root readout before mutation:\n\n\`\`\`json\n${JSON.stringify({
  active_task_ids_excluding_self: asStringArray(beforeRootReadout.active_task_ids_excluding_self),
  active_task_ids_including_self: asStringArray(beforeRootReadout.active_task_ids_including_self),
  review_task_ids: asStringArray(beforeRootReadout.review_task_ids),
  waiting_task_ids: asStringArray(beforeRootReadout.waiting_task_ids),
  runnable_task_ids: asStringArray(beforeRootReadout.runnable_task_ids),
  blocked_leaf_count: beforeRootReadout.blocked_leaf_count ?? null,
  excludes_task_id: beforeRootReadout.excludes_task_id ?? null,
}, null, 2)}\n\`\`\`\n\nStored proposal frontier before mutation:\n\n\`\`\`json\n${JSON.stringify({
  active_task_ids: asStringArray(beforeProposalContext.active_task_ids),
  review_task_ids: asStringArray(beforeProposalContext.review_task_ids),
  waiting_task_ids: asStringArray(beforeProposalContext.waiting_task_ids),
  runnable_task_ids: asStringArray(beforeProposalContext.runnable_task_ids),
  blocked_task_ids: asStringArray(beforeProposalContext.blocked_task_ids),
  linked_blocked_task_ids: asStringArray(beforeProposalContext.linked_blocked_task_ids),
}, null, 2)}\n\`\`\`\n\nMirrored runtime/project summaries before mutation:\n\n\`\`\`json\n${JSON.stringify({
  project_summary: beforeProjectTask.summary ?? null,
  project_strategy_context: beforeProjectTask.strategy_context ?? null,
  runtime_current_state_summary: beforeRuntimeState.summary ?? null,
  runtime_current_focus_summary: beforeRuntimeFocus.summary ?? null,
  runtime_focus_plan_summary: beforeRuntimePlan.summary ?? null,
}, null, 2)}\n\`\`\`\n\n## Mutation applied\n\nReplaced the stale explicit arrays with the live frontier verified at apply time:\n\n- active: \`${formatList(baselineBefore.active)}\`\n- review: \`${formatList(baselineBefore.review)}\`\n- waiting: \`${formatList(baselineBefore.waiting)}\`\n- runnable: \`${formatList(baselineBefore.runnable)}\`\n- blocked leaf count: \`${baselineBefore.blockedLeafCount}\`\n- scoped repair ids excluded from the visible root frontier: \`${formatList(baselineBefore.scopedRepairTaskIds)}\`\n\nThen reran \`syncProjectReadout(config, checkedAt)\`, which returned:\n\n\`\`\`json\n${JSON.stringify(syncResult, null, 2)}\n\`\`\`\n\n## Post-sync verification\n\nExpected frontier after sync:\n\n\`\`\`json\n${JSON.stringify(expectedAfter, null, 2)}\n\`\`\`\n\nCurrent root readout after sync:\n\n\`\`\`json\n${JSON.stringify({
  active_task_ids_excluding_self: asStringArray(afterRootReadout.active_task_ids_excluding_self),
  active_task_ids_including_self: asStringArray(afterRootReadout.active_task_ids_including_self),
  review_task_ids: asStringArray(afterRootReadout.review_task_ids),
  waiting_task_ids: asStringArray(afterRootReadout.waiting_task_ids),
  runnable_task_ids: asStringArray(afterRootReadout.runnable_task_ids),
  blocked_leaf_count: afterRootReadout.blocked_leaf_count ?? null,
  excludes_task_id: afterRootReadout.excludes_task_id ?? null,
  top_level_blocked_ids: asStringArray(afterRootReadout.top_level_blocked_ids),
}, null, 2)}\n\`\`\`\n\nCurrent proposal frontier after sync:\n\n\`\`\`json\n${JSON.stringify({
  reason: afterFocusProposal.reason ?? null,
  active_task_ids: asStringArray(afterProposalContext.active_task_ids),
  review_task_ids: asStringArray(afterProposalContext.review_task_ids),
  waiting_task_ids: asStringArray(afterProposalContext.waiting_task_ids),
  runnable_task_ids: asStringArray(afterProposalContext.runnable_task_ids),
  proposed_task_ids: asStringArray(afterProposalContext.proposed_task_ids),
}, null, 2)}\n\`\`\`\n\nMirrored runtime/project summaries after sync:\n\n\`\`\`json\n${JSON.stringify({
  project_summary: afterProjectTask.summary ?? null,
  project_strategy_context: afterProjectTask.strategy_context ?? null,
  runtime_current_state_summary: afterRuntimeState.summary ?? null,
  runtime_current_focus_summary: afterRuntimeFocus.summary ?? null,
  runtime_focus_plan_summary: afterRuntimePlan.summary ?? null,
  runtime_metrics: objectValue(afterRuntimeState.metrics),
}, null, 2)}\n\`\`\`\n\nVerification checks:\n\n\`\`\`json\n${JSON.stringify(verification, null, 2)}\n\`\`\`\n\n## Result\n\nThe root readout now tracks the current live frontier instead of the stale explicit arrays left by the earlier repair wave. The updated represented vector is:\n\n- \`${expectedVector}\`\n\nNext exact verification step for reviewer/planner: after the next live root-frontier leaf state change, rerun the same supported readout parity check against \`.state/tasks/tree.json\`, \`.state/project-state.json\`, and \`project.context.current_root_readout\` to confirm the vector advances again without preserving superseded explicit arrays.\n`);

console.log(
  JSON.stringify(
    {
      evidencePath,
      checkedAt,
      syncResult,
      expectedAfter,
      verification,
    },
    null,
    2,
  ),
);
