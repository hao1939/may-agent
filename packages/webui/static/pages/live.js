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

function metricBreached(metric) {
  if (!metric) return false;
  if (metric.alertOpen) return true;
  if (metric.alertsDisabled) return false;
  if ('thresholdBreached' in metric) return !!metric.thresholdBreached;
  if (metric.breached) return true;
  if (metric.threshold == null || metric.current == null) return false;
  const value = Number(metric.current), limit = Number(metric.threshold);
  switch (metric.alert_op) {
    case '>':
    case 'above': return value > limit;
    case '>=': return value >= limit;
    case '<=': return value <= limit;
    default: return value < limit;
  }
}

// Healthy side of the declared breach rule, including strict boundary labels.
function metricHealthyOperator(metric) {
  if (metric.alert_op === '>=') return '<';
  if (metric.alert_op === '<=') return '>';
  return metric.alert_op === '>' || metric.alert_op === 'above' ? '≤' : '≥';
}

function metricPriorityRank(priority) {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 })[priority] ?? 4;
}

function normalizeProjectMetricKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^projects\//, '')
    .replace(/\/project\.(md|json)$/i, '')
    .replace(/\.app$/, '');
}

function metricBelongsToProject(metric, project) {
  const metricProject = normalizeProjectMetricKey(metric.project);
  const name = normalizeProjectMetricKey(project.name);
  const path = normalizeProjectMetricKey(project.path);
  const routeId = normalizeProjectMetricKey(projectIdOf(project));
  const keys = new Set([
    name,
    path,
    routeId,
    name.replace(/\.app$/, ''),
    path.replace(/\.app$/, ''),
    routeId.replace(/\.app$/, ''),
  ]);
  if (metricProject && keys.has(metricProject)) return true;

  const baseName = name.replace(/\.app$/, '');
  return !!baseName && String(metric.id || '').toLowerCase().startsWith(baseName + '.');
}

function shortMetricLabel(metric, project) {
  const projectBase = normalizeProjectMetricKey(project.name).replace(/\.app$/, '');
  const id = String(metric.id || '');
  if (projectBase && id.toLowerCase().startsWith(projectBase + '.')) {
    return id.slice(projectBase.length + 1);
  }
  return id.split('.').slice(-2).join('.');
}

function scheduleLivenessRefresh() {
  if (typeof currentTab !== 'undefined' && currentTab !== 'live') return;
  if (livenessRefreshTimer) clearTimeout(livenessRefreshTimer);
  livenessRefreshTimer = setTimeout(() => { loadLiveness(); loadWorkflowOverview(); loadOverviewTasks(); }, 500);
}

