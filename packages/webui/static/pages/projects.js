// ── Projects ──────────────────────────────────────────────────────────

// List and detail requests share one pane; only the latest load may render it.
let projectLoadVersion = 0;

function formatCadenceCompact(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  if (ms < 60000) return Math.round(ms / 1000) + 's';
  if (ms < 3600000) return Math.round(ms / 60000) + 'm';
  return (ms / 3600000).toFixed(1).replace(/\.0$/, '') + 'h';
}

function formatProjectMetricNum(value, unit) {
  if (typeof formatAgentMetricValue === 'function') return formatAgentMetricValue(value, unit);
  if (value == null || Number.isNaN(Number(value))) return '—';
  return String(Number(value).toFixed(2)) + (unit || '');
}

function renderInstalledApps(result) {
  let html = '<section id="installed-apps" class="health-section"><div class="overview-card-head"><h2>Loaded Apps</h2><span class="health-note">Canonical domain units loaded in this Host</span></div>';
  if (result.status === 'rejected') {
    return html + `<p role="alert" class="health-warning">Loaded Apps unavailable: ${esc(result.reason.message)}</p></section>`;
  }
  const apps = result.value;
  if (!apps.length) return html + '<p class="health-note">No Apps loaded.</p></section>';

  html += '<div class="app-domain-grid">';
  for (const app of apps) {
    const href = `/projects/${encodeURIComponent(app.id + '.app')}/tasks?appId=${encodeURIComponent(app.id)}`;
    const briefHref = `/projects/${encodeURIComponent(app.id + '.app')}?appId=${encodeURIComponent(app.id)}`;
    const metricsHref = `/metrics?appId=${encodeURIComponent(app.id)}`;
    const obs = Array.isArray(app.observations) ? app.observations : [];
    const run = app.runningTasks || 0;
    const attn = app.attentionTasks || 0;
    const wait = app.waitingTasks || 0;
    const queued = app.queuedTasks || 0;
    const idle = app.idleTasks || 0;

    const lanePills = [];
    if (run > 0) lanePills.push(`<span class="app-task-pill running">● ${run} running</span>`);
    if (attn > 0) lanePills.push(`<span class="app-task-pill attn">⚠ ${attn} needs review</span>`);
    if (wait > 0) lanePills.push(`<span class="app-task-pill wait">${wait} waiting</span>`);
    if (queued > 0) lanePills.push(`<span class="app-task-pill">${queued} queued</span>`);
    if (idle > 0) lanePills.push(`<span class="app-task-pill muted">${idle} idle</span>`);
    if (!lanePills.length) lanePills.push(`<span class="app-task-pill muted">0 open Tasks</span>`);

    const obsHtml = obs.length
      ? `<div class="app-observers-row">${obs.slice(0, 3).map(o => `<span class="observer-chip" title="${attrEsc((o.type || o.id) + (o.description ? ': ' + o.description.slice(0, 180) : ''))}">👁 ${esc(o.id)}${o.intervalMs ? ' · ' + esc(formatCadenceCompact(o.intervalMs)) : ''}</span>`).join('')}</div>`
      : '';

    html += `<article class="app-domain-card" data-app-id="${attrEsc(app.id)}">
      <header class="app-domain-head">
        <h3><a href="${attrEsc(href)}">${esc(app.id)}</a></h3>
        <a href="/agents/${encodeURIComponent(app.owner)}" class="agent-role-pill owner" title="App owner agent">Owner: ${esc(app.owner)}</a>
      </header>
      <div class="app-domain-body">
        ${app.description ? `<p class="app-domain-desc" title="${attrEsc(app.description)}">${esc(app.description)}</p>` : '<p class="app-domain-desc"><i>No description declared.</i></p>'}
        <div class="app-lanes-strip">${lanePills.join('')}</div>
        ${obsHtml}
      </div>
      <footer class="app-domain-foot">
        <a href="${attrEsc(href)}" class="app-card-cta">Task Board →</a>
        <a href="${attrEsc(metricsHref)}">Trends &amp; Metrics →</a>
        <a href="${attrEsc(briefHref)}">Brief →</a>
      </footer>
    </article>`;
  }
  html += '</div>';

  // Retain compact table summary in a collapsible drawer for tabular comparison & test parity.
  html += `<details class="compact-table-drawer"><summary>Compact workload table (${apps.length})</summary><div class="health-scroll" style="margin-top:8px"><table class="health-table"><thead><tr><th>App</th><th>Owner</th><th>Running Tasks</th><th>Waiting Tasks</th><th>Needs review</th></tr></thead><tbody>`;
  for (const app of apps) {
    const href = `/projects/${encodeURIComponent(app.id + '.app')}/tasks?appId=${encodeURIComponent(app.id)}`;
    html += `<tr style="cursor:pointer" onclick="routeTo(${jsStringAttr(href)})">` +
      `<td><a href="${attrEsc(href)}" style="color:inherit;text-decoration:none"><strong>${esc(app.id)}</strong></a>${app.description ? `<div class="health-note">${esc(app.description)}</div>` : ''}</td>` +
      `<td>${esc(app.owner)}</td><td>${esc(app.runningTasks)}</td><td>${esc(app.waitingTasks)}</td><td>${esc(app.attentionTasks)}</td></tr>`;
  }
  return html + '</tbody></table></div></details></section>';
}

