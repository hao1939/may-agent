import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
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

const repairTaskId = "ops/repair-focus-nodepool-holder-id-drift-20260713";
const focusTaskId =
  "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711";
const projectTaskId = "project";
const primaryWaitTaskId =
  "ops/wait-project-approval-owner-return-primary-blocker-20260713";
const oldPromotionTaskId =
  "domain/hold-rp-nodepool-lifecycle-execute-ready-promotion-visible-backlog-20260713";
const newPromotionTaskId =
  "domain/hold-rp-nodepool-lifecycle-execute-ready-promotion-visible-backlog-20260713b";
const oldSubsetTaskId =
  "domain/hold-rp-nodepool-lifecycle-ready-subset-pass-sync-visible-backlog-20260713";
const newSubsetTaskId =
  "domain/hold-rp-nodepool-lifecycle-ready-subset-pass-sync-visible-backlog-20260713b";
const evidencePath =
  "evidence/archive/ops-repair-focus-nodepool-holder-id-drift-20260713.md";
const attemptId =
  "a_ops_repair-focus-nodepool-holder-id-drift-20260713_20260713195632";
const checkedAt = new Date().toISOString();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}

function replaceNodepoolHolderIds(text: string): string {
  return text
    .split(oldPromotionTaskId)
    .join(newPromotionTaskId)
    .split(oldSubsetTaskId)
    .join(newSubsetTaskId);
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, evidencePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const focusTask = tree.tasks[focusTaskId];
  const projectTask = tree.tasks[projectTaskId];
  const primaryWaitTask = tree.tasks[primaryWaitTaskId];
  const newPromotionTask = tree.tasks[newPromotionTaskId];
  const newSubsetTask = tree.tasks[newSubsetTaskId];

  for (const [id, task] of Object.entries({
    [focusTaskId]: focusTask,
    [projectTaskId]: projectTask,
    [primaryWaitTaskId]: primaryWaitTask,
    [newPromotionTaskId]: newPromotionTask,
    [newSubsetTaskId]: newSubsetTask,
  })) {
    if (!task) throw new Error(`Task not found: ${id}`);
  }

  const focusContext = asRecord(focusTask.context);
  const observations = asRecord(focusContext.observations);
  const progressReview = asRecord(focusContext.progress_review);
  const focusTraceBefore = asRecord(focusTask.trace);
  const focusOutputsBefore = asStringArray(focusTask.outputs);
  const projectContext = asRecord(projectTask.context);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const projectTraceBefore = asRecord(projectTask.trace);
  const projectOutputsBefore = asStringArray(projectTask.outputs);
  const primaryWaitBlocker = asRecord(primaryWaitTask.blocker);
  const primaryWaitTraceBefore = asRecord(primaryWaitTask.trace);
  const primaryWaitOutputsBefore = asStringArray(primaryWaitTask.outputs);

  const beforeIssues = auditFocusMetadataIssues(tree);
  const beforeLinkedBlocked = asStringArray(observations.linked_blocked_task_ids);
  const beforeProjectReason = asString(currentFocusProposal.reason);
  const beforePrimaryWaitCondition = asString(primaryWaitBlocker.condition);
  const beforeProgressEvidence = asStringArray(progressReview.evidence);

  observations.linked_blocked_task_ids = unique(
    beforeLinkedBlocked.map((taskId) => {
      if (taskId === oldPromotionTaskId) return newPromotionTaskId;
      if (taskId === oldSubsetTaskId) return newSubsetTaskId;
      return taskId;
    }),
  );
  focusContext.observations = observations;

  progressReview.last_reviewed_at = checkedAt;
  progressReview.evidence = beforeProgressEvidence.map(replaceNodepoolHolderIds);
  focusContext.progress_review = progressReview;
  focusContext.rollup_summary =
    "2026-07-13 focus holder-id drift repair: replaced archived RP nodepool holder ids in focus blocked-holder metadata with the live 20260713b successors after planner compaction.";
  focusTask.context = focusContext;
  focusTask.outputs = unique([...focusOutputsBefore, evidencePath]);
  focusTask.trace = {
    ...focusTraceBefore,
    nodepool_holder_id_drift_repaired_at: checkedAt,
    nodepool_holder_id_drift_repaired_by: "app-ops-script",
    nodepool_holder_id_drift_repair_attempt_id: attemptId,
    nodepool_holder_id_drift_repair_evidence_path: evidencePath,
  };

  currentFocusProposal.reviewed_at = checkedAt;
  currentFocusProposal.reason = replaceNodepoolHolderIds(beforeProjectReason);
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  projectTask.outputs = unique([...projectOutputsBefore, evidencePath]);
  projectTask.trace = {
    ...projectTraceBefore,
    current_focus_proposal_nodepool_holder_id_drift_repaired_at: checkedAt,
    current_focus_proposal_nodepool_holder_id_drift_repaired_by:
      "app-ops-script",
    current_focus_proposal_nodepool_holder_id_drift_repair_attempt_id: attemptId,
    current_focus_proposal_nodepool_holder_id_drift_repair_evidence_path:
      evidencePath,
  };

  primaryWaitBlocker.condition = replaceNodepoolHolderIds(
    beforePrimaryWaitCondition,
  );
  primaryWaitTask.blocker = primaryWaitBlocker;
  primaryWaitTask.outputs = unique([...primaryWaitOutputsBefore, evidencePath]);
  primaryWaitTask.trace = {
    ...primaryWaitTraceBefore,
    nodepool_holder_id_drift_repaired_at: checkedAt,
    nodepool_holder_id_drift_repaired_by: "app-ops-script",
    nodepool_holder_id_drift_repair_attempt_id: attemptId,
    nodepool_holder_id_drift_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  const afterIssues = auditFocusMetadataIssues(tree);

  return {
    checkedAt,
    repairTaskId,
    focusTaskId,
    projectTaskId,
    primaryWaitTaskId,
    oldTaskIds: [oldPromotionTaskId, oldSubsetTaskId],
    newTaskIds: [newPromotionTaskId, newSubsetTaskId],
    liveSuccessorStates: {
      [newPromotionTaskId]: newPromotionTask.state ?? newPromotionTask.status ?? null,
      [newSubsetTaskId]: newSubsetTask.state ?? newSubsetTask.status ?? null,
    },
    oldTaskStates: {
      [oldPromotionTaskId]: tree.tasks[oldPromotionTaskId]?.state ?? "missing",
      [oldSubsetTaskId]: tree.tasks[oldSubsetTaskId]?.state ?? "missing",
    },
    before: {
      linkedBlockedTaskIds: beforeLinkedBlocked,
      projectReason: beforeProjectReason,
      primaryWaitCondition: beforePrimaryWaitCondition,
      issues: beforeIssues,
    },
    after: {
      linkedBlockedTaskIds: asStringArray(observations.linked_blocked_task_ids),
      projectReason: asString(currentFocusProposal.reason),
      primaryWaitCondition: asString(primaryWaitBlocker.condition),
      issues: afterIssues,
    },
  };
});

writeMemo(`# Focus nodepool holder-id drift repair — 2026-07-13

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`

## Result

Repaired the focus-plan blocked-holder metadata after planner compaction replaced two RP nodepool visible backlog holders with 20260713b successors. The focus branch, project current-focus reason, and governing project-level wait now reference the live holder ids instead of the archived ones.

## Exact repair

- replaced \`${oldPromotionTaskId}\` with \`${newPromotionTaskId}\`
- replaced \`${oldSubsetTaskId}\` with \`${newSubsetTaskId}\`
- refreshed these surfaces through the task-tree safe write path:
  - \`${focusTaskId}.context.observations.linked_blocked_task_ids\`
  - \`${focusTaskId}.context.progress_review.evidence[]\`
  - \`${projectTaskId}.context.current_focus_proposal.reason\`
  - \`${primaryWaitTaskId}.blocker.condition\`

## Verification payload

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`);

console.log(JSON.stringify(result, null, 2));
