const PROJECT_PATH = "projects/aks-rp-e2e";
const APP_PATH = "projects/aks-rp-e2e.app";
const TASK_TREE_FILE = "aks-rp-e2e.app/tasks/tree.json";
const MAX_CONCURRENT = 3;

let state = {
  tree: null,
  project: "",
  selectedTaskId: null,
  collapsedTaskIds: new Set(),
};

function esc(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function attrEsc(value) {
  return esc(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function taskColor(status) {
  if (status === "accepted") return "var(--green)";
  if (status === "ready") return "var(--blue)";
  if (status === "active") return "var(--blue)";
  if (status === "claimed_done") return "var(--purple)";
  if (status === "rejected") return "var(--red)";
  if (status === "blocked") return "var(--yellow)";
  if (status === "superseded") return "var(--muted)";
  return "var(--muted)";
}

function isLeaf(task) {
  return !(task?.children || []).length;
}

function isReviewTask(task) {
  const id = task?.id || "";
  return task?.kind === "blocked_review"
    || task?.kind === "parent_review"
    || task?.kind === "rework_review"
    || id === "blocked-frontier-review"
    || id.endsWith("-blocker-review")
    || id.endsWith("-rollup-review")
    || id.endsWith("-rework-review");
}

function isPlanningTask(task) {
  return task?.kind === "frontier_replan" || task?.kind === "domain_planner" || task?.kind === "loop_task";
}

function isHumanQuestionTask(task) {
  return task?.kind === "human_question" || task?.owner === "human";
}

function isSerializedTask(task) {
  return isReviewTask(task) || isPlanningTask(task) || isHumanQuestionTask(task);
}

function hasExternalBlockSignal(task) {
  if (!task || task.status !== "blocked") return false;
  if (task.kind === "human_question") return true;
  if (hasClosedGate(task) || (task.gates || []).length > 0) return true;
  if (isReviewTask(task) || isPlanningTask(task)) return false;
  if (task.owner === "human") return true;
  if (task.verification?.verdict === "rejected") return false;
  if (/validation|validator|check failed|failed required|not executable|no-work|waiting claims are not terminal/i.test(task.blocker || "")) return false;
  const text = [task.goal, task.blocker, ...(task.gates || [])].filter(Boolean).join("\n");
  return /(?:external|credential|auth|token|azure cli|\baz\b|owner|capacity|quota|rollout|environment|precondition|human|input|approval|unsafe|safety|not installed|unavailable|source signal|subscription|msi|hcp|staging)/i.test(text);
}

function taskEscalation(task) {
  return task?.escalation && typeof task.escalation === "object" ? task.escalation : null;
}

function hasOpenEscalation(task) {
  const escalation = taskEscalation(task);
  return !!escalation && ["open", "routed", "waiting_human"].includes(escalation.state);
}

function kanbanColumn(task) {
  if (isPlanningTask(task) && ["proposed", "ready", "active"].includes(task.status)) return "planning";
  if (task.status === "proposed") return "backlog";
  if (task.status === "ready") return "ready";
  if (task.status === "active") return "in-progress";
  if (task.status === "claimed_done" || task.status === "rejected") return "review";
  if (task.status === "blocked") return hasExternalBlockSignal(task) ? "blocked" : "review";
  if (task.status === "accepted") return "done";
  if (task.status === "superseded") return "archive";
  return null;
}

function kanbanLabel(task) {
  const column = kanbanColumn(task);
  if (!column) return "Structure";
  return ({
    "backlog": "Backlog",
    "planning": "Planning",
    "ready": "Ready",
    "in-progress": "In Progress",
    "review": "Review",
    "blocked": "Blocked",
    "done": "Done",
    "archive": "Archive",
  })[column] || "Structure";
}

function isKanbanTask(tree, task) {
  if (!task || task.id === tree?.root_task_id) return false;
  return isLeaf(task) && !!kanbanColumn(task);
}

function kanbanTasks(tree) {
  return Object.values(tree?.tasks || {}).filter(task => isKanbanTask(tree, task));
}

function taskRows(tree) {
  const rows = [];
  const seen = new Set();
  const tasks = tree?.tasks || {};
  const visit = (id, depth) => {
    const task = tasks[id];
    if (!task || seen.has(id)) return;
    seen.add(id);
    rows.push({ task, depth });
    for (const childId of task.children || []) visit(childId, depth + 1);
  };
  visit(tree?.root_task_id || "project", 0);
  for (const task of Object.values(tasks)) {
    if (!seen.has(task.id)) visit(task.id, 0);
  }
  return rows;
}

function visibleTaskRows(tree) {
  const rows = [];
  const covered = new Set();
  const tasks = tree?.tasks || {};

  const markSubtree = id => {
    const task = tasks[id];
    if (!task || covered.has(id)) return;
    covered.add(id);
    for (const childId of task.children || []) markSubtree(childId);
  };

  const visit = (id, depth) => {
    const task = tasks[id];
    if (!task || covered.has(id)) return;
    covered.add(id);
    rows.push({ task, depth });
    if (state.collapsedTaskIds.has(id)) {
      for (const childId of task.children || []) markSubtree(childId);
      return;
    }
    for (const childId of task.children || []) visit(childId, depth + 1);
  };

  visit(tree?.root_task_id || "project", 0);
  for (const task of Object.values(tasks)) {
    if (!covered.has(task.id)) visit(task.id, 0);
  }
  return rows;
}

function depthMap(tree) {
  const map = {};
  for (const row of taskRows(tree)) map[row.task.id] = row.depth;
  return map;
}

function priorityRank(priority) {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 })[priority] ?? 9;
}

function taskSort(tree) {
  const depths = depthMap(tree);
  return (a, b) => {
    const ad = depths[a.id] ?? 99;
    const bd = depths[b.id] ?? 99;
    return ad - bd || priorityRank(a.priority) - priorityRank(b.priority) || String(a.id).localeCompare(String(b.id));
  };
}

function topBranchId(tree, task) {
  let current = task;
  let parent = current?.parent_id ? tree?.tasks?.[current.parent_id] : null;
  while (parent && parent.parent_id && parent.id !== tree.root_task_id) {
    current = parent;
    parent = parent.parent_id ? tree?.tasks?.[parent.parent_id] : null;
  }
  return current?.id || task?.id || "";
}

function activeLeaves(tree) {
  return Object.values(tree?.tasks || {})
    .filter(task => isLeaf(task) && ["active", "claimed_done"].includes(task.status))
    .sort(taskSort(tree));
}

function readyLeaves(tree) {
  return Object.values(tree?.tasks || {})
    .filter(task => isLeaf(task) && task.status === "ready")
    .sort(taskSort(tree));
}

function taskConflictScope(task) {
  const explicit = Array.isArray(task?.conflict_scope) ? task.conflict_scope.filter(Boolean) : [];
  return [...new Set((explicit.length ? explicit : (task?.outputs || [])).filter(Boolean))];
}

function conflictScopesOverlap(a, b) {
  const right = new Set(taskConflictScope(b));
  return taskConflictScope(a).some(item => right.has(item));
}

function taskClarity(task) {
  if (!String(task?.goal || "").trim()) return { ok: false, reason: "missing goal" };
  if (!(task?.acceptance || []).length) return { ok: false, reason: "missing acceptance" };
  if (!(task?.outputs || []).length) return { ok: false, reason: "missing output" };
  return { ok: true };
}

function hasClosedGate(task) {
  return (task?.gates || []).length > 0 && task.gate_status !== "satisfied";
}

function dispatchableReadyIds(tree, maxConcurrent = MAX_CONCURRENT) {
  const active = activeLeaves(tree);
  if (active.some(isSerializedTask)) return new Set();
  const capacity = Math.max(0, maxConcurrent - active.length);
  if (capacity <= 0) return new Set();
  const selected = [];
  for (const candidate of readyLeaves(tree)) {
    if (selected.length >= capacity) break;
    const clarity = taskClarity(candidate);
    if (!clarity.ok || hasClosedGate(candidate)) continue;
    if (isSerializedTask(candidate)) {
      if (active.length === 0 && selected.length === 0) selected.push(candidate);
      break;
    }
    if ([...active, ...selected].some(other => conflictScopesOverlap(other, candidate))) continue;
    selected.push(candidate);
  }
  return new Set(selected.map(task => task.id));
}

function schedulerReason(tree, task) {
  if (!task) return "";
  if (task.status === "active") {
    if (!task.lease_expires_at) return "stale: active without lease; worker pickup should requeue";
    if (Date.parse(task.lease_expires_at) <= Date.now()) return "stale: lease expired; worker pickup should requeue";
    return `working: lease until ${task.lease_expires_at}`;
  }
  if (task.status === "claimed_done") return "waiting: verification or worker completion rollup";
  if (task.status !== "ready") return "";
  const clarity = taskClarity(task);
  if (!clarity.ok) return `waiting: unclear task (${clarity.reason})`;
  if (hasClosedGate(task)) return "waiting: closed gate";
  if (dispatchableReadyIds(tree).has(task.id)) return "dispatchable on next worker pickup";
  const active = activeLeaves(tree);
  const activeSerialized = active.find(isSerializedTask);
  if (activeSerialized) return `waiting: serialized task active (${activeSerialized.id})`;
  if (active.length >= MAX_CONCURRENT) return `waiting: max concurrent full (${active.length}/${MAX_CONCURRENT})`;
  if (isSerializedTask(task) && active.length > 0) return "waiting: serialized task needs empty lane";
  const conflicting = active.find(other => conflictScopesOverlap(other, task));
  if (conflicting) return `waiting: conflicts with ${conflicting.id}`;
  return "waiting: earlier ready tasks have priority or conflict";
}

function taskStats(tree) {
  const tasks = Object.values(tree?.tasks || {});
  const workflowTasks = kanbanTasks(tree);
  const counts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  const workflowCounts = workflowTasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});
  const columnCounts = workflowTasks.reduce((acc, task) => {
    const column = kanbanColumn(task);
    if (column) acc[column] = (acc[column] || 0) + 1;
    return acc;
  }, {});
  const accepted = workflowCounts.accepted || 0;
  const blocked = workflowTasks.filter(task => task.status === "blocked" && hasExternalBlockSignal(task)).length;
  const escalated = workflowTasks.filter(hasOpenEscalation).length;
  const active = columnCounts["in-progress"] || 0;
  const total = workflowTasks.length;
  return {
    total,
    counts,
    workflowCounts,
    accepted,
    blocked,
    escalated,
    active,
    ready: columnCounts.ready || 0,
    review: columnCounts.review || 0,
    settledPct: total ? Math.round(((accepted + blocked + (workflowCounts.superseded || 0)) / total) * 100) : 0,
    treeTotal: tasks.length,
  };
}

