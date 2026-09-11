// ── Events ───────────────────────────────────────────────────────────

let _eventGraphView = 'graph';
let _eventGraphDetailView = 'graph';
let _eventOverviewGraphView = 'view';

async function loadEvents() {
  try {
    const focusedEventId = currentRouteParams?.eventId || null;
    const healthEl = document.getElementById('event-delivery-health');
    if (healthEl) {
      healthEl.style.display = focusedEventId ? 'none' : '';
      if (focusedEventId) healthEl.innerHTML = '';
      else loadEventDeliveryHealth();
    }
    const eventIdInput = document.getElementById('event-graph-id');
    if (eventIdInput && !eventIdInput.dataset.bound) {
      eventIdInput.dataset.bound = '1';
      eventIdInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') openEventGraphFromInput();
      });
    }
    const ownerSel = document.getElementById('events-owner');
    const typeSel = document.getElementById('events-type');
    const el = document.getElementById('events-content');
    const countEl = document.getElementById('events-count');
    if (ownerSel) ownerSel.style.display = focusedEventId ? 'none' : '';
    if (typeSel) typeSel.style.display = focusedEventId ? 'none' : '';
    if (focusedEventId) {
      if (countEl) countEl.textContent = `event #${focusedEventId}`;
      if (el) el.innerHTML = '';
      return;
    }
    const owner = document.getElementById('events-owner')?.value || '';
    const type = document.getElementById('events-type')?.value || '';
    let url = '/api/events?limit=200';
    if (owner) url += `&owner=${encodeURIComponent(owner)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    const res = await fetch(url);
    const events = await res.json();

    // Populate filter dropdowns from data
    const owners = new Set(events.map(e => e.owner).filter(Boolean));
    const types = new Set(events.map(e => e.event_type).filter(Boolean));
    if (ownerSel && ownerSel.options.length <= 1) {
      for (const o of [...owners].sort()) {
        const opt = document.createElement('option'); opt.value = o; opt.textContent = o;
        ownerSel.appendChild(opt);
      }
    }
    if (typeSel && typeSel.options.length <= 1) {
      for (const t of [...types].sort()) {
        const opt = document.createElement('option'); opt.value = t; opt.textContent = t;
        typeSel.appendChild(opt);
      }
    }

    countEl.textContent = `${events.length} events`;

    if (events.length === 0) {
      el.innerHTML = '<div style="padding:16px;color:var(--fg2)">No events recorded yet. Events will appear here once the event persistence (G1) is deployed.</div>';
      return;
    }

    let html = `<table style="width:100%;border-collapse:collapse;font-size:13px">`;
    html += `<tr style="border-bottom:2px solid var(--border);text-align:left">`;
    html += `<th style="padding:6px">Time</th><th>Type</th><th>Owner</th><th>Source</th><th>Data</th><th></th>`;
    html += `</tr>`;
    for (const e of events) {
      let data = {};
      try { data = e.data ? JSON.parse(e.data) : {}; } catch {}
      const summary = Object.entries(data).filter(([k]) => k !== 'owner' && k !== 'source').map(([k,v]) => `${k}=${typeof v === 'string' ? v.slice(0,30) : v}`).join(', ');
      html += `<tr style="border-bottom:1px solid var(--border)">` +
        `<td style="padding:6px;color:var(--fg2);font-size:12px;white-space:nowrap">${timeAgo(e.timestamp)}</td>` +
        `<td style="font-family:monospace">${esc(e.event_type || '')}</td>` +
        `<td>${esc(e.owner || '—')}</td>` +
        `<td style="color:var(--fg2)">${esc(e.source || '—')}</td>` +
        `<td style="color:var(--fg2);font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(summary)}</td>` +
        `<td style="text-align:right;white-space:nowrap">` +
        `<button onclick="loadEventGraph(${Number(e.id)})" title="Show event graph" style="font-size:11px;padding:3px 8px">graph</button> ` +
        `<button onclick="loadLoopTrace(${Number(e.id)})" title="Show loop trace" style="font-size:11px;padding:3px 8px">trace</button>` +
        `</td>` +
        `</tr>`;
    }
    html += `</table>`;
    el.innerHTML = html;
  } catch(e) {
    document.getElementById('events-content').innerHTML = `<div style="color:var(--red)">Failed to load events: ${e.message}</div>`;
  }
}

async function loadEventDeliveryHealth() {
  const el = document.getElementById('event-delivery-health');
  if (!el) return;
  try {
    const res = await fetch('/api/events/delivery-health?lookbackMs=3600000&limit=8');
    const health = await res.json();
    if (!res.ok) throw new Error(health.error || 'failed');
    el.innerHTML = renderEventDeliveryHealth(health);
  } catch (e) {
    el.innerHTML = `<div style="padding:10px;border:1px solid var(--border);border-radius:6px;color:var(--red)">Failed to load delivery health: ${esc(e.message)}</div>`;
  }
}

function renderEventDeliveryHealth(health) {
  const unhandled = health.unhandledEvents || [];
  const overduePending = health.overduePendingEvents || [];
  const orphanPairs = health.orphanPairs || [];
  const overdueOpen = health.overdueOpenPairs || [];
  const totalFailures = unhandled.length + overduePending.length + orphanPairs.length + overdueOpen.length;
  const tone = health.schemaReady === false ? 'var(--fg2)' : totalFailures > 0 || health.error ? 'var(--red)' : 'var(--green)';
  const chips = [
    ['unhandled', unhandled.length],
    ['overdue pending', overduePending.length],
    ['orphan pairs', orphanPairs.length],
    ['overdue pairs', overdueOpen.length],
  ];
  let html = `<div style="border:1px solid var(--border);border-radius:6px;background:var(--bg2);padding:12px">`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">`;
  html += `<b>Event Delivery Health</b>`;
  html += `<span style="width:8px;height:8px;border-radius:50%;background:${tone};display:inline-block"></span>`;
  html += `<span style="color:var(--fg2);font-size:12px">last hour</span>`;
  html += `<button onclick="loadEventDeliveryHealth()" style="margin-left:auto;font-size:11px;padding:3px 8px">Refresh</button>`;
  html += `</div>`;
  html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">`;
  for (const [label, count] of chips) {
    html += `<span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:2px 8px">${esc(label)} ${count}</span>`;
  }
  html += `</div>`;
  if (health.error) {
    html += `<div style="font-size:12px;color:var(--red)">read-model error: ${esc(health.error)}</div>`;
  } else if (health.note) {
    html += `<div style="font-size:12px;color:var(--fg2)">${esc(health.note)}</div>`;
  }
  const samples = [
    ...unhandled.map((row) => ({ kind: 'unhandled', row, eventId: row.id, label: row.eventType })),
    ...overduePending.map((row) => ({ kind: 'overdue pending', row, eventId: row.id, label: row.eventType })),
    ...orphanPairs.map((row) => ({ kind: 'orphan pair', row, eventId: row.openEventId, label: row.pairName || row.openEventType })),
    ...overdueOpen.map((row) => ({ kind: 'overdue pair', row, eventId: row.openEventId, label: row.pairName || row.openEventType })),
  ].slice(0, 8);
  if (samples.length) {
    html += `<div style="display:grid;gap:4px;margin-top:8px">`;
    for (const sample of samples) {
      const row = sample.row || {};
      const owner = row.owner || '—';
      const ts = row.timestamp || row.openedAt || row.expectedCloseAt;
      const trace = sample.eventId ? `<button onclick="loadEventGraph(${Number(sample.eventId)})" style="font-size:11px;padding:2px 7px">graph</button>` : '';
      html += `<div style="display:flex;gap:8px;align-items:center;font-size:12px;color:var(--fg2);border-top:1px solid var(--border);padding-top:4px">`;
      html += `<span style="color:var(--fg);min-width:104px">${esc(sample.kind)}</span>`;
      html += `<span style="font-family:monospace;color:var(--accent);min-width:170px">${esc(sample.label || '—')}</span>`;
      html += `<span>owner ${esc(owner)}</span>`;
      html += `<span>${ts ? timeAgo(ts) : '—'}</span>`;
      html += `<span style="margin-left:auto">${trace}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function loopTraceQuery(target) {
  if (target && typeof target === 'object') {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(target)) {
      if (value != null && value !== '') params.set(key, String(value));
    }
    return params.toString();
  }
  return `eventId=${encodeURIComponent(target)}`;
}

function openLoopTrace(target) {
  routeTo('/events');
  setTimeout(() => loadLoopTrace(target), 80);
}

function openEventGraph(eventId) {
  routeTo(`/events/${encodeURIComponent(eventId)}`);
}

function setEventGraphDetailView(view, eventId) {
  _eventGraphDetailView = view === 'rows' ? 'rows' : 'graph';
  _eventGraphView = 'list';
  loadEventGraph(eventId, { detail: true });
}

function setEventOverviewGraphView(view, eventId) {
  _eventOverviewGraphView = view === 'raw' ? 'raw' : 'view';
  _eventGraphView = 'graph';
  loadEventGraph(eventId);
}

function openEventGraphFromInput() {
  const input = document.getElementById('event-graph-id');
  const eventId = String(input?.value || '').trim();
  if (!eventId.match(/^\d+$/)) {
    const el = document.getElementById('event-graph-content');
    if (el) el.innerHTML = '<div style="padding:10px;color:var(--red);border:1px solid var(--border);border-radius:6px">Enter a numeric event id.</div>';
    return;
  }
  openEventGraph(eventId);
}

async function loadEventGraph(eventId, opts = {}) {
  const el = document.getElementById('event-graph-content');
  if (!el) return;
  const detail = opts.detail === true;
  const input = document.getElementById('event-graph-id');
  if (input) input.value = String(eventId);
  el.innerHTML = '<div style="padding:10px;color:var(--fg2);border:1px solid var(--border);border-radius:6px">Loading event graph…</div>';
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/graph`);
    const graph = await res.json();
    if (!res.ok) throw new Error(graph.error || 'failed');
    if (detail && graph.scope?.kind === 'session' && Array.isArray(graph.scope.ids) && graph.scope.ids.length === 1) {
      graph.sessionTranscript = await loadEventGraphSessionTranscript(graph.scope.ids[0]);
    }
    el.innerHTML = renderEventGraph(graph);
    if (typeof scrollToHashAnchor === 'function') scrollToHashAnchor();
  } catch (e) {
    el.innerHTML = `<div style="padding:10px;color:var(--red);border:1px solid var(--border);border-radius:6px">Failed to load event graph: ${esc(e.message)}</div>`;
  }
}

