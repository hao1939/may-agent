const PROJECT_PATH = "projects/aks-rp-e2e";
const APP_PATH = "projects/aks-rp-e2e.app";
const TASK_TREE_FILE = "aks-rp-e2e.app/tasks/tree.json";

let state = {
  tree: null,
  kanban: null,
  metrics: [],
  metricAlerts: [],
  metricWarning: "",
  kanbanSource: "",
  kanbanWarning: "",
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
  if (status === "backlog" || status === "proposed") return "var(--muted)";
  if (status === "accepted") return "var(--green)";
  if (status === "ready") return "var(--blue)";
  if (status === "active") return "var(--blue)";
  if (status === "review") return "var(--purple)";
  if (status === "claimed_done") return "var(--purple)";
  if (status === "rejected") return "var(--red)";
  if (status === "blocked") return "var(--yellow)";
  if (status === "superseded") return "var(--muted)";
  return "var(--muted)";
}

const METRIC_GROUPS = [
  {
    title: "Flow",
    description: "Is the planner keeping executable work moving?",
    metrics: [
      ["aks-rp-e2e.task.active-count", "Active"],
      ["aks-rp-e2e.task.ready-count", "Backlog"],
      ["aks-rp-e2e.task.blocked-count", "Blocked"],
      ["aks-rp-e2e.task.completed-24h", "Done 24h"],
      ["aks-rp-e2e.task.capacity-underfilled-with-gaps", "Underfilled"],
    ],
  },
  {
    title: "Knowledge",
    description: "How much AKS input and expectation space is still open?",
    metrics: [
      ["aks-rp-e2e.model.unknown-path-count", "Unknown paths"],
      ["aks-rp-e2e.model.failed-path-count", "Failed paths"],
      ["aks-rp-e2e.model.blocked-path-count", "Blocked paths"],
      ["aks-rp-e2e.feature.unknown-count", "Unknown features"],
    ],
  },
  {
    title: "Execution",
    description: "Are specs turning into live staging feedback?",
    metrics: [
      ["aks-rp-e2e.spec.total-count", "Specs"],
      ["aks-rp-e2e.replay.script-count", "Scripts"],
      ["aks-rp-e2e.run.live-started-24h", "Runs 24h"],
      ["aks-rp-e2e.run.live-succeeded-24h", "Passed 24h"],
      ["aks-rp-e2e.run.live-idle-with-runnable-work", "Idle"],
    ],
  },
  {
    title: "Hygiene",
    description: "Signals that the project may be cycling or needs attention.",
    metrics: [
      ["aks-rp-e2e.run.live-failed-24h", "Failed 24h"],
      ["aks-rp-e2e.artifact.duplicate-group-count", "Duplicate groups"],
    ],
  },
];

const METRIC_FALLBACKS = {
  "aks-rp-e2e.task.active-count": (stats) => stats.active,
  "aks-rp-e2e.task.ready-count": (stats) => stats.backlog,
  "aks-rp-e2e.task.blocked-count": (stats) => stats.blocked,
};

function normalizedStatus(task) {
  const status = task?.status || "unknown";
  if (status === "ready" || status === "proposed") return "backlog";
  if (status === "claimed_done" || status === "rejected") return "review";
  return status;
}

function statusLabel(task) {
  const status = normalizedStatus(task);
  return (
    {
      backlog: "Backlog",
      active: "In Progress",
      review: "Review",
      blocked: "Blocked",
      accepted: "Accepted",
      superseded: "Archived",
      decomposed: "Decomposed",
    }[status] || status
  );
}

function taskBlocker(task) {
  return task?.blocker || task?.blocked_reason || task?.trace?.blocked_reason;
}

function isLeaf(task) {
  return !(task?.children || []).length;
}

function isReviewTask(task) {
  const id = task?.id || "";
  return (
    task?.kind === "blocked_review" ||
    task?.kind === "parent_review" ||
    task?.kind === "rework_review" ||
    id === "blocked-frontier-review" ||
    id.endsWith("-blocker-review") ||
    id.endsWith("-rollup-review") ||
    id.endsWith("-rework-review")
  );
}

function isPlanningTask(task) {
  return (
    task?.kind === "frontier_replan" ||
    task?.kind === "domain_planner" ||
    task?.kind === "loop_task"
  );
}

function isHumanQuestionTask(task) {
  return task?.kind === "human_question" || task?.owner === "human";
}

function hasExternalBlockSignal(task) {
  if (!task || task.status !== "blocked") return false;
  if (task.kind === "human_question") return true;
  if (hasClosedGate(task) || (task.gates || []).length > 0) return true;
  if (isReviewTask(task) || isPlanningTask(task)) return false;
  if (task.owner === "human") return true;
  if (task.verification?.verdict === "rejected") return false;
  if (
    /validation|validator|check failed|failed required|not executable|no-work|waiting claims are not terminal/i.test(
      taskBlocker(task) || "",
    )
  )
    return false;
  const text = [task.goal, taskBlocker(task), ...(task.gates || [])]
    .filter(Boolean)
    .join("\n");
  return /(?:external|credential|auth|token|azure cli|\baz\b|owner|capacity|quota|rollout|environment|precondition|human|input|approval|unsafe|safety|not installed|unavailable|source signal|subscription|msi|hcp|staging)/i.test(
    text,
  );
}

function taskEscalation(task) {
  return task?.escalation && typeof task.escalation === "object"
    ? task.escalation
    : null;
}

function hasOpenEscalation(task) {
  const escalation = taskEscalation(task);
  return (
    !!escalation &&
    ["open", "routed", "waiting_human"].includes(escalation.state)
  );
}