function descendantStatusCounts(tree, task) {
  const counts = {};
  const tasks = tree?.tasks || {};
  const seen = new Set();
  const visit = id => {
    const child = tasks[id];
    if (!child || seen.has(id)) return;
    seen.add(id);
    const status = child.status || "unknown";
    counts[status] = (counts[status] || 0) + 1;
    for (const childId of child.children || []) visit(childId);
  };
  for (const childId of task?.children || []) visit(childId);
  return counts;
}

function renderStatusSummary(counts) {
  const order = ["active", "ready", "claimed_done", "rejected", "blocked", "accepted", "decomposed", "proposed", "superseded", "unknown"];
  const entries = Object.entries(counts || {})
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });
  if (!entries.length) return "";
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return `<div class="tree-summary" data-testid="tree-summary">
    <span class="summary-label">${total} hidden</span>
    ${entries.map(([status, count]) => `<span class="summary-chip" style="color:${taskColor(status)}">${esc(status)} ${count}</span>`).join("")}
  </div>`;
}

async function fetchJson(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadData() {
  const [projectData, taskData] = await Promise.all([
    fetchJson(`/api/projects/content?path=${encodeURIComponent(PROJECT_PATH)}`).catch(() => ({ content: "" })),
    fetchJson(`/api/projects/artifact?path=${encodeURIComponent(APP_PATH)}&file=${encodeURIComponent("tasks/tree.json")}`),
  ]);
  state.project = projectData.content || "";
  state.tree = JSON.parse(taskData.content || "{}");
  state.collapsedTaskIds = new Set([...state.collapsedTaskIds].filter(id => state.tree?.tasks?.[id]));
  const active = (state.tree?.active_task_ids || [])[0] || state.tree?.active_task_id;
  if (!state.selectedTaskId || !state.tree.tasks?.[state.selectedTaskId]) {
    state.selectedTaskId = active || firstTaskIdByColumn(state.tree, "in-progress") || firstTaskIdByColumn(state.tree, "ready") || state.tree?.root_task_id || null;
  }
}

function firstTaskIdByColumn(tree, column) {
  return kanbanTasks(tree).find(task => kanbanColumn(task) === column)?.id || null;
}

function primaryActiveTask(tree) {
  const activeId = (tree?.active_task_ids || [])[0] || tree?.active_task_id;
  return activeId ? tree.tasks?.[activeId] || null : null;
}

function renderMetric(label, value, color = "") {
  return `<div class="metric">
    <div class="metric-value" style="${color ? `color:${color}` : ""}">${esc(value)}</div>
    <div class="metric-label">${esc(label)}</div>
  </div>`;
}

function renderSummary(tree) {
  const stats = taskStats(tree);
  const activeTasks = (tree.active_task_ids || [])
    .map(id => tree.tasks?.[id])
    .filter(Boolean);
  const active = activeTasks[0] || (tree.active_task_id ? tree.tasks?.[tree.active_task_id] : null);
  const activeTitle = activeTasks.length > 1 ? `${activeTasks.length} active tasks` : active ? active.id : "No active task";
  const activeNote = activeTasks.length > 1
    ? activeTasks.slice(0, 4).map(task => `${task.id}: ${task.goal || ""}`).join(" | ")
    : active?.goal || "The task tree has no active pointer. Review ready, blocked, or rejected work below.";
  const progressAccepted = stats.total ? Math.round((stats.accepted / stats.total) * 100) : 0;
  const progressBlocked = stats.total ? Math.round((stats.blocked / stats.total) * 100) : 0;
  const progressActive = stats.total && stats.active ? Math.max(1, Math.round((stats.active / stats.total) * 100)) : 0;
  const workflowTasks = kanbanTasks(tree);
  const planningTasks = workflowTasks.filter(task => kanbanColumn(task) === "planning");
  const planning = planningTasks.length;
  const backlog = workflowTasks.filter(task => kanbanColumn(task) === "backlog").length;
  const activePlanning = planningTasks.filter(task => task.status === "active").length;
  const planningNeedsBatch = activePlanning > 0 && backlog === 0 && stats.ready === 0 && stats.active === 0;
  return `<section class="summary-grid">
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="kicker">Current Work</div>
          <div class="title">${esc(activeTitle)}</div>
        </div>
        <span class="pill" style="color:${taskColor(active?.status)}">${active ? esc(kanbanLabel(active)) : "Idle"}</span>
      </div>
      <div class="muted">${esc(activeNote)}</div>
      ${planningNeedsBatch ? `<div class="notice" data-testid="planning-empty-backlog-warning">Planning is active but Backlog and Ready are empty. The planner should create a batch of proposed tasks before execution can parallelize.</div>` : ""}
      <div class="progress" title="${stats.accepted} accepted, ${stats.blocked} blocked, ${stats.active} active, ${stats.total} total">
        <span class="progress-accepted" style="width:${progressAccepted}%"></span>
        <span class="progress-active" style="width:${progressActive}%"></span>
        <span class="progress-blocked" style="width:${progressBlocked}%"></span>
      </div>
      <div class="metrics">
        ${renderMetric("task cards", stats.total)}
        ${renderMetric("planning", planning, "var(--purple)")}
        ${renderMetric("backlog", backlog, "var(--muted)")}
        ${renderMetric("done", stats.accepted, "var(--green)")}
        ${renderMetric("ready", stats.ready, "var(--blue)")}
        ${renderMetric("in progress", stats.active, "var(--blue)")}
        ${renderMetric("blocked", stats.blocked, "var(--yellow)")}
        ${renderMetric("escalated", stats.escalated, "var(--orange)")}
      </div>
    </div>
    <div class="panel">
      <div class="kicker">Steering</div>
      <div class="title">Talk With The Agent</div>
      <div class="muted">Target a task, ask for a split, challenge a claim, unblock a gate, or request the next project move.</div>
      <div class="actions" style="margin-top:12px">
        <button class="btn btn-primary" onclick="prefillAdvance()">Advance Project</button>
        <button class="btn" onclick="prefillReviewFrontier()">Triage Blocked</button>
        <button class="btn" onclick="prefillSelected('split')">Split Selected</button>
      </div>
    </div>
  </section>`;
}

function renderCard(task) {
  const selected = task.id === state.selectedTaskId ? " active-card" : "";
  const branch = topBranchId(state.tree, task);
  const escalation = taskEscalation(task);
  const meta = [
    task.priority || "",
    task.claimed_by ? `claimed by ${task.claimed_by}` : "",
    branch && branch !== task.id ? branch : "",
    task.kind ? String(task.kind).replace(/_/g, " ") : "",
    isLeaf(task) ? "leaf" : `${(task.children || []).length} children`,
  ].filter(Boolean);
  const reason = schedulerReason(state.tree, task);
  return `<article class="card${selected}" style="--task-color:${taskColor(task.status)}" data-task-id="${attrEsc(task.id)}" onclick="selectTask(this.dataset.taskId)" title="${attrEsc(task.goal || task.id)}">
    <div class="card-id">${esc(task.id)}</div>
    <div class="card-goal">${esc(task.blocker || task.goal || "")}</div>
    ${escalation ? `<div class="card-badges"><span class="escalation-badge">${hasOpenEscalation(task) ? "Escalated" : "Escalation"}: ${esc(escalation.owner || escalation.state || "owner")}</span></div>` : ""}
    ${reason ? `<div class="card-scheduler">${esc(reason)}</div>` : ""}
    <div class="card-meta">${meta.map(item => `<span>${esc(item)}</span>`).join("")}</div>
  </article>`;
}

function renderKanban(tree) {
  const columnsByKey = {
    backlog: [],
    planning: [],
    ready: [],
    "in-progress": [],
    review: [],
    blocked: [],
    done: [],
    archive: [],
  };
  const sort = taskSort(tree);
  for (const task of kanbanTasks(tree)) {
    const column = kanbanColumn(task);
    if (columnsByKey[column]) columnsByKey[column].push(task);
  }
  const columns = [
    ["planning", "Planning"],
    ["backlog", "Backlog"],
    ["ready", "Ready"],
    ["in-progress", "In Progress"],
    ["review", "Review"],
    ["blocked", "Blocked"],
    ["done", "Done"],
    ["archive", "Archive"],
  ];
  const limits = { done: 20, planning: 8, backlog: 16, blocked: 20, ready: 16, "in-progress": 16, review: 16, archive: 8 };
  return `<section class="panel" data-testid="kanban-board">
    <div class="panel-head">
      <div>
        <div class="kicker">Execution Board</div>
        <div class="title">Kanban Board</div>
      </div>
      <span class="muted">leaf task cards from ${TASK_TREE_FILE}</span>
    </div>
    <div class="kanban">
      ${columns.map(([key, label]) => {
        const items = columnsByKey[key].sort(sort);
        const limit = limits[key] || 12;
        return `<div class="col" data-testid="kanban-${key}">
          <div class="col-head"><span class="col-title">${esc(label)}</span><span class="pill">${items.length}</span></div>
          <div class="cards">${items.length ? items.slice(0, limit).map(renderCard).join("") : `<div class="empty">None</div>`}${items.length > limit ? `<div class="empty">${items.length - limit} more</div>` : ""}</div>
        </div>`;
      }).join("")}
    </div>
  </section>`;
}

function renderTree(tree) {
  const rows = visibleTaskRows(tree);
  return `<section class="panel" data-testid="task-breakdown">
    <div class="panel-head">
      <div>
        <div class="kicker">Feature Breakdown</div>
        <div class="title">Feature / Task Tree</div>
      </div>
      <span class="muted">${esc(tree.project_lifecycle || "active")}</span>
    </div>
    <div class="tree">
      ${rows.map(({ task, depth }) => {
        const selected = task.id === state.selectedTaskId ? " selected" : "";
        const hasChildren = (task.children || []).length > 0;
        const collapsed = state.collapsedTaskIds.has(task.id);
        const summary = collapsed ? renderStatusSummary(descendantStatusCounts(tree, task)) : "";
        return `<div class="tree-row${selected}" data-task-id="${attrEsc(task.id)}" onclick="selectTask(this.dataset.taskId)">
          <div class="tree-main" style="--indent:${Math.min(depth * 18, 120)}px">
            ${hasChildren
              ? `<button class="tree-toggle" data-testid="tree-toggle" aria-label="${collapsed ? "Expand" : "Collapse"} children for ${attrEsc(task.id)}" aria-expanded="${collapsed ? "false" : "true"}" data-task-id="${attrEsc(task.id)}" onclick="toggleTaskCollapse(event, this.dataset.taskId)">${collapsed ? "+" : "-"}</button>`
              : `<span class="tree-toggle-spacer"></span>`}
            <div class="tree-copy">
              <div class="tree-id">${esc(task.id)}</div>
              <div class="tree-goal">${esc(task.goal || "")}</div>
              ${summary}
            </div>
          </div>
          <span class="pill" style="color:${taskColor(task.status)}">${esc(task.status || "unknown")}</span>
        </div>`;
      }).join("")}
    </div>
  </section>`;
}

function outputLinks(task) {
  const outputs = (task?.outputs || []).filter(Boolean);
  if (!outputs.length) return `<span class="muted">None recorded</span>`;
  return outputs.map(output => `<a href="/projects/aks-rp-e2e/${encodeURIComponent(output)}" target="_blank">${esc(output)}</a>`).join("");
}

function detailList(title, items) {
  const list = (items || []).filter(Boolean);
  return `<div class="detail-section"><div class="kicker">${esc(title)}</div><div class="detail-list">${
    list.length ? list.map(item => `<div>${esc(item)}</div>`).join("") : `<div>None recorded</div>`
  }</div></div>`;
}

function selectedTask() {
  return state.selectedTaskId ? state.tree?.tasks?.[state.selectedTaskId] : null;
}

function renderDetail() {
  const task = selectedTask();
  if (!task) {
    return `<aside class="detail panel" data-testid="task-detail"><div class="empty">Select a task to discuss or steer it.</div></aside>`;
  }
  const parent = task.parent_id ? state.tree.tasks?.[task.parent_id] : null;
  const latestAttempt = (task.attempts || []).at(-1);
  const escalation = taskEscalation(task);
  return `<aside class="detail panel" data-testid="task-detail">
    <div>
      <div class="kicker">Selected Task</div>
      <h2>${esc(task.id)}</h2>
      <div class="muted">${esc(task.goal || "")}</div>
      <div class="actions" style="margin-top:10px">
        <span class="pill" style="color:${taskColor(task.status)}">${esc(task.status || "unknown")}</span>
        ${task.kind ? `<span class="pill">${esc(String(task.kind).replace(/_/g, " "))}</span>` : ""}
        ${task.priority ? `<span class="pill">${esc(task.priority)}</span>` : ""}
      </div>
    </div>
    <div class="detail-section">
      <div class="kicker">Context</div>
      <div class="detail-list">
        <div>Parent: ${parent ? esc(parent.id) : "none"}</div>
        <div>Children: ${(task.children || []).length}</div>
        ${task.claimed_by ? `<div>Claimed by: ${esc(task.claimed_by)}</div>` : ""}
        ${task.lease_expires_at ? `<div>Lease expires: ${esc(task.lease_expires_at)}</div>` : ""}
        ${schedulerReason(state.tree, task) ? `<div>Scheduler: ${esc(schedulerReason(state.tree, task))}</div>` : ""}
        <div>Outputs: ${outputLinks(task)}</div>
        ${task.blocker ? `<div>Blocker: ${esc(task.blocker)}</div>` : ""}
        ${task.session_id ? `<div>Session: ${esc(task.session_id)}</div>` : ""}
        ${task.verification ? `<div>Verification: ${esc(task.verification.verdict)} - ${esc(task.verification.reason || "")}</div>` : ""}
        ${latestAttempt ? `<div>Latest attempt: ${esc(latestAttempt.claim)} - ${esc(String(latestAttempt.summary || "").slice(0, 260))}</div>` : ""}
      </div>
    </div>
    ${escalation ? `<div class="detail-section escalation-panel">
      <div class="kicker">Escalation</div>
      <div class="detail-list">
        <div>ID: ${esc(escalation.id || task.escalation_id || "")}</div>
        <div>State: ${esc(escalation.state || "open")}</div>
        <div>Owner: ${esc(escalation.owner || "")}</div>
        <div>Severity: ${esc(escalation.severity || "")}</div>
        <div>Reason: ${esc(escalation.reason || "")}</div>
        <div>Requested action: ${esc(escalation.requested_action || "")}</div>
        <div>Resume condition: ${esc(escalation.resume_condition || "")}</div>
        ${escalation.resolution ? `<div>Resolution: ${esc(escalation.resolution.outcome || "")} - ${esc(escalation.resolution.summary || "")}</div>` : ""}
      </div>
      <div class="actions" style="margin-top:8px">
        <button class="btn" onclick="prefillSelected('resolve')">Resolve</button>
        <button class="btn" onclick="prefillSelected('reject-escalation')">Reject</button>
      </div>
    </div>` : ""}
    ${detailList("Acceptance", task.acceptance)}
    ${detailList("Gates", task.gates)}
    ${detailList("Forbidden", task.forbidden)}
    <div class="detail-section steer-box">
      <div>
        <div class="kicker">Agent Discussion</div>
        <div class="muted">Send a task-targeted steering message. It is posted as a project comment for May to route through the event system.</div>
      </div>
      <textarea id="steer-text" data-testid="steer-textarea" placeholder="Ask the agent to review, split, unblock, rerun, or challenge this task."></textarea>
      <div class="actions">
        <button class="btn btn-primary" onclick="sendSteering()" data-testid="send-steering">Send To Agent</button>
        <button class="btn" onclick="prefillSelected('review')">Audit</button>
        <button class="btn" onclick="prefillSelected('split')">Split</button>
        <button class="btn" onclick="prefillSelected('challenge')">Challenge</button>
        <button class="btn" onclick="prefillSelected('escalate')">Escalate</button>
      </div>
      <div class="status" id="send-status" data-testid="send-status"></div>
    </div>
  </aside>`;
}

function render() {
  const root = document.getElementById("kanban-root");
  if (!root) return;
  const tree = state.tree;
  if (!tree?.tasks) {
    root.innerHTML = `<div class="panel">Task tree is unavailable.</div>`;
    return;
  }
  root.innerHTML = [
    renderSummary(tree),
    renderKanban(tree),
    `<section class="lower-grid">`,
    renderTree(tree),
    renderDetail(),
    `</section>`,
  ].join("");
}

function selectTask(id) {
  state.selectedTaskId = id;
  render();
}

function toggleTaskCollapse(event, id) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (state.collapsedTaskIds.has(id)) state.collapsedTaskIds.delete(id);
  else state.collapsedTaskIds.add(id);
  render();
}

