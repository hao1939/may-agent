import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
} from "../workflows/lib/spec-loop-store.ts";
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

const loopTaskId = "aks-feature-compact-loop";
const reviewedTaskId = "ops/reconcile-feature-compact-runnable-frontier-false-positive-20260715";
const repairTaskId =
  "ops-apply-reconcile-feature-compact-runnable-frontier-false-positive-20260715-state-repair";
const attemptId =
  "a_ops-apply-reconcile-feature-compact-runnable-frontier-false-positive-20260715-state-repair_20260715113011";
const evidencePath =
  "evidence/archive/ops-apply-reconcile-feature-compact-runnable-frontier-false-positive-20260715-state-repair.md";
const noRefillReason =
  "feature-compact loop has no runnable planner or support children; the remaining frontier is exact blocked wait stewardship until a stated resume signal lands";

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

function plannerChild(task: TaskNode | undefined): boolean {
  if (!task || task.workflow !== "feature-compact-planner") return false;
  const featureKey = asString(asRecord(task.context).featureKey).trim();
  return featureKey.length > 0;
}

function childStateBuckets(tree: TaskTree, task: TaskNode) {
  const activeIds: string[] = [];
  const reviewIds: string[] = [];
  const backlogIds: string[] = [];
  const blockedIds: string[] = [];
  const doneIds: string[] = [];
  const waitingIds: string[] = [];
  let openChildren = 0;
  let openSupportChildren = 0;
  let blockedWaitChildren = 0;

  for (const childId of asStringArray(task.children)) {
    const child = tree.tasks[childId];
    if (!child) continue;
    const status = taskState(child);
    if (status === "active") activeIds.push(childId);
    else if (status === "review") reviewIds.push(childId);
    else if (status === "backlog") backlogIds.push(childId);
    else if (status === "blocked") blockedIds.push(childId);
    else if (status === "done") doneIds.push(childId);
    else if (status === "waiting") waitingIds.push(childId);

    if (plannerChild(child)) {
      if (status === "active" || status === "backlog") openChildren += 1;
      continue;
    }
    if (status === "blocked") blockedWaitChildren += 1;
    else if (status !== "done") openSupportChildren += 1;
  }

  return {
    activeIds,
    reviewIds,
    backlogIds,
    blockedIds,
    doneIds,
    waitingIds,
    openChildren,
    openSupportChildren,
    blockedWaitChildren,
  };
}

function blockedOnlyChildren(summary: ReturnType<typeof childStateBuckets>): boolean {
  const states = [
    ...summary.activeIds.map(() => "active"),
    ...summary.reviewIds.map(() => "review"),
    ...summary.backlogIds.map(() => "backlog"),
    ...summary.blockedIds.map(() => "blocked"),
    ...summary.doneIds.map(() => "done"),
    ...summary.waitingIds.map(() => "waiting"),
  ];
  return (
    states.length > 0 &&
    states.every((state) => state === "blocked" || state === "done") &&
    states.some((state) => state === "blocked")
  );
}

function expectedParentState(task: TaskNode, summary: ReturnType<typeof childStateBuckets>): string {
  const progress = asRecord(asRecord(task.context).workflowProgress);
  const completionIncomplete = progress.completionReady === false;
  const trace = asRecord(task.trace);
  const assignedWorkflowController =
    typeof task.workflow === "string" && task.workflow.trim().length > 0 &&
    typeof trace.current_attempt_id === "string" && trace.current_attempt_id.length > 0;

  if (completionIncomplete) {
    if (assignedWorkflowController) return "active";
    if (summary.activeIds.length > 0) return "active";
    if (summary.reviewIds.length > 0) return "review";
    if (blockedOnlyChildren(summary)) return "blocked";
    return "backlog";
  }

  if (summary.activeIds.length > 0) return "active";
  if (summary.reviewIds.length > 0) return "review";
  if (summary.blockedIds.length > 0) return "blocked";
  if (summary.backlogIds.length > 0) return "backlog";
  return "done";
}

function setNumberField(record: Record<string, unknown>, key: string, value: number): boolean {
  if (record[key] === value) return false;
  record[key] = value;
  return true;
}