function kanbanColumn(task) {
  if (
    isPlanningTask(task) &&
    ["proposed", "ready", "active"].includes(task.status)
  )
    return "planning";
  if (task.status === "proposed") return "backlog";
  if (task.status === "ready") return "backlog";
  if (task.status === "active") return "in-progress";
  if (
    task.status === "review" ||
    task.status === "claimed_done" ||
    task.status === "rejected"
  )
    return "review";
  if (task.status === "blocked")
    return hasExternalBlockSignal(task) ? "blocked" : "review";
  if (task.status === "accepted") return "done";
  if (task.status === "superseded") return "archive";
  return null;
}

function kanbanLabel(task) {
  const column = kanbanColumn(task);
  if (!column) return "Structure";
  return (
    {
      backlog: "Backlog",
      planning: "Planning",
      ready: "Ready",
      "in-progress": "In Progress",
      review: "Review",
      blocked: "Blocked",
      done: "Done",
      archive: "Archive",
    }[column] || "Structure"
  );
}

function isKanbanTask(tree, task) {
  if (!task || task.id === tree?.root_task_id) return false;
  return isLeaf(task) && !!kanbanColumn(task);
}

function kanbanTasks(tree) {
  return Object.values(tree?.tasks || {}).filter((task) =>
    isKanbanTask(tree, task),
  );
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

  const markSubtree = (id) => {
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
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority] ?? 9;
}

function taskSort(tree) {
  const depths = depthMap(tree);
  return (a, b) => {
    const ad = depths[a.id] ?? 99;
    const bd = depths[b.id] ?? 99;
    return (
      ad - bd ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      String(a.id).localeCompare(String(b.id))
    );
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
    .filter(
      (task) =>
        isLeaf(task) &&
        ["active", "review", "claimed_done"].includes(task.status),
    )
    .sort(taskSort(tree));
}

function taskConflictScope(task) {
  const explicit = Array.isArray(task?.conflict_scope)
    ? task.conflict_scope.filter(Boolean)
    : [];
  return [
    ...new Set(
      (explicit.length ? explicit : task?.outputs || []).filter(Boolean),
    ),
  ];
}

function conflictScopesOverlap(a, b) {
  const right = new Set(taskConflictScope(b));
  return taskConflictScope(a).some((item) => right.has(item));
}

function taskClarity(task) {
  if (!String(task?.goal || "").trim())
    return { ok: false, reason: "missing goal" };
  if (!(task?.acceptance || []).length)
    return { ok: false, reason: "missing acceptance" };
  if (!(task?.outputs || []).length)
    return { ok: false, reason: "missing output" };
  return { ok: true };
}

function hasClosedGate(task) {
  return (task?.gates || []).length > 0 && task.gate_status !== "satisfied";
}

function taskEvidenceRefs(task) {
  return [
    ...(task?.evidence || []),
    ...(task?.trace?.last_worker_evidence || []),
  ].filter(Boolean);
}

function taskKnowledgeSummary(task) {
  return (
    task?.summary ||
    task?.acceptance_note ||
    task?.trace?.acceptance_note ||
    task?.trace?.last_worker_summary ||
    task?.archive_summary?.summary ||
    ""
  );
}

function taskReusableFor(task) {
  const reusable = task?.reusable_for || task?.reusableFor || [];
  return Array.isArray(reusable) ? reusable.filter(Boolean) : [];
}

function readinessInfo(tree, task) {
  if (!task || !isLeaf(task) || normalizedStatus(task) !== "backlog")
    return null;
  const depends = (task.depends_on || []).filter(Boolean);
  const unmet = depends.find((id) => tree?.tasks?.[id]?.status !== "accepted");
  if (unmet) {
    const dep = tree?.tasks?.[unmet];
    return {
      label: "dependency blocked",
      detail: `${unmet} is ${dep?.status || "missing"}`,
      color: "var(--yellow)",
    };
  }
  const clarity = taskClarity(task);
  if (!clarity.ok) {
    return {
      label: "needs clarity",
      detail: clarity.reason,
      color: "var(--orange)",
    };
  }
  if (hasClosedGate(task)) {
    return {
      label: "gated",
      detail: "gate is not satisfied",
      color: "var(--yellow)",
    };
  }
  const conflict = activeLeaves(tree).find((other) =>
    conflictScopesOverlap(other, task),
  );
  if (conflict) {
    return {
      label: "conflict blocked",
      detail: `conflicts with ${conflict.id}`,
      color: "var(--yellow)",
    };
  }
  return {
    label: "runnable",
    detail: "backlog leaf with dependencies satisfied",
    color: "var(--green)",
  };
}

function treeRowSummary(tree, task) {
  const acceptedSummary =
    normalizedStatus(task) === "accepted" ? taskKnowledgeSummary(task) : "";
  if (acceptedSummary) return `Learned: ${acceptedSummary}`;
  const blocker = taskBlocker(task);
  if (normalizedStatus(task) === "blocked" && blocker)
    return `Blocked: ${blocker}`;
  const readiness = readinessInfo(tree, task);
  if (readiness) return readiness.detail;
  if (task.archive_summary) {
    const summary =
      typeof task.archive_summary === "string"
        ? task.archive_summary
        : Object.entries(task.archive_summary)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ");
    if (summary) return `Archived detail: ${summary}`;
  }
  return "";
}

function taskStats(tree) {
  const projection = state.kanban;
  if (!projection) throw new Error("Kanban projection is unavailable");
  const columnCounts = projection.column_counts || {};
  const counts = projection.status_counts || {};
  const accepted = columnCounts.done || 0;
  const blocked = columnCounts.blocked || 0;
  const escalated = projection.escalated || 0;
  const active = columnCounts["in-progress"] || 0;
  const total = projection.total_cards || 0;
  return {
    total,
    counts,
    workflowCounts: counts,
    columnCounts,
    accepted,
    blocked,
    escalated,
    active,
    planning: columnCounts.planning || 0,
    backlog: columnCounts.backlog || 0,
    ready: columnCounts.ready || 0,
    review: columnCounts.review || 0,
    archive: columnCounts.archive || 0,
    settledPct: projection.settled_pct || 0,
    treeTotal: projection.tree_total || 0,
  };
}

function emptyKanbanColumns() {
  return {
    planning: [],
    backlog: [],
    ready: [],
    "in-progress": [],
    review: [],
    blocked: [],
    done: [],
    archive: [],
  };
}

function buildBrowserKanbanProjection(tree) {
  const cards = kanbanTasks(tree);
  const columns = emptyKanbanColumns();
  const statusCounts = {};
  for (const task of Object.values(tree?.tasks || {})) {
    const status = task?.status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  for (const task of cards) {
    const column = kanbanColumn(task);
    if (columns[column]) columns[column].push(task.id);
  }
  const columnCounts = {};
  for (const [key, ids] of Object.entries(columns))
    columnCounts[key] = ids.length;
  return {
    total_cards: cards.length,
    tree_total: Object.keys(tree?.tasks || {}).length,
    status_counts: statusCounts,
    column_counts: columnCounts,
    card_ids_by_column: columns,
    escalated: cards.filter(hasOpenEscalation).length,
    settled_pct: cards.length
      ? Math.round(
          (((columns.done || []).length + (columns.archive || []).length) /
            cards.length) *
            100,
        )
      : 0,
  };
}

function descendantStatusCounts(tree, task) {
  const counts = {};
  const tasks = tree?.tasks || {};
  const seen = new Set();
  const visit = (id) => {
    const child = tasks[id];
    if (!child || seen.has(id)) return;
    seen.add(id);
    const status = normalizedStatus(child);
    counts[status] = (counts[status] || 0) + 1;
    for (const childId of child.children || []) visit(childId);
  };
  for (const childId of task?.children || []) visit(childId);
  return counts;
}

function renderStatusSummary(counts, label = "hidden") {
  const order = [
    "active",
    "backlog",
    "review",
    "blocked",
    "accepted",
    "decomposed",
    "superseded",
    "unknown",
  ];
  const entries = Object.entries(counts || {})
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (
        (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b)
      );
    });
  if (!entries.length) return "";
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return `<div class="tree-summary" data-testid="tree-summary">
    <span class="summary-label">${total} ${esc(label)}</span>
    ${entries.map(([status, count]) => `<span class="summary-chip" style="color:${taskColor(status)}">${esc(statusLabel({ status }))} ${count}</span>`).join("")}
  </div>`;
}

