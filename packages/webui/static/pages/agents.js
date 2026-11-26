// Agent roster & detail inspector; only the configured interface agent exposes Conversation.
let currentAgentSubTab = 'chat';
let currentAgentChat = null;
let cachedAgentsCatalog = [];
let agentsGroupMode = 'team'; // 'team' | 'grid' | 'active'
let agentsSearchQuery = '';

function formatAgentMetricValue(value, unit) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (unit === 'ratio') return (n * 100).toFixed(n === 0 || n === 1 ? 0 : 1).replace(/\.0$/, '') + '%';
  if (unit === 'usd') return '$' + (n >= 10 ? n.toFixed(2) : n.toFixed(3));
  if (unit === 'seconds') return n < 1 ? Math.round(n * 1000) + 'ms' : (n < 60 ? n.toFixed(1).replace(/\.0$/, '') + 's' : (n / 60).toFixed(1) + 'm');
  if (unit === 'milliseconds' || unit === 'ms') return n >= 1000 ? (n / 1000).toFixed(1) + 's' : Math.round(n) + 'ms';
  if (unit === 'percent') return n.toFixed(1).replace(/\.0$/, '') + '%';
  const numStr = Math.abs(n) < 10 && n % 1 !== 0 ? n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') : String(Math.round(n));
  return numStr + (unit && unit !== 'count' ? ' ' + unit : '');
}

function setAgentsGroupMode(mode) {
  agentsGroupMode = mode;
  renderAgentsRoster();
}

function setAgentsSearch(val) {
  agentsSearchQuery = String(val || '');
  renderAgentsRoster(true);
}

function renderAgentRoleBadge(a) {
  const isInterface = typeof humanInterface !== 'undefined' && humanInterface?.agent === a.name;
  if (isInterface) return `<span class="agent-role-pill interface">Interface · Owner</span>`;
  if (a.roleKind === 'app-owner' && a.homeApp) return `<span class="agent-role-pill owner">App Owner · ${esc(a.homeApp)}</span>`;
  if (a.homeApp) return `<span class="agent-role-pill specialist">Specialist · ${esc(a.homeApp)}</span>`;
  return `<span class="agent-role-pill global">Global</span>`;
}

function renderAgentCard(a) {
  const lastTs = a.lastActivityAt || a.lastSessionAt || null;
  const ageMs = lastTs ? (Date.now() - lastTs) : null;
  const runningNow = (a.runningNow || 0) > 0;
  const stale = !runningNow && (ageMs == null || ageMs > 4 * 3600 * 1000);
  const dotColor = a.errors4h > 0 ? 'var(--red)' : runningNow ? '#39c5cf' : stale ? 'var(--fg2)' : 'var(--green)';
  const ageLabel = runningNow ? `${a.runningNow} running now` : ageMs == null ? 'idle' : timeAgo(lastTs);

  const ts = a.tasksSummary || {};
  const taskParts = [];
  if (ts.running) taskParts.push(`<b style="color:#39c5cf">${ts.running} run</b>`);
  if (ts.attention) taskParts.push(`<b style="color:var(--yellow)">${ts.attention} attn</b>`);
  if (ts.waiting) taskParts.push(`${ts.waiting} wait`);
  if (ts.pending) taskParts.push(`${ts.pending} pend`);
  const taskStrip = taskParts.length
    ? `Tasks: ${taskParts.join(' · ')}${ts.idle ? ` · ${ts.idle} idle` : ''}`
    : ts.idle ? `Tasks: 0 open · ${ts.idle} idle` : 'Tasks: none assigned';

  const exec4h = a.executions4h ?? a.sessions4h ?? 0;
  const exec24h = a.executions24h ?? a.sessions24h ?? 0;
  const desc = a.description ? String(a.description) : (a.domain ? String(a.domain) : '');

  return `<article class="agent-roster-card ${stale ? 'is-idle' : ''} ${runningNow ? 'is-running' : ''}" onclick="routeTo('/agents/${esc(a.name)}')">
    <header class="agent-card-head">
      <div class="agent-card-title-row">
        <span style="color:${dotColor};font-size:10px">●</span>
        <h3><a href="/agents/${encodeURIComponent(a.name)}" onclick="event.stopPropagation()">${esc(a.name)}</a></h3>
        ${renderAgentRoleBadge(a)}
        ${typeof renderScorePill === 'function' && a.scorecard7d?.sampleSize > 0 ? renderScorePill(a.scorecard7d) : ''}
      </div>
      ${a.model ? `<span class="model-chip">${esc(a.model)}</span>` : ''}
    </header>
    <p class="agent-card-desc">${desc ? esc(desc.slice(0, 150)) : '<i>No description in agent.json</i>'}</p>
    <div class="agent-card-stats">
      <div class="agent-workload-line">${taskStrip}</div>
      <div class="agent-chip-row">
        <span class="agent-stat-pill" title="Latest activity">⏱ ${esc(ageLabel)}</span>
        <span class="agent-stat-pill" title="Executions (sessions + Codex/workflow attempts) in 4h / 24h">${exec4h} (4h) · ${exec24h} (24h)</span>
        ${a.estimatedCost7d != null ? `<span class="agent-stat-pill" title="Estimated 7-day SDK spend">$${Number(a.estimatedCost7d).toFixed(2)} (7d)</span>` : ''}
        ${a.metricCount > 0 ? `<span class="agent-stat-pill ${a.metricBreached > 0 ? 'warn' : ''}" title="Active owned metrics">∆ ${a.metricCount}${a.metricBreached > 0 ? ` (${a.metricBreached} ⚠)` : ''}</span>` : ''}
        ${a.errors4h > 0 ? `<span class="agent-stat-pill warn" title="Errors in last 4h">✗ ${a.errors4h} err</span>` : ''}
      </div>
    </div>
  </article>`;
}

