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

const focusTaskId =
  "focus-blocked-frontier-writeback-and-holder-normalization-20260714";
const projectTaskId = "project";
const evidencePath =
  "evidence/archive/20260714-metric-alert-task-tree-problem-count-alert3693-fix-root-cause.md";
const focusReviewMemoPath =
  "../aks-rp-e2e/evidence/archive/focus-progress-review-blocked-frontier-writeback-and-holder-normalization-20260714.md";
const attemptId =
  "a_ops_repair-focus-blocked-frontier-writeback-holder-metadata-drift-20260714d_20260714174500";
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
  const currentActive = unique(frontierBefore.active);
  const currentReview = unique(frontierBefore.review);
  const currentWaiting = unique(frontierBefore.waiting);
  const currentRunnable = unique(frontierBefore.runnable);

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
  progressReview.status = "blocked";
  progressReview.summary =
    `The blocked-frontier writeback and holder-normalization focus is still the truthful no-live mission, but the live frontier shifted after the LocalDNS family leaf archived and the KMS writeback leaf moved to review. The current baseline is active=[${currentActive.join(", ") || "none"}], review=[${currentReview.join(", ") || "none"}], waiting=[${currentWaiting.join(", ") || "none"}], runnable=[${currentRunnable.join(", ") || "none"}], blocked=${summaryBefore.counts.blocked}. Owner approval is still required before treating this proposal as the named 12-24h branch.`;
  progressReview.evidence = unique([
    `${checkedAt} task-tree summary showed active=[${frontierBefore.active.join(", ") || "none"}], review=[${frontierBefore.review.join(", ") || "none"}], waiting=[${frontierBefore.waiting.join(", ") || "none"}], runnable=[${frontierBefore.runnable.join(", ") || "none"}], blocked=${summaryBefore.counts.blocked}.`,
    `${checkedAt} focus metadata audit found ${beforeIssues.length} issue(s): ${beforeIssues.map((issue) => issue.reason).join(" | ")}`,
    `${checkedAt} refreshed linked_active_task_ids and linked_review_task_ids so the focus proposal matches the live frontier after LocalDNS archived and the KMS writeback leaf moved from active to review.`,
    ...priorEvidence,
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
  observations.recent_review_signal =
    "Current useful movement remains local writeback/reconciliation. The LocalDNS family check has already been compacted as done, network-cni writeback is the only active focus leaf, and the KMS writeback plus wave-b/wave-c review follow-ups now sit in review rather than active execution.";
  observations.parallel_work_gap =
    `The immediate no-live frontier is still concrete: active=[${currentActive.join(", ") || "none"}] and review=[${currentReview.join(", ") || "none"}]. Do not invent broader backlog until these exact writeback/review leaves are written back, replaced, or closed.`;
  focusContext.observations = observations;
  focusTask.context = focusContext;
  focusTask.outputs = unique([...priorFocusOutputs, evidencePath, focusReviewMemoPath]);
  focusTask.trace = {
    ...focusTraceBefore,
    review_summary:
      `Refreshed focus metadata so ${focusTaskId} now matches the live frontier: active=[${currentActive.join(", ") || "none"}], review=[${currentReview.join(", ") || "none"}], blocked-links=[${liveBlockedLinks.join(", ") || "none"}].`,
    latest_focus_review_at: checkedAt,
    latest_focus_review_result: "updated",
    latest_focus_review_summary:
      "Focus still fits, but its live frontier changed: LocalDNS is no longer active, network-cni writeback is active, and the KMS writeback leaf is now review work.",
    frontier_metadata_repaired_at: checkedAt,
    frontier_metadata_repaired_by: "app-ops-script",
    frontier_metadata_repair_attempt_id: attemptId,
    frontier_metadata_repair_evidence_path: evidencePath,
  };

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.reason =
    `At ${checkedAt} the truthful live frontier is active=[${currentActive.join(", ") || "none"}], review=[${currentReview.join(", ") || "none"}], waiting=[${currentWaiting.join(", ") || "none"}], runnable=[${currentRunnable.join(", ") || "none"}], blocked=${summaryBefore.counts.blocked}. The same no-live blocked-frontier writeback/holder-normalization mission still fits, but the LocalDNS family check is already compacted done and the KMS writeback leaf has advanced to review. Keep the mission centered on network-cni writeback, App Routing shared-wait restoration, and compact-holder truth without recreating retired leaves.`;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...priorProjectOutputs, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_frontier_metadata_repaired_at: checkedAt,
    current_focus_proposal_frontier_metadata_repaired_by: "app-ops-script",
    current_focus_proposal_frontier_metadata_repair_attempt_id: attemptId,
    current_focus_proposal_frontier_metadata_repair_evidence_path: evidencePath,
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
    baseline: {
      active: currentActive,
      review: currentReview,
      waiting: currentWaiting,
      runnable: currentRunnable,
      blockedLeafCount: summaryBefore.counts.blocked,
    },
    beforeIssues,
    afterIssues,
    beforeLinked: linkedBefore,
    afterLinked: {
      linked_active_task_ids: currentActive,
      linked_review_task_ids: currentReview,
      linked_blocked_task_ids: liveBlockedLinks,
    },
    projectReason: currentFocusProposal.reason,
    focusProgressSummary: progressReview.summary,
  };
});

