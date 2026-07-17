import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { saveProjectRuntimeState } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const projectTaskId = "project";
const excludedReviewTaskId = "ops/repair-project-root-frontier-review-parity-20260716";
const contaminationCarrierTaskId =
  "fix-rp-regional-quota-public-create-path-run-172346097";
const lineageScrubEvidencePath =
  "evidence/archive/ops-apply-repair-root-frontier-rp-regional-quota-lineage-split-20260716-task-tree-followup.md";
const lineageScrubAt = "2026-07-16T04:45:00.320Z";
const nowIso = new Date().toISOString();

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asMutableRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

const summary = summarizeTaskTree(config);
const liveActive = unique(asStringArray(summary.frontier.active));
const liveReview = unique(asStringArray(summary.frontier.review));
const liveWaiting = unique(asStringArray(summary.frontier.waiting));
const liveRunnable = unique(asStringArray(summary.frontier.runnable));
const blockedLeafCount = Number(summary.counts.blocked ?? 0);

const representedReview = liveReview.filter((taskId) => taskId !== excludedReviewTaskId);
const excludedReview = liveReview.includes(excludedReviewTaskId) ? [excludedReviewTaskId] : [];

const contaminationReason =
  `${excludedReviewTaskId} previously carried misrouted terminal-wait review lineage for ADO run 172346097. The bounded scrub recorded at ${lineageScrubAt} in ${lineageScrubEvidencePath} removed ado-run:172346097 conflict scope plus terminal wait metadata from that root-readout repair leaf, so ${contaminationCarrierTaskId} is now the only live carrier for run 172346097 verdict/review lineage.`;
const exclusionRule = excludedReview.length
  ? `Mirrored non-repair root/focus readout arrays intentionally exclude scoped root-readout parity repair leaf ${excludedReviewTaskId} while it remains live in review for the same surface; use live_review_frontier_task_ids for the full review frontier and review_task_ids for the non-repair mirrored subset.`
  : null;
const historicalReviewNote = excludedReview.length
  ? ""
  : `${excludedReviewTaskId} is not in the current live review frontier, so no review-frontier omission is active. Historical 172346097 lineage scrub remains recorded in ${lineageScrubEvidencePath}.`;

const reasonPrefix =
  `Current root-contract frontier is active=[${formatList(liveActive)}], review=[${formatList(liveReview)}], waiting=[${formatList(liveWaiting)}], runnable=[${formatList(liveRunnable)}], blocked=${blockedLeafCount}.`;
const liveReviewNote = excludedReview.length
  ? ` Mirrored root/focus review_task_ids intentionally omit [${formatList(excludedReview)}] under project.context.current_root_readout.excludes_task_id. ${contaminationReason}`
  : ` ${historicalReviewNote}`;

