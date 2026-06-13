/**
 * Task Tree Engine — pure-function library for project task trees.
 *
 * Design: projects/may-agent.app/docs/2a-design/task-tree-engine.md
 *
 * All mutations are pure: tree in → new tree out. Callers own I/O.
 * The tool enforces structure. The planner makes judgments.
 * The worker claims leaves and submits evidence.
 */

// ── Types ─────────────────────────────────────────────────────────────

export const TASK_STATUSES = ["backlog", "active", "review", "accepted", "blocked", "superseded", "decomposed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Blocker {
  condition: string;
  category: string;
}

export interface Knowledge {
  summary: string;
  evidence: string[];
  reusable_for?: string[];
  accepted_at?: string;
  accepted_by?: string;
}

export interface TaskNode {
  id: string;
  goal: string;
  status: TaskStatus;
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
  hint: "all-accepted" | "child-blocked";
  detail: string;
}

export interface TreeStatus {
  project: string;
  updatedAt: string;
  totalNodes: number;
  archivedNodes: number;
  byStatus: Record<string, number>;
  activeWork: string[];
  blockedWork: string[];
  reviewWork: string[];
  nextReady: string[];
  rollupHints: RollupHint[];
}

// ── Helpers ───────────────────────────────────────────────────────────

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
  return node.children.length === 0;
}

const TERMINAL: Set<TaskStatus> = new Set(["accepted", "superseded"]);

// ── Planner Mutations ─────────────────────────────────────────────────

export function create(
  tree: TaskTree,
  parentId: string,
  task: { id: string; goal: string; depends_on?: string[]; priority?: number; conflict_scope?: string },
): TaskTree {
  const t = clone(tree);
  if (t.tasks[task.id]) throw new Error(`Node already exists: ${task.id}`);
  const parent = getNode(t, parentId);

  // Check parent can accept children before adding
  const allowedParentStatuses: TaskStatus[] = ["decomposed"];
  if (parent.status === "accepted" && parent.archived) {
    // archived accepted parent can receive new children (reopen)
  } else if (!allowedParentStatuses.includes(parent.status)) {
    throw new Error(
      `Cannot add child to '${parentId}' with status '${parent.status}'. ` +
      (parent.status === "backlog" ? "Decompose it first." : "Parent must be decomposed.")
    );
  }

  t.tasks[task.id] = {
    id: task.id,
    goal: task.goal,
    status: "backlog",
    parent_id: parentId,
    children: [],
    depends_on: task.depends_on || [],
    priority: task.priority,
    conflict_scope: task.conflict_scope,
    created_at: now(),
    updated_at: now(),
  };

  parent.children.push(task.id);
  parent.updated_at = now();
  t.updated_at = now();
  return t;
}

export function decompose(
  tree: TaskTree,
  nodeId: string,
  children: Array<{ id: string; goal: string; depends_on?: string[]; priority?: number }>,
): TaskTree {
  if (children.length === 0) throw new Error("decompose requires at least one child");
  let t = clone(tree);
  const node = getNode(t, nodeId);
  if (node.status !== "backlog") throw new Error(`Can only decompose backlog nodes, got ${node.status}`);
  if (node.children.length > 0) throw new Error(`Node ${nodeId} already has children`);

  node.status = "decomposed";
  node.updated_at = now();

  for (const child of children) {
    t = create(t, nodeId, child);
  }
  t.updated_at = now();
  return t;
}

export function accept(tree: TaskTree, nodeId: string, knowledge: Knowledge): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  // Accept from review (normal leaf path) or decomposed (parent rollup after
  // all children accepted — planner summarizes the branch as knowledge).
  if (node.status !== "review" && node.status !== "decomposed") {
    throw new Error(`Can only accept review or decomposed nodes, got ${node.status}`);
  }
  if (!knowledge.summary) throw new Error("Accepted knowledge must have a summary");

  node.status = "accepted";
  node.summary = knowledge.summary;
  node.evidence = knowledge.evidence || [];
  node.reusable_for = knowledge.reusable_for;
  node.accepted_at = knowledge.accepted_at || now();
  node.accepted_by = knowledge.accepted_by || "planner";
  node.updated_at = now();
  t.updated_at = now();
  return t;
}

