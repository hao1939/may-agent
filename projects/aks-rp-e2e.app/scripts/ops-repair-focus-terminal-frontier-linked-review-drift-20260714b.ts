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
  "ops/repair-focus-terminal-frontier-linked-review-drift-20260714b";
const focusTaskId = "focus-terminal-frontier-finality-reconciliation-20260714";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops-repair-focus-terminal-frontier-linked-review-drift-20260714b.md";
const attemptId =
  "a_ops_repair-focus-terminal-frontier-linked-review-drift-20260714b_20260714105125";
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

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
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
    `The proposed no-live terminal-frontier finality mission still fits the live queue, but the focus metadata had drifted again after worker completions changed one linked active task to review and removed another linked active task from the tree. Excluding ${repairTaskId}, the truthful current frontier is ${activeExcludingRepair.length} active, ${reviewExcludingRepair.length} review, ${waitingExcludingRepair.length} waiting, ${runnableExcludingRepair.length} runnable, and ${summaryBefore.counts.blocked} blocked leaves.`;
  progressReview.evidence = unique([
    `${checkedAt} task-tree frontier reported active=[${frontierBefore.active.join(", ")}], review=[${frontierBefore.review.join(", ")}], waiting=[${frontierBefore.waiting.join(", ")}], runnable=[${frontierBefore.runnable.join(", ")}]. Excluding ${repairTaskId}, the baseline is active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}].`,
    `${checkedAt} focus metadata audit found ${beforeIssues.length} issue(s): ${beforeIssues.map((issue) => issue.reason).join(" | ")}`,
    `${checkedAt} repaired ${focusTaskId}.context.observations.linked_active_task_ids and linked_review_task_ids so they match the live frontier baseline, and pruned linked_blocked_task_ids to still-blocked tasks only.`,
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
  observations.parallel_work_gap =
    activeExcludingRepair.length === 0 && reviewExcludingRepair.length === 0
      ? `No active or review leaves remain once ${repairTaskId} is excluded; owner approval would be the only mover.`
      : `Excluding ${repairTaskId}, parallel work is now carried by active=[${activeExcludingRepair.join(", ") || "none"}] and review=[${reviewExcludingRepair.join(", ") || "none"}] under the same no-live mission.`;
  focusContext.observations = observations;
  focusTask.context = focusContext;
  focusTask.outputs = unique([...priorFocusOutputs, evidencePath]);
  focusTask.trace = {
    ...focusTraceBefore,
    review_summary:
      `Repaired focus metadata drift so ${focusTaskId} again matches the live frontier baseline excluding ${repairTaskId}: active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], blocked-links=[${liveBlockedLinks.join(", ") || "none"}].`,
    linked_review_drift_repaired_at: checkedAt,
    linked_review_drift_repaired_by: "app-ops-script",
    linked_review_drift_repair_attempt_id: attemptId,
    linked_review_drift_repair_evidence_path: evidencePath,
  };

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.reason =
    `The next bounded no-live mission is still terminal-frontier finality reconciliation, but the live frontier moved again after earlier worker completions. Excluding ${repairTaskId}, the truthful frontier is active=[${activeExcludingRepair.join(", ") || "none"}], review=[${reviewExcludingRepair.join(", ") || "none"}], waiting=[${waitingExcludingRepair.join(", ") || "none"}], runnable=[${runnableExcludingRepair.join(", ") || "none"}], while blocked carrier linkage stays on [${liveBlockedLinks.join(", ") || "none"}]. Owner approval is still required before this mission replaces the retired VM-prerelease parity focus.`;
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
  };
});

writeMemo(`# Focus terminal-frontier linked-review drift repair — 2026-07-14

Task: \`${repairTaskId}\`
Attempt: \`${attemptId}\`

## Result

Applied a bounded app-state repair to \`${focusTaskId}\` after the live frontier shifted again. The focus branch had stale linked active metadata: one referenced task was gone from the live tree and one had already moved to review.

## Baseline used

Per worker-mode audit rules, the baseline excludes the assigned repair task \`${repairTaskId}\`.

- active: ${result.baselineExcludingRepair.active.length > 0 ? result.baselineExcludingRepair.active.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${result.baselineExcludingRepair.review.length > 0 ? result.baselineExcludingRepair.review.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${result.baselineExcludingRepair.waiting.length > 0 ? result.baselineExcludingRepair.waiting.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${result.baselineExcludingRepair.runnable.length > 0 ? result.baselineExcludingRepair.runnable.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- blocked leaf count: ${result.baselineExcludingRepair.blockedLeafCount}

## Integrity contributors before repair

The focus metadata audit reported ${result.beforeIssues.length} issue(s):

${result.beforeIssues.map((issue, index) => `${index + 1}. ${issue.reason}`).join("\n")}

## What changed

- rewrote \`${focusTaskId}.context.observations.linked_active_task_ids\` to the live active frontier baseline
- rewrote \`${focusTaskId}.context.observations.linked_review_task_ids\` to the live review frontier baseline
- pruned \`${focusTaskId}.context.observations.linked_blocked_task_ids\` to still-blocked tasks only
- refreshed \`${focusTaskId}.context.progress_review\`
- refreshed \`${focusTaskId}.trace.review_summary\`
- refreshed \`project.context.current_focus_proposal.reason\`

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

Project focus reason now states:

> ${result.projectReason}

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
