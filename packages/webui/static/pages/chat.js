// ── Ask about (bridge dashboard → chat) ───────────────────────────────

function switchToChat(message) {
  // Switch to sessions tab via the router
  routeTo('/sessions');

  // Pre-fill the input with the context message
  const input = document.getElementById('chat-input');
  input.value = message;
  input.focus();
}

function askAboutRequest(r) {
  const task = (r.task || '').slice(0, 150);
  const outcome = r.outcome || r.summary || '(no outcome recorded)';
  const dur = r.durationMs ? (r.durationMs < 60000 ? Math.round(r.durationMs/1000)+'s' : Math.round(r.durationMs/60000)+'m') : '?';

  const msg = `Review this request and tell me what happened:\n` +
    `- Request: ${r.requestId.slice(0,8)}\n` +
    `- From: ${r.fromEntity} → ${r.toAgent}\n` +
    `- Task: "${task}"\n` +
    `- Status: ${r.status}, duration: ${dur}\n` +
    (r.sessionId ? `- Session: ${r.sessionId}\n` : '') +
    `- Outcome: ${outcome.slice(0,200)}\n\n` +
    `Was this handled well? What was the actual result?`;

  switchToChat(msg);
}


// ── Chat ──────────────────────────────────────────────────────────────

let ws = null;
let chatInitialized = false;
let activeSessions = [];
let currentSessionId = null;
let sessionRefreshTimer = null;
let renderMd = true; // markdown rendering on by default
let feedPaused = false;
let chatAutoScroll = true;
let feedAutoScroll = true;
let feedItems = [];

function toggleChatScroll() {
  chatAutoScroll = !chatAutoScroll;
  const btn = document.getElementById('scroll-toggle');
  if (chatAutoScroll) {
    btn.textContent = '⬇ Auto-scroll';
    btn.classList.remove('off');
    // Immediately scroll to bottom when re-enabled
    const messages = document.getElementById('chat-messages');
    messages.scrollTop = messages.scrollHeight;
  } else {
    btn.textContent = '⏸ Scroll paused';
    btn.classList.add('off');
  }
}

function chatScrollToBottom(el) {
  if (chatAutoScroll) el.scrollTop = el.scrollHeight;
}

// Smart auto-scroll: pause when user scrolls up, resume when at bottom
document.addEventListener('DOMContentLoaded', () => {
  const messages = document.getElementById('chat-messages');
  if (messages) {
    messages.addEventListener('scroll', () => {
      const atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 40;
      if (atBottom && !chatAutoScroll) {
        chatAutoScroll = true;
        const btn = document.getElementById('scroll-toggle');
        btn.textContent = '⬇ Auto-scroll';
        btn.classList.remove('off');
      } else if (!atBottom && chatAutoScroll) {
        chatAutoScroll = false;
        const btn = document.getElementById('scroll-toggle');
        btn.textContent = '⏸ Scroll paused';
        btn.classList.add('off');
      }
    });
  }

  // Smart auto-scroll for activity feed: pause when user scrolls up, resume at bottom
  const feedList = document.getElementById('feed-list');
  if (feedList) {
    feedList.addEventListener('scroll', () => {
      const atBottom = feedList.scrollHeight - feedList.scrollTop - feedList.clientHeight < 40;
      if (atBottom && !feedAutoScroll) {
        feedAutoScroll = true;
        const btn = document.getElementById('feed-scroll-toggle');
        if (btn) { btn.textContent = '⬇ Auto-scroll'; btn.classList.remove('off'); }
      } else if (!atBottom && feedAutoScroll) {
        feedAutoScroll = false;
        const btn = document.getElementById('feed-scroll-toggle');
        if (btn) { btn.textContent = '⏸ Scroll paused'; btn.classList.add('off'); }
      }
    });
  }
});

function toggleFeedPause() {
  feedPaused = !feedPaused;
  document.getElementById('feed-pause-btn').textContent = feedPaused ? '▶ Resume' : '⏸ Pause';
}