export function rework(tree: TaskTree, nodeId: string, reason: string): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (node.status !== "review") throw new Error(`Can only rework review nodes, got ${node.status}`);

  node.status = "backlog";
  node.reason = reason;
  delete (node as Record<string, unknown>).result;
  delete (node as Record<string, unknown>).evidence;
  node.updated_at = now();
  t.updated_at = now();
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
  if (TERMINAL.has(node.status)) throw new Error(`Cannot supersede ${node.status} node`);
  if (!reason) throw new Error("Supersede requires a reason");

  node.status = "superseded";
  node.supersededBy = replacementIds;
  node.reason = reason;
  node.updated_at = now();

  // Cascade to non-terminal children
  function cascadeSupersede(nid: string): void {
    const child = t.tasks[nid];
    if (!child || TERMINAL.has(child.status)) return;
    child.status = "superseded";
    child.reason = "parent-superseded";
    child.supersededBy = [];
    child.updated_at = now();
    for (const cid of child.children) cascadeSupersede(cid);
  }
  for (const cid of node.children) cascadeSupersede(cid);

  t.updated_at = now();
  return t;
}

export function block(tree: TaskTree, nodeId: string, blocker: Blocker): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (!blocker.condition) throw new Error("Blocker must have a condition");
  if (!blocker.category) throw new Error("Blocker must have a category");
  // Can only block backlog or review nodes. Active nodes should submit
  // a blocked_claim via review; the planner then decides to block.
  if (node.status !== "backlog" && node.status !== "review") {
    throw new Error(`Can only block backlog or review nodes, got ${node.status}`);
  }

  node.status = "blocked";
  node.blocker = blocker;
  node.updated_at = now();
  t.updated_at = now();
  return t;
}

export function unblock(tree: TaskTree, nodeId: string, reason: string): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (node.status !== "blocked") throw new Error(`Can only unblock blocked nodes, got ${node.status}`);

  node.status = "backlog";
  node.blocker = undefined;
  node.reason = reason;
  node.updated_at = now();
  t.updated_at = now();
  return t;
}

export function attachFeedback(tree: TaskTree, nodeId: string, feedbackRef: string): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (!node.feedback) node.feedback = [];
  node.feedback.push(feedbackRef);
  node.updated_at = now();
  t.updated_at = now();
  return t;
}

// ── Worker Mutations ──────────────────────────────────────────────────

export function claim(tree: TaskTree, nodeId: string): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (node.status !== "backlog") throw new Error(`Can only claim backlog nodes, got ${node.status}`);
  if (!isLeaf(node)) throw new Error("Can only claim leaf nodes");

  // Check readiness
  const r = readiness(t, nodeId);
  if (!r.ready) throw new Error(`Node not ready: ${r.reasons.join("; ")}`);

  node.status = "active";
  node.updated_at = now();
  t.updated_at = now();
  return t;
}

export function submit(tree: TaskTree, nodeId: string, result: string, evidence: string[]): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (node.status !== "active") throw new Error(`Can only submit active nodes, got ${node.status}`);
  if (!result) throw new Error("Submit requires a result");

  node.status = "review";
  node.result = result;
  node.evidence = evidence;
  node.updated_at = now();
  t.updated_at = now();
  return t;
}

// ── Cleanup ───────────────────────────────────────────────────────────