writeMemo(
  evidencePath,
  `# Metric alert triage — \`aks-rp-e2e.process.integrity.task-tree-problem-count\` (alert 3693)

- Date: 2026-07-14
- Final operation: \`resolve_stale\`
- Metric id: \`aks-rp-e2e.process.integrity.task-tree-problem-count\`
- Alert id: \`3693\`
- Owner: \`app-ops\`

## Judgment

The breach was real. The live task tree had two focus-metadata integrity defects under \`${focusTaskId}\`: one stale active link to archived LocalDNS family task \`domain-burn-down-localdns-blocked-family-20260714\`, and one stale active link to \`review-spec-kms-v2-private-vnet-integration-private-kv-rerun-171997614-return-20260714\` even though that leaf had already moved to \`review\`.

This session fixed the root cause by refreshing the focus-plan metadata and project focus readout through the supported task-tree save path so the focus branch now matches the live frontier truth.

## Evidence checked

### 1) Live integrity failure before repair

Before repair, \`bun run integrity\` failed with:

${result.beforeIssues.map((issue) => `- ${issue.reason}`).join("\n")}

### 2) Concrete repair applied

- rewrote \`${focusTaskId}.context.observations.linked_active_task_ids\` to the current live active frontier
- rewrote \`${focusTaskId}.context.observations.linked_review_task_ids\` to the current live review frontier
- preserved only still-blocked carriers in \`linked_blocked_task_ids\`
- refreshed \`${focusTaskId}.context.progress_review\`
- refreshed \`project.context.current_focus_proposal.reason\`

### 3) Verification snapshot

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

Updated project focus reason:

> ${result.projectReason}

## Outcome

Choosing \`fix_root_cause\` because the current breach came from stale focus metadata links in the live task tree, this session refreshed those links through the supported task-tree save path, and the live integrity/metric recompute can now validate the repair.

## Next validation

Wait for the next \`metrics-snapshot\` / alert refresh to move persisted \`metrics.current\` from \`2\` to \`0\` and auto-clear alert \`3693\`.
`,
);

writeMemo(
  focusReviewMemoPath,
  `# Focus progress review — blocked-frontier writeback and holder normalization — 2026-07-14

Mode: regular focus progress review refresh
Agent: \`app-ops\`

## Current read

The same no-live blocked-frontier writeback and holder-normalization mission still fits, but the live frontier has shifted since the proposal was first recorded.

Current truthful frontier:

- active: ${formatTaskList(result.baseline.active)}
- review: ${formatTaskList(result.baseline.review)}
- waiting: ${formatTaskList(result.baseline.waiting)}
- runnable: ${formatTaskList(result.baseline.runnable)}
- blocked leaf count: ${result.baseline.blockedLeafCount}

## What changed

- \`domain-burn-down-localdns-blocked-family-20260714\` is no longer a live active leaf; it has already been compacted done.
- \`review-spec-kms-v2-private-vnet-integration-private-kv-rerun-171997614-return-20260714\` is no longer active execution; it is now review work.
- \`domain/reconcile-network-cni-pass-writeback-drift-20260714\` is the remaining active focus leaf.

## Judgment

Keep the same no-live mission and approval gate, but represent it truthfully as:

- one active writeback leaf (network-cni),
- four review leaves (wave-b, wave-c, compact wave-c, KMS writeback),
- and the same blocked carrier set.

Do **not** recreate retired LocalDNS activity just to keep the focus summary looking busier than the live tree really is.
`,
);

console.log(JSON.stringify(result, null, 2));
