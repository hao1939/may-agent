import { resolve } from "node:path";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const taskId =
  "focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711";
const attemptId =
  "a_ops-apply-reconcile-rp-cluster-lifecycle-unpublished-repo-state-20260711_20260711214337";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-rp-cluster-lifecycle-unpublished-repo-state-20260711.md";
const checkedAt = new Date().toISOString();

const staleEvidence =
  "2026-07-11 git status --short shows unpublished repo-local edits only in features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-create-get-delete.ts and .test.ts, so the immediate repo-local publication surface is still bounded and does not require new live work from this focus review.";
const repairedEvidence =
  "2026-07-11 repo-state reconciliation plus live git verification show local dev remains ahead of origin/dev by checkpoint commit a096a03178cd817424f64f29f851466ef803a0b9 carrying the rp-cluster-lifecycle no-live carrier slice (rp-available-agent-pool-versions, rp-operation-status-polling, and create-get-delete carrier/gate tightening), while git push --dry-run origin dev still fails because git-credential-azdevops cannot invoke az in this runtime; see evidence/archive/ops-apply-reconcile-rp-cluster-lifecycle-unpublished-repo-state-20260711.md.";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

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

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const task = tree.tasks[taskId];
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const context = asRecord(task.context);
  const progressReview = asRecord(context.progress_review);
  const beforeEvidence = asStringArray(progressReview.evidence);

  let changed = false;
  const afterEvidence = beforeEvidence.map((entry) => {
    if (entry === staleEvidence) {
      changed = true;
      return repairedEvidence;
    }
    return entry;
  });

  if (!changed && !afterEvidence.includes(repairedEvidence)) {
    afterEvidence.push(repairedEvidence);
    changed = true;
  }

  if (!changed) {
    return {
      taskId,
      attemptId,
      checkedAt,
      changed,
      beforeEvidence,
      afterEvidence,
      progressLastReviewedAt: progressReview.last_reviewed_at ?? null,
      evidencePath,
      trace: task.trace ?? null,
    };
  }

  progressReview.evidence = afterEvidence;
  progressReview.last_reviewed_at = checkedAt;
  context.progress_review = progressReview;
  task.context = context;
  task.trace = {
    ...asRecord(task.trace),
    rp_cluster_lifecycle_unpublished_repo_state_repaired_at: checkedAt,
    rp_cluster_lifecycle_unpublished_repo_state_repaired_by: "app-ops-script",
    rp_cluster_lifecycle_unpublished_repo_state_repair_attempt_id: attemptId,
    rp_cluster_lifecycle_unpublished_repo_state_repair_evidence_path: evidencePath,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    taskId,
    attemptId,
    checkedAt,
    changed,
    beforeEvidence,
    afterEvidence,
    progressLastReviewedAt: progressReview.last_reviewed_at,
    evidencePath,
    trace: task.trace,
  };
});

console.log(JSON.stringify(result, null, 2));
