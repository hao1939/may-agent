// Shared project Kanban projection for Project App V2 task trees.

const TASK_LANES = [
  { id: "planning", label: "Planning" },
  { id: "backlog", label: "Backlog" },
  { id: "ready", label: "Ready" },
  { id: "active", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
  { id: "archive", label: "Archive" },
];

const SERIALIZED_KINDS = new Set([
  "blocked_review",
  "parent_review",
  "rework_review",
  "frontier_replan",
  "domain_planner",
  "loop_task",
  "human_question",
]);

const STATUS_ORDER = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

function taskPriorityRank(task) {
  return STATUS_ORDER[task.priority] ?? 9;
}

function taskChildren(task) {
  return Array.isArray(task?.children) ? task.children : [];
}

function isLeafTask(task) {
  return taskChildren(task).length === 0;
}

function isPlanningTask(task) {
  return ["frontier_replan", "domain_planner", "loop_task"].includes(task.kind);
}

function taskLane(task) {
  if (!isLeafTask(task)) return null;
  if (task.status === "superseded") return "archive";
  if (task.status === "accepted") return "done";
  if (task.status === "blocked") return "blocked";
  if (task.status === "claimed_done" || task.status === "rejected") return "review";
  if (isPlanningTask(task) && ["proposed", "ready", "active"].includes(task.status)) return "planning";
  if (task.status === "proposed") return "backlog";
  if (task.status === "ready") return "ready";
  if (task.status === "active") return "active";
  return null;
}

function taskStatusCounts(tree, taskId, acc) {
  const task = tree.tasks?.[taskId];
  if (!task) return acc;
  const status = task.status || "unknown";
  acc[status] = (acc[status] || 0) + 1;
  for (const childId of taskChildren(task)) taskStatusCounts(tree, childId, acc);
  return acc;
}

function summarizeCounts(counts) {
  const order = ["ready", "active", "claimed_done", "rejected", "blocked", "accepted", "proposed", "superseded", "decomposed"];
  return order.filter(k => counts[k]).map(k => `${k} ${counts[k]}`).join(" · ");
}

function taskSchedulerReason(task, tree) {
  if (task.status === "ready") {
    if ((task.gates || []).length && task.gate_status !== "satisfied") return "waiting: closed gate";
    const maxConcurrent = Number.isFinite(Number(tree.max_concurrent)) ? Number(tree.max_concurrent) : 3;
    if ((tree.active_task_ids || []).length >= maxConcurrent) return "waiting: max concurrent full";
    if (SERIALIZED_KINDS.has(task.kind)) return "dispatchable as serialized work";
    return "dispatchable on next worker pickup";
  }
  if (task.status === "active") return task.lease_expires_at ? `leased until ${new Date(task.lease_expires_at).toISOString().slice(11, 19)}Z` : "active without lease";
  if (task.status === "proposed") {
    if ((task.gates || []).length && task.gate_status !== "satisfied") return "waiting: closed gate";
    return "waiting: backlog promotion";
  }
  if (task.status === "blocked") return task.blocker || "blocked";
  if (task.status === "accepted") return task.verification?.verdict ? `verified: ${task.verification.verdict}` : "accepted";
  if (task.status === "rejected") return task.verification?.reason || "needs rework";
  return task.status || "unknown";
}

function taskCard(task, tree) {
  const output = (task.outputs || [])[0];
  const hasGate = (task.gates || []).length > 0 && task.gate_status !== "satisfied";
  return `<button class="kanban-card" onclick="showTaskDetail(${jsStringAttr(task.id)})">
    <span class="kanban-card-top">
      <span class="task-priority">${esc(task.priority || "P?")}</span>
      <span class="task-status">${esc(task.status || "unknown")}</span>
      ${hasGate ? '<span class="task-gate">gate</span>' : ''}
    </span>
    <span class="task-id">${esc(task.id)}</span>
    <span class="task-goal">${esc((task.goal || "").slice(0, 180))}</span>
    <span class="task-reason">${esc(taskSchedulerReason(task, tree))}</span>
    ${output ? `<span class="task-output">${esc(output)}</span>` : ''}
  </button>`;
}

function renderTaskTreeNode(tree, taskId, depth) {
  const task = tree.tasks?.[taskId];
  if (!task) return "";
  const children = taskChildren(task);
  const counts = taskStatusCounts(tree, taskId, {});
  const summary = summarizeCounts(counts);
  const indent = Math.min(depth * 14, 70);
  const hasChildren = children.length > 0;
  const open = depth < 2 ? " open" : "";
  const detail = `<div class="task-tree-row" style="padding-left:${indent}px">
    <button class="tree-task-main" onclick="showTaskDetail(${jsStringAttr(task.id)});event.stopPropagation()">
      <span class="task-priority">${esc(task.priority || "P?")}</span>
      <span class="tree-task-id">${esc(task.id)}</span>
      <span class="task-status">${esc(task.status || "unknown")}</span>
      ${summary ? `<span class="tree-counts">${esc(summary)}</span>` : ''}
    </button>
  </div>`;
  if (!hasChildren) return detail;
  return `<details class="task-tree-node"${open}>
    <summary>${detail}</summary>
    ${children.map(id => renderTaskTreeNode(tree, id, depth + 1)).join("")}
  </details>`;
}

function projectCurrentState(tree) {
  const tasks = Object.values(tree.tasks || {});
  const active = tasks.filter(t => isLeafTask(t) && t.status === "active").sort((a, b) => taskPriorityRank(a) - taskPriorityRank(b));
  const ready = tasks.filter(t => isLeafTask(t) && t.status === "ready").sort((a, b) => taskPriorityRank(a) - taskPriorityRank(b));
  const review = tasks.filter(t => isLeafTask(t) && ["claimed_done", "rejected"].includes(t.status));
  const blocked = tasks.filter(t => isLeafTask(t) && t.status === "blocked");
  if (active.length) return { label: "working", text: `${active.length} active: ${active.slice(0, 3).map(t => t.id).join(", ")}` };
  if (ready.length) return { label: "ready", text: `${ready.length} ready: ${ready.slice(0, 3).map(t => t.id).join(", ")}` };
  if (review.length) return { label: "review", text: `${review.length} task(s) need verification or rework.` };
  if (blocked.length) return { label: "blocked", text: `${blocked.length} blocked leaf task(s).` };
  return { label: "settled", text: "No active, ready, review, or blocked leaves." };
}

async function renderProjectKanban(el) {
  const res = await fetch(`/api/projects/tasks?path=${encodeURIComponent(_projectDetailPath)}`);
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("application/json")) {
    const body = await res.text().catch(() => "");
    throw new Error(`Task API returned HTTP ${res.status}: ${body.slice(0, 160) || res.statusText}`);
  }
  const data = await res.json();
  if (data.error) {
    el.innerHTML = `<div style="color:var(--red)">Failed to load task tree: ${esc(data.error)}</div>`;
    return;
  }
  if (!data.available) {
    el.innerHTML = `<div class="empty-state">This project has no <code>tasks/tree.json</code> yet. V2 projects expose a task tree for shared Kanban and task audit.</div>`;
    return;
  }

  window._currentProjectTaskTree = data;
  const tasks = Object.values(data.tasks || {});
  const current = projectCurrentState(data);
  const laneHtml = TASK_LANES.map(lane => {
    const laneTasks = tasks
      .filter(t => taskLane(t) === lane.id)
      .sort((a, b) => taskPriorityRank(a) - taskPriorityRank(b) || String(a.id).localeCompare(String(b.id)));
    return `<section class="kanban-lane">
      <header><span>${esc(lane.label)}</span><b>${laneTasks.length}</b></header>
      <div class="kanban-lane-body">${laneTasks.length ? laneTasks.map(t => taskCard(t, data)).join("") : '<div class="lane-empty">empty</div>'}</div>
    </section>`;
  }).join("");

  const rootId = data.root_task_id || "project";
  el.className = "";
  el.innerHTML = `<div class="kanban-shell">
    <div class="kanban-banner">
      <div>
        <div class="banner-label">${esc(current.label)}</div>
        <div class="banner-text">${esc(current.text)}</div>
      </div>
      <div class="banner-meta">
        <span>updated ${esc(data.updated_at || "unknown")}</span>
        <span>${Object.keys(data.tasks || {}).length} tasks</span>
        <span>max ${esc(data.max_concurrent || 3)} workers</span>
      </div>
    </div>
    <div class="kanban-board">${laneHtml}</div>
    <div class="task-tree-panel">
      <h3>Task Tree</h3>
      <div class="task-tree">${renderTaskTreeNode(data, rootId, 0)}</div>
    </div>
    <div id="task-detail-drawer" class="task-detail-drawer hidden"></div>
  </div>`;
}

