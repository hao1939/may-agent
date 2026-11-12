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
let realtimeEnabled = false;
let wsPollTimer = null;
let wsReconnectTimer = null;
let chatInitialized = false;
let activeSessions = [];
let currentSessionId = null;
// Routes, subtabs, resets and explicit selections invalidate pending chat work.
let chatSelectionVersion = 0;
let chatTranscript = null;
let chatPendingInput = null;
let sessionRefreshTimer = null;
let chatAutoScroll = true;

function clearChatTranscript() {
  clearTimeout(chatTranscript?.timer);
  chatTranscript = null;
}

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
});

function setSessionPageMode(enabled) {
  clearChatTranscript();
  clearTimeout(sessionRefreshTimer);
  sessionRefreshTimer = null;
  const chat = document.getElementById('chat');
  if (chat) chat.classList.toggle('session-page-mode', !!enabled);
  const status = document.getElementById('chat-status');
  const input = document.getElementById('chat-input');
  if (status && enabled) status.textContent = 'Follow up on this session';
  if (input && enabled) input.placeholder = 'Send follow-up to this session...';
  if (!enabled) {
    currentInspectedSession = null;
    restoreChatComposer();
    const panel = document.getElementById('session-detail-panel');
    if (panel) panel.innerHTML = '';
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
  const sessionId = currentRouteParams.id;
  if (!isSessionPageMode() || currentInspectedSession !== sessionId) return;
  clearTimeout(sessionRefreshTimer);
  sessionRefreshTimer = setTimeout(() => {
    if (isSessionPageMode() && currentRouteParams.id === sessionId) {
      loadSessionDetail(sessionId, { preserveScroll: true });
    }
  }, delay);
}

function initChat(deepLinkSessionId) {
  if (!chatInitialized) {
    chatInitialized = true;
    // WS is now connected on page load; no need to call connectWs() here
  }
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
      const kind = String(s.kind || '').toLowerCase();
      const source = String(s.source || '').toLowerCase();
      // Skip explicitly typed heartbeat and worker sessions; task prose is not
      // a lifecycle or presentation classifier.
      if (kind === 'heartbeat' || kind === 'worker' || source === 'heartbeat') return false;
      return true;
    });
    if (candidates.length) {
      // Most-recent first — use startedAt if present, else first in the array.
      candidates.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      switchSession(candidates[0].sessionId);
    }
  }
}

function linkifyRefs(html) {
  if (!html) return html;
  // KE-NNN — route to knowledge surface so deep links work cross-pane.
  html = html.replace(/\b(KE-\d+)\b/g, '<a href="#/knowledge/entries/$1.md" onclick="event.stopPropagation()">$1</a>');
  return html;
}

function isSessionPageMode() {
  return currentTab === 'sessions' && !!currentRouteParams.id;
}

