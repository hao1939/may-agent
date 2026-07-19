// Shared project Kanban projection for Project App V3 task trees.

const TASK_LANES = [
  { id: "backlog", label: "Backlog" },
  { id: "active", label: "In Progress" },
  { id: "review", label: "Review" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
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

function parseTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function taskPriorityRank(task) {
  return STATUS_ORDER[task.priority] ?? 9;
}

function taskChildren(task) {
  return Array.isArray(task?.children) ? task.children : [];
}

function isLeafTask(task) {
  return taskChildren(task).length === 0;
}

function taskState(task) {
  const raw = task.state || task.status || "unknown";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  if (raw === "accepted" || raw === "superseded") return "done";
  return raw;
}

function isPlanningTask(task) {
  return ["frontier_replan", "domain_planner", "loop_task"].includes(task.kind);
}

function taskLane(task) {
  if (!isLeafTask(task)) return null;
  const state = taskState(task);
  if (isPlanningTask(task) && ["backlog", "active"].includes(state)) return "backlog";
  if (["backlog", "active", "review", "blocked", "done"].includes(state)) return state;
  return null;
}

function taskBlocker(task) {
  const blocker = task?.blocker || task?.blocked_reason || task?.trace?.blocked_reason;
  if (!blocker) return "";
  if (typeof blocker === "string") return blocker;
  if (typeof blocker.condition === "string") return blocker.condition;
  if (typeof blocker.reason === "string") return blocker.reason;
  return JSON.stringify(blocker);
}

function taskEvidenceRefs(task) {
  return [
    ...(Array.isArray(task?.evidence) ? task.evidence : []),
    ...(Array.isArray(task?.trace?.last_worker_evidence)
      ? task.trace.last_worker_evidence
      : []),
  ].filter(Boolean);
}

function taskDoneKnowledge(task) {
  return (
    task?.summary ||
    task?.acceptance_note ||
    task?.trace?.acceptance_note ||
    task?.trace?.last_worker_summary ||
    task?.archive_summary?.summary ||
    ""
  );
}

function taskEscalation(task) {
  return task?.escalation && typeof task.escalation === "object"
    ? task.escalation
    : null;
}

function taskRoots(tree) {
  const tasks = tree?.tasks || {};
  const roots = Object.values(tasks).filter(
    (task) => !task.parent_id || !tasks[task.parent_id],
  );
  return roots.length ? roots : tree?.root_task_id ? [tasks[tree.root_task_id]].filter(Boolean) : [];
}

function leafTasks(tree) {
  return Object.values(tree?.tasks || {}).filter(isLeafTask);
}

function leavesByState(tree, state) {
  return leafTasks(tree)
    .filter((task) => taskState(task) === state)
    .sort((a, b) => taskPriorityRank(a) - taskPriorityRank(b) || String(a.id).localeCompare(String(b.id)));
}

function latestTaskTimestamp(tasks) {
  let latest = null;
  for (const task of tasks) {
    for (const value of [
      task.updated_at,
      task.done_at,
      task.accepted_at,
      task.trace?.assigned_at,
      task.trace?.worker_started_at,
      task.trace?.done_at,
      task.trace?.accepted_at,
    ]) {
      const ms = parseTime(value);
      if (ms != null && (latest == null || ms > latest.ms)) {
        latest = { ms, value };
      }
    }
  }
  return latest?.value || null;
}

function closedGate(task) {
  return (task?.gates || []).length > 0 && task.gate_status !== "satisfied";
}

function readinessInfo(tree, task) {
  if (!task || !isLeafTask(task) || taskState(task) !== "backlog") return null;
  const unmet = (task.depends_on || []).find(
    (id) => taskState(tree?.tasks?.[id]) !== "done",
  );
  if (unmet) return { label: "dependency", detail: `${unmet} is not done`, tone: "watch" };
  if (!String(task.goal || "").trim()) return { label: "needs goal", detail: "missing goal", tone: "watch" };
  if (!(task.acceptance || []).length) return { label: "needs acceptance", detail: "missing acceptance", tone: "watch" };
  if (closedGate(task)) return { label: "gated", detail: "gate is not satisfied", tone: "watch" };
  return { label: "runnable", detail: "backlog leaf looks runnable", tone: "ok" };
}

function taskUiProjectId() {
  if (typeof projectIdFromPath === "function") {
    return projectIdFromPath(_projectDetailPath).replace(/\.app$/, "");
  }
  const path = String(_projectDetailPath || "");
  return path.replace(/^projects\//, "").replace(/\.app$/, "");
}

function taskStatusCounts(tree, taskId, acc) {
  const task = tree.tasks?.[taskId];
  if (!task) return acc;
  const status = taskState(task);
  acc[status] = (acc[status] || 0) + 1;
  for (const childId of taskChildren(task)) taskStatusCounts(tree, childId, acc);
  return acc;
}

function buildProjectControlReadout(tree) {
  const tasks = Object.values(tree.tasks || {});
  const leaves = leafTasks(tree);
  const roots = taskRoots(tree);
  const active = leavesByState(tree, "active");
  const backlog = leavesByState(tree, "backlog");
  const review = leavesByState(tree, "review");
  const blocked = leavesByState(tree, "blocked");
  const done = leavesByState(tree, "done");
  const maxConcurrent = Number.isFinite(Number(tree.max_concurrent))
    ? Number(tree.max_concurrent)
    : 3;
  const activeIds = Array.isArray(tree.active_task_ids)
    ? tree.active_task_ids
    : tree.active_task_id
      ? [tree.active_task_id]
      : [];
  const noStartedWorker = active.filter(
    (task) => !task.trace?.worker_started_at && !task.session_id,
  );
  const blockedWithoutOwner = blocked.filter((task) => {
    const blocker = taskBlocker(task);
    const escalation = taskEscalation(task);
    return !task.owner && !escalation?.owner && !/owner|human|approval|credential|capacity|quota|auth|token/i.test(blocker);
  });
  const runnable = backlog.filter((task) => readinessInfo(tree, task)?.tone === "ok");
  const movement = latestTaskTimestamp(tasks) || tree.updated_at;
  const coverage = [
    {
      key: "coverage.task-tree",
      surface: "Task tree",
      expected: "Current decomposition, owners, waits, and evidence.",
      observed: `${tasks.length} tasks, ${roots.length} root(s)`,
      freshness: tree.updated_at ? formatAge(tree.updated_at) : "unknown",
      coverage: roots.length === 1 ? "complete" : "partial",
      blindSpot:
        roots.length === 1
          ? "Structure is visible; semantic correctness still depends on review."
          : "Extra roots can hide work outside the intended project tree.",
      evidence: ".state/tasks/tree.json",
      action: roots.length === 1 ? "" : "Review Tree",
    },
    {
      key: "coverage.metrics",
      surface: "Metrics",
      expected: "Registered sensors expose trends and alert state.",
      observed: "Project metric summary is visible on the project overview when registered.",
      freshness: "inferred",
      coverage: "partial",
      blindSpot: "This task page does not yet receive a normalized project metric packet.",
      evidence: "/api/projects/detail and /api/metrics",
      action: "Review Metrics",
    },
    {
      key: "coverage.loop-ledgers",
      surface: "Loop ledgers",
      expected: "Durable queues expose pending, running, done, error, and unrepresented records.",
      observed: "No generic project loop declaration is loaded yet.",
      freshness: "missing",
      coverage: "missing",
      blindSpot: "A project can have hidden loop state unless it declares loop readout metadata.",
      evidence: "future project.json ui.loops",
      action: "Review Loops",
    },
    {
      key: "coverage.runtime-events",
      surface: "Runtime events",
      expected: "Events can be matched to handlers and workflow runs.",
      observed: "Use lineage and system event pages for now.",
      freshness: "partial",
      coverage: "partial",
      blindSpot: "This page cannot prove every emitted event reached a handler.",
      evidence: "/events and workflow runs",
      action: "Review Trace",
    },
  ];
  const bottlenecks = [
    {
      key: "task-tree-integrity",
      name: "Task tree valid?",
      question: "Does the tree have exactly one project root?",
      rawValue: roots.length,
      tone: roots.length === 1 ? "ok" : "bad",
      meaning: "Multiple roots can hide work outside the intended project tree.",
      candidates: roots.map((task) => task?.id).filter(Boolean),
      next: roots.length === 1 ? "No action." : "Ask the owner to repair or archive the extra root.",
    },
    {
      key: "capacity",
      name: "Capacity sane?",
      question: "Is active work under or over project capacity?",
      rawValue: `${active.length}/${maxConcurrent}`,
      tone: active.length > maxConcurrent ? "bad" : active.length === 0 && backlog.length ? "watch" : "ok",
      meaning: "Too much active work causes review churn; too little active work with backlog means dispatch may be idle.",
      candidates: active.slice(0, 5).map((task) => task.id),
      next: active.length > maxConcurrent ? "Throttle or review active fanout." : "No action unless work is stalled.",
    },
    {
      key: "worker-liveness",
      name: "Workers alive?",
      question: "Do active leaves show worker/session attachment?",
      rawValue: noStartedWorker.length,
      tone: noStartedWorker.length ? "watch" : "ok",
      meaning: "A board can say active while no visible worker has started.",
      candidates: noStartedWorker.slice(0, 5).map((task) => task.id),
      next: noStartedWorker.length ? "Review whether active work should be requeued or refreshed." : "No action.",
    },
    {
      key: "review-backlog",
      name: "Review draining?",
      question: "Is review work accumulating?",
      rawValue: review.length,
      tone: review.length > maxConcurrent ? "watch" : "ok",
      meaning: "Review leaves are the owner acceptance boundary; too many can stall progress.",
      candidates: review.slice(0, 5).map((task) => task.id),
      next: review.length ? "Audit or accept/reject review leaves." : "No action.",
    },
    {
      key: "blocked-frontier",
      name: "Waits exact?",
      question: "Are blocked leaves owned or clearly resumable?",
      rawValue: blocked.length,
      tone: blockedWithoutOwner.length ? "bad" : blocked.length ? "watch" : "ok",
      meaning: "Blocked work should carry owner, evidence, and a resume condition.",
      candidates: (blockedWithoutOwner.length ? blockedWithoutOwner : blocked)
        .slice(0, 5)
        .map((task) => task.id),
      next: blockedWithoutOwner.length ? "Clarify blocker owner and resume condition." : "No action unless stale.",
    },
    {
      key: "work-assigned",
      name: "Runnable work?",
      question: "Is there concrete backlog work when the project is not settled?",
      rawValue: runnable.length,
      tone: !active.length && !review.length && !blocked.length && backlog.length === 0 && done.length < leaves.length ? "bad" : runnable.length ? "ok" : backlog.length ? "watch" : "ok",
      meaning: "Backlog leaves need enough clarity to become executable worker input.",
      candidates: (runnable.length ? runnable : backlog).slice(0, 5).map((task) => task.id),
      next: runnable.length ? "Dispatch or advance runnable backlog." : backlog.length ? "Clarify backlog acceptance/gates." : "No action.",
    },
  ];
  const issues = [
    ...bottlenecks
      .filter((row) => row.tone !== "ok")
      .map((row) => ({
        key: row.key,
        severity: row.tone === "bad" ? "P1" : "P2",
        group: "Process",
        rawFact: `${row.name}: ${row.rawValue}`,
        hint: row.meaning,
        confidence: row.key === "worker-liveness" || row.key === "work-assigned" ? "inferred" : "known",
        owner: "project owner",
        currentAttempt: row.candidates.join(", ") || "none",
        evidence: ".state/tasks/tree.json",
        clearCondition: row.next,
        requiredResponse: "Convert the signal into concrete work, exact wait, escalation, or accepted no-op.",
        action: row.key,
      })),
    ...coverage
      .filter((row) => row.coverage !== "complete")
      .map((row) => ({
        key: row.key,
        severity: row.coverage === "missing" ? "P2" : "P3",
        group: "Coverage",
        rawFact: row.observed,
        hint: row.blindSpot,
        confidence: row.coverage === "missing" ? "known" : "inferred",
        owner: "project owner",
        currentAttempt: row.surface,
        evidence: row.evidence,
        clearCondition: `${row.surface} coverage is complete or explicitly accepted as a blind spot.`,
        requiredResponse: "Review whether this observability gap matters now.",
        action: row.key,
      })),
  ];
  return {
    movement,
    taskStats: {
      total: tasks.length,
      leaves: leaves.length,
      roots: roots.length,
      active: active.length,
      backlog: backlog.length,
      review: review.length,
      blocked: blocked.length,
      done: done.length,
      maxConcurrent,
      activeIds,
    },
    bottlenecks,
    coverage,
    issues,
  };
}

function summarizeCounts(counts) {
  const order = ["active", "review", "blocked", "backlog", "done", "unknown"];
  return order.filter(k => counts[k]).map(k => `${k} ${counts[k]}`).join(" · ");
}

function taskSchedulerReason(task, tree) {
  const state = taskState(task);
  if (state === "backlog") {
    if ((task.gates || []).length && task.gate_status !== "satisfied") return "waiting: closed gate";
    const maxConcurrent = Number.isFinite(Number(tree.max_concurrent)) ? Number(tree.max_concurrent) : 3;
    if ((tree.active_task_ids || []).length >= maxConcurrent) return "waiting: max concurrent full";
    if (SERIALIZED_KINDS.has(task.kind)) return "backlog serialized work";
    return "backlog";
  }
  if (state === "active") return task.lease_expires_at ? `leased until ${new Date(task.lease_expires_at).toISOString().slice(11, 19)}Z` : "active";
  if (state === "review") return task.verification?.reason || task.result || "ready for owner review";
  if (state === "blocked") return typeof task.blocker === "string" ? task.blocker : task.blocker?.condition || "blocked";
  if (state === "done") return task.verification?.verdict ? `verified: ${task.verification.verdict}` : task.resolution || "done";
  return state;
}

function taskCard(task, tree) {
  const output = (task.outputs || [])[0];
  const hasGate = (task.gates || []).length > 0 && task.gate_status !== "satisfied";
  const state = taskState(task);
  return `<button class="kanban-card" onclick="showTaskDetail(${jsStringAttr(task.id)})">
    <span class="kanban-card-top">
      <span class="task-priority">${esc(task.priority || "P?")}</span>
      <span class="task-status">${esc(state)}</span>
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
      <span class="task-status">${esc(taskState(task))}</span>
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
  const active = tasks.filter(t => isLeafTask(t) && taskState(t) === "active").sort((a, b) => taskPriorityRank(a) - taskPriorityRank(b));
  const backlog = tasks.filter(t => isLeafTask(t) && taskState(t) === "backlog").sort((a, b) => taskPriorityRank(a) - taskPriorityRank(b));
  const review = tasks.filter(t => isLeafTask(t) && taskState(t) === "review");
  const blocked = tasks.filter(t => isLeafTask(t) && taskState(t) === "blocked");
  if (active.length) return { label: "working", text: `${active.length} active: ${active.slice(0, 3).map(t => t.id).join(", ")}` };
  if (backlog.length) return { label: "backlog", text: `${backlog.length} backlog leaf task(s): ${backlog.slice(0, 3).map(t => t.id).join(", ")}` };
  if (review.length) return { label: "review", text: `${review.length} task(s) need verification or rework.` };
  if (blocked.length) return { label: "blocked", text: `${blocked.length} blocked leaf task(s).` };
  return { label: "settled", text: "No active, backlog, review, or blocked leaves." };
}

function renderReadoutMetric(label, value, tone = "ok") {
  return `<div class="readout-metric readout-${esc(tone)}">
    <strong>${esc(value)}</strong>
    <span>${esc(label)}</span>
  </div>`;
}

function renderBottleneckCard(row) {
  return `<div class="readout-card readout-${esc(row.tone)}">
    <div class="readout-card-head">
      <span>${esc(row.name)}</span>
      <b>${esc(row.rawValue)}</b>
    </div>
    <div class="readout-question">${esc(row.question)}</div>
    <div class="readout-copy">${esc(row.meaning)}</div>
    <div class="readout-copy"><b>Candidates:</b> ${esc(row.candidates.length ? row.candidates.join(", ") : "none")}</div>
    <div class="readout-next"><b>Next:</b> ${esc(row.next)}</div>
    <button class="readout-action" onclick="prefillProjectReadoutAction(${jsStringAttr(row.key)}, 'bottleneck')">Prepare Review</button>
  </div>`;
}

function renderCoverageRow(row) {
  return `<div class="coverage-row coverage-${esc(String(row.coverage).replace(/\s+/g, "-"))}">
    <div>
      <b>${esc(row.surface)}</b>
      <span>${esc(row.expected)}</span>
    </div>
    <div>
      <small>Observed</small>
      <span>${esc(row.observed)}</span>
    </div>
    <div>
      <small>Freshness</small>
      <span>${esc(row.freshness)}</span>
    </div>
    <div>
      <small>Coverage</small>
      <em>${esc(row.coverage)}</em>
    </div>
    <div>
      <small>Blind spot</small>
      <span>${esc(row.blindSpot)}</span>
      <code>${esc(row.evidence)}</code>
    </div>
    ${
      row.action
        ? `<button class="readout-action" onclick="prefillProjectReadoutAction(${jsStringAttr(row.key)}, 'coverage')">${esc(row.action)}</button>`
        : `<span class="readout-no-action">No action</span>`
    }
  </div>`;
}

function renderIssueRow(issue) {
  return `<div class="issue-row issue-${esc(String(issue.severity).toLowerCase())}">
    <div>
      <b>${esc(issue.key)}</b>
      <span>${esc(issue.group)} · ${esc(issue.severity)}</span>
    </div>
    <div>
      <small>Raw fact</small>
      <span>${esc(issue.rawFact)}</span>
      <code>${esc(issue.evidence || "")}</code>
    </div>
    <div>
      <small>Hint</small>
      <span>${esc(issue.hint)}</span>
    </div>
    <div>
      <small>Confidence</small>
      <em>${esc(issue.confidence)}</em>
      <span>${esc(issue.currentAttempt || "none")}</span>
    </div>
    <div>
      <small>Clear condition</small>
      <span>${esc(issue.clearCondition)}</span>
    </div>
    <button class="readout-action" onclick="prefillProjectReadoutAction(${jsStringAttr(issue.key)}, 'issue')">Prepare Review</button>
  </div>`;
}

function renderControlReadout(tree) {
  const readout = buildProjectControlReadout(tree);
  window._currentProjectReadout = readout;
  const current = projectCurrentState(tree);
  const lead = [...readout.bottlenecks].find((row) => row.tone === "bad") ||
    [...readout.bottlenecks].find((row) => row.tone === "watch") ||
    null;
  const openBottlenecks = readout.bottlenecks.filter((row) => row.tone !== "ok");
  const leadHtml = lead
    ? `<div class="readout-lead readout-${esc(lead.tone)}">
        <div>
          <strong>${esc(lead.question)}</strong>
          <span>Raw fact: ${esc(lead.rawValue)}. ${esc(lead.meaning)}</span>
          ${lead.candidates.length ? `<span>Affected: ${esc(lead.candidates.join(", "))}</span>` : ""}
        </div>
        <button class="readout-action" onclick="prefillProjectReadoutAction(${jsStringAttr(lead.key)}, 'bottleneck')">Prepare Review</button>
      </div>`
    : `<div class="readout-lead readout-ok">
        <div>
          <strong>No generic process bottleneck is firing.</strong>
          <span>Use diagnostics when you need to audit coverage, handlers, or raw issue rows.</span>
        </div>
      </div>`;
  const gaps = readout.coverage.filter((row) => row.coverage !== "complete").length;
  return `<section class="project-readout">
    <div class="readout-panel readout-compact-panel">
      <div class="readout-head">
        <div>
          <div class="readout-kicker">Project Status</div>
          <h3>${esc(current.label)}</h3>
          <p>${esc(current.text)}</p>
        </div>
        <div class="readout-status">
          <span>${lead ? "attention needed" : "no primary signal"}</span>
          <span>${openBottlenecks.length} signal(s), ${gaps} gap(s)</span>
        </div>
      </div>
      <div class="readout-metrics">
        ${renderReadoutMetric("last movement", readout.movement ? formatAge(readout.movement) : "unknown")}
        ${renderReadoutMetric("active", readout.taskStats.active, readout.taskStats.active ? "ok" : "watch")}
        ${renderReadoutMetric("review", readout.taskStats.review, readout.taskStats.review ? "watch" : "ok")}
        ${renderReadoutMetric("blocked", readout.taskStats.blocked, readout.taskStats.blocked ? "watch" : "ok")}
        ${renderReadoutMetric("roots", readout.taskStats.roots, readout.taskStats.roots === 1 ? "ok" : "bad")}
        ${renderReadoutMetric("capacity", `${readout.taskStats.active}/${readout.taskStats.maxConcurrent}`, readout.taskStats.active > readout.taskStats.maxConcurrent ? "bad" : "ok")}
      </div>
      ${leadHtml}
      <details class="readout-diagnostics">
        <summary>
          <span>Diagnostics</span>
          <b>${openBottlenecks.length} bottleneck(s) · ${gaps} coverage gap(s) · ${readout.issues.length} issue row(s)</b>
        </summary>
        <div class="diagnostic-section">
          <div class="readout-head compact">
            <div><div class="readout-kicker">Bottlenecks</div><h3>Open Signals</h3></div>
            <span>${openBottlenecks.length} row(s)</span>
          </div>
          <div class="bottleneck-grid">
            ${openBottlenecks.length ? openBottlenecks.map(renderBottleneckCard).join("") : '<div class="lane-empty">No open generic bottlenecks.</div>'}
          </div>
        </div>
        <div class="diagnostic-section">
          <div class="readout-head compact">
            <div><div class="readout-kicker">Trust</div><h3>What This Page Can Prove</h3></div>
            <span>${gaps} gap(s)</span>
          </div>
          <div class="coverage-list">${readout.coverage.map(renderCoverageRow).join("")}</div>
        </div>
        <div class="diagnostic-section">
          <div class="readout-head compact">
            <div><div class="readout-kicker">Raw Facts With Hints</div><h3>Issue Rows</h3></div>
            <span>${readout.issues.length} row(s)</span>
          </div>
          <div class="issue-list">
            ${readout.issues.length ? readout.issues.slice(0, 8).map(renderIssueRow).join("") : '<div class="lane-empty">No generic issue rows. Coverage may still be partial.</div>'}
          </div>
        </div>
      </details>
    </div>
  </section>`;
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
    const details = (data.errors || []).length ? `<pre>${esc((data.errors || []).join("\n"))}</pre>` : "";
    el.innerHTML = `<div class="empty-state">${esc(data.reason || "This Agent App has no task attachment.")}${details}</div>`;
    return;
  }

  window._currentProjectTaskTree = data;
  const tasks = Object.values(data.tasks || {});
  const laneHtml = TASK_LANES.map(lane => {
    const laneTasks = tasks
      .filter(t => taskLane(t) === lane.id)
      .sort((a, b) => taskPriorityRank(a) - taskPriorityRank(b) || String(a.id).localeCompare(String(b.id)));
    if (lane.id === "done") {
      return `<details class="kanban-lane done-lane">
        <summary><span>${esc(lane.label)}</span><b>${laneTasks.length}</b></summary>
        <div class="kanban-lane-body">${laneTasks.length ? laneTasks.map(t => taskCard(t, data)).join("") : '<div class="lane-empty">empty</div>'}</div>
      </details>`;
    }
    return `<section class="kanban-lane">
      <header><span>${esc(lane.label)}</span><b>${laneTasks.length}</b></header>
      <div class="kanban-lane-body">${laneTasks.length ? laneTasks.map(t => taskCard(t, data)).join("") : '<div class="lane-empty">empty</div>'}</div>
    </section>`;
  }).join("");

  const rootId = data.root_task_id || "project";
  el.className = "";
  el.innerHTML = `<div class="kanban-shell">
    ${renderControlReadout(data)}
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
  const blocker = taskBlocker(task);
  const escalation = taskEscalation(task);
  const readiness = readinessInfo(tree, task);
  const doneKnowledge = taskState(task) === "done" ? taskDoneKnowledge(task) : "";
  const evidence = taskEvidenceRefs(task);
  const reusableFor = Array.isArray(task.reusable_for || task.reusableFor)
    ? (task.reusable_for || task.reusableFor).filter(Boolean)
    : [];
  drawer.classList.remove("hidden");
  drawer.innerHTML = `<div class="task-detail-head">
    <div>
      <div class="task-detail-id">${esc(task.id)}</div>
      <div class="task-detail-meta">${esc(task.priority || "P?")} · ${esc(taskState(task))} · ${esc(task.kind || "work")}</div>
    </div>
    <button onclick="document.getElementById('task-detail-drawer').classList.add('hidden')">Close</button>
  </div>
  <p>${esc(task.goal || "")}</p>
  <div class="task-detail-grid">
    <div><b>Parent</b><span>${esc(task.parent_id || "none")}</span></div>
    <div><b>Children</b><span>${taskChildren(task).length}</span></div>
    <div><b>Reason</b><span>${esc(taskSchedulerReason(task, tree))}</span></div>
    <div><b>Conflict</b><span>${esc(Array.isArray(task.conflict_scope) ? task.conflict_scope.join(", ") : task.conflict_scope || "")}</span></div>
    <div><b>Readiness</b><span>${esc(readiness ? `${readiness.label}: ${readiness.detail}` : "not applicable")}</span></div>
    <div><b>Evidence</b><span>${esc(evidence.length ? evidence.join(", ") : "none")}</span></div>
  </div>
  ${doneKnowledge ? `<h4>Done Knowledge</h4><p>${esc(doneKnowledge)}</p>` : ""}
  ${reusableFor.length ? `<h4>Reusable For</h4><p>${esc(reusableFor.join(", "))}</p>` : ""}
  ${list("Outputs", task.outputs || [])}
  ${list("Acceptance", task.acceptance || [])}
  ${list("Gates", task.gates || [])}
  ${list("Forbidden", task.forbidden || [])}
  ${blocker ? `<h4>Blocker</h4><p>${esc(blocker)}</p>` : ""}
  ${escalation ? `<h4>Escalation</h4><pre>${esc(JSON.stringify(escalation, null, 2))}</pre>` : ""}
  ${task.verification ? `<h4>Verification</h4><pre>${esc(JSON.stringify(task.verification, null, 2))}</pre>` : ""}
  ${(task.attempts || []).length ? `<h4>Attempts</h4><div>${task.attempts.length} recorded attempt(s)</div>` : ""}
  <h4>Task Feedback</h4>
  <textarea id="kanban-steer-text" class="kanban-steer-text" placeholder="Prepare or write a review, split, challenge, or unblock request for this task."></textarea>
  <div class="kanban-steer-actions">
    <button onclick="sendProjectSteering()">Send To Owner</button>
    <button onclick="prefillTaskSteering('review')">Audit</button>
    <button onclick="prefillTaskSteering('split')">Split</button>
    <button onclick="prefillTaskSteering('challenge')">Challenge</button>
    <button onclick="prefillTaskSteering('escalate')">Escalate</button>
  </div>
  <div id="kanban-steer-status" class="kanban-steer-status"></div>`;
}

function setSteeringText(text) {
  const textarea = document.getElementById("kanban-steer-text") || document.getElementById("project-readout-steer-text");
  if (textarea) {
    textarea.value = text;
    textarea.focus();
    textarea.scrollIntoView({ block: "nearest" });
  }
}

function selectedTaskForSteering() {
  const drawer = document.getElementById("task-detail-drawer");
  if (!drawer || drawer.classList.contains("hidden")) return null;
  const id = drawer.querySelector(".task-detail-id")?.textContent || "";
  return id ? window._currentProjectTaskTree?.tasks?.[id] || null : null;
}

function prefillTaskSteering(action) {
  const task = selectedTaskForSteering();
  if (!task) return;
  const blocker = taskBlocker(task) || "none";
  const prompts = {
    review: `[task-steer] ${taskUiProjectId()} task ${task.id}\n\naction: review_task\n\nReview this task's state, evidence, blocker, acceptance, and parent context. Decide whether it is correctly represented and what should happen next.\n\nCurrent state: ${taskState(task)}\nBlocker: ${blocker}\nClear condition: record concrete work, exact wait, escalation, accepted no-op, or done knowledge.`,
    split: `[task-steer] ${taskUiProjectId()} task ${task.id}\n\naction: split_task\n\nIf this task is too broad or blocked ambiguously, split it into smaller executable child tasks. Preserve acceptance, gates, forbidden actions, evidence, and owner context.`,
    challenge: `[task-steer] ${taskUiProjectId()} task ${task.id}\n\naction: challenge_task_state\n\nChallenge this task state using raw evidence. Check whether it is over-closed, under-specified, blocked for the wrong reason, or missing a concrete next step.`,
    escalate: `[task-steer] ${taskUiProjectId()} task ${task.id}\n\naction: review_escalation\n\nDecide whether this task is blocked by a real ownership boundary. If yes, create or refresh an escalation with owner, requested action, evidence, and resume condition. If local rework is possible, create backlog work instead.\n\nCurrent blocker: ${blocker}`,
  };
  setSteeringText(prompts[action] || prompts.review);
}

function prefillProjectReadoutAction(key, kind) {
  const readout = window._currentProjectReadout;
  const row =
    readout?.bottlenecks?.find((item) => item.key === key) ||
    readout?.coverage?.find((item) => item.key === key) ||
    readout?.issues?.find((item) => item.key === key);
  const rawFact = row?.rawFact || `${row?.name || row?.surface || key}: ${row?.rawValue ?? row?.observed ?? "unknown"}`;
  const hint = row?.hint || row?.meaning || row?.blindSpot || "review requested from project readout";
  const confidence = row?.confidence || (kind === "coverage" ? row?.coverage : "known") || "unknown";
  const evidence = row?.evidence || ".state/tasks/tree.json";
  const clearCondition = row?.clearCondition || row?.next || "signal is converted into owned work, exact wait, escalation, or accepted no-op";
  const message = `[project-steer] ${taskUiProjectId()} ${kind} ${key}\n\naction: review_${kind}\n\nRaw fact: ${rawFact}\nSystem hint: ${hint}\nConfidence: ${confidence}\nEvidence: ${evidence}\nClear condition: ${clearCondition}\n\nExpected response:\nConvert this into concrete work, an exact wait, an escalation, or an accepted no-op. Preserve the raw fact in the task tree or discussion.`;
  let textarea = document.getElementById("project-readout-steer-text");
  if (!textarea) {
    const panel = document.querySelector(".project-readout");
    if (panel) {
      panel.insertAdjacentHTML(
        "beforeend",
        `<div class="readout-panel readout-steer-panel">
          <div class="readout-head compact"><div><div class="readout-kicker">Prepared Request</div><h3>Structured Steering</h3></div></div>
          <textarea id="project-readout-steer-text" class="kanban-steer-text"></textarea>
          <div class="kanban-steer-actions"><button onclick="sendProjectSteering('project-readout-steer-text', 'project-readout-steer-status')">Send To Owner</button></div>
          <div id="project-readout-steer-status" class="kanban-steer-status"></div>
        </div>`,
      );
      textarea = document.getElementById("project-readout-steer-text");
    }
  }
  if (textarea) {
    textarea.value = message;
    textarea.focus();
    textarea.scrollIntoView({ block: "nearest" });
  }
}

async function sendProjectSteering(textareaId = "kanban-steer-text", statusId = "kanban-steer-status") {
  const textarea = document.getElementById(textareaId);
  const status = document.getElementById(statusId);
  const message = String(textarea?.value || "").trim();
  if (!message) {
    if (status) status.textContent = "Write or prepare a request first.";
    return;
  }
  if (status) status.textContent = "Sending...";
  const task = selectedTaskForSteering();
  const project = taskUiProjectId();
  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "project.owner.requested",
        source: "web-ui",
        project,
        target: { project },
        action: "project-ui-steering",
        reason: "project-ui-steering",
        data: {
          project,
          projectPath: _projectDetailPath,
          action: "project-ui-steering",
          params: {
            comment: message,
            task_id: task?.id || null,
            selectedTaskState: task ? taskState(task) : null,
            ui: "default-project-kanban",
          },
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) throw new Error(body.error || body.triggerError || `HTTP ${res.status}`);
    if (textarea) textarea.value = "";
    if (status) status.textContent = body.workflowRunId ? `Accepted: workflow ${body.workflowRunId}` : "Accepted. Refresh shortly to see task, wait, escalation, report, or message changes.";
  } catch (error) {
    if (status) status.textContent = `Failed: ${error?.message || String(error)}`;
  }
}

window.prefillProjectReadoutAction = prefillProjectReadoutAction;
window.prefillTaskSteering = prefillTaskSteering;
window.sendProjectSteering = sendProjectSteering;
