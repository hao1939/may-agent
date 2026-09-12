// Human Task reads are shared with Console and Telegram.
// This adapter owns only one page and one detail, never a work lifecycle.
const TASK_SECTIONS = [
  { id: "attention", label: "Needs review" },
  { id: "running", label: "Working" },
  { id: "pending", label: "Queued" },
  { id: "waiting", label: "Waiting" },
  { id: "up-to-date", label: "Up to date" },
  { id: "done", label: "Done" },
  { id: "closed", label: "Closed" },
  { id: "cancelled", label: "Cancelled" },
];
const PROJECT_TASK_PAGE_SIZE = 30;
let projectTaskBoard = null;

function projectTaskFormatTime(value) {
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) return "unknown";
  const minutes = Math.floor(Math.max(0, Date.now() - parsed) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function projectTaskCard(task) {
  const search = [task.taskId, task.ref, task.outcome, task.summary].filter(Boolean).join(" ").toLowerCase();
  return `<button class="kanban-card" data-task-search="${attrEsc(search)}" onclick="showTaskDetail(${jsStringAttr(task.taskId)})">
    <span class="task-id">${esc(task.ref)} · ${esc(task.taskId)}</span>
    <span class="task-goal">${esc(task.outcome)}</span>
    <span class="task-reason">${esc(task.summary || task.statusDetail || "No current observation")}</span>
    <span class="task-output">${esc(projectTaskFormatTime(task.updatedAt))} · ${task.humanAction ? "needs you" : "no action from you"}</span>
  </button>`;
}

function projectTaskSetSelection(taskId) {
  const url = new URL(location.href);
  if (taskId) url.searchParams.set("task", taskId);
  else url.searchParams.delete("task");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function projectTaskBoardIsCurrent(board) {
  return (
    projectTaskBoard === board &&
    board.el.isConnected &&
    board.el.dataset.projectTab === "kanban" &&
    _projectDetailPath === board.path
  );
}

async function projectTaskRead(path, params) {
  const res = await fetch(`${path}?${new URLSearchParams(params)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Task API returned HTTP ${res.status}`);
  return body;
}

async function renderProjectKanban(el, options = {}) {
  el.dataset.projectTab = "kanban";
  const board = {
    el,
    path: _projectDetailPath,
    appId: _currentProjectDetail?.app?.appId,
    status: options.status || "",
    includeDone: options.includeDone === true,
    page: options.page || 1,
    task: null,
    detailRead: null,
  };
  projectTaskBoard = board;
  if (!board.appId) {
    el.innerHTML = '<div class="empty-state">This project has no App Task identity.</div>';
    return;
  }
  el.innerHTML = '<div class="empty-state">Loading Tasks…</div>';
  try {
    const page = await projectTaskRead("/api/tasks", {
      appId: board.appId,
      limit: String(PROJECT_TASK_PAGE_SIZE),
      includeDone: String(board.includeDone),
      ...(board.status ? { status: board.status } : {}),
      ...(options.cursor ? { cursor: options.cursor } : {}),
    });
    if (!projectTaskBoardIsCurrent(board)) return;
    if (!Array.isArray(page.items)) throw new Error("Invalid Task page");
    board.nextCursor = page.nextCursor;
    el.className = "";
    el.innerHTML = `<div class="kanban-shell">
      <div class="readout-panel readout-compact-panel task-board-controls">
        <h3>${esc(board.appId)} Tasks</h3>
        <p>Page ${board.page} · ${page.items.length} Tasks · newest changes first. Counts and text filtering apply to this page only.</p>
        <p class="task-reason">Up to date means recurring work is currently satisfied, not finished. Open a Task for its full goal, Conditions, dependencies, and history.</p>
        <label>State <select id="project-task-status" onchange="reloadProjectTasks()">
          <option value="">All states</option>${TASK_SECTIONS.map((s) => `<option value="${s.id}"${s.id === board.status ? " selected" : ""}>${s.label}</option>`).join("")}
        </select></label>
        <label><input id="project-task-history" type="checkbox"${board.includeDone ? " checked" : ""} onchange="reloadProjectTasks()">Include Task history</label>
        <button onclick="reloadProjectTasks()">Refresh / newest page</button>
        <button id="project-tasks-next" onclick="nextProjectTasks()"${page.nextCursor ? "" : " disabled"}>Next page</button>
        <label for="project-task-filter">Filter this page</label>
        <input id="project-task-filter" type="search" placeholder="goal, Task ID, reference, summary" oninput="filterProjectTasks(this.value)">
      </div>
      <div class="kanban-board">${
        TASK_SECTIONS.filter((s) => page.items.some((t) => t.status === s.id))
          .map((s) => {
            const tasks = page.items.filter((t) => t.status === s.id);
            return `<section class="kanban-lane"><header><span>${s.label}</span><b>${tasks.length}</b></header><div class="kanban-lane-body">${tasks.map(projectTaskCard).join("")}</div></section>`;
          })
          .join("") || '<div class="empty-state">No Tasks in this page/filter.</div>'
      }</div>
      <div id="task-detail-drawer" class="task-detail-drawer hidden"></div>
    </div>`;
    const selected = new URLSearchParams(location.search).get("task");
    if (selected) await showTaskDetail(selected, false);
  } catch (error) {
    if (projectTaskBoardIsCurrent(board))
      el.innerHTML = `<div class="empty-state">Task read unavailable: ${esc(error.message)} <button onclick="reloadProjectTasks()">Retry</button></div>`;
  }
}

function reloadProjectTasks() {
  const board = projectTaskBoard;
  if (!board || !projectTaskBoardIsCurrent(board)) return;
  return renderProjectKanban(board.el, {
    status: document.getElementById("project-task-status")?.value ?? board.status,
    includeDone: document.getElementById("project-task-history")?.checked ?? board.includeDone,
  });
}

function nextProjectTasks() {
  const board = projectTaskBoard;
  if (!board?.nextCursor || !projectTaskBoardIsCurrent(board)) return;
  return renderProjectKanban(board.el, { ...board, page: board.page + 1, cursor: board.nextCursor });
}

function projectTaskList(label, values) {
  return values?.length ? `<h4>${esc(label)}</h4><ul>${values.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : "";
}

function projectTaskEvidenceHref(reference) {
  const [kind, ...rest] = String(reference || "").split(":");
  const target = rest.join(":");
  if (!target) return "";
  if (kind === "session") return `/sessions/${encodeURIComponent(target)}`;
  if (kind === "event" && /^\d+$/.test(target)) return `/events/${encodeURIComponent(target)}`;
  return "";
}

function projectTaskEvidenceList(values) {
  return values?.length
    ? `<h4>Evidence</h4><ul>${values
        .map((v) => {
          const href = projectTaskEvidenceHref(v);
          return `<li>${href ? `<a href="${attrEsc(href)}">${esc(v)}</a>` : esc(v)}</li>`;
        })
        .join("")}</ul>`
    : "";
}

function projectTaskConditionHtml({ condition, id }) {
  if (!condition) return `<li><b>${esc(id)}</b> · missing Condition</li>`;
  return `<li><b>${esc(condition.spec.type)}</b> · ${esc(condition.spec.subject)} · ${esc(condition.status.state)}
    <div class="task-reason">expected ${esc(JSON.stringify(condition.spec.expected))} · observed ${esc(JSON.stringify(condition.status.observed) ?? "not observed")} · ${esc(projectTaskFormatTime(condition.status.observedAt))}</div>
    <pre>${esc(JSON.stringify(condition.spec, null, 2))}</pre></li>`;
}

function projectTaskDetailHtml(task) {
  const d = task.diagnostics;
  const field = (label, value) => `<div><b>${esc(label)}</b><span>${esc(value ?? "unknown")}</span></div>`;
  return `<div class="task-detail-head"><div class="task-detail-id">${esc(task.appId)} / ${esc(task.taskId)} · ${esc(task.ref)}</div><button onclick="closeTaskDetail()">Close</button></div>
    <h4>Goal</h4><p>${esc(task.outcome)}</p>
    <h4>State</h4><p>${esc(task.status)} · ${esc(task.statusDetail)}</p>
    ${task.progress ? `<h4>Current progress</h4><p>${esc(task.progress.stage)} · ${esc(task.progress.message || "")} · ${esc(projectTaskFormatTime(task.progress.updatedAt))}</p>` : ""}
    ${task.summary ? `<h4>Current observation</h4><p>${esc(task.summary)}</p>` : ""}
    ${task.response ? `<h4>Result</h4><pre>${esc(task.response)}</pre>` : ""}
    ${projectTaskList("Expected result", task.acceptance)}
    <h4>You</h4><p>${esc(task.humanAction?.requestedAction || "Nothing needed right now.")}</p>
    ${task.humanAction?.task ? `<p>Action belongs to ${esc(task.humanAction.task.appId)} / ${esc(task.humanAction.task.taskId)} · ${esc(task.humanAction.task.ref)}</p>` : ""}
    ${projectTaskList(
      "Waiting on",
      task.waitingOn?.map((w) =>
        w.kind === "condition"
          ? `${w.type}: ${w.subject}`
          : `${w.appId}${w.taskId ? ` / ${w.taskId}` : ""}: ${w.status}`,
      ),
    )}
    ${task.requestedBy ? `<h4>Requested by</h4><p>${esc(task.requestedBy.appId)} / ${esc(task.requestedBy.taskId)} · ${esc(task.requestedBy.outcome)}</p>` : ""}
    <div class="task-detail-grid">
      ${field("Generation", `${d?.observedGeneration ?? "—"} observed / ${task.generation} desired`)}
      ${field("Resource version", task.resourceVersion)}${field("Updated", projectTaskFormatTime(task.updatedAt))}
      ${d ? `${field("Parent", d.parentId)}${field("Owner override", d.owner || "not specified")}${field("Priority", d.priority || "P2")}${field("Category", d.category || "work")}${field("Mechanism", d.workflow ? `workflow ${d.workflow}` : d.executor || "agent")}${field("Ready to claim", d.ready ? "yes" : "no")}${field("Retained attempts", d.attemptCount)}` : ""}
    </div>
    ${projectTaskList("Outputs", d?.outputs)}${projectTaskEvidenceList(task.evidence)}
    ${task.execution ? `<h4>Current attempt</h4><p>${esc(task.execution.attemptId)}${d?.attempt ? ` · ${esc(d.attempt.handler)} · ${esc(d.attempt.state)} · ${esc(d.attempt.reason)} · ${esc(projectTaskFormatTime(d.attempt.startedAt))}` : ""}</p>${projectTaskEvidenceList(task.execution.sessionId ? [`session:${task.execution.sessionId}`] : [])}` : ""}
    ${d?.attempt?.trigger ? `<details><summary>Attempt trigger</summary><pre>${esc(JSON.stringify(d.attempt.trigger, null, 2))}</pre></details>` : ""}
    ${d?.conditions.length ? `<h4>Conditions</h4><ul>${d.conditions.map(projectTaskConditionHtml).join("")}</ul>` : ""}
    ${d?.conditionsTruncated ? "<p>Only the first 100 Conditions are shown.</p>" : ""}
    ${d?.dependencies.length ? `<h4>Dependencies</h4><ul>${d.dependencies.map((dep) => `<li>${["missing", "group"].includes(dep.status) ? esc(dep.id) : `<button onclick="showTaskDetail(${jsStringAttr(dep.id)})">${esc(dep.id)}</button>`} · ${esc(dep.status)}</li>`).join("")}</ul>` : ""}
    ${d?.dependenciesTruncated ? "<p>Only the first 100 dependencies are shown.</p>" : ""}
    <h4>Recent reconciliation history</h4><p class="task-reason">Historical evidence, including older generations/attempts; not the current Task state.</p>
    ${task.historyError ? `<p>History unavailable: ${esc(task.historyError)}</p>` : projectTaskHistoryHtml(task.history)}
    ${task.historyTruncated ? "<p>Only the newest 20 records are shown.</p>" : ""}
    ${!task.terminal ? projectTaskSteeringHtml() : ""}`;
}

function projectTaskHistoryHtml(history) {
  return history?.length
    ? `<ul>${history.map((h) => `<li><a href="/events/${encodeURIComponent(h.eventId)}">${esc(h.eventType)}</a> · ${esc(projectTaskFormatTime(h.timestamp))}<div class="task-reason">${esc(h.summary || h.disposition || "No summary")} · generation ${esc(h.generation ?? "unknown")} · attempt ${esc(h.attemptId || "unknown")}${h.handler ? ` · ${esc(h.handler)}` : ""}</div></li>`).join("")}</ul>`
    : "<p>No task-linked records retained.</p>";
}

async function showTaskDetail(taskId, updateUrl = true) {
  const board = projectTaskBoard;
  const drawer = document.getElementById("task-detail-drawer");
  if (!board || !drawer || !taskId || !projectTaskBoardIsCurrent(board)) return;
  const read = {};
  board.detailRead = read;
  board.task = null;
  drawer.classList.remove("hidden");
  drawer.innerHTML = '<button onclick="closeTaskDetail()">Close</button><p>Loading Task…</p>';
  if (updateUrl) projectTaskSetSelection(taskId);
  drawer.scrollIntoView({ block: "nearest" });
  const current = () => projectTaskBoardIsCurrent(board) && board.detailRead === read && drawer.isConnected;
  try {
    const task = await projectTaskRead("/api/task", { appId: board.appId, taskId });
    if (!current()) return;
    if (task.appId !== board.appId || task.taskId !== taskId) throw new Error("Task identity mismatch");
    drawer.innerHTML = projectTaskDetailHtml(task);
    board.task = task;
  } catch (error) {
    if (current())
      drawer.innerHTML = `<button onclick="closeTaskDetail()">Close</button><p>Task read unavailable: ${esc(error.message)}</p>`;
  }
}

function closeTaskDetail() {
  if (projectTaskBoard) {
    projectTaskBoard.detailRead = null;
    projectTaskBoard.task = null;
  }
  document.getElementById("task-detail-drawer")?.classList.add("hidden");
  projectTaskSetSelection("");
}

function filterProjectTasks(value) {
  const needle = String(value || "")
    .trim()
    .toLowerCase();
  for (const card of document.querySelectorAll(".kanban-card[data-task-search]")) {
    card.hidden = Boolean(needle) && !card.dataset.taskSearch.includes(needle);
  }
}

function projectTaskSteeringHtml() {
  return `<h4>Steer the App</h4><textarea id="kanban-steer-text" class="kanban-steer-text" placeholder="Prepare an audit, challenge, split, unblock, or escalation request."></textarea>
    <div class="kanban-steer-actions"><button onclick="sendProjectSteering()">Send request</button>${["audit", "split", "challenge", "unblock", "escalate"].map((a) => `<button onclick="prefillTaskSteering('${a}')">${a}</button>`).join("")}</div>
    <div id="kanban-steer-status" class="kanban-steer-status"></div>`;
}

function selectedTaskForSteering() {
  const board = projectTaskBoard;
  return board && projectTaskBoardIsCurrent(board) && !board.task?.terminal ? board.task : null;
}

function prefillTaskSteering(action) {
  const task = selectedTaskForSteering();
  const textarea = document.getElementById("kanban-steer-text");
  if (!task || !textarea) return;
  textarea.value = `[task-app-request]\nproject: ${task.appId}\ntask: ${task.taskId}\naction: ${action}\noutcome: ${task.outcome}\nstate: ${task.status}\ngeneration: ${task.generation}\nsummary: ${task.summary || "none"}\n\nExpected response: inspect current evidence, then record concrete progress, an exact wait, an escalation, a task split, or an accepted no-op.`;
  textarea.focus();
}

async function sendProjectSteering() {
  const textarea = document.getElementById("kanban-steer-text");
  const status = document.getElementById("kanban-steer-status");
  const message = String(textarea?.value || "").trim();
  const task = selectedTaskForSteering();
  if (!message || !task) {
    if (status) status.textContent = "Select a Task and prepare a request first.";
    return;
  }
  if (status) status.textContent = "Submitting…";
  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "project.owner.requested",
        target: { appId: task.appId, taskId: task.taskId },
        data: {
          project: task.appId,
          projectId: task.appId,
          projectPath: projectTaskBoard.path,
          taskId: task.taskId,
          action: "task-review",
          reason: message,
          params: { comment: message },
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
    if (textarea) textarea.value = "";
    if (status)
      status.textContent = body.eventId
        ? `Recorded as event ${body.eventId}. Await later delivery and reconciliation evidence.`
        : "Request sent, but no durable event receipt was returned.";
  } catch (error) {
    if (status) status.textContent = `Failed: ${error.message}`;
  }
}
