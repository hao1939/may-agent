// SQLite-backed observations. No browser-owned metric formulas or health score.
let metricsLoadGeneration = 0;
let overviewLoadGeneration = 0;
let overviewTasksGeneration = 0;
let topDownOverviewGeneration = 0;
let topDownDays = 1;
const WORKFLOW_OUTCOMES = ['done', 'error', 'blocked', 'interrupted'];

function formatAgeCompact(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60000) return Math.round(ms / 1000) + 's';
  if (ms < 3600000) return Math.round(ms / 60000) + 'm';
  if (ms < 86400000) return (ms / 3600000).toFixed(1).replace(/\.0$/, '') + 'h';
  return (ms / 86400000).toFixed(1).replace(/\.0$/, '') + 'd';
}

function formatBytesGiB(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function renderScorePill(scorecard) {
  if (!scorecard || scorecard.status === 'not_scored') {
    return `<span class="td-score-pill" title="No milestone cohorts scored in this window">Unscored</span>`;
  }
  if (scorecard.status === 'incomplete' || scorecard.score === null) {
    return `<span class="td-score-pill warn" title="Missing evidence on one or more required dimensions">Incomplete · n=${esc(String(scorecard.sampleSize || 0))}</span>`;
  }
  const conf = scorecard.confidence === 'low-sample' ? ` · low-sample (n=${scorecard.sampleSize})` : ` · n=${scorecard.sampleSize}`;
  if (scorecard.gated) {
    return `<span class="td-score-pill gated" title="${attrEsc(scorecard.gateReason || 'Gated by correctness/safety')}">Gated ${esc(scorecard.score.toFixed(1))}${esc(conf)}</span>`;
  }
  const cls = scorecard.score >= 75 ? 'good' : 'warn';
  return `<span class="td-score-pill ${cls}">${esc(scorecard.score.toFixed(1))}/100${esc(conf)}</span>`;
}

function setTopDownDays(days, onMetricsTab) {
  topDownDays = days;
  if (onMetricsTab) {
    const q = new URLSearchParams(location.search);
    q.set('days', String(days));
    q.delete('start');
    q.delete('end');
    routeTo('/metrics?' + q.toString());
  } else {
    void loadTopDownOverview();
  }
}

function renderAppDrillDown(detail, days) {
  if (!detail) return '';
  const tasks = detail.tasks || [];
  const agents = detail.agents || [];
  const workflows = detail.workflows || [];
  const appId = detail.appId;

  const tasksTable = tasks.length
    ? `<div class="health-scroll"><table class="health-table"><thead><tr><th>Task</th><th>Status</th><th>Agent</th><th>Window outcomes</th><th>Scorecard</th></tr></thead><tbody>
        ${tasks.map(t => {
          const href = `/projects/${encodeURIComponent(appId + '.app')}/tasks?appId=${encodeURIComponent(appId)}&task=${encodeURIComponent(t.taskId)}`;
          return `<tr>
            <td><a href="${attrEsc(href)}"><code>${esc(t.taskId)}</code></a>${t.goal && t.goal !== t.taskId ? `<div class="health-note">${esc(t.goal)}</div>` : ''}</td>
            <td><span class="badge ${t.status === 'running' ? 'running' : t.status === 'attention' ? 'error' : t.status === 'closed' || t.status === 'idle' ? 'done' : 'interrupted'}">${esc(t.status)}</span></td>
            <td>${t.agent ? `<a href="/agents/${encodeURIComponent(t.agent)}">${esc(t.agent)}</a>` : '—'}</td>
            <td>${esc(String(t.convergedWindow || 0))} converged${t.failedWindow ? ` · <span class="td-kv-val warn">${esc(String(t.failedWindow))} failed</span>` : ''}</td>
            <td>${renderScorePill(t.scorecard)}</td>
          </tr>`;
        }).join('')}
      </tbody></table></div>`
    : '<p class="health-note">No active or recent Tasks in this window.</p>';

  const agentsTable = agents.length
    ? `<div class="health-scroll"><table class="health-table"><thead><tr><th>Agent</th><th>Runs / Sessions</th><th>Errors</th><th>Estimated cost</th><th>App-scoped Scorecard</th></tr></thead><tbody>
        ${agents.map(a => `<tr>
          <td><a href="/agents/${encodeURIComponent(a.agent)}"><b>${esc(a.agent)}</b></a></td>
          <td>${esc(String(a.invocationsWindow || 0))} runs · ${esc(String(a.sessionsWindow || 0))} sessions</td>
          <td class="${a.errorsWindow > 0 ? 'td-kv-val warn' : ''}">${esc(String(a.errorsWindow || 0))}</td>
          <td>${a.estimatedCostUsdWindow != null ? '$' + Number(a.estimatedCostUsdWindow).toFixed(4) : '—'}</td>
          <td>${renderScorePill(a.scorecard)}</td>
        </tr>`).join('')}
      </tbody></table></div>`
    : '<p class="health-note">No Agent executions recorded for this App in this window.</p>';

  const workflowsTable = workflows.length
    ? `<div class="health-scroll"><table class="health-table"><thead><tr><th>Workflow</th><th>Finished</th><th>Done</th><th>Error / Blocked</th><th>Mean duration</th></tr></thead><tbody>
        ${workflows.map(w => {
          const wfHref = `/metrics?days=${encodeURIComponent(String(days))}&appId=${encodeURIComponent(appId)}&workflow=${encodeURIComponent(w.workflow)}&runs=true`;
          return `<tr>
            <td><a href="${attrEsc(wfHref)}"><code>${esc(w.workflow)}</code></a></td>
            <td>${esc(String(w.finished || 0))}</td>
            <td>${esc(String(w.done || 0))}</td>
            <td class="${(w.errors || w.blocked) ? 'td-kv-val warn' : ''}">${esc(String(w.errors || 0))} err · ${esc(String(w.blocked || 0))} blocked</td>
            <td>${esc(healthDuration(w.meanDurationMs))}</td>
          </tr>`;
        }).join('')}
      </tbody></table></div>`
    : '<p class="health-note">No top-level Workflow executions recorded for this App in this window.</p>';

  return `<div class="td-drilldown" data-app-drilldown="${attrEsc(appId)}">
    <div class="td-drilldown-head">
      <h3>App Drill-Down: <code>${esc(appId)}</code> (Tasks, Agents &amp; Workflows)</h3>
      <a href="/metrics?days=${encodeURIComponent(String(days))}" class="td-window-btn">← Show all Apps</a>
    </div>
    <div class="td-drilldown-grid">
      <div><h4>1. Contributing Tasks (value &amp; backlog → App)</h4>${tasksTable}</div>
      <div><h4>2. Contributing Agents (capability → App)</h4>${agentsTable}</div>
      <div><h4>3. Deterministic Workflows (code offload → App)</h4>${workflowsTable}</div>
    </div>
  </div>`;
}

function renderTopDownObservability(data, options = {}) {
  const host = data.host || {};
  const plumbing = host.plumbing || {};
  const recovery = host.recovery || {};
  const headroom = host.headroom || {};
  const sensors = headroom.sensors || {};
  const overhead = host.overhead || {};
  const disk = headroom.disk;
  const auth = headroom.auth || { state: 'unknown', expiresAt: null };
  const days = Math.max(1, Math.round(((data.window?.end || 0) - (data.window?.start || 0)) / 86400000)) || 1;
  const windowLabel = days === 1 ? '24h' : days + 'd';
  const onMetricsTab = !!options.detailed;

  const hostAlertsBadge = headroom.openAlerts === null
    ? `<span class="breach-badge alerting" onclick="routeTo('/metrics')">Alerts truncated (${esc(String(headroom.visibleOpenAlerts || 0))}+)</span>`
    : (headroom.openAlerts || 0) > 0
      ? `<span class="breach-badge alerting" onclick="routeTo('/metrics')">${esc(String(headroom.openAlerts))} Host alert${headroom.openAlerts === 1 ? '' : 's'}</span>`
      : `<span class="breach-badge healthy" onclick="routeTo('/metrics')">0 Host alerts</span>`;

  const diskText = disk
    ? `${disk.usedPercent}% used (${formatBytesGiB(disk.availableBytes)} free)`
    : 'Disk unknown';
  const authText = auth.state === 'valid'
    ? `az auth valid (${formatAgeCompact((auth.expiresAt || 0) - data.generatedAt)} left)`
    : auth.state === 'expired'
      ? 'az auth EXPIRED'
      : auth.state === 'unconfigured'
        ? 'az auth unconfigured'
        : 'az auth unknown';

  const rubricLabels = [
    ['outcomeValue', 'Outcome value (35%)'],
    ['correctnessAndEvidence', 'Correctness & proof (25%)'],
    ['autonomyAndRecovery', 'Independence (15%)'],
    ['efficiency', 'Efficiency (15%)'],
    ['humanCoordination', 'Coordination (10%)'],
  ];

  const appsHtml = (data.apps || []).map(app => {
    const o = app.outcomes || {};
    const t = o.tasks || {};
    const b = app.blockers || {};
    const hb = app.humanBurden || {};
    const cl = app.costAndLeverage || {};
    const sc = app.scorecard || { status: 'not_scored' };

    const deliveredParts = [`${o.convergedMilestonesWindow || 0} milestones`];
    if (o.closedTasksWindow) deliveredParts.push(`${o.closedTasksWindow} closed tasks`);
    if (o.closedRequestsWindow) deliveredParts.push(`${o.closedRequestsWindow} asks`);
    const outcomesVal = deliveredParts.join(' · ');
    const backlogVal = `${o.openTasksTotal || 0} active (${t.running || 0} run, ${t.waiting || 0} wait${t.attention ? `, ${t.attention} attn` : ''})`
      + (t.idle ? ` · ${t.idle} idle` : '')
      + (o.openRequests ? ` · ${o.openRequests} asks` : '')
      + (o.oldestOpenAgeMs != null ? ` · oldest ${formatAgeCompact(o.oldestOpenAgeMs)}` : '');

    const blockerCount = (b.failedAttemptsWindow || 0) + (b.errorWorkflowsWindow || 0) + (b.blockedWorkflowsWindow || 0) + (b.openHumanConditions || 0) + (b.visibleOpenAlerts || 0);
    const blockerParts = [];
    if (b.failedAttemptsWindow) blockerParts.push(`${b.failedAttemptsWindow} failed att`);
    if (b.errorWorkflowsWindow) blockerParts.push(`${b.errorWorkflowsWindow} wf err`);
    if (b.blockedWorkflowsWindow) blockerParts.push(`${b.blockedWorkflowsWindow} blocked`);
    if (b.openHumanConditions) blockerParts.push(`${b.openHumanConditions} human wait`);
    if (b.openAlerts === null) blockerParts.push('alerts truncated');
    else if (b.openAlerts > 0) blockerParts.push(`${b.openAlerts} alert${b.openAlerts === 1 ? '' : 's'}`);
    const blockerVal = blockerParts.length ? blockerParts.join(' · ') : 'None observed';

    const offloadPct = cl.workflowOffloadShare != null ? Math.round(cl.workflowOffloadShare * 100) + '% workflow' : '—';
    const costParts = [`${cl.agentInvocationsWindow || 0} agent / ${cl.workflowRunsWindow || 0} wf (${offloadPct})`];
    if (cl.estimatedCostUsdWindow != null) costParts.push('$' + Number(cl.estimatedCostUsdWindow).toFixed(3));

    const taskHref = `/projects/${encodeURIComponent(app.appId + '.app')}/tasks?appId=${encodeURIComponent(app.appId)}`;
    const metricHref = `/metrics?appId=${encodeURIComponent(app.appId)}&days=${encodeURIComponent(String(days))}`;

    const rubricHtml = onMetricsTab && sc.sampleSize > 0
      ? `<div class="td-rubric-bars">${rubricLabels.map(([key, label]) => {
          const d = sc.dimensions?.[key];
          const val = d?.mean != null ? `${d.mean.toFixed(1)}/4` : d?.unknown ? 'unknown' : 'n/a';
          return `<div class="td-rubric-row"><span>${esc(label)}</span><span>${esc(val)}</span></div>`;
        }).join('')}</div>`
      : '';

    return `<div class="td-app-card" data-app-card="${attrEsc(app.appId)}">
      <div class="td-app-head">
        <span class="td-app-name">${esc(app.appId)}</span>
        ${renderScorePill(sc)}
      </div>
      <div class="td-kv-list">
        <div class="td-kv-row"><span class="td-kv-key">Delivered (${esc(windowLabel)})</span><span class="td-kv-val">${esc(outcomesVal)}</span></div>
        <div class="td-kv-row"><span class="td-kv-key">Open backlog</span><span class="td-kv-val">${esc(backlogVal)}</span></div>
        <div class="td-kv-row"><span class="td-kv-key">Blockers &amp; friction</span><span class="td-kv-val ${blockerCount > 0 ? 'warn' : ''}">${esc(blockerVal)}</span></div>
        <div class="td-kv-row"><span class="td-kv-key">Human inputs (${esc(windowLabel)})</span><span class="td-kv-val">${esc(String(hb.humanInputsWindow || 0))}</span></div>
        <div class="td-kv-row"><span class="td-kv-key">Effort &amp; offload</span><span class="td-kv-val">${esc(costParts.join(' · '))}</span></div>
      </div>
      ${rubricHtml}
      <div class="td-app-links">
        <a href="${attrEsc(taskHref)}">Open Tasks →</a>
        <a href="${attrEsc(metricHref)}" data-drilldown-link="${attrEsc(app.appId)}">Drill Down →</a>
      </div>
    </div>`;
  }).join('');

  const plumbingErrs = (plumbing.failedTaskAttemptsWindow || 0) + (plumbing.workflowErrorsWindow || 0) + (plumbing.subscriberFailures1h || 0) + (plumbing.unhandledSignals1h || 0);
  const recoveryIssues = (recovery.unresolvedInputRecoveryCount || 0) + (recovery.expiredLeasesCount || 0);
  const diskWarn = disk && disk.usedPercent >= 90;
  const authBad = auth.state === 'expired';

  return `<div class="td-header">
      <div>
        <h2>Host &amp; Apps · Top-Down Observing &amp; Scoring</h2>
        <p class="health-note" style="margin:2px 0 0">Transparent Host telemetry (${esc(windowLabel)} window). Host protects stable contracts (<code>alex/develop-host-change</code>); Apps iterate on domain outcomes (<code>alex/develop-change</code>).</p>
      </div>
      <div class="td-window-switch">
        ${[1, 7, 30].map(d => `<button type="button" class="td-window-btn ${days === d ? 'active' : ''}" onclick="setTopDownDays(${d}, ${onMetricsTab})">${d === 1 ? '24h' : d + 'd'}</button>`).join('')}
      </div>
    </div>
    <div class="td-host-box" data-host-summary>
      <div class="td-host-head">
        <div class="td-host-title">
          <span>Host Platform (Kernel)</span>
          ${renderScorePill(host.scorecard)}
          ${hostAlertsBadge}
        </div>
        <span class="health-note">Rubric: <code>host-rubric-v1</code> · Conservative &amp; subtractive</span>
      </div>
      <div class="td-pillars">
        <div class="td-pillar">
          <div class="td-pillar-label">1. Plumbing &amp; Execution</div>
          <div class="td-pillar-main ${plumbingErrs > 0 ? 'td-kv-val warn' : ''}" style="text-align:left">${esc(String(plumbing.failedTaskAttemptsWindow || 0))} failed att · ${esc(String(plumbing.workflowErrorsWindow || 0))} wf err</div>
          <div class="td-pillar-sub">Unhandled 1h: ${esc(plumbing.unhandledSignals1h == null ? '—' : String(plumbing.unhandledSignals1h))} · Sub err 1h: ${esc(plumbing.subscriberFailures1h == null ? '—' : String(plumbing.subscriberFailures1h))}</div>
        </div>
        <div class="td-pillar">
          <div class="td-pillar-label">2. Stuck Work &amp; Recovery</div>
          <div class="td-pillar-main ${recoveryIssues > 0 ? 'td-kv-val warn' : ''}" style="text-align:left">${esc(String(recovery.unresolvedInputRecoveryCount || 0))} unresolved · ${esc(String(recovery.expiredLeasesCount || 0))} expired leases</div>
          <div class="td-pillar-sub">Oldest recovery: ${esc(formatAgeCompact(recovery.oldestInputRecoveryAgeMs))} · Failovers (${esc(windowLabel)}): ${esc(String(recovery.taskFailoversWindow || 0))}</div>
        </div>
        <div class="td-pillar">
          <div class="td-pillar-label">3. Environment &amp; Sensors</div>
          <div class="td-pillar-main ${authBad ? 'td-kv-val bad' : diskWarn ? 'td-kv-val warn' : ''}" style="text-align:left">${esc(diskText)}</div>
          <div class="td-pillar-sub">${esc(authText)} · Sensors: ${esc(String(sensors.freshMetrics || 0))}/${esc(String(sensors.activeMetrics || 0))} fresh${sensors.collectionFailuresAfterSample ? ` · ${esc(String(sensors.collectionFailuresAfterSample))} failed` : ''}</div>
        </div>
        <div class="td-pillar">
          <div class="td-pillar-label">4. Platform Overhead</div>
          <div class="td-pillar-main" style="text-align:left">SQL: ${esc(overhead.daemonSqlTimePercent == null ? '—' : overhead.daemonSqlTimePercent + '%')} · Skip: ${esc(overhead.skippedCheckRatePerMin == null ? '—' : Math.round(overhead.skippedCheckRatePerMin) + '/m')}</div>
          <div class="td-pillar-sub">Worst SQL: ${esc(overhead.daemonSqlWorstMs == null ? '—' : Math.round(overhead.daemonSqlWorstMs) + 'ms')} · Metric query: ${esc(overhead.metricQueryWorstMs == null ? '—' : Math.round(overhead.metricQueryWorstMs) + 'ms')}</div>
        </div>
      </div>
    </div>
    <div class="td-apps-grid">${appsHtml || '<p class="health-note">No enabled Apps discovered yet.</p>'}</div>
    ${onMetricsTab && data.appDetail ? renderAppDrillDown(data.appDetail, days) : ''}`;
}

async function loadTopDownOverview() {
  const generation = ++topDownOverviewGeneration;
  const el = document.getElementById('top-down-overview');
  if (!el) return;
  try {
    const data = await readHealthJson('/api/observability?days=' + encodeURIComponent(String(topDownDays)));
    if (generation !== topDownOverviewGeneration || currentTab !== 'live') return;
    el.innerHTML = renderTopDownObservability(data, { detailed: false });
  } catch (error) {
    if (generation === topDownOverviewGeneration) {
      el.innerHTML = `<h2>Host &amp; Apps</h2><p class="health-warning">Unable to read observability summary: ${esc(error.message)}</p>`;
    }
  }
}

async function readHealthJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Read failed (${response.status})`);
  return data;
}

function healthTime(value) {
  return Number.isFinite(value) ? new Date(value).toLocaleString() : 'unknown';
}

function healthDuration(value) {
  if (!Number.isFinite(value)) return 'unknown';
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)} s`;
  return `${(value / 60000).toFixed(1)} min`;
}