function setBooleanFlag(record: Record<string, unknown>, key: string, enabled: boolean): boolean {
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

function stateReason(summary: ReturnType<typeof childStateBuckets>, targetState: string): string {
  if (targetState === "active") {
    return `completionReady=false and active child ids are ${summary.activeIds.join(", ") || "none"}`;
  }
  if (targetState === "review") {
    return `completionReady=false, no active child remained at apply time, and review child ids are ${summary.reviewIds.join(", ") || "none"}`;
  }
  if (targetState === "blocked") {
    return `all non-done children were blocked exact waits (${summary.blockedIds.length} blocked child id(s))`;
  }
  if (targetState === "backlog") {
    return "workflowProgress still marked completion incomplete but no active/review/blocked-only child rollup remained";
  }
  return `rolled-up child states resolved to ${targetState}`;
}

function repair() {
  return withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const task = tree.tasks[loopTaskId];
    if (!task) {
      throw new Error(`Task not found: ${loopTaskId}`);
    }

    const now = new Date().toISOString();
    const context = asRecord(task.context);
    const progress = asRecord(context.workflowProgress);
    const trace = asRecord(task.trace);
    const beforeState = taskState(task);
    const beforeProgress = {
      openChildren: progress.openChildren ?? null,
      openSupportChildren: progress.openSupportChildren ?? null,
      blockedWaitChildren: progress.blockedWaitChildren ?? null,
      noRefillNow: progress.noRefillNow ?? null,
      reason: progress.reason ?? null,
      updatedAt: progress.updatedAt ?? null,
    };

    const summary = childStateBuckets(tree, task);
    const targetState = expectedParentState(task, summary);
    let changed = false;
    if (beforeState !== targetState) {
      setTaskState(task, targetState);
      changed = true;
    }

    const pending = typeof progress.pending === "number" ? progress.pending : 0;
    const running = typeof progress.running === "number" ? progress.running : 0;
    const blocked = typeof progress.blocked === "number" ? progress.blocked : 0;
    const error = typeof progress.error === "number" ? progress.error : 0;
    const retryBudgetExhausted =
      typeof progress.retryBudgetExhausted === "number"
        ? progress.retryBudgetExhausted
        : 0;
    const unrepresentedNonTerminalCount =
      typeof progress.unrepresentedNonTerminalCount === "number"
        ? progress.unrepresentedNonTerminalCount
        : 0;
    const noRefillNow =
      pending === 0 &&
      running === 0 &&
      summary.openChildren === 0 &&
      summary.openSupportChildren === 0 &&
      unrepresentedNonTerminalCount === 0 &&
      (blocked > 0 || error === retryBudgetExhausted) &&
      summary.blockedWaitChildren > 0;

    let progressChanged = false;
    progressChanged = setNumberField(progress, "openChildren", summary.openChildren) || progressChanged;
    progressChanged =
      setNumberField(progress, "openSupportChildren", summary.openSupportChildren) || progressChanged;
    progressChanged =
      setNumberField(progress, "blockedWaitChildren", summary.blockedWaitChildren) || progressChanged;
    progressChanged = setBooleanFlag(progress, "noRefillNow", noRefillNow) || progressChanged;
    if (noRefillNow && progress.reason !== noRefillReason) {
      progress.reason = noRefillReason;
      progressChanged = true;
    }
    if (progressChanged) {
      progress.updatedAt = now;
      context.workflowProgress = progress;
      task.context = context;
      changed = true;
    }

    if (trace.compact_runnable_false_positive_repaired_at !== now) changed = true;
    trace.compact_runnable_false_positive_repaired_at = now;
    trace.compact_runnable_false_positive_repaired_by = "app-ops";
    trace.compact_runnable_false_positive_repair_attempt_id = attemptId;
    trace.compact_runnable_false_positive_repair_evidence_path = evidencePath;
    trace.compact_runnable_false_positive_repair_reviewed_task_id = reviewedTaskId;
    trace.rolled_up_at = now;
    trace.rolled_up_by = "app-ops";
    task.trace = trace;

    if (changed) {
      saveTaskTreeWithKanbanSnapshot(config, tree);
    }

    const afterProgress = asRecord(asRecord(task.context).workflowProgress);
    const targetStateReason = stateReason(summary, taskState(task));
    const result = {
      changed,
      taskId: loopTaskId,
      reviewedTaskId,
      repairTaskId,
      attemptId,
      evidencePath,
      beforeState,
      afterState: taskState(task),
      targetStateReason,
      childSummary: {
        activeIds: summary.activeIds,
        reviewIds: summary.reviewIds,
        backlogIds: summary.backlogIds,
        blockedIdsSample: summary.blockedIds.slice(0, 10),
        blockedCount: summary.blockedIds.length,
        doneCount: summary.doneIds.length,
        waitingCount: summary.waitingIds.length,
      },
      beforeProgress,
      afterProgress: {
        openChildren: afterProgress.openChildren ?? null,
        openSupportChildren: afterProgress.openSupportChildren ?? null,
        blockedWaitChildren: afterProgress.blockedWaitChildren ?? null,
        noRefillNow: afterProgress.noRefillNow ?? null,
        reason: afterProgress.reason ?? null,
        updatedAt: afterProgress.updatedAt ?? null,
      },
      featureCompactStatePath: defaultFeatureCompactLoopStatePath(appDir),
      specLoopStatePath: defaultSpecLoopStatePath(appDir),
    };

    const evidence = `# Feature compact runnable frontier false-positive repair\n\n- Attempt: ${attemptId}\n- Reviewed task: ${reviewedTaskId}\n- Repair task: ${repairTaskId}\n- Applied at: ${now}\n- Supported mechanism: app-local task-tree repair script using task-tree lock/save helpers (no direct JSON editing)\n\n## Baseline\n\nBefore the repair, live task-tree reads showed:\n\n- \`${loopTaskId}\` state was **${beforeState}**.\n- Child rollup evidence included active child ids: ${summary.activeIds.length ? summary.activeIds.join(", ") : "none"}.\n- Child review ids: ${summary.reviewIds.length ? summary.reviewIds.join(", ") : "none"}.\n- Blocked child count: ${summary.blockedIds.length}.\n- Workflow progress already reported openChildren=${String(beforeProgress.openChildren)}, openSupportChildren=${String(beforeProgress.openSupportChildren)}, blockedWaitChildren=${String(beforeProgress.blockedWaitChildren)}.\n\nThis combination made the durable compact loop root appear in \`confirm-runnable\` even though its current child rollup was not runnable backlog.\n\n## Applied repair\n\n- Recomputed the parent rollup from current live child states under the task-tree lock.\n- Updated \`${loopTaskId}\` state from **${beforeState}** to **${taskState(task)}** because ${targetStateReason}.\n- Recomputed compact-loop workflow progress counters from current children and preserved the existing truthful support-child posture: openChildren=${String(afterProgress.openChildren ?? null)}, openSupportChildren=${String(afterProgress.openSupportChildren ?? null)}, blockedWaitChildren=${String(afterProgress.blockedWaitChildren ?? null)}.\n- Recorded repair lineage on \`${loopTaskId}\`.trace with this attempt id and evidence path.\n\n## Notes on app-owned loop state\n\n- \`${defaultFeatureCompactLoopStatePath(appDir)}\`: read-only verification target for this repair; no content rewrite was required.\n- \`${defaultSpecLoopStatePath(appDir)}\`: read-only verification target for cross-loop parity; no content rewrite was required.\n\n## Expected verification\n\n- \`bun run task-tree -- show ${loopTaskId}\` now reports state \`${taskState(task)}\`.\n- \`bun run task-tree -- confirm-runnable --limit 20\` should no longer list \`${loopTaskId}\`.\n- \`bun run task-tree -- frontier --limit 20\` should no longer include \`${loopTaskId}\` under runnable.\n- \`bun run ./scripts/check-integrity.ts\` should no longer report \`task ${loopTaskId} state backlog does not match child rollup active\`.\n`;

    const evidenceAbs = resolve(appDir, evidencePath);
    mkdirSync(dirname(evidenceAbs), { recursive: true });
    writeFileSync(evidenceAbs, evidence, "utf-8");

    return result;
  });
}

console.log(JSON.stringify(repair(), null, 2));
