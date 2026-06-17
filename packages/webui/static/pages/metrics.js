// ── Metrics Tab ───────────────────────────────────────────────────────
const PINNED_METRICS = ['runtime.daemon-heartbeat-stale', 'runtime.project-app-schedule-orphan-count-1h', 'escalation.pending-count', 'session.planner-timeout-rate-6h', 'handler.success-rate', 'handler.heartbeat-coverage', 'project.active-count', 'project.stale-active-count', 'project.iterations-24h'];
const HEALTH_METRICS = ['runtime.daemon-heartbeat-stale', 'runtime.project-app-schedule-orphan-count-1h', 'escalation.pending-count', 'session.planner-timeout-rate-6h', 'handler.success-rate', 'handler.heartbeat-coverage', 'project.active-count', 'project.stale-active-count', 'project.iterations-24h'];

async function loadMetricsTab() {
  try {
    const res = await fetch('/api/metrics');
    const data = await res.json();
    const container = document.getElementById('metrics-by-owner');
    const alertsEl = document.getElementById('metrics-alerts');
    const recentEl = document.getElementById('metrics-recent');
    function metricSurface(m) {
      if (m.type === 'health') return 'health';
      if (m.priority === 'P3') return 'watch';
      return m.type || 'gauge';
    }
    function metricSurfaceBadge(m) {
      const surface = metricSurface(m);
      const color = surface === 'health' ? 'var(--red)' : surface === 'watch' ? 'var(--fg2)' : 'var(--accent)';
      return `<span title="${surface === 'watch' ? 'Watch-only signal' : surface + ' metric'}" style="display:inline-block;border:1px solid ${color};color:${color};border-radius:10px;padding:1px 7px;font-size:10px">${esc(surface)}</span>`;
    }
    const hardAlerts = (data.alerts || []).filter(m => metricSurface(m) !== 'watch');
    const watchSignals = (data.alerts || []).filter(m => metricSurface(m) === 'watch');

    // Alerts
    if (hardAlerts.length === 0) {
      alertsEl.innerHTML = '<div style="padding:8px 12px;background:rgba(76,175,80,0.1);border:1px solid rgba(76,175,80,0.3);border-radius:6px;color:var(--green);font-size:13px">✓ No health/gauge alerts</div>';
    } else {
      alertsEl.innerHTML = hardAlerts.map(function(a) { var u = a.unit === 'ratio' ? '' : (a.unit ? ' ' + a.unit : ''); var desc = (a.alert_op === 'above' || a.alert_op === '>') ? 'exceeds' : 'below'; return '<div style="padding:8px 12px;background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.3);border-radius:6px;margin-bottom:6px;font-size:13px;color:var(--red)">\u26a0 <b>' + a.name + '</b> (' + a.owner + '): ' + a.current + u + ' — ' + desc + ' threshold ' + a.threshold + u + '</div>'; }).join('');
    }
    if (watchSignals.length > 0) {
      alertsEl.innerHTML += '<div style="padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;margin-top:6px;font-size:13px;color:var(--fg2)">' + watchSignals.length + ' watch signal' + (watchSignals.length === 1 ? '' : 's') + ' outside threshold</div>';
    }

    const snapMap = {};
    for (const s of (data.latestSnapshots || [])) snapMap[s.metric_id] = s;

    let html = '';

    // ── Health Metrics Section (with larger graphs) ──
    html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px">`;
    html += `<h3 style="margin:0 0 4px;font-size:14px;color:var(--fg)">Runtime Self-Drive</h3>`;
    html += `<div id="runtime-metrics-graphs" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;margin-bottom:16px"></div>`;
    html += `<h3 style="margin:0 0 4px;font-size:14px;color:var(--fg)">Handler Health</h3>`;
    html += `<div id="handler-metrics-graphs" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;margin-bottom:16px"></div>`;
    html += `<h3 style="margin:0 0 4px;font-size:14px;color:var(--fg)">Project Health</h3>`;
    html += `<div id="project-metrics-graphs" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px"></div>`;
    html += `</div>`;

    // System overview cards
    const healthy = data.metrics.filter(m => m.threshold != null && m.current != null && ((m.alert_op === 'above' || m.alert_op === '>') ? m.current <= m.threshold : m.current >= m.threshold)).length;
    const alerting = hardAlerts.length;
    const watchCount = data.metrics.filter(m => metricSurface(m) === 'watch').length;
    html += `<div style="display:flex;gap:12px;margin-bottom:16px">`;
    html += `<div style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:var(--green)">${healthy}</div><div style="font-size:11px;color:var(--fg2)">Healthy</div></div>`;
    html += `<div style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:var(--red)">${alerting}</div><div style="font-size:11px;color:var(--fg2)">Alerting</div></div>`;
    html += `<div style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold;color:var(--fg2)">${watchCount}</div><div style="font-size:11px;color:var(--fg2)">Watch</div></div>`;
    html += `<div style="flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px;text-align:center"><div style="font-size:24px;font-weight:bold">${data.metrics.length}</div><div style="font-size:11px;color:var(--fg2)">Total Active</div></div>`;
    html += `</div>`;

    // Group by operator-facing axis, not by owner. Three buckets per webui.md /system mock:
    //   AGENCY — are agents being agents?
    //   INFRASTRUCTURE — is the runtime healthy?
    //   OUTPUT — is work actually getting done?
    // Mapping is a cheap prefix rule. Anything unmatched falls into 'Other'.
    function axisOf(id) {
      if (id.startsWith('agent.') || id.startsWith('capability.')) return 'Agency';
      if (id.startsWith('handler.') || id.startsWith('session.') || id.startsWith('evaluator.') || id.startsWith('message.') || id.startsWith('metric.') || id.startsWith('runtime.') || id.startsWith('escalation.') || id.startsWith('v2.')) return 'Infrastructure';
      if (id.startsWith('project.') || id.startsWith('system.')) return 'Output';
      return 'Other';
    }
    const AXIS_ORDER = ['Agency', 'Infrastructure', 'Output', 'Other'];
    const AXIS_BLURB = {
      Agency: 'Are agents being agents? (heartbeats, self-direction, idle rate)',
      Infrastructure: 'Is the runtime healthy? (handlers, sessions, evaluators)',
      Output: 'Is work getting done? (projects, deliverables)',
      Other: 'Uncategorised — ID prefix not recognised by axis rule.',
    };
    const byAxis = {Agency: [], Infrastructure: [], Output: [], Other: []};
    for (const m of data.metrics) byAxis[axisOf(m.id)].push(m);
    // Within axis: alerting first, then by ID alpha.
    for (const axis of AXIS_ORDER) {
      byAxis[axis].sort((a, b) => {
        const aa = (a.threshold != null && a.current != null && ((a.alert_op === 'above' || a.alert_op === '>') ? a.current > a.threshold : a.current < a.threshold)) ? 0 : 1;
        const bb = (b.threshold != null && b.current != null && ((b.alert_op === 'above' || b.alert_op === '>') ? b.current > b.threshold : b.current < b.threshold)) ? 0 : 1;
        return aa - bb || a.id.localeCompare(b.id);
      });
    }
    for (const axis of AXIS_ORDER) {
      const ms = byAxis[axis];
      if (ms.length === 0) continue;
      html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px">`;
      html += `<h3 style="margin:0 0 4px;font-size:14px;color:var(--fg)">${axis} <span style="color:var(--fg2);font-weight:normal;font-size:12px">(${ms.length})</span></h3>`;
      html += `<div style="font-size:11px;color:var(--fg2);margin-bottom:10px">${AXIS_BLURB[axis]}</div>`;
      html += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
      html += `<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 8px;color:var(--fg2)">Metric</th><th style="padding:4px 8px;color:var(--fg2)">Owner</th><th style="padding:4px 8px;color:var(--fg2)">Current</th><th style="padding:4px 8px;color:var(--fg2)">Target</th><th style="padding:4px 8px;color:var(--fg2)">Type</th><th style="padding:4px 8px;color:var(--fg2)">Updated</th></tr>`;
      for (const m of ms) {
        const snap = snapMap[m.id]; const val = m.current != null ? m.current : '—';
        const isAlert = m.threshold != null && m.current != null && ((m.alert_op === 'above' || m.alert_op === '>') ? m.current > m.threshold : m.current < m.threshold);
        html += `<tr style="border-bottom:1px solid var(--bg3,#333);cursor:pointer" onclick="showMetricHistory('${m.id}')">`;
        html += `<td style="padding:4px 8px">${m.name}<br><span style="color:var(--fg2);font-size:11px">${m.id}</span></td>`;
        html += `<td style="padding:4px 8px;text-align:center;color:var(--fg2);font-size:11px">${m.owner||''}</td>`;
        html += `<td style="padding:4px 8px;text-align:center;${isAlert?'color:var(--red);font-weight:bold':''}">${val}${m.unit||''}</td>`;
        html += `<td style="padding:4px 8px;text-align:center;color:var(--fg2)">${m.target}${m.unit||''} <button title="Edit threshold (current: ${m.threshold ?? '—'})" onclick="verbEditThreshold('${m.id}', ${m.threshold ?? 'null'}, event)" style="background:none;border:none;color:var(--fg2);cursor:pointer;padding:0 2px">✎</button></td>`;
        html += `<td style="padding:4px 8px;text-align:center;color:var(--fg2)">${metricSurfaceBadge(m)}</td>`;
        html += `<td style="padding:4px 8px;text-align:center;color:var(--fg2);font-size:11px">${snap ? timeAgo(snap.measured_at) : '—'}</td></tr>`;
      }
      html += `</table></div>`;
    }
    container.innerHTML = html;

    // Load health metric graphs
    loadHealthMetricGraphs();
    renderRecentSnapshots(data.recentSnapshots);
  } catch (e) { document.getElementById('metrics-by-owner').innerHTML = `<p style="color:var(--red)">Failed: ${e.message}</p>`; }
}