function workflowHealthLink(data, changes = {}) {
  const params = new URLSearchParams({ start: data.window.start, end: data.window.end, scope: data.scope, runs: 'true', ...data.identity });
  for (const [key, value] of Object.entries(changes)) {
    if (value !== null) params.set(key, String(value));
  }
  return '/metrics?' + params;
}

function workflowRunLink(id) {
  return '/api/workflow-runs/' + encodeURIComponent(id);
}

function workflowOutcomeCards(data) {
  const t = data.totals;
  return `<div class="health-summary" data-workflow-outcomes>
    <div class="health-card"><div class="health-label">Finished executions</div><div class="health-value">${t.finished}</div><div class="health-sub">${t.successRate === null ? 'No finished executions' : (100 * t.successRate).toFixed(1) + '% successful execution'}</div></div>
    ${WORKFLOW_OUTCOMES.map(status => `<a class="health-card" href="${esc(workflowHealthLink(data, { outcome: status }))}"><div class="health-label">${esc(status)}</div><div class="health-value">${t[status]}</div><div class="health-sub">of ${t.finished} finished</div></a>`).join('')}
  </div>`;
}

function workflowCoverage(data) {
  return `<p class="health-note">${esc(healthTime(data.window.start))} – ${esc(healthTime(data.window.end))} (end excluded).
    ${data.scope === 'top-level' ? 'Top-level runs only; children remain in run facts.' : 'All runs, including children; not independent Task outcomes.'}
    Retained records only; older coverage is not guaranteed. Later settlement or retention can change this selection.</p>
    ${data.totals.unknownOutcomes || data.coverage.undatedFinishedStartedInWindow ? `<p class="health-warning">Coverage gap: ${data.totals.unknownOutcomes} unrecognized outcomes in the window; ${data.coverage.undatedFinishedStartedInWindow} finished runs started in the window without an end time.</p>` : ''}`;
}