async function fetchJson(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error)
    throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadMetrics() {
  try {
    const data = await fetchJson("/api/metrics");
    state.metrics = (data.metrics || []).filter((metric) =>
      String(metric.id || "").startsWith("aks-rp-e2e."),
    );
    state.metricAlerts = (data.alerts || []).filter((alert) =>
      String(alert.metricId || alert.metric_id || "").startsWith("aks-rp-e2e."),
    );
    state.metricWarning = "";
  } catch (error) {
    state.metrics = [];
    state.metricAlerts = [];
    state.metricWarning = `Project metrics are unavailable: ${error?.message || String(error)}`;
  }
}

async function loadData() {
  const [projectData, taskData, kanbanData] = await Promise.all([
    fetchJson(
      `/api/projects/content?path=${encodeURIComponent(PROJECT_PATH)}`,
    ).catch(() => ({ content: "" })),
    fetchJson(
      `/api/projects/artifact?path=${encodeURIComponent(APP_PATH)}&file=${encodeURIComponent("tasks/tree.json")}`,
    ),
    fetchJson(
      `/api/projects/artifact?path=${encodeURIComponent(APP_PATH)}&file=${encodeURIComponent("tasks/kanban.json")}`,
    ),
  ]);
  state.project = projectData.content || "";
  state.tree = JSON.parse(taskData.content || "{}");
  const kanbanSnapshot = JSON.parse(kanbanData.content || "{}");
  if (!kanbanSnapshot?.kanban?.card_ids_by_column)
    throw new Error("tasks/kanban.json is missing the task-tool projection");
  state.kanban = kanbanSnapshot.kanban;
  await loadMetrics();
  state.kanbanSource = "task-tree-tools snapshot";
  state.kanbanWarning =
    kanbanSnapshot.tree_updated_at !== state.tree.updated_at
      ? `Task-tool Kanban projection is stale. Tree ${state.tree.updated_at || "unknown"}; projection ${kanbanSnapshot.tree_updated_at || "unknown"}.`
      : "";
  if (state.kanbanWarning) {
    state.kanban = buildBrowserKanbanProjection(state.tree);
    state.kanbanSource = "current task tree";
  }
  state.collapsedTaskIds = new Set(
    [...state.collapsedTaskIds].filter((id) => state.tree?.tasks?.[id]),
  );
  const active =
    (state.tree?.active_task_ids || [])[0] || state.tree?.active_task_id;
  if (!state.selectedTaskId || !state.tree.tasks?.[state.selectedTaskId]) {
    state.selectedTaskId =
      active ||
      firstTaskIdByColumn(state.tree, "in-progress") ||
      firstTaskIdByColumn(state.tree, "backlog") ||
      state.tree?.root_task_id ||
      null;
  }
}

