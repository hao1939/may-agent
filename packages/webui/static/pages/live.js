// ── Dashboard ─────────────────────────────────────────────────────────

let selectedAgent = null;

// ── System Health Summary ─────────────────────────────────────────────

async function loadHealth() {
  try {
    const r = await fetch('/api/agents/health');
    const data = await r.json();
    const el = document.getElementById('health-summary');
    const avgDur = data.avgDurationMs
      ? (data.avgDurationMs < 60000 ? Math.round(data.avgDurationMs / 1000) + 's' : Math.round(data.avgDurationMs / 60000) + 'm')
      : '—';
    const trendIcon = data.errorTrend > 0 ? '↑' : data.errorTrend < 0 ? '↓' : '→';
    const trendClass = data.errorTrend > 0 ? 'trend-up' : data.errorTrend < 0 ? 'trend-down' : 'trend-flat';
    const trendText = data.errorTrend > 0 ? `+${data.errorTrend}%` : data.errorTrend < 0 ? `${data.errorTrend}%` : 'same';
    el.innerHTML = `
      <div class="health-card">
        <div class="health-label">Sessions Today</div>
        <div class="health-value">${data.sessionsToday}</div>
        <div class="health-sub">${data.successRate}% success rate</div>
      </div>
      <div class="health-card">
        <div class="health-label">Active Agents</div>
        <div class="health-value">${data.activeAgents}</div>
        <div class="health-sub">in last 2 hours</div>
      </div>
      <div class="health-card">
        <div class="health-label">Avg Duration</div>
        <div class="health-value">${avgDur}</div>
        <div class="health-sub">per session</div>
      </div>
      <div class="health-card">
        <div class="health-label">Error Rate</div>
        <div class="health-value">${data.errorRateToday}%</div>
        <div class="health-sub"><span class="${trendClass}">${trendIcon} ${trendText} vs yesterday</span></div>
      </div>
    `;
  } catch (e) { console.error('Health error:', e); }
}

// ── Health Metrics Graphs ────────────────────────────────────────────

var HEALTH_GRAPH_METRICS = [
  { id: 'handler.success-rate', label: 'Handler Success Rate', threshold: 0.80, unit: '%', scale: 100 },
  { id: 'handler.heartbeat-coverage', label: 'Heartbeat Coverage', threshold: 6, unit: ' agents', scale: 1 },
];

async function loadHealthGraphs() {
  var container = document.getElementById('health-graphs');
  if (!container) return;

  var html = '';
  for (var i = 0; i < HEALTH_GRAPH_METRICS.length; i++) {
    var metric = HEALTH_GRAPH_METRICS[i];
    try {
      var res = await fetch('/api/metrics/' + encodeURIComponent(metric.id) + '/history?days=1');
      var data = await res.json();
      var snaps = data.snapshots || [];
      var latest = snaps.length > 0 ? snaps[snaps.length - 1].value : null;
      var latestStr = latest != null ? (latest * metric.scale).toFixed(metric.scale > 1 ? 0 : 2) + metric.unit : '—';
      var color = latest == null ? 'var(--fg2)' : latest >= metric.threshold ? 'var(--green)' : 'var(--red)';

      html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 16px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">' +
        '<span style="font-size:12px;color:var(--fg2);font-weight:500">' + metric.label + '</span>' +
        '<span style="font-size:16px;font-weight:700;color:' + color + '">' + latestStr + '</span>' +
        '</div>' +
        renderSparklineWithValues(snaps, metric.threshold, 300, 50) +
        '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--fg2);opacity:0.7">' +
        '<span>24h ago</span>' +
        '<span>threshold: ' + (metric.threshold * metric.scale).toFixed(metric.scale > 1 ? 0 : 2) + metric.unit + '</span>' +
        '<span>now</span>' +
        '</div></div>';
    } catch (e) {
      html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;color:var(--fg2);font-size:12px">' + metric.label + ': error</div>';
    }
  }
  container.innerHTML = html;
}

// ── Liveness View ────────────────────────────────────────────────────

let livenessRefreshTimer = null;