var RUNTIME_METRICS = ['runtime.daemon-heartbeat-stale', 'runtime.project-app-schedule-orphan-count-1h', 'escalation.pending-count', 'session.planner-timeout-rate-6h'];
var HANDLER_METRICS = ['handler.completed-count', 'handler.failed-count', 'handler.success-rate', 'handler.heartbeat-coverage', 'handler.p95-duration', 'handler.fires-per-hour'];
var PROJECT_METRICS = ['project.active-count', 'project.stale-active-count', 'project.iterations-24h'];

async function loadHealthMetricGraphs() {
  var metricsRes = await fetch('/api/metrics');
  var metricsData = await metricsRes.json();

  await renderMetricGroup('runtime-metrics-graphs', RUNTIME_METRICS, metricsData);
  await renderMetricGroup('handler-metrics-graphs', HANDLER_METRICS, metricsData);
  await renderMetricGroup('project-metrics-graphs', PROJECT_METRICS, metricsData);
}

async function renderMetricGroup(containerId, metricIds, metricsData) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var html = '';
  for (var i = 0; i < metricIds.length; i++) {
    var metricId = metricIds[i];
    try {
      var res = await fetch('/api/metrics/' + encodeURIComponent(metricId) + '/history?days=1');
      var histData = await res.json();
      var snaps = histData.snapshots || [];

      var metricInfo = metricsData.metrics.find(function(m) { return m.id === metricId; });
      var threshold = metricInfo ? metricInfo.threshold : null;
      var name = metricInfo ? metricInfo.name : metricId.split('.').pop();
      var unit = metricInfo ? (metricInfo.unit || '') : '';
      var current = metricInfo ? metricInfo.current : null;
      var alertOp = metricInfo ? metricInfo.alert_op : null;
      var breaches = current != null && threshold != null && ((alertOp === 'above' || alertOp === '>') ? current > threshold : current < threshold);

      var currentStr = current != null ? Number(current).toFixed(2) + unit : '—';
      var color = current == null ? 'var(--fg2)' : (threshold == null || !breaches) ? 'var(--green)' : 'var(--red)';

      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;cursor:pointer" onclick="showMetricHistory(\'' + metricId + '\')">';
      html += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">';
      html += '<span style="font-size:12px;color:var(--fg2)">' + esc(name) + '</span>';
      html += '<span style="font-size:16px;font-weight:700;color:' + color + '">' + currentStr + '</span>';
      html += '</div>';
      html += renderSparklineWithValues(snaps, threshold, 300, 60, alertOp);
      html += '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:var(--fg2);opacity:0.7">';
      html += '<span>24h ago</span>';
      if (threshold != null) html += '<span>' + ((alertOp === 'above' || alertOp === '>') ? 'max: ' : 'min: ') + threshold + unit + '</span>';
      html += '<span>now</span>';
      html += '</div></div>';
    } catch (e) {
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;color:var(--fg2);font-size:12px">' + esc(metricId.split('.').pop()) + ': no data yet</div>';
    }
  }
  el.innerHTML = html;
}

