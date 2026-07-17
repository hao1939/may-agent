import { resolve } from "node:path";
import { loadProjectReadModel } from "@may-agent/sdk";
import {
  saveTaskTreeWithKanbanSnapshot,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { syncProjectReadout } from "../workflows/lib/project-readout-sync.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type Snapshot = {
  frontier: {
    active: string[];
    review: string[];
    waiting: string[];
    runnable: string[];
    blockedLeafCount: number;
  };
  rootReadout: JsonRecord;
  proposal: JsonRecord;
  runtimeCurrentState: JsonRecord;
  runtimeCurrentFocus: JsonRecord;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function nodeState(task: TaskNode | undefined): string {
  return String(task?.status ?? task?.state ?? "backlog");
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const repairTaskId = "ops/repair-project-root-frontier-review-parity-20260716";
const evidencePath =
  "evidence/archive/ops-repair-project-root-frontier-review-parity-20260716.md";
const appliedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

function liveFrontierExcludingSelf() {
  const summary = summarizeTaskTree(config);
  return {
    active: asStringArray(summary.frontier.active).filter((id) => id !== repairTaskId),
    review: asStringArray(summary.frontier.review).filter((id) => id !== repairTaskId),
    waiting: asStringArray(summary.frontier.waiting).filter((id) => id !== repairTaskId),
    runnable: asStringArray(summary.frontier.runnable).filter((id) => id !== repairTaskId),
    blockedLeafCount: Number(summary.counts.blocked ?? asStringArray(summary.frontier.blocked).length),
  };
}

function snapshot(): Snapshot {
  const runtime = asRecord(loadProjectReadModel(appDir));
  const currentState = asRecord(runtime.currentState);
  const currentFocus = asRecord(runtime.currentFocus);
  const frontier = liveFrontierExcludingSelf();
  const tree = readTaskTree(config);
  const projectTask = tree.tasks.project;
  const projectContext = asRecord(projectTask?.context);
  return {
    frontier,
    rootReadout: asRecord(projectContext.current_root_readout),
    proposal: asRecord(projectContext.current_focus_proposal),
    runtimeCurrentState: currentState,
    runtimeCurrentFocus: currentFocus,
  };
}

const before = snapshot();
const frontierAtApply = before.frontier;

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks.project;
  const repairTask = tree.tasks[repairTaskId];
  if (!projectTask) throw new Error("Task not found: project");
  if (!repairTask) throw new Error(`Task not found: ${repairTaskId}`);

  const projectContext = asRecord(projectTask.context);
  const currentRootReadout = asRecord(projectContext.current_root_readout);
  const currentFocusProposal = asRecord(projectContext.current_focus_proposal);
  const proposalContext = asRecord(currentFocusProposal.context);
  const frontier = frontierAtApply;

  const projectChildren = Array.isArray(projectTask.children)
    ? projectTask.children.filter(
        (child): child is string => typeof child === "string" && child.trim().length > 0,
      )
    : [];
  const topLevelBlockedIds = projectChildren
    .filter((id) => /(^ops\/wait-|^wait-)/.test(id) && nodeState(tree.tasks[id]) === "blocked")
    .sort((a, b) => a.localeCompare(b));

  const blockedLineageIds = unique([
    ...asStringArray(proposalContext.blocked_task_ids),
    ...asStringArray(proposalContext.linked_blocked_task_ids),
    ...asStringArray(currentRootReadout.top_level_blocked_ids),
    ...topLevelBlockedIds,
  ]).filter((id) => nodeState(tree.tasks[id]) === "blocked");

  proposalContext.active_task_ids = frontier.active;
  proposalContext.review_task_ids = frontier.review;
  proposalContext.waiting_task_ids = frontier.waiting;
  proposalContext.runnable_task_ids = frontier.runnable;
  proposalContext.blocked_task_ids = blockedLineageIds;
  proposalContext.linked_blocked_task_ids = blockedLineageIds;
  proposalContext.proposed_task_ids = unique([
    ...frontier.active,
    ...frontier.review,
    ...frontier.waiting,
    ...frontier.runnable,
    ...blockedLineageIds,
  ]);
  currentFocusProposal.context = proposalContext;
  currentFocusProposal.evidence_path = evidencePath;

  currentRootReadout.updated_at = appliedAt;
  currentRootReadout.excludes_task_id = repairTaskId;
  currentRootReadout.active_task_ids_excluding_self = frontier.active;
  currentRootReadout.active_task_ids_including_self = unique([
    ...frontier.active,
    ...(nodeState(repairTask) === "active" ? [repairTaskId] : []),
  ]);
  currentRootReadout.review_task_ids = frontier.review;
  currentRootReadout.waiting_task_ids = frontier.waiting;
  currentRootReadout.runnable_task_ids = frontier.runnable;
  currentRootReadout.blocked_leaf_count = frontier.blockedLeafCount;
  currentRootReadout.top_level_blocked_ids = topLevelBlockedIds;
  currentRootReadout.top_level_blocked_root_ids = topLevelBlockedIds;
  currentRootReadout.root_frontier_readout_repaired_at = appliedAt;
  currentRootReadout.root_frontier_readout_repaired_by = worker;
  currentRootReadout.root_frontier_readout_repair_evidence_path = evidencePath;

  projectContext.current_root_readout = currentRootReadout;
  projectContext.current_focus_proposal = currentFocusProposal;
  projectTask.context = projectContext;
  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const syncResult = syncProjectReadout(config, appliedAt);
const after = snapshot();

console.log(
  JSON.stringify(
    {
      appliedAt,
      repairTaskId,
      evidencePath,
      syncResult,
      before,
      after,
    },
    null,
    2,
  ),
);
