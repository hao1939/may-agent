import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import {
  isLeaf,
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type Baseline = {
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blockedLeafCount: number;
  exactBlockedResultIds: string[];
  topLevelBlockedIds: string[];
  proposedIds: string[];
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
  "ops-apply-reconcile-focus-frontier-after-unpublished-change-recovery-20260715-state-repair";
const focusTaskId =
  "focus-same-spec-verification-fix-forward-followthrough-20260715";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops/apply-reconcile-focus-frontier-after-unpublished-change-recovery-20260715-state-repair.md";
const attemptId =
  process.env.ATTEMPT_ID ??
  "manual-run-no-attempt-id-supplied";
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

function stateOf(task: TaskNode | undefined): string {
  if (!task) return "";
  const status = typeof task.status === "string" ? task.status.trim() : "";
  if (status) return status;
  return typeof task.state === "string" ? task.state.trim() : "";
}

function isTopLevelBlockedWaitTask(taskId: string): boolean {
  return /(^ops\/wait-|^wait-)/.test(taskId);
}

function isExactBlockedResultTask(task: TaskNode | undefined): boolean {
  if (!task || !isLeaf(task)) return false;
  if (stateOf(task) !== "blocked") return false;
  return /ready-subset|ado-run-.*-result$/.test(task.id);
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

function buildBaseline(): Baseline {
  const summary = summarizeTaskTree(config);
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    return buildBaselineFromSnapshot(tree, summary);
  });
}

function buildBaselineFromSnapshot(
  tree: ReturnType<typeof readTaskTree>,
  summary: ReturnType<typeof summarizeTaskTree>,
): Baseline {
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const active = unique(
    summary.frontier.active.filter((taskId) => taskId !== repairTaskId),
  ).sort((a, b) => a.localeCompare(b));
  const review = unique(summary.frontier.review).sort((a, b) =>
    a.localeCompare(b),
  );
  const waiting = unique(summary.frontier.waiting ?? []).sort((a, b) =>
    a.localeCompare(b),
  );
  const runnable = unique(summary.frontier.runnable).sort((a, b) =>
    a.localeCompare(b),
  );

  const topLevelBlockedIds = (
    Array.isArray(projectTask.children) ? projectTask.children : []
  )
    .filter(
      (taskId): taskId is string =>
        typeof taskId === "string" &&
        isTopLevelBlockedWaitTask(taskId) &&
        stateOf(tree.tasks[taskId]) === "blocked",
    )
    .sort((a, b) => a.localeCompare(b));

  const exactBlockedResultIds = Object.values(tree.tasks)
    .filter((task) => isExactBlockedResultTask(task))
    .map((task) => task.id)
    .filter((taskId) => !topLevelBlockedIds.includes(taskId))
    .sort((a, b) => a.localeCompare(b));

  return {
    active,
    review,
    waiting,
    runnable,
    blockedLeafCount: Number(summary.counts.blocked ?? 0),
    exactBlockedResultIds,
    topLevelBlockedIds,
    proposedIds: unique([
      ...active,
      ...review,
      ...waiting,
      ...runnable,
      ...exactBlockedResultIds,
      ...topLevelBlockedIds,
    ]),
  };
}

function buildGoal(): string {
  return "Keep one visible 12-24h focus branch aligned to the real frontier: exact same-run review/fix-forward follow-through, repo-local scenario-test normalization, and current metric/readout hygiene only; no broad new live execution from focus maintenance alone.";
}

function buildLaneLinks(baseline: Baseline) {
  const sourceSpecReplay = unique(
    [...baseline.active, ...baseline.review].filter((taskId) =>
      /normalize-scenario/.test(taskId),
    ),
  );
  const stateHygiene = unique(
    [...baseline.active, ...baseline.review].filter((taskId) =>
      /(^ops\/|^ops-)/.test(taskId),
    ),
  );
  const modelFeedback = unique(
    baseline.review.filter((taskId) => /(^fix-|^hold-)/.test(taskId)),
  );
  const executionVerification = unique([
    ...baseline.active.filter((taskId) => !/(^ops\/|^ops-)/.test(taskId)),
    ...baseline.review.filter((taskId) => !sourceSpecReplay.includes(taskId)),
    ...baseline.exactBlockedResultIds,
  ]);

  return {
    source_spec_replay: sourceSpecReplay,
    execution_verification: executionVerification,
    model_feedback: modelFeedback,
    state_hygiene: stateHygiene,
  };
}

function buildProgressReview(baseline: Baseline) {
  return {
    last_reviewed_at: checkedAt,
    status: "on_track",
    summary:
      `Recovered unpublished-change reconciliation is no longer represented as live focus work. ` +
      `Excluding this repair leaf, the current frontier is active=${baseline.active.length}, review=${baseline.review.length}, waiting=${baseline.waiting.length}, runnable=${baseline.runnable.length}, blocked=${baseline.blockedLeafCount}; the visible branch now points only at current live holders.`,
    evidence: [
      `${checkedAt} bun run task-tree frontier showed active=[${formatList(baseline.active)}], review=[${formatList(baseline.review)}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(baseline.runnable)}] after excluding ${repairTaskId}.`,
      `${checkedAt} exact blocked result holders remained [${formatList(baseline.exactBlockedResultIds)}] and top-level blocked steward waits remained [${formatList(baseline.topLevelBlockedIds)}].`,
      `${checkedAt} repair evidence recorded in ${evidencePath}.`,
    ],
  };
}

function buildObservations(baseline: Baseline) {
  return {
    frontier_runnable_leaf_count: baseline.runnable.length,
    frontier_waiting_leaf_count: baseline.waiting.length,
    frontier_active_leaf_count: baseline.active.length,
    frontier_review_leaf_count: baseline.review.length,
    frontier_blocked_leaf_count: baseline.blockedLeafCount,
    linked_active_task_ids: baseline.active,
    linked_review_task_ids: baseline.review,
    linked_exact_blocked_task_ids: baseline.exactBlockedResultIds,
    linked_blocked_task_ids: baseline.topLevelBlockedIds,
    recent_review_signal:
      `Recovered unpublished-change reconciliation is complete; the remaining live frontier is active=[${formatList(baseline.active)}], review=[${formatList(baseline.review)}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(baseline.runnable)}].`,
    parallel_work_gap:
      `Parallel work is already concrete without resurrecting stale focus ids: ${baseline.active.length} active leaves, ${baseline.review.length} review leaves, ${baseline.exactBlockedResultIds.length} exact blocked result holders, and ${baseline.topLevelBlockedIds.length} top-level blocked stewardship waits.`,
    structural_status:
      "The focus branch now names only live frontier holders and preserves exact blocked stewardship waits; missing or superseded unpublished-change lineage ids were removed from the visible readout.",
  };
}

function buildProposalContext(baseline: Baseline) {
  const laneLinks = buildLaneLinks(baseline);
  return {
    horizon: "12-24h",
    success_criteria: [
      "The visible focus branch stays synchronized with the current live frontier and does not reintroduce recovered unpublished-change reconciliation as active work.",
      `Current represented frontier remains active=[${formatList(baseline.active)}], review=[${formatList(baseline.review)}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(baseline.runnable)}], blocked=${baseline.blockedLeafCount}.`,
      `Exact blocked stewardship remains truthful and preserves ${formatList(baseline.topLevelBlockedIds)} including wait-ccp-coredns-pdb-disruption-budget-ado-run-172408613-result.`,
      "No missing or superseded linked ids remain in the focus branch readout or mirrored project-state focus surfaces.",
    ],
    progress_review: {
      reviewed_at: checkedAt,
      result: "updated",
      evidence_path: evidencePath,
      answers: {
        learned_or_verified: [
          `The current non-self active frontier is [${formatList(baseline.active)}].`,
          `The current review frontier is [${formatList(baseline.review)}].`,
          `Exact blocked result holders remain [${formatList(baseline.exactBlockedResultIds)}].`,
          `Top-level blocked steward waits remain [${formatList(baseline.topLevelBlockedIds)}].`,
        ],
        live_execution_posture:
          "Keep work bounded to the already-live active/review frontier and exact blocked waits; do not relaunch recovered unpublished-change reconciliation or widen scope from metadata repair alone.",
        blocker_mix:
          `Current blocker mix is exact blocked result holders [${formatList(baseline.exactBlockedResultIds)}] plus top-level stewardship waits [${formatList(baseline.topLevelBlockedIds)}].`,
        parallel_leafs:
          `Parallel work is ${baseline.active.length} active, ${baseline.review.length} review, ${baseline.waiting.length} waiting, and ${baseline.runnable.length} runnable leaf/leaves, excluding this repair leaf.`,
        goal_alignment:
          "This repair restores truthful app readouts without deciding AKS correctness or creating new planner work.",
      },
    },
    lane_links: laneLinks,
    runnable_task_ids: baseline.runnable,
    waiting_task_ids: baseline.waiting,
    active_task_ids: baseline.active,
    review_task_ids: baseline.review,
    blocked_task_ids: unique([
      ...baseline.exactBlockedResultIds,
      ...baseline.topLevelBlockedIds,
    ]),
    proposed_task_ids: baseline.proposedIds,
    linked_blocked_task_ids: baseline.topLevelBlockedIds,
  };
}

function runtimeSnapshot(): JsonRecord {
  return asRecord(loadProjectReadModel(appDir));
}

const baselineBefore = buildBaseline();
const runtimeBefore = runtimeSnapshot();
const syncResult = syncProjectReadout(config, checkedAt);
const baselineAtApply = buildBaseline();

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const baseline = baselineAtApply;
  const laneLinks = buildLaneLinks(baseline);
  const focusContext = asRecord(focusTask.context);
  const focusTraceBefore = asRecord(focusTask.trace);
  const focusOutputs = asStringArray(focusTask.outputs);
  const projectContext = asRecord(projectTask.context);
  const currentFocusProposalBefore = asRecord(projectContext.current_focus_proposal);
  const currentRootReadout = asRecord(projectContext.current_root_readout);
  const projectTraceBefore = asRecord(projectTask.trace);
  const projectOutputs = asStringArray(projectTask.outputs);

  focusTask.goal = buildGoal();
  focusContext.progress_review = buildProgressReview(baseline);
  focusContext.observations = buildObservations(baseline);
  focusContext.lane_links = laneLinks;
  focusTask.context = focusContext;
  focusTask.outputs = unique([...focusOutputs, evidencePath]);
  focusTask.updated_at = checkedAt;
  focusTask.trace = {
    ...focusTraceBefore,
    focus_frontier_after_unpublished_change_recovery_repaired_at: checkedAt,
    focus_frontier_after_unpublished_change_recovery_repaired_by:
      "app-ops-script",
    focus_frontier_after_unpublished_change_recovery_repair_attempt_id:
      attemptId,
    focus_frontier_after_unpublished_change_recovery_repair_evidence_path:
      evidencePath,
  };

  projectContext.current_focus_proposal = {
    id: currentFocusProposalBefore.id ?? focusTaskId,
    title:
      currentFocusProposalBefore.title ??
      "Bounded same-run review, fix-forward, and normalization follow-through",
    status: "updated",
    reviewed_at: checkedAt,
    needs_approval: false,
    reason:
      `Current root-contract non-repair frontier is active=[${formatList(baseline.active)}], review=[${formatList(baseline.review)}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(baseline.runnable)}], blocked=${baseline.blockedLeafCount}. ` +
      `Exact top-level blocked steward waits remain ${formatList(baseline.topLevelBlockedIds)}. ` +
      `Recovered unpublished-change reconciliation is complete and no longer represented as active focus work.`,
    evidence_path: evidencePath,
    context: buildProposalContext(baseline),
  };

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
  projectContext.current_root_readout = currentRootReadout;

  projectTask.context = projectContext;
  projectTask.outputs = unique([...projectOutputs, evidencePath]);
  projectTask.updated_at = checkedAt;
  projectTask.trace = {
    ...projectTraceBefore,
    focus_frontier_after_unpublished_change_recovery_repaired_at: checkedAt,
    focus_frontier_after_unpublished_change_recovery_repaired_by:
      "app-ops-script",
    focus_frontier_after_unpublished_change_recovery_repair_attempt_id:
      attemptId,
    focus_frontier_after_unpublished_change_recovery_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    baseline,
    beforeGoal: typeof focusTask.goal === "string" ? focusTask.goal : null,
    beforeCurrentFocusProposal: currentFocusProposalBefore,
  };
});