// Activity-timeline category filter. All categories enabled by default.
// 'error' is an overlay: when off, status=error sessions are hidden
// regardless of base category. When on, they render in their base color
// (or red, if the base color is the error red itself).
const TIMELINE_CATEGORIES = ['heartbeat', 'project', 'chat', 'workflow', 'other', 'error'];
const TIMELINE_CATEGORY_COLORS = {
  heartbeat: 'var(--green)', project: 'var(--purple)', chat: 'var(--accent)',
  workflow: 'var(--yellow)', other: 'var(--fg2)', error: 'var(--red)',
};
const TIMELINE_CATEGORY_FILTER = new Set(TIMELINE_CATEGORIES);

// Activity-timeline window in hours. Operator-selectable from the legend.
// Backend clamps to 1..72. Defaults to 4h to match the original behavior.
const TIMELINE_WINDOW_OPTIONS = [4, 8, 12, 24, 48];
let livenessHours = 4;

function toggleTimelineCategory(cat) {
  if (TIMELINE_CATEGORY_FILTER.has(cat)) {
    TIMELINE_CATEGORY_FILTER.delete(cat);
    // Don't allow leaving the filter empty — auto-reset to all-on if the
    // user accidentally removes the last enabled chip.
    if (TIMELINE_CATEGORY_FILTER.size === 0) {
      for (const c of TIMELINE_CATEGORIES) TIMELINE_CATEGORY_FILTER.add(c);
    }
  } else {
    TIMELINE_CATEGORY_FILTER.add(cat);
  }
  loadLiveness();
}

function setTimelineHours(h) {
  if (livenessHours === h) return;
  livenessHours = h;
  loadLiveness();
}

function formatAgo(ts) {
  if (!ts) return 'never';
  const ms = Date.now() - ts;
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return Math.round(ms / 60000) + 'm ago';
  if (ms < 86400000) return Math.round(ms / 3600000) + 'h ago';
  return Math.round(ms / 86400000) + 'd ago';
}

function formatMetricValue(value, unit) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (unit === 'ratio') return Math.round(n * 100) + '%';
  if (unit === 'hours') return n >= 10 ? Math.round(n) + 'h' : n.toFixed(1).replace(/\.0$/, '') + 'h';
  if (unit === 'ms') return n >= 1000 ? Math.round(n / 1000) + 's' : Math.round(n) + 'ms';
  if (Math.abs(n) < 10 && n % 1 !== 0) return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') + (unit && unit !== 'count' ? unit : '');
  return String(Math.round(n)) + (unit && unit !== 'count' ? unit : '');
}

function scheduleLivenessRefresh() {
  if (livenessRefreshTimer) clearTimeout(livenessRefreshTimer);
  livenessRefreshTimer = setTimeout(loadLiveness, 500);
}

