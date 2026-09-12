// ── Global error handler ──────────────────────────────────────────────
window.onerror = function(msg, url, line, col, err) {
  const errDiv = document.getElementById('global-error');
  if (errDiv) {
    errDiv.style.display = 'block';
    errDiv.textContent = `JS Error: ${msg} (${url}:${line}:${col})`;
  }
  console.error('Global error:', msg, url, line, col, err);
};

// ── State ─────────────────────────────────────────────────────────────
let currentTab = 'live';
let currentRouteParams = {};
let offset = 0;
const limit = 30;
let _currentProjectDetail = null;
let liveInitialized = false;
let legacyDashboardInitialized = false;

// ── Router ────────────────────────────────────────────────────────────
// Real routes: / /agents /agents/<name> /projects /projects/:id
//              /projects/:id/tasks /projects/:id/functions
//              /metrics /metrics/<id> /learning /terminal /sessions/:id
//              /knowledge /knowledge/<sub-path> /events /events/:eventId
// Legacy hash routes (#/... and #dashboard/#events) still work via aliases.
const LEGACY_TAB_ALIAS = {
  dashboard: 'live', chat: 'sessions',
  // 'metrics' previously aliased to system; now metrics is its own top-level tab.
};

function routeFromHash() {
  if (!location.hash) return '';
  if (location.hash.startsWith('#/')) return location.hash.slice(1) || '/';
  const rawHash = location.hash.slice(1);
  if (!rawHash) return '';
  const legacyHashRoutes = new Set(['dashboard', 'chat', 'events', 'system']);
  const head = rawHash.split('/').filter(Boolean)[0] || '';
  if (legacyHashRoutes.has(head)) return '/' + rawHash;
  return '';
}

function currentAnchorId() {
  if (!location.hash || routeFromHash()) return '';
  try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); }
}