function renderAgentsRoster(preserveFocus = false) {
  const el = document.getElementById('agents-content');
  if (!el) return;
  const agents = cachedAgentsCatalog || [];
  const q = agentsSearchQuery.trim().toLowerCase();
  const filtered = agents.filter(a => {
    if (agentsGroupMode === 'active') {
      const recent = (a.runningNow || 0) > 0 || (a.tasksSummary?.openTotal || 0) > 0 || (a.executions24h ?? a.sessions24h ?? 0) > 0;
      if (!recent) return false;
    }
    if (!q) return true;
    const hay = [a.name, a.homeApp, ...(a.apps7d || []), a.model, a.domain, a.description].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  const runningCount = agents.filter(a => (a.runningNow || 0) > 0).length;
  const active24hCount = agents.filter(a => (a.executions24h ?? a.sessions24h ?? 0) > 0 || (a.runningNow || 0) > 0).length;
  const totalOpenTasks = agents.reduce((s, a) => s + (a.tasksSummary?.openTotal || 0), 0);

  let bodyHtml = '';
  if (filtered.length === 0) {
    bodyHtml = `<div class="empty-state">No agents match this filter.</div>`;
  } else if (agentsGroupMode === 'team') {
    const groups = new Map();
    const standalone = [];
    for (const a of filtered) {
      const team = a.homeApp || null;
      if (!team) {
        standalone.push(a);
      } else {
        if (!groups.has(team)) groups.set(team, []);
        groups.get(team).push(a);
      }
    }
    // Sort within each App team: App Owner first, then running, then specialists alphabetically.
    const sortedTeams = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [appId, members] of sortedTeams) {
      members.sort((x, y) => (x.roleKind === 'app-owner' ? 0 : 1) - (y.roleKind === 'app-owner' ? 0 : 1) || (y.runningNow || 0) - (x.runningNow || 0) || String(x.name).localeCompare(String(y.name)));
      const appTaskHref = `/projects/${encodeURIComponent(appId + '.app')}/tasks?appId=${encodeURIComponent(appId)}`;
      const appMetricHref = `/metrics?appId=${encodeURIComponent(appId)}`;
      bodyHtml += `<section class="agent-team-section">
        <div class="agent-team-head">
          <div class="agent-team-title">
            <span class="td-scope-tag app" style="margin:0">App Team</span>
            <h3><a href="${attrEsc(appTaskHref)}">${esc(appId)}</a></h3>
            <span class="health-note">${members.length} agent${members.length === 1 ? '' : 's'}</span>
          </div>
          <div class="agent-team-links">
            <a href="${attrEsc(appTaskHref)}">Task Board →</a>
            <a href="${attrEsc(appMetricHref)}">Metrics →</a>
          </div>
        </div>
        <div class="agent-cards-grid">${members.map(renderAgentCard).join('')}</div>
      </section>`;
    }
    if (standalone.length > 0) {
      bodyHtml += `<section class="agent-team-section">
        <div class="agent-team-head">
          <div class="agent-team-title">
            <span class="td-scope-tag host" style="margin:0">Global</span>
            <h3>Standalone &amp; Benchmark Specialists</h3>
            <span class="health-note">${standalone.length} agent${standalone.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div class="agent-cards-grid">${standalone.map(renderAgentCard).join('')}</div>
      </section>`;
    }
  } else {
    bodyHtml = `<div class="agent-cards-grid">${filtered.map(renderAgentCard).join('')}</div>`;
  }

  const toolbarHtml = `<div class="agents-toolbar">
    <div>
      <h2 style="margin:0;font-size:18px">Agents <span class="health-note" style="font-weight:400">(${agents.length} configured · ${active24hCount} active in 24h${runningNowBadge(runningCount)} · ${totalOpenTasks} open Tasks)</span></h2>
      <p class="health-note" style="margin:2px 0 0">An App extends its owner agent; specialists collaborate on assigned Tasks via bounded turns, workflows, and native executors.</p>
    </div>
    <div class="agents-toolbar-controls">
      <input id="agents-search-input" type="search" value="${attrEsc(agentsSearchQuery)}" placeholder="Filter name, App, model…" oninput="setAgentsSearch(this.value)" aria-label="Filter agents">
      <div class="td-window-switch" role="group" aria-label="Agent roster grouping">
        <button type="button" class="td-window-btn ${agentsGroupMode === 'team' ? 'active' : ''}" onclick="setAgentsGroupMode('team')">By App Team</button>
        <button type="button" class="td-window-btn ${agentsGroupMode === 'active' ? 'active' : ''}" onclick="setAgentsGroupMode('active')">Active Only</button>
        <button type="button" class="td-window-btn ${agentsGroupMode === 'grid' ? 'active' : ''}" onclick="setAgentsGroupMode('grid')">Flat Grid</button>
      </div>
    </div>
  </div>`;

  if (preserveFocus && document.getElementById('agents-roster-body')) {
    document.getElementById('agents-roster-body').innerHTML = bodyHtml;
    return;
  }
  el.innerHTML = toolbarHtml + `<div id="agents-roster-body">${bodyHtml}</div>`;
}

function runningNowBadge(count) {
  return count > 0 ? ` · ${count} running now` : '';
}

async function loadAgentsTab() {
  const el = document.getElementById('agents-content');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--fg2);padding:24px">Loading agents…</div>';
  try {
    const r = await fetch('/api/agents');
    const agents = await r.json();
    if (agents.error) throw new Error(agents.error);
    cachedAgentsCatalog = Array.isArray(agents) ? agents : [];
    renderAgentsRoster();
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red);padding:16px">Failed to load agents: ${esc(e.message)}</div>`;
  }
}

