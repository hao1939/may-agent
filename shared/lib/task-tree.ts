/**
 * Task Tree Engine - pure-function library for project task trees.
 *
 * Design: projects/may-agent.app/docs/2a-design/task-tree-engine.md
 *
 * Compatibility note: older trees may use `status` and old values such as
 * accepted/ready/proposed/decomposed/superseded. Read paths normalize those
 * values. Mutation paths write canonical `state`.
 */

export const TASK_STATES = [
  "backlog",
  "active",
  "review",
  "done",
  "blocked",
] as const;
export type TaskState = (typeof TASK_STATES)[number];
export type TaskStatus = TaskState;

const VALID_STATES = new Set<string>(TASK_STATES);

export interface Blocker {
  condition: string;
  category?: string;
  owner?: string;
  resume_condition?: string;
}

export interface Knowledge {
  summary: string;
  evidence: string[];
  reusable_for?: string[];
  accepted_at?: string;
  accepted_by?: string;
  done_at?: string;
  done_by?: string;
}

export interface TaskNode {
  id: string;
  goal: string;
  state?: TaskState | string;
  status?: string;
  parent_id: string | null;
  children: string[];
  created_at: string;
  updated_at: string;
  depends_on?: string[];
  result?: string;
  evidence?: string[];
  summary?: string;
  reusable_for?: string[];
  accepted_at?: string;
  accepted_by?: string;
  done_at?: string;
  done_by?: string;
  resolution?: string;
  replaced_by?: string[];
  supersededBy?: string[];
  reason?: string;
  blocker?: Blocker;
  conflict_scope?: string;
  archived?: boolean;
  archive_summary?: string;
  priority?: number;
  feedback?: string[];
  [key: string]: unknown;
}

export interface TaskTree {
  version: number;
  project: string;
  updated_at: string;
  root_task_id: string;
  tasks: Record<string, TaskNode>;
  archive?: Record<string, Partial<TaskNode>>;
  [key: string]: unknown;
}

export type Severity = "error" | "warning" | "hint";

export interface Violation {
  code: string;
  nodeId?: string;
  message: string;
  severity: Severity;
}

export interface ReadinessResult {
  ready: boolean;
  reasons: string[];
}

export interface KanbanCard {
  nodeId: string;
  goal: string;
  lane: "backlog" | "in-progress" | "review" | "blocked" | "done";
  badges: string[];
}

export interface RollupHint {
  nodeId: string;
  hint: "all-done" | "child-review" | "child-blocked";
  detail: string;
}

export interface TreeStatus {
  project: string;
  updatedAt: string;
  totalNodes: number;
  archivedNodes: number;
  byStatus: Record<string, number>;
  byState: Record<string, number>;
  activeWork: string[];
  blockedWork: string[];
  reviewWork: string[];
  nextReady: string[];
  nextRunnable: string[];
  rollupHints: RollupHint[];
}

function now(): string {
  return new Date().toISOString();
}

function clone(tree: TaskTree): TaskTree {
  return JSON.parse(JSON.stringify(tree));
}

function getNode(tree: TaskTree, nodeId: string): TaskNode {
  const node = tree.tasks[nodeId];
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  return node;
}

function isLeaf(node: TaskNode): boolean {
  return (node.children ?? []).length === 0;
}

export function taskState(node: TaskNode): TaskState | string {
  const raw = node.state ?? node.status ?? "backlog";
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  return raw;
}

function rawState(node: TaskNode): string {
  return String(node.state ?? node.status ?? "");
}

function setTaskState(node: TaskNode, state: TaskState): void {
  node.state = state;
  delete node.status;
}

function markUpdated(tree: TaskTree, node: TaskNode): void {
  node.updated_at = now();
  tree.updated_at = node.updated_at;
}

function doneMetadata(knowledge: Knowledge): Record<string, unknown> {
  return {
    summary: knowledge.summary,
    evidence: knowledge.evidence || [],
    reusable_for: knowledge.reusable_for,
    done_at: knowledge.done_at || knowledge.accepted_at || now(),
    done_by: knowledge.done_by || knowledge.accepted_by || "owner",
    accepted_at: knowledge.accepted_at,
    accepted_by: knowledge.accepted_by,
  };
}