function renderSessionPicker() {
  const picker = document.getElementById('session-picker');
  if (!picker) return;
  if (isMayConversation() || isSessionPageMode()) {
    picker.innerHTML = '';
    if (isMayConversation()) document.getElementById('chat-input').placeholder = 'Talk with May…';
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

function syncRealtimeSubscriptions() {
  if (ws?.readyState !== WebSocket.OPEN) return;
  const conversation = isMayConversation();
  let sessions = [];
  if (currentTab === 'live' || conversation) sessions = ['*'];
  else if (isSessionPageMode()) sessions = [currentRouteParams.id];
  else if (isAgentChatActive(currentAgentChat)) sessions = currentSessionId ? [currentSessionId] : [];
  else if (currentTab === 'sessions') sessions = [currentSessionId || 'chat'];
  ws.send(JSON.stringify({
    type: 'subscribe', sessions,
    conversations: conversation ? [humanInterface.conversationId] : [],
  }));
}

async function switchSession(sessionId) {
  chatSelectionVersion++;
  currentSessionId = sessionId;
  if (currentAgentChat) setAgentChatSessionId(sessionId);
  const messages = document.getElementById('chat-messages');
  messages.innerHTML = '';
  clearChatTranscript();
  if (sessionId && !isSessionPageMode()) chatTranscript = { sessionId, read: null, dirty: false, timer: null };
  renderSessionPicker();
  syncRealtimeSubscriptions();
  return refreshChatTranscript();
}

function refreshChatTranscript() {
  const view = chatTranscript;
  const selected = () => chatTranscript === view;
  if (!view || !selected()) return Promise.resolve();
  if (view.read) { view.dirty = true; return view.read; }
  // Saved transcript is the only message renderer. A turn ending during a
  // read marks it dirty, so the next read includes the intervening saved turn.
  view.read = (async () => {
    do {
      view.dirty = false;
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(view.sessionId)}/transcript`, { signal: AbortSignal.timeout(5000) });
        const data = await response.json();
        if (!selected()) return;
        if (view.dirty) continue;
        if (!response.ok) throw new Error(data.error || 'Transcript unavailable');
        const transcript = data.messages || data;
        const transData = Array.isArray(transcript) ? { sessionId: view.sessionId, messages: transcript } : data;
        const messages = document.getElementById('chat-messages');
        messages.innerHTML = renderSessionConversation(transData, { embedded: true, showTitle: false });
        chatScrollToBottom(messages);
      } catch (error) {
        if (selected()) document.getElementById('chat-status').textContent = error.message;
      }
    } while (view.dirty && selected());
  })().finally(() => { view.read = null; });
  return view.read;
}

function scheduleChatTranscriptRefresh() {
  const view = chatTranscript;
  if (!view) return;
  if (view.read) { view.dirty = true; return; }
  clearTimeout(view.timer);
  view.timer = setTimeout(() => {
    if (chatTranscript === view) void refreshChatTranscript();
  }, 300);
}

function setRealtimeEnabled(enabled) {
  realtimeEnabled = !!enabled;
  clearTimeout(wsReconnectTimer);
  wsReconnectTimer = null;
  if (realtimeEnabled) {
    connectWs();
    syncRealtimeSubscriptions();
    return;
  }
  clearInterval(wsPollTimer);
  wsPollTimer = null;
  const socket = ws;
  ws = null;
  if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
}

function connectWs() {
  if (!realtimeEnabled) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const reconnecting = !!wsReconnectTimer;
  wsReconnectTimer = null;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${proto}//${location.host}/ws`);
  ws = socket;
  const status = document.getElementById('chat-status');

  socket.onopen = () => {
    if (ws !== socket) return socket.close();
    status.textContent = 'Connected';
    syncRealtimeSubscriptions();
    if (isMayConversation()) {
      void refreshMayConversation();
    } else if (reconnecting) {
      if (currentTab === 'live') scheduleLivenessRefresh();
      else void refreshChatTranscript();
    }
    // Poll for active sessions periodically
    const pollSessions = () => {
      if (ws === socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'status' }));
    };
    pollSessions();
    clearInterval(wsPollTimer);
    wsPollTimer = setInterval(pollSessions, 15000);
  };
  socket.onclose = () => {
    if (ws !== socket) return;
    ws = null;
    updateConversationStop();
    clearInterval(wsPollTimer);
    wsPollTimer = null;
    if (!realtimeEnabled) return;
    status.textContent = 'Disconnected — reconnecting...';
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(connectWs, 3000);
  };
  socket.onerror = () => { if (ws === socket) status.textContent = 'Connection error'; };

  socket.onmessage = (e) => {
    if (ws !== socket) return;
    try {
      const event = JSON.parse(e.data);
      const eventType = typeof event.type === 'string' ? event.type.replace(/\./g, '_') : event.type;
      const data = event && typeof event.data === 'object' && event.data !== null && !Array.isArray(event.data)
        ? event.data
        : event;

      // Live event pub-sub: panels subscribe via window.busSubscribe(type, fn)
      // and get the raw (unmangled) event. Type matches AgentEvent shape:
      // 'session.start', 'session.end', 'message.created', 'metric.breach', etc.
      if (typeof event.type === 'string' && window.__busSubs) {
        const subs = window.__busSubs[event.type];
        if (subs) for (const fn of subs) { try { fn(event); } catch (err) { console.error('bus sub err', err); } }
        const all = window.__busSubs['*'];
        if (all) for (const fn of all) { try { fn(event); } catch (err) { console.error('bus * sub err', err); } }
      }

      if (isMayConversation() && event.type === 'conversation.updated'
        && data.appId === humanInterface.appId && data.conversationId === humanInterface.conversationId) {
        void refreshMayConversation();
      }

      // Notifications wake the current read model; they never write messages.
      if (data.sessionId && (eventType === 'turn_end' || eventType === 'session_end')) {
        if (isSessionPageMode() && data.sessionId === currentInspectedSession) scheduleSessionConversationRefresh(300);
        else if (data.sessionId === chatTranscript?.sessionId) scheduleChatTranscriptRefresh();
      }

      switch (eventType) {
        case 'connected':
        case 'status':
          if (event.activeAgents) {
            activeSessions = event.activeAgents;
            renderSessionPicker();
            if (currentTab === 'sessions' && !currentRouteParams.id && !currentSessionId) {
              const chatSession = activeSessions.find(s => s.agent === humanInterface.agent && (s.status === 'running' || (s.status === 'idle' && s.kind === 'chat')));
              if (chatSession) void switchSession(chatSession.sessionId);
            }
          }
          break;
        case 'session_start':
          if (data.sessionId && !activeSessions.some(s => s.sessionId === data.sessionId)) {
            activeSessions.push(data);
            renderSessionPicker();
          }
          scheduleLivenessRefresh();
          break;
        case 'session_end':
          activeSessions = activeSessions.filter(s => s.sessionId !== data.sessionId);
          renderSessionPicker();
          scheduleLivenessRefresh();
          break;
        case 'message_created':
        case 'metric_breach':
        case 'metric_recovered':
        case 'handler_failed':
          scheduleLivenessRefresh();
          break;
      }
    } catch {}
  };
}

async function sendChat() {
  if (isMayConversation()) return sendMayConversation();
  const input = document.getElementById('chat-input');
  const draft = input.value;
  const message = draft.trim();
  if (!message) return;
  const route = currentRouteParams;
  const name = isAgentChatActive(currentAgentChat) ? currentAgentChat : null;
  const sessionId = isSessionPageMode() ? currentRouteParams.id : currentSessionId;
  if (!sessionId && (!name || name === humanInterface.agent) && !humanInterface.appId) {
    toast('No Conversation App is configured');
    return;
  }
  const target = sessionId ? `session:${sessionId}` : name ? `agent:${name}` : `app:${humanInterface.appId}`;
  // Retrying an unchanged explicit-target draft after an unknown HTTP outcome
  // retains publication identity. A different target or draft is a new input.
  if (chatPendingInput?.draft !== draft || chatPendingInput?.target !== target) {
    chatPendingInput = { draft, target, id: `web-ui:${crypto.randomUUID()}`, sending: false };
  }
  const pending = chatPendingInput;
  if (pending.sending) return;
  pending.sending = true;
  let selection = chatSelectionVersion;
  let admittedSession = null;
  try {
    if (sessionId) {
      await publishChatEvent({
        type: 'session.steer.requested', target: { sessionId },
        data: { message }, idempotencyKey: pending.id,
      });
    } else if (name && name !== humanInterface.agent) {
      selection = ++chatSelectionVersion;
      const response = await fetch('/api/agents/' + encodeURIComponent(name) + '/message' + (forceNewAgentChat ? '?new=true' : ''), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }), signal: AbortSignal.timeout(10000),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Message admission failed');
      admittedSession = result.sessionId;
    } else {
      await publishChatEvent({
        type: 'app.input.requested', target: { appId: humanInterface.appId },
        data: { input: { kind: 'message', data: { message } }, channel: 'web-ui', conversationId: humanInterface.conversationId },
        idempotencyKey: pending.id,
      });
    }
    if (chatPendingInput === pending) chatPendingInput = null;
    if (currentRouteParams !== route || selection !== chatSelectionVersion) return;
    if (input.value === draft) input.value = '';
    if (!chatAutoScroll) toggleChatScroll();
    document.getElementById('chat-status').textContent = 'Message accepted; waiting for the saved turn';
    if (name && !sessionId && name !== humanInterface.agent) {
      forceNewAgentChat = false;
      if (admittedSession) void switchSession(admittedSession);
      else setTimeout(() => {
        if (selection === chatSelectionVersion && isAgentChatActive(name)) void loadAgentChatThread(name);
      }, 800);
    }
  } catch (error) {
    if (currentRouteParams === route && selection === chatSelectionVersion) toast('Message was not confirmed: ' + error.message);
  } finally {
    pending.sending = false;
  }
}

document.getElementById('chat-send').addEventListener('click', sendChat);

function resetAgentChat(name) {
  chatSelectionVersion++;
  clearChatTranscript();
  currentSessionId = null;
  forceNewAgentChat = true;
  syncRealtimeSubscriptions();
  setAgentChatSessionId(null);
  const messages = document.getElementById('chat-messages');
  if (messages) messages.innerHTML = '<div style="color:var(--fg2);font-size:13px;padding:24px;text-align:center">Chat cleared. Send a message to start a new conversation with <b>' + esc(name) + '</b>.</div>';
  document.getElementById('chat-input').placeholder = 'Type a message to start fresh...';
  renderSessionPicker();
}
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});
