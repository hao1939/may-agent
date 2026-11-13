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
        `<button onclick="loadEventGraph(${Number(e.id)})" title="Show event details" style="font-size:11px;padding:3px 8px">inspect</button>` +
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
