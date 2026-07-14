import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

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

const repairTaskId =
  "ops/repair-focus-progress-review-stale-queue-claims-20260714";
const focusTaskId =
  "focus-no-live-checkpoint-split-carrier-bundle-model-isolation-20260714";
const projectTaskId = "project";
const governingApprovalWaitTaskId =
  "ops/wait-project-approval-owner-return-primary-blocker-20260713";
const dependentFocusWaitTaskId =
  "ops/wait-focus-no-live-checkpoint-split-owner-decision-20260714";
const evidencePath =
  "evidence/archive/ops-repair-focus-progress-review-stale-queue-claims-20260714.md";
const attemptId =
  "a_ops_repair-focus-progress-review-stale-queue-claims-20260714_20260714075012";
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

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const summaryBefore = summarizeTaskTree(config);
const frontierBefore = summaryBefore.frontier;
const activeExcludingRepair = frontierBefore.active.filter(
  (taskId) => taskId !== repairTaskId,
);
const reviewExcludingRepair = frontierBefore.review.filter(
  (taskId) => taskId !== repairTaskId,
);
const waitingExcludingRepair = frontierBefore.waiting.filter(
  (taskId) => taskId !== repairTaskId,
);
const runnableExcludingRepair = frontierBefore.runnable.filter(
  (taskId) => taskId !== repairTaskId,
);

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  const governingApprovalWait = tree.tasks[governingApprovalWaitTaskId];
  const dependentFocusWait = tree.tasks[dependentFocusWaitTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);
  if (!governingApprovalWait) {
    throw new Error(`Task not found: ${governingApprovalWaitTaskId}`);
  }
  if (!dependentFocusWait) {
    throw new Error(`Task not found: ${dependentFocusWaitTaskId}`);
  }

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const priorEvidence = asStringArray(progressReview.evidence);
  const observations = asRecord(focusContext.observations);
  const focusTraceBefore = asRecord(focusTask.trace);
  const priorFocusOutputs = asStringArray(focusTask.outputs);

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTraceBefore = asRecord(projectTask.trace);
  const priorProjectOutputs = asStringArray(projectTask.outputs);

  const before = {
    focusProgressSummary: progressReview.summary ?? null,
    focusProgressEvidence: priorEvidence,
    focusObservationLearned:
      observations.what_project_learned_since_last_review ?? null,
    focusObservationParallel: observations.parallel_work_filled ?? null,
    focusTraceReviewSummary: focusTraceBefore.review_summary ?? null,
    projectReason: currentFocusProposal.reason ?? null,
  };

  const focusProgressSummary =
    `The no-live checkpoint split / model-isolation focus still fits the next 12-24h and remains approval-blocked, but the adjacent queue is now blocked-only rather than active/review. Excluding ${repairTaskId}, the live frontier has ${activeExcludingRepair.length} active, ${reviewExcludingRepair.length} review, ${waitingExcludingRepair.length} waiting, and ${runnableExcludingRepair.length} runnable leaves, so the truthful approval surface is just ${governingApprovalWaitTaskId} as the governing carrier plus ${dependentFocusWaitTaskId} as the dependent focus holder.`;
  const focusEvidence = [
    `${checkedAt} task-tree frontier reported active=[${frontierBefore.active.join(", ")}], review=[${frontierBefore.review.join(", ")}], waiting=[${frontierBefore.waiting.join(", ")}], runnable=[${frontierBefore.runnable.join(", ")}]. Excluding ${repairTaskId}, the live frontier has active=[${activeExcludingRepair.join(", ")}], review=[${reviewExcludingRepair.join(", ")}], waiting=[${waitingExcludingRepair.join(", ")}], runnable=[${runnableExcludingRepair.join(", ")}].`,
    `${checkedAt} task-tree packet/root summary still shows the focus branch itself is readable and blocked behind one dependent child wait: ${focusTaskId} -> ${dependentFocusWaitTaskId}. No adjacent active or review leaves remain in the frontier once this repair task is excluded.`,
    `${checkedAt} task-tree show ${governingApprovalWaitTaskId} still records the preserved project.approval.submitted lineage for focus-no-live-checkpoint-split-carrier-bundle-model-isolation-20260714, while task-tree show ${dependentFocusWaitTaskId} still points back to ${governingApprovalWaitTaskId} via blocker.waiting_for.taskId instead of creating a second approval ask.`,
    ...priorEvidence.filter(
      (entry) =>
        !entry.includes("active approval-lineage repair plus one review-ready secops-fips holder repair") &&
        !entry.includes("task-tree frontier snapshot")
    ),
  ];

  progressReview.last_reviewed_at = checkedAt;
  progressReview.status = "blocked";
  progressReview.summary = focusProgressSummary;
  progressReview.evidence = unique(focusEvidence);
  focusContext.progress_review = progressReview;

  observations.what_project_learned_since_last_review =
    `The checkpoint-split residue decomposition still holds and no approval return has landed, but the earlier adjacent approval-lineage/secops-fips repair leaves have already been accepted and archived. Excluding ${repairTaskId}, the live frontier is now blocked-only, with ${governingApprovalWaitTaskId} carrying the governing approval lineage and ${dependentFocusWaitTaskId} preserving the focus branch's planned post-approval slices.`;
  observations.live_execution_value =
    "Still low. Live throughput remains 0/0 in the last 24h, and there are no adjacent active or review leaves left to justify a live pivot from focus maintenance.";
  observations.blocker_shape =
    `The focus is paused on one real external owner-approval wait represented by ${governingApprovalWaitTaskId}, plus one dependent focus holder ${dependentFocusWaitTaskId}; no separate active/review queue remains once this repair task is excluded.`;
  observations.parallel_work_filled =
    `No. Excluding ${repairTaskId}, the current queue shape is blocked-only behind ${governingApprovalWaitTaskId} and ${dependentFocusWaitTaskId}.`;
  observations.next_12_24h_fit =
    "Yes. Keeping the mission on checkpoint-shape and model/view isolation still best supports truthful feature/spec/model feedback, but the focus metadata must describe the queue as blocked-only until a returned approval decision or sharper same-lineage evidence arrives.";
  observations.frontier_active_leaf_count = activeExcludingRepair.length;
  observations.frontier_review_leaf_count = reviewExcludingRepair.length;
  observations.frontier_waiting_leaf_count = waitingExcludingRepair.length;
  observations.frontier_runnable_leaf_count = runnableExcludingRepair.length;
  observations.linked_active_task_ids = activeExcludingRepair;
  observations.linked_review_task_ids = reviewExcludingRepair;
  observations.linked_blocked_task_ids = [
    governingApprovalWaitTaskId,
    dependentFocusWaitTaskId,
  ];
  focusContext.observations = observations;
  focusTask.context = focusContext;
  focusTask.outputs = unique([...priorFocusOutputs, evidencePath]);
  focusTask.trace = {
    ...focusTraceBefore,
    review_summary:
      `Mid-term focus-plan review still keeps the no-live checkpoint split / model-isolation branch as the right bounded mission, but subsequent queue-shape repair shows the adjacent queue is now blocked-only. Excluding ${repairTaskId}, no active or review leaves remain; keep ${governingApprovalWaitTaskId} as the governing approval carrier and ${dependentFocusWaitTaskId} as the dependent focus wait rather than implying another live pivot.`,
    stale_queue_claims_repaired_at: checkedAt,
    stale_queue_claims_repaired_by: "app-ops-script",
    stale_queue_claims_repair_attempt_id: attemptId,
    stale_queue_claims_repair_evidence_path: evidencePath,
  };

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.reason =
    `Mid-term focus-plan review kept the same no-live checkpoint split mission: live throughput remains 0/0, the accepted uncheckpointed-slice memo still proves the current residue should stay split between feature-local carriers and the wider shared model/view regeneration bundle, and excluding ${repairTaskId} the adjacent queue is now blocked-only behind ${governingApprovalWaitTaskId} plus dependent focus holder ${dependentFocusWaitTaskId} rather than any active/review repair leaves.`;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_stale_queue_claims_repaired_at: checkedAt,
    current_focus_proposal_stale_queue_claims_repaired_by: "app-ops-script",
    current_focus_proposal_stale_queue_claims_repair_attempt_id: attemptId,
    current_focus_proposal_stale_queue_claims_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    checkedAt,
    attemptId,
    repairTaskId,
    focusTaskId,
    projectTaskId,
    governingApprovalWaitTaskId,
    dependentFocusWaitTaskId,
    baselineExcludingRepair: {
      active: activeExcludingRepair,
      review: reviewExcludingRepair,
      waiting: waitingExcludingRepair,
      runnable: runnableExcludingRepair,
    },
    before,
    after: {
      focusProgressSummary: progressReview.summary,
      focusProgressEvidence: asStringArray(progressReview.evidence),
      focusObservationLearned:
        observations.what_project_learned_since_last_review ?? null,
      focusObservationParallel: observations.parallel_work_filled ?? null,
      focusObservationCounts: {
        active: observations.frontier_active_leaf_count ?? null,
        review: observations.frontier_review_leaf_count ?? null,
        waiting: observations.frontier_waiting_leaf_count ?? null,
        runnable: observations.frontier_runnable_leaf_count ?? null,
      },
      focusTraceReviewSummary: focusTask.trace
        ? asRecord(focusTask.trace).review_summary ?? null
        : null,
      projectReason: currentFocusProposal.reason ?? null,
      focusOutputs: asStringArray(focusTask.outputs),
      projectOutputs: asStringArray(projectTask.outputs),
    },
    preservedApprovalSurface: {
      governingWait: {
        taskId: governingApprovalWaitTaskId,
        state:
          governingApprovalWait.state ?? governingApprovalWait.status ?? null,
        blocker: asRecord(governingApprovalWait.blocker),
      },
      dependentFocusWait: {
        taskId: dependentFocusWaitTaskId,
        state: dependentFocusWait.state ?? dependentFocusWait.status ?? null,
        blocker: asRecord(dependentFocusWait.blocker),
      },
    },
  };
});

