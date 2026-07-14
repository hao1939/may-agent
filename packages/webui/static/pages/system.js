// ── Events ───────────────────────────────────────────────────────────

let _eventGraphView = 'graph';
let _eventGraphDetailView = 'graph';
let _eventGraphRootEventId = null;
let _eventGraphExpandedSessions = {};
let _eventGraphExpandedMore = {};
let _eventGraphExpansionRequestSeq = 0;

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
    ['owner inbox open', Number(health.ownerInboxOpenCount || 0)],
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

function setEventGraphDetailView(view, eventId, detail, depth) {
  _eventGraphDetailView = view === 'rows' ? 'rows' : 'graph';
  _eventGraphView = 'list';
  loadEventGraph(eventId, { detail: true, depth });
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
  const depth = Number.isFinite(Number(opts.depth)) ? Number(opts.depth) : 1;
  const numericEventId = Number(eventId);
  if (_eventGraphRootEventId !== numericEventId) {
    _eventGraphRootEventId = numericEventId;
    _eventGraphExpandedSessions = {};
    _eventGraphExpandedMore = {};
  }
  const input = document.getElementById('event-graph-id');
  if (input) input.value = String(eventId);
  el.innerHTML = '<div style="padding:10px;color:var(--fg2);border:1px solid var(--border);border-radius:6px">Loading event graph…</div>';
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/graph?depth=${encodeURIComponent(depth)}&detail=${detail ? 'true' : 'false'}`);
    const graph = await res.json();
    if (!res.ok) throw new Error(graph.error || 'failed');
    if (detail && graph.eventListScope?.kind === 'session' && Array.isArray(graph.eventListScope.ids) && graph.eventListScope.ids.length === 1) {
      graph.sessionTranscript = await loadEventGraphSessionTranscript(graph.eventListScope.ids[0]);
    }
    el.innerHTML = renderEventGraph(graph, { detail, depth });
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

async function loadEventGraphData(eventId, detail, depth) {
  const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/graph?depth=${encodeURIComponent(depth)}&detail=${detail ? 'true' : 'false'}`);
  const graph = await res.json();
  if (!res.ok) throw new Error(graph.error || 'failed');
  return graph;
}

async function toggleEventGraphSessionExpansion(rootEventId, eventId, sessionId, depth) {
  const key = String(sessionId || '').trim();
  if (!key) return;
  if (_eventGraphExpandedSessions[key]?.ready || _eventGraphExpandedSessions[key]?.loading || _eventGraphExpandedSessions[key]?.error) {
    delete _eventGraphExpandedSessions[key];
    loadEventGraph(rootEventId, { depth });
    return;
  }
  const requestId = ++_eventGraphExpansionRequestSeq;
  _eventGraphExpandedSessions[key] = { loading: true, eventId: Number(eventId), sessionId: key, requestId };
  loadEventGraph(rootEventId, { depth });
  try {
    const [transcript, detailGraph] = await Promise.all([
      loadEventGraphSessionTranscript(key),
      loadEventGraphData(eventId, false, Math.max(3, Number(depth) || 3)),
    ]);
    if (_eventGraphExpandedSessions[key]?.requestId !== requestId) return;
    _eventGraphExpandedSessions[key] = {
      ready: true,
      eventId: Number(eventId),
      sessionId: key,
      transcript,
      sessionEvents: Array.isArray(detailGraph.eventList) ? detailGraph.eventList : [],
    };
  } catch (e) {
    if (_eventGraphExpandedSessions[key]?.requestId !== requestId) return;
    _eventGraphExpandedSessions[key] = {
      error: e.message || String(e),
      eventId: Number(eventId),
      sessionId: key,
    };
  }
  loadEventGraph(rootEventId, { depth });
}

function toggleEventGraphMoreExpansion(rootEventId, moreKey, depth) {
  const key = String(moreKey || '').trim();
  if (!key) return;
  if (_eventGraphExpandedMore[key]) delete _eventGraphExpandedMore[key];
  else _eventGraphExpandedMore[key] = true;
  loadEventGraph(rootEventId, { depth });
}