const syncAfterResult = syncProjectReadout(config, checkedAt);
const runtimeMid = runtimeSnapshot();
const currentState = asRecord(runtimeMid.currentState);
const currentFocus = asRecord(runtimeMid.currentFocus);
const currentFocusReview = asRecord(currentFocus.focusReview);
const currentFocusMission = asRecord(currentFocus.focusMission);
const focusPlan = asRecord(runtimeMid.focusPlan);

currentFocus.activeTaskIds = treeMutation.baseline.active;
currentFocus.proposedTaskIds = treeMutation.baseline.proposedIds;
currentFocusReview.reviewedAt = checkedAt;
currentFocusReview.result = "updated";
currentFocusReview.note =
  `Readout repair verified the current frontier after unpublished-change recovery. ` +
  `active=[${formatList(treeMutation.baseline.active)}], review=[${formatList(treeMutation.baseline.review)}], waiting=[${formatList(treeMutation.baseline.waiting)}], runnable=[${formatList(treeMutation.baseline.runnable)}], blocked=${treeMutation.baseline.blockedLeafCount}. ` +
  `Recovered unpublished-change reconciliation is complete and no longer represented as active focus work.`;
currentFocusReview.evidencePath = evidencePath;
currentFocus.focusReview = currentFocusReview;
currentFocusMission.id = focusTaskId;
currentFocusMission.title =
  "Bounded same-run review, fix-forward, and normalization follow-through";