async function loadLiveness() {
  const panel = document.getElementById('liveness-panel');
  if (!panel) return;
  try {
    const res = await fetch('/api/liveness?hours=' + encodeURIComponent(livenessHours));
    const data = await res.json();
    const summary = data.summary || {};
    const agents = data.agents || [];
    // Window the backend actually used (it clamps 1..72). Fall back to
    // local livenessHours if absent (older builds).
    const windowHours = Number(summary.windowHours) || livenessHours;
    const since = Number(summary.windowSince) || (Date.now() - windowHours * 60 * 60 * 1000);
    const span = Date.now() - since;
    const alerts = data.alerts || [];
    const vitals = data.vitals || [];
    const decisions = data.recentDecisions || [];
    const messages = data.messages || [];
    const windowLabel = windowHours === 1 ? '1h'
      : windowHours === 24 ? '1 day'
      : windowHours === 48 ? '2 days'
      : windowHours + 'h';

    let html = `<h2>
      <span>System liveness</span>
      <span class="subtle">${summary.heartbeatAgents4h || 0}/${summary.expectedHeartbeatAgents || summary.agentsConfigured || 0} scheduled agents heartbeated in ${esc(windowLabel)} · ${summary.activeSessions || 0} active</span>
      <span class="breach-badge ${(summary.openAlerts || 0) > 0 ? 'alerting' : 'healthy'}" onclick="routeTo('/system')" title="Click to open System tab">${(summary.openAlerts || 0) > 0 ? '⚠ ' + summary.openAlerts + ' breach' + (summary.openAlerts === 1 ? '' : 'es') : '✓ healthy'}</span>
    </h2>`;

    if (vitals.length > 0) {
      html += `<div class="liveness-section"><h3>Core vitals</h3>`;
      html += `<div class="vitals-grid">`;
      for (const metric of vitals) {
        const alerting = !!(metric.breached || metric.alertOpen);
        const value = formatMetricValue(metric.current, metric.unit);
        const threshold = metric.threshold == null ? 'no threshold' : `${metric.alert_op === '>' || metric.alert_op === 'above' ? 'max' : 'min'} ${formatMetricValue(metric.threshold, metric.unit)}`;
        html += `<div class="vital-card ${alerting ? 'alerting' : ''}" onclick="routeTo('/metrics/${attrEsc(metric.id)}')" title="${esc(metric.id)} · owner ${esc(metric.owner || 'may')} · ${esc(threshold)}">
          <div class="vital-top"><span class="vital-label">${esc(metric.name || metric.id)}</span><span class="vital-owner">${esc(metric.owner || 'may')}</span></div>
          <div class="vital-value">${esc(value)}</div>
          <div class="vital-sub">${esc(threshold)}${metric.updatedAt ? ' · ' + esc(formatAgo(metric.updatedAt)) : ''}</div>
        </div>`;
      }
      html += `</div></div>`;
    }

    // Agent contact strip — Telegram-style entry points. One tile per
    // configured agent: name + status dot + last-heartbeat-age. Click to
    // open #/agents/<name> chat. Stale agents (no heartbeat in 4h) are
    // muted but still clickable — you can wake them by sending a message.
    // Compact contact strip — the full Agents tab has the rich card grid.
    // Here we just expose names as quick chat entry points.
    html += `<div class="liveness-section" style="margin:8px 0 12px"><h3 style="font-size:11px;color:var(--fg2);margin:0 0 6px;display:flex;align-items:center;gap:8px">Talk to an agent <a href="#/agents" style="color:var(--accent);text-decoration:none;font-size:10px">see all →</a></h3><div class="agent-contact-strip" style="display:flex;flex-wrap:wrap;gap:4px">`;
    for (const agent of agents) {
      const ageMs = agent.lastHeartbeat ? (Date.now() - agent.lastHeartbeat) : null;
      const stale = ageMs == null || ageMs > 4 * 3600 * 1000;
      const dotColor = stale ? 'var(--fg2)' : (agent.lastStatus === 'error' ? 'var(--red)' : 'var(--green)');
      const ageLabel = ageMs == null ? 'no heartbeat' : formatAgo(agent.lastHeartbeat);
      html += `<button class="agent-tile" onclick="routeTo('/agents/${esc(agent.name)}')" title="Open chat with ${esc(agent.name)} — ${esc(ageLabel)}" style="display:flex;align-items:center;gap:5px;padding:3px 9px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;color:var(--fg);cursor:pointer;font-size:12px;${stale ? 'opacity:0.55' : ''}">
        <span style="color:${dotColor};font-size:9px">●</span>
        <span>${esc(agent.name)}</span>
      </button>`;
    }
    html += `</div></div>`;

    // Timeline as the dominant element (full width, screen-1 layout).
    html += `<div class="liveness-section liveness-timeline"><h3 style="display:flex;align-items:center;gap:10px;justify-content:space-between"><span>Activity timeline, last ${esc(windowLabel)}</span><span class="heartbeat-legend" style="margin:0">`;
    // Window selector (chips, same look as category chips).
    for (const h of TIMELINE_WINDOW_OPTIONS) {
      const on = h === windowHours;
      const lbl = h === 24 ? '1d' : h === 48 ? '2d' : h + 'h';
      html += `<span class="chip${on ? '' : ' off'}" onclick="setTimelineHours(${h})" title="Show last ${esc(lbl)}" style="padding:1px 7px;font-size:10px">${esc(lbl)}</span>`;
    }
    html += `</span></h3>`;
    // Interactive legend — click a chip to toggle that category.
    html += `<div class="heartbeat-legend">`;
    for (const cat of TIMELINE_CATEGORIES) {
      const on = TIMELINE_CATEGORY_FILTER.has(cat);
      const label = cat === 'error' ? 'error (any kind)' : cat;
      html += `<span class="chip${on ? '' : ' off'}" onclick="toggleTimelineCategory('${cat}')" title="Click to ${on ? 'hide' : 'show'} ${esc(cat)} sessions"><span class="swatch" style="background:${TIMELINE_CATEGORY_COLORS[cat]}"></span>${esc(label)}</span>`;
    }
    html += `<span class="note">— ring = currently running</span></div>`;

    // Snapshot the filter for this render pass so dots and per-row counts
    // agree even if the user toggles mid-render (next click triggers a new
    // loadLiveness anyway).
    const filter = TIMELINE_CATEGORY_FILTER;
    const showError = filter.has('error');

    if (!agents.length) {
      html += `<div class="liveness-item">No configured agents found.</div>`;
    } else {
      for (const agent of agents) {
        const sessions = agent.sessions || [];
        // Apply category filter for this row's dots. Error is an overlay:
        // when off, error-status dots are hidden entirely; when on, they
        // render only if their base category is also enabled.
        const visibleSessions = sessions.filter((s) => {
          const cat = s.category || 'other';
          if (s.status === 'error') return showError && filter.has(cat);
          return filter.has(cat);
        });
        // Compact per-category counts in the agent label tooltip so hovering
        // tells the operator the activity mix without expanding rows.
        const cc = agent.categoryCounts || {};
        const mixTip = ['heartbeat','project','chat','workflow','other']
          .filter((k) => (cc[k] || 0) > 0)
          .map((k) => `${k}:${cc[k]}`)
          .join(' ');
        const filterTip = filter.size < TIMELINE_CATEGORIES.length
          ? ` · showing ${visibleSessions.length}/${sessions.length}`
          : '';
        html += `<div class="heartbeat-row">
          <div class="heartbeat-agent" title="${esc(agent.name)} — ${esc(mixTip || 'no activity')}${esc(filterTip)}">${esc(agent.name)}</div>
          <div class="heartbeat-track">`;
        for (const s of visibleSessions) {
          const left = Math.max(0, Math.min(99, ((s.startedAt - since) / span) * 100));
          const cat = `cat-${s.category || 'other'}`;
          const errCls = s.status === 'error' ? ' error' : '';
          const runCls = s.status === 'running' ? ' running' : '';
          const label = s.category === 'heartbeat' ? 'heartbeat'
                      : s.category === 'project' ? `project ${s.projectId || ''}`.trim()
                      : s.category === 'chat' ? 'chat'
                      : s.category === 'workflow' ? (s.source || 'workflow')
                      : (s.source || 'session');
          html += `<span class="heartbeat-dot ${cat}${errCls}${runCls}" style="left:${left}%" title="${esc(agent.name)} · ${esc(label)} · ${esc(s.status || '')} · ${formatAgo(s.startedAt)}" onclick="loadSessionDetail('${esc(s.sessionId)}')"></span>`;
        }
        html += `</div><div class="heartbeat-last" title="Last heartbeat (agency tick)">${formatAgo(agent.lastHeartbeat)} <button title="Heartbeat now" onclick="verbHeartbeatNow('${esc(agent.name)}', event)" style="background:none;border:1px solid var(--border);color:var(--fg2);border-radius:3px;padding:1px 6px;font-size:11px;cursor:pointer;margin-left:4px">♥</button></div></div>`;
      }
    }
    html += `</div>`;

    // Three-column row: decisions / alerts / messages.
    html += `<div class="liveness-row3">`;
    html += `<div class="liveness-section"><h3>Recent decisions</h3><div class="liveness-list">`;
    if (decisions.length === 0) {
      html += `<div class="liveness-item">No heartbeat sessions in the last 4 hours.</div>`;
    } else {
      for (const item of decisions.slice(0, 5)) {
        html += `<div class="liveness-item" onclick="loadSessionDetail('${esc(item.sessionId)}')" style="cursor:pointer">
          <div class="meta">${formatAgo(item.timestamp)} · <strong>${esc(item.agent)}</strong> · ${esc(item.status || '')}</div>
          <div>${esc(item.text || '(no outcome yet)')}</div>
        </div>`;
      }
    }
    html += `</div></div>`;

    html += `<div class="liveness-section"><h3>Open alerts</h3><div class="liveness-list">`;
    if (alerts.length === 0) {
      html += `<div class="liveness-item">No open metric alerts.</div>`;
    } else {
      for (const alert of alerts.slice(0, 4)) {
        const resolveBtn = alert.alertId
          ? `<button title="Resolve" onclick="verbResolveAlert(${Number(alert.alertId)}, event)" style="background:none;border:1px solid var(--border);color:var(--fg2);border-radius:3px;padding:1px 6px;font-size:11px;cursor:pointer;float:right">resolve</button>`
          : '';
        html += `<div class="liveness-item liveness-alert">
          <div class="meta">${formatAgo(alert.createdAt)} · <strong>${esc(alert.metricId)}</strong> · ${esc(alert.priority || 'P2')} ${resolveBtn}</div>
          <div>${esc(alert.message || '')}</div>
        </div>`;
      }
    }
    html += `</div></div>`;

    html += `<div class="liveness-section"><h3>Recent messages</h3><div class="liveness-list">`;
    if (messages.length === 0) {
      html += `<div class="liveness-item">No messages in the last hour.</div>`;
    } else {
      for (const msg of messages.slice(0, 4)) {
        html += `<div class="liveness-item">
          <div class="meta">${formatAgo(msg.timestamp)} · <strong>${esc(String(msg.from || 'unknown'))}</strong> -> ${esc(String(msg.to || 'unknown'))}${msg.priority ? ' · ' + esc(String(msg.priority)) : ''}</div>
          <div>${esc(String(msg.content || ''))}</div>
        </div>`;
      }
    }
    html += `</div></div></div>`;

    // — Projects panel (design's screen-1 fifth panel) — sorted by activity —
    html += `<div class="liveness-section" style="margin-top:16px"><h3>Projects · sorted by recent activity</h3><div class="liveness-list" id="liveness-projects">Loading…</div></div>`;

    panel.innerHTML = html;
    void renderLivenessProjects();
  } catch (e) {
    panel.innerHTML = `<h2>System liveness</h2><div class="liveness-item">Failed to load liveness: ${esc(e.message || String(e))}</div>`;
  }
}

