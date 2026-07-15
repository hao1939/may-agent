import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";
import { auditFocusMetadataIssues } from "./lib/focus-metadata-audit.ts";

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
  "ops/repair-focus-terminal-frontier-post-review-metadata-drift-20260714c";
const focusTaskId = "focus-terminal-frontier-finality-reconciliation-20260714";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops-repair-focus-terminal-frontier-post-review-metadata-drift-20260714c.md";
const focusReviewMemoPath =
  "../aks-rp-e2e/evidence/archive/focus-progress-review-terminal-frontier-finality-current-frontier-20260714b.md";
const attemptId =
  "a_ops_repair-focus-terminal-frontier-post-review-metadata-drift-20260714c_20260714110837";
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
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function taskState(task: Record<string, unknown> | undefined): string {
  const raw = task?.state ?? task?.status ?? "";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return typeof raw === "string" ? raw : "";
}

function writeMemo(relativePath: string, content: string) {
  const absolute = resolve(appDir, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

function formatTaskList(taskIds: string[]): string {
  return taskIds.length > 0
    ? taskIds.map((taskId) => `\`${taskId}\``).join(", ")
    : "none";
}

const summaryBefore = summarizeTaskTree(config);

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const beforeIssues = auditFocusMetadataIssues(tree).filter(
    (issue) => issue.ownerTaskId === focusTaskId,
  );
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];

  if (!focusTask) throw new Error(`Task not found: ${focusTaskId}`);
  if (!projectTask) throw new Error(`Task not found: ${projectTaskId}`);

  const frontierBefore = summaryBefore.frontier;
  const activeExcludingRepair = unique(
    frontierBefore.active.filter((taskId) => taskId !== repairTaskId),
  );
  const reviewExcludingRepair = unique(
    frontierBefore.review.filter((taskId) => taskId !== repairTaskId),
  );
  const waitingExcludingRepair = unique(
    frontierBefore.waiting.filter((taskId) => taskId !== repairTaskId),
  );
  const runnableExcludingRepair = unique(
    frontierBefore.runnable.filter((taskId) => taskId !== repairTaskId),
  );

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const priorEvidence = asStringArray(progressReview.evidence);
  const observations = asRecord(focusContext.observations);
  const focusTraceBefore = asRecord(focusTask.trace);
  const priorFocusOutputs = asStringArray(focusTask.outputs);
  const priorBlockedLinks = asStringArray(observations.linked_blocked_task_ids);

  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTraceBefore = asRecord(projectTask.trace);
  const priorProjectOutputs = asStringArray(projectTask.outputs);
  const linkedBefore = {
    linked_active_task_ids: asStringArray(observations.linked_active_task_ids),
    linked_review_task_ids: asStringArray(observations.linked_review_task_ids),
    linked_blocked_task_ids: priorBlockedLinks,
  };

  const liveBlockedLinks = unique(
    priorBlockedLinks.filter((taskId) => {
      const task = tree.tasks[taskId] as Record<string, unknown> | undefined;
      return taskState(task) === "blocked";
    }),
  );

  progressReview.last_reviewed_at = checkedAt;
  progressReview.status = "needs_approval";
  progressReview.summary =
    `The no-live terminal-frontier finality mission remains truthful, but after the three 2026-07-14 review closures the live frontier baseline excluding ${repairTaskId} is now blocked-only: active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}], blocked=${summaryBefore.counts.blocked}. Owner approval on ops/wait-project-approval-owner-return-primary-blocker-20260713 remains the governing gate.`;
  progressReview.evidence = unique([
    `${checkedAt} task-tree frontier reported active=[${frontierBefore.active.join(", ") || "none"}], review=[${frontierBefore.review.join(", ") || "none"}], waiting=[${frontierBefore.waiting.join(", ") || "none"}], runnable=[${frontierBefore.runnable.join(", ") || "none"}]. Excluding ${repairTaskId}, the truthful focus baseline is active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}], blocked=${summaryBefore.counts.blocked}.`,
    `${checkedAt} focus metadata audit found ${beforeIssues.length} issue(s): ${beforeIssues.map((issue) => issue.reason).join(" | ")}`,
    `${checkedAt} refreshed linked_active_task_ids and linked_review_task_ids to the blocked-only post-review frontier, pruned linked_blocked_task_ids to still-blocked tasks only, and kept the same no-live approval-gated mission without recreating retired holders.`,
    ...priorEvidence,
  ]);
  focusContext.progress_review = progressReview;

  observations.frontier_active_leaf_count = activeExcludingRepair.length;
  observations.frontier_review_leaf_count = reviewExcludingRepair.length;
  observations.frontier_waiting_leaf_count = waitingExcludingRepair.length;
  observations.frontier_runnable_leaf_count = runnableExcludingRepair.length;
  observations.frontier_blocked_leaf_count = summaryBefore.counts.blocked;
  observations.linked_active_task_ids = activeExcludingRepair;
  observations.linked_review_task_ids = reviewExcludingRepair;
  observations.linked_blocked_task_ids = liveBlockedLinks;
  observations.recent_learning =
    "Once the final no-live repair/review leaves closed, this focus branch reverted to a blocked-only frontier governed by the exact owner-approval wait plus preserved blocked carriers rather than any active or review worker leaves.";
  observations.parallel_work_gap =
    activeExcludingRepair.length === 0 && reviewExcludingRepair.length === 0
      ? `Excluding ${repairTaskId}, no active or review leaves remain; this focus is now represented only by blocked carriers and the governing owner-decision wait.`
      : `Excluding ${repairTaskId}, parallel work is carried by active=[${activeExcludingRepair.join(", ") || "none"}] and review=[${reviewExcludingRepair.join(", ") || "none"}] under the same no-live mission.`;
  focusContext.observations = observations;
  focusTask.context = focusContext;
  focusTask.outputs = unique([...priorFocusOutputs, evidencePath, focusReviewMemoPath]);
  focusTask.trace = {
    ...focusTraceBefore,
    review_summary:
      `Refreshed focus metadata so ${focusTaskId} now matches the live post-review frontier baseline excluding ${repairTaskId}: active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], blocked-links=[${liveBlockedLinks.join(", ") || "none"}].`,
    latest_focus_review_at: checkedAt,
    latest_focus_review_result: "updated",
    latest_focus_review_summary:
      `Focus still fits after the review closures: the mission remains no-live and approval-gated, but the truthful frontier is now blocked-only once ${repairTaskId} is excluded.`,
    linked_review_drift_repaired_at: checkedAt,
    linked_review_drift_repaired_by: "app-ops-script",
    linked_review_drift_repair_attempt_id: attemptId,
    linked_review_drift_repair_evidence_path: evidencePath,
  };

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.reason =
    `The next bounded mission is still terminal-frontier finality reconciliation, but after the three 2026-07-14 review closures the truthful live frontier excluding ${repairTaskId} is blocked-only: active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}], while blocked carrier linkage stays on [${liveBlockedLinks.join(", ") || "none"}]. Keep the same no-live approval gate; do not recreate retired holders just to make the focus look active.`;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_linked_review_drift_repaired_at: checkedAt,
    current_focus_proposal_linked_review_drift_repaired_by: "app-ops-script",
    current_focus_proposal_linked_review_drift_repair_attempt_id: attemptId,
    current_focus_proposal_linked_review_drift_repair_evidence_path:
      evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  const afterIssues = auditFocusMetadataIssues(tree).filter(
    (issue) => issue.ownerTaskId === focusTaskId,
  );

  return {
    checkedAt,
    attemptId,
    repairTaskId,
    focusTaskId,
    projectTaskId,
    baselineExcludingRepair: {
      active: activeExcludingRepair,
      review: reviewExcludingRepair,
      waiting: waitingExcludingRepair,
      runnable: runnableExcludingRepair,
      blockedLeafCount: summaryBefore.counts.blocked,
    },
    beforeIssues,
    afterIssues,
    beforeLinked: linkedBefore,
    afterLinked: {
      linked_active_task_ids: activeExcludingRepair,
      linked_review_task_ids: reviewExcludingRepair,
      linked_blocked_task_ids: liveBlockedLinks,
    },
    projectReason: currentFocusProposal.reason,
    focusProgressSummary: progressReview.summary,
  };
});

