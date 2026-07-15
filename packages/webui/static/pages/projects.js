// ── Projects ──────────────────────────────────────────────────────────

async function loadAgentsTab() {
  const el = document.getElementById('agents-content');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--fg2);padding:24px">Loading agents…</div>';
  try {
    const r = await fetch('/api/agents');
    const agents = await r.json();
    if (agents.error) throw new Error(agents.error);

    // Top header + intro.
    let html = `<div style="margin-bottom:16px">
      <h2 style="margin:0 0 4px;font-size:18px">Agents <span style="color:var(--fg2);font-weight:normal;font-size:13px">(${agents.length})</span></h2>
      <div style="font-size:12px;color:var(--fg2)">Each agent owns a domain. Click a card to talk to them, see their projects, metrics, and recent work.</div>
    </div>`;

    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:12px">`;
    for (const a of agents) {
      const ageMs = a.lastSessionAt ? (Date.now() - a.lastSessionAt) : null;
      const stale = ageMs == null || ageMs > 4 * 3600 * 1000;
      const dotColor = stale ? 'var(--fg2)' : (a.errors4h > 0 ? 'var(--red)' : 'var(--green)');
      const ageLabel = ageMs == null ? 'no recent session' : timeAgo(a.lastSessionAt);

      html += `<div onclick="routeTo('/agents/${esc(a.name)}')" style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px;cursor:pointer;transition:border-color 0.1s;${stale ? 'opacity:0.7' : ''}" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">`;

      // Header: dot + name + model badge.
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="color:${dotColor};font-size:12px">●</span>
        <span style="font-weight:600;font-size:15px">${esc(a.name)}</span>
        ${a.model ? `<span class="model-chip" style="margin-left:auto;font-size:10px">${esc(a.model)}</span>` : ''}
      </div>`;

      // Description.
      if (a.description) {
        html += `<div style="font-size:12px;color:var(--fg2);margin-bottom:10px;line-height:1.4;min-height:34px">${esc(String(a.description).slice(0, 140))}</div>`;
      } else {
        html += `<div style="font-size:12px;color:var(--fg2);margin-bottom:10px;font-style:italic;min-height:34px">No description in agent.json</div>`;
      }

      // Stats row: 4 chips.
      html += `<div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--fg2)">
        <span title="Last session" style="background:var(--bg);padding:2px 8px;border-radius:8px">⏱ ${esc(ageLabel)}</span>
        <span title="Heartbeats in 4h / sessions in 4h" style="background:var(--bg);padding:2px 8px;border-radius:8px">♥ ${a.heartbeats4h}/${a.sessions4h} (4h)</span>
        <span title="Active projects / total" style="background:var(--bg);padding:2px 8px;border-radius:8px;${a.projectsActive > 0 ? 'color:var(--green)' : ''}">📁 ${a.projectsActive}/${a.projectsTotal}</span>
        <span title="Owned metrics; breached count" style="background:var(--bg);padding:2px 8px;border-radius:8px;${a.metricBreached > 0 ? 'color:var(--red)' : ''}">∆ ${a.metricCount}${a.metricBreached > 0 ? ` (${a.metricBreached} ⚠)` : ''}</span>
        ${a.errors4h > 0 ? `<span style="background:var(--bg);padding:2px 8px;border-radius:8px;color:var(--red)" title="Errored sessions in 4h">✗ ${a.errors4h}</span>` : ''}
      </div>`;

      html += `</div>`;
    }
    html += `</div>`;

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red);padding:16px">Failed to load agents: ${esc(e.message)}</div>`;
  }
}