function workflowRunTable(data) {
  if (!data.runs.length) return '<p>No matching retained executions.</p>';
  return `<div class="health-scroll"><table class="health-table"><thead><tr><th>Run / workflow</th><th>Outcome</th><th>Finished</th><th>Duration</th><th>Reason (preview)</th></tr></thead><tbody>
    ${data.runs.map(run => `<tr><td><a href="${esc(workflowRunLink(run.runId))}">${esc(run.runId)}</a><div class="health-note">${esc(run.workflow)}</div></td>
    <td>${esc(run.status)}</td><td>${esc(healthTime(run.endedAt))}</td><td>${esc(healthDuration(run.durationMs))}</td><td class="health-text">${esc(run.reason || '—')}</td></tr>`).join('')}
    </tbody></table></div>`;
}

async function loadWorkflowOverview() {
  const generation = ++overviewLoadGeneration;
  const el = document.getElementById('workflow-overview');
  if (!el) return;
  try {
    const data = await readHealthJson('/api/workflow-health');
    if (generation !== overviewLoadGeneration || currentTab !== 'live') return;
    el.innerHTML = `<h2>Workflow execution · last 24 hours</h2>${workflowOutcomeCards(data)}${workflowCoverage(data)}
      <p>${data.running} running now (separate from finished outcomes). <a href="${esc(workflowHealthLink(data))}">Compare workflows and inspect runs</a></p>
      <details><summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--fg2);margin-top:8px">Recent execution runs (${data.runs.length})</summary>${workflowRunTable(data)}</details>`;
  } catch (error) { if (generation === overviewLoadGeneration) el.innerHTML = `<h2>Workflow execution</h2><p class="health-warning">Unable to read execution facts: ${esc(error.message)}</p>`; }
}

