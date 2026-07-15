import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { exactBlockedWaitStewardshipProgress } from "../workflows/lib/durable-loop-wait-stewardship.ts";
import { defaultFeatureCompactLoopStatePath } from "../workflows/lib/feature-compact-loop-store.ts";
import { defaultSpecLoopStatePath } from "../workflows/lib/spec-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  setTaskState,
  taskState,
  withTreeLock,
  type TaskNode,
  type TaskTree,
} from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const loopTaskId = "aks-spec-verification-loop";
const reviewedTaskId =
  "ops/reconcile-spec-loop-runnable-frontier-false-positive-20260715";
const repairTaskId =
  "ops-apply-reconcile-spec-loop-runnable-frontier-false-positive-20260715-state-repair";
const attemptId =
  "a_ops-apply-reconcile-spec-loop-runnable-frontier-false-positive-20260715-state-repair_20260715191000";
const outputPath =
  ".state/ops/reconcile-spec-loop-runnable-frontier-false-positive-20260715.md";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item))
    : [];
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function setNumberField(record: Record<string, unknown>, key: string, value: number): boolean {
  if (record[key] === value) return false;
  record[key] = value;
  return true;
}

function setStringField(record: Record<string, unknown>, key: string, value: string): boolean {
  if (record[key] === value) return false;
  record[key] = value;
  return true;
}

function setBooleanField(record: Record<string, unknown>, key: string, enabled: boolean): boolean {
  const current = record[key] === true;
  if (enabled) {
    if (current) return false;
    record[key] = true;
    return true;
  }
  if (!(key in record)) return false;
  delete record[key];
  return true;
}

function specVerifierChild(task: TaskNode | undefined): boolean {
  return asString(task?.workflow).trim() === "single-spec-verifier";
}

function childStateBuckets(tree: TaskTree, task: TaskNode) {
  const activeIds: string[] = [];
  const reviewIds: string[] = [];
  const waitingIds: string[] = [];
  const backlogIds: string[] = [];
  const blockedIds: string[] = [];
  const doneIds: string[] = [];
  let openSpecVerifierChildren = 0;
  let openFollowups = 0;

  for (const childId of asStringArray(task.children)) {
    const child = tree.tasks[childId];
    if (!child) continue;
    const status = taskState(child);
    if (status === "active") activeIds.push(childId);
    else if (status === "review") reviewIds.push(childId);
    else if (status === "waiting") waitingIds.push(childId);
    else if (status === "backlog") backlogIds.push(childId);
    else if (status === "blocked") blockedIds.push(childId);
    else if (status === "done") doneIds.push(childId);

    if (["active", "review", "waiting", "backlog"].includes(status)) {
      if (specVerifierChild(child)) openSpecVerifierChildren += 1;
      else openFollowups += 1;
    }
  }

  return {
    activeIds,
    reviewIds,
    waitingIds,
    backlogIds,
    blockedIds,
    doneIds,
    openChildren:
      activeIds.length + reviewIds.length + waitingIds.length + backlogIds.length,
    openSpecVerifierChildren,
    openFollowups,
    blockedWaitChildren: blockedIds.length,
  };
}

function inferredDispatchHold(task: TaskNode, progress: Record<string, unknown>): string {
  const explicit = asString(progress.dispatchHold).trim();
  if (explicit) return explicit;
  const reason = asString(progress.reason).trim();
  if (reason.startsWith("spec-loop live dispatch held because ")) return reason;
  const activeGithubRuns = numberField(progress, "activeGithubRuns") ?? 0;
  const githubActiveRunLimit =
    numberField(progress, "githubActiveRunLimit") ??
    numberField(asRecord(task.context), "githubActiveRunLimit") ??
    0;
  const dispatchablePending = numberField(progress, "dispatchablePending") ?? 0;
  const branch = asString(asRecord(task.context).branch).trim() || "dev";
  if (
    githubActiveRunLimit > 0 &&
    activeGithubRuns >= githubActiveRunLimit &&
    dispatchablePending === 0
  ) {
    return `spec-loop live dispatch held because ${activeGithubRuns} Azure DevOps pipeline run(s) are already in progress on ${branch}; limit=${githubActiveRunLimit}`;
  }
  return "";
}

function expectedParentState(progress: Record<string, unknown>, summary: ReturnType<typeof childStateBuckets>): string {
  if (exactBlockedWaitStewardshipProgress(progress)) return "blocked";
  if (summary.activeIds.length > 0) return "active";
  if (summary.reviewIds.length > 0) return "review";
  return "backlog";
}

