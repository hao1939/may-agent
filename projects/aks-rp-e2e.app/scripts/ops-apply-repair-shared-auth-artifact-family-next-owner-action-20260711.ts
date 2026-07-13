import { resolve } from "node:path";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const focusTaskId =
  "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711";
const familyWaitTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711";
const staleTaskId =
  "ops/reconcile-shared-auth-runtime-artifact-recovery-family-20260711";
const attemptId =
  "a_ops-apply-repair-shared-auth-artifact-family-next-owner-action-20260711-_20260711130356";
const checkedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const familyWaitTask = tree.tasks[familyWaitTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!familyWaitTask) throw new Error(`Task not found: ${familyWaitTaskId}`);

  const context =
    focusTask.context && typeof focusTask.context === "object" && !Array.isArray(focusTask.context)
      ? { ...(focusTask.context as Record<string, unknown>) }
      : {};

  const observations =
    context.observations &&
    typeof context.observations === "object" &&
    !Array.isArray(context.observations)
      ? { ...(context.observations as Record<string, unknown>) }
      : {};

  const progressReview =
    context.progress_review &&
    typeof context.progress_review === "object" &&
    !Array.isArray(context.progress_review)
      ? { ...(context.progress_review as Record<string, unknown>) }
      : {};

  const progressEvidence = Array.isArray(progressReview.evidence)
    ? [...progressReview.evidence]
    : [];

  const currentBlockedIds = Array.isArray(observations.linked_blocked_task_ids)
    ? observations.linked_blocked_task_ids.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const normalizedBlockedIds = [
    familyWaitTaskId,
    ...currentBlockedIds.filter(
      (taskId) => taskId !== familyWaitTaskId && taskId !== staleTaskId,
    ),
  ];

  const repairedGoal =
    "Proposed 12-24h focus: stay no-live and shift the owner loop from stale review-recovery work to RP lifecycle source/spec/replay/model maturation plus exact wait stewardship, anchored on the shared auth/runtime/stale-row owner-return family wait and its dependent authenticated artifact-classification lineage rather than a nonexistent active recovery leaf or new mutation dispatch.";

  const repairedAcceptance = [
    "One visible focus branch represents the proposed 12-24h mission and truthfully matches the current live frontier: ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711 remains the exact blocked family holder, rp-cluster-lifecycle stop-start stays on one exact artifact-classification wait, and no blind live rerun is reopened from focus bookkeeping alone.",
    "If approved, normal owner work stays inside existing lanes: exact wait stewardship plus repo-local RP lifecycle source/spec/replay/model maturation for still-draft or still-unknown branches before any new live execution is considered.",
    "The focus is considered successful only when the shared auth/runtime/stale-row family either yields authenticated result recovery or lands one exact unrecoverable handoff, and the returned evidence narrows the RP lifecycle frontier or confirms the next bounded repo-local authoring work.",
  ];

  context.success_criteria = [
    "The shared auth/runtime/stale-row owner-return family advances to returned approval evidence, imported authenticated ADO result evidence, or one exact unrecoverable owner/runtime handoff, so spec.rp-cluster-lifecycle.stop-start can be classified beyond terminal pipeline success alone.",
    "RP lifecycle source/spec/replay/model maturation is pulled as the preferred no-live lane for the next 12-24h wherever lifecycle paths remain draft or unknown, instead of reopening broad blocked-frontier churn or blind reruns.",
    "Task-tree focus state and runtime readout agree that live execution is currently low-value: the live frontier carries exact waits rather than a shared auth/runtime active leaf, while the owner loop should mine repo-local lifecycle authoring/model work before asking for new cloud risk.",
  ];

  progressReview.summary =
    "The prior bounded review-recovery focus is no longer the truthful mission. Latest readout shows no pre-existing runnable/review frontier and the shared auth/runtime/stale-row family is now represented by one blocked wait rather than the previously cited active recovery leaf, while live starts/succeeds in the last 24h remain zero and 70 unknown paths still justify no-live RP lifecycle authoring plus exact wait stewardship.";
  progressReview.evidence = progressEvidence.map((entry) =>
    entry ===
    "2026-07-11T11:58:48Z bun run task-tree summary showed 1 active leaf (ops/reconcile-shared-auth-runtime-artifact-recovery-family-20260711), 0 runnable, 0 waiting, 0 review, and 134 blocked leaves."
      ? "2026-07-11 task-tree repair replaced the stale focus-plan active-leaf reference with the live blocked family wait ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711, whose blocker already carries the 2026-07-11T18:00:00Z review window plus 2026-07-11T20:00:00Z fallback."
      : entry,
  );
  context.progress_review = progressReview;

  observations.focus_reason =
    "The frontier is no longer a review-packet mission; it is exact blocked-wait stewardship with the shared auth/runtime/stale-row family carried by one blocked holder plus a large remaining unknown/draft lifecycle surface that can be improved locally.";
  observations.what_changed_since_last_review =
    "The prior focus completed and dropped out of the live runtime tree. The earlier cited active recovery leaf is missing, and the truthful live representation is now the blocked family wait ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711 while RP lifecycle stop-start remains exactly blocked on authenticated result recovery.";
  observations.live_execution_value =
    "Low. No live runs started or succeeded in the last 24h, and the current highest-value uncertainty is exact wait closure plus lifecycle authoring, not another cloud mutation attempt.";
  observations.frontier_active_leaf_count = 0;
  observations.frontier_review_leaf_count = 0;
  observations.frontier_waiting_leaf_count = 0;
  observations.frontier_runnable_leaf_count = 0;
  observations.frontier_blocked_leaf_count = 133;
  observations.linked_active_task_ids = [];
  observations.linked_blocked_task_ids = normalizedBlockedIds;
  observations.structural_status =
    "The next useful 12-24h mission is still a material direction change: preserve the shared owner-return family wait, keep dependent exact waits intact, and refill bounded repo-local lifecycle work without relying on the missing active recovery leaf.";
  context.observations = observations;

  context.rollup_summary =
    "2026-07-11 focus review now truthfully points at the shared auth/runtime/stale-row family wait instead of the missing active recovery leaf: preserve the exact RP stop-start wait, keep the owner-return review/fallback window on the family blocker, and direct the next owner loop toward RP lifecycle source/spec/replay/model maturation instead of more blocked-frontier churn.";

  focusTask.goal = repairedGoal;
  focusTask.acceptance = repairedAcceptance;
  focusTask.context = context;
  focusTask.trace = {
    ...(focusTask.trace ?? {}),
    shared_auth_artifact_family_focus_repaired_at: checkedAt,
    shared_auth_artifact_family_focus_repaired_by: "app-ops-script",
    shared_auth_artifact_family_focus_repair_attempt_id: attemptId,
    shared_auth_artifact_family_focus_replaced_stale_task_id: staleTaskId,
    shared_auth_artifact_family_focus_linked_wait_id: familyWaitTaskId,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    focusTaskId,
    familyWaitTaskId,
    staleTaskId,
    attemptId,
    checkedAt,
    linkedActiveTaskIds: observations.linked_active_task_ids,
    linkedBlockedTaskIds: observations.linked_blocked_task_ids,
    progressSummary: progressReview.summary,
  };
});

console.log(JSON.stringify(result, null, 2));
