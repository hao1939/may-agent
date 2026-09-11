// SQLite-backed observations. No browser-owned metric formulas or health score.
let metricsLoadGeneration = 0;
let overviewLoadGeneration = 0;
let overviewTasksGeneration = 0;
const WORKFLOW_OUTCOMES = ['done', 'error', 'blocked', 'interrupted'];

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
  return '/events?workflowRunId=' + encodeURIComponent(id) + '#loop-trace';
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
    ${data.scope === 'top-level' ? 'Top-level runs only; children remain in run evidence.' : 'All runs, including children; not independent Task outcomes.'}
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
      <h3>Recent execution errors</h3>${workflowRunTable(data)}`;
  } catch (error) { if (generation === overviewLoadGeneration) el.innerHTML = `<h2>Workflow execution</h2><p class="health-warning">Unable to read execution evidence: ${esc(error.message)}</p>`; }
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
  return `${metric.thresholdBreached === null ? 'Not evaluated' : metric.thresholdBreached ? 'Last value outside threshold' : 'Last value within threshold'} (${metric.alert_op === '>' || metric.alert_op === 'above' ? 'max' : 'min'} ${metric.threshold} ${metric.unit || ''})`;
}

function renderObservationList(data) {
  return `<h2>Recorded measurements</h2><p class="health-note">${data.metrics.length} definitions${data.truncated ? ' (list limited; use an exact metric link for other definitions)' : ''}. Freshness, collection failure and warning rules are separate facts.</p>
    <label>Find a metric <input id="metric-search" type="search" placeholder="Name, ID or owner" oninput="filterMetricRows(this.value)"></label>
    <div class="health-scroll"><table class="health-table"><thead><tr><th>Metric / owner</th><th>Last value</th><th>Observation</th><th>Rule</th></tr></thead><tbody>
    ${data.metrics.map(m => `<tr data-metric-search="${attrEsc([m.name, m.id, m.owner].join(' ').toLowerCase())}"><td><a href="/metrics/${encodeURIComponent(m.id)}">${esc(m.name || m.id)}</a><div class="health-note">${esc(m.id)} · ${esc(m.owner || 'unknown owner')} · ${esc(m.type || 'unspecified type')}</div></td>
      <td>${esc(m.observation ? String(m.observation.value) : 'unknown')} ${esc(m.unit || '')}</td><td>${esc(metricObservationLabel(m))}${m.observation?.sampleSize != null ? `<div>Sample size: ${m.observation.sampleSize}</div>` : ''}</td><td>${esc(metricRuleLabel(m))}${m.alertOpen ? ' · open alert' : ''}</td></tr>`).join('')}
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

async function loadMetricsTab() {
  const generation = ++metricsLoadGeneration;
  const el = document.getElementById('metrics-by-owner');
  const workflows = document.getElementById('metrics-workflows');
  const detail = document.getElementById('metrics-recent');
  document.getElementById('metrics-alerts').textContent = '';
  el.innerHTML = '<p>Loading measurements…</p>';
  workflows.innerHTML = '';
  detail.innerHTML = '';
  const id = currentRouteParams.id;
  // Independent surfaces: an unavailable metric collector cannot hide run facts.
  if (!id) {
    workflows.innerHTML = '<p>Loading workflow evidence…</p>';
    const query = new URLSearchParams(location.search);
    query.set('runs', 'true');
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
      document.getElementById('metrics-alerts').innerHTML = `<p>${data.alerts.length} open alerts${data.alertsTruncated ? ' (limited)' : ''}; ${failures.length} measurements with a failure after the last sample. No alerts is not proof of health.</p>
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
      ${metric.workflowSelection ? `<p><a href="/metrics?${attrEsc(new URLSearchParams({ ...metric.workflowSelection, runs: 'true' }).toString())}">Inspect retained runs for this observation's window</a> · Counts are recalculated; retention or later settlement can change the available evidence.</p>` : '<p class="health-note">This definition does not supply a known workflow-run selection.</p>'}
      ${metric.alertOpen ? `<p class="health-warning">Open alert: ${esc(metric.alertMessage)} · <a href="/api/loop-trace?alertId=${metric.alertId}">retained alert evidence (JSON)</a></p>` : ''}
      <p class="health-note">${metric.staleAfterMs ? 'Stale after ' + esc(healthDuration(metric.staleAfterMs)) + ' (two declared sampling intervals).' : 'No sampling cadence: freshness is unknown.'} Measurement freshness is not system health.</p>
      ${metric.collectionFailure ? `<p class="health-warning">Last retained collection failure: ${esc(healthTime(metric.collectionFailure.at))} · ${esc(metric.collectionFailure.reason)} · <a href="/events/${metric.collectionFailure.eventId}">event</a></p>` : ''}
      <h3>Recorded sample history</h3><div class="health-actions">${[1, 7, 14].map(d => `<button onclick="selectMetricDays(${jsStringAttr(id)}, ${d})">Last ${d === 1 ? '24 hours' : d + ' days'}</button>`).join('')}</div>${renderSparklineWithValues(data.snapshots, metric.threshold, 700, 160, metric.alert_op, { ...data.window, gapMs: metric.staleAfterMs, failures: data.failures })}
      <p class="health-note">${esc(healthTime(data.window.start))} – ${esc(healthTime(data.window.end))}. ${data.snapshots.length} observations${data.truncated ? '; limited to newest 2,000 samples / failures' : ''}. Points are observations, not continuous availability. Rolling-window counts must not be summed.</p>
      <div class="health-scroll"><table class="health-table"><thead><tr><th>Measured</th><th>Value</th><th>Sample size</th><th>Source</th><th>Note</th></tr></thead><tbody>${data.snapshots.slice(-50).reverse().map(s => `<tr><td>${esc(healthTime(s.measured_at))}</td><td>${esc(s.value)}</td><td>${esc(s.sample_size ?? 'unknown')}</td><td>${esc(s.measured_by || 'unknown')}</td><td class="health-text">${esc(s.note || '')}</td></tr>`).join('')}</tbody></table></div><p class="health-note">Table shows the latest 50 retained observations in this window.</p>`;
  } catch (error) { if (generation === metricsLoadGeneration) el.innerHTML = `<p class="health-warning">History read failed: ${esc(error.message)}</p>`; }
}

// Existing project/agent cards can request a single history after selection.
async function loadSparkline(id) {
  try {
    const data = await readHealthJson('/api/metrics/' + encodeURIComponent(id) + '/history?days=7');
    const el = document.getElementById('spark-' + id.replace(/\./g, '-'));
    if (el) el.innerHTML = renderSparklineWithValues(data.snapshots, null, 250, 40, null, data.window);
  } catch { /* The owning page shows its read state. */ }
}