async function loadEventGraphSessionTranscript(sessionId) {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/transcript`);
    const data = await res.json();
    if (!res.ok) return { sessionId, error: data.error || 'transcript unavailable', messages: [] };
    return data;
  } catch (e) {
    return { sessionId, error: e.message || String(e), messages: [] };
  }
}

function shortGraphLabel(value, max = 28) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function graphDataValue(value) {
  if (value == null) return String(value);
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function graphNodeDataLines(node, limit = 5) {
  const entries = Object.entries(node?.dataPreview || {});
  if (entries.length) {
    return entries.slice(0, limit).map(([key, value]) => `${key}=${graphDataValue(value)}`);
  }
  const summary = String(node?.summary || '').trim();
  return summary ? [summary] : [];
}

function componentAnchorHref(id) {
  const path = `${location.pathname || '/'}${location.search || ''}`;
  return `${path}#${encodeURIComponent(id)}`;
}

function componentAnchor(id, label) {
  const text = label || id;
  return `<a href="${esc(componentAnchorHref(id))}" title="Link to this section" style="color:var(--fg);text-decoration:none;font-size:12px;font-weight:600">${esc(text)}</a>`;
}

function graphNodeTitle(node) {
  if (!node) return 'Event';
  if (node.type === 'session.start') return 'Session started';
  if (node.type === 'session.end') return 'Session ended';
  if (node.type === 'session.completed') return 'Session completed';
  if (node.type === 'project.task.reconcile.started') return 'Task reconciliation started';
  if (node.type === 'project.task.reconciled') return 'Task reconciled';
  if (node.type === 'workflow.started') return 'Workflow started';
  if (node.type === 'workflow.completed') return 'Workflow completed';
  if (node.type === 'workflow.failed') return 'Workflow failed';
  if (node.type === 'escalation.created') return 'Escalation opened';
  if (node.type === 'escalation.resolved') return 'Escalation resolved';
  if (node.type === 'escalation.dismissed') return 'Escalation dismissed';
  if (node.type === 'metric.breach') return 'Metric breach';
  if (node.type === 'escalation.requested') return 'Escalation requested';
  if (node.type === 'human.message.received') return 'Human reply received';
  return node.type || 'Event';
}

function graphStatusTone(status) {
  const value = String(status || '').toLowerCase();
  if (['healthy'].includes(value)) return 'green';
  if (['done', 'pass', 'passed', 'success', 'succeeded', 'resolved', 'completed'].includes(value)) return 'green';
  if (['fail', 'failed', 'error', 'errored', 'rejected', 'orphaned'].includes(value)) return 'red';
  if (['warning', 'blocked', 'skipped', 'timeout', 'timed_out', 'open', 'overdue', 'orphan'].includes(value)) return 'yellow';
  return 'fg2';
}

function graphStatusText(status) {
  const value = String(status || '').trim();
  if (!value) return 'unknown';
  return value.replace(/_/g, ' ');
}

function graphDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}s`;
  return `${Math.floor(value / 60000)}m ${Math.round((value % 60000) / 1000)}s`;
}

function shortIdentity(value, max = 34) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= max) return text;
  const head = Math.max(8, Math.floor((max - 1) * 0.45));
  const tail = Math.max(8, max - head - 1);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function graphNodeSubtitle(node) {
  const data = node?.dataPreview || {};
  if (data.sessionId) return `#${node.id} · session ${shortIdentity(data.sessionId, 28)}`;
  if (data.workflowRunId) return `#${node.id} · workflow ${shortIdentity(data.workflowRunId, 28)}`;
  if (data.taskId) return `#${node.id} · task ${shortIdentity(data.taskId, 28)}`;
  return `#${node.id} · ${node.owner || '—'}`;
}

function findSessionLifecycle(nodes) {
  const focusNode = nodes.find((node) => node.isFocus) || null;
  const focusSessionId = focusNode?.dataPreview?.sessionId;
  const starts = nodes.filter((node) => node.type === 'session.start');
  const ends = nodes.filter((node) => node.type === 'session.end');
  const start = (focusSessionId && starts.find((node) => node.dataPreview?.sessionId === focusSessionId)) || starts[0];
  const end = (focusSessionId && ends.find((node) => node.dataPreview?.sessionId === focusSessionId)) ||
    (start?.dataPreview?.sessionId && ends.find((node) => node.dataPreview?.sessionId === start.dataPreview.sessionId)) ||
    ends[0];
  if (!start && !end) return null;
  return { start, end };
}

function timelineScopeTitle(scope) {
  if (scope?.kind === 'session') return 'Focused Session Timeline';
  if (scope?.kind === 'workflow') return 'Workflow Timeline';
  if (scope?.kind === 'trace') return 'Trace Timeline';
  return 'Visible Graph Timeline';
}