async function loadProjects() {
  const loadVersion = ++projectLoadVersion;
  try {
    const readCatalog = async (path) => {
      const res = await fetch(path);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (!Array.isArray(body)) throw new Error('Invalid catalog response');
      return body;
    };
    const [projectResult, appResult] = await Promise.allSettled([
      readCatalog('/api/projects'), readCatalog('/api/apps'),
    ]);
    if (loadVersion !== projectLoadVersion) return;
    const projects = projectResult.status === 'fulfilled' ? projectResult.value : [];
    const loadedApps = appResult.status === 'fulfilled' ? appResult.value : [];
    const loadedAppIds = new Set(loadedApps.map(a => String(a.id || '').replace(/\.app$/, '')));
    const el = document.getElementById('projects-content');

    const statusOrder = {active:0, blocked:1, paused:2, waiting:3, done:4, complete:5, closed:6};
    projects.sort((a,b) => (statusOrder[a.status]??9) - (statusOrder[b.status]??9) || b.updatedAt - a.updatedAt);

    const HIDDEN_STATUSES = new Set(['done', 'complete', 'closed']);
    const hiddenCount = projects.filter(p => HIDDEN_STATUSES.has(p.status)).length;
    const showHidden = document.getElementById('show-hidden-toggle')?.checked ?? false;
    const visible = showHidden ? projects : projects.filter(p => !HIDDEN_STATUSES.has(p.status));

    const hasStandaloneProject =
      projectResult.status === 'rejected' ||
      appResult.status === 'rejected' ||
      loadedAppIds.size === 0 ||
      visible.some(p => !loadedAppIds.has(String(p.name || '').replace(/\.app$/, ''))) ||
      showHidden;

    const totalOpenTasks = loadedApps.reduce((s, a) => s + (a.openTasks ?? a.activeTasks ?? 0), 0);
    let html = `<div class="agents-toolbar">
      <div>
        <h2 style="margin:0;font-size:18px">Apps &amp; Projects <span class="health-note" style="font-weight:400">(${loadedApps.length} Loaded Apps · ${totalOpenTasks} open Tasks)</span></h2>
        <p class="health-note" style="margin:2px 0 0">Loaded Apps own live Task reconciliation, Conditions, and observers. Saved project files record design-time project intent.</p>
      </div>
      <button class="td-window-btn" onclick="loadProjects()">↻ Refresh</button>
    </div>` + renderInstalledApps(appResult);

    if (projectResult.status === 'rejected') {
      html += `<p role="alert" class="health-warning">Saved projects unavailable: ${esc(projectResult.reason.message)}</p>`;
    }

    html += `<details class="saved-projects-drawer" ${hasStandaloneProject ? 'open' : ''}>
      <summary>Saved project metadata files (${visible.length} active${hiddenCount ? ` · ${hiddenCount} closed` : ''})</summary>
      <div style="margin-top:10px">
        <p class="health-note" style="margin:0 0 8px">Saved project status describes project intent in <code>project.md</code> / <code>project.json</code>; it does not indicate whether an App is loaded or running.</p>
        <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:var(--fg2);cursor:pointer"><input type="checkbox" id="show-hidden-toggle" onchange="loadProjects()" ${showHidden ? 'checked' : ''}> Show closed (${hiddenCount} done / complete / closed)</label></div>
        <div class="health-scroll"><table id="saved-projects" class="health-table">
          <thead><tr>
            <th>Project</th><th>Owner</th><th>Saved project status</th><th>Health</th><th>Milestones</th><th>Metrics</th><th>Iter</th><th>Updated</th>
          </tr></thead><tbody>`;

    for (const p of visible) {
      const healthColor = !p.health ? 'var(--fg2)' :
        p.health.includes('PASS') || p.health.includes('COMPLETE') ? 'var(--green)' :
        p.health.includes('FAIL') ? 'var(--red)' : 'var(--yellow)';
      const statusColor = p.status === 'active' ? 'var(--green)' :
        p.status === 'blocked' ? 'var(--red)' :
        p.status === 'paused' ? 'var(--yellow)' : 'var(--fg2)';
      const msBar = p.milestonesTotal > 0
        ? `<div style="display:flex;align-items:center;gap:4px"><div style="width:60px;height:6px;background:var(--bg3);border-radius:3px"><div style="width:${Math.round(p.milestonesDone/p.milestonesTotal*100)}%;height:100%;background:var(--green);border-radius:3px"></div></div><span>${p.milestonesDone}/${p.milestonesTotal}</span></div>`
        : '<span style="color:var(--fg2)">—</span>';

      html += `<tr style="cursor:pointer" onclick="routeTo('/projects/' + '${attrEsc(projectIdOf(p))}')">` +
        `<td style="font-weight:500">${esc(p.name)}</td>` +
        `<td>${esc(p.owner)}</td>` +
        `<td><span style="color:${statusColor}">${esc(p.status)}</span></td>` +
        `<td><span style="color:${healthColor}">${p.health || '—'}</span></td>` +
        `<td>${msBar}</td>` +
        `<td style="font-size:12px">${p.metrics?.length ? p.metrics.map(m => {
          const name = m.id.split('.').pop();
          if (m.current != null) return `<span style="color:${m.breached ? 'var(--red)' : 'var(--green)'}">${esc(name)}: ${esc(formatProjectMetricNum(m.current, m.unit))} ${m.breached ? '\u2717' : '\u2713'}</span>`;
          return `<span style="color:var(--fg2)">${esc(name)}: ${m.target ?? '?'}</span>`;
        }).join(', ') : '\u2014'}</td>` +
        `<td>${p.iteration ?? 0}</td>` +
        `<td style="color:var(--fg2);font-size:12px">${timeAgo(p.updatedAt)}</td>` +
        `</tr>`;
    }
    html += `</tbody></table></div></div></details>`;
    el.innerHTML = html;
  } catch(e) {
    if (loadVersion !== projectLoadVersion) return;
    document.getElementById('projects-content').innerHTML = `<div style="color:var(--red)">Failed to load projects: ${esc(e.message)}</div>`;
  }
}

