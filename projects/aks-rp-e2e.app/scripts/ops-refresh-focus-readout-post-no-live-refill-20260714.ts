import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadProjectReadModel, saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type Baseline = {
  active: string[];
  review: string[];
  waiting: string[];
  runnable: string[];
  blocked: string[];
  blockedLeafCount: number;
  focusIds: string[];
  representedIds: string[];
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const repairTaskId = "ops/refresh-focus-readout-post-no-live-refill-20260714";
const projectTaskId = "project";
const focusProposalId = "focus-no-live-frontier-lineage-closure-and-holder-truth-20260714";
const evidencePath =
  "evidence/archive/ops-refresh-focus-readout-post-no-live-refill-20260714.md";
const attemptId =
  "a_ops_refresh-focus-readout-post-no-live-refill-20260714_20260714194518";
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

function formatList(taskIds: string[]): string {
  return taskIds.length > 0 ? taskIds.join(", ") : "none";
}

function sample(taskIds: string[], limit = 8): string {
  if (taskIds.length === 0) return "none";
  const picked = taskIds.slice(0, limit);
  return taskIds.length > limit
    ? `${picked.join(", ")} (+${taskIds.length - limit} more)`
    : picked.join(", ");
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
const beforeFocusPlan = asRecord(runtimeBefore.focusPlan);

const treeResult = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const baseline: Baseline = {
    active: unique(
      summaryBefore.frontier.active.filter((taskId) => taskId !== repairTaskId),
    ),
    review: unique(
      summaryBefore.frontier.review.filter((taskId) => taskId !== repairTaskId),
    ),
    waiting: unique(
      (summaryBefore.frontier.waiting ?? []).filter(
        (taskId) => taskId !== repairTaskId,
      ),
    ),
    runnable: unique(
      summaryBefore.frontier.runnable.filter((taskId) => taskId !== repairTaskId),
    ),
    blocked: Object.values(tree.tasks)
      .filter(
        (task) => (!task.children || task.children.length === 0) && task.state === "blocked",
      )
      .map((task) => task.id)
      .sort((left, right) => left.localeCompare(right)),
    blockedLeafCount: summaryBefore.counts.blocked,
    focusIds: [],
    representedIds: [],
  };
  baseline.focusIds = unique([
    ...baseline.active,
    ...baseline.review,
    ...baseline.runnable,
    ...baseline.waiting,
  ]);
  if (baseline.focusIds.length === 0) baseline.focusIds = [...baseline.blocked];
  baseline.representedIds = unique([...baseline.focusIds, ...baseline.blocked]);

  const projectContext = asRecord(projectTask.context);
  const beforeCurrentFocusProposal = asRecord(
    projectContext.current_focus_proposal,
  );
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTraceBefore = asRecord(projectTask.trace);
  const priorProjectOutputs = asStringArray(projectTask.outputs);

  currentFocusProposal.id =
    typeof beforeCurrentFocusProposal.id === "string"
      ? beforeCurrentFocusProposal.id
      : focusProposalId;
  currentFocusProposal.title =
    "No-live VM-prerelease post-refill follow-through";
  currentFocusProposal.status = "updated";
  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.needs_approval = false;
  currentFocusProposal.reason =
    `The approved no-live envelope is unchanged, but the shared-auth repair + ManagedSystem review/apply pair has settled. Excluding ${repairTaskId}, the truthful post-refill frontier is active=[${formatList(baseline.active)}], review=[${formatList(baseline.review)}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(baseline.runnable)}], blocked=${baseline.blockedLeafCount}. Keep focus on the surviving bounded VM-prerelease follow-up set and do not reopen live execution or broader blocker churn from focus bookkeeping alone.`;
  currentFocusProposal.evidence_path = evidencePath;

  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_post_no_live_refill_refreshed_at: checkedAt,
    current_focus_proposal_post_no_live_refill_refreshed_by: "app-ops-script",
    current_focus_proposal_post_no_live_refill_refresh_attempt_id: attemptId,
    current_focus_proposal_post_no_live_refill_refresh_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    baseline,
    beforeCurrentFocusProposal,
    afterCurrentFocusProposal: currentFocusProposal,
  };
});

const runtimeCurrentState = asRecord(runtimeBefore.currentState);
const runtimeCurrentFocus = asRecord(runtimeBefore.currentFocus);
const runtimeFocusReview = asRecord(runtimeCurrentFocus.focusReview);
const runtimeFocusPlan = asRecord(runtimeBefore.focusPlan);