writeMemo(
  evidencePath,
  `# Focus terminal-frontier post-review metadata drift repair — 2026-07-14

Task: \`${repairTaskId}\`
Attempt: \`${attemptId}\`

## Result

Applied a bounded app-state repair to \`${focusTaskId}\` after the three 2026-07-14 review closures left stale active/review references behind. The truthful live frontier baseline excluding this repair task is now blocked-only, so the focus branch no longer cites retired leaves as active or review work.

## Baseline used

Per worker-mode audit rules, the baseline excludes the assigned repair task \`${repairTaskId}\`.

- active: ${formatTaskList(result.baselineExcludingRepair.active)}
- review: ${formatTaskList(result.baselineExcludingRepair.review)}
- waiting: ${formatTaskList(result.baselineExcludingRepair.waiting)}
- runnable: ${formatTaskList(result.baselineExcludingRepair.runnable)}
- blocked leaf count: ${result.baselineExcludingRepair.blockedLeafCount}

## Integrity contributors before repair

The focus metadata audit reported ${result.beforeIssues.length} issue(s):

${result.beforeIssues.map((issue, index) => `${index + 1}. ${issue.reason}`).join("\n")}

## What changed

- rewrote \`${focusTaskId}.context.observations.linked_active_task_ids\` to the live post-review frontier baseline
- rewrote \`${focusTaskId}.context.observations.linked_review_task_ids\` to the live post-review frontier baseline
- pruned \`${focusTaskId}.context.observations.linked_blocked_task_ids\` to still-blocked tasks only
- refreshed \`${focusTaskId}.context.progress_review\` to the truthful blocked-only frontier
- refreshed \`${focusTaskId}.trace.review_summary\` and latest focus review trace fields
- refreshed \`project.context.current_focus_proposal.reason\`
- refreshed \`${focusReviewMemoPath}\` so the archived progress review matches the blocked-only frontier

## Verification snapshot

Post-repair focus metadata audit issues for \`${focusTaskId}\`: ${result.afterIssues.length}

Before:

\`\`\`json
${JSON.stringify(result.beforeLinked, null, 2)}
\`\`\`

After:

\`\`\`json
${JSON.stringify(result.afterLinked, null, 2)}
\`\`\`

Updated focus progress summary:

> ${result.focusProgressSummary}

Project focus reason now states:

> ${result.projectReason}

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`,
);