async function loadLiveness() {
  if (typeof currentTab !== 'undefined' && currentTab !== 'live') return;
  const panel = document.getElementById('liveness-panel');
  if (!panel) return;
  try {
    const res = await fetch('/api/liveness?hours=' + encodeURIComponent(livenessHours));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Liveness read failed');
    const summary = data.summary || {};
    const agents = data.agents || [];
    // Window the backend actually used (it clamps 1..72). Fall back to
    // local livenessHours if absent (older builds).
    const windowHours = Number(summary.windowHours) || livenessHours;
    const since = Number(summary.windowSince) || (Date.now() - windowHours * 60 * 60 * 1000);
    const span = Date.now() - since;
    const alerts = data.alerts || [];
    const visibleAlerts = alerts.slice(0, 4);
    const vitals = data.vitals || [];
    const decisions = data.recentDecisions || [];
    const messages = data.messages || [];
    const windowLabel = windowHours === 1 ? '1h'
      : windowHours === 24 ? '1 day'
      : windowHours === 48 ? '2 days'
      : windowHours + 'h';

    let html = `<h2>
      <span>System liveness</span>
      <span class="subtle">${summary.heartbeatAgents4h || 0} agents had heartbeat activity in ${esc(windowLabel)} · ${summary.activeSessions || 0} active</span>
      <span class="breach-badge ${(summary.openAlerts || 0) > 0 ? 'alerting' : ''}" onclick="routeTo('/metrics')" title="Alert state is not overall health">${summary.openAlertsTruncated ? 'More than ' + summary.openAlerts + ' open alerts' : (summary.openAlerts || 0) > 0 ? summary.openAlerts + ' open alerts' : 'No open alerts'}${summary.openAlertsTruncated || summary.openAlerts > visibleAlerts.length ? ' · showing newest ' + visibleAlerts.length : ''}</span>
    </h2>`;
    html += '<div id="liveness-measurement-problems" class="liveness-section">Loading measurement coverage…</div>';

    if (vitals.length > 0) {
      html += `<div class="liveness-section"><h3>Host observations</h3>`;
      html += `<div class="vitals-grid">`;
      for (const metric of vitals) {
        const alerting = metricBreached(metric);
        const value = formatMetricValue(metric.current, metric.unit);
        const threshold = metric.alertsDisabled ? 'Alerts disabled' : metric.threshold == null ? 'no threshold' : `${metricHealthyOperator(metric)} ${formatMetricValue(metric.threshold, metric.unit)}`;
        html += `<div class="vital-card ${alerting ? 'alerting' : ''}" onclick="routeTo(${jsStringAttr('/metrics/' + encodeURIComponent(metric.id))})" title="${attrEsc(metric.id + ' · owner ' + (metric.owner || 'system:host') + ' · ' + threshold)}">
          <div class="vital-top"><span class="vital-label">${esc(metric.name || metric.id)}</span><span class="vital-owner">${esc(metric.owner || 'system:host')}</span></div>
          <div class="vital-value">${esc(value)}</div>
          <div class="vital-sub">${esc(threshold)}</div><div class="health-note">${esc(metricObservationLabel(metric))}${metric.alertOpen === null ? ' · alert list limited; open metric detail' : ''}</div>
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
    html += `<div class="liveness-section" style="margin:8px 0 12px"><h3 style="font-size:11px;color:var(--fg2);margin:0 0 6px;display:flex;align-items:center;gap:8px">Talk to an agent <a href="/agents" style="color:var(--accent);text-decoration:none;font-size:10px">see all →</a></h3><div class="agent-contact-strip" style="display:flex;flex-wrap:wrap;gap:4px">`;
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
    if (summary.activityRowsTruncated) {
      html += `<div class="note" style="margin:4px 0 8px;color:var(--yellow)">Showing the newest ${summary.activityRows || summary.rowLimit || 2000} sessions in this window.</div>`;
    }

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
        html += `</div><div class="heartbeat-last" title="Last historical heartbeat">${formatAgo(agent.lastHeartbeat)}</div></div>`;
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
      for (const alert of visibleAlerts) {
        const resolveBtn = alert.alertId
          ? `<button title="Resolve" onclick="verbResolveAlert(${Number(alert.alertId)}, event)" style="background:none;border:1px solid var(--border);color:var(--fg2);border-radius:3px;padding:1px 6px;font-size:11px;cursor:pointer;float:right">resolve</button>`
          : '';
        html += `<div class="liveness-item liveness-alert">
          <div class="meta">${formatAgo(alert.createdAt)} · <strong>${esc(alert.metricId)}</strong> · ${esc(alert.priority || 'P2')} ${resolveBtn}</div>
          <div>${esc(alert.message || '')}</div>
          ${renderAlertJudgment(alert)}
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

    // — Projects panel (design's screen-1 fifth panel) — sorted by metric risk, then activity —
    html += `<div class="liveness-section" style="margin-top:16px"><h3>Project metric health</h3><div class="liveness-list" id="liveness-projects">Loading…</div></div>`;

    panel.innerHTML = html;
    void renderLivenessProjects();
  } catch (e) {
    panel.innerHTML = `<h2>System liveness</h2><div class="liveness-item">Failed to load liveness: ${esc(e.message || String(e))}</div>`;
  }
}

// Renders the project metric health strip on the dashboard.
// The front page should answer whether each active project is still moving,
// not just whether the runtime is alive.
async function renderLivenessProjects() {
  const el = document.getElementById('liveness-projects');
  const coverage = document.getElementById('liveness-measurement-problems');
  if (!el) return;
  try {
    const [projectsRes, metricsRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/metrics'),
    ]);
    const all = await projectsRes.json();
    const metricData = await metricsRes.json();
    if (!projectsRes.ok || !metricsRes.ok) throw new Error('Project or metric read unavailable');
    if (!Array.isArray(all)) { el.innerHTML = ''; return; }
    const allMetrics = Array.isArray(metricData.metrics) ? metricData.metrics : [];
    const metricsIncomplete = metricData.truncated === true;
    const problems = allMetrics.filter(m => m.freshness !== 'fresh' || m.collectionFailure?.afterLastSample);
    if (coverage) coverage.innerHTML = `<h3>Measurement coverage</h3><p class="health-note">${problems.length} missing, stale or uncertain observations among ${allMetrics.length} definitions${metricData.truncated ? ' (list limited)' : ''}. No alerts is not proof of health.</p>
      ${problems.slice(0, 5).map(m => `<div class="health-note"><a href="/metrics/${encodeURIComponent(m.id)}">${esc(m.name || m.id)}</a> · ${esc(metricObservationLabel(m))}${m.collectionFailure?.afterLastSample ? ' · ' + esc(m.collectionFailure.reason) : ''}</div>`).join('')}
      ${problems.length > 5 ? '<a href="/metrics">Inspect all measurements</a>' : ''}`;
    const TERMINAL = new Set(['done', 'complete', 'closed']);
    const active = all.filter(p => !TERMINAL.has(p.status));
    const enriched = active.map((project) => {
      const metrics = allMetrics
        .filter((metric) => metricBelongsToProject(metric, project))
        .sort((a, b) => {
          const aa = metricBreached(a) ? 0 : 1;
          const bb = metricBreached(b) ? 0 : 1;
          return aa - bb || metricPriorityRank(a.priority) - metricPriorityRank(b.priority) || String(a.id).localeCompare(String(b.id));
        });
      const alertCount = metrics.filter(metricBreached).length;
      const topPriority = metrics.reduce((rank, metric) => Math.min(rank, metricPriorityRank(metric.priority)), 9);
      return { project, metrics, alertCount, topPriority };
    });
    enriched.sort((a, b) =>
      b.alertCount - a.alertCount ||
      a.topPriority - b.topPriority ||
      (b.project.updatedAt || 0) - (a.project.updatedAt || 0)
    );
    if (enriched.length === 0) { el.innerHTML = `<div class="liveness-item">No active projects.</div>`; return; }
    const now = Date.now();
    let html = '';
    for (const item of enriched.slice(0, 8)) {
      const p = item.project;
      const age = now - (p.updatedAt || 0);
      const pulse = age < 3600_000 ? '●' : age < 86_400_000 ? '◐' : '○';
      const pulseColor = age < 3600_000 ? 'var(--green,#3fb950)' : age < 86_400_000 ? 'var(--yellow,#d29922)' : 'var(--fg2)';
      const owner = p.owner && p.owner !== 'unknown' ? p.owner : '';
      const routeId = projectIdOf(p);
      const statusTone = p.status === 'blocked' ? 'var(--red)' : p.status === 'waiting' || p.status === 'paused' ? 'var(--yellow)' : 'var(--fg2)';
      const metricChips = item.metrics.slice(0, 5).map((metric) => {
        const breached = metricBreached(metric);
        const value = formatMetricValue(metric.current, metric.unit);
        const label = shortMetricLabel(metric, p);
        const thresholdLabel = metric.threshold == null ? '' : `${metricHealthyOperator(metric)} ${formatMetricValue(metric.threshold, metric.unit)}`;
        return `<button class="project-metric-chip ${breached ? 'alerting' : ''}" onclick="event.stopPropagation(); routeTo(${jsStringAttr('/metrics/' + encodeURIComponent(metric.id))})" title="${attrEsc(metric.id + (thresholdLabel ? ' · ' + thresholdLabel : ''))}">
          <span class="project-metric-label">${esc(label)}</span>
          <b>${esc(value)}</b><span>${esc(metric.freshness || 'unknown')}</span>
        </button>`;
      }).join('');
      const moreCount = Math.max(0, item.metrics.length - 5);
      const alertLabel = item.alertCount > 0
        ? `<span class="project-health-alert">${item.alertCount} alert${item.alertCount === 1 ? '' : 's'}${metricsIncomplete ? ' shown' : ''}</span>`
        : metricsIncomplete
          ? `<span class="project-health-muted">${item.metrics.length} metrics shown · overall metric health unknown</span>`
          : item.metrics.length > 0
            ? `<span class="project-health-muted">${item.metrics.filter(m => m.freshness !== 'fresh' || m.collectionFailure?.afterLastSample).length} missing/stale/uncertain measurements · no threshold breaches</span>`
            : `<span class="project-health-muted">no project metrics</span>`;

      html += `<div class="liveness-item project-health-item" onclick="routeTo(${jsStringAttr('/projects/' + encodeURIComponent(routeId))})">
        <div class="project-health-main">
          <span style="color:${pulseColor};font-size:14px" title="${formatAgo(p.updatedAt)}">${pulse}</span>
          <span class="project-health-title"><strong>${esc(p.name)}</strong>${owner ? ` <span class="meta">${esc(owner)}</span>` : ''}</span>
          <span class="project-health-status" style="color:${statusTone}">${esc(p.status || 'unknown')}</span>
          <span class="meta" style="font-size:11px">${formatAgo(p.updatedAt)}</span>
          ${alertLabel}
        </div>
        ${metricsIncomplete ? '<p class="health-warning">Partial metric data: other metrics may be missing.</p>' : ''}
        <div class="project-health-metrics">${metricChips || `<span class="meta">${metricsIncomplete ? 'No matching definitions in this partial list.' : 'No registered project metrics yet.'}</span>`}${moreCount ? `<span class="project-health-muted">+${moreCount}${metricsIncomplete ? ' shown' : ''}</span>` : ''}</div>
      </div>`;
    }
    el.innerHTML = html;
  } catch (e) {
    if (coverage) coverage.innerHTML = '<p class="health-warning">Measurement coverage unavailable. Open Metrics to inspect the read failure.</p>';
    el.innerHTML = `<div class="liveness-item">Failed to load projects: ${esc(e.message || String(e))}</div>`;
  }
}
