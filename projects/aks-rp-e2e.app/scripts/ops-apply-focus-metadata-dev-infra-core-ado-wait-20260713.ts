import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  isLeaf,
  readTaskTree,
  withTreeLock,
} from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const focusTaskId =
  "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711";
const projectTaskId = "project";
const reviewedRepairTaskId =
  "ops/repair-focus-post-reconciliation-frontier-metadata-20260713";
const adoWaitTaskId =
  "ops/wait-dev-infra-core-ado171990664-queue-result-20260713b";
const staleReviewTaskId =
  "ops/review-dev-infra-core-ado171990664-blocker-shape-20260713";
const staleDiagnosisTaskId =
  "ops/diagnose-dev-infra-core-ado171990664-environment-overblock-20260713";
const sourcePacketPath =
  "evidence/archive/ops-repair-focus-post-reconciliation-frontier-metadata-20260713.md";
const evidencePath =
  "evidence/archive/ops-apply-focus-metadata-dev-infra-core-ado-wait-20260713.md";
const attemptId = "a_ops-apply-focus-metadata-dev-infra-core-ado-wait-20260713";
const checkedAt = new Date().toISOString();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function leafState(task: Record<string, unknown>): string {
  const status = task.status;
  if (typeof status === "string" && status.trim()) return status.trim();
  const state = task.state;
  return typeof state === "string" && state.trim() ? state.trim() : "";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const frontierBefore = summarizeTaskTree(config).frontier;

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  const reviewedRepairTask = tree.tasks[reviewedRepairTaskId];
  const adoWaitTask = tree.tasks[adoWaitTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);
  if (!reviewedRepairTask) {
    throw new Error(`Task not found: ${reviewedRepairTaskId}`);
  }
  if (!adoWaitTask) throw new Error(`Task not found: ${adoWaitTaskId}`);

  const activeExcludingRepair = frontierBefore.active.filter(
    (taskId) => taskId !== reviewedRepairTaskId,
  );
  const reviewExcludingRepair = frontierBefore.review.filter(
    (taskId) => taskId !== reviewedRepairTaskId,
  );
  const waitingExcludingRepair = frontierBefore.waiting.filter(
    (taskId) => taskId !== reviewedRepairTaskId,
  );
  const runnableExcludingRepair = frontierBefore.runnable.filter(
    (taskId) => taskId !== reviewedRepairTaskId,
  );
  const blockedLeafCount = Object.values(tree.tasks).filter((task) => {
    if (!isLeaf(task)) return false;
    return leafState(task as unknown as Record<string, unknown>) === "blocked";
  }).length;

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const observations = asRecord(focusContext.observations);
  const progressEvidence = asStringArray(progressReview.evidence);
  const focusTrace = asRecord(focusTask.trace);
  const focusOutputs = asStringArray(focusTask.outputs);

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTrace = asRecord(projectTask.trace);
  const projectOutputs = asStringArray(projectTask.outputs);

  const before = {
    focusSummary: progressReview.summary ?? null,
    focusEvidence0: progressEvidence[0] ?? null,
    whatChanged: observations.what_changed_since_last_review ?? null,
    parallelWorkFilled: observations.parallel_work_filled ?? null,
    linkedActiveTaskIds: asStringArray(observations.linked_active_task_ids),
    linkedReviewTaskIds: asStringArray(observations.linked_review_task_ids),
    projectFocusReason: currentFocusProposal.reason ?? null,
  };

  const focusSummary = `The post-reconciliation no-live focus remains approval-blocked, and the live validation work is now represented by one exact blocked ADO wait (${adoWaitTaskId}) for run 171990664. Excluding this metadata repair task, the current frontier has ${activeExcludingRepair.length} active, ${reviewExcludingRepair.length} review, ${waitingExcludingRepair.length} waiting, ${runnableExcludingRepair.length} runnable, and ${blockedLeafCount} blocked leaf tasks, so the app should wait on the explicit ADO run result instead of claiming hidden active review/diagnosis work.`;
  const evidence0 = `${checkedAt} task-tree frontier reported active=[${frontierBefore.active.join(", ")}], review=[${frontierBefore.review.join(", ")}], waiting=[${frontierBefore.waiting.join(", ")}], runnable=[${frontierBefore.runnable.join(", ")}]. Excluding ${reviewedRepairTaskId}, the only dev-infra-core live-validation holder is ${adoWaitTaskId}, whose blocker points to ADO pipeline 467665 run 171990664 at commit 2c9d7c78a366856b80f6f1cc8165f5757c25bfc8 with last observed status notStarted.`;

  progressReview.last_reviewed_at = checkedAt;
  progressReview.status = "blocked";
  progressReview.summary = focusSummary;
  progressReview.evidence = [evidence0, ...progressEvidence.slice(1)];
  focusContext.progress_review = progressReview;

  observations.what_changed_since_last_review = `The stale blocker-shape review ${staleReviewTaskId} and the follow-up diagnosis ${staleDiagnosisTaskId} have both been retired from the live tree. Their useful result is preserved as the exact ADO wait ${adoWaitTaskId}; the focus branch should point at that wait until run 171990664 starts/completes or escalates.`;
  observations.parallel_work_filled =
    "No. There is no runnable or active project work from this focus-maintenance lane; the concrete next external signal is the ADO run 171990664 result/artifacts.";
  observations.frontier_active_leaf_count = activeExcludingRepair.length;
  observations.frontier_review_leaf_count = reviewExcludingRepair.length;
  observations.frontier_waiting_leaf_count = waitingExcludingRepair.length;
  observations.frontier_runnable_leaf_count = runnableExcludingRepair.length;
  observations.frontier_blocked_leaf_count = blockedLeafCount;
  observations.linked_active_task_ids = activeExcludingRepair;
  observations.linked_review_task_ids = reviewExcludingRepair;
  observations.linked_blocked_task_ids = unique([
    ...asStringArray(observations.linked_blocked_task_ids),
    adoWaitTaskId,
  ]);
  focusContext.observations = observations;
  focusContext.rollup_summary = `2026-07-13 focus metadata repair: stale active review/diagnosis references were replaced with the exact blocked ADO wait ${adoWaitTaskId}; the focus branch remains no-live and approval-blocked while dev-infra-core validation waits for run 171990664.`;
  focusTask.context = focusContext;
  focusTask.outputs = unique([...focusOutputs, evidencePath]);
  focusTask.trace = {
    ...focusTrace,
    dev_infra_core_ado_wait_focus_metadata_repaired_at: checkedAt,
    dev_infra_core_ado_wait_focus_metadata_repaired_by: "app-ops-script",
    dev_infra_core_ado_wait_focus_metadata_repair_attempt_id: attemptId,
    dev_infra_core_ado_wait_focus_metadata_repair_evidence_path: evidencePath,
  };

  currentFocusProposal.reason = `Regular focus review remains no-live and approval-blocked. The stale active review/diagnosis references have been replaced by the exact ADO wait ${adoWaitTaskId}; dev-infra-core live validation is not proven yet because ADO run 171990664 is still the required result/artifact signal.`;
  currentFocusProposal.reviewed_at = checkedAt;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...projectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTrace,
    current_focus_proposal_dev_infra_core_ado_wait_repaired_at: checkedAt,
    current_focus_proposal_dev_infra_core_ado_wait_repaired_by:
      "app-ops-script",
    current_focus_proposal_dev_infra_core_ado_wait_repair_attempt_id: attemptId,
    current_focus_proposal_dev_infra_core_ado_wait_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    checkedAt,
    focusTaskId,
    projectTaskId,
    reviewedRepairTaskId,
    adoWaitTaskId,
    sourcePacketPath,
    evidencePath,
    before,
    after: {
      focusSummary: progressReview.summary,
      focusEvidence0: asStringArray(progressReview.evidence)[0] ?? null,
      whatChanged: observations.what_changed_since_last_review ?? null,
      parallelWorkFilled: observations.parallel_work_filled ?? null,
      linkedActiveTaskIds: asStringArray(observations.linked_active_task_ids),
      linkedReviewTaskIds: asStringArray(observations.linked_review_task_ids),
      linkedBlockedTaskIds: asStringArray(observations.linked_blocked_task_ids),
      projectFocusReason: currentFocusProposal.reason ?? null,
    },
  };
});

writeMemo(`# Focus metadata repair for dev-infra-core ADO wait — 2026-07-13

## Why this repair exists

The earlier repair packet was right that focus/project metadata had drifted, but its proposed replacement became stale before apply. The live diagnosis task is now retired, and the current truthful live-validation holder is:

- \`${adoWaitTaskId}\`

That wait points at ADO pipeline \`467665\`, run \`171990664\`, branch \`dev\`, commit \`2c9d7c78a366856b80f6f1cc8165f5757c25bfc8\`, feature set \`dev-infra-core\`, target \`staging\`.

## Applied change

- Replaced stale references to \`${staleReviewTaskId}\` and \`${staleDiagnosisTaskId}\` with \`${adoWaitTaskId}\`.
- Preserved the focus branch's no-live approval blocker.
- Preserved the landed holder lineage.
- Kept the validation claim honest: run \`171990664\` exists, but it has not produced proof until ADO starts/completes and artifacts are inspected.

## Evidence

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