function stateReason(targetState: string, summary: ReturnType<typeof childStateBuckets>, dispatchHold: string): string {
  if (targetState === "active") {
    return `current child rollup still has active verifier/follow-up leaves (${summary.activeIds.join(", ")}) while dispatch hold only blocks new refill`;
  }
  if (targetState === "review") {
    return `no active child remained and current child rollup is review-only (${summary.reviewIds.join(", ")})`;
  }
  if (targetState === "blocked") {
    return dispatchHold
      ? `dispatch hold remains truthful and the remaining represented frontier is exact blocked wait stewardship (${summary.blockedWaitChildren} blocked child wait(s))`
      : `remaining frontier is exact blocked wait stewardship (${summary.blockedWaitChildren} blocked child wait(s))`;
  }
  return `no active/review child remained; fallback backlog state is the best live controller posture`;
}

function repair() {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[loopTaskId];
    if (!task) throw new Error(`Task not found: ${loopTaskId}`);

    const now = new Date().toISOString();
    const context = asRecord(task.context);
    const progress = asRecord(context.workflowProgress);
    const trace = asRecord(task.trace);
    const beforeState = taskState(task);
    const summary = childStateBuckets(tree, task);
    const dispatchHold = inferredDispatchHold(task, progress);
    const beforeProgress = {
      dispatchHeld: progress.dispatchHeld ?? null,
      dispatchHold: progress.dispatchHold ?? null,
      reason: progress.reason ?? null,
      dispatchablePending: progress.dispatchablePending ?? null,
      activeGithubRuns: progress.activeGithubRuns ?? null,
      githubActiveRunLimit: progress.githubActiveRunLimit ?? null,
      openChildren: progress.openChildren ?? null,
      activeChildren: progress.activeChildren ?? null,
      reviewChildren: progress.reviewChildren ?? null,
      waitingChildren: progress.waitingChildren ?? null,
      backlogChildren: progress.backlogChildren ?? null,
      openSpecVerifierChildren: progress.openSpecVerifierChildren ?? null,
      openFollowups: progress.openFollowups ?? null,
      blockedWaitChildren: progress.blockedWaitChildren ?? null,
      updatedAt: progress.updatedAt ?? null,
    };

    let changed = false;
    let progressChanged = false;
    progressChanged = setNumberField(progress, "openChildren", summary.openChildren) || progressChanged;
    progressChanged = setNumberField(progress, "activeChildren", summary.activeIds.length) || progressChanged;
    progressChanged = setNumberField(progress, "reviewChildren", summary.reviewIds.length) || progressChanged;
    progressChanged = setNumberField(progress, "waitingChildren", summary.waitingIds.length) || progressChanged;
    progressChanged = setNumberField(progress, "backlogChildren", summary.backlogIds.length) || progressChanged;
    progressChanged =
      setNumberField(progress, "openSpecVerifierChildren", summary.openSpecVerifierChildren) || progressChanged;
    progressChanged = setNumberField(progress, "openFollowups", summary.openFollowups) || progressChanged;
    progressChanged =
      setNumberField(progress, "blockedWaitChildren", summary.blockedWaitChildren) || progressChanged;

    if (dispatchHold) {
      progressChanged = setBooleanField(progress, "dispatchHeld", true) || progressChanged;
      progressChanged = setStringField(progress, "dispatchHold", dispatchHold) || progressChanged;
      progressChanged = setStringField(progress, "reason", dispatchHold) || progressChanged;
    }

    if (progressChanged) {
      progress.updatedAt = now;
      context.workflowProgress = progress;
      task.context = context;
      changed = true;
    }

    const targetState = expectedParentState(progress, summary);
    if (beforeState !== targetState) {
      setTaskState(task, targetState);
      changed = true;
    }
    if (targetState === "active" || targetState === "review" || targetState === "backlog") {
      if (task.blocker !== undefined) {
        task.blocker = undefined;
        changed = true;
      }
    }

    trace.spec_runnable_false_positive_repaired_at = now;
    trace.spec_runnable_false_positive_repaired_by = "app-ops";
    trace.spec_runnable_false_positive_repair_attempt_id = attemptId;
    trace.spec_runnable_false_positive_repair_output_path = outputPath;
    trace.spec_runnable_false_positive_repair_reviewed_task_id = reviewedTaskId;
    trace.spec_runnable_false_positive_repair_task_id = repairTaskId;
    trace.rolled_up_at = now;
    trace.rolled_up_by = "app-ops";
    task.trace = trace;
    changed = true;

    if (changed) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }

    const afterProgress = asRecord(asRecord(task.context).workflowProgress);
    const targetStateReason = stateReason(targetState, summary, dispatchHold);
    const report = `# Spec-loop runnable frontier false-positive repair

- Attempt: ${attemptId}
- Reviewed task: ${reviewedTaskId}
- Repair task: ${repairTaskId}
- Applied at: ${now}
- Supported mechanism: app-local task-tree repair script using task-tree lock/save helpers (no direct JSON editing)

## Baseline

Before the repair, live task-tree reads showed:

- \`${loopTaskId}\` state was **${beforeState}**.
- Active child ids: ${summary.activeIds.length ? summary.activeIds.map((id) => `\`${id}\``).join(", ") : "none"}.
- Review child ids: ${summary.reviewIds.length ? summary.reviewIds.map((id) => `\`${id}\``).join(", ") : "none"}.
- Blocked child count: ${summary.blockedIds.length}.
- workflowProgress.dispatchHeld before repair: ${String(beforeProgress.dispatchHeld)}.
- workflowProgress.dispatchHold before repair: ${JSON.stringify(beforeProgress.dispatchHold)}.
- workflowProgress.reason before repair: ${JSON.stringify(beforeProgress.reason)}.
- workflowProgress.dispatchablePending before repair: ${String(beforeProgress.dispatchablePending)}.
- workflowProgress.activeGithubRuns/githubActiveRunLimit before repair: ${String(beforeProgress.activeGithubRuns)}/${String(beforeProgress.githubActiveRunLimit)}.