function renderEventReviewPanel(review, nodes, edges = [], scope = null) {
  if (!review) return '';
  const verdict = review.verdict || {};
  const tone = graphStatusTone(verdict.status);
  const lifecycles = review.lifecycles || [];
  const timeline = [...(nodes || [])].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0) || Number(a.id || 0) - Number(b.id || 0));
  let html = `<div id="event-summary" style="display:grid;gap:10px;margin-bottom:12px;scroll-margin-top:14px">`;
  html += `<div style="border:1px solid var(--border);border-left:4px solid var(--${tone});border-radius:6px;background:var(--bg);padding:10px;display:grid;gap:6px">`;
  html += `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">`;
  html += `<b>${esc(verdict.text || 'No verdict available yet.')}</b>`;
  html += componentAnchor('event-summary', 'Summary');
  html += `<span style="font-size:11px;border:1px solid var(--${tone});color:var(--${tone});border-radius:10px;padding:1px 8px">${esc(graphStatusText(verdict.status || 'unknown'))}</span>`;
  if (review.focus?.title) html += `<span style="font-size:12px;color:var(--fg2)">focus: ${esc(review.focus.title)} #${esc(String(review.focus.id || ''))}</span>`;
  html += `</div>`;
  html += `</div>`;

  if (lifecycles.length) {
    html += `<div id="event-lifecycles" style="display:grid;gap:6px;scroll-margin-top:14px">`;
    html += `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">`;
    html += `<span style="font-size:12px;font-weight:600">${componentAnchor('event-lifecycles', 'Related Lifecycles')}</span>`;
    html += `<span style="font-size:11px;color:var(--fg2)">context cards; timeline below follows the focused scope</span>`;
    html += `</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">`;
    for (const lifecycle of lifecycles.slice(0, 8)) {
      const cardTone = graphStatusTone(lifecycle.status);
      const label = lifecycle.kind ? lifecycle.kind.replace(/\./g, ' ') : 'lifecycle';
      html += `<div style="border:1px solid var(--border);border-top:3px solid var(--${cardTone});border-radius:6px;background:var(--bg);padding:8px;display:grid;gap:4px">`;
      html += `<div style="display:flex;gap:8px;align-items:center">`;
      html += `<b style="font-size:12px">${esc(label)}</b>`;
      if (lifecycle.relation) html += `<span style="font-size:10px;color:var(--fg2);border:1px solid var(--border);border-radius:8px;padding:1px 6px">${esc(String(lifecycle.relation).replace('-', ' '))}</span>`;
      html += `<span style="margin-left:auto;font-size:11px;color:var(--${cardTone})">${esc(graphStatusText(lifecycle.status))}</span>`;
      html += `</div>`;
      html += `<div style="font-size:11px;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(lifecycle.id || '')}</div>`;
      html += `<div style="font-size:11px;color:var(--fg2)">`;
      if (lifecycle.openEventId) html += `open <button onclick="loadEventGraph(${Number(lifecycle.openEventId)})" style="font-size:10px;padding:1px 5px">#${esc(String(lifecycle.openEventId))}</button> `;
      if (lifecycle.closeEventId) html += `close <button onclick="loadEventGraph(${Number(lifecycle.closeEventId)})" style="font-size:10px;padding:1px 5px">#${esc(String(lifecycle.closeEventId))}</button>`;
      html += `</div>`;
      if (lifecycle.openedAt || lifecycle.closedAt) {
        html += `<div style="font-size:11px;color:var(--fg2)">${lifecycle.openedAt ? `opened ${esc(timeAgo(lifecycle.openedAt))}` : ''}${lifecycle.closedAt ? ` · closed ${esc(timeAgo(lifecycle.closedAt))}` : ''}</div>`;
      }
      if (lifecycle.summary) html += `<div style="font-size:12px;color:var(--fg);line-height:1.35">${esc(shortGraphLabel(lifecycle.summary, 150))}</div>`;
      if (lifecycle.issues?.length) {
        for (const issue of lifecycle.issues.slice(0, 2)) html += `<div style="font-size:11px;color:var(--yellow);line-height:1.35">${esc(issue)}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`;
  }

  if (timeline.length) {
    const title = timelineScopeTitle(scope);
    const label = scope?.label || (Array.isArray(scope?.ids) && scope.ids.length === 1 ? scope.ids[0] : '');
    html += `<div id="event-timeline" style="border:1px solid var(--border);border-radius:6px;background:var(--bg);padding:8px;scroll-margin-top:14px">`;
    html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">`;
    html += componentAnchor('event-timeline', title);
    if (label) html += `<span style="font-size:11px;font-weight:400;color:var(--fg2);font-family:monospace">${esc(shortIdentity(label, 48))}</span>`;
    html += `<span style="font-size:11px;font-weight:400;color:var(--fg2)">${timeline.length} event${timeline.length === 1 ? '' : 's'}</span>`;
    html += `</div>`;
    html += `<div style="display:grid;gap:4px">`;
    for (const node of timeline.slice(0, 16)) {
      const isDetail = node.visibility === 'detail';
      html += `<div style="display:grid;grid-template-columns:72px minmax(140px,.5fr) minmax(0,1fr) auto;gap:8px;align-items:start;font-size:12px;color:${isDetail ? 'var(--fg2)' : 'var(--fg)'};border-top:1px solid var(--border);padding-top:4px">`;
      html += `<span style="color:var(--fg2)">${esc(timeAgo(node.timestamp))}</span>`;
      html += `<span style="font-family:monospace;color:${isDetail ? 'var(--fg2)' : 'var(--accent)'}">${esc(shortGraphLabel(node.type, 26))}</span>`;
      html += `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(node.summary || node.dataPreview?.summary || node.dataPreview?.reason || node.owner || '')}</span>`;
      html += `<button onclick="loadEventGraph(${Number(node.id)})" style="font-size:10px;padding:1px 6px">#${esc(String(node.id))}</button>`;
      html += `</div>`;
    }
    html += `</div>`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function renderEventGraphSummary(graph, nodes, edges, focus, eventRows = nodes) {
  if (graph.review) return renderEventReviewPanel(graph.review, eventRows, edges, graph.scope);
  const enrichedNodes = nodes.map((node) => ({ ...node, isFocus: Number(node.id) === Number(graph.focusEventId) }));
  const session = findSessionLifecycle(enrichedNodes);
  const closureCount = edges.filter((edge) => edge.type === 'closure').length;

  if (session) {
    const endData = session.end?.dataPreview || {};
    const startData = session.start?.dataPreview || {};
    const status = endData.status || endData.outcome || (session.end ? 'done' : 'running');
    const tone = graphStatusTone(status);
    const title = session.end ? 'Session completed' : 'Session started';
    const summary = endData.summary || session.end?.summary || session.start?.summary || startData.task || '';
    const chips = [
      startData.projectId || endData.projectId ? `project ${startData.projectId || endData.projectId}` : null,
      startData.agent || endData.agent ? `agent ${startData.agent || endData.agent}` : null,
      startData.workflowRunId || endData.workflowRunId ? `workflow ${startData.workflowRunId || endData.workflowRunId}` : null,
      graphDuration(endData.durationMs) ? `duration ${graphDuration(endData.durationMs)}` : null,
      session.start ? `start #${session.start.id}` : null,
      session.end ? `end #${session.end.id}` : null,
    ].filter(Boolean);

    let html = `<div style="border:1px solid var(--border);border-radius:6px;background:var(--bg);padding:10px;margin-bottom:12px;display:grid;gap:8px">`;
    html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`;
    html += `<b>${esc(title)}</b>`;
    html += `<span style="font-size:11px;border:1px solid var(--${tone});color:var(--${tone});border-radius:10px;padding:1px 8px">${esc(graphStatusText(status))}</span>`;
    if (closureCount) html += `<span style="font-size:11px;color:var(--fg2)">closed by ${closureCount} link${closureCount === 1 ? '' : 's'}</span>`;
    html += `</div>`;
    if (summary) html += `<div style="font-size:12px;color:var(--fg);line-height:1.4">${esc(shortGraphLabel(summary, 220))}</div>`;
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap">`;
    for (const chip of chips) html += `<span style="font-size:11px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:2px 8px;color:var(--fg2)">${esc(chip)}</span>`;
    html += `</div>`;
    html += `</div>`;
    return html;
  }

  const focusType = focus?.type || 'event';
  let html = `<div id="event-summary" style="border:1px solid var(--border);border-radius:6px;background:var(--bg);padding:10px;margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;scroll-margin-top:14px">`;
  html += componentAnchor('event-summary', graphNodeTitle(focus));
  html += `<span style="font-size:12px;color:var(--fg2)">${nodes.length} events · ${edges.length} links</span>`;
  if (closureCount) html += `<span style="font-size:12px;color:var(--fg2)">${closureCount} closure link${closureCount === 1 ? '' : 's'}</span>`;
  html += `<span style="font-family:monospace;color:var(--fg2);font-size:12px">${esc(focusType)}</span>`;
  html += `</div>`;
  return html;
}

function chronologicalNodes(nodes) {
  return [...(nodes || [])].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0) || Number(a.id || 0) - Number(b.id || 0));
}

function renderGraphEdge(svg, source, target, nodeWidth, nodeHeight, label, color, dash = '', route = 'auto') {
  const sameLevel = Math.abs(source.x - target.x) < 8;
  const isReturn = route === 'return' || target.x < source.x - 8;
  const x1 = isReturn ? source.x : sameLevel ? source.x + nodeWidth / 2 : source.x + nodeWidth;
  const y1 = isReturn ? source.y + nodeHeight / 2 : source.y + nodeHeight;
  const x2 = isReturn ? target.x + nodeWidth : sameLevel ? target.x + nodeWidth / 2 : target.x;
  const y2 = isReturn ? target.y + nodeHeight / 2 : target.y;
  const midY = y1 + Math.max(24, (y2 - y1) / 2);
  const d = isReturn
    ? `M ${x1} ${y1} C ${x1 - 52} ${y1}, ${x2 + 52} ${y2}, ${x2} ${y2}`
    : sameLevel
    ? `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
    : `M ${x1} ${source.y + nodeHeight / 2} C ${x1 + 42} ${source.y + nodeHeight / 2}, ${x2 - 42} ${target.y + nodeHeight / 2}, ${x2} ${target.y + nodeHeight / 2}`;
  const strokeWidth = isReturn ? 1.4 : 2;
  svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#event-graph-arrow)" style="color:${color}"></path>`;
  if (label) {
    svg += `<text x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 - 6}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(label, 18))}</text>`;
  }
  return svg;
}

function eventOverviewGraphHeader(rootEventId) {
  const rawActive = _eventOverviewGraphView === 'raw';
  const nextView = rawActive ? 'view' : 'raw';
  const label = rawActive ? 'View graph' : 'Raw data';
  return `<div style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid var(--border);font-size:12px">` +
    componentAnchor('event-overview-graph', 'Overview Graph') +
    `<button onclick="setEventOverviewGraphView('${nextView}', ${Number(rootEventId)})" style="margin-left:auto;font-size:11px;padding:3px 8px">${label}</button>` +
    `</div>`;
}

function canonicalEventGraphView(graph) {
  const nodes = [...(graph.nodes || [])]
    .sort((a, b) => {
      const at = Number(a.timestamp);
      const bt = Number(b.timestamp);
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
      if (Number.isFinite(at) !== Number.isFinite(bt)) return Number.isFinite(at) ? -1 : 1;
      return Number(a.order || 0) - Number(b.order || 0) || String(a.key).localeCompare(String(b.key));
    });
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const edges = (graph.edges || []).filter((edge) => nodeKeys.has(edge.sourceKey) && nodeKeys.has(edge.targetKey));
  return { nodes, edges };
}

function renderCanonicalEventGraphMap(graph, rootEventId) {
  const view = canonicalEventGraphView(graph);
  if (!view.nodes.length) return '';
  const nodeWidth = 360;
  const nodeHeight = 126;
  const rowGap = 26;
  const levelGap = 56;
  const margin = 24;
  const positions = new Map();
  let cursorY = 58;
  let maxLevel = 0;
  for (const node of view.nodes) {
    const level = Math.max(0, Math.min(4, Number(node.level || 0)));
    maxLevel = Math.max(maxLevel, level);
    positions.set(node.key, { x: margin + level * (nodeWidth + levelGap), y: cursorY, level });
    cursorY += nodeHeight + rowGap;
  }
  const width = Math.max(820, margin * 2 + (maxLevel + 1) * nodeWidth + maxLevel * levelGap);
  const height = Math.max(230, cursorY + margin);
  let svg = `<div id="event-overview-graph" style="overflow-x:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg);margin-bottom:12px;scroll-margin-top:14px">`;
  svg += eventOverviewGraphHeader(rootEventId);
  if (_eventOverviewGraphView === 'raw') {
    svg += `<pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.35;color:var(--fg2);margin:0;padding:10px;max-height:620px;overflow:auto">${esc(JSON.stringify({ revision: graph.revision, focusEvent: graph.focusEvent, nodes: graph.nodes, edges: graph.edges, events: graph.events, relations: graph.relations, scope: graph.scope }, null, 2))}</pre>`;
    return `${svg}</div>`;
  }
  svg += `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="event graph" style="display:block;min-width:100%">`;
  svg += `<defs><marker id="event-graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor"></path></marker></defs>`;
  for (const edge of view.edges) {
    const source = positions.get(edge.sourceKey);
    const target = positions.get(edge.targetKey);
    if (!source || !target) continue;
    const color = edge.kind === 'closure' ? 'var(--green)' : edge.provenance === 'persisted' ? 'var(--accent)' : 'var(--fg2)';
    const dash = edge.provenance === 'persisted' ? '' : edge.kind === 'sequence' ? '3 3' : '5 4';
    const route = target.level < source.level ? 'return' : target.level > source.level ? 'child' : 'same';
    svg = renderGraphEdge(svg, source, target, nodeWidth, nodeHeight, edge.label || '', color, dash, route);
  }
  for (const node of view.nodes) {
    const pos = positions.get(node.key);
    if (!pos) continue;
    const eventId = Number(node.eventId);
    const focus = eventId === Number(graph.focusEventId);
    const diagnostic = node.role === 'diagnostic';
    const stroke = diagnostic ? 'var(--yellow)' : focus ? 'var(--accent)' : 'var(--border)';
    const fill = focus ? 'rgba(80,150,255,.12)' : 'var(--bg2)';
    const click = Number.isFinite(eventId) ? `loadEventGraph(${eventId})` : '';
    const dataLines = graphNodeDataLines(node);
    const metadata = [node.source, node.owner].filter(Boolean).join(' → ');
    svg += `<g${click ? ` onclick="${click}" style="cursor:pointer"` : ''}>`;
    svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${focus ? 2 : 1.2}"><title>${esc(JSON.stringify({ type: node.type, source: node.source, owner: node.owner, data: node.dataPreview || {}, refs: node.refs || {} }, null, 2))}</title></rect>`;
    svg += `<text x="${pos.x + 10}" y="${pos.y + 20}" fill="${diagnostic ? 'var(--yellow)' : focus ? 'var(--accent)' : 'var(--fg)'}" font-size="12" font-family="monospace">${esc(shortGraphLabel(node.type || node.label, 37))}</text>`;
    if (metadata) svg += `<text x="${pos.x + 10}" y="${pos.y + 39}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(metadata, 54))}</text>`;
    dataLines.forEach((line, index) => {
      svg += `<text x="${pos.x + 10}" y="${pos.y + 58 + index * 14}" fill="var(--fg2)" font-size="10" font-family="monospace">${esc(shortGraphLabel(line, 54))}</text>`;
    });
    if (Number.isFinite(eventId)) svg += `<text x="${pos.x + nodeWidth - 58}" y="${pos.y + 20}" fill="var(--fg2)" font-size="10">#${eventId}</text>`;
    svg += `</g>`;
  }
  return `${svg}</svg></div>`;
}

function edgeSummaryForNode(edges, nodeId) {
  const labels = [];
  for (const edge of edges || []) {
    if (Number(edge.source) === Number(nodeId)) labels.push(`${edge.label || edge.type} → #${edge.target}`);
    if (Number(edge.target) === Number(nodeId)) labels.push(`#${edge.source} → ${edge.label || edge.type}`);
  }
  return labels.slice(0, 3).join(', ');
}

function renderEventGraphEventList(nodes, edges, focusEventId, scope) {
  const rows = [...(nodes || [])].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0) || Number(a.id || 0) - Number(b.id || 0));
  const title = eventDetailTitle(scope);
  let html = `<div id="event-detail-rows" style="border:1px solid var(--border);border-radius:6px;background:var(--bg);overflow:auto;margin-bottom:12px;scroll-margin-top:14px">`;
  html += `<div style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid var(--border);font-size:12px">`;
  html += componentAnchor('event-detail-rows', title);
  if (scope?.label) html += `<span style="color:var(--fg2);font-family:monospace">${esc(scope.label)}</span>`;
  html += `<span style="margin-left:auto;color:var(--fg2)">${rows.length} event${rows.length === 1 ? '' : 's'}</span>`;
  html += `</div>`;
  if (!rows.length) {
    html += `<div style="padding:12px;color:var(--fg2);font-size:13px">No related detail events found for this event.</div>`;
    html += `</div>`;
    return html;
  }
  html += `<table style="width:100%;border-collapse:collapse;font-size:13px">`;
  html += `<tr style="border-bottom:2px solid var(--border);text-align:left">`;
  html += `<th style="padding:6px">Time</th><th>Type</th><th>Relation</th><th>Owner</th><th>Source</th><th>Data</th><th></th>`;
  html += `</tr>`;
  for (const node of rows) {
    const isFocus = Number(node.id) === Number(focusEventId);
    const data = node.dataPreview || {};
    const summary = Object.entries(data)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? shortGraphLabel(v, 46) : v}`)
      .join(', ');
    html += `<tr style="border-bottom:1px solid var(--border);background:${isFocus ? 'rgba(80,150,255,.08)' : 'transparent'}">`;
    html += `<td style="padding:6px;color:var(--fg2);font-size:12px;white-space:nowrap">${timeAgo(node.timestamp)}</td>`;
    html += `<td style="font-family:monospace;color:${isFocus ? 'var(--accent)' : 'var(--fg)'}">${esc(node.type || '')}</td>`;
    html += `<td style="color:var(--fg2);font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(edgeSummaryForNode(edges, node.id))}</td>`;
    html += `<td>${esc(node.owner || '—')}</td>`;
    html += `<td style="color:var(--fg2)">${esc(node.source || '—')}</td>`;
    html += `<td style="color:var(--fg2);font-size:12px;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(summary)}</td>`;
    html += `<td style="text-align:right;white-space:nowrap"><button onclick="loadEventGraph(${Number(node.id)})" style="font-size:11px;padding:3px 8px">graph</button></td>`;
    html += `</tr>`;
  }
  html += `</table>`;
  html += `</div>`;
  return html;
}