async function loadOverviewTasks() {
  const generation = ++overviewTasksGeneration;
  const el = document.getElementById('overview-tasks');
  if (!el) return;
  try {
    const data = await readHealthJson('/api/tasks?allApps=true&status=pending&status=running&status=waiting&status=attention&limit=8');
    if (generation !== overviewTasksGeneration || currentTab !== 'live') return;
    el.innerHTML = `<h3>Current Tasks</h3><p class="health-note">Current work, not workflow outcomes. Showing up to 8 recent Tasks; pending does not necessarily mean eligible to run.</p>
      ${data.items.length ? data.items.map(task => `<div class="health-task">${esc(task.outcome)} · ${esc(task.status)} · ${esc(task.appId)} · ${esc(task.ref)}</div>`).join('') : '<p>No current Tasks in this selection.</p>'}
      <p><a href="/projects">Inspect Tasks in Projects</a>${data.nextCursor ? ' · more Tasks available' : ''}</p>`;
  } catch (error) { if (generation === overviewTasksGeneration) el.innerHTML = `<h3>Current Tasks</h3><p class="health-warning">Task read unavailable: ${esc(error.message)}</p>`; }
}

function metricObservationLabel(metric) {
  const observation = metric.observation;
  let label = observation ? `${metric.freshness} · measured ${healthTime(observation.measuredAt)}` : 'No retained observation';
  if (metric.collectionFailure?.afterLastSample) label += ' · collection failed after last sample';
  return label;
}