export function archive(tree: TaskTree, nodeId: string, summary: string): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (node.status !== "accepted") throw new Error(`Can only archive accepted nodes, got ${node.status}`);
  if (!summary) throw new Error("Archive requires a knowledge summary");
  if (summary.length < 50) throw new Error("Archive summary too short — must capture what was learned (min 50 chars)");
  if (!node.summary && !node.evidence?.length) {
    throw new Error("Cannot archive a node without summary or evidence — roll up knowledge first");
  }

  if (!t.archive) t.archive = {};

  // Move children to archive
  function archiveChildren(nid: string): void {
    const child = t.tasks[nid];
    if (!child) return;
    for (const cid of child.children) archiveChildren(cid);
    t.archive![nid] = {
      goal: child.goal,
      status: child.status,
      parent_id: child.parent_id,
      evidence: child.evidence,
      summary: child.summary,
    };
    delete t.tasks[nid];
  }
  for (const cid of [...node.children]) archiveChildren(cid);

  node.children = [];
  node.archived = true;
  node.archive_summary = summary;
  node.updated_at = now();
  t.updated_at = now();
  return t;
}

export function prune(tree: TaskTree, nodeId: string, reason: string): TaskTree {
  const t = clone(tree);
  const node = getNode(t, nodeId);
  if (TERMINAL.has(node.status)) throw new Error(`Cannot prune terminal node ${node.status}`);

  // Remove from parent
  if (node.parent_id && t.tasks[node.parent_id]) {
    const parent = t.tasks[node.parent_id];
    parent.children = parent.children.filter((c) => c !== nodeId);
    parent.updated_at = now();
  }

  // Remove subtree
  function removeSubtree(nid: string): void {
    const n = t.tasks[nid];
    if (!n) return;
    for (const cid of n.children) removeSubtree(cid);
    delete t.tasks[nid];
  }
  removeSubtree(nodeId);

  t.updated_at = now();
  return t;
}

// ── Derived Queries ───────────────────────────────────────────────────

export function readiness(tree: TaskTree, nodeId: string): ReadinessResult {
  const node = tree.tasks[nodeId];
  if (!node) return { ready: false, reasons: ["node not found"] };
  if (node.status !== "backlog") return { ready: false, reasons: [`status is ${node.status}, not backlog`] };
  if (node.children.length > 0) return { ready: false, reasons: ["not a leaf (has children)"] };

  const reasons: string[] = [];

  // Check dependencies
  for (const dep of node.depends_on || []) {
    const depNode = tree.tasks[dep];
    if (!depNode) {
      reasons.push(`depends_on '${dep}' not found`);
    } else if (depNode.status !== "accepted") {
      reasons.push(`depends_on '${dep}' is ${depNode.status}, not accepted`);
    }
  }

  // Check conflict scope
  if (node.conflict_scope) {
    for (const [tid, t] of Object.entries(tree.tasks)) {
      if (tid !== nodeId && t.status === "active" && t.conflict_scope === node.conflict_scope) {
        reasons.push(`conflict_scope '${node.conflict_scope}' has active task '${tid}'`);
      }
    }
  }

  return { ready: reasons.length === 0, reasons };
}

export function next(tree: TaskTree): TaskNode[] {
  const ready: TaskNode[] = [];
  for (const node of Object.values(tree.tasks)) {
    if (readiness(tree, node.id).ready) {
      ready.push(node);
    }
  }
  return ready.sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));
}

export function rollupHints(tree: TaskTree): RollupHint[] {
  const hints: RollupHint[] = [];
  for (const node of Object.values(tree.tasks)) {
    if (node.status !== "decomposed" || node.children.length === 0) continue;

    const childStatuses = node.children.map((cid) => tree.tasks[cid]?.status).filter(Boolean);
    if (childStatuses.length === 0) continue;

    if (childStatuses.every((s) => s === "accepted")) {
      hints.push({ nodeId: node.id, hint: "all-accepted", detail: `All ${childStatuses.length} children accepted` });
    } else if (childStatuses.some((s) => s === "blocked")) {
      const blockedCount = childStatuses.filter((s) => s === "blocked").length;
      hints.push({ nodeId: node.id, hint: "child-blocked", detail: `${blockedCount} child(ren) blocked` });
    }
  }
  return hints;
}