async function loadSparkline(metricId) {
  try {
    const res = await fetch(`/api/metrics/${encodeURIComponent(metricId)}/history?days=7`);
    const data = await res.json();
    const el = document.getElementById('spark-' + metricId.replace(/\./g, '-'));
    if (!el || !data.snapshots || data.snapshots.length < 2) return;
    const values = data.snapshots.map(s => s.value);
    const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
    const w = el.offsetWidth || 250; const h = 30;
    const step = w / (values.length - 1);
    const pts = values.map((v, i) => `${i*step},${h-((v-min)/range)*(h-4)-2}`).join(' ');
    el.innerHTML = `<svg width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5"/></svg>`;
  } catch {}
}

async function showMetricHistory(metricId) {
  try {
    const res = await fetch(`/api/metrics/${encodeURIComponent(metricId)}/history?days=14`);
    const data = await res.json();
    const el = document.getElementById('metrics-recent');
    let html = `<div style="background:var(--bg2);border:1px solid var(--accent);border-radius:8px;padding:16px">`;
    html += `<h3 style="margin:0 0 12px;font-size:14px;color:var(--fg)">📈 ${metricId} — 14d history <button onclick="loadMetricsTab()" style="float:right;background:var(--bg3,#333);border:1px solid var(--border);color:var(--fg);padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px">Back</button></h3>`;
    if (!data.snapshots || data.snapshots.length === 0) { html += `<p style="color:var(--fg2)">No snapshots</p>`; }
    else {
      const values = data.snapshots.map(s => s.value);
      const min = Math.min(...values); const max = Math.max(...values); const range = max-min||1;
      const w=600; const h=120; const step=w/Math.max(values.length-1,1);
      const pts = values.map((v,i) => `${i*step},${h-((v-min)/range)*(h-10)-5}`).join(' ');
      html += `<svg width="100%" viewBox="0 0 ${w} ${h}" style="margin-bottom:12px"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/></svg>`;
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--fg2);margin-bottom:12px"><span>min: ${min.toFixed(2)}</span><span>max: ${max.toFixed(2)}</span><span>latest: ${values[values.length-1].toFixed(2)}</span><span>${data.snapshots.length} points</span></div>`;
      html += `<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 8px;color:var(--fg2)">Value</th><th style="padding:4px 8px;color:var(--fg2)">When</th><th style="text-align:left;padding:4px 8px;color:var(--fg2)">Note</th></tr>`;
      for (const s of data.snapshots.slice().reverse().slice(0,20)) {
        html += `<tr style="border-bottom:1px solid var(--bg3,#333)"><td style="padding:4px 8px">${s.value}</td><td style="padding:4px 8px;text-align:center;color:var(--fg2);font-size:11px">${timeAgo(s.measured_at)}</td><td style="padding:4px 8px;color:var(--fg2);font-size:11px">${s.note||''}</td></tr>`;
      }
      html += `</table>`;
    }
    html += `</div>`;
    el.innerHTML = html;
  } catch (e) { document.getElementById('metrics-recent').innerHTML = `<p style="color:var(--red)">Failed: ${e.message}</p>`; }
}

function renderRecentSnapshots(snapshots) {
  let html = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">`;
  html += `<h3 style="margin:0 0 10px;font-size:14px;color:var(--fg)">Recent Snapshots</h3>`;
  html += `<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 8px;color:var(--fg2)">Metric</th><th style="padding:4px 8px;color:var(--fg2)">Value</th><th style="padding:4px 8px;color:var(--fg2)">When</th><th style="text-align:left;padding:4px 8px;color:var(--fg2)">Note</th></tr>`;
  for (const s of (snapshots||[]).slice(0,30)) {
    html += `<tr style="border-bottom:1px solid var(--bg3,#333);cursor:pointer" onclick="showMetricHistory('${s.metric_id}')"><td style="padding:4px 8px">${s.metric_id}</td><td style="padding:4px 8px;text-align:center">${s.value}</td><td style="padding:4px 8px;text-align:center;color:var(--fg2);font-size:11px">${timeAgo(s.measured_at)}</td><td style="padding:4px 8px;color:var(--fg2);font-size:11px">${s.note||''}</td></tr>`;
  }
  html += `</table></div>`;
  document.getElementById('metrics-recent').innerHTML = html;
}
