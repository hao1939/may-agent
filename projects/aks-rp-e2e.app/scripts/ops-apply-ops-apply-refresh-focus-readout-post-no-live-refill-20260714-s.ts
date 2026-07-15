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

const currentTaskId =
  "ops-apply-ops-apply-refresh-focus-readout-post-no-live-refill-20260714-s";
const reviewedTaskId =
  "ops-apply-refresh-focus-readout-post-no-live-refill-20260714-state-repai";
const projectTaskId = "project";
const focusProposalId =
  "focus-no-live-frontier-lineage-closure-and-holder-truth-20260714";
const evidencePath =
  "evidence/archive/ops-apply-ops-apply-refresh-focus-readout-post-no-live-refill-20260714-s.md";
const attemptId =
  "a_ops-apply-ops-apply-refresh-focus-readout-post-no-live-refill-20260714-s_20260714195858";
const checkedAt = new Date().toISOString();
const excludedTaskIds = [currentTaskId, reviewedTaskId];

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

function excluded(taskId: string): boolean {
  return excludedTaskIds.includes(taskId);
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
    active: unique(summaryBefore.frontier.active.filter((taskId) => !excluded(taskId))),
    review: unique(summaryBefore.frontier.review.filter((taskId) => !excluded(taskId))),
    waiting: unique(
      (summaryBefore.frontier.waiting ?? []).filter((taskId) => !excluded(taskId)),
    ),
    runnable: unique(
      summaryBefore.frontier.runnable.filter((taskId) => !excluded(taskId)),
    ),
    blocked: Object.values(tree.tasks)
      .filter(
        (task) =>
          (!task.children || task.children.length === 0) &&
          task.state === "blocked" &&
          !excluded(task.id),
      )
      .map((task) => task.id)
      .sort((left, right) => left.localeCompare(right)),
    blockedLeafCount: Object.values(tree.tasks).filter(
      (task) =>
        (!task.children || task.children.length === 0) &&
        task.state === "blocked" &&
        !excluded(task.id),
    ).length,
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
  const beforeCurrentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTraceBefore = asRecord(projectTask.trace);
  const priorProjectOutputs = asStringArray(projectTask.outputs);

  currentFocusProposal.id =
    typeof beforeCurrentFocusProposal.id === "string"
      ? beforeCurrentFocusProposal.id
      : focusProposalId;
  currentFocusProposal.title = "No-live VM-prerelease post-refill follow-through";
  currentFocusProposal.status = "updated";
  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.needs_approval = false;
  const proposalBlockedOnly =
    baseline.active.length === 0 &&
    baseline.review.length === 0 &&
    baseline.waiting.length === 0 &&
    baseline.runnable.length === 0 &&
    baseline.blockedLeafCount > 0;
  currentFocusProposal.reason = proposalBlockedOnly
    ? `The approved no-live envelope is unchanged, and after excluding bounded metadata repair leaves ${currentTaskId} and ${reviewedTaskId} the truthful frontier is active=[none], review=[none], waiting=[none], runnable=[none], blocked=${baseline.blockedLeafCount}. Keep the represented scope on the exact blocked waits only until a named resume condition lands.`
    : `The approved no-live envelope is unchanged, and after excluding bounded metadata repair leaves ${currentTaskId} and ${reviewedTaskId} the truthful frontier is active=[${formatList(baseline.active)}], review=[${formatList(baseline.review)}], waiting=[${formatList(baseline.waiting)}], runnable=[${formatList(baseline.runnable)}], blocked=${baseline.blockedLeafCount}. Keep the represented scope on the current non-done frontier (${sample(baseline.focusIds)}) plus the blocked remainder; do not reopen live execution from loop residue alone.`;
  currentFocusProposal.evidence_path = evidencePath;

  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_post_no_live_refill_followup_state_repaired_at: checkedAt,
    current_focus_proposal_post_no_live_refill_followup_state_repaired_by:
      "app-ops-script",
    current_focus_proposal_post_no_live_refill_followup_state_repair_attempt_id:
      attemptId,
    current_focus_proposal_post_no_live_refill_followup_state_repair_evidence_path:
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
const blockedOnly =
  treeResult.baseline.active.length === 0 &&
  treeResult.baseline.review.length === 0 &&
  treeResult.baseline.waiting.length === 0 &&
  treeResult.baseline.runnable.length === 0 &&
  treeResult.baseline.blockedLeafCount > 0;

runtimeCurrentState.summary = blockedOnly
  ? `Focus/readout baseline at ${checkedAt} excludes metadata repair leaves ${currentTaskId} and ${reviewedTaskId} and shows 0 runnable leaves, 0 waiting leaves, 0 active leaves, 0 review leaves, and ${treeResult.baseline.blockedLeafCount} blocked leaves. Live frontier is blocked-only exact wait stewardship from non-done task-tree leaves; loop residue is diagnostic-only unless backed by a represented live leaf.`
  : `Focus/readout baseline at ${checkedAt} excludes metadata repair leaves ${currentTaskId} and ${reviewedTaskId} and shows ${treeResult.baseline.runnable.length} runnable leaves, ${treeResult.baseline.waiting.length} waiting leaves, ${treeResult.baseline.active.length} active leaves, ${treeResult.baseline.review.length} review leaves, and ${treeResult.baseline.blockedLeafCount} blocked leaves. The represented frontier is ${sample(treeResult.baseline.focusIds)}; loop residue is diagnostic-only unless backed by a represented live leaf.`;
runtimeCurrentState.activeTaskId = treeResult.baseline.active[0] ?? null;
runtimeCurrentState.metrics = {
  ...asRecord(runtimeCurrentState.metrics),
  blockedLeafCount: treeResult.baseline.blockedLeafCount,
  runnableLeafCount: treeResult.baseline.runnable.length,
  activeLeafCount: treeResult.baseline.active.length,
  reviewLeafCount: treeResult.baseline.review.length,
  waitingLeafCount: treeResult.baseline.waiting.length,
};

runtimeCurrentFocus.summary = blockedOnly
  ? `Current live focus is blocked-only wait stewardship from the task tree: ${sample(treeResult.baseline.focusIds)}. Do not reopen compact/spec execution from loop residue alone.`
  : `Current live focus remains inside the approved no-live envelope. Excluding metadata repair leaves ${currentTaskId} and ${reviewedTaskId}, the active follow-up set is ${sample(treeResult.baseline.active)}, the review follow-up set is ${sample(treeResult.baseline.review)}, and the runnable follow-up set is ${sample(treeResult.baseline.runnable)}.`;
runtimeCurrentFocus.nextAction = blockedOnly
  ? `Preserve the exact blocked waits (${sample(treeResult.baseline.focusIds)}) and reopen work only when one named resume condition lands; do not dispatch from loop residue alone.`
  : treeResult.baseline.active.length > 0
    ? `Finish the current active represented leaf/leaves first: ${sample(treeResult.baseline.active)}. Then work the remaining represented review/runnable set ${sample(unique([...treeResult.baseline.review, ...treeResult.baseline.runnable]))}.`
    : `Work the current represented non-done frontier in order: ${sample(unique([...treeResult.baseline.review, ...treeResult.baseline.runnable, ...treeResult.baseline.waiting]))}.`;
runtimeCurrentFocus.activeTaskIds = treeResult.baseline.focusIds;
runtimeCurrentFocus.proposedTaskIds = treeResult.baseline.representedIds;
delete runtimeCurrentFocus.focusPlanId;
delete runtimeCurrentFocus.focusPlanStatus;
runtimeFocusReview.reviewedAt = checkedAt;
runtimeFocusReview.result = "updated";
runtimeFocusReview.note = blockedOnly
  ? `The approved no-live scope is unchanged, and excluding metadata repair leaves ${currentTaskId} and ${reviewedTaskId} the truthful frontier is blocked-only exact wait stewardship: active=[none], review=[none], waiting=[none], runnable=[none], blocked=${treeResult.baseline.blockedLeafCount}. Keep the represented scope on the existing blocked waits only.`
  : `The approved no-live scope is unchanged, and excluding metadata repair leaves ${currentTaskId} and ${reviewedTaskId} the truthful frontier is active=[${formatList(treeResult.baseline.active)}], review=[${formatList(treeResult.baseline.review)}], waiting=[${formatList(treeResult.baseline.waiting)}], runnable=[${formatList(treeResult.baseline.runnable)}], blocked=${treeResult.baseline.blockedLeafCount}.`;
runtimeCurrentFocus.focusReview = runtimeFocusReview;

runtimeFocusPlan.summary = blockedOnly
  ? `Approved no-live focus metadata remains in force, and the represented post-review frontier excluding metadata repair leaves ${currentTaskId} and ${reviewedTaskId} is now blocked-only exact wait stewardship: active=[none], review=[none], waiting=[none], runnable=[none], blocked=${treeResult.baseline.blockedLeafCount}. Keep the mission on the existing blocked waits until a named resume condition changes.`
  : `Approved no-live focus metadata remains in force, and the represented post-review frontier excluding metadata repair leaves ${currentTaskId} and ${reviewedTaskId} consists of active=[${formatList(treeResult.baseline.active)}], review=[${formatList(treeResult.baseline.review)}], waiting=[${formatList(treeResult.baseline.waiting)}], runnable=[${formatList(treeResult.baseline.runnable)}], blocked=${treeResult.baseline.blockedLeafCount}.`;
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
const afterCurrentFocusProposal = asRecord(afterProjectContext.current_focus_proposal);

const result = {
  checkedAt,
  attemptId,
  currentTaskId,
  reviewedTaskId,
  focusProposalId,
  baselineExcludingRepairLeaves: treeResult.baseline,
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
    runtimeProposedTaskIdsSample: asStringArray(afterCurrentFocus.proposedTaskIds).slice(
      0,
      12,
    ),
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

writeMemo(`# Focus/readout follow-up state repair after no-live refill review — 2026-07-14

Task: \`${currentTaskId}\`
Attempt: \`${attemptId}\`

## Result

Refreshed the app-owned focus/readout metadata using the worker-mode baseline that excludes this bounded repair leaf itself and the already-completed reviewed repair leaf. The supported runtime state now represents the truthful current frontier again, including any non-repair active leaf that appeared after the prior review.

## Baseline used

Per worker-mode audit rules, the baseline excludes \`${currentTaskId}\` and \`${reviewedTaskId}\`.

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

\`current_focus_proposal.reason\`
> ${String(result.before.currentFocusProposal.reason ?? "n/a")}

### After

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
- \`currentFocus.proposedTaskIds\` sample
  > ${result.after.runtimeProposedTaskIdsSample.map((taskId) => `\`${taskId}\``).join(", ") || "none"}
- \`currentFocus.focusPlanId\`
  > ${result.after.runtimeFocusPlanId ? `\`${result.after.runtimeFocusPlanId}\`` : "none"}
- \`currentFocus.focusPlanStatus\`
  > ${result.after.runtimeFocusPlanStatus ? `\`${result.after.runtimeFocusPlanStatus}\`` : "none"}
- \`currentFocus.focusReview.note\`
  > ${String(result.after.runtimeFocusReviewNote ?? "n/a")}
- \`focusPlan.summary\`
  > ${String(result.after.runtimeFocusPlanSummary ?? "n/a")}

## Scope preserved

The refresh keeps the approved no-live envelope. It only rewrites focus/readout metadata so the represented frontier excludes both bounded repair leaves, contains no done ids, and stays grounded in the live non-done frontier plus blocked waits.

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