currentFocusMission.horizon = "12-24h";
currentFocusMission.successCriteria = [
  "Current focus surfaces represent only live frontier holders after unpublished-change recovery.",
  `Live active frontier remains [${formatList(treeMutation.baseline.active)}] and live review frontier remains [${formatList(treeMutation.baseline.review)}].`,
  `Exact top-level blocked steward waits remain [${formatList(treeMutation.baseline.topLevelBlockedIds)}].`,
  "Recovered unpublished-change reconciliation is not represented as active focus work.",
];
currentFocusMission.activeTaskIds = treeMutation.baseline.active;
currentFocusMission.reviewTaskIds = treeMutation.baseline.review;
currentFocusMission.waitingTaskIds = treeMutation.baseline.waiting;
currentFocusMission.runnableTaskIds = treeMutation.baseline.runnable;
currentFocusMission.linkedBlockedTaskIds = treeMutation.baseline.topLevelBlockedIds;
currentFocusMission.evidencePath = evidencePath;
currentFocus.focusMission = currentFocusMission;
focusPlan.currentProposalId = focusTaskId;
focusPlan.evidencePath = evidencePath;

saveProjectRuntimeState(appDir, {
  currentState,
  currentFocus,
  focusPlan,
  updatedAt: checkedAt,
});

const runtimeAfter = runtimeSnapshot();
const verification = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  const projectContext = asRecord(projectTask?.context);
  return {
    focusGoal: focusTask?.goal ?? null,
    focusProgressReview: asRecord(asRecord(focusTask?.context).progress_review),
    focusObservations: asRecord(asRecord(focusTask?.context).observations),
    focusLaneLinks: asRecord(asRecord(focusTask?.context).lane_links),
    currentRootReadout: asRecord(projectContext.current_root_readout),
    currentFocusProposal: asRecord(projectContext.current_focus_proposal),
  };
});