function scrollToHashAnchor() {
  const id = currentAnchorId();
  if (!id) return;
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function parseRouteString(route) {
  const raw = String(route || '/').replace(/^\/?/, '').split('?')[0];
  if (!raw) return { tab: 'live', params: {} };
  const segs = raw.split('/').filter(Boolean);
  const head = segs[0];
  if (LEGACY_TAB_ALIAS[head]) return { tab: LEGACY_TAB_ALIAS[head], params: {} };
  if (head === 'projects') {
    const tail = segs.slice(1);
    let surface = null;
    const last = tail[tail.length - 1];
    if (last === 'tasks' || last === 'functions') {
      surface = last;
      tail.pop();
    }
    return { tab: 'projects', params: { id: tail.map(decodeURIComponent).join('/') || null, surface } };
  }
  if (head === 'sessions') return { tab: 'sessions', params: { id: segs[1] ? decodeURIComponent(segs[1]) : null } };
  if (head === 'agents') return { tab: 'agents', params: { name: segs[1] ? decodeURIComponent(segs[1]) : null } };
  if (head === 'metrics') return { tab: 'metrics', params: { id: segs.slice(1).map(decodeURIComponent).join('/') || null } };
  if (head === 'learning') return { tab: 'learning', params: {} };
  if (head === 'terminal') return { tab: 'terminal', params: {} };
  if (head === 'knowledge') return { tab: 'knowledge', params: { path: segs.slice(1).map(decodeURIComponent).join('/') || '' } };
  if (head === 'system' || head === 'events') return { tab: 'system', params: { eventId: head === 'events' && segs[1] ? decodeURIComponent(segs[1]) : null } };
  if (head === 'live') return { tab: 'live', params: {} };
  return { tab: 'live', params: {} };
}

function parseRoute() {
  const hashRoute = routeFromHash();
  if (hashRoute) return parseRouteString(hashRoute);
  return parseRouteString(location.pathname + location.search);
}

function routeTo(route) {
  if (!route.startsWith('/')) route = '/' + route;
  if (location.pathname + location.search === route && !location.hash) {
    render();
    return;
  }
  history.pushState({}, '', route);
  render();
}

function isPlatformClientRoute(pathname) {
  if (pathname === '/' || pathname === '/index.html') return true;
  if (/^\/(events|agents|metrics|learning|knowledge|terminal|sessions)(?:\/.*)?$/.test(pathname)) return true;
  if (pathname === '/projects') return true;
  if (!pathname.startsWith('/projects/')) return false;
  const parts = pathname.split('/').filter(Boolean).slice(1);
  const last = parts[parts.length - 1];
  const hasSurface = last === 'tasks' || last === 'functions';
  const idParts = hasSurface ? parts.slice(0, -1) : parts;
  if (!hasSurface && idParts.length === 2) {
    if (['ui', 'kanban'].includes(idParts[1])) return false;
    if (/\.[a-z0-9]+$/i.test(idParts[1])) return false;
  }
  return idParts.length === 1 || idParts.length === 2;
}

// ── Project identity ─────────────────────────────────────────────────────
// URLs and table-row clicks carry a *project id*, never a server-side
// filesystem path. The id is the canonical handle the URL exposes:
//
//   top-level work-project       projects/<name>                  id: '<name>'
//   per-agent project (legacy)   agents/<owner>/workspace/projects/<name>
//                                                                  id: '<owner>/<name>'
//   shared project (legacy)      shared/projects/<name>            id: 'shared/<name>'
//
// All UI route-building goes through projectIdOf(p), and all server calls
// go through projectPathOf(id). Do not splice path prefixes inline.
function projectIdOf(p) {
  const path = (p && p.path) || '';
  if (path.startsWith('projects/')) return path.slice('projects/'.length);
  const m = path.match(/^agents\/([^/]+)\/workspace\/projects\/(.+)$/);
  if (m) return m[1] + '/' + m[2];
  if (path.startsWith('shared/projects/')) return 'shared/' + path.slice('shared/projects/'.length);
  return path; // unknown shape: pass through, server will reject
}

function projectPathOf(id) {
  if (!id) return null;
  if (id.startsWith('shared/')) return 'shared/projects/' + id.slice('shared/'.length);
  if (id.includes('/')) {
    const idx = id.indexOf('/');
    return 'agents/' + id.slice(0, idx) + '/workspace/projects/' + id.slice(idx + 1);
  }
  return 'projects/' + id;
}

function initializeLegacyDashboard() {
  if (legacyDashboardInitialized) return;
  legacyDashboardInitialized = true;
  loadHealth();
  loadHealthGraphs();
  loadAgentGrid();
  loadTimeline();
  loadStats();
}

function render() {
  const previousTab = currentTab;
  const { tab, params } = parseRoute();
  currentTab = tab;
  currentRouteParams = params;
  // Trace selection belongs to this route, not to the reusable Events pane.
  clearLoopTrace();
  // Pane visibility — design's 5 surfaces map onto existing panes:
  //   live  → #dashboard
  //   projects → #projects (with optional :id deep-link via params.id)
  //   agents → #agents (list) or #chat (when name set)
  //   metrics → #metrics (own tab; previously folded into system)
  //   sessions → #chat (deep-link only, not in primary nav)
  //   knowledge → #knowledge
  //   system → #events (events + runtime; metrics moved out)
  const inAgentChat = tab === 'agents' && !!params.name;
  document.body.classList.toggle('terminal-mode', tab === 'terminal');
  document.getElementById('dashboard').classList.toggle('hidden', tab !== 'live');
  document.getElementById('projects').classList.toggle('hidden', tab !== 'projects');
  document.getElementById('agents').classList.toggle('hidden', tab !== 'agents');
  document.getElementById('chat').classList.toggle('hidden', tab !== 'sessions' && !inAgentChat);
  document.getElementById('knowledge').classList.toggle('hidden', tab !== 'knowledge');
  // #metrics pane now serves the dedicated Metrics tab. System tab no longer renders it.
  document.getElementById('metrics').classList.toggle('hidden', tab !== 'metrics');
  document.getElementById('learning').classList.toggle('hidden', tab !== 'learning');
  document.getElementById('terminal').classList.toggle('hidden', tab !== 'terminal');
  document.getElementById('events').classList.toggle('hidden', tab !== 'system');
  // Tab highlight
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  // Surface initialization
  const needsRealtime = tab === 'live' || tab === 'sessions' || inAgentChat;
  if (typeof setRealtimeEnabled === 'function') setRealtimeEnabled(needsRealtime);
  else if (needsRealtime && typeof connectWs === 'function') connectWs();
  if (tab === 'live' && (!liveInitialized || previousTab !== 'live')) {
    liveInitialized = true;
    loadLiveness();
    loadWorkflowOverview();
    loadOverviewTasks();
    if (document.getElementById('legacy-dashboard')?.open) initializeLegacyDashboard();
  }
  if (tab === 'sessions') initChat(params.id || null);
  if (tab !== 'agents' || !inAgentChat) currentAgentChat = null;
  updateConversationStop();
  if (tab === 'agents') {
    if (params.name) initAgentChat(params.name);
    else loadAgentsTab();
  }
  if (tab === 'knowledge') {
    // Deep-link support: #/knowledge/<sub-path>. If sub-path looks like a file, view it.
    const sub = (params.path || '').replace(/^knowledge\//, '');
    if (sub && /\.[a-z0-9]+$/i.test(sub)) {
      // Show the dir tree, then load the file.
      const dir = sub.replace(/\/[^/]+$/, '');
      browsePath(dir).then(() => viewFile(sub));
    } else if (sub) {
      browsePath(sub);
    } else {
      loadKnowledge();
    }
  }
  if (tab === 'metrics') loadMetricsTab();
  if (tab === 'learning') loadLearning();
  if (tab === 'terminal') initTerminalPage();
  if (tab === 'system') {
    loadEvents();
    const workflowRunId = new URLSearchParams(location.search).get('workflowRunId');
    if (workflowRunId) loadLoopTrace({ workflowRunId });
    if (params.eventId) {
      const anchor = currentAnchorId();
      if (anchor === 'event-details' || anchor === 'event-detail-rows') {
        if (typeof _eventGraphView !== 'undefined') _eventGraphView = 'list';
        if (typeof _eventGraphDetailView !== 'undefined') _eventGraphDetailView = anchor === 'event-detail-rows' ? 'rows' : 'graph';
        loadEventGraph(params.eventId, { detail: true });
      } else {
        loadEventGraph(params.eventId);
      }
      if (!workflowRunId && anchor === 'loop-trace') loadLoopTrace(params.eventId);
    }
  }
  if (tab === 'projects') {
    // Project id deep-link: /projects/<id>
    if (params.id) {
      // params.id is the canonical id form: '<name>', '<owner>/<name>',
      // or 'shared/<name>'. Server paths are reconstructed via projectPathOf().
      _projectDetailPath = projectPathOf(params.id);
      showProjectDetail(_projectDetailPath, params.surface || 'project');
    } else {
      _projectDetailPath = null;
      loadProjects();
    }
  }
  scrollToHashAnchor();
}

window.addEventListener('popstate', render);
window.addEventListener('hashchange', () => {
  const hashRoute = routeFromHash();
  if (hashRoute) {
    history.replaceState({}, '', hashRoute);
    render();
    return;
  }
  scrollToHashAnchor();
});

// ── WebSocket pub-sub ──────────────────────────────────────────────────
// Panels can subscribe to live events flowing through /ws.
//   const off = busSubscribe('message.created', e => render(e));
//   off();  // unsubscribe
// Use '*' to receive every event.
window.__busSubs = {};
function busSubscribe(type, fn) {
  if (!window.__busSubs[type]) window.__busSubs[type] = new Set();
  window.__busSubs[type].add(fn);
  return () => { window.__busSubs[type].delete(fn); };
}
window.busSubscribe = busSubscribe;

// ── Tabs ──────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    routeTo(tab.dataset.route);
  });
});