function setSteerText(text) {
  const textarea = document.getElementById("steer-text");
  if (textarea) {
    textarea.value = text;
    textarea.focus();
  }
}

function prefillAdvance() {
  const active = primaryActiveTask(state.tree);
  state.selectedTaskId = active?.id || state.selectedTaskId;
  render();
  setSteerText(`[resume] Advance aks-rp-e2e through aks-rp-e2e.app/tasks/tree.json.\n\nCurrent task: ${active?.id || "none"}\n\nKeep working until blocked by a concrete gate/input, complete, or budget-limited. Do not accept no_work or waiting as terminal. Verify claims before accepting tasks.`);
}

function prefillReviewFrontier() {
  const blocked = Object.values(state.tree?.tasks || {}).filter(task => task.status === "blocked" && hasExternalBlockSignal(task)).slice(0, 8).map(task => `- ${task.id}: ${task.blocker || task.goal}`).join("\n");
  setSteerText(`[task-steer] aks-rp-e2e frontier review\n\naction: review_frontier\n\nReview the current blocked/rejected frontier and decide what can still move locally. Convert vague no-work/waiting into concrete ready work, exact blocker, human question, or supersession.\n\nBlocked sample:\n${blocked || "- none"}`);
}

function prefillSelected(action) {
  const task = selectedTask();
  if (!task) return;
  const escalation = taskEscalation(task);
  const prompts = {
    review: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: review\n\nReview this task's status, evidence, acceptance, blockers, and parent rollup. Tell me whether it is correctly represented in aks-rp-e2e.app/tasks/tree.json and what should happen next.`,
    split: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: split\n\nIf this task is too broad or blocked ambiguously, split it into smaller executable child tasks. Preserve safety gates, forbidden actions, and evidence links.`,
    challenge: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: challenge\n\nChallenge this task status. Check whether the claim is overaccepted, under-specified, blocked for the wrong reason, or missing a concrete next step.`,
    escalate: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: escalate\n\nReview whether this task is blocked by a real ownership boundary. If yes, create or refresh a task-linked escalation with owner, requested action, evidence, and resume condition. If local rework is possible, do not escalate; create ready follow-up work instead.\n\nCurrent blocker: ${task.blocker || "none"}`,
    resolve: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: resolve_escalation\n\nResolve escalation ${escalation?.id || task.escalation_id || "(missing)"} for this task. Record outcome fixed or answered only if the task can resume now; otherwise use rejected, needs_human, or superseded with evidence. Wake project execution after updating the task.\n\nResolution summary: `,
    "reject-escalation": `[task-steer] aks-rp-e2e task ${task.id}\n\naction: reject_escalation\n\nReject or dismiss escalation ${escalation?.id || task.escalation_id || "(missing)"} if the request is invalid, obsolete, or not enough to unblock the task. Explain what should happen next in the task tree.`,
  };
  setSteerText(prompts[action] || prompts.review);
}