function isAgentChatActive(name) {
  return currentTab === 'agents' && currentRouteParams.name === name
    && currentAgentChat === name && currentAgentSubTab === 'chat';
}

async function initAgentChat(name) {
  currentAgentChat = name;
  currentAgentSubTab = name === humanInterface.agent ? 'chat' : 'overview';
  await renderAgentDetail(name);
  if (currentTab !== 'agents' || currentRouteParams.name !== name) return;
  switchAgentSubTab(currentAgentSubTab);
}

async function renderAgentDetail(name) {
  const route = currentRouteParams;
  const el = document.getElementById('agents-content');
  if (!el) return;
  // Fetch summary stats from /api/agents (same source as list view).
  let summary = null;
  try {
    const r = await fetch('/api/agents');
    const all = await r.json();
    summary = (all || []).find(a => a.name === name) || null;
  } catch {}
  if (currentRouteParams !== route || currentTab !== 'agents' || currentRouteParams.name !== name) return;

  const lastTs = summary && (summary.lastActivityAt || summary.lastSessionAt);
  const runningNow = summary && (summary.runningNow || 0) > 0;
  const dotColor = summary && summary.errors4h > 0
    ? 'var(--red)'
    : runningNow
      ? '#39c5cf'
      : lastTs && (Date.now() - lastTs < 4 * 3600 * 1000)
        ? 'var(--green)'
        : 'var(--fg2)';

  let html = `<div class="agent-detail-header">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <button onclick="routeTo('/agents')" class="td-window-btn">← All agents</button>
      <span style="color:${dotColor};font-size:13px">●</span>
      <h2 style="margin:0;font-size:18px">${esc(name)}</h2>
      ${summary ? renderAgentRoleBadge(summary) : ''}
      ${summary && typeof renderScorePill === 'function' && summary.scorecard7d?.sampleSize > 0 ? renderScorePill(summary.scorecard7d) : ''}
      ${summary && summary.model ? `<span class="model-chip">${esc(summary.model)}</span>` : ''}
    </div>
    ${summary ? `<div class="agent-detail-kpis">
      ${summary.homeApp ? `<a href="/projects/${encodeURIComponent(summary.homeApp + '.app')}/tasks?appId=${encodeURIComponent(summary.homeApp)}" class="agent-stat-pill">App: ${esc(summary.homeApp)} →</a>` : ''}
      <span class="agent-stat-pill">${summary.tasksSummary?.openTotal || 0} open Tasks</span>
      <span class="agent-stat-pill">${summary.executions24h ?? summary.sessions24h ?? 0} runs (24h)</span>
      ${summary.estimatedCost7d != null ? `<span class="agent-stat-pill">$${Number(summary.estimatedCost7d).toFixed(2)} (7d)</span>` : ''}
    </div>` : ''}
  </div>`;
  if (summary && summary.description) {
    html += `<div style="font-size:12px;color:var(--fg2);margin:6px 0 10px">${esc(summary.description)}</div>`;
  }
  const subTabs = name === humanInterface.agent ? ['chat', 'overview', 'about'] : ['overview', 'about'];
  html += `<div id="agent-subtab-nav" style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:12px">`;
  for (const t of subTabs) {
    const active = t === currentAgentSubTab;
    html += `<button onclick="switchAgentSubTab('${t}')" style="background:none;border:none;border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'};color:${active ? 'var(--accent)' : 'var(--fg2)'};padding:8px 16px;cursor:pointer;font-size:13px;text-transform:capitalize">${t}</button>`;
  }
  html += `</div>`;
  html += `<div id="agent-subtab-body"></div>`;
  el.innerHTML = html;
}