export function create(
  tree: TaskTree,
  parentId: string,
  task: {
    id: string;
    goal: string;
    depends_on?: string[];
    priority?: number;
    conflict_scope?: string;
  },
): TaskTree {
  const t = clone(tree);
  if (t.tasks[task.id]) throw new Error(`Node already exists: ${task.id}`);
  const parent = getNode(t, parentId);
  if (parent.children === undefined) parent.children = [];

  t.tasks[task.id] = {
    id: task.id,
    goal: task.goal,
    state: "backlog",
    parent_id: parentId,
    children: [],
    depends_on: task.depends_on || [],
    priority: task.priority,
    conflict_scope: task.conflict_scope,
    created_at: now(),
    updated_at: now(),
  };

  parent.children = [...new Set([...parent.children, task.id])];
  markUpdated(t, parent);
  return t;
}

export function decompose(
  tree: TaskTree,
  nodeId: string,
  children: Array<{
    id: string;
    goal: string;
    depends_on?: string[];
    priority?: number;
  }>,
): TaskTree {
  if (children.length === 0)
    throw new Error("decompose requires at least one child");
  let t = clone(tree);
  const node = getNode(t, nodeId);
  const state = taskState(node);
  if (state !== "backlog")
    throw new Error(`Can only decompose backlog nodes, got ${state}`);
  if ((node.children ?? []).length > 0)
    throw new Error(`Node ${nodeId} already has children`);

  setTaskState(node, "backlog");
  markUpdated(t, node);
  for (const child of children) {
    t = create(t, nodeId, child);
  }
  t.updated_at = now();
  return t;
}

export function accept(
  tree: TaskTree,
  nodeId: string,
  knowledge: Knowledge,
): TaskTree {
  return markDone(tree, nodeId, knowledge);
}

export function markDone(
  tree: TaskTree,
  nodeId: string,
  knowledge: Knowledge,
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  const state = taskState(node);
  if (!["review", "backlog", "done"].includes(state)) {
    throw new Error(
      `Can only mark review/backlog/done nodes done, got ${state}`,
    );
  }
  if (!knowledge.summary) throw new Error("Done knowledge must have a summary");

  setTaskState(node, "done");
  Object.assign(node, doneMetadata(knowledge));
  node.resolution = node.resolution || "completed";
  markUpdated(t, node);
  return t;
}

export function rework(
  tree: TaskTree,
  nodeId: string,
  reason: string,
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  const state = taskState(node);
  if (state !== "review")
    throw new Error(`Can only rework review nodes, got ${state}`);

  setTaskState(node, "backlog");
  node.reason = reason;
  delete (node as Record<string, unknown>).result;
  delete (node as Record<string, unknown>).evidence;
  markUpdated(t, node);
  return t;
}

export function supersede(
  tree: TaskTree,
  nodeId: string,
  reason: string,
  replacementIds: string[],
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (!reason) throw new Error("Supersede requires a reason");

  setTaskState(node, "done");
  node.resolution = "replaced";
  node.replaced_by = replacementIds;
  node.supersededBy = replacementIds;
  node.reason = reason;
  if (!node.summary)
    node.summary = `Replaced by ${replacementIds.join(", ") || "newer project understanding"}. ${reason}`;
  markUpdated(t, node);
  return t;
}

export function block(
  tree: TaskTree,
  nodeId: string,
  blocker: Blocker,
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (!blocker.condition) throw new Error("Blocker must have a condition");
  const state = taskState(node);
  if (state !== "backlog" && state !== "review") {
    throw new Error(`Can only block backlog or review nodes, got ${state}`);
  }

  setTaskState(node, "blocked");
  node.blocker = blocker;
  markUpdated(t, node);
  return t;
}

export function unblock(
  tree: TaskTree,
  nodeId: string,
  reason: string,
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  const state = taskState(node);
  if (state !== "blocked")
    throw new Error(`Can only unblock blocked nodes, got ${state}`);

  setTaskState(node, "backlog");
  delete (node as Record<string, unknown>).blocker;
  node.reason = reason;
  markUpdated(t, node);
  return t;
}

export function attachFeedback(
  tree: TaskTree,
  nodeId: string,
  feedbackRef: string,
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (!node.feedback) node.feedback = [];
  node.feedback.push(feedbackRef);
  markUpdated(t, node);
  return t;
}

export function claim(tree: TaskTree, nodeId: string): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  const state = taskState(node);
  if (state !== "backlog")
    throw new Error(`Can only claim backlog nodes, got ${state}`);
  if (!isLeaf(node)) throw new Error("Can only claim leaf nodes");

  const r = readiness(t, nodeId);
  if (!r.ready) throw new Error(`Node not ready: ${r.reasons.join("; ")}`);

  setTaskState(node, "active");
  markUpdated(t, node);
  return t;
}