export function kanban(tree: TaskTree): KanbanCard[] {
  const cards: KanbanCard[] = [];
  for (const node of Object.values(tree.tasks)) {
    if (node.children.length > 0 && node.status === "decomposed") continue; // structural parent

    const badges: string[] = [];
    let lane: KanbanCard["lane"];

    switch (node.status) {
      case "backlog": {
        lane = "backlog";
        const r = readiness(tree, node.id);
        if (r.ready) badges.push("runnable");
        else {
          if (r.reasons.some((reason) => reason.includes("depends_on"))) badges.push("dependency-blocked");
          if (r.reasons.some((reason) => reason.includes("conflict_scope"))) badges.push("conflict-blocked");
        }
        // staleness badge
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
      case "accepted":
        lane = "done";
        break;
      case "superseded":
        continue; // not shown in Kanban — archive is tree history, not workflow
      default:
        continue;
    }

    cards.push({ nodeId: node.id, goal: node.goal, lane, badges });
  }
  return cards;
}

export function stale(tree: TaskTree, thresholds?: { backlogDays?: number; activeDays?: number; blockedDays?: number }): TaskNode[] {
  const backlogMs = (thresholds?.backlogDays ?? 7) * 86400_000;
  const activeMs = (thresholds?.activeDays ?? 1) * 86400_000;
  const blockedMs = (thresholds?.blockedDays ?? 14) * 86400_000;
  const nowMs = Date.now();
  const result: TaskNode[] = [];

  for (const node of Object.values(tree.tasks)) {
    if (!node.updated_at) continue;
    const age = nowMs - new Date(node.updated_at).getTime();
    if (node.status === "backlog" && age > backlogMs) result.push(node);
    if (node.status === "active" && age > activeMs) result.push(node);
    if (node.status === "blocked" && age > blockedMs) result.push(node);
  }
  return result;
}

export function status(tree: TaskTree): TreeStatus {
  const byStatus: Record<string, number> = {};
  const activeWork: string[] = [];
  const blockedWork: string[] = [];
  const reviewWork: string[] = [];

  for (const node of Object.values(tree.tasks)) {
    byStatus[node.status] = (byStatus[node.status] || 0) + 1;
    if (node.status === "active") activeWork.push(node.id);
    if (node.status === "blocked") blockedWork.push(node.id);
    if (node.status === "review") reviewWork.push(node.id);
  }

  return {
    project: tree.project,
    updatedAt: tree.updated_at,
    totalNodes: Object.keys(tree.tasks).length,
    archivedNodes: Object.keys(tree.archive || {}).length,
    byStatus,
    activeWork,
    blockedWork,
    reviewWork,
    nextReady: next(tree).map((n) => n.id),
    rollupHints: rollupHints(tree),
  };
}

// ── Integrity Checker ─────────────────────────────────────────────────

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

  // Root check
  if (!tree.root_task_id || !allIds.has(tree.root_task_id)) {
    err("missing-root", `Root task '${tree.root_task_id}' not found`);
  }

  const childrenSeen = new Set<string>();

  for (const [nodeId, node] of Object.entries(tree.tasks)) {
    // Valid status
    if (!TASK_STATUSES.includes(node.status as TaskStatus)) {
      err("invalid-status", `Invalid status '${node.status}'`, nodeId);
    }

    // Ambiguous statuses
    const ambiguous = ["no_work", "waiting", "unknown", "maybe-later", "ready", "pending", ""];
    if (ambiguous.includes(node.status)) {
      err("ambiguous-status", `Ambiguous status '${node.status}'`, nodeId);
    }

    // Children refs exist
    for (const cid of node.children) {
      childrenSeen.add(cid);
      if (!allIds.has(cid)) err("missing-child", `Child '${cid}' not found`, nodeId);
    }

    // Parent ref exists
    if (node.parent_id && !allIds.has(node.parent_id) && nodeId !== tree.root_task_id) {
      err("missing-parent", `Parent '${node.parent_id}' not found`, nodeId);
    }

    // Depends_on refs exist
    for (const dep of node.depends_on || []) {
      if (!allIds.has(dep)) err("missing-dep", `depends_on '${dep}' not found`, nodeId);
    }

    // SupersededBy refs exist
    for (const sid of node.supersededBy || []) {
      if (sid && !allIds.has(sid)) warn("missing-superseded-ref", `supersededBy '${sid}' not found`, nodeId);
    }

    // State-specific checks
    if (node.status === "review") {
      if (!node.result) err("review-no-result", "Review node missing result", nodeId);
      if (!node.evidence?.length) err("review-no-evidence", "Review node missing evidence", nodeId);
    }

    if (node.status === "accepted") {
      if (!node.summary && !node.archive_summary) {
        warn("accepted-no-summary", "Accepted node missing summary or archive_summary", nodeId);
      }
    }

    if (node.status === "superseded") {
      if (!node.reason) err("superseded-no-reason", "Superseded node missing reason", nodeId);
    }

    if (node.status === "blocked") {
      if (!node.blocker?.condition) err("blocked-no-condition", "Blocked node missing blocker.condition", nodeId);
    }

    if (node.status === "decomposed" && node.children.length === 0) {
      warn("decomposed-no-children", "Decomposed node has no children", nodeId);
    }

    if (node.children.length > 0 && !["decomposed", "accepted"].includes(node.status)) {
      warn("leaf-with-children", `Node has children but status is ${node.status}`, nodeId);
    }

    // Goal present
    if (!node.goal) warn("no-goal", "Node missing goal", nodeId);
  }

  // Orphan check
  for (const nodeId of allIds) {
    if (nodeId === tree.root_task_id) continue;
    if (!childrenSeen.has(nodeId)) {
      const parent = tree.tasks[nodeId].parent_id;
      if (!parent || !allIds.has(parent)) {
        err("orphan", "Node is not referenced as a child and has no valid parent", nodeId);
      }
    }
  }

  // Depth check
  function getDepth(nodeId: string, seen?: Set<string>): number {
    if (!seen) seen = new Set();
    if (seen.has(nodeId) || !tree.tasks[nodeId]) return 0;
    seen.add(nodeId);
    const children = tree.tasks[nodeId].children;
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map((c) => getDepth(c, new Set(seen))));
  }
  const maxDepth = tree.root_task_id ? getDepth(tree.root_task_id) : 0;
  if (maxDepth > 5) warn("depth-exceeded", `Max depth ${maxDepth} exceeds limit of 5`);

  // Circular dependency check
  function hasCycle(nodeId: string, path: Set<string>): boolean {
    if (path.has(nodeId)) return true;
    path.add(nodeId);
    for (const dep of tree.tasks[nodeId]?.depends_on || []) {
      if (tree.tasks[dep] && hasCycle(dep, new Set(path))) {
        err("circular-dependency", `Circular dependency involving '${dep}'`, nodeId);
        return true;
      }
    }
    return false;
  }
  for (const nodeId of allIds) {
    hasCycle(nodeId, new Set());
  }

  // Breadth check
  for (const [nodeId, node] of Object.entries(tree.tasks)) {
    if (node.children.length > 15) {
      warn("width-exceeded", `${node.children.length} children exceeds limit of 15`, nodeId);
    }
  }

  // Node count
  const visibleCount = Object.values(tree.tasks).filter((n) => !n.archived).length;
  if (visibleCount > 50) warn("count-exceeded", `${visibleCount} visible nodes exceeds limit of 50`);

  // Rollup hints
  for (const h of rollupHints(tree)) {
    hint("rollup", `${h.hint}: ${h.detail}`, h.nodeId);
  }

  // Staleness
  for (const s of stale(tree)) {
    const age = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / 86400_000);
    warn("stale", `${s.status} node untouched for ${age} days`, s.id);
  }

  return violations;
}
