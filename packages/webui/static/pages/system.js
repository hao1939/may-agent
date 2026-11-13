// ── Events ───────────────────────────────────────────────────────────

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
  return loadLoopTrace(target);
}

function componentAnchorHref(id) {
  const path = `${location.pathname || '/'}${location.search || ''}`;
  return `${path}#${encodeURIComponent(id)}`;
}

function componentAnchor(id, label) {
  const text = label || id;
  return `<a href="${esc(componentAnchorHref(id))}" title="Link to this section" style="color:var(--fg);text-decoration:none;font-size:12px;font-weight:600">${esc(text)}</a>`;
}

function openEventGraph(eventId) {
  routeTo(`/events/${encodeURIComponent(eventId)}`);
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

async function loadEventGraph(eventId) {
  const el = document.getElementById('event-graph-content');
  if (!el) return;
  const input = document.getElementById('event-graph-id');
  if (input) input.value = String(eventId);
  el.innerHTML = '<div style="padding:10px;color:var(--fg2);border:1px solid var(--border);border-radius:6px">Loading event…</div>';
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
    const view = await res.json();
    if (!res.ok) throw new Error(view.error || 'failed');
    el.innerHTML = renderEventView(view);
    if (typeof scrollToHashAnchor === 'function') scrollToHashAnchor();
  } catch (e) {
    el.innerHTML = `<div style="padding:10px;color:var(--red);border:1px solid var(--border);border-radius:6px">Failed to load event: ${esc(e.message)}</div>`;
  }
}

function renderEventView(view) {
  const ev = view.event || {};
  const delivery = view.delivery || {};
  const links = view.links || [];
  const eventId = Number(ev.id || 0);
  let html = `<div id="event-inspector" style="border:1px solid var(--border);border-radius:6px;background:var(--bg2);padding:12px;scroll-margin-top:14px">`;
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">`;
  html += `${componentAnchor('event-inspector', 'Event')} <span style="font-family:monospace;color:var(--accent)">#${esc(String(eventId))}</span>`;
  html += `<span style="font-family:monospace">${esc(ev.type || '')}</span>`;
  if (delivery.state) html += `<span style="font-size:11px;border:1px solid var(--border);border-radius:10px;padding:1px 8px;color:var(--fg2)">${esc(delivery.state)}</span>`;
  html += `<button onclick="loadLoopTrace(${eventId})" style="margin-left:auto;font-size:11px;padding:3px 8px">Loop trace</button>`;
  html += `</div>`;
  html += `<div style="font-size:12px;color:var(--fg2);margin-bottom:8px">owner ${esc(ev.owner || '—')} · source ${esc(ev.source || '—')} · ${ev.timestamp ? timeAgo(ev.timestamp) : '—'}</div>`;
  if (links.length) {
    html += `<div style="display:grid;gap:4px;margin-bottom:8px">`;
    for (const link of links) {
      html += `<div style="font-size:12px;color:var(--fg2)"><span style="color:var(--fg)">${esc(link.kind || '')}</span> ${esc(link.id || '')} · ${esc(link.state || '')}${link.summary ? ` · ${esc(link.summary)}` : ''}</div>`;
    }
    html += `</div>`;
  }
  html += `<pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.35;color:var(--fg2);margin:0">${esc(JSON.stringify(view, null, 2))}</pre>`;
  html += `</div>`;
  return html;
}
let loopTraceLoadGeneration = 0;
function clearLoopTrace() {
  ++loopTraceLoadGeneration;
  document.getElementById('loop-trace-content')?.replaceChildren();
}
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

function renderWorkflowFacts(facts) {
  if (!facts) return '<p class="health-warning">Workflow facts are unavailable or expired.</p>';
  const run = facts.run;
  const diagnostics = facts.diagnostics;
  const links = [
    run.parentWorkflowRunId ? `<a href="${esc(workflowRunLink(run.parentWorkflowRunId))}">Parent run</a>` : '',
    `<a href="/api/loop-trace?workflowRunId=${encodeURIComponent(run.runId)}">Full retained facts (JSON)</a>`,
  ].filter(Boolean).join(' · ');
  return `<section class="health-section" data-workflow-facts><h3>Workflow facts · ${esc(run.runId)}</h3>
    <p>${esc(run.workflow)} · ${esc(run.status)} · ${esc(healthTime(run.startedAt))} → ${esc(healthTime(run.endedAt))}</p>
    <p>${links}</p><h4>Purpose</h4><pre class="health-text">${esc((run.task || '').slice(0, 2000))}${run.task?.length > 2000 ? '\n[preview limited; open full facts]' : ''}</pre>
    <h4>Recorded result / reason</h4><pre class="health-text">${esc(run.result_summary || '')}\n${esc(run.result_reason || 'No reason recorded.')}</pre>
    <p class="health-note">Source: ${esc(run.sourcePath || 'unknown')} · entry hash ${esc(run.entryContentHash || 'unknown')}. Workflow completion is not Task acceptance.</p>
    <p class="health-note">Artifact reference: ${esc(run.artifact_ref || 'none')}${run.artifact_error ? ' · ' + esc(run.artifact_error) : ''}</p>
    <h4>Steps / agent calls</h4>${facts.steps.length ? facts.steps.map(step => `<div class="health-task"><a href="/sessions/${encodeURIComponent(step.sessionId)}">${esc(step.stepLabel || step.sessionId)}</a> · ${esc(step.status)} · ${esc(step.agent)}<pre class="health-text">${esc(step.error || step.outcome || '')}</pre></div>`).join('') : '<p>No retained step sessions.</p>'}
    ${facts.stepsTruncated ? '<p class="health-warning">Step list truncated.</p>' : ''}
    <h4>Child workflows</h4>${facts.childRunIds.length ? facts.childRunIds.map(id => `<a href="${esc(workflowRunLink(id))}">${esc(id)}</a>`).join(' · ') : '<p>No retained child links.</p>'}
    ${facts.childrenTruncated ? '<p class="health-warning">Child list truncated.</p>' : ''}
    <h4>Run diagnostics</h4>${diagnostics.state === 'available' ? `<pre class="health-text">${esc(diagnostics.entries.map(e => `${healthTime(e.at)} [${e.level}] ${e.message}`).join('\n') || 'No messages recorded.')}</pre>` : '<p class="health-warning">Diagnostics unavailable: not recorded, expired or unreadable.</p>'}
    ${diagnostics.truncated ? '<p class="health-warning">Diagnostics truncated by recording limits.</p>' : ''}
    <p class="health-note">Diagnostics are bounded and best-effort; known-secret redaction is not a guarantee of complete or secret-free facts.</p></section>`;
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
  if (trace.target.kind === 'workflow') html += renderWorkflowFacts(trace.workflowFacts);
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
      const nextAction = data.nextAction || '';
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