// Renders the projects-by-activity strip on the dashboard.
// Pulse: green = touched in last hour, yellow = last 24h, gray = older.
async function renderLivenessProjects() {
  const el = document.getElementById('liveness-projects');
  if (!el) return;
  try {
    const res = await fetch('/api/projects');
    const all = await res.json();
    if (!Array.isArray(all)) { el.innerHTML = ''; return; }
    // Active only — hide done/blocked from the front-page strip.
    // Front-page strip is for live work — hide all terminal/stalled projects.
    const HIDDEN = new Set(['done', 'complete', 'closed', 'waiting', 'blocked', 'paused']);
    const active = all.filter(p => !HIDDEN.has(p.status));
    active.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (active.length === 0) { el.innerHTML = `<div class="liveness-item">No active projects.</div>`; return; }
    const now = Date.now();
    let html = '';
    for (const p of active.slice(0, 6)) {
      const age = now - (p.updatedAt || 0);
      const pulse = age < 3600_000 ? '●' : age < 86_400_000 ? '◐' : '○';
      const pulseColor = age < 3600_000 ? 'var(--green,#3fb950)' : age < 86_400_000 ? 'var(--yellow,#d29922)' : 'var(--fg2)';
      const owner = p.owner && p.owner !== 'unknown' ? p.owner : '';
      const metricSummary = (p.metrics && p.metrics.length)
        ? `${p.metrics.length} metric${p.metrics.length === 1 ? '' : 's'}`
        : '';
      // Path -> route id
      const routeId = projectIdOf(p);
      html += `<div class="liveness-item" style="cursor:pointer;display:flex;align-items:center;gap:10px" onclick="routeTo('/projects/' + '${attrEsc(routeId)}')">
        <span style="color:${pulseColor};font-size:14px" title="${formatAgo(p.updatedAt)}">${pulse}</span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><strong>${esc(p.name)}</strong>${owner ? ` <span class="meta">${esc(owner)}</span>` : ''}</span>
        <span class="meta" style="font-size:11px">${formatAgo(p.updatedAt)}</span>
        ${metricSummary ? `<span class="meta" style="font-size:11px">${esc(metricSummary)}</span>` : ''}
      </div>`;
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="liveness-item">Failed to load projects: ${esc(e.message || String(e))}</div>`;
  }
}

// ── Agent Status Grid ─────────────────────────────────────────────────

async function loadAgentGrid() {
  try {
    const r = await fetch('/api/agents/activity');
    const data = await r.json();
    const grid = document.getElementById('agent-grid');
    if (!data.agents || data.agents.length === 0) {
      grid.innerHTML = '<div style="color:var(--fg2);font-size:13px;padding:8px">No agent activity in the last 24 hours.</div>';
      return;
    }

    // Populate the agent filter dropdown
    const agentSelect = document.getElementById('f-agent');
    if (agentSelect) {
      const currentVal = agentSelect.value;
      agentSelect.innerHTML = '<option value="">All agents</option>' +
        data.agents.map(a => `<option value="${esc(a.name)}" ${currentVal === a.name ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
    }

    grid.innerHTML = data.agents.map(a => {
      const elapsed = Date.now() - a.lastSession;
      let timeAgo;
      if (elapsed < 60000) timeAgo = 'just now';
      else if (elapsed < 3600000) timeAgo = Math.round(elapsed / 60000) + 'm ago';
      else timeAgo = Math.round(elapsed / 3600000) + 'h ago';

      const barWidth = Math.min(a.successRate, 100);
      const isSelected = selectedAgent === a.name;

      return `<div class="agent-card ${isSelected ? 'selected' : ''}" onclick="toggleAgentFilter('${esc(a.name)}')">
        <div style="display:flex;align-items:center">
          <span class="agent-status-dot ${a.status}"></span>
          <span class="agent-name">${esc(a.name)}</span>
        </div>
        <div class="agent-meta">
          <span><span>Last active</span><span>${timeAgo}</span></span>
          <span><span>Sessions</span><span>${a.sessionsToday}</span></span>
          <span><span>Success</span><span>${a.successRate}%</span></span>
        </div>
        <div class="agent-bar" style="width:${barWidth}%"></div>
      </div>`;
    }).join('');
  } catch (e) { console.error('Agent grid error:', e); }
}

function toggleAgentFilter(name) {
  if (selectedAgent === name) {
    selectedAgent = null;
    hideAgentDeepDive();
  } else {
    selectedAgent = name;
    loadAgentDeepDive(name);
  }
  const agentSelect = document.getElementById('f-agent');
  if (agentSelect) agentSelect.value = selectedAgent || '';
  loadAgentGrid();
  offset = 0;
}

function hideAgentDeepDive() {
  document.getElementById('agent-deep-dive').style.display = 'none';
}

async function loadAgentDeepDive(name) {
  const container = document.getElementById('agent-deep-dive');
  container.style.display = 'block';
  container.innerHTML = '<div style="color:var(--fg2);padding:20px">Loading agent details...</div>';

  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(name)}/detail`);
    const data = await res.json();

    let html = `<button class="close-btn" onclick="selectedAgent=null;hideAgentDeepDive();loadAgentGrid()">✕</button>`;
    html += `<h2>${esc(name)}</h2>`;

    // Tabs
    html += `<div class="tabs">
      <button class="tab-btn active" onclick="switchDeepDiveTab(this,'dd-sessions')">Sessions</button>
      <button class="tab-btn" onclick="switchDeepDiveTab(this,'dd-evals')">Evaluations</button>
      <button class="tab-btn" onclick="switchDeepDiveTab(this,'dd-delegation')">Delegation</button>
      <button class="tab-btn" onclick="switchDeepDiveTab(this,'dd-files')">Workspace</button>
    </div>`;

    // Tab 1: Sessions
    html += `<div id="dd-sessions" class="tab-content active">`;
    if (data.recentSessions && data.recentSessions.length) {
      html += `<table class="session-table"><thead><tr><th>Time</th><th>Duration</th><th>Status</th><th>Ops</th><th>Task</th></tr></thead><tbody>`;
      for (const s of data.recentSessions) {
        const time = new Date(s.startedAt).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
        const dur = s.duration != null ? (s.duration < 60 ? s.duration + 's' : Math.round(s.duration/60) + 'm') : '—';
        html += `<tr style="cursor:pointer" onclick="loadSessionDetail('${esc(s.id)}')">
          <td>${time}</td><td>${dur}</td>
          <td><span class="status-badge ${s.status}">${s.status}</span></td>
          <td>${s.opCount || '—'}</td>
          <td title="${esc(s.task || '')}">${esc((s.task||'').slice(0,80))}</td>
        </tr>`;
      }
      html += `</tbody></table>`;
    } else {
      html += '<div style="color:var(--fg2);font-size:13px">No recent sessions.</div>';
    }
    html += `</div>`;

    // Tab 2: Evaluations
    html += `<div id="dd-evals" class="tab-content">`;
    if (data.evalTrend && data.evalTrend.length) {
      const avgQ = (data.evalTrend.reduce((a,e) => a+e.quality, 0) / data.evalTrend.length).toFixed(1);
      const avgE = (data.evalTrend.reduce((a,e) => a+e.efficiency, 0) / data.evalTrend.length).toFixed(1);
      const verdictCounts = {};
      data.evalTrend.forEach(e => { verdictCounts[e.verdict] = (verdictCounts[e.verdict]||0)+1; });
      const topVerdict = Object.entries(verdictCounts).sort((a,b) => b[1]-a[1])[0];

      html += `<div class="eval-grid" style="margin-bottom:16px">
        <div class="eval-card"><div class="score">${avgQ}</div><div class="label">Avg Quality</div></div>
        <div class="eval-card"><div class="score">${avgE}</div><div class="label">Avg Efficiency</div></div>
        <div class="eval-card"><div class="score">${data.evalTrend.length}</div><div class="label">Evaluations</div></div>
        <div class="eval-card"><div class="score" style="font-size:14px">${topVerdict ? topVerdict[0] : '—'}</div><div class="label">Top Verdict</div></div>
      </div>`;

      // Sparkline for quality trend (most recent on right)
      const reversed = [...data.evalTrend].reverse();
      const maxQ = Math.max(...reversed.map(e => e.quality), 1);
      html += `<div style="margin-bottom:8px;font-size:12px;color:var(--fg2)">Quality trend (recent →)</div>`;
      html += `<div class="sparkline">`;
      for (const e of reversed) {
        const h = Math.max(4, Math.round((e.quality / maxQ) * 40));
        const color = e.quality >= 0.7 ? 'var(--green)' : e.quality >= 0.4 ? 'var(--yellow)' : 'var(--red)';
        html += `<div class="bar" style="height:${h}px;background:${color}" title="Q:${e.quality} E:${e.efficiency}"></div>`;
      }
      html += `</div>`;
    } else {
      html += '<div style="color:var(--fg2);font-size:13px">No evaluations found.</div>';
    }
    html += `</div>`;

    // Tab 3: Delegation
    html += `<div id="dd-delegation" class="tab-content">`;
    if (data.delegationMap) {
      const { delegatesTo, delegatedFrom } = data.delegationMap;
      html += `<h3 style="font-size:13px;margin-bottom:8px">${esc(name)} delegates to:</h3>`;
      if (delegatesTo && delegatesTo.length) {
        html += `<ul class="delegation-list">`;
        for (const d of delegatesTo) {
          html += `<li><span>→ ${esc(d.agent)}</span><span class="count">${d.count} sessions</span></li>`;
        }
        html += `</ul>`;
      } else {
        html += '<div style="color:var(--fg2);font-size:13px;margin-bottom:16px">None in last 7 days.</div>';
      }

      html += `<h3 style="font-size:13px;margin:16px 0 8px">${esc(name)} receives from:</h3>`;
      if (delegatedFrom && delegatedFrom.length) {
        html += `<ul class="delegation-list">`;
        for (const d of delegatedFrom) {
          html += `<li><span>← ${esc(d.agent)}</span><span class="count">${d.count} sessions</span></li>`;
        }
        html += `</ul>`;
      } else {
        html += '<div style="color:var(--fg2);font-size:13px">None in last 7 days.</div>';
      }
    }
    html += `</div>`;

    // Tab 4: Workspace files
    html += `<div id="dd-files" class="tab-content">`;
    if (data.workspaceFiles && data.workspaceFiles.length) {
      html += `<ul class="file-list">`;
      for (const f of data.workspaceFiles) {
        html += `<li>📄 ${esc(f)}</li>`;
      }
      html += `</ul>`;
    } else {
      html += '<div style="color:var(--fg2);font-size:13px">No workspace files found.</div>';
    }
    html += `</div>`;

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="color:var(--red);padding:20px">Error loading agent details: ${esc(e.message)}</div>`;
  }
}

