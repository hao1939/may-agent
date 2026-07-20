// Default task reconciliation surface. The server owns classification; this
// file presents the canonical projection and sends asynchronous owner requests.

const TASK_SECTIONS = [
  { id: "attention", label: "Attention" },
  { id: "running", label: "Running" },
  { id: "ready", label: "Ready" },
  { id: "pending", label: "Pending" },
  { id: "waiting", label: "Waiting" },
  { id: "healthy", label: "Healthy standing" },
];

const TASK_PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

function projectTaskItems(model) {
  return model?.items && typeof model.items === "object" ? model.items : {};
}

function projectTaskResources(model) {
  return Object.values(projectTaskItems(model)).filter((item) => item?.item_type === "task");
}

function projectTaskChildren(item) {
  return Array.isArray(item?.children) ? item.children : [];
}

function projectTaskSection(item) {
  if (!item || item.item_type !== "task") return null;
  if (item.phase === "attention") return "attention";
  if (item.phase === "running") return "running";
  if (item.phase === "waiting") return "waiting";
  if (item.phase === "pending" && item.readiness?.state === "ready") return "ready";
  if (item.phase === "pending") return "pending";
  if (item.phase === "converged" && item.mode === "maintain") return "healthy";
  return null;
}

function projectTaskSort(left, right) {
  return (TASK_PRIORITY_ORDER[left?.priority] ?? 9) - (TASK_PRIORITY_ORDER[right?.priority] ?? 9) ||
    String(left?.id || "").localeCompare(String(right?.id || ""));
}

function projectTaskFormatTime(value) {
  if (!value) return "unknown";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value);
  const delta = Math.max(0, Date.now() - parsed);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function projectTaskConditionLabel(model, conditionId) {
  const condition = model?.conditions?.[conditionId];
  if (!condition) return conditionId;
  const type = condition.spec?.type || "Condition";
  const subject = condition.spec?.subject || conditionId;
  return `${type}: ${subject}`;
}

function projectTaskCard(item, model) {
  const conditions = (item.condition_ids || []).map((id) => projectTaskConditionLabel(model, id));
  const drift = item.synchronized === false ? `generation ${item.observed_generation ?? 0}/${item.generation ?? 0}` : "";
  const secondary = [
    item.owner ? `owner ${item.owner}` : "",
    item.workflow ? `workflow ${item.workflow}` : "",
    drift,
  ].filter(Boolean).join(" · ");
  const search = [item.id, item.outcome, item.summary, item.owner, item.workflow, item.category, ...conditions]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return `<button class="kanban-card" data-task-search="${attrEsc(search)}" onclick="showTaskDetail(${jsStringAttr(item.id)})">
    <span class="kanban-card-top">
      <span class="task-priority">${esc(item.priority || "P?")}</span>
      <span class="task-status">${esc(item.phase || "unknown")}</span>
      <span class="task-status">${esc(item.mode || "unknown")}</span>
    </span>
    <span class="task-goal">${esc(item.outcome || item.id)}</span>
    <span class="task-id">${esc(item.id)}</span>
    <span class="task-reason">${esc(item.readiness?.reason || item.summary || "No current observation")}</span>
    ${conditions.length ? `<span class="task-reason">${esc(conditions.join(" · "))}</span>` : ""}
    ${secondary ? `<span class="task-output">${esc(secondary)}</span>` : ""}
  </button>`;
}

function projectTaskSectionHtml(section, model) {
  const items = projectTaskResources(model).filter((item) => projectTaskSection(item) === section.id).sort(projectTaskSort);
  let cards = items.length ? items.map((item) => projectTaskCard(item, model)).join("") : '<div class="lane-empty">empty</div>';
  if (section.id === "waiting" && items.length) {
    const groups = new Map();
    for (const item of items) {
      const key = item.condition_ids?.length
        ? item.condition_ids.map((id) => projectTaskConditionLabel(model, id)).join(" · ")
        : "Missing Condition";
      groups.set(key, [...(groups.get(key) || []), item]);
    }
    cards = [...groups.entries()]
      .map(([label, waiting]) => `<div class="task-reason"><b>${esc(label)}</b> · ${waiting.length}</div>${waiting.map((item) => projectTaskCard(item, model)).join("")}`)
      .join("");
  }
  const body = `<div class="kanban-lane-body">${cards}</div>`;
  if (section.id === "healthy") {
    return `<details class="kanban-lane done-lane"><summary><span>${esc(section.label)}</span><b>${items.length}</b></summary>${body}</details>`;
  }
  return `<section class="kanban-lane"><header><span>${esc(section.label)}</span><b>${items.length}</b></header>${body}</section>`;
}