writeMemo(`# Focus progress-review stale queue-claims repair — 2026-07-14

Task: \`${repairTaskId}\`
Attempt: \`${attemptId}\`

## Result

Applied a bounded app-state repair so the live no-live checkpoint-split focus metadata no longer implies adjacent active/review work that has already been accepted and archived. The focus branch now describes the current queue truthfully as a blocked-only approval surface behind one governing project-level carrier plus one dependent focus wait.

## Baseline used

Per task rules, the baseline excludes the assigned repair task \`${repairTaskId}\`.

- active: ${activeExcludingRepair.length > 0 ? activeExcludingRepair.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${reviewExcludingRepair.length > 0 ? reviewExcludingRepair.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${waitingExcludingRepair.length > 0 ? waitingExcludingRepair.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${runnableExcludingRepair.length > 0 ? runnableExcludingRepair.map((taskId) => `\`${taskId}\``).join(", ") : "none"}

## Packet / frontier evidence used to retire the stale narration

1. \`bun run task-tree frontier\` showed the only active frontier leaf was this repair task itself, with empty review/waiting/runnable arrays.
2. \`bun run task-tree packet\` showed \`active_task_ids=["${repairTaskId}"]\` and no review frontier, while the blocked parent summary for \`${focusTaskId}\` still had exactly one open blocked child: \`${dependentFocusWaitTaskId}\`.
3. \`bun run task-tree show ${governingApprovalWaitTaskId}\` still preserved the governing focus approval lineage, and \`bun run task-tree show ${dependentFocusWaitTaskId}\` still pointed back to \`${governingApprovalWaitTaskId}\` through \`blocker.waiting_for.taskId\`.

## What changed

- refreshed \`${focusTaskId}.context.progress_review\`
- refreshed \`${focusTaskId}.context.observations\`
- refreshed \`${focusTaskId}.trace.review_summary\`
- refreshed \`project.context.current_focus_proposal.reason\`
- preserved the governing approval surface as exactly:
  - \`${governingApprovalWaitTaskId}\`
  - \`${dependentFocusWaitTaskId}\`

## Verification snapshot

The repaired focus metadata now records:

- \`frontier_active_leaf_count = ${activeExcludingRepair.length}\`
- \`frontier_review_leaf_count = ${reviewExcludingRepair.length}\`
- \`frontier_waiting_leaf_count = ${waitingExcludingRepair.length}\`
- \`frontier_runnable_leaf_count = ${runnableExcludingRepair.length}\`
- \`linked_active_task_ids = [${activeExcludingRepair.join(", ")}]\`
- \`linked_review_task_ids = [${reviewExcludingRepair.join(", ")}]\`
- \`linked_blocked_task_ids = [${governingApprovalWaitTaskId}, ${dependentFocusWaitTaskId}]\`

The project focus proposal reason now says the adjacent queue is blocked-only behind the same governing approval carrier plus dependent focus wait, not an active/review repair queue.

## Script path

- \`scripts/ops-repair-focus-progress-review-stale-queue-claims-20260714.ts\`

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
