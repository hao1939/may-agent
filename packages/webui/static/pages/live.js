// ── Liveness & Unified Activity Timeline View ───────────────────────

let livenessRefreshTimer = null;

// Unified activity-timeline kind filter. All kinds enabled by default.
// 'error' is an overlay: when off, status=error items are hidden
// regardless of base kind; when on, failed/error runs render in high-contrast red.
const TIMELINE_CATEGORIES = ['agent', 'codex', 'workflow', 'chat', 'human', 'heartbeat', 'other', 'error'];
const TIMELINE_CATEGORY_LABELS = {
  agent: 'agent turn',
  codex: 'codex / cli',
  workflow: 'workflow',
  chat: 'chat',
  human: 'human ◆',
  heartbeat: 'heartbeat',
  other: 'other',
  error: 'error (any)',
};
const TIMELINE_CATEGORY_COLORS = {
  agent: 'var(--purple)',
  codex: '#39c5cf',
  workflow: 'var(--yellow)',
  chat: 'var(--accent)',
  human: 'var(--green)',
  heartbeat: '#2ea043',
  other: 'var(--fg2)',
  error: 'var(--red)',
};
const TIMELINE_CATEGORY_FILTER = new Set(TIMELINE_CATEGORIES);

// Activity-timeline window in hours & swimlane grouping ('app' | 'agent').
const TIMELINE_WINDOW_OPTIONS = [4, 8, 12, 24, 48];
let livenessHours = 4;
let timelineGroupBy = 'app';