function showTaskDetail(taskId) {
  const tree = window._currentProjectTaskTree;
  const drawer = document.getElementById("task-detail-drawer");
  if (!tree || !drawer) return;
  const task = tree.tasks?.[taskId];
  if (!task) return;
  const list = (label, values) => values?.length ? `<h4>${esc(label)}</h4><ul>${values.map(v => `<li>${esc(v)}</li>`).join("")}</ul>` : "";
  drawer.classList.remove("hidden");
  drawer.innerHTML = `<div class="task-detail-head">
    <div>
      <div class="task-detail-id">${esc(task.id)}</div>
      <div class="task-detail-meta">${esc(task.priority || "P?")} · ${esc(task.status || "unknown")} · ${esc(task.kind || "work")}</div>
    </div>
    <button onclick="document.getElementById('task-detail-drawer').classList.add('hidden')">Close</button>
  </div>
  <p>${esc(task.goal || "")}</p>
  <div class="task-detail-grid">
    <div><b>Parent</b><span>${esc(task.parent_id || "none")}</span></div>
    <div><b>Children</b><span>${taskChildren(task).length}</span></div>
    <div><b>Reason</b><span>${esc(taskSchedulerReason(task, tree))}</span></div>
    <div><b>Conflict</b><span>${esc(Array.isArray(task.conflict_scope) ? task.conflict_scope.join(", ") : task.conflict_scope || "")}</span></div>
  </div>
  ${list("Outputs", task.outputs || [])}
  ${list("Acceptance", task.acceptance || [])}
  ${list("Gates", task.gates || [])}
  ${task.blocker ? `<h4>Blocker</h4><p>${esc(task.blocker)}</p>` : ""}
  ${task.verification ? `<h4>Verification</h4><pre>${esc(JSON.stringify(task.verification, null, 2))}</pre>` : ""}
  ${(task.attempts || []).length ? `<h4>Attempts</h4><div>${task.attempts.length} recorded attempt(s)</div>` : ""}`;
}
