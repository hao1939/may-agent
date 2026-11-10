// A standalone view of public Task facts. Reads and task-scoped input do not
// start sessions or make model calls.
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const apiBase = (params.get("apiBase") || "").replace(/\/$/, "");
const readOnly = params.get("readOnly") === "1";
function apiPath(path) {
  if (
    !/^(?:\/[A-Za-z0-9._~-]+)*$/.test(apiBase) ||
    apiBase.split("/").some((part) => part === "." || part === "..")
  )
    throw new Error(
      "Invalid apiBase. Use a same-origin path such as /k8s-upgrade.",
    );
  return apiBase + path;
}
const state = {
  appId: "",
  taskId: "",
  version: "",
  task: null,
  taskError: "",
  epoch: 0,
  refreshing: false,
  refreshAgain: false,
  refreshedAt: null,
  session: null,
  items: [],
  transcriptLoaded: false,
  transcriptError: "",
  cursor: null,
  cursors: new Set(),
  olderLoading: false,
  receipts: [],
  socket: null,
  retries: 0,
  retryTimer: null,
  pollTimer: null,
  wakeTimer: null,
  socketTimer: null,
  delivery: null,
  document: null,
  documentError: "",
  documentLoading: false,
};
const escapes = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => escapes[char]);
const plain = (value) => (typeof value === "string" ? value : "");
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const date = (value) => {
  if (value === undefined || value === null || value === "") return "Unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Unknown"
    : parsed.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
};
function linkedText(value) {
  const text = String(value ?? "");
  const pattern = /https?:\/\/[^\s<>"'\[\]]+/g;
  let html = "",
    offset = 0;
  for (const match of text.matchAll(pattern)) {
    let url = match[0].replace(/[.,;:!?)}]+$/, "");
    html += esc(text.slice(offset, match.index));
    html += `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
    offset = match.index + url.length;
  }
  return html + esc(text.slice(offset));
}
function showNotice(id, message) {
  $(id).textContent = message;
  $(id).hidden = !message;
}
function taskQuery(extra = {}) {
  return new URLSearchParams({
    appId: state.appId,
    taskId: state.taskId,
    ...extra,
  });
}
async function readJson(path, options = {}) {
  const response = await fetch(apiPath(path), {
    credentials: "same-origin",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
    ...options,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    /* Handled as unavailable below. */
  }
  if (!response.ok || !record(data) || data.error) {
    const error = new Error(
      plain(data?.error) || `Request failed (HTTP ${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
function scopeMatches(value) {
  return value?.appId === state.appId && value?.taskId === state.taskId;
}
function setConnection(label, mode = "") {
  $("connection-status").textContent = label;
  $("connection-status").dataset.state = mode;
}
function badge(status) {
  return `<span class="badge" data-tone="${esc(status)}">${esc(status || "Unknown")}</span>`;
}
function list(items, kind = "plain-list") {
  return `<ul class="${kind}">${items.map((item) => `<li>${linkedText(item)}</li>`).join("")}</ul>`;
}
function waitLabel(wait) {
  if (!record(wait)) return "Unspecified dependency";
  return (
    plain(wait.outcome) ||
    plain(wait.subject) ||
    [
      plain(wait.kind),
      plain(wait.appId),
      plain(wait.taskId),
      plain(wait.status),
    ]
      .filter(Boolean)
      .join(" · ") ||
    "Unspecified dependency"
  );
}
function taskLinks(task) {
  const sources = [
    task.outcome,
    task.summary,
    task.response,
    ...(Array.isArray(task.facts) ? task.facts : []),
  ];
  const urls = new Set();
  for (const source of sources) {
    for (const match of plain(source).matchAll(/https?:\/\/[^\s<>"'\[\]]+/g)) {
      const url = match[0].replace(/[.,;:!?)}]+$/, "");
      if (/\/(?:pull|pullrequest|pullrequests)\/\d+/i.test(url)) urls.add(url);
    }
  }
  return [...urls];
}
function renderSessionFacts() {
  const status = state.session
    ? state.task && !state.taskError
      ? state.task.status
      : "Session available"
    : "Unavailable";
  $("session-status").textContent = status;
  $("session-status").dataset.active = String(status === "running");
  const detail = $("details-session-id");
  if (detail)
    detail.textContent =
      state.task?.execution?.sessionId ||
      state.session?.id ||
      "No current session reported";
}
function renderTask() {
  showNotice(
    "task-error",
    state.taskError
      ? `${state.task ? "Current task facts are unavailable. Showing the previous snapshot. " : "Task unavailable. "}${state.taskError}`
      : "",
  );
  const task = state.task;
  if (!task) {
    updateComposer();
    return;
  }
  $("task-ref").textContent = task.ref || task.taskId;
  $("task-ref").title = task.taskId;
  $("page-subtitle").textContent = `${task.appId} / ${task.ref || task.taskId}`;
  const progress = record(task.progress) ? task.progress : null;
  const savedResult =
    !progress &&
    task.acceptedEvidence?.available === true &&
    plain(task.summary);
  const human = plain(task.humanAction?.requestedAction);
  const waits = Array.isArray(task.waitingOn) ? task.waitingOn : null;
  const acceptance = Array.isArray(task.acceptance)
    ? task.acceptance.filter((item) => typeof item === "string")
    : null;
  const facts = Array.isArray(task.facts)
    ? task.facts.filter((item) => typeof item === "string")
    : null;
  let next =
    human ||
    (waits?.length ? `Waiting on: ${waits.map(waitLabel).join("; ")}` : "");
  $("overview-panel").innerHTML = `
    <div class="goal-heading"><span class="section-eyebrow">Task goal</span></div>
    <h2 class="goal-title">${esc(task.outcome || "Goal unavailable")}</h2>
    <button class="text-button" id="full-goal-button" type="button">Read full goal in Details ↗</button>
    ${task.summary ? `<p class="goal-summary">${linkedText(task.summary)}</p>` : '<p class="goal-summary unknown">No summary reported.</p>'}
    <div class="state-grid">
      <div class="state-card"><span class="state-card-label">TASK STATE</span>${badge(task.status)}<p>${esc(task.statusDetail || "No state detail reported.")}</p></div>
      <div class="state-card"><span class="state-card-label">${savedResult ? "LATEST RESULT" : "LATEST PROGRESS"}</span><strong class="progress-value">${esc(savedResult ? "Saved" : plain(progress?.stage) || "Not reported")}</strong><p>${linkedText(savedResult || plain(progress?.message) || "No execution progress has been reported.")}</p>${progress?.updatedAt ? `<p>${esc(date(progress.updatedAt))}</p>` : ""}</div>
    </div>
    <div class="next-action${human ? " human" : ""}"><h3>${human ? "ACTION NEEDED FROM YOU" : "NEXT ACTION"}</h3><p${next ? "" : ' class="unknown"'}>${linkedText(next || "No next action reported.")}</p></div>
    <section class="section"><h3>Outstanding dependencies${waits?.length ? `<span class="count">${waits.length} reported</span>` : ""}</h3>${waits?.length ? list(waits.map(waitLabel)) : `<p class="unknown">${waits ? "No outstanding dependencies reported." : "No dependency information reported."}</p>`}</section>
    <section class="section"><h3>Requirements${acceptance ? `<span class="count">${acceptance.length} reported</span>` : ""}</h3>${acceptance?.length ? list(acceptance, "requirements-list") + '<p class="requirements-note">Task requirements. Individual verification results have not been inferred.</p>' : `<p class="unknown">${acceptance ? "No requirements reported." : "Requirements unavailable."}</p>`}</section>
    <section class="section"><h3>Evidence${facts ? `<span class="count">${facts.length} reported facts</span>` : ""}</h3>${facts?.length ? list(facts, "evidence-list") : `<p class="unknown">${facts ? "No evidence reported." : "Evidence unavailable."}</p>`}</section>
    <section class="section"><h3>Pull requests</h3>${taskLinks(task).length ? list(taskLinks(task), "evidence-list") : '<p class="unknown">No pull request links reported in task facts.</p>'}</section>`;
  const history = Array.isArray(task.history) ? task.history : null;
  const field = (label, value, mono = false) =>
    `<dt>${label}</dt><dd${mono ? ' class="mono"' : ""}>${esc(value ?? "Unknown")}</dd>`;
  $("details-panel").innerHTML = `
    <span class="section-eyebrow">Task details</span>
    <section class="section"><dl class="metadata">${field("App", task.appId, true)}${field("Task ID", task.taskId, true)}${field("Generation", task.generation)}${field("State", task.status)}${field("Updated", date(task.updatedAt))}${field("Attempt", task.execution?.attemptId || "No current attempt reported", true)}<dt>Session</dt><dd class="mono" id="details-session-id"></dd></dl></section>
    <section class="section"><h3>Goal</h3><p class="goal-summary">${linkedText(task.outcome || "Goal unavailable")}</p></section>
    <section class="section"><h3>Task response</h3>${task.response ? `<p class="goal-summary">${linkedText(task.response)}</p>` : '<p class="unknown">No task response reported.</p>'}</section>
    <section class="section" id="progress-document-section">${renderDocument()}</section>
    <section class="section"><h3>Task history${history ? `<span class="count">${history.length} events in this snapshot</span>` : ""}</h3>${task.historyError ? `<p class="notice">History unavailable: ${esc(task.historyError)}</p>` : ""}${history?.length ? `<ol class="history-list">${history.map((event) => `<li><p>${linkedText(event.summary || event.eventType || "Task event")}</p><small>${esc(date(event.timestamp))}${event.disposition ? ` · ${esc(event.disposition)}` : ""}${Number.isInteger(event.generation) ? ` · generation ${esc(event.generation)}` : ""}</small></li>`).join("")}</ol>` : `<p class="unknown">${history ? "No history events in this snapshot." : "Task history unavailable."}</p>`}${task.historyTruncated ? '<p class="section-note">This is a partial history. Earlier events are outside this task snapshot.</p>' : ""}</section>`;
  $("task-footer").textContent =
    `${state.taskError ? "Previous snapshot" : "Task updated"} ${date(task.updatedAt)} · Read ${date(state.refreshedAt)}`;
  $("full-goal-button").addEventListener("click", () =>
    selectTab("details", true),
  );
  renderSessionFacts();
  updateComposer();
}

// Render only the configured source document. Markdown is escaped; source HTML
// is never executed, and rows are not turned into inferred completion totals.
function markdown(source) {
  const lines = source.split(/\r?\n/),
    out = [];
  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      const code = [];
      while (++index < lines.length && !/^\s*```/.test(lines[index]))
        code.push(lines[index]);
      out.push(`<pre>${esc(code.join("\n"))}</pre>`);
    } else if (
      line.includes("|") &&
      index + 1 < lines.length &&
      cells(lines[index + 1]).every((cell) => /^:?-{3,}:?$/.test(cell))
    ) {
      const headers = cells(line);
      index++;
      const rows = [];
      while (
        index + 1 < lines.length &&
        lines[index + 1].includes("|") &&
        lines[index + 1].trim()
      )
        rows.push(cells(lines[++index]));
      out.push(
        `<div class="document-table"><table><thead><tr>${headers.map((cell) => `<th>${linkedText(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, column) => `<td>${linkedText(row[column] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      );
    } else if (/^#{1,6}\s/.test(line)) {
      out.push(`<h4>${linkedText(line.replace(/^#{1,6}\s+/, ""))}</h4>`);
    } else if (line.trim()) {
      out.push(`<p>${linkedText(line)}</p>`);
    }
  }
  return out.join("");
}
function documentPath() {
  const project = params.get("progressProject"),
    file = params.get("progressFile");
  return project && file
    ? "/api/projects/artifact?" + new URLSearchParams({ path: project, file })
    : null;
}
function renderDocument() {
  const path = documentPath();
  let body = '<p class="unknown">No progress document configured.</p>';
  if (path) {
    body = `<p class="document-source"><a href="${esc(apiPath(path))}" target="_blank" rel="noopener noreferrer">Source document ↗</a><span>${esc(params.get("progressProject"))} / ${esc(params.get("progressFile"))}</span></p>`;
    if (state.documentError)
      body += `<p class="notice">Document unavailable. ${esc(state.documentError)}</p>`;
    if (state.document !== null)
      body += `<div class="source-document">${markdown(state.document)}</div>`;
    else if (!state.documentError)
      body += `<p class="unknown">${state.documentLoading ? "Loading source document…" : "Source document unavailable."}</p>`;
  }
  return `<h3>Version progress document</h3>${body}`;
}
async function loadDocument(epoch) {
  const path = documentPath();
  if (!path || state.documentLoading) return;
  state.documentLoading = true;
  try {
    const data = await readJson(path);
    if (epoch !== state.epoch) return;
    if (typeof data.content !== "string")
      throw new Error("Invalid document response.");
    state.document = data.content;
    state.documentError = "";
  } catch (error) {
    if (epoch === state.epoch) state.documentError = error.message;
  } finally {
    if (epoch === state.epoch) {
      state.documentLoading = false;
      if ($("progress-document-section"))
        $("progress-document-section").innerHTML = renderDocument();
    }
  }
}

function visibleItems(items) {
  if (!Array.isArray(items)) throw new Error("Invalid transcript response.");
  return items.filter(
    (item) =>
      record(item) &&
      typeof item.id === "string" &&
      ["user", "assistant", "tool"].includes(item.role) &&
      typeof item.type === "string" &&
      !/reason|analysis|developer|system|instruction|prompt/i.test(item.type) &&
      (typeof item.text === "string" || typeof item.command === "string"),
  );
}
function resetTranscript() {
  state.items = [];
  state.session = null;
  state.cursor = null;
  state.cursors = new Set();
  state.transcriptLoaded = false;
  state.transcriptError = "";
  state.olderLoading = false;
}
function renderAssistantResult(item, expanded) {
  if (item.role !== "assistant") return null;
  let result;
  try {
    result = JSON.parse(item.text);
  } catch {
    return null;
  }
  if (
    !record(result) ||
    typeof result.summary !== "string" ||
    typeof result.state !== "string" ||
    !Array.isArray(result.facts) ||
    !result.facts.every((fact) => typeof fact === "string")
  )
    return null;
  return `<div class="message-content task-result"><p class="message-status">Reported result · ${esc(result.state)}</p><p class="result-summary">${linkedText(result.summary)}</p>${list(result.facts, "result-facts")}</div><details class="command-block result-raw" data-item-id="${esc(item.id)}"${expanded.has(item.id) ? " open" : ""}><summary>Raw result</summary><pre>${esc(item.text)}</pre></details>`;
}
function renderTranscript({ older = false, force = false } = {}) {
  const scroll = $("transcript-scroll");
  const oldHeight = scroll.scrollHeight,
    oldTop = scroll.scrollTop;
  const atBottom = oldHeight - oldTop - scroll.clientHeight < 70;
  const expanded = new Set(
    [...$("transcript").querySelectorAll("details[open]")].map(
      (node) => node.dataset.itemId,
    ),
  );
  const kind = state.session?.kind;
  const agentName = kind === "may" ? "May" : "Codex";
  $("session-title").textContent = `${agentName} session`;
  $("session-subtitle").textContent = state.session
    ? "Bound to this support task"
    : "No session currently available";
  renderSessionFacts();
  $("session-meta").textContent = state.session
    ? `Session ${state.session.id}${state.session.updatedAt ? " · Updated " + date(state.session.updatedAt) : ""}`
    : "No task-bound Codex or May session has been reported.";
  showNotice("transcript-error", state.transcriptError);
  $("older-button").hidden = !state.cursor;
  $("older-button").disabled = state.olderLoading;
  $("older-button").textContent = state.olderLoading
    ? "Loading older messages…"
    : "↑ Load older messages";
  $("transcript").innerHTML = state.items.length
    ? state.items
        .map((item) => {
          const tool =
            item.role === "tool" || /command|tool|result/i.test(item.type);
          const name =
            item.role === "user"
              ? "You"
              : tool
                ? "Command / result"
                : agentName;
          return `<article class="message ${item.role === "user" ? "user" : "assistant"}" data-item-id="${esc(item.id)}"><div class="message-heading"><span class="message-avatar" aria-hidden="true">${item.role === "user" ? "↗" : tool ? "›_" : "✳"}</span><span>${name}</span>${item.status ? `<span class="message-status">${esc(item.status)}</span>` : ""}${item.timestamp ? `<time>${esc(date(item.timestamp))}</time>` : ""}</div>${tool ? `<details class="command-block" data-item-id="${esc(item.id)}"${expanded.has(item.id) ? " open" : ""}><summary>${esc(item.command || item.type || "Command / result")}</summary><pre>${esc(item.text || "No output reported.")}</pre></details>` : renderAssistantResult(item, expanded) || `<div class="message-content">${linkedText(item.text || "")}</div>`}</article>`;
        })
        .join("")
    : '<div class="empty-state session-empty"><span class="empty-symbol" aria-hidden="true">✳</span><h3>No transcript available yet</h3><p>Visible agent messages, commands, and results will appear here when the task reports a bound session.</p></div>';
  if (older) scroll.scrollTop = oldTop + scroll.scrollHeight - oldHeight;
  else if (atBottom || force) {
    scroll.scrollTop = scroll.scrollHeight;
    $("jump-latest").hidden = true;
  } else {
    scroll.scrollTop = oldTop;
    $("jump-latest").hidden = false;
  }
}
async function loadTranscript(epoch, older = false) {
  const cursor = older ? state.cursor : null;
  if (older && (!cursor || state.olderLoading)) return;
  if (older) {
    state.olderLoading = true;
    $("older-button").disabled = true;
    $("history-status").textContent = "Loading…";
  }
  try {
    const data = await readJson(
      "/api/task/transcript?" + taskQuery(cursor ? { cursor } : {}),
    );
    if (epoch !== state.epoch) return;
    if (
      !scopeMatches(data) ||
      !Number.isInteger(data.generation) ||
      (data.nextCursor !== undefined &&
        data.nextCursor !== null &&
        (typeof data.nextCursor !== "string" || !data.nextCursor))
    )
      throw new Error("Transcript scope or pagination is invalid.");
    if (data.generation !== state.task?.generation)
      throw new Error(
        "Task generation changed. Refresh to read the current session.",
      );
    if (
      data.session !== null &&
      (!record(data.session) ||
        typeof data.session.id !== "string" ||
        !["codex", "may"].includes(data.session.kind))
    )
      throw new Error("Invalid task session response.");
    const items = visibleItems(data.items);
    if (
      older &&
      (data.session?.id !== state.session?.id ||
        data.nextCursor === cursor ||
        (data.nextCursor && state.cursors.has(data.nextCursor)))
    )
      throw new Error(
        "Session history changed. Refresh before loading earlier messages.",
      );
    const retainedIds = new Set(state.items.map((item) => item.id));
    const disjointLatest =
      !older &&
      state.transcriptLoaded &&
      items.length > 0 &&
      !items.some((item) => retainedIds.has(item.id));
    if (
      !older &&
      state.transcriptLoaded &&
      (data.session?.id !== state.session?.id || disjointLatest)
    )
      resetTranscript();
    const first = !state.transcriptLoaded;
    state.session = data.session;
    state.items = [
      ...new Map(
        (older ? [...items, ...state.items] : [...state.items, ...items]).map(
          (item) => [item.id, item],
        ),
      ).values(),
    ];
    if (first || older) state.cursor = data.nextCursor || null;
    if (older && cursor) state.cursors.add(cursor);
    state.transcriptLoaded = true;
    state.transcriptError =
      typeof data.unavailable === "string"
        ? data.unavailable
        : data.unavailable
          ? "Transcript is unavailable for this task."
          : "";
    $("history-status").textContent =
      disjointLatest && data.nextCursor
        ? "Showing newer messages. Earlier history is available above."
        : "";
    renderTranscript({ older, force: first });
  } catch (error) {
    if (epoch !== state.epoch) return;
    if (older && error.status === 400) {
      // Signed history cursors may expire when the bridge restarts. Keep the
      // visible transcript, then obtain a fresh latest-page cursor.
      state.cursor = null;
      state.cursors = new Set();
      state.transcriptLoaded = false;
      $("older-button").hidden = true;
      $("history-status").textContent = "History cursor expired. Refreshing…";
      scheduleRefresh();
    }
    state.transcriptError = `${state.items.length ? "Current transcript unavailable. Retained messages may be out of date. " : "Transcript unavailable. "}${error.message}`;
    showNotice("transcript-error", state.transcriptError);
    if (older && error.status !== 400)
      $("history-status").textContent = "Could not load older messages.";
  } finally {
    if (epoch === state.epoch) {
      state.olderLoading = false;
      $("older-button").disabled = false;
    }
  }
}
async function refresh({ document = false } = {}) {
  if (!state.taskId) return;
  if (state.refreshing) {
    state.refreshAgain = true;
    return;
  }
  const epoch = state.epoch;
  state.refreshing = true;
  $("refresh-button").disabled = true;
  try {
    const data = await readJson("/api/task?" + taskQuery());
    if (epoch !== state.epoch) return;
    if (
      !scopeMatches(data) ||
      typeof data.status !== "string" ||
      !Number.isInteger(data.generation)
    )
      throw new Error("The task response does not match the selected task.");
    if (state.task && data.generation !== state.task.generation) {
      resetTranscript();
      renderTranscript({ force: true });
    }
    state.task = data;
    state.taskError = "";
    state.refreshedAt = Date.now();
    renderTask();
    await loadTranscript(epoch);
    if (document) await loadDocument(epoch);
  } catch (error) {
    if (epoch === state.epoch) {
      state.taskError = error.message;
      renderTask();
    }
  } finally {
    if (epoch === state.epoch) {
      state.refreshing = false;
      $("refresh-button").disabled = false;
      if (state.refreshAgain) {
        state.refreshAgain = false;
        scheduleRefresh();
      }
    }
  }
}
function scheduleRefresh() {
  if (state.wakeTimer) return;
  state.wakeTimer = setTimeout(() => {
    state.wakeTimer = null;
    refresh();
  }, 350);
}
function startPolling() {
  if (state.pollTimer) return;
  state.pollTimer = setInterval(() => {
    if (!document.hidden && state.taskId && !state.task?.terminal) refresh();
  }, 20000);
}
function stopPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}
function disconnect() {
  clearTimeout(state.retryTimer);
  clearTimeout(state.socketTimer);
  clearTimeout(state.wakeTimer);
  state.retryTimer = null;
  state.socketTimer = null;
  state.wakeTimer = null;
  stopPolling();
  const old = state.socket;
  state.socket = null;
  if (old) {
    old.onclose = null;
    old.close();
  }
}
function connectSocket() {
  if (!state.taskId || state.socket) return;
  const epoch = state.epoch;
  setConnection("Connecting…");
  startPolling();
  let socket;
  try {
    const url = new URL(apiPath("/ws"), location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(url);
  } catch {
    socketFailed(epoch);
    return;
  }
  state.socket = socket;
  state.socketTimer = setTimeout(() => {
    if (state.socket === socket && socket.readyState !== WebSocket.OPEN)
      socket.close();
  }, 8000);
  socket.onopen = () => {
    if (epoch !== state.epoch) {
      socket.close();
      return;
    }
    clearTimeout(state.socketTimer);
    state.socketTimer = null;
    socket.send(
      JSON.stringify({
        type: "subscribe",
        sessions: [],
        task: { appId: state.appId, taskId: state.taskId },
      }),
    );
    setConnection("Live updates · refresh 20s", "live");
    // Reset the retry budget after a stable connection, not a flapping open.
    state.socketTimer = setTimeout(() => {
      if (state.socket === socket) state.retries = 0;
    }, 30000);
    scheduleRefresh();
  };
  socket.onmessage = (event) => {
    if (epoch !== state.epoch) return;
    try {
      const frame = JSON.parse(event.data),
        data = frame.data || frame;
      if (frame.type === "app.task.updated" && scopeMatches(data))
        scheduleRefresh();
    } catch {
      /* Invalid and unrelated frames do not change Task facts. */
    }
  };
  socket.onerror = () => socket.close();
  socket.onclose = () => {
    if (epoch !== state.epoch || state.socket !== socket) return;
    clearTimeout(state.socketTimer);
    state.socketTimer = null;
    state.socket = null;
    socketFailed(epoch);
  };
}
function socketFailed(epoch) {
  if (epoch !== state.epoch) return;
  setConnection("Polling · every 20s", "polling");
  startPolling();
  const delays = [1000, 2000, 4000, 8000, 15000, 30000];
  if (state.retries >= delays.length) return;
  state.retryTimer = setTimeout(() => {
    state.retryTimer = null;
    connectSocket();
  }, delays[state.retries++]);
}

function inputKind() {
  return (
    params.get("inputKind") ||
    (state.appId === "aks-rp-e2e" ? "owner-review" : "message")
  );
}
function updateComposer() {
  const sending = state.delivery?.status === "sending";
  const ready =
    !readOnly &&
    state.task &&
    !state.taskError &&
    Number.isInteger(state.task.generation) &&
    !state.task.terminal;
  $("task-message").disabled = !ready || sending;
  $("send-button").disabled =
    !ready || sending || !$("task-message").value.trim();
  $("send-button").firstChild.textContent = sending ? "Sending… " : "Send ";
  $("composer-hint").textContent = readOnly
    ? "Task execution is disabled. Progress and session history remain available."
    : !state.task
      ? "Open a task to send input."
      : state.taskError
        ? "Refresh task facts before sending."
        : state.task.terminal
          ? "This task is terminal."
          : sending
            ? "Saving input to this task…"
            : "⌘ / Ctrl + Enter to send";
}
function renderReceipts() {
  $("input-receipts").innerHTML = state.receipts
    .slice(-3)
    .map(
      (receipt) =>
        `<div class="receipt${receipt.status === "failed" ? " error" : ""}">${esc(receipt.text)}${receipt.status === "failed" && receipt.retryable && receipt.key === state.delivery?.key ? '<button type="button" class="text-button" id="retry-input">Retry same input</button>' : ""}</div>`,
    )
    .join("");
}
async function sendPayload(delivery) {
  if (readOnly) return;
  const epoch = state.epoch;
  const payload = {
    appId: state.appId,
    taskId: state.taskId,
    inputKind: inputKind(),
    message: delivery.message,
    idempotencyKey: delivery.key,
    expectedGeneration: delivery.generation,
  };
  delivery.status = "sending";
  state.delivery = delivery;
  state.receipts = state.receipts.filter(
    (receipt) => receipt.key !== delivery.key,
  );
  renderReceipts();
  updateComposer();
  try {
    const data = await readJson("/api/task/input", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (epoch !== state.epoch) return;
    if (data.accepted !== true)
      throw new Error("Input acceptance was not confirmed.");
    if (
      data.appId !== payload.appId ||
      data.taskId !== payload.taskId ||
      data.generation !== payload.expectedGeneration
    )
      throw new Error(
        "Input acknowledgment does not match the submitted task and generation.",
      );
    delivery.status = "accepted";
    state.receipts.push({
      key: delivery.key,
      status: "accepted",
      text: `Accepted for delivery${data.eventId ? ` · event ${data.eventId}` : ""}${data.inboxId ? ` · inbox ${data.inboxId}` : ""}. Agent acknowledgment has not been reported.`,
    });
    if ($("task-message").value.trim() === delivery.message)
      $("task-message").value = "";
    scheduleRefresh();
  } catch (error) {
    if (epoch !== state.epoch) return;
    delivery.status = "failed";
    const conflict = error.status === 409;
    const retryable =
      !error.status || error.status >= 500 || error.status === 429;
    state.receipts.push({
      key: delivery.key,
      status: "failed",
      retryable,
      text: conflict
        ? "Task changed. This input was not accepted. Review the refreshed task and send again."
        : retryable
          ? `Delivery not confirmed. ${error.message} Retrying uses the same request ID.`
          : `Input was not accepted. ${error.message}`,
    });
    if (conflict) {
      delivery.status = "conflict";
      await refresh();
    }
  } finally {
    if (epoch === state.epoch) {
      renderReceipts();
      updateComposer();
    }
  }
}
function submitInput(event) {
  event?.preventDefault();
  updateComposer();
  if ($("send-button").disabled) return;
  const message = $("task-message").value.trim();
  const old = state.delivery;
  const delivery =
    old?.status === "failed" &&
    old.message === message &&
    old.generation === state.task.generation
      ? old
      : {
          message,
          generation: state.task.generation,
          key: requestId(),
          status: "new",
        };
  sendPayload(delivery);
}
function requestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function openTask(appId, taskId, version = "") {
  disconnect();
  state.epoch++;
  state.appId = appId.trim();
  state.taskId = taskId.trim();
  state.version = version.trim();
  state.task = null;
  state.taskError = "";
  state.refreshedAt = null;
  state.refreshing = false;
  state.refreshAgain = false;
  state.delivery = null;
  state.receipts = [];
  state.document = null;
  state.documentError = "";
  state.documentLoading = false;
  state.retries = 0;
  resetTranscript();
  $("task-message").value = "";
  $("app-id").value = state.appId;
  $("task-id").value = state.taskId;
  $("version").value = state.version;
  $("page-title").textContent = state.version
    ? `Kubernetes ${state.version} support`
    : "Kubernetes version support";
  document.title = $("page-title").textContent;
  $("version-label").textContent = state.version
    ? `Version ${state.version}`
    : "Version not specified";
  $("workspace-scope").textContent = `${state.appId} / ${state.taskId}`;
  $("overview-panel").innerHTML =
    '<div class="empty-state"><h2>Reading task facts…</h2><p>The current goal and state will appear here.</p></div>';
  $("details-panel").innerHTML = "";
  $("task-ref").textContent = state.taskId;
  $("task-footer").textContent = "Reading current task facts…";
  $("page-subtitle").textContent = `${state.appId} / ${state.taskId}`;
  renderReceipts();
  renderTranscript({ force: true });
  updateComposer();
  showNotice("connect-error", "");
  showNotice("task-error", "");
  params.set("appId", state.appId);
  params.set("taskId", state.taskId);
  params.delete("app");
  params.delete("task");
  if (state.version) params.set("version", state.version);
  else params.delete("version");
  history.replaceState(
    null,
    "",
    `${location.pathname}?${params}${location.hash}`,
  );
  setConfiguration(false);
  await refresh({ document: true });
  connectSocket();
}
function setConfiguration(visible) {
  $("connection-panel").hidden = !visible;
  $("configure-button").setAttribute("aria-expanded", String(visible));
  $("configure-button").textContent = state.taskId
    ? "Change task"
    : "Connect task";
}
const discovery = {
  appId: "",
  cursor: null,
  ids: new Set(),
  cursors: new Set(),
  busy: false,
};
async function findTasks(more = false) {
  if (discovery.busy) return;
  const appId = $("app-id").value.trim();
  if (!appId) {
    showNotice("connect-error", "Enter an App ID first.");
    return;
  }
  if (!more || discovery.appId !== appId) {
    discovery.appId = appId;
    discovery.cursor = null;
    discovery.ids = new Set();
    discovery.cursors = new Set();
    $("task-options").replaceChildren();
  }
  discovery.busy = true;
  $("find-tasks").disabled = true;
  $("more-tasks").disabled = true;
  $("task-list-status").textContent = "Reading App tasks…";
  try {
    const query = new URLSearchParams({
      appId,
      includeDone: "true",
      limit: "100",
    });
    if (more && discovery.cursor) query.set("cursor", discovery.cursor);
    const data = await readJson("/api/tasks?" + query);
    if (
      !Array.isArray(data.items) ||
      data.items.some(
        (task) => task.appId !== appId || typeof task.taskId !== "string",
      ) ||
      (data.nextCursor !== undefined &&
        (typeof data.nextCursor !== "string" ||
          !data.nextCursor ||
          discovery.cursors.has(data.nextCursor)))
    )
      throw new Error("Invalid App task list.");
    for (const task of data.items) {
      if (discovery.ids.has(task.taskId)) continue;
      discovery.ids.add(task.taskId);
      const option = document.createElement("option");
      option.value = task.taskId;
      option.label = `${task.outcome || task.taskId} · ${task.status || "Unknown"}`;
      $("task-options").append(option);
    }
    discovery.cursor = data.nextCursor || null;
    if (data.nextCursor) discovery.cursors.add(data.nextCursor);
    $("more-tasks").hidden = !discovery.cursor;
    $("task-list-status").textContent =
      `${discovery.ids.size} task${discovery.ids.size === 1 ? "" : "s"} loaded${discovery.cursor ? " · more available" : ""}. Choose a Task ID above.`;
    showNotice("connect-error", "");
    $("task-id").focus();
  } catch (error) {
    $("task-list-status").textContent = "Task list unavailable.";
    showNotice("connect-error", error.message);
  } finally {
    discovery.busy = false;
    $("find-tasks").disabled = false;
    $("more-tasks").disabled = false;
  }
}

function selectTab(name, focus = false) {
  for (const tab of ["overview", "details"]) {
    const active = name === tab;
    $(`${tab}-tab`).setAttribute("aria-selected", String(active));
    $(`${tab}-tab`).tabIndex = active ? 0 : -1;
    $(`${tab}-tab`).classList.toggle("active", active);
    $(`${tab}-panel`).hidden = !active;
  }
  if (focus) $(`${name}-tab`).focus();
}
for (const name of ["overview", "details"]) {
  $(`${name}-tab`).addEventListener("click", () => selectTab(name));
  $(`${name}-tab`).addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      selectTab(
        event.key === "Home"
          ? "overview"
          : event.key === "End"
            ? "details"
            : name === "overview"
              ? "details"
              : "overview",
        true,
      );
    }
  });
}
function setSplit(percent) {
  const width = $("split-layout").clientWidth - 18;
  const minimum =
    width > 0 ? Math.max(30, Math.min(45, (300 / width) * 100)) : 30;
  const maximum = 100 - minimum;
  const value = Math.max(minimum, Math.min(maximum, percent));
  $("split-layout").style.setProperty(
    "--left-pane",
    `calc(${value}% - ${(18 * value) / 100}px)`,
  );
  $("split-resizer").setAttribute("aria-valuemin", String(Math.round(minimum)));
  $("split-resizer").setAttribute("aria-valuemax", String(Math.round(maximum)));
  $("split-resizer").setAttribute("aria-valuenow", String(Math.round(value)));
  $("split-resizer").setAttribute(
    "aria-valuetext",
    `${Math.round(value)} percent task, ${Math.round(100 - value)} percent session`,
  );
}
$("split-resizer").addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const value = Number($("split-resizer").getAttribute("aria-valuenow"));
  setSplit(
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? 100
        : value +
          (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 5 : 2),
  );
});
$("split-resizer").addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  event.currentTarget.focus();
  event.currentTarget.setPointerCapture(event.pointerId);
  document.body.classList.add("resizing");
});
$("split-resizer").addEventListener("pointermove", (event) => {
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
  const bounds = $("split-layout").getBoundingClientRect();
  setSplit(((event.clientX - bounds.left - 9) / (bounds.width - 18)) * 100);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("split-resizer").addEventListener(event, () =>
    document.body.classList.remove("resizing"),
  );
window.addEventListener("resize", () =>
  setSplit(Number($("split-resizer").getAttribute("aria-valuenow"))),
);
$("configure-button").addEventListener("click", () => {
  const visible = $("connection-panel").hidden;
  setConfiguration(visible);
  if (visible) $("task-id").focus();
});
$("connect-form").addEventListener("submit", (event) => {
  event.preventDefault();
  openTask($("app-id").value, $("task-id").value, $("version").value);
});
$("find-tasks").addEventListener("click", () => findTasks());
$("more-tasks").addEventListener("click", () => findTasks(true));
$("refresh-button").addEventListener("click", () => {
  refresh({ document: true });
  if (!state.socket && !state.retryTimer) {
    state.retries = 0;
    connectSocket();
  }
});
$("older-button").addEventListener("click", () =>
  loadTranscript(state.epoch, true),
);
$("task-message").addEventListener("input", updateComposer);
$("task-message").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
    submitInput(event);
});
$("input-form").addEventListener("submit", submitInput);
$("input-receipts").addEventListener("click", (event) => {
  if (
    event.target.closest("#retry-input") &&
    state.delivery?.status === "failed"
  )
    sendPayload(state.delivery);
});
$("jump-latest").addEventListener("click", () => {
  $("transcript-scroll").scrollTop = $("transcript-scroll").scrollHeight;
  $("jump-latest").hidden = true;
});
$("transcript-scroll").addEventListener(
  "scroll",
  () => {
    const node = $("transcript-scroll");
    if (node.scrollHeight - node.scrollTop - node.clientHeight < 70)
      $("jump-latest").hidden = true;
  },
  { passive: true },
);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.taskId) refresh();
});
window.addEventListener("pagehide", disconnect);
setSplit(55);
const initialApp = params.get("appId") || params.get("app") || "aks-rp-e2e";
const initialTask = params.get("taskId") || params.get("task");
$("app-id").value = initialApp;
$("version").value = params.get("version") || "";
if (initialTask?.trim())
  openTask(initialApp, initialTask, params.get("version") || "");