export function submit(
  tree: TaskTree,
  nodeId: string,
  result: string,
  evidence: string[],
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  const state = taskState(node);
  if (state !== "active")
    throw new Error(`Can only submit active nodes, got ${state}`);
  if (!result) throw new Error("Submit requires a result");

  setTaskState(node, "review");
  node.result = result;
  node.evidence = evidence;
  markUpdated(t, node);
  return t;
}

export function archive(
  tree: TaskTree,
  nodeId: string,
  summary: string,
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  const state = taskState(node);
  if (state !== "done")
    throw new Error(`Can only archive done nodes, got ${state}`);
  if (!summary) throw new Error("Archive requires a knowledge summary");
  if (summary.length < 50)
    throw new Error(
      "Archive summary too short - must capture what was learned (min 50 chars)",
    );
  if (!node.summary && !node.evidence?.length) {
    throw new Error(
      "Cannot archive a node without summary or evidence - roll up knowledge first",
    );
  }

  if (!t.archive) t.archive = {};

  function archiveChildren(nid: string): void {
    const child = t.tasks[nid];
    if (!child) return;
    for (const cid of child.children ?? []) archiveChildren(cid);
    t.archive![nid] = {
      goal: child.goal,
      state: taskState(child),
      parent_id: child.parent_id,
      evidence: child.evidence,
      summary: child.summary,
    };
    delete t.tasks[nid];
  }
  for (const cid of [...(node.children ?? [])]) archiveChildren(cid);

  node.children = [];
  node.archived = true;
  node.archive_summary = summary;
  markUpdated(t, node);
  return t;
}

export function prune(
  tree: TaskTree,
  nodeId: string,
  reason: string,
): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  const state = taskState(node);
  if (state === "done") throw new Error(`Cannot prune done node ${nodeId}`);

  if (node.parent_id && t.tasks[node.parent_id]) {
    const parent = t.tasks[node.parent_id];
    parent.children = (parent.children ?? []).filter((c) => c !== nodeId);
    parent.reason = reason;
    parent.updated_at = now();
  }

  function removeSubtree(nid: string): void {
    const n = t.tasks[nid];
    if (!n) return;
    for (const cid of n.children ?? []) removeSubtree(cid);
    delete t.tasks[nid];
  }
  removeSubtree(nodeId);

  t.updated_at = now();
  return t;
}

export function readiness(tree: TaskTree, nodeId: string): ReadinessResult {
  const node = tree.tasks[nodeId];
  if (!node) return { ready: false, reasons: ["node not found"] };
  const state = taskState(node);
  if (state !== "backlog")
    return { ready: false, reasons: [`state is ${state}, not backlog`] };
  if (!isLeaf(node))
    return { ready: false, reasons: ["not a leaf (has children)"] };

  const reasons: string[] = [];
  for (const dep of node.depends_on || []) {
    const depNode = tree.tasks[dep];
    if (!depNode) {
      reasons.push(`depends_on '${dep}' not found`);
    } else if (taskState(depNode) !== "done") {
      reasons.push(`depends_on '${dep}' is ${taskState(depNode)}, not done`);
    }
  }

  if (node.conflict_scope) {
    for (const [tid, task] of Object.entries(tree.tasks)) {
      if (
        tid !== nodeId &&
        taskState(task) === "active" &&
        task.conflict_scope === node.conflict_scope
      ) {
        reasons.push(
          `conflict_scope '${node.conflict_scope}' has active task '${tid}'`,
        );
      }
    }
  }

  return { ready: reasons.length === 0, reasons };
}

export function next(tree: TaskTree): TaskNode[] {
  const runnable: TaskNode[] = [];
  for (const node of Object.values(tree.tasks)) {
    if (readiness(tree, node.id).ready) runnable.push(node);
  }
  return runnable.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
}

export function rollupHints(tree: TaskTree): RollupHint[] {
  const hints: RollupHint[] = [];
  for (const node of Object.values(tree.tasks)) {
    if ((node.children ?? []).length === 0) continue;
    const childStates = node.children
      .map((cid) => tree.tasks[cid] && taskState(tree.tasks[cid]))
      .filter(Boolean);
    if (childStates.length === 0) continue;

    if (childStates.every((s) => s === "done") && taskState(node) !== "done") {
      hints.push({
        nodeId: node.id,
        hint: "all-done",
        detail: `All ${childStates.length} children are done`,
      });
    } else if (childStates.some((s) => s === "review")) {
      const count = childStates.filter((s) => s === "review").length;
      hints.push({
        nodeId: node.id,
        hint: "child-review",
        detail: `${count} child(ren) in review`,
      });
    } else if (childStates.some((s) => s === "blocked")) {
      const count = childStates.filter((s) => s === "blocked").length;
      hints.push({
        nodeId: node.id,
        hint: "child-blocked",
        detail: `${count} child(ren) blocked`,
      });
    }
  }
  return hints;
}

