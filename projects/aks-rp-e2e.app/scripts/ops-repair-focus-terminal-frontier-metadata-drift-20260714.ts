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

const focusTaskId = "focus-terminal-frontier-finality-reconciliation-20260714";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/ops-repair-focus-terminal-frontier-metadata-drift-20260714.md";
const attemptId =
  "a_ops_repair-focus-terminal-frontier-metadata-drift-20260714_20260714105000";
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

  const focusContext = asRecord(focusTask.context);
  const progressReview = asRecord(focusContext.progress_review);
  const observations = asRecord(focusContext.observations);
  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const focusTraceBefore = asRecord(focusTask.trace);
  const projectTraceBefore = asRecord(projectTask.trace);
  const priorFocusOutputs = asStringArray(focusTask.outputs);
  const priorProjectOutputs = asStringArray(projectTask.outputs);

  const currentActive = unique(summaryBefore.frontier.active);
  const currentReview = unique(summaryBefore.frontier.review);
  const currentWaiting = unique(summaryBefore.frontier.waiting);
  const currentRunnable = unique(summaryBefore.frontier.runnable);
  const priorBlockedLinks = asStringArray(observations.linked_blocked_task_ids);
  const liveBlockedLinks = priorBlockedLinks.filter((taskId) => {
    const task = tree.tasks[taskId];
    return taskState(task as Record<string, unknown> | undefined) === "blocked";
  });

  progressReview.last_reviewed_at = checkedAt;
  progressReview.status = "needs_approval";
  progressReview.summary =
    `The proposed no-live terminal-frontier finality mission still matches the live frontier, but focus metadata had drifted after worker outcomes changed two leaves from active to review and retired one stale blocked reference. The truthful current queue is ${currentActive.length} active, ${currentReview.length} review, ${currentWaiting.length} waiting, and ${summaryBefore.counts.blocked} blocked leaves, with owner approval still the missing control input.`;
  progressReview.evidence = unique([
    `${checkedAt} task-tree summary/frontier showed active=[${currentActive.join(", ")}], review=[${currentReview.join(", ")}], waiting=[${currentWaiting.join(", ")}], runnable=[${currentRunnable.join(", ")}], blocked=${summaryBefore.counts.blocked}.`,
    `${checkedAt} focus metadata audit found ${beforeIssues.length} issue(s): ${beforeIssues.map((issue) => issue.reason).join(" | ")}`,
    `${checkedAt} repaired linked_active_task_ids to the live active frontier, moved review leaves to linked_review_task_ids, and pruned missing blocked reference(s) from linked_blocked_task_ids.`,
  ]);
  focusContext.progress_review = progressReview;

  observations.frontier_active_leaf_count = currentActive.length;
  observations.frontier_review_leaf_count = currentReview.length;
  observations.frontier_waiting_leaf_count = currentWaiting.length;
  observations.frontier_runnable_leaf_count = currentRunnable.length;
  observations.frontier_blocked_leaf_count = summaryBefore.counts.blocked;
  observations.linked_active_task_ids = currentActive;
  observations.linked_review_task_ids = currentReview;
  observations.linked_blocked_task_ids = liveBlockedLinks;
  observations.parallel_work_gap =
    currentActive.length === 0 && currentReview.length === 0
      ? "No active or review leaves are currently advancing this focus; owner approval remains the only mover."
      : `Parallel work is currently carried by active=[${currentActive.join(", ") || "none"}] and review=[${currentReview.join(", ") || "none"}] inside the same no-live envelope.`;
  focusContext.observations = observations;
  focusTask.context = focusContext;
  focusTask.outputs = unique([...priorFocusOutputs, evidencePath]);
  focusTask.trace = {
    ...focusTraceBefore,
    review_summary:
      `Repaired focus metadata drift so ${focusTaskId} now matches the live frontier after worker outcomes changed queue shape: active=[${currentActive.join(", ") || "none"}], review=[${currentReview.join(", ") || "none"}], blocked-links=[${liveBlockedLinks.join(", ") || "none"}].`,
    metadata_drift_repaired_at: checkedAt,
    metadata_drift_repaired_by: "app-ops-script",
    metadata_drift_repair_attempt_id: attemptId,
    metadata_drift_repair_evidence_path: evidencePath,
  };

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.reason =
    `The next bounded no-live mission remains terminal-frontier finality reconciliation, but the live frontier has shifted since the focus task was first written: active=[${currentActive.join(", ") || "none"}], review=[${currentReview.join(", ") || "none"}], and the stale blocked reference hold-compact-app-routing-package-partial-frontier-20260714 is no longer in the live tree. Owner approval is still required before this mission formally replaces the retired VM-prerelease parity focus.`;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_metadata_drift_repaired_at: checkedAt,
    current_focus_proposal_metadata_drift_repaired_by: "app-ops-script",
    current_focus_proposal_metadata_drift_repair_attempt_id: attemptId,
    current_focus_proposal_metadata_drift_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  const afterIssues = auditFocusMetadataIssues(tree).filter(
    (issue) => issue.ownerTaskId === focusTaskId,
  );

  return {
    checkedAt,
    attemptId,
    focusTaskId,
    projectTaskId,
    summaryBefore: {
      active: summaryBefore.frontier.active,
      review: summaryBefore.frontier.review,
      waiting: summaryBefore.frontier.waiting,
      runnable: summaryBefore.frontier.runnable,
      blockedCount: summaryBefore.counts.blocked,
    },
    beforeIssues,
    afterIssues,
    repairedObservations: {
      linked_active_task_ids: currentActive,
      linked_review_task_ids: currentReview,
      linked_blocked_task_ids: liveBlockedLinks,
      frontier_active_leaf_count: currentActive.length,
      frontier_review_leaf_count: currentReview.length,
      frontier_waiting_leaf_count: currentWaiting.length,
      frontier_runnable_leaf_count: currentRunnable.length,
      frontier_blocked_leaf_count: summaryBefore.counts.blocked,
    },
    repairedProjectReason: currentFocusProposal.reason,
  };
});