writeMemo(
  focusReviewMemoPath,
  `# Focus progress review — terminal frontier finality remains blocked-only after review closures (2026-07-14)

- Trigger: \`project.focus.review.requested\`
- Mode: \`progress\`
- Focus branch reviewed: \`${focusTaskId}\`
- Review timestamp: \`${result.checkedAt}\`
- Cloud execution from this session: none
- Worker-task execution from this session: none

## Surfaces reviewed

- \`/app/projects/aks-rp-e2e.app/.state/tasks/tree.json\`
- \`/app/projects/aks-rp-e2e.app/.state/project-state.json\`
- \`cd /app/projects/aks-rp-e2e.app && bun run task-tree summary\`
- \`cd /app/projects/aks-rp-e2e.app && bun run task-tree frontier\`
- \`cd /app/projects/aks-rp-e2e.app && bun run ./scripts/check-integrity.ts\`

## Current read

The same no-live 12-24h focus still fits, and it does not need a new approval ask.

What changed is that the three 2026-07-14 review leaves are now gone from the live frontier. Excluding the currently assigned repair task \`${repairTaskId}\`, the truthful focus baseline is:

- active: ${formatTaskList(result.baselineExcludingRepair.active)}
- review: ${formatTaskList(result.baselineExcludingRepair.review)}
- waiting: ${formatTaskList(result.baselineExcludingRepair.waiting)}
- runnable: ${formatTaskList(result.baselineExcludingRepair.runnable)}
- blocked focus branch: \`${focusTaskId}\`
- governing owner-decision wait: \`ops/wait-project-approval-owner-return-primary-blocker-20260713\`

This is still a no-live reconciliation window, not a live-execution window.

## Frontier

Current task-tree summary shows, excluding the assigned repair leaf:

- \`${result.baselineExcludingRepair.runnable.length}\` runnable leaves
- \`${result.baselineExcludingRepair.waiting.length}\` waiting leaves
- \`${result.baselineExcludingRepair.active.length}\` active leaves
- \`${result.baselineExcludingRepair.review.length}\` review leaves
- \`${result.baselineExcludingRepair.blockedLeafCount}\` blocked leaves

## Judgment

Keep the same focus branch and the same approval gate, but represent it truthfully as blocked-only until a real owner decision or sharper blocked-holder change lands.

Do **not** reopen live execution. Do **not** recreate retired holders just to manufacture visible activity. Do keep the current blocked carriers and governing approval wait aligned.
`,
);

console.log(JSON.stringify(result, null, 2));
