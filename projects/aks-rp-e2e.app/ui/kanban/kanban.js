const APP_PATH = "projects/aks-rp-e2e.app";
const TASK_TREE_FILE = "aks-rp-e2e.app/.state/tasks/tree.json";

let state = {
  tree: null,
  kanban: null,
  metrics: [],
  metricHistory: new Map(),
  metricAlerts: [],
  metricWarning: "",
  kanbanSource: "",
  kanbanWarning: "",
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

function taskColor(stateName) {
  if (stateName === "backlog") return "var(--muted)";
  if (stateName === "active") return "var(--blue)";
  if (stateName === "review") return "var(--purple)";
  if (stateName === "blocked") return "var(--yellow)";
  if (stateName === "done") return "var(--green)";
  return "var(--muted)";
}

const METRIC_GROUPS = [
  {
    title: "Process Bottlenecks",
    description: "Where work can stop moving even when the board looks busy.",
    metrics: [
      [
        "aks-rp-e2e.process.integrity.task-tree-problem-count",
        "Tree integrity",
      ],
      ["aks-rp-e2e.process.unpublished-change-count", "Project repo stale"],
      ["aks-rp-e2e.process.unowned-work-count", "Unowned work"],
      ["aks-rp-e2e.task.stale-active-count", "Stale active"],
      ["aks-rp-e2e.task.capacity-underfilled-with-gaps", "Underfilled"],
      ["aks-rp-e2e.task.no-work-with-gaps", "No work"],
      ["aks-rp-e2e.planner.slow-count-24h", "Planner slow"],
    ],
  },
  {
    title: "Flow",
    description: "Is the project owner keeping executable work moving?",
    metrics: [
      ["aks-rp-e2e.task.active-count", "Active"],
      ["aks-rp-e2e.task.ready-count", "Backlog"],
      ["aks-rp-e2e.task.blocked-count", "Blocked"],
      ["aks-rp-e2e.task.completed-24h", "Done 24h"],
      ["aks-rp-e2e.task.capacity-underfilled-with-gaps", "Underfilled"],
    ],
  },
  {
    title: "Spec Verification",
    description: "Are indexed specs verified, failing, ready, or still draft?",
    metrics: [
      ["aks-rp-e2e.spec.total-count", "Specs"],
      ["aks-rp-e2e.spec.verified-count", "Verified"],
      ["aks-rp-e2e.spec.unverified-count", "Unverified"],
      ["aks-rp-e2e.spec.failed-count", "Failed"],
      ["aks-rp-e2e.spec.ready-count", "Ready"],
      ["aks-rp-e2e.spec.draft-count", "Draft"],
    ],
  },
  {
    title: "Model",
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
      ["aks-rp-e2e.spec.reviewed-exception-count", "Exceptions"],
      ["aks-rp-e2e.spec.unverified-without-work", "No verification work"],
    ],
  },
];

const METRIC_FALLBACKS = {
  "aks-rp-e2e.task.active-count": (stats) => stats.active,
  "aks-rp-e2e.task.ready-count": (stats) => stats.backlog,
  "aks-rp-e2e.task.blocked-count": (stats) => stats.blocked,
};

const DURABLE_LOOPS = [
  {
    id: "aks-spec-verification-loop",
    label: "Spec loop",
    owner: "spec-loop-controller",
    expected:
      "Every non-terminal spec has verifier work, repair work, exact wait, or terminal disposition.",
  },
  {
    id: "aks-feature-reference-loop",
    label: "Reference loop",
    owner: "feature-reference-loop-controller",
    expected:
      "Every feature has official reference collection complete or accepted terminal disposition.",
  },
  {
    id: "aks-feature-compact-loop",
    label: "Compact loop",
    owner: "feature-compact-loop-controller",
    expected:
      "Every feature compact package is passing live, represented by repair/wait work, or terminal.",
  },
];

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function safeHttpUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^https?:\/\//i.test(text) ? text : "";
}

function parseTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function latestTimestamp(values) {
  let latest = null;
  for (const value of values) {
    const ms = parseTime(value);
    if (ms == null) continue;
    if (!latest || ms > latest.ms) latest = { ms, value };
  }
  return latest?.value || null;
}

function formatTime(value) {
  if (!value) return "unknown";
  const ms = parseTime(value);
  if (ms == null) return String(value);
  return new Date(ms)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "Z");
}