function switchAgentSubTab(tab) {
  if (tab === 'chat' && currentAgentChat !== humanInterface.agent) tab = 'overview';
  currentAgentSubTab = tab;
  const nav = document.getElementById('agent-subtab-nav');
  if (nav) {
    [...nav.children].forEach(btn => {
      const isActive = btn.textContent.trim().toLowerCase() === tab;
      btn.style.borderBottomColor = isActive ? 'var(--accent)' : 'transparent';
      btn.style.color = isActive ? 'var(--accent)' : 'var(--fg2)';
    });
  }
  const body = document.getElementById('agent-subtab-body');
  const chatPane = document.getElementById('chat');
  const agentsPane = document.getElementById('agents');
  // Make sure both panes are visible (the global render() set agents=visible
  // and chat=visible because inAgentChat=true). If sub-tab is non-chat, hide chat.
  if (tab === 'chat') {
    if (chatPane) chatPane.classList.remove('hidden');
    if (body) body.innerHTML = '';
    void refreshMayConversation();
  } else {
    if (chatPane) chatPane.classList.add('hidden');
    if (body) body.innerHTML = '<div style="color:var(--fg2);padding:24px">Loading…</div>';
    if (tab === 'overview') void loadAgentOverview(currentAgentChat);
    else if (tab === 'about') void loadAgentAbout(currentAgentChat);
  }
  // Keep agents pane visible regardless.
  if (agentsPane) agentsPane.classList.remove('hidden');
  setRealtimeEnabled(tab === 'chat');
  updateConversationStop();
}