function projectIdFromPath(path) {
  return projectIdOf({ path: path || '' });
}

function projectRouteFor(path, surface, explicitAppId) {
  const query = explicitAppId ? `?appId=${encodeURIComponent(explicitAppId)}` : '';
  const suffix = surface && surface !== 'project' ? `/${surface}` : '';
  if (explicitAppId) {
    return `/projects/${encodeURIComponent(explicitAppId + '.app')}${suffix}${query}`;
  }
  const id = projectIdFromPath(path);
  return `/projects/${id.split('/').map(encodeURIComponent).join('/')}${suffix}`;
}

async function showProjectDetail(path, initialTab, explicitAppId) {
  const loadVersion = ++projectLoadVersion;
  _projectDetailPath = path;
  const el = document.getElementById('projects-content');
  el.innerHTML = '<div style="color:var(--fg2);padding:24px">Loading project…</div>';

  // Fetch the rollup first — we need it for the header card.
  let detail = null;
  try {
    const r = await fetch(`/api/projects/detail?path=${encodeURIComponent(path)}`);
    const body = await r.json().catch(() => ({}));
    if (loadVersion !== projectLoadVersion) return;
    if (explicitAppId) {
      const appDirName = `${explicitAppId}.app`;
      if (r.ok && !body.error) {
        detail = { ...body, explicitAppId, app: { ...(body.app || {}), appId: explicitAppId, appDirName } };
      } else {
        detail = { name: appDirName, owner: '', status: 'loaded-app', explicitAppId, app: { appId: explicitAppId, appDirName, hasUi: false } };
      }
      _currentProjectDetail = detail;
    } else if (r.status === 404 && initialTab === 'tasks' && /^projects\/.+\.app$/.test(path)) {
      const appId = path.slice('projects/'.length).replace(/\.app$/, '');
      detail = { name: `${appId}.app`, owner: '', status: 'loaded-app', app: { appId, appDirName: `${appId}.app`, hasUi: false } };
      _currentProjectDetail = detail;
    } else {
      if (!r.ok || body.error) throw new Error(body.error || `HTTP ${r.status}`);
      detail = body;
      _currentProjectDetail = detail;
    }
  } catch (e) {
    if (loadVersion !== projectLoadVersion) return;
    el.innerHTML = `<div style="color:var(--red);padding:16px">Failed to load project: ${esc(e.message)}</div>`;
    return;
  }

  // Fetch Loaded App live summary in best-effort mode when this path corresponds to an App.
  const resolvedAppId = explicitAppId || detail.app?.appId || null;
  let loadedAppInfo = null;
  if (resolvedAppId) {
    try {
      const appsRes = await fetch('/api/apps');
      if (appsRes.ok) {
        const appsList = await appsRes.json();
        if (Array.isArray(appsList)) loadedAppInfo = appsList.find(a => a.id === resolvedAppId) || null;
      }
    } catch { /* Best-effort App metadata. */ }
    if (loadVersion !== projectLoadVersion) return;
  }

  const statusColors = {
    active: 'var(--green)', running: 'var(--green)',
    waiting: 'var(--orange,#e8a44c)', blocked: 'var(--red)', paused: 'var(--orange,#e8a44c)',
    done: 'var(--fg2)', complete: 'var(--fg2)', closed: 'var(--fg2)',
  };
  const statusColor = statusColors[detail.status] || 'var(--fg2)';
  const milestonePct = detail.milestonesTotal > 0 ? Math.round(100 * detail.milestonesDone / detail.milestonesTotal) : 0;
  const effectiveOwner = loadedAppInfo?.owner || detail.owner || '';
  const defaultProjectTab = initialTab === 'tasks' ? 'kanban' : 'project';

  let html = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
    <button onclick="routeTo('/projects')" class="td-window-btn">← All Apps &amp; Projects</button>
    ${resolvedAppId ? `<a href="/metrics?appId=${encodeURIComponent(resolvedAppId)}" class="td-window-btn">Trends &amp; Metrics →</a>` : ''}
  </div>`;

  // ── Header card ──
  html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:12px">`;
  html += `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">`;
  html += `<h2 style="margin:0;font-size:18px">${esc(loadedAppInfo?.id || detail.name)}</h2>`;
  if (loadedAppInfo) {
    html += `<span class="td-scope-tag app" style="margin:0">Loaded App</span>`;
    if (loadedAppInfo.runningTasks > 0) html += `<span class="app-task-pill running">● ${loadedAppInfo.runningTasks} running</span>`;
    if (loadedAppInfo.attentionTasks > 0) html += `<span class="app-task-pill attn">⚠ ${loadedAppInfo.attentionTasks} needs review</span>`;
    if (loadedAppInfo.waitingTasks > 0) html += `<span class="app-task-pill wait">${loadedAppInfo.waitingTasks} waiting</span>`;
    if (loadedAppInfo.idleTasks > 0) html += `<span class="app-task-pill muted">${loadedAppInfo.idleTasks} idle</span>`;
  } else {
    html += `<span style="color:${statusColor};font-size:11px;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;background:var(--bg);padding:2px 8px;border:1px solid ${statusColor};border-radius:10px">Saved project status: ${esc(detail.status || 'unknown')}</span>`;
  }
  if (detail.priority) html += `<span class="agent-stat-pill">${esc(detail.priority)}</span>`;
  if (detail.workflow) html += `<span class="agent-stat-pill">workflow: ${esc(detail.workflow)}</span>`;
  html += `</div>`;

  html += `<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--fg2);margin-top:6px">`;
  if (effectiveOwner) html += `<span>owner: <a href="/agents/${encodeURIComponent(effectiveOwner)}" style="color:var(--accent);text-decoration:none">${esc(effectiveOwner)}</a></span>`;
  if (!loadedAppInfo && detail.iteration != null) html += `<span>iteration ${detail.iteration ?? 0}</span>`;
  if (detail.sessionCount) html += `<span title="Sessions tagged with projectId">${detail.sessionCount} sessions</span>`;
  if (detail.updatedAt && !loadedAppInfo) html += `<span>updated ${esc(timeAgo(detail.updatedAt))}</span>`;
  html += `</div>`;

  if (loadedAppInfo?.description) {
    html += `<p class="health-note" style="margin:6px 0 0">${esc(loadedAppInfo.description)}</p>`;
  }

  // Fold verbose Goal / Current State / Metrics into a clean drawer when opening the Tasks board directly.
  const allProjectMetrics = [...(detail.ownedMetrics || []), ...(detail.citedMetricsResolved || [])];
  const metricsById = {};
  for (const m of allProjectMetrics) metricsById[m.id] = m;
  const projectMetrics = Object.values(metricsById);

  let briefInner = '';
  if (detail.goal) {
    const goalHtml = window.marked && window.marked.parse ? window.marked.parse(detail.goal) : '<pre style="white-space:pre-wrap;margin:0;font-family:inherit">' + esc(detail.goal) + '</pre>';
    briefInner += `<div style="margin-top:10px;padding:10px 12px;background:var(--bg);border-left:3px solid var(--accent);border-radius:4px;font-size:13px;line-height:1.5">
      <div style="font-size:10px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Goal</div>
      <div class="md-rendered" style="font-size:13px">${goalHtml}</div>
    </div>`;
  }
  if (detail.currentState) {
    const currentStateHtml = window.marked && window.marked.parse ? window.marked.parse(detail.currentState) : '<pre style="white-space:pre-wrap;margin:0;font-family:inherit">' + esc(detail.currentState) + '</pre>';
    briefInner += `<div style="margin-top:10px;padding:10px 12px;background:var(--bg);border-left:3px solid ${statusColor};border-radius:4px;font-size:13px;line-height:1.5">
      <div style="font-size:10px;color:${statusColor};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Current State</div>
      <div class="md-rendered" style="font-size:13px;overflow-wrap:anywhere">${currentStateHtml}</div>
    </div>`;
  }
  if (detail.milestonesTotal > 0) {
    const barColor = milestonePct === 100 ? 'var(--green)' : (milestonePct >= 50 ? 'var(--accent)' : 'var(--orange,#e8a44c)');
    briefInner += `<div style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--fg2);margin-bottom:3px"><span>Milestones</span><span>${detail.milestonesDone} / ${detail.milestonesTotal} · ${milestonePct}%</span></div>
      <div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden"><div style="height:100%;background:${barColor};width:${milestonePct}%;transition:width 0.3s"></div></div>
    </div>`;
  }
  if (projectMetrics.length > 0) {
    briefInner += `<div style="margin-top:12px">
      <h3 style="margin:0 0 8px;font-size:12px;color:var(--fg2);display:flex;align-items:center;gap:8px">Metrics <span style="font-size:11px;font-weight:normal">${detail.ownedMetrics.length} owned${detail.citedMetricsResolved.length > 0 ? `, ${detail.citedMetricsResolved.length} cited` : ''}</span></h3>
      <div id="project-metrics-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:8px">`;
    for (const m of projectMetrics) {
      const breached = metricBreached(m);
      const cited = !detail.ownedMetrics.find(o => o.id === m.id);
      const formattedVal = formatProjectMetricNum(m.current, m.unit);
      const formattedLim = m.threshold != null ? formatProjectMetricNum(m.threshold, m.unit) : '';
      briefInner += `<div data-metric-id="${esc(m.id)}" onclick="routeTo('/metrics/' + encodeURIComponent('${attrEsc(m.id)}'))" style="background:var(--bg);border:1px solid ${breached ? 'var(--red)' : 'var(--border)'};border-radius:6px;padding:10px;cursor:pointer">
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;margin-bottom:2px"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name || m.id)}</span>${cited ? '<span style="font-size:9px;color:var(--fg2);background:var(--bg2);padding:1px 5px;border-radius:6px">cited</span>' : ''}</div>
        <div style="font-size:10px;color:var(--fg2);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.id)}</div>
        <div class="spark-slot" style="min-height:30px"><span style="font-size:10px;color:var(--fg2)">loading…</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px;font-variant-numeric:tabular-nums"><span style="font-weight:600;${breached ? 'color:var(--red)' : ''}">${esc(formattedVal)}</span>${m.threshold != null ? `<span style="color:var(--fg2)">${esc(metricHealthyOperator(m))} ${esc(formattedLim)}</span>` : ''}</div>
      </div>`;
    }
    const unresolved = (detail.citedMetrics || []).filter(id => !metricsById[id]);
    for (const id of unresolved) {
      briefInner += `<div style="background:var(--bg);border:1px dashed var(--border);border-radius:6px;padding:10px;opacity:0.6">
        <div style="font-size:12px;font-weight:500;color:var(--fg2)">${esc(id)}</div>
        <div style="font-size:10px;color:var(--fg2);margin-top:4px">cited but not registered as a metric</div>
      </div>`;
    }
    briefInner += `</div></div>`;
  }

  if (briefInner) {
    if (defaultProjectTab === 'kanban') {
      html += `<details class="project-brief-drawer"><summary>Project brief, state &amp; ${projectMetrics.length} metrics</summary>${briefInner}</details>`;
    } else {
      html += briefInner;
    }
  }
  html += `</div>`;

  const conversationLink = humanInterface.appId && humanInterface.agent
    ? `<a href="${attrEsc('/agents/' + encodeURIComponent(humanInterface.agent))}" style="color:var(--accent)">Conversation</a>`
    : 'Conversation';
  html += `<p id="project-feedback-guidance" class="health-note">Start new work in ${conversationLink}. For existing work, open a Task in the Tasks tab and send feedback.</p>`;

  // ── Sub-tabs ──
  html += `<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:12px">`;
  html += projectTabButton('kanban', 'Tasks', defaultProjectTab);
  html += projectTabButton('project', 'Project Doc', defaultProjectTab);
  const totalSessionLink = detail.sessionCount || 0;
  html += projectTabButton('sessions', `Sessions${totalSessionLink ? ` <span style="font-size:10px;background:var(--bg);padding:1px 6px;border-radius:8px;margin-left:4px">${totalSessionLink}</span>` : ''}`, defaultProjectTab);
  html += `</div>`;
  html += `<div id="project-tab-content" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px"></div>`;

  el.innerHTML = html;

  // Async: fetch sparklines for project metrics and inject into slots.
  if (projectMetrics.length > 0) {
    Promise.all(projectMetrics.map(m =>
      fetch(`/api/metrics/${encodeURIComponent(m.id)}/history?days=7`).then(r => r.json()).catch(() => ({snapshots:[]}))
    )).then(results => {
      if (loadVersion !== projectLoadVersion) return;
      results.forEach((res, i) => {
        const m = projectMetrics[i];
        const card = document.querySelector(`[data-metric-id="${CSS.escape(m.id)}"]`);
        if (!card) return;
        const slot = card.querySelector('.spark-slot');
        if (!slot) return;
        const series = (res.snapshots || []).map(s => s.value);
        if (series.length < 2) {
          slot.innerHTML = '<span style="font-size:10px;color:var(--fg2)">no history yet</span>';
        } else {
          const breached = metricBreached(m);
          slot.innerHTML = sparkline(series, { threshold: m.threshold, color: breached ? 'var(--red)' : 'var(--accent)', width: 200, height: 32 });
        }
      });
    });
  }

  loadProjectTab(defaultProjectTab);
}

