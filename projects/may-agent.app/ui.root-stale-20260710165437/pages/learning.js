// ── Learning ───────────────────────────────────────────────────────────
function learningStat(label, value, sub, tone = '') {
  return `<div class="learning-card ${tone}"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
}

function learningChip(text, cls = '') {
  if (!text) return '';
  return `<span class="learning-chip ${esc(cls)}">${esc(text)}</span>`;
}

function learningEntries(map, max = 8) {
  return Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, max);
}

function renderLearningBreakdown(title, map) {
  const entries = learningEntries(map);
  const max = Math.max(1, ...entries.map(([, n]) => Number(n || 0)));
  let html = `<div class="learning-panel"><h3>${esc(title)}</h3><div class="learning-breakdown">`;
  if (!entries.length) html += `<div class="learning-muted">No data in this window.</div>`;
  for (const [key, value] of entries) {
    const pct = Math.max(3, Math.round(Number(value || 0) / max * 100));
    html += `<div class="learning-bar-row"><div class="learning-bar-label" title="${attrEsc(key)}">${esc(key)}</div><div class="learning-muted" style="text-align:right">${value}</div><div class="learning-bar-track"><div class="learning-bar-fill" style="width:${pct}%"></div></div></div>`;
  }
  html += `</div></div>`;
  return html;
}

function renderLearningTimeline(rows) {
  const data = rows || [];
  const max = Math.max(1, ...data.map(r => Number(r.findings || 0) + Number(r.high || 0)));
  let html = `<div class="learning-panel"><h3>Trend</h3><div class="learning-timeline">`;
  for (const row of data) {
    const findings = Number(row.findings || 0);
    const high = Number(row.high || 0);
    const normalH = Math.max(2, Math.round((findings / max) * 58));
    const highH = high ? Math.max(2, Math.round((high / max) * 58)) : 0;
    const label = String(row.date || '').slice(5);
    html += `<div class="learning-day" title="${attrEsc(row.date || '')}: ${findings} findings, ${high} high"><div class="learning-day-bar" style="height:${normalH}px"></div>${high ? `<div class="learning-day-bar high" style="height:${highH}px"></div>` : ''}<div class="learning-day-label">${esc(label)}</div></div>`;
  }
  html += `</div></div>`;
  return html;
}

function renderLearningFindings(findings) {
  let html = `<div class="learning-panel"><h3>Owner Findings</h3>`;
  if (!findings || findings.length === 0) return html + `<div class="learning-muted">No findings in this window.</div></div>`;
  html += `<div class="learning-finding-list">`;
  for (const f of findings) {
    const action = (f.suggestedActions || [])[0] || '';
    const sessionHref = `#/sessions/${encodeURIComponent(f.sessionId || '')}`;
    html += `<div class="learning-finding-row">`;
    const scope = String(f.scope || 'unknown');
    const id = String(f.id || 'finding');
    const idChip = id.replace(/-/g, '_') === scope ? '' : learningChip(id);
    html += `<div class="learning-finding-main">`;
    html += `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px">${learningChip(f.severity, f.severity)}${learningChip(scope)}${idChip}${f.notified ? learningChip('sent', 'ok') : ''}</div>`;
    html += `<div class="finding-text">${esc(f.finding || '')}</div>`;
    if (action) html += `<div class="learning-actions">${esc(action)}</div>`;
    html += `</div>`;
    html += `<div class="learning-finding-meta">`;
    html += `<div class="learning-meta-line"><b>Owner</b><span title="${attrEsc(f.owner || '')}">${esc(f.owner || '')}</span></div>`;
    html += `<div class="learning-meta-line"><b>Agent</b><span>${esc(f.agent || '')}</span></div>`;
    html += `<div class="learning-meta-line"><b>Project</b><span title="${attrEsc(f.projectId || '')}">${esc(f.projectId || '')}</span></div>`;
    html += `<div class="learning-meta-line"><b>Session</b><span><a href="${sessionHref}">${esc(String(f.sessionId || '').slice(-12))}</a></span></div>`;
    html += `<div class="learning-meta-line"><b>Status</b><span>${esc(f.sessionStatus || '')}${f.createdAt ? ' · ' + esc(timeAgo(f.createdAt)) : ''}</span></div>`;
    html += `</div>`;
    html += `</div>`;
  }
  html += `</div></div>`;
  return html;
}