async function loadAgentAbout(name) {
  const body = document.getElementById('agent-subtab-body');
  if (!body || !name) return;
  try {
    const r = await fetch(`/api/agents/${encodeURIComponent(name)}/about`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    const cfg = d.agentJson;
    const promptFiles = d.promptFiles || [];
    const otherFiles = d.otherFiles || [];
    const promptBytes = promptFiles.reduce((s, f) => s + (f.bytes || 0), 0);

    let html = '';

    // ── In-prompt section: what's actually loaded into the model's context. ──
    html += `<div style="margin-bottom:16px">`;
    html += `<h3 style="margin:0 0 4px;font-size:13px;color:var(--fg);display:flex;align-items:center;gap:8px">In the system prompt <span style="color:var(--fg2);font-size:11px;font-weight:normal">${promptFiles.length} file${promptFiles.length===1?'':'s'} · ${promptBytes.toLocaleString()} bytes loaded into every session</span></h3>`;
    html += `<div style="font-size:11px;color:var(--fg2);margin-bottom:8px">This is what the agent actually "knows" — auto-injected by manager.ts on every session start.</div>`;
    if (promptFiles.length === 0) {
      html += `<div style="color:var(--fg2);padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">No prompt files found. Agent will run with empty system prompt.</div>`;
    } else {
      for (const f of promptFiles) {
        html += `<details open style="background:var(--bg2);border:1px solid var(--accent);border-radius:6px;padding:10px 12px;margin-bottom:8px">`;
        html += `<summary style="cursor:pointer;font-weight:500;font-size:13px;color:var(--fg);display:flex;align-items:center;gap:8px">
          <span>${esc(f.name)}</span>
          <span style="color:var(--fg2);font-weight:normal;font-size:11px">${(f.bytes||0).toLocaleString()} bytes</span>
          <span style="color:var(--accent);font-weight:normal;font-size:10px;margin-left:auto">${esc(f.source || '')}</span>
        </summary>`;
        html += `<div class="md-rendered" style="margin-top:10px;font-size:13px;border-top:1px solid var(--border);padding-top:10px">${window.marked && window.marked.parse ? window.marked.parse(f.content) : '<pre>' + esc(f.content) + '</pre>'}</div>`;
        html += `</details>`;
      }
    }
    html += `</div>`;

    // ── Other on-disk files: convention files agents may read on demand. ──
    if (otherFiles.length > 0) {
      html += `<div>`;
      html += `<h3 style="margin:0 0 4px;font-size:13px;color:var(--fg2)">On-disk only <span style="font-size:11px;font-weight:normal">${otherFiles.length} file${otherFiles.length===1?'':'s'} · not in prompt</span></h3>`;
      html += `<div style="font-size:11px;color:var(--fg2);margin-bottom:8px">Convention files. Agent reads these on demand (not auto-injected). Editing them does not change the agent's knowledge until they read it.</div>`;
      for (const f of otherFiles) {
        html += `<details style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:6px">`;
        html += `<summary style="cursor:pointer;font-weight:500;font-size:13px;color:var(--fg)">${esc(f.name)} <span style="color:var(--fg2);font-weight:normal;font-size:11px">${(f.bytes||0).toLocaleString()} bytes</span></summary>`;
        html += `<div class="md-rendered" style="margin-top:10px;font-size:13px;border-top:1px solid var(--border);padding-top:10px">${window.marked && window.marked.parse ? window.marked.parse(f.content) : '<pre>' + esc(f.content) + '</pre>'}</div>`;
        html += `</details>`;
      }
      html += `</div>`;
    }

    if (!cfg && promptFiles.length === 0 && otherFiles.length === 0) {
      html = `<div style="color:var(--fg2);padding:24px">No agent.json, no prompt files, and no convention files for <b>${esc(name)}</b>.</div>`;
    }
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<div style="color:var(--red);padding:16px">Failed: ${esc(e.message)}</div>`;
  }
}

// ── Sparkline ──────────────────────────────────────────────────────────
// Tiny inline SVG sparkline. ~120x32px. Renders a polyline through the
// values, with optional threshold band as a dashed horizontal line.
function sparkline(values, opts = {}) {
  const w = opts.width || 120, h = opts.height || 32, pad = 2;
  if (!values || values.length === 0) return `<svg width="${w}" height="${h}"></svg>`;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (w - 2 * pad) / (values.length - 1) : 0;
  const yOf = v => h - pad - ((v - min) / span) * (h - 2 * pad);
  const pts = values.map((v, i) => `${(pad + i * stepX).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  let extras = '';
  if (opts.threshold != null && opts.threshold >= min && opts.threshold <= max) {
    const ty = yOf(opts.threshold);
    extras += `<line x1="0" x2="${w}" y1="${ty}" y2="${ty}" stroke="var(--red)" stroke-width="1" stroke-dasharray="2,2" opacity="0.6"/>`;
  }
  const color = opts.color || 'var(--accent)';
  return `<svg width="${w}" height="${h}" style="display:block"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/>${extras}</svg>`;
}

// ── Agent Overview ─────────────────────────────────────────────────────
// Single dense panel: metrics with sparklines, projects, sessions.
// All rows clickable to drill in. Layout: 2 columns on wide screens
// (metrics left, projects+sessions right); single column on narrow.
async function loadAgentOverview(name) {
  const body = document.getElementById('agent-subtab-body');
  if (!body || !name) return;
  body.innerHTML = '<div style="color:var(--fg2);padding:24px">Loading overview…</div>';
  try {
    const [metricsRes, projectsRes, livenessRes, aboutRes] = await Promise.all([
      fetch('/api/metrics').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/liveness').then(r => r.json()),
      fetch(`/api/agents/${encodeURIComponent(name)}/about`).then(r => r.json()).catch(() => ({ agentJson: null, assignedTasks: [], recentAttempts: [] })),
    ]);
    const cfg = aboutRes && aboutRes.agentJson;
    const assignedTasks = Array.isArray(aboutRes?.assignedTasks) ? aboutRes.assignedTasks : [];
    const recentAttempts = Array.isArray(aboutRes?.recentAttempts) ? aboutRes.recentAttempts : [];
    const ownedMetrics = (metricsRes.metrics || []).filter(m => m.owner === name);
    const metricsIncomplete = metricsRes.truncated === true;
    const ownedProjects = (projectsRes || []).filter(p => p.owner === name);
    const sessions = (livenessRes.agents || []).find(a => a.name === name)?.sessions || [];

    const breached = ownedMetrics.filter(metricBreached);
    const sortedForSpark = [...ownedMetrics].sort((a, b) => {
      const aBr = breached.includes(a) ? 0 : 1;
      const bBr = breached.includes(b) ? 0 : 1;
      if (aBr !== bBr) return aBr - bBr;
      const prio = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (prio[a.priority] ?? 9) - (prio[b.priority] ?? 9);
    });
    const sparkTargets = sortedForSpark.slice(0, 12);
    const histories = await Promise.all(sparkTargets.map(m =>
      fetch(`/api/metrics/${encodeURIComponent(m.id)}/history?days=7`).then(r => r.json()).catch(() => ({snapshots:[]}))
    ));
    const histById = {};
    sparkTargets.forEach((m, i) => { histById[m.id] = (histories[i].snapshots || []).map(s => s.value); });

    const HIDDEN = new Set(['done','complete','closed','waiting','blocked','paused']);
    const activeProjects = ownedProjects.filter(p => !HIDDEN.has(p.status));
    const inactiveProjects = ownedProjects.filter(p => HIDDEN.has(p.status));

    // Merge recent 24h Task attempts (codex-goal, workflow, agent) with 4h sessions without duplicating sessionId.
    const seenSessionIds = new Set();
    const unifiedExecutions = [];
    for (const att of recentAttempts) {
      if (att.sessionId) seenSessionIds.add(att.sessionId);
      unifiedExecutions.push({
        kind: 'attempt',
        appId: att.appId,
        taskId: att.taskId,
        handler: att.handler || 'task',
        status: att.state === 'failed' ? 'error' : att.state === 'running' ? 'running' : (att.resultState || att.state || 'done'),
        sessionId: att.sessionId || null,
        startedAt: att.startedAt,
      });
    }
    for (const s of sessions.slice().reverse()) {
      if (s.sessionId && seenSessionIds.has(s.sessionId)) continue;
      unifiedExecutions.push({
        kind: 'session',
        appId: s.app_id || s.projectId || null,
        taskId: null,
        handler: s.source || s.category || 'session',
        status: s.status || 'done',
        sessionId: s.sessionId,
        startedAt: s.startedAt,
      });
    }
    unifiedExecutions.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    let html = `<div class="agent-overview-grid">`;

    // ── Left column: Role/Config card + Owned Active Metrics ──
    html += `<div style="display:flex;flex-direction:column;gap:14px">`;
    if (cfg) {
      html += `<div class="agent-panel-card">
        <div class="agent-panel-head"><h3>Configuration (agent.json)</h3></div>
        <table class="agent-kv-table"><tbody>`;
      for (const k of ['name','domain','model','compaction']) {
        if (cfg[k] != null && cfg[k] !== '') html += `<tr><td>${esc(k)}</td><td>${esc(String(cfg[k]))}</td></tr>`;
      }
      if (Array.isArray(cfg.tools)) {
        html += `<tr><td>tools (${cfg.tools.length})</td><td><div style="display:flex;flex-wrap:wrap;gap:4px">${cfg.tools.map(t => `<code class="tool-tag">${esc(typeof t === 'string' ? t : (t.name || JSON.stringify(t)))}</code>`).join('')}</div></td></tr>`;
      }
      html += `</tbody></table></div>`;
    }

    html += `<div>`;
    html += `<h3 class="agent-section-title">Metrics <span style="color:var(--fg)">${ownedMetrics.length}${metricsIncomplete ? ' shown' : ''}</span>${breached.length > 0 ? `<span style="color:var(--red);font-size:11px">⚠ ${breached.length} breached${metricsIncomplete ? ' shown' : ''}</span>` : ''}</h3>`;
    if (metricsIncomplete) html += '<p class="health-warning">Partial metric data: other metrics may be missing.</p>';
    if (ownedMetrics.length === 0) {
      html += `<div class="agent-empty-box">${metricsIncomplete ? 'No matching definitions in this partial list.' : 'No metrics owned.'}</div>`;
    } else {
      html += `<div class="agent-list-box">`;
      for (const m of sortedForSpark) {
        const isBr = breached.includes(m);
        const series = histById[m.id] || [];
        const sparkColor = isBr ? 'var(--red)' : (m.alertsDisabled ? 'var(--fg2)' : 'var(--accent)');
        const formattedVal = m.noExposure ? 'n/a (0 exp)' : formatAgentMetricValue(m.current, m.unit);
        const ruleSub = m.alertsDisabled
          ? 'trend only'
          : m.threshold != null
            ? `${metricHealthyOperator(m)} ${formatAgentMetricValue(m.threshold, m.unit)}`
            : '';
        html += `<div onclick="routeTo('/metrics/' + encodeURIComponent('${attrEsc(m.id)}'))" title="Inspect metric history" class="agent-metric-row ${isBr ? 'breached' : ''}">
          <div style="min-width:0">
            <div style="font-size:12.5px;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name || m.id)}</div>
            <div style="font-size:10.5px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><code>${esc(m.id)}</code>${m.priority ? ` · ${esc(m.priority)}` : ''}</div>
          </div>
          <div>${series.length > 1 ? sparkline(series, { threshold: m.alertsDisabled ? null : m.threshold, color: sparkColor, width: 120, height: 26 }) : `<span style="color:var(--fg2);font-size:10px">${m.noExposure ? '0/0 window' : 'no history'}</span>`}</div>
          <div style="text-align:right;font-size:12px;font-variant-numeric:tabular-nums">
            <span style="font-weight:600;${isBr ? 'color:var(--red)' : ''}">${esc(formattedVal)}</span>
            ${ruleSub ? `<div style="font-size:10px;color:var(--fg2)">${esc(ruleSub)}</div>` : ''}
          </div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div></div>`;

    // ── Right column: Assigned Durable Tasks -> Recent Executions -> Owned Projects ──
    html += `<div style="display:flex;flex-direction:column;gap:14px">`;

    // 1. Assigned Durable Tasks (`app_tasks`).
    const openAssigned = assignedTasks.filter(t => t.status !== 'idle');
    html += `<div>
      <h3 class="agent-section-title">Assigned Tasks <span style="color:var(--fg)">${openAssigned.length} open</span><span style="color:var(--fg2);font-size:11px">/ ${assignedTasks.length} retained</span></h3>`;
    if (assignedTasks.length === 0) {
      html += `<div class="agent-empty-box">No durable Tasks currently assigned to ${esc(name)}.</div>`;
    } else {
      html += `<div class="agent-list-box">`;
      for (const t of assignedTasks.slice(0, 10)) {
        const href = `/projects/${encodeURIComponent(t.appId + '.app')}/tasks?appId=${encodeURIComponent(t.appId)}&task=${encodeURIComponent(t.taskId)}`;
        const st = String(t.status || 'pending').toLowerCase();
        const badgeCls = st === 'running' ? 'running' : st === 'attention' ? 'error' : st === 'waiting' ? 'interrupted' : st === 'idle' ? 'done' : 'source';
        html += `<a href="${attrEsc(href)}" class="agent-task-row">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="badge ${badgeCls}">${esc(t.status)}</span>
            <span class="td-scope-tag app" style="margin:0">${esc(t.appId)}</span>
            <code style="font-size:11px;color:var(--fg)">${esc(t.taskId)}</code>
            <span style="margin-left:auto;font-size:10.5px;color:var(--fg2)">${t.updatedAt ? timeAgo(t.updatedAt) : ''}</span>
          </div>
          <div style="font-size:12px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.outcome)}</div>
        </a>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    // 2. Recent Executions (24h Task Attempts + 4h Sessions).
    html += `<div>
      <h3 class="agent-section-title">Recent executions <span style="color:var(--fg)">${unifiedExecutions.length}</span><span style="color:var(--fg2);font-size:11px">attempts (24h) &amp; sessions</span></h3>`;
    if (unifiedExecutions.length === 0) {
      html += `<div class="agent-empty-box">No sessions or Task attempts in the last 24 hours.</div>`;
    } else {
      html += `<div class="agent-list-box">`;
      for (const ex of unifiedExecutions.slice(0, 15)) {
        const statusColor = ex.status === 'error' ? 'var(--red)' : ex.status === 'running' ? '#39c5cf' : ex.status === 'converged' ? 'var(--green)' : 'var(--fg2)';
        const handlerShort = String(ex.handler || '').replace(/^executor:/, '');
        if (ex.sessionId) {
          html += `<div onclick="navigateToSession(${jsStringAttr(ex.sessionId)})" class="agent-exec-row" style="cursor:pointer">
            <span style="color:${statusColor};font-size:9px">●</span>
            <div style="min-width:0;display:flex;align-items:center;gap:6px;overflow:hidden">
              <code style="font-size:11px;color:var(--fg)">${esc(ex.taskId || ex.sessionId.slice(-12))}</code>
              <span class="agent-stat-pill">${esc(handlerShort)}</span>
              ${ex.appId ? `<span style="font-size:10.5px;color:var(--fg2)">${esc(ex.appId)}</span>` : ''}
            </div>
            <span style="font-size:10.5px;color:var(--fg2);white-space:nowrap">${ex.startedAt ? timeAgo(ex.startedAt) : '—'}</span>
          </div>`;
        } else {
          const taskHref = ex.appId && ex.taskId
            ? `/projects/${encodeURIComponent(ex.appId + '.app')}/tasks?appId=${encodeURIComponent(ex.appId)}&task=${encodeURIComponent(ex.taskId)}`
            : '/projects';
          html += `<a href="${attrEsc(taskHref)}" class="agent-exec-row">
            <span style="color:${statusColor};font-size:9px">●</span>
            <div style="min-width:0;display:flex;align-items:center;gap:6px;overflow:hidden">
              <code style="font-size:11px;color:var(--fg)">${esc(ex.taskId || 'attempt')}</code>
              <span class="agent-stat-pill">${esc(handlerShort)}</span>
              <span style="font-size:10.5px;color:var(--fg2)">${esc(ex.status)}</span>
            </div>
            <span style="font-size:10.5px;color:var(--fg2);white-space:nowrap">${ex.startedAt ? timeAgo(ex.startedAt) : '—'}</span>
          </a>`;
        }
      }
      html += `</div>`;
    }
    html += `</div>`;

    // 3. Owned Projects metadata (compact).
    html += `<div>
      <h3 class="agent-section-title">Projects <span style="color:var(--fg)">${activeProjects.length} active</span><span style="color:var(--fg2);font-size:11px">/ ${ownedProjects.length} total</span></h3>`;
    if (ownedProjects.length === 0) {
      html += `<div class="agent-empty-box">No projects owned.</div>`;
    } else {
      html += `<div class="agent-list-box">`;
      for (const p of [...activeProjects, ...inactiveProjects]) {
        const muted = HIDDEN.has(p.status);
        const projId = projectIdOf(p);
        html += `<div onclick="routeTo('/projects/' + '${attrEsc(projId)}')" class="agent-exec-row" style="cursor:pointer;${muted ? 'opacity:0.55' : ''}">
          <div style="min-width:0;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
          <span style="font-size:11px;color:var(--fg2)">${esc(p.status||'')}</span>
          <span style="font-size:10.5px;color:var(--fg2);white-space:nowrap">${p.updatedAt ? timeAgo(p.updatedAt) : '—'}</span>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    html += `</div></div>`;
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<div style="color:var(--red);padding:16px">Failed to load overview: ${esc(e.message)}</div>`;
  }
}