function eventDetailTitle(scope) {
  const kind = scope?.kind || 'event';
  if (kind === 'session') return 'Session Details';
  if (kind === 'workflow') return 'Workflow Details';
  if (kind === 'task') return 'Task Details';
  return 'Event Details';
}

function renderEventDetailViewToggle(eventId) {
  const graphActive = _eventGraphDetailView !== 'rows';
  const rowsActive = _eventGraphDetailView === 'rows';
  const button = (view, label, active) =>
    `<button onclick="setEventGraphDetailView('${view}', ${eventId})" style="font-size:11px;padding:3px 8px;border-color:${active ? 'var(--accent)' : 'var(--border)'};color:${active ? 'var(--accent)' : 'var(--fg)'}">${label}</button>`;
  return `<div style="display:flex;gap:6px;align-items:center;margin-left:auto"><span style="font-size:12px;color:var(--fg2)">Detail view</span>${button('graph', 'Graph', graphActive)}${button('rows', 'Rows', rowsActive)}</div>`;
}

function transcriptTextPreview(text, max = 110) {
  return shortGraphLabel(String(text || '').replace(/\s+/g, ' ').trim(), max);
}

function transcriptFlow(transcript) {
  if (!transcript || transcript.error || !(transcript.messages || []).length) return [];
  return typeof buildSessionFlow === 'function'
    ? buildSessionFlow(transcript.messages || [])
    : (transcript.messages || []).map((message, index) => ({ type: 'message', role: message.role, index: index + 1, assistant: message, text: message.text || '', toolResults: [] }));
}

