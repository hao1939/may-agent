// Agent detail and agent-chat surfaces.
let currentAgentSubTab = 'chat';
let currentAgentChat = null;
let forceNewAgentChat = false;

function setAgentChatSessionId(sessionId) {
  const el = document.querySelector('#chat-agent-banner .banner-session');
  if (!el) return;
  if (!sessionId) {
    el.textContent = 'session: —';
    el.removeAttribute('title');
    return;
  }
  el.title = sessionId;
  el.innerHTML = `session: <a href="#/sessions/${encodeURIComponent(sessionId)}" style="color:var(--accent);text-decoration:none">${esc(sessionId)}</a>`;
}

/**
 * Telegram-style chat with a specific agent. Reuses the #chat pane:
 *   1. Fetch /api/agents/:name/default-session to find the agent's persistent
 *      thread (most-recent non-throwaway session, any status).
 *   2. switchSession() loads transcript and binds compose box.
 *   3. If no session exists yet, show an empty chat; first message will
 *      spawn one via /api/agents/:name/message (handled in chat-input).
 *
 * Header banner shows which agent we're talking to so the user can tell
 * agent-chat from arbitrary-session view.
 */
async function initAgentChat(name) {
  if (!chatInitialized) {
    chatInitialized = true;
  }
  setSessionPageMode(false);
  currentAgentChat = name;
  // Update the chat header to show the agent name.
  const header = document.getElementById('chat-agent-banner');
  if (header) {
    header.style.display = name ? 'flex' : 'none';
    header.querySelector('.banner-name').textContent = name || '';
    setAgentChatSessionId(null);
  }
  if (!name) { switchSession(null); return; }
  // Render agent detail header + sub-tab nav into #agents-content (above the
  // chat pane). The agent detail uses sub-tabs: Chat (default), About,
  // Metrics, Projects, Sessions. Switching sub-tab toggles whether the
  // #chat pane is visible vs. the detail body in #agents-content.
  await renderAgentDetail(name);
  // Default sub-tab is chat; load the thread.
  switchAgentSubTab(currentAgentSubTab || 'chat');
}

async function renderAgentDetail(name) {
  const el = document.getElementById('agents-content');
  if (!el) return;
  // Fetch summary stats from /api/agents (same source as list view).
  let summary = null;
  try {
    const r = await fetch('/api/agents');
    const all = await r.json();
    summary = (all || []).find(a => a.name === name) || null;
  } catch {}

  const dotColor = summary && summary.lastSessionAt && (Date.now() - summary.lastSessionAt < 4*3600*1000)
    ? (summary.errors4h > 0 ? 'var(--red)' : 'var(--green)')
    : 'var(--fg2)';

  let html = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
    <button onclick="routeTo('/agents')" style="padding:4px 10px;background:var(--bg3,#222);border:1px solid var(--border);border-radius:4px;color:var(--fg);cursor:pointer;font-size:12px">← All agents</button>
    <span style="color:${dotColor};font-size:14px">●</span>
    <h2 style="margin:0;font-size:18px">${esc(name)}</h2>
    ${summary && summary.model ? `<span class="model-chip">${esc(summary.model)}</span>` : ''}
    <button onclick="verbHeartbeatNow('${esc(name)}', event)" title="Trigger a heartbeat for ${esc(name)} now" style="margin-left:auto;padding:4px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--fg);cursor:pointer;font-size:12px">♥ heartbeat-now</button>
    <button onclick="resetAgentChat('${attrEsc(name)}')" title="Clear chat and start fresh" style="padding:4px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--fg);cursor:pointer;font-size:12px">↻ Reset</button>
  </div>`;
  if (summary && summary.description) {
    html += `<div style="font-size:12px;color:var(--fg2);margin-bottom:10px">${esc(summary.description)}</div>`;
  }
  // Sub-tab nav. Three tabs: Chat (default Telegram thread), Overview
  // (dense dashboard — metrics with sparklines, projects, sessions),
  // About (identity files). Overview merges what was previously three
  // separate sub-tabs because they're all 'what does this agent own?' —
  // shown side-by-side they tell the story faster.
  const subTabs = ['chat', 'overview', 'about'];
  html += `<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:12px">`;
  for (const t of subTabs) {
    const active = t === currentAgentSubTab;
    html += `<button onclick="switchAgentSubTab('${t}')" style="background:none;border:none;border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'};color:${active ? 'var(--accent)' : 'var(--fg2)'};padding:8px 16px;cursor:pointer;font-size:13px;text-transform:capitalize">${t}</button>`;
  }
  html += `</div>`;
  // Sub-tab body container; populated by switchAgentSubTab().
  html += `<div id="agent-subtab-body"></div>`;
  el.innerHTML = html;
}