runtimeCurrentState.summary =
  `Focus/readout baseline at ${checkedAt} excludes metadata repair leaf ${repairTaskId} and shows ${treeResult.baseline.runnable.length} runnable leaves, ${treeResult.baseline.waiting.length} waiting leaves, ${treeResult.baseline.active.length} active leaves, ${treeResult.baseline.review.length} review leaves, and ${treeResult.baseline.blockedLeafCount} blocked leaves. The represented post-refill frontier is ${sample(treeResult.baseline.focusIds)}; loop residue is diagnostic-only unless backed by a represented live leaf.`;
runtimeCurrentState.activeTaskId = treeResult.baseline.active[0] ?? null;
runtimeCurrentState.metrics = {
  ...asRecord(runtimeCurrentState.metrics),
  blockedLeafCount: treeResult.baseline.blockedLeafCount,
  runnableLeafCount: treeResult.baseline.runnable.length,
  activeLeafCount: treeResult.baseline.active.length,
  reviewLeafCount: treeResult.baseline.review.length,
  waitingLeafCount: treeResult.baseline.waiting.length,
};

runtimeCurrentFocus.summary =
  `Current live focus remains inside the approved no-live envelope. Excluding metadata repair leaf ${repairTaskId}, the active follow-up is ${sample(treeResult.baseline.active)}, the runnable follow-up set is ${sample(treeResult.baseline.runnable)}, and the settled shared-auth/ManagedSystem pair is no longer represented as live focus work.`;
runtimeCurrentFocus.nextAction =
  `Finish the current active represented leaf first: ${sample(treeResult.baseline.active)}. After that, work the remaining runnable follow-up set ${sample(treeResult.baseline.runnable)} without reopening live execution or restoring the settled shared-auth/ManagedSystem wording.`;
runtimeCurrentFocus.activeTaskIds = treeResult.baseline.active;
runtimeCurrentFocus.proposedTaskIds = treeResult.baseline.representedIds;
delete runtimeCurrentFocus.focusPlanId;
delete runtimeCurrentFocus.focusPlanStatus;
runtimeFocusReview.reviewedAt = checkedAt;
runtimeFocusReview.result = "updated";
runtimeFocusReview.note =
  `The approved no-live scope is unchanged, but the shared-auth repair + ManagedSystem review/apply pair is no longer the represented live frontier. Excluding ${repairTaskId}, current focus is active=[${formatList(treeResult.baseline.active)}], review=[${formatList(treeResult.baseline.review)}], waiting=[${formatList(treeResult.baseline.waiting)}], runnable=[${formatList(treeResult.baseline.runnable)}], blocked=${treeResult.baseline.blockedLeafCount}. Keep attention on the surviving VM-prerelease follow-up set.`;
runtimeCurrentFocus.focusReview = runtimeFocusReview;

runtimeFocusPlan.summary =
  `Approved no-live focus metadata remains in force, but the represented post-refill frontier now excludes metadata repair leaf ${repairTaskId} and consists of active=[${formatList(treeResult.baseline.active)}], review=[${formatList(treeResult.baseline.review)}], waiting=[${formatList(treeResult.baseline.waiting)}], runnable=[${formatList(treeResult.baseline.runnable)}], blocked=${treeResult.baseline.blockedLeafCount}. The shared-auth repair + ManagedSystem review/apply pair is settled history; keep the mission on the bounded VM-prerelease follow-up set.`;
runtimeFocusPlan.currentProposalId = focusProposalId;

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
const afterFocusPlan = asRecord(runtimeAfter.focusPlan);
const afterTree = readTaskTree(config);
const afterProjectContext = asRecord(afterTree.tasks[projectTaskId]?.context);
const afterCurrentFocusProposal = asRecord(
  afterProjectContext.current_focus_proposal,
);

const result = {
  checkedAt,
  attemptId,
  repairTaskId,
  focusProposalId,
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
    runtimeFocusPlanSummary:
      typeof beforeFocusPlan.summary === "string"
        ? beforeFocusPlan.summary
        : null,
    runtimeActiveTaskIds: asStringArray(beforeCurrentFocus.activeTaskIds),
  },
  after: {
    currentFocusProposal: afterCurrentFocusProposal,
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
    runtimeFocusPlanSummary:
      typeof afterFocusPlan.summary === "string"
        ? afterFocusPlan.summary
        : null,
    runtimeActiveTaskIds: asStringArray(afterCurrentFocus.activeTaskIds),
    runtimeFocusPlanId:
      typeof afterCurrentFocus.focusPlanId === "string"
        ? afterCurrentFocus.focusPlanId
        : null,
    runtimeFocusPlanStatus:
      typeof afterCurrentFocus.focusPlanStatus === "string"
        ? afterCurrentFocus.focusPlanStatus
        : null,
  },
};