function renderEventDetailGraph(nodes, edges, focusEventId, scope, eventId, transcript) {
  const rows = [...(nodes || [])].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0) || Number(a.id || 0) - Number(b.id || 0));
  const flow = transcriptFlow(transcript);
  const toolCount = flow.reduce((count, item) => count + ((item.assistant?.toolCalls || []).length), 0);
  const errorCount = flow.reduce((count, item) => count + ((item.toolResults || []).filter((result) => result.isError).length), 0);
  const title = eventDetailTitle(scope);
  let html = `<div id="event-details" style="border:1px solid var(--border);border-radius:6px;background:var(--bg);margin-bottom:12px;scroll-margin-top:14px">`;
  html += `<div style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid var(--border);font-size:12px;flex-wrap:wrap">`;
  html += componentAnchor('event-details', title);
  if (scope?.label) html += `<span style="color:var(--fg2);font-family:monospace">${esc(scope.label)}</span>`;
  html += `<span style="color:var(--fg2)">${rows.length} event${rows.length === 1 ? '' : 's'}</span>`;
  if (flow.length) html += `<span style="color:var(--fg2)">${flow.length} turn${flow.length === 1 ? '' : 's'}</span>`;
  if (toolCount) html += `<span style="color:var(--fg2)">${toolCount} tool call${toolCount === 1 ? '' : 's'}</span>`;
  if (errorCount) html += `<span style="color:var(--red)">${errorCount} error${errorCount === 1 ? '' : 's'}</span>`;
  if (transcript?.error) html += `<span style="color:var(--yellow)">transcript unavailable: ${esc(transcript.error)}</span>`;
  if (transcript?.sessionId) html += `<a href="/sessions/${encodeURIComponent(transcript.sessionId)}" style="color:var(--accent);font-size:12px">open session</a>`;
  html += renderEventDetailViewToggle(eventId);
  html += `</div>`;
  if (!rows.length && !flow.length) {
    html += `<div style="padding:12px;color:var(--fg2);font-size:13px">No related detail events found for this event.</div>`;
    html += `</div>`;
    return html;
  }

  const width = 1180;
  const rowHeight = 76;
  const margin = 22;
  const eventX = 120;
  const turnX = 520;
  const toolX = 890;
  const eventWidth = 330;
  const turnWidth = 320;
  const toolWidth = 240;
  const nodeHeight = 50;
  const eventSlots = rows.map((row) => ({ kind: 'event', row }));
  const flowSlots = flow.map((item) => ({ kind: 'turn', item }));
  let slots = [];
  if (eventSlots.length && flowSlots.length) {
    const start = eventSlots.find((slot) => slot.row.type === 'session.start') || eventSlots[0];
    const end = [...eventSlots].reverse().find((slot) => slot.row.type === 'session.end');
    const middleEvents = eventSlots.filter((slot) => slot !== start && slot !== end);
    const endTimestamp = Number(end?.row?.timestamp || 0);
    const beforeEnd = endTimestamp ? middleEvents.filter((slot) => Number(slot.row.timestamp || 0) <= endTimestamp) : middleEvents;
    const afterEnd = endTimestamp ? middleEvents.filter((slot) => Number(slot.row.timestamp || 0) > endTimestamp) : [];
    slots = [start, ...flowSlots, ...beforeEnd, ...(end && end !== start ? [end] : []), ...afterEnd];
  } else {
    slots = [...eventSlots, ...flowSlots];
  }
  const positionedSlots = [];
  let cursorY = margin;
  for (const slot of slots) {
    const toolCalls = slot.kind === 'turn' ? (slot.item.assistant?.toolCalls || []).length : 0;
    const slotHeight = Math.max(rowHeight, nodeHeight + Math.min(toolCalls, 4) * 40 + (toolCalls > 4 ? 20 : 0));
    positionedSlots.push({ ...slot, y: cursorY, slotHeight });
    cursorY += slotHeight;
  }
  const height = cursorY + margin;
  const edgeByTarget = new Map();
  for (const edge of edges || []) {
    edgeByTarget.set(Number(edge.target), [...(edgeByTarget.get(Number(edge.target)) || []), edge]);
  }

  html += `<div style="overflow:auto;max-height:720px">`;
  html += `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)} graph" style="display:block;min-width:820px">`;
  html += `<defs><marker id="event-detail-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor"></path></marker></defs>`;
  html += `<text x="${eventX}" y="14" fill="var(--fg2)" font-size="10">session events</text>`;
  if (flow.length) html += `<text x="${turnX}" y="14" fill="var(--fg2)" font-size="10">LLM turns</text>`;
  if (toolCount) html += `<text x="${toolX}" y="14" fill="var(--fg2)" font-size="10">tool calls</text>`;

  for (let index = 0; index < positionedSlots.length - 1; index++) {
    const y1 = positionedSlots[index].y + nodeHeight;
    const y2 = positionedSlots[index + 1].y;
    html += `<path d="M ${margin + 66} ${y1} L ${margin + 66} ${y2}" fill="none" stroke="var(--fg2)" stroke-width="1" stroke-dasharray="2 5" opacity=".55"></path>`;
  }

  positionedSlots.forEach((slot) => {
    const y = slot.y;
    html += `<text x="${margin}" y="${y + 20}" fill="var(--fg2)" font-size="11">${esc(slot.kind === 'event' ? timeAgo(slot.row.timestamp) : `turn ${slot.item.index || ''}`)}</text>`;
    if (slot.kind === 'turn') {
      const item = slot.item;
      const assistant = item.assistant || {};
      const isUser = item.role === 'user';
      const label = isUser ? 'user' : 'assistant';
      const stroke = isUser ? 'var(--border)' : 'var(--accent)';
      const fill = isUser ? 'var(--bg2)' : 'rgba(80,150,255,.09)';
      const text = isUser ? item.text : assistant.text;
      const chips = [];
      if (!isUser && (assistant.model || assistant.api?.model)) chips.push(assistant.model || assistant.api?.model);
      if (!isUser && (assistant.toolCalls || []).length) chips.push(`${assistant.toolCalls.length} tools`);
      html += `<rect x="${turnX}" y="${y}" width="${turnWidth}" height="${nodeHeight}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></rect>`;
      html += `<text x="${turnX + 10}" y="${y + 18}" fill="${isUser ? 'var(--fg)' : 'var(--accent)'}" font-size="12" font-family="monospace">${esc(label)}</text>`;
      html += `<text x="${turnX + 10}" y="${y + 36}" fill="var(--fg2)" font-size="11">${esc(transcriptTextPreview(text || chips.join(' | '), 58))}</text>`;
      if (chips.length) html += `<text x="${turnX + turnWidth - 112}" y="${y + 18}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(chips.join(' | '), 22))}</text>`;

      const toolResults = item.toolResults || [];
      const resultById = new Map(toolResults.map((result) => [result.toolCallId, result]));
      (assistant.toolCalls || []).slice(0, 4).forEach((toolCall, toolIndex) => {
        const result = resultById.get(toolCall.id);
        const toolY = y + Math.min(4, toolIndex) * 40;
        const tone = result?.isError ? 'var(--red)' : 'var(--green)';
        const request = typeof toolRequestExcerpt === 'function' ? toolRequestExcerpt(toolCall) : JSON.stringify(toolCall.args || {});
        html += `<path d="M ${turnX + turnWidth} ${y + nodeHeight / 2} C ${turnX + turnWidth + 24} ${y + nodeHeight / 2}, ${toolX - 24} ${toolY + 17}, ${toolX} ${toolY + 17}" fill="none" stroke="var(--fg2)" stroke-width="1.3" stroke-dasharray="4 4" marker-end="url(#event-detail-arrow)" style="color:var(--fg2)"></path>`;
        html += `<rect x="${toolX}" y="${toolY}" width="${toolWidth}" height="34" rx="6" fill="var(--bg2)" stroke="${tone}" stroke-width="1"></rect>`;
        html += `<text x="${toolX + 9}" y="${toolY + 14}" fill="${tone}" font-size="11" font-family="monospace">${esc(shortGraphLabel(toolCall.tool || 'tool', 22))}</text>`;
        html += `<text x="${toolX + 9}" y="${toolY + 27}" fill="var(--fg2)" font-size="10">${esc(transcriptTextPreview(request, 38))}</text>`;
      });
      if ((assistant.toolCalls || []).length > 4) {
        html += `<text x="${toolX + 9}" y="${y + 178}" fill="var(--fg2)" font-size="10">+${esc(String(assistant.toolCalls.length - 4))} more</text>`;
      }
      return;
    }

    const node = slot.row;
    const isFocus = Number(node.id) === Number(focusEventId);
    const stroke = isFocus ? 'var(--accent)' : 'var(--border)';
    const fill = isFocus ? 'rgba(80,150,255,.12)' : 'var(--bg2)';
    const incoming = edgeByTarget.get(Number(node.id)) || [];
    const relation = incoming.map((edge) => edge.label || edge.type).filter(Boolean).slice(0, 2).join(', ');
    const summary = node.summary || node.dataPreview?.summary || node.dataPreview?.reason || node.dataPreview?.message || '';
    html += `<g onclick="loadEventGraph(${Number(node.id)})" style="cursor:pointer">`;
    html += `<rect x="${eventX}" y="${y}" width="${eventWidth}" height="${nodeHeight}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${isFocus ? 2 : 1}"></rect>`;
    html += `<text x="${eventX + 10}" y="${y + 18}" fill="${isFocus ? 'var(--accent)' : 'var(--fg)'}" font-size="12" font-family="monospace">${esc(shortGraphLabel(node.type, 34))}</text>`;
    html += `<text x="${eventX + 10}" y="${y + 36}" fill="var(--fg2)" font-size="11">${esc(shortGraphLabel(summary || graphNodeSubtitle(node), 48))}</text>`;
    html += `<text x="${eventX + eventWidth - 70}" y="${y + 18}" fill="var(--fg2)" font-size="10">#${esc(String(node.id))}</text>`;
    if (relation) html += `<text x="${eventX + eventWidth - 150}" y="${y + 36}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(relation, 22))}</text>`;
    if (node.visibility === 'detail') html += `<text x="${eventX + eventWidth - 70}" y="${y + 36}" fill="var(--fg2)" font-size="10">detail</text>`;
    html += `</g>`;
  });

  html += `</svg>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

function renderEventDetails(nodes, edges, focusEventId, scope, eventId, transcript) {
  if (_eventGraphDetailView === 'rows') return renderEventGraphEventList(nodes, edges, focusEventId, scope);
  return renderEventDetailGraph(nodes, edges, focusEventId, scope, eventId, transcript);
}

function renderEventGraph(graph) {
  const events = chronologicalNodes(graph.events || []);
  const graphIds = new Set(Array.isArray(graph.scope?.graphEventIds) ? graph.scope.graphEventIds.map(Number) : []);
  const timelineIds = new Set(Array.isArray(graph.scope?.timelineEventIds) ? graph.scope.timelineEventIds.map(Number) : []);
  const nodes = graphIds.size ? events.filter((node) => graphIds.has(Number(node.id))) : events;
  const edges = graph.relations || [];
  const eventRows = timelineIds.size ? events.filter((node) => timelineIds.has(Number(node.id))) : nodes;
  const diagnostics = graph.diagnostics || [];
  const focus = nodes.find((node) => Number(node.id) === Number(graph.focusEventId));
  const eventId = Number(graph.focusEventId);
  const nodeIndex = new Map(nodes.map((node) => [Number(node.id), node]));
  const edgeRows = edges.map((edge) => {
    const source = nodeIndex.get(Number(edge.source));
    const target = nodeIndex.get(Number(edge.target));
    return {
      ...edge,
      sourceType: source?.type || edge.source,
      targetType: target?.type || edge.target,
    };
  });

  let html = `<div id="event-graph" style="border:1px solid var(--border);border-radius:6px;background:var(--bg2);padding:12px;scroll-margin-top:14px">`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">`;
  html += componentAnchor('event-graph', 'Event Graph');
  html += `<span style="font-family:monospace;color:var(--accent)">#${esc(String(graph.focusEventId))}</span>`;
  if (graph.traceId) html += `<span style="font-size:12px;color:var(--fg2)">trace ${esc(graph.traceId)}</span>`;
  html += `<button onclick="loadLoopTrace(${eventId})" style="margin-left:auto;font-size:11px;padding:3px 8px">Loop trace</button>`;
  html += `</div>`;

  if (focus) {
    html += `<div style="font-size:12px;color:var(--fg2);margin-bottom:10px">`;
    html += `<span style="color:var(--fg);font-family:monospace">${esc(focus.type)}</span>`;
    html += ` · owner ${esc(focus.owner || '—')} · source ${esc(focus.source || '—')} · ${timeAgo(focus.timestamp)}`;
    if (focus.summary) html += `<div style="margin-top:4px;color:var(--fg)">${esc(focus.summary)}</div>`;
    html += `</div>`;
  }

  if (diagnostics.length) {
    html += `<div style="display:grid;gap:4px;margin-bottom:10px">`;
    for (const d of diagnostics) {
      html += `<div style="font-size:12px;color:var(--fg2);border-left:2px solid var(--yellow,#c69026);padding-left:8px">${esc(d)}</div>`;
    }
    html += `</div>`;
  }

  if (_eventGraphView === 'list') {
    html += renderEventDetails(eventRows, edges, graph.focusEventId, graph.scope, eventId, graph.sessionTranscript);
    html += `</div>`;
    return html;
  }

  html += renderCanonicalEventGraphMap(graph, eventId);

  html += `<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:12px">`;
  html += `<div id="event-visible-nodes" style="display:grid;gap:6px;scroll-margin-top:14px">`;
  html += `<div style="font-size:12px;font-weight:600;display:flex;gap:6px;align-items:center">${componentAnchor('event-visible-nodes', 'Visible Nodes')}</div>`;
  if (!nodes.length) {
    html += `<div style="padding:12px;color:var(--fg2);border:1px solid var(--border);border-radius:6px">No graph nodes.</div>`;
  }
  for (const node of nodes) {
    const isFocus = Number(node.id) === Number(graph.focusEventId);
    const border = isFocus ? 'var(--accent)' : 'var(--border)';
    const bg = isFocus ? 'rgba(80,150,255,.08)' : 'var(--bg)';
    html += `<div style="border:1px solid ${border};border-radius:6px;background:${bg};padding:8px;display:grid;gap:3px">`;
    html += `<div style="display:flex;gap:8px;align-items:center">`;
    html += `<span style="font-family:monospace;color:${isFocus ? 'var(--accent)' : 'var(--fg)'}">${esc(node.type || '')}</span>`;
    html += `<span style="font-size:11px;color:var(--fg2)">#${esc(String(node.id))}</span>`;
    if (node.visibility === 'detail') html += `<span style="font-size:10px;border:1px solid var(--border);border-radius:8px;padding:1px 6px;color:var(--fg2)">detail</span>`;
    html += `<span style="margin-left:auto;font-size:11px;color:var(--fg2)">${timeAgo(node.timestamp)}</span>`;
    html += `</div>`;
    if (node.summary) html += `<div style="font-size:12px;color:var(--fg)">${esc(node.summary)}</div>`;
    html += `<div style="font-size:11px;color:var(--fg2)">owner ${esc(node.owner || '—')} · source ${esc(node.source || '—')}</div>`;
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div style="display:grid;gap:8px;align-content:start">`;
  html += `<div id="event-edges" style="border:1px solid var(--border);border-radius:6px;background:var(--bg);padding:8px;scroll-margin-top:14px">`;
  html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px;display:flex;gap:6px;align-items:center">${componentAnchor('event-edges', 'Edges')}</div>`;
  if (!edgeRows.length) {
    html += `<div style="font-size:12px;color:var(--fg2)">No visible edges.</div>`;
  } else {
    html += `<div style="display:grid;gap:5px">`;
    for (const edge of edgeRows.slice(0, 80)) {
      const color = edge.type === 'closure' ? 'var(--green)' : edge.type === 'parent' ? 'var(--accent)' : 'var(--fg2)';
      html += `<div style="font-size:12px;color:var(--fg2);border-left:2px solid ${color};padding-left:7px">`;
      html += `<span style="color:${color}">${esc(edge.type)}</span> `;
      html += `<span style="font-family:monospace">${esc(String(edge.sourceType))}</span>`;
      html += ` → <span style="font-family:monospace">${esc(String(edge.targetType))}</span>`;
      if (edge.label) html += ` · ${esc(edge.label)}`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  html += `<div id="event-inspector" style="border:1px solid var(--border);border-radius:6px;background:var(--bg);padding:8px;scroll-margin-top:14px">`;
  html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px;display:flex;gap:6px;align-items:center">${componentAnchor('event-inspector', 'Inspector')}</div>`;
  html += `<pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.35;color:var(--fg2);margin:0">${esc(JSON.stringify(graph.focusEvent || focus || {}, null, 2))}</pre>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

let loopTraceLoadGeneration = 0;
async function loadLoopTrace(target) {
  const generation = ++loopTraceLoadGeneration;
  const el = document.getElementById('loop-trace-content');
  if (!el) return;
  el.innerHTML = '<div style="padding:10px;color:var(--fg2);border:1px solid var(--border);border-radius:6px">Loading loop trace…</div>';
  try {
    const eventIdTarget = !(target && typeof target === 'object') && String(target || '').match(/^\d+$/);
    const res = await fetch(eventIdTarget ? `/api/events/${encodeURIComponent(target)}/trace` : `/api/loop-trace?${loopTraceQuery(target)}`);
    const trace = await res.json();
    if (!res.ok) throw new Error(trace.error || 'failed');
    if (generation !== loopTraceLoadGeneration) return;
    el.innerHTML = renderLoopTrace(trace);
    if (typeof scrollToHashAnchor === 'function') scrollToHashAnchor();
  } catch (e) {
    if (generation !== loopTraceLoadGeneration) return;
    el.innerHTML = `<div style="padding:10px;color:var(--red);border:1px solid var(--border);border-radius:6px">Failed to load loop trace: ${esc(e.message)}</div>`;
  }
}

function renderWorkflowEvidence(evidence) {
  if (!evidence) return '<p class="health-warning">Workflow evidence is unavailable or expired.</p>';
  const run = evidence.run;
  const diagnostics = evidence.diagnostics;
  const links = [
    run.parentWorkflowRunId ? `<a href="${esc(workflowRunLink(run.parentWorkflowRunId))}">Parent run</a>` : '',
    run.resumedFromRunId ? `<a href="${esc(workflowRunLink(run.resumedFromRunId))}">Earlier execution</a>` : '',
    `<a href="/api/loop-trace?workflowRunId=${encodeURIComponent(run.runId)}">Full retained evidence (JSON)</a>`,
  ].filter(Boolean).join(' · ');
  return `<section class="health-section" data-workflow-evidence><h3>Workflow evidence · ${esc(run.runId)}</h3>
    <p>${esc(run.workflow)} · ${esc(run.status)} · ${esc(healthTime(run.startedAt))} → ${esc(healthTime(run.endedAt))}</p>
    <p>${links}</p><h4>Purpose</h4><pre class="health-text">${esc((run.task || '').slice(0, 2000))}${run.task?.length > 2000 ? '\n[preview limited; open full evidence]' : ''}</pre>
    <h4>Recorded result / reason</h4><pre class="health-text">${esc(run.result_summary || '')}\n${esc(run.result_reason || 'No reason recorded.')}</pre>
    <p class="health-note">Source: ${esc(run.sourcePath || 'unknown')} · entry hash ${esc(run.entryContentHash || 'unknown')}. Workflow completion is not Task acceptance.</p>
    <p class="health-note">Artifact reference: ${esc(run.artifact_ref || 'none')}${run.artifact_error ? ' · ' + esc(run.artifact_error) : ''}</p>
    <h4>Steps / agent calls</h4>${evidence.steps.length ? evidence.steps.map(step => `<div class="health-task"><a href="/sessions/${encodeURIComponent(step.sessionId)}">${esc(step.stepLabel || step.sessionId)}</a> · ${esc(step.status)} · ${esc(step.agent)}<pre class="health-text">${esc(step.error || step.outcome || '')}</pre></div>`).join('') : '<p>No retained step sessions.</p>'}
    ${evidence.stepsTruncated ? '<p class="health-warning">Step list truncated.</p>' : ''}
    <h4>Child workflows</h4>${evidence.childRunIds.length ? evidence.childRunIds.map(id => `<a href="${esc(workflowRunLink(id))}">${esc(id)}</a>`).join(' · ') : '<p>No retained child links.</p>'}
    ${evidence.childrenTruncated ? '<p class="health-warning">Child list truncated.</p>' : ''}
    <h4>Run diagnostics</h4>${diagnostics.state === 'available' ? `<pre class="health-text">${esc(diagnostics.entries.map(e => `${healthTime(e.at)} [${e.level}] ${e.message}`).join('\n') || 'No messages recorded.')}</pre>` : '<p class="health-warning">Diagnostics unavailable: not recorded, expired or unreadable.</p>'}
    ${diagnostics.truncated ? '<p class="health-warning">Diagnostics truncated by recording limits.</p>' : ''}
    <p class="health-note">Diagnostics are bounded and best-effort; known-secret redaction is not a guarantee of complete or secret-free evidence.</p></section>`;
}

function renderLoopTrace(trace) {
  const workflow = trace.workflows?.[0];
  const sessionCount = trace.sessions?.length || 0;
  const guardCount = trace.guardSignals?.length || 0;
  const failoverCount = trace.failoverEvents?.length || 0;
  const metricEventCount = trace.metricEvents?.length || 0;
  const chips = [
    `owner ${trace.owner || '—'}`,
    trace.metricId ? `metric ${trace.metricId}` : null,
    trace.projectId ? `project ${trace.projectId}` : null,
    workflow ? `workflow ${workflow.workflow}:${workflow.status}` : 'workflow —',
    `${sessionCount} sessions`,
    `${guardCount} guards`,
    `${metricEventCount} metric events`,
    `${failoverCount} failovers`,
  ].filter(Boolean);

  let html = `<div id="loop-trace" style="border:1px solid var(--border);border-radius:6px;background:var(--bg2);padding:12px;scroll-margin-top:14px">`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">`;
  html += `${componentAnchor('loop-trace', 'Loop trace')}<span style="color:var(--fg2);font-size:12px">${esc(trace.target.kind)}:${esc(String(trace.target.id))}</span>`;
  html += `</div>`;
  html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">`;
  for (const chip of chips) html += `<span style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:2px 8px">${esc(chip)}</span>`;
  html += `</div>`;
  if (trace.target.kind === 'workflow') html += renderWorkflowEvidence(trace.workflowEvidence);
  if (trace.handler?.name || trace.handler?.reason) {
    html += `<div style="font-size:12px;color:var(--fg2);margin-bottom:8px">handler: <b style="color:var(--fg)">${esc(trace.handler.name || '—')}</b>${trace.handler.status ? ` · ${esc(trace.handler.status)}` : ''}${trace.handler.reason ? ` · ${esc(trace.handler.reason)}` : ''}</div>`;
  }
  if (trace.executions?.length) {
    html += `<div style="font-size:12px;margin-top:8px"><b>Executions</b></div>`;
    html += `<div style="display:grid;gap:4px;margin-top:4px">`;
    for (const ex of trace.executions.slice(0, 10)) {
      html += `<div style="font-size:12px;color:var(--fg2);display:flex;gap:8px;align-items:center">`;
      let id = `<span style="color:var(--accent)">${esc(ex.id)}</span>`;
      if (ex.kind === 'session') {
        id = `<a href="/sessions/${esc(ex.id)}" style="color:var(--accent)">${esc(ex.id)}</a>`;
      } else if (ex.kind === 'workflow') {
        id = `<a href="#" style="color:var(--accent)" onclick='event.preventDefault();loadLoopTrace({workflowRunId:${jsStringAttr(ex.id)}})'>${esc(ex.id)}</a>`;
      }
      html += id;
      html += `<span>${esc(ex.kind || '—')}</span><span>${esc(ex.owner || '—')}</span><span>${esc(ex.status || '—')}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ex.summary || '')}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  } else if (trace.sessions?.length) {
    html += `<div style="font-size:12px;margin-top:8px"><b>Sessions</b></div>`;
    html += `<div style="display:grid;gap:4px;margin-top:4px">`;
    for (const s of trace.sessions.slice(0, 8)) {
      html += `<div style="font-size:12px;color:var(--fg2);display:flex;gap:8px;align-items:center">`;
      html += `<a href="/sessions/${esc(s.sessionId)}" style="color:var(--accent)">${esc(s.sessionId)}</a>`;
      html += `<span>${esc(s.agent || '—')}</span><span>${esc(s.status || '—')}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((s.task || '').slice(0, 90))}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  if (trace.failoverEvents?.length) {
    html += `<div style="font-size:12px;margin-top:8px"><b style="color:var(--red)">Failover</b></div>`;
    html += `<div style="display:grid;gap:4px;margin-top:4px">`;
    for (const ev of trace.failoverEvents.slice(0, 5)) {
      let data = {};
      try { data = ev.data ? JSON.parse(ev.data) : {}; } catch {}
      const owner = ev.owner || trace.owner || '—';
      const category = data.category || data.action || ev.event_type || 'failure';
      const recoverable = data.recoverable === false ? 'not recoverable' : data.recoverable === true ? 'recoverable' : '';
      const nextAction = data.nextAction || (ev.event_type === 'workflow.resume_skipped' ? 'none' : '');
      const reason = data.reason || data.message || ev.event_type || '';
      html += `<div style="font-size:12px;color:var(--fg2);border-left:2px solid var(--red);padding-left:8px">`;
      html += `<span style="color:var(--fg)">${esc(ev.event_type || '')}</span>`;
      html += ` · owner ${esc(owner)} · ${esc(category)}${recoverable ? ` · ${esc(recoverable)}` : ''}`;
      if (nextAction) html += ` · next ${esc(nextAction)}`;
      if (reason) html += `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(reason)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}