document.addEventListener('click', (event) => {
  const anchor = event.target.closest?.('a[href]');
  if (!anchor) return;
  const href = anchor.getAttribute('href') || '';
  if (!href.startsWith('/') || href.startsWith('//')) return;
  const url = new URL(href, location.origin);
  if (url.origin !== location.origin || !isPlatformClientRoute(url.pathname)) return;
  event.preventDefault();
  routeTo(url.pathname + url.search + url.hash);
});


let _projectDetailPath = '';  // render() reads/writes this on first paint

// ── Filters ───────────────────────────────────────────────────────────
// Filter listeners removed (requests panel removed)

// ── Helpers ───────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// HTML attribute-safe escape: also escapes both quote types so the value
// can be embedded inside onclick="..." or onclick='...' without breaking
// out. Use this for any user-derived string spliced into an inline
// event handler attribute.
function attrEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function jsStringAttr(s) {
  return attrEsc(JSON.stringify(String(s ?? '')));
}

function renderMarkdownBlock(text) {
  if (window.marked?.parse) return window.marked.parse(text || '');
  return '<pre style="white-space:pre-wrap;margin:0;font-family:inherit">' + esc(text || '') + '</pre>';
}

// ── Steering verbs ──────────────────────────────────────────────────────────────
// Tiny toast for verb feedback. Honesty-of-latency: "queued at <time>".
function toast(msg, kind) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:6px;max-width:340px;pointer-events:none';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  const bg = kind === 'error' ? 'rgba(244,67,54,0.95)' : kind === 'ok' ? 'rgba(63,185,80,0.95)' : 'rgba(50,55,65,0.95)';
  el.style.cssText = `background:${bg};color:#fff;padding:8px 12px;border-radius:6px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.15s`;
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 3500);
}