function renderLearningGuardSignals(rows) {
  let html = `<div class="learning-panel"><h3>Guard Signals</h3>`;
  if (!rows || rows.length === 0) return html + `<div class="learning-muted">No guard signals in this window.</div></div>`;
  html += `<div class="learning-muted" style="font-size:12px;margin-bottom:10px">Unreviewed detector output. Review before turning into owner feedback.</div>`;
  html += `<table class="learning-table"><tr><th>Signal</th><th>Reason</th><th>Context</th><th>Review</th></tr>`;
  for (const g of rows.slice(0, 12)) {
    const blocked = g.action === 'blocked' || g.demandType === 'block';
    const sessionId = String(g.sessionId || '');
    const sessionHref = sessionId ? `#/sessions/${encodeURIComponent(sessionId)}` : '';
    const when = g.createdAt ? timeAgo(Number(g.createdAt)) : '';
    const absoluteWhen = g.createdAt ? new Date(Number(g.createdAt)).toLocaleString() : '';
    const signal = [g.action || 'triggered', g.guard || 'guard'].filter(Boolean).join(' · ');
    const context = [
      g.owner ? `owner: ${g.owner}` : '',
      g.projectId ? `project: ${g.projectId}` : '',
      g.sourceEventType ? `source: ${g.sourceEventType}` : '',
    ].filter(Boolean).join(' · ');
    html += `<tr>`;
    html += `<td style="min-width:145px">${learningChip(g.action || 'triggered', blocked ? 'medium' : '')}<div style="margin-top:5px;font-weight:600">${esc(g.guard || 'guard')}</div></td>`;
    html += `<td><div style="line-height:1.35;overflow-wrap:anywhere">${esc(g.reason || '')}</div></td>`;
    html += `<td style="min-width:190px"><div class="learning-muted" title="${attrEsc(context)}">${esc(context || 'no project context')}</div>${sessionHref ? `<div style="margin-top:5px"><a href="${sessionHref}" title="${attrEsc(sessionId)}">${esc(sessionId)}</a></div>` : ''}${when ? `<div class="learning-muted" title="${attrEsc(absoluteWhen)}">${esc(when)}</div>` : ''}</td>`;
    html += `<td style="min-width:120px">${learningChip(g.reviewStatus || 'unreviewed', 'medium')}<div class="learning-muted" style="margin-top:5px">signal, not finding</div></td>`;
    html += `</tr>`;
  }
  html += `</table></div>`;
  return html;
}

function renderLearningBacklog(rows) {
  let html = `<div class="learning-panel"><h3>Evaluation Backlog</h3>`;
  if (!rows || rows.length === 0) return html + `<div class="learning-muted">No unevaluated terminal sessions in this window.</div></div>`;
  html += `<table class="learning-table"><tr><th>Session</th><th>Agent</th><th>Status</th><th>Project</th></tr>`;
  for (const s of rows.slice(0, 12)) {
    html += `<tr><td><a href="#/sessions/${encodeURIComponent(s.sessionId || '')}">${esc(String(s.sessionId || '').slice(-12))}</a><div class="learning-muted">${s.startedAt ? esc(timeAgo(s.startedAt)) : ''}</div></td><td>${esc(s.agent || '')}</td><td>${esc(s.status || '')}</td><td>${esc(s.projectId || '')}</td></tr>`;
  }
  html += `</table></div>`;
  return html;
}