async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    const projects = await res.json();
    const el = document.getElementById('projects-content');

    // Sort: active first, then by updatedAt desc
    const statusOrder = {active:0, blocked:1, paused:2, waiting:3, done:4, complete:5, closed:6};
    projects.sort((a,b) => (statusOrder[a.status]??9) - (statusOrder[b.status]??9) || b.updatedAt - a.updatedAt);

    // Hide only terminal projects by default. Waiting/blocked projects still need
    // operator attention, so keep them visible in the main project list.
    const HIDDEN_STATUSES = new Set(['done', 'complete', 'closed']);
    const hiddenCount = projects.filter(p => HIDDEN_STATUSES.has(p.status)).length;
    const showHidden = document.getElementById('show-hidden-toggle')?.checked ?? false;
    const visible = showHidden ? projects : projects.filter(p => !HIDDEN_STATUSES.has(p.status));

    let html = `<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:var(--fg2);cursor:pointer"><input type="checkbox" id="show-hidden-toggle" onchange="loadProjects()" ${showHidden ? 'checked' : ''}> Show closed (${hiddenCount} done / complete / closed)</label></div>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px">`;
    html += `<tr style="border-bottom:2px solid var(--border);text-align:left">`;
    html += `<th style="padding:8px">Project</th><th>Owner</th><th>Status</th><th>Health</th><th>Milestones</th><th>Metrics</th><th>Iter</th><th>Updated</th>`;
    html += `</tr>`;

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

      html += `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="routeTo('/projects/' + '${attrEsc(projectIdOf(p))}')">` +
        `<td style="padding:8px;font-weight:500">${esc(p.name)}</td>` +
        `<td>${esc(p.owner)}</td>` +
        `<td><span style="color:${statusColor}">${esc(p.status)}</span></td>` +
        `<td><span style="color:${healthColor}">${p.health || '—'}</span></td>` +
        `<td>${msBar}</td>` +
        `<td style="font-size:12px">${p.metrics?.length ? p.metrics.map(m => {
          const name = m.id.split('.').pop();
          if (m.current != null) return `<span style="color:${m.breached ? 'var(--red)' : 'var(--green)'}">${name}: ${Number(m.current).toFixed(2)} ${m.breached ? '\u2717' : '\u2713'}</span>`;
          return `<span style="color:var(--fg2)">${name}: ${m.target || '?'}</span>`;
        }).join(', ') : '\u2014'}</td>` +
        `<td>${p.iteration}</td>` +
        `<td style="color:var(--fg2);font-size:12px">${timeAgo(p.updatedAt)}</td>` +
        `</tr>`;
    }
    html += `</table>`;
    el.innerHTML = html;
  } catch(e) {
    document.getElementById('projects-content').innerHTML = `<div style="color:var(--red)">Failed to load projects: ${e.message}</div>`;
  }
}

function projectIdFromPath(path) {
  return projectIdOf({ path: path || '' });
}

function projectRouteFor(path, surface) {
  const id = projectIdFromPath(path);
  const suffix = surface && surface !== 'project' ? `/${surface}` : '';
  return `/projects/${id.split('/').map(encodeURIComponent).join('/')}${suffix}`;
}