function metricRuleLabel(metric) {
  if (metric.alertsDisabled) return 'Alerts disabled';
  if (metric.threshold === null) return 'No threshold rule';
  return `${metric.thresholdBreached === null ? 'Not evaluated' : metric.thresholdBreached ? 'Last value outside threshold' : 'Last value within threshold'} (${metricHealthyOperator(metric)} ${metric.threshold} ${metric.unit || ''})`;
}

function metricScopeTag(metric) {
  const scope = metric.scope;
  if (scope && scope.kind === 'app' && scope.appId) {
    return `<span class="td-scope-tag app">App: ${esc(scope.appId)}</span>`;
  }
  return `<span class="td-scope-tag host">Host</span>`;
}

function renderObservationList(data) {
  const activeScopeFilter = new URLSearchParams(location.search).get('appId') || '';
  return `<h2>Recorded measurements</h2><p class="health-note">${data.metrics.length} definitions${data.truncated ? ' (list limited; use an exact metric link for other definitions)' : ''}. Freshness, collection failure and warning rules are separate facts.</p>
    <div class="health-actions">
      <label>Find a metric <input id="metric-search" type="search" value="${attrEsc(activeScopeFilter)}" placeholder="Name, ID, Host or App" oninput="filterMetricRows(this.value)"></label>
    </div>
    <div class="health-scroll"><table class="health-table"><thead><tr><th>Metric / scope</th><th>Last value</th><th>Observation</th><th>Rule</th></tr></thead><tbody>
    ${data.metrics.map(m => {
      const scopeSearch = m.scope?.kind === 'app' ? `app:${m.scope.appId} ${m.scope.appId}` : 'host';
      const hidden = activeScopeFilter && !(m.scope?.kind === 'app' && m.scope.appId === activeScopeFilter) ? 'hidden' : '';
      return `<tr ${hidden} data-metric-search="${attrEsc([m.name, m.id, m.owner, scopeSearch].join(' ').toLowerCase())}"><td>${metricScopeTag(m)}<a href="/metrics/${encodeURIComponent(m.id)}">${esc(m.name || m.id)}</a><div class="health-note">${esc(m.id)} · ${esc(m.owner || 'unknown owner')} · ${esc(m.type || 'unspecified type')}</div></td>
      <td>${esc(m.observation ? String(m.observation.value) : 'unknown')} ${esc(m.unit || '')}</td><td>${esc(metricObservationLabel(m))}${m.observation?.sampleSize != null ? `<div>Sample size: ${m.observation.sampleSize}</div>` : ''}</td><td>${esc(metricRuleLabel(m))}${m.alertOpen ? ' · open alert' : m.alertOpen === null ? ' · alert list limited; open metric detail' : ''}</td></tr>`;
    }).join('')}
    </tbody></table></div>${data.metrics.length ? '' : '<p>No measurements installed. This is not a healthy verdict.</p>'}`;
}

function filterMetricRows(value) {
  for (const row of document.querySelectorAll('[data-metric-search]')) row.hidden = !row.dataset.metricSearch.includes(value.toLowerCase());
}

function applyWorkflowFilters(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const params = new URLSearchParams(location.search);
  for (const key of ['before', 'beforeId', 'sourcePath', 'sourceScope']) params.delete(key);
  for (const key of ['appId', 'workflow', 'outcome']) {
    const value = form.elements[key].value;
    if (value) params.set(key, value); else params.delete(key);
  }
  params.set('scope', form.elements.scope.value);
  params.set('runs', 'true');
  routeTo('/metrics?' + params);
}

function selectHealthDays(days) { routeTo('/metrics?days=' + days + '&runs=true'); }
function selectMetricDays(id, days) { routeTo('/metrics/' + encodeURIComponent(id) + '?days=' + days); }