function shortGraphLabel(value, max = 28) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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
  if (node.type === 'session.end') return 'Session completed';
  if (node.type === 'project.task.assigned') return 'Task assigned';
  if (node.type === 'project.task.completed') return 'Task completed';
  if (node.type === 'project.task.reviewed') return 'Task reviewed';
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

function eventListScopeTitle(scope) {
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
    const title = eventListScopeTitle(scope);
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
  if (graph.review) return renderEventReviewPanel(graph.review, eventRows, edges, graph.eventListScope);
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

function graphNodeSessionId(node) {
  return String(node?.dataPreview?.sessionId || node?.dataPreview?.session_id || '').trim();
}

function isExpandableSessionNode(node) {
  return !!graphNodeSessionId(node) && (node?.type === 'session.start' || node?.type === 'session.end');
}

function chronologicalNodes(nodes) {
  return [...(nodes || [])].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0) || Number(a.id || 0) - Number(b.id || 0));
}

function graphTimestampValue(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function transcriptItemTimestamp(item) {
  return graphTimestampValue(item?.timestamp) ??
    graphTimestampValue(item?.assistant?.timestamp) ??
    graphTimestampValue(item?.toolResults?.[0]?.timestamp);
}

function sessionExpansionItems(sessionId, expansion, visibleEventIds = new Set()) {
  if (expansion?.loading) {
    return [{ kind: 'status', key: `status:${sessionId}:loading`, sessionId, status: 'loading', label: 'loading transcript' }];
  }
  if (expansion?.error) {
    return [{ kind: 'status', key: `status:${sessionId}:error`, sessionId, status: 'error', label: expansion.error }];
  }
  const flow = transcriptFlow(expansion?.transcript);
  const sessionEvents = chronologicalNodes(expansion?.sessionEvents || []).filter((node) => {
    const nodeSessionId = graphNodeSessionId(node);
    if (nodeSessionId && nodeSessionId !== sessionId) return false;
    if (visibleEventIds.has(Number(node.id))) return false;
    return true;
  });
  const flowItems = flow.map((item, index) => ({
      kind: 'turn',
      key: `turn:${sessionId}:${index}`,
      sessionId,
      item,
      turnIndex: index + 1,
      sortTime: transcriptItemTimestamp(item),
      sortIndex: index,
    }));
  const eventItems = sessionEvents.map((node, index) => ({
      kind: 'session-event',
      key: `session-event:${sessionId}:${node.id}`,
      sessionId,
      node,
      sortTime: graphTimestampValue(node.timestamp),
      sortIndex: flowItems.length + index,
    }));
  const canAlignByTime = [...flowItems, ...eventItems].filter((item) => item.sortTime != null).length >= 2;
  const items = canAlignByTime
    ? [...flowItems, ...eventItems].sort((a, b) => {
        if (a.sortTime == null && b.sortTime == null) return a.sortIndex - b.sortIndex;
        if (a.sortTime == null) return 1;
        if (b.sortTime == null) return -1;
        return a.sortTime - b.sortTime || a.sortIndex - b.sortIndex;
      })
    : [...flowItems, ...eventItems];
  if (!items.length) {
    return [{ kind: 'status', key: `status:${sessionId}:empty`, sessionId, status: 'empty', label: 'no session details' }];
  }
  return items;
}

function buildEventGraphDisplay(nodes, moreNodes = []) {
  const ordered = chronologicalNodes(nodes);
  const expandedHiddenNodes = [];
  for (const more of moreNodes || []) {
    if (_eventGraphExpandedMore[more.key]) expandedHiddenNodes.push(...chronologicalNodes(more.nodes || []));
  }
  const visibleNodes = [...ordered, ...expandedHiddenNodes];
  const hasStart = new Set(visibleNodes.filter((node) => node.type === 'session.start').map(graphNodeSessionId).filter(Boolean));
  const visibleEventIds = new Set(visibleNodes.map((node) => Number(node.id)).filter(Number.isFinite));
  const moreByParent = new Map();
  for (const more of moreNodes || []) {
    const parentId = Number(more.parentEventId);
    if (!Number.isFinite(parentId)) continue;
    moreByParent.set(parentId, [...(moreByParent.get(parentId) || []), more]);
  }
  const inserted = new Set();
  const items = [];
  for (const node of ordered) {
    const sessionId = graphNodeSessionId(node);
    const expansion = sessionId ? _eventGraphExpandedSessions[sessionId] : null;
    if (expansion && !inserted.has(sessionId) && node.type === 'session.end' && !hasStart.has(sessionId)) {
      items.push(...sessionExpansionItems(sessionId, expansion, visibleEventIds));
      inserted.add(sessionId);
    }
    items.push({ kind: 'event', key: `event:${node.id}`, node });
    if (expansion && !inserted.has(sessionId) && node.type === 'session.start') {
      items.push(...sessionExpansionItems(sessionId, expansion, visibleEventIds));
      inserted.add(sessionId);
    }
    for (const more of moreByParent.get(Number(node.id)) || []) {
      if (_eventGraphExpandedMore[more.key]) {
        for (const hidden of chronologicalNodes(more.nodes || [])) {
          const hiddenSessionId = graphNodeSessionId(hidden);
          const hiddenExpansion = hiddenSessionId ? _eventGraphExpandedSessions[hiddenSessionId] : null;
          if (hiddenExpansion && !inserted.has(hiddenSessionId) && hidden.type === 'session.end' && !hasStart.has(hiddenSessionId)) {
            items.push(...sessionExpansionItems(hiddenSessionId, hiddenExpansion, visibleEventIds));
            inserted.add(hiddenSessionId);
          }
          items.push({ kind: 'more-event', key: `${more.key}:event:${hidden.id}`, node: hidden, sessionId: hiddenSessionId, moreKey: more.key, more });
          if (hiddenExpansion && !inserted.has(hiddenSessionId) && hidden.type === 'session.start') {
            items.push(...sessionExpansionItems(hiddenSessionId, hiddenExpansion, visibleEventIds));
            inserted.add(hiddenSessionId);
          }
        }
        items.push({ kind: 'more-tail', key: `${more.key}:tail`, moreKey: more.key, more });
      } else {
        items.push({ kind: 'more', key: more.key, more });
      }
    }
  }
  return items;
}

function eventNodeKey(eventId) {
  return `event:${eventId}`;
}

function expandedSessionEdge(edge, nodeById) {
  const source = nodeById.get(Number(edge.source));
  const target = nodeById.get(Number(edge.target));
  const sourceSession = graphNodeSessionId(source);
  const targetSession = graphNodeSessionId(target);
  if (!sourceSession || sourceSession !== targetSession || !_eventGraphExpandedSessions[sourceSession]) return false;
  return (source?.type === 'session.start' && target?.type === 'session.end') ||
    (source?.type === 'session.end' && target?.type === 'session.start');
}

function itemLevel(item) {
  if (!item) return 0;
  if (item.kind === 'event') return 0;
  if (item.kind === 'session-event') return 0;
  if (item.kind === 'more') return moreItemLevel(item.more);
  if (item.kind === 'more-event' && (item.node?.type === 'session.start' || item.node?.type === 'session.end')) return 0;
  if (item.kind === 'more-tail') return moreItemLevel(item.more);
  if (item.kind === 'turn' || item.kind === 'status' || item.kind === 'more-event') return 1;
  if (item.kind === 'tool') return 2;
  return 0;
}

function moreItemLevel(more) {
  const nodes = more?.nodes || [];
  if (more?.direction === 'context' && more?.scope === 'workflow' && nodes.some((node) => node.type === 'session.start' || node.type === 'session.end')) {
    return 0;
  }
  return more?.direction === 'details' ? 1 : 0;
}

function graphXForLevel(level, eventX, turnX, toolX) {
  if (level >= 2) return toolX;
  if (level === 1) return turnX;
  return eventX;
}

function edgeRouteForItems(source, target) {
  const sourceLevel = itemLevel(source);
  const targetLevel = itemLevel(target);
  if (sourceLevel > targetLevel) return 'return';
  if (sourceLevel < targetLevel) return 'child';
  return 'same';
}

function buildExpandedSessionEdges(displayItems) {
  const edges = [];
  const bySession = new Map();
  for (const item of displayItems) {
    const sessionId = item.kind === 'event' ? graphNodeSessionId(item.node) : item.sessionId;
    if (!sessionId || !_eventGraphExpandedSessions[sessionId]) continue;
    bySession.set(sessionId, [...(bySession.get(sessionId) || []), item]);
  }
  for (const [sessionId, items] of bySession) {
    const start = items.find((item) => (item.kind === 'event' || item.kind === 'more-event') && item.node?.type === 'session.start');
    const end = [...items].reverse().find((item) => (item.kind === 'event' || item.kind === 'more-event') && item.node?.type === 'session.end');
    const details = items.filter((item) => item.kind !== 'event' && item.kind !== 'more-event' && item.kind !== 'session-event');
    if (!details.length) continue;
    const sequence = [start, ...details, end].filter(Boolean);
    for (let index = 0; index < sequence.length - 1; index++) {
      const source = sequence[index];
      const target = sequence[index + 1];
      const returnToParent = itemLevel(source) > itemLevel(target);
      edges.push({
        sourceKey: source.key,
        targetKey: target.key,
        type: 'expanded-session',
        label: index === 0 ? 'session detail' : returnToParent ? 'return' : '',
        route: returnToParent ? 'return' : itemLevel(source) < itemLevel(target) ? 'child' : 'same',
        sessionId,
      });
    }
  }
  return edges;
}

function buildMoreEdges(displayItems) {
  const edges = [];
  const itemByKey = new Map(displayItems.map((item) => [item.key, item]));
  for (const item of displayItems) {
    if (item.kind !== 'more') continue;
    const parentKey = eventNodeKey(item.more?.parentEventId);
    const parentItem = itemByKey.get(parentKey);
    if (parentItem) {
      edges.push({
        sourceKey: parentKey,
        targetKey: item.key,
        type: 'more',
        label: item.more?.label || '...',
        route: edgeRouteForItems(parentItem, item),
      });
    }
  }

  const expandedGroups = new Map();
  for (const item of displayItems) {
    if (item.kind !== 'more-event' && item.kind !== 'more-tail') continue;
    expandedGroups.set(item.moreKey, [...(expandedGroups.get(item.moreKey) || []), item]);
  }
  for (const items of expandedGroups.values()) {
    const more = items.find((item) => item.more)?.more;
    if (!more) continue;
    const parentKey = eventNodeKey(more.parentEventId);
    let previousKey = parentKey;
    let previousItem = itemByKey.get(parentKey);
    if (!previousItem) continue;
    items.forEach((item, index) => {
      edges.push({
        sourceKey: previousKey,
        targetKey: item.key,
        type: 'more-expanded',
        label: index === 0 ? more.scope || 'context' : '',
        route: edgeRouteForItems(previousItem, item),
      });
      previousKey = item.key;
      previousItem = item;
    });
  }
  return edges;
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

function renderEventGraphMap(nodes, edges, focusEventId, rootEventId, depth, moreNodes = []) {
  if (!nodes.length) return '';
  const displayItems = buildEventGraphDisplay(nodes, moreNodes);
  const structuralEdges = edges;
  const nodeWidth = 230;
  const nodeHeight = 58;
  const rowGap = 36;
  const levelGap = 70;
  const margin = 24;
  const eventX = margin;
  const turnX = eventX + nodeWidth + levelGap;
  const toolX = turnX + nodeWidth + levelGap;
  const width = Math.max(820, toolX + nodeWidth + margin);
  let cursorY = 58;
  const positions = new Map();
  const toolPositions = [];
  displayItems.forEach((item) => {
    const level = itemLevel(item);
    const x = graphXForLevel(level, eventX, turnX, toolX);
    positions.set(item.key, { x, y: cursorY, level });
    if (item.kind === 'turn') {
      const toolCalls = (item.item?.assistant?.toolCalls || []).slice(0, 4);
      toolCalls.forEach((toolCall, toolIndex) => {
        toolPositions.push({
          key: `${item.key}:tool:${toolIndex}`,
          turnKey: item.key,
          toolCall,
          result: (item.item?.toolResults || []).find((result) => result.toolCallId === toolCall.id),
          x: toolX,
          y: cursorY + toolIndex * 46,
        });
      });
      const toolRows = Math.max(1, toolCalls.length);
      cursorY += Math.max(nodeHeight + rowGap, toolRows * 46 + rowGap);
    } else {
      cursorY += nodeHeight + rowGap;
    }
  });
  const height = Math.max(230, cursorY + margin);
  const nodeById = new Map(nodes.map((node) => [Number(node.id), node]));
  const syntheticEdges = [...buildExpandedSessionEdges(displayItems), ...buildMoreEdges(displayItems)];
  const startEventId = chronologicalNodes(nodes).find((node) => node.type)?.id;

  let svg = `<div id="event-overview-graph" style="overflow-x:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg);margin-bottom:12px;scroll-margin-top:14px">`;
  svg += `<div style="display:flex;gap:6px;align-items:center;padding:8px;border-bottom:1px solid var(--border);font-size:12px">${componentAnchor('event-overview-graph', 'Overview Graph')}</div>`;
  svg += `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="event graph" style="display:block;min-width:100%">`;
  svg += `<defs><marker id="event-graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor"></path></marker></defs>`;
  for (const edge of structuralEdges) {
    if (expandedSessionEdge(edge, nodeById)) continue;
    const source = positions.get(eventNodeKey(edge.source));
    const target = positions.get(eventNodeKey(edge.target));
    if (!source || !target) continue;
    const color = edge.type === 'closure' ? 'var(--green)' : edge.type === 'parent' ? 'var(--accent)' : 'var(--fg2)';
    const dash = edge.type === 'reference' ? '4 4' : '';
    svg = renderGraphEdge(svg, source, target, nodeWidth, nodeHeight, edge.label, color, dash);
  }
  for (const edge of syntheticEdges) {
    const source = positions.get(edge.sourceKey);
    const target = positions.get(edge.targetKey);
    if (!source || !target) continue;
    svg = renderGraphEdge(svg, source, target, nodeWidth, nodeHeight, edge.label, 'var(--accent)', edge.route === 'return' ? '5 5' : '3 4', edge.route);
  }

  for (const tool of toolPositions) {
    const turn = positions.get(tool.turnKey);
    if (!turn) continue;
    const tone = tool.result?.isError ? 'var(--red)' : 'var(--green)';
    const request = typeof toolRequestExcerpt === 'function' ? toolRequestExcerpt(tool.toolCall) : JSON.stringify(tool.toolCall.args || {});
    svg = renderGraphEdge(svg, turn, tool, nodeWidth, nodeHeight, '', 'var(--fg2)', '4 4');
    svg += `<rect x="${tool.x}" y="${tool.y}" width="${nodeWidth}" height="34" rx="6" fill="var(--bg2)" stroke="${tone}" stroke-width="1"></rect>`;
    svg += `<text x="${tool.x + 8}" y="${tool.y + 14}" fill="${tone}" font-size="10" font-family="monospace">${esc(shortGraphLabel(tool.toolCall.tool || 'tool', 26))}</text>`;
    svg += `<text x="${tool.x + 8}" y="${tool.y + 27}" fill="var(--fg2)" font-size="9">${esc(transcriptTextPreview(request, 38))}</text>`;
  }

  for (const item of displayItems) {
    const pos = positions.get(item.key);
    if (!pos) continue;
    if (item.kind === 'turn') {
      const assistant = item.item?.assistant || {};
      const isUser = item.item?.role === 'user';
      const label = isUser ? 'user' : 'assistant';
      const text = isUser ? item.item?.text : assistant.text;
      const toolCalls = assistant.toolCalls || [];
      const stroke = isUser ? 'var(--border)' : 'var(--accent)';
      const fill = isUser ? 'var(--bg2)' : 'rgba(80,150,255,.09)';
      svg += `<g>`;
      svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></rect>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 19}" fill="${isUser ? 'var(--fg)' : 'var(--accent)'}" font-size="12" font-family="monospace">${esc(label)}</text>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 38}" fill="var(--fg2)" font-size="10">${esc(transcriptTextPreview(text || `${toolCalls.length} tools`, 38))}</text>`;
      svg += `<text x="${pos.x + nodeWidth - 56}" y="${pos.y + 19}" fill="var(--fg2)" font-size="10">turn ${esc(String(item.turnIndex || ''))}</text>`;
      svg += `</g>`;
      if (toolCalls.length > 4) {
        svg += `<text x="${toolX + 8}" y="${pos.y + 4 * 46 + 14}" fill="var(--fg2)" font-size="10">+${esc(String(toolCalls.length - 4))} more tool calls</text>`;
      }
      continue;
    }

    if (item.kind === 'session-event') {
      const node = item.node;
      const tone = node.type === 'handler.skipped' || node.type === 'evaluation.skipped' ? 'var(--yellow)' : 'var(--fg2)';
      const summary = node.summary || node.dataPreview?.summary || node.dataPreview?.reason || node.dataPreview?.status || '';
      svg += `<g onclick="loadEventGraph(${Number(node.id)})" style="cursor:pointer">`;
      svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="var(--bg2)" stroke="${tone}" stroke-width="1.3"></rect>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 19}" fill="${tone}" font-size="12" font-family="monospace">${esc(shortGraphLabel(node.type, 28))}</text>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 38}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(summary || `#${node.id}`, 38))}</text>`;
      svg += `<text x="${pos.x + nodeWidth - 58}" y="${pos.y + 19}" fill="var(--fg2)" font-size="10">#${esc(String(node.id))}</text>`;
      svg += `</g>`;
      continue;
    }

    if (item.kind === 'status') {
      const tone = item.status === 'error' ? 'var(--red)' : item.status === 'loading' ? 'var(--yellow)' : 'var(--fg2)';
      svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="var(--bg2)" stroke="${tone}" stroke-width="1.4"></rect>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 22}" fill="${tone}" font-size="12" font-family="monospace">${esc(item.status || 'status')}</text>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 40}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(item.label, 30))}</text>`;
      continue;
    }

    if (item.kind === 'more') {
      const more = item.more || {};
      const expanded = !!_eventGraphExpandedMore[item.key];
      const label = more.label || '... more';
      svg += `<g onclick='toggleEventGraphMoreExpansion(${Number(rootEventId)}, ${jsStringAttr(item.key)}, ${Number(depth)})' style="cursor:pointer">`;
      svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="rgba(255,255,255,.025)" stroke="var(--fg2)" stroke-width="1.3" stroke-dasharray="4 4"></rect>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 21}" fill="var(--fg2)" font-size="12" font-family="monospace">${esc(shortGraphLabel(label, 30))}</text>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 39}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(`${more.scope || 'context'} · ${expanded ? 'collapse' : 'expand'}`, 38))}</text>`;
      svg += `</g>`;
      continue;
    }

    if (item.kind === 'more-tail') {
      const more = item.more || {};
      svg += `<g onclick='toggleEventGraphMoreExpansion(${Number(rootEventId)}, ${jsStringAttr(item.moreKey)}, ${Number(depth)})' style="cursor:pointer">`;
      svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="rgba(255,255,255,.018)" stroke="var(--fg2)" stroke-width="1.1" stroke-dasharray="4 4"></rect>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 21}" fill="var(--fg2)" font-size="12" font-family="monospace">...</text>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 39}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(`${more.scope || 'context'} · collapse`, 38))}</text>`;
      svg += `</g>`;
      continue;
    }

    if (item.kind === 'more-event') {
      const node = item.node;
      const sessionId = graphNodeSessionId(node);
      const expandable = isExpandableSessionNode(node);
      const expanded = !!(sessionId && _eventGraphExpandedSessions[sessionId]);
      const summary = node.summary || node.dataPreview?.summary || node.dataPreview?.reason || node.dataPreview?.status || graphNodeSubtitle(node);
      const click = expandable
        ? `toggleEventGraphSessionExpansion(${Number(rootEventId)}, ${Number(node.id)}, ${jsStringAttr(sessionId)}, ${Number(depth)})`
        : `loadEventGraph(${Number(node.id)})`;
      svg += `<g onclick='${click}' style="cursor:pointer">`;
      svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="${expanded ? 'rgba(80,150,255,.16)' : 'var(--bg2)'}" stroke="${expanded ? 'var(--accent)' : 'var(--border)'}" stroke-width="${expanded ? 2 : 1}"></rect>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 19}" fill="var(--fg)" font-size="12" font-family="monospace">${esc(shortGraphLabel(node.type, 28))}</text>`;
      svg += `<text x="${pos.x + 10}" y="${pos.y + 38}" fill="var(--fg2)" font-size="10">${esc(shortGraphLabel(summary, 38))}</text>`;
      svg += `<text x="${pos.x + nodeWidth - 58}" y="${pos.y + 19}" fill="var(--fg2)" font-size="10">#${esc(String(node.id))}</text>`;
      if (expandable) svg += `<text x="${pos.x + nodeWidth - 58}" y="${pos.y + 36}" fill="var(--fg2)" font-size="10">${expanded ? 'collapse' : 'expand'}</text>`;
      svg += `</g>`;
      continue;
    }

    const node = item.node;
    const isFocus = Number(node.id) === Number(focusEventId);
    const isStart = Number(node.id) === Number(startEventId);
    const sessionId = graphNodeSessionId(node);
    const expandable = isExpandableSessionNode(node);
    const expanded = !!(sessionId && _eventGraphExpandedSessions[sessionId]);
    const stroke = isFocus ? 'var(--accent)' : 'var(--border)';
    const fill = expanded ? 'rgba(80,150,255,.16)' : isFocus ? 'rgba(80,150,255,.12)' : 'var(--bg2)';
    const click = expandable
      ? `toggleEventGraphSessionExpansion(${Number(rootEventId)}, ${Number(node.id)}, ${jsStringAttr(sessionId)}, ${Number(depth)})`
      : `loadEventGraph(${Number(node.id)})`;
    svg += `<g onclick='${click}' style="cursor:pointer">`;
    svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" rx="6" fill="${fill}" stroke="${expanded ? 'var(--accent)' : stroke}" stroke-width="${isFocus || expanded ? 2 : 1}"></rect>`;
    svg += `<text x="${pos.x + 10}" y="${pos.y + 21}" fill="${isFocus ? 'var(--accent)' : 'var(--fg)'}" font-size="12">${esc(shortGraphLabel(graphNodeTitle(node), 25))}</text>`;
    svg += `<text x="${pos.x + 10}" y="${pos.y + 39}" fill="var(--fg2)" font-size="11">${esc(shortGraphLabel(graphNodeSubtitle(node), 38))}</text>`;
    if (node.visibility === 'detail') svg += `<text x="${pos.x + nodeWidth - 42}" y="${pos.y + 21}" fill="var(--fg2)" font-size="10">detail</text>`;
    if (isStart) svg += `<text x="${pos.x + nodeWidth - 104}" y="${pos.y + 21}" fill="var(--green)" font-size="10">start</text>`;
    if (expandable) svg += `<text x="${pos.x + nodeWidth - 58}" y="${pos.y + 21}" fill="var(--fg2)" font-size="10">${expanded ? 'collapse' : 'expand'}</text>`;
    svg += `</g>`;
  }
  svg += `</svg>`;
  svg += `</div>`;
  return svg;
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