function formatAge(value) {
  const ms = parseTime(value);
  if (ms == null) return "unknown";
  const delta = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCount(value) {
  return formatMetricValue(value);
}

function taskState(task) {
  const raw = task?.state || task?.status || "unknown";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  if (raw === "accepted" || raw === "superseded") return "done";
  if (["backlog", "active", "review", "blocked", "done"].includes(raw))
    return raw;
  return "unknown";
}

function normalizedStatus(task) {
  return taskState(task);
}

function statusLabel(task) {
  const status = taskState(task);
  return (
    {
      backlog: "Backlog",
      active: "In Progress",
      review: "Review",
      blocked: "Blocked",
      done: "Done",
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
  if (!task || taskState(task) !== "blocked") return false;
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
  const stateName = taskState(task);
  if (stateName === "backlog") return "backlog";
  if (stateName === "active") return "in-progress";
  if (stateName === "review") return "review";
  if (stateName === "blocked") return "blocked";
  if (stateName === "done") return "done";
  return null;
}

function kanbanLabel(task) {
  const column = kanbanColumn(task);
  if (!column) return "Structure";
  return (
    {
      backlog: "Backlog",
      "in-progress": "In Progress",
      review: "Review",
      blocked: "Blocked",
      done: "Done",
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
      (task) => isLeaf(task) && ["active", "review"].includes(taskState(task)),
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
  if (!task || !isLeaf(task) || taskState(task) !== "backlog") return null;
  const depends = (task.depends_on || []).filter(Boolean);
  const unmet = depends.find((id) => taskState(tree?.tasks?.[id]) !== "done");
  if (unmet) {
    const dep = tree?.tasks?.[unmet];
    return {
      label: "dependency blocked",
      detail: `${unmet} is ${dep ? taskState(dep) : "missing"}`,
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
  const doneSummary =
    taskState(task) === "done" ? taskKnowledgeSummary(task) : "";
  if (doneSummary) return `Learned: ${doneSummary}`;
  const blocker = taskBlocker(task);
  if (taskState(task) === "blocked" && blocker) return `Blocked: ${blocker}`;
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
  const done = columnCounts.done || 0;
  const blocked = columnCounts.blocked || 0;
  const escalated = projection.escalated || 0;
  const active = columnCounts["in-progress"] || 0;
  const total = projection.total_cards || 0;
  return {
    total,
    counts,
    workflowCounts: counts,
    columnCounts,
    done,
    blocked,
    escalated,
    active,
    backlog: columnCounts.backlog || 0,
    review: columnCounts.review || 0,
    settledPct: projection.settled_pct || 0,
    treeTotal: projection.tree_total || 0,
  };
}

function emptyKanbanColumns() {
  return {
    backlog: [],
    "in-progress": [],
    review: [],
    blocked: [],
    done: [],
  };
}

function buildBrowserKanbanProjection(tree) {
  const cards = kanbanTasks(tree);
  const columns = emptyKanbanColumns();
  const statusCounts = {};
  for (const task of Object.values(tree?.tasks || {})) {
    const status = taskState(task);
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
          (((columns.done || []).length + (columns.blocked || []).length) /
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
  const order = ["backlog", "active", "review", "blocked", "done", "unknown"];
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
    const histories = await Promise.all(
      state.metrics.map((metric) =>
        fetchJson(
          `/api/metrics/${encodeURIComponent(metric.id)}/history?days=7`,
        ).catch(() => ({ snapshots: [] })),
      ),
    );
    state.metricHistory = new Map(
      state.metrics.map((metric, index) => [
        metric.id,
        histories[index]?.snapshots || [],
      ]),
    );
    state.metricWarning = "";
  } catch (error) {
    state.metrics = [];
    state.metricHistory = new Map();
    state.metricAlerts = [];
    state.metricWarning = `Project metrics are unavailable: ${error?.message || String(error)}`;
  }
}

async function loadData() {
  const [taskData, kanbanData] = await Promise.all([
    fetchJson(
      `/api/projects/artifact?path=${encodeURIComponent(APP_PATH)}&file=${encodeURIComponent(".state/tasks/tree.json")}`,
    ),
    fetchJson(
      `/api/projects/artifact?path=${encodeURIComponent(APP_PATH)}&file=${encodeURIComponent(".state/tasks/kanban.json")}`,
    ),
  ]);
  state.tree = JSON.parse(taskData.content || "{}");
  const kanbanSnapshot = JSON.parse(kanbanData.content || "{}");
  if (!kanbanSnapshot?.kanban?.card_ids_by_column)
    throw new Error(
      "runtime task board snapshot is missing the task-tool projection",
    );
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

function workflowProgress(task) {
  return objectValue(objectValue(task?.context).workflowProgress);
}

function taskRoots(tree) {
  const tasks = tree?.tasks || {};
  return Object.values(tasks)
    .filter((task) => !task.parent_id || !tasks[task.parent_id])
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
}

function leavesByState(tree, stateName) {
  return Object.values(tree?.tasks || {})
    .filter((task) => isLeaf(task) && taskState(task) === stateName)
    .sort(taskSort(tree));
}

function allMetricAlerts() {
  return state.metricAlerts.length > 0
    ? state.metricAlerts
    : (state.metrics || []).filter((metric) => metric.alertOpen);
}

function metricById(id) {
  return projectMetricsById().get(id) || null;
}

function processStatusTone(status) {
  if (status === "Broken" || status === "Failing") return "bad";
  if (status === "Attention" || status === "Unknown") return "warn";
  return "good";
}

function loopReports(tree) {
  return DURABLE_LOOPS.map((loop) => {
    const task = tree?.tasks?.[loop.id] || null;
    const progress = workflowProgress(task);
    const updatedAt =
      progress.updatedAt || task?.updated_at || tree?.updated_at;
    const unrepresented = numberOrNull(progress.unrepresentedNonTerminalCount);
    const error = numberOrZero(progress.error ?? progress.residueError);
    const pending = numberOrZero(progress.pending ?? progress.residuePending);
    const running = numberOrZero(progress.running ?? progress.residueRunning);
    const done = numberOrZero(progress.done);
    const retryBudgetExhausted = numberOrZero(progress.retryBudgetExhausted);
    const completionReady =
      typeof progress.completionReady === "boolean"
        ? progress.completionReady
        : null;
    const openChildren = numberOrZero(progress.openChildren);
    const activeGithubRuns = numberOrZero(progress.activeGithubRuns);
    const activePipelineWaits = arrayValue(progress.activePipelineWaits)
      .map(objectValue)
      .filter((wait) => wait.featureKey || wait.runId);
    const activePipelineRuns = Math.max(
      activePipelineWaits.length,
      numberOrZero(progress.activePipelineRuns ?? progress.activeGithubRuns),
    );
    const represented = unrepresented === 0 && completionReady === false;
    const status =
      completionReady === true
        ? "complete"
        : unrepresented != null && unrepresented > 0
          ? "unrepresented"
          : represented
            ? "represented"
            : task
              ? taskState(task)
              : "missing";
    return {
      ...loop,
      task,
      state: task ? taskState(task) : "missing",
      progress,
      completionReady,
      pending,
      running,
      done,
      error,
      retryBudgetExhausted,
      unrepresented,
      openChildren,
      activeGithubRuns,
      activePipelineRuns,
      activePipelineWaits,
      represented,
      status,
      reason: progress.reason || "",
      updatedAt,
    };
  });
}

function buildCoverageRows(tree, loops) {
  const roots = taskRoots(tree);
  const loopUpdatedAt = latestTimestamp(loops.map((loop) => loop.updatedAt));
  const metricUpdatedAt = latestTimestamp(
    (state.metrics || []).map((metric) => metric.updated_at),
  );
  const rows = [
    {
      surface: "Task tree",
      expected:
        "Current task state, active frontier, owners, waits, and task evidence.",
      observed: `${Object.keys(tree?.tasks || {}).length} tasks, ${roots.length} root(s)`,
      freshness: tree?.updated_at ? formatAge(tree.updated_at) : "unknown",
      coverage: roots.length === 1 ? "complete" : "partial",
      blindSpot:
        roots.length === 1
          ? "Tree structure is observable; semantic correctness still depends on review."
          : "Extra roots can hide work outside the intended project tree.",
      evidence: "tasks/tree.json",
      action: roots.length === 1 ? "" : "Request Planner Review",
      actionKind: roots.length === 1 ? "" : "planner",
      key: "coverage.task-tree",
    },
    {
      surface: "Metrics",
      expected: "Registered sensors expose trends and alert state.",
      observed:
        state.metricWarning ||
        `${state.metrics.length} metric(s), ${allMetricAlerts().length} open alert(s)`,
      freshness: metricUpdatedAt
        ? formatAge(metricUpdatedAt)
        : state.metricWarning
          ? "missing"
          : "unknown",
      coverage: state.metricWarning
        ? "missing"
        : state.metrics.length
          ? "partial"
          : "unknown",
      blindSpot: state.metricWarning
        ? "Metric-discovered issues may be invisible until metrics load."
        : "Metrics are sampled sensors; absence of alert is not complete proof.",
      evidence: "/api/metrics",
      action: state.metricWarning ? "Review Observability Gap" : "",
      actionKind: state.metricWarning ? "observability" : "",
      key: "coverage.metrics",
    },
    {
      surface: "Loop ledgers",
      expected:
        "Durable loop state can prove unfinished records are represented by work, waits, or terminal disposition.",
      observed: `${loops.length} loop root(s) via workflowProgress`,
      freshness: loopUpdatedAt ? formatAge(loopUpdatedAt) : "unknown",
      coverage: "inferred",
      blindSpot:
        "The UI trusts workflowProgress and does not independently scan every .state loop record yet.",
      evidence: "tasks/tree.json context.workflowProgress",
      action: "Challenge Classification",
      actionKind: "challenge",
      key: "coverage.loop-ledgers",
    },
    {
      surface: "Runtime trace",
      expected: "Emitted events can be matched to handler and workflow runs.",
      observed: "No browser-readable process route trace yet.",
      freshness: "missing",
      coverage: "not implemented",
      blindSpot:
        "Event black holes may exist even when the task tree appears to move.",
      evidence: "future .state/process-routes.jsonl",
      action: "Review Observability Gap",
      actionKind: "observability",
      key: "coverage.runtime-trace",
    },
    {
      surface: "Static graph",
      expected:
        "App schedules, events, handlers, workflows, and terminal outputs are route-checked.",
      observed: "Static graph readout is not browser-readable yet.",
      freshness: "missing",
      coverage: "not implemented",
      blindSpot:
        "Unhandled emitted events or unguarded cycles may not be visible on this page.",
      evidence: "app.ts and workflow metadata",
      action: "Review Observability Gap",
      actionKind: "observability",
      key: "coverage.static-graph",
    },
  ];
  return rows;
}

function buildProcessIssues(tree, loops) {
  const roots = taskRoots(tree);
  const issues = [];
  if (roots.length !== 1) {
    issues.push({
      key: "process.integrity.task-tree-root-count",
      group: "Process mismatch",
      severity: "P1",
      rawFact: `${roots.length} root task(s): ${roots.join(", ") || "none"}`,
      hint: "The project process expects exactly one reachable task-tree root.",
      confidence: "known",
      owner: "project-planner",
      currentAttempt: roots.slice(0, 3).join(", "),
      uncertainty:
        "The UI has not decided whether the extra root is legacy residue or active drift.",
      evidence: "tasks/tree.json",
      requiredResponse: "Request planner review if this is not already owned.",
      clearCondition: "task tree root count is exactly 1",
      action: "Request Planner Review",
      actionKind: "planner",
      taskId: roots.find((id) => id !== tree?.root_task_id) || roots[0],
    });
  }

  for (const loop of loops) {
    if (loop.unrepresented != null && loop.unrepresented > 0) {
      issues.push({
        key: `${loop.id}.unrepresented`,
        group: "Process mismatch",
        severity: "P0",
        rawFact: `${loop.unrepresented} unrepresented non-terminal record(s)`,
        hint: "Unfinished durable loop records should be visible as work, exact wait, or terminal disposition.",
        confidence: "inferred",
        owner: `${loop.owner} -> project-planner`,
        currentAttempt: loop.task?.id || loop.id,
        uncertainty:
          "The UI reads workflowProgress; full ledger-level proof needs the loop state file.",
        evidence: "tasks/tree.json context.workflowProgress",
        requiredResponse:
          "Review loop representation and create repair/wait work if needed.",
        clearCondition: "unrepresentedNonTerminalCount = 0",
        action: "Review Loop",
        actionKind: "loop",
        taskId: loop.task?.id,
        loopId: loop.id,
      });
    }
    if (
      loop.completionReady === false &&
      (loop.error > 0 || loop.retryBudgetExhausted > 0) &&
      !(loop.unrepresented != null && loop.unrepresented > 0)
    ) {
      issues.push({
        key: `${loop.id}.nonterminal-errors`,
        group: "Failure cluster",
        severity: "P2",
        rawFact: `${loop.error} error(s), ${loop.retryBudgetExhausted} retry-budget-exhausted, ${loop.activePipelineRuns} active ADO pipeline run(s)`,
        hint: loop.represented
          ? "The loop claims non-terminal errors are represented, but result work is not complete."
          : "The loop has non-terminal error records.",
        confidence: loop.represented ? "inferred" : "known",
        owner: loop.owner,
        currentAttempt: loop.task?.id || loop.id,
        uncertainty:
          "Human may need to challenge whether each error is correctly classified and represented.",
        evidence: "tasks/tree.json context.workflowProgress",
        requiredResponse:
          "Only intervene if the representation or classification looks wrong.",
        clearCondition:
          "error records are classified into repair, exact wait, terminal disposition, or passing proof",
        action: "Challenge Classification",
        actionKind: "challenge",
        taskId: loop.task?.id,
        loopId: loop.id,
      });
    }
  }

  for (const alert of allMetricAlerts().slice(0, 8)) {
    const id = alert.metricId || alert.metric_id || alert.id;
    const metric = metricById(id);
    const current = metric?.current ?? alert.current;
    const threshold = metric?.threshold ?? alert.threshold;
    issues.push({
      key: `metric.${id}`,
      group: "Metric-discovered",
      severity: metric?.priority || alert.priority || "P2",
      rawFact: `${id}: current ${formatMetricValue(current)}${threshold == null ? "" : `, threshold ${formatMetricValue(threshold)}`}`,
      hint: alert.message || alert.alertMessage || metric?.description || id,
      confidence: metric ? "known" : "inferred",
      owner: metric?.owner || "project-planner",
      currentAttempt: alert.alertId || alert.alert_id || "open metric alert",
      uncertainty:
        "Metric breach needs owner classification before it becomes repair, wait, escalation, or no-op.",
      evidence: "/api/metrics",
      requiredResponse:
        "Review the signal only if the owner has not already converted it to work.",
      clearCondition: "metric alert resolves or has accepted no-op/owned work",
      action: "Review Signal",
      actionKind: "signal",
    });
  }

  issues.push(
    {
      key: "coverage.runtime-trace",
      group: "Coverage gap",
      severity: "P2",
      rawFact: "Runtime route trace is not available in the browser readout.",
      hint: "The page cannot prove every emitted event reached its handler.",
      confidence: "known",
      owner: "project-stall-review",
      currentAttempt: "observability design gap",
      uncertainty:
        "Event black holes may exist outside the current task-tree view.",
      evidence: "future .state/process-routes.jsonl",
      requiredResponse:
        "Decide whether this visibility gap needs implementation now.",
      clearCondition: "runtime route trace is readable and correlated",
      action: "Review Observability Gap",
      actionKind: "observability",
    },
    {
      key: "coverage.static-graph",
      group: "Coverage gap",
      severity: "P2",
      rawFact:
        "Static app graph check is not available in the browser readout.",
      hint: "The page cannot prove app event routes are all handled or terminal.",
      confidence: "known",
      owner: "project-planner",
      currentAttempt: "observability design gap",
      uncertainty:
        "Unhandled events may be invisible until static graph readout exists.",
      evidence: "app.ts and workflow metadata",
      requiredResponse: "Review graph readout implementation priority.",
      clearCondition: "static graph reports zero unhandled internal events",
      action: "Review Observability Gap",
      actionKind: "observability",
    },
  );

  return issues;
}

function buildProcessOverview(tree) {
  const stats = taskStats(tree);
  const loops = loopReports(tree);
  const issues = buildProcessIssues(tree, loops);
  const coverage = buildCoverageRows(tree, loops);
  const roots = taskRoots(tree);
  const activeTasks = (tree.active_task_ids || [])
    .map((id) => tree.tasks?.[id])
    .filter(Boolean);
  const reviewLeaves = leavesByState(tree, "review");
  const blockedLeaves = leavesByState(tree, "blocked");
  const alerts = allMetricAlerts();
  const latestLoopAt = latestTimestamp(loops.map((loop) => loop.updatedAt));
  const lastMovement = latestTimestamp([tree.updated_at, latestLoopAt]);
  const processStatus =
    issues.some((issue) => issue.severity === "P0") || roots.length === 0
      ? "Broken"
      : issues.length || alerts.length || roots.length !== 1
        ? "Attention"
        : "Healthy";
  const resultStatus = loops.some((loop) => loop.error > 0)
    ? "Attention"
    : loops.every((loop) => loop.completionReady === true)
      ? "Healthy"
      : "Unknown";
  return {
    stats,
    loops,
    issues,
    coverage,
    roots,
    activeTasks,
    reviewLeaves,
    blockedLeaves,
    alerts,
    lastMovement,
    processStatus,
    resultStatus,
  };
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

function metricHealth(metric, value) {
  if (!metric) return { label: "local", tone: "neutral" };
  if (metric.alertOpen) return { label: "alert", tone: "alert" };
  const current = Number(value ?? metric.current);
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
  const fallback = METRIC_FALLBACKS[id];
  if (metric) {
    return {
      metric,
      value:
        metric.current == null || metric.current === ""
          ? fallback
            ? fallback(stats)
            : null
          : metric.current,
    };
  }
  return {
    metric: null,
    value: fallback ? fallback(stats) : null,
  };
}

function metricNumberValue(id, stats) {
  const { value } = metricValueFor(id, stats);
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function activeTasksWithoutStartedWorker(tree) {
  const now = Date.now();
  return (tree?.active_task_ids || [])
    .map((id) => tree.tasks?.[id])
    .filter(Boolean)
    .filter((task) => !task.trace?.worker_started_at)
    .map((task) => {
      const assignedAt = parseTime(task.trace?.assigned_at);
      return {
        task,
        assignedAgeMs: assignedAt == null ? null : now - assignedAt,
      };
    })
    .sort((a, b) => (b.assignedAgeMs || 0) - (a.assignedAgeMs || 0));
}

function bottleneckTone(value, warnAt = 1, badAt = 1) {
  if (value == null) return "watch";
  if (value >= badAt) return "bad";
  if (value >= warnAt) return "watch";
  return "ok";
}

function compactCandidateIds(tasks, limit = 3) {
  const ids = tasks
    .filter(Boolean)
    .map((task) => task.id || task.task?.id)
    .filter(Boolean)
    .slice(0, limit);
  return ids.length ? ids.join(", ") : "none";
}

function buildBottleneckRows(tree, overview) {
  const stats = overview.stats;
  const activeTasks = overview.activeTasks;
  const activeNoStart = activeTasksWithoutStartedWorker(tree);
  const unrepresentedLoops = overview.loops.filter(
    (loop) => Number(loop.unrepresented) > 0,
  );
  const rootCount = overview.roots.length;
  const unpublished = metricNumberValue(
    "aks-rp-e2e.process.unpublished-change-count",
    stats,
  );
  const unowned = metricNumberValue(
    "aks-rp-e2e.process.unowned-work-count",
    stats,
  );
  const staleActive = metricNumberValue(
    "aks-rp-e2e.task.stale-active-count",
    stats,
  );
  const underfilled = metricNumberValue(
    "aks-rp-e2e.task.capacity-underfilled-with-gaps",
    stats,
  );
  const noWork = metricNumberValue("aks-rp-e2e.task.no-work-with-gaps", stats);
  const slowPlanner = metricNumberValue(
    "aks-rp-e2e.planner.slow-count-24h",
    stats,
  );
  const activeFanout = activeTasks.length;

  return [
    {
      key: "task-tree-integrity",
      signalKey: "process.integrity.task-tree-root-count",
      name: "Task tree valid?",
      value: rootCount,
      tone: rootCount === 1 ? "ok" : "bad",
      rank: 100,
      question: "Does the task tree have exactly one project root?",
      meaning:
        "Multiple roots can hide work outside the intended project tree, so process status cannot be fully trusted.",
      action:
        rootCount === 1
          ? "no action"
          : "ask planner to repair or intentionally archive the extra root",
      candidates: overview.roots.join(", ") || "none",
    },
    {
      key: "github-visible",
      signalKey: "aks-rp-e2e.process.unpublished-change-count",
      name: "Pipeline has repo changes?",
      value: unpublished,
      tone: bottleneckTone(unpublished),
      rank: 90,
      question: "Were aks-rp-e2e repo changes committed and pushed?",
      meaning:
        "This checks the aks-rp-e2e repo that Azure DevOps pipeline runs use. App UI and task-state changes in aks-rp-e2e.app take effect locally and are not counted here.",
      action:
        unpublished && unpublished > 0
          ? "commit and push intended aks-rp-e2e repo changes, or discard unintended churn"
          : "no action",
      candidates: "git status in /app/projects/aks-rp-e2e",
    },
    {
      key: "owned-work",
      signalKey: "aks-rp-e2e.process.unowned-work-count",
      name: "Work has owners?",
      value: unowned,
      tone: bottleneckTone(unowned),
      rank: 90,
      question: "Does every unfinished item have a task, wait, or escalation?",
      meaning:
        "This catches loop ledger work that exists but has no visible owner.",
      action:
        unowned && unowned > 0
          ? "pulse the loop or create recovery/wait work"
          : "no action",
      candidates: compactCandidateIds(
        unrepresentedLoops.map((loop) => loop.task),
      ),
    },
    {
      key: "worker-liveness",
      signalKey: "aks-rp-e2e.task.stale-active-count",
      name: "Workers alive?",
      value: staleActive,
      tone: bottleneckTone(staleActive),
      rank: 80,
      question: "Are active tasks actually attached to running workers?",
      meaning:
        "If this is high, the board says active but the work is not really moving.",
      action:
        staleActive && staleActive > 0
          ? "requeue stale active tasks or restart workers"
          : "no action",
      candidates: compactCandidateIds(activeNoStart.map((row) => row.task)),
    },
    {
      key: "planner-speed",
      signalKey: "aks-rp-e2e.planner.slow-count-24h",
      name: "Planner slow?",
      value: slowPlanner,
      tone: bottleneckTone(slowPlanner, 1, 10),
      rank: 70,
      question: "Is planner/review taking too long to apply results?",
      meaning:
        "Slow planner runs usually mean review fanout, large state diffs, or unclear next actions.",
      action:
        slowPlanner && slowPlanner > 0
          ? "inspect recent planner runs and reduce broad review fanout"
          : "no action",
      candidates: compactCandidateIds(overview.reviewLeaves),
    },
    {
      key: "active-fanout",
      signalKey: "local.active-fanout",
      name: "Too much at once?",
      value: activeFanout,
      tone: activeFanout > 50 ? "bad" : activeFanout > 20 ? "watch" : "ok",
      rank: 50,
      question: "Did we activate more work than humans/workers can process?",
      meaning:
        "Large active fanout can make the project look busy while review and planner throughput becomes the bottleneck.",
      action:
        activeFanout > 20
          ? "let active work drain or throttle assignment waves"
          : "no action",
      candidates: compactCandidateIds(activeTasks),
    },
    {
      key: "work-assigned",
      signalKey: "aks-rp-e2e.task.capacity-underfilled-with-gaps",
      name: "Enough work assigned?",
      value:
        underfilled == null && noWork == null
          ? null
          : (underfilled || 0) + (noWork || 0),
      tone: bottleneckTone((underfilled || 0) + (noWork || 0)),
      rank: 60,
      question: "Are there gaps but no runnable or active work?",
      meaning:
        "This points to planner/dispatcher starvation instead of worker slowness.",
      action:
        (underfilled || 0) + (noWork || 0) > 0
          ? "ask planner to refill concrete runnable work"
          : "no action",
      candidates: compactCandidateIds(leavesByState(tree, "backlog")),
    },
  ];
}

function renderBottleneckCard(row) {
  return `<div class="bottleneck-card bottleneck-${esc(row.tone)}" data-bottleneck="${attrEsc(row.key)}">
    <div class="bottleneck-top">
      <div class="bottleneck-name">${esc(row.name)}</div>
      <div class="bottleneck-value">${esc(formatMetricValue(row.value))}</div>
    </div>
    <div class="bottleneck-question">${esc(row.question)}</div>
    <div class="bottleneck-meaning">${esc(row.meaning)}</div>
    <div class="bottleneck-candidates"><strong>Candidates:</strong> ${esc(row.candidates)}</div>
    <div class="bottleneck-action"><strong>Next:</strong> ${esc(row.action)}</div>
    <div class="bottleneck-actions"><button class="btn" onclick="prefillBottleneckReview('${attrEsc(row.key)}')" title="Prepare a planner review request for this signal">Prepare Review</button></div>
  </div>`;
}

function bottleneckPriority(row) {
  const toneScore = { bad: 3, watch: 2, ok: 1 }[row.tone] || 0;
  const valueScore = Number(row.value);
  const rank = Number(row.rank);
  return (
    toneScore * 1_000_000 +
    (Number.isFinite(rank) ? rank * 1_000 : 0) +
    (Number.isFinite(valueScore) ? valueScore : 0)
  );
}

function renderLeadReadout(bottlenecks) {
  const lead = [...bottlenecks]
    .filter((row) => row.tone !== "ok")
    .sort((a, b) => bottleneckPriority(b) - bottleneckPriority(a))[0];

  if (!lead) {
    return `<div class="lead-readout lead-ok" data-testid="process-lead">
      <div class="lead-title">First read: no process bottleneck is firing.</div>
      <div class="lead-detail">The board may still contain normal work, but the main sensors do not show stale pipeline repo state, unowned work, stale workers, planner starvation, or overload.</div>
      <div class="lead-next"><strong>Next:</strong> use the raw sections below if the result still feels wrong.</div>
    </div>`;
  }

  return `<div class="lead-readout lead-${esc(lead.tone)}" data-testid="process-lead">
    <div class="lead-title">First check: ${esc(lead.question)} Raw count: ${esc(formatMetricValue(lead.value))}.</div>
    <div class="lead-detail">${esc(lead.meaning)} Candidates: ${esc(lead.candidates)}.</div>
    <div class="lead-next"><strong>Next:</strong> ${esc(lead.action)}.</div>
  </div>`;
}

function snapshotValue(snapshot) {
  const value =
    snapshot?.value ??
    snapshot?.current ??
    snapshot?.metric_value ??
    snapshot?.measurement;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metricSeries(id, value) {
  const snapshots = state.metricHistory.get(id) || [];
  const values = snapshots.map(snapshotValue).filter((item) => item != null);
  const current = Number(value);
  if (Number.isFinite(current)) {
    if (!values.length || values[values.length - 1] !== current) {
      values.push(current);
    }
  }
  if (values.length === 1) values.push(values[0]);
  return values;
}

function renderMetricSparkline(id, metric, value, health) {
  const values = metricSeries(id, value);
  const hasHistory = (state.metricHistory.get(id) || []).length >= 2;
  if (!values.length) {
    return `<div class="metric-chart metric-chart-empty">No samples</div>`;
  }

  const width = 160;
  const height = 42;
  const pad = 3;
  const threshold = Number(metric?.threshold);
  const numericThreshold = Number.isFinite(threshold) ? threshold : null;
  const domain = [...values];
  if (numericThreshold != null) domain.push(numericThreshold);
  let min = Math.min(...domain);
  let max = Math.max(...domain);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min || 1;
  const xStep = (width - pad * 2) / Math.max(1, values.length - 1);
  const yFor = (item) =>
    height - pad - ((item - min) / range) * (height - pad * 2);
  const points = values
    .map((item, index) => `${pad + index * xStep},${yFor(item).toFixed(2)}`)
    .join(" ");
  const thresholdLine =
    numericThreshold == null
      ? ""
      : `<line x1="${pad}" y1="${yFor(numericThreshold).toFixed(2)}" x2="${width - pad}" y2="${yFor(numericThreshold).toFixed(2)}" class="metric-threshold" />`;
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaLabel =
    values.length < 2
      ? "flat"
      : `${delta > 0 ? "+" : ""}${formatMetricValue(delta)}`;
  const trendTone = delta === 0 ? "neutral" : delta > 0 ? "up" : "down";
  const strokeClass =
    health.tone === "alert" ? "metric-line-alert" : "metric-line";

  return `<div class="metric-chart" aria-label="${attrEsc(id)} trend">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img">
      ${thresholdLine}
      <polyline class="${strokeClass}" points="${points}" />
    </svg>
    <div class="metric-trend">
      <span>${hasHistory ? "7d trend" : "waiting for samples"}</span>
      <strong class="trend-${trendTone}">${esc(deltaLabel)}</strong>
    </div>
  </div>`;
}

function renderMetricTile(id, label, stats) {
  const { metric, value } = metricValueFor(id, stats);
  const health = metricHealth(metric, value);
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
    ${renderMetricSparkline(id, metric, value, health)}
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

function renderStatusPill(label, status) {
  return `<span class="process-pill process-${processStatusTone(status)}"><strong>${esc(label)}</strong>${esc(status)}</span>`;
}

function renderProcessMetric(label, value, tone = "") {
  return `<div class="process-stat ${tone ? `process-stat-${tone}` : ""}">
    <div class="process-stat-value">${esc(value)}</div>
    <div class="process-stat-label">${esc(label)}</div>
  </div>`;
}

function renderActivityStage(label, value, detail, tone = "good") {
  return `<div class="activity-stage activity-${tone}">
    <div class="activity-stage-label">${esc(label)}</div>
    <div class="activity-stage-value">${esc(value)}</div>
    <div class="activity-stage-detail">${esc(detail)}</div>
  </div>`;
}

function renderCoverageRow(row) {
  return `<div class="coverage-row coverage-${String(row.coverage || "").replace(/\s+/g, "-")}">
    <div>
      <div class="coverage-surface">${esc(row.surface)}</div>
      <div class="coverage-expected">${esc(row.expected)}</div>
    </div>
    <div>
      <div class="coverage-label">Observed</div>
      <div>${esc(row.observed)}</div>
    </div>
    <div>
      <div class="coverage-label">Freshness</div>
      <div>${esc(row.freshness)}</div>
    </div>
    <div>
      <div class="coverage-label">Coverage</div>
      <span class="pill">${esc(row.coverage)}</span>
    </div>
    <div>
      <div class="coverage-label">Blind Spot</div>
      <div>${esc(row.blindSpot)}</div>
      <div class="coverage-evidence">${esc(row.evidence)}</div>
    </div>
    <div class="coverage-actions">
      ${
        row.action
          ? `<button class="btn" onclick="prefillCoverageAction('${attrEsc(row.key)}', '${attrEsc(row.actionKind)}')">${esc(row.action)}</button>`
          : `<span class="muted">No user action</span>`
      }
    </div>
  </div>`;
}

function renderLoopRow(loop) {
  const statusTone =
    loop.status === "complete"
      ? "good"
      : loop.status === "unrepresented"
        ? "bad"
        : "warn";
  const compactReason = loop.reason
    ? loop.reason.length > 180
      ? `${loop.reason.slice(0, 180)}...`
      : loop.reason
    : "No loop reason recorded.";
  return `<div class="loop-row loop-${statusTone}" data-loop-id="${attrEsc(loop.id)}">
    <div>
      <div class="loop-title">${esc(loop.label)}</div>
      <div class="loop-id">${esc(loop.id)}</div>
    </div>
    <div class="loop-state">
      <span class="pill">${esc(loop.status)}</span>
      <span class="muted">${loop.completionReady === true ? "complete" : loop.completionReady === false ? "incomplete" : "unknown"}</span>
    </div>
    <div class="loop-counts">
      <span>pending ${esc(formatCount(loop.pending))}</span>
      <span>running ${esc(formatCount(loop.running))}</span>
      <span>done ${esc(formatCount(loop.done))}</span>
      <span>error ${esc(formatCount(loop.error))}</span>
      <span>unrepresented ${esc(loop.unrepresented == null ? "unknown" : formatCount(loop.unrepresented))}</span>
    </div>
    <div>
      <div class="coverage-label">Raw Fact</div>
      <div class="loop-reason">${esc(compactReason)}</div>
      <div class="coverage-evidence">updated ${esc(formatAge(loop.updatedAt))} | ${esc(loop.owner)}</div>
    </div>
    <div class="coverage-actions">
      <button class="btn" onclick="selectTask('${attrEsc(loop.id)}')">Open Task</button>
      <button class="btn" onclick="prefillReviewLoop('${attrEsc(loop.id)}')">Review Loop</button>
      <button class="btn" onclick="prefillChallengeClassification('${attrEsc(loop.id)}')">Challenge</button>
    </div>
    ${renderActivePipelineWaits(loop.activePipelineWaits)}
  </div>`;
}

function renderActivePipelineWaits(waits) {
  if (!waits?.length) return "";
  return `<div class="active-pipeline-waits">
    <div class="coverage-label">Active ADO Waits</div>
    <div class="pipeline-wait-list">
      ${waits.map(renderActivePipelineWait).join("")}
    </div>
  </div>`;
}

function renderActivePipelineWait(wait) {
  const runUrl = safeHttpUrl(wait.runUrl);
  const runLabel = wait.runId ? `run ${wait.runId}` : "run unknown";
  const runHtml = runUrl
    ? `<a href="${attrEsc(runUrl)}" target="_blank" rel="noreferrer">${esc(runLabel)}</a>`
    : esc(runLabel);
  return `<div class="pipeline-wait-row">
    <div>
      <div class="coverage-label">Feature</div>
      <div>${esc(wait.featureKey || "unknown")}</div>
    </div>
    <div>
      <div class="coverage-label">ADO Run</div>
      <div>${runHtml}</div>
      <div class="coverage-evidence">${esc(wait.runStatus || "status unknown")}</div>
    </div>
    <div>
      <div class="coverage-label">Waiting For</div>
      <div>${esc(wait.watchedCondition || "pipeline completion")}</div>
      ${wait.runTitle ? `<div class="coverage-evidence">${esc(wait.runTitle)}</div>` : ""}
    </div>
    <div>
      <div class="coverage-label">Expected Result</div>
      <div>${esc(wait.expectedArtifact || "test result artifact")}</div>
    </div>
    <div>
      <div class="coverage-label">Next/Fallback</div>
      <div>next ${esc(formatTime(wait.nextCheckAt))}</div>
      <div class="coverage-evidence">fallback ${esc(formatTime(wait.fallbackAt))}</div>
    </div>
  </div>`;
}

function renderIssueRow(issue) {
  const taskAction =
    issue.taskId && state.tree?.tasks?.[issue.taskId]
      ? `<button class="btn" onclick="selectTask('${attrEsc(issue.taskId)}')">Open Task</button>`
      : "";
  const actionButton =
    issue.actionKind === "loop"
      ? `<button class="btn" onclick="prefillReviewLoop('${attrEsc(issue.loopId || issue.taskId || issue.key)}')">${esc(issue.action)}</button>`
      : issue.actionKind === "observability"
        ? `<button class="btn" onclick="prefillObservabilityGap('${attrEsc(issue.key)}')">${esc(issue.action)}</button>`
        : issue.actionKind === "challenge"
          ? `<button class="btn" onclick="prefillChallengeClassification('${attrEsc(issue.loopId || issue.taskId || issue.key)}')">${esc(issue.action)}</button>`
          : issue.actionKind === "signal"
            ? `<button class="btn" onclick="prefillSignalReview('${attrEsc(issue.key)}')">${esc(issue.action)}</button>`
            : `<button class="btn" onclick="prefillPlannerReview('${attrEsc(issue.key)}')">${esc(issue.action)}</button>`;
  return `<div class="issue-row issue-${esc(String(issue.severity).toLowerCase())}">
    <div>
      <div class="issue-key">${esc(issue.key)}</div>
      <div class="issue-group">${esc(issue.group)} | ${esc(issue.severity)}</div>
    </div>
    <div>
      <div class="coverage-label">Raw Fact</div>
      <div>${esc(issue.rawFact)}</div>
      <div class="coverage-evidence">${esc(issue.evidence)}</div>
    </div>
    <div>
      <div class="coverage-label">Hint</div>
      <div>${esc(issue.hint)}</div>
    </div>
    <div>
      <div class="coverage-label">Confidence</div>
      <span class="pill">${esc(issue.confidence)}</span>
      <div class="issue-uncertainty">${esc(issue.uncertainty)}</div>
    </div>
    <div>
      <div class="coverage-label">Owner And Attempt</div>
      <div>${esc(issue.owner)}</div>
      <div class="coverage-evidence">${esc(issue.currentAttempt)}</div>
    </div>
    <div>
      <div class="coverage-label">Clear Condition</div>
      <div>${esc(issue.clearCondition)}</div>
      <div class="issue-response">${esc(issue.requiredResponse)}</div>
    </div>
    <div class="issue-actions">${taskAction}${actionButton}</div>
  </div>`;
}

function renderProcessOverview(tree) {
  const overview = buildProcessOverview(tree);
  const bottlenecks = buildBottleneckRows(tree, overview);
  const hotBottlenecks = bottlenecks.filter((row) => row.tone !== "ok").length;
  const activeNames = overview.activeTasks
    .slice(0, 4)
    .map((task) => task.id)
    .join(", ");
  const loopUpdates = overview.loops
    .map((loop) => `${loop.label}: ${formatAge(loop.updatedAt)}`)
    .join(" | ");
  const issueLimit = 8;
  const issues = overview.issues.slice(0, issueLimit);
  return `<section class="process-overview" data-testid="process-overview">
    <div class="panel process-hero">
      <div class="panel-head">
        <div>
          <div class="kicker">Start Here</div>
          <div class="title">Is The Project Moving?</div>
          <div class="muted">Read this from left to right. The cards show where work can get stuck, the raw count, likely candidates, and the next check.</div>
        </div>
        <div class="process-status-set">
          ${renderStatusPill("Process", overview.processStatus)}
          ${renderStatusPill("AKS Results", overview.resultStatus)}
        </div>
      </div>
      <div class="bottleneck-strip" data-testid="process-bottlenecks">
        ${renderLeadReadout(bottlenecks)}
        ${bottlenecks.map(renderBottleneckCard).join("")}
      </div>
      <div class="process-stats">
        ${renderProcessMetric("last movement", overview.lastMovement ? formatAge(overview.lastMovement) : "unknown", "neutral")}
        ${renderProcessMetric("bottlenecks", hotBottlenecks, hotBottlenecks ? "warn" : "good")}
        ${renderProcessMetric("open signals", overview.issues.length, overview.issues.length ? "warn" : "good")}
        ${renderProcessMetric("active work", overview.activeTasks.length, overview.activeTasks.length ? "good" : "neutral")}
        ${renderProcessMetric("pending review", overview.reviewLeaves.length, overview.reviewLeaves.length ? "warn" : "good")}
        ${renderProcessMetric("exact waits", overview.blockedLeaves.length, overview.blockedLeaves.length ? "warn" : "good")}
      </div>
      <div class="activity-strip">
        ${renderActivityStage("Planner", state.metrics.length ? "observable" : "inferred", `tree updated ${formatAge(tree.updated_at)}`, "good")}
        ${renderActivityStage("Worker", overview.activeTasks.length ? "active" : "idle", activeNames || "no active task ids", overview.activeTasks.length ? "good" : "warn")}
        ${renderActivityStage("Reviewer", overview.reviewLeaves.length ? "waiting" : "clear", `${overview.reviewLeaves.length} review leaf/leaves`, overview.reviewLeaves.length ? "warn" : "good")}
        ${renderActivityStage("Loop control", "active", loopUpdates || "no loop roots", "good")}
      </div>
    </div>

    <div class="process-grid">
      <section class="panel process-panel" data-testid="coverage-readout">
        <div class="panel-head">
          <div>
            <div class="kicker">What This Page Can See</div>
            <div class="title">Trust And Blind Spots</div>
            <div class="muted">Use this to know whether a green status is real proof or only a partial readout.</div>
          </div>
          <span class="pill">${overview.coverage.filter((row) => row.coverage !== "complete").length} gap(s)</span>
        </div>
        <div class="coverage-list">
          ${overview.coverage.map(renderCoverageRow).join("")}
        </div>
      </section>

      <section class="panel process-panel" data-testid="durable-loop-readout">
        <div class="panel-head">
          <div>
            <div class="kicker">Long-Running Queues</div>
            <div class="title">What The System Is Working On</div>
            <div class="muted">Each loop must turn unfinished records into active work, review work, exact waits, escalations, or pass results.</div>
          </div>
          <span class="pill">${overview.loops.filter((loop) => loop.completionReady !== true).length} incomplete</span>
        </div>
        <div class="loop-list">
          ${overview.loops.map(renderLoopRow).join("")}
        </div>
      </section>
    </div>

    <section class="panel process-panel" data-testid="potential-issues">
      <div class="panel-head">
        <div>
          <div class="kicker">Things Worth Checking</div>
          <div class="title">Raw Facts With Hints</div>
          <div class="muted">These rows are not final judgment. They are facts plus hints so a human can challenge or confirm the system.</div>
        </div>
        <span class="pill">${overview.issues.length} issue row(s)</span>
      </div>
      <div class="issue-list">
        ${issues.length ? issues.map(renderIssueRow).join("") : `<div class="empty">No issue observed from the browser readout. Check coverage before treating this as complete.</div>`}
        ${overview.issues.length > issueLimit ? `<div class="empty">${overview.issues.length - issueLimit} more issue row(s)</div>` : ""}
      </div>
    </section>
  </section>`;
}

function renderProjectMetrics(tree) {
  const stats = taskStats(tree);
  return `<section class="panel metrics-panel" data-testid="project-metrics">
    <div class="panel-head">
      <div>
        <div class="kicker">Raw Sensor Details</div>
        <div class="title">Metrics Behind The Bottleneck Cards</div>
        <div class="muted">Use this when the start-here cards point to a problem and you need the exact metric, threshold, and trend.</div>
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
  const progressDone = stats.total
    ? Math.round((stats.done / stats.total) * 100)
    : 0;
  const progressBlocked = stats.total
    ? Math.round((stats.blocked / stats.total) * 100)
    : 0;
  const progressActive =
    stats.total && stats.active
      ? Math.max(1, Math.round((stats.active / stats.total) * 100))
      : 0;
  return `<section class="summary-grid">
    <div class="panel current-panel">
      <div class="panel-head">
        <div>
          <div class="kicker">Running Now</div>
          <div class="title">${esc(activeTitle)}</div>
        </div>
        <span class="pill" style="color:${taskColor(taskState(active))}">${active ? esc(kanbanLabel(active)) : "Idle"}</span>
      </div>
      ${activeWorkHtml}
      ${state.kanbanWarning ? `<div class="notice" data-testid="kanban-projection-warning">${esc(state.kanbanWarning)}</div>` : ""}
      <div class="progress" title="${stats.done} done, ${stats.blocked} blocked, ${stats.active} active, ${stats.total} total">
        <span class="progress-accepted" style="width:${progressDone}%"></span>
        <span class="progress-active" style="width:${progressActive}%"></span>
        <span class="progress-blocked" style="width:${progressBlocked}%"></span>
      </div>
      <div class="metrics">
        ${renderMetric("task cards", stats.total)}
        ${renderMetric("backlog", stats.backlog, "var(--muted)")}
        ${renderMetric("in progress", stats.active, "var(--blue)")}
        ${renderMetric("review", stats.review, "var(--orange)")}
        ${renderMetric("blocked", stats.blocked, "var(--yellow)")}
        ${renderMetric("done", stats.done, "var(--green)")}
        ${renderMetric("open escalations", stats.escalated, "var(--orange)")}
      </div>
    </div>
    <div class="panel steering-panel">
      <div>
        <div class="kicker">Human Action</div>
        <div class="title">Send A Planner Request</div>
        <div class="muted">Use this when you want the project owner to inspect raw facts and turn them into work, an exact wait, an escalation, or an accepted no-op.</div>
      </div>
      <div class="steer-help" data-testid="planner-request-help">
        <strong>How this works</strong>
        <div>Buttons like Prepare Review fill this box with a complete request. You can send it as-is, or add context before sending.</div>
        <div>Send To Planner posts a planning event. The agent does not answer in this textarea; refresh the page to see follow-up as changed tasks, review rows, waits, escalations, or messages.</div>
        <div>If the agent needs human input, it should create a visible human-needed task, escalation, or message with a clear resume condition.</div>
      </div>
      <textarea id="global-steer-text" data-testid="global-steer-textarea" placeholder="Prepared requests appear here. You can send them as-is or add context."></textarea>
      <div class="actions">
        <button class="btn btn-primary" onclick="sendSteering('global-steer-text', 'global-send-status')" data-testid="send-global-steering">Send To Planner</button>
        <button class="btn" onclick="prefillAdvance()">Advance</button>
        <button class="btn" onclick="prefillReviewFrontier()">Blocked</button>
        <button class="btn" onclick="prefillMetricReview()">Metrics</button>
      </div>
      <div class="status" id="global-send-status" data-testid="global-send-status">No request prepared yet.</div>
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
    const legacyMappings = {
      planning: "backlog",
      ready: "backlog",
      active: "in-progress",
      archive: "done",
    };
    for (const [legacyKey, canonicalKey] of Object.entries(legacyMappings)) {
      const tasks = (projectedColumns[legacyKey] || [])
        .map((id) => tree.tasks?.[id])
        .filter(Boolean);
      columnsByKey[canonicalKey].push(...tasks);
    }
    for (const [key, tasks] of Object.entries(columnsByKey)) {
      const seen = new Set();
      columnsByKey[key] = tasks.filter((task) => {
        if (seen.has(task.id)) return false;
        seen.add(task.id);
        return true;
      });
    }
  } else {
    for (const task of kanbanTasks(tree)) {
      const column = kanbanColumn(task);
      if (columnsByKey[column]) columnsByKey[column].push(task);
    }
  }
  const columns = [
    ["backlog", "Backlog"],
    ["in-progress", "In Progress"],
    ["review", "Review"],
    ["blocked", "Blocked"],
    ["done", "Done"],
  ];
  const limits = {
    done: 20,
    backlog: 16,
    blocked: 20,
    "in-progress": 16,
    review: 16,
  };
  return `<section class="panel" data-testid="kanban-board">
    <div class="panel-head">
      <div>
        <div class="kicker">Task Board</div>
        <div class="title">Open Work By State</div>
      </div>
      <span class="muted">leaf task cards from ${TASK_TREE_FILE}${state.kanbanSource ? ` via ${esc(state.kanbanSource)}` : ""}</span>
    </div>
    <div class="kanban">
      ${columns
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
        <div class="kicker">Full Breakdown</div>
        <div class="title">Task Tree</div>
        <div class="muted">Use this when you need the parent/child context behind a board card or bottleneck candidate.</div>
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
  const doneKnowledge =
    taskState(task) === "done" ? taskKnowledgeSummary(task) : "";
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
      taskState(task) === "done"
        ? `<div class="detail-section knowledge-panel">
      <div class="kicker">Done Knowledge</div>
      <div class="detail-list">
        <div>${esc(doneKnowledge || "Recorded by the project owner as reusable project understanding.")}</div>
        <div>Evidence: ${evidenceLinks(task)}</div>
        ${
          reusableFor.length
            ? `<div>Reusable for: ${esc(reusableFor.join(", "))}</div>`
            : ""
        }
        ${task.done_at || task.trace?.done_at || task.accepted_at || task.trace?.accepted_at ? `<div>Done at: ${esc(task.done_at || task.trace?.done_at || task.accepted_at || task.trace?.accepted_at)}</div>` : ""}
        ${task.done_by || task.trace?.done_by || task.accepted_by || task.trace?.accepted_by ? `<div>Done by: ${esc(task.done_by || task.trace?.done_by || task.accepted_by || task.trace?.accepted_by)}</div>` : ""}
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
        ${task.conflict_scope?.length ? `<div>Conflict scope: ${esc(Array.isArray(task.conflict_scope) ? task.conflict_scope.join(", ") : String(task.conflict_scope))}</div>` : ""}
      </div>
    </div>
    <div class="detail-section steer-box">
      <div>
        <div class="kicker">Task Feedback</div>
        <div class="muted">Attach feedback to this node so the project owner can update the project tree with the local context in mind.</div>
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
    renderProcessOverview(tree),
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

function setInputStatus(text, statusId = "global-send-status") {
  const status = document.getElementById(statusId);
  if (status) status.textContent = text;
}

function prefillAdvance() {
  const active = primaryActiveTask(state.tree);
  state.selectedTaskId = active?.id || state.selectedTaskId;
  render();
  setSteerText(
    `[resume] Advance aks-rp-e2e through the task tree.\n\nCurrent task: ${active?.id || "none"}\n\nUse the task tree as the project thinking surface. Keep working until blocked by a concrete gate/input, complete, or budget-limited. Do not accept no_work or waiting as terminal. Verify claims and record done knowledge before closing tasks.`,
    "global-steer-text",
  );
}

function prefillReviewFrontier() {
  const blocked = Object.values(state.tree?.tasks || {})
    .filter(
      (task) => taskState(task) === "blocked" && hasExternalBlockSignal(task),
    )
    .slice(0, 8)
    .map((task) => `- ${task.id}: ${task.blocker || task.goal}`)
    .join("\n");
  setSteerText(
    `[task-steer] aks-rp-e2e frontier review\n\naction: review_frontier\n\nReview the current blocked/review frontier and decide what can still move locally. Convert vague no-work/waiting into concrete backlog work, exact blocker, human question, or obsolete done work. Preserve done knowledge that future tasks can reuse.\n\nBlocked sample:\n${blocked || "- none"}`,
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
    `[metric-steer] aks-rp-e2e project health review\n\naction: review_metrics\n\nReview the project metrics and task tree together. If a metric indicates starvation, duplicate work, idle live execution, or blocked knowledge paths, update the task tree with concrete backlog, repair, unblock, or verification work. Do not add synthetic tracking-only tasks unless they clarify the actual project plan.\n\nOpen alerts:\n${alertLines || "- none"}`,
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

function prefillPlannerReview(signalKey = "process-review") {
  const overview = buildProcessOverview(state.tree);
  const issue = overview.issues.find((row) => row.key === signalKey);
  setSteerText(
    `[process-steer] aks-rp-e2e planner review\n\naction: request_planner_review\n\nReview the process readout row and update the task tree only if there is concrete repair, exact wait, terminal disposition, or accepted no-op work to record.\n\nSignal: ${signalKey}\nRaw fact: ${issue?.rawFact || "see process overview"}\nSystem hint: ${issue?.hint || "planner review requested from Kanban process surface"}\nConfidence: ${issue?.confidence || "inferred"}\nUncertainty: ${issue?.uncertainty || "not specified"}\nClear condition: ${issue?.clearCondition || "the owner records an explicit decision or the signal clears"}\n\nDo not hide the raw fact behind a broad status. If the next step is deterministic and safe, perform it; otherwise create exact owned work or an exact wait.`,
    "global-steer-text",
  );
}

function prefillSignalReview(signalKey = "metric-discovered") {
  const overview = buildProcessOverview(state.tree);
  const issue = overview.issues.find((row) => row.key === signalKey);
  setSteerText(
    `[process-steer] aks-rp-e2e signal review\n\naction: review_signal\n\nReview this metric or signal as a raw fact plus hint. Decide whether it is already owned, needs repair work, needs exact wait/escalation, or is an accepted no-op.\n\nSignal: ${signalKey}\nRaw fact: ${issue?.rawFact || "see metric alert"}\nSystem hint: ${issue?.hint || "metric-discovered signal"}\nOwner: ${issue?.owner || "project-planner"}\nClear condition: ${issue?.clearCondition || "metric clears or owned work/no-op is recorded"}`,
    "global-steer-text",
  );
}

function prefillBottleneckReview(key = "process-bottleneck") {
  const overview = buildProcessOverview(state.tree);
  const row = buildBottleneckRows(state.tree, overview).find(
    (item) => item.key === key,
  );
  setSteerText(
    `[process-steer] aks-rp-e2e bottleneck review\n\naction: review_bottleneck\n\nReview this project bottleneck using the raw count and candidates. Decide whether it is already healthy, needs repair work, needs throttling, needs an aks-rp-e2e repo commit/push, or needs an exact wait/escalation.\n\nBottleneck: ${row?.name || key}\nSignal: ${row?.signalKey || key}\nRaw value: ${row?.value ?? "unknown"}\nQuestion: ${row?.question || "where is work stuck?"}\nMeaning: ${row?.meaning || "not recorded"}\nCandidate tasks/sessions: ${row?.candidates || "none"}\nSuggested next check: ${row?.action || "inspect process state"}\n\nDo not hide the raw number. If the signal is real, update the task tree with concrete owned work or publish/discard aks-rp-e2e repo changes. If it is already handled, record why it is safe.`,
    "global-steer-text",
  );
  setInputStatus(
    "Planner request prepared. Send it as-is, or add what you want the planner to consider.",
  );
}

function prefillReviewLoop(loopId) {
  const loop = loopReports(state.tree).find((item) => item.id === loopId);
  setSteerText(
    `[process-steer] aks-rp-e2e durable loop review\n\naction: review_loop\n\nReview the durable loop raw facts and decide whether the loop is correctly moving, exactly waiting, represented by repair work, or missing owned work.\n\nLoop: ${loopId}\nExpected: ${loop?.expected || "non-terminal records must be represented"}\nRaw fact: pending=${loop?.pending ?? "unknown"}, running=${loop?.running ?? "unknown"}, done=${loop?.done ?? "unknown"}, error=${loop?.error ?? "unknown"}, unrepresented=${loop?.unrepresented ?? "unknown"}\nConfidence: ${loop?.unrepresented === 0 ? "inferred from workflowProgress" : "known from workflowProgress"}\nReason: ${loop?.reason || "none recorded"}\nClear condition: completionReady=true, or every non-terminal record is represented by active work, review work, exact wait, escalation, or terminal disposition.\n\nPreserve raw evidence and do not mark blocked/wait as complete unless the exact resume condition is recorded.`,
    "global-steer-text",
  );
}

function prefillObservabilityGap(key = "coverage-gap") {
  const overview = buildProcessOverview(state.tree);
  const coverage = overview.coverage.find((row) => row.key === key);
  const issue = overview.issues.find((row) => row.key === key);
  setSteerText(
    `[process-steer] aks-rp-e2e observability gap review\n\naction: review_observability_gap\n\nReview whether this missing/stale/inferred visibility is acceptable for current project operation. If not, create the smallest repair task that makes the raw fact observable.\n\nCoverage row: ${key}\nSurface: ${coverage?.surface || "unknown"}\nExpected: ${coverage?.expected || issue?.hint || "expected observation missing"}\nObserved: ${coverage?.observed || issue?.rawFact || "not observed"}\nCoverage: ${coverage?.coverage || issue?.confidence || "unknown"}\nBlind spot: ${coverage?.blindSpot || issue?.uncertainty || "unknown"}\nEvidence: ${coverage?.evidence || issue?.evidence || "not recorded"}\nClear condition: ${issue?.clearCondition || "coverage row becomes complete or an accepted terminal visibility gap is recorded"}`,
    "global-steer-text",
  );
}

function prefillCoverageAction(key, actionKind) {
  if (actionKind === "challenge") {
    prefillChallengeClassification(key);
    return;
  }
  if (actionKind === "observability") {
    prefillObservabilityGap(key);
    return;
  }
  prefillPlannerReview(key);
}

function prefillChallengeClassification(key = "classification") {
  const overview = buildProcessOverview(state.tree);
  const issue = overview.issues.find((row) => row.key === key);
  const loop = loopReports(state.tree).find((item) => item.id === key);
  const coverage = overview.coverage.find((row) => row.key === key);
  setSteerText(
    `[process-steer] aks-rp-e2e challenge classification\n\naction: challenge_classification\n\nChallenge the system hint using raw evidence. Re-evaluate the row and either keep the classification with evidence, change it, create repair/wait work, or record an accepted no-op.\n\nRow: ${key}\nRaw fact: ${issue?.rawFact || coverage?.observed || (loop ? `pending=${loop.pending}, error=${loop.error}, unrepresented=${loop.unrepresented}` : "see selected process row")}\nSystem hint: ${issue?.hint || coverage?.blindSpot || loop?.reason || "classification needs review"}\nConfidence: ${issue?.confidence || coverage?.coverage || (loop ? "inferred" : "unknown")}\nUncertainty: ${issue?.uncertainty || coverage?.blindSpot || "human challenge requested"}\nEvidence: ${issue?.evidence || coverage?.evidence || "task tree"}\nExpected re-evaluation condition: ${issue?.clearCondition || "classification is backed by evidence or changed into owned work/no-op"}`,
    "global-steer-text",
  );
}

function prefillSelected(action) {
  const task = selectedTask();
  if (!task) return;
  const escalation = taskEscalation(task);
  const prompts = {
    review: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: review\n\nReview this task's state, evidence, done knowledge, blockers, and parent rollup. Tell me whether it is correctly represented in the task tree and what should happen next.`,
    split: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: split\n\nIf this task is too broad or blocked ambiguously, split it into smaller executable child tasks. Preserve safety gates, forbidden actions, and evidence links.`,
    challenge: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: challenge\n\nChallenge this task state. Check whether the claim is over-closed, under-specified, blocked for the wrong reason, or missing a concrete next step.`,
    escalate: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: escalate\n\nReview whether this task is blocked by a real ownership boundary. If yes, create or refresh a task-linked escalation with owner, requested action, evidence, and resume condition. If local rework is possible, do not escalate; create backlog follow-up work instead.\n\nCurrent blocker: ${taskBlocker(task) || "none"}`,
    resolve: `[task-steer] aks-rp-e2e task ${task.id}\n\naction: resolve_escalation\n\nResolve escalation ${escalation?.id || task.escalation_id || "(missing)"} for this task. Record outcome fixed or answered only if the task can resume now; otherwise keep it blocked, ask for human input, or close it as obsolete done work with evidence. Wake project execution after updating the task.\n\nResolution summary: `,
    "reject-escalation": `[task-steer] aks-rp-e2e task ${task.id}\n\naction: reject_escalation\n\nDismiss escalation ${escalation?.id || task.escalation_id || "(missing)"} if the request is invalid, obsolete, or not enough to unblock the task. Explain what should happen next in the task tree.`,
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
          selectedTaskState: task ? taskState(task) : "",
        },
      },
    };
    const body = {
      type: "project.owner.requested",
      source: "web-ui",
      owner: "agent:aks-explorer",
      urgency: "high",
      target: { project: eventData.project },
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
          ? "Planner request sent. Refresh shortly; follow-up should appear as task-tree, wait, escalation, or message changes."
          : "Planner request accepted. Refresh shortly to check follow-up.";
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
window.prefillPlannerReview = prefillPlannerReview;
window.prefillSignalReview = prefillSignalReview;
window.prefillBottleneckReview = prefillBottleneckReview;
window.prefillReviewLoop = prefillReviewLoop;
window.prefillObservabilityGap = prefillObservabilityGap;
window.prefillCoverageAction = prefillCoverageAction;
window.prefillChallengeClassification = prefillChallengeClassification;
window.prefillSelected = prefillSelected;
window.sendSteering = sendSteering;

boot();