This combination let planner-facing reads advertise \`${loopTaskId}\` in \`confirm-runnable\` / runnable frontier even though live child work was still active and the loop was under a truthful Azure DevOps dispatch hold.

## Root cause

- The live loop root had been reopened into a runnable-looking parent state while its child rollup still included active verifier leaves.
- The app/runtime repair path also left the controller-visible dispatch-hold fields absent from the current task snapshot, even though the preserved reason text and ADO run headroom still proved the hold condition.
- Because planner-facing runnable reads key off the live task-tree state plus controller workflowProgress, the missing dispatch-hold fields and stale parent state combined into a false runnable promotion.

## Applied repair

- Recomputed current child rollup counters from the live task tree.
- Reconstructed the controller-visible dispatch hold from live workflowProgress reason + ADO headroom fields.
- Updated \`${loopTaskId}\` from **${beforeState}** to **${taskState(task)}** because ${targetStateReason}.
- Preserved the loop as incomplete work without reopening the parent as runnable backlog.

## After repair

- workflowProgress.dispatchHeld: ${String(afterProgress.dispatchHeld ?? null)}.
- workflowProgress.dispatchHold: ${JSON.stringify(afterProgress.dispatchHold ?? null)}.
- workflowProgress.reason: ${JSON.stringify(afterProgress.reason ?? null)}.
- workflowProgress.openChildren/activeChildren/reviewChildren: ${String(afterProgress.openChildren ?? null)}/${String(afterProgress.activeChildren ?? null)}/${String(afterProgress.reviewChildren ?? null)}.
- workflowProgress.blockedWaitChildren: ${String(afterProgress.blockedWaitChildren ?? null)}.
- output written to: \`${outputPath}\`.

## Cross-check paths

- Spec-loop state path (read-only for this repair): \`${defaultSpecLoopStatePath(appDir)}\`.
- Feature-compact state path (read-only parity reference): \`${defaultFeatureCompactLoopStatePath(appDir)}\`.

## Expected verification

- \`bun run task-tree show ${loopTaskId}\` now reports state \`${taskState(task)}\`.
- \`bun run task-tree frontier\` no longer includes \`${loopTaskId}\` under runnable.
- \`bun run task-tree confirm-runnable --limit 20\` no longer promotes \`${loopTaskId}\`.
`;

    const outputAbs = resolve(appDir, outputPath);
    mkdirSync(dirname(outputAbs), { recursive: true });
    writeFileSync(outputAbs, report, "utf-8");

    return {
      changed,
      taskId: loopTaskId,
      reviewedTaskId,
      repairTaskId,
      attemptId,
      outputPath,
      beforeState,
      afterState: taskState(task),
      targetStateReason,
      childSummary: {
        activeIds: summary.activeIds,
        reviewIds: summary.reviewIds,
        waitingIds: summary.waitingIds,
        backlogIds: summary.backlogIds,
        blockedIdsSample: summary.blockedIds.slice(0, 10),
        blockedCount: summary.blockedIds.length,
        doneCount: summary.doneIds.length,
      },
      beforeProgress,
      afterProgress: {
        dispatchHeld: afterProgress.dispatchHeld ?? null,
        dispatchHold: afterProgress.dispatchHold ?? null,
        reason: afterProgress.reason ?? null,
        openChildren: afterProgress.openChildren ?? null,
        activeChildren: afterProgress.activeChildren ?? null,
        reviewChildren: afterProgress.reviewChildren ?? null,
        waitingChildren: afterProgress.waitingChildren ?? null,
        backlogChildren: afterProgress.backlogChildren ?? null,
        openSpecVerifierChildren: afterProgress.openSpecVerifierChildren ?? null,
        openFollowups: afterProgress.openFollowups ?? null,
        blockedWaitChildren: afterProgress.blockedWaitChildren ?? null,
        updatedAt: afterProgress.updatedAt ?? null,
      },
    };
  });
}

console.log(JSON.stringify(repair(), null, 2));