export function kanban(tree: TaskTree): KanbanCard[] {
  const cards: KanbanCard[] = [];
  for (const node of Object.values(tree.tasks)) {
    if (!isLeaf(node)) continue;

    const badges: string[] = [];
    let lane: KanbanCard["lane"];
    const state = taskState(node);

    switch (state) {
      case "backlog": {
        lane = "backlog";
        const r = readiness(tree, node.id);
        if (r.ready) badges.push("runnable");
        else {
          if (r.reasons.some((reason) => reason.includes("depends_on")))
            badges.push("dependency-blocked");
          if (r.reasons.some((reason) => reason.includes("conflict_scope")))
            badges.push("conflict-blocked");
        }
        if (node.updated_at) {
          const age = Date.now() - new Date(node.updated_at).getTime();
          if (age > 7 * 86400_000) badges.push("stale");
        }
        break;
      }
      case "active":
        lane = "in-progress";
        break;
      case "review":
        lane = "review";
        break;
      case "blocked":
        lane = "blocked";
        break;
      case "done":
        lane = "done";
        break;
      default:
        continue;
    }

    cards.push({ nodeId: node.id, goal: node.goal, lane, badges });
  }
  return cards;
}

export function stale(
  tree: TaskTree,
  thresholds?: {
    backlogDays?: number;
    activeDays?: number;
    blockedDays?: number;
  },
): TaskNode[] {
  const backlogMs = (thresholds?.backlogDays ?? 7) * 86400_000;
  const activeMs = (thresholds?.activeDays ?? 1) * 86400_000;
  const blockedMs = (thresholds?.blockedDays ?? 14) * 86400_000;
  const nowMs = Date.now();
  const result: TaskNode[] = [];

  for (const node of Object.values(tree.tasks)) {
    if (!node.updated_at) continue;
    const age = nowMs - new Date(node.updated_at).getTime();
    const state = taskState(node);
    if (state === "backlog" && age > backlogMs) result.push(node);
    if (state === "active" && age > activeMs) result.push(node);
    if (state === "blocked" && age > blockedMs) result.push(node);
  }
  return result;
}

export function status(tree: TaskTree): TreeStatus {
  const byState: Record<string, number> = {};
  const activeWork: string[] = [];
  const blockedWork: string[] = [];
  const reviewWork: string[] = [];

  for (const node of Object.values(tree.tasks)) {
    const state = taskState(node);
    byState[state] = (byState[state] || 0) + 1;
    if (state === "active") activeWork.push(node.id);
    if (state === "blocked") blockedWork.push(node.id);
    if (state === "review") reviewWork.push(node.id);
  }

  const runnable = next(tree).map((n) => n.id);
  return {
    project: tree.project,
    updatedAt: tree.updated_at,
    totalNodes: Object.keys(tree.tasks).length,
    archivedNodes: Object.keys(tree.archive || {}).length,
    byStatus: byState,
    byState,
    activeWork,
    blockedWork,
    reviewWork,
    nextReady: runnable,
    nextRunnable: runnable,
    rollupHints: rollupHints(tree),
  };
}