function projectTabButton(tab, label, activeTab) {
  const active = tab === activeTab;
  return `<button class="tab-btn ${active ? 'active' : ''}" onclick="switchProjectTab(this,'${tab}')" style="background:none;border:none;border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'};color:${active ? 'var(--accent)' : 'var(--fg2)'};padding:8px 16px;cursor:pointer;font-size:13px">${label}</button>`;
}

function switchProjectTab(btn, tab) {
  btn.parentElement.querySelectorAll('.tab-btn').forEach(b => { b.style.borderBottomColor = 'transparent'; b.style.color = 'var(--fg2)'; });
  btn.style.borderBottomColor = 'var(--accent)'; btn.style.color = 'var(--accent)';
  const explicitAppId = _currentProjectDetail?.explicitAppId || null;
  if (tab === 'kanban') history.replaceState({}, '', projectRouteFor(_projectDetailPath, 'tasks', explicitAppId));
  else if (location.pathname.endsWith('/tasks')) history.replaceState({}, '', projectRouteFor(_projectDetailPath, null, explicitAppId));
  loadProjectTab(tab);
}

async function loadProjectTab(tab) {
  const el = document.getElementById('project-tab-content');
  if (!el) return;
  el.dataset.projectTab = tab;
  try {
    el.classList.remove('md-rendered');
    if (tab === 'project') {
      const res = await fetch(`/api/projects/content?path=${encodeURIComponent(_projectDetailPath)}`);
      const data = await res.json();
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = '13px';
      if (window.marked?.parse) { el.innerHTML = window.marked.parse(data.content || 'No content'); el.classList.add('md-rendered'); }
      else { el.style.whiteSpace = 'pre-wrap'; el.style.fontFamily = 'monospace'; el.textContent = data.content || 'No content'; }
    } else if (tab === 'kanban') {
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = '13px';
      await renderProjectKanban(el);
    } else if (tab === 'sessions') {
      const res = await fetch(`/api/projects/sessions?path=${encodeURIComponent(_projectDetailPath)}`);
      const rows = await res.json();
      if (rows.length === 0) {
        el.innerHTML = `<div style="color:var(--fg2)">No sessions linked to this project.</div>`;
        return;
      }
      let h = `<table style="width:100%;border-collapse:collapse;font-size:13px">`;
      h += `<tr style="border-bottom:2px solid var(--border)"><th style="padding:6px;text-align:left">Session</th><th>Agent</th><th>Status</th><th>Ops</th><th>Time</th><th>Task</th></tr>`;
      for (const s of rows) {
        const sessionIdArg = jsStringAttr(s.sessionId);
        const sessionHref = attrEsc('/sessions/' + encodeURIComponent(s.sessionId || ''));
        h += `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="navigateToSession(${sessionIdArg})" title="Open interactive session">`;
        h += `<td style="padding:6px;font-family:monospace;font-size:11px">${esc((s.sessionId||'').slice(-12))}</td>`;
        h += `<td>${esc(s.agent||'')}</td>`;
        h += `<td>${esc(s.status||'')}</td>`;
        h += `<td>${s.opCount ?? ''}</td>`;
        h += `<td style="color:var(--fg2);font-size:12px">${s.startedAt ? timeAgo(s.startedAt) : ''}</td>`;
        h += `<td style="color:var(--fg2);font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((s.task||'').slice(0,80))}<a href="${sessionHref}" onclick="event.stopPropagation()" style="color:var(--accent);margin-left:8px;text-decoration:none">open</a></td>`;
        h += `</tr>`;
      }
      h += `</table>`;
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = 'inherit';
      el.innerHTML = h;
    }
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red)">Failed: ${e.message}</div>`;
  }
}