function switchAgentSubTab(tab) {
  currentAgentSubTab = tab;
  // Update sub-tab nav highlight.
  const nav = document.querySelector('#agents-content > div:nth-child(3)');
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
    // Resolve & load the chat thread (same as before).
    void loadAgentChatThread(currentAgentChat);
  } else {
    if (chatPane) chatPane.classList.add('hidden');
    if (body) body.innerHTML = '<div style="color:var(--fg2);padding:24px">Loading…</div>';
    if (tab === 'overview') void loadAgentOverview(currentAgentChat);
    else if (tab === 'about') void loadAgentAbout(currentAgentChat);
  }
  // Keep agents pane visible regardless.
  if (agentsPane) agentsPane.classList.remove('hidden');
}

async function loadAgentChatThread(name) {
  if (!name) return;
  try {
    const r = await fetch(`/api/agents/${encodeURIComponent(name)}/default-session`);
    const d = await r.json();
    if (d.sessionId) {
      setAgentChatSessionId(d.sessionId);
      if (d.sessionId !== currentSessionId) switchSession(d.sessionId);
    } else {
      currentSessionId = null;
      setAgentChatSessionId(null);
      const messages = document.getElementById('chat-messages');
      if (messages) messages.innerHTML = '<div style="color:var(--fg2);font-size:13px;padding:24px;text-align:center">No conversation with <b>' + esc(name) + '</b> yet. Send a message to start one.</div>';
    }
  } catch (e) {
    const messages = document.getElementById('chat-messages');
    if (messages) messages.innerHTML = '<div style="color:var(--red);padding:16px">Failed: ' + esc(e.message) + '</div>';
  }
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
    // Fetch in parallel.
    const [metricsRes, projectsRes, livenessRes, aboutRes] = await Promise.all([
      fetch('/api/metrics').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/liveness').then(r => r.json()),
      fetch(`/api/agents/${encodeURIComponent(name)}/about`).then(r => r.json()).catch(() => ({agentJson: null})),
    ]);
    const cfg = aboutRes && aboutRes.agentJson;
    const ownedMetrics = (metricsRes.metrics || []).filter(m => m.owner === name);
    const ownedProjects = (projectsRes || []).filter(p => p.owner === name);
    const sessions = (livenessRes.agents || []).find(a => a.name === name)?.sessions || [];

    // Fetch sparkline data for the most-relevant metrics. To keep latency
    // bounded, pull history for at most 12 metrics: alerting first, then
    // by priority (P0 > P1 > P2). Each call is cheap (~5–20ms server-side).
    const breached = ownedMetrics.filter(m => {
      if (m.alertOpen) return true;
      if (m.threshold == null || m.current == null) return false;
      const above = m.alert_op === 'above' || m.alert_op === '>';
      return above ? m.current > m.threshold : m.current < m.threshold;
    });
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

    // ── Render ──
    const HIDDEN = new Set(['done','complete','closed','waiting','blocked','paused']);
    const activeProjects = ownedProjects.filter(p => !HIDDEN.has(p.status));
    const inactiveProjects = ownedProjects.filter(p => HIDDEN.has(p.status));

    let html = `<div style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start">`;

    // ── Left column: agent.json brief, then Metrics with sparklines ──
    html += `<div>`;
    if (cfg) {
      html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:12px">`;
      html += `<h3 style="margin:0 0 6px;font-size:12px;color:var(--fg2)">agent.json</h3>`;
      html += `<table style="font-size:12px;width:100%"><tbody>`;
      for (const k of ['name','description','domain','model','compaction']) {
        if (cfg[k] != null) html += `<tr><td style="padding:2px 12px 2px 0;color:var(--fg2);vertical-align:top;white-space:nowrap">${k}</td><td>${esc(String(cfg[k]))}</td></tr>`;
      }
      if (Array.isArray(cfg.tools)) html += `<tr><td style="padding:2px 12px 2px 0;color:var(--fg2);vertical-align:top;white-space:nowrap">tools (${cfg.tools.length})</td><td style="font-size:11px;color:var(--fg2)">${cfg.tools.map(t => esc(typeof t === 'string' ? t : (t.name || JSON.stringify(t)))).join(', ')}</td></tr>`;
      html += `</tbody></table></div>`;
    }
    html += `<h3 style="margin:0 0 8px;font-size:13px;color:var(--fg2);display:flex;align-items:center;gap:8px">Metrics <span style="color:var(--fg)">${ownedMetrics.length}</span>${breached.length > 0 ? `<span style="color:var(--red);font-size:11px">⚠ ${breached.length} breached</span>` : ''}</h3>`;
    if (ownedMetrics.length === 0) {
      html += `<div style="color:var(--fg2);font-size:12px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">No metrics owned.</div>`;
    } else {
      html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;overflow:hidden">`;
      // Sort: breached first (red), then by priority.
      for (const m of sortedForSpark) {
        const isBr = breached.includes(m);
        const above = m.alert_op === 'above' || m.alert_op === '>';
        const series = histById[m.id] || [];
        const sparkColor = isBr ? 'var(--red)' : (m.priority === 'P0' ? 'var(--orange,#e8a44c)' : 'var(--accent)');
        html += `<div onclick="showMetricHistory('${esc(m.id)}')" title="Click for full chart" style="display:grid;grid-template-columns:minmax(0,1fr) 130px 90px;gap:10px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border);cursor:pointer;${isBr ? 'background:rgba(255,80,80,0.06)' : ''}" onmouseover="this.style.background='var(--bg3,#222)'" onmouseout="this.style.background='${isBr ? 'rgba(255,80,80,0.06)' : ''}'">`;
        // Name + id.
        html += `<div style="min-width:0"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.name)}</div><div style="font-size:10px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.id)}${m.priority ? ` · ${esc(m.priority)}` : ''}</div></div>`;
        // Sparkline.
        html += `<div>${series.length > 1 ? sparkline(series, {threshold: m.threshold, color: sparkColor, width:130, height:28}) : `<span style="color:var(--fg2);font-size:10px">no history</span>`}</div>`;
        // Current value vs target.
        html += `<div style="text-align:right;font-size:12px"><span style="font-weight:600;${isBr ? 'color:var(--red)' : ''}">${m.current ?? '—'}${m.unit||''}</span>${m.threshold != null ? `<div style="font-size:10px;color:var(--fg2)">${above ? '≤' : '≥'} ${m.threshold}${m.unit||''}</div>` : ''}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    // ── Right column: Projects (top), Sessions (bottom) ──
    html += `<div style="display:flex;flex-direction:column;gap:16px">`;

    // Projects.
    html += `<div>`;
    html += `<h3 style="margin:0 0 8px;font-size:13px;color:var(--fg2);display:flex;align-items:center;gap:8px">Projects <span style="color:var(--fg)">${activeProjects.length} active</span><span style="color:var(--fg2);font-size:11px">/ ${ownedProjects.length} total</span></h3>`;
    if (ownedProjects.length === 0) {
      html += `<div style="color:var(--fg2);font-size:12px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">No projects owned.</div>`;
    } else {
      html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;overflow:hidden">`;
      for (const p of [...activeProjects, ...inactiveProjects]) {
        const muted = HIDDEN.has(p.status);
        const projId = projectIdOf(p);
        html += `<div onclick="routeTo('/projects/' + '${attrEsc(projId)}')" style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:7px 12px;border-bottom:1px solid var(--border);cursor:pointer;${muted ? 'opacity:0.55' : ''}" onmouseover="this.style.background='var(--bg3,#222)'" onmouseout="this.style.background=''">`;
        html += `<div style="min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div><div style="font-size:10px;color:var(--fg2)">${p.milestonesDone ?? 0}/${p.milestonesTotal ?? 0} milestones · iter ${p.iteration ?? 0}</div></div>`;
        html += `<div style="font-size:11px;color:var(--fg2)">${esc(p.status||'')}</div>`;
        html += `<div style="font-size:10px;color:var(--fg2);white-space:nowrap">${p.updatedAt ? timeAgo(p.updatedAt) : '—'}</div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    // Sessions.
    html += `<div>`;
    html += `<h3 style="margin:0 0 8px;font-size:13px;color:var(--fg2);display:flex;align-items:center;gap:8px">Recent sessions <span style="color:var(--fg)">${sessions.length}</span><span style="color:var(--fg2);font-size:11px">last 4h</span></h3>`;
    if (sessions.length === 0) {
      html += `<div style="color:var(--fg2);font-size:12px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:6px">No sessions in the last 4 hours.</div>`;
    } else {
      html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;overflow:hidden">`;
      for (const s of sessions.slice().reverse().slice(0, 15)) {
        const statusColor = s.status === 'error' ? 'var(--red)' : (s.status === 'done' ? 'var(--fg2)' : 'var(--green)');
        html += `<div onclick="loadSessionDetail('${esc(s.sessionId)}')" style="display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;padding:6px 12px;border-bottom:1px solid var(--border);cursor:pointer" onmouseover="this.style.background='var(--bg3,#222)'" onmouseout="this.style.background=''">`;
        html += `<span style="color:${statusColor};font-size:9px">●</span>`;
        html += `<div style="min-width:0;font-family:monospace;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((s.sessionId||'').slice(-12))}</div>`;
        html += `<div style="font-size:10px;color:var(--fg2);white-space:nowrap">${s.startedAt ? timeAgo(s.startedAt) : '—'}</div>`;
        html += `</div>`;
      }
      if (sessions.length > 15) {
        html += `<div style="padding:6px 12px;font-size:11px;color:var(--fg2);text-align:center">+${sessions.length - 15} older</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;

    html += `</div>`;  // right column
    html += `</div>`;  // grid

    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = `<div style="color:var(--red);padding:16px">Failed to load overview: ${esc(e.message)}</div>`;
  }
}
