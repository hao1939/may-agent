// ── Events ───────────────────────────────────────────────────────────

async function loadEvents() {
  try {
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
        `<td style="text-align:right"><button onclick="loadLoopTrace(${Number(e.id)})" title="Show loop trace" style="font-size:11px;padding:3px 8px">trace</button></td>` +
        `</tr>`;
    }
    html += `</table>`;
    el.innerHTML = html;
  } catch(e) {
    document.getElementById('events-content').innerHTML = `<div style="color:var(--red)">Failed to load events: ${e.message}</div>`;
  }
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