function renderWorkflowComparison(data) {
  const q = new URLSearchParams(location.search);
  return `<h2>Workflow comparison</h2><div class="health-actions"><button onclick="selectHealthDays(1)">Last 24 hours</button><button onclick="selectHealthDays(7)">Last 7 days</button><button onclick="selectHealthDays(30)">Last 30 days</button></div>
    <form class="health-actions" onsubmit="applyWorkflowFilters(event)">
      <label>App ID <input name="appId" value="${attrEsc(data.identity.appId || '')}" placeholder="All Apps"></label>
      <label>Workflow <input name="workflow" value="${attrEsc(data.identity.workflow || '')}" placeholder="All workflows"></label>
      <label>Scope <select name="scope"><option value="top-level" ${data.scope === 'top-level' ? 'selected' : ''}>Top-level</option><option value="all" ${data.scope === 'all' ? 'selected' : ''}>Including children</option></select></label>
      <label>Run list outcome <select name="outcome"><option value="">All outcomes</option>${WORKFLOW_OUTCOMES.map(s => `<option ${q.get('outcome') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><button>Apply</button>
    </form>${workflowOutcomeCards(data)}${workflowCoverage(data)}
    ${data.identity.sourcePath !== undefined ? `<p class="health-note">Selected recorded source: ${esc(data.identity.sourcePath || 'unknown')}</p>` : ''}
    <p>${data.running} executions running now. Durations below include all finished outcomes, not CPU or financial cost; inspect successful runs separately when comparing speed.</p>
    <div class="health-scroll"><table class="health-table"><thead><tr><th>Workflow / App / source</th><th>Finished</th><th>Done / success share</th><th>Error</th><th>Blocked</th><th>Interrupted</th><th>Mean duration</th><th>Slowest duration</th><th>Timed runs</th></tr></thead><tbody>
      ${data.groups.map(g => `<tr><td><a href="${esc(workflowHealthLink(data, { appId: g.appId, workflow: g.workflow, sourcePath: g.sourcePath, sourceScope: g.sourceScope || '' }))}">${esc(g.workflow)}</a><div class="health-note">${esc(g.appId || 'No App binding')} · ${esc(g.sourcePath || 'Unknown source')}</div></td><td>${g.finished}</td><td>${g.done} / ${g.successRate === null ? '—' : (g.successRate * 100).toFixed(1) + '%'}</td><td>${g.error}</td><td>${g.blocked}</td><td>${g.interrupted}</td><td>${esc(healthDuration(g.meanDurationMs))}</td><td>${esc(healthDuration(g.maxDurationMs))}</td><td>${g.durationCount}/${g.finished}</td></tr>`).join('')}
    </tbody></table></div>${data.groupsTruncated ? '<p class="health-warning">Showing the first 100 workflow groups. Narrow the filters to see others; totals still cover the full selected population.</p>' : ''}
    <h3>Matching runs · ${data.matchingRuns}</h3><p class="health-note">Run-list outcome filtering does not change the overall outcome denominator. Counts are refreshed from the same retained population as these results.</p>
    ${workflowRunTable(data)}${data.next ? `<a href="${esc(workflowHealthLink(data, { ...data.next, outcome: q.get('outcome') }))}">Next runs</a>` : ''}`;
}

function usageNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—';
}

function contextUsageLink(data, changes = {}) {
  return '/metrics?' + new URLSearchParams({ start: data.window.start, end: data.window.end, ...data.identity, ...changes });
}

function applyContextFilters(event) {
  event.preventDefault();
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(event.currentTarget)) if (value) params.set(key, value);
  routeTo('/metrics?' + params);
}

function renderContextUsage(data) {
  return `<h2>Context preparation</h2>
    <p>Compare the same work with different preparers. Each sample is one bounded agent invocation, including later replies and corrective calls. Outcomes and actual model combinations stay separate. A completed execution does not prove the answer is correct.</p>
    <form class="health-actions" onsubmit="applyContextFilters(event)">
      <input type="hidden" name="start" value="${data.window.start}"><input type="hidden" name="end" value="${data.window.end}">
      <label>App <input name="appId" value="${esc(data.identity.appId || '')}" placeholder="All Apps"></label>
      <label>Agent <input name="agent" value="${esc(data.identity.agent || '')}" placeholder="All agents"></label>
      <label>Preparer <input name="preparer" value="${esc(data.identity.preparer || '')}" placeholder="All preparers"></label><button>Apply</button>
      <a href="/metrics?days=1">Last 24 hours</a> · <a href="/metrics?days=7">Last 7 days</a>
    </form>
    <p class="health-note">${esc(healthTime(data.window.start))} – ${esc(healthTime(data.window.end))}: ${data.invocations} recorded invocations started in this window. Workflow filters below apply only to workflows.</p>
    <p class="health-note">Means use finished invocations with usage on every observed reply. Missing or all-zero usage is unknown. Unfinished means no final measurement was saved, not necessarily still running. Historical sessions, persistent chat turns, provider-hidden retries, and external CLI usage are not covered. Direct runs save a local usage artifact and are not imported here.</p>
    ${data.groups.length ? `<div class="health-scroll"><table class="health-table" data-context-comparison><thead><tr><th>Preparer / agent / App / model</th><th>Outcome</th><th>Samples with complete usage</th><th>Mean input tokens</th><th>Mean output tokens</th><th>Mean replies / tools</th><th>Mean elapsed</th><th>Mean estimated cost</th></tr></thead><tbody>
      ${data.groups.map(g => `<tr><td><a href="${esc(contextUsageLink(data, { appId: g.appId || '', agent: g.agent, preparer: g.preparer, entryHash: g.entryHash || '', models: JSON.stringify(g.models) }))}">${esc(g.preparer)}</a>
        <div class="health-note">${esc(g.entryHash ? g.entryHash.slice(0, 12) : g.preparer === 'full' ? 'Default full brief' : 'Version unknown')} · ${esc(g.agent)} · ${esc(g.appId || 'No App binding')}</div>
        <div class="health-note">${esc(g.models.length ? g.models.map(m => m.join('/')).join(', ') : 'No model replies')}<br>Configured: ${esc(g.configuredModel)}</div></td>
        <td>${esc(g.outcome)}</td><td>${g.measuredInvocations}/${g.invocations}<div class="health-note">${g.measuredReplies}/${g.replies} replies measured</div></td>
        <td>${usageNumber(g.meanInputExposure)}<div class="health-note">${usageNumber(g.meanInput)} uncached<br>${usageNumber(g.meanCacheRead)} cache read<br>${usageNumber(g.meanCacheWrite)} cache write</div></td>
        <td>${usageNumber(g.meanOutput)}</td><td>${usageNumber(g.meanReplies)} / ${usageNumber(g.meanToolCalls)}</td><td>${esc(healthDuration(g.meanDurationMs))}</td>
        <td>${g.meanEstimatedCost === null ? '—' : '$' + Number(g.meanEstimatedCost).toFixed(4)}<div class="health-note">${g.pricedInvocations}/${g.measuredInvocations} samples priced</div></td></tr>`).join('')}
      </tbody></table></div>` : '<p>No context usage observations in this selection. Older sessions have unknown preparer identity and are not treated as full-context samples.</p>'}
    ${data.groupsTruncated ? '<p class="health-warning">Showing the first 100 groups. Narrow the filters; the invocation count includes all matching observations.</p>' : ''}
    <p class="health-note">Cost is an SDK estimate from model metadata, not an invoice; zero pricing is not proof of free usage. The version hash covers the preparer entry file only, not imported dependencies. Compare matched workloads and review the results before choosing a preparer.</p>
    <details><summary>Measurements and recent invocation evidence</summary>
      <p>Observed token subtotals below include partial runs; they must not be mistaken for complete spend. Brief sizes are UTF-8 bytes, not model token counts; they omit system instructions and tool schemas. Preparation time covers local prompt/tool setup.</p>
      <div class="health-scroll"><table class="health-table"><thead><tr><th>Preparer / outcome</th><th>Observed input / output tokens</th><th>Mean brief bytes: original → prepared</th><th>Mean preparation</th></tr></thead><tbody>
      ${data.groups.map(g => `<tr><td>${esc(g.preparer)} · ${esc(g.outcome)}</td><td>${g.measuredReplies ? usageNumber(g.inputExposure) + ' / ' + usageNumber(g.output) : 'Unknown'}</td><td>${usageNumber(g.meanTaskBytes)} → ${usageNumber(g.meanPromptBytes)}</td><td>${esc(healthDuration(g.meanPreparationMs))}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="health-note">The existing maintenance pass retires usage records after 30 days without updates. Session and workflow evidence may be retired earlier.</p>
      <ul>${data.runs.map(r => `<li>${r.outcome === 'preparation-error' ? `${esc(r.agent)} · Preparation failed before session execution` : r.sessionAvailable ? `<a href="/sessions/${encodeURIComponent(r.sessionId)}">${esc(r.agent)} · ${esc(r.sessionId)}</a>` : `${esc(r.agent)} · ${esc(r.sessionId)} · Session evidence unavailable`} · ${esc(r.preparer)} · ${esc(r.outcome || 'unfinished')} · ${esc(healthTime(r.startedAt))}${r.workflowAvailable ? ` · <a href="${esc(workflowRunLink(r.workflowRunId))}">Workflow evidence</a>` : ''}</li>`).join('')}</ul>
      ${data.runsTruncated ? '<p>Newest 50 matching invocations shown. Narrow the App, agent or preparer selection.</p>' : ''}
    </details>`;
}

async function loadMetricsTab() {
  const generation = ++metricsLoadGeneration;
  const topDown = document.getElementById('metrics-top-down');
  const el = document.getElementById('metrics-by-owner');
  const workflows = document.getElementById('metrics-workflows');
  const context = document.getElementById('metrics-context');
  const detail = document.getElementById('metrics-recent');
  document.getElementById('metrics-alerts').textContent = '';
  if (topDown) topDown.innerHTML = '';
  el.innerHTML = '<p>Loading measurements…</p>';
  workflows.innerHTML = '';
  context.innerHTML = '';
  detail.innerHTML = '';
  const id = currentRouteParams.id;
  // Independent surfaces: an unavailable metric collector cannot hide run facts.
  if (!id) {
    const obsQuery = new URLSearchParams(location.search);
    if (!obsQuery.has('days') && !obsQuery.has('start')) obsQuery.set('days', String(topDownDays));
    if (topDown) {
      topDown.innerHTML = '<p>Loading Host &amp; App summary…</p>';
      void readHealthJson('/api/observability?' + obsQuery).then(data => {
        if (generation === metricsLoadGeneration && currentTab === 'metrics') {
          topDown.innerHTML = renderTopDownObservability(data, { detailed: true });
        }
      }).catch(error => {
        if (generation === metricsLoadGeneration && topDown) {
          topDown.innerHTML = `<p class="health-warning">Observability summary failed: ${esc(error.message)}</p>`;
        }
      });
    }
    workflows.innerHTML = '<p>Loading workflow facts…</p>';
    const query = new URLSearchParams(location.search);
    if (!query.has('end')) query.set('end', Date.now());
    query.set('runs', 'true');
    context.innerHTML = '<p>Loading context usage…</p>';
    void readHealthJson('/api/context-usage?' + query).then(data => {
      if (generation === metricsLoadGeneration && currentTab === 'metrics') context.innerHTML = renderContextUsage(data);
    }).catch(error => {
      if (generation === metricsLoadGeneration) context.innerHTML = `<p class="health-warning">Context usage read failed: ${esc(error.message)}</p>`;
    });
    void readHealthJson('/api/workflow-health?' + query).then(data => {
      if (generation !== metricsLoadGeneration || currentTab !== 'metrics') return;
      query.set('start', data.window.start); query.set('end', data.window.end); query.delete('days');
      history.replaceState({}, '', '/metrics?' + query);
      workflows.innerHTML = renderWorkflowComparison(data);
    }).catch(error => {
      if (generation === metricsLoadGeneration) workflows.innerHTML = `<p class="health-warning">Workflow read failed: ${esc(error.message)}</p>`;
    });
  }
  try {
    const data = await readHealthJson('/api/metrics' + (id ? '?id=' + encodeURIComponent(id) : ''));
    if (generation !== metricsLoadGeneration || currentTab !== 'metrics') return;
    if (id) {
      const metric = data.metrics.find(m => m.id === id);
      el.innerHTML = '<p><a href="/metrics">All measurements</a></p>';
      if (!metric) { detail.textContent = 'Metric definition not found or retired.'; return; }
      await showMetricHistory(id, metric, generation);
    } else {
      el.innerHTML = renderObservationList(data);
      const failures = data.metrics.filter(m => m.collectionFailure?.afterLastSample);
      document.getElementById('metrics-alerts').innerHTML = `<p>${data.alertsTruncated ? 'More than ' : ''}${data.alerts.length} open alerts; ${failures.length} measurements with a failure after the last sample${data.truncated ? ' among ' + data.metrics.length + ' shown definitions (partial list)' : ''}. No alerts is not proof of health.</p>
        ${data.alerts.slice(0, 20).map(a => `<div class="health-warning"><a href="/metrics/${encodeURIComponent(a.metricId)}">${esc(a.name || a.metricId)}</a>: ${esc(a.message)} · opened ${esc(healthTime(a.createdAt))}</div>`).join('')}${data.alerts.length > 20 ? '<p>Showing newest 20 alerts; use metric detail for a selected definition.</p>' : ''}
        ${failures.map(m => `<div class="health-warning"><a href="/metrics/${encodeURIComponent(m.id)}">${esc(m.name || m.id)}</a>: ${esc(m.collectionFailure.reason)} · <a href="/events/${m.collectionFailure.eventId}">event</a></div>`).join('')}`;
    }
  } catch (error) { if (generation === metricsLoadGeneration) el.innerHTML = `<p class="health-warning">Metric read failed: ${esc(error.message)}</p>`; }
}

async function showMetricHistory(id, metric, generation) {
  if (!metric) { routeTo('/metrics/' + encodeURIComponent(id)); return; }
  const el = document.getElementById('metrics-recent');
  el.innerHTML = '<p>Loading history…</p>';
  try {
    const days = new URLSearchParams(location.search).get('days') || '1';
    const data = await readHealthJson('/api/metrics/' + encodeURIComponent(id) + '/history?days=' + encodeURIComponent(days));
    if (generation !== metricsLoadGeneration || currentTab !== 'metrics') return;
    el.innerHTML = `<h2>${esc(metric.name || id)}</h2><p>${esc(id)} · ${esc(metric.type || 'unspecified')} · ${esc(metric.unit || 'no unit')}</p>
      <p>${esc(metric.description || metric.source || 'No source description recorded.')}</p><p>${esc(metricObservationLabel(metric))}</p><p>${esc(metricRuleLabel(metric))}</p>
      ${metric.workflowSelection ? `<p><a href="/metrics?${attrEsc(new URLSearchParams({ ...metric.workflowSelection, runs: 'true' }).toString())}">Inspect retained runs for this observation's window</a> · Counts are recalculated; retention or later settlement can change the available facts.</p>` : '<p class="health-note">This definition does not supply a known workflow-run selection.</p>'}
      ${metric.alertOpen ? `<p class="health-warning">Open alert: ${esc(metric.alertMessage)}</p>` : ''}
      <p class="health-note">${metric.staleAfterMs ? 'Stale after ' + esc(healthDuration(metric.staleAfterMs)) + ' (two declared sampling intervals).' : 'No sampling cadence: freshness is unknown.'} Measurement freshness is not system health.</p>
      ${metric.collectionFailure ? `<p class="health-warning">Last retained collection failure: ${esc(healthTime(metric.collectionFailure.at))} · ${esc(metric.collectionFailure.reason)} · <a href="/events/${metric.collectionFailure.eventId}">event</a></p>` : ''}
      <h3>Recorded sample history</h3><div class="health-actions">${[1, 7, 14].map(d => `<button onclick="selectMetricDays(${jsStringAttr(id)}, ${d})">Last ${d === 1 ? '24 hours' : d + ' days'}</button>`).join('')}</div>${renderSparklineWithValues(data.snapshots, metric.threshold, 700, 160, metric.alert_op, { ...data.window, gapMs: metric.staleAfterMs, failures: data.failures })}
      <p class="health-note">${esc(healthTime(data.window.start))} – ${esc(healthTime(data.window.end))}. ${data.snapshots.length} observations${data.truncated ? '; limited to newest 2,000 samples / failures' : ''}. Points are observations, not continuous availability. Rolling-window counts must not be summed.</p>
      <div class="health-scroll"><table class="health-table"><thead><tr><th>Measured</th><th>Value</th><th>Sample size</th><th>Source</th><th>Note</th></tr></thead><tbody>${data.snapshots.slice(-50).reverse().map(s => `<tr><td>${esc(healthTime(s.measured_at))}</td><td>${esc(s.value)}</td><td>${esc(s.sample_size ?? 'unknown')}</td><td>${esc(s.measured_by || 'unknown')}</td><td class="health-text">${esc(s.note || '')}</td></tr>`).join('')}</tbody></table></div><p class="health-note">Table shows the latest 50 retained observations in this window.</p>`;
  } catch (error) { if (generation === metricsLoadGeneration) el.innerHTML = `<p class="health-warning">History read failed: ${esc(error.message)}</p>`; }
}