async function sendSteering() {
  const textarea = document.getElementById("steer-text");
  const status = document.getElementById("send-status");
  const message = String(textarea?.value || "").trim();
  if (!message) {
    if (status) status.textContent = "Write a steering message first.";
    return;
  }
  if (status) status.textContent = "Sending...";
  try {
    const res = await fetch("/api/projects/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: PROJECT_PATH, comment: message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    if (textarea) textarea.value = "";
    if (status) status.textContent = data.workflowStarted ? "Sent. Workflow started." : "Sent.";
  } catch (error) {
    if (status) status.textContent = `Failed: ${error?.message || String(error)}`;
  }
}

async function boot() {
  const refresh = document.getElementById("refresh-btn");
  if (refresh) refresh.addEventListener("click", async () => {
    refresh.disabled = true;
    try {
      await loadData();
      render();
    } finally {
      refresh.disabled = false;
    }
  });
  try {
    await loadData();
    render();
  } catch (error) {
    const root = document.getElementById("kanban-root");
    if (root) root.innerHTML = `<div class="panel"><div class="title">Could not load task tree</div><div class="muted">${esc(error?.message || String(error))}</div></div>`;
  }
}

window.selectTask = selectTask;
window.toggleTaskCollapse = toggleTaskCollapse;
window.prefillAdvance = prefillAdvance;
window.prefillReviewFrontier = prefillReviewFrontier;
window.prefillSelected = prefillSelected;
window.sendSteering = sendSteering;

boot();