writeMemo(`# Focus readout refresh after no-live refill — 2026-07-14

Task: \`${repairTaskId}\`
Attempt: \`${attemptId}\`

## Result

Refreshed the app-owned focus metadata after the no-live shared-auth/ManagedSystem pair settled. Using the baseline that excludes this audit repair leaf, the represented frontier is now one active row-label clarification task and no live review leaves.

## Baseline used

Per worker-mode audit rules, the baseline excludes \`${repairTaskId}\`.

- active: ${treeResult.baseline.active.length > 0 ? treeResult.baseline.active.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${treeResult.baseline.review.length > 0 ? treeResult.baseline.review.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${treeResult.baseline.waiting.length > 0 ? treeResult.baseline.waiting.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${treeResult.baseline.runnable.length > 0 ? treeResult.baseline.runnable.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- blocked leaf count: ${treeResult.baseline.blockedLeafCount}

Exact task ids now represented by focus/readout:

- focus task ids: ${treeResult.baseline.focusIds.length > 0 ? treeResult.baseline.focusIds.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- represented non-done ids sample: ${treeResult.baseline.representedIds.slice(0, 12).map((taskId) => `\`${taskId}\``).join(", ")}${treeResult.baseline.representedIds.length > 12 ? ` (+${treeResult.baseline.representedIds.length - 12} more)` : ""}

## Before → after: project current_focus_proposal

### Before

\`current_focus_proposal.title\`
> ${String(result.before.currentFocusProposal.title ?? "n/a")}

\`current_focus_proposal.reason\`
> ${String(result.before.currentFocusProposal.reason ?? "n/a")}

### After

\`current_focus_proposal.title\`
> ${String(result.after.currentFocusProposal.title ?? "n/a")}

\`current_focus_proposal.reason\`
> ${String(result.after.currentFocusProposal.reason ?? "n/a")}

## Before → after: runtime readout

### Before

- \`currentState.summary\`
  > ${String(result.before.runtimeCurrentStateSummary ?? "n/a")}
- \`currentFocus.summary\`
  > ${String(result.before.runtimeCurrentFocusSummary ?? "n/a")}
- \`currentFocus.nextAction\`
  > ${String(result.before.runtimeNextAction ?? "n/a")}
- \`currentFocus.activeTaskIds\`
  > ${result.before.runtimeActiveTaskIds.map((taskId) => `\`${taskId}\``).join(", ") || "none"}
- \`currentFocus.focusReview.note\`
  > ${String(result.before.runtimeFocusReviewNote ?? "n/a")}
- \`focusPlan.summary\`
  > ${String(result.before.runtimeFocusPlanSummary ?? "n/a")}

### After

- \`currentState.summary\`
  > ${String(result.after.runtimeCurrentStateSummary ?? "n/a")}
- \`currentFocus.summary\`
  > ${String(result.after.runtimeCurrentFocusSummary ?? "n/a")}
- \`currentFocus.nextAction\`
  > ${String(result.after.runtimeNextAction ?? "n/a")}
- \`currentFocus.activeTaskIds\`
  > ${result.after.runtimeActiveTaskIds.map((taskId) => `\`${taskId}\``).join(", ") || "none"}
- \`currentFocus.focusPlanId\`
  > ${result.after.runtimeFocusPlanId ? `\`${result.after.runtimeFocusPlanId}\`` : "none"}
- \`currentFocus.focusPlanStatus\`
  > ${result.after.runtimeFocusPlanStatus ? `\`${result.after.runtimeFocusPlanStatus}\`` : "none"}
- \`currentFocus.focusReview.note\`
  > ${String(result.after.runtimeFocusReviewNote ?? "n/a")}
- \`focusPlan.summary\`
  > ${String(result.after.runtimeFocusPlanSummary ?? "n/a")}

## Scope preserved

The refresh keeps the approved no-live envelope. It only rewrites focus/readout metadata so the represented frontier points at \`domain/clarify-vmpr-row-ledger-vs-mounted-order-20260714\` and no longer describes the settled shared-auth/ManagedSystem pair as active live work.

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