function renderEventDetailViewToggle(eventId, detail, depth) {
  const graphActive = _eventGraphDetailView !== 'rows';
  const rowsActive = _eventGraphDetailView === 'rows';
  const button = (view, label, active) =>
    `<button onclick="setEventGraphDetailView('${view}', ${eventId}, ${detail ? 'true' : 'false'}, ${depth})" style="font-size:11px;padding:3px 8px;border-color:${active ? 'var(--accent)' : 'var(--border)'};color:${active ? 'var(--accent)' : 'var(--fg)'}">${label}</button>`;
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

function renderEventDetailGraph(nodes, edges, focusEventId, scope, eventId, detail, depth, transcript) {
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
  html += renderEventDetailViewToggle(eventId, detail, depth);
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

function renderEventDetails(nodes, edges, focusEventId, scope, eventId, detail, depth, transcript) {
  if (_eventGraphDetailView === 'rows') return renderEventGraphEventList(nodes, edges, focusEventId, scope);
  return renderEventDetailGraph(nodes, edges, focusEventId, scope, eventId, detail, depth, transcript);
}

function renderEventGraph(graph, opts = {}) {
  const nodes = chronologicalNodes(graph.nodes || []);
  const edges = graph.edges || [];
  const eventRows = chronologicalNodes(Array.isArray(graph.eventList) ? graph.eventList : nodes);
  const diagnostics = graph.diagnostics || [];
  const focus = nodes.find((node) => Number(node.id) === Number(graph.focusEventId));
  const detail = opts.detail === true;
  const depth = Number.isFinite(Number(opts.depth)) ? Number(opts.depth) : 1;
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

  html += renderEventGraphSummary(graph, nodes, edges, focus, eventRows);

  if (diagnostics.length) {
    html += `<div style="display:grid;gap:4px;margin-bottom:10px">`;
    for (const d of diagnostics) {
      html += `<div style="font-size:12px;color:var(--fg2);border-left:2px solid var(--yellow,#c69026);padding-left:8px">${esc(d)}</div>`;
    }
    html += `</div>`;
  }

  if (_eventGraphView === 'list') {
    html += renderEventDetails(eventRows, edges, graph.focusEventId, graph.eventListScope, eventId, detail, depth, graph.sessionTranscript);
    html += `</div>`;
    return html;
  }

  html += renderEventGraphMap(nodes, edges, graph.focusEventId, eventId, depth, graph.moreNodes || []);

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
    html += `<span style="font-family:monospace;color:${isFocus ? 'var(--accent)' : 'var(--fg)'}">${esc(graphNodeTitle(node))}</span>`;
    if (graphNodeTitle(node) !== node.type) html += `<span style="font-size:11px;color:var(--fg2);font-family:monospace">${esc(node.type)}</span>`;
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
  html += `<pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.35;color:var(--fg2);margin:0">${esc(JSON.stringify(focus?.dataPreview || {}, null, 2))}</pre>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

async function loadLoopTrace(target) {
  const el = document.getElementById('loop-trace-content');
  if (!el) return;
  el.innerHTML = '<div style="padding:10px;color:var(--fg2);border:1px solid var(--border);border-radius:6px">Loading loop trace…</div>';
  try {
    const eventIdTarget = !(target && typeof target === 'object') && String(target || '').match(/^\d+$/);
    const res = await fetch(eventIdTarget ? `/api/events/${encodeURIComponent(target)}/trace` : `/api/loop-trace?${loopTraceQuery(target)}`);
    const trace = await res.json();
    if (!res.ok) throw new Error(trace.error || 'failed');
    el.innerHTML = renderLoopTrace(trace);
    if (typeof scrollToHashAnchor === 'function') scrollToHashAnchor();
  } catch (e) {
    el.innerHTML = `<div style="padding:10px;color:var(--red);border:1px solid var(--border);border-radius:6px">Failed to load loop trace: ${esc(e.message)}</div>`;
  }
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