function projectTaskDescendantSummary(model, itemId) {
  const items = projectTaskItems(model);
  const counts = {};
  const visit = (id, seen) => {
    if (seen.has(id)) return;
    seen.add(id);
    const item = items[id];
    if (!item) return;
    const section = projectTaskSection(item);
    if (section) counts[section] = (counts[section] || 0) + 1;
    for (const childId of projectTaskChildren(item)) visit(childId, seen);
  };
  visit(itemId, new Set());
  return TASK_SECTIONS.filter((section) => counts[section.id])
    .map((section) => `${section.label.toLowerCase()} ${counts[section.id]}`)
    .join(" · ");
}

function projectTaskTreeNode(model, itemId, depth = 0, seen = new Set()) {
  const item = projectTaskItems(model)[itemId];
  if (!item || seen.has(itemId)) return "";
  const nextSeen = new Set(seen);
  nextSeen.add(itemId);
  const children = projectTaskChildren(item);
  const summary = projectTaskDescendantSummary(model, itemId);
  const label = item.outcome || item.id;
  const type = item.item_type === "group" ? "group" : item.phase || "task";
  const row = `<div class="task-tree-row" style="padding-left:${Math.min(depth * 14, 70)}px">
    <button class="tree-task-main" onclick="showTaskDetail(${jsStringAttr(item.id)});event.stopPropagation()">
      <span class="task-priority">${esc(item.priority || (item.item_type === "group" ? "group" : "P?"))}</span>
      <span class="tree-task-id">${esc(label)}</span>
      <span class="task-status">${esc(type)}</span>
      ${summary ? `<span class="tree-counts">${esc(summary)}</span>` : ""}
    </button>
  </div>`;
  if (!children.length) return row;
  return `<details class="task-tree-node"${depth < 2 ? " open" : ""}><summary>${row}</summary>${children
    .slice(0, 100)
    .map((childId) => projectTaskTreeNode(model, childId, depth + 1, nextSeen))
    .join("")}${children.length > 100 ? `<div class="lane-empty">${children.length - 100} more children</div>` : ""}</details>`;
}