async function steer(method, path, body, opts) {
  opts = opts || {};
  if (opts.confirm && !confirm(opts.confirm)) return { cancelled: true };
  try {
    const init = { method };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const res = await fetch(path, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(`✗ ${opts.label || path}: ${data.error || res.statusText}`, 'error');
      return { ok: false, error: data.error || res.statusText, status: res.status };
    }
    toast(`✓ ${opts.label || path} — queued at ${new Date().toLocaleTimeString()}`, 'ok');
    return { ok: true, data };
  } catch (e) {
    toast(`✗ ${opts.label || path}: ${e.message || e}`, 'error');
    return { ok: false, error: String(e) };
  }
}

// Verb wrappers (one per endpoint). Stop event so row clicks don't fire.
function stopEv(ev) { if (ev) { ev.stopPropagation(); ev.preventDefault(); } }

async function verbResolveAlert(alertId, ev) {
  stopEv(ev);
  const reason = prompt('Resolution note (optional):', '') ?? '';
  await steer('POST', `/api/alerts/${alertId}/resolve`, { reason }, { label: `resolve alert ${alertId}` });
  if (typeof loadMetricsTab === 'function') loadMetricsTab();
  scheduleLivenessRefresh();
}

async function verbEditThreshold(metricId, current, ev) {
  stopEv(ev);
  const raw = prompt(`New threshold for ${metricId} (current: ${current ?? '—'}):`, String(current ?? ''));
  if (raw == null) return;
  const n = Number(raw);
  if (!Number.isFinite(n)) { toast('threshold must be a number', 'error'); return; }
  await steer('POST', `/api/metrics/${encodeURIComponent(metricId)}/threshold`, { threshold: n }, { label: `threshold ${metricId}` });
  if (typeof loadMetricsTab === 'function') loadMetricsTab();
}

async function verbCancelSession(sessionId, ev) {
  stopEv(ev);
  await steer('POST', `/api/sessions/${encodeURIComponent(sessionId)}/cancel`, {}, {
    confirm: `Cancel session ${sessionId.slice(0, 12)}?`,
    label: `cancel ${sessionId.slice(0, 8)}`,
  });
  scheduleLivenessRefresh();
}

// Apply initial route from URL/hash. Each surface initializes its own data.
document.getElementById('legacy-dashboard')?.addEventListener('toggle', event => {
  if (event.currentTarget.open) initializeLegacyDashboard();
});
render();

function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return Math.floor(diff/86400000) + 'd ago';
}

function renderAlertJudgment(alert) {
  const judgment = alert?.latestJudgment;
  if (!judgment) {
    return '<div style="margin-top:5px;color:var(--yellow);font-size:11px">unjudged: owner still needs to react</div>';
  }
  const operation = judgment.operation || judgment.verdict || 'judged';
  const facts = String(judgment.facts ?? judgment.evidence ?? judgment.summary ?? '').trim();
  const clipped = facts.length > 180 ? facts.slice(0, 177) + '...' : facts;
  const when = judgment.timestamp ? timeAgo(Number(judgment.timestamp)) : 'recently';
  return '<div style="margin-top:5px;color:var(--fg2);font-size:11px;line-height:1.35">'
    + '<b>latest judgment:</b> ' + esc(operation) + ' · ' + esc(when)
    + (clipped ? '<br><span>' + esc(clipped) + '</span>' : '')
    + '</div>';
}
