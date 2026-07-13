// ── Events ───────────────────────────────────────────────────────────

async function loadEvents() {
  try {
    loadEventDeliveryHealth();
    const owner = document.getElementById('events-owner')?.value || '';
    const type = document.getElementById('events-type')?.value || '';
    let url = '/api/events?limit=200';
    if (owner) url += `&owner=${encodeURIComponent(owner)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    const res = await fetch(url);
    const events = await res.json();
    const el = document.getElementById('events-content');
    const countEl = document.getElementById('events-count');

    // Populate filter dropdowns from data
    const owners = new Set(events.map(e => e.owner).filter(Boolean));
    const types = new Set(events.map(e => e.event_type).filter(Boolean));
    const ownerSel = document.getElementById('events-owner');
    const typeSel = document.getElementById('events-type');
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

async function loadEventGraph(eventId, opts = {}) {
  const el = document.getElementById('event-graph-content');
  if (!el) return;
  const detail = opts.detail === true;
  const depth = Number.isFinite(Number(opts.depth)) ? Number(opts.depth) : 3;
  el.innerHTML = '<div style="padding:10px;color:var(--fg2);border:1px solid var(--border);border-radius:6px">Loading event graph…</div>';
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/graph?depth=${encodeURIComponent(depth)}&detail=${detail ? 'true' : 'false'}`);
    const graph = await res.json();
    if (!res.ok) throw new Error(graph.error || 'failed');
    el.innerHTML = renderEventGraph(graph, { detail, depth });
  } catch (e) {
    el.innerHTML = `<div style="padding:10px;color:var(--red);border:1px solid var(--border);border-radius:6px">Failed to load event graph: ${esc(e.message)}</div>`;
  }
}

function renderEventGraph(graph, opts = {}) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const diagnostics = graph.diagnostics || [];
  const focus = nodes.find((node) => Number(node.id) === Number(graph.focusEventId));
  const detail = opts.detail === true;
  const depth = Number.isFinite(Number(opts.depth)) ? Number(opts.depth) : 3;
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

  let html = `<div style="border:1px solid var(--border);border-radius:6px;background:var(--bg2);padding:12px">`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">`;
  html += `<b>Event Graph</b>`;
  html += `<span style="font-family:monospace;color:var(--accent)">#${esc(String(graph.focusEventId))}</span>`;
  if (graph.traceId) html += `<span style="font-size:12px;color:var(--fg2)">trace ${esc(graph.traceId)}</span>`;
  html += `<button onclick="loadEventGraph(${eventId}, {detail:${detail ? 'false' : 'true'}, depth:${depth}})" style="margin-left:auto;font-size:11px;padding:3px 8px">${detail ? 'Hide detail' : 'Show detail'}</button>`;
  html += `<button onclick="loadLoopTrace(${eventId})" style="font-size:11px;padding:3px 8px">Loop trace</button>`;
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

  html += `<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:12px">`;
  html += `<div style="display:grid;gap:6px">`;
  if (!nodes.length) {
    html += `<div style="padding:12px;color:var(--fg2);border:1px solid var(--border);border-radius:6px">No graph nodes.</div>`;
  }
  for (const node of nodes) {
    const isFocus = Number(node.id) === Number(graph.focusEventId);
    const border = isFocus ? 'var(--accent)' : 'var(--border)';
    const bg = isFocus ? 'rgba(80,150,255,.08)' : 'var(--bg)';
    html += `<div style="border:1px solid ${border};border-radius:6px;background:${bg};padding:8px;display:grid;gap:3px">`;
    html += `<div style="display:flex;gap:8px;align-items:center">`;
    html += `<span style="font-family:monospace;color:${isFocus ? 'var(--accent)' : 'var(--fg)'}">${esc(node.type)}</span>`;
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
  html += `<div style="border:1px solid var(--border);border-radius:6px;background:var(--bg);padding:8px">`;
  html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px">Edges</div>`;
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
  html += `<div style="border:1px solid var(--border);border-radius:6px;background:var(--bg);padding:8px">`;
  html += `<div style="font-size:12px;font-weight:600;margin-bottom:6px">Inspector</div>`;
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

  let html = `<div style="border:1px solid var(--border);border-radius:6px;background:var(--bg2);padding:12px">`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">`;
  html += `<b>Loop trace</b><span style="color:var(--fg2);font-size:12px">${esc(trace.target.kind)}:${esc(String(trace.target.id))}</span>`;
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