function projectTaskStatusStrip(model) {
  const stats = model.stats || {};
  const integrity = Array.isArray(model.integrity) ? model.integrity : [];
  const capacity = Number.isInteger(model.project?.maxConcurrent) ? model.project.maxConcurrent : "unknown";
  const metric = (label, value, tone = "ok") => `<div class="readout-metric readout-${tone}"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
  return `<section class="project-readout"><div class="readout-panel readout-compact-panel">
    <div class="readout-head"><div><div class="readout-kicker">Task reconciliation</div><h3>${esc(model.project?.id || "Project")}</h3>
      <p>Observed ${esc(projectTaskFormatTime(model.taskStateUpdatedAt))}. The UI presents controller-projected state; it does not decide what runs.</p></div>
      <div class="readout-status"><span>${esc(model.project?.posture || "posture unknown")}</span><span>capacity ${esc(capacity)}</span></div>
    </div>
    <div class="readout-metrics">
      ${metric("Attention", stats.attention || 0, stats.attention ? "bad" : "ok")}
      ${metric("Running", stats.running || 0)}
      ${metric("Ready", stats.ready || 0)}
      ${metric("Pending", stats.pending || 0, stats.pending ? "watch" : "ok")}
      ${metric("Waiting", stats.waiting || 0, stats.waiting ? "watch" : "ok")}
      ${metric("Integrity", integrity.length, integrity.length ? "bad" : "ok")}
    </div>
    ${integrity.length ? `<details class="readout-diagnostics"><summary><span>Integrity findings</span><b>${integrity.length}</b></summary><div class="diagnostic-section issue-list">${integrity
      .map((finding) => `<button class="issue-row issue-p1" onclick="showTaskDetail(${jsStringAttr(finding.task_id)})"><div><b>${esc(finding.code)}</b><span>${esc(finding.task_id)}</span></div><div><small>Observed</small><span>${esc(finding.message)}</span></div></button>`)
      .join("")}</div></details>` : ""}
  </div></section>`;
}

function projectTaskSelectedId() {
  return new URLSearchParams(location.search).get("task") || "";
}

function projectTaskSetSelection(taskId) {
  const url = new URL(location.href);
  if (taskId) url.searchParams.set("task", taskId);
  else url.searchParams.delete("task");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

async function renderProjectKanban(el) {
  const res = await fetch(`/api/projects/tasks?path=${encodeURIComponent(_projectDetailPath)}`);
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("application/json")) {
    const body = await res.text().catch(() => "");
    throw new Error(`Task API returned HTTP ${res.status}: ${body.slice(0, 160) || res.statusText}`);
  }
  const model = await res.json();
  if (!model.available) {
    const details = model.errors?.length ? `<pre>${esc(model.errors.join("\n"))}</pre>` : "";
    el.innerHTML = `<div class="empty-state">${esc(model.reason || "This Agent App has no task attachment.")}${details}</div>`;
    return;
  }

  window._currentProjectTaskTree = model;
  const root = model.rootId && model.items?.[model.rootId] ? projectTaskTreeNode(model, model.rootId) : Object.values(model.items || {})
    .filter((item) => !item.parent_id || !model.items?.[item.parent_id])
    .map((item) => projectTaskTreeNode(model, item.id))
    .join("");
  el.className = "";
  el.innerHTML = `<div class="kanban-shell">
    ${projectTaskStatusStrip(model)}
    <div class="readout-panel readout-compact-panel"><label class="task-reason" for="project-task-filter">Filter live tasks</label><input id="project-task-filter" type="search" placeholder="outcome, id, owner, workflow, Condition" oninput="filterProjectTasks(this.value)" style="width:100%;background:var(--bg2);color:var(--fg);border:1px solid var(--border);border-radius:6px;padding:8px 10px"></div>
    <div class="kanban-board">${TASK_SECTIONS.map((section) => projectTaskSectionHtml(section, model)).join("")}</div>
    <div class="task-tree-panel"><h3>Task tree · groups show structure only</h3><div class="task-tree">${root || '<div class="lane-empty">No live resources</div>'}</div></div>
    ${model.completionTraceError ? `<div class="empty-state">Recent completion trace unavailable: ${esc(model.completionTraceError)}</div>` : ""}
    ${model.recentCompletions?.length ? `<div class="task-tree-panel"><h3>Recent completions</h3><div class="task-tree">${model.recentCompletions.map((completion) => `<button class="tree-task-main" onclick="showTaskDetail(${jsStringAttr(completion.taskId)})"><span class="tree-task-id">${esc(completion.summary || completion.taskId)}</span><span class="task-status">${esc(projectTaskFormatTime(completion.completedAt))}</span></button>`).join("")}</div></div>` : ""}
    <div id="task-detail-drawer" class="task-detail-drawer hidden"></div>
  </div>`;

  const selected = projectTaskSelectedId();
  if (selected) await showTaskDetail(selected, false);
}

function projectTaskList(label, values) {
  return values?.length ? `<h4>${esc(label)}</h4><ul>${values.map((value) => `<li>${esc(value)}</li>`).join("")}</ul>` : "";
}

function projectTaskEvidenceHref(reference) {
  const value = String(reference || "");
  const [kind, ...rest] = value.split(":");
  const target = rest.join(":");
  if (!target) return "";
  if (kind === "session") return `/sessions/${encodeURIComponent(target)}`;
  if (kind === "event" && /^\d+$/.test(target)) return `/events/${encodeURIComponent(target)}`;
  return "";
}

function projectTaskEvidenceList(values) {
  if (!values?.length) return "";
  return `<h4>Evidence</h4><ul>${values.map((value) => {
    const href = projectTaskEvidenceHref(value);
    return `<li>${href ? `<a href="${attrEsc(href)}">${esc(value)}</a>` : esc(value)}</li>`;
  }).join("")}</ul>`;
}

function projectTaskConditionHtml(condition, id) {
  if (!condition) return `<li><b>${esc(id)}</b> · missing Condition</li>`;
  const observed = condition.status?.observed === undefined ? "not observed" : JSON.stringify(condition.status.observed);
  return `<li><b>${esc(condition.spec?.type || id)}</b> · ${esc(condition.spec?.subject || id)} · ${esc(condition.status?.state || "unknown")}
    <div class="task-reason">expected ${esc(JSON.stringify(condition.spec?.expected))} · observed ${esc(observed)} · ${esc(projectTaskFormatTime(condition.status?.observedAt))}</div></li>`;
}

function projectTaskBasicDetail(item, model) {
  const conditions = (item.condition_ids || []).map((id) => projectTaskConditionHtml(model.conditions?.[id], id)).join("");
  const attempt = item.active_attempt;
  return `<div class="task-detail-head"><div><div class="task-detail-id">${esc(item.id)}</div><div class="task-detail-meta">${esc(item.priority || "P?")} · ${esc(item.phase || item.item_type)} · ${esc(item.mode || item.category || "structure")}</div></div>
    <button onclick="closeTaskDetail()">Close</button></div>
    <p>${esc(item.outcome || item.summary || "Structural group")}</p>
    <div class="task-detail-grid">
      <div><b>Owner</b><span>${esc(item.owner || model.project?.owner || "convention fallback")}</span></div>
      <div><b>Handler binding</b><span>${esc(item.workflow ? `workflow ${item.workflow}` : "owner")}</span></div>
      <div><b>Parent</b><span>${esc(item.parent_id || "none")}</span></div>
      <div><b>Category</b><span>${esc(item.category || "work")}</span></div>
      <div><b>Generation</b><span>${esc(`${item.observed_generation ?? "-"} observed / ${item.generation ?? "-"} desired`)}</span></div>
      <div><b>Readiness</b><span>${esc(item.readiness ? `${item.readiness.state}: ${item.readiness.reason}` : "not applicable")}</span></div>
      <div><b>Status updated</b><span>${esc(projectTaskFormatTime(item.status_updated_at))}</span></div>
      <div><b>Attempts</b><span>${esc(item.attempt_count ?? 0)}</span></div>
    </div>
    ${item.summary ? `<h4>Current observation</h4><p>${esc(item.summary)}</p>` : ""}
    ${projectTaskList("Acceptance", item.acceptance || [])}
    ${projectTaskList("Outputs", item.outputs || [])}
    ${projectTaskEvidenceList(item.evidence || [])}
    ${conditions ? `<h4>Conditions</h4><ul>${conditions}</ul>` : ""}
    ${attempt ? `<h4>Current attempt</h4><p>${esc(attempt.handler)} · ${esc(attempt.state)} · ${esc(attempt.reason)} · ${esc(projectTaskFormatTime(attempt.started_at))}</p>` : ""}
    ${item.trigger ? `<details><summary class="task-reason">Trigger</summary><pre>${esc(JSON.stringify(item.trigger, null, 2))}</pre></details>` : ""}
    <div id="task-detail-trace" class="task-reason">Loading reconciliation trace…</div>
    ${item.item_type === "task" ? projectTaskSteeringHtml() : ""}`;
}

function projectTaskSteeringHtml() {
  return `<h4>Ask the owner</h4>
    <textarea id="kanban-steer-text" class="kanban-steer-text" placeholder="Prepare an audit, challenge, split, unblock, or escalation request."></textarea>
    <div class="kanban-steer-actions"><button onclick="sendProjectSteering()">Send request</button><button onclick="prefillTaskSteering('audit')">Audit</button><button onclick="prefillTaskSteering('split')">Split</button><button onclick="prefillTaskSteering('challenge')">Challenge</button><button onclick="prefillTaskSteering('unblock')">Unblock</button><button onclick="prefillTaskSteering('escalate')">Escalate</button></div>
    <div id="kanban-steer-status" class="kanban-steer-status"></div>`;
}

function projectTaskTimelineHtml(timeline) {
  if (!timeline?.length) return '<div class="task-reason">No task-linked reconciliation records are available.</div>';
  return `<h4>Recent reconciliation</h4><ul>${timeline.map((row) => `<li><b>${esc(row.eventType)}</b> · ${esc(projectTaskFormatTime(row.timestamp))}<div class="task-reason">${esc(row.disposition || row.summary || "No summary")}${row.handler ? ` · ${esc(row.handler)}` : ""}</div></li>`).join("")}</ul>`;
}

async function showTaskDetail(taskId, updateUrl = true) {
  const model = window._currentProjectTaskTree;
  const drawer = document.getElementById("task-detail-drawer");
  if (!model || !drawer || !taskId) return;
  const item = projectTaskItems(model)[taskId];
  drawer.classList.remove("hidden");
  drawer.dataset.taskId = taskId;
  if (updateUrl) projectTaskSetSelection(taskId);
  drawer.innerHTML = item ? projectTaskBasicDetail(item, model) : `<div class="task-detail-head"><div><div class="task-detail-id">${esc(taskId)}</div><div class="task-detail-meta">Looking for completed task</div></div><button onclick="closeTaskDetail()">Close</button></div><div id="task-detail-trace">Loading…</div>`;
  drawer.scrollIntoView({ block: "nearest" });

  try {
    const res = await fetch(`/api/projects/task?path=${encodeURIComponent(_projectDetailPath)}&taskId=${encodeURIComponent(taskId)}`);
    const detail = await res.json().catch(() => ({}));
    if (drawer.dataset.taskId !== taskId) return;
    if (!res.ok) throw new Error(detail.error || `HTTP ${res.status}`);
    if (detail.kind === "completed") {
      const completion = detail.completion || {};
      drawer.innerHTML = `<div class="task-detail-head"><div><div class="task-detail-id">${esc(taskId)}</div><div class="task-detail-meta">completed finite work · generation ${esc(completion.generation ?? "unknown")}</div></div><button onclick="closeTaskDetail()">Close</button></div>
        <p>${esc(completion.outcome || completion.summary || "Task completed and left the live graph.")}</p>
        ${projectTaskEvidenceList(completion.evidence || [])}${projectTaskTimelineHtml(completion.timeline)}`;
      return;
    }
    const trace = document.getElementById("task-detail-trace");
    if (trace) trace.outerHTML = `${detail.task?.dependencies?.length ? `<h4>Dependencies</h4><ul>${detail.task.dependencies.map((dependency) => `<li><b>${esc(dependency.id)}</b> · ${esc(dependency.disposition)}</li>`).join("")}</ul>` : ""}${projectTaskTimelineHtml(detail.task?.timeline)}`;
  } catch (error) {
    const trace = document.getElementById("task-detail-trace");
    if (trace) trace.innerHTML = `<span style="color:var(--red)">Trace unavailable: ${esc(error?.message || String(error))}</span>`;
  }
}

function closeTaskDetail() {
  document.getElementById("task-detail-drawer")?.classList.add("hidden");
  projectTaskSetSelection("");
}

function filterProjectTasks(value) {
  const needle = String(value || "").trim().toLowerCase();
  for (const card of document.querySelectorAll(".kanban-card[data-task-search]")) {
    card.hidden = Boolean(needle) && !String(card.dataset.taskSearch || "").includes(needle);
  }
}

function selectedTaskForSteering() {
  const id = document.getElementById("task-detail-drawer")?.dataset.taskId;
  return id ? projectTaskItems(window._currentProjectTaskTree)[id] || null : null;
}

function prefillTaskSteering(action) {
  const task = selectedTaskForSteering();
  const textarea = document.getElementById("kanban-steer-text");
  if (!task || !textarea) return;
  const conditionIds = (task.condition_ids || []).join(", ") || "none";
  textarea.value = `[task-owner-request]\nproject: ${window._currentProjectTaskTree?.project?.id || projectIdFromPath(_projectDetailPath)}\ntask: ${task.id}\naction: ${action}\noutcome: ${task.outcome || "unspecified"}\nphase: ${task.phase}\ngeneration: ${task.generation}\nsummary: ${task.summary || "none"}\nconditions: ${conditionIds}\nreadiness: ${task.readiness?.state || "not-applicable"} — ${task.readiness?.reason || ""}\n\nExpected response: inspect current evidence, then record concrete progress, an exact wait, an escalation, a task split, or an accepted no-op.`;
  textarea.focus();
}

async function sendProjectSteering() {
  const textarea = document.getElementById("kanban-steer-text");
  const status = document.getElementById("kanban-steer-status");
  const message = String(textarea?.value || "").trim();
  const task = selectedTaskForSteering();
  if (!message || !task) {
    if (status) status.textContent = "Select a task and prepare a request first.";
    return;
  }
  if (status) status.textContent = "Submitting…";
  try {
    const project = window._currentProjectTaskTree?.project?.id || projectIdFromPath(_projectDetailPath).replace(/\.app$/, "");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "project.owner.requested",
        source: "web-ui",
        target: { project, taskId: task.id },
        data: { project, projectId: project, projectPath: _projectDetailPath, taskId: task.id, action: "task-review", reason: message, params: { comment: message } },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
    if (textarea) textarea.value = "";
    if (status) status.textContent = body.eventId
      ? `Recorded as event ${body.eventId}. Await later delivery and reconciliation evidence.`
      : "Request sent, but no durable event receipt was returned.";
  } catch (error) {
    if (status) status.textContent = `Failed: ${error?.message || String(error)}`;
  }
}

window.showTaskDetail = showTaskDetail;
window.closeTaskDetail = closeTaskDetail;
window.filterProjectTasks = filterProjectTasks;
window.prefillTaskSteering = prefillTaskSteering;
window.sendProjectSteering = sendProjectSteering;