async function showProjectDetail(path, initialTab) {
  _projectDetailPath = path;
  const el = document.getElementById('projects-content');
  el.innerHTML = '<div style="color:var(--fg2);padding:24px">Loading project…</div>';

  // Fetch the rollup first — we need it for the header card.
  let detail = null;
  try {
    const r = await fetch(`/api/projects/detail?path=${encodeURIComponent(path)}`);
    detail = await r.json();
    if (detail.error) throw new Error(detail.error);
    _currentProjectDetail = detail;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red);padding:16px">Failed to load project: ${esc(e.message)}</div>`;
    return;
  }

  // Status badge color.
  const statusColors = {
    active: 'var(--green)', running: 'var(--green)',
    waiting: 'var(--orange,#e8a44c)', blocked: 'var(--red)', paused: 'var(--orange,#e8a44c)',
    done: 'var(--fg2)', complete: 'var(--fg2)', closed: 'var(--fg2)',
  };
  const statusColor = statusColors[detail.status] || 'var(--fg2)';
  const milestonePct = detail.milestonesTotal > 0 ? Math.round(100 * detail.milestonesDone / detail.milestonesTotal) : 0;

  let html = '';

  // Back button row.
  html += `<button onclick="routeTo('/projects')" style="margin-bottom:12px;padding:4px 12px;background:var(--bg3,#222);border:1px solid var(--border);border-radius:4px;color:var(--fg);cursor:pointer;font-size:12px">← All projects</button>`;

  // ── Header card ──
  html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:14px">`;
  // Title row.
  html += `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">`;
  html += `<h2 style="margin:0;font-size:18px">${esc(detail.name)}</h2>`;
  html += `<span style="color:${statusColor};font-size:11px;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;background:var(--bg);padding:2px 8px;border:1px solid ${statusColor};border-radius:10px">${esc(detail.status || 'unknown')}</span>`;
  if (detail.priority) html += `<span style="color:var(--fg2);font-size:11px;background:var(--bg);padding:2px 7px;border-radius:10px">${esc(detail.priority)}</span>`;
  if (detail.workflow) html += `<span style="color:var(--fg2);font-size:11px;background:var(--bg);padding:2px 7px;border-radius:10px">workflow: ${esc(detail.workflow)}</span>`;
  html += `</div>`;
  // Owner / dates / iteration row.
  html += `<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--fg2);margin-top:6px">`;
  html += `<span>owner: <a href="/agents/${esc(detail.owner)}" style="color:var(--accent);text-decoration:none">${esc(detail.owner)}</a></span>`;
  html += `<span>iteration ${detail.iteration ?? 0}</span>`;
  html += `<span title="Sessions tagged with projectId; +mentions = task body references this project but wasn't dispatched through it">${detail.sessionCount} sessions${detail.mentionCount ? ` (+${detail.mentionCount} mentions)` : ''}</span>`;
  if (detail.updatedAt) html += `<span>updated ${esc(timeAgo(detail.updatedAt))}</span>`;
  if (detail.createdAt) html += `<span>created ${esc(timeAgo(detail.createdAt))}</span>`;
  html += `</div>`;
  // Goal.
  if (detail.goal) {
    html += `<div style="margin-top:10px;padding:10px 12px;background:var(--bg);border-left:3px solid var(--accent);border-radius:4px;font-size:13px;line-height:1.5">`;
    html += `<div style="font-size:10px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Goal</div>`;
    // Render as markdown if available, else plaintext.
    const goalHtml = window.marked && window.marked.parse ? window.marked.parse(detail.goal) : '<pre style="white-space:pre-wrap;margin:0;font-family:inherit">' + esc(detail.goal) + '</pre>';
    html += `<div class="md-rendered" style="font-size:13px">${goalHtml}</div>`;
    html += `</div>`;
  }
  // Current state.
  if (detail.currentState) {
    html += `<div style="margin-top:10px;padding:10px 12px;background:var(--bg);border-left:3px solid ${statusColor};border-radius:4px;font-size:13px;line-height:1.5">`;
    html += `<div style="font-size:10px;color:${statusColor};font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Current State</div>`;
    const currentStateHtml = window.marked && window.marked.parse ? window.marked.parse(detail.currentState) : '<pre style="white-space:pre-wrap;margin:0;font-family:inherit">' + esc(detail.currentState) + '</pre>';
    html += `<div class="md-rendered" style="font-size:13px;overflow-wrap:anywhere">${currentStateHtml}</div>`;
    html += `</div>`;
  }
  // Milestone progress bar.
  if (detail.milestonesTotal > 0) {
    const barColor = milestonePct === 100 ? 'var(--green)' : (milestonePct >= 50 ? 'var(--accent)' : 'var(--orange,#e8a44c)');
    html += `<div style="margin-top:10px">`;
    html += `<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--fg2);margin-bottom:3px"><span>Milestones</span><span>${detail.milestonesDone} / ${detail.milestonesTotal} · ${milestonePct}%</span></div>`;
    html += `<div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden"><div style="height:100%;background:${barColor};width:${milestonePct}%;transition:width 0.3s"></div></div>`;
    html += `</div>`;
  }
  html += `</div>`;

  // ── Metrics row ──
  const allProjectMetrics = [...(detail.ownedMetrics || []), ...(detail.citedMetricsResolved || [])];
  // De-duplicate by id (a metric could be both owned and cited).
  const metricsById = {};
  for (const m of allProjectMetrics) metricsById[m.id] = m;
  const projectMetrics = Object.values(metricsById);
  if (projectMetrics.length > 0) {
    html += `<div style="margin-bottom:14px">`;
    html += `<h3 style="margin:0 0 8px;font-size:13px;color:var(--fg2);display:flex;align-items:center;gap:8px">Metrics <span style="font-size:11px;font-weight:normal">${detail.ownedMetrics.length} owned${detail.citedMetricsResolved.length > 0 ? `, ${detail.citedMetricsResolved.length} cited` : ''}</span></h3>`;
    html += `<div id="project-metrics-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:8px">`;
    for (const m of projectMetrics) {
      const above = m.alert_op === 'above' || m.alert_op === '>';
      const breached = m.threshold != null && m.current != null && (above ? m.current > m.threshold : m.current < m.threshold);
      const sparkColor = breached ? 'var(--red)' : 'var(--accent)';
      const cited = !detail.ownedMetrics.find(o => o.id === m.id);
      html += `<div data-metric-id="${esc(m.id)}" onclick="showMetricHistory('${esc(m.id)}')" style="background:var(--bg2);border:1px solid ${breached ? 'var(--red)' : 'var(--border)'};border-radius:6px;padding:10px;cursor:pointer" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='${breached ? 'var(--red)' : 'var(--border)'}'">`;
      html += `<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;margin-bottom:2px"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</span>${cited ? '<span style="font-size:9px;color:var(--fg2);background:var(--bg);padding:1px 5px;border-radius:6px">cited</span>' : ''}</div>`;
      html += `<div style="font-size:10px;color:var(--fg2);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.id)}</div>`;
      // Sparkline placeholder — will be filled async after this loop.
      html += `<div class="spark-slot" style="min-height:32px"><span style="font-size:10px;color:var(--fg2)">loading…</span></div>`;
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px"><span style="font-weight:600;${breached ? 'color:var(--red)' : ''}">${m.current ?? '—'}${m.unit||''}</span>${m.threshold != null ? `<span style="color:var(--fg2)">${above ? '≤' : '≥'} ${m.threshold}${m.unit||''}</span>` : ''}</div>`;
      html += `</div>`;
    }
    // Cited but not in DB.
    const unresolved = (detail.citedMetrics || []).filter(id => !metricsById[id]);
    for (const id of unresolved) {
      html += `<div style="background:var(--bg2);border:1px dashed var(--border);border-radius:6px;padding:10px;opacity:0.6">`;
      html += `<div style="font-size:12px;font-weight:500;color:var(--fg2)">${esc(id)}</div>`;
      html += `<div style="font-size:10px;color:var(--fg2);margin-top:4px">cited but not registered as a metric</div>`;
      html += `</div>`;
    }
    html += `</div></div>`;
  }

  // ── Comment input ──
  html += `<div style="margin:0 0 12px;display:flex;gap:8px;align-items:center">`;
  html += `<input id="project-comment" placeholder="Add a comment (auto-resumes blocked/waiting projects)..." style="flex:1;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--fg);font-size:13px" onkeydown="if(event.key==='Enter')addProjectComment()">`;
  html += `<button onclick="addProjectComment()" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap">Comment</button>`;
  html += `</div>`;
  html += `<div id="project-comment-status" style="font-size:12px;margin:-8px 0 8px;display:none"></div>`;

  // ── Sub-tabs ──
  const defaultProjectTab = initialTab === 'tasks' ? 'kanban' : initialTab === 'functions' ? 'functions' : 'project';
  html += `<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:12px">`;
  html += projectTabButton('project', 'Project', defaultProjectTab);
  html += projectTabButton('kanban', 'Tasks', defaultProjectTab);
  html += projectTabButton('functions', 'Functions', defaultProjectTab);
  html += projectTabButton('journal', 'Journal', defaultProjectTab);
  html += projectTabButton('discussion', 'Discussion', defaultProjectTab);
  const totalSessionLink = (detail.sessionCount || 0) + (detail.mentionCount || 0);
  html += projectTabButton('lineage', 'Lineage', defaultProjectTab);
  html += projectTabButton('sessions', `Sessions${totalSessionLink ? ` <span style="font-size:10px;background:var(--bg);padding:1px 6px;border-radius:8px;margin-left:4px">${totalSessionLink}</span>` : ''}`, defaultProjectTab);
  html += projectTabButton('learning', 'Learning', defaultProjectTab);
  html += `</div>`;
  html += `<div id="project-tab-content" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px"></div>`;

  el.innerHTML = html;

  // Async: fetch sparklines for project metrics and inject into slots.
  if (projectMetrics.length > 0) {
    Promise.all(projectMetrics.map(m =>
      fetch(`/api/metrics/${encodeURIComponent(m.id)}/history?days=7`).then(r => r.json()).catch(() => ({snapshots:[]}))
    )).then(results => {
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
          const above = m.alert_op === 'above' || m.alert_op === '>';
          const breached = m.threshold != null && m.current != null && (above ? m.current > m.threshold : m.current < m.threshold);
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
  if (tab === 'kanban') history.replaceState({}, '', projectRouteFor(_projectDetailPath, 'tasks'));
  else if (tab === 'functions') history.replaceState({}, '', projectRouteFor(_projectDetailPath, 'functions'));
  else if (location.pathname.endsWith('/tasks') || location.pathname.endsWith('/functions')) history.replaceState({}, '', projectRouteFor(_projectDetailPath));
  loadProjectTab(tab);
}

async function loadProjectTab(tab) {
  const el = document.getElementById('project-tab-content');
  if (!el) return;
  try {
    el.classList.remove('md-rendered');
    if (tab === 'project') {
      const res = await fetch(`/api/projects/content?path=${encodeURIComponent(_projectDetailPath)}`);
      const data = await res.json();
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = '13px';
      if (window.marked?.parse) { el.innerHTML = window.marked.parse(data.content || 'No content'); el.classList.add('md-rendered'); }
      else { el.style.whiteSpace = 'pre-wrap'; el.style.fontFamily = 'monospace'; el.textContent = data.content || 'No content'; }
    } else if (tab === 'journal') {
      const res = await fetch(`/api/projects/journal?path=${encodeURIComponent(_projectDetailPath)}`);
      const data = await res.json();
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = '13px';
      if (window.marked?.parse) { el.innerHTML = window.marked.parse(data.content || 'No journal'); el.classList.add('md-rendered'); }
      else { el.style.whiteSpace = 'pre-wrap'; el.style.fontFamily = 'monospace'; el.textContent = data.content || 'No journal'; }
    } else if (tab === 'discussion') {
      const res = await fetch(`/api/projects/discussion?path=${encodeURIComponent(_projectDetailPath)}`);
      const data = await res.json();
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = '13px';
      if (window.marked?.parse) { el.innerHTML = window.marked.parse(data.content || 'No discussion yet'); el.classList.add('md-rendered'); }
      else { el.style.whiteSpace = 'pre-wrap'; el.style.fontFamily = 'monospace'; el.textContent = data.content || 'No discussion yet'; }
    } else if (tab === 'learning') {
      await renderProjectLearning(el);
    } else if (tab === 'kanban') {
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = '13px';
      await renderProjectKanban(el);
    } else if (tab === 'functions') {
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = '13px';
      await renderProjectFunctions(el);
    } else if (tab === 'lineage') {
      const res = await fetch(`/api/projects/lineage?path=${encodeURIComponent(_projectDetailPath)}`);
      const data = await res.json();
      if (data.error) { el.innerHTML = `<div style="color:var(--red)">${esc(data.error)}</div>`; return; }
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = 'inherit';
      renderProjectLineage(el, data);
    } else if (tab === 'sessions') {
      const res = await fetch(`/api/projects/sessions?path=${encodeURIComponent(_projectDetailPath)}`);
      const rows = await res.json();
      if (rows.length === 0) {
        el.innerHTML = `<div style="color:var(--fg2)">
          <p style="margin:0 0 8px">No sessions linked to this project.</p>
          <p style="margin:0;font-size:12px">Sessions are linked two ways:</p>
          <ul style="font-size:12px;margin:4px 0 0 20px">
            <li><b>Tagged</b>: dispatched through this project's workflow (sets <code>sessions.projectId</code>).</li>
            <li><b>Mention</b>: task body references the project name. Best-effort; only shown for projects with name length ≥ 6.</li>
          </ul>
          <p style="margin:8px 0 0;font-size:12px;color:var(--fg2)">If you expected work here, the project may not be wired into a workflow yet.</p>
        </div>`;
        return;
      }
      // Group: tagged first, then mentions, then workflow-file fallbacks.
      const tagged = rows.filter(r => r.link === 'tagged' || !r.link);
      const mentions = rows.filter(r => r.link === 'mention');
      const workflow = rows.filter(r => r.link === 'workflow-file');
      let html = '';
      const renderTable = (group, label, hint, badgeColor) => {
        if (group.length === 0) return '';
        let h = `<div style="margin-bottom:14px">`;
        h += `<h4 style="margin:0 0 4px;font-size:12px;color:var(--fg2);display:flex;align-items:center;gap:6px"><span style="background:${badgeColor};color:#000;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:600">${label}</span><span style="color:var(--fg2);font-size:11px;font-weight:normal">${group.length} · ${hint}</span></h4>`;
        h += `<table style="width:100%;border-collapse:collapse;font-size:13px">`;
        h += `<tr style="border-bottom:2px solid var(--border)"><th style="padding:6px;text-align:left">Session</th><th>Agent</th><th>Status</th><th>Ops</th><th>Time</th><th>Task</th></tr>`;
        for (const s of group) {
          const sessionIdArg = jsStringAttr(s.sessionId);
          const sessionHref = attrEsc('/sessions/' + encodeURIComponent(s.sessionId || ''));
          h += `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="openSessionRoute(${sessionIdArg})" title="Open interactive session">`;
          h += `<td style="padding:6px;font-family:monospace;font-size:11px">${esc((s.sessionId||'').slice(-12))}</td>`;
          h += `<td>${esc(s.agent||'')}</td>`;
          h += `<td>${esc(s.status||'')}</td>`;
          h += `<td>${s.opCount ?? ''}</td>`;
          h += `<td style="color:var(--fg2);font-size:12px">${s.startedAt ? timeAgo(s.startedAt) : ''}</td>`;
          h += `<td style="color:var(--fg2);font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((s.task||'').slice(0,80))}<a href="${sessionHref}" onclick="event.stopPropagation()" style="color:var(--accent);margin-left:8px;text-decoration:none">open</a></td>`;
          h += `</tr>`;
        }
        h += `</table></div>`;
        return h;
      };
      html += renderTable(tagged,   'TAGGED',   'dispatched through this project',                      'var(--green)');
      html += renderTable(mentions, 'MENTION',  'task body references this project (not dispatched here)', 'var(--orange,#e8a44c)');
      html += renderTable(workflow, 'WORKFLOW', 'recovered from workflow run files',                     'var(--accent)');
      el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = 'inherit';
      el.innerHTML = html;
    }
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red)">Failed: ${e.message}</div>`;
  }
}

async function renderProjectFunctions(el) {
  const detail = _currentProjectDetail || {};
  const projectId = projectIdFromPath(_projectDetailPath);
  const domainUiHref = `/projects/${projectId.split('/').map(encodeURIComponent).join('/')}/ui/`;
  const hasDomainUi = detail.app?.hasUi !== false;
  const actions = Array.isArray(detail.app?.actions) ? detail.app.actions : [];
  let html = `<div class="project-functions">
    <div class="function-surface-grid">
      <a class="function-card" href="${attrEsc(domainUiHref)}">
        <b>Domain UI</b>
        <span>${hasDomainUi ? 'Open the project-owned UI surface.' : 'Conventional project UI path. The project may not expose one yet.'}</span>
        <code>${esc(domainUiHref)}</code>
      </a>
      <button class="function-card" onclick="emitProjectPlanningRequest()">
        <b>Request Planning</b>
        <span>Emit a project planning event for the project owner agent.</span>
        <code>project.owner.requested</code>
      </button>
    </div>`;

  html += `<div class="function-panel">
    <h3>Action Bridge</h3>
    <p>Project actions enter through <code>POST /api/events</code>. The project app owns validation, handlers, and side effects.</p>`;
  if (actions.length) {
    html += `<div class="action-list">`;
    for (const action of actions) {
      html += `<button class="action-row" onclick="selectProjectAction(${jsStringAttr(action.id)})">
        <b>${esc(action.id)}</b>
        <span>${esc(action.description || action.type || 'Project app action')}</span>
      </button>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="empty-state">No declared actions were detected in this project app. You can still emit a named action below.</div>`;
  }
  html += `<div class="action-form">
    <label>Action id<input id="project-action-id" value="${actions[0] ? esc(actions[0].id) : ''}" placeholder="review-library"></label>
    <label>Params JSON<textarea id="project-action-params" placeholder='{"reason":"manual review"}'>{}</textarea></label>
    <button onclick="emitProjectAction()">Emit Action Event</button>
    <span id="project-action-status"></span>
  </div></div></div>`;
  el.innerHTML = html;
}

function selectProjectAction(actionId) {
  const input = document.getElementById('project-action-id');
  if (input) input.value = actionId || '';
}

async function emitProjectPlanningRequest() {
  await emitProjectActionEvent('project.owner.requested', 'manual-functions-page', {});
}

async function emitProjectAction() {
  const action = document.getElementById('project-action-id')?.value?.trim();
  const paramsText = document.getElementById('project-action-params')?.value || '{}';
  const status = document.getElementById('project-action-status');
  if (!action) {
    if (status) status.textContent = 'Action id required.';
    return;
  }
  let params = {};
  try {
    params = JSON.parse(paramsText || '{}');
  } catch (e) {
    if (status) status.textContent = `Invalid JSON: ${e.message}`;
    return;
  }
  await emitProjectActionEvent('project.action.invoked', action, params);
}

async function emitProjectActionEvent(type, action, params) {
  const status = document.getElementById('project-action-status');
  if (status) status.textContent = 'Sending...';
  try {
    const project = projectIdFromPath(_projectDetailPath).replace(/\.app$/, '');
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        source: 'web-ui',
        data: {
          projectPath: _projectDetailPath,
          project,
          projectId: project,
          action,
          params,
          reason: action,
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);
    if (status) status.innerHTML = `Accepted${body.workflowRunId ? ` · workflow <code>${esc(body.workflowRunId)}</code>` : ''}`;
    toast('Project event accepted', 'ok');
  } catch (e) {
    if (status) status.textContent = `Failed: ${e.message}`;
    toast(`Project event failed: ${e.message}`, 'error');
  }
}


function openSessionRoute(sessionId) {
  if (!sessionId) return;
  routeTo('/sessions/' + encodeURIComponent(sessionId));
}

// ── Project Lineage ────────────────────────────────────────────────────
// Renders the full causal session list for a project as a top-down
// timeline. Each row: timestamp · link badge · agent · status dot ·
// session id · task snippet. Click expands inline session_digests.
//
// 'link' provenance encodes how this session was associated:
//   tagged    — sessions.projectId set (canonical)
//   workflow  — dispatched by a workflow run that mentions the project
//   file-read — the agent read a file inside the project dir
//   child     — spawned by a session already on the list
//   mention   — task body mentions the project name
function renderProjectLineage(el, data) {
  const sessions = data.sessions || [];
  const digestsBySession = data.digestsBySession || {};
  const byLink = data.byLink || {};

  if (sessions.length === 0) {
    el.innerHTML = `<div style="color:var(--fg2);padding:16px">
      <p style="margin:0 0 8px"><b>No sessions found</b> for this project across any signal.</p>
      <p style="margin:0;font-size:12px">We checked: tagged projectId, workflow_runs mentioning the project,
      file_reads inside the project dir, task body mentions, and child sessions of any of the above.</p>
      <p style="margin:8px 0 0;font-size:12px">If you expected work, the project may not have started or its file paths haven't been touched yet.</p>
    </div>`;
    return;
  }

  // Header chips: link distribution at a glance.
  const linkColors = {
    tagged: { bg: 'var(--green)', fg: '#000' },
    workflow: { bg: 'var(--accent)', fg: '#fff' },
    'file-read': { bg: 'var(--orange,#e8a44c)', fg: '#000' },
    child: { bg: 'var(--bg3,#222)', fg: 'var(--fg)' },
    mention: { bg: 'var(--bg2)', fg: 'var(--fg2)' },
  };
  const linkExplain = {
    tagged: 'sessions.projectId set (workflow dispatched)',
    workflow: 'workflow run task references this project',
    'file-read': 'agent read a file inside this project',
    child: 'child of another session on this list',
    mention: 'task body mentions the project name',
  };

  let html = '';
  html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;font-size:11px;align-items:center">`;
  html += `<span style="color:var(--fg2)">${sessions.length} sessions — by link:</span>`;
  for (const link of ['tagged', 'workflow', 'file-read', 'child', 'mention']) {
    if (!byLink[link]) continue;
    const c = linkColors[link];
    html += `<span title="${esc(linkExplain[link])}" style="background:${c.bg};color:${c.fg};padding:2px 8px;border-radius:8px;font-weight:600;font-size:10px">${esc(link)} · ${byLink[link]}</span>`;
  }
  html += `</div>`;

  // Group by day for readable scrolling.
  let lastDay = '';
  html += `<div style="position:relative">`;
  html += `<div style="position:absolute;left:90px;top:0;bottom:0;width:2px;background:var(--border)"></div>`;
  for (const s of sessions) {
    const d = new Date(s.startedAt || 0);
    const day = d.toISOString().slice(0, 10);
    if (day !== lastDay) {
      html += `<div style="position:relative;padding:10px 0 4px 110px;font-size:11px;color:var(--fg2);font-weight:600">${esc(day)}</div>`;
      lastDay = day;
    }
    const time = d.toTimeString().slice(0, 5);
    const c = linkColors[s.link] || linkColors.mention;
    const statusColor = s.status === 'error' ? 'var(--red)' : (s.status === 'done' ? 'var(--fg2)' : 'var(--green)');
    const taskSnippet = (s.task || '').replace(/\n/g, ' ').slice(0, 110);
    const digests = digestsBySession[s.sessionId] || [];

    html += `<div style="position:relative;padding:6px 0 6px 110px;border-bottom:1px solid var(--border)">`;
    // Time on the left of the spine.
    html += `<div style="position:absolute;left:0;top:8px;width:84px;text-align:right;font-size:11px;color:var(--fg2);font-family:monospace">${esc(time)}</div>`;
    // Dot on the spine.
    html += `<div style="position:absolute;left:86px;top:11px;width:10px;height:10px;border-radius:50%;background:${c.bg};border:2px solid var(--bg)"></div>`;
    // Body.
    html += `<div onclick="toggleLineageDigest(this, '${esc(s.sessionId)}')" style="cursor:pointer">`;
    html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px">`;
    html += `<span style="background:${c.bg};color:${c.fg};padding:1px 7px;border-radius:8px;font-size:9px;font-weight:600;text-transform:uppercase">${esc(s.link)}</span>`;
    html += `<span style="color:${statusColor};font-size:8px">●</span>`;
    html += `<a href="/agents/${esc(s.agent || '')}" style="color:var(--accent);text-decoration:none;font-weight:500" onclick="event.stopPropagation()">${esc(s.agent || '?')}</a>`;
    html += `<span style="color:var(--fg2);font-family:monospace;font-size:11px">${esc((s.sessionId||'').slice(-12))}</span>`;
    if (s.kind && s.kind !== 'call') html += `<span style="color:var(--fg2);font-size:10px">${esc(s.kind)}</span>`;
    if (s.opCount != null) html += `<span style="color:var(--fg2);font-size:10px" title="operations">${s.opCount} ops</span>`;
    if (digests.length > 0) html += `<span style="font-size:10px;color:var(--accent)" title="${digests.length} digest entries available">≡ ${digests.length}</span>`;
    html += `<a href="/sessions/${esc(s.sessionId)}" onclick="event.stopPropagation()" style="margin-left:auto;color:var(--fg2);text-decoration:none;font-size:11px">open →</a>`;
    html += `</div>`;
    html += `<div style="font-size:11px;color:var(--fg2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">${esc(taskSnippet)}</div>`;
    html += `</div>`;
    // Digest container (lazy-revealed).
    html += `<div data-digest-for="${esc(s.sessionId)}" style="display:none;margin-top:8px;padding:10px 12px;background:var(--bg);border-left:3px solid ${c.bg};border-radius:4px;font-size:12px"></div>`;
    html += `</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
  // Stash digests in window for the toggle handler.
  window._lineageDigests = digestsBySession;
}

function toggleLineageDigest(triggerEl, sessionId) {
  const container = triggerEl.parentElement.querySelector(`[data-digest-for]`);
  if (!container) return;
  if (container.style.display === 'none') {
    container.style.display = 'block';
    if (!container.dataset.rendered) {
      const digests = (window._lineageDigests || {})[sessionId] || [];
      let h = '';
      if (digests.length === 0) {
        h = `<div style="color:var(--fg2);font-style:italic">No session_digests recorded for this session. <a href="/sessions/${esc(sessionId)}" style="color:var(--accent)">Open full session →</a></div>`;
      } else {
        for (const d of digests) {
          h += `<div style="margin-bottom:8px">`;
          h += `<div style="font-size:10px;color:var(--fg2);margin-bottom:2px">step ${d.step ?? '?'} · ${esc(d.trigger || '')} · ${esc(d.outcome || 'in_progress')}</div>`;
          if (d.what_happened) h += `<div style="font-size:12px;line-height:1.4"><b>did:</b> ${esc(String(d.what_happened).slice(0, 400))}</div>`;
          if (d.still_open) h += `<div style="font-size:12px;line-height:1.4;color:var(--orange,#e8a44c)"><b>still open:</b> ${esc(String(d.still_open).slice(0, 400))}</div>`;
          if (d.action) h += `<div style="font-size:12px;line-height:1.4"><b>next:</b> ${esc(String(d.action).slice(0, 200))}${d.action_reason ? ' — ' + esc(String(d.action_reason).slice(0,200)) : ''}</div>`;
          h += `</div>`;
        }
      }
      container.innerHTML = h;
      container.dataset.rendered = '1';
    }
  } else {
    container.style.display = 'none';
  }
}

async function addProjectComment() {
  const input = document.getElementById('project-comment');
  const statusEl = document.getElementById('project-comment-status');
  const comment = input.value.trim();
  if (!comment) return;
  input.disabled = true;
  statusEl.style.display = 'none';
  try {
    const res = await fetch('/api/projects/comment', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ path: _projectDetailPath, comment })
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || data.triggerError || `HTTP ${res.status}`);
    input.value = '';
    if (data.accepted) {
      statusEl.textContent = '✅ Comment accepted — project owner will process the event';
      statusEl.style.color = 'var(--green)';
    } else if (data.triggered) {
      statusEl.textContent = '⚠️ Comment event sent, acceptance not confirmed';
      statusEl.style.color = 'var(--orange)';
    } else {
      statusEl.textContent = '⚠️ Comment added — trigger not confirmed';
      statusEl.style.color = 'var(--fg2)';
    }
    statusEl.style.display = 'block';
    setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    loadProjectTab('project');
  } catch(e) {
    statusEl.textContent = '❌ Failed: ' + e.message;
    statusEl.style.color = 'var(--red)';
    statusEl.style.display = 'block';
  } finally {
    input.disabled = false;
    input.focus();
  }
}