function toggleFeedScroll() {
  feedAutoScroll = !feedAutoScroll;
  const btn = document.getElementById('feed-scroll-toggle');
  if (feedAutoScroll) {
    btn.textContent = '⬇ Auto-scroll';
    btn.classList.remove('off');
    // Immediately scroll to bottom when re-enabled
    const feedList = document.getElementById('feed-list');
    if (feedList) feedList.scrollTop = feedList.scrollHeight;
  } else {
    btn.textContent = '⏸ Scroll paused';
    btn.classList.add('off');
  }
}

function addFeedItem(agent, text, type) {
  const now = new Date();
  const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0');
  const agentClass = 'feed-agent-' + (agent || '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const typeClass = 'feed-type-' + (type || '').replace(/[^a-z0-9-]/gi, '-');

  const item = { agent, text, type, time: timeStr };
  feedItems.push(item);

  const feedList = document.getElementById('feed-list');
  if (!feedList) return;

  const div = document.createElement('div');
  div.className = 'feed-item ' + typeClass;
  div.innerHTML = '<span class="feed-time">' + esc(timeStr) + '</span>' +
    '<span class="feed-agent ' + agentClass + '">' + esc(agent || '') + '</span>' +
    '<span class="feed-text">' + esc(text || '') + '</span>';
  feedList.appendChild(div);

  // Trim to max 50 items
  while (feedItems.length > 50) {
    feedItems.shift();
    if (feedList.firstChild) feedList.removeChild(feedList.firstChild);
  }

  // Auto-scroll if enabled and not paused
  if (feedAutoScroll && !feedPaused) {
    feedList.scrollTop = feedList.scrollHeight;
  }
}

function setSessionPageMode(enabled) {
  const chat = document.getElementById('chat');
  if (chat) chat.classList.toggle('session-page-mode', !!enabled);
  const status = document.getElementById('chat-status');
  const input = document.getElementById('chat-input');
  if (status && enabled) status.textContent = 'Follow up on this session';
  if (input && enabled) input.placeholder = 'Send follow-up to this session...';
  if (!enabled) {
    clearTimeout(sessionRefreshTimer);
    currentInspectedSession = null;
    const panel = document.getElementById('session-detail-panel');
    if (panel) panel.innerHTML = '';
    restoreChatComposer();
  }
}

function restoreChatComposer() {
  const host = document.getElementById('chat-composer-host');
  const composer = document.querySelector('#chat .chat-container');
  if (host && composer && composer.parentElement !== host) host.appendChild(composer);
}

function placeSessionComposer() {
  const anchor = document.getElementById('session-followup-anchor');
  const composer = document.querySelector('#chat .chat-container');
  if (anchor && composer && composer.parentElement !== anchor) anchor.appendChild(composer);
}

function scheduleSessionConversationRefresh(delay = 600) {
  if (!isSessionPageMode() || !currentInspectedSession) return;
  clearTimeout(sessionRefreshTimer);
  sessionRefreshTimer = setTimeout(() => {
    const sessionId = currentInspectedSession;
    loadSessionDetail(sessionId, { preserveScroll: true });
  }, delay);
}

function initChat(deepLinkSessionId) {
  if (!chatInitialized) {
    chatInitialized = true;
    // WS is now connected on page load; no need to call connectWs() here
  }
  setSessionPageMode(!!deepLinkSessionId);
  // Hide the agent-chat banner when entering plain sessions mode.
  const banner = document.getElementById('chat-agent-banner');
  if (banner) banner.style.display = 'none';
  // Honor deep-link first. The inspector is the visible conversation stream;
  // switchSession only binds input/subscription and its message list is hidden in session-page mode.
  if (deepLinkSessionId && deepLinkSessionId !== currentSessionId) {
    switchSession(deepLinkSessionId);
    loadSessionDetail(deepLinkSessionId);
    return;
  } else if (deepLinkSessionId) {
    renderSessionPicker();
    loadSessionDetail(deepLinkSessionId);
    return;
  } else {
    const sessionDetailPanel = document.getElementById('session-detail-panel');
    if (sessionDetailPanel) sessionDetailPanel.innerHTML = '';
  }
  // Default-session resolution: if nothing selected, pick the most-recent
  // open non-heartbeat / non-worker session per agent. Per webui.md §5.
  // The bus updates `activeSessions` continuously via session.start/end —
  // this is the only place we read it for default selection.
  if (!currentSessionId && Array.isArray(activeSessions) && activeSessions.length) {
    const candidates = activeSessions.filter(s => {
      if (s.status !== 'running' && s.status !== 'idle') return false;
      if (currentAgentChat && s.agent !== currentAgentChat) return false;
      const task = String(s.task || '').toLowerCase();
      const kind = String(s.kind || '').toLowerCase();
      // Skip heartbeat and worker-pattern sessions — those are not for chat.
      if (kind === 'heartbeat' || kind === 'worker') return false;
      if (task.startsWith('[heartbeat]')) return false;
      if (task.includes('waking up for your heartbeat')) return false;
      return true;
    });
    if (candidates.length) {
      // Most-recent first — use startedAt if present, else first in the array.
      candidates.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      switchSession(candidates[0].sessionId);
    }
  }
}

function toggleMarkdown() {
  renderMd = !renderMd;
  document.getElementById('md-toggle').textContent = renderMd ? 'Raw' : 'Markdown';
  document.querySelectorAll('.msg.assistant').forEach(el => {
    const raw = el.dataset.raw;
    if (!raw) return;
    if (renderMd && window.marked && window.marked.parse) {
      el.innerHTML = window.marked.parse(raw);
      el.classList.add('md-rendered');
    } else {
      el.textContent = raw;
      el.classList.remove('md-rendered');
    }
  });
}

function linkifyRefs(html) {
  if (!html) return html;
  // KE-NNN, H-NNN, EXP-NNN — route to knowledge surface so deep links work cross-pane.
  html = html.replace(/\b(KE-\d+)\b/g, '<a href="#/knowledge/entries/$1.md" onclick="event.stopPropagation()">$1</a>');
  html = html.replace(/\b(H-\d+)\b/g, '<a href="#/knowledge/hypotheses/$1.md" onclick="event.stopPropagation()">$1</a>');
  html = html.replace(/\b(EXP-\d+)\b/g, '<a href="#/knowledge/experiments/$1.md" onclick="event.stopPropagation()">$1</a>');
  return html;
}

function renderAssistantMsg(el, text) {
  el.dataset.raw = text;
  if (renderMd && window.marked && window.marked.parse) {
    el.innerHTML = linkifyRefs(window.marked.parse(text));
    el.classList.add('md-rendered');
  } else {
    el.textContent = text;
    el.classList.remove('md-rendered');
  }
}

function isSessionPageMode() {
  return !!document.getElementById('chat')?.classList.contains('session-page-mode');
}

function renderSessionPicker() {
  const picker = document.getElementById('session-picker');
  if (!picker) return;
  if (isSessionPageMode()) {
    picker.innerHTML = '';
    return;
  }
  const seen = new Set();
  // Show running AND idle chat sessions (idle = waiting for next message)
  const visible = activeSessions.filter(s => {
    if (seen.has(s.sessionId)) return false;
    if (s.status !== 'running' && !(s.status === 'idle' && s.kind === 'chat')) return false;
    if (currentAgentChat && s.agent !== currentAgentChat) return false;
    seen.add(s.sessionId);
    return true;
  });
  let html = '<button class="ask-btn" style="' + (!currentSessionId ? 'border-color:var(--accent);color:var(--accent)' : '') + '" onclick="switchSession(null)">💬 Chat</button> ';
  for (const s of visible) {
    const isActive = currentSessionId === s.sessionId;
    const color = isActive ? 'border-color:var(--accent);color:var(--accent)' : '';
    const label = s.agent + ' (' + s.sessionId.slice(-6) + ')';
    const task = (s.task || '').slice(0, 80);
    const statusIcon = s.status === 'idle' ? '💤 ' : '';
    html += `<span class="session-pill" style="display:inline-flex;align-items:center;gap:0;margin-right:4px"><button class="ask-btn" style="${color};border-top-right-radius:0;border-bottom-right-radius:0;border-right:none" onclick="switchSession('${s.sessionId}')" title="${esc(task)}">${statusIcon}${label}</button><button class="ask-btn" style="${color};border-top-left-radius:0;border-bottom-left-radius:0;padding:2px 6px" onclick="verbCancelSession('${s.sessionId}', event)" title="Cancel session">✕</button></span>`;
  }
  if (currentSessionId && !visible.some(s => s.sessionId === currentSessionId)) {
    const label = currentAgentChat ? `${currentAgentChat} (${currentSessionId.slice(-6)})` : currentSessionId;
    html += `<button class="ask-btn" style="border-color:var(--accent);color:var(--accent)" onclick="switchSession('${currentSessionId}')" title="${esc(currentSessionId)}">${esc(label)}</button> `;
  } else if (visible.length === 0) {
    html += '<span style="color:var(--fg2);font-size:11px">No active sessions</span>';
  }
  picker.innerHTML = html;
  const target = visible.find(s => s.sessionId === currentSessionId);
  document.getElementById('chat-input').placeholder = currentSessionId
    ? `Steer ${target?.agent || 'session'}...`
    : 'Type a message...';
}

async function switchSession(sessionId) {
  currentSessionId = sessionId;
  if (currentAgentChat) setAgentChatSessionId(sessionId);
  const messages = document.getElementById('chat-messages');
  messages.innerHTML = '';

  if (sessionId && !isSessionPageMode()) {
    // Load transcript history for chat/agent-chat mode. On #/sessions/:id, the
    // inspector Conversation section is the visible stream, so this duplicate
    // message list stays empty and hidden.
    try {
      const resp = await fetch(`/api/sessions/${sessionId}/transcript`);
      if (resp.ok) {
        const data = await resp.json();
        const transcript = data.messages || data;
        const transData = Array.isArray(transcript)
          ? { sessionId, messageCount: transcript.length, messages: transcript }
          : data;
        messages.innerHTML = renderSessionConversation(transData, { embedded: true, showTitle: false });
      }
    } catch {}
    chatScrollToBottom(messages);
  }

  renderSessionPicker();
  // Tell the server to switch subscription
  if (ws && ws.readyState === 1) {
    if (sessionId) {
      ws.send(JSON.stringify({ type: 'subscribe', sessions: [sessionId] }));
    } else {
      // Chat mode — server auto-tracks the active chat session + children
      ws.send(JSON.stringify({ type: 'subscribe', sessions: ['chat'] }));
    }
  }
}

function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  const status = document.getElementById('chat-status');
  const messages = document.getElementById('chat-messages');

  ws.onopen = () => {
    status.textContent = 'Connected';
    // Poll for active sessions periodically
    const pollSessions = () => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'status' }));
    };
    pollSessions();
    setInterval(pollSessions, 15000);
  };
  ws.onclose = () => {
    status.textContent = 'Disconnected — reconnecting...';
    setTimeout(connectWs, 3000);
  };
  ws.onerror = () => { status.textContent = 'Connection error'; };

  let currentAssistant = null;
  let currentAssistantRaw = ''; // accumulate raw text for markdown rendering

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      const eventType = typeof event.type === 'string' ? event.type.replace(/\./g, '_') : event.type;

      // Live event pub-sub: panels subscribe via window.busSubscribe(type, fn)
      // and get the raw (unmangled) event. Type matches AgentEvent shape:
      // 'session.start', 'session.end', 'message.created', 'metric.breach', etc.
      if (typeof event.type === 'string' && window.__busSubs) {
        const subs = window.__busSubs[event.type];
        if (subs) for (const fn of subs) { try { fn(event); } catch (err) { console.error('bus sub err', err); } }
        const all = window.__busSubs['*'];
        if (all) for (const fn of all) { try { fn(event); } catch (err) { console.error('bus * sub err', err); } }
      }

      // The session inspector is a read model. Rebuilding it for every
      // streamed text/tool event makes the page appear to refresh constantly,
      // especially while evaluator sessions are running. Only refresh
      // the inspected session at stable lifecycle boundaries.
      if (isSessionPageMode()
        && event.sessionId === currentInspectedSession
        && (eventType === 'turn_end' || eventType === 'session_end')) {
        scheduleSessionConversationRefresh(300);
      }

      switch (eventType) {
        case 'text':
          if (!currentAssistant) {
            currentAssistant = document.createElement('div');
            currentAssistant.className = 'msg assistant';
            currentAssistantRaw = '';
            messages.appendChild(currentAssistant);
          }
          currentAssistantRaw += event.text;
          renderAssistantMsg(currentAssistant, currentAssistantRaw);
          chatScrollToBottom(messages);
          break;
        case 'tool_call': {
          currentAssistant = null;
          currentAssistantRaw = '';
          const div = document.createElement('div');
          div.className = 'msg tool_call';
          const argsStr = typeof event.args === 'string' ? event.args : JSON.stringify(event.args);
          div.textContent = `⚡ ${event.tool}(${argsStr.slice(0, 200)})`;
          messages.appendChild(div);
          chatScrollToBottom(messages);
          break;
        }
        case 'tool_result': {
          const div = document.createElement('div');
          div.className = `msg tool_result ${event.isError ? 'error' : ''}`;
          div.textContent = event.preview || '';
          messages.appendChild(div);
          chatScrollToBottom(messages);
          break;
        }
        case 'turn_end':
          currentAssistant = null;
          currentAssistantRaw = '';
          break;
        case 'session_start': {
          // Show delegation: "→ tech-lead: <task>"
          if (event.parentSessionId) {
            const div = document.createElement('div');
            div.className = 'msg';
            div.style.color = 'var(--purple)';
            div.style.fontSize = '12px';
            div.textContent = `→ ${event.agent}: ${(event.task || '').slice(0, 100)}`;
            messages.appendChild(div);
            chatScrollToBottom(messages);
          }
          // Update session picker
          if (event.sessionId && !activeSessions.find(s => s.sessionId === event.sessionId)) {
            activeSessions.push({ agent: event.agent, sessionId: event.sessionId, status: 'running', task: event.task });
            renderSessionPicker();
          }
          addFeedItem(event.agent, 'started session: ' + (event.task || '').slice(0, 80), 'start');
          scheduleLivenessRefresh();
          break;
        }
        case 'session_end': {
          const div = document.createElement('div');
          div.className = 'msg';
          div.style.color = 'var(--fg2)';
          div.style.fontSize = '12px';
          div.textContent = `✓ ${event.agent}: ${event.status}${event.duration ? ' (' + event.duration + ')' : ''}`;
          messages.appendChild(div);
          chatScrollToBottom(messages);
          // Update session picker
          activeSessions = activeSessions.filter(s => s.sessionId !== event.sessionId);
          renderSessionPicker();
          addFeedItem(event.agent, 'finished (' + (event.status || '?') + (event.duration ? ', ' + event.duration : '') + ')', event.status === 'error' ? 'end-error' : 'end-good');
          scheduleLivenessRefresh();
          break;
        }
        case 'message_created':
          {
            const message = event.data || event;
            addFeedItem(message.from || event.source || 'message', (message.content || message.message || '').slice(0, 120), 'notification');
          }
          scheduleLivenessRefresh();
          break;
        case 'metric_breach':
          addFeedItem(event.owner || 'metric', (event.metricId || 'metric') + ' breached', 'notification');
          scheduleLivenessRefresh();
          break;
        case 'metric_recovered':
          addFeedItem('metric', (event.metricId || 'metric') + ' recovered', 'end-good');
          scheduleLivenessRefresh();
          break;
        case 'handler_failed':
          addFeedItem(event.agent || event.handler || 'handler', (event.error || 'handler failed').slice(0, 120), 'end-error');
          scheduleLivenessRefresh();
          break;
        case 'notification': {
          const div = document.createElement('div');
          div.className = 'msg';
          div.style.borderLeft = '3px solid var(--yellow)';
          div.style.paddingLeft = '8px';
          div.style.fontSize = '12px';
          div.textContent = `📋 ${event.agent}: ${event.text.slice(0, 300)}`;
          messages.appendChild(div);
          chatScrollToBottom(messages);
          addFeedItem(event.agent, event.text?.slice(0, 120) || '', 'notification');
          break;
        }
        case 'connected':
          status.textContent = `Connected — ${event.agent} (${event.instance})`;
          activeSessions = event.activeAgents || [];
          renderSessionPicker();
          // Auto-attach to existing chat session (preserves conversation across refreshes)
          if (!currentSessionId) {
            const chatSession = activeSessions.find(s => s.agent === 'may' && (s.status === 'running' || (s.status === 'idle' && s.kind === 'chat')));
            if (chatSession) {
              switchSession(chatSession.sessionId);
            } else {
              // No chat session yet — use chat mode so server auto-tracks it when it appears
              ws.send(JSON.stringify({ type: 'subscribe', sessions: ['chat'] }));
            }
          }
          break;
        case 'status':
          // Update active sessions from periodic poll
          if (event.activeAgents) {
            activeSessions = event.activeAgents;
            renderSessionPicker();
            // Auto-attach to chat session if we don't have one
            if (!currentSessionId) {
              const chatSession = activeSessions.find(s => s.agent === 'may' && (s.status === 'running' || (s.status === 'idle' && s.kind === 'chat')));
              if (chatSession) {
                switchSession(chatSession.sessionId);
              }
            }
          }
          break;
      }
    } catch {}
  };
}

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg || !ws || ws.readyState !== 1) return;

  // Show user message
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg user';
  div.textContent = msg;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight; // Always scroll for user's own messages
  // Re-enable auto-scroll when user sends a message (they want to see the response)
  if (!chatAutoScroll) {
    chatAutoScroll = true;
    const btn = document.getElementById('scroll-toggle');
    btn.textContent = '⬇ Auto-scroll';
    btn.classList.remove('off');
  }

  if (currentSessionId) {
    // Steer the selected session (works for running, idle, and — via 3b
    // cold-resume — done/error/interrupted sessions too).
    ws.send(JSON.stringify({ type: 'steer', sessionId: currentSessionId, message: msg }));
  } else if (currentAgentChat) {
    // Telegram-style: agent chat with no session yet. POST spawns one.
    const newParam = forceNewAgentChat ? '?new=true' : '';
    forceNewAgentChat = false;
    fetch('/api/agents/' + encodeURIComponent(currentAgentChat) + '/message' + newParam, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ content: msg }),
    }).then(r => r.json()).then(d => {
      // After spawn, re-resolve default session so the WS subscribes properly.
      if (d.sessionId) switchSession(d.sessionId);
      else setTimeout(() => initAgentChat(currentAgentChat), 800);
    }).catch(e => toast('Failed: ' + e.message));
  } else {
    // Chat mode — input to the interface agent
    ws.send(JSON.stringify({ type: 'input', message: msg }));
  }
  input.value = '';
}

document.getElementById('chat-send').addEventListener('click', sendChat);

function resetAgentChat(name) {
  currentSessionId = null;
  forceNewAgentChat = true;
  setAgentChatSessionId(null);
  const messages = document.getElementById('chat-messages');
  if (messages) messages.innerHTML = '<div style="color:var(--fg2);font-size:13px;padding:24px;text-align:center">Chat cleared. Send a message to start a new conversation with <b>' + esc(name) + '</b>.</div>';
  document.getElementById('chat-input').placeholder = 'Type a message to start fresh...';
  renderSessionPicker();
}
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