function switchDeepDiveTab(btn, tabId) {
  const dive = document.getElementById('agent-deep-dive');
  dive.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  dive.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// ── Activity Timeline ─────────────────────────────────────────────────

let timelineTooltip = null;

async function loadTimeline() {
  const hours = parseInt(document.getElementById('timeline-hours').value || '24', 10);
  const section = document.getElementById('activity-timeline');
  const body = document.getElementById('timeline-body');
  const axis = document.getElementById('timeline-axis');

  try {
    const r = await fetch('/api/agents/timeline?hours=' + hours);
    const data = await r.json();

    if (!data.agents || data.agents.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    const now = data.now;
    const since = data.since;
    const span = now - since;

    // Render rows
    let html = '';
    for (const agent of data.agents) {
      html += `<div class="timeline-row">`;
      html += `<div class="timeline-label" title="${esc(agent.name)}">${esc(agent.name)}</div>`;
      html += `<div class="timeline-track">`;
      for (const s of agent.sessions) {
        const left = ((s.start - since) / span) * 100;
        const end = s.end || now;
        const width = Math.max(((end - s.start) / span) * 100, 0.3);
        const statusClass = s.status === 'done' ? 'done' : s.status === 'error' ? 'error' : s.status === 'running' ? 'running' : 'interrupted';
        const dur = s.end ? Math.round((s.end - s.start) / 1000) : null;
        const durStr = dur !== null ? (dur < 60 ? dur + 's' : Math.round(dur / 60) + 'm') : 'running';
        html += `<div class="timeline-block ${statusClass}"
          style="left:${left}%;width:${width}%"
          data-agent="${esc(agent.name)}" data-status="${s.status}" data-dur="${durStr}" data-id="${s.id}"
          onmouseenter="showTimelineTooltip(event, this)" onmouseleave="hideTimelineTooltip()"
          onclick="loadSessionDetail('${s.id}')"></div>`;
      }
      html += `</div></div>`;
    }
    body.innerHTML = html;

    // Render axis
    const tickCount = Math.min(hours, 12);
    const tickInterval = span / tickCount;
    let axisHtml = '';
    for (let i = 0; i <= tickCount; i++) {
      const t = new Date(since + i * tickInterval);
      const label = t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0');
      axisHtml += `<span>${label}</span>`;
    }
    axis.innerHTML = axisHtml;
  } catch (e) {
    console.error('Timeline error:', e);
    section.style.display = 'none';
  }
}

function showTimelineTooltip(event, el) {
  if (!timelineTooltip) {
    timelineTooltip = document.createElement('div');
    timelineTooltip.className = 'timeline-tooltip';
    document.body.appendChild(timelineTooltip);
  }
  const agent = el.dataset.agent;
  const status = el.dataset.status;
  const dur = el.dataset.dur;
  const statusEmoji = status === 'done' ? '✅' : status === 'error' ? '❌' : status === 'running' ? '🔵' : '⚪';
  timelineTooltip.innerHTML = `<strong>${agent}</strong><br>${statusEmoji} ${status} · ${dur}`;
  timelineTooltip.style.display = 'block';
  positionTooltip(event);
}

function positionTooltip(event) {
  if (!timelineTooltip) return;
  const x = event.clientX + 12;
  const y = event.clientY - 40;
  timelineTooltip.style.left = x + 'px';
  timelineTooltip.style.top = y + 'px';
}

function hideTimelineTooltip() {
  if (timelineTooltip) timelineTooltip.style.display = 'none';
}

document.addEventListener('mousemove', function(e) {
  if (timelineTooltip && timelineTooltip.style.display === 'block') positionTooltip(e);
});

// ── Stats / Requests ──────────────────────────────────────────────────

async function loadStats() {
  try {
    const r = await fetch('/api/stats');
    const data = await r.json();
    const s = data.last24h;
    const totalSess = s.sessions.reduce((a, b) => a + b.cnt, 0);
    const totalDone = s.sessions.reduce((a, b) => a + b.done, 0);
    const humanReqs = s.requests.find(r => r.fromEntity === 'human');
    document.getElementById('stats').innerHTML = `
      <div class="stat"><div class="label">Sessions (24h)</div><div class="value">${totalSess}</div></div>
      <div class="stat"><div class="label">Success rate</div><div class="value">${totalSess ? Math.round(totalDone/totalSess*100) : 0}%</div></div>
      <div class="stat"><div class="label">Human requests (7d)</div><div class="value">${data.last7d.humanRequests}</div></div>
      <div class="stat"><div class="label">Chat</div><div class="value">${data.socketAvailable ? '✓' : '—'}</div></div>
    `;
  } catch(e) { console.error('Stats error:', e); }
}