function renderLearningDashboard(data, opts = {}) {
  const s = data.summary || {};
  const embedded = !!opts.embedded;
  const title = embedded ? '' : `<div class="learning-toolbar"><b style="font-size:16px;margin-right:auto">Learning</b><span class="learning-muted">global evaluator coverage, findings, and owner routing</span><select id="learning-days" onchange="loadLearning()"><option value="1">1 day</option><option value="7" selected>7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></div>`;
  let html = title;
  html += `<div class="learning-grid">`;
  html += learningStat('Coverage', `${s.coveragePct || 0}%`, `${s.evaluatedSessions || 0}/${s.terminalSessions || 0} terminal sessions`, (s.coveragePct || 0) < 80 ? 'warn' : '');
  html += learningStat('Backlog', s.backlog || 0, 'terminal sessions without eval', s.backlog ? 'warn' : '');
  html += learningStat('Findings', s.findings || 0, `${s.highFindings || 0} high severity`, s.highFindings ? 'bad' : '');
  html += learningStat('Sent Now', s.immediateFindings || 0, 'owner findings routed');
  html += learningStat('Stale Loops', s.staleBlockerLoops || 0, 'blocked-loop findings', s.staleBlockerLoops ? 'bad' : '');
  html += learningStat('Guard Signals', s.guardSignals || 0, `${s.guardBlocks || 0} block signals · unreviewed`, s.guardSignals ? 'warn' : '');
  html += learningStat('Evaluator Errors', `${s.evaluatorFailureRatePct || 0}%`, `${s.evaluatorFailures || 0}/${s.evaluatorReviewCount || 0} review sessions`, s.evaluatorFailures ? 'warn' : '');
  html += `</div>`;
  html += `<div class="learning-layout"><div style="display:grid;gap:14px">`;
  html += renderLearningFindings(data.findings || []);
  html += renderLearningGuardSignals(data.guardSignals || []);
  html += renderLearningBacklog(data.backlogSessions || []);
  html += `</div><div style="display:grid;gap:14px">`;
  html += renderLearningTimeline(data.timeline || []);
  html += renderLearningBreakdown('By Guard', data.breakdowns?.byGuard || {});
  html += renderLearningBreakdown('By Scope', data.breakdowns?.byScope || {});
  html += renderLearningBreakdown('By Owner', data.breakdowns?.byOwner || {});
  html += renderLearningBreakdown('By Severity', data.breakdowns?.bySeverity || {});
  if ((data.recurring || []).length) {
    html += `<div class="learning-panel"><h3>Recurring</h3><div class="learning-breakdown">`;
    for (const r of data.recurring.slice(0, 8)) html += `<div style="font-size:12px"><span class="learning-muted">${esc(r.count)}x</span> ${esc(r.key)}</div>`;
    html += `</div></div>`;
  }
  html += `</div></div>`;
  return html;
}

async function loadLearning(projectId = null, targetId = 'learning-content') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const dayEl = document.getElementById('learning-days');
  const days = projectId ? 30 : (dayEl?.value || '7');
  el.innerHTML = `<div class="learning-muted" style="padding:18px">Loading learning signals...</div>`;
  try {
    const params = new URLSearchParams({ days, limit: '200' });
    if (projectId) params.set('projectId', projectId);
    const r = await fetch('/api/learning?' + params.toString());
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    el.innerHTML = renderLearningDashboard(data, { embedded: !!projectId });
    if (!projectId) {
      const select = document.getElementById('learning-days');
      if (select) select.value = String(days);
    }
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red);padding:16px">Failed to load learning: ${esc(e.message || String(e))}</div>`;
  }
}

async function renderProjectLearning(el) {
  const projectId = _currentProjectDetail?.projectId;
  if (!projectId) { el.innerHTML = `<div class="learning-muted">Project id unavailable.</div>`; return; }
  el.classList.remove('md-rendered');
  el.style.whiteSpace = 'normal'; el.style.fontFamily = 'inherit'; el.style.fontSize = 'inherit';
  el.innerHTML = `<div id="project-learning-content"></div>`;
  await loadLearning(projectId, 'project-learning-content');
}