function toggleTimelineCategory(cat) {
  if (TIMELINE_CATEGORY_FILTER.has(cat)) {
    TIMELINE_CATEGORY_FILTER.delete(cat);
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

function setTimelineGroupBy(mode) {
  if (timelineGroupBy === mode) return;
  timelineGroupBy = mode;
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
  livenessRefreshTimer = setTimeout(() => {
    if (typeof loadTopDownOverview === 'function') loadTopDownOverview();
    loadLiveness();
    loadWorkflowOverview();
    loadOverviewTasks();
  }, 500);
}

function formatClockShort(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

function renderTimelineRuler(since, now, windowHours) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(frac => {
    const ts = Math.round(since + (now - since) * frac);
    const hoursBack = windowHours * (1 - frac);
    const rel = frac === 1 ? 'now' : `-${Number.isInteger(hoursBack) ? hoursBack : hoursBack.toFixed(1)}h`;
    const clock = formatClockShort(ts);
    return `<span class="timeline-tick" style="left:${frac * 100}%">${esc(rel)}${clock ? ` · ${esc(clock)}` : ''}</span>`;
  }).join('');
  return `<div class="heartbeat-row timeline-ruler-row" aria-hidden="true">
    <div class="heartbeat-agent"></div>
    <div class="timeline-ruler">${ticks}</div>
    <div class="heartbeat-last"></div>
  </div>`;
}

function renderTimelineAlertRail(alertEvents, since, now, span) {
  if (!Array.isArray(alertEvents) || !alertEvents.length) return '';
  const pins = [];
  for (const ev of alertEvents) {
    const href = `/metrics/${encodeURIComponent(ev.metricId)}`;
    if (ev.createdAt && ev.createdAt >= since && ev.createdAt <= now) {
      const left = Math.max(0.5, Math.min(99.2, ((ev.createdAt - since) / span) * 100));
      const p1 = ev.priority === 'P0' || ev.priority === 'P1';
      pins.push(`<a class="timeline-pin alert-breach ${p1 ? 'p1' : ''}" href="${attrEsc(href)}" style="left:${left.toFixed(2)}%" title="${attrEsc(`Alert opened · ${ev.name} (${ev.priority}) · ${formatAgo(ev.createdAt)}`)}">▲</a>`);
    }
    if (ev.resolvedAt && ev.resolvedAt >= since && ev.resolvedAt <= now) {
      const left = Math.max(0.5, Math.min(99.2, ((ev.resolvedAt - since) / span) * 100));
      pins.push(`<a class="timeline-pin alert-resolved" href="${attrEsc(href)}" style="left:${left.toFixed(2)}%" title="${attrEsc(`Alert resolved · ${ev.name} · ${formatAgo(ev.resolvedAt)}`)}">✓</a>`);
    }
  }
  if (!pins.length) return '';
  return `<div class="heartbeat-row timeline-alert-rail">
    <div class="heartbeat-agent"><a href="/metrics" class="lane-link">Alerts</a><span class="lane-count-pill warn">${pins.length}</span></div>
    <div class="heartbeat-track">${pins.join('')}</div>
    <div class="heartbeat-last">events</div>
  </div>`;
}

function renderSwimlaneRow(lane, since, now, span, filter, showError) {
  const items = Array.isArray(lane.items) ? lane.items : [];
  const visibleItems = items.filter(item => {
    const k = item.kind || 'other';
    if (item.status === 'error') return showError && filter.has(k);
    return filter.has(k);
  });

  const barsHtml = visibleItems.map(item => {
    const startClamped = Math.max(since, item.startedAt || since);
    const endRaw = item.status === 'running' ? now : (item.endedAt || item.startedAt || startClamped);
    const endClamped = Math.max(startClamped, Math.min(now, endRaw));
    const left = Math.max(0, Math.min(99.2, ((startClamped - since) / span) * 100));
    const durMs = Math.max(0, endRaw - (item.startedAt || startClamped));
    const durLabel = durMs >= 1000 ? formatAgeCompact(durMs) : '<1s';
    const tip = [
      lane.label,
      item.agent && item.agent !== lane.label ? item.agent : '',
      item.label || item.kind,
      item.detail || '',
      item.status || '',
      item.isPin ? '' : durLabel,
      formatAgo(item.startedAt),
    ].filter(Boolean).join(' · ');

    if (item.isPin) {
      return `<a class="timeline-pin kind-${esc(item.kind || 'human')}" href="${attrEsc(item.href || '/projects')}" style="left:${left.toFixed(2)}%" title="${attrEsc(tip)}">◆</a>`;
    }

    const width = Math.max(0.45, Math.min(100 - left, ((endClamped - startClamped) / span) * 100));
    const errCls = item.status === 'error' ? ' error' : '';
    const runCls = item.status === 'running' ? ' running' : '';
    const convCls = item.status === 'converged' ? ' converged' : '';
    const style = `left:${left.toFixed(2)}%;width:${width.toFixed(2)}%`;

    if (item.sessionId) {
      return `<span class="heartbeat-dot timeline-bar kind-${esc(item.kind || 'agent')} cat-${esc(item.legacyCategory || 'other')}${errCls}${runCls}${convCls}" style="${style}" title="${attrEsc(tip)}" onclick="navigateToSession(${jsStringAttr(item.sessionId)})"></span>`;
    }
    return `<a class="timeline-bar kind-${esc(item.kind || 'workflow')}${errCls}${runCls}${convCls}" href="${attrEsc(item.href || '/projects')}" style="${style}" title="${attrEsc(tip)}"></a>`;
  }).join('');

  const subHtml = lane.sublabel ? `<span class="lane-sublabel">${esc(lane.sublabel)}</span>` : '';
  const countBadge = lane.totalCount > 0
    ? `<span class="lane-count-pill ${lane.errorCount > 0 ? 'err' : ''}">${visibleItems.length}</span>`
    : '';
  const labelHtml = lane.href
    ? `<a class="lane-link" href="${attrEsc(lane.href)}">${esc(lane.label)}</a>`
    : `<span>${esc(lane.label)}</span>`;
  const rightHtml = lane.runningCount > 0
    ? `<span class="timeline-running-pill">● ${lane.runningCount} active</span>`
    : esc(formatAgo(lane.lastActivityAt));

  return `<div class="heartbeat-row ${lane.totalCount === 0 ? 'idle-lane' : ''}">
    <div class="heartbeat-agent" title="${attrEsc(`${lane.label}${lane.sublabel ? ' (' + lane.sublabel + ')' : ''} · ${lane.totalCount} items`)}">
      <span class="lane-title-wrap">${labelHtml}${subHtml}</span>${countBadge}
    </div>
    <div class="heartbeat-track">${barsHtml}</div>
    <div class="heartbeat-last">${rightHtml}</div>
  </div>`;
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
    const timeline = data.timeline || null;
    const windowHours = Number(summary.windowHours) || livenessHours;
    const now = Number(summary.windowEnd) || Date.now();
    const since = Number(summary.windowSince) || (now - windowHours * 60 * 60 * 1000);
    const span = Math.max(1, now - since);
    const alerts = data.alerts || [];
    const visibleAlerts = alerts.slice(0, 4);
    const windowLabel = windowHours === 1 ? '1h'
      : windowHours === 24 ? '1 day'
      : windowHours === 48 ? '2 days'
      : windowHours + 'h';

    const activeRunning = summary.activeRunning ?? summary.activeSessions ?? 0;
    const activeSummaryLabel = summary.activeAppsInWindow != null
      ? `${summary.activeAppsInWindow} Apps · ${summary.activeAgentsInWindow || 0} agents active in ${windowLabel} · ${activeRunning} running`
      : `${summary.activeAgentsInWindow || 0} agents active in ${windowLabel} · ${activeRunning} active`;

    const badgeText = summary.openAlertsTruncated
      ? 'More than ' + summary.openAlerts + ' open alerts'
      : (summary.openAlerts || 0) > 0
        ? summary.openAlerts + ' open alerts'
        : 'No open alerts';
    const badgeSuffix = summary.openAlertsTruncated || summary.openAlerts > visibleAlerts.length
      ? ' · showing newest ' + visibleAlerts.length
      : '';

    let html = `<div class="liveness-top-bar">
      <div class="liveness-title-group">
        <h2>Live Activity &amp; Pulse</h2>
        <span class="subtle">${esc(activeSummaryLabel)}</span>
      </div>
      <a class="breach-badge ${(summary.openAlerts || 0) > 0 ? 'alerting' : 'healthy'}" href="/metrics" title="Alert state is not overall health">${esc(badgeText + badgeSuffix)}</a>
    </div>`;

    // Unified Open Alerts Strip (only expanded when open alerts exist; merges Scope/Owner/Status + resolve action).
    if (visibleAlerts.length > 0) {
      html += `<div class="liveness-section" style="margin:0 0 12px" data-active-alerts><div class="liveness-list">`;
      for (const alert of visibleAlerts) {
        const scopeLabel = alert.scope?.kind === 'app' ? `App: ${alert.scope.appId}` : 'Host';
        const scopeClass = alert.scope?.kind === 'app' ? 'app' : 'host';
        const ownerLabel = alert.declaredOwner || alert.owner || 'system:host';
        const declText = alert.declaredHandler
          ? `Owner: ${ownerLabel} · Handler: ${alert.declaredHandler}`
          : `Owner: ${ownerLabel}`;
        const statusText = alert.handlingStatus || 'No recorded handling';
        const taskLink = alert.linkedTask
          ? ` · <a href="/projects/${encodeURIComponent(alert.linkedTask.appId + '.app')}/tasks?appId=${encodeURIComponent(alert.linkedTask.appId)}&task=${encodeURIComponent(alert.linkedTask.taskId)}">Task <code>${esc(alert.linkedTask.taskId)}</code></a>`
          : '';
        const resolveBtn = alert.alertId
          ? `<button title="Resolve alert" onclick="verbResolveAlert(${Number(alert.alertId)}, event)" class="alert-resolve-btn">resolve</button>`
          : '';
        html += `<div class="liveness-item liveness-alert ${(alert.priority === 'P0' || alert.priority === 'P1') ? 'p1' : ''}">
          <div class="liveness-alert-head">
            <div class="td-alert-main">
              <span class="td-scope-tag ${scopeClass}">${esc(scopeLabel)} · ${esc(declText)}</span>
              <a href="/metrics/${encodeURIComponent(alert.metricId)}"><strong>${esc(alert.name || alert.metricId)}</strong></a>
              <span class="meta">· ${esc(alert.priority || 'P2')} · ${esc(formatAgo(alert.createdAt))}</span>
            </div>
            <div class="td-alert-status">
              <span class="td-alert-handler">${esc(statusText)}</span>${taskLink}
              ${resolveBtn}
            </div>
          </div>
          <div class="health-note" style="margin-top:3px">${esc(alert.message || '')}</div>
          ${renderAlertJudgment(alert)}
        </div>`;
      }
      html += `</div></div>`;
    }

    // Compact Agent quick-chat strip.
    const agentLanesByName = new Map((timeline?.agentLanes || []).map(l => [l.id, l]));
    html += `<div class="liveness-section agent-strip-row"><span class="agent-strip-label">Talk to agent:</span><div class="agent-contact-strip">`;
    for (const agent of agents) {
      const agLane = agentLanesByName.get(agent.name);
      const lastTs = agLane?.lastActivityAt ?? agent.lastSessionAt ?? null;
      const runningNow = (agLane?.runningCount || 0) > 0;
      const hasErr = (agLane?.errorCount || 0) > 0 || agent.lastStatus === 'error';
      const stale = !runningNow && (lastTs == null || (now - lastTs) > windowHours * 3600 * 1000);
      const dotColor = hasErr ? 'var(--red)' : runningNow ? '#39c5cf' : stale ? 'var(--fg2)' : 'var(--green)';
      const ageLabel = runningNow ? 'running now' : lastTs == null ? 'idle' : formatAgo(lastTs);
      html += `<button type="button" class="agent-tile ${stale ? 'stale' : ''}" onclick="routeTo('/agents/${esc(agent.name)}')" title="Open ${esc(agent.name)} — ${esc(ageLabel)}">
        <span style="color:${dotColor};font-size:8px">●</span><span>${esc(agent.name)}</span>
      </button>`;
    }
    html += `<a href="/agents" class="agent-strip-more">all agents →</a></div></div>`;

    // Unified Activity Timeline (Task Attempts + Codex CLI + Workflows + Sessions + Human Inputs + Alerts).
    const hasAppLanes = Array.isArray(timeline?.appLanes) && timeline.appLanes.length > 0;
    const effectiveGroup = timelineGroupBy === 'app' && hasAppLanes ? 'app' : 'agent';
    html += `<div class="liveness-section liveness-timeline">
      <div class="timeline-head-bar">
        <h3>Activity timeline · last ${esc(windowLabel)}</h3>
        <div class="timeline-controls">
          ${hasAppLanes ? `<span class="timeline-mode-switch" role="group" aria-label="Group timeline lanes">
            <button type="button" class="chip ${effectiveGroup === 'app' ? '' : 'off'}" onclick="setTimelineGroupBy('app')">By App</button>
            <button type="button" class="chip ${effectiveGroup === 'agent' ? '' : 'off'}" onclick="setTimelineGroupBy('agent')">By Agent</button>
          </span>` : ''}
          <span class="heartbeat-legend" style="margin:0">
            ${TIMELINE_WINDOW_OPTIONS.map(h => {
              const on = h === windowHours;
              const lbl = h === 24 ? '1d' : h === 48 ? '2d' : h + 'h';
              return `<button type="button" class="chip${on ? '' : ' off'}" onclick="setTimelineHours(${h})" title="Show last ${esc(lbl)}" style="padding:1px 7px;font-size:10px">${esc(lbl)}</button>`;
            }).join('')}
          </span>
        </div>
      </div>`;

    html += `<div class="heartbeat-legend">`;
    for (const cat of TIMELINE_CATEGORIES) {
      const on = TIMELINE_CATEGORY_FILTER.has(cat);
      const label = TIMELINE_CATEGORY_LABELS[cat] || cat;
      html += `<span class="chip${on ? '' : ' off'}" onclick="toggleTimelineCategory('${cat}')" title="Click to ${on ? 'hide' : 'show'} ${esc(label)}"><span class="swatch" style="background:${TIMELINE_CATEGORY_COLORS[cat]}"></span>${esc(label)}</span>`;
    }
    html += `<span class="note">bar width = duration · glow = running · green tip = converged</span></div>`;

    if (summary.activityRowsTruncated) {
      html += `<div class="note" style="margin:4px 0 8px;color:var(--yellow)">Showing the newest ${summary.activityRows || summary.rowLimit || 2000} items in this window.</div>`;
    }

    const filter = TIMELINE_CATEGORY_FILTER;
    const showError = filter.has('error');

    // Fallback if older response has no `timeline` object.
    const rawLanes = timeline
      ? (effectiveGroup === 'app' ? timeline.appLanes : timeline.agentLanes)
      : agents.map(a => ({
          id: a.name,
          label: a.name,
          sublabel: null,
          href: '/agents/' + encodeURIComponent(a.name),
          runningCount: (a.sessions || []).filter(s => s.status === 'running').length,
          errorCount: (a.sessions || []).filter(s => s.status === 'error').length,
          totalCount: (a.sessions || []).length,
          lastActivityAt: a.lastSessionAt,
          items: (a.sessions || []).map(s => ({
            kind: s.category === 'project' ? 'agent' : (s.category || 'other'),
            legacyCategory: s.category || 'other',
            status: s.status === 'error' ? 'error' : s.status === 'running' ? 'running' : 'done',
            sessionId: s.sessionId,
            href: '/sessions/' + encodeURIComponent(s.sessionId),
            label: s.source || s.category || 'session',
            startedAt: s.startedAt,
            endedAt: s.endedAt,
          })),
        }));

    if (!rawLanes || !rawLanes.length) {
      html += `<div class="liveness-item">No configured Apps or agents found.</div>`;
    } else {
      html += renderTimelineRuler(since, now, windowHours);
      html += renderTimelineAlertRail(timeline?.alertEvents || [], since, now, span);

      const activeLanes = rawLanes.filter(l => l.totalCount > 0 || l.runningCount > 0);
      const idleLanes = rawLanes.filter(l => l.totalCount === 0 && l.runningCount === 0);
      const foldIdle = activeLanes.length > 0 && (effectiveGroup === 'agent' ? idleLanes.length > 0 : idleLanes.length > 2);

      const primaryLanes = foldIdle ? activeLanes : rawLanes;
      for (const lane of primaryLanes) {
        html += renderSwimlaneRow(lane, since, now, span, filter, showError);
      }
      if (foldIdle && idleLanes.length > 0) {
        html += `<details class="idle-lanes-drawer">
          <summary>Show ${idleLanes.length} idle ${effectiveGroup === 'app' ? 'Apps' : 'agents'} (0 activity in ${esc(windowLabel)})</summary>
          <div style="margin-top:6px">${idleLanes.map(lane => renderSwimlaneRow(lane, since, now, span, filter, showError)).join('')}</div>
        </details>`;
      }
    }
    html += `</div>`;

    // Collapsible Diagnostics Drawer (houses measurement coverage & project metric matrix without duplicating App cards).
    html += `<details class="liveness-diagnostics" id="liveness-diagnostics">
      <summary id="liveness-diagnostics-summary">Diagnostics · Measurement coverage &amp; project metric matrix</summary>
      <div class="liveness-diagnostics-body">
        <div id="liveness-measurement-problems" class="liveness-section">Loading measurement coverage…</div>
        <div class="liveness-section" style="margin-top:12px"><h3>Project metric health</h3><div class="liveness-list" id="liveness-projects">Loading…</div></div>
      </div>
    </details>`;

    panel.innerHTML = html;
    void renderLivenessProjects();
  } catch (e) {
    panel.innerHTML = `<h2>Live Activity &amp; Pulse</h2><div class="liveness-item">Failed to load liveness: ${esc(e.message || String(e))}</div>`;
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
    const diagSummary = document.getElementById('liveness-diagnostics-summary');
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
    if (diagSummary) {
      const projBreaches = enriched.reduce((sum, item) => sum + item.alertCount, 0);
      diagSummary.textContent = `Diagnostics · ${allMetrics.length} metrics (${problems.length} stale/missing) · ${enriched.length} projects${projBreaches ? ' (' + projBreaches + ' breached)' : ''}`;
    }
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