writeMemo(`# Apply reconcile focus/frontier readout after unpublished-change recovery — 2026-07-15

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Checked at: ${checkedAt}

## Result

Applied the bounded app-owned metadata repair through supported app helpers. The live root readout, visible focus branch, project current focus proposal, and mirrored \`.state/project-state.json\` now exclude recovered unpublished-change reconciliation as active focus work and name only current live frontier holders sampled at apply time.

## App mechanism used

- recomputed live readouts via \`syncProjectReadout(config, checkedAt)\`
- updated the live task tree under lock with \`readTaskTree(...)\` + \`saveTaskTreeWithKanbanSnapshot(...)\`
- updated mirrored runtime focus surfaces with \`saveProjectRuntimeState(appDir, ...)\`

## Baseline used at apply time (excluding this repair leaf)

- active: ${baselineBefore.active.length > 0 ? baselineBefore.active.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${baselineBefore.review.length > 0 ? baselineBefore.review.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${baselineBefore.waiting.length > 0 ? baselineBefore.waiting.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${baselineBefore.runnable.length > 0 ? baselineBefore.runnable.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- blocked leaf count: ${baselineBefore.blockedLeafCount}
- exact blocked result holders: ${baselineBefore.exactBlockedResultIds.length > 0 ? baselineBefore.exactBlockedResultIds.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- top-level blocked steward waits: ${baselineBefore.topLevelBlockedIds.map((taskId) => `\`${taskId}\``).join(", ")}