export function check(tree: TaskTree): Violation[] {
  const violations: Violation[] = [];
  const allIds = new Set(Object.keys(tree.tasks));

  function err(code: string, msg: string, nodeId?: string): void {
    violations.push({ code, message: msg, severity: "error", nodeId });
  }
  function warn(code: string, msg: string, nodeId?: string): void {
    violations.push({ code, message: msg, severity: "warning", nodeId });
  }
  function hint(code: string, msg: string, nodeId?: string): void {
    violations.push({ code, message: msg, severity: "hint", nodeId });
  }

  if (!tree.root_task_id || !allIds.has(tree.root_task_id)) {
    err("missing-root", `Root task '${tree.root_task_id}' not found`);
  }

  const childrenSeen = new Set<string>();

  for (const [nodeId, node] of Object.entries(tree.tasks)) {
    const state = taskState(node);
    const raw = rawState(node);

    if (!VALID_STATES.has(state))
      err("invalid-state", `Invalid state '${raw || state}'`, nodeId);
    if (node.status !== undefined)
      warn(
        "legacy-status-field",
        "Task still uses legacy status field; migrate to state",
        nodeId,
      );
    if (
      ["no_work", "waiting", "unknown", "maybe-later", "pending", ""].includes(
        raw,
      )
    ) {
      err("ambiguous-state", `Ambiguous state '${raw}'`, nodeId);
    }
    if (
      ["ready", "proposed", "accepted", "superseded", "decomposed"].includes(
        raw,
      )
    ) {
      warn(
        "legacy-state-value",
        `Legacy state value '${raw}' should be migrated`,
        nodeId,
      );
    }

    for (const cid of node.children ?? []) {
      childrenSeen.add(cid);
      if (!allIds.has(cid))
        err("missing-child", `Child '${cid}' not found`, nodeId);
    }

    if (
      node.parent_id &&
      !allIds.has(node.parent_id) &&
      nodeId !== tree.root_task_id
    ) {
      err("missing-parent", `Parent '${node.parent_id}' not found`, nodeId);
    }

    for (const dep of node.depends_on || []) {
      if (!allIds.has(dep))
        err("missing-dep", `depends_on '${dep}' not found`, nodeId);
    }

    for (const rid of node.replaced_by || node.supersededBy || []) {
      if (rid && !allIds.has(rid))
        warn(
          "missing-replacement-ref",
          `replacement '${rid}' not found`,
          nodeId,
        );
    }

    if (state === "review") {
      if (!node.result)
        err("review-no-result", "Review node missing result", nodeId);
      if (
        !node.evidence?.length &&
        !(node.trace && typeof node.trace === "object")
      ) {
        err(
          "review-no-evidence",
          "Review node missing evidence or trace",
          nodeId,
        );
      }
    }

    if (state === "done") {
      if (!node.summary && !node.archive_summary && !node.resolution) {
        warn(
          "done-no-summary",
          "Done node missing summary, resolution, or archive_summary",
          nodeId,
        );
      }
      if (
        node.resolution === "replaced" &&
        !node.replaced_by?.length &&
        !node.supersededBy?.length
      ) {
        warn("replaced-no-target", "Replaced node missing replaced_by", nodeId);
      }
    }

    if (state === "blocked" && !node.blocker?.condition) {
      err(
        "blocked-no-condition",
        "Blocked node missing blocker.condition",
        nodeId,
      );
    }

    if (!node.goal) warn("no-goal", "Node missing goal", nodeId);
  }

  for (const nodeId of allIds) {
    if (nodeId === tree.root_task_id) continue;
    const parent = tree.tasks[nodeId].parent_id;
    if (!childrenSeen.has(nodeId) && (!parent || !allIds.has(parent))) {
      err(
        "orphan",
        "Node is not referenced as a child and has no valid parent",
        nodeId,
      );
    }
  }

  function getDepth(nodeId: string, seen = new Set<string>()): number {
    if (seen.has(nodeId) || !tree.tasks[nodeId]) return 0;
    seen.add(nodeId);
    const children = tree.tasks[nodeId].children ?? [];
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map((c) => getDepth(c, new Set(seen))));
  }
  const maxDepth = tree.root_task_id ? getDepth(tree.root_task_id) : 0;
  if (maxDepth > 5)
    warn("depth-exceeded", `Max depth ${maxDepth} exceeds limit of 5`);

  function hasDepCycle(nodeId: string, path: Set<string>): boolean {
    if (path.has(nodeId)) return true;
    path.add(nodeId);
    for (const dep of tree.tasks[nodeId]?.depends_on || []) {
      if (tree.tasks[dep] && hasDepCycle(dep, new Set(path))) {
        err(
          "circular-dependency",
          `Circular dependency involving '${dep}'`,
          nodeId,
        );
        return true;
      }
    }
    return false;
  }
  for (const nodeId of allIds) hasDepCycle(nodeId, new Set());

  for (const [nodeId, node] of Object.entries(tree.tasks)) {
    if ((node.children ?? []).length > 15) {
      warn(
        "width-exceeded",
        `${node.children.length} children exceeds limit of 15`,
        nodeId,
      );
    }
  }

  const visibleCount = Object.values(tree.tasks).filter(
    (n) => !n.archived,
  ).length;
  if (visibleCount > 50)
    warn("count-exceeded", `${visibleCount} visible nodes exceeds limit of 50`);

  for (const rollup of rollupHints(tree)) {
    hint("rollup", `${rollup.hint}: ${rollup.detail}`, rollup.nodeId);
  }

  for (const node of stale(tree)) {
    const age = Math.floor(
      (Date.now() - new Date(node.updated_at).getTime()) / 86400_000,
    );
    warn("stale", `${taskState(node)} node untouched for ${age} days`, node.id);
  }

  return violations;
}