function firstTaskIdByColumn(tree, column) {
  return (
    state.kanban?.card_ids_by_column?.[column]?.find(
      (id) => tree?.tasks?.[id],
    ) ||
    kanbanTasks(tree).find((task) => kanbanColumn(task) === column)?.id ||
    null
  );
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

function projectMetricsById() {
  return new Map((state.metrics || []).map((metric) => [metric.id, metric]));
}

function formatMetricValue(value) {
  if (value == null || value === "") return "-";
  const number = Number(value);
  if (Number.isFinite(number)) return new Intl.NumberFormat().format(number);
  return String(value);
}

function metricHealth(metric) {
  if (!metric) return { label: "local", tone: "neutral" };
  if (metric.alertOpen) return { label: "alert", tone: "alert" };
  const current = Number(metric.current);
  const threshold = Number(metric.threshold);
  if (!Number.isFinite(current) || !Number.isFinite(threshold))
    return { label: metric.priority || "active", tone: "neutral" };
  if (metric.alert_op === ">" && current > threshold)
    return { label: "breach", tone: "alert" };
  if (metric.alert_op === "<" && current < threshold)
    return { label: "breach", tone: "alert" };
  if (metric.type === "health" && current === 0)
    return { label: "ok", tone: "good" };
  return { label: metric.priority || "ok", tone: "neutral" };
}

function metricValueFor(id, stats) {
  const metric = projectMetricsById().get(id);
  if (metric) return { metric, value: metric.current };
  const fallback = METRIC_FALLBACKS[id];
  return {
    metric: null,
    value: fallback ? fallback(stats) : null,
  };
}

function renderMetricTile(id, label, stats) {
  const { metric, value } = metricValueFor(id, stats);
  const health = metricHealth(metric);
  const detail = metric
    ? [
        metric.priority,
        metric.target != null
          ? `target ${formatMetricValue(metric.target)}`
          : "",
        metric.threshold != null
          ? `${metric.alert_op || ""} ${formatMetricValue(metric.threshold)}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ")
    : "task-tree snapshot";
  return `<div class="metric-tile metric-${health.tone}" title="${attrEsc(metric?.description || detail)}">
    <div class="metric-topline">
      <span class="metric-name">${esc(label)}</span>
      <span class="metric-state">${esc(health.label)}</span>
    </div>
    <div class="metric-number">${esc(formatMetricValue(value))}</div>
    <div class="metric-detail">${esc(detail)}</div>
  </div>`;
}

function renderMetricGroup(group, stats) {
  return `<div class="metric-group">
    <div>
      <div class="metric-group-title">${esc(group.title)}</div>
      <div class="metric-group-copy">${esc(group.description)}</div>
    </div>
    <div class="metric-tiles">
      ${group.metrics.map(([id, label]) => renderMetricTile(id, label, stats)).join("")}
    </div>
  </div>`;
}

function renderMetricAlerts() {
  const alerts =
    state.metricAlerts.length > 0
      ? state.metricAlerts
      : (state.metrics || []).filter((metric) => metric.alertOpen);
  if (!alerts.length) {
    return `<div class="metric-alerts-ok">No open AKS RP E2E metric alerts.</div>`;
  }
  return `<div class="metric-alerts-list">
    ${alerts
      .slice(0, 5)
      .map((alert) => {
        const id = alert.metricId || alert.metric_id || alert.id;
        const message = alert.message || alert.alertMessage || alert.name || id;
        return `<div class="metric-alert-row">
          <span>${esc(id)}</span>
          <strong>${esc(message)}</strong>
        </div>`;
      })
      .join("")}
    ${alerts.length > 5 ? `<div class="metric-alert-row"><span>${alerts.length - 5} more alerts</span></div>` : ""}
  </div>`;
}

function renderProjectMetrics(tree) {
  const stats = taskStats(tree);
  return `<section class="panel metrics-panel" data-testid="project-metrics">
    <div class="panel-head">
      <div>
        <div class="kicker">Project Metrics</div>
        <div class="title">Health And Progress</div>
        <div class="muted">Registered project metrics plus task-tree fallback counts. These are the signals the planner and humans use to decide whether to refill, repair, verify, or escalate.</div>
      </div>
      <span class="pill">${state.metrics.length ? `${state.metrics.length} metrics` : "metrics offline"}</span>
    </div>
    ${state.metricWarning ? `<div class="notice" data-testid="metric-warning">${esc(state.metricWarning)}</div>` : ""}
    <div class="metric-groups">
      ${METRIC_GROUPS.map((group) => renderMetricGroup(group, stats)).join("")}
    </div>
    <div class="metric-footer">
      <div>
        <div class="metric-group-title">Open Alerts</div>
        ${renderMetricAlerts()}
      </div>
      <div class="actions metric-actions">
        <button class="btn" onclick="prefillMetricReview()">Review Metrics</button>
        <button class="btn" onclick="prefillBacklogRefill()">Refill Backlog</button>
        <button class="btn" onclick="prefillExecutionReview()">Review Execution</button>
      </div>
    </div>
  </section>`;
}

function renderSummary(tree) {
  const stats = taskStats(tree);
  const activeTasks = (tree.active_task_ids || [])
    .map((id) => tree.tasks?.[id])
    .filter(Boolean);
  const active =
    activeTasks[0] ||
    (tree.active_task_id ? tree.tasks?.[tree.active_task_id] : null);
  const activeTitle =
    activeTasks.length > 1
      ? `${activeTasks.length} active tasks`
      : active
        ? active.id
        : "No active task";
  const activeNote =
    activeTasks.length > 1
      ? activeTasks
          .slice(0, 4)
          .map((task) => `${task.id}: ${task.goal || ""}`)
          .join(" | ")
      : active?.goal ||
        "The task tree has no active pointer. Review backlog, review, and blocked work below.";
  const activeWorkHtml =
    activeTasks.length > 1
      ? `<div class="active-task-list">
        ${activeTasks
          .slice(0, 5)
          .map(
            (task) => `<div class="active-task-row">
              <span>${esc(task.id)}</span>
              <strong>${esc(task.goal || "")}</strong>
            </div>`,
          )
          .join("")}
        ${activeTasks.length > 5 ? `<div class="active-task-row"><span>${activeTasks.length - 5} more active tasks</span></div>` : ""}
      </div>`
      : `<div class="muted">${esc(activeNote)}</div>`;
  const progressAccepted = stats.total
    ? Math.round((stats.accepted / stats.total) * 100)
    : 0;
  const progressBlocked = stats.total
    ? Math.round((stats.blocked / stats.total) * 100)
    : 0;
  const progressActive =
    stats.total && stats.active
      ? Math.max(1, Math.round((stats.active / stats.total) * 100))
      : 0;
  const workflowTasks = kanbanTasks(tree);
  const planningTasks = workflowTasks.filter(
    (task) => kanbanColumn(task) === "planning",
  );
  const activePlanning = planningTasks.filter(
    (task) => task.status === "active",
  ).length;
  const planningNeedsBatch =
    activePlanning > 0 &&
    stats.backlog === 0 &&
    stats.ready === 0 &&
    stats.active === 0;
  return `<section class="summary-grid">
    <div class="panel current-panel">
      <div class="panel-head">
        <div>
          <div class="kicker">Current Work</div>
          <div class="title">${esc(activeTitle)}</div>
        </div>
        <span class="pill" style="color:${taskColor(active?.status)}">${active ? esc(kanbanLabel(active)) : "Idle"}</span>
      </div>
      ${activeWorkHtml}
      ${state.kanbanWarning ? `<div class="notice" data-testid="kanban-projection-warning">${esc(state.kanbanWarning)}</div>` : ""}
      ${planningNeedsBatch ? `<div class="notice" data-testid="planning-empty-backlog-warning">Planning is active but Backlog is empty. The planner should create a batch of executable project work before execution can parallelize.</div>` : ""}
      <div class="progress" title="${stats.accepted} accepted, ${stats.blocked} blocked, ${stats.active} active, ${stats.total} total">
        <span class="progress-accepted" style="width:${progressAccepted}%"></span>
        <span class="progress-active" style="width:${progressActive}%"></span>
        <span class="progress-blocked" style="width:${progressBlocked}%"></span>
      </div>
      <div class="metrics">
        ${renderMetric("task cards", stats.total)}
        ${renderMetric("backlog", stats.backlog, "var(--muted)")}
        ${renderMetric("in progress", stats.active, "var(--blue)")}
        ${renderMetric("review", stats.review, "var(--orange)")}
        ${renderMetric("blocked", stats.blocked, "var(--yellow)")}
        ${renderMetric("done", stats.accepted, "var(--green)")}
        ${renderMetric("archived", stats.archive, "var(--muted)")}
        ${renderMetric("open escalations", stats.escalated, "var(--orange)")}
      </div>
    </div>
    <div class="panel steering-panel">
      <div>
        <div class="kicker">Human Steering</div>
        <div class="title">Send Project Feedback</div>
        <div class="muted">Use this for project-level direction. Select a task below when the feedback should attach to a specific node.</div>
      </div>
      <textarea id="global-steer-text" data-testid="global-steer-textarea" placeholder="Tell the planner what to review, refill, split, verify, or prioritize next."></textarea>
      <div class="actions">
        <button class="btn btn-primary" onclick="sendSteering('global-steer-text', 'global-send-status')" data-testid="send-global-steering">Send To Planner</button>
        <button class="btn" onclick="prefillAdvance()">Advance</button>
        <button class="btn" onclick="prefillReviewFrontier()">Blocked</button>
        <button class="btn" onclick="prefillMetricReview()">Metrics</button>
      </div>
      <div class="status" id="global-send-status" data-testid="global-send-status"></div>
    </div>
  </section>`;
}

function renderCard(task) {
  const selected = task.id === state.selectedTaskId ? " active-card" : "";
  const branch = topBranchId(state.tree, task);
  const escalation = taskEscalation(task);
  const readiness = readinessInfo(state.tree, task);
  const meta = [
    task.id,
    task.priority || "",
    task.claimed_by ? `claimed by ${task.claimed_by}` : "",
    branch && branch !== task.id ? branch : "",
    task.kind ? String(task.kind).replace(/_/g, " ") : "",
    isLeaf(task) ? "leaf" : `${(task.children || []).length} children`,
  ].filter(Boolean);
  const blocker = taskBlocker(task);
  const note =
    blocker ||
    taskKnowledgeSummary(task) ||
    readiness?.detail ||
    task.goal ||
    "";
  return `<article class="card${selected}" style="--task-color:${taskColor(normalizedStatus(task))}" data-task-id="${attrEsc(task.id)}" onclick="selectTask(this.dataset.taskId)" title="${attrEsc(task.goal || task.id)}">
    <div class="card-id">${esc(task.goal || task.id)}</div>
    <div class="card-goal">${esc(note)}</div>
    ${escalation ? `<div class="card-badges"><span class="escalation-badge">${hasOpenEscalation(task) ? "Escalated" : "Escalation"}: ${esc(escalation.owner || escalation.state || "owner")}</span></div>` : ""}
    <div class="card-badges">
      <span class="pill" style="color:${taskColor(normalizedStatus(task))}">${esc(statusLabel(task))}</span>
      ${readiness ? `<span class="pill" style="color:${readiness.color}">${esc(readiness.label)}</span>` : ""}
    </div>
    <div class="card-meta">${meta.map((item) => `<span>${esc(item)}</span>`).join("")}</div>
  </article>`;
}

function renderKanban(tree) {
  const columnsByKey = emptyKanbanColumns();
  const sort = taskSort(tree);
  const projectedColumns = state.kanban?.card_ids_by_column;
  if (projectedColumns) {
    for (const key of Object.keys(columnsByKey)) {
      columnsByKey[key] = (projectedColumns[key] || [])
        .map((id) => tree.tasks?.[id])
        .filter(Boolean);
    }
    columnsByKey.backlog = [...columnsByKey.backlog, ...columnsByKey.ready];
    columnsByKey.ready = [];
  } else {
    for (const task of kanbanTasks(tree)) {
      const column = kanbanColumn(task);
      if (columnsByKey[column]) columnsByKey[column].push(task);
    }
  }
  const columns = [
    ["planning", "Planning"],
    ["backlog", "Backlog"],
    ["in-progress", "In Progress"],
    ["review", "Review"],
    ["blocked", "Blocked"],
    ["done", "Done"],
    ["archive", "Archive"],
  ];
  const visibleColumns = columns.filter(
    ([key]) => key !== "planning" || columnsByKey[key].length > 0,
  );
  const limits = {
    done: 20,
    planning: 8,
    backlog: 16,
    blocked: 20,
    "in-progress": 16,
    review: 16,
    archive: 8,
  };
  return `<section class="panel" data-testid="kanban-board">
    <div class="panel-head">
      <div>
        <div class="kicker">Execution Board</div>
        <div class="title">Kanban Board</div>
      </div>
      <span class="muted">leaf task cards from ${TASK_TREE_FILE}${state.kanbanSource ? ` via ${esc(state.kanbanSource)}` : ""}</span>
    </div>
    <div class="kanban">
      ${visibleColumns
        .map(([key, label]) => {
          const items = columnsByKey[key].sort(sort);
          const limit = limits[key] || 12;
          return `<div class="col" data-testid="kanban-${key}">
          <div class="col-head"><span class="col-title">${esc(label)}</span><span class="pill">${items.length}</span></div>
          <div class="cards">${items.length ? items.slice(0, limit).map(renderCard).join("") : `<div class="empty">None</div>`}${items.length > limit ? `<div class="empty">${items.length - limit} more</div>` : ""}</div>
        </div>`;
        })
        .join("")}
    </div>
  </section>`;
}

function renderTree(tree) {
  const rows = visibleTaskRows(tree);
  return `<section class="panel" data-testid="task-breakdown">
    <div class="panel-head">
      <div>
        <div class="kicker">Project Thinking</div>
        <div class="title">Task Tree</div>
        <div class="muted">Agent plan, accepted knowledge, open work, and task-linked human steering.</div>
      </div>
      <span class="muted">${esc(tree.project_lifecycle || "active")}</span>
    </div>
    <div class="tree">
      ${rows
        .map(({ task, depth }) => {
          const selected = task.id === state.selectedTaskId ? " selected" : "";
          const hasChildren = (task.children || []).length > 0;
          const collapsed = state.collapsedTaskIds.has(task.id);
          const descendantCounts = descendantStatusCounts(tree, task);
          const summary = hasChildren
            ? renderStatusSummary(
                descendantCounts,
                collapsed ? "hidden" : "children",
              )
            : "";
          const readiness = readinessInfo(tree, task);
          const rowSummary = treeRowSummary(tree, task);
          return `<div class="tree-row${selected}" data-task-id="${attrEsc(task.id)}" onclick="selectTask(this.dataset.taskId)">
          <div class="tree-main" style="--indent:${Math.min(depth * 18, 120)}px">
            ${
              hasChildren
                ? `<button class="tree-toggle" data-testid="tree-toggle" aria-label="${collapsed ? "Expand" : "Collapse"} children for ${attrEsc(task.id)}" aria-expanded="${collapsed ? "false" : "true"}" data-task-id="${attrEsc(task.id)}" onclick="toggleTaskCollapse(event, this.dataset.taskId)">${collapsed ? "+" : "-"}</button>`
                : `<span class="tree-toggle-spacer"></span>`
            }
            <div class="tree-copy">
              <div class="tree-goal">${esc(task.goal || task.id)}</div>
              ${rowSummary ? `<div class="tree-description">${esc(rowSummary)}</div>` : ""}
              <div class="tree-id">${esc(task.id)}</div>
              ${summary}
            </div>
          </div>
          <div class="tree-badges">
            <span class="pill" style="color:${taskColor(normalizedStatus(task))}">${esc(statusLabel(task))}</span>
            ${readiness ? `<span class="pill" style="color:${readiness.color}">${esc(readiness.label)}</span>` : ""}
          </div>
        </div>`;
        })
        .join("")}
    </div>
  </section>`;
}

function artifactLinks(refs) {
  const links = (refs || []).filter(Boolean);
  if (!links.length) return `<span class="muted">None recorded</span>`;
  return links
    .map(
      (output) =>
        `<a href="/projects/aks-rp-e2e/${encodeURIComponent(output)}" target="_blank">${esc(output)}</a>`,
    )
    .join("");
}

function outputLinks(task) {
  return artifactLinks(task?.outputs || []);
}

function evidenceLinks(task) {
  return artifactLinks(taskEvidenceRefs(task));
}

function detailList(title, items) {
  const list = (items || []).filter(Boolean);
  return `<div class="detail-section"><div class="kicker">${esc(title)}</div><div class="detail-list">${
    list.length
      ? list.map((item) => `<div>${esc(item)}</div>`).join("")
      : `<div>None recorded</div>`
  }</div></div>`;
}

function selectedTask() {
  return state.selectedTaskId
    ? state.tree?.tasks?.[state.selectedTaskId]
    : null;
}

function renderDetail() {
  const task = selectedTask();
  if (!task) {
    return `<aside class="detail panel" data-testid="task-detail"><div class="empty">Select a task to discuss or steer it.</div></aside>`;
  }
  const parent = task.parent_id ? state.tree.tasks?.[task.parent_id] : null;
  const latestAttempt = (task.attempts || []).at(-1);
  const escalation = taskEscalation(task);
  const readiness = readinessInfo(state.tree, task);
  const blocker = taskBlocker(task);
  const acceptedKnowledge =
    normalizedStatus(task) === "accepted" ? taskKnowledgeSummary(task) : "";
  const reusableFor = taskReusableFor(task);
  return `<aside class="detail panel" data-testid="task-detail">
    <div>
      <div class="kicker">Selected Node</div>
      <h2>${esc(task.goal || task.id)}</h2>
      <div class="muted">${esc(task.id)}</div>
      <div class="actions" style="margin-top:10px">
        <span class="pill" style="color:${taskColor(normalizedStatus(task))}">${esc(statusLabel(task))}</span>
        ${readiness ? `<span class="pill" style="color:${readiness.color}">${esc(readiness.label)}</span>` : ""}
        ${task.kind ? `<span class="pill">${esc(String(task.kind).replace(/_/g, " "))}</span>` : ""}
        ${task.priority ? `<span class="pill">${esc(task.priority)}</span>` : ""}
      </div>
    </div>
    ${
      normalizedStatus(task) === "accepted"
        ? `<div class="detail-section knowledge-panel">
      <div class="kicker">Accepted Knowledge</div>
      <div class="detail-list">
        <div>${esc(acceptedKnowledge || "Accepted by planner as verified project understanding.")}</div>
        <div>Evidence: ${evidenceLinks(task)}</div>
        ${
          reusableFor.length
            ? `<div>Reusable for: ${esc(reusableFor.join(", "))}</div>`
            : ""
        }
        ${task.accepted_at || task.trace?.accepted_at ? `<div>Accepted at: ${esc(task.accepted_at || task.trace?.accepted_at)}</div>` : ""}
        ${task.accepted_by || task.trace?.accepted_by ? `<div>Accepted by: ${esc(task.accepted_by || task.trace?.accepted_by)}</div>` : ""}
      </div>
    </div>`
        : ""
    }
    <div class="detail-section">
      <div class="kicker">Project Context</div>
      <div class="detail-list">
        <div>Parent: ${parent ? esc(parent.id) : "none"}</div>
        <div>Children: ${(task.children || []).length}</div>
        ${readiness ? `<div>Readiness: ${esc(readiness.detail)}</div>` : ""}
        <div>Outputs: ${outputLinks(task)}</div>
        <div>Evidence: ${evidenceLinks(task)}</div>
        ${blocker ? `<div>Blocker: ${esc(blocker)}</div>` : ""}
        ${task.verification ? `<div>Verification: ${esc(task.verification.verdict)} - ${esc(task.verification.reason || "")}</div>` : ""}
        ${latestAttempt ? `<div>Latest attempt: ${esc(latestAttempt.claim)} - ${esc(String(latestAttempt.summary || "").slice(0, 260))}</div>` : ""}
      </div>
    </div>
    ${
      escalation
        ? `<div class="detail-section escalation-panel">
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
    </div>`
        : ""
    }
    ${detailList("Acceptance", task.acceptance)}
    ${detailList("Gates", task.gates)}
    ${detailList("Forbidden", task.forbidden)}
    <div class="detail-section">
      <div class="kicker">Technical Metadata</div>
      <div class="detail-list">
        ${task.claimed_by ? `<div>Claimed by: ${esc(task.claimed_by)}</div>` : ""}
        ${task.lease_expires_at ? `<div>Lease expires: ${esc(task.lease_expires_at)}</div>` : ""}
        ${task.session_id ? `<div>Session: ${esc(task.session_id)}</div>` : ""}
        ${task.conflict_scope?.length ? `<div>Conflict scope: ${esc(task.conflict_scope.join(", "))}</div>` : ""}
      </div>
    </div>
    <div class="detail-section steer-box">
      <div>
        <div class="kicker">Task Feedback</div>
        <div class="muted">Attach feedback to this node so the planner can update the project tree with the local context in mind.</div>
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
    renderProjectMetrics(tree),
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

function setSteerText(text, textareaId = "steer-text") {
  const textarea =
    document.getElementById(textareaId) ||
    document.getElementById("steer-text") ||
    document.getElementById("global-steer-text");
  if (textarea) {
    textarea.value = text;
    textarea.focus();
    textarea.scrollIntoView({ block: "nearest" });
  }
}

function prefillAdvance() {
  const active = primaryActiveTask(state.tree);
  state.selectedTaskId = active?.id || state.selectedTaskId;
  render();
  setSteerText(
    `[resume] Advance aks-rp-e2e through aks-rp-e2e.app/tasks/tree.json.\n\nCurrent task: ${active?.id || "none"}\n\nUse the task tree as the project thinking surface. Keep working until blocked by a concrete gate/input, complete, or budget-limited. Do not accept no_work or waiting as terminal. Verify claims and record accepted knowledge before accepting tasks.`,
    "global-steer-text",
  );
}

function prefillReviewFrontier() {
  const blocked = Object.values(state.tree?.tasks || {})
    .filter((task) => task.status === "blocked" && hasExternalBlockSignal(task))
    .slice(0, 8)
    .map((task) => `- ${task.id}: ${task.blocker || task.goal}`)
    .join("\n");
  setSteerText(
    `[task-steer] aks-rp-e2e frontier review\n\naction: review_frontier\n\nReview the current blocked/review frontier and decide what can still move locally. Convert vague no-work/waiting into concrete backlog work, exact blocker, human question, or supersession. Preserve accepted knowledge that future tasks can reuse.\n\nBlocked sample:\n${blocked || "- none"}`,
    "global-steer-text",
  );
}

function prefillMetricReview() {
  const alerts =
    state.metricAlerts.length > 0
      ? state.metricAlerts
      : (state.metrics || []).filter((metric) => metric.alertOpen);
  const alertLines = alerts
    .slice(0, 8)
    .map((alert) => {
      const id = alert.metricId || alert.metric_id || alert.id;
      const message = alert.message || alert.alertMessage || alert.name || "";
      return `- ${id}: ${message}`;
    })
    .join("\n");
  setSteerText(
    `[metric-steer] aks-rp-e2e project health review\n\naction: review_metrics\n\nReview the project metrics and task tree together. If a metric indicates starvation, duplicate work, idle live execution, or blocked knowledge paths, update aks-rp-e2e.app/tasks/tree.json with concrete backlog, repair, unblock, or verification work. Do not add synthetic tracking-only tasks unless they clarify the actual project plan.\n\nOpen alerts:\n${alertLines || "- none"}`,
    "global-steer-text",
  );
}

function prefillBacklogRefill() {
  setSteerText(
    `[metric-steer] aks-rp-e2e backlog refill\n\naction: refill_backlog\n\nReview the knowledge-model gaps, source-discovery frontier, executable specs, replay scripts, and current task tree. Create or repair enough concrete backlog leaf tasks to keep workers busy in parallel. Prefer tasks that either discover new AKS RP feature/test paths or verify runnable specs live on staging and feed the result back into the model.`,
    "global-steer-text",
  );
}

function prefillExecutionReview() {
  setSteerText(
    `[metric-steer] aks-rp-e2e live execution review\n\naction: review_execution\n\nReview why runnable specs are or are not producing live staging feedback. For failing or blocked runs, decide whether each issue is runner code, spec quality, environment/auth, or a real product gap. Update the task tree with the next executable repair or verification tasks.`,
    "global-steer-text",
  );
}

function prefillSelected(action) {
  const task = selectedTask();
  if (!task) return;
  const escalation = taskEscalation(task);
  const prompts = {
    review: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: review\n\nReview this task's status, evidence, accepted knowledge, blockers, and parent rollup. Tell me whether it is correctly represented in aks-rp-e2e.app/tasks/tree.json and what should happen next.`,
    split: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: split\n\nIf this task is too broad or blocked ambiguously, split it into smaller executable child tasks. Preserve safety gates, forbidden actions, and evidence links.`,
    challenge: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: challenge\n\nChallenge this task status. Check whether the claim is overaccepted, under-specified, blocked for the wrong reason, or missing a concrete next step.`,
    escalate: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: escalate\n\nReview whether this task is blocked by a real ownership boundary. If yes, create or refresh a task-linked escalation with owner, requested action, evidence, and resume condition. If local rework is possible, do not escalate; create backlog follow-up work instead.\n\nCurrent blocker: ${taskBlocker(task) || "none"}`,
    resolve: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: resolve_escalation\n\nResolve escalation ${escalation?.id || task.escalation_id || "(missing)"} for this task. Record outcome fixed or answered only if the task can resume now; otherwise use rejected, needs_human, or superseded with evidence. Wake project execution after updating the task.\n\nResolution summary: `,
    "reject-escalation": `[task-steer] aks-rp-e2e task ${task.id}\n\naction: reject_escalation\n\nReject or dismiss escalation ${escalation?.id || task.escalation_id || "(missing)"} if the request is invalid, obsolete, or not enough to unblock the task. Explain what should happen next in the task tree.`,
  };
  setSteerText(prompts[action] || prompts.review);
}

async function sendSteering(
  textareaId = "steer-text",
  statusId = "send-status",
) {
  const textarea =
    document.getElementById(textareaId) ||
    document.getElementById("steer-text");
  const status =
    document.getElementById(statusId) || document.getElementById("send-status");
  const message = String(textarea?.value || "").trim();
  if (!message) {
    if (status) status.textContent = "Write a steering message first.";
    return;
  }
  if (status) status.textContent = "Sending...";
  try {
    const task = selectedTask();
    const eventData = {
      project: "aks-rp-e2e",
      reason: "human-steering",
      action: "task-feedback",
      requested_by: "kanban",
      params: {
        task_id: task?.id || state.selectedTaskId || "project",
        comment: message,
        context: {
          ui: "kanban",
          input: textareaId === "global-steer-text" ? "project" : "task",
          selectedTaskId: task?.id || state.selectedTaskId || "",
          selectedTaskStatus: task ? normalizedStatus(task) : "",
        },
      },
    };
    const body = {
      type: "project.planning.requested",
      source: "web-ui",
      owner: "agent:aks-explorer",
      urgency: "high",
      project: eventData.project,
      reason: eventData.reason,
      data: eventData,
    };
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false)
      throw new Error(data.error || data.triggerError || `HTTP ${res.status}`);
    if (textarea) textarea.value = "";
    if (status)
      status.textContent =
        data.workflowStarted || data.triggered
          ? "Planning request sent."
          : "Planning request accepted.";
  } catch (error) {
    if (status)
      status.textContent = `Failed: ${error?.message || String(error)}`;
  }
}

async function boot() {
  const refresh = document.getElementById("refresh-btn");
  if (refresh)
    refresh.addEventListener("click", async () => {
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
    if (root)
      root.innerHTML = `<div class="panel"><div class="title">Could not load task tree</div><div class="muted">${esc(error?.message || String(error))}</div></div>`;
  }
}

window.selectTask = selectTask;
window.toggleTaskCollapse = toggleTaskCollapse;
window.prefillAdvance = prefillAdvance;
window.prefillReviewFrontier = prefillReviewFrontier;
window.prefillMetricReview = prefillMetricReview;
window.prefillBacklogRefill = prefillBacklogRefill;
window.prefillExecutionReview = prefillExecutionReview;
window.prefillSelected = prefillSelected;
window.sendSteering = sendSteering;

boot();