writeMemo(`# Focus terminal-frontier metadata drift repair — 2026-07-14

Task: \`${focusTaskId}\`
Attempt: \`${attemptId}\`

## Result

Applied a bounded app-state repair to the focus metadata that was inflating \`aks-rp-e2e.process.integrity.task-tree-problem-count\`. The live task tree had already shifted, but \`${focusTaskId}\` still claimed two review leaves were active and still referenced missing blocked task \`hold-compact-app-routing-package-partial-frontier-20260714\`.

## Metric contributor before repair

The focus metadata audit reported ${result.beforeIssues.length} issue(s):

${result.beforeIssues.map((issue, index) => `${index + 1}. ${issue.reason}`).join("\n")}

## Live frontier used as source of truth

- active: ${result.summaryBefore.active.length > 0 ? result.summaryBefore.active.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- review: ${result.summaryBefore.review.length > 0 ? result.summaryBefore.review.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- waiting: ${result.summaryBefore.waiting.length > 0 ? result.summaryBefore.waiting.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- runnable: ${result.summaryBefore.runnable.length > 0 ? result.summaryBefore.runnable.map((taskId) => `\`${taskId}\``).join(", ") : "none"}
- blocked count: ${result.summaryBefore.blockedCount}

## What changed

- rewrote \`${focusTaskId}.context.observations.linked_active_task_ids\` to the live active frontier
- populated \`${focusTaskId}.context.observations.linked_review_task_ids\` with the live review frontier
- pruned missing/non-blocked entries from \`${focusTaskId}.context.observations.linked_blocked_task_ids\`
- refreshed \`${focusTaskId}.context.progress_review\`
- refreshed \`project.context.current_focus_proposal.reason\`

## Verification

Post-repair focus metadata audit issues for \`${focusTaskId}\`: ${result.afterIssues.length}

Repaired observation snapshot:

\`\`\`json
${JSON.stringify(result.repairedObservations, null, 2)}
\`\`\`

Project focus reason now states:

> ${result.repairedProjectReason}

## Evidence payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