const runtimePath = resolve(appDir, ".state/project-state.json");
const runtimeState = JSON.parse(readFileSync(runtimePath, "utf8")) as JsonRecord;

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId];
  if (!projectTask) {
    throw new Error(`Task not found: ${projectTaskId}`);
  }

  const projectContext = asMutableRecord(projectTask.context);
  const currentFocusProposal = asMutableRecord(projectContext.current_focus_proposal);
  const focusContext = asMutableRecord(currentFocusProposal.context);
  const currentRootReadout = asMutableRecord(projectContext.current_root_readout);

  const blockedLineage = unique([
    ...asStringArray(focusContext.blocked_task_ids),
    ...asStringArray(focusContext.linked_blocked_task_ids),
  ]);
  const topLevelBlocked = unique(asStringArray(currentRootReadout.top_level_blocked_ids));
  const preservedTail = [
    ` Preserved blocked carrier lineage remains ${formatList(blockedLineage)}.`,
    ` Exact top-level blocked steward waits remain ${formatList(topLevelBlocked)}.`,
  ].join("");

  currentFocusProposal.reason = `${reasonPrefix}${liveReviewNote}${preservedTail}`;

  const successCriteria = asStringArray(focusContext.success_criteria);
  if (successCriteria.length > 0) {
    successCriteria[0] = excludedReview.length
      ? `Live 12-24h mission currently has active=[${formatList(liveActive)}], review frontier=[${formatList(liveReview)}], waiting=[${formatList(liveWaiting)}], runnable=[${formatList(liveRunnable)}]. Mirrored root/focus arrays intentionally represent non-repair review=[${formatList(representedReview)}] and exclude scoped root-readout repair leaf ${excludedReviewTaskId}; see project.context.current_root_readout.exclusion_rule and exclusion_reason for the scrubbed 172346097 review-lineage explanation.`
      : `Live 12-24h mission currently has active=[${formatList(liveActive)}], review=[${formatList(liveReview)}], waiting=[${formatList(liveWaiting)}], runnable=[${formatList(liveRunnable)}].`;
  }

  focusContext.success_criteria = successCriteria;
  focusContext.live_review_frontier_task_ids = liveReview;
  focusContext.excluded_review_task_ids = excludedReview;
  if (exclusionRule) {
    focusContext.exclusion_rule = exclusionRule;
    focusContext.exclusion_reason = contaminationReason;
  } else {
    delete focusContext.exclusion_rule;
    delete focusContext.exclusion_reason;
  }
  currentFocusProposal.context = focusContext;

  currentRootReadout.live_review_frontier_task_ids = liveReview;
  currentRootReadout.excluded_review_task_ids = excludedReview;
  if (exclusionRule) {
    currentRootReadout.exclusion_rule = exclusionRule;
    currentRootReadout.exclusion_reason = contaminationReason;
  } else {
    delete currentRootReadout.exclusion_rule;
    delete currentRootReadout.exclusion_reason;
  }
  currentRootReadout.updated_at = nowIso;
  currentRootReadout.visibility_repaired_at = nowIso;
  currentRootReadout.visibility_repaired_by = process.env.WORKER ?? "app-ops";
  currentRootReadout.visibility_repair_script =
    "scripts/ops-apply-repair-focus-review-visibility-parity-20260716.ts";

  projectContext.current_focus_proposal = currentFocusProposal;
  projectContext.current_root_readout = currentRootReadout;
  projectTask.context = projectContext;
  projectTask.updated_at = nowIso;
  tree.updated_at = nowIso;

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const runtimeCurrentFocus = asMutableRecord(runtimeState.currentFocus);
const runtimeFocusMission = asMutableRecord(runtimeCurrentFocus.focusMission);
const runtimeSuccessCriteria = asStringArray(runtimeFocusMission.successCriteria);
if (runtimeSuccessCriteria.length > 0) {
  runtimeSuccessCriteria[0] = excludedReview.length
    ? `Live 12-24h mission currently has active=[${formatList(liveActive)}], review frontier=[${formatList(liveReview)}], waiting=[${formatList(liveWaiting)}], runnable=[${formatList(liveRunnable)}]. Mirrored root/focus arrays intentionally represent non-repair review=[${formatList(representedReview)}] and exclude scoped root-readout repair leaf ${excludedReviewTaskId}; see project.context.current_root_readout.exclusion_rule and exclusion_reason for the scrubbed 172346097 review-lineage explanation.`
    : `Live 12-24h mission currently has active=[${formatList(liveActive)}], review=[${formatList(liveReview)}], waiting=[${formatList(liveWaiting)}], runnable=[${formatList(liveRunnable)}].`;
}
runtimeFocusMission.successCriteria = runtimeSuccessCriteria;
runtimeFocusMission.liveReviewFrontierTaskIds = liveReview;
runtimeFocusMission.excludedReviewTaskIds = excludedReview;
if (exclusionRule) {
  runtimeFocusMission.exclusionRule = exclusionRule;
  runtimeFocusMission.exclusionReason = contaminationReason;
} else {
  delete runtimeFocusMission.exclusionRule;
  delete runtimeFocusMission.exclusionReason;
}
runtimeCurrentFocus.focusMission = runtimeFocusMission;
if (typeof runtimeCurrentFocus.summary === "string") {
  runtimeCurrentFocus.summary = `${reasonPrefix}${liveReviewNote}`;
}
const runtimeFocusReview = asMutableRecord(runtimeCurrentFocus.focusReview);
runtimeFocusReview.note = excludedReview.length
  ? `Live review frontier is [${formatList(liveReview)}], while mirrored non-repair review arrays intentionally exclude [${formatList(excludedReview)}]. ${contaminationReason}`
  : `Live review frontier is [${formatList(liveReview)}]. ${historicalReviewNote}`;
runtimeCurrentFocus.focusReview = runtimeFocusReview;
runtimeState.currentFocus = runtimeCurrentFocus;

const runtimeFocusPlan = asMutableRecord(runtimeState.focusPlan);
if (typeof runtimeFocusPlan.summary === "string") {
  runtimeFocusPlan.summary = excludedReview.length
    ? `Live review frontier is [${formatList(liveReview)}]; mirrored non-repair review arrays intentionally exclude [${formatList(excludedReview)}] under project.context.current_root_readout.excludes_task_id.`
    : `Live review frontier is [${formatList(liveReview)}]. No current review-frontier exclusions apply.`;
}
runtimeState.focusPlan = runtimeFocusPlan;
runtimeState.updatedAt = nowIso;

saveProjectRuntimeState(appDir, runtimeState);

console.log(
  JSON.stringify(
    {
      appliedAt: nowIso,
      liveActive,
      liveReview,
      representedReview,
      excludedReview,
      exclusionRule,
      contaminationReason,
    },
    null,
    2,
  ),
);