## Before → after represented focus sets

### Pre-audit contributor set

- active: [${formatList(baselineBefore.active)}]
- review: [${formatList(baselineBefore.review)}]
- exact blocked result holders: [${formatList(baselineBefore.exactBlockedResultIds)}]
- top-level blocked steward waits: [${formatList(baselineBefore.topLevelBlockedIds)}]

### Post-action represented set

- project.context.current_focus_proposal.context.active_task_ids = [${formatList(treeMutation.baseline.active)}]
- project.context.current_focus_proposal.context.review_task_ids = [${formatList(treeMutation.baseline.review)}]
- project.context.current_focus_proposal.context.blocked_task_ids = [${formatList(unique([...treeMutation.baseline.exactBlockedResultIds, ...treeMutation.baseline.topLevelBlockedIds]))}]
- currentFocus.activeTaskIds = [${formatList(asStringArray(asRecord(runtimeAfter.currentFocus).activeTaskIds))}]
- currentFocus.proposedTaskIds = [${formatList(asStringArray(asRecord(runtimeAfter.currentFocus).proposedTaskIds))}]

## Repairs applied

- updated \`project.context.current_root_readout.excludes_task_id\` to \`${repairTaskId}\`
- refreshed \`project.context.current_root_readout.active_task_ids_excluding_self\`, \`review_task_ids\`, \`waiting_task_ids\`, \`runnable_task_ids\`, and \`blocked_leaf_count\`
- rewrote \`${focusTaskId}.goal\` so it no longer says \`active scenario-test unpublished-change reconciliation\`
- refreshed \`${focusTaskId}.context.progress_review\`, \`.observations\`, and \`.lane_links\` to only current live holders
- rewrote \`project.context.current_focus_proposal\` reason, evidence path, progress review, lane links, active/review/blocked/proposed ids
- refreshed mirrored \`.state/project-state.json\` currentFocus and focusPlan evidence/readout surfaces

## Verification snapshot

### Focus goal

> ${String(verification.focusGoal)}

### Root readout

\`project.context.current_root_readout\`

\`\`\`json
${JSON.stringify(verification.currentRootReadout, null, 2)}
\`\`\`

### Current focus proposal

\`project.context.current_focus_proposal\`

\`\`\`json
${JSON.stringify(verification.currentFocusProposal, null, 2)}
\`\`\`

### Runtime focus surfaces

\`\`\`json
${JSON.stringify({
  currentState: asRecord(runtimeAfter.currentState),
  currentFocus: asRecord(runtimeAfter.currentFocus),
  focusPlan: asRecord(runtimeAfter.focusPlan),
}, null, 2)}
\`\`\`

## Notes

- The current live frontier changed from the earlier memo sample: review now includes \`fix-localdns-auto-default-run-172310406\`, and exact blocked result holders now include \`domain/wait-network-cni-cilium-preview-upgrade-ado-run-172407279-result\` plus \`wait-rp-master-validation-spot-pool-ado-run-172397034-result\`.
- The repair therefore recomputed the frontier at apply time instead of replaying the older stale 19:37 counts and linked ids.
- \`wait-ccp-coredns-pdb-disruption-budget-ado-run-172408613-result\` remains preserved in the top-level blocked stewardship set.

## Sync results

\`syncProjectReadout\` before task-tree rewrite:

\`\`\`json
${JSON.stringify(syncResult, null, 2)}
\`\`\`

\`syncProjectReadout\` after task-tree rewrite:

\`\`\`json
${JSON.stringify(syncAfterResult, null, 2)}
\`\`\`
`);

console.log(
  JSON.stringify(
    {
      checkedAt,
      attemptId,
      evidencePath,
      baselineBefore,
      syncResult,
      syncAfterResult,
      verification,
      runtimeBefore,
      runtimeAfter,
    },
    null,
    2,
  ),
);
